'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SongStatus } from '@/lib/types';

export default function CatalogPage() {
  const [songs, setSongs] = useState<SongStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSongs() {
      try {
        const response = await fetch('/api/songs');
        if (!response.ok) {
          throw new Error('Failed to load songs');
        }
        const data = await response.json();
        setSongs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadSongs();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Song Catalog</h1>
        <p className="text-zinc-400">
          Select a song to edit sync points or play with visualization
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-zinc-400">Loading songs...</div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && songs.length === 0 && (
        <div className="bg-zinc-900 rounded-lg p-8 text-center border border-zinc-800">
          <p className="text-zinc-400 mb-4">No songs found</p>
          <p className="text-sm text-zinc-500">
            Add songs to <code>public/songs/</code> folder with .mid and .mp3
            files
          </p>
        </div>
      )}

      {!loading && !error && songs.length > 0 && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-left text-zinc-500 text-sm border-b border-zinc-800">
                <th className="py-3 px-4">Song</th>
                <th className="py-3 px-4 text-center">MIDI</th>
                <th className="py-3 px-4 text-center">Audio</th>
                <th className="py-3 px-4 text-center">Config</th>
                <th className="py-3 px-4 text-center">Sync Points</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr
                  key={song.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium">{song.title}</div>
                    <div className="text-sm text-zinc-500">{song.id}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {song.hasMidi ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {song.hasAudio ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {song.hasConfig ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {song.syncPointCount > 0 ? (
                      <span className="text-blue-400">
                        {song.syncPointCount}
                      </span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/editor/${song.id}`}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          song.hasMidi && song.hasAudio
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                          if (!song.hasMidi || !song.hasAudio) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/play/${song.id}`}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          song.hasMidi && song.hasAudio
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                          if (!song.hasMidi || !song.hasAudio) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Play
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="font-semibold mb-3">Adding New Songs</h2>
        <div className="text-sm text-zinc-400 space-y-2">
          <p>
            1. Create a folder in <code>public/songs/</code> named with the song
            ID (e.g., <code>volver</code>)
          </p>
          <p>
            2. Add the MIDI file as <code>songId.mid</code> (e.g.,{' '}
            <code>volver.mid</code>)
          </p>
          <p>
            3. Add the audio file as <code>songId.mp3</code> (e.g.,{' '}
            <code>volver.mp3</code>)
          </p>
          <p>4. Refresh this page to see the new song in the catalog</p>
        </div>
      </div>
    </div>
  );
}
