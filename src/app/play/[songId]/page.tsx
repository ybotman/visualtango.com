'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Howl } from 'howler';
import * as Tone from 'tone';
import { loadMidi } from '@/lib/midi';
import { Note, Track, SyncPoint, SongConfig } from '@/lib/types';
import { audioToMidiTime, formatTimeShort } from '@/lib/sync';
import { fetchSongConfig } from '@/lib/storage';

export default function PlayPage() {
  const params = useParams();
  const songId = params.songId as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundRef = useRef<Howl | null>(null);
  const synthsRef = useRef<Tone.PolySynth[]>([]);
  const scheduledEventsRef = useRef<number[]>([]);
  const animationRef = useRef<number | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [config, setConfig] = useState<SongConfig | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [midiDuration, setMidiDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([]);
  const [playbackMode, setPlaybackMode] = useState<'audio' | 'midi'>('audio');
  const [toneStarted, setToneStarted] = useState(false);

  const [pixelsPerSecond, setPixelsPerSecond] = useState(100);
  const [noteHeight, setNoteHeight] = useState(4);

  // Start Tone.js
  const startTone = useCallback(async () => {
    if (!toneStarted) {
      await Tone.start();
      setToneStarted(true);
    }
  }, [toneStarted]);

  // Load files on mount
  useEffect(() => {
    async function loadFiles() {
      setLoading(true);
      setError(null);

      try {
        // Load config
        const loadedConfig = await fetchSongConfig(songId);
        setConfig(loadedConfig);
        setSyncPoints(loadedConfig.syncPoints || []);

        // Restore track settings from config
        const savedTracks = loadedConfig.tracks || [];

        // Load MIDI
        const midiUrl = `/songs/${songId}/${loadedConfig.midiFile || `${songId}.mid`}`;
        const midiData = await loadMidi(midiUrl);
        setNotes(midiData.notes);
        setMidiDuration(midiData.duration);

        // Merge saved track settings with loaded tracks
        const mergedTracks = midiData.tracks.map((t, i) => {
          const saved = savedTracks[i];
          return {
            ...t,
            visible: saved?.visible ?? true,
            muted: saved?.muted ?? false,
            solo: saved?.solo ?? false,
          };
        });
        setTracks(mergedTracks);

        // Create synths
        synthsRef.current.forEach((s) => s.dispose());
        synthsRef.current = midiData.tracks.map(
          () =>
            new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'triangle' },
              envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 },
            }).toDestination()
        );

        // Load Audio
        const audioUrl = `/songs/${songId}/${loadedConfig.audioFile || `${songId}.mp3`}`;
        const sound = new Howl({
          src: [audioUrl],
          html5: true,
          onload: () => {
            setDuration(sound.duration());
            setLoading(false);
          },
          onloaderror: () => {
            setError('Failed to load audio');
            setLoading(false);
          },
          onplay: () => setIsPlaying(true),
          onpause: () => setIsPlaying(false),
          onstop: () => {
            setIsPlaying(false);
            setCurrentTime(0);
          },
          onend: () => setIsPlaying(false),
        });
        soundRef.current = sound;
      } catch (err) {
        setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    }

    loadFiles();

    return () => {
      if (soundRef.current) soundRef.current.unload();
      synthsRef.current.forEach((s) => s.dispose());
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, [songId]);

  // Track controls
  const toggleTrack = useCallback((index: number) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, visible: !t.visible } : t))
    );
  }, []);

  const toggleMute = useCallback((index: number) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, muted: !t.muted } : t))
    );
  }, []);

  const toggleSolo = useCallback((index: number) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, solo: !t.solo } : t))
    );
  }, []);

  const shouldTrackPlay = useCallback(
    (trackIndex: number) => {
      const track = tracks[trackIndex];
      if (!track) return false;
      if (track.muted) return false;
      const anySolo = tracks.some((t) => t.solo);
      if (anySolo && !track.solo) return false;
      return true;
    },
    [tracks]
  );

  // Schedule MIDI notes
  const scheduleMidiNotes = useCallback(() => {
    scheduledEventsRef.current.forEach((id) => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];

    notes.forEach((note) => {
      if (!shouldTrackPlay(note.track)) return;

      const synth = synthsRef.current[note.track];
      if (!synth) return;

      const eventId = Tone.Transport.schedule((time) => {
        synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
      }, note.time);

      scheduledEventsRef.current.push(eventId);
    });
  }, [notes, shouldTrackPlay]);

  // Playback controls
  const togglePlay = useCallback(async () => {
    if (playbackMode === 'audio') {
      if (!soundRef.current) return;
      if (isPlaying) {
        soundRef.current.pause();
      } else {
        soundRef.current.play();
      }
    } else {
      await startTone();
      if (isPlaying) {
        Tone.Transport.pause();
        setIsPlaying(false);
      } else {
        scheduleMidiNotes();
        Tone.Transport.start();
        setIsPlaying(true);
      }
    }
  }, [isPlaying, playbackMode, startTone, scheduleMidiNotes]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      setCurrentTime(time);

      if (playbackMode === 'audio') {
        if (soundRef.current) soundRef.current.seek(time);
      } else {
        Tone.Transport.seconds = time;
      }
    },
    [playbackMode]
  );

  const stop = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);

    if (playbackMode === 'audio') {
      if (soundRef.current) soundRef.current.stop();
    } else {
      Tone.Transport.stop();
      Tone.Transport.seconds = 0;
    }
  }, [playbackMode]);

  const switchMode = useCallback(
    (mode: 'audio' | 'midi') => {
      stop();
      setPlaybackMode(mode);
    },
    [stop]
  );

  // Re-schedule when tracks change
  useEffect(() => {
    if (playbackMode === 'midi' && isPlaying) {
      scheduleMidiNotes();
    }
  }, [tracks, playbackMode, isPlaying, scheduleMidiNotes]);

  // Animation loop
  useEffect(() => {
    const updateTime = () => {
      if (playbackMode === 'audio') {
        if (soundRef.current && isPlaying) {
          setCurrentTime(soundRef.current.seek() as number);
        }
      } else {
        if (isPlaying) {
          setCurrentTime(Tone.Transport.seconds);
        }
      }
      animationRef.current = requestAnimationFrame(updateTime);
    };

    if (isPlaying) updateTime();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackMode]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 400;
    }

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (notes.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
      return;
    }

    const playheadX = 150;

    const displayTime =
      playbackMode === 'audio' && syncPoints.length > 0
        ? audioToMidiTime(currentTime, syncPoints)
        : currentTime;

    const visibleStart = displayTime - playheadX / pixelsPerSecond;
    const visibleEnd = displayTime + (canvas.width - playheadX) / pixelsPerSecond;

    const visibleNotes = notes.filter((n) => tracks[n.track]?.visible);
    if (visibleNotes.length === 0) return;

    const minPitch = Math.min(...visibleNotes.map((n) => n.midi)) - 2;
    const maxPitch = Math.max(...visibleNotes.map((n) => n.midi)) + 2;
    const pitchRange = maxPitch - minPitch;

    // Beat grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const beatInterval = 0.5;
    const startBeat = Math.floor(visibleStart / beatInterval) * beatInterval;
    for (let beat = startBeat; beat < visibleEnd; beat += beatInterval) {
      const x = playheadX + (beat - displayTime) * pixelsPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Sync markers
    if (syncPoints.length > 0) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      syncPoints.forEach((sp) => {
        const x = playheadX + (sp.midiTime - displayTime) * pixelsPerSecond;
        if (x > 0 && x < canvas.width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();

          ctx.fillStyle = '#10B981';
          ctx.font = '10px sans-serif';
          ctx.fillText(sp.label, x + 3, 12);
        }
      });
    }

    // Notes
    visibleNotes.forEach((note) => {
      const noteStart = note.time;
      const noteEnd = note.time + note.duration;

      if (noteEnd < visibleStart || noteStart > visibleEnd) return;

      const x = playheadX + (noteStart - displayTime) * pixelsPerSecond;
      const width = Math.max(note.duration * pixelsPerSecond, 2);
      const y =
        canvas.height -
        ((note.midi - minPitch) / pitchRange) * (canvas.height - 40) -
        20;

      const isMuted = tracks[note.track]?.muted;
      const anySolo = tracks.some((t) => t.solo);
      const isSoloed = tracks[note.track]?.solo;
      const dimmed = isMuted || (anySolo && !isSoloed);

      const isActive = displayTime >= noteStart && displayTime < noteEnd;

      ctx.globalAlpha = dimmed
        ? 0.2
        : isActive
        ? 1
        : note.velocity * 0.7 + 0.3;
      ctx.fillStyle = note.color || tracks[note.track]?.color || '#666';
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight / 2, width, noteHeight, 2);
      ctx.fill();

      if (isActive && !dimmed) {
        ctx.shadowColor = note.color || '#fff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    ctx.globalAlpha = 1;

    // Playhead
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();

    // Time display
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatTimeShort(currentTime), 10, 20);

    // Mode indicator
    ctx.fillStyle = playbackMode === 'midi' ? '#10B981' : '#3B82F6';
    ctx.fillText(playbackMode === 'midi' ? 'MIDI' : 'AUDIO', 10, 40);

    if (syncPoints.length > 0 && playbackMode === 'audio') {
      ctx.fillStyle = '#10B981';
      ctx.fillText(`SYNCED (${syncPoints.length} pts)`, 10, 55);
    }
  }, [
    notes,
    tracks,
    currentTime,
    pixelsPerSecond,
    noteHeight,
    playbackMode,
    syncPoints,
  ]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveDuration = playbackMode === 'audio' ? duration : midiDuration;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading {songId}...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              ← Catalog
            </Link>
            <h1 className="text-2xl font-bold">
              {config?.title || songId}
            </h1>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            {syncPoints.length > 0
              ? `${syncPoints.length} sync points loaded`
              : 'No sync points - go to Editor to create them'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/play/${songId}/cinema`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium"
          >
            Cinema Mode
          </Link>
          <Link
            href={`/editor/${songId}`}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm"
          >
            Edit →
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Playback Mode */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <h3 className="text-sm text-zinc-400 mb-3">Playback Mode</h3>
        <div className="flex gap-2">
          <button
            onClick={() => switchMode('audio')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              playbackMode === 'audio'
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            Audio (MP3)
          </button>
          <button
            onClick={() => switchMode('midi')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              playbackMode === 'midi'
                ? 'bg-green-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            MIDI (Synth)
          </button>
        </div>
        {playbackMode === 'midi' && (
          <p className="text-xs text-green-400 mt-2">
            Use Solo/Mute below to isolate tracks
          </p>
        )}
        {playbackMode === 'audio' && syncPoints.length > 0 && (
          <p className="text-xs text-green-400 mt-2">
            Visualization synced to audio ({syncPoints.length} sync points)
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              playbackMode === 'midi'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <button
            onClick={stop}
            className="w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>

          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={effectiveDuration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-zinc-500 mt-1">
              <span>{formatTimeShort(currentTime)}</span>
              <span>{formatTimeShort(effectiveDuration)}</span>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="flex flex-wrap gap-6">
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Zoom: {pixelsPerSecond}px/sec
            </label>
            <input
              type="range"
              min="50"
              max="300"
              value={pixelsPerSecond}
              onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-1">
              Note Height: {noteHeight}px
            </label>
            <input
              type="range"
              min="2"
              max="12"
              value={noteHeight}
              onChange={(e) => setNoteHeight(Number(e.target.value))}
              className="w-32"
            />
          </div>
        </div>
      </div>

      {/* Track Controls */}
      {tracks.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h3 className="text-sm text-zinc-400 mb-2">
            Tracks {playbackMode === 'midi' && '(S = Solo, M = Mute)'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {tracks.map((track, i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded overflow-hidden"
                style={{
                  backgroundColor: track.visible ? track.color + '33' : '#333',
                  borderColor: track.color,
                  borderWidth: 2,
                  borderStyle: 'solid',
                }}
              >
                {playbackMode === 'midi' && (
                  <button
                    onClick={() => toggleSolo(i)}
                    className={`px-2 py-1 text-xs font-bold ${
                      track.solo
                        ? 'bg-yellow-500 text-black'
                        : 'bg-zinc-800 text-zinc-500 hover:text-yellow-400'
                    }`}
                  >
                    S
                  </button>
                )}
                {playbackMode === 'midi' && (
                  <button
                    onClick={() => toggleMute(i)}
                    className={`px-2 py-1 text-xs font-bold ${
                      track.muted
                        ? 'bg-red-500 text-white'
                        : 'bg-zinc-800 text-zinc-500 hover:text-red-400'
                    }`}
                  >
                    M
                  </button>
                )}
                <button
                  onClick={() => toggleTrack(i)}
                  className={`px-3 py-1 text-sm ${
                    track.visible ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  {track.name} ({track.noteCount})
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <canvas ref={canvasRef} className="w-full" style={{ height: 400 }} />
      </div>
    </div>
  );
}
