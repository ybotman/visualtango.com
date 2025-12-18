import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { SongConfig, createEmptyConfig } from '@/lib/types';

const SONGS_DIR = path.join(process.cwd(), 'public', 'songs');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const configPath = path.join(SONGS_DIR, songId, 'config.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    const config: SongConfig = JSON.parse(content);
    return NextResponse.json(config);
  } catch {
    // Return empty config if file doesn't exist
    return NextResponse.json(createEmptyConfig(songId));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params;
  const songDir = path.join(SONGS_DIR, songId);
  const configPath = path.join(songDir, 'config.json');

  try {
    const config: SongConfig = await request.json();

    // Ensure directory exists
    await mkdir(songDir, { recursive: true });

    // Write config file
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
