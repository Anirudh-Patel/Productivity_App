use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

// Database connection type
pub type DbConnection = Arc<Mutex<rusqlite::Connection>>;

// Core data structures that match the database schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub level: i32,
    pub experience_points: i32,
    pub experience_to_next_level: i32,
    pub strength: i32,
    pub intelligence: i32,
    pub endurance: i32,
    pub charisma: i32,
    pub luck: i32,
    pub current_health: i32,
    pub max_health: i32,
    pub gold: i32,
    pub theme_preference: String,
    pub equipped_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub category: String,
    pub difficulty: i32,
    pub base_experience_reward: i32,
    pub gold_reward: i32,
    pub due_date: Option<String>,
    pub status: String,
    pub priority: i32,
    pub task_type: String,
    pub current_progress: Option<i32>,
    pub target_progress: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub requirements_type: String,
    pub requirements_value: i32,
    pub experience_reward: i32,
    pub gold_reward: i32,
    pub rarity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAchievement {
    pub id: i64,
    pub user_id: i64,
    pub achievement_id: i64,
    pub unlocked_at: String,
}

// Inventory and buff persistence is implemented directly in the lib.rs commands
// (purchase_item, use_inventory_item, get_user_inventory, apply_buff, get_active_buffs)
// using transactional SQL against inventory_items / active_buffs / user_titles.

// Database initialization and migration
pub async fn init_database() -> Result<DbConnection, String> {
    // Use simple relative path for database
    let db_path = "game.db";
    let conn = rusqlite::Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Set performance optimizations
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = 10000;
         PRAGMA mmap_size = 268435456;
         PRAGMA temp_store = MEMORY;",
    )
    .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Run migrations
    run_migrations(&conn)?;

    Ok(Arc::new(Mutex::new(conn)))
}

fn run_migrations(conn: &rusqlite::Connection) -> Result<(), String> {
    // Create migrations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )
    .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    // Migration files in order
    let migrations = vec![
        ("001_initial_schema.sql", include_str!("../migrations/001_initial_schema.sql")),
        ("002_avatar_system.sql", include_str!("../migrations/002_avatar_system.sql")),
        ("003_avatar_seed_data.sql", include_str!("../migrations/003_avatar_seed_data.sql")),
        ("004_inventory_and_buffs.sql", include_str!("../migrations/004_inventory_and_buffs.sql")),
        ("20241212000001_create_daily_stats.sql", include_str!("../migrations/20241212000001_create_daily_stats.sql")),
        ("005_recurring_tasks.sql", include_str!("../migrations/005_recurring_tasks.sql")),
        ("006_projects.sql", include_str!("../migrations/006_projects.sql")),
        ("007_time_tracking.sql", include_str!("../migrations/007_time_tracking.sql")),
        ("008_notifications.sql", include_str!("../migrations/008_notifications.sql")),
        ("009_github_integration.sql", include_str!("../migrations/009_github_integration.sql")),
        ("010_calendar_links.sql", include_str!("../migrations/010_calendar_links.sql")),
        ("012_health.sql", include_str!("../migrations/012_health.sql")),
        ("011_finance.sql", include_str!("../migrations/011_finance.sql")),
        ("014_capture.sql", include_str!("../migrations/014_capture.sql")),
        ("013_reminders.sql", include_str!("../migrations/013_reminders.sql")),
        ("015_unlocked_content.sql", include_str!("../migrations/015_unlocked_content.sql")),
    ];

    for (filename, sql) in migrations {
        // Check if migration was already applied
        let applied: Result<i32, _> = conn.query_row(
            "SELECT COUNT(*) FROM migrations WHERE filename = ?1",
            [filename],
            |row| row.get(0),
        );

        if applied.unwrap_or(0) == 0 {
            // Apply migration
            conn.execute_batch(sql)
                .map_err(|e| format!("Failed to apply migration {}: {}", filename, e))?;

            // Record migration
            conn.execute(
                "INSERT INTO migrations (filename) VALUES (?1)",
                [filename],
            )
            .map_err(|e| format!("Failed to record migration {}: {}", filename, e))?;
        }
    }

    // Add missing columns if they don't exist (for backwards compatibility)
    add_column_if_not_exists(conn, "tasks", "task_type", "TEXT DEFAULT 'standard'")?;
    add_column_if_not_exists(conn, "users", "equipped_title", "TEXT")?;

    Ok(())
}

fn add_column_if_not_exists(
    conn: &rusqlite::Connection,
    table: &str,
    column: &str,
    column_def: &str,
) -> Result<(), String> {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = conn.prepare(&sql)
        .map_err(|e| format!("Failed to prepare pragma: {}", e))?;

    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("Failed to query columns: {}", e))?
        .filter_map(Result::ok)
        .collect();

    if !columns.contains(&column.to_string()) {
        let sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, column_def);
        conn.execute(&sql, [])
            .map_err(|e| format!("Failed to add column: {}", e))?;
    }

    Ok(())
}

// Database operation functions
pub async fn get_user(conn: &DbConnection, user_id: i64) -> Result<User, String> {
    let conn = conn.lock().await;

    let user = conn.query_row(
        "SELECT id, username, level, experience_points, experience_to_next_level,
         strength, intelligence, endurance, charisma, luck,
         current_health, max_health, gold, theme_preference, equipped_title
         FROM users WHERE id = ?1",
        [user_id],
        |row| {
            Ok(User {
                id: row.get(0)?,
                username: row.get(1)?,
                level: row.get(2)?,
                experience_points: row.get(3)?,
                experience_to_next_level: row.get(4)?,
                strength: row.get(5)?,
                intelligence: row.get(6)?,
                endurance: row.get(7)?,
                charisma: row.get(8)?,
                luck: row.get(9)?,
                current_health: row.get(10)?,
                max_health: row.get(11)?,
                gold: row.get(12)?,
                theme_preference: row.get(13)?,
                equipped_title: row.get(14)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get user: {}", e))?;

    Ok(user)
}

pub async fn update_user(conn: &DbConnection, user: &User) -> Result<(), String> {
    let conn = conn.lock().await;

    conn.execute(
        "UPDATE users SET
         username = ?2, level = ?3, experience_points = ?4, experience_to_next_level = ?5,
         strength = ?6, intelligence = ?7, endurance = ?8, charisma = ?9, luck = ?10,
         current_health = ?11, max_health = ?12, gold = ?13, theme_preference = ?14, equipped_title = ?15
         WHERE id = ?1",
        rusqlite::params![
            user.id,
            user.username,
            user.level,
            user.experience_points,
            user.experience_to_next_level,
            user.strength,
            user.intelligence,
            user.endurance,
            user.charisma,
            user.luck,
            user.current_health,
            user.max_health,
            user.gold,
            user.theme_preference,
            user.equipped_title,
        ],
    )
    .map_err(|e| format!("Failed to update user: {}", e))?;

    Ok(())
}

pub async fn get_tasks(conn: &DbConnection, user_id: i64) -> Result<Vec<Task>, String> {
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
         t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
         COALESCE(t.task_type, 'standard') as task_type,
         tp.current_progress, tp.target_progress
         FROM tasks t
         LEFT JOIN task_progress tp ON t.id = tp.task_id
         WHERE t.user_id = ?1 AND t.status != 'archived'
         ORDER BY t.priority DESC, t.due_date ASC",
    )
    .map_err(|e| format!("Failed to prepare tasks query: {}", e))?;

    let task_iter = stmt.query_map([user_id], |row| {
        Ok(Task {
            id: row.get(0)?,
            user_id: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            category: row.get(4)?,
            difficulty: row.get(5)?,
            base_experience_reward: row.get(6)?,
            gold_reward: row.get(7)?,
            due_date: row.get(8)?,
            status: row.get(9)?,
            priority: row.get(10)?,
            task_type: row.get(11)?,
            current_progress: row.get(12)?,
            target_progress: row.get(13)?,
        })
    })
    .map_err(|e| format!("Failed to query tasks: {}", e))?;

    let tasks: Result<Vec<Task>, _> = task_iter.collect();
    tasks.map_err(|e| format!("Failed to collect tasks: {}", e))
}

pub async fn create_task(conn: &DbConnection, task: &Task) -> Result<i64, String> {
    let conn = conn.lock().await;

    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    tx.execute(
        "INSERT INTO tasks (user_id, title, description, category, difficulty,
         base_experience_reward, gold_reward, due_date, status, priority, task_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            task.user_id,
            task.title,
            task.description,
            task.category,
            task.difficulty,
            task.base_experience_reward,
            task.gold_reward,
            task.due_date,
            task.status,
            task.priority,
            task.task_type,
        ],
    )
    .map_err(|e| format!("Failed to insert task: {}", e))?;

    let task_id = tx.last_insert_rowid();

    // If it's a goal-based task, create progress tracking
    if task.task_type == "goal" && task.target_progress.is_some() {
        tx.execute(
            "INSERT INTO task_progress (task_id, current_progress, target_progress)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![
                task_id,
                task.current_progress.unwrap_or(0),
                task.target_progress.unwrap(),
            ],
        )
        .map_err(|e| format!("Failed to insert task progress: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(task_id)
}

pub async fn complete_task(conn: &DbConnection, task_id: i64, user_id: i64) -> Result<(i32, i32), String> {
    let conn = conn.lock().await;

    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    // Get task details
    let (xp_reward, gold_reward): (i32, i32) = tx.query_row(
        "SELECT base_experience_reward, gold_reward FROM tasks WHERE id = ?1 AND user_id = ?2",
        [task_id, user_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|e| format!("Failed to get task rewards: {}", e))?;

    // Update task status
    tx.execute(
        "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [task_id],
    )
    .map_err(|e| format!("Failed to update task status: {}", e))?;

    // Update user stats
    tx.execute(
        "UPDATE users SET experience_points = experience_points + ?1, gold = gold + ?2 WHERE id = ?3",
        rusqlite::params![xp_reward, gold_reward, user_id],
    )
    .map_err(|e| format!("Failed to update user stats: {}", e))?;

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok((xp_reward, gold_reward))
}

pub async fn get_all_achievements(conn: &DbConnection) -> Result<Vec<Achievement>, String> {
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT id, name, description, icon, requirements_type, requirements_value,
         experience_reward, gold_reward, rarity
         FROM achievements ORDER BY rarity, name",
    )
    .map_err(|e| format!("Failed to prepare achievements query: {}", e))?;

    let achievement_iter = stmt.query_map([], |row| {
        Ok(Achievement {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
            requirements_type: row.get(4)?,
            requirements_value: row.get(5)?,
            experience_reward: row.get(6)?,
            gold_reward: row.get(7)?,
            rarity: row.get(8)?,
        })
    })
    .map_err(|e| format!("Failed to query achievements: {}", e))?;

    let achievements: Result<Vec<Achievement>, _> = achievement_iter.collect();
    achievements.map_err(|e| format!("Failed to collect achievements: {}", e))
}

pub async fn get_user_achievements(conn: &DbConnection, user_id: i64) -> Result<Vec<UserAchievement>, String> {
    let conn = conn.lock().await;

    let mut stmt = conn.prepare(
        "SELECT id, user_id, achievement_id, unlocked_at
         FROM user_achievements WHERE user_id = ?1 ORDER BY unlocked_at DESC",
    )
    .map_err(|e| format!("Failed to prepare user achievements query: {}", e))?;

    let user_achievement_iter = stmt.query_map([user_id], |row| {
        Ok(UserAchievement {
            id: row.get(0)?,
            user_id: row.get(1)?,
            achievement_id: row.get(2)?,
            unlocked_at: row.get(3)?,
        })
    })
    .map_err(|e| format!("Failed to query user achievements: {}", e))?;

    let user_achievements: Result<Vec<UserAchievement>, _> = user_achievement_iter.collect();
    user_achievements.map_err(|e| format!("Failed to collect user achievements: {}", e))
}

pub async fn unlock_achievement(conn: &DbConnection, user_id: i64, achievement_id: i64) -> Result<(), String> {
    let conn = conn.lock().await;

    // Check if already unlocked
    let already_unlocked: i32 = conn.query_row(
        "SELECT COUNT(*) FROM user_achievements WHERE user_id = ?1 AND achievement_id = ?2",
        rusqlite::params![user_id, achievement_id],
        |row| row.get(0),
    )
    .unwrap_or(0);

    if already_unlocked > 0 {
        return Ok(()); // Already unlocked, skip
    }

    conn.execute(
        "INSERT INTO user_achievements (user_id, achievement_id) VALUES (?1, ?2)",
        rusqlite::params![user_id, achievement_id],
    )
    .map_err(|e| format!("Failed to unlock achievement: {}", e))?;

    Ok(())
}

pub async fn update_task(conn: &DbConnection, task: &Task) -> Result<(), String> {
    let conn = conn.lock().await;

    conn.execute(
        "UPDATE tasks SET
         title = ?2, description = ?3, category = ?4, difficulty = ?5,
         base_experience_reward = ?6, gold_reward = ?7, due_date = ?8,
         status = ?9, priority = ?10, task_type = ?11
         WHERE id = ?1",
        rusqlite::params![
            task.id,
            task.title,
            task.description,
            task.category,
            task.difficulty,
            task.base_experience_reward,
            task.gold_reward,
            task.due_date,
            task.status,
            task.priority,
            task.task_type,
        ],
    )
    .map_err(|e| format!("Failed to update task: {}", e))?;

    Ok(())
}

pub async fn update_task_progress(conn: &DbConnection, task_id: i64, current_progress: i32) -> Result<(), String> {
    let conn = conn.lock().await;

    conn.execute(
        "UPDATE task_progress SET current_progress = ?2 WHERE task_id = ?1",
        rusqlite::params![task_id, current_progress],
    )
    .map_err(|e| format!("Failed to update task progress: {}", e))?;

    Ok(())
}
