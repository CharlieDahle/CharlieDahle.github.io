export const ROOT_TO_SEMITONE = {
  'C': 0, 'C#': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
};

export const QUALITY_INTERVALS = {
  'maj':  [0, 4, 7],
  'min':  [0, 3, 7],
  '7':    [0, 4, 7, 10],
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  'dim':  [0, 3, 6],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function chordToNotes(chord) {
  const root = ROOT_TO_SEMITONE[chord.root] ?? 0;
  const intervals = QUALITY_INTERVALS[chord.quality] ?? [0, 4, 7];
  return intervals.map((interval) => {
    const semitone = root + interval;
    const octave = 3 + Math.floor(semitone / 12);
    return `${NOTE_NAMES[semitone % 12]}${octave}`;
  });
}
