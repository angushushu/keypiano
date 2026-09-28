# KeyPiano

KeyPiano turns a computer keyboard or MIDI keyboard into a polyphonic browser instrument. It is inspired by [FreePiano](https://freepiano.tiwb.com/) and includes an on-screen key map, an 88-key piano, recording, MIDI import/export, practice playback, a metronome, and several sampled instruments.

![KeyPiano keyboard interface](public/screenshot.jpg)

[Open KeyPiano](https://keypiano.app/)

## Run locally

Requirements: Node.js 18 or newer and npm.

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run verify` runs lint, tests and a full build in one go — the same sequence CI runs on every push and pull request. `npm run test:watch` reruns the unit tests when source files change.

## Playing

- Samples load as soon as the page opens; your first click or keypress unlocks Web Audio, so there is no start screen to get past.
- Play with the mapped computer keys, the visual computer keyboard, the 88-key piano, or an attached MIDI keyboard.
- The visual keyboards use one Tab stop each. Use the arrow keys to move between keys, then Enter or Space to play.
- Open **Settings → MIDI keyboard → Enable MIDI** to request MIDI permission. Permission is requested only when you choose to enable it, and can be retried after denial.
- Instrument, transpose, and octave changes are locked during recording and playback so a take always uses a consistent mapping and sound.

## Keyboard shortcuts

These work anywhere on the page (the same list is in the in-app **About** dialog):

| Key | Action |
| --- | --- |
| `Esc` | Cycle sustain level (off → short → long) |
| `F1` / `F2` | Octave down / up |
| `F3` / `F4` | Transpose down / up by a semitone |
| `F5` / `F6` | Keyboard velocity down / up |
| `F7` | Toggle the metronome |
| `F8` | Switch between the stave and keyboard views |
| `F9` | Play or pause playback |
| `F10` | Start or stop recording |
| `F11` | Stop playback and reset the position |
| `F12` | Reset transpose and octave |
| `Shift` (held) | Raise left-hand notes by one semitone |
| `Ctrl` (held) | Lower left-hand notes by one semitone |
| `Space` | Play the note mapped to the spacebar |

Octave and transpose keys (`F1`–`F4`) are ignored while recording or playing back, so a take always keeps one consistent mapping.

## Recording and MIDI

Every recording and imported MIDI file is saved in the browser (IndexedDB) as it is made, including a snapshot every few seconds while recording, so a refresh or closed tab loses at most those few seconds. The 20 most recent appear under **Recent recordings** (the history button next to MIDI export), and the latest one is reopened when the page loads. Starting a new recording never discards the previous one. If the browser refuses storage, for example in some private modes, the panel says so and KeyPiano asks before replacing an unsaved take.

Recordings store note-on and note-off events, velocity, key mapping, and transposition. MIDI import and export preserve overlapping notes of the same pitch.

MIDI files do not preserve KeyPiano-specific UI state, instrument sample names, sustain-pedal automation, or metronome settings. Imported MIDI is played with the currently selected KeyPiano instrument. KeyPiano records note events rather than microphone or rendered audio.

Track name, channel and program number from an imported file are kept and written back out, so a multi-track file survives a round trip instead of collapsing onto one channel. KeyPiano's own recordings are single-track and export on channel 1.

## Practice mode

Load a recording or MIDI file, turn on practice mode (graduation-cap button), then press Play. Playback is silent. Keys fill in with colour as their notes approach, like the notes falling in the waterfall view; a fully lit key means play it now. With **wait mode** (hourglass button, on by default) playback stops at each note or chord until you have pressed all of its notes (only the ones still to press stay fully lit), on any input: computer keyboard, on-screen keys or a MIDI keyboard. Notes are matched by pitch, so transposition does not matter. **Skip** moves past notes you cannot reach. Turn wait mode off to play along at a fixed tempo, optionally slowed down with the speed control.

Pieces you recorded on the computer keyboard light the exact keys you pressed. For imported MIDI, KeyPiano picks keys the way a keyboard piano is played: the left hand on the two lower letter rows and the right hand on the Q and number rows (a file with separate tracks per hand keeps that split; otherwise the top note of each chord is the right hand and the rest split at middle C), black keys as Shift on the key below (or Ctrl on the key above for flats), and each hand staying near where it already is. Hints use only the main keys unless **Settings → My keyboard has a numpad** is on. When notes fall outside the keys' range, practice mode suggests an octave that fits more of them.

## Browser support

| Capability | Chromium browsers | Firefox | Safari |
| --- | --- | --- | --- |
| Computer keyboard and Web Audio | Supported | Supported | Supported |
| Installable PWA | Supported | Varies by platform | Supported on current Apple platforms |
| Web MIDI keyboard input | Supported | Not generally available | Not generally available |

Chrome or Edge is recommended when using a physical MIDI keyboard. Audio sample files are fetched on first use from the server chosen in **Settings → Sample server**: the upstream GitHub hosts by default, or a jsDelivr mirror (Fastly or Gcore) of the same files, pinned to a fixed commit. If sounds stay silent or load slowly, as can happen from mainland China, switch servers there. The service worker caches successfully downloaded samples for later sessions, but a sound that has never been loaded still requires a network connection.

## Privacy

KeyPiano runs in the browser and does not upload performances. The site uses Google Analytics to count visits and to record which sample server is chosen and how long its samples take to load (`sample_source_change` and `sample_load` events); nothing you play is sent to it. Selecting the coffee link or a related project opens that external site in a new tab.

## Production build

```bash
npm run build
npm run preview
```

The deploy script publishes `dist/` through `gh-pages`:

```bash
npm run deploy
```

`public/CNAME` pins the `keypiano.app` custom domain. It has to live in `public/` so Vite copies it into `dist/` — `gh-pages` replaces the branch contents on every deploy, so a `CNAME` kept only on the branch would be deleted and the domain would stop resolving.

The production build includes the web app manifest, service worker, scalable app icons, sitemap, robots file, and social preview image.

## License

MIT — see [LICENSE](LICENSE). That covers the source code only: instrument samples are fetched from third-party hosts at runtime and remain under their own licences.

## Changelog

Notable changes are listed in [CHANGELOG.md](CHANGELOG.md).
