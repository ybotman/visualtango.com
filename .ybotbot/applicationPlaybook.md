# VisualTango.com - Detailed Application Playbook

## Project Overview

**App Name**: VisualTango
**Domain**: visualtango.com
**GitHub**: https://github.com/ybotman/visualtango.com.git
**Created**: December 2025

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

## File Storage Structure

Songs are stored in `public/songs/{songId}/`:

```
public/songs/
├── bach_846/
│   ├── bach_846.mid      # MIDI from sheet music
│   ├── bach_846.mp3      # Audio recording
│   └── config.json       # Sync points + adornments + track settings
├── volver/
│   ├── volver.mid
│   ├── volver.mp3
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
└────────────────────────────────────────────────────┘
```

**Modes**:
- **Audio mode**: Howler.js plays MP3, Canvas shows MIDI visualization synced via `audioToMidiTime()`
- **MIDI mode**: Tone.js synthesizes MIDI, Solo/Mute per track available

### 4. About Page (/about)
Placeholder for project info, credits, links.

### 5. Payment Page (/payment)
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
- [ ] src/lib/types.ts - Core interfaces
- [ ] src/lib/sync.ts - Interpolation functions
- [ ] src/lib/midi.ts - MIDI loading
- [ ] src/lib/storage.ts - Config load/save
- [ ] Navigation component
- [ ] Catalog page (/)
- [ ] API routes (/api/songs)
- [ ] Editor page (/editor/[songId])
- [ ] Play page (/play/[songId])
- [ ] About page (placeholder)
- [ ] Payment page (placeholder)
- [ ] Sample song files in public/songs/
- [ ] Git remote + first push
