# VisualTango.com - Quick Reference

**Full documentation**: `.ybotbot/applicationPlaybook.md`

---

## What This App Does

Animated visual music scores synced to 1930s tango recordings. MIDI visualization that stays synced to audio via sync point interpolation.

---

## Tech Stack

- **Framework**: Next.js 16 + TypeScript + Tailwind CSS 4
- **MIDI**: @tonejs/midi (parsing), Tone.js (synthesis)
- **Audio**: Howler.js (playback), WaveSurfer.js (waveform)
- **Visualization**: Canvas 2D

---

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

---

## Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Catalog - song list with status |
| `/editor/[songId]` | Sync point editor with waveform + piano roll |
| `/play/[songId]` | Standard playback with horizontal piano roll |
| `/play/[songId]/cinema` | Cinema mode - vertical scroll, video recording |
| `/help` | User documentation |

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/lib/types.ts` | Core interfaces (Note, Track, SyncPoint, SongConfig) |
| `src/lib/sync.ts` | `audioToMidiTime()` / `midiToAudioTime()` interpolation |
| `public/songs/{songId}/` | Song data (MIDI, audio, config.json) |

---

## The Sync Problem

MIDI has perfect timing. Real recordings have human timing.

**Solution**: Sync points map MIDI time ↔ Audio time, with linear interpolation between points.

```typescript
// Core function in src/lib/sync.ts
audioToMidiTime(audioTime: number, syncPoints: SyncPoint[]): number
```

---

## Recent Features

- **Cinema Mode**: Vertical visualization with video recording, A/V offset, watermarks
- **Draggable Sync Points**: Adjust sync markers in the editor
- **Bands/Full View**: Toggle instrument columns in cinema mode
- **Read-only Production**: Prevents edits on production with contact info

---

## See Also

- `.ybotbot/applicationPlaybook.md` - Full architecture, page specs, API routes
- `/help` page - User-facing documentation
