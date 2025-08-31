import { ReactNode, useState, useEffect } from 'react';

interface FadeInProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export const FadeIn = ({ 
  children, 
  className = '', 
  delay = 0, 
  duration = 500,
  direction = 'none' 
}: FadeInProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const directionClasses = {
    up: isVisible ? 'translate-y-0' : 'translate-y-4',
    down: isVisible ? 'translate-y-0' : '-translate-y-4', 
    left: isVisible ? 'translate-x-0' : 'translate-x-4',
    right: isVisible ? 'translate-x-0' : '-translate-x-4',
    none: ''
  };

  return (
    <div
      className={`transition-all duration-${duration} ${
        isVisible ? 'opacity-100' : 'opacity-0'
      } ${directionClasses[direction]} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

interface SlideInProps {
  children: ReactNode;
  isVisible: boolean;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
  duration?: number;
}

export const SlideIn = ({ 
  children, 
  isVisible, 
  direction = 'right', 
  className = '',
  duration = 300 
}: SlideInProps) => {
  const directionClasses = {
    left: isVisible ? 'translate-x-0' : '-translate-x-full',
    right: isVisible ? 'translate-x-0' : 'translate-x-full',
    up: isVisible ? 'translate-y-0' : '-translate-y-full',
    down: isVisible ? 'translate-y-0' : 'translate-y-full'
  };

  return (
    <div
      className={`transition-transform duration-${duration} ease-out ${directionClasses[direction]} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

interface ScaleInProps {
  children: ReactNode;
  isVisible: boolean;
  className?: string;
  duration?: number;
}

export const ScaleIn = ({ 
  children, 
  isVisible, 
  className = '',
  duration = 200 
}: ScaleInProps) => {
  return (
    <div
      className={`transition-all duration-${duration} ease-out ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      } ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

interface StaggeredListProps {
  children: ReactNode[];
  className?: string;
  delay?: number;
}

export const StaggeredList = ({ children, className = '', delay = 100 }: StaggeredListProps) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={index * delay} direction="up" duration={300}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

// Animated progress bar component
interface AnimatedProgressBarProps {
  progress: number;
  className?: string;
  color?: string;
  height?: string;
  duration?: number;
}

export const AnimatedProgressBar = ({ 
  progress, 
  className = '', 
  color = 'bg-gradient-to-r from-solo-accent to-solo-secondary',
  height = 'h-2',
  duration = 1000
}: AnimatedProgressBarProps) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className={`bg-gray-800 rounded-full overflow-hidden ${height} ${className}`}>
      <div 
        className={`${height} ${color} rounded-full transition-all ease-out`}
        style={{ 
          width: `${Math.min(100, Math.max(0, animatedProgress))}%`,
          transitionDuration: `${duration}ms`
        }}
      />
    </div>
  );
};

// Floating notification/toast
interface FloatingNotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  isVisible: boolean;
  duration?: number;
  onClose: () => void;
}

export const FloatingNotification = ({ 
  message, 
  type = 'info', 
  isVisible, 
  duration = 3000,
  onClose 
}: FloatingNotificationProps) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  const typeColors = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500', 
    warning: 'bg-yellow-600 border-yellow-500',
    info: 'bg-blue-600 border-blue-500'
  };

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`px-4 py-3 rounded-lg border ${typeColors[type]} text-white shadow-lg max-w-sm`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{message}</p>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};