import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, Undo2, Redo2, Trash2, Square, Minus, Plus } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useSynth } from '../contexts/SynthContext';
import { midiNumberToNote } from '../constants';
import { createTakeId } from '../services/takeStore';
import { eventsToRollNotes, moveRollNotes, resizeRollNote, resizeRollNotes, rollNotesToEvents, selectRollNotes, snapTime, type RollNote, type RollPoint } from '../services/pianoRoll';
import type { AutoCaptureMode, RecordedEvent } from '../types';

const DEFAULT_ROW = 22;
const MIN_ROW = 1;
const MAX_ROW = 44;
const LABEL = 56;
const RULER = 28;
const PITCHES = Array.from({ length: 128 }, (_, row) => 127 - row);

interface Props {
    events: RecordedEvent[];
    currentTime: number;
    bpm: number;
    isRecording: boolean;
    isRecordingPaused: boolean;
    isPlaying: boolean;
    autoCapture: boolean;
    autoCaptureMode: AutoCaptureMode;
    onAutoCapture: (value: boolean) => void;
    onAutoCaptureMode: (value: AutoCaptureMode) => void;
    onSeek: (time: number) => void;
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
    clickedNoteId?: string;
}

interface SeekGesture extends GestureBase { mode: 'seek'; time: number }

type Gesture = EditGesture | SelectionGesture | SeekGesture;

export default function PianoRoll({ events, currentTime, bpm, isRecording, isRecordingPaused, isPlaying, autoCapture, autoCaptureMode, onAutoCapture, onAutoCaptureMode, onSeek, onChange, onStopRecording, onExport }: Props) {
    const { theme, t } = useSettings();
    const { currentInstrument, keyVelocity } = useSynth();
    const scrollRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const rulerRef = useRef<HTMLDivElement>(null);
    const viewportHeightRef = useRef(0);
    const zoomCentreRef = useRef<number | null>(null);
    const gestureRef = useRef<Gesture | null>(null);
    const past = useRef<RecordedEvent[][]>([]);
    const future = useRef<RecordedEvent[][]>([]);
    const ownedEvents = useRef(events);
    const [, refreshHistory] = useState(0);
    const [selection, setSelection] = useState<Set<string>>(() => new Set());
    const [marquee, setMarquee] = useState<{ start: GridPoint; end: GridPoint } | null>(null);
    const [draft, setDraft] = useState<RollNote[] | null>(null);
    const [seekPreview, setSeekPreview] = useState<number | null>(null);
    const [division, setDivision] = useState(4);
    const [beatWidth, setBeatWidth] = useState(80);
    const [rowHeight, setRowHeight] = useState(DEFAULT_ROW);
    const [viewport, setViewport] = useState({ left: 0, top: 0, width: 1000, height: 500 });
    const beatMs = 60_000 / bpm;
    const step = division ? beatMs / division : 0;
    const pxPerMs = beatWidth / beatMs;
    const locked = isRecording || isPlaying;
    // The recording clock extends held bars between note events.
    const liveTime = isRecording ? currentTime : 0;
    const notes = useMemo(() => eventsToRollNotes(events, liveTime), [events, liveTime]);
    const shown = draft ?? notes;
    const duration = notes.reduce((max, note) => Math.max(max, note.end), isRecording ? currentTime : 0);
    const displayTime = seekPreview ?? (isRecording ? currentTime : Math.min(duration, currentTime));
    const end = shown.reduce((max, note) => Math.max(max, note.end), displayTime);
    const width = Math.max(viewport.width - LABEL, 16 * beatWidth, (Math.ceil(end / (4 * beatMs)) * 4 + 8) * beatWidth);
    const firstBeat = Math.max(0, Math.floor((viewport.left - LABEL) / beatWidth) - 1);
    const lastBeat = Math.min(Math.ceil(width / beatWidth), firstBeat + Math.ceil(viewport.width / beatWidth) + 3);
    const visible = shown.filter(note => {
        const y = (127 - note.pitch) * rowHeight + RULER;
        return y + rowHeight >= viewport.top && y <= viewport.top + viewport.height
            && LABEL + note.end * pxPerMs >= viewport.left && LABEL + note.start * pxPerMs <= viewport.left + viewport.width;
    });
    const noteGap = rowHeight >= 12 ? 2 : rowHeight >= 4 ? 1 : 0;

    const syncViewport = useCallback(() => {
        const element = scrollRef.current;
        if (element) setViewport({ left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight });
    }, []);

    const centreViewport = useCallback((centre: number, height: number) => {
        const element = scrollRef.current;
        if (!element) return;
        element.scrollTop = Math.max(0, centre * height - (element.clientHeight - RULER) / 2);
        viewportHeightRef.current = element.clientHeight;
        syncViewport();
    }, [syncViewport]);

    const zoomPitch = (height: number, centre?: number) => {
        const element = scrollRef.current;
        if (!element || gestureRef.current) return;
        const next = Math.max(MIN_ROW, Math.min(MAX_ROW, height));
        const anchor = centre ?? (element.scrollTop + (element.clientHeight - RULER) / 2) / rowHeight;
        if (next === rowHeight) centreViewport(anchor, next);
        else {
            zoomCentreRef.current = anchor;
            setRowHeight(next);
        }
    };

    const fitPitches = () => {
        const element = scrollRef.current;
        if (!element || !notes.length) return;
        const { high, low } = notes.reduce((range, note) => ({ high: Math.max(range.high, note.pitch), low: Math.min(range.low, note.pitch) }), { high: 0, low: 127 });
        // Leave one pitch of breathing room above and below the phrase.
        zoomPitch((element.clientHeight - RULER) / (high - low + 3), 127 - high + (high - low + 1) / 2);
    };

    useLayoutEffect(() => {
        if (zoomCentreRef.current === null) return;
        centreViewport(zoomCentreRef.current, rowHeight);
        zoomCentreRef.current = null;
    }, [rowHeight, centreViewport]);

    const clearGesture = useCallback((restoreSelection = false) => {
        const gesture = gestureRef.current;
        gestureRef.current = null;
        setDraft(null);
        setMarquee(null);
        setSeekPreview(null);
        if (restoreSelection && gesture) setSelection(gesture.previousSelection);
        if (gesture && gridRef.current?.hasPointerCapture(gesture.pointer)) gridRef.current.releasePointerCapture(gesture.pointer);
    }, []);

    useEffect(() => {
        if (gestureRef.current && (isRecording || (isPlaying && gestureRef.current.mode !== 'seek'))) clearGesture(true);
    }, [isRecording, isPlaying, clearGesture]);

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
        viewportHeightRef.current = element.clientHeight;
        const sync = () => {
            if (viewportHeightRef.current !== element.clientHeight) element.scrollTop = Math.max(0, element.scrollTop + (viewportHeightRef.current - element.clientHeight) / 2);
            viewportHeightRef.current = element.clientHeight;
            syncViewport();
        };
        // Centre the first loaded phrase, or middle C for a blank arrangement.
        const centre = notes.length ? Math.round(notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length) : 60;
        centreViewport(127 - centre + 0.5, rowHeight);
        const observer = new ResizeObserver(sync);
        observer.observe(element);
        sync();
        return () => observer.disconnect();
    // Initial positioning only; later edits must not move the viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!locked || !scrollRef.current) return;
        if (gestureRef.current?.mode === 'seek') return;
        const element = scrollRef.current;
        const x = LABEL + currentTime * pxPerMs;
        if (x > element.scrollLeft + element.clientWidth - 60) element.scrollLeft = x - element.clientWidth * 0.6;
        if (isRecording) {
            const held = notes.findLast(note => note.held);
            if (held) {
                const y = RULER + (127 - held.pitch) * rowHeight;
                if (y < element.scrollTop + RULER || y > element.scrollTop + element.clientHeight - rowHeight) element.scrollTop = Math.max(0, y - element.clientHeight / 2);
            }
        }
    }, [locked, currentTime, pxPerMs, rowHeight, notes, isRecording]);

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
        if (event.code === 'Space' && gestureRef.current) {
            event.preventDefault(); event.stopPropagation(); return;
        }
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
        return { x, y, time: (x - LABEL) / pxPerMs, pitch: Math.max(0, Math.min(127, 127 - Math.floor((y - RULER) / rowHeight))) };
    };
    const startSeek = (event: React.PointerEvent) => {
        event.preventDefault(); event.stopPropagation();
        if (isRecording || !duration || event.button !== 0 || gestureRef.current) return;
        const time = Math.min(duration, point(event).time);
        gestureRef.current = { mode: 'seek', pointer: event.pointerId, time, x: event.clientX, y: event.clientY, previousSelection: selection, changed: false };
        setSeekPreview(time);
        gridRef.current!.setPointerCapture(event.pointerId);
        rulerRef.current!.focus({ preventScroll: true });
    };
    const seekKeyboard = (event: React.KeyboardEvent) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (isRecording || gestureRef.current) return;
        const delta = (event.shiftKey ? beatMs * 4 : step || beatMs) * (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1);
        onSeek(event.key === 'Home' ? 0 : event.key === 'End' ? duration : Math.max(0, Math.min(duration, displayTime + delta)));
    };
    const startGesture = (event: React.PointerEvent, note?: RollNote, resize = false) => {
        if (locked || ![0, 2].includes(event.button) || gestureRef.current) return;
        event.preventDefault();
        const position = point(event);
        if (event.button === 2) {
            gestureRef.current = { pointer: event.pointerId, mode: 'select', start: position, x: event.clientX, y: event.clientY, previousSelection: selection, additive: event.shiftKey || event.ctrlKey || event.metaKey, clickedNoteId: note?.id, changed: false };
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
        if (gesture.mode === 'seek') {
            gesture.time = Math.min(duration, point(event).time);
            setSeekPreview(gesture.time);
            return;
        }
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
                ? moveRollNotes(gesture.base, gesture.selection, gesture.note.id, Math.abs(dx) < 3 ? 0 : dx / pxPerMs, -dy / rowHeight, step)
                : resizeRollNotes(gesture.base, gesture.selection, gesture.note.id, dx / pxPerMs, step);
        }
        setDraft(gesture.result);
    };
    const finishGesture = (event: React.PointerEvent, cancel = false) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointer !== event.pointerId) return;
        if (!cancel) moveGesture(event);
        clearGesture(cancel);
        if (cancel) return;
        if (gesture.mode === 'seek') onSeek(gesture.time);
        else if (gesture.mode === 'select') {
            if (!gesture.changed && gesture.clickedNoteId) {
                commit(notes.filter(note => note.id !== gesture.clickedNoteId));
                setSelection(new Set([...selection].filter(id => id !== gesture.clickedNoteId)));
            }
        } else if (gesture.changed || gesture.mode === 'add') commit(gesture.result);
    };

    const button = `p-1.5 rounded disabled:opacity-35 ${theme.controlOff}`;
    return (
        <section className={`flex flex-col flex-1 min-h-0 ${theme.panelBg} ${theme.toolbarText}`} onKeyDown={keyboard}>
            <div className={`flex flex-wrap items-center gap-3 px-3 py-2 border-b ${theme.panelBorder}`}>
                <strong className="text-sm">{t.arrange.title}</strong>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={autoCapture} disabled={isRecording || isPlaying} onChange={event => onAutoCapture(event.target.checked)} className="accent-[color:var(--kp-played)]" />{t.arrange.auto}
                </label>
                <select aria-label={t.arrange.recordMode} title={autoCaptureMode === 'pressed' ? t.arrange.pressedHint : t.arrange.continuousHint} value={autoCaptureMode} disabled={!autoCapture || locked} onChange={event => onAutoCaptureMode(event.target.value === 'pressed' ? 'pressed' : 'continuous')} className={`text-xs rounded border px-1 py-0.5 disabled:opacity-40 ${theme.field}`}>
                    <option value="continuous">{t.arrange.continuous}</option><option value="pressed">{t.arrange.pressed}</option>
                </select>
                <span role="status" className={`text-xs ${isRecording ? 'text-[color:var(--kp-rec)]' : theme.mutedText}`}>{isRecording ? isRecordingPaused ? t.arrange.paused : t.arrange.recording : autoCapture ? autoCaptureMode === 'pressed' ? t.arrange.readyPressed : t.arrange.ready : t.arrange.editing}</span>
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
                <div role="group" aria-label={t.arrange.zoom} className="flex items-center gap-1 text-xs whitespace-nowrap">{t.arrange.zoom}<button className={button} aria-label={`${t.arrange.zoom} −`} disabled={beatWidth <= 32 || Boolean(gestureRef.current)} onClick={() => setBeatWidth(value => Math.max(32, value / 1.25))}><Minus className="w-3 h-3" /></button><button className={button} aria-label={`${t.arrange.zoom} +`} disabled={beatWidth >= 200 || Boolean(gestureRef.current)} onClick={() => setBeatWidth(value => Math.min(200, value * 1.25))}><Plus className="w-3 h-3" /></button></div>
                <div role="group" aria-label={t.arrange.pitchZoom} className="flex items-center gap-1 text-xs whitespace-nowrap">{t.arrange.pitchZoom}
                    <button className={button} aria-label={`${t.arrange.pitchZoom} −`} title={`${t.arrange.pitchZoom} −`} disabled={rowHeight <= MIN_ROW || Boolean(gestureRef.current)} onClick={() => zoomPitch(rowHeight / 1.25)}><Minus className="w-3 h-3" /></button>
                    <span className="w-9 text-center tabular-nums">{Math.round(rowHeight / DEFAULT_ROW * 100)}%</span>
                    <button className={button} aria-label={`${t.arrange.pitchZoom} +`} title={`${t.arrange.pitchZoom} +`} disabled={rowHeight >= MAX_ROW || Boolean(gestureRef.current)} onClick={() => zoomPitch(rowHeight * 1.25)}><Plus className="w-3 h-3" /></button>
                    <button className={`px-2 py-1 rounded disabled:opacity-35 ${theme.controlOff}`} disabled={!notes.length || Boolean(gestureRef.current)} title={t.arrange.fitHint} onClick={fitPitches}>{t.arrange.fit}</button>
                </div>
                <span className={`text-[11px] ${theme.mutedText}`}>{bpm} BPM · 4/4</span>
            </div>
            <div className={`px-3 py-1 text-[11px] border-b ${theme.panelBorder} ${theme.mutedText}`}>{t.arrange.hint}</div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto relative" onScroll={event => { const element = event.currentTarget; setViewport({ left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight }); }}>
                <div ref={gridRef} data-piano-roll data-row-height={rowHeight} tabIndex={0} role="group" aria-label={t.arrange.grid} className="relative outline-none select-none" style={{ width: width + LABEL, height: RULER + 128 * rowHeight }}
                    onPointerDown={event => { if (event.target === gridRef.current || (event.target as HTMLElement).dataset.rollBackground !== undefined) startGesture(event); }}
                    onPointerMove={moveGesture} onPointerUp={event => finishGesture(event)} onPointerCancel={event => finishGesture(event, true)} onLostPointerCapture={event => finishGesture(event, true)} onContextMenu={event => event.preventDefault()}>
                    <div data-roll-background className="absolute" style={{ left: LABEL, top: RULER, width, height: 128 * rowHeight, backgroundColor: 'var(--kp-field-bg)', backgroundImage: 'linear-gradient(to right, var(--kp-panel-border) 1px, transparent 1px), linear-gradient(to bottom, var(--kp-panel-border) 1px, transparent 1px)', backgroundSize: `${step ? beatWidth / division : beatWidth}px ${rowHeight}px` }} />
                    <div ref={rulerRef} data-roll-ruler role="slider" tabIndex={0} aria-label={t.arrange.position} aria-valuemin={0} aria-valuemax={duration / 1000} aria-valuenow={displayTime / 1000} aria-disabled={isRecording || !duration} title={t.arrange.seekHint} onKeyDown={seekKeyboard} onPointerDown={startSeek}
                        className={`sticky top-0 z-30 h-7 border-b outline-none focus-visible:ring-2 focus-visible:ring-inset ${isRecording ? '' : 'cursor-ew-resize'} ${theme.panelBg} ${theme.panelBorder}`} style={{ width: width + LABEL, touchAction: 'none' }}>
                        {Array.from({ length: Math.max(0, lastBeat - firstBeat) }, (_, index) => firstBeat + index).map(beat => <span key={beat} className={`absolute h-full border-l text-[10px] pt-1 pl-1 ${theme.panelBorder} ${beat % 4 === 0 ? theme.toolbarText : theme.mutedText}`} style={{ left: LABEL + beat * beatWidth }}>{beat % 4 === 0 ? `${beat / 4 + 1}` : '·'}</span>)}
                        <span data-roll-playhead-handle aria-hidden="true" className="absolute top-0 bottom-0 w-3 flex justify-center" style={{ left: LABEL + displayTime * pxPerMs - 6 }}><span className="w-2 h-2 mt-1 rotate-45" style={{ background: isRecording ? 'var(--kp-rec)' : 'var(--kp-guide)' }} /></span>
                        <span onPointerDown={event => event.stopPropagation()} className={`sticky left-0 inline-flex h-full items-center justify-center text-[10px] z-40 ${theme.panelBg}`} style={{ width: LABEL }}>4/4</span>
                    </div>
                    <div className="sticky left-0 z-20" style={{ width: LABEL }}>
                        {PITCHES.map(pitch => <div key={pitch} className="flex items-center justify-end pr-2 text-[10px] border-r" style={{ height: rowHeight, borderBottomWidth: rowHeight >= 4 ? 1 : 0, borderColor: 'var(--kp-piano-border)', background: [1, 3, 6, 8, 10].includes(pitch % 12) ? 'var(--kp-piano-black)' : 'var(--kp-piano-white)', color: [1, 3, 6, 8, 10].includes(pitch % 12) ? '#f4f4f5' : '#18181b' }}>{(rowHeight >= 12 || pitch % 12 === 0) && <span className="relative z-10" style={rowHeight < 12 ? { background: 'var(--kp-piano-white)' } : undefined}>{midiNumberToNote(pitch)}</span>}</div>)}
                    </div>
                    {visible.map(note => <button type="button" key={note.id} data-roll-note={note.id} aria-pressed={selection.has(note.id)} aria-label={t.arrange.note.replace('{note}', midiNumberToNote(note.pitch)).replace('{start}', (note.start / 1000).toFixed(2)).replace('{duration}', ((note.end - note.start) / 1000).toFixed(2))}
                        className="absolute z-[11] rounded-sm text-[10px] text-left pl-1 overflow-hidden border shadow-sm focus:outline-none focus:ring-2 focus:ring-white"
                        title={t.arrange.note.replace('{note}', midiNumberToNote(note.pitch)).replace('{start}', (note.start / 1000).toFixed(2)).replace('{duration}', ((note.end - note.start) / 1000).toFixed(2))}
                        style={{ left: LABEL + note.start * pxPerMs, top: RULER + (127 - note.pitch) * rowHeight + noteGap, width: Math.max(6, (note.end - note.start) * pxPerMs), height: rowHeight - noteGap * 2, paddingLeft: rowHeight >= 14 ? 4 : 0, fontSize: rowHeight >= 14 ? Math.min(10, rowHeight - noteGap * 2 - 2) : 10, lineHeight: 1, background: note.held ? 'var(--kp-rec)' : 'var(--kp-played)', color: 'var(--kp-played-ink)', borderWidth: rowHeight < 4 ? 0 : 1, borderColor: selection.has(note.id) ? 'var(--kp-text)' : 'transparent', outline: selection.has(note.id) && rowHeight < 4 ? '1px solid var(--kp-text)' : undefined, opacity: selection.has(note.id) || note.held ? 1 : 0.8, cursor: locked ? 'default' : 'grab', touchAction: 'none' }}
                        onPointerDown={event => { event.stopPropagation(); startGesture(event, note); }}>
                        {rowHeight >= 14 && midiNumberToNote(note.pitch)}
                        <span data-roll-resize className="absolute top-0 right-0 bottom-0 w-2 border-l border-black/20 cursor-ew-resize" title={t.arrange.resize} onPointerDown={event => { event.stopPropagation(); startGesture(event, note, true); }} />
                    </button>)}
                    {marquee && <div data-roll-selection aria-hidden="true" className="absolute border pointer-events-none z-10" style={{ left: Math.min(marquee.start.x, marquee.end.x), top: Math.min(marquee.start.y, marquee.end.y), width: Math.abs(marquee.end.x - marquee.start.x), height: Math.abs(marquee.end.y - marquee.start.y), borderColor: 'var(--kp-text)', background: 'var(--kp-guide)', opacity: 0.25 }} />}
                    <div data-roll-playhead aria-hidden="true" onPointerDown={event => event.button === 2 ? startGesture(event) : startSeek(event)} className={`absolute top-7 bottom-0 w-2 z-10 ${isRecording ? 'pointer-events-none' : 'cursor-ew-resize'}`} style={{ left: LABEL + displayTime * pxPerMs - 4, touchAction: 'none' }}><span className="absolute left-1 top-0 bottom-0 w-px" style={{ background: isRecording ? 'var(--kp-rec)' : 'var(--kp-guide)' }} /></div>
                    {!shown.length && <div className={`sticky pointer-events-none text-xs left-20 bottom-6 inline-block px-4 py-2 rounded ${theme.panelBg} ${theme.mutedText}`}>{t.arrange.empty}</div>}
                </div>
            </div>
        </section>
    );
}
