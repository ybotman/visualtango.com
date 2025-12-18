# VisualTango.com - Application Playbook

Generated on: 2025-12-18

**DOMAIN**: visualtango.com
**REPO**: https://github.com/ybotman/visualtango.com.git

---

## WHAT THIS APP DOES

VisualTango creates **animated visual music scores** synced to 1930s tango recordings. Think of Stephen Malinowski's Music Animation Machine, but for tango.

**The Core Challenge**:
- MIDI from sheet music has perfect, quantized timing (120 BPM exactly)
- Real recordings have human timing (rubato, tempo changes, expressive timing)
- We sync these two different time domains via **sync points** with linear interpolation

**How It Works**:
1. Load MIDI (from sheet music) + Audio (recording)
2. Editor: Place sync markers mapping MIDI measures to audio timestamps
3. Play: Audio plays normally, visualization adjusts via interpolation

---

## TECH STACK

| Component | Library | Purpose |
|-----------|---------|---------|
| Framework | Next.js 16 + TypeScript | App framework |
| Styling | Tailwind CSS 4 | UI styling |
| MIDI Parsing | @tonejs/midi | Parse MIDI to JSON |
| Audio Playback | Howler.js | Simple, precise seeking |
| MIDI Synthesis | Tone.js | Play MIDI through synth |
| Waveform | WaveSurfer.js | Waveform + sync markers |
| Visualization | Canvas 2D | Piano roll rendering |

---

## FILE STRUCTURE

```
visualtango.com/
├── .claude/settings.local.json    # Claude permissions
├── .ybotbot/applicationPlaybook.md # Detailed app docs
├── CLAUDE.md                       # This file
├── public/
│   └── songs/
│       └── {songId}/
│           ├── {songId}.mid       # MIDI file
│           ├── {songId}.mp3       # Audio file
│           └── config.json        # Sync points + adornments
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + nav
│   │   ├── page.tsx               # Catalog (song list)
│   │   ├── editor/[songId]/page.tsx
│   │   ├── play/[songId]/page.tsx
│   │   ├── about/page.tsx
│   │   └── payment/page.tsx
│   │   └── api/
│   │       └── songs/             # API routes
│   ├── components/
│   │   └── Navigation.tsx
│   └── lib/
│       ├── types.ts               # Shared interfaces
│       ├── sync.ts                # Time interpolation
│       ├── midi.ts                # MIDI loading
│       └── storage.ts             # Config load/save
└── package.json
```

---

## KEY TYPES (src/lib/types.ts)

```typescript
interface Note {
  name: string;      // "C4", "D#5"
  midi: number;      // 0-127
  time: number;      // Seconds in MIDI timeline
  duration: number;  // Seconds
  velocity: number;  // 0-1
  track: number;     // Track index
}

interface SyncPoint {
  id: string;
  midiTime: number;   // Position in MIDI
  audioTime: number;  // Position in audio
  label: string;
}

type AdornmentType = 'wavy' | 'spark' | 'punch' | 'glow' | 'phrase' | 'accent' | 'tremolo' | 'legato';

interface Adornment {
  id: string;
  type: AdornmentType;
  scope: 'track' | 'section';  // Instrument-level or time-range
  startTime: number;
  endTime: number;
  trackIndex?: number;
  label?: string;
}

interface SongConfig {
  id: string;
  title: string;
  midiFile: string;
  audioFile: string;
  syncPoints: SyncPoint[];
  tracks: Track[];
  adornments: Adornment[];
}
```

---

## SYNC INTERPOLATION ALGORITHM

```typescript
// Convert audio time to MIDI time for visualization
function audioToMidiTime(audioTime: number, syncPoints: SyncPoint[]): number {
  if (syncPoints.length === 0) return audioTime;
  const sorted = [...syncPoints].sort((a, b) => a.audioTime - b.audioTime);

  // Before first sync point
  if (audioTime <= sorted[0].audioTime) {
    const ratio = sorted[0].midiTime / sorted[0].audioTime;
    return audioTime * ratio;
  }

  // After last sync point
  if (audioTime >= sorted[sorted.length - 1].audioTime) {
    const last = sorted[sorted.length - 1];
    return last.midiTime + (audioTime - last.audioTime);
  }

  // Linear interpolation between points
  for (let i = 0; i < sorted.length - 1; i++) {
    const before = sorted[i];
    const after = sorted[i + 1];
    if (audioTime >= before.audioTime && audioTime < after.audioTime) {
      const audioRange = after.audioTime - before.audioTime;
      const midiRange = after.midiTime - before.midiTime;
      const progress = (audioTime - before.audioTime) / audioRange;
      return before.midiTime + progress * midiRange;
    }
  }
  return audioTime;
}
```

---

## PAGES

### Catalog (/)
- Lists all songs from `public/songs/` directories
- Shows status: has MIDI, has Audio, has Config, sync point count
- Edit and Play buttons per song

### Editor (/editor/[songId])
- WaveSurfer waveform - click to mark audio time
- Canvas piano roll - click to mark MIDI time
- Link points to create sync markers
- Adornment panel with 8 types + track/section scope
- Save to `public/songs/[songId]/config.json`

### Play (/play/[songId])
- Audio mode (Howler.js) or MIDI mode (Tone.js)
- Canvas visualization with sync interpolation
- Solo/Mute per track (MIDI mode)
- Sync point markers (green lines)

### About (/about)
- Placeholder for info/links

### Payment (/payment)
- Placeholder for subscription tiers

---

## COMMANDS

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

---

## STARTUP INSTRUCTIONS

When starting a new session:
1. Run `npm run dev` to start the dev server
2. Check `public/songs/` for available songs
3. Use Catalog to navigate to Editor or Play

---

## FUTURE (Not Yet Implemented)

- Firebase Auth for user roles (guest/free/subscriber/editor/admin)
- Azure API for cloud storage (replace file-based storage)
- Visual adornment rendering in Canvas
- Real-time collaboration
