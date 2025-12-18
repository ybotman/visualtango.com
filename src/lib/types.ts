// Core music data types

export interface Note {
  name: string;        // "C4", "D#5", etc.
  midi: number;        // MIDI note number (0-127)
  time: number;        // Start time in seconds (MIDI timeline)
  duration: number;    // Duration in seconds
  velocity: number;    // Velocity (0-1)
  track: number;       // Track index
  color?: string;      // Assigned color from track
}

export interface Track {
  name: string;
  noteCount: number;
  color: string;
  instrument: string;
  visible: boolean;
  muted: boolean;
  solo: boolean;
}

export interface SyncPoint {
  id: string;
  midiTime: number;    // Position in MIDI timeline (seconds)
  audioTime: number;   // Position in audio timeline (seconds)
  label: string;
}

// Adornment types - visual enhancements for notes/sections
export type AdornmentType =
  | 'wavy'      // Melodic runs - flowing wave effect
  | 'spark'     // Syncopation - sparkle/burst effect
  | 'punch'     // Strong accents - bold impact
  | 'glow'      // Sustained notes - halo effect
  | 'phrase'    // Section markers - bracket overlay
  | 'accent'    // Single note emphasis - highlight
  | 'tremolo'   // Rapid repetition - vibration
  | 'legato';   // Smooth connection - curved lines

export interface Adornment {
  id: string;
  type: AdornmentType;
  scope: 'track' | 'section';  // Instrument-level or time-range
  startTime: number;           // Start time in MIDI timeline
  endTime: number;             // End time in MIDI timeline
  trackIndex?: number;         // Required for 'track' scope
  label?: string;
}

export interface SongConfig {
  id: string;                  // Unique identifier (folder name)
  title: string;               // Display name
  midiFile: string;            // Filename (e.g., "bach_846.mid")
  audioFile: string;           // Filename (e.g., "bach_846.mp3")
  syncPoints: SyncPoint[];
  tracks: Track[];
  adornments: Adornment[];
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
}

// For catalog display
export interface SongStatus {
  id: string;
  title: string;
  hasMidi: boolean;
  hasAudio: boolean;
  hasConfig: boolean;
  syncPointCount: number;
  adornmentCount: number;
}

// Track colors for consistent visualization
export const TRACK_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];

// Adornment type labels for UI
export const ADORNMENT_LABELS: Record<AdornmentType, string> = {
  wavy: 'Wavy',
  spark: 'Spark',
  punch: 'Punch',
  glow: 'Glow',
  phrase: 'Phrase',
  accent: 'Accent',
  tremolo: 'Tremolo',
  legato: 'Legato',
};

// Helper to get color for track index
export function getTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

// Helper to create empty config
export function createEmptyConfig(id: string): SongConfig {
  return {
    id,
    title: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    midiFile: `${id}.mid`,
    audioFile: `${id}.mp3`,
    syncPoints: [],
    tracks: [],
    adornments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
