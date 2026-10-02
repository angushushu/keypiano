# Imported MIDI fingering

`services/autoFingering.ts` builds physical key slots and groups attacks within
60 ms, while keeping repeated attacks in separate groups. `services/fingeringPlanner.ts` produces key, modifier, hand and finger
assignments for those groups. `workers/fingeringWorker.ts` runs the search off
the UI thread; `hooks/useFingeringPlan.ts` cancels obsolete work and maps the
serialized results back to the original event objects. Practice playback waits
for the current plan. Recorded key codes are preserved.

## Model and objective

The plan first minimizes adaptations (serial chord presses, early releases,
and unavailable pitches), then minimizes movement/preference cost. It considers
the entire sequence through a bounded beam search with backtracking. A rest of
at least 1500 ms resets posture only when no note spans the rest.

- Note durations are paired by note identity when available, with FIFO pairing
  by pitch and MIDI source metadata for older events. Exact
  simultaneous unisons share a press and hold until the longest note ends.
  Repeated attacks remain distinct. Events without note-offs end at the next
  chord, or after 500 ms at the end, for compatibility with note-only callers.
- Each key and each finger can hold only one note. A later attack that reuses
  either must choose another assignment or explicitly release the earlier note.
- The model limits each hand to 6.5 horizontal key units and three rows between
  simultaneous keys, including the modifier key. Finger order is monotonic on
  each row, and hand crossing is excluded with a one-unit tolerance.
- Individual finger pairs also have a reach bound: Euclidean distance with
  row spacing scaled by 0.8 must not exceed `0.9 + 1.4 × finger-number gap`,
  plus 1.1 when the thumb participates. Tall numpad keys use their physical
  center rather than the top row for these geometry checks.
- Left Shift or Ctrl reserves the left little finger. All main-block attacks in
  a simultaneous group share one modifier. Numpad/navigation pitches ignore
  that modifier. An already sounding note retains its onset pitch, so changing
  the modifier alone does not force an early release.
- The full-size preference favors fixed-pitch right-side keys. Either hand can
  use the main block when needed; compact mode instead favors the source-track
  or pitch-based hand and its usual upper/lower rows.
- Movement uses the chord's posture center rather than the last event in a
  file. Shorter onset intervals increase its cost. Each source track's highest
  current note carries a hand-continuity preference; modifier changes also
  incur a cost. Written sharp/flat preference is subordinate to reachability.

Default limits are 72 partial combinations, 48 completed candidates (with
space reserved for every modifier and serial playing), and 32 sequence states.
`FingeringOptions.beamWidth` allows 1–64 for diagnostics; 1 is a greedy baseline.
`FingeringPlan.pruned` records whether candidates or sequence states were cut.
This is approximate search even when a complete plan exists. Finger combinations,
serial ordering, span limits and costs are model choices, not a proven human
optimum. Serial alternatives currently play pitches from low to high.

The general idea of planning a sequence rather than independent notes is also
used in [Statistical Learning and Estimation of Piano Fingering](https://arxiv.org/abs/1904.10237).
That work concerns piano keyboards; its trained model and weights are not used
here. Our computer-keyboard geometry and weights are conservative defaults and
have not been validated against expert annotations or individual hand sizes.

## Teaching integration

Assignments expose `finger` (thumb 1 through little finger 5), `step` (zero for
a simultaneous chord), and optional `releaseBefore` key codes. The coach shows
hand/finger labels and reports adaptations. In wait mode, `nextPracticePitches`
only accepts the next serial step; future steps appear dim instead of all being
presented as simultaneous presses. Pitch matching still accepts every input
method; it does not measure which physical finger the learner used.

Wait mode also dims accepted but still sounding notes with a `•` holding cue
until their note-offs. Held notes do not keep an obsolete modifier highlighted, and their visible pitch
labels remain their onset pitches. Playback without waiting retains MIDI timing;
the coach recommends wait mode to learn serial adaptations. No MIDI events or
export data are rewritten to implement the recommended fingerings.

## Verification

Run `npm run verify`. Regression tests compare the sequence search to a greedy
baseline on a chromatic phrase, check track-aware durations, occupied keys and
fingers, simultaneous unisons, chord ordering, compact/full-size layouts,
transposition, direct-black-key presets, explicit adaptations and sequential
teaching. These are model correctness checks, not evidence of human optimality.
