import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useGameStore } from '../../../store/gameStore';

// Solo Leveling style level up animation
export const SoloLevelUpAnimation: React.FC<{ 
  isVisible: boolean; 
  newLevel: number;
  onComplete?: () => void;
}> = ({ isVisible, newLevel, onComplete }) => {
  const particleVariants: Variants = {
    initial: { 
      opacity: 0, 
      scale: 0,
      y: 0 
    },
    animate: (i: number) => ({
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
      y: [-100, -200, -300],
      transition: {
        duration: 2,
        delay: i * 0.1,
        ease: "easeOut"
      }
    })
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={onComplete}
          className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        >
          {/* Dark aura effect */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 2, 2.5, 2],
              opacity: [0, 0.5, 0.3, 0]
            }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-[800px] h-[800px] bg-gradient-radial from-purple-900/50 via-black/30 to-transparent rounded-full blur-3xl" />
          </motion.div>

          {/* Energy particles */}
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="initial"
              animate="animate"
              variants={particleVariants}
              className="absolute"
              style={{
                left: `${45 + Math.random() * 10}%`,
                top: `${45 + Math.random() * 10}%`,
              }}
            >
              <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full shadow-lg shadow-purple-500/50" />
            </motion.div>
          ))}

          {/* Main level up text */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ 
              scale: [0, 1.5, 1],
              rotate: [- 180, 0, 0]
            }}
            transition={{ 
              duration: 1,
              ease: [0.68, -0.55, 0.265, 1.55]
            }}
            className="relative"
          >
            {/* Glowing background */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 blur-2xl opacity-50"
            />
            
            {/* Text container */}
            <div className="relative bg-black/90 border-2 border-purple-500 rounded-lg p-12 backdrop-blur-xl">
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  textShadow: [
                    "0 0 20px rgba(147, 51, 234, 0.5)",
                    "0 0 40px rgba(147, 51, 234, 1)",
                    "0 0 20px rgba(147, 51, 234, 0.5)"
                  ]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 tracking-wider">
                  LEVEL UP!
                </h1>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-4xl text-white mt-4 text-center font-bold"
              >
                Level {newLevel}
              </motion.p>

              {/* Power surge lines */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Solo Leveling style stat increase animation
export const StatIncreaseAnimation: React.FC<{
  stat: string;
  oldValue: number;
  newValue: number;
  isVisible: boolean;
}> = ({ stat, oldValue, newValue, isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="flex items-center space-x-4 p-4 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg border border-purple-500/30"
        >
          <div className="text-purple-400 font-bold text-lg uppercase tracking-wider">
            {stat}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-xl">{oldValue}</span>
            
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.5, 1]
              }}
              transition={{ duration: 0.5 }}
              className="text-purple-500 text-2xl"
            >
              →
            </motion.div>
            
            <motion.span
              initial={{ scale: 0 }}
              animate={{ 
                scale: [0, 1.5, 1],
                color: ["#9333ea", "#3b82f6", "#10b981"]
              }}
              transition={{ duration: 0.7 }}
              className="text-2xl font-bold"
            >
              {newValue}
            </motion.span>
            
            <motion.span
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: [0, 1, 0], y: [-20, -40, -60] }}
              transition={{ duration: 1.5 }}
              className="text-green-400 text-lg font-bold ml-2"
            >
              +{newValue - oldValue}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Solo Leveling style power gauge
export const PowerGauge: React.FC<{
  current: number;
  max: number;
  label: string;
  color?: string;
}> = ({ current, max, label, color = "purple" }) => {
  const percentage = (current / max) * 100;
  
  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm font-bold text-white">
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      
      <div className="relative h-8 bg-gray-900 rounded-full overflow-hidden border border-gray-700">
        {/* Background glow */}
        <motion.div
          animate={{ 
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute inset-0 bg-gradient-to-r from-${color}-600/20 to-${color}-400/20`}
        />
        
        {/* Fill bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ 
            duration: 1,
            ease: "easeOut"
          }}
          className="relative h-full overflow-hidden"
        >
          {/* Gradient fill */}
          <div className={`h-full bg-gradient-to-r from-${color}-600 to-${color}-400`}>
            {/* Animated shine effect */}
            <motion.div
              animate={{ 
                x: ["-100%", "200%"]
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
            />
          </div>
        </motion.div>
        
        {/* Power surge effect at high percentage */}
        {percentage > 80 && (
          <motion.div
            animate={{ 
              opacity: [0, 0.5, 0]
            }}
            transition={{ 
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          />
        )}
      </div>
    </div>
  );
};

// Solo Leveling style rank badge
export const RankBadge: React.FC<{
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';
}> = ({ rank }) => {
  const rankColors = {
    E: 'from-gray-600 to-gray-400',
    D: 'from-brown-600 to-brown-400',
    C: 'from-green-600 to-green-400',
    B: 'from-blue-600 to-blue-400',
    A: 'from-purple-600 to-purple-400',
    S: 'from-yellow-600 to-yellow-400',
    SS: 'from-orange-600 to-orange-400',
    SSS: 'from-red-600 via-orange-500 to-yellow-400'
  };

  const glowColors = {
    E: 'shadow-gray-500/50',
    D: 'shadow-brown-500/50',
    C: 'shadow-green-500/50',
    B: 'shadow-blue-500/50',
    A: 'shadow-purple-500/50',
    S: 'shadow-yellow-500/50',
    SS: 'shadow-orange-500/50',
    SSS: 'shadow-red-500/50'
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.1 }}
      className={`relative w-24 h-24 flex items-center justify-center`}
    >
      {/* Outer ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className={`absolute inset-0 rounded-full bg-gradient-to-r ${rankColors[rank]} opacity-20 blur-xl`}
      />
      
      {/* Inner badge */}
      <div className={`relative w-20 h-20 bg-gradient-to-br ${rankColors[rank]} rounded-lg shadow-2xl ${glowColors[rank]} flex items-center justify-center transform rotate-45`}>
        <span className="text-4xl font-black text-white transform -rotate-45 tracking-wider">
          {rank}
        </span>
      </div>
      
      {/* Corner accents */}
      {['S', 'SS', 'SSS'].includes(rank) && (
        <>
          {[0, 90, 180, 270].map((rotation) => (
            <motion.div
              key={rotation}
              animate={{ 
                opacity: [0.5, 1, 0.5],
                scale: [0.8, 1, 0.8]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                delay: rotation / 360
              }}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{
                transform: `rotate(${rotation}deg) translateY(-45px)`
              }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
};

// System window notification (like in Solo Leveling)
export const SystemNotification: React.FC<{
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'quest';
  isVisible: boolean;
  onClose?: () => void;
}> = ({ title, message, type = 'info', isVisible, onClose }) => {
  const typeStyles = {
    info: 'border-blue-500 bg-blue-900/20',
    warning: 'border-yellow-500 bg-yellow-900/20',
    success: 'border-green-500 bg-green-900/20',
    quest: 'border-purple-500 bg-purple-900/20'
  };

  const typeGlows = {
    info: 'shadow-blue-500/50',
    warning: 'shadow-yellow-500/50',
    success: 'shadow-green-500/50',
    quest: 'shadow-purple-500/50'
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-[90] max-w-md"
        >
          <div className={`relative p-6 rounded-lg border-2 ${typeStyles[type]} backdrop-blur-xl shadow-2xl ${typeGlows[type]}`}>
            {/* System label */}
            <div className="absolute -top-3 left-4 px-2 bg-gray-900 text-xs font-bold text-gray-400 uppercase tracking-wider">
              System
            </div>
            
            {/* Content */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">{title}</h3>
              <p className="text-gray-300">{message}</p>
            </div>
            
            {/* Close button */}
            {onClose && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-2 right-2 text-gray-500 hover:text-white"
              >
                ✕
              </motion.button>
            )}
            
            {/* Animated border */}
            <motion.div
              animate={{ 
                rotate: [0, 360]
              }}
              transition={{ 
                duration: 10,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${type === 'quest' ? 'purple' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'}, transparent)`
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};