import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Volume2, 
  VolumeX, 
  Music, 
  Gamepad2, 
  Bell, 
  Settings, 
  Play,
  RotateCcw,
  TestTube
} from 'lucide-react'
import { useAudio } from '../audio/AudioManager'
import { useGameAudio } from '../../../hooks/useGameAudio'

interface SoundSettingsProps {
  className?: string
}

const SoundSettings = ({ className = '' }: SoundSettingsProps) => {
  const audio = useAudio()
  const gameAudio = useGameAudio()
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false)

  const handleVolumeChange = useCallback((type: 'master' | 'sfx' | 'music', value: number) => {
    const volumeUpdate = type === 'master' 
      ? { masterVolume: value / 100 }
      : type === 'sfx'
      ? { sfxVolume: value / 100 }
      : { musicVolume: value / 100 }
    
    audio.updateSettings(volumeUpdate)
  }, [audio])

  const handleToggle = useCallback((type: 'sfx' | 'music' | 'notifications') => {
    const toggleUpdate = type === 'sfx'
      ? { enableSoundEffects: !audio.settings.enableSoundEffects }
      : type === 'music'
      ? { enableMusic: !audio.settings.enableMusic }
      : { enableNotificationSounds: !audio.settings.enableNotificationSounds }
    
    audio.updateSettings(toggleUpdate)
  }, [audio])

  const resetToDefaults = useCallback(() => {
    audio.updateSettings({
      masterVolume: 0.7,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      enableSoundEffects: true,
      enableMusic: true,
      enableNotificationSounds: true
    })
  }, [audio])

  const VolumeSlider = ({ 
    label, 
    value, 
    onChange, 
    icon: Icon, 
    disabled = false,
    color = 'theme-accent'
  }: {
    label: string
    value: number
    onChange: (value: number) => void
    icon: any
    disabled?: boolean
    color?: string
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${disabled ? 'text-gray-500' : `text-${color}`}`} />
          <span className={`text-sm font-medium ${disabled ? 'text-gray-500' : 'text-white'}`}>
            {label}
          </span>
        </div>
        <span className={`text-sm ${disabled ? 'text-gray-500' : 'text-gray-400'}`}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider ${disabled ? 'opacity-50' : ''}`}
          style={{
            background: disabled 
              ? '#374151'
              : `linear-gradient(to right, var(--color-${color}) 0%, var(--color-${color}) ${value}%, #374151 ${value}%, #374151 100%)`
          }}
        />
      </div>
    </div>
  )

  const ToggleButton = ({ 
    label, 
    enabled, 
    onToggle, 
    icon: Icon,
    description 
  }: {
    label: string
    enabled: boolean
    onToggle: () => void
    icon: any
    description: string
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${enabled ? 'text-theme-accent' : 'text-gray-500'}`} />
        <div>
          <div className={`font-medium ${enabled ? 'text-white' : 'text-gray-400'}`}>
            {label}
          </div>
          <div className="text-xs text-gray-500">
            {description}
          </div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
          enabled ? 'bg-theme-accent' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )

  const SoundTestButton = ({ 
    label, 
    onClick, 
    icon: Icon,
    disabled = false
  }: {
    label: string
    onClick: () => void
    icon: any
    disabled?: boolean
  }) => (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        disabled 
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-gray-700 hover:bg-gray-600 text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </motion.button>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-theme-accent" />
          <h3 className="text-lg font-semibold text-white">Audio Settings</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTestPanelOpen(!isTestPanelOpen)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
          >
            <TestTube className="w-4 h-4" />
            Test Sounds
          </button>
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Loading Status */}
      {!audio.isLoaded && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <Settings className="w-4 h-4 text-yellow-400 animate-spin" />
          <span className="text-sm text-yellow-400">Loading audio system...</span>
        </div>
      )}

      {/* Volume Controls */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Volume Controls</h4>
        
        <VolumeSlider
          label="Master Volume"
          value={Math.round(audio.settings.masterVolume * 100)}
          onChange={(value) => handleVolumeChange('master', value)}
          icon={Volume2}
          color="theme-accent"
        />

        <VolumeSlider
          label="Sound Effects"
          value={Math.round(audio.settings.sfxVolume * 100)}
          onChange={(value) => handleVolumeChange('sfx', value)}
          icon={Gamepad2}
          disabled={!audio.settings.enableSoundEffects}
          color="green-500"
        />

        <VolumeSlider
          label="Music"
          value={Math.round(audio.settings.musicVolume * 100)}
          onChange={(value) => handleVolumeChange('music', value)}
          icon={Music}
          disabled={!audio.settings.enableMusic}
          color="purple-500"
        />
      </div>

      {/* Audio Category Toggles */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Audio Categories</h4>
        
        <ToggleButton
          label="Sound Effects"
          enabled={audio.settings.enableSoundEffects}
          onToggle={() => handleToggle('sfx')}
          icon={Gamepad2}
          description="Task completion, level up, achievement sounds"
        />

        <ToggleButton
          label="Background Music"
          enabled={audio.settings.enableMusic}
          onToggle={() => handleToggle('music')}
          icon={Music}
          description="Ambient music and theme songs"
        />

        <ToggleButton
          label="Notifications"
          enabled={audio.settings.enableNotificationSounds}
          onToggle={() => handleToggle('notifications')}
          icon={Bell}
          description="Alert sounds and system notifications"
        />
      </div>

      {/* Sound Test Panel */}
      {isTestPanelOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Test Sounds</h4>
          
          <div className="p-4 bg-gray-800/50 rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <SoundTestButton
                label="Task Complete"
                onClick={() => gameAudio.playTaskCompletionAudio({ xpAmount: 50 })}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableSoundEffects}
              />
              
              <SoundTestButton
                label="Level Up"
                onClick={() => gameAudio.playLevelUpAudio({ newLevel: 25, previousLevel: 24 })}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableSoundEffects}
              />
              
              <SoundTestButton
                label="Achievement"
                onClick={() => gameAudio.playAchievementAudio({ 
                  achievement: { 
                    id: 1, 
                    name: 'Test Achievement', 
                    description: 'Test description',
                    rarity: 'epic' as const,
                    experience_reward: 100,
                    gold_reward: 50
                  }
                })}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableSoundEffects}
              />
              
              <SoundTestButton
                label="XP Gain"
                onClick={() => gameAudio.playXPGainAudio(75)}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableSoundEffects}
              />
              
              <SoundTestButton
                label="Button Click"
                onClick={() => gameAudio.playButtonClickAudio()}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableSoundEffects}
              />
              
              <SoundTestButton
                label="Notification"
                onClick={() => gameAudio.playNotificationAudio('success')}
                icon={Play}
                disabled={!audio.isLoaded || !audio.settings.enableNotificationSounds}
              />
            </div>
            
            <div className="pt-2 border-t border-gray-700">
              <SoundTestButton
                label="Stop All Sounds"
                onClick={() => gameAudio.stopAllSounds()}
                icon={VolumeX}
                disabled={!audio.isLoaded}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Audio Info */}
      <div className="text-xs text-gray-500 p-3 bg-gray-800/30 rounded-lg">
        <p>🎵 Audio files will be loaded automatically. If files are missing, procedural sounds will be generated using Web Audio API.</p>
        <p className="mt-1">🔊 All settings are saved automatically and persist between sessions.</p>
      </div>
    </div>
  )
}

export default SoundSettings