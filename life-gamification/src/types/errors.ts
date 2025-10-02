// TypeScript types for structured error handling from the Rust backend
// These types match the Rust AppError enum for proper error handling

export type ErrorType =
  | 'Database'
  | 'NotFound'
  | 'Validation'
  | 'Unauthorized'
  | 'FileSystem'
  | 'External'
  | 'BusinessLogic'
  | 'Internal';

export interface DatabaseError {
  type: 'Database';
  details: {
    operation: string;
    message: string;
    sql_error?: string;
  };
}

export interface NotFoundError {
  type: 'NotFound';
  details: {
    resource: string;
    id: string;
  };
}

export interface ValidationError {
  type: 'Validation';
  details: {
    field: string;
    message: string;
    expected?: string;
  };
}

export interface UnauthorizedError {
  type: 'Unauthorized';
  details: {
    action: string;
    reason: string;
  };
}

export interface FileSystemError {
  type: 'FileSystem';
  details: {
    operation: string;
    path: string;
    message: string;
  };
}

export interface ExternalError {
  type: 'External';
  details: {
    service: string;
    message: string;
    status_code?: number;
  };
}

export interface BusinessLogicError {
  type: 'BusinessLogic';
  details: {
    code: string;
    message: string;
    context?: any;
  };
}

export interface InternalError {
  type: 'Internal';
  details: {
    message: string;
    debug_info?: string;
  };
}

export type AppError =
  | DatabaseError
  | NotFoundError
  | ValidationError
  | UnauthorizedError
  | FileSystemError
  | ExternalError
  | BusinessLogicError
  | InternalError;

export interface ErrorResponse {
  success: false;
  error: AppError;
  timestamp: string;
  request_id?: string;
}

// Type guards for error checking
export const isNotFoundError = (error: AppError): error is NotFoundError =>
  error.type === 'NotFound';

export const isValidationError = (error: AppError): error is ValidationError =>
  error.type === 'Validation';

export const isUnauthorizedError = (error: AppError): error is UnauthorizedError =>
  error.type === 'Unauthorized';

export const isDatabaseError = (error: AppError): error is DatabaseError =>
  error.type === 'Database';

export const isBusinessLogicError = (error: AppError): error is BusinessLogicError =>
  error.type === 'BusinessLogic';

// Error handler utility
export class ErrorHandler {
  /**
   * Get a user-friendly message from an error
   */
  static getUserMessage(error: AppError): string {
    switch (error.type) {
      case 'Database':
        return `Database error: ${error.details.message}`;
      case 'NotFound':
        return `${error.details.resource} with ID '${error.details.id}' not found`;
      case 'Validation':
        return `Invalid ${error.details.field}: ${error.details.message}`;
      case 'Unauthorized':
        return `Cannot ${error.details.action}: ${error.details.reason}`;
      case 'FileSystem':
        return `File operation failed: ${error.details.message}`;
      case 'External':
        return `${error.details.service} error: ${error.details.message}`;
      case 'BusinessLogic':
        return error.details.message;
      case 'Internal':
        return 'An internal error occurred. Please try again.';
    }
  }

  /**
   * Get the error code for the error
   */
  static getErrorCode(error: AppError): string {
    switch (error.type) {
      case 'Database':
        return 'DATABASE_ERROR';
      case 'NotFound':
        return 'NOT_FOUND';
      case 'Validation':
        return 'VALIDATION_ERROR';
      case 'Unauthorized':
        return 'UNAUTHORIZED';
      case 'FileSystem':
        return 'FILE_SYSTEM_ERROR';
      case 'External':
        return 'EXTERNAL_SERVICE_ERROR';
      case 'BusinessLogic':
        return error.details.code;
      case 'Internal':
        return 'INTERNAL_ERROR';
    }
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: AppError): boolean {
    switch (error.type) {
      case 'Validation':
      case 'BusinessLogic':
        return true;
      case 'External':
      case 'Database':
        // Some database/external errors might be recoverable (timeout, connection)
        return error.details.message.toLowerCase().includes('timeout') ||
               error.details.message.toLowerCase().includes('connection');
      default:
        return false;
    }
  }

  /**
   * Convert error to toast notification format
   */
  static toToast(error: AppError): {
    title: string;
    description: string;
    type: 'error' | 'warning'
  } {
    const isRecoverable = ErrorHandler.isRecoverable(error);

    return {
      title: isRecoverable ? 'Action Required' : 'Error',
      description: ErrorHandler.getUserMessage(error),
      type: isRecoverable ? 'warning' : 'error'
    };
  }

  /**
   * Log error with appropriate severity
   */
  static log(error: AppError, context?: any): void {
    const severity = error.type === 'Internal' ? 'error' :
                    error.type === 'Validation' ? 'warn' :
                    'info';

    const logData = {
      type: error.type,
      details: error.details,
      code: ErrorHandler.getErrorCode(error),
      context,
      timestamp: new Date().toISOString()
    };

    if (severity === 'error') {
      console.error('[AppError]', logData);
    } else if (severity === 'warn') {
      console.warn('[AppError]', logData);
    } else {
      console.info('[AppError]', logData);
    }

    // In production, you might want to send this to a logging service
    if (import.meta.env.PROD && severity === 'error') {
      // Send to error tracking service (e.g., Sentry)
      // window.Sentry?.captureException(error);
    }
  }
}

// React hook for error handling
export function useErrorHandler() {
  const handleError = (error: unknown) => {
    if (typeof error === 'string') {
      // Try to parse as JSON (from Tauri)
      try {
        const parsed = JSON.parse(error) as AppError;
        ErrorHandler.log(parsed);
        return parsed;
      } catch {
        // Fallback to internal error
        const internalError: InternalError = {
          type: 'Internal',
          details: { message: error }
        };
        ErrorHandler.log(internalError);
        return internalError;
      }
    } else if (error && typeof error === 'object' && 'type' in error) {
      // Already an AppError
      ErrorHandler.log(error as AppError);
      return error as AppError;
    } else {
      // Unknown error format
      const internalError: InternalError = {
        type: 'Internal',
        details: {
          message: 'An unexpected error occurred',
          debug_info: String(error)
        }
      };
      ErrorHandler.log(internalError);
      return internalError;
    }
  };

  return { handleError };
}

// Example usage:
/*
import { invoke } from '@tauri-apps/api/tauri';
import { useErrorHandler } from '@/types/errors';

function MyComponent() {
  const { handleError } = useErrorHandler();

  const loadUser = async () => {
    try {
      const user = await invoke('get_user', { id: 123 });
      // Handle success
    } catch (error) {
      const appError = handleError(error);

      if (isNotFoundError(appError)) {
        // Handle user not found
        console.log(`User ${appError.details.id} not found`);
      } else if (isDatabaseError(appError)) {
        // Handle database error
        console.error('Database issue:', appError.details.message);
      }

      // Show toast
      const toast = ErrorHandler.toToast(appError);
      showToast(toast);
    }
  };
}
*/