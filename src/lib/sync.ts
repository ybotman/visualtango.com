import { SyncPoint } from './types';

/**
 * Convert MIDI time to audio time using sync point interpolation.
 * Used when playing MIDI and need to know where we are in audio.
 */
export function midiToAudioTime(midiTime: number, syncPoints: SyncPoint[]): number {
  if (syncPoints.length === 0) return midiTime;

  const sorted = [...syncPoints].sort((a, b) => a.midiTime - b.midiTime);

  // Before first sync point: use ratio from first point
  if (midiTime <= sorted[0].midiTime) {
    if (sorted[0].midiTime === 0) return sorted[0].audioTime;
    const ratio = sorted[0].audioTime / sorted[0].midiTime;
    return midiTime * (isNaN(ratio) || !isFinite(ratio) ? 1 : ratio);
  }

  // After last sync point: add offset from last point
  if (midiTime >= sorted[sorted.length - 1].midiTime) {
    const last = sorted[sorted.length - 1];
    return last.audioTime + (midiTime - last.midiTime);
  }

  // Linear interpolation between two sync points
  for (let i = 0; i < sorted.length - 1; i++) {
    const before = sorted[i];
    const after = sorted[i + 1];

    if (midiTime >= before.midiTime && midiTime < after.midiTime) {
      const midiRange = after.midiTime - before.midiTime;
      const audioRange = after.audioTime - before.audioTime;
      const progress = (midiTime - before.midiTime) / midiRange;
      return before.audioTime + progress * audioRange;
    }
  }

  return midiTime;
}

/**
 * Convert audio time to MIDI time using sync point interpolation.
 * Used when playing audio and need to know which MIDI notes to show.
 */
export function audioToMidiTime(audioTime: number, syncPoints: SyncPoint[]): number {
  if (syncPoints.length === 0) return audioTime;

  const sorted = [...syncPoints].sort((a, b) => a.audioTime - b.audioTime);

  // Before first sync point: use ratio from first point
  if (audioTime <= sorted[0].audioTime) {
    if (sorted[0].audioTime === 0) return sorted[0].midiTime;
    const ratio = sorted[0].midiTime / sorted[0].audioTime;
    return audioTime * (isNaN(ratio) || !isFinite(ratio) ? 1 : ratio);
  }

  // After last sync point: add offset from last point
  if (audioTime >= sorted[sorted.length - 1].audioTime) {
    const last = sorted[sorted.length - 1];
    return last.midiTime + (audioTime - last.audioTime);
  }

  // Linear interpolation between two sync points
  for (let i = 0; i < sorted.length - 1; i++) {
    const before = sorted[i];
    const after = sorted[i + 1];

    if (audioTime >= before.audioTime && audioTime < after.audioTime) {
      const audioRange = after.audioTime - before.audioTime;
      const midiRange = after.midiTime - before.midiTime;
      const progress = (audioTime - before.audioTime) / audioRange;
      return before.midiTime + progress * midiRange;
    }
  }

  return audioTime;
}

/**
 * Generate a unique ID for sync points
 */
export function generateSyncPointId(): string {
  return `sp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for adornments
 */
export function generateAdornmentId(): string {
  return `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format time as MM:SS.ms
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/**
 * Format time as MM:SS (no milliseconds)
 */
export function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
