import { InstrumentID } from './services/audioEngine';

export interface KeyDef {
  code: string;
  label: string;
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
}
