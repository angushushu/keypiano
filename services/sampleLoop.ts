export interface SustainLoop {
    buffer: AudioBuffer;
    start: number;
    end: number;
}

/**
 * The MP3 soundfonts have no loop markers. Find a loud, steady part after the
 * attack, then crossfade its end into the frames immediately before its start.
 * Keep the original attack; never replay it or the sample's silent/release tail.
 * Called once per decoded sample, never on the note-on path.
 */
export function prepareSustainLoop(
    ctx: Pick<BaseAudioContext, 'createBuffer'>,
    buffer: AudioBuffer,
    attackSeconds: number,
): SustainLoop | null {
    const blockSize = Math.max(1, Math.round(buffer.sampleRate * 0.02));
    const blockCount = Math.floor(buffer.length / blockSize);
    const firstBlock = Math.max(1, Math.ceil(Math.min(attackSeconds, buffer.duration * 0.2) * buffer.sampleRate / blockSize));
    if (blockCount - firstBlock < 6) return null;

    // Sum channel energies rather than mixing channels, which could cancel
    // phase-inverted stereo samples and mistake an audible region for silence.
    const energies = new Float64Array(blockCount);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let block = firstBlock; block < blockCount; block++) {
            let energy = 0;
            for (let i = block * blockSize; i < (block + 1) * blockSize; i++) {
                energy += data[i] * data[i];
            }
            energies[block] += energy / blockSize;
        }
    }

    let peak = 0;
    for (const energy of energies) peak = Math.max(peak, energy);
    if (peak < 1e-10) return null;

    // Prefer a 600 ms stable region; shorter samples can use shorter loops.
    // Try a short region too when a long attack/release leaves little plateau.
    let bestStart = -1;
    let bestLength = 0;
    for (const seconds of [0.6, 0.12]) {
        const length = Math.min(Math.round(seconds * buffer.sampleRate / blockSize), blockCount - firstBlock);
        let bestScore = -Infinity;
        for (let start = firstBlock; start + length <= blockCount; start++) {
            let sum = 0;
            let squares = 0;
            let minimum = Infinity;
            for (let i = start; i < start + length; i++) {
                sum += energies[i];
                squares += energies[i] * energies[i];
                minimum = Math.min(minimum, energies[i]);
            }
            const mean = sum / length;
            // Judge silence relative to this region, not the loudest block in
            // the whole recording: organ attacks and tremolo can have peaks
            // far above their otherwise usable steady tone.
            if (mean < 1e-10 || minimum < mean * 0.001) continue;
            const variation = Math.sqrt(Math.max(0, squares / length - mean * mean)) / mean;
            const score = mean / (1 + 8 * variation);
            if (score > bestScore) {
                bestScore = score;
                bestStart = start;
                bestLength = length;
            }
        }
        if (bestStart >= 0) break;
    }
    if (bestStart < 0) return null;

    const regionStart = bestStart * blockSize;
    const endFrame = (bestStart + bestLength) * blockSize;
    const fadeFrames = Math.max(2, Math.min(Math.round(buffer.sampleRate * 0.03), Math.floor((endFrame - regionStart) / 4)));
    const startFrame = regionStart + fadeFrames;
    const prepared = ctx.createBuffer(buffer.numberOfChannels, endFrame, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const input = buffer.getChannelData(channel);
        const output = prepared.getChannelData(channel);
        output.set(input.subarray(0, endFrame));
        for (let i = 0; i < fadeFrames; i++) {
            const position = i / (fadeFrames - 1);
            const mix = position * position * (3 - 2 * position);
            const tail = endFrame - fadeFrames + i;
            output[tail] = input[tail] * (1 - mix) + input[regionStart + i] * mix;
        }
    }
    return { buffer: prepared, start: startFrame / buffer.sampleRate, end: endFrame / buffer.sampleRate };
}
