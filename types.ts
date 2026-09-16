import { InstrumentID } from './services/audioEngine';

export interface KeyDef {
  code: string;
  label: string;
  description?: string;
  customLabel?: string;
  width?: number;
  height?: number;
  isDummy?: boolean;
  isModifier?: boolean;
}

export interface RecordedEvent {
  time: number;
  type: 'on' | 'off';
  note: string;
  code?: string; // Physical key code for visual playback
  transpose: number;
  instrumentId: InstrumentID;
  velocity?: number;
  /**
   * MIDI metadata, carried so a file survives an import/export round trip
   * without collapsing into a single track. KeyPiano's own recordings leave
   * these undefined and are exported on channel 1.
   */
  channel?: number;   // 0-15
  trackName?: string;
  program?: number;   // General MIDI program number, 0-127
}

export type NoteType = 'user' | 'practice';

export interface TriggerNote {
  note: string;
  time: number;
  type: NoteType;
}
