# KeyPiano

KeyPiano turns a computer keyboard or MIDI keyboard into a polyphonic browser instrument. It is inspired by [FreePiano](https://freepiano.tiwb.com/) and includes an on-screen key map, an 88-key piano, recording, MIDI import/export, practice playback, a metronome, and several sampled instruments.

![KeyPiano keyboard interface](/screenshot.png)

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

`npm run test:watch` reruns the unit tests when source files change.

## Playing

- Click **Start Engine** once to unlock Web Audio and load the selected instrument.
- Play with the mapped computer keys, the visual computer keyboard, the 88-key piano, or an attached MIDI keyboard.
- The visual keyboards use one Tab stop each. Use the arrow keys to move between keys, then Enter or Space to play.
- Open **Settings → MIDI keyboard → Enable MIDI** to request MIDI permission. Permission is requested only when you choose to enable it, and can be retried after denial.
- Instrument, transpose, and octave changes are locked during recording and playback so a take always uses a consistent mapping and sound.

## Recording and MIDI

Recordings store note-on and note-off events, velocity, key mapping, and transposition. MIDI import and export preserve overlapping notes of the same pitch.

MIDI files do not preserve KeyPiano-specific UI state, instrument sample names, sustain-pedal automation, or metronome settings. Imported MIDI is played with the currently selected KeyPiano instrument. KeyPiano records note events rather than microphone or rendered audio.

## Browser support

| Capability | Chromium browsers | Firefox | Safari |
| --- | --- | --- | --- |
| Computer keyboard and Web Audio | Supported | Supported | Supported |
| Installable PWA | Supported | Varies by platform | Supported on current Apple platforms |
| Web MIDI keyboard input | Supported | Not generally available | Not generally available |

Chrome or Edge is recommended when using a physical MIDI keyboard. Audio sample files are fetched from the upstream sample hosts on first use. The service worker caches successfully downloaded samples for later sessions, but a sound that has never been loaded still requires a network connection.

## Privacy

KeyPiano runs in the browser and does not upload performances. The site does not include third-party analytics. Selecting the coffee link or a related project opens that external site in a new tab.

## Production build

```bash
npm run build
npm run preview
```

The deploy script publishes `dist/` through `gh-pages`:

```bash
npm run deploy
```

The production build includes the web app manifest, service worker, scalable app icons, sitemap, robots file, and social preview image.
