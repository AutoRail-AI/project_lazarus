/**
 * Sound effect configuration for Project Lazarus.
 * Reference: docs/IMPLEMENTATION.md Phase 9.2
 *
 * Audio files should be placed in public/sounds/.
 * When files are missing, the useSoundEffects hook falls back to procedural audio.
 */

export const SOUND_KEYS = {
  KEYSTROKE: "keystroke",
  SUCCESS: "success",
  ERROR: "error",
  HEAL: "heal",
  CONFIDENCE_TICK: "confidence-tick",
  BOOT_UP: "boot-up",
} as const

export type SoundKey = (typeof SOUND_KEYS)[keyof typeof SOUND_KEYS]

/** Base path for sound assets (relative to public) */
const SOUNDS_BASE = "/sounds"

export const SOUND_URLS: Record<SoundKey, string> = {
  [SOUND_KEYS.KEYSTROKE]: `${SOUNDS_BASE}/keystroke.mp3`,
  [SOUND_KEYS.SUCCESS]: `${SOUNDS_BASE}/success.mp3`,
  [SOUND_KEYS.ERROR]: `${SOUNDS_BASE}/error.mp3`,
  [SOUND_KEYS.HEAL]: `${SOUNDS_BASE}/heal.mp3`,
  [SOUND_KEYS.CONFIDENCE_TICK]: `${SOUNDS_BASE}/confidence-tick.mp3`,
  [SOUND_KEYS.BOOT_UP]: `${SOUNDS_BASE}/boot-up.mp3`,
}

/** Volume levels (0–1) per sound for balanced mix */
export const SOUND_VOLUMES: Record<SoundKey, number> = {
  [SOUND_KEYS.KEYSTROKE]: 0.3,
  [SOUND_KEYS.SUCCESS]: 0.5,
  [SOUND_KEYS.ERROR]: 0.5,
  [SOUND_KEYS.HEAL]: 0.6,
  [SOUND_KEYS.CONFIDENCE_TICK]: 0.25,
  [SOUND_KEYS.BOOT_UP]: 0.6,
}
