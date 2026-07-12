import { useState, useCallback, createContext, useContext, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import LevelUpAnimation from './LevelUpAnimation'
import XPGainAnimation from './XPGainAnimation'
import AchievementAnimation from './AchievementAnimation'
import { useGameAudio } from '../../../hooks/useGameAudio'
import type { Achievement } from '../../../types'

interface LevelUpEvent {
  id: string
  newLevel: number
  previousLevel: number
  xpGained: number
}

interface XPGainEvent {
  id: string
  xpAmount: number
  reason?: string
  position?: { x: number; y: number }
}

interface AchievementEvent {
  id: string
  achievement: Achievement
}

interface VisualEffect {
  id: string
  type: 'levelup' | 'xp' | 'achievement'
  data: LevelUpEvent | XPGainEvent | AchievementEvent
  priority: number
  timestamp: number
}

interface VisualEffectsContextType {
  showLevelUp: (newLevel: number, previousLevel: number, xpGained: number) => void
  showXPGain: (xpAmount: number, reason?: string, position?: { x: number; y: number }) => void
  showAchievement: (achievement: Achievement) => void
  clearAllEffects: () => void
  isPlayingEffects: boolean
}

const VisualEffectsContext = createContext<VisualEffectsContextType | null>(null)

export const useVisualEffects = () => {
  const context = useContext(VisualEffectsContext)
  if (!context) {
    throw new Error('useVisualEffects must be used within VisualEffectsProvider')
  }
  return context
}

interface VisualEffectsProviderProps {
  children: React.ReactNode
  maxConcurrentEffects?: number
}

export const VisualEffectsProvider = ({ 
  children, 
  maxConcurrentEffects = 3 
}: VisualEffectsProviderProps) => {
  const [effectQueue, setEffectQueue] = useState<VisualEffect[]>([])
  const [activeEffects, setActiveEffects] = useState<VisualEffect[]>([])
  const [isPlayingEffects, setIsPlayingEffects] = useState(false)
  
  // Audio integration (only available inside AudioProvider)
  let gameAudio: ReturnType<typeof useGameAudio> | null = null
  try {
    gameAudio = useGameAudio()
  } catch (error) {
    // Audio provider not available, skip audio
  }

  // Process effect queue
  useEffect(() => {
    if (effectQueue.length === 0 || activeEffects.length >= maxConcurrentEffects) {
      return
    }

    // Sort by priority and timestamp
    const sortedQueue = [...effectQueue].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority // Higher priority first
      }
      return a.timestamp - b.timestamp // Earlier timestamp first
    })

    const nextEffect = sortedQueue[0]
    if (nextEffect) {
      setActiveEffects(prev => [...prev, nextEffect])
      setEffectQueue(prev => prev.filter(e => e.id !== nextEffect.id))
      setIsPlayingEffects(true)
    }
  }, [effectQueue, activeEffects, maxConcurrentEffects])

  // Update playing state
  useEffect(() => {
    setIsPlayingEffects(activeEffects.length > 0)
  }, [activeEffects])

  const addEffect = useCallback((effect: VisualEffect) => {
    setEffectQueue(prev => [...prev, effect])
  }, [])

  const removeEffect = useCallback((effectId: string) => {
    setActiveEffects(prev => prev.filter(e => e.id !== effectId))
  }, [])

  const showLevelUp = useCallback((newLevel: number, previousLevel: number, xpGained: number) => {
    const effect: VisualEffect = {
      id: `levelup-${Date.now()}-${Math.random()}`,
      type: 'levelup',
      data: {
        id: `levelup-${Date.now()}`,
        newLevel,
        previousLevel,
        xpGained
      },
      priority: 10, // Highest priority
      timestamp: Date.now()
    }
    addEffect(effect)
    
    // Trigger audio effect
    if (gameAudio) {
      const milestone = newLevel % 25 === 0 || newLevel % 50 === 0 || newLevel >= 100
      gameAudio.playLevelUpAudio({ newLevel, previousLevel, milestone })
    }
  }, [addEffect, gameAudio])

  const showXPGain = useCallback((xpAmount: number, reason?: string, position?: { x: number; y: number }) => {
    const effect: VisualEffect = {
      id: `xp-${Date.now()}-${Math.random()}`,
      type: 'xp',
      data: {
        id: `xp-${Date.now()}`,
        xpAmount,
        reason,
        position
      },
      priority: 5, // Medium priority
      timestamp: Date.now()
    }
    addEffect(effect)
    
    // Trigger audio effect
    if (gameAudio) {
      gameAudio.playXPGainAudio(xpAmount)
    }
  }, [addEffect, gameAudio])

  const showAchievement = useCallback((achievement: Achievement) => {
    const effect: VisualEffect = {
      id: `achievement-${Date.now()}-${Math.random()}`,
      type: 'achievement',
      data: {
        id: `achievement-${Date.now()}`,
        achievement
      },
      priority: 8, // High priority
      timestamp: Date.now()
    }
    addEffect(effect)
    
    // Trigger audio effect
    if (gameAudio) {
      gameAudio.playAchievementAudio({ achievement })
    }
  }, [addEffect, gameAudio])

  const clearAllEffects = useCallback(() => {
    setEffectQueue([])
    setActiveEffects([])
    
    // Stop all audio effects
    if (gameAudio) {
      gameAudio.stopAllSounds()
    }
  }, [gameAudio])

  return (
    <VisualEffectsContext.Provider
      value={{
        showLevelUp,
        showXPGain,
        showAchievement,
        clearAllEffects,
        isPlayingEffects
      }}
    >
      {children}
      
      {/* Render Active Effects */}
      <AnimatePresence>
        {activeEffects.map((effect) => {
          switch (effect.type) {
            case 'levelup':
              const levelUpData = effect.data as LevelUpEvent
              return (
                <LevelUpAnimation
                  key={effect.id}
                  isVisible={true}
                  newLevel={levelUpData.newLevel}
                  previousLevel={levelUpData.previousLevel}
                  xpGained={levelUpData.xpGained}
                  onComplete={() => removeEffect(effect.id)}
                />
              )
              
            case 'xp':
              const xpData = effect.data as XPGainEvent
              return (
                <XPGainAnimation
                  key={effect.id}
                  isVisible={true}
                  xpAmount={xpData.xpAmount}
                  reason={xpData.reason}
                  position={xpData.position}
                  onComplete={() => removeEffect(effect.id)}
                />
              )
              
            case 'achievement':
              const achievementData = effect.data as AchievementEvent
              return (
                <AchievementAnimation
                  key={effect.id}
                  isVisible={true}
                  achievement={achievementData.achievement}
                  onComplete={() => removeEffect(effect.id)}
                />
              )
              
            default:
              return null
          }
        })}
      </AnimatePresence>
    </VisualEffectsContext.Provider>
  )
}

// Hook for triggering effects based on game events
export const useGameEffects = () => {
  const effects = useVisualEffects()

  const triggerTaskCompletion = useCallback((
    xpGained: number, 
    taskName?: string,
    position?: { x: number; y: number }
  ) => {
    effects.showXPGain(xpGained, taskName ? `${taskName} completed!` : 'Task completed!', position)
    
    // Audio is handled by the VisualEffectsProvider, but we can trigger additional task completion audio here
    // This allows for more complex audio sequences if needed
  }, [effects])

  const triggerLevelUp = useCallback((newLevel: number, previousLevel: number, xpGained: number) => {
    effects.showLevelUp(newLevel, previousLevel, xpGained)
  }, [effects])

  const triggerAchievementUnlock = useCallback((achievement: Achievement) => {
    effects.showAchievement(achievement)
  }, [effects])

  const triggerMultipleXPGains = useCallback((gains: Array<{ amount: number; reason?: string; delay?: number }>) => {
    gains.forEach((gain, index) => {
      setTimeout(() => {
        effects.showXPGain(
          gain.amount, 
          gain.reason,
          {
            x: 50 + (Math.random() - 0.5) * 30,
            y: 50 + (Math.random() - 0.5) * 30
          }
        )
      }, (gain.delay || 0) + index * 200)
    })
  }, [effects])

  const triggerComboReward = useCallback((comboCount: number, totalXP: number) => {
    // Show individual XP gains for combo effect
    const baseXP = totalXP / comboCount
    for (let i = 0; i < comboCount; i++) {
      setTimeout(() => {
        effects.showXPGain(
          Math.round(baseXP),
          i === 0 ? `${comboCount}x Combo!` : `Combo ${i + 1}`,
          {
            x: 50 + (Math.random() - 0.5) * 40,
            y: 50 + (Math.random() - 0.5) * 40
          }
        )
      }, i * 150)
    }
  }, [effects])

  return {
    triggerTaskCompletion,
    triggerLevelUp,
    triggerAchievementUnlock,
    triggerMultipleXPGains,
    triggerComboReward,
    isPlayingEffects: effects.isPlayingEffects,
    clearAllEffects: effects.clearAllEffects
  }
}

// Utility component for testing effects
export const EffectsTestPanel = () => {
  const gameEffects = useGameEffects()

  const testLevelUp = () => {
    gameEffects.triggerLevelUp(25, 24, 180)
  }

  const testXPGain = () => {
    gameEffects.triggerTaskCompletion(50, 'Complete daily workout')
  }

  const testAchievement = () => {
    const testAchievement: Achievement = {
      id: 999,
      name: 'Task Master',
      description: 'Complete 100 tasks in a single day',
      icon: '🏆',
      requirements_type: 'task_count',
      requirements_value: 100,
      rarity: 'legendary',
      experience_reward: 500,
      gold_reward: 250
    }
    gameEffects.triggerAchievementUnlock(testAchievement)
  }

  const testCombo = () => {
    gameEffects.triggerComboReward(5, 250)
  }

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 p-4 rounded-lg space-y-2 z-50">
      <h3 className="text-white font-semibold text-sm">Effects Test Panel</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={testXPGain}
          className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
        >
          Test XP Gain
        </button>
        <button
          onClick={testLevelUp}
          className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
        >
          Test Level Up
        </button>
        <button
          onClick={testAchievement}
          className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
        >
          Test Achievement
        </button>
        <button
          onClick={testCombo}
          className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
        >
          Test Combo
        </button>
        <button
          onClick={gameEffects.clearAllEffects}
          className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
        >
          Clear All
        </button>
      </div>
      {gameEffects.isPlayingEffects && (
        <div className="text-xs text-green-400">▶ Effects Playing</div>
      )}
    </div>
  )
}

export default VisualEffectsProvider