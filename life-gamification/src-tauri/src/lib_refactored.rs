// This is a refactored version of key functions that use database persistence
// To be integrated into lib.rs

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::{DateTime, Utc, Duration};
use rusqlite::Connection;
use tauri::Manager;

// Database State - to be added to lib.rs
pub struct AppState {
    pub db: Mutex<Connection>,
}

// Refactored get_user command - replaces existing function
#[tauri::command]
async fn get_user(state: tauri::State<'_, AppState>) -> Result<User, String> {
    let conn = state.db.lock().unwrap();

    conn.query_row(
        "SELECT id, username, level, experience_points, experience_to_next_level,
         strength, intelligence, endurance, charisma, luck,
         current_health, max_health, gold, theme_preference, equipped_title
         FROM users WHERE id = 1",
        [],
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
                active_title: row.get(14)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get user: {}", e))
}

// Refactored get_tasks command - replaces existing function
#[tauri::command]
async fn get_tasks(state: tauri::State<'_, AppState>, status: Option<String>) -> Result<Vec<Task>, String> {
    let conn = state.db.lock().unwrap();

    let query = if let Some(status_filter) = status {
        format!(
            "SELECT id, user_id, title, description, category, difficulty,
             base_experience_reward, gold_reward, due_date, status, priority,
             created_at, completed_at, COALESCE(task_type, 'standard'),
             goal_target, goal_current, goal_unit
             FROM tasks WHERE user_id = 1 AND status = '{}'",
            status_filter
        )
    } else {
        "SELECT id, user_id, title, description, category, difficulty,
         base_experience_reward, gold_reward, due_date, status, priority,
         created_at, completed_at, COALESCE(task_type, 'standard'),
         goal_target, goal_current, goal_unit
         FROM tasks WHERE user_id = 1".to_string()
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let task_iter = stmt.query_map([], |row| {
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
            created_at: row.get(11)?,
            completed_at: row.get(12)?,
            task_type: row.get(13)?,
            goal_target: row.get(14)?,
            goal_current: row.get(15)?,
            goal_unit: row.get(16)?,
        })
    }).map_err(|e| e.to_string())?;

    let tasks: Result<Vec<Task>, _> = task_iter.collect();
    tasks.map_err(|e| e.to_string())
}

// Refactored create_task command - replaces existing function
#[tauri::command]
async fn create_task(state: tauri::State<'_, AppState>, task_data: CreateTaskRequest) -> Result<Task, String> {
    let conn = state.db.lock().unwrap();

    let difficulty = task_data.difficulty.unwrap_or(5);
    let category = task_data.category.unwrap_or_else(|| "general".to_string());
    let priority = task_data.priority.unwrap_or(3);
    let task_type = task_data.task_type.unwrap_or_else(|| "standard".to_string());

    // Calculate rewards based on difficulty
    let base_xp = 10 + (difficulty - 1) * 5;
    let gold_reward = 1 + (difficulty - 1);

    let created_at = Utc::now().to_rfc3339();

    // Add columns for task_type and goal fields
    conn.execute(
        "INSERT INTO tasks (user_id, title, description, category, difficulty,
         base_experience_reward, gold_reward, due_date, status, priority, created_at,
         task_type, goal_target, goal_current, goal_unit)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        rusqlite::params![
            1, // user_id
            task_data.title,
            task_data.description,
            category,
            difficulty,
            base_xp,
            gold_reward,
            task_data.due_date,
            "active",
            priority,
            created_at.clone(),
            task_type.clone(),
            task_data.goal_target,
            if task_data.goal_target.is_some() { Some(0) } else { None },
            task_data.goal_unit,
        ],
    ).map_err(|e| e.to_string())?;

    let task_id = conn.last_insert_rowid();

    Ok(Task {
        id: task_id,
        user_id: 1,
        title: task_data.title,
        description: task_data.description,
        category,
        difficulty,
        base_experience_reward: base_xp,
        gold_reward,
        due_date: task_data.due_date,
        status: "active".to_string(),
        priority,
        created_at,
        completed_at: None,
        task_type,
        goal_target: task_data.goal_target,
        goal_current: if task_data.goal_target.is_some() { Some(0) } else { None },
        goal_unit: task_data.goal_unit,
    })
}

// Refactored complete_task command - replaces existing function
#[tauri::command]
async fn complete_task(state: tauri::State<'_, AppState>, task_id: i64) -> Result<Task, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Get task details
    let mut task: Task = tx.query_row(
        "SELECT id, user_id, title, description, category, difficulty,
         base_experience_reward, gold_reward, due_date, status, priority,
         created_at, completed_at, COALESCE(task_type, 'standard'),
         goal_target, goal_current, goal_unit
         FROM tasks WHERE id = ?1",
        [task_id],
        |row| {
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
                created_at: row.get(11)?,
                completed_at: row.get(12)?,
                task_type: row.get(13)?,
                goal_target: row.get(14)?,
                goal_current: row.get(15)?,
                goal_unit: row.get(16)?,
            })
        },
    ).map_err(|e| format!("Task not found: {}", e))?;

    if task.status == "completed" {
        return Ok(task);
    }

    let completed_at = Utc::now().to_rfc3339();

    // Update task status
    tx.execute(
        "UPDATE tasks SET status = 'completed', completed_at = ?1 WHERE id = ?2",
        rusqlite::params![completed_at.clone(), task_id],
    ).map_err(|e| e.to_string())?;

    task.status = "completed".to_string();
    task.completed_at = Some(completed_at);

    // Get user and update rewards
    let mut user: User = tx.query_row(
        "SELECT id, username, level, experience_points, experience_to_next_level,
         strength, intelligence, endurance, charisma, luck,
         current_health, max_health, gold, theme_preference, equipped_title
         FROM users WHERE id = ?1",
        [task.user_id],
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
                active_title: row.get(14)?,
            })
        },
    ).map_err(|e| format!("User not found: {}", e))?;

    // Apply stat bonuses (simplified for now)
    let int_bonus = user.intelligence as f64 * 0.02;
    let luck_bonus = user.luck as f64 * 0.015;
    let final_xp = (task.base_experience_reward as f64 * (1.0 + int_bonus)) as i64;
    let final_gold = (task.gold_reward as f64 * (1.0 + luck_bonus)) as i64;

    user.experience_points += final_xp;
    user.gold += final_gold;

    // Recalculate level
    let new_level = 1 + (user.experience_points / 100);
    if new_level > user.level {
        user.current_health = user.max_health; // Level up bonus
    }
    user.level = new_level;
    user.experience_to_next_level = (100 * (user.level + 1)) - user.experience_points;

    // Update user in database
    tx.execute(
        "UPDATE users SET level = ?1, experience_points = ?2, experience_to_next_level = ?3,
         gold = ?4, current_health = ?5 WHERE id = ?6",
        rusqlite::params![
            user.level,
            user.experience_points,
            user.experience_to_next_level,
            user.gold,
            user.current_health,
            user.id,
        ],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(task)
}

// Helper function for initializing the database connection in main()
pub fn init_database() -> Result<Connection, String> {
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;

    let db_path = app_dir.join("game.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Set performance optimizations
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = 10000;
         PRAGMA mmap_size = 268435456;
         PRAGMA temp_store = MEMORY;",
    ).map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Ensure tables exist - run migrations
    run_migrations(&conn)?;

    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    // Add task_type and goal columns if they don't exist
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'standard'", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN goal_target INTEGER", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN goal_current INTEGER", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN goal_unit TEXT", []);
    let _ = conn.execute("ALTER TABLE users ADD COLUMN equipped_title TEXT", []);

    Ok(())
}

// Updated main() function setup - to be added to lib.rs
/*
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(init_database().expect("Failed to initialize database")),
        })
        .invoke_handler(tauri::generate_handler![
            get_user,
            get_tasks,
            create_task,
            complete_task,
            // ... other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
*/