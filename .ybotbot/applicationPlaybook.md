# VisualTango.com - Detailed Application Playbook

## Project Overview

**App Name**: VisualTango
**Domain**: visualtango.com
**GitHub**: https://github.com/ybotman/visualtango.com.git
**Created**: December 2025
**Last Updated**: 2025-12-19

### Inspiration
Stephen Malinowski's Music Animation Machine (https://twitter.com/musanim) - visual representations of classical music that make the structure visible.

### Purpose
Create animated visual music scores synced to 1930s Argentine tango recordings. The target audience is tango enthusiasts who want to see and understand the musical structure - the interplay between bandoneon, strings, piano, and vocals.

---

## Technical Architecture

### The Sync Problem

**Challenge**: MIDI from sheet music has perfect timing. Real recordings don't.

- Sheet music MIDI: Quantized, perfect 120 BPM
- 1930s recordings: Rubato, tempo changes, human expression

**Solution**: Sync point interpolation
1. User manually places sync markers (MIDI time ↔ Audio time)
2. During playback, linear interpolation converts between time domains
3. Visualization stays synced to audio despite tempo variations

### Core Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  MIDI File  │────▶│   Parser    │────▶│   Notes[]   │
│  (.mid)     │     │ @tonejs/midi│     │ + Tracks[]  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
┌─────────────┐     ┌─────────────┐            │
│ Audio File  │────▶│  Playback   │            │
│  (.mp3)     │     │  Howler.js  │            │
└─────────────┘     └─────────────┘            │
       │                   │                   │
       │                   ▼                   ▼
       │            ┌─────────────┐     ┌─────────────┐
       │            │ Sync Points │◀───▶│   Canvas    │
       │            │ Interpolate │     │ Visualization│
       │            └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│ config.json │◀───▶│   Editor    │
│ (saved)     │     │   Page      │
└─────────────┘     └─────────────┘
```

---

## Project File Structure

```
visualtango.com/
├── .claude/settings.local.json    # Claude permissions
├── .ybotbot/applicationPlaybook.md # This file - detailed docs
├── CLAUDE.md                       # Quick reference (points here)
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
│   │   ├── play/[songId]/cinema/page.tsx  # Cinema mode
│   │   ├── help/page.tsx          # Documentation
│   │   ├── about/page.tsx
│   │   └── payment/page.tsx
│   │   └── api/
│   │       └── songs/
│   │           ├── route.ts       # GET /api/songs
│   │           └── [songId]/config/route.ts  # GET/POST config
│   ├── components/
│   │   └── Navigation.tsx
│   └── lib/
│       ├── types.ts               # Shared interfaces
│       ├── sync.ts                # Time interpolation
│       ├── midi.ts                # MIDI loading
│       └── storage.ts             # Config load/save
└── package.json
```

## Song File Storage

Songs are stored in `public/songs/{songId}/`:

```
public/songs/
├── bach_846/
│   ├── bach_846.mid      # MIDI from sheet music
│   ├── bach_846.mp3      # Audio recording
│   └── config.json       # Sync points + adornments + track settings
├── la-yumba-osvaldo-pugliese/
│   ├── la-yumba-osvaldo-pugliese.mid
│   ├── la-yumba-osvaldo-pugliese.mp3
│   └── config.json
└── ...
```

### config.json Structure

```json
{
  "id": "bach_846",
  "title": "Bach BWV 846 - Prelude in C Major",
  "midiFile": "bach_846.mid",
  "audioFile": "bach_846.mp3",
  "syncPoints": [
    { "id": "sp1", "midiTime": 0, "audioTime": 0.5, "label": "Start" },
    { "id": "sp2", "midiTime": 8.0, "audioTime": 8.2, "label": "M8" },
    { "id": "sp3", "midiTime": 16.0, "audioTime": 15.8, "label": "M16" }
  ],
  "tracks": [
    { "name": "Piano RH", "noteCount": 543, "color": "#3B82F6", "instrument": "piano", "visible": true, "muted": false, "solo": false },
    { "name": "Piano LH", "noteCount": 128, "color": "#10B981", "instrument": "piano", "visible": true, "muted": false, "solo": false }
  ],
  "adornments": [
    { "id": "ad1", "type": "wavy", "scope": "section", "startTime": 4.0, "endTime": 8.0, "label": "Run" },
    { "id": "ad2", "type": "glow", "scope": "track", "trackIndex": 0, "startTime": 0, "endTime": 120, "label": "Melody highlight" }
  ],
  "createdAt": "2025-12-18T00:00:00Z",
  "updatedAt": "2025-12-18T00:00:00Z"
}
```

---

## Page Specifications

### 1. Catalog Page (/)

**Purpose**: Song browser with status indicators

**Features**:
- Dynamic list from `public/songs/` directories
- Status columns: MIDI exists, Audio exists, Config exists
- Sync point count display
- Edit button → `/editor/{songId}`
- Play button → `/play/{songId}`

**API**: `GET /api/songs` returns `SongStatus[]`

### 2. Editor Page (/editor/[songId])

**Purpose**: Create sync points and adornments

**Layout**:
```
┌────────────────────────────────────────────────────┐
│  [Back to Catalog]              [Save] [Export]    │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │        WaveSurfer Waveform                   │  │
│  │   Click to mark audio time                   │  │
│  │   [▶] 0:00 / 3:45                           │  │
│  └──────────────────────────────────────────────┘  │
│  Audio marker: 8.234s                              │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │        Canvas Piano Roll                     │  │
│  │   Click to mark MIDI time                    │  │
│  │   Shift+click to select notes for adornment │  │
│  └──────────────────────────────────────────────┘  │
│  MIDI marker: M8 (8.0s)                           │
├────────────────────────────────────────────────────┤
│  [Link Selected Points]                            │
│                                                    │
│  Sync Points:                                      │
│  ┌────────────────────────────────────────────┐   │
│  │ M1 → 0:00.50  [Jump] [Remove]              │   │
│  │ M8 → 0:08.23  [Jump] [Remove]              │   │
│  └────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│  Adornments:                                       │
│  Scope: [Track ▼] or [Section]                    │
│  Type: [wavy] [spark] [punch] [glow] [phrase]     │
│        [accent] [tremolo] [legato]                │
│  Track: [Piano RH ▼]                              │
│  [Add Adornment]                                  │
├────────────────────────────────────────────────────┤
│  Track Legend:                                     │
│  ■ Piano RH (543 notes)                           │
│  ■ Piano LH (128 notes)                           │
└────────────────────────────────────────────────────┘
```

**Interactions**:
1. Click waveform → sets audio marker time
2. Click piano roll → sets MIDI marker time
3. "Link" → creates sync point from both markers
4. Shift+click notes → selects for section adornment
5. Save → writes to `public/songs/{songId}/config.json`

### 3. Play Page (/play/[songId])

**Purpose**: Playback with synced visualization

**Layout**:
```
┌────────────────────────────────────────────────────┐
│  [Back to Catalog]     Mode: [Audio ▼] [MIDI]     │
├────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────┐  │
│  │                                              │  │
│  │          Canvas Visualization                │  │
│  │      (Piano roll with playhead)             │  │
│  │      (Sync point markers in green)          │  │
│  │      (Notes glow when active)               │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────┤
│  [▶ Play]  ═══════════════●═══════  1:23 / 3:45   │
├────────────────────────────────────────────────────┤
│  Track Controls (MIDI mode only):                  │
│  ┌────────────────────────────────────────────┐   │
│  │ ■ Piano RH   [Mute] [Solo]                 │   │
│  │ ■ Piano LH   [Mute] [Solo]                 │   │
│  └────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│  Settings: Zoom [●────] 150 px/sec                │
│            Note Height [──●──] 6px                │
│  [Cinema Mode]                                     │
└────────────────────────────────────────────────────┘
```

**Modes**:
- **Audio mode**: Howler.js plays MP3, Canvas shows MIDI visualization synced via `audioToMidiTime()`
- **MIDI mode**: Tone.js synthesizes MIDI, Solo/Mute per track available

### 4. Cinema Mode (/play/[songId]/cinema)

**Purpose**: Full-screen vertical visualization for presentations/recordings

**Features**:
- Notes scroll top-to-bottom (like movie credits)
- **View modes**: Bands (instruments in separate columns) or Full (merged view)
- **A/V Sync Offset**: Adjustable offset (±ms) to compensate for audio/video latency
- **Video Recording**: Record canvas to WebM for export
- **Watermark**: Optional "VisualTango.com" watermark overlay
- **Fullscreen**: Native fullscreen support
- Track solo/mute panel

**Keyboard Shortcuts**:
- `Space` - Play/Pause
- `←/→` - Seek 5 seconds
- `H` - Hide/show controls
- `Esc` - Exit fullscreen/cinema

### 5. Help Page (/help)

**Purpose**: User documentation for adding songs and using the editor

**Content**:
- File structure requirements (folder naming, file naming)
- Step-by-step song addition guide with terminal commands
- Editor usage: creating sync points, navigation controls
- Play mode descriptions
- Troubleshooting common issues

### 6. About Page (/about)
Placeholder for project info, credits, links.

### 7. Payment Page (/payment)
Placeholder for subscription tiers (future).

---

## Adornment Types

| Type | Purpose | Visual Effect (future) |
|------|---------|----------------------|
| wavy | Melodic runs | Sine wave path |
| spark | Syncopation | Star burst |
| punch | Strong accents | Bold pulse |
| glow | Sustained notes | Halo effect |
| phrase | Section markers | Bracket overlay |
| accent | Single note emphasis | Highlight |
| tremolo | Rapid repetition | Vibration |
| legato | Smooth connection | Curved lines |

**Scopes**:
- `track`: Applies to entire track (e.g., highlight melody throughout)
- `section`: Applies to time range (e.g., highlight a specific run)

---

## API Routes

### GET /api/songs
Returns list of all songs with status.

```typescript
interface SongStatus {
  id: string;
  title: string;
  hasMidi: boolean;
  hasAudio: boolean;
  hasConfig: boolean;
  syncPointCount: number;
  adornmentCount: number;
}
```

### GET /api/songs/[songId]/config
Returns config.json contents or empty config template.

### POST /api/songs/[songId]/config
Saves config.json to `public/songs/{songId}/`.

---

## Role-Based Access (Future)

| Role | Catalog | Play | Editor | Admin |
|------|---------|------|--------|-------|
| Guest | View (limited) | No | No | No |
| Free | View | Basic | No | No |
| Subscriber | View | Full | No | No |
| Editor | View | Full | Yes | No |
| Admin | View | Full | Yes | Yes |

Currently: All users have Editor access.

---

## Development Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm start        # Run production build
```

---

## POC Heritage

This app evolved from `/visualMusic/POC/tech-tests/` which tested:
- @tonejs/midi ✓ (excellent MIDI parsing)
- Howler.js ✓ (simple audio playback)
- Tone.js ✓ (MIDI synthesis)
- PixiJS ✗ (user preferred Canvas)
- Canvas 2D ✓ (chosen for visualization)
- WaveSurfer.js ✓ (waveform + regions)

Key code patterns migrated:
- Sync interpolation (`audioToMidiTime`, `midiToAudioTime`)
- Canvas piano roll rendering
- Track Solo/Mute logic
- WaveSurfer + Regions integration

---

## Session Startup

When Claude starts in this folder:
1. Read this playbook for full context
2. Check `public/songs/` for available test data
3. Run `npm run dev` if needed
4. Continue implementation or answer questions

---

## Implementation Status

- [x] Project scaffolding (Next.js 16 + TypeScript + Tailwind)
- [x] Dependencies installed (@tonejs/midi, howler, tone, wavesurfer.js)
- [x] Configuration files (.claude/, .ybotbot/, CLAUDE.md)
- [x] src/lib/types.ts - Core interfaces
- [x] src/lib/sync.ts - Interpolation functions
- [x] src/lib/midi.ts - MIDI loading
- [x] src/lib/storage.ts - Config load/save
- [x] Navigation component
- [x] Catalog page (/)
- [x] API routes (/api/songs, /api/songs/[songId]/config)
- [x] Editor page (/editor/[songId]) - Sync points, draggable markers
- [x] Play page (/play/[songId])
- [x] Cinema mode (/play/[songId]/cinema) - Video recording, watermarks, A/V offset
- [x] Help page (/help)
- [x] About page (placeholder)
- [x] Payment page (placeholder)
- [x] Sample song files in public/songs/
- [x] Git remote + first push
- [x] Read-only production check with contact info
- [ ] Visual adornment rendering in Canvas
- [ ] Firebase Auth for user roles
- [ ] Azure API for cloud storage
