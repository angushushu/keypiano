import { useState, useCallback, useEffect, useRef, type SetStateAction } from 'react';
import { IMMUNE_TO_MODIFIERS, KEYMAP_PRESETS, KeymapID } from '../constants';

/** Only #L/bL change pitches. Right Shift is a mapped performance key. */
export const heldTranspose = (keys: ReadonlySet<string>, latest?: string): number => {
    if (latest === 'ControlLeft' && keys.has(latest)) return -1;
    if (keys.has('ShiftLeft')) return 1;
    return keys.has('ControlLeft') ? -1 : 0;
};

export function useKeyboardInput(initialKeymapId: KeymapID = 'freepiano') {
    const [activeKeys, setActiveKeysState] = useState<Set<string>>(new Set());
    const [keymapId, setKeymapId] = useState<KeymapID>(() => {
        try {
            const stored = localStorage.getItem('keypiano.keymap.v1');
            return stored && stored in KEYMAP_PRESETS ? stored as KeymapID : initialKeymapId;
        } catch {
            return initialKeymapId;
        }
    });
    
    // Modifiers state
    const [tempTranspose, setTempTranspose] = useState(0); 
    
    const activeKeysRef = useRef<Set<string>>(new Set());
    const tempTransposeRef = useRef(0);
    const lastShiftLeftReleaseTime = useRef<number>(0);

    const setActiveKeys = useCallback((updater: SetStateAction<Set<string>>) => {
        setActiveKeysState(previous => {
            const next = typeof updater === 'function'
                ? (updater as (value: Set<string>) => Set<string>)(previous)
                : updater;
            activeKeysRef.current = next;
            return next;
        });
    }, []);

    const currentKeyMap = KEYMAP_PRESETS[keymapId].map;

    useEffect(() => {
        try {
            localStorage.setItem('keypiano.keymap.v1', keymapId);
        } catch {
            // Storage is an enhancement, not a requirement for playing.
        }
    }, [keymapId]);

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
        const next = new Set(activeKeysRef.current);
        next.add(code);
        if (code === 'ShiftLeft' || code === 'ControlLeft') {
             const modifier = heldTranspose(next, code);
             setTempTranspose(modifier);
             tempTransposeRef.current = modifier;
        }
        
        activeKeysRef.current = next;
        setActiveKeys(next);
    }, []);

    const handleKeyUp = useCallback((e: globalThis.KeyboardEvent) => {
        const code = e.code;
        
        // --- Modifier State Update ---
        const next = new Set(activeKeysRef.current);
        next.delete(code);
        if (code === 'ShiftLeft' || code === 'ControlLeft') {
            const modifier = heldTranspose(next);
            setTempTranspose(modifier);
            tempTransposeRef.current = modifier;
            if (code === 'ShiftLeft') {
                lastShiftLeftReleaseTime.current = Date.now();
            }
        }

        // Failsafe: if OS sticky keys issue occurred, we can't trust the event
        // This is handled in `getEffectiveTranspose` logic
        
        activeKeysRef.current = next;
        setActiveKeys(next);
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

    const resetKeyboardState = useCallback(() => {
        activeKeysRef.current = new Set();
        tempTransposeRef.current = 0;
        setActiveKeysState(new Set());
        setTempTranspose(0);
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
        activeKeysRef,
        resetKeyboardState,
    };
}
