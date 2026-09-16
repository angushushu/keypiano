/**
 * Playback clock for `useAudioScheduler`.
 *
 * The tick lives in a worker because main-thread timers are throttled to about
 * once per second in background tabs, which would stall scheduled playback.
 * Only types are exported: the hook imports them with `import type`, so this
 * module is never evaluated on the main thread.
 *
 * Message contract:
 *   main -> worker : 'start' | 'stop'
 *   worker -> main : 'tick'
 */

export type TickWorkerCommand = 'start' | 'stop';
export type TickWorkerMessage = 'tick';

/** Milliseconds between ticks. Also the scheduler's effective resolution. */
const TICK_INTERVAL_MS = 25;

// The project's tsconfig loads the DOM lib, not the WebWorker lib, so the
// worker global is described structurally instead of via
// DedicatedWorkerGlobalScope.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<TickWorkerCommand>) => void) | null;
  postMessage: (message: TickWorkerMessage) => void;
};

let intervalId: ReturnType<typeof setInterval> | undefined;

workerScope.onmessage = (event) => {
  if (event.data === 'start') {
    if (intervalId !== undefined) clearInterval(intervalId);
    intervalId = setInterval(() => { workerScope.postMessage('tick'); }, TICK_INTERVAL_MS);
  } else if (event.data === 'stop') {
    if (intervalId !== undefined) clearInterval(intervalId);
    intervalId = undefined;
  }
};
