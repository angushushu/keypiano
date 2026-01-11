
import React, { useEffect, useRef, useState } from 'react';
import { Theme } from '../theme';
import StaveBackgroundSVG from './StaveBackgroundSVG';

export type NoteType = 'user' | 'practice';

interface TriggerNote {
    note: string;
    time: number;
    type: NoteType;
}

interface StaveVisualizerProps {
    triggerNotes: TriggerNote[]; 
    theme: Theme;
    height?: number;
}

// --- VISUALIZATION CONSTANTS ---
const QUANTIZATION_MS = 62.5; 
const NOTE_SPACING_X = 50; 
const PADDING_RIGHT = 150;     
const NOTE_HEAD_RADIUS_X = 6.5;
const NOTE_HEAD_RADIUS_Y = 4.5;

// --- SVG METRICS (Derived from provided music_sheet.svg) ---
// ViewBox: 18.432 38.912 759.808 172.032
const VB_X = 18.432;
const VB_Y = 38.912;
const VB_W = 759.808;
const VB_H = 172.032;

// Metric Analysis of the SVG:
// Treble Bottom Line (E4, Offset +2) Center Y ~= 112.144
const SVG_TREBLE_REF_Y = 112.144;
// Bass Top Line (A3, Offset -2) Center Y ~= 146.056
const SVG_BASS_REF_Y = 146.056;

// Half Line Height (Step) calculated from SVG
const SVG_LINE_HALF_H = 4.358;

// Optimization: Cache results for getDiatonicOffset to avoid regex parsing in render loop
const offsetCache: Record<string, { offset: number; isSharp: boolean; isFlat: boolean }> = {};

const getDiatonicOffset = (noteStr: string): { offset: number; isSharp: boolean; isFlat: boolean } => {
    if (offsetCache[noteStr]) return offsetCache[noteStr];

    const match = noteStr.match(/([A-G][#b]?)(-?\d+)/);
    if (!match) {
        const fallback = { offset: 0, isSharp: false, isFlat: false };
        offsetCache[noteStr] = fallback;
        return fallback;
    }

    let [_, name, octStr] = match;
    const octave = parseInt(octStr);
    
    let isSharp = false;
    let isFlat = false;

    if (name.endsWith('#')) isSharp = true;
    if (name.endsWith('b')) isFlat = true;

    const naturalName = name.replace('#', '').replace('b', '');
    const diatonicBase: Record<string, number> = { 'C':0, 'D':1, 'E':2, 'F':3, 'G':4, 'A':5, 'B':6 };
    const step = diatonicBase[naturalName];

    // C4 = 0
    const offset = (octave - 4) * 7 + step;

    const result = { offset, isSharp, isFlat };
    offsetCache[noteStr] = result;
    return result;
};

interface StaveNoteItem {
    name: string;
    type: NoteType;
}

interface NoteBin {
    timestamp: number;
    quantizedTime: number; 
    notes: StaveNoteItem[]; 
    x: number;       
}

const StaveVisualizer: React.FC<StaveVisualizerProps> = ({ triggerNotes, theme }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const binsRef = useRef<NoteBin[]>([]);
    const rafRef = useRef<number | null>(null);
    
    // --- Bin Logic ---
    useEffect(() => {
        if (!triggerNotes || triggerNotes.length === 0) return;

        triggerNotes.forEach(latestNote => {
            const now = latestNote.time;
            const noteName = latestNote.note;
            const noteType = latestNote.type;

            const currentQuantizedTime = Math.round(now / QUANTIZATION_MS) * QUANTIZATION_MS;
            let addedToBin = false;

            if (binsRef.current.length > 0) {
                const lastBin = binsRef.current[binsRef.current.length - 1];
                if (lastBin.quantizedTime === currentQuantizedTime) {
                    // Check if note exists
                    const existingIdx = lastBin.notes.findIndex(n => n.name === noteName);
                    
                    if (existingIdx === -1) {
                        lastBin.notes.push({ name: noteName, type: noteType });
                        // Sort by pitch
                        lastBin.notes.sort((a, b) => getDiatonicOffset(a.name).offset - getDiatonicOffset(b.name).offset);
                    } else {
                        // If existing note is 'practice' and new is 'user', upgrade it
                        if (lastBin.notes[existingIdx].type === 'practice' && noteType === 'user') {
                            lastBin.notes[existingIdx].type = 'user';
                        }
                    }
                    addedToBin = true;
                }
            }

            if (!addedToBin) {
                binsRef.current.push({
                    timestamp: now,
                    quantizedTime: currentQuantizedTime,
                    notes: [{ name: noteName, type: noteType }],
                    x: 1000 
                });
            }
        });
        
        triggerRender();
    }, [triggerNotes]);

    const triggerRender = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(draw);
    };

    // --- Resize Observer ---
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                
                if (canvasRef.current) {
                    const dpr = window.devicePixelRatio || 1;
                    canvasRef.current.width = width * dpr;
                    canvasRef.current.height = height * dpr;
                    canvasRef.current.style.width = `${width}px`;
                    canvasRef.current.style.height = `${height}px`;
                    draw();
                }
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [theme]);

    useEffect(() => {
        draw();
    }, [theme]);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pWidth = canvas.width;
        const pHeight = canvas.height;
        const dpr = window.devicePixelRatio || 1;
        const width = pWidth / dpr;
        const height = pHeight / dpr;

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const isLight = theme.id === 'light' || theme.id === 'minimalist' || theme.id === 'pastel' || theme.id === 'fauvism';
        const inkColor = isLight ? '#111' : '#e4e4e7';
        // Ghost color for practice mode
        const ghostColor = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)';
        
        // --- COORDINATE MAPPING ---
        const scale = Math.min(width / VB_W, height / VB_H);
        const renderH = VB_H * scale;
        const offY = (height - renderH) / 2;

        const trebleBaseY = offY + (SVG_TREBLE_REF_Y - VB_Y) * scale;
        const bassBaseY = offY + (SVG_BASS_REF_Y - VB_Y) * scale;
        const canvasLineH = SVG_LINE_HALF_H * scale;

        // --- Draw Bins ---
        const maxVisibleItems = Math.ceil(width / NOTE_SPACING_X) + 2;
        if (binsRef.current.length > maxVisibleItems) {
            binsRef.current = binsRef.current.slice(binsRef.current.length - maxVisibleItems);
        }

        binsRef.current.forEach((bin, idx) => {
            const reverseIdx = (binsRef.current.length - 1) - idx;
            const targetX = width - PADDING_RIGHT - (reverseIdx * NOTE_SPACING_X);
            bin.x = targetX;
        });

        binsRef.current.forEach(bin => {
            if (bin.x < 80) return; 

            bin.notes.forEach(noteItem => {
                const noteStr = noteItem.name;
                const { offset, isSharp, isFlat } = getDiatonicOffset(noteStr);
                
                // Set color based on note type
                if (noteItem.type === 'practice') {
                    ctx.fillStyle = ghostColor;
                    ctx.strokeStyle = ghostColor;
                } else {
                    ctx.fillStyle = inkColor;
                    ctx.strokeStyle = inkColor;
                }

                // --- SPLIT CONTEXT LOGIC ---
                let y = 0;
                let isTrebleContext = true;

                if (offset >= 0) {
                    y = trebleBaseY - ((offset - 2) * canvasLineH);
                    isTrebleContext = true;
                } else {
                    y = bassBaseY - ((offset + 2) * canvasLineH);
                    isTrebleContext = false;
                }

                // Note Head
                ctx.save();
                ctx.translate(bin.x, y);
                ctx.rotate(-0.35); 
                ctx.beginPath();
                ctx.ellipse(0, 0, NOTE_HEAD_RADIUS_X, NOTE_HEAD_RADIUS_Y, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
                
                // Ledger Lines Logic
                const drawLedger = (ly: number) => {
                    ctx.beginPath();
                    ctx.moveTo(bin.x - 12, ly);
                    ctx.lineTo(bin.x + 12, ly);
                    ctx.stroke();
                };

                if (isTrebleContext) {
                    if (offset === 0) drawLedger(y);
                    if (offset > 10) {
                        for (let i = 12; i <= offset; i += 2) {
                             const ly = trebleBaseY - ((i - 2) * canvasLineH);
                             drawLedger(ly);
                        }
                    }
                } else {
                    if (offset < -10) {
                         for (let i = -12; i >= offset; i -= 2) {
                             const ly = bassBaseY - ((i + 2) * canvasLineH);
                             drawLedger(ly);
                         }
                    }
                }
                
                // Accidentals
                if (isSharp || isFlat) {
                    ctx.font = "20px serif"; 
                    const symbol = isSharp ? '♯' : '♭';
                    const accX = bin.x - 20;
                    const accY = y + 7;
                    ctx.fillText(symbol, accX, accY);
                }
            });
        });
    };
    
    const isLight = theme.id === 'light' || theme.id === 'minimalist' || theme.id === 'pastel' || theme.id === 'fauvism';
    const bgClass = isLight ? 'bg-[#fffaf0]' : 'bg-[#222]'; 

    return (
        <div ref={containerRef} className={`w-full h-full overflow-hidden border-b ${theme.toolbarBorder} relative ${bgClass}`}>
            <StaveBackgroundSVG theme={theme} />
            <canvas ref={canvasRef} className="block w-full h-full absolute top-0 left-0" />
        </div>
    );
};

export default StaveVisualizer;
