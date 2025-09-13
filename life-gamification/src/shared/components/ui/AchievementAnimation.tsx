import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  Trophy,
  Crown,
  Star,
  Sparkles,
  Zap,
  Target,
  Medal
} from 'lucide-react'

interface Achievement {
  id: number
  name: string
  description: string
  icon?: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  experience_reward: number
  gold_reward: number
}

interface AchievementAnimationProps {
  isVisible: boolean
  achievement: Achievement
  onComplete: () => void
  className?: string
}

const AchievementAnimation = ({
  isVisible,
  achievement,
  onComplete,
  className = ''
}: AchievementAnimationProps) => {
  const [animationPhase, setAnimationPhase] = useState<'intro' | 'reveal' | 'celebration' | 'outro'>('intro')
  const [particles, setParticles] = useState<Array<{ id: string; x: number; y: number; color: string }>>([])

  useEffect(() => {
    if (!isVisible) return

    // Animation sequence
    const phases = [
      { phase: 'intro', delay: 0 },
      { phase: 'reveal', delay: 800 },
      { phase: 'celebration', delay: 1500 },
      { phase: 'outro', delay: 4000 }
    ]

    phases.forEach(({ phase, delay }) => {
      setTimeout(() => {
        setAnimationPhase(phase as any)
        if (phase === 'outro') {
          setTimeout(onComplete, 500)
        }
      }, delay)
    })

    // Create particles for celebration
    const createParticles = () => {
      const newParticles = []
      for (let i = 0; i < 30; i++) {
        newParticles.push({
          id: `particle-${i}`,
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: getRarityColor(achievement.rarity)
        })
      }
      setParticles(newParticles)
    }

    setTimeout(createParticles, 1200)

    return () => {
      setAnimationPhase('intro')
      setParticles([])
    }
  }, [isVisible, achievement, onComplete])

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '#FFD700'
      case 'epic': return '#9333EA'
      case 'rare': return '#3B82F6'
      case 'uncommon': return '#10B981'
      default: return '#6B7280'
    }
  }

  const getRarityGradient = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-yellow-400 via-yellow-500 to-orange-500'
      case 'epic': return 'from-purple-400 via-purple-500 to-pink-500'
      case 'rare': return 'from-blue-400 via-blue-500 to-indigo-500'
      case 'uncommon': return 'from-green-400 via-green-500 to-emerald-500'
      default: return 'from-gray-400 via-gray-500 to-gray-600'
    }
  }

  const getRarityIcon = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return Crown
      case 'epic': return Trophy
      case 'rare': return Medal
      case 'uncommon': return Award
      default: return Target
    }
  }

  const getRarityTitle = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'LEGENDARY ACHIEVEMENT'
      case 'epic': return 'EPIC ACHIEVEMENT'
      case 'rare': return 'RARE ACHIEVEMENT'
      case 'uncommon': return 'UNCOMMON ACHIEVEMENT'
      default: return 'ACHIEVEMENT UNLOCKED'
    }
  }

  const RarityIcon = getRarityIcon(achievement.rarity)

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${className}`}
          onClick={onComplete}
        >
          {/* Particle Effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${particle.x}%`,
                  top: `${particle.y}%`,
                  backgroundColor: particle.color
                }}
                animate={{
                  y: [0, -100, -200],
                  opacity: [1, 0.8, 0],
                  scale: [1, 1.5, 0]
                }}
                transition={{ 
                  duration: 3,
                  ease: 'easeOut',
                  delay: Math.random() * 0.5
                }}
              />
            ))}
          </div>

          {/* Main Achievement Card */}
          <motion.div
            initial={{ scale: 0, rotateY: -180 }}
            animate={{ 
              scale: animationPhase === 'reveal' ? 1 : animationPhase === 'celebration' ? 1.05 : 0.95,
              rotateY: animationPhase === 'intro' ? -180 : 0
            }}
            transition={{ 
              type: 'spring',
              stiffness: 150,
              damping: 20,
              duration: 0.8
            }}
            className="relative max-w-lg w-full mx-4"
          >
            {/* Glow Effect */}
            <div 
              className={`absolute -inset-4 bg-gradient-to-r ${getRarityGradient(achievement.rarity)} rounded-2xl opacity-20 blur-xl animate-pulse`}
            />
            
            {/* Card Content */}
            <div className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border-4 p-8 text-center shadow-2xl`}
                 style={{ borderColor: getRarityColor(achievement.rarity) }}>
              
              {/* Rarity Badge */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`inline-block px-4 py-1 rounded-full text-xs font-bold text-white mb-4 bg-gradient-to-r ${getRarityGradient(achievement.rarity)}`}
              >
                {getRarityTitle(achievement.rarity)}
              </motion.div>

              {/* Achievement Icon */}
              <motion.div
                animate={{ 
                  rotate: animationPhase === 'celebration' ? 360 : 0,
                  scale: animationPhase === 'celebration' ? 1.1 : 1
                }}
                transition={{ duration: 2, type: 'spring' }}
                className="mb-6 relative"
              >
                <div className="relative">
                  <RarityIcon 
                    className="w-24 h-24 mx-auto"
                    style={{ color: getRarityColor(achievement.rarity) }}
                  />
                  
                  {/* Icon Glow */}
                  <div 
                    className="absolute inset-0 blur-lg opacity-30"
                    style={{ backgroundColor: getRarityColor(achievement.rarity) }}
                  />
                </div>

                {/* Sparkles around icon */}
                {animationPhase === 'celebration' && (
                  <>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <motion.div
                        key={`icon-sparkle-${i}`}
                        className="absolute"
                        style={{
                          left: '50%',
                          top: '50%',
                          transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-60px)`
                        }}
                        animate={{
                          opacity: [0, 1, 0],
                          scale: [0.5, 1.2, 0.5]
                        }}
                        transition={{
                          duration: 1.5,
                          delay: i * 0.1,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                      >
                        <Sparkles className="w-4 h-4 text-yellow-300" />
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>

              {/* Achievement Name */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-bold text-white mb-3"
              >
                {achievement.name}
              </motion.h2>

              {/* Achievement Description */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-gray-300 mb-6"
              >
                {achievement.description}
              </motion.p>

              {/* Rewards */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="flex justify-center gap-6 mb-4"
              >
                <div className="flex items-center gap-2 text-theme-accent">
                  <Zap className="w-5 h-5" />
                  <span className="font-semibold">+{achievement.experience_reward} XP</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-400">
                  <Star className="w-5 h-5" />
                  <span className="font-semibold">+{achievement.gold_reward} Gold</span>
                </div>
              </motion.div>

              {/* Continue Hint */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: animationPhase === 'celebration' ? 1 : 0.5 }}
                transition={{ delay: 2 }}
                className="text-sm text-gray-400"
              >
                Click anywhere to continue
              </motion.div>
            </div>
          </motion.div>

          {/* Background Stars */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <motion.div
                key={`bg-star-${i}`}
                className="absolute"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                  rotate: [0, 180, 360]
                }}
                transition={{
                  duration: 4,
                  delay: Math.random() * 3,
                  repeat: Infinity,
                  repeatDelay: Math.random() * 5
                }}
              >
                <Star 
                  className="w-3 h-3"
                  style={{ color: getRarityColor(achievement.rarity) }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default AchievementAnimation