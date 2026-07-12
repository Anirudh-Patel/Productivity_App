import { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react'
import { logger } from '../../../utils/logger'

interface AudioSettings {
  masterVolume: number
  sfxVolume: number
  musicVolume: number
  enableSoundEffects: boolean
  enableMusic: boolean
  enableNotificationSounds: boolean
}

interface AudioContextType {
  settings: AudioSettings
  updateSettings: (newSettings: Partial<AudioSettings>) => void
  playSound: (soundId: AudioSoundId, options?: AudioPlayOptions) => void
  playSequence: (sounds: Array<{ soundId: AudioSoundId; delay?: number; options?: AudioPlayOptions }>) => void
  stopAllSounds: () => void
  preloadSounds: () => Promise<void>
  isLoaded: boolean
}

export interface AudioPlayOptions {
  volume?: number
  loop?: boolean
  pitch?: number
  fadeIn?: number
  fadeOut?: number
}

export type AudioSoundId = 
  | 'task_complete'
  | 'level_up'
  | 'achievement_unlock'
  | 'xp_gain'
  | 'button_click'
  | 'notification'
  | 'combo_reward'
  | 'skill_unlock'
  | 'shop_purchase'
  | 'error'
  | 'success'
  | 'swoosh'
  | 'sparkle'
  | 'coin'
  | 'powerup'

interface SoundDefinition {
  id: AudioSoundId
  url: string
  volume: number
  category: 'sfx' | 'music' | 'notification'
  preload: boolean
}

const AudioContext = createContext<AudioContextType | null>(null)

export const useAudio = () => {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}

interface AudioProviderProps {
  children: React.ReactNode
}

export const AudioProvider = ({ children }: AudioProviderProps) => {
  const [settings, setSettings] = useState<AudioSettings>({
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    enableSoundEffects: true,
    enableMusic: true,
    enableNotificationSounds: true
  })
  
  const [isLoaded, setIsLoaded] = useState(false)
  const audioCache = useRef<Map<AudioSoundId, HTMLAudioElement>>(new Map())
  const activeAudio = useRef<Set<HTMLAudioElement>>(new Set())

  // Sound definitions with Web Audio API compatible sounds
  const soundDefinitions: SoundDefinition[] = [
    { id: 'task_complete', url: '/sounds/task_complete.wav', volume: 0.8, category: 'sfx', preload: true },
    { id: 'level_up', url: '/sounds/level_up.wav', volume: 1.0, category: 'sfx', preload: true },
    { id: 'achievement_unlock', url: '/sounds/achievement.wav', volume: 0.9, category: 'sfx', preload: true },
    { id: 'xp_gain', url: '/sounds/xp_gain.wav', volume: 0.6, category: 'sfx', preload: true },
    { id: 'button_click', url: '/sounds/click.wav', volume: 0.4, category: 'sfx', preload: false },
    { id: 'notification', url: '/sounds/notification.wav', volume: 0.7, category: 'notification', preload: true },
    { id: 'combo_reward', url: '/sounds/combo.wav', volume: 0.8, category: 'sfx', preload: true },
    { id: 'skill_unlock', url: '/sounds/skill.wav', volume: 0.8, category: 'sfx', preload: true },
    { id: 'shop_purchase', url: '/sounds/purchase.wav', volume: 0.7, category: 'sfx', preload: false },
    { id: 'error', url: '/sounds/error.wav', volume: 0.6, category: 'notification', preload: false },
    { id: 'success', url: '/sounds/success.wav', volume: 0.8, category: 'sfx', preload: false },
    { id: 'swoosh', url: '/sounds/swoosh.wav', volume: 0.5, category: 'sfx', preload: false },
    { id: 'sparkle', url: '/sounds/sparkle.wav', volume: 0.4, category: 'sfx', preload: false },
    { id: 'coin', url: '/sounds/coin.wav', volume: 0.7, category: 'sfx', preload: false },
    { id: 'powerup', url: '/sounds/powerup.wav', volume: 0.8, category: 'sfx', preload: false }
  ]

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('audio-settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      }
    } catch (error) {
      logger.error('Failed to load audio settings:', error, 'AudioManager')
    }
  }, [])

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('audio-settings', JSON.stringify(settings))
    } catch (error) {
      logger.error('Failed to save audio settings:', error, 'AudioManager')
    }
  }, [settings])

  // Create procedural sound using Web Audio API as fallback
  const createProceduralSound = useCallback((soundId: AudioSoundId): HTMLAudioElement | null => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      // Define sound characteristics based on type
      const soundConfig = {
        task_complete: { frequency: 800, type: 'sine' as OscillatorType, duration: 0.3 },
        level_up: { frequency: 523.25, type: 'triangle' as OscillatorType, duration: 0.8 },
        achievement_unlock: { frequency: 659.25, type: 'sine' as OscillatorType, duration: 1.0 },
        xp_gain: { frequency: 1000, type: 'square' as OscillatorType, duration: 0.2 },
        button_click: { frequency: 2000, type: 'square' as OscillatorType, duration: 0.1 },
        notification: { frequency: 880, type: 'sine' as OscillatorType, duration: 0.4 },
        combo_reward: { frequency: 440, type: 'sawtooth' as OscillatorType, duration: 0.6 },
        skill_unlock: { frequency: 698.46, type: 'triangle' as OscillatorType, duration: 0.7 },
        shop_purchase: { frequency: 1318.51, type: 'sine' as OscillatorType, duration: 0.4 },
        error: { frequency: 200, type: 'sawtooth' as OscillatorType, duration: 0.5 },
        success: { frequency: 783.99, type: 'sine' as OscillatorType, duration: 0.5 },
        swoosh: { frequency: 400, type: 'sine' as OscillatorType, duration: 0.3 },
        sparkle: { frequency: 1500, type: 'sine' as OscillatorType, duration: 0.15 },
        coin: { frequency: 1760, type: 'square' as OscillatorType, duration: 0.2 },
        powerup: { frequency: 523.25, type: 'triangle' as OscillatorType, duration: 1.2 }
      }
      
      const config = soundConfig[soundId] || soundConfig.button_click
      
      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime)
      
      // Create envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration)
      
      // Create mock HTML audio element that uses Web Audio
      const mockAudio = {
        play: () => {
          try {
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + config.duration)
          } catch (error) {
            // Oscillator already started, ignore
          }
          return Promise.resolve()
        },
        pause: () => {},
        volume: 1,
        currentTime: 0,
        duration: config.duration,
        paused: false,
        ended: false,
        src: '',
        load: () => {},
        addEventListener: () => {},
        removeEventListener: () => {}
      } as unknown as HTMLAudioElement
      
      return mockAudio
    } catch (error) {
      logger.error(`Failed to create procedural sound for ${soundId}:`, error, 'AudioManager')
      return null
    }
  }, [])

  // Preload all sounds
  const preloadSounds = useCallback(async () => {
    const loadPromises = soundDefinitions.map(async (soundDef) => {
      if (!soundDef.preload) return
      
      try {
        // Try to load actual audio file first
        const audio = new Audio()
        audio.preload = 'auto'
        audio.volume = 0 // Mute during preload
        
        const loadPromise = new Promise<void>((resolve, reject) => {
          audio.addEventListener('canplaythrough', () => resolve(), { once: true })
          audio.addEventListener('error', () => reject(new Error(`Failed to load ${soundDef.url}`)), { once: true })
          
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error(`Timeout loading ${soundDef.url}`)), 5000)
        })
        
        audio.src = soundDef.url
        audio.load()
        
        await loadPromise
        audioCache.current.set(soundDef.id, audio)
        
        logger.info(`Loaded audio: ${soundDef.id}`, {}, 'AudioManager')
      } catch (error) {
        logger.warn(`Failed to load audio file for ${soundDef.id}, using procedural sound:`, error, 'AudioManager')
        
        // Fallback to procedural sound
        const proceduralAudio = createProceduralSound(soundDef.id)
        if (proceduralAudio) {
          audioCache.current.set(soundDef.id, proceduralAudio)
        }
      }
    })
    
    await Promise.allSettled(loadPromises)
    setIsLoaded(true)
    logger.info('Audio preloading completed', {}, 'AudioManager')
  }, [createProceduralSound])

  // Initialize audio on mount
  useEffect(() => {
    preloadSounds()
  }, [preloadSounds])

  const updateSettings = useCallback((newSettings: Partial<AudioSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  const getEffectiveVolume = useCallback((soundId: AudioSoundId, customVolume?: number): number => {
    const soundDef = soundDefinitions.find(s => s.id === soundId)
    if (!soundDef) return 0
    
    let categoryVolume = 1
    if (!settings.enableSoundEffects && soundDef.category === 'sfx') return 0
    if (!settings.enableMusic && soundDef.category === 'music') return 0
    if (!settings.enableNotificationSounds && soundDef.category === 'notification') return 0
    
    switch (soundDef.category) {
      case 'sfx': categoryVolume = settings.sfxVolume; break
      case 'music': categoryVolume = settings.musicVolume; break
      case 'notification': categoryVolume = settings.sfxVolume; break
    }
    
    return settings.masterVolume * categoryVolume * soundDef.volume * (customVolume ?? 1)
  }, [settings, soundDefinitions])

  const playSound = useCallback(async (soundId: AudioSoundId, options: AudioPlayOptions = {}) => {
    try {
      const volume = getEffectiveVolume(soundId, options.volume)
      if (volume <= 0) return
      
      let audio = audioCache.current.get(soundId)
      
      // If not cached, try to create on-demand
      if (!audio) {
        const soundDef = soundDefinitions.find(s => s.id === soundId)
        if (soundDef) {
          try {
            audio = new Audio(soundDef.url)
          } catch (error) {
            // Fallback to procedural sound
            audio = createProceduralSound(soundId) ?? undefined
          }
          
          if (audio) {
            audioCache.current.set(soundId, audio)
          }
        }
      }
      
      if (!audio) {
        logger.warn(`No audio found for sound: ${soundId}`, {}, 'AudioManager')
        return
      }
      
      // Clone audio for concurrent playback
      const audioClone = audio.cloneNode() as HTMLAudioElement
      audioClone.volume = volume
      
      if (options.pitch && options.pitch !== 1) {
        audioClone.playbackRate = options.pitch
      }
      
      // Handle fade in
      if (options.fadeIn) {
        audioClone.volume = 0
        const fadeStep = volume / (options.fadeIn * 100) // 10ms intervals
        const fadeInterval = setInterval(() => {
          if (audioClone.volume < volume) {
            audioClone.volume = Math.min(audioClone.volume + fadeStep, volume)
          } else {
            clearInterval(fadeInterval)
          }
        }, 10)
      }
      
      // Handle fade out
      if (options.fadeOut) {
        const fadeOutTime = (audioClone.duration || 1) - options.fadeOut
        setTimeout(() => {
          const fadeStep = audioClone.volume / (options.fadeOut! * 100)
          const fadeInterval = setInterval(() => {
            if (audioClone.volume > 0) {
              audioClone.volume = Math.max(audioClone.volume - fadeStep, 0)
            } else {
              clearInterval(fadeInterval)
            }
          }, 10)
        }, fadeOutTime * 1000)
      }
      
      activeAudio.current.add(audioClone)
      
      audioClone.addEventListener('ended', () => {
        activeAudio.current.delete(audioClone)
      }, { once: true })
      
      await audioClone.play()
      
      logger.debug(`Played sound: ${soundId}`, { volume, options }, 'AudioManager')
    } catch (error) {
      logger.error(`Failed to play sound ${soundId}:`, error, 'AudioManager')
    }
  }, [getEffectiveVolume, createProceduralSound])

  const playSequence = useCallback(async (sounds: Array<{ soundId: AudioSoundId; delay?: number; options?: AudioPlayOptions }>) => {
    for (const sound of sounds) {
      if (sound.delay) {
        await new Promise(resolve => setTimeout(resolve, sound.delay))
      }
      await playSound(sound.soundId, sound.options)
    }
  }, [playSound])

  const stopAllSounds = useCallback(() => {
    activeAudio.current.forEach(audio => {
      audio.pause()
      audio.currentTime = 0
    })
    activeAudio.current.clear()
  }, [])

  return (
    <AudioContext.Provider
      value={{
        settings,
        updateSettings,
        playSound,
        playSequence,
        stopAllSounds,
        preloadSounds,
        isLoaded
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

export default AudioProvider