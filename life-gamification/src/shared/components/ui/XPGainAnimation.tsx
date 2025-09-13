import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Star, Plus } from 'lucide-react'

interface XPGainAnimationProps {
  isVisible: boolean
  xpAmount: number
  reason?: string
  onComplete: () => void
  position?: { x: number; y: number }
  className?: string
}

interface FloatingXP {
  id: string
  amount: number
  x: number
  y: number
  delay: number
}

const XPGainAnimation = ({
  isVisible,
  xpAmount,
  reason,
  onComplete,
  position = { x: 50, y: 50 },
  className = ''
}: XPGainAnimationProps) => {
  const [floatingXPs, setFloatingXPs] = useState<FloatingXP[]>([])

  useEffect(() => {
    if (!isVisible) return

    // Break down large XP amounts into smaller floating numbers
    const chunks = []
    let remaining = xpAmount
    let chunkId = 0

    if (xpAmount <= 50) {
      chunks.push({ id: `xp-${chunkId++}`, amount: xpAmount, x: position.x, y: position.y, delay: 0 })
    } else {
      // Split large amounts into multiple chunks for visual impact
      while (remaining > 0) {
        const chunkSize = Math.min(remaining, Math.random() * 20 + 10)
        chunks.push({
          id: `xp-${chunkId++}`,
          amount: Math.round(chunkSize),
          x: position.x + (Math.random() - 0.5) * 20,
          y: position.y + (Math.random() - 0.5) * 20,
          delay: chunkId * 0.1
        })
        remaining -= chunkSize
      }
    }

    setFloatingXPs(chunks)

    // Auto-complete after animation
    const timeout = setTimeout(() => {
      onComplete()
    }, 2000 + chunks.length * 100)

    return () => {
      clearTimeout(timeout)
      setFloatingXPs([])
    }
  }, [isVisible, xpAmount, position.x, position.y, onComplete])

  const getXPColor = (amount: number) => {
    if (amount >= 100) return 'from-yellow-400 to-orange-500'
    if (amount >= 50) return 'from-blue-400 to-purple-500'
    if (amount >= 25) return 'from-green-400 to-blue-500'
    return 'from-cyan-400 to-blue-400'
  }

  const getXPSize = (amount: number) => {
    if (amount >= 100) return 'text-2xl'
    if (amount >= 50) return 'text-xl'
    if (amount >= 25) return 'text-lg'
    return 'text-base'
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <div className={`fixed inset-0 pointer-events-none z-40 ${className}`}>
          {/* Main XP Display */}
          <motion.div
            className="absolute"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              scale: [0.5, 1.2, 1, 0.8],
              y: [0, -30, -50, -80]
            }}
            transition={{ duration: 2, ease: 'easeOut' }}
          >
            <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${getXPColor(xpAmount)} rounded-full shadow-lg border border-white/20`}>
              <Zap className="w-5 h-5 text-white" />
              <span className={`font-bold text-white ${getXPSize(xpAmount)}`}>
                +{xpAmount} XP
              </span>
            </div>
            
            {reason && (
              <motion.div
                className="text-center mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <span className="text-sm text-white/90 bg-black/50 px-2 py-1 rounded">
                  {reason}
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Floating XP Chunks */}
          {floatingXPs.map((floatingXP) => (
            <motion.div
              key={floatingXP.id}
              className="absolute"
              style={{
                left: `${floatingXP.x}%`,
                top: `${floatingXP.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              initial={{ opacity: 0, scale: 0, y: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0],
                y: [0, -40],
                x: [(Math.random() - 0.5) * 20]
              }}
              transition={{ 
                duration: 1.5,
                delay: floatingXP.delay,
                ease: 'easeOut'
              }}
            >
              <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-cyan-400/80 to-blue-400/80 rounded-full text-white text-sm font-semibold shadow-lg">
                <Plus className="w-3 h-3" />
                {floatingXP.amount}
              </div>
            </motion.div>
          ))}

          {/* Sparkle Effects */}
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute"
              style={{
                left: `${position.x + (Math.random() - 0.5) * 40}%`,
                top: `${position.y + (Math.random() - 0.5) * 40}%`
              }}
              initial={{ opacity: 0, scale: 0, rotate: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, Math.random() * 0.8 + 0.5, 0],
                rotate: [0, 360],
                x: [(Math.random() - 0.5) * 60],
                y: [(Math.random() - 0.5) * 60]
              }}
              transition={{ 
                duration: 1.5,
                delay: Math.random() * 0.8,
                ease: 'easeOut'
              }}
            >
              <Star className="w-4 h-4 text-yellow-300" />
            </motion.div>
          ))}

          {/* Ripple Effect */}
          <motion.div
            className="absolute border-2 border-cyan-400/30 rounded-full"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ width: 0, height: 0, opacity: 0.6 }}
            animate={{ 
              width: 200, 
              height: 200, 
              opacity: 0 
            }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      )}
    </AnimatePresence>
  )
}

export default XPGainAnimation