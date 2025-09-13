import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle, Trophy, Star, Zap, TrendingUp, Gift, Crown, Award } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'achievement' | 'xp' | 'levelup' | 'rare_drop';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  data?: {
    xpAmount?: number;
    newLevel?: number;
    previousLevel?: number;
    achievementRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    [key: string]: any;
  };
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, persistent?: boolean) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  achievement: (title: string, message?: string, rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary', duration?: number) => void;
  xpGain: (amount: number, reason?: string, duration?: number) => void;
  levelUp: (newLevel: number, previousLevel: number, duration?: number) => void;
  rareDrop: (itemName: string, rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider = ({ children, maxToasts = 5 }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      duration: 4000,
      ...toast
    };

    setToasts(prev => {
      const updated = [newToast, ...prev].slice(0, maxToasts);
      return updated;
    });

    // Auto remove non-persistent toasts
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => removeToast(id), newToast.duration);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (title: string, message?: string, duration = 3000) => {
    addToast({ type: 'success', title, message, duration });
  };

  const error = (title: string, message?: string, persistent = false) => {
    addToast({ type: 'error', title, message, persistent, duration: persistent ? 0 : 5000 });
  };

  const warning = (title: string, message?: string, duration = 4000) => {
    addToast({ type: 'warning', title, message, duration });
  };

  const info = (title: string, message?: string, duration = 3000) => {
    addToast({ type: 'info', title, message, duration });
  };

  const achievement = (title: string, message?: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common', duration = 6000) => {
    addToast({ 
      type: 'achievement', 
      title, 
      message, 
      duration,
      data: { achievementRarity: rarity }
    });
  };

  const xpGain = (amount: number, reason = 'Task completed', duration = 4000) => {
    addToast({ 
      type: 'xp', 
      title: `+${amount} XP`, 
      message: reason,
      duration,
      data: { xpAmount: amount }
    });
  };

  const levelUp = (newLevel: number, previousLevel: number, duration = 8000) => {
    addToast({ 
      type: 'levelup', 
      title: `Level Up!`, 
      message: `Reached Level ${newLevel}`,
      duration,
      data: { newLevel, previousLevel }
    });
  };

  const rareDrop = (itemName: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common', duration = 5000) => {
    addToast({ 
      type: 'rare_drop', 
      title: 'Rare Drop!', 
      message: `Found ${itemName}`,
      duration,
      data: { itemRarity: rarity }
    });
  };

  return (
    <ToastContext.Provider value={{
      addToast,
      removeToast,
      success,
      error,
      warning,
      info,
      achievement,
      xpGain,
      levelUp,
      rareDrop
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isGlowing, setIsGlowing] = useState(false);

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    
    // Special animations for certain toast types
    if (['achievement', 'levelup', 'rare_drop'].includes(toast.type)) {
      const shakeTimer = setTimeout(() => setIsShaking(true), 200);
      const glowTimer = setTimeout(() => setIsGlowing(true), 400);
      
      // Stop animations after some time
      const stopShakeTimer = setTimeout(() => setIsShaking(false), 1500);
      const stopGlowTimer = setTimeout(() => setIsGlowing(false), 2000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(shakeTimer);
        clearTimeout(glowTimer);
        clearTimeout(stopShakeTimer);
        clearTimeout(stopGlowTimer);
      };
    }
    
    return () => clearTimeout(timer);
  }, [toast.type]);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const typeConfig: Record<string, { icon: any; className: string; iconColor: string }> = {
    success: {
      icon: CheckCircle,
      className: 'bg-green-600 border-green-500',
      iconColor: 'text-green-200'
    },
    error: {
      icon: AlertCircle,
      className: 'bg-red-600 border-red-500',
      iconColor: 'text-red-200'
    },
    warning: {
      icon: AlertTriangle,
      className: 'bg-yellow-600 border-yellow-500',
      iconColor: 'text-yellow-200'
    },
    info: {
      icon: Info,
      className: 'bg-blue-600 border-blue-500',
      iconColor: 'text-blue-200'
    },
    achievement: {
      icon: Award,
      className: 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-500',
      iconColor: 'text-yellow-300'
    },
    xp: {
      icon: Zap,
      className: 'bg-gradient-to-r from-blue-600 to-cyan-600 border-blue-500',
      iconColor: 'text-yellow-300'
    },
    levelup: {
      icon: TrendingUp,
      className: 'bg-gradient-to-r from-orange-600 to-red-600 border-orange-500',
      iconColor: 'text-yellow-300'
    },
    rare_drop: {
      icon: Gift,
      className: 'bg-gradient-to-r from-purple-700 to-indigo-700 border-purple-600',
      iconColor: 'text-yellow-300'
    }
  };

  const { icon: Icon, className, iconColor } = typeConfig[toast.type] || typeConfig.info;

  const isSpecialType = ['achievement', 'levelup', 'rare_drop'].includes(toast.type);
  
  return (
    <div className={`transition-all duration-300 transform ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    } ${
      isShaking ? 'animate-bounce' : ''
    } ${
      isGlowing ? 'animate-pulse' : ''
    }`}>
      <div className={`${className} border rounded-lg p-4 shadow-lg text-white max-w-sm ${
        isSpecialType ? 'animate-pulse' : ''
      }`}>
        <div className="flex items-start gap-3">
          <div className="relative">
            <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5 ${
              isSpecialType ? 'animate-spin' : ''
            }`} 
            style={{
              animationDuration: isSpecialType ? '2s' : undefined,
              animationIterationCount: isSpecialType ? '3' : undefined
            }} />
            {isSpecialType && (
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-purple-400 rounded-full opacity-75 animate-ping" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-white ${
              toast.type === 'levelup' ? 'text-lg font-bold' : ''
            } ${
              toast.type === 'achievement' ? 'font-semibold' : ''
            }`}>{toast.title}</p>
            {toast.message && (
              <p className="text-sm text-white/90 mt-1">{toast.message}</p>
            )}
            {toast.type === 'xp' && toast.data?.xpAmount && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div className="bg-yellow-400 h-2 rounded-full w-full animate-pulse" />
                </div>
                <Zap className="w-3 h-3 text-yellow-400" />
              </div>
            )}
            {toast.type === 'levelup' && toast.data?.newLevel && (
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium">
                  Level {toast.data.previousLevel} → {toast.data.newLevel}
                </span>
              </div>
            )}
            {(toast.type === 'achievement' || toast.type === 'rare_drop') && toast.data && (
              <div className="mt-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  toast.data.achievementRarity === 'legendary' || toast.data.itemRarity === 'legendary' ? 'bg-yellow-500/30 text-yellow-200' :
                  toast.data.achievementRarity === 'epic' || toast.data.itemRarity === 'epic' ? 'bg-purple-500/30 text-purple-200' :
                  toast.data.achievementRarity === 'rare' || toast.data.itemRarity === 'rare' ? 'bg-blue-500/30 text-blue-200' :
                  toast.data.achievementRarity === 'uncommon' || toast.data.itemRarity === 'uncommon' ? 'bg-green-500/30 text-green-200' :
                  'bg-gray-500/30 text-gray-200'
                }`}>
                  {(toast.data.achievementRarity || toast.data.itemRarity || 'common').toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="text-white/80 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};