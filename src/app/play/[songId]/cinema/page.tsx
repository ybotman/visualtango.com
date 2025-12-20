'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Howl } from 'howler';
import { loadMidi } from '@/lib/midi';
import { Note, Track, SyncPoint, SongConfig, Adornment } from '@/lib/types';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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
  const [adornments, setAdornments] = useState<Adornment[]>([]);
  const [config, setConfig] = useState<SongConfig | null>(null);

  // Visualization settings
  const [secondsVisible, setSecondsVisible] = useState(8); // How many seconds of music visible
  const [showControls, setShowControls] = useState(true);
  const [showTrackPanel, setShowTrackPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'bands' | 'full'>('bands'); // bands = separate columns, full = merged
  const [showWatermark, setShowWatermark] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // A/V Sync offset - positive = visual ahead, negative = visual behind
  const [avOffset, setAvOffset] = useState(300); // Default +300ms

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
    // Apply A/V offset to compensate for rendering delay (offset in ms, convert to seconds)
    const adjustedAudioTime = audioTime + (avOffset / 1000);
    const midiTime = audioToMidiTime(adjustedAudioTime, syncPoints);

    // Helper to get adornments for a note
    const getAdornmentsForNote = (note: Note): Adornment[] => {
      return adornments.filter((ad) => {
        const noteEnd = note.time + note.duration;
        const inTimeRange = note.time < ad.endTime && noteEnd > ad.startTime;
        if (!inTimeRange) return false;
        if (ad.scope === 'track' && ad.trackIndex !== undefined) {
          return ad.trackIndex === note.track;
        }
        // For section scope with trackIndices, only apply to specified tracks
        if (ad.scope === 'section' && ad.trackIndices && ad.trackIndices.length > 0) {
          return ad.trackIndices.includes(note.track);
        }
        return true;
      });
    };

    // Playhead is at center of screen
    const playheadY = canvas.height / 2;
    const pixelsPerSecond = canvas.height / secondsVisible;

    // Calculate time window
    const timeWindowStart = midiTime - (secondsVisible / 2);
    const timeWindowEnd = midiTime + (secondsVisible / 2);

    // Get visible tracks for layout
    const visibleTrackIndices = tracks
      .map((_, i) => i)
      .filter((i) => isTrackVisible(i));
    const visibleTrackCount = visibleTrackIndices.length || 1;

    // Calculate layout based on view mode
    const padding = 20;

    if (viewMode === 'bands') {
      // BANDS MODE: Each track gets its own column
      const trackWidth = canvas.width / visibleTrackCount;

      // Draw alternating background bands and track titles
      visibleTrackIndices.forEach((trackIdx, i) => {
        const track = tracks[trackIdx];
        const trackX = i * trackWidth;

        // Alternating background - subtle dark/darker grey
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#0f0f0f';
        ctx.fillRect(trackX, 0, trackWidth, canvas.height);

        // Track title at TOP
        ctx.fillStyle = track.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(track.name, trackX + trackWidth / 2, 18);
      });

      // Draw separator lines between bands
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      visibleTrackIndices.forEach((_, i) => {
        if (i > 0) {
          const trackX = i * trackWidth;
          ctx.beginPath();
          ctx.moveTo(trackX, 0);
          ctx.lineTo(trackX, canvas.height);
          ctx.stroke();
        }
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

      // Draw notes in bands with adornment effects
      notes.forEach((note) => {
        if (!isTrackVisible(note.track)) return;

        const noteStart = note.time;
        const noteEnd = note.time + note.duration;
        if (noteEnd < timeWindowStart || noteStart > timeWindowEnd) return;

        const track = tracks[note.track];
        if (!track) return;

        // Find which visible column this track is in
        const visibleIndex = visibleTrackIndices.indexOf(note.track);
        if (visibleIndex === -1) return;

        const pitchRange = trackPitchRanges[note.track];
        const trackX = visibleIndex * trackWidth + padding / 2;
        const noteAreaWidth = trackWidth - padding;

        const pitchNormalized = (note.midi - pitchRange.min) / (pitchRange.max - pitchRange.min);
        const noteX = trackX + pitchNormalized * noteAreaWidth;
        const noteY = playheadY - (noteStart - midiTime) * pixelsPerSecond;
        const noteHeight = Math.max(note.duration * pixelsPerSecond, 4);
        const isActive = midiTime >= noteStart && midiTime < noteEnd;
        const noteWidth = Math.max(8, noteAreaWidth / 20);

        // Get adornments for this note
        const noteAdornments = getAdornmentsForNote(note);
        let hasPunch = false, hasGlow = false, hasSpark = false, hasAccent = false;
        let hasWavy = false, hasTremolo = false, hasStar = false, hasDiamond = false;
        let hasFootball = false, hasArrow = false;
        noteAdornments.forEach((ad) => {
          if (ad.type === 'punch') hasPunch = true;
          if (ad.type === 'glow') hasGlow = true;
          if (ad.type === 'spark') hasSpark = true;
          if (ad.type === 'accent') hasAccent = true;
          if (ad.type === 'wavy') hasWavy = true;
          if (ad.type === 'tremolo') hasTremolo = true;
          if (ad.type === 'star') hasStar = true;
          if (ad.type === 'diamond') hasDiamond = true;
          if (ad.type === 'football') hasFootball = true;
          if (ad.type === 'arrow') hasArrow = true;
        });

        // GLOW effect
        if (hasGlow) {
          ctx.shadowColor = track.color;
          ctx.shadowBlur = 25;
        } else if (isActive) {
          ctx.shadowColor = track.color;
          ctx.shadowBlur = 20;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isActive ? '#ffffff' : track.color;
        ctx.globalAlpha = isActive ? 1 : 0.7;

        // Draw note shape based on adornment
        if (hasWavy) {
          ctx.beginPath();
          const amplitude = noteWidth * 0.3;
          const freq = 0.2;
          ctx.moveTo(noteX - noteWidth / 2, noteY);
          for (let py = 0; py <= noteHeight; py += 2) {
            const waveX = noteX + Math.sin((py + midiTime * 50) * freq) * amplitude;
            ctx.lineTo(waveX - noteWidth / 2, noteY - py);
          }
          for (let py = noteHeight; py >= 0; py -= 2) {
            const waveX = noteX + Math.sin((py + midiTime * 50) * freq) * amplitude;
            ctx.lineTo(waveX + noteWidth / 2, noteY - py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (hasTremolo) {
          const layers = 3;
          for (let i = 0; i < layers; i++) {
            const offset = Math.sin(midiTime * 30 + i * 2) * 3;
            ctx.globalAlpha = 0.4 + (i * 0.2);
            ctx.beginPath();
            ctx.roundRect(noteX - noteWidth / 2 + offset, noteY - noteHeight - i * 2, noteWidth, noteHeight, 3);
            ctx.fill();
          }
          ctx.globalAlpha = isActive ? 1 : 0.7;
        } else if (hasStar) {
          // STAR effect - 5-pointed star
          ctx.beginPath();
          const cx = noteX;
          const cy = noteY - noteHeight / 2;
          const outerR = noteWidth * 0.8;
          const innerR = noteWidth * 0.4;
          const points = 5;
          for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (hasDiamond) {
          // DIAMOND effect - rotated square
          ctx.beginPath();
          const cx = noteX;
          const cy = noteY - noteHeight / 2;
          const size = noteWidth * 0.7;
          ctx.moveTo(cx, cy - size);
          ctx.lineTo(cx + size, cy);
          ctx.lineTo(cx, cy + size);
          ctx.lineTo(cx - size, cy);
          ctx.closePath();
          ctx.fill();
        } else if (hasFootball) {
          // FOOTBALL effect - ellipse
          ctx.beginPath();
          ctx.ellipse(noteX, noteY - noteHeight / 2, noteWidth * 0.8, noteHeight / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(noteX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight, 3);
          ctx.fill();
        }

        // PUNCH effect - bold outline
        if (hasPunch) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(noteX - noteWidth / 2 - 2, noteY - noteHeight - 2, noteWidth + 4, noteHeight + 4, 4);
          ctx.stroke();
        }

        // ACCENT effect - triangle marker
        if (hasAccent) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          const triSize = noteWidth * 0.8;
          ctx.moveTo(noteX, noteY - noteHeight - triSize - 4);
          ctx.lineTo(noteX - triSize / 2, noteY - noteHeight - 4);
          ctx.lineTo(noteX + triSize / 2, noteY - noteHeight - 4);
          ctx.closePath();
          ctx.fill();
        }

        // SPARK effect - radiating lines when active
        if (hasSpark && isActive) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          const rays = 6;
          const innerR = noteWidth;
          const outerR = noteWidth * 2;
          for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + midiTime * 4;
            ctx.beginPath();
            ctx.moveTo(noteX + Math.cos(angle) * innerR, noteY - noteHeight / 2 + Math.sin(angle) * innerR);
            ctx.lineTo(noteX + Math.cos(angle) * outerR, noteY - noteHeight / 2 + Math.sin(angle) * outerR);
            ctx.stroke();
          }
        }

        // ARROW effect - directional arrow
        if (hasArrow) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          const arrowSize = noteWidth * 0.6;
          ctx.moveTo(noteX, noteY - noteHeight - arrowSize - 4);
          ctx.lineTo(noteX - arrowSize / 2, noteY - noteHeight - 4);
          ctx.lineTo(noteX + arrowSize / 2, noteY - noteHeight - 4);
          ctx.closePath();
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      });

    } else {
      // FULL MODE: All tracks merged on one horizontal scale
      const visibleNotes = notes.filter((n) => isTrackVisible(n.track));
      if (visibleNotes.length === 0) {
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        return;
      }

      // Get global pitch range across all visible notes
      const allPitches = visibleNotes.map((n) => n.midi);
      const globalPitchRange = {
        min: Math.min(...allPitches) - 2,
        max: Math.max(...allPitches) + 2,
      };

      // Draw pitch labels on sides
      ctx.fillStyle = '#444';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Low (${globalPitchRange.min})`, 5, canvas.height - 25);
      ctx.textAlign = 'right';
      ctx.fillText(`High (${globalPitchRange.max})`, canvas.width - 5, canvas.height - 25);

      // Draw track legend at bottom
      let legendX = padding;
      tracks.forEach((track, i) => {
        if (!isTrackVisible(i)) return;
        ctx.fillStyle = track.color;
        ctx.fillRect(legendX, canvas.height - 15, 10, 10);
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(track.name, legendX + 14, canvas.height - 6);
        legendX += ctx.measureText(track.name).width + 30;
      });

      // Draw notes across full width with adornment effects
      const noteAreaWidth = canvas.width - padding * 2;

      visibleNotes.forEach((note) => {
        const noteStart = note.time;
        const noteEnd = note.time + note.duration;
        if (noteEnd < timeWindowStart || noteStart > timeWindowEnd) return;

        const track = tracks[note.track];
        if (!track) return;

        const pitchNormalized = (note.midi - globalPitchRange.min) / (globalPitchRange.max - globalPitchRange.min);
        const noteX = padding + pitchNormalized * noteAreaWidth;
        const noteY = playheadY - (noteStart - midiTime) * pixelsPerSecond;
        const noteHeight = Math.max(note.duration * pixelsPerSecond, 4);
        const isActive = midiTime >= noteStart && midiTime < noteEnd;
        const noteWidth = Math.max(6, 12);

        // Get adornments for this note
        const noteAdornments = getAdornmentsForNote(note);
        let hasPunch = false, hasGlow = false, hasSpark = false, hasAccent = false;
        let hasWavy = false, hasTremolo = false, hasStar = false, hasDiamond = false;
        let hasFootball = false, hasArrow = false;
        noteAdornments.forEach((ad) => {
          if (ad.type === 'punch') hasPunch = true;
          if (ad.type === 'glow') hasGlow = true;
          if (ad.type === 'spark') hasSpark = true;
          if (ad.type === 'accent') hasAccent = true;
          if (ad.type === 'wavy') hasWavy = true;
          if (ad.type === 'tremolo') hasTremolo = true;
          if (ad.type === 'star') hasStar = true;
          if (ad.type === 'diamond') hasDiamond = true;
          if (ad.type === 'football') hasFootball = true;
          if (ad.type === 'arrow') hasArrow = true;
        });

        // GLOW effect
        if (hasGlow) {
          ctx.shadowColor = track.color;
          ctx.shadowBlur = 25;
        } else if (isActive) {
          ctx.shadowColor = track.color;
          ctx.shadowBlur = 20;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = isActive ? '#ffffff' : track.color;
        ctx.globalAlpha = isActive ? 1 : 0.8;

        // Draw note shape based on adornment
        if (hasWavy) {
          ctx.beginPath();
          const amplitude = noteWidth * 0.4;
          const freq = 0.2;
          ctx.moveTo(noteX - noteWidth / 2, noteY);
          for (let py = 0; py <= noteHeight; py += 2) {
            const waveX = noteX + Math.sin((py + midiTime * 50) * freq) * amplitude;
            ctx.lineTo(waveX - noteWidth / 2, noteY - py);
          }
          for (let py = noteHeight; py >= 0; py -= 2) {
            const waveX = noteX + Math.sin((py + midiTime * 50) * freq) * amplitude;
            ctx.lineTo(waveX + noteWidth / 2, noteY - py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (hasTremolo) {
          const layers = 3;
          for (let i = 0; i < layers; i++) {
            const offset = Math.sin(midiTime * 30 + i * 2) * 3;
            ctx.globalAlpha = 0.4 + (i * 0.2);
            ctx.beginPath();
            ctx.roundRect(noteX - noteWidth / 2 + offset, noteY - noteHeight - i * 2, noteWidth, noteHeight, 3);
            ctx.fill();
          }
          ctx.globalAlpha = isActive ? 1 : 0.8;
        } else if (hasStar) {
          ctx.beginPath();
          const cx = noteX;
          const cy = noteY - noteHeight / 2;
          const outerR = noteWidth * 0.8;
          const innerR = noteWidth * 0.4;
          const points = 5;
          for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const px = cx + r * Math.cos(angle);
            const py = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (hasDiamond) {
          ctx.beginPath();
          const cx = noteX;
          const cy = noteY - noteHeight / 2;
          const size = noteWidth * 0.7;
          ctx.moveTo(cx, cy - size);
          ctx.lineTo(cx + size, cy);
          ctx.lineTo(cx, cy + size);
          ctx.lineTo(cx - size, cy);
          ctx.closePath();
          ctx.fill();
        } else if (hasFootball) {
          ctx.beginPath();
          ctx.ellipse(noteX, noteY - noteHeight / 2, noteWidth * 0.8, noteHeight / 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(noteX - noteWidth / 2, noteY - noteHeight, noteWidth, noteHeight, 3);
          ctx.fill();
        }

        // PUNCH effect
        if (hasPunch) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(noteX - noteWidth / 2 - 2, noteY - noteHeight - 2, noteWidth + 4, noteHeight + 4, 4);
          ctx.stroke();
        }

        // ACCENT effect
        if (hasAccent) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          const triSize = noteWidth * 0.8;
          ctx.moveTo(noteX, noteY - noteHeight - triSize - 4);
          ctx.lineTo(noteX - triSize / 2, noteY - noteHeight - 4);
          ctx.lineTo(noteX + triSize / 2, noteY - noteHeight - 4);
          ctx.closePath();
          ctx.fill();
        }

        // SPARK effect
        if (hasSpark && isActive) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          const rays = 6;
          const innerR = noteWidth;
          const outerR = noteWidth * 2;
          for (let i = 0; i < rays; i++) {
            const angle = (i / rays) * Math.PI * 2 + midiTime * 4;
            ctx.beginPath();
            ctx.moveTo(noteX + Math.cos(angle) * innerR, noteY - noteHeight / 2 + Math.sin(angle) * innerR);
            ctx.lineTo(noteX + Math.cos(angle) * outerR, noteY - noteHeight / 2 + Math.sin(angle) * outerR);
            ctx.stroke();
          }
        }

        // ARROW effect
        if (hasArrow) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          const arrowSize = noteWidth * 0.6;
          ctx.moveTo(noteX, noteY - noteHeight - arrowSize - 4);
          ctx.lineTo(noteX - arrowSize / 2, noteY - noteHeight - 4);
          ctx.lineTo(noteX + arrowSize / 2, noteY - noteHeight - 4);
          ctx.closePath();
          ctx.fill();
        }

        ctx.shadowBlur = 0;
      });
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // PHRASE effect - horizontal bracket overlay
    adornments
      .filter((ad) => ad.type === 'phrase')
      .forEach((ad) => {
        const startY = playheadY - (ad.startTime - midiTime) * pixelsPerSecond;
        const endY = playheadY - (ad.endTime - midiTime) * pixelsPerSecond;
        if (endY > canvas.height || startY < 0) return;

        ctx.strokeStyle = '#A855F7';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(20, startY);
        ctx.lineTo(10, startY);
        ctx.lineTo(10, endY);
        ctx.lineTo(20, endY);
        ctx.stroke();

        if (ad.label) {
          ctx.fillStyle = '#A855F7';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.save();
          ctx.translate(5, (startY + endY) / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(ad.label, 0, 0);
          ctx.restore();
        }
        ctx.setLineDash([]);
      });

    // LEGATO effect - curved slur on right side
    adornments
      .filter((ad) => ad.type === 'legato')
      .forEach((ad) => {
        const startY = playheadY - (ad.startTime - midiTime) * pixelsPerSecond;
        const endY = playheadY - (ad.endTime - midiTime) * pixelsPerSecond;
        if (endY > canvas.height || startY < 0) return;

        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const midY = (startY + endY) / 2;
        const curveX = 20;
        ctx.moveTo(canvas.width - 15, startY);
        ctx.quadraticCurveTo(canvas.width - 15 + curveX, midY, canvas.width - 15, endY);
        ctx.stroke();
      });

    // CRESCENDO effect - growing wedge on left side (vertical for cinema)
    adornments
      .filter((ad) => ad.type === 'crescendo')
      .forEach((ad) => {
        const startY = playheadY - (ad.startTime - midiTime) * pixelsPerSecond;
        const endY = playheadY - (ad.endTime - midiTime) * pixelsPerSecond;
        if (endY > canvas.height || startY < 0) return;

        ctx.strokeStyle = '#F97316'; // Orange
        ctx.lineWidth = 2;
        ctx.beginPath();
        const wedgeWidth = 10;
        ctx.moveTo(30, startY);                    // point at start
        ctx.lineTo(30 - wedgeWidth, endY);         // left at end
        ctx.moveTo(30, startY);                    // point at start again
        ctx.lineTo(30 + wedgeWidth, endY);         // right at end
        ctx.stroke();
      });

    // DECRESCENDO effect - shrinking wedge on left side (vertical for cinema)
    adornments
      .filter((ad) => ad.type === 'decrescendo')
      .forEach((ad) => {
        const startY = playheadY - (ad.startTime - midiTime) * pixelsPerSecond;
        const endY = playheadY - (ad.endTime - midiTime) * pixelsPerSecond;
        if (endY > canvas.height || startY < 0) return;

        ctx.strokeStyle = '#F97316'; // Orange
        ctx.lineWidth = 2;
        ctx.beginPath();
        const wedgeWidth = 10;
        ctx.moveTo(30 - wedgeWidth, startY);       // left at start
        ctx.lineTo(30, endY);                      // point at end
        ctx.moveTo(30 + wedgeWidth, startY);       // right at start
        ctx.lineTo(30, endY);                      // point at end
        ctx.stroke();
      });

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

    // Watermark (for video export)
    if (showWatermark) {
      ctx.globalAlpha = 0.7;

      // Main watermark - bottom right
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('VisualTango.com', canvas.width - 15, 30);

      // Secondary text
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Become a TangoTiempo.com organizer', canvas.width - 15, 48);

      // Song title
      if (config?.title) {
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(config.title, 15, 30);
      }

      ctx.globalAlpha = 1;
    }

  }, [notes, tracks, audioTime, syncPoints, adornments, secondsVisible, isTrackVisible, viewMode, showWatermark, config, avOffset]);

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

  // Video recording functions
  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure watermark is shown during recording
    setShowWatermark(true);

    try {
      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000, // 5 Mbps for good quality
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${songId}-visualtango.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
      };

      mediaRecorder.start(100); // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Auto-start playback when recording starts
      if (howlRef.current && !isPlaying) {
        howlRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Recording not supported in this browser. Try Chrome or Firefox.');
    }
  }, [songId, isPlaying]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Also pause playback
    if (howlRef.current) {
      howlRef.current.pause();
      setIsPlaying(false);
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
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex bg-white/10 rounded overflow-hidden">
                  <button
                    onClick={() => setViewMode('bands')}
                    className={`px-3 py-1 text-sm ${
                      viewMode === 'bands'
                        ? 'bg-blue-600 text-white'
                        : 'text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Bands
                  </button>
                  <button
                    onClick={() => setViewMode('full')}
                    className={`px-3 py-1 text-sm ${
                      viewMode === 'full'
                        ? 'bg-blue-600 text-white'
                        : 'text-white/70 hover:bg-white/20'
                    }`}
                  >
                    Full
                  </button>
                </div>
                <button
                  onClick={() => setShowTrackPanel((prev) => !prev)}
                  className={`px-3 py-1 rounded text-white text-sm ${
                    showTrackPanel ? 'bg-purple-600' : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  Tracks
                </button>
                {/* Record Button */}
                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm flex items-center gap-1 animate-pulse"
                  >
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    Stop Recording
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="px-3 py-1 bg-red-600/80 hover:bg-red-600 rounded text-white text-sm flex items-center gap-1"
                  >
                    <span className="w-2 h-2 bg-white rounded-full"></span>
                    Record
                  </button>
                )}
                <button
                  onClick={() => setShowWatermark((prev) => !prev)}
                  className={`px-3 py-1 rounded text-white text-sm ${
                    showWatermark ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  Watermark
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

                <div className="flex items-center gap-6">
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
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-sm">A/V Sync:</span>
                    <button
                      onClick={() => setAvOffset((o) => o - 25)}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm"
                      title="Visual earlier (if notes appear late)"
                    >
                      ←
                    </button>
                    <span className={`text-sm w-16 text-center ${avOffset === 0 ? 'text-white' : avOffset < 0 ? 'text-green-400' : 'text-amber-400'}`}>
                      {avOffset > 0 ? '+' : ''}{avOffset}ms
                    </span>
                    <button
                      onClick={() => setAvOffset((o) => o + 25)}
                      className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-white text-sm"
                      title="Visual later (if notes appear early)"
                    >
                      →
                    </button>
                    <button
                      onClick={() => setAvOffset(0)}
                      className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/50 text-xs"
                    >
                      Reset
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
