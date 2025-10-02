// Database connection pooling for better performance
// Manages multiple SQLite connections to prevent blocking

use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};
use rusqlite::{Connection, Result as SqliteResult};
use std::path::Path;
use crate::errors::{AppError, AppResult};

/// Database connection pool configuration
#[derive(Debug, Clone)]
pub struct PoolConfig {
    /// Maximum number of connections in the pool
    pub max_connections: usize,
    /// Path to the database file
    pub database_path: String,
    /// WAL mode settings
    pub enable_wal: bool,
    /// Cache size per connection
    pub cache_size: i32,
}

impl Default for PoolConfig {
    fn default() -> Self {
        PoolConfig {
            max_connections: 5,
            database_path: "game.db".to_string(),
            enable_wal: true,
            cache_size: 10000,
        }
    }
}

/// A pooled database connection
pub struct PooledConnection {
    connection: Connection,
    _permit: tokio::sync::SemaphorePermit<'static>,
}

impl PooledConnection {
    /// Get access to the underlying connection
    pub fn connection(&self) -> &Connection {
        &self.connection
    }

    /// Get mutable access to the underlying connection
    pub fn connection_mut(&mut self) -> &mut Connection {
        &mut self.connection
    }
}

/// Database connection pool
pub struct DbPool {
    connections: Arc<Mutex<Vec<Connection>>>,
    semaphore: Arc<Semaphore>,
    config: PoolConfig,
}

impl DbPool {
    /// Create a new database pool
    pub async fn new(config: PoolConfig) -> AppResult<Self> {
        let connections = Arc::new(Mutex::new(Vec::new()));
        let semaphore = Arc::new(Semaphore::new(config.max_connections));

        // Pre-create initial connections
        let mut initial_connections = Vec::new();
        for _ in 0..std::cmp::min(2, config.max_connections) {
            match Self::create_connection(&config) {
                Ok(conn) => initial_connections.push(conn),
                Err(e) => {
                    return Err(AppError::database(
                        "pool_init",
                        format!("Failed to create initial connection: {}", e)
                    ));
                }
            }
        }

        *connections.lock().await = initial_connections;

        Ok(DbPool {
            connections,
            semaphore,
            config,
        })
    }

    /// Get a connection from the pool
    pub async fn get_connection(&self) -> AppResult<PooledConnection> {
        // Acquire semaphore permit (limits concurrent connections)
        let permit = self.semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| AppError::internal(format!("Failed to acquire connection permit: {}", e)))?;

        // Try to get an existing connection
        let connection = {
            let mut pool = self.connections.lock().await;
            pool.pop()
        };

        let connection = match connection {
            Some(conn) => conn,
            None => {
                // Create a new connection if pool is empty
                Self::create_connection(&self.config)
                    .map_err(|e| AppError::database(
                        "connection_create",
                        format!("Failed to create new connection: {}", e)
                    ))?
            }
        };

        Ok(PooledConnection {
            connection,
            _permit: permit,
        })
    }

    /// Return a connection to the pool
    pub async fn return_connection(&self, mut conn: PooledConnection) {
        // Reset connection state for reuse
        let _ = conn.connection.execute("ROLLBACK", []);

        // Return to pool if there's space
        let mut pool = self.connections.lock().await;
        if pool.len() < self.config.max_connections {
            // Move connection back to pool
            let Connection = std::mem::replace(&mut conn.connection, Self::create_dummy_connection());
            pool.push(connection);
        }
        // Connection will be dropped when PooledConnection is dropped
    }

    /// Create a new database connection with proper settings
    fn create_connection(config: &PoolConfig) -> SqliteResult<Connection> {
        let conn = Connection::open(&config.database_path)?;

        // Apply performance settings
        if config.enable_wal {
            conn.execute_batch(
                &format!(
                    "PRAGMA journal_mode = WAL;
                     PRAGMA synchronous = NORMAL;
                     PRAGMA cache_size = {};
                     PRAGMA mmap_size = 268435456;
                     PRAGMA temp_store = MEMORY;
                     PRAGMA foreign_keys = ON;",
                    config.cache_size
                )
            )?;
        } else {
            conn.execute_batch(
                &format!(
                    "PRAGMA synchronous = NORMAL;
                     PRAGMA cache_size = {};
                     PRAGMA temp_store = MEMORY;
                     PRAGMA foreign_keys = ON;",
                    config.cache_size
                )
            )?;
        }

        Ok(conn)
    }

    /// Create a dummy connection for replacement purposes
    fn create_dummy_connection() -> Connection {
        Connection::open_in_memory().expect("Failed to create dummy connection")
    }

    /// Get pool statistics
    pub async fn stats(&self) -> PoolStats {
        let pool = self.connections.lock().await;
        PoolStats {
            total_connections: self.config.max_connections,
            available_connections: pool.len(),
            active_connections: self.config.max_connections - pool.len(),
        }
    }

    /// Health check for the pool
    pub async fn health_check(&self) -> AppResult<()> {
        let mut conn = self.get_connection().await?;

        // Simple query to test connection
        conn.connection
            .prepare("SELECT 1")?
            .query_row([], |row| row.get::<_, i32>(0))
            .map_err(|e| AppError::database("health_check", e.to_string()))?;

        self.return_connection(conn).await;
        Ok(())
    }
}

/// Pool statistics
#[derive(Debug, Clone)]
pub struct PoolStats {
    pub total_connections: usize,
    pub available_connections: usize,
    pub active_connections: usize,
}

/// Implement Drop for proper cleanup
impl Drop for PooledConnection {
    fn drop(&mut self) {
        // Connection will be closed automatically
        // Permit will be returned to semaphore automatically
    }
}

/// Helper macro for database operations with automatic connection management
#[macro_export]
macro_rules! db_operation {
    ($pool:expr, $operation:expr) => {{
        let mut conn = $pool.get_connection().await?;
        let result = $operation(conn.connection_mut());
        $pool.return_connection(conn).await;
        result
    }};
}

/// Example usage in Tauri commands:
/*
use crate::db_pool::DbPool;
use std::sync::Arc;

// In your app state
pub struct AppState {
    pub db_pool: Arc<DbPool>,
}

#[tauri::command]
async fn get_user(state: tauri::State<'_, AppState>, user_id: i64) -> AppResult<User> {
    db_operation!(state.db_pool, |conn: &mut Connection| {
        conn.query_row(
            "SELECT id, username, level FROM users WHERE id = ?1",
            [user_id],
            |row| {
                Ok(User {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    level: row.get(2)?,
                })
            },
        )
        .map_err(|e| AppError::database("get_user", e.to_string()))
    })
}

// In your main function
fn main() {
    let pool_config = PoolConfig {
        max_connections: 10,
        database_path: "game.db".to_string(),
        ..Default::default()
    };

    let db_pool = Arc::new(
        DbPool::new(pool_config)
            .await
            .expect("Failed to create database pool")
    );

    tauri::Builder::default()
        .manage(AppState { db_pool })
        .invoke_handler(tauri::generate_handler![get_user])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
*/

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_pool_creation() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = PoolConfig {
            max_connections: 2,
            database_path: db_path.to_string_lossy().to_string(),
            ..Default::default()
        };

        let pool = DbPool::new(config).await.unwrap();
        let stats = pool.stats().await;

        assert_eq!(stats.total_connections, 2);
        assert!(stats.available_connections > 0);
    }

    #[tokio::test]
    async fn test_connection_acquisition() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = PoolConfig {
            max_connections: 1,
            database_path: db_path.to_string_lossy().to_string(),
            ..Default::default()
        };

        let pool = DbPool::new(config).await.unwrap();
        let _conn1 = pool.get_connection().await.unwrap();

        let stats = pool.stats().await;
        assert_eq!(stats.active_connections, 1);
    }

    #[tokio::test]
    async fn test_health_check() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");

        let config = PoolConfig {
            max_connections: 1,
            database_path: db_path.to_string_lossy().to_string(),
            ..Default::default()
        };

        let pool = DbPool::new(config).await.unwrap();
        assert!(pool.health_check().await.is_ok());
    }
}