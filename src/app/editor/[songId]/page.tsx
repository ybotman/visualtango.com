'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { loadMidi } from '@/lib/midi';
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

type EditorMode = 'sync' | 'adornment';

export default function EditorPage() {
  const params = useParams();
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

  // State - Editor Mode
  const [editorMode, setEditorMode] = useState<EditorMode>('sync');

  // State - Selection
  const [selectedMidiTime, setSelectedMidiTime] = useState<number | null>(null);
  const [selectedAudioTime, setSelectedAudioTime] = useState<number | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null);

  // State - Sync & Adornments
  const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([]);
  const [adornments, setAdornments] = useState<Adornment[]>([]);
  const [adornmentScope, setAdornmentScope] = useState<'section' | 'track'>('section');
  const [selectedTrackForAdornment, setSelectedTrackForAdornment] = useState<number>(0);

  // State - UI / Piano Roll
  const [midiZoom, setMidiZoom] = useState(50);
  const [midiScroll, setMidiScroll] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScroll, setDragStartScroll] = useState(0);

  // State - Dragging sync points on MIDI piano roll
  const [draggingSyncPointId, setDraggingSyncPointId] = useState<string | null>(null);
  const [dragSyncStartX, setDragSyncStartX] = useState(0);
  const [dragSyncStartTime, setDragSyncStartTime] = useState(0);

  // State - Audio Zoom & Scroll
  const [audioZoom, setAudioZoom] = useState(50); // WaveSurfer zoom: pixels per second
  const [isAudioDragging, setIsAudioDragging] = useState(false);
  const [audioDragStartX, setAudioDragStartX] = useState(0);
  const [audioDragStartTime, setAudioDragStartTime] = useState(0);

  // State - Synced Zoom
  const [syncedZoom, setSyncedZoom] = useState(true); // Keep audio and MIDI zoom in sync

  // State - Toast notification
  const [toast, setToast] = useState<string | null>(null);

  // Show toast notification
  const showToast = useCallback((message: string, duration = 2000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }, []);

  // Load files on mount
  useEffect(() => {
    let isMounted = true;
    let loadTimeout: NodeJS.Timeout | null = null;

    async function loadFiles() {
      setLoading(true);
      setError(null);

      loadTimeout = setTimeout(() => {
        if (isMounted) {
          setError('Loading timed out. Please refresh the page.');
          setLoading(false);
        }
      }, 30000);

      try {
        const loadedConfig = await fetchSongConfig(songId);
        setConfig(loadedConfig);
        setSyncPoints(loadedConfig.syncPoints || []);
        setAdornments(loadedConfig.adornments || []);

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

        // WaveSurfer initialization - retry if ref not ready (React Strict Mode)
        const initWaveSurfer = () => {
          if (!waveformRef.current || !isMounted) {
            // Retry after a short delay (handles React Strict Mode double-mount)
            setTimeout(() => {
              if (isMounted && waveformRef.current) {
                initWaveSurfer();
              }
            }, 100);
            return;
          }

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
            if (loadTimeout) clearTimeout(loadTimeout);
            if (!isMounted) return;
            setAudioDuration(ws.getDuration());
            setAudioLoaded(true);
            setLoading(false);

            loadedConfig.syncPoints?.forEach((sp) => {
              regions.addRegion({
                id: sp.id,
                start: sp.audioTime,
                end: sp.audioTime,
                color: 'rgba(16, 185, 129, 0.8)',
                content: sp.label,
                drag: true,
                resize: false,
              });
            });

            // Listen for region updates (when user drags a sync point)
            regions.on('region-updated', (region) => {
              console.log('Region updated:', region.id, 'new time:', region.start);
              setSyncPoints((prev) =>
                prev.map((sp) =>
                  sp.id === region.id
                    ? { ...sp, audioTime: region.start }
                    : sp
                )
              );
            });
          });

          ws.on('error', (err) => {
            console.error('WaveSurfer error:', err);
            if (loadTimeout) clearTimeout(loadTimeout);
            if (!isMounted) return;
            setError('Failed to load audio file');
            setLoading(false);
          });

          ws.on('timeupdate', (time) => setAudioTime(time));
          ws.on('play', () => setIsPlaying(true));
          ws.on('pause', () => setIsPlaying(false));
          ws.on('click', (relativeX) => {
            if (editorMode !== 'sync') return;
            const time = relativeX * ws.getDuration();
            setSelectedAudioTime(time);
            ws.setTime(time);
          });

          const audioUrl = `/songs/${songId}/${loadedConfig.audioFile || `${songId}.mp3`}`;
          ws.load(audioUrl);
          wavesurferRef.current = ws;
        };

        initWaveSurfer();
      } catch (err) {
        console.error('Editor load error:', err);
        if (loadTimeout) clearTimeout(loadTimeout);
        if (isMounted) {
          setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setLoading(false);
        }
      }
    }

    loadFiles();

    return () => {
      isMounted = false;
      if (loadTimeout) clearTimeout(loadTimeout);
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

  const seekTo = useCallback(
    (time: number) => {
      if (!wavesurferRef.current) return;
      const clampedTime = Math.max(0, Math.min(audioDuration, time));
      wavesurferRef.current.setTime(clampedTime);
      setAudioTime(clampedTime);
    },
    [audioDuration]
  );

  // Audio zoom control
  const handleAudioZoom = useCallback(
    (newZoom: number) => {
      if (!wavesurferRef.current) return;
      const clampedZoom = Math.max(20, Math.min(500, newZoom));
      setAudioZoom(clampedZoom);
      wavesurferRef.current.zoom(clampedZoom);
      if (syncedZoom) {
        setMidiZoom(clampedZoom);
      }
    },
    [syncedZoom]
  );

  // MIDI zoom control (with sync option)
  const handleMidiZoom = useCallback(
    (newZoom: number) => {
      const clampedZoom = Math.max(20, Math.min(500, newZoom));
      setMidiZoom(clampedZoom);
      if (syncedZoom && wavesurferRef.current) {
        setAudioZoom(clampedZoom);
        wavesurferRef.current.zoom(clampedZoom);
      }
    },
    [syncedZoom]
  );

  // Audio waveform drag handlers
  const handleAudioMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Alt+click or middle mouse button to drag
      if (e.altKey || e.button === 1) {
        e.preventDefault();
        setIsAudioDragging(true);
        setAudioDragStartX(e.clientX);
        setAudioDragStartTime(audioTime);
      }
    },
    [audioTime]
  );

  const handleAudioMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isAudioDragging || !wavesurferRef.current) return;

      const deltaX = e.clientX - audioDragStartX;
      // Convert pixels to seconds based on zoom level
      const deltaTime = -deltaX / audioZoom;
      const newTime = Math.max(0, Math.min(audioDuration, audioDragStartTime + deltaTime));

      wavesurferRef.current.setTime(newTime);
      setAudioTime(newTime);
    },
    [isAudioDragging, audioDragStartX, audioDragStartTime, audioZoom, audioDuration]
  );

  const handleAudioMouseUp = useCallback(() => {
    setIsAudioDragging(false);
  }, []);

  const handleAudioMouseLeave = useCallback(() => {
    setIsAudioDragging(false);
  }, []);

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
        drag: true,
        resize: false,
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
    console.log('=== SAVE STARTED ===');
    console.log('Current syncPoints:', syncPoints);
    console.log('Current adornments:', adornments);
    console.log('Current tracks:', tracks.length);

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

      console.log('Saving config:', updatedConfig);
      await saveSongConfig(songId, updatedConfig);
      console.log('Save successful!');
      setConfig(updatedConfig);
      showToast('Saved!');
    } catch (err) {
      console.error('Save failed:', err);
      setError(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [songId, config, syncPoints, tracks, adornments, showToast]);

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

  // Get sync point at position on MIDI piano roll
  const getSyncPointAtPosition = useCallback(
    (x: number): SyncPoint | null => {
      const hitThreshold = 10; // pixels
      for (const sp of syncPoints) {
        const spX = (sp.midiTime - midiScroll) * midiZoom;
        if (Math.abs(x - spX) < hitThreshold) {
          return sp;
        }
      }
      return null;
    },
    [syncPoints, midiScroll, midiZoom]
  );

  // Get note at position helper
  const getNoteAtPosition = useCallback(
    (x: number, y: number, canvas: HTMLCanvasElement): Note | null => {
      if (notes.length === 0) return null;

      const minPitch = Math.min(...notes.map((n) => n.midi)) - 2;
      const maxPitch = Math.max(...notes.map((n) => n.midi)) + 2;
      const pitchRange = maxPitch - minPitch;

      for (const note of notes) {
        const noteX = (note.time - midiScroll) * midiZoom;
        const noteWidth = Math.max(note.duration * midiZoom, 8);
        const noteY =
          canvas.height -
          ((note.midi - minPitch) / pitchRange) * (canvas.height - 20) -
          10;

        if (x >= noteX && x <= noteX + noteWidth && y >= noteY - 4 && y <= noteY + 4) {
          return note;
        }
      }
      return null;
    },
    [notes, midiScroll, midiZoom]
  );

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

    // Draw time grid (every second)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let t = 0; t < midiDuration; t += 1) {
      const x = (t - midiScroll) * midiZoom;
      if (x > 0 && x < canvas.width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        // Time labels every 5 seconds
        if (t % 5 === 0) {
          ctx.fillStyle = '#555';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${t}s`, x + 2, canvas.height - 2);
        }
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

        // Sync point label
        ctx.fillStyle = '#10B981';
        ctx.font = '10px sans-serif';
        ctx.fillText(sp.label, x + 3, 12);
      }
    });

    // Draw notes
    notes.forEach((note) => {
      const x = (note.time - midiScroll) * midiZoom;
      const width = Math.max(note.duration * midiZoom, 3);
      const y =
        canvas.height -
        ((note.midi - minPitch) / pitchRange) * (canvas.height - 20) -
        10;

      if (x + width < 0 || x > canvas.width) return;

      const isSelected = selectedNotes.some(
        (n) => n.time === note.time && n.midi === note.midi
      );
      const isHovered = hoveredNote?.time === note.time && hoveredNote?.midi === note.midi;

      // Note color
      let color = tracks[note.track]?.color || '#666';
      if (isSelected) color = '#ffffff';
      else if (isHovered) color = '#F59E0B';

      ctx.fillStyle = color;
      ctx.globalAlpha = isSelected || isHovered ? 1 : note.velocity * 0.6 + 0.4;
      ctx.beginPath();
      ctx.roundRect(x, y - 3, width, 6, 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    // Draw selected MIDI time marker (sync mode)
    if (editorMode === 'sync' && selectedMidiTime !== null) {
      const x = (selectedMidiTime - midiScroll) * midiZoom;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`MIDI: ${formatTime(selectedMidiTime)}`, x + 5, 25);
    }

    // Draw mode indicator
    ctx.fillStyle = editorMode === 'sync' ? '#10B981' : '#8B5CF6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      editorMode === 'sync' ? 'SYNC MODE: Click to select time' : 'ADORNMENT MODE: Click/Shift+click notes',
      canvas.width - 10,
      15
    );
  }, [
    notes,
    tracks,
    midiDuration,
    midiZoom,
    midiScroll,
    syncPoints,
    selectedMidiTime,
    selectedNotes,
    hoveredNote,
    editorMode,
  ]);

  // Piano Roll Mouse Handlers
  const handlePianoRollMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = pianoRollRef.current;
      if (!canvas) return;

      // Middle mouse button or Alt+click for dragging the view
      if (e.button === 1 || e.altKey) {
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartScroll(midiScroll);
        e.preventDefault();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const clickTime = x / midiZoom + midiScroll;

      // Check if clicking on a sync point marker (for dragging)
      if (editorMode === 'sync') {
        const syncPoint = getSyncPointAtPosition(x);
        if (syncPoint) {
          // Start dragging this sync point
          setDraggingSyncPointId(syncPoint.id);
          setDragSyncStartX(e.clientX);
          setDragSyncStartTime(syncPoint.midiTime);
          e.preventDefault();
          return;
        }

        // In sync mode, click to select time point
        const note = getNoteAtPosition(x, y, canvas);
        if (note) {
          setSelectedMidiTime(note.time);
        } else {
          setSelectedMidiTime(clickTime);
        }
        setSelectedNotes([]);
      } else {
        // In adornment mode, click to select notes
        const note = getNoteAtPosition(x, y, canvas);
        if (note) {
          if (e.shiftKey) {
            setSelectedNotes((prev) => {
              const exists = prev.some((n) => n.time === note.time && n.midi === note.midi);
              if (exists) {
                return prev.filter((n) => !(n.time === note.time && n.midi === note.midi));
              }
              return [...prev, note];
            });
          } else {
            setSelectedNotes([note]);
          }
        } else if (!e.shiftKey) {
          setSelectedNotes([]);
        }
      }
    },
    [midiZoom, midiScroll, editorMode, getNoteAtPosition, getSyncPointAtPosition]
  );

  const handlePianoRollMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = pianoRollRef.current;
      if (!canvas) return;

      // Handle dragging a sync point
      if (draggingSyncPointId) {
        const deltaX = e.clientX - dragSyncStartX;
        const deltaTime = deltaX / midiZoom;
        const newMidiTime = Math.max(0, dragSyncStartTime + deltaTime);

        // Update the sync point's midiTime in real-time
        setSyncPoints((prev) =>
          prev.map((sp) =>
            sp.id === draggingSyncPointId
              ? { ...sp, midiTime: newMidiTime }
              : sp
          )
        );
        return;
      }

      if (isDragging) {
        const deltaX = e.clientX - dragStartX;
        const deltaScroll = deltaX / midiZoom;
        const newScroll = Math.max(0, Math.min(midiDuration - 5, dragStartScroll - deltaScroll));
        setMidiScroll(newScroll);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if hovering over a sync point (change cursor)
      const syncPoint = getSyncPointAtPosition(x);
      if (syncPoint && editorMode === 'sync') {
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = isDragging ? 'grabbing' : hoveredNote ? 'pointer' : 'crosshair';
      }

      const note = getNoteAtPosition(x, y, canvas);
      setHoveredNote(note);
    },
    [isDragging, dragStartX, dragStartScroll, midiZoom, midiDuration, getNoteAtPosition, getSyncPointAtPosition, draggingSyncPointId, dragSyncStartX, dragSyncStartTime, editorMode, hoveredNote]
  );

  const handlePianoRollMouseUp = useCallback(() => {
    if (draggingSyncPointId) {
      console.log('Sync point dragged on MIDI:', draggingSyncPointId);
      setDraggingSyncPointId(null);
    }
    setIsDragging(false);
  }, [draggingSyncPointId]);

  const handlePianoRollMouseLeave = useCallback(() => {
    if (draggingSyncPointId) {
      setDraggingSyncPointId(null);
    }
    setIsDragging(false);
    setHoveredNote(null);
  }, [draggingSyncPointId]);

  // Wheel zoom on piano roll - needs non-passive listener for preventDefault
  useEffect(() => {
    const canvas = pianoRollRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom with Ctrl/Cmd + scroll
        const zoomDelta = e.deltaY > 0 ? -10 : 10;
        setMidiZoom((prev) => Math.max(20, Math.min(300, prev + zoomDelta)));
      } else {
        // Scroll horizontally
        setMidiScroll((prev) => {
          const scrollDelta = e.deltaY / midiZoom;
          return Math.max(0, Math.min(midiDuration - 5, prev + scrollDelta));
        });
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [midiZoom, midiDuration]);

  const adornmentTypes: AdornmentType[] = [
    'wavy', 'spark', 'punch', 'glow', 'phrase', 'accent', 'tremolo', 'legato',
  ];

  return (
    <div className="space-y-4 relative">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-pulse">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg font-medium">
            {toast}
          </div>
        </div>
      )}
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
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded-lg text-sm"
          >
            Export
          </button>
          <Link
            href={`/play/${songId}`}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
          >
            Play →
          </Link>
        </div>
      </div>

      {/* Mode Toggle - Prominent */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400 font-medium">Editor Mode:</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditorMode('sync');
                setSelectedNotes([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                editorMode === 'sync'
                  ? 'bg-green-600 text-white shadow-lg shadow-green-600/30'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Sync Points
            </button>
            <button
              onClick={() => {
                setEditorMode('adornment');
                setSelectedMidiTime(null);
                setSelectedAudioTime(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                editorMode === 'adornment'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              Adornments
            </button>
          </div>
          <span className="text-xs text-zinc-500 ml-4">
            {editorMode === 'sync'
              ? 'Click waveform for audio time, click piano roll for MIDI time, then Link'
              : 'Click or Shift+click notes to select, then apply adornment'}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 flex items-center justify-center">
          <div className="text-zinc-400">Loading {songId}...</div>
        </div>
      )}

      {/* Audio Waveform */}
      <div className={`bg-zinc-900 rounded-lg p-4 border border-zinc-800 ${loading ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">Audio Waveform</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {editorMode === 'sync' && (
              <>
                <span>Click to mark audio time</span>
                {selectedAudioTime !== null && (
                  <span className="text-amber-400 font-mono">
                    Audio: {formatTime(selectedAudioTime)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div
          onMouseDown={handleAudioMouseDown}
          onMouseMove={handleAudioMouseMove}
          onMouseUp={handleAudioMouseUp}
          onMouseLeave={handleAudioMouseLeave}
          className={`mb-3 ${isAudioDragging ? 'cursor-grabbing' : ''}`}
        >
          <div ref={waveformRef} />
        </div>

        {audioLoaded && (
          <div className="space-y-3">
            {/* Full-width position bar */}
            <div
              className="relative h-6 bg-zinc-800 rounded cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                seekTo(percent * audioDuration);
              }}
            >
              <div
                className="absolute h-full bg-blue-600/30 rounded-l"
                style={{ width: `${(audioTime / audioDuration) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-blue-500 rounded"
                style={{ left: `${(audioTime / audioDuration) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 group-hover:text-zinc-300">
                Click to seek • {formatTime(audioTime)} / {formatTime(audioDuration)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => seekTo(audioTime - 30)}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
              >
                -30s
              </button>
              <button
                onClick={() => seekTo(audioTime - 5)}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
              >
                -5s
              </button>
              <button
                onClick={togglePlay}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={() => seekTo(audioTime + 5)}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
              >
                +5s
              </button>
              <button
                onClick={() => seekTo(audioTime + 30)}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
              >
                +30s
              </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Zoom:</span>
                <button
                  onClick={() => handleAudioZoom(audioZoom - 20)}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  -
                </button>
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={audioZoom}
                  onChange={(e) => handleAudioZoom(Number(e.target.value))}
                  className="w-24"
                />
                <button
                  onClick={() => handleAudioZoom(audioZoom + 20)}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  +
                </button>
                <span className="text-xs text-zinc-500 w-16">{audioZoom}px/s</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncedZoom}
                  onChange={(e) => setSyncedZoom(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-zinc-400">Sync zoom with MIDI</span>
              </label>
              <span className="text-xs text-zinc-500">Alt+drag to scroll</span>
            </div>
          </div>
        )}
      </div>

      {/* MIDI Piano Roll */}
      <div className={`bg-zinc-900 rounded-lg p-4 border border-zinc-800 ${loading ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm">MIDI Piano Roll</h2>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span>Scroll: Mouse wheel | Zoom: Ctrl+wheel | Drag: Alt+drag</span>
            {editorMode === 'sync' && selectedMidiTime !== null && (
              <span className="text-amber-400 font-mono">
                MIDI: {formatTime(selectedMidiTime)}
              </span>
            )}
            {editorMode === 'adornment' && selectedNotes.length > 0 && (
              <span className="text-purple-400">
                {selectedNotes.length} note{selectedNotes.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>
        </div>

        <canvas
          ref={pianoRollRef}
          onMouseDown={handlePianoRollMouseDown}
          onMouseMove={handlePianoRollMouseMove}
          onMouseUp={handlePianoRollMouseUp}
          onMouseLeave={handlePianoRollMouseLeave}
          className={`w-full mb-3 ${draggingSyncPointId ? 'cursor-ew-resize' : isDragging ? 'cursor-grabbing' : hoveredNote ? 'cursor-pointer' : 'cursor-crosshair'}`}
          style={{ height: 200 }}
        />

        {midiLoaded && (
          <div className="space-y-3">
            {/* Full-width position bar */}
            <div
              className="relative h-6 bg-zinc-800 rounded cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                setMidiScroll(Math.max(0, percent * midiDuration - 5));
              }}
            >
              <div
                className="absolute h-full bg-green-600/30 rounded-l"
                style={{ width: `${(midiScroll / Math.max(1, midiDuration - 5)) * 100}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-green-500 rounded"
                style={{ left: `${(midiScroll / Math.max(1, midiDuration - 5)) * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400 group-hover:text-zinc-300">
                Click to scroll • {formatTime(midiScroll)} / {formatTime(midiDuration)}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Zoom:</span>
                <button
                  onClick={() => handleMidiZoom(midiZoom - 20)}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  -
                </button>
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={midiZoom}
                  onChange={(e) => handleMidiZoom(Number(e.target.value))}
                  className="w-24"
                />
                <button
                  onClick={() => handleMidiZoom(midiZoom + 20)}
                  className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs"
                >
                  +
                </button>
                <span className="text-xs text-zinc-500 w-16">{midiZoom}px/s</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncedZoom}
                  onChange={(e) => setSyncedZoom(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs text-zinc-400">Sync zoom with Audio</span>
              </label>
              <span className="text-xs text-zinc-500">Scroll: wheel | Zoom: Ctrl+wheel | Drag: Alt+drag</span>
            </div>
          </div>
        )}
      </div>

      {/* Sync Mode Controls */}
      {editorMode === 'sync' && midiLoaded && audioLoaded && (
        <div className="bg-zinc-900 rounded-lg p-4 border-2 border-green-600/50">
          <h2 className="font-semibold text-sm mb-3 text-green-400">Create Sync Point</h2>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">MIDI:</span>
              <span
                className={`font-mono text-sm ${
                  selectedMidiTime !== null ? 'text-amber-400' : 'text-zinc-600'
                }`}
              >
                {selectedMidiTime !== null ? formatTime(selectedMidiTime) : 'Click piano roll'}
              </span>
            </div>

            <span className="text-green-400 font-bold">↔</span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">Audio:</span>
              <span
                className={`font-mono text-sm ${
                  selectedAudioTime !== null ? 'text-amber-400' : 'text-zinc-600'
                }`}
              >
                {selectedAudioTime !== null ? formatTime(selectedAudioTime) : 'Click waveform'}
              </span>
            </div>

            <button
              onClick={createSyncPoint}
              disabled={selectedMidiTime === null || selectedAudioTime === null}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium"
            >
              Link Points
            </button>

            <button
              onClick={() => {
                setSelectedMidiTime(null);
                setSelectedAudioTime(null);
              }}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs"
            >
              Clear Selection
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
                      M:{formatTime(sp.midiTime)} ↔ A:{formatTime(sp.audioTime)}
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

          {/* Sync Analysis - Visual Bar (synced with MIDI piano roll zoom/scroll) */}
          {syncPoints.length >= 2 && (
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs text-zinc-400">
                  Sync Analysis (synced with MIDI view)
                </h3>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-green-600 rounded-sm"></span> OK
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-yellow-600 rounded-sm"></span> Rubato
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-600 rounded-sm"></span> Check
                  </span>
                </div>
              </div>
              {(() => {
                const sorted = [...syncPoints].sort((a, b) => a.midiTime - b.midiTime);

                // Calculate intervals and their status
                const intervals: Array<{
                  startTime: number;
                  endTime: number;
                  ratio: number;
                  label: string;
                  midiDelta: number;
                  audioDelta: number;
                }> = [];

                for (let i = 1; i < sorted.length; i++) {
                  const prev = sorted[i - 1];
                  const curr = sorted[i];
                  const midiDelta = curr.midiTime - prev.midiTime;
                  const audioDelta = curr.audioTime - prev.audioTime;
                  const ratio = midiDelta > 0 ? audioDelta / midiDelta : 1;

                  intervals.push({
                    startTime: prev.midiTime,
                    endTime: curr.midiTime,
                    ratio,
                    label: `${prev.label}→${curr.label}`,
                    midiDelta,
                    audioDelta,
                  });
                }

                const avgRatio = intervals.length > 0
                  ? intervals.reduce((sum, i) => sum + i.ratio, 0) / intervals.length
                  : 1;

                // Calculate visible window based on MIDI piano roll
                const containerWidth = 800; // Approximate, will be full width
                const visibleDuration = containerWidth / midiZoom;
                const visibleStart = midiScroll;
                const visibleEnd = midiScroll + visibleDuration;

                return (
                  <div className="relative h-8 bg-zinc-800 rounded overflow-hidden group">
                    {/* Colored segments - positioned based on midiZoom/midiScroll */}
                    {intervals.map((interval, i) => {
                      const ratioDeviation = Math.abs(interval.ratio - avgRatio);
                      const percentDiff = Math.abs(interval.ratio - 1) * 100;

                      let bgColor = 'bg-green-600/60';
                      if (ratioDeviation > 0.15 || percentDiff > 20) {
                        bgColor = 'bg-red-600/60';
                      } else if (ratioDeviation > 0.05 || percentDiff > 10) {
                        bgColor = 'bg-yellow-600/60';
                      }

                      // Position based on midiZoom and midiScroll (same as piano roll)
                      const leftPx = (interval.startTime - midiScroll) * midiZoom;
                      const widthPx = (interval.endTime - interval.startTime) * midiZoom;

                      // Skip if completely outside visible area
                      if (leftPx + widthPx < 0 || leftPx > containerWidth) return null;

                      return (
                        <div
                          key={i}
                          className={`absolute top-0 bottom-0 ${bgColor} hover:opacity-80 cursor-help border-r border-zinc-700`}
                          style={{
                            left: `${leftPx}px`,
                            width: `${Math.max(widthPx, 2)}px`,
                          }}
                          title={`${interval.label}: M=${interval.midiDelta.toFixed(1)}s A=${interval.audioDelta.toFixed(1)}s (${(interval.ratio * 100).toFixed(0)}%)`}
                        />
                      );
                    })}

                    {/* Sync point markers - positioned based on midiZoom/midiScroll */}
                    {sorted.map((sp, i) => {
                      const leftPx = (sp.midiTime - midiScroll) * midiZoom;

                      // Skip if outside visible area
                      if (leftPx < -20 || leftPx > containerWidth + 20) return null;

                      return (
                        <div
                          key={sp.id}
                          className="absolute top-0 bottom-0 w-0.5 bg-white"
                          style={{ left: `${leftPx}px` }}
                        >
                          <span className="absolute -top-0.5 left-1 text-[9px] text-white font-medium whitespace-nowrap">
                            {i + 1}
                          </span>
                        </div>
                      );
                    })}

                    {/* Current view indicator */}
                    <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none border-l-2 border-r-2 border-blue-500/30" />
                  </div>
                );
              })()}
              <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                <span>{formatTime(midiScroll)}</span>
                <span className="text-zinc-400">Synced with piano roll • Hover for details</span>
                <span>{formatTime(midiScroll + 10)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adornment Mode Controls */}
      {editorMode === 'adornment' && midiLoaded && audioLoaded && (
        <div className="bg-zinc-900 rounded-lg p-4 border-2 border-purple-600/50">
          <h2 className="font-semibold text-sm mb-3 text-purple-400">Visual Adornments</h2>

          <div className="flex items-center gap-4 mb-3">
            <span className="text-xs text-zinc-400">Scope:</span>
            <button
              onClick={() => setAdornmentScope('section')}
              className={`px-3 py-1 rounded text-xs ${
                adornmentScope === 'section'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              Selected Notes
            </button>
            <button
              onClick={() => setAdornmentScope('track')}
              className={`px-3 py-1 rounded text-xs ${
                adornmentScope === 'track'
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              Entire Track
            </button>

            {adornmentScope === 'track' && tracks.length > 0 && (
              <select
                value={selectedTrackForAdornment}
                onChange={(e) => setSelectedTrackForAdornment(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs"
              >
                {tracks.map((t, i) => (
                  <option key={i} value={i}>{t.name}</option>
                ))}
              </select>
            )}

            {adornmentScope === 'section' && (
              <span className="text-xs text-zinc-500">
                {selectedNotes.length === 0
                  ? 'Click notes in piano roll to select'
                  : `${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''} selected`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {adornmentTypes.map((type) => (
              <button
                key={type}
                onClick={() => addAdornment(type)}
                disabled={adornmentScope === 'section' && selectedNotes.length === 0}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 rounded text-xs"
              >
                {ADORNMENT_LABELS[type]}
              </button>
            ))}
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
                    <span className="text-zinc-400">Track {a.trackIndex + 1}</span>
                  )}
                  <button
                    onClick={() => setAdornments((prev) => prev.filter((x) => x.id !== a.id))}
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
      {tracks.length > 0 && !loading && (
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
