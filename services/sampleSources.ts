// Where instrument samples are downloaded from. The upstream GitHub hosts are
// often slow or unreachable from mainland China, so the same files are also
// offered through jsDelivr's GitHub mirror and players can pick what works.

export type SampleLibrary = 'salamander' | 'hq_piano' | 'gm';

// Mirrors are pinned to a commit so every URL is immutable: jsDelivr then
// serves it from its long-lived cache, and a moved branch can never swap the
// audio underneath a cached copy.
const REPOS: Record<SampleLibrary, string> = {
    salamander: 'Tonejs/audio@efd8296360f9526e379bfbe5c1698ff54d6a1d34/salamander/',
    hq_piano: 'fuhton/piano-mp3@1238aa3635393ff143f9cc14643fd2d2ad66b8c4/piano-mp3/',
    gm: 'gleitz/midi-js-soundfonts@044fab8e1456bfafc5776e86dfd6bb8697149aef/MusyngKite/',
};

const jsDelivrBases = (host: string): Record<SampleLibrary, string> => ({
    salamander: `https://${host}/gh/${REPOS.salamander}`,
    hq_piano: `https://${host}/gh/${REPOS.hq_piano}`,
    gm: `https://${host}/gh/${REPOS.gm}`,
});

// Display labels live in i18n.ts (`t.sampleSource.options`), keyed by these ids.
// The ids are also sent to analytics, so keep them stable once released.
export const SAMPLE_SOURCES = [
    {
        id: 'github',
        bases: {
            salamander: 'https://tonejs.github.io/audio/salamander/',
            hq_piano: 'https://raw.githubusercontent.com/fuhton/piano-mp3/master/piano-mp3/',
            gm: 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/',
        },
    },
    { id: 'jsdelivr_fastly', bases: jsDelivrBases('fastly.jsdelivr.net') },
    { id: 'jsdelivr_gcore', bases: jsDelivrBases('gcore.jsdelivr.net') },
] as const satisfies readonly { id: string; bases: Record<SampleLibrary, string> }[];

export type SampleSourceID = typeof SAMPLE_SOURCES[number]['id'];

export const DEFAULT_SAMPLE_SOURCE: SampleSourceID = 'github';

export const isSampleSourceID = (value: unknown): value is SampleSourceID => (
    typeof value === 'string' && SAMPLE_SOURCES.some(source => source.id === value)
);

export const getSampleBaseUrl = (sourceId: SampleSourceID, library: SampleLibrary): string => {
    const source = SAMPLE_SOURCES.find(entry => entry.id === sourceId) ?? SAMPLE_SOURCES[0];
    return source.bases[library];
};
