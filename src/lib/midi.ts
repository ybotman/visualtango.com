import { Midi } from '@tonejs/midi';
import { Note, Track, getTrackColor } from './types';

export interface ParsedMidi {
  notes: Note[];
  tracks: Track[];
  duration: number;
  name: string;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
}

/**
 * Load and parse a MIDI file from URL
 */
export async function loadMidi(url: string): Promise<ParsedMidi> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const notes: Note[] = [];
  const tracks: Track[] = [];

  // Process each track
  midi.tracks.forEach((track, trackIndex) => {
    if (track.notes.length === 0) return;

    const color = getTrackColor(tracks.length);

    // Add track metadata
    tracks.push({
      name: track.name || `Track ${tracks.length + 1}`,
      noteCount: track.notes.length,
      color,
      instrument: track.instrument.name || 'Unknown',
      visible: true,
      muted: false,
      solo: false,
    });

    // Add notes with track reference
    track.notes.forEach((note) => {
      notes.push({
        name: note.name,
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        track: tracks.length - 1, // Use tracks array index
        color,
      });
    });
  });

  // Sort notes by time
  notes.sort((a, b) => a.time - b.time);

  // Get tempo info
  const tempos = midi.header.tempos;
  const bpm = tempos.length > 0 ? Math.round(tempos[0].bpm) : 120;

  // Get time signature
  const timeSigs = midi.header.timeSignatures;
  const timeSignature =
    timeSigs.length > 0
      ? {
          numerator: timeSigs[0].timeSignature[0],
          denominator: timeSigs[0].timeSignature[1],
        }
      : { numerator: 4, denominator: 4 };

  return {
    notes,
    tracks,
    duration: midi.duration,
    name: midi.name || 'Untitled',
    bpm,
    timeSignature,
  };
}

/**
 * Load MIDI from a File object (for uploads)
 */
export async function loadMidiFromFile(file: File): Promise<ParsedMidi> {
  const arrayBuffer = await file.arrayBuffer();
  const midi = new Midi(arrayBuffer);

  const notes: Note[] = [];
  const tracks: Track[] = [];

  midi.tracks.forEach((track, trackIndex) => {
    if (track.notes.length === 0) return;

    const color = getTrackColor(tracks.length);

    tracks.push({
      name: track.name || `Track ${tracks.length + 1}`,
      noteCount: track.notes.length,
      color,
      instrument: track.instrument.name || 'Unknown',
      visible: true,
      muted: false,
      solo: false,
    });

    track.notes.forEach((note) => {
      notes.push({
        name: note.name,
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity,
        track: tracks.length - 1,
        color,
      });
    });
  });

  notes.sort((a, b) => a.time - b.time);

  const tempos = midi.header.tempos;
  const bpm = tempos.length > 0 ? Math.round(tempos[0].bpm) : 120;

  const timeSigs = midi.header.timeSignatures;
  const timeSignature =
    timeSigs.length > 0
      ? {
          numerator: timeSigs[0].timeSignature[0],
          denominator: timeSigs[0].timeSignature[1],
        }
      : { numerator: 4, denominator: 4 };

  return {
    notes,
    tracks,
    duration: midi.duration,
    name: file.name.replace(/\.mid$/i, ''),
    bpm,
    timeSignature,
  };
}

/**
 * Get visible notes based on track visibility settings
 */
export function getVisibleNotes(notes: Note[], tracks: Track[]): Note[] {
  return notes.filter((note) => {
    const track = tracks[note.track];
    return track && track.visible;
  });
}

/**
 * Get playable notes based on mute/solo settings
 */
export function getPlayableNotes(notes: Note[], tracks: Track[]): Note[] {
  const anySolo = tracks.some((t) => t.solo);

  return notes.filter((note) => {
    const track = tracks[note.track];
    if (!track) return false;
    if (track.muted) return false;
    if (anySolo && !track.solo) return false;
    return true;
  });
}

/**
 * Check if a track should play based on mute/solo
 */
export function shouldTrackPlay(trackIndex: number, tracks: Track[]): boolean {
  const track = tracks[trackIndex];
  if (!track) return false;
  if (track.muted) return false;

  const anySolo = tracks.some((t) => t.solo);
  if (anySolo && !track.solo) return false;

  return true;
}
