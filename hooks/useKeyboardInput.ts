import { useState, useCallback, useRef } from 'react';
import { IMMUNE_TO_MODIFIERS, KEYMAP_PRESETS, KeymapID } from '../constants';

export function useKeyboardInput(initialKeymapId: KeymapID = 'freepiano') {
    const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
    const [keymapId, setKeymapId] = useState<KeymapID>(initialKeymapId);
    
    // Modifiers state
    const [tempTranspose, setTempTranspose] = useState(0); 
    
    const activeKeysRef = useRef<Set<string>>(new Set());
    const tempTransposeRef = useRef(0);
    const lastShiftLeftReleaseTime = useRef<number>(0);

    const currentKeyMap = KEYMAP_PRESETS[keymapId].map;

    const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
        if (e.repeat) return;
        const target = e.target as HTMLElement;
        if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') return;

        const code = e.code;
        
        // Block default behavior for most playing keys to prevent scrolling etc.
        if (code.startsWith('Key') || code.startsWith('Digit') || code.startsWith('Numpad') || 
            code === 'Space' || code === 'Minus' || code === 'Equal' ||
            code === 'BracketLeft' || code === 'BracketRight' || code === 'Backslash' ||
            code === 'Semicolon' || code === 'Quote' || code === 'Comma' || 
            code === 'Period' || code === 'Slash') {
             e.preventDefault();
        }

        // --- Modifier State Update ---
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
             setTempTranspose(1);
             tempTransposeRef.current = 1;
        } else if (code === 'ControlLeft' || code === 'ControlRight') {
             setTempTranspose(-1);
             tempTransposeRef.current = -1;
        }
        
        setActiveKeys(prev => {
            const next = new Set(prev);
            next.add(code);
            activeKeysRef.current = next;
            return next;
        });
    }, []);

    const handleKeyUp = useCallback((e: globalThis.KeyboardEvent) => {
        const code = e.code;
        
        // --- Modifier State Update ---
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
            setTempTranspose(0);
            tempTransposeRef.current = 0;
            if (code === 'ShiftLeft') {
                lastShiftLeftReleaseTime.current = Date.now();
            }
        } else if (code === 'ControlLeft' || code === 'ControlRight') {
            setTempTranspose(0);
            tempTransposeRef.current = 0;
        }

        // Failsafe: if OS sticky keys issue occurred, we can't trust the event
        // This is handled in `getEffectiveTranspose` logic
        
        setActiveKeys(prev => {
            const next = new Set(prev);
            next.delete(code);
            activeKeysRef.current = next;
            return next;
        });
    }, []);

    const getEffectiveTranspose = useCallback((code: string | undefined) => {
        let effectiveTranspose = tempTransposeRef.current;
        if (code && IMMUNE_TO_MODIFIERS.has(code)) {
            effectiveTranspose = 0;
        } else if (code && effectiveTranspose === 0 && code.startsWith('Numpad')) {
            // Fallback OS Numpad Shift Fix
            if (Date.now() - lastShiftLeftReleaseTime.current < 100) {
                return 1;
            }
        }
        return effectiveTranspose;
    }, []);

    return {
        activeKeys,
        setActiveKeys,
        keymapId,
        setKeymapId,
        currentKeyMap,
        tempTranspose,
        handleKeyDown,
        handleKeyUp,
        getEffectiveTranspose,
        activeKeysRef
    };
}
