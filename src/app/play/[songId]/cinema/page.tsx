'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Howl } from 'howler';
import { loadMidi } from '@/lib/midi';
import { Note, Track, SyncPoint, SongConfig } from '@/lib/types';
import { audioToMidiTime } from '@/lib/sync';
import { fetchSongConfig } from '@/lib/storage';

export default function CinemaPlayPage() {
  const params = useParams();
  const router = useRouter();
  const songId = params.songId as string;

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const howlRef = useRef<Howl | null>(null);
  const animationRef = useRef<number | null>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Data
  const [notes, setNotes] = useState<Note[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([]);
  const [config, setConfig] = useState<SongConfig | null>(null);

  // Visualization settings
  const [secondsVisible, setSecondsVisible] = useState(8); // How many seconds of music visible
  const [showControls, setShowControls] = useState(true);
  const [showTrackPanel, setShowTrackPanel] = useState(false);

  // Track visibility helpers
  const toggleTrackMute = useCallback((trackIndex: number) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === trackIndex ? { ...t, muted: !t.muted } : t))
    );
  }, []);

  const toggleTrackSolo = useCallback((trackIndex: number) => {
    setTracks((prev) =>
      prev.map((t, i) => (i === trackIndex ? { ...t, solo: !t.solo } : t))
    );
  }, []);

  const isTrackVisible = useCallback(
    (trackIndex: number) => {
      const hasSolo = tracks.some((t) => t.solo);
      const track = tracks[trackIndex];
      if (!track) return false;
      if (hasSolo) return track.solo;
      return !track.muted;
    },
    [tracks]
  );

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const loadedConfig = await fetchSongConfig(songId);
        setConfig(loadedConfig);
        setSyncPoints(loadedConfig.syncPoints || []);

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

        // Load audio with Howler
        const audioUrl = `/songs/${songId}/${loadedConfig.audioFile || `${songId}.mp3`}`;
        const howl = new Howl({
          src: [audioUrl],
          html5: true,
          onload: () => {
            setAudioDuration(howl.duration());
            setLoading(false);
          },
          onloaderror: () => {
            setError('Failed to load audio');
            setLoading(false);
          },
          onend: () => {
            setIsPlaying(false);
          },
        });
        howlRef.current = howl;
      } catch (err) {
        setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [songId]);

  // Request landscape orientation on mobile
  useEffect(() => {
    const orientation = typeof screen !== 'undefined' ? screen.orientation : null;
    if (orientation && typeof (orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }).lock === 'function') {
      (orientation as ScreenOrientation & { lock: (type: string) => Promise<void> }).lock('landscape').catch(() => {
        // Orientation lock not supported or denied - that's ok
      });
    }

    return () => {
      if (orientation && typeof (orientation as ScreenOrientation & { unlock?: () => void }).unlock === 'function') {
        (orientation as ScreenOrientation & { unlock: () => void }).unlock();
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = () => {
      if (howlRef.current) {
        setAudioTime(howlRef.current.seek() as number);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to fill container
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (notes.length === 0 || tracks.length === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading...', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Calculate MIDI time from audio time using sync points
    const midiTime = audioToMidiTime(audioTime, syncPoints);

    // Playhead is at center of screen
    const playheadY = canvas.height / 2;
    const pixelsPerSecond = canvas.height / secondsVisible;

    // Calculate time window
    const timeWindowStart = midiTime - (secondsVisible / 2);
    const timeWindowEnd = midiTime + (secondsVisible / 2);

    // Calculate track layout
    const trackCount = tracks.length;
    const trackWidth = canvas.width / trackCount;
    const trackPadding = 10;

    // Draw track separators and labels
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    tracks.forEach((track, i) => {
      const trackX = i * trackWidth;

      // Separator line
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(trackX, 0);
        ctx.lineTo(trackX, canvas.height);
        ctx.stroke();
      }

      // Track label at bottom
      ctx.fillStyle = track.color + '88';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(track.name, trackX + trackWidth / 2, canvas.height - 10);
    });

    // Get pitch range for each track
    const trackPitchRanges = tracks.map((_, trackIndex) => {
      const trackNotes = notes.filter((n) => n.track === trackIndex);
      if (trackNotes.length === 0) return { min: 60, max: 72 };
      const pitches = trackNotes.map((n) => n.midi);
      return {
        min: Math.min(...pitches) - 2,
        max: Math.max(...pitches) + 2,
      };
    });

    // Draw notes
    notes.forEach((note) => {
      // Check if track is visible (Solo/Mute)
      if (!isTrackVisible(note.track)) return;

      // Check if note is in visible time window
      const noteStart = note.time;
      const noteEnd = note.time + note.duration;

      if (noteEnd < timeWindowStart || noteStart > timeWindowEnd) return;

      const track = tracks[note.track];
      if (!track) return;

      const pitchRange = trackPitchRanges[note.track];
      const trackX = note.track * trackWidth + trackPadding;
      const noteAreaWidth = trackWidth - trackPadding * 2;

      // X position based on pitch (low = left, high = right)
      const pitchNormalized = (note.midi - pitchRange.min) / (pitchRange.max - pitchRange.min);
      const noteX = trackX + pitchNormalized * noteAreaWidth;

      // Y position: playhead is at center, notes scroll down
      // Notes above playhead are in the future (top), below are past (bottom)
      const noteY = playheadY - (noteStart - midiTime) * pixelsPerSecond;
      const noteHeight = Math.max(note.duration * pixelsPerSecond, 4);

      // Is this note currently playing?
      const isActive = midiTime >= noteStart && midiTime < noteEnd;

      // Draw note
      const noteWidth = Math.max(8, noteAreaWidth / 20);

      if (isActive) {
        // Active note - glow effect
        ctx.shadowColor = track.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = track.color;
      }

      ctx.globalAlpha = isActive ? 1 : 0.7;
      ctx.beginPath();
      ctx.roundRect(noteX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight, 3);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Draw playhead line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, playheadY);
    ctx.lineTo(canvas.width, playheadY);
    ctx.stroke();

    // Playhead label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NOW', 10, playheadY - 10);

  }, [notes, tracks, audioTime, syncPoints, secondsVisible, isTrackVisible]);

  // Playback controls
  const togglePlay = useCallback(() => {
    if (!howlRef.current) return;
    if (isPlaying) {
      howlRef.current.pause();
      setIsPlaying(false);
    } else {
      howlRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    if (!howlRef.current) return;
    howlRef.current.seek(time);
    setAudioTime(time);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          router.push(`/play/${songId}`);
        }
      } else if (e.code === 'ArrowLeft') {
        seekTo(Math.max(0, audioTime - 5));
      } else if (e.code === 'ArrowRight') {
        seekTo(Math.min(audioDuration, audioTime + 5));
      } else if (e.code === 'KeyH') {
        setShowControls((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekTo, audioTime, audioDuration, router, songId]);

  // Format time
  const formatTime = (t: number) => {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Cinema Mode...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 text-xl">{error}</div>
        <button
          onClick={() => router.push(`/play/${songId}`)}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg"
        >
          Back to Standard Play
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black cursor-pointer"
      onClick={() => !showControls && setShowControls(true)}
    >
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Controls overlay */}
      {showControls && (
        <div
          className="absolute inset-0 pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push(`/play/${songId}`)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  ← Back
                </button>
                <h1 className="text-white font-bold text-lg">
                  {config?.title || songId} - Cinema Mode
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowTrackPanel((prev) => !prev)}
                  className={`px-3 py-1 rounded text-white text-sm ${
                    showTrackPanel ? 'bg-purple-600' : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  Tracks
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm"
                >
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                <button
                  onClick={() => setShowControls(false)}
                  className="text-white/50 hover:text-white text-sm"
                >
                  Hide (H)
                </button>
              </div>
            </div>
          </div>

          {/* Track Panel */}
          {showTrackPanel && (
            <div className="absolute top-16 right-4 bg-black/90 rounded-lg p-3 pointer-events-auto max-h-[60vh] overflow-y-auto">
              <div className="text-white text-sm font-medium mb-2">Tracks (Solo/Mute)</div>
              <div className="space-y-1">
                {tracks.map((track, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-1 rounded hover:bg-white/10"
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: track.color }}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        isTrackVisible(i) ? 'text-white' : 'text-white/40'
                      }`}
                    >
                      {track.name}
                    </span>
                    <button
                      onClick={() => toggleTrackSolo(i)}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        track.solo
                          ? 'bg-yellow-500 text-black'
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      S
                    </button>
                    <button
                      onClick={() => toggleTrackMute(i)}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        track.muted
                          ? 'bg-red-500 text-white'
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      M
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/20 text-xs text-white/50">
                S = Solo (show only) • M = Mute (hide)
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
            <div className="space-y-2">
              {/* Progress bar */}
              <div
                className="relative h-2 bg-white/20 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  seekTo(percent * audioDuration);
                }}
              >
                <div
                  className="absolute h-full bg-white rounded-full"
                  style={{ width: `${(audioTime / audioDuration) * 100}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center bg-white rounded-full text-black hover:bg-white/90"
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
                  <span className="text-white font-mono">
                    {formatTime(audioTime)} / {formatTime(audioDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-sm">Zoom:</span>
                    <button
                      onClick={() => setSecondsVisible((s) => Math.min(20, s + 2))}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm"
                    >
                      -
                    </button>
                    <span className="text-white text-sm w-12 text-center">{secondsVisible}s</span>
                    <button
                      onClick={() => setSecondsVisible((s) => Math.max(2, s - 2))}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Keyboard hints */}
              <div className="flex items-center justify-center gap-6 text-white/40 text-xs">
                <span>Space: Play/Pause</span>
                <span>←/→: Seek</span>
                <span>H: Hide controls</span>
                <span>Esc: Exit</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
