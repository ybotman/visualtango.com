'use client';

import { useState } from 'react';

export default function HelpPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold mb-2">Help & Documentation</h1>
        <p className="text-zinc-400">
          How to add songs, create sync points, and use the visualization
        </p>
      </div>

      {/* Adding Songs */}
      <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 text-blue-400">
          Adding Songs (MIDI + Audio)
        </h2>

        <div className="space-y-4 text-zinc-300">
          <div>
            <h3 className="font-medium text-white mb-2">File Structure</h3>
            <pre className="bg-zinc-950 rounded-lg p-4 text-sm overflow-x-auto">
{`public/
└── songs/
    └── my_song/              ← Folder name = Song ID
        ├── my_song.mid       ← MIDI file (same name as folder)
        ├── my_song.mp3       ← Audio file (same name as folder)
        └── config.json       ← Created automatically when you Save`}
            </pre>
          </div>

          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-4">
            <h4 className="font-medium text-amber-400 mb-2">Important Notes</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Folder name becomes the <strong>Song ID</strong> (use underscores, no spaces)</li>
              <li>MIDI and MP3 files should match the folder name (e.g., <code>volver/volver.mid</code>)</li>
              <li>Supported audio: <code>.mp3</code>, <code>.wav</code>, <code>.ogg</code></li>
              <li>Supported MIDI: <code>.mid</code>, <code>.midi</code></li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Step-by-Step</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Create a folder in <code className="bg-zinc-800 px-1 rounded">public/songs/</code> with your song ID</li>
              <li>Copy your MIDI file into the folder, rename to match folder name</li>
              <li>Copy your MP3 file into the folder, rename to match folder name</li>
              <li>Refresh the Catalog page - your song should appear</li>
              <li>Click <strong>Edit</strong> to create sync points</li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Terminal Commands</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="bg-zinc-950 rounded px-3 py-2 text-sm flex-1 overflow-x-auto">
                  mkdir -p public/songs/my_song
                </code>
                <button
                  onClick={() => copyToClipboard('mkdir -p public/songs/my_song', 'mkdir')}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  {copiedCommand === 'mkdir' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-zinc-950 rounded px-3 py-2 text-sm flex-1 overflow-x-auto">
                  cp ~/Downloads/song.mid public/songs/my_song/my_song.mid
                </code>
                <button
                  onClick={() => copyToClipboard('cp ~/Downloads/song.mid public/songs/my_song/my_song.mid', 'cp1')}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  {copiedCommand === 'cp1' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="bg-zinc-950 rounded px-3 py-2 text-sm flex-1 overflow-x-auto">
                  cp ~/Downloads/song.mp3 public/songs/my_song/my_song.mp3
                </code>
                <button
                  onClick={() => copyToClipboard('cp ~/Downloads/song.mp3 public/songs/my_song/my_song.mp3', 'cp2')}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  {copiedCommand === 'cp2' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editor Guide */}
      <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 text-green-400">
          Using the Editor
        </h2>

        <div className="space-y-4 text-zinc-300">
          <div>
            <h3 className="font-medium text-white mb-2">Creating Sync Points</h3>
            <p className="text-sm mb-3">
              Sync points map MIDI time to audio time, allowing the visualization to stay
              in sync with the recording despite tempo variations.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Switch to <strong>Sync Points</strong> mode (green button)</li>
              <li>Click on the <strong>audio waveform</strong> to mark an audio time</li>
              <li>Click on the <strong>MIDI piano roll</strong> to mark the matching MIDI time</li>
              <li>Click <strong>Link Points</strong> to create the sync point</li>
              <li>Add more sync points at key moments (start, tempo changes, phrases)</li>
              <li>Click <strong>Save</strong> to save your work</li>
            </ol>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Navigation Controls</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-zinc-950 rounded-lg p-3">
                <div className="font-medium text-blue-400 mb-1">Audio Waveform</div>
                <ul className="space-y-1">
                  <li><code>Click</code> - Select audio time</li>
                  <li><code>Alt + Drag</code> - Scroll through audio</li>
                  <li><code>Zoom slider</code> - Zoom in/out</li>
                  <li><code>Position bar</code> - Click to seek</li>
                </ul>
              </div>
              <div className="bg-zinc-950 rounded-lg p-3">
                <div className="font-medium text-green-400 mb-1">MIDI Piano Roll</div>
                <ul className="space-y-1">
                  <li><code>Click</code> - Select MIDI time</li>
                  <li><code>Alt + Drag</code> - Scroll through MIDI</li>
                  <li><code>Scroll wheel</code> - Scroll horizontally</li>
                  <li><code>Ctrl + Scroll</code> - Zoom in/out</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Sync Zoom</h3>
            <p className="text-sm">
              Enable <strong>"Sync zoom with MIDI/Audio"</strong> to keep both views at
              the same pixels-per-second, making it easier to align sync points.
            </p>
          </div>
        </div>
      </section>

      {/* Play Modes */}
      <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 text-purple-400">
          Play Modes
        </h2>

        <div className="space-y-4 text-zinc-300">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 rounded-lg p-4">
              <h3 className="font-medium text-green-400 mb-2">Standard Play</h3>
              <p className="text-sm mb-2">
                Horizontal piano roll with notes scrolling left-to-right.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Audio or MIDI playback modes</li>
                <li>• Track solo/mute controls</li>
                <li>• Adjustable zoom and note size</li>
              </ul>
            </div>
            <div className="bg-zinc-950 rounded-lg p-4">
              <h3 className="font-medium text-purple-400 mb-2">Cinema Mode</h3>
              <p className="text-sm mb-2">
                Full-screen vertical visualization like movie credits.
              </p>
              <ul className="text-sm space-y-1">
                <li>• Notes scroll top-to-bottom</li>
                <li>• Instruments in vertical columns</li>
                <li>• Track solo/mute panel</li>
                <li>• Fullscreen support</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-white mb-2">Cinema Mode Keyboard Shortcuts</h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="bg-zinc-800 px-2 py-1 rounded"><code>Space</code> Play/Pause</span>
              <span className="bg-zinc-800 px-2 py-1 rounded"><code>←/→</code> Seek 5s</span>
              <span className="bg-zinc-800 px-2 py-1 rounded"><code>H</code> Hide controls</span>
              <span className="bg-zinc-800 px-2 py-1 rounded"><code>Esc</code> Exit</span>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
        <h2 className="text-xl font-semibold mb-4 text-red-400">
          Troubleshooting
        </h2>

        <div className="space-y-4 text-zinc-300 text-sm">
          <div>
            <h3 className="font-medium text-white">Song doesn't appear in Catalog</h3>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Make sure the folder is directly inside <code>public/songs/</code></li>
              <li>Check that you have both a MIDI and an audio file</li>
              <li>Refresh the page (the API reads the filesystem)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white">Audio/MIDI doesn't load</h3>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Files should be named <code>songId.mid</code> and <code>songId.mp3</code></li>
              <li>Or create a <code>config.json</code> with custom filenames</li>
              <li>Check browser console for errors (F12)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-white">Sync points not saving</h3>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Make sure you click <strong>Save</strong> after creating sync points</li>
              <li>Check browser console for save errors</li>
              <li>The server needs write permission to <code>public/songs/</code></li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
