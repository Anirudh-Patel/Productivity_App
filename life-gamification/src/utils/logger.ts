export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  component?: string;
  action?: string;
  message: string;
  data?: any;
  userId?: number;
}

class Logger {
  private static instance: Logger;
  private minLevel: LogLevel;
  private maxLogs: number = 200;
  
  private constructor() {
    this.minLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }
  
  private createLogEntry(
    level: keyof typeof LogLevel,
    message: string,
    data?: any,
    component?: string,
    action?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      action,
      message,
      data,
      userId: this.getCurrentUserId()
    };
  }
  
  private getCurrentUserId(): number | undefined {
    // Get current user ID from store or storage
    try {
      const userStr = localStorage.getItem('current_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.id;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    return undefined;
  }
  
  private persistLog(entry: LogEntry): void {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      existingLogs.push(entry);
      
      // Keep only recent logs
      const recentLogs = existingLogs.slice(-this.maxLogs);
      localStorage.setItem('app_logs', JSON.stringify(recentLogs));
    } catch (e) {
      console.warn('Failed to persist log entry:', e);
    }
  }
  
  private outputToConsole(entry: LogEntry): void {
    const { timestamp, level, component, action, message, data } = entry;
    const prefix = `[${timestamp}] ${level}${component ? ` [${component}]` : ''}${action ? ` (${action})` : ''}:`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, data || '');
        break;
      case 'INFO':
        console.info(prefix, message, data || '');
        break;
      case 'WARN':
        console.warn(prefix, message, data || '');
        break;
      case 'ERROR':
        console.error(prefix, message, data || '');
        break;
    }
  }
  
  debug(message: string, data?: any, component?: string, action?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry = this.createLogEntry('DEBUG', message, data, component, action);
    this.outputToConsole(entry);
    this.persistLog(entry);
  }
  
  info(message: string, data?: any, component?: string, action?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry = this.createLogEntry('INFO', message, data, component, action);
    this.outputToConsole(entry);
    this.persistLog(entry);
  }
  
  warn(message: string, data?: any, component?: string, action?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry = this.createLogEntry('WARN', message, data, component, action);
    this.outputToConsole(entry);
    this.persistLog(entry);
  }
  
  error(message: string, data?: any, component?: string, action?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry = this.createLogEntry('ERROR', message, data, component, action);
    this.outputToConsole(entry);
    this.persistLog(entry);
  }
  
  // Performance logging
  time(label: string, component?: string): void {
    console.time(`${component ? `[${component}] ` : ''}${label}`);
  }
  
  timeEnd(label: string, component?: string): void {
    console.timeEnd(`${component ? `[${component}] ` : ''}${label}`);
  }
  
  // Get logs for debugging
  getLogs(): LogEntry[] {
    try {
      return JSON.parse(localStorage.getItem('app_logs') || '[]');
    } catch (e) {
      return [];
    }
  }
  
  // Clear logs
  clearLogs(): void {
    localStorage.removeItem('app_logs');
    localStorage.removeItem('app_errors');
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for common logging patterns
export const logUserAction = (action: string, data?: any, component?: string) => {
  logger.info(`User action: ${action}`, data, component, action);
};

export const logPerformance = (operation: string, duration: number, component?: string) => {
  logger.info(`Performance: ${operation} took ${duration}ms`, { duration }, component, operation);
};

export const logApiCall = (endpoint: string, method: string, duration?: number) => {
  logger.debug(`API Call: ${method} ${endpoint}`, { method, endpoint, duration }, 'API');
};