// Structured error handling for the Tauri backend
// Replaces string-based errors with typed errors for better debugging and user feedback

use serde::{Deserialize, Serialize};
use std::fmt;

/// Application error types with structured information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "details")]
pub enum AppError {
    /// Database-related errors
    Database {
        operation: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        sql_error: Option<String>,
    },

    /// Resource not found errors
    NotFound {
        resource: String,
        id: String,
    },

    /// Validation errors
    Validation {
        field: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        expected: Option<String>,
    },

    /// Permission/Authorization errors
    Unauthorized {
        action: String,
        reason: String,
    },

    /// File system errors
    FileSystem {
        operation: String,
        path: String,
        message: String,
    },

    /// Network/External service errors
    External {
        service: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        status_code: Option<u16>,
    },

    /// Business logic errors
    BusinessLogic {
        code: String,
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        context: Option<serde_json::Value>,
    },

    /// Internal server errors
    Internal {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        debug_info: Option<String>,
    },
}

impl AppError {
    /// Create a database error
    pub fn database(operation: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::Database {
            operation: operation.into(),
            message: message.into(),
            sql_error: None,
        }
    }

    /// Create a not found error
    pub fn not_found(resource: impl Into<String>, id: impl Into<String>) -> Self {
        AppError::NotFound {
            resource: resource.into(),
            id: id.into(),
        }
    }

    /// Create a validation error
    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::Validation {
            field: field.into(),
            message: message.into(),
            expected: None,
        }
    }

    /// Create an unauthorized error
    pub fn unauthorized(action: impl Into<String>, reason: impl Into<String>) -> Self {
        AppError::Unauthorized {
            action: action.into(),
            reason: reason.into(),
        }
    }

    /// Create a file system error
    pub fn file_system(operation: impl Into<String>, path: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::FileSystem {
            operation: operation.into(),
            path: path.into(),
            message: message.into(),
        }
    }

    /// Create a business logic error
    pub fn business_logic(code: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::BusinessLogic {
            code: code.into(),
            message: message.into(),
            context: None,
        }
    }

    /// Create an internal error
    pub fn internal(message: impl Into<String>) -> Self {
        AppError::Internal {
            message: message.into(),
            debug_info: None,
        }
    }

    /// Add SQL error details to a database error
    pub fn with_sql_error(mut self, sql_error: String) -> Self {
        if let AppError::Database { sql_error: ref mut err, .. } = self {
            *err = Some(sql_error);
        }
        self
    }

    /// Add debug info to an internal error
    pub fn with_debug_info(mut self, info: String) -> Self {
        if let AppError::Internal { debug_info: ref mut debug, .. } = self {
            *debug = Some(info);
        }
        self
    }

    /// Add context to a business logic error
    pub fn with_context(mut self, context: serde_json::Value) -> Self {
        if let AppError::BusinessLogic { context: ref mut ctx, .. } = self {
            *ctx = Some(context);
        }
        self
    }

    /// Get a user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            AppError::Database { message, .. } => format!("Database error: {}", message),
            AppError::NotFound { resource, id } => format!("{} with ID '{}' not found", resource, id),
            AppError::Validation { field, message, .. } => format!("Invalid {}: {}", field, message),
            AppError::Unauthorized { action, reason } => format!("Cannot {}: {}", action, reason),
            AppError::FileSystem { message, .. } => format!("File operation failed: {}", message),
            AppError::External { service, message, .. } => format!("{} error: {}", service, message),
            AppError::BusinessLogic { message, .. } => message.clone(),
            AppError::Internal { .. } => "An internal error occurred. Please try again.".to_string(),
        }
    }

    /// Get the error code for frontend handling
    pub fn error_code(&self) -> &str {
        match self {
            AppError::Database { .. } => "DATABASE_ERROR",
            AppError::NotFound { .. } => "NOT_FOUND",
            AppError::Validation { .. } => "VALIDATION_ERROR",
            AppError::Unauthorized { .. } => "UNAUTHORIZED",
            AppError::FileSystem { .. } => "FILE_SYSTEM_ERROR",
            AppError::External { .. } => "EXTERNAL_SERVICE_ERROR",
            AppError::BusinessLogic { code, .. } => code,
            AppError::Internal { .. } => "INTERNAL_ERROR",
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.user_message())
    }
}

impl std::error::Error for AppError {}

/// Convert from rusqlite errors
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::QueryReturnedNoRows => {
                AppError::not_found("record", "unknown")
            }
            _ => AppError::database("query", err.to_string())
                .with_sql_error(format!("{:?}", err))
        }
    }
}

/// Convert from io errors
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::file_system("io", "", err.to_string())
    }
}

/// Convert AppError to a format Tauri can serialize
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        serde_json::to_string(&err).unwrap_or_else(|_| err.user_message())
    }
}

/// Result type alias for cleaner function signatures
pub type AppResult<T> = Result<T, AppError>;

/// Error response structure for the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: AppError,
    pub timestamp: String,
    pub request_id: Option<String>,
}

impl ErrorResponse {
    pub fn new(error: AppError) -> Self {
        ErrorResponse {
            success: false,
            error,
            timestamp: chrono::Utc::now().to_rfc3339(),
            request_id: None,
        }
    }

    pub fn with_request_id(mut self, id: String) -> Self {
        self.request_id = Some(id);
        self
    }
}

/// Example usage in commands:
///
/// ```rust
/// #[tauri::command]
/// async fn get_user(id: i64) -> AppResult<User> {
///     let conn = get_connection()?;
///
///     conn.query_row("SELECT * FROM users WHERE id = ?", [id], |row| {
///         // ...
///     })
///     .map_err(|_| AppError::not_found("User", id.to_string()))
/// }
///
/// #[tauri::command]
/// async fn create_task(data: TaskData) -> AppResult<Task> {
///     if data.title.is_empty() {
///         return Err(AppError::validation("title", "Title cannot be empty"));
///     }
///
///     // ... rest of implementation
/// }
/// ```

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = AppError::not_found("Task", "123");
        assert_eq!(err.error_code(), "NOT_FOUND");
        assert_eq!(err.user_message(), "Task with ID '123' not found");
    }

    #[test]
    fn test_error_serialization() {
        let err = AppError::database("insert", "Constraint violation");
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"type\":\"Database\""));
        assert!(json.contains("\"operation\":\"insert\""));
    }

    #[test]
    fn test_error_with_context() {
        let err = AppError::business_logic("INSUFFICIENT_GOLD", "Not enough gold")
            .with_context(serde_json::json!({
                "required": 100,
                "available": 50
            }));

        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"required\":100"));
    }
}