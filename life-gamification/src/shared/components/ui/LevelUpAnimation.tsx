import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  Star,
  Crown,
  Zap,
  Award,
  Sparkles,
  ArrowUp,
  ArrowRight,
  Trophy,
  Target
} from 'lucide-react'
import { FadeIn } from './AnimatedComponents'

interface LevelUpAnimationProps {
  isVisible: boolean
  newLevel: number
  previousLevel: number
  xpGained: number
  onComplete: () => void
  className?: string
}

interface FloatingNumber {
  id: string
  value: number
  x: number
  y: number
  type: 'xp' | 'level' | 'reward'
  color: string
}

interface ParticleEffect {
  id: string
  x: number
  y: number
  color: string
  size: number
  velocity: { x: number; y: number }
  life: number
}

const LevelUpAnimation = ({
  isVisible,
  newLevel,
  previousLevel,
  xpGained,
  onComplete,
  className = ''
}: LevelUpAnimationProps) => {
  const [particles, setParticles] = useState<ParticleEffect[]>([])
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([])
  const [showRewards, setShowRewards] = useState(false)
  const [animationPhase, setAnimationPhase] = useState<'intro' | 'celebration' | 'rewards' | 'outro'>('intro')

  // Create particle effects
  useEffect(() => {
    if (!isVisible) return

    const createParticles = () => {
      const newParticles: ParticleEffect[] = []
      
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: `particle-${i}`,
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: ['#FFD700', '#FFA500', '#FF69B4', '#00D4FF', '#9333EA'][Math.floor(Math.random() * 5)],
          size: Math.random() * 8 + 2,
          velocity: {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 4
          },
          life: 1
        })
      }
      
      setParticles(newParticles)
    }

    const createFloatingNumbers = () => {
      const numbers: FloatingNumber[] = [
        {
          id: 'xp-number',
          value: xpGained,
          x: 50,
          y: 60,
          type: 'xp',
          color: '#00D4FF'
        },
        {
          id: 'level-number',
          value: newLevel,
          x: 50,
          y: 40,
          type: 'level',
          color: '#FFD700'
        }
      ]
      
      setFloatingNumbers(numbers)
    }

    if (isVisible) {
      createParticles()
      createFloatingNumbers()
      
      // Animation sequence
      const phases = [
        { phase: 'intro', delay: 0 },
        { phase: 'celebration', delay: 1000 },
        { phase: 'rewards', delay: 3000 },
        { phase: 'outro', delay: 5000 }
      ]
      
      phases.forEach(({ phase, delay }) => {
        setTimeout(() => {
          setAnimationPhase(phase as any)
          if (phase === 'rewards') {
            setShowRewards(true)
          }
          if (phase === 'outro') {
            setTimeout(onComplete, 1000)
          }
        }, delay)
      })
    }

    return () => {
      setParticles([])
      setFloatingNumbers([])
      setShowRewards(false)
      setAnimationPhase('intro')
    }
  }, [isVisible, xpGained, newLevel, onComplete])

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return

    const interval = setInterval(() => {
      setParticles(prev => 
        prev.map(particle => ({
          ...particle,
          x: particle.x + particle.velocity.x,
          y: particle.y + particle.velocity.y,
          life: particle.life - 0.02
        })).filter(particle => particle.life > 0)
      )
    }, 16)

    return () => clearInterval(interval)
  }, [particles.length])

  const levelMilestones = {
    5: { title: 'Getting Started!', reward: '🎯', description: 'You\'re building momentum' },
    10: { title: 'Habit Former!', reward: '🔥', description: 'Consistency is key' },
    25: { title: 'Task Master!', reward: '⚡', description: 'You\'re on fire!' },
    50: { title: 'Productivity Guru!', reward: '🏆', description: 'Exceptional dedication' },
    100: { title: 'Legendary Achiever!', reward: '👑', description: 'Ultimate mastery unlocked' }
  }

  const milestone = Object.entries(levelMilestones)
    .reverse()
    .find(([level]) => newLevel >= parseInt(level))

  const getLevelTitle = () => {
    if (newLevel >= 100) return 'Legendary'
    if (newLevel >= 50) return 'Master'
    if (newLevel >= 25) return 'Expert'
    if (newLevel >= 10) return 'Skilled'
    if (newLevel >= 5) return 'Apprentice'
    return 'Novice'
  }

  const getLevelColor = () => {
    if (newLevel >= 100) return 'text-yellow-300'
    if (newLevel >= 50) return 'text-purple-300'
    if (newLevel >= 25) return 'text-blue-300'
    if (newLevel >= 10) return 'text-green-300'
    if (newLevel >= 5) return 'text-orange-300'
    return 'text-gray-300'
  }

  const getBorderColor = () => {
    if (newLevel >= 100) return 'border-yellow-400'
    if (newLevel >= 50) return 'border-purple-400'
    if (newLevel >= 25) return 'border-blue-400'
    if (newLevel >= 10) return 'border-green-400'
    if (newLevel >= 5) return 'border-orange-400'
    return 'border-gray-400'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ${className}`}
          onClick={onComplete}
        >
          {/* Particle Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  backgroundColor: particle.color,
                  opacity: particle.life
                }}
                animate={{
                  scale: [1, 1.5, 0],
                  opacity: [particle.life, particle.life * 0.5, 0]
                }}
                transition={{ duration: 2, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Floating Numbers */}
          <div className="absolute inset-0 pointer-events-none">
            {floatingNumbers.map((number) => (
              <motion.div
                key={number.id}
                className="absolute font-bold"
                style={{
                  left: `${number.x}%`,
                  top: `${number.y}%`,
                  color: number.color,
                  fontSize: number.type === 'level' ? '3rem' : '2rem'
                }}
                initial={{ y: 0, opacity: 0, scale: 0.5 }}
                animate={{ 
                  y: -50, 
                  opacity: 1, 
                  scale: 1.2 
                }}
                transition={{ 
                  duration: 2, 
                  ease: 'easeOut',
                  delay: number.type === 'level' ? 0.5 : 0
                }}
              >
                {number.type === 'xp' && '+'}
                {number.value}
                {number.type === 'xp' && ' XP'}
              </motion.div>
            ))}
          </div>

          {/* Main Content */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: animationPhase === 'celebration' ? 1.1 : 1, 
              opacity: 1 
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 200, 
              damping: 20 
            }}
            className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border-4 ${getBorderColor()} p-8 max-w-md w-full mx-4 text-center shadow-2xl`}
          >
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-purple-500 to-blue-500 rounded-2xl opacity-30 blur-lg animate-pulse" />
            
            <div className="relative">
              {/* Level Up Icon */}
              <motion.div
                animate={{ 
                  rotate: animationPhase === 'celebration' ? 360 : 0,
                  scale: animationPhase === 'celebration' ? 1.2 : 1
                }}
                transition={{ duration: 1, type: 'spring' }}
                className="mb-6"
              >
                {newLevel >= 100 ? (
                  <Crown className="w-20 h-20 text-yellow-300 mx-auto" />
                ) : newLevel >= 50 ? (
                  <Trophy className="w-20 h-20 text-purple-300 mx-auto" />
                ) : newLevel >= 25 ? (
                  <Award className="w-20 h-20 text-blue-300 mx-auto" />
                ) : (
                  <TrendingUp className="w-20 h-20 text-green-300 mx-auto" />
                )}
              </motion.div>

              {/* Level Up Text */}
              <motion.h1
                animate={{ 
                  scale: animationPhase === 'celebration' ? 1.1 : 1 
                }}
                className="text-4xl font-bold text-white mb-2"
              >
                LEVEL UP!
              </motion.h1>

              {/* Level Information */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mb-6"
              >
                <div className="text-2xl font-bold mb-2">
                  <span className="text-gray-400">Level {previousLevel}</span>
                  <ArrowRight className="inline-block w-6 h-6 mx-3 text-theme-accent" />
                  <span className={`${getLevelColor()}`}>Level {newLevel}</span>
                </div>
                <div className={`text-lg ${getLevelColor()}`}>
                  {getLevelTitle()} Tier
                </div>
              </motion.div>

              {/* XP Gained */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8, type: 'spring' }}
                className="mb-6"
              >
                <div className="flex items-center justify-center gap-2 text-theme-accent">
                  <Zap className="w-5 h-5" />
                  <span className="text-xl font-semibold">+{xpGained} XP</span>
                </div>
              </motion.div>

              {/* Milestone Rewards */}
              {showRewards && milestone && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 mb-6 border border-purple-400/30"
                >
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Sparkles className="w-6 h-6 text-yellow-300" />
                    <h3 className="text-lg font-bold text-yellow-300">
                      {milestone[1].title}
                    </h3>
                    <span className="text-2xl">{milestone[1].reward}</span>
                  </div>
                  <p className="text-sm text-gray-300">{milestone[1].description}</p>
                </motion.div>
              )}

              {/* Action Hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: animationPhase === 'outro' ? 1 : 0.7 }}
                transition={{ delay: 2 }}
                className="text-sm text-gray-400"
              >
                Click anywhere to continue
              </motion.div>
            </div>
          </motion.div>

          {/* Background Stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={`star-${i}`}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1.5, 0.5]
                }}
                transition={{
                  duration: 3,
                  delay: Math.random() * 2,
                  repeat: Infinity,
                  repeatDelay: Math.random() * 3
                }}
              >
                <Star className="w-4 h-4 text-yellow-300" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LevelUpAnimation