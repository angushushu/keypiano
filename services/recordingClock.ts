import type { AutoCaptureMode } from '../types';

/** One take can pause its musical clock without ending its recording session. */
export class RecordingClock {
    active = false;
    startTime = 0;
    private mode: AutoCaptureMode = 'continuous';
    private elapsed = 0;
    private runningSince: number | null = null;
    private held = 0;

    get paused() { return this.active && this.mode === 'pressed' && this.held === 0; }

    start(offset = 0, mode: AutoCaptureMode = 'continuous', now = Date.now()) {
        this.active = true;
        this.startTime = now;
        this.elapsed = Math.max(0, offset);
        this.mode = mode;
        this.held = 0;
        this.runningSince = mode === 'continuous' ? now : null;
    }

    read(now = Date.now()) {
        return this.elapsed + (this.runningSince === null ? 0 : Math.max(0, now - this.runningSince));
    }

    noteOn(now = Date.now()) {
        if (!this.active) return;
        if (this.mode === 'pressed' && this.held === 0) this.runningSince = now;
        this.held++;
    }

    noteOff(now = Date.now()) {
        if (!this.active || this.held === 0) return;
        this.held--;
        if (this.mode === 'pressed' && this.held === 0) {
            this.elapsed = this.read(now);
            this.runningSince = null;
        }
    }

    stop(now = Date.now()) {
        this.elapsed = this.read(now);
        this.runningSince = null;
        this.active = false;
        this.held = 0;
        return this.elapsed;
    }
}
