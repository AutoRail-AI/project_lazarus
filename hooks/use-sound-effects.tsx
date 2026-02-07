"use client"

import { useCallback } from "react"
import useSound from "use-sound"
import {
  playProceduralSound,
  SOUND_KEYS,
  SOUND_URLS,
  SOUND_VOLUMES,
  type SoundKey,
} from "@/lib/sounds"

export type SoundEffectsOptions = {
  /** Use MP3 files when available; falls back to procedural when files are missing */
  useFiles?: boolean
  /** Global mute (e.g. from user preference or prefers-reduced-motion) */
  soundEnabled?: boolean
}

/**
 * Centralized sound effects hook for Project Lazarus.
 * Plays UI audio cues: keystroke, success, error, heal, confidence-tick, boot-up.
 *
 * When useFiles=true and MP3 files exist in public/sounds/, uses use-sound.
 * Otherwise uses procedural Web Audio API (no external files required).
 *
 * Reference: docs/IMPLEMENTATION.md Phase 9.2, docs/UI_UX_GUIDE.md
 */
export function useSoundEffects(options: SoundEffectsOptions = {}) {
  const { useFiles = false, soundEnabled = true } = options

  const [playKeystroke] = useSound(SOUND_URLS[SOUND_KEYS.KEYSTROKE], {
    volume: SOUND_VOLUMES[SOUND_KEYS.KEYSTROKE],
    soundEnabled: soundEnabled && useFiles,
  })
  const [playSuccess] = useSound(SOUND_URLS[SOUND_KEYS.SUCCESS], {
    volume: SOUND_VOLUMES[SOUND_KEYS.SUCCESS],
    soundEnabled: soundEnabled && useFiles,
  })
  const [playError] = useSound(SOUND_URLS[SOUND_KEYS.ERROR], {
    volume: SOUND_VOLUMES[SOUND_KEYS.ERROR],
    soundEnabled: soundEnabled && useFiles,
  })
  const [playHeal] = useSound(SOUND_URLS[SOUND_KEYS.HEAL], {
    volume: SOUND_VOLUMES[SOUND_KEYS.HEAL],
    soundEnabled: soundEnabled && useFiles,
  })
  const [playConfidenceTick] = useSound(
    SOUND_URLS[SOUND_KEYS.CONFIDENCE_TICK],
    {
      volume: SOUND_VOLUMES[SOUND_KEYS.CONFIDENCE_TICK],
      soundEnabled: soundEnabled && useFiles,
    }
  )
  const [playBootUp] = useSound(SOUND_URLS[SOUND_KEYS.BOOT_UP], {
    volume: SOUND_VOLUMES[SOUND_KEYS.BOOT_UP],
    soundEnabled: soundEnabled && useFiles,
  })

  const play = useCallback(
    (key: SoundKey) => {
      if (!soundEnabled) return

      const playFile = () => {
        switch (key) {
          case SOUND_KEYS.KEYSTROKE:
            playKeystroke()
            break
          case SOUND_KEYS.SUCCESS:
            playSuccess()
            break
          case SOUND_KEYS.ERROR:
            playError()
            break
          case SOUND_KEYS.HEAL:
            playHeal()
            break
          case SOUND_KEYS.CONFIDENCE_TICK:
            playConfidenceTick()
            break
          case SOUND_KEYS.BOOT_UP:
            playBootUp()
            break
          default:
            break
        }
      }

      if (useFiles) {
        playFile()
      } else {
        playProceduralSound(key)
      }
    },
    [
      soundEnabled,
      useFiles,
      playKeystroke,
      playSuccess,
      playError,
      playHeal,
      playConfidenceTick,
      playBootUp,
    ]
  )

  return {
    play,
    playKeystroke: () => play(SOUND_KEYS.KEYSTROKE),
    playSuccess: () => play(SOUND_KEYS.SUCCESS),
    playError: () => play(SOUND_KEYS.ERROR),
    playHeal: () => play(SOUND_KEYS.HEAL),
    playConfidenceTick: () => play(SOUND_KEYS.CONFIDENCE_TICK),
    playBootUp: () => play(SOUND_KEYS.BOOT_UP),
  }
}
