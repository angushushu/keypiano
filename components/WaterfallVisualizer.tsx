import React, { useEffect, useRef, useMemo } from 'react';
import { RecordedEvent } from '../types';
import { NOTE_NAMES, getTransposedNote, FLAT_TO_SHARP, noteToMidi } from '../constants';
import { Theme } from '../theme';

interface WaterfallVisualizerProps {
    recording: RecordedEvent[];
    currentTimeMs: number;
    playbackSpeed: number;
    lookaheadMs?: number; 
    theme?: Theme;
}

const WaterfallVisualizer: React.FC<WaterfallVisualizerProps> = ({
    recording,
    currentTimeMs,
    playbackSpeed,
    lookaheadMs = 2500,
    theme
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Pre-calculate positions for all 88 keys to avoid doing it per frame
    const keyLayout = useMemo(() => {
        const keys = [];
        for (let i = 0; i < 88; i++) {
            const midi = i + 21;
            const noteName = NOTE_NAMES[midi % 12];
            keys.push({ midi, isBlack: noteName.includes('#') });
        }
        const whiteKeys = keys.filter(k => !k.isBlack);
        const layout = new Map<number, { xPct: number, widthPct: number, isBlack: boolean }>();
        
        const unitWidthPct = 100 / whiteKeys.length;
        const blackWidthPct = unitWidthPct * 0.65;

        keys.forEach(k => {
            if (!k.isBlack) {
                const wIdx = whiteKeys.findIndex(w => w.midi === k.midi);
                layout.set(k.midi, { xPct: wIdx * unitWidthPct, widthPct: unitWidthPct, isBlack: false });
            } else {
                const prevWIdx = whiteKeys.findIndex(w => w.midi === k.midi - 1);
                layout.set(k.midi, { 
                    xPct: (prevWIdx + 1) * unitWidthPct - (blackWidthPct / 2), 
                    widthPct: blackWidthPct, 
                    isBlack: true 
                });
            }
        });
        return layout;
    }, []);

    // Produce blocks with start/end time
    const noteBlocks = useMemo(() => {
        const blocks: { midi: number, startTime: number, endTime: number, isBlack: boolean }[] = [];
        const activeMap = new Map<string, number>();

        for (const evt of recording) {
            const visualNote = getTransposedNote(evt.note, evt.transpose);
            const midi = noteToMidi(visualNote);
            const key = `${midi}_${evt.code || 'nocode'}`;
            
            if (evt.type === 'on') {
                activeMap.set(key, evt.time);
            } else {
                const st = activeMap.get(key);
                if (st !== undefined) {
                    blocks.push({ midi, startTime: st, endTime: Math.max(evt.time, st + 50), isBlack: keyLayout.get(midi)?.isBlack || false });
                    activeMap.delete(key);
                }
            }
        }
        
        // Any notes still 'on' at the end of recording calculation, give them a nominal duration
        activeMap.forEach((st, key) => {
            const midi = parseInt(key.split('_')[0], 10);
            blocks.push({ midi, startTime: st, endTime: st + 500, isBlack: keyLayout.get(midi)?.isBlack || false });
        });

        return blocks;
    }, [recording, keyLayout]);

    // Track canvas dimensions to avoid reallocating every frame
    const canvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const updateCanvasSize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const newW = Math.round(rect.width * dpr);
            const newH = Math.round(rect.height * dpr);
            if (canvasSizeRef.current.width !== newW || canvasSizeRef.current.height !== newH) {
                canvas.width = newW;
                canvas.height = newH;
                canvasSizeRef.current = { width: newW, height: newH };
            }
        };

        // ResizeObserver to handle container size changes
        const resizeObserver = new ResizeObserver(() => {
            updateCanvasSize();
        });
        resizeObserver.observe(canvas);
        updateCanvasSize();

        const render = () => {
            const { width: cw, height: ch } = canvasSizeRef.current;
            if (cw === 0 || ch === 0) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }
            const dpr = window.devicePixelRatio || 1;
            const width = cw / dpr;
            const height = ch / dpr;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            // Time window bounds
            const visibleStartTime = currentTimeMs;
            const visibleEndTime = currentTimeMs + (lookaheadMs / playbackSpeed);

            // Draw grid lines separating white keys for reference
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const whiteKeyCount = 52;
            const unitWidth = width / whiteKeyCount;
            for (let i = 1; i < whiteKeyCount; i++) {
                ctx.moveTo(i * unitWidth, 0);
                ctx.lineTo(i * unitWidth, height);
            }
            ctx.stroke();

            // Draw blocks
            noteBlocks.forEach(blk => {
                if (blk.endTime < visibleStartTime || blk.startTime > visibleEndTime) return;

                const layout = keyLayout.get(blk.midi);
                if (!layout) return;

                const x = (layout.xPct / 100) * width;
                const blockWidth = (layout.widthPct / 100) * width;

                const pixelsPerMs = height / (lookaheadMs / playbackSpeed);
                
                const msFromHitToStart = blk.startTime - currentTimeMs;
                const msFromHitToEnd = blk.endTime - currentTimeMs;

                let yBottom = height - (msFromHitToStart * pixelsPerMs);
                let yTop = height - (msFromHitToEnd * pixelsPerMs);
                
                yTop = Math.max(-50, yTop);
                yBottom = Math.min(height + 50, yBottom);

                const blockHeight = Math.max(yBottom - yTop, 4);
                
                const radius = Math.min(blockWidth / 3, 4);

                const baseColorHex = blk.isBlack ? (theme?.waterfallBlackHex || '#22c55e') : (theme?.waterfallWhiteHex || '#86efac');
                const fadedColor = baseColorHex + '0D';
                
                const gradient = ctx.createLinearGradient(0, yTop, 0, yBottom);
                gradient.addColorStop(0, fadedColor);
                gradient.addColorStop(1, baseColorHex);

                ctx.fillStyle = gradient;

                if (currentTimeMs >= blk.startTime && currentTimeMs <= blk.endTime) {
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = baseColorHex;
                } else {
                    ctx.shadowBlur = 0;
                }

                ctx.beginPath();
                ctx.roundRect(x + 1, yTop, blockWidth - 2, blockHeight, radius);
                ctx.fill();
            });

            // Draw Hit Line at the bottom
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(0, height - 3, width, 3);

            animationFrameId = requestAnimationFrame(render);
        };
        
        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            resizeObserver.disconnect();
        };
    }, [noteBlocks, currentTimeMs, playbackSpeed, lookaheadMs, keyLayout, theme]);

    return (
        <div className="w-full h-full p-1 rounded bg-[#1a1a1a]">
            <canvas 
                ref={canvasRef} 
                className="w-full h-full block rounded-t"
            />
        </div>
    );
};

export default WaterfallVisualizer;
