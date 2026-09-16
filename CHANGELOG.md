# Changelog

All notable changes to KeyPiano are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries before 1.1.0 are summarised from the commit history.

## [Unreleased]

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
