// Error types and interfaces
export enum ErrorType {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE', 
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: Date;
  userMessage: string;
  recoverable: boolean;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: number;
  taskId?: number;
  additionalData?: Record<string, any>;
}

// Error classification and user-friendly messages
export class ErrorHandler {
  static classifyError(error: any, context?: ErrorContext): AppError {
    const timestamp = new Date();
    
    // Network errors
    if (error.message?.includes('fetch') || error.message?.includes('network')) {
      return {
        type: ErrorType.NETWORK,
        message: error.message,
        details: { context, originalError: error },
        timestamp,
        userMessage: 'Connection problem. Please check your internet connection.',
        recoverable: true
      };
    }
    
    // Database errors
    if (error.message?.includes('database') || error.message?.includes('SQL')) {
      return {
        type: ErrorType.DATABASE,
        message: error.message,
        details: { context, originalError: error },
        timestamp,
        userMessage: 'Data save failed. Your progress might not be saved.',
        recoverable: true
      };
    }
    
    // Validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return {
        type: ErrorType.VALIDATION,
        message: error.message,
        details: { context, originalError: error },
        timestamp,
        userMessage: 'Please check your input and try again.',
        recoverable: true
      };
    }
    
    // Tauri invoke errors
    if (error.message?.includes('invoke')) {
      return {
        type: ErrorType.DATABASE,
        message: error.message,
        details: { context, originalError: error },
        timestamp,
        userMessage: 'Action failed. Please try again.',
        recoverable: true
      };
    }
    
    // Default unknown error
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || 'An unexpected error occurred',
      details: { context, originalError: error },
      timestamp,
      userMessage: 'Something went wrong. Please try refreshing the app.',
      recoverable: false
    };
  }
  
  static async handleError(error: any, context?: ErrorContext): Promise<AppError> {
    const appError = this.classifyError(error, context);
    
    // Log error
    await this.logError(appError);
    
    // Report to analytics/monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(appError);
    }
    
    return appError;
  }
  
  private static async logError(error: AppError): Promise<void> {
    const logEntry = {
      level: 'ERROR',
      timestamp: error.timestamp.toISOString(),
      type: error.type,
      message: error.message,
      userMessage: error.userMessage,
      recoverable: error.recoverable,
      details: error.details
    };
    
    console.error('App Error:', logEntry);
    
    // Store in local storage for debugging
    try {
      const existingLogs = JSON.parse(localStorage.getItem('app_errors') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 50 errors
      const recentLogs = existingLogs.slice(-50);
      localStorage.setItem('app_errors', JSON.stringify(recentLogs));
    } catch (e) {
      console.warn('Failed to store error log:', e);
    }
  }
  
  private static reportError(error: AppError): void {
    // In production, send to monitoring service like Sentry
    console.info('Error reported to monitoring service:', error.type);
  }
}

// React error boundary hook
import { useState, useEffect } from 'react';

export const useErrorHandler = () => {
  const [error, setError] = useState<AppError | null>(null);
  
  const handleError = async (err: any, context?: ErrorContext) => {
    const appError = await ErrorHandler.handleError(err, context);
    setError(appError);
    return appError;
  };
  
  const clearError = () => setError(null);
  
  // Auto-clear recoverable errors after 5 seconds
  useEffect(() => {
    if (error?.recoverable) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);
  
  return { error, handleError, clearError };
};

// Utility for wrapping async operations
export const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<{ data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    return { data };
  } catch (err) {
    const error = await ErrorHandler.handleError(err, context);
    return { error };
  }
};