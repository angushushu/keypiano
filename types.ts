export interface NoteMapping {
  note: string; // e.g., "C4"
  label: string; // The physical key label, e.g., "Q"
  code: string; // The DOM KeyboardEvent.code, e.g., "KeyQ"
}

export type KeyMap = Record<string, string>; // code -> note (e.g. "KeyZ": "C2")

export interface AudioConfig {
  volume: number;
}

export interface KeyDef {
  code: string;
  label: string;
  width?: number; // Width in units (1u = standard key)
  height?: number; // Height in units
  isModifier?: boolean;
  isDummy?: boolean; // For visual spacing or unmapped keys
  customLabel?: string; // For top row function buttons
  marginRight?: number; // Extra margin to the right in units (for F-key grouping etc)
}