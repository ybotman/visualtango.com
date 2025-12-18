'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { loadMidi, ParsedMidi } from '@/lib/midi';
import {
  Note,
  Track,
  SyncPoint,
  Adornment,
  AdornmentType,
  SongConfig,
  ADORNMENT_LABELS,
} from '@/lib/types';
import {
  generateSyncPointId,
  generateAdornmentId,
  formatTime,
} from '@/lib/sync';
import { fetchSongConfig, saveSongConfig, exportConfigAsJson } from '@/lib/storage';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const songId = params.songId as string;

  // Refs
  const waveformRef = useRef<HTMLDivElement>(null);
  const pianoRollRef = useRef<HTMLCanvasElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);

  // State - Files
  const [midiLoaded, setMidiLoaded] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State - Data
  const [notes, setNotes] = useState<Note[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [midiDuration, setMidiDuration] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [config, setConfig] = useState<SongConfig | null>(null);

  // State - Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);

  // State - Selection
  const [selectedMidiTime, setSelectedMidiTime] = useState<number | null>(null);
  const [selectedAudioTime, setSelectedAudioTime] = useState<number | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);

  // State - Sync & Adornments
  const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([]);
  const [adornments, setAdornments] = useState<Adornment[]>([]);
  const [adornmentScope, setAdornmentScope] = useState<'section' | 'track'>('section');
  const [selectedTrackForAdornment, setSelectedTrackForAdornment] = useState<number>(0);

  // State - UI
  const [midiZoom, setMidiZoom] = useState(50);
  const [midiScroll, setMidiScroll] = useState(0);

  // Load files on mount
  useEffect(() => {
    async function loadFiles() {
      setLoading(true);
      setError(null);

      try {
        // Load config first
        const loadedConfig = await fetchSongConfig(songId);
        setConfig(loadedConfig);
        setSyncPoints(loadedConfig.syncPoints || []);
        setAdornments(loadedConfig.adornments || []);

        // Load MIDI
        const midiUrl = `/songs/${songId}/${loadedConfig.midiFile || `${songId}.mid`}`;
        const midiData = await loadMidi(midiUrl);
        setNotes(midiData.notes);
        setTracks(
          midiData.tracks.map((t) => ({
            ...t,
            visible: true,
            muted: false,
            solo: false,
          }))
        );
        setMidiDuration(midiData.duration);
        setMidiLoaded(true);

        // Load Audio with WaveSurfer
        if (waveformRef.current) {
          const regions = RegionsPlugin.create();
          regionsRef.current = regions;

          const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: '#4a5568',
            progressColor: '#3B82F6',
            cursorColor: '#ffffff',
            cursorWidth: 2,
            height: 100,
            normalize: true,
            plugins: [regions],
          });

          ws.on('ready', () => {
            setAudioDuration(ws.getDuration());
            setAudioLoaded(true);
            setLoading(false);

            // Add existing sync markers
            loadedConfig.syncPoints?.forEach((sp) => {
              regions.addRegion({
                id: sp.id,
                start: sp.audioTime,
                end: sp.audioTime,
                color: 'rgba(16, 185, 129, 0.8)',
                content: sp.label,
              });
            });
          });

          ws.on('error', () => {
            setError('Failed to load audio file');
            setLoading(false);
          });

          ws.on('timeupdate', (time) => setAudioTime(time));
          ws.on('play', () => setIsPlaying(true));
          ws.on('pause', () => setIsPlaying(false));
          ws.on('click', (relativeX) => {
            const time = relativeX * ws.getDuration();
            setSelectedAudioTime(time);
            ws.setTime(time);
          });

          const audioUrl = `/songs/${songId}/${loadedConfig.audioFile || `${songId}.mp3`}`;
          ws.load(audioUrl);
          wavesurferRef.current = ws;
        }
      } catch (err) {
        setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    }

    loadFiles();

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [songId]);

  // Playback Controls
  const togglePlay = useCallback(() => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  }, []);

  const goBack = useCallback(
    (seconds: number) => {
      if (!wavesurferRef.current) return;
      const newTime = Math.max(0, audioTime - seconds);
      wavesurferRef.current.setTime(newTime);
      setAudioTime(newTime);
    },
    [audioTime]
  );

  const goForward = useCallback(
    (seconds: number) => {
      if (!wavesurferRef.current) return;
      const newTime = Math.min(audioDuration, audioTime + seconds);
      wavesurferRef.current.setTime(newTime);
      setAudioTime(newTime);
    },
    [audioTime, audioDuration]
  );

  // Sync Point Management
  const createSyncPoint = useCallback(() => {
    if (selectedMidiTime === null || selectedAudioTime === null) return;

    const id = generateSyncPointId();
    const label = `Sync ${syncPoints.length + 1}`;

    const newPoint: SyncPoint = {
      id,
      midiTime: selectedMidiTime,
      audioTime: selectedAudioTime,
      label,
    };

    setSyncPoints((prev) =>
      [...prev, newPoint].sort((a, b) => a.midiTime - b.midiTime)
    );

    if (regionsRef.current) {
      regionsRef.current.addRegion({
        id,
        start: selectedAudioTime,
        end: selectedAudioTime,
        color: 'rgba(16, 185, 129, 0.8)',
        content: label,
      });
    }

    setSelectedMidiTime(null);
    setSelectedAudioTime(null);
  }, [selectedMidiTime, selectedAudioTime, syncPoints.length]);

  const deleteSyncPoint = useCallback((id: string) => {
    setSyncPoints((prev) => prev.filter((p) => p.id !== id));
    if (regionsRef.current) {
      const regions = regionsRef.current.getRegions();
      const region = regions.find((r) => r.id === id);
      if (region) region.remove();
    }
  }, []);

  // Adornment Management
  const addAdornment = useCallback(
    (type: AdornmentType) => {
      let startTime: number;
      let endTime: number;
      let trackIndex: number | undefined;

      if (adornmentScope === 'track') {
        startTime = 0;
        endTime = midiDuration;
        trackIndex = selectedTrackForAdornment;
      } else {
        if (selectedNotes.length === 0) return;
        startTime = Math.min(...selectedNotes.map((n) => n.time));
        endTime = Math.max(...selectedNotes.map((n) => n.time + n.duration));
      }

      const newAdornment: Adornment = {
        id: generateAdornmentId(),
        type,
        scope: adornmentScope,
        startTime,
        endTime,
        trackIndex,
        label: ADORNMENT_LABELS[type],
      };

      setAdornments((prev) => [...prev, newAdornment]);
      setSelectedNotes([]);
    },
    [adornmentScope, selectedNotes, selectedTrackForAdornment, midiDuration]
  );

  // Save Config
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updatedConfig: SongConfig = {
        id: songId,
        title: config?.title || songId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        midiFile: config?.midiFile || `${songId}.mid`,
        audioFile: config?.audioFile || `${songId}.mp3`,
        syncPoints,
        tracks: tracks.map((t) => ({
          name: t.name,
          noteCount: t.noteCount,
          color: t.color,
          instrument: t.instrument,
          visible: t.visible,
          muted: t.muted,
          solo: t.solo,
        })),
        adornments,
        createdAt: config?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveSongConfig(songId, updatedConfig);
      setConfig(updatedConfig);
      alert('Saved! You can now play this song with sync.');
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [songId, config, syncPoints, tracks, adornments]);

  // Export Config
  const handleExport = useCallback(() => {
    if (!config) return;
    exportConfigAsJson({
      ...config,
      syncPoints,
      tracks: tracks.map((t) => ({
        name: t.name,
        noteCount: t.noteCount,
        color: t.color,
        instrument: t.instrument,
        visible: t.visible,
        muted: t.muted,
        solo: t.solo,
      })),
      adornments,
    });
  }, [config, syncPoints, tracks, adornments]);

  // Draw Piano Roll
  useEffect(() => {
    const canvas = pianoRollRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 200;
    }

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (notes.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading MIDI...', canvas.width / 2, canvas.height / 2);
      return;
    }

    const minPitch = Math.min(...notes.map((n) => n.midi)) - 2;
    const maxPitch = Math.max(...notes.map((n) => n.midi)) + 2;
    const pitchRange = maxPitch - minPitch;

    // Draw time grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let t = 0; t < midiDuration; t += 1) {
      const x = (t - midiScroll) * midiZoom;
      if (x > 0 && x < canvas.width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    }

    // Draw sync point lines
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    syncPoints.forEach((sp) => {
      const x = (sp.midiTime - midiScroll) * midiZoom;
      if (x > 0 && x < canvas.width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
    });

    // Draw notes
    notes.forEach((note) => {
      const x = (note.time - midiScroll) * midiZoom;
      const width = Math.max(note.duration * midiZoom, 2);
      const y =
        canvas.height -
        ((note.midi - minPitch) / pitchRange) * (canvas.height - 20) -
        10;

      if (x + width < 0 || x > canvas.width) return;

      const isSelected = selectedNotes.some(
        (n) => n.time === note.time && n.midi === note.midi
      );

      ctx.fillStyle = isSelected
        ? '#ffffff'
        : tracks[note.track]?.color || '#666';
      ctx.globalAlpha = isSelected ? 1 : note.velocity * 0.6 + 0.4;
      ctx.beginPath();
      ctx.roundRect(x, y - 2, width, 4, 1);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Draw selected MIDI time marker
    if (selectedMidiTime !== null) {
      const x = (selectedMidiTime - midiScroll) * midiZoom;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '12px sans-serif';
      ctx.fillText(`MIDI: ${formatTime(selectedMidiTime)}`, x + 5, 15);
    }
  }, [
    notes,
    tracks,
    midiDuration,
    midiZoom,
    midiScroll,
    syncPoints,
    selectedMidiTime,
    selectedNotes,
  ]);

  // Piano Roll Click Handler
  const handlePianoRollClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = pianoRollRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickTime = x / midiZoom + midiScroll;

      const clickedNotes = notes.filter((note) => {
        const noteX = (note.time - midiScroll) * midiZoom;
        const noteWidth = Math.max(note.duration * midiZoom, 10);
        return x >= noteX && x <= noteX + noteWidth;
      });

      if (e.shiftKey && clickedNotes.length > 0) {
        setSelectedNotes((prev) => [...prev, ...clickedNotes]);
      } else if (clickedNotes.length > 0) {
        setSelectedMidiTime(clickedNotes[0].time);
        setSelectedNotes(clickedNotes);
      } else {
        setSelectedMidiTime(clickTime);
        setSelectedNotes([]);
      }
    },
    [notes, midiZoom, midiScroll]
  );

  // Scroll Piano Roll
  const scrollMidi = useCallback(
    (direction: 'left' | 'right') => {
      const delta = (5 / midiZoom) * 10;
      setMidiScroll((prev) => {
        if (direction === 'left') return Math.max(0, prev - delta);
        return Math.min(midiDuration - 10, prev + delta);
      });
    },
    [midiZoom, midiDuration]
  );

  const adornmentTypes: AdornmentType[] = [
    'wavy',
    'spark',
    'punch',
    'glow',
    'phrase',
    'accent',
    'tremolo',
    'legato',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading {songId}...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
              Editor: {config?.title || songId}
            </h1>
          </div>
          <p className="text-zinc-400 text-sm mt-1">
            Create sync points and add visual adornments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm"
          >
            Export JSON
          </button>
          <Link
            href={`/play/${songId}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Play →
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Audio Waveform */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Audio Waveform</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Click to mark audio time</span>
            {selectedAudioTime !== null && (
              <span className="text-amber-400 font-mono">
                Selected: {formatTime(selectedAudioTime)}
              </span>
            )}
          </div>
        </div>

        <div ref={waveformRef} className="mb-3" />

        {audioLoaded && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goBack(30)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              -30s
            </button>
            <button
              onClick={() => goBack(5)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              -5s
            </button>
            <button
              onClick={togglePlay}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => goForward(5)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              +5s
            </button>
            <button
              onClick={() => goForward(30)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              +30s
            </button>
            <span className="ml-auto font-mono text-sm">
              {formatTime(audioTime)}
            </span>
          </div>
        )}
      </div>

      {/* MIDI Piano Roll */}
      <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">MIDI Piano Roll</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Click to select MIDI time | Shift+click for notes</span>
            {selectedMidiTime !== null && (
              <span className="text-amber-400 font-mono">
                Selected: {formatTime(selectedMidiTime)}
              </span>
            )}
          </div>
        </div>

        <canvas
          ref={pianoRollRef}
          onClick={handlePianoRollClick}
          className="w-full cursor-crosshair mb-3"
          style={{ height: 200 }}
        />

        {midiLoaded && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollMidi('left')}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              ← Scroll
            </button>
            <button
              onClick={() => scrollMidi('right')}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
            >
              Scroll →
            </button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-zinc-400">Zoom:</span>
              <input
                type="range"
                min="20"
                max="200"
                value={midiZoom}
                onChange={(e) => setMidiZoom(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sync Point Creator */}
      {midiLoaded && audioLoaded && (
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h2 className="font-semibold text-sm mb-3">Create Sync Point</h2>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">MIDI:</span>
              <span
                className={`font-mono text-sm ${
                  selectedMidiTime !== null ? 'text-amber-400' : 'text-zinc-600'
                }`}
              >
                {selectedMidiTime !== null
                  ? formatTime(selectedMidiTime)
                  : 'Not selected'}
              </span>
            </div>

            <span className="text-zinc-600">↔</span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Audio:</span>
              <span
                className={`font-mono text-sm ${
                  selectedAudioTime !== null
                    ? 'text-amber-400'
                    : 'text-zinc-600'
                }`}
              >
                {selectedAudioTime !== null
                  ? formatTime(selectedAudioTime)
                  : 'Not selected'}
              </span>
            </div>

            <button
              onClick={createSyncPoint}
              disabled={
                selectedMidiTime === null || selectedAudioTime === null
              }
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm"
            >
              Link Points
            </button>
          </div>

          {syncPoints.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs text-zinc-400 mb-2">
                Sync Points ({syncPoints.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {syncPoints.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex items-center gap-2 bg-zinc-800 rounded px-3 py-1 text-xs"
                  >
                    <span className="text-green-400">{sp.label}</span>
                    <span className="text-zinc-400">
                      M:{formatTime(sp.midiTime)} ↔ A:
                      {formatTime(sp.audioTime)}
                    </span>
                    <button
                      onClick={() => deleteSyncPoint(sp.id)}
                      className="text-red-400 hover:text-red-300 ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adornments */}
      {midiLoaded && audioLoaded && (
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h2 className="font-semibold text-sm mb-3">Visual Adornments</h2>

          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs text-zinc-400">Scope:</span>
            <button
              onClick={() => setAdornmentScope('section')}
              className={`px-3 py-1 rounded text-xs ${
                adornmentScope === 'section'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              Section (selected notes)
            </button>
            <button
              onClick={() => setAdornmentScope('track')}
              className={`px-3 py-1 rounded text-xs ${
                adornmentScope === 'track'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              Entire Track
            </button>

            {adornmentScope === 'track' && tracks.length > 0 && (
              <select
                value={selectedTrackForAdornment}
                onChange={(e) =>
                  setSelectedTrackForAdornment(Number(e.target.value))
                }
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
              >
                {tracks.map((t, i) => (
                  <option key={i} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {adornmentTypes.map((type) => (
              <button
                key={type}
                onClick={() => addAdornment(type)}
                disabled={
                  adornmentScope === 'section' && selectedNotes.length === 0
                }
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-xs"
              >
                {ADORNMENT_LABELS[type]}
              </button>
            ))}

            {adornmentScope === 'section' && selectedNotes.length > 0 && (
              <span className="text-xs text-amber-400 ml-2">
                {selectedNotes.length} notes selected
              </span>
            )}
          </div>

          {adornments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {adornments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 bg-zinc-800 rounded px-3 py-1 text-xs"
                >
                  <span className="text-purple-400">{a.label}</span>
                  <span className="text-zinc-500">{a.scope}</span>
                  {a.trackIndex !== undefined && (
                    <span className="text-zinc-400">
                      Track {a.trackIndex + 1}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setAdornments((prev) => prev.filter((x) => x.id !== a.id))
                    }
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Track Legend */}
      {tracks.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h2 className="font-semibold text-sm mb-2">Tracks</h2>
          <div className="flex flex-wrap gap-2">
            {tracks.map((track, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1 rounded text-xs"
                style={{
                  backgroundColor: track.color + '33',
                  borderColor: track.color,
                  borderWidth: 1,
                }}
              >
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: track.color }}
                />
                <span>{track.name}</span>
                <span className="text-zinc-400">({track.noteCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
