/**
 * Procedural audio generation using Web Audio API.
 * Fallback when MP3 files are not available.
 * Reference: docs/IMPLEMENTATION.md Phase 9.2
 */

import { SOUND_KEYS, type SoundKey } from "./constants"

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioContext
}

function playTone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine"
): void {
  const ctx = getAudioContext()
  if (!ctx) return

  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = type
    osc.frequency.value = frequency
    gain.gain.value = volume

    osc.connect(gain)
    gain.connect(ctx.destination)

    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Silently fail if audio fails (e.g., autoplay policy)
  }
}

/**
 * Play a procedural sound for the given key.
 * Used as fallback when MP3 files are missing.
 */
export function playProceduralSound(key: SoundKey): void {
  const ctx = getAudioContext()
  if (!ctx) return

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {})
  }

  switch (key) {
    case SOUND_KEYS.KEYSTROKE:
      playTone(1200, 0.03, 0.15, "square")
      break
    case SOUND_KEYS.SUCCESS:
      playTone(880, 0.08, 0.3, "sine")
      setTimeout(() => playTone(1100, 0.1, 0.25, "sine"), 80)
      setTimeout(() => playTone(1320, 0.15, 0.2, "sine"), 180)
      break
    case SOUND_KEYS.ERROR:
      playTone(200, 0.1, 0.4, "sawtooth")
      setTimeout(() => playTone(150, 0.15, 0.3, "sawtooth"), 80)
      break
    case SOUND_KEYS.HEAL:
      playTone(600, 0.1, 0.2, "sine")
      setTimeout(() => playTone(800, 0.12, 0.25, "sine"), 100)
      setTimeout(() => playTone(1000, 0.15, 0.2, "sine"), 220)
      break
    case SOUND_KEYS.CONFIDENCE_TICK:
      playTone(1400, 0.02, 0.12, "sine")
      break
    case SOUND_KEYS.BOOT_UP:
      playTone(400, 0.15, 0.2, "sine")
      setTimeout(() => playTone(600, 0.2, 0.25, "sine"), 150)
      setTimeout(() => playTone(800, 0.25, 0.3, "sine"), 350)
      setTimeout(() => playTone(1000, 0.3, 0.25, "sine"), 600)
      break
    default:
      break
  }
}
