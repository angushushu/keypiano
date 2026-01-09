import { KeyMap, KeyDef } from './types';

// Keyboard Note Mapping (Unchanged)
export const KEY_TO_NOTE: KeyMap = {
  // --- Row 1 (Numbers) ---
  'Backquote': 'B4', 'Digit1': 'C5', 'Digit2': 'D5', 'Digit3': 'E5', 'Digit4': 'F5', 'Digit5': 'G5',
  'Digit6': 'A5', 'Digit7': 'B5', 'Digit8': 'C6', 'Digit9': 'D6', 'Digit0': 'E6', 'Minus': 'F6',
  'Equal': 'G6', 'Backspace': 'A6',
  // --- Row 2 (Tab/QWERTY) ---
  'Tab': 'B3', 'KeyQ': 'C4', 'KeyW': 'D4', 'KeyE': 'E4', 'KeyR': 'F4', 'KeyT': 'G4', 'KeyY': 'A4',
  'KeyU': 'B4', 'KeyI': 'C5', 'KeyO': 'D5', 'KeyP': 'E5', 'BracketLeft': 'F5', 'BracketRight': 'G5',
  'Backslash': 'A5',
  // --- Row 3 (Caps/ASDF) ---
  'CapsLock': 'B2', 'KeyA': 'C3', 'KeyS': 'D3', 'KeyD': 'E3', 'KeyF': 'F3', 'KeyG': 'G3', 'KeyH': 'A3',
  'KeyJ': 'B3', 'KeyK': 'C4', 'KeyL': 'D4', 'Semicolon': 'E4', 'Quote': 'F4', 'Enter': 'G4',
  // --- Row 4 (Shift/ZXCV) ---
  'KeyZ': 'C2', 'KeyX': 'D2', 'KeyC': 'E2', 'KeyV': 'F2', 'KeyB': 'G2', 'KeyN': 'A2', 'KeyM': 'B2',
  'Comma': 'C3', 'Period': 'D3', 'Slash': 'E3', 'ShiftRight': 'F3',
  // --- Numpad ---
  'NumLock': 'F5', 'NumpadDivide': 'G5', 'NumpadMultiply': 'A5', 'NumpadSubtract': 'B5',
  'Numpad7': 'B4', 'Numpad8': 'C5', 'Numpad9': 'D5', 'NumpadAdd': 'E5',
  'Numpad4': 'F4', 'Numpad5': 'G4', 'Numpad6': 'A4',
  'Numpad1': 'C4', 'Numpad2': 'D4', 'Numpad3': 'E4', 'NumpadEnter': 'B3',
  'Numpad0': 'G3', 'NumpadDecimal': 'A3',
  // --- Navigation ---
  'Insert': 'F6', 'Home': 'G6', 'PageUp': 'A6',
  'Delete': 'C6', 'End': 'D6', 'PageDown': 'E6',
  'ArrowUp': 'F3', 'ArrowLeft': 'C3', 'ArrowDown': 'D3', 'ArrowRight': 'E3',
};

// FULL KEYBOARD ROW DEFINITIONS
// We use a single grid system. 
// Main Block ends at ~15u. Gap 0.5u. Nav Block 3u. Gap 0.5u. Num Block 4u. Total ~23u.
// To handle the Numpad Enter/Plus height, we use grid-row-span in the component.

export const FULL_ROW_0: KeyDef[] = [
  { code: 'Escape', label: 'Esc', customLabel: 'SUSTAIN' }, 
  { code: 'dummy_0_1', label: '', width: 1, isDummy: true }, // Gap 1u
  { code: 'F1', label: 'F1' }, { code: 'F2', label: 'F2' }, { code: 'F3', label: 'F3', customLabel: 'KS-' }, { code: 'F4', label: 'F4', customLabel: 'KS+' },
  { code: 'dummy_0_2', label: '', width: 0.5, isDummy: true }, // Gap 0.5u
  { code: 'F5', label: 'F5', customLabel: 'OC-' }, { code: 'F6', label: 'F6', customLabel: 'OC+' }, { code: 'F7', label: 'F7', customLabel: 'V-' }, { code: 'F8', label: 'F8', customLabel: 'V+' },
  { code: 'dummy_0_3', label: '', width: 0.5, isDummy: true }, // Gap 0.5u
  { code: 'F9', label: 'F9' }, { code: 'F10', label: 'F10' }, { code: 'F11', label: 'F11' }, { code: 'F12', label: 'F12' },
  { code: 'dummy_0_4', label: '', width: 0.5, isDummy: true }, // Gap 0.5u (Main to Nav)
  // UPDATED: Control keys mapped to Play/Rec/Stop
  { code: 'PrintScreen', label: 'Play' }, { code: 'ScrollLock', label: 'Rec' }, { code: 'Pause', label: 'Stop' },
  { code: 'dummy_0_5', label: '', width: 0.5, isDummy: true }, // Gap 0.5u (Nav to Num)
  { code: 'dummy_0_6', label: '', width: 4, isDummy: true }, // Empty Numpad top area
];

export const FULL_ROW_1: KeyDef[] = [
  { code: 'Backquote', label: '~' }, { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' }, { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' }, { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' }, { code: 'Digit9', label: '9' }, { code: 'Digit0', label: '0' }, { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' }, { code: 'Backspace', label: '←', width: 2 },
  { code: 'dummy_1_1', label: '', width: 0.5, isDummy: true }, // Gap
  { code: 'Insert', label: 'Ins' }, { code: 'Home', label: 'Home' }, { code: 'PageUp', label: 'PgUp' },
  { code: 'dummy_1_2', label: '', width: 0.5, isDummy: true }, // Gap
  { code: 'NumLock', label: 'Num' }, { code: 'NumpadDivide', label: '/' }, { code: 'NumpadMultiply', label: '*' }, { code: 'NumpadSubtract', label: '-' },
];

export const FULL_ROW_2: KeyDef[] = [
  { code: 'Tab', label: 'Tab', width: 1.5 }, { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' }, { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' }, { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' }, { code: 'KeyP', label: 'P' }, { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' }, { code: 'Backslash', label: '\\', width: 1.5 },
  { code: 'dummy_2_1', label: '', width: 0.5, isDummy: true },
  { code: 'Delete', label: 'Del' }, { code: 'End', label: 'End' }, { code: 'PageDown', label: 'PgDn' },
  { code: 'dummy_2_2', label: '', width: 0.5, isDummy: true },
  { code: 'Numpad7', label: '7' }, { code: 'Numpad8', label: '8' }, { code: 'Numpad9', label: '9' }, { code: 'NumpadAdd', label: '+', height: 2 },
];

export const FULL_ROW_3: KeyDef[] = [
  { code: 'CapsLock', label: 'Caps', width: 1.75 }, { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' }, { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' }, { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' }, { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" }, { code: 'Enter', label: 'Enter', width: 2.25 },
  { code: 'dummy_3_1', label: '', width: 0.5, isDummy: true },
  { code: 'dummy_3_2', label: '', width: 3, isDummy: true }, // Nav middle gap
  { code: 'dummy_3_3', label: '', width: 0.5, isDummy: true },
  { code: 'Numpad4', label: '4' }, { code: 'Numpad5', label: '5' }, { code: 'Numpad6', label: '6' }, 
  // NumpadAdd spans from above, so we don't render anything in 4th col
];

export const FULL_ROW_4: KeyDef[] = [
  { code: 'ShiftLeft', label: 'Shift', width: 2.25, isModifier: true }, { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' }, { code: 'KeyC', label: 'C' }, { code: 'KeyV', label: 'V' }, { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' }, { code: 'KeyM', label: 'M' }, { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' }, { code: 'ShiftRight', label: 'Shift', width: 2.75 },
  { code: 'dummy_4_1', label: '', width: 0.5, isDummy: true },
  { code: 'dummy_4_2', label: '', width: 1, isDummy: true }, { code: 'ArrowUp', label: '↑' }, { code: 'dummy_4_3', label: '', width: 1, isDummy: true },
  { code: 'dummy_4_4', label: '', width: 0.5, isDummy: true },
  { code: 'Numpad1', label: '1' }, { code: 'Numpad2', label: '2' }, { code: 'Numpad3', label: '3' }, { code: 'NumpadEnter', label: 'Ent', height: 2 },
];

export const FULL_ROW_5: KeyDef[] = [
  { code: 'ControlLeft', label: 'Ctrl', width: 1.25, isModifier: true }, { code: 'MetaLeft', label: 'Win', width: 1.25, isDummy: true }, { code: 'AltLeft', label: 'Alt', width: 1.25, isDummy: true }, { code: 'Space', label: 'KeyPiano', width: 6.25 }, { code: 'AltRight', label: 'Alt', width: 1.25, isDummy: true }, { code: 'MetaRight', label: 'Win', width: 1.25, isDummy: true }, { code: 'ContextMenu', label: 'Menu', width: 1.25, isDummy: true }, { code: 'ControlRight', label: 'Ctrl', width: 1.25, isDummy: true },
  { code: 'dummy_5_1', label: '', width: 0.5, isDummy: true },
  { code: 'ArrowLeft', label: '←' }, { code: 'ArrowDown', label: '↓' }, { code: 'ArrowRight', label: '→' },
  { code: 'dummy_5_2', label: '', width: 0.5, isDummy: true },
  { code: 'Numpad0', label: '0', width: 2 }, { code: 'NumpadDecimal', label: '.' },
  // NumpadEnter spans from above
];

export const ALL_ROWS = [FULL_ROW_0, FULL_ROW_1, FULL_ROW_2, FULL_ROW_3, FULL_ROW_4, FULL_ROW_5];