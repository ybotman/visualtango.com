import { SongConfig, SongStatus, createEmptyConfig } from './types';

const SONGS_BASE_PATH = '/songs';

/**
 * Fetch list of all songs with their status
 */
export async function fetchSongList(): Promise<SongStatus[]> {
  const response = await fetch('/api/songs');
  if (!response.ok) {
    throw new Error('Failed to fetch song list');
  }
  return response.json();
}

/**
 * Fetch config for a specific song
 */
export async function fetchSongConfig(songId: string): Promise<SongConfig> {
  const response = await fetch(`/api/songs/${songId}/config`);
  if (!response.ok) {
    // Return empty config if not found
    return createEmptyConfig(songId);
  }
  return response.json();
}

/**
 * Save config for a specific song
 */
export async function saveSongConfig(songId: string, config: SongConfig): Promise<void> {
  const response = await fetch(`/api/songs/${songId}/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...config,
      updatedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save config');
  }
}

/**
 * Get URL for a song's MIDI file
 */
export function getMidiUrl(songId: string, filename: string): string {
  return `${SONGS_BASE_PATH}/${songId}/${filename}`;
}

/**
 * Get URL for a song's audio file
 */
export function getAudioUrl(songId: string, filename: string): string {
  return `${SONGS_BASE_PATH}/${songId}/${filename}`;
}

/**
 * Export config as JSON file download
 */
export function exportConfigAsJson(config: SongConfig): void {
  const data = JSON.stringify(config, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.id}-config.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import config from JSON file
 */
export async function importConfigFromFile(file: File): Promise<SongConfig> {
  const text = await file.text();
  const config = JSON.parse(text) as SongConfig;
  return config;
}

/**
 * Local storage helpers for caching (optional, for offline support)
 */
const LOCAL_STORAGE_PREFIX = 'visualtango-config-';

export function cacheConfig(songId: string, config: SongConfig): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${songId}`, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to cache config to localStorage:', e);
  }
}

export function getCachedConfig(songId: string): SongConfig | null {
  try {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${songId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Failed to read cached config:', e);
  }
  return null;
}

export function clearCachedConfig(songId: string): void {
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${songId}`);
  } catch (e) {
    console.warn('Failed to clear cached config:', e);
  }
}
