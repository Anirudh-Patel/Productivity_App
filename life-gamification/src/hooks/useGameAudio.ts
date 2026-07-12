import { useCallback } from 'react'
import { useAudio, type AudioSoundId, type AudioPlayOptions } from '../shared/components/audio/AudioManager'
import type { Achievement } from '../types'

interface TaskCompletionAudioOptions {
  taskName?: string
  xpAmount?: number
  isCombo?: boolean
  comboCount?: number
}

interface LevelUpAudioOptions {
  newLevel: number
  previousLevel: number
  milestone?: boolean
}

interface AchievementAudioOptions {
  achievement: Achievement
}

export const useGameAudio = () => {
  const audio = useAudio()

  const playTaskCompletionAudio = useCallback(async (options: TaskCompletionAudioOptions = {}) => {
    const { xpAmount = 50, isCombo = false, comboCount = 1 } = options

    if (isCombo && comboCount > 1) {
      // Play combo sequence
      const sounds = []
      for (let i = 0; i < Math.min(comboCount, 5); i++) {
        sounds.push({
          soundId: 'xp_gain' as AudioSoundId,
          delay: i * 150,
          options: { 
            volume: 0.6 + (i * 0.1),
            pitch: 1 + (i * 0.1)
          }
        })
      }
      sounds.push({
        soundId: 'combo_reward' as AudioSoundId,
        delay: 100,
        options: { volume: 0.8 }
      })
      
      await audio.playSequence(sounds)
    } else {
      // Single task completion
      const baseVolume = Math.min(0.8, 0.4 + (xpAmount / 200))
      await audio.playSound('task_complete', { volume: baseVolume })
      
      // Add XP gain sound after short delay
      setTimeout(() => {
        audio.playSound('xp_gain', { volume: 0.6 })
      }, 200)
    }
  }, [audio])

  const playLevelUpAudio = useCallback(async (options: LevelUpAudioOptions) => {
    const { newLevel, milestone = false } = options

    // Create ascending tone sequence based on level
    const levelTones = []
    
    // Build up sequence
    for (let i = 0; i < Math.min(3, Math.floor(newLevel / 5) + 1); i++) {
      levelTones.push({
        soundId: 'powerup' as AudioSoundId,
        delay: i * 200,
        options: { 
          volume: 0.6,
          pitch: 1 + (i * 0.2)
        }
      })
    }

    // Main level up sound
    levelTones.push({
      soundId: 'level_up' as AudioSoundId,
      delay: 300,
      options: { volume: 0.9 }
    })

    // Milestone bonus
    if (milestone) {
      levelTones.push({
        soundId: 'achievement_unlock' as AudioSoundId,
        delay: 500,
        options: { volume: 0.8 }
      })
    }

    await audio.playSequence(levelTones)
  }, [audio])

  const playAchievementAudio = useCallback(async (options: AchievementAudioOptions) => {
    const { achievement } = options

    const rarityAudioMap = {
      'common': { volume: 0.6, pitch: 1.0, extraSounds: [] as AudioSoundId[] },
      'uncommon': { volume: 0.7, pitch: 1.1, extraSounds: ['sparkle'] as AudioSoundId[] },
      'rare': { volume: 0.8, pitch: 1.2, extraSounds: ['sparkle', 'coin'] as AudioSoundId[] },
      'epic': { volume: 0.9, pitch: 1.3, extraSounds: ['sparkle', 'coin', 'powerup'] as AudioSoundId[] },
      'legendary': { volume: 1.0, pitch: 1.4, extraSounds: ['sparkle', 'coin', 'powerup', 'success'] as AudioSoundId[] }
    }

    const rarityConfig = rarityAudioMap[achievement.rarity] || rarityAudioMap.common

    const sequence = [
      {
        soundId: 'swoosh' as AudioSoundId,
        delay: 0,
        options: { volume: 0.5 }
      },
      {
        soundId: 'achievement_unlock' as AudioSoundId,
        delay: 300,
        options: { 
          volume: rarityConfig.volume,
          pitch: rarityConfig.pitch
        }
      }
    ]

    // Add extra sounds for higher rarities
    rarityConfig.extraSounds.forEach((soundId, index) => {
      sequence.push({
        soundId,
        delay: 600 + (index * 150),
        options: { 
          volume: 0.4 + (index * 0.1),
          pitch: 1 + (index * 0.05)
        }
      })
    })

    await audio.playSequence(sequence)
  }, [audio])

  const playXPGainAudio = useCallback(async (amount: number) => {
    const volume = Math.min(0.8, 0.3 + (amount / 150))
    const pitch = Math.min(1.5, 1 + (amount / 200))
    
    await audio.playSound('xp_gain', { volume, pitch })
  }, [audio])

  const playButtonClickAudio = useCallback(async () => {
    await audio.playSound('button_click', { volume: 0.3 })
  }, [audio])

  const playNotificationAudio = useCallback(async (type: 'success' | 'error' | 'info' = 'info') => {
    const soundMap = {
      success: 'success' as AudioSoundId,
      error: 'error' as AudioSoundId,
      info: 'notification' as AudioSoundId
    }
    
    await audio.playSound(soundMap[type], { volume: 0.7 })
  }, [audio])

  const playShopPurchaseAudio = useCallback(async (cost: number) => {
    const sequence: Array<{ soundId: AudioSoundId; delay?: number; options?: AudioPlayOptions }> = [
      {
        soundId: 'coin' as AudioSoundId,
        delay: 0,
        options: { volume: 0.6 }
      },
      {
        soundId: 'shop_purchase' as AudioSoundId,
        delay: 150,
        options: { volume: 0.7 }
      }
    ]

    // Add extra coin sounds for expensive items
    if (cost > 100) {
      sequence.unshift({
        soundId: 'coin' as AudioSoundId,
        delay: 0,
        options: { volume: 0.4, pitch: 1.2 }
      })
    }
    if (cost > 500) {
      sequence.unshift({
        soundId: 'coin' as AudioSoundId,
        delay: 0,
        options: { volume: 0.3, pitch: 1.4 }
      })
    }

    await audio.playSequence(sequence)
  }, [audio])

  const playSkillUnlockAudio = useCallback(async () => {
    const sequence = [
      {
        soundId: 'sparkle' as AudioSoundId,
        delay: 0,
        options: { volume: 0.5 }
      },
      {
        soundId: 'skill_unlock' as AudioSoundId,
        delay: 200,
        options: { volume: 0.8 }
      },
      {
        soundId: 'powerup' as AudioSoundId,
        delay: 400,
        options: { volume: 0.6, pitch: 1.3 }
      }
    ]

    await audio.playSequence(sequence)
  }, [audio])

  // Ambient and contextual audio
  const playPageTransitionAudio = useCallback(async () => {
    await audio.playSound('swoosh', { volume: 0.3 })
  }, [audio])

  const playHoverAudio = useCallback(async () => {
    await audio.playSound('sparkle', { volume: 0.2, pitch: 1.5 })
  }, [audio])

  return {
    // Core game events
    playTaskCompletionAudio,
    playLevelUpAudio,
    playAchievementAudio,
    playXPGainAudio,
    playSkillUnlockAudio,
    
    // UI interactions
    playButtonClickAudio,
    playNotificationAudio,
    playPageTransitionAudio,
    playHoverAudio,
    
    // Shop and rewards
    playShopPurchaseAudio,
    
    // Audio control
    stopAllSounds: audio.stopAllSounds,
    settings: audio.settings,
    updateSettings: audio.updateSettings,
    isLoaded: audio.isLoaded
  }
}