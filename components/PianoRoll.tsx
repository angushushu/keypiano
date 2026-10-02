import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Undo2, Redo2, Trash2, Square, Minus, Plus } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { midiNumberToNote } from '../constants';
import { createTakeId } from '../services/takeStore';
import { eventsToRollNotes, moveRollNotes, resizeRollNote, resizeRollNotes, rollNotesToEvents, selectRollNotes, snapTime, type RollNote, type RollPoint } from '../services/pianoRoll';
import type { RecordedEvent } from '../types';

const ROW = 22;
const LABEL = 56;
const RULER = 28;
const PITCHES = Array.from({ length: 128 }, (_, row) => 127 - row);

interface Props {
    events: RecordedEvent[];
    currentTime: number;
    bpm: number;
    isRecording: boolean;
    isPlaying: boolean;
    autoCapture: boolean;
    onAutoCapture: (value: boolean) => void;
    onChange: (events: RecordedEvent[]) => void;
    onStopRecording: () => void;
    onExport: () => void;
}

interface GridPoint extends RollPoint { x: number; y: number }

interface GestureBase {
    pointer: number;
    x: number;
    y: number;
    previousSelection: Set<string>;
    changed: boolean;
}

interface EditGesture extends GestureBase {
    mode: 'move' | 'resize' | 'add';
    note: RollNote;
    selection: Set<string>;
    base: RollNote[];
    result: RollNote[];
}

interface SelectionGesture extends GestureBase {
    mode: 'select';
    start: GridPoint;
    additive: boolean;
}

type Gesture = EditGesture | SelectionGesture;

export default function PianoRoll({ events, currentTime, bpm, isRecording, isPlaying, autoCapture, onAutoCapture, onChange, onStopRecording, onExport }: Props) {
    const { theme, t } = useSettings();
    const { currentInstrument, keyVelocity } = useSynth();
    const scrollRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const gestureRef = useRef<Gesture | null>(null);
    const past = useRef<RecordedEvent[][]>([]);
    const future = useRef<RecordedEvent[][]>([]);
    const ownedEvents = useRef(events);
    const [, refreshHistory] = useState(0);
    const [selection, setSelection] = useState<Set<string>>(() => new Set());
    const [marquee, setMarquee] = useState<{ start: GridPoint; end: GridPoint } | null>(null);
    const [draft, setDraft] = useState<RollNote[] | null>(null);
    const [division, setDivision] = useState(4);
    const [beatWidth, setBeatWidth] = useState(80);
    const [viewport, setViewport] = useState({ left: 0, top: 0, width: 1000, height: 500 });
    const beatMs = 60_000 / bpm;
    const step = division ? beatMs / division : 0;
    const pxPerMs = beatWidth / beatMs;
    const locked = isRecording || isPlaying;
    // The mutable live event buffer is rendered on the recording timer tick.
    const liveTime = isRecording ? currentTime : 0;
    const notes = useMemo(() => eventsToRollNotes(events, liveTime), [events, liveTime]);
    const shown = draft ?? notes;
    const end = shown.reduce((max, note) => Math.max(max, note.end), currentTime);
    const width = Math.max(viewport.width - LABEL, 16 * beatWidth, (Math.ceil(end / (4 * beatMs)) * 4 + 8) * beatWidth);
    const firstBeat = Math.max(0, Math.floor((viewport.left - LABEL) / beatWidth) - 1);
    const lastBeat = Math.min(Math.ceil(width / beatWidth), firstBeat + Math.ceil(viewport.width / beatWidth) + 3);
    const visible = shown.filter(note => {
        const y = (127 - note.pitch) * ROW + RULER;
        return y + ROW >= viewport.top && y <= viewport.top + viewport.height
            && LABEL + note.end * pxPerMs >= viewport.left && LABEL + note.start * pxPerMs <= viewport.left + viewport.width;
    });

    const clearGesture = useCallback((restoreSelection = false) => {
        const gesture = gestureRef.current;
        gestureRef.current = null;
        setDraft(null);
        setMarquee(null);
        if (restoreSelection && gesture) setSelection(gesture.previousSelection);
        if (gesture && gridRef.current?.hasPointerCapture(gesture.pointer)) gridRef.current.releasePointerCapture(gesture.pointer);
    }, []);

    useEffect(() => {
        if (locked && gestureRef.current) clearGesture(true);
    }, [locked, clearGesture]);

    useEffect(() => {
        if (events === ownedEvents.current || isRecording) return;
        ownedEvents.current = events;
        past.current = [];
        future.current = [];
        clearGesture();
        setSelection(new Set());
        refreshHistory(value => value + 1);
    }, [events, isRecording, clearGesture]);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;
        let previousHeight = element.clientHeight;
        const sync = () => {
            if (previousHeight !== element.clientHeight) element.scrollTop = Math.max(0, element.scrollTop + (previousHeight - element.clientHeight) / 2);
            previousHeight = element.clientHeight;
            setViewport({ left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight });
        };
        // Centre the first loaded phrase, or middle C for a blank arrangement.
        const centre = notes.length ? Math.round(notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length) : 60;
        element.scrollTop = Math.max(0, (127 - centre) * ROW - element.clientHeight / 2);
        const observer = new ResizeObserver(sync);
        observer.observe(element);
        sync();
        return () => observer.disconnect();
    // Initial positioning only; later edits must not move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!locked || !scrollRef.current) return;
        const element = scrollRef.current;
        const x = LABEL + currentTime * pxPerMs;
        if (x > element.scrollLeft + element.clientWidth - 60) element.scrollLeft = x - element.clientWidth * 0.6;
        if (isRecording) {
            const held = notes.findLast(note => note.held);
            if (held) {
                const y = RULER + (127 - held.pitch) * ROW;
                if (y < element.scrollTop + RULER || y > element.scrollTop + element.clientHeight - ROW) element.scrollTop = Math.max(0, y - element.clientHeight / 2);
            }
        }
    }, [locked, currentTime, pxPerMs, notes, isRecording]);

    const commit = (next: RollNote[]) => {
        if (locked) return;
        past.current.push(events.slice());
        if (past.current.length > 100) past.current.shift();
        future.current = [];
        const result = rollNotesToEvents(next);
        ownedEvents.current = result;
        onChange(result);
        setDraft(null);
        refreshHistory(value => value + 1);
    };
    const undo = (redo = false) => {
        if (locked || gestureRef.current) return;
        const from = redo ? future.current : past.current;
        const to = redo ? past.current : future.current;
        const result = from.pop();
        if (!result) return;
        to.push(events.slice());
        ownedEvents.current = result;
        onChange(result);
        setSelection(new Set());
        refreshHistory(value => value + 1);
    };
    const remove = () => {
        if (!selection.size || locked) return;
        commit(notes.filter(note => !selection.has(note.id)));
        setSelection(new Set());
    };
    const keyboard = (event: React.KeyboardEvent) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault(); event.stopPropagation();
            if (!locked && !gestureRef.current) setSelection(new Set(notes.map(note => note.id)));
            return;
        }
        if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
            event.preventDefault(); event.stopPropagation();
            undo(event.key.toLowerCase() === 'y' || event.shiftKey);
            return;
        }
        if (event.key === 'Escape' && gestureRef.current) {
            event.preventDefault(); event.stopPropagation(); clearGesture(true); return;
        }
        if (event.key === 'Escape' && selection.size) {
            event.preventDefault(); event.stopPropagation(); setSelection(new Set()); return;
        }
        if (!selection.size || locked || gestureRef.current) return;
        if (['Delete', 'Backspace'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation(); remove();
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const note = notes.find(entry => selection.has(entry.id));
            if (!note) return;
            const amount = step || 10;
            const horizontal = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
            const next = event.shiftKey && horizontal
                ? resizeRollNotes(notes, selection, note.id, horizontal, step)
                : moveRollNotes(notes, selection, note.id, horizontal, event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0, horizontal ? step : 0);
            commit(next);
        }
    };

    const point = (event: React.PointerEvent): GridPoint => {
        const rect = gridRef.current!.getBoundingClientRect();
        const x = Math.max(LABEL, Math.min(rect.width, event.clientX - rect.left));
        const y = Math.max(RULER, Math.min(rect.height, event.clientY - rect.top));
        return { x, y, time: (x - LABEL) / pxPerMs, pitch: Math.max(0, Math.min(127, 127 - Math.floor((y - RULER) / ROW))) };
    };
    const startGesture = (event: React.PointerEvent, note?: RollNote, resize = false) => {
        if (locked || ![0, 2].includes(event.button) || gestureRef.current) return;
        event.preventDefault();
        const position = point(event);
        if (event.button === 2) {
            gestureRef.current = { pointer: event.pointerId, mode: 'select', start: position, x: event.clientX, y: event.clientY, previousSelection: selection, additive: event.shiftKey || event.ctrlKey || event.metaKey, changed: false };
            setMarquee({ start: position, end: position });
            gridRef.current!.setPointerCapture(event.pointerId);
            gridRef.current!.focus({ preventScroll: true });
            return;
        }
        if (note && (event.shiftKey || event.ctrlKey || event.metaKey) && selection.has(note.id)) {
            setSelection(new Set([...selection].filter(id => id !== note.id)));
            return;
        }
        const created: RollNote = note ?? {
            id: createTakeId(), pitch: position.pitch, start: snapTime(position.time, step),
            end: snapTime(position.time, step) + beatMs, held: false,
            event: { type: 'on', note: midiNumberToNote(position.pitch), transpose: 0, time: 0, instrumentId: currentInstrument, velocity: keyVelocity },
        };
        const selected = note && (selection.has(note.id) || event.shiftKey || event.ctrlKey || event.metaKey) ? new Set([...selection, note.id]) : new Set([created.id]);
        setSelection(selected);
        const base = note ? notes : [...notes, created];
        gestureRef.current = { pointer: event.pointerId, mode: note ? resize ? 'resize' : 'move' : 'add', note: created, selection: selected, previousSelection: selection, x: event.clientX, y: event.clientY, base, result: base, changed: false };
        if (!note) setDraft(base);
        gridRef.current!.setPointerCapture(event.pointerId);
        gridRef.current!.focus({ preventScroll: true });
    };
    const moveGesture = (event: React.PointerEvent) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointer !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.changed && Math.abs(dx) + Math.abs(dy) < 3) return;
        gesture.changed = true;
        if (gesture.mode === 'select') {
            const end = point(event);
            const selected = selectRollNotes(notes, gesture.start, end);
            setSelection(gesture.additive ? new Set([...gesture.previousSelection, ...selected]) : selected);
            setMarquee({ start: gesture.start, end });
            return;
        }
        if (gesture.mode === 'add') {
            const note = resizeRollNote(gesture.note, point(event).time, step);
            gesture.result = gesture.base.map(entry => entry.id === note.id ? note : entry);
        } else {
            gesture.result = gesture.mode === 'move'
                ? moveRollNotes(gesture.base, gesture.selection, gesture.note.id, Math.abs(dx) < 3 ? 0 : dx / pxPerMs, -dy / ROW, step)
                : resizeRollNotes(gesture.base, gesture.selection, gesture.note.id, dx / pxPerMs, step);
        }
        setDraft(gesture.result);
    };
    const finishGesture = (event: React.PointerEvent, cancel = false) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointer !== event.pointerId) return;
        if (!cancel) moveGesture(event);
        clearGesture(cancel);
        if (!cancel && gesture.mode !== 'select' && (gesture.changed || gesture.mode === 'add')) commit(gesture.result);
    };

    const button = `p-1.5 rounded disabled:opacity-35 ${theme.controlOff}`;
    return (
        <section className={`flex flex-col flex-1 min-h-0 ${theme.panelBg} ${theme.toolbarText}`} onKeyDown={keyboard}>
            <div className={`flex flex-wrap items-center gap-3 px-3 py-2 border-b ${theme.panelBorder}`}>
                <strong className="text-sm">{t.arrange.title}</strong>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={autoCapture} onChange={event => onAutoCapture(event.target.checked)} className="accent-[color:var(--kp-played)]" />{t.arrange.auto}
                </label>
                <span role="status" className={`text-xs ${isRecording ? 'text-[color:var(--kp-rec)]' : theme.mutedText}`}>{isRecording ? t.arrange.recording : autoCapture ? t.arrange.ready : t.arrange.editing}</span>
                {!locked && selection.size > 0 && <span aria-live="polite" className={`text-xs ${theme.accentText}`}>{t.arrange.selected.replace('{count}', String(selection.size))}</span>}
                {isRecording && <button onClick={onStopRecording} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${theme.controlOn}`}><Square className="w-3 h-3" />{t.arrange.stop}</button>}
                <div className="flex gap-1 ml-auto">
                    <button className={button} aria-label={t.arrange.undo} title={t.arrange.undo} disabled={locked || !past.current.length} onClick={() => undo()}><Undo2 className="w-4 h-4" /></button>
                    <button className={button} aria-label={t.arrange.redo} title={t.arrange.redo} disabled={locked || !future.current.length} onClick={() => undo(true)}><Redo2 className="w-4 h-4" /></button>
                    <button className={button} aria-label={t.arrange.delete} title={t.arrange.delete} disabled={locked || !selection.size} onClick={remove}><Trash2 className="w-4 h-4" /></button>
                    <button className={button} aria-label={t.exportMidi} title={t.exportMidi} disabled={isRecording || !events.length} onClick={onExport}><Download className="w-4 h-4" /></button>
                </div>
                <label className="flex items-center gap-1 text-xs">{t.arrange.snap}<select className={`rounded border px-1 py-0.5 ${theme.field}`} aria-label={t.arrange.snap} value={division} disabled={locked} onChange={event => setDivision(Number(event.target.value))}>
                    <option value={0}>{t.arrange.free}</option><option value={1}>1/4</option><option value={2}>1/8</option><option value={4}>1/16</option><option value={8}>1/32</option>
                </select></label>
                <label className="flex items-center gap-1 text-xs">{t.arrange.zoom}<button className={button} aria-label={`${t.arrange.zoom} −`} disabled={beatWidth <= 32 || Boolean(draft || marquee)} onClick={() => setBeatWidth(value => Math.max(32, value / 1.25))}><Minus className="w-3 h-3" /></button><button className={button} aria-label={`${t.arrange.zoom} +`} disabled={beatWidth >= 200 || Boolean(draft || marquee)} onClick={() => setBeatWidth(value => Math.min(200, value * 1.25))}><Plus className="w-3 h-3" /></button></label>
                <span className={`text-[11px] ${theme.mutedText}`}>{bpm} BPM · 4/4</span>
            </div>
            <div className={`px-3 py-1 text-[11px] border-b ${theme.panelBorder} ${theme.mutedText}`}>{t.arrange.hint}</div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative" onScroll={event => { const element = event.currentTarget; setViewport({ left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight }); }}>
                <div ref={gridRef} data-piano-roll tabIndex={0} role="group" aria-label={t.arrange.grid} className="relative outline-none select-none" style={{ width: width + LABEL, height: RULER + 128 * ROW }}
                    onPointerDown={event => { if (event.target === gridRef.current || (event.target as HTMLElement).dataset.rollBackground !== undefined) startGesture(event); }}
                    onPointerMove={moveGesture} onPointerUp={event => finishGesture(event)} onPointerCancel={event => finishGesture(event, true)} onLostPointerCapture={event => finishGesture(event, true)} onContextMenu={event => event.preventDefault()}>
                    <div data-roll-background className="absolute" style={{ left: LABEL, top: RULER, width, height: 128 * ROW, backgroundColor: 'var(--kp-field-bg)', backgroundImage: 'linear-gradient(to right, var(--kp-panel-border) 1px, transparent 1px), linear-gradient(to bottom, var(--kp-panel-border) 1px, transparent 1px)', backgroundSize: `${step ? beatWidth / division : beatWidth}px ${ROW}px` }} />
                    <div className={`sticky top-0 z-30 h-7 border-b ${theme.panelBg} ${theme.panelBorder}`} style={{ width: width + LABEL }}>
                        {Array.from({ length: Math.max(0, lastBeat - firstBeat) }, (_, index) => firstBeat + index).map(beat => <span key={beat} className={`absolute h-full border-l text-[10px] pt-1 pl-1 ${theme.panelBorder} ${beat % 4 === 0 ? theme.toolbarText : theme.mutedText}`} style={{ left: LABEL + beat * beatWidth }}>{beat % 4 === 0 ? `${beat / 4 + 1}` : '·'}</span>)}
                        <span className={`sticky left-0 inline-flex h-full items-center justify-center text-[10px] z-40 ${theme.panelBg}`} style={{ width: LABEL }}>4/4</span>
                    </div>
                    <div className="sticky left-0 z-20" style={{ width: LABEL }}>
                        {PITCHES.map(pitch => <div key={pitch} className="flex items-center justify-end pr-2 text-[10px] border-b border-r" style={{ height: ROW, borderColor: 'var(--kp-piano-border)', background: [1, 3, 6, 8, 10].includes(pitch % 12) ? 'var(--kp-piano-black)' : 'var(--kp-piano-white)', color: [1, 3, 6, 8, 10].includes(pitch % 12) ? '#f4f4f5' : '#18181b' }}>{midiNumberToNote(pitch)}</div>)}
                    </div>
                    {visible.map(note => <button type="button" key={note.id} data-roll-note={note.id} aria-pressed={selection.has(note.id)} aria-label={t.arrange.note.replace('{note}', midiNumberToNote(note.pitch)).replace('{start}', (note.start / 1000).toFixed(2)).replace('{duration}', ((note.end - note.start) / 1000).toFixed(2))}
                        className="absolute rounded-sm text-[10px] text-left pl-1 overflow-hidden border shadow-sm focus:outline-none focus:ring-2 focus:ring-white"
                        style={{ left: LABEL + note.start * pxPerMs, top: RULER + (127 - note.pitch) * ROW + 2, width: Math.max(6, (note.end - note.start) * pxPerMs), height: ROW - 4, background: note.held ? 'var(--kp-rec)' : 'var(--kp-played)', color: 'var(--kp-played-ink)', borderColor: selection.has(note.id) ? 'var(--kp-text)' : 'transparent', opacity: selection.has(note.id) || note.held ? 1 : 0.8, cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
                        onPointerDown={event => { event.stopPropagation(); startGesture(event, note); }}>
                        {midiNumberToNote(note.pitch)}
                        <span data-roll-resize className="absolute top-0 right-0 bottom-0 w-2 border-l border-black/20 cursor-ew-resize" title={t.arrange.resize} onPointerDown={event => { event.stopPropagation(); startGesture(event, note, true); }} />
                    </button>)}
                    {marquee && <div data-roll-selection aria-hidden="true" className="absolute border pointer-events-none z-10" style={{ left: Math.min(marquee.start.x, marquee.end.x), top: Math.min(marquee.start.y, marquee.end.y), width: Math.abs(marquee.end.x - marquee.start.x), height: Math.abs(marquee.end.y - marquee.start.y), borderColor: 'var(--kp-text)', background: 'var(--kp-guide)', opacity: 0.25 }} />}
                    <div aria-hidden="true" className="absolute top-7 bottom-0 w-px pointer-events-none z-10" style={{ left: LABEL + currentTime * pxPerMs, background: isRecording ? 'var(--kp-rec)' : 'var(--kp-guide)' }} />
                    {!shown.length && <div className={`sticky pointer-events-none text-xs left-20 bottom-6 inline-block px-4 py-2 rounded ${theme.panelBg} ${theme.mutedText}`}>{t.arrange.empty}</div>}
                </div>
            </div>
        </section>
    );
}
