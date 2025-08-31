import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, persistent?: boolean) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
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

  return (
    <ToastContext.Provider value={{
      addToast,
      removeToast,
      success,
      error,
      warning,
      info
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

  useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const typeConfig = {
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
    }
  };

  const { icon: Icon, className, iconColor } = typeConfig[toast.type];

  return (
    <div className={`transition-all duration-300 transform ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`${className} border rounded-lg p-4 shadow-lg text-white max-w-sm`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white">{toast.title}</p>
            {toast.message && (
              <p className="text-sm text-white/90 mt-1">{toast.message}</p>
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