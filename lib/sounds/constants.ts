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

/**
 * Minimal silent MP3 data URI — prevents 404 requests when sound files don't exist.
 * use-sound always tries to preload the URL even when soundEnabled=false.
 *
 * This is the smallest valid MPEG audio frame (a single silent frame).
 * Uses audio/mpeg MIME type for maximum browser compatibility.
 */
const SILENT_MP3 =
  "data:audio/mpeg;base64,//uQxAAAAAADSAAAAAASEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//uQxBEAAADSAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"

export const SOUND_URLS: Record<SoundKey, string> = {
  [SOUND_KEYS.KEYSTROKE]: SILENT_MP3,
  [SOUND_KEYS.SUCCESS]: SILENT_MP3,
  [SOUND_KEYS.ERROR]: SILENT_MP3,
  [SOUND_KEYS.HEAL]: SILENT_MP3,
  [SOUND_KEYS.CONFIDENCE_TICK]: SILENT_MP3,
  [SOUND_KEYS.BOOT_UP]: SILENT_MP3,
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
