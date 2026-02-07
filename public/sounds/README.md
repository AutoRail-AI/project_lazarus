# Audio Assets

Sound effects for the Glass Brain Dashboard theatrical experience.  
**Reference:** `docs/IMPLEMENTATION.md` Phase 9.2

## Required Files

| File | Purpose | Specs |
|------|---------|-------|
| `keystroke.mp3` | Ghost Typer typing effect | Short click, ~50ms |
| `success.mp3` | Test pass / slice complete | Pleasant chime, ~300ms |
| `error.mp3` | Test failure | Low buzz/glitch, ~200ms |
| `heal.mp3` | Self-heal trigger | Ethereal whoosh, ~400ms |
| `confidence-tick.mp3` | Confidence gauge increment | Subtle tick, ~100ms |
| `boot-up.mp3` | Neural Handshake start | Sci-fi power-on, ~1s |

## Implementation

- **Hook:** `hooks/use-sound-effects.tsx` — centralized sound playback
- **Config:** `lib/sounds/constants.ts` — URLs and volume levels
- **Fallback:** `lib/sounds/procedural.ts` — Web Audio API procedural sounds when files are missing

When MP3 files are **not** present, the app uses procedural audio (no external files required).  
When MP3 files **are** added, pass `useFiles: true` to `useSoundEffects()` to use them.

## Obtaining Audio

Use royalty-free sound effects from:
- [Freesound.org](https://freesound.org)
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [ZapSplat](https://www.zapsplat.com)

Or generate procedurally at runtime (already implemented as fallback).
