# Changelog

All notable changes to KeyPiano are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries before 1.1.0 are summarised from the commit history.

## [Unreleased]

## [1.4.1] - 2026-09-28

### Changed

- Louder, even playback. The sample sets were recorded at very different
  levels: measured over C2–C6, Salamander sits near -21 dBFS RMS and the
  other instruments near -30 to -38 dBFS, so most instruments were about
  12 dB quieter. Each instrument now has a measured level trim, the output
  gets +6 dB ahead of a limiter and a transparent soft clipper, and
  velocity maps linearly to gain (100 at unity; 64 was -5.8 dB, now -3.9).
  A single note is about 8 dB louder on Salamander and 20 dB on the other
  instruments, and 12 loud notes at full volume no longer clip.
- The volume control goes up to 150%.

## [1.4.0] - 2026-09-27

### Added

- Three themes: **Night** (graphite with amber and teal, now the default for
  new visitors), **Day** (cool white with blue and orange) and **Studio**
  (ebony and ivory with brass and felt red).
- Unit tests for every theme's text contrast and key-state visibility.
- **Settings → My keyboard has a numpad** (off by default): lets practice
  hints for imported MIDI use the numpad and arrow keys.
- In practice mode, when notes of a piece fall outside the keys' range, a
  prompt suggests the octave that fits more of them and switches to it.

### Changed

- Themes are palettes applied as CSS variables, and every component reads
  them. The six original themes are remade on the same rules: flat keys,
  single-colour toolbar icons that only take the accent when switched on,
  and one colour for "pressed" and one for "practice guide" on the computer
  keyboard, piano, waterfall and stave. The stave, waterfall, settings and
  history panels, native selects and scrollbars now follow the theme too.
- Practice hints for imported MIDI follow keyboard-piano technique. The old
  fingering put almost every note on the numpad and the bass on the arrow
  keys, so on a laptop nothing useful lit up. Now the left hand uses the two
  lower letter rows and the right hand the Q and number rows (split by MIDI
  track when a file has one per hand), black keys are Shift on the key
  below (or Ctrl above for flats), a chord shares one modifier where it can,
  and each hand stays near its last key instead of jumping rows. Keys are
  chosen once per piece, so a hinted note no longer switches key as it
  approaches, and they follow the current octave and transpose setting.

### Fixed

- The instrument select was white text on white in the Minimalist and
  Pastel themes; the Pastel piano's black keys matched its playback colour;
  the support link was unreadable in Fauvism; Cyber's white and black piano
  keys were hard to tell apart; pressed keys barely changed in Light and on
  the Dark computer keyboard.

## [1.3.1] - 2026-09-27

### Changed

- Practice mode's key guide is one colour that fills in as a note
  approaches, instead of a yellow outline for the next 1.5 seconds plus a
  separate "now" colour. In wait mode only the notes still to press are
  fully lit, so the count in the prompt matches the lit keys; notes held
  over from earlier chords are no longer highlighted.

### Fixed

- After clicking any toolbar control (Import MIDI, view buttons, the speed
  or instrument select, the volume slider, Recent recordings), the computer
  keyboard played nothing until the page was clicked. A control focused by a
  click now hands focus back to the page on the next note key; text fields
  and controls reached with the keyboard keep their own keys.

## [1.3.0] - 2026-09-27

### Added

- **Settings → Sample server**: download samples from the upstream GitHub
  hosts (default) or from a jsDelivr mirror (Fastly or Gcore) pinned to a
  fixed commit, for players who cannot reach GitHub, such as those in
  mainland China. The choice is remembered, and the service worker caches
  samples from every server.
- Google Analytics events `sample_source_change` and `sample_load` (server,
  instrument, result, load time, failed-sample count) to compare servers.
- Recordings and imported MIDI files are saved automatically in IndexedDB,
  snapshotted every 5 seconds while recording, and the latest is restored on
  load. A **Recent recordings** panel keeps the 20 newest, to reopen or
  delete. A new recording no longer discards the previous one; KeyPiano only
  asks first when the browser refused to store it.
- Practice **wait mode** (on by default): playback halts at each note or
  chord until the player presses all its pitches on any input, with a Skip
  button for unreachable notes.

### Changed

- The sound-loading error now suggests switching the sample server.

### Fixed

- Holding Tab (mapped to a note) no longer moves focus onto the toolbar and
  stops the keyboard from playing: auto-repeat keydowns now have their
  default action blocked too.
- Clicking Record, Play or Reset no longer leaves keyboard focus on that
  button, which made the computer keyboard stop playing until the page was
  clicked.
- In practice mode, a playback note-off no longer cuts off the player's own
  note of the same pitch.

## [1.2.0] - 2026-09-16

### Added

- `public/CNAME` so deploying cannot delete the `keypiano.app` custom domain.
- A keyboard-shortcut section in the About dialog, built from the same
  `keyDescriptions` data as the on-screen key tooltips.
- A shortcut table in the README.
- A GitHub Actions workflow running lint, tests, typecheck and build.
- `npm run verify` to run that same sequence locally.
- `AudioEngine.dispose()`, called on `pagehide`, to release the in-flight
  download, metronome timer, voices, buffers and the `AudioContext`.
- `workers/tickWorker.ts`: the playback clock is now a real module worker
  instead of an inline Blob URL string.
- Optional `channel`, `trackName` and `program` fields on `RecordedEvent`, so
  importing and exporting a MIDI file keeps its track structure.
- `LICENSE` (MIT) and this changelog.

### Changed

- Audio no longer sits behind a start screen: samples load on page open and the
  first click or keypress unlocks Web Audio.
- The social preview image is `public/screenshot.jpg` — it was a JPEG being
  served as `image/png`, and was byte-identical to the root `screenshot.png`.
  Open Graph tags now also declare its type and dimensions.

### Fixed

- A failed sample download could leave the app permanently silent: the engine
  reported itself loaded with nothing to play, and all three retry paths were
  unreachable. It now fails loudly so the user gets an error and can retry.
- The scheduler's animation loop kept re-arming itself after unmount, because
  `workerRef` was never cleared; playback voices were also never stopped.
- The metronome timer kept running when its provider unmounted.
- Analytics was silently dropped from the page (see 1.1.0 below) and is now
  restored.
- Remaining hardcoded UI text moved into `i18n.ts`: the sample-failure toast,
  piano-key accessible names, the toast dismiss label, the error screen, and
  the 18 on-screen key tooltips.

### Removed

- `components/AdBanner.tsx`, which was never imported and held placeholder
  AdSense credentials.
- The root copies of `sitemap.xml` and `robots.txt`. Only `public/` is deployed,
  so the duplicates could silently drift out of sync.
- The mistyped `TranslationKey` type, the unused `METRONOME_SOUNDS[].label`
  field, the `Theme.name` field and the dead `theme.ts` re-exports.

## [1.1.0] - 2026-07-25

### Added

- MIDI import and export, including overlapping notes of the same pitch.
- Practice mode with note guidance, waterfall and stave visualisers.
- Metronome with selectable sounds, and six instrument voices.
- Six themes, English and Chinese localisation, zen mode.
- Installable PWA with offline caching of downloaded samples.

### Changed

- Rewrote the meta tags for search and social sharing.
- Moved the virtual keyboards to a single Tab stop with arrow-key navigation.

### Fixed

- Enter no longer plays a key while a settings control has focus.

## [1.0.1] - 2026-04-25

### Changed

- Replaced the Tailwind CDN with a real build pipeline.
- Removed the React version conflict in `index.html`.
- Enabled TypeScript strict mode.
- Split `App.tsx` into components and reduced audio-scheduler coupling.

### Added

- React error boundary.

## [1.0.0] - 2026-01-11

### Added

- First release: computer-keyboard piano with FreePiano keymaps, 88-key piano,
  Web Audio playback, recording and a sitemap/robots setup.
