import { useReducer, useRef, useEffect, useCallback } from 'react';
import { RecordedEvent } from '../types';
import { closeOpenNotes, createTakeId } from '../services/takeStore';
import { noteQueueKey } from '../services/waitGate';

// ─── State ──────────────────────────────────────────────────────

export interface RecordingState {
  isRecording: boolean;
  recordedEvents: RecordedEvent[];
  recordingStartTime: number;
  elapsedTime: number;
}

export const initialRecordingState: RecordingState = {
  isRecording: false,
  recordedEvents: [],
  recordingStartTime: 0,
  elapsedTime: 0,
};

// ─── Actions ────────────────────────────────────────────────────

export type RecordingAction =
  | { type: 'START_RECORDING'; startTime: number }
  | { type: 'STOP_RECORDING'; events: RecordedEvent[] }
  | { type: 'TICK_TIMER'; elapsed: number }
  | { type: 'RESET_TIMER' }
  | { type: 'SET_EVENTS'; events: RecordedEvent[] }
  | { type: 'SET_ELAPSED'; elapsed: number };

// ─── Reducer ────────────────────────────────────────────────────

export function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
  switch (action.type) {
    case 'START_RECORDING':
      return {
        ...state,
        isRecording: true,
        recordedEvents: [],
        recordingStartTime: action.startTime,
        elapsedTime: 0,
      };
    case 'STOP_RECORDING':
      return {
        ...state,
        isRecording: false,
        recordedEvents: action.events,
      };
    case 'TICK_TIMER':
      return { ...state, elapsedTime: action.elapsed };
    case 'RESET_TIMER':
      return { ...state, elapsedTime: 0 };
    case 'SET_EVENTS':
      return {
        ...state,
        isRecording: false,
        recordedEvents: action.events,
        recordingStartTime: 0,
        elapsedTime: 0,
      };
    case 'SET_ELAPSED':
      return { ...state, elapsedTime: action.elapsed };
    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────────

export function useRecordingState() {
  const [state, dispatch] = useReducer(recordingReducer, initialRecordingState);
  const recordingRef = useRef<RecordedEvent[]>([]);
  // A first note can start recording and be captured in the same event turn,
  // before React has rendered the new state (including a simultaneous chord).
  const sessionRef = useRef({ active: false, startTime: 0 });
  const heldNoteIds = useRef(new Map<string, string[]>());

  // Timer effect
  useEffect(() => {
    let interval: number;
    if (state.isRecording) {
      interval = window.setInterval(
        () => dispatch({ type: 'TICK_TIMER', elapsed: Date.now() - state.recordingStartTime }),
        50
      );
    }
    return () => clearInterval(interval);
  }, [state.isRecording, state.recordingStartTime]);

  const addRecordingEvent = useCallback((evt: RecordedEvent) => {
    recordingRef.current.push(evt);
  }, []);

  const captureEvent = useCallback((evt: Omit<RecordedEvent, 'time'>) => {
    if (!sessionRef.current.active) return;
    const key = noteQueueKey({ ...evt, time: 0 });
    const queue = heldNoteIds.current.get(key) ?? [];
    const noteId = evt.type === 'on' ? createTakeId() : queue.shift();
    if (!noteId) return; // A key held before recording has no recorded onset.
    if (evt.type === 'on') queue.push(noteId);
    if (queue.length) heldNoteIds.current.set(key, queue);
    else heldNoteIds.current.delete(key);
    recordingRef.current.push({ ...evt, noteId, time: Math.max(0, Date.now() - sessionRef.current.startTime) });
  }, []);

  const startAppendRecording = useCallback((offset: number, clearPlaybackVisuals: () => void, pausePlayback: () => void) => {
    if (sessionRef.current.active) return;
    pausePlayback();
    recordingRef.current = [...recordingRef.current];
    heldNoteIds.current.clear();
    const startTime = Date.now() - offset;
    sessionRef.current = { active: true, startTime };
    clearPlaybackVisuals();
    dispatch({ type: 'START_RECORDING', startTime });
  }, []);

  const startRecording = useCallback((clearPlaybackVisuals: () => void, pausePlayback: () => void) => {
    pausePlayback();
    recordingRef.current = [];
    heldNoteIds.current.clear();
    clearPlaybackVisuals();
    const startTime = Date.now();
    sessionRef.current = { active: true, startTime };
    dispatch({ type: 'START_RECORDING', startTime });
  }, []);

  const stopRecording = useCallback(() => {
    if (sessionRef.current.active) {
      recordingRef.current = closeOpenNotes([...recordingRef.current], Date.now() - sessionRef.current.startTime);
      sessionRef.current.active = false;
      heldNoteIds.current.clear();
    }
    dispatch({ type: 'STOP_RECORDING', events: [...recordingRef.current] });
    dispatch({ type: 'SET_ELAPSED', elapsed: recordingRef.current.reduce((end, event) => Math.max(end, event.time), 0) });
  }, []);

  const stopAndReset = useCallback((pausePlayback: () => void) => {
    stopRecording();
    if (recordingRef.current.length > 0) {
      dispatch({ type: 'STOP_RECORDING', events: [...recordingRef.current] });
    } else {
      dispatch({ type: 'STOP_RECORDING', events: state.recordedEvents });
    }
    pausePlayback();
    dispatch({ type: 'RESET_TIMER' });
  }, [state.recordedEvents, stopRecording]);

  const toggleRecording = useCallback((clearPlaybackVisuals: () => void, pausePlayback: () => void) => {
    if (sessionRef.current.active) {
      stopRecording();
    } else {
      startRecording(clearPlaybackVisuals, pausePlayback);
    }
  }, [state.isRecording, stopRecording, startRecording]);

  const loadMidiEvents = useCallback((events: RecordedEvent[], pausePlayback: () => void) => {
    pausePlayback();
    sessionRef.current.active = false;
    heldNoteIds.current.clear();
    recordingRef.current = events;
    dispatch({ type: 'SET_EVENTS', events });
  }, []);

  return {
    ...state,
    recordingRef,
    addRecordingEvent,
    captureEvent,
    startAppendRecording,
    sessionRef,
    startRecording,
    stopRecording,
    stopAndReset,
    toggleRecording,
    loadMidiEvents,
    dispatch,
  };
}
