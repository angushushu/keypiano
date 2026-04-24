import { useReducer, useRef, useEffect, useCallback } from 'react';
import { RecordedEvent } from '../types';

// ─── State ──────────────────────────────────────────────────────

interface RecordingState {
  isRecording: boolean;
  recordedEvents: RecordedEvent[];
  recordingStartTime: number;
  elapsedTime: number;
}

const initialRecordingState: RecordingState = {
  isRecording: false,
  recordedEvents: [],
  recordingStartTime: 0,
  elapsedTime: 0,
};

// ─── Actions ────────────────────────────────────────────────────

type RecordingAction =
  | { type: 'START_RECORDING'; startTime: number }
  | { type: 'STOP_RECORDING'; events: RecordedEvent[] }
  | { type: 'TICK_TIMER'; elapsed: number }
  | { type: 'RESET_TIMER' }
  | { type: 'SET_EVENTS'; events: RecordedEvent[] }
  | { type: 'SET_ELAPSED'; elapsed: number };

// ─── Reducer ────────────────────────────────────────────────────

function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
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
      return { ...state, recordedEvents: action.events, elapsedTime: 0 };
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

  const startRecording = useCallback((clearPlaybackVisuals: () => void, pausePlayback: () => void) => {
    pausePlayback();
    recordingRef.current = [];
    clearPlaybackVisuals();
    dispatch({ type: 'START_RECORDING', startTime: Date.now() });
  }, []);

  const stopRecording = useCallback(() => {
    dispatch({ type: 'STOP_RECORDING', events: [...recordingRef.current] });
  }, []);

  const stopAndReset = useCallback((pausePlayback: () => void) => {
    if (recordingRef.current.length > 0) {
      dispatch({ type: 'STOP_RECORDING', events: [...recordingRef.current] });
    } else {
      dispatch({ type: 'STOP_RECORDING', events: state.recordedEvents });
    }
    pausePlayback();
    dispatch({ type: 'RESET_TIMER' });
  }, [state.recordedEvents]);

  const toggleRecording = useCallback((clearPlaybackVisuals: () => void, pausePlayback: () => void) => {
    if (state.isRecording) {
      stopRecording();
    } else {
      startRecording(clearPlaybackVisuals, pausePlayback);
    }
  }, [state.isRecording, stopRecording, startRecording]);

  const loadMidiEvents = useCallback((events: RecordedEvent[], pausePlayback: () => void) => {
    pausePlayback();
    recordingRef.current = events;
    dispatch({ type: 'SET_EVENTS', events });
  }, []);

  return {
    ...state,
    recordingRef,
    addRecordingEvent,
    startRecording,
    stopRecording,
    stopAndReset,
    toggleRecording,
    loadMidiEvents,
    dispatch,
  };
}
