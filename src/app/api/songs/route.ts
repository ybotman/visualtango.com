import { NextResponse } from 'next/server';
import { readdir, stat, readFile } from 'fs/promises';
import path from 'path';
import { SongStatus, SongConfig } from '@/lib/types';

const SONGS_DIR = path.join(process.cwd(), 'public', 'songs');

export async function GET() {
  try {
    // Read the songs directory
    let directories: string[];
    try {
      directories = await readdir(SONGS_DIR);
    } catch {
      // Directory doesn't exist yet
      return NextResponse.json([]);
    }

    const songs: SongStatus[] = [];

    for (const dir of directories) {
      const songPath = path.join(SONGS_DIR, dir);
      const songStat = await stat(songPath);

      if (!songStat.isDirectory()) continue;

      // Check for files
      const files = await readdir(songPath);
      const hasMidi = files.some(
        (f) => f.endsWith('.mid') || f.endsWith('.midi')
      );
      const hasAudio = files.some(
        (f) => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg')
      );
      const hasConfig = files.includes('config.json');

      let syncPointCount = 0;
      let adornmentCount = 0;
      let title = dir.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      // Read config if exists
      if (hasConfig) {
        try {
          const configPath = path.join(songPath, 'config.json');
          const configContent = await readFile(configPath, 'utf-8');
          const config: SongConfig = JSON.parse(configContent);
          syncPointCount = config.syncPoints?.length || 0;
          adornmentCount = config.adornments?.length || 0;
          if (config.title) {
            title = config.title;
          }
        } catch {
          // Ignore config read errors
        }
      }

      songs.push({
        id: dir,
        title,
        hasMidi,
        hasAudio,
        hasConfig,
        syncPointCount,
        adornmentCount,
      });
    }

    // Sort by title
    songs.sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json(songs);
  } catch (error) {
    console.error('Error reading songs:', error);
    return NextResponse.json(
      { error: 'Failed to read songs directory' },
      { status: 500 }
    );
  }
}
