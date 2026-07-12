use serde::{Deserialize, Serialize};
use serde_json;
use std::sync::Mutex;
use chrono::{Duration, Utc};
use rusqlite::{Connection, OptionalExtension, Result};
use tauri::Manager;
use std::fs;
use std::path::Path;

// Import avatar and calendar commands
mod commands;
use commands::avatar;
use commands::calendar;
use commands::capture;
use commands::finance;
use commands::github;
use commands::health;
use commands::reminders;
use commands::connections;
use commands::simplefin;

mod database;
use database::DbConnection;

mod oauth;


// Skill Tree Structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillNode {
    pub node_key: String,
    pub name: String,
    pub description: String,
    pub node_type: String,
    pub primary_stat: String,
    pub skill_point_cost: i64,
    pub level_requirement: i64,
    pub x_position: f64,
    pub y_position: f64,
    pub prerequisite_nodes: Vec<String>,
    pub stats: SkillNodeStats,
    pub color_hex: String,
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillNodeStats {
    pub strength: i64,
    pub intelligence: i64,
    pub luck: i64,
    pub aura: i64,
    pub will: i64,
    pub health: i64,
    pub mana: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillTreeConnection {
    pub from_node: String,
    pub to_node: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSkillStats {
    pub available_skill_points: i64,
    pub strength_bonus: i64,
    pub intelligence_bonus: i64,
    pub luck_bonus: i64,
    pub aura_bonus: i64,
    pub will_bonus: i64,
    pub health_bonus: i64,
    pub mana_bonus: i64,
    pub total_nodes_allocated: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub level: i64,
    pub experience_points: i64,
    pub experience_to_next_level: i64,
    pub strength: i64,
    pub intelligence: i64,
    pub endurance: i64,
    pub charisma: i64,
    pub luck: i64,
    pub current_health: i64,
    pub max_health: i64,
    pub gold: i64,
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
    pub difficulty: i64,
    pub base_experience_reward: i64,
    pub gold_reward: i64,
    pub due_date: Option<String>,
    pub status: String,
    pub priority: i64,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub task_type: String,  // "standard", "goal", or "recurring"
    pub goal_target: Option<i64>,
    pub goal_current: Option<i64>,
    pub goal_unit: Option<String>,
    // Recurring task fields
    pub recurrence_pattern: Option<String>,  // JSON string
    pub parent_recurring_task_id: Option<i64>,
    pub instance_date: Option<String>,
    pub current_streak: Option<i64>,
    pub longest_streak: Option<i64>,
    pub last_completed_date: Option<String>,
    pub streak_bonus_multiplier: Option<f64>,
    pub project_id: Option<i64>,  // Project this task belongs to
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub color: String,  // Hex color code
    pub icon: String,   // Emoji icon
    pub status: String, // "active", "completed", "archived"
    pub due_date: Option<String>,
    pub priority: i64,
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub total_xp_earned: i64,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub due_date: Option<String>,
    pub priority: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub difficulty: Option<i64>,
    pub due_date: Option<String>,
    pub priority: Option<i64>,
    pub task_type: Option<String>,
    pub goal_target: Option<i64>,
    pub goal_unit: Option<String>,
    pub recurrence_pattern: Option<String>,  // JSON string for recurring tasks
    pub project_id: Option<i64>,  // Project to assign this task to
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub requirements_type: String,
    pub requirements_value: i64,
    pub experience_reward: i64,
    pub gold_reward: i64,
    pub rarity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAchievement {
    pub id: i64,
    pub user_id: i64,
    pub achievement_id: i64,
    pub achievement: Achievement,
    pub unlocked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Buff {
    pub id: String,
    pub name: String,
    pub buff_type: String, // "stat", "xp_multiplier", "gold_multiplier", "health_regen"
    pub value: f64, // Amount or multiplier
    pub stat_type: Option<String>, // "strength", "intelligence", etc. for stat buffs
    pub duration_minutes: i64,
    pub applied_at: String, // ISO timestamp
    pub expires_at: String, // ISO timestamp
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSession {
    pub id: i64,
    pub task_id: i64,
    pub user_id: i64,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: Option<i64>,
    pub session_type: String, // 'focus', 'break', 'manual', 'pomodoro'
    pub is_completed: bool,
    pub notes: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTimer {
    pub id: i64,
    pub task_id: i64,
    pub user_id: i64,
    pub session_id: i64,
    pub start_time: String,
    pub is_paused: bool,
    pub paused_at: Option<String>,
    pub total_paused_seconds: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeStats {
    pub total_seconds: i64,
    pub total_sessions: i64,
    pub focus_seconds: i64,
    pub break_seconds: i64,
    pub pomodoro_sessions: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub id: i64,
    pub user_id: i64,
    pub due_reminders_enabled: bool,
    pub reminder_minutes_before: i64,
    pub overdue_alerts_enabled: bool,
    pub recurring_reminders_enabled: bool,
    pub daily_agenda_enabled: bool,
    pub daily_agenda_time: String,
    pub weekly_planning_enabled: bool,
    pub weekly_planning_time: String,
    pub achievement_notifications_enabled: bool,
    pub streak_notifications_enabled: bool,
    pub timer_notifications_enabled: bool,
    pub timer_reminder_minutes: i64,
    pub quiet_hours_enabled: bool,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
    pub sound_enabled: bool,
    pub priority_filter: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledNotification {
    pub id: i64,
    pub user_id: i64,
    pub task_id: Option<i64>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub scheduled_for: String,
    pub status: String,
    pub snoozed_until: Option<String>,
    pub snooze_count: i64,
    pub priority: String,
    pub action_url: Option<String>,
    pub created_at: String,
    pub sent_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationHistory {
    pub id: i64,
    pub user_id: i64,
    pub task_id: Option<i64>,
    pub scheduled_notification_id: Option<i64>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub sent_at: String,
    pub action_taken: Option<String>,
    pub action_taken_at: Option<String>,
    pub priority: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNotificationRequest {
    pub task_id: Option<i64>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub scheduled_for: String,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNotificationPreferencesRequest {
    pub due_reminders_enabled: Option<bool>,
    pub reminder_minutes_before: Option<i64>,
    pub overdue_alerts_enabled: Option<bool>,
    pub recurring_reminders_enabled: Option<bool>,
    pub daily_agenda_enabled: Option<bool>,
    pub daily_agenda_time: Option<String>,
    pub weekly_planning_enabled: Option<bool>,
    pub weekly_planning_time: Option<String>,
    pub quiet_hours_enabled: Option<bool>,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
    pub sound_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryItem {
    pub id: String,
    pub name: String,
    pub description: String,
    pub item_type: String, // "consumable", "title", "upgrade"
    pub effect: Option<String>,
    pub quantity: i64,
    pub max_stack: i64,
    pub rarity: String,
    pub icon: String,
    pub obtained_at: String,
}

// All data now persists in SQLite database via managed DbConnection state
// Commands marked as "not yet refactored" are stubbed for auxiliary features

// Basic commands to test the app is working
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Helper function to calculate level from XP
// Helper function to calculate effective difficulty based on user stats
fn calculate_effective_difficulty(base_difficulty: i64, user: &User, task_category: &str) -> f64 {
    let stat_modifier = match task_category {
        "Exercise" | "Health" => user.endurance as f64 * 0.03, // 3% easier per END point
        "Study" | "Work" => user.intelligence as f64 * 0.03,   // 3% easier per INT point  
        "Social" => user.charisma as f64 * 0.03,               // 3% easier per CHA point
        _ => ((user.strength + user.endurance) as f64 / 2.0) * 0.02, // 2% easier per avg STR/END
    };
    
    // Lower effective difficulty means task is easier for this user
    let effective_diff = base_difficulty as f64 * (1.0 - stat_modifier.min(0.5)); // Cap at 50% reduction
    effective_diff.max(1.0) // Minimum difficulty of 1
}

fn calculate_level_and_progress(xp: i64) -> (i64, i64) {
    let level = 1 + (xp / 100);
    let xp_for_next_level = (level + 1) * 100;
    let xp_to_next = xp_for_next_level - xp;
    (level, xp_to_next)
}

// Initialize default user and tasks
// REMOVED: initialize_default_data() - Data now comes from database
// fn initialize_default_data() {
//     // This function is no longer needed as all data is persisted in the database
// }

// Fetch the primary user using an already-open connection.
// Shared by get_user, purchase_item, use_inventory_item, equip_title and unequip_title.
fn fetch_user_sync(conn: &Connection) -> Result<User, String> {
    conn.query_row(
        "SELECT id, username, level, experience_points, experience_to_next_level,
         strength, intelligence, endurance, charisma, luck,
         current_health, max_health, gold, theme_preference, equipped_title
         FROM users WHERE id = 1",
        [],
        |row| {
            Ok(User {
                id: row.get::<_, i64>(0)?,
                username: row.get(1)?,
                level: row.get::<_, i64>(2)?,
                experience_points: row.get::<_, i64>(3)?,
                experience_to_next_level: row.get::<_, i64>(4)?,
                strength: row.get::<_, i64>(5)?,
                intelligence: row.get::<_, i64>(6)?,
                endurance: row.get::<_, i64>(7)?,
                charisma: row.get::<_, i64>(8)?,
                luck: row.get::<_, i64>(9)?,
                current_health: row.get::<_, i64>(10)?,
                max_health: row.get::<_, i64>(11)?,
                gold: row.get::<_, i64>(12)?,
                theme_preference: row.get(13)?,
                equipped_title: row.get(14)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get user: {}", e))
}

#[tauri::command]
async fn get_user(db: tauri::State<'_, DbConnection>) -> Result<User, String> {
    let conn = db.lock().await;
    fetch_user_sync(&conn)
}

#[tauri::command]
async fn get_tasks(db: tauri::State<'_, DbConnection>, status: Option<String>) -> Result<Vec<Task>, String> {
    let conn = db.lock().await;

    let query = match status {
        Some(ref s) => format!(
            "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
             t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
             COALESCE(t.task_type, 'standard') as task_type,
             tp.target_progress as goal_target, tp.current_progress as goal_current,
             t.recurrence_pattern, t.parent_recurring_task_id, t.instance_date,
             t.current_streak, t.longest_streak, t.last_completed_date, t.streak_bonus_multiplier,
             t.project_id
             FROM tasks t
             LEFT JOIN task_progress tp ON t.id = tp.task_id
             WHERE t.user_id = 1 AND t.status = '{}' AND t.status != 'archived'
             ORDER BY t.priority DESC, t.due_date ASC", s
        ),
        None => "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
             t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
             COALESCE(t.task_type, 'standard') as task_type,
             tp.target_progress as goal_target, tp.current_progress as goal_current,
             t.recurrence_pattern, t.parent_recurring_task_id, t.instance_date,
             t.current_streak, t.longest_streak, t.last_completed_date, t.streak_bonus_multiplier,
             t.project_id
             FROM tasks t
             LEFT JOIN task_progress tp ON t.id = tp.task_id
             WHERE t.user_id = 1 AND t.status != 'archived'
             ORDER BY t.priority DESC, t.due_date ASC".to_string(),
    };

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare tasks query: {}", e))?;

    let task_iter = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get::<_, i64>(0)?,
            user_id: row.get::<_, i64>(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            category: row.get(4)?,
            difficulty: row.get::<_, i32>(5).map(|v| v as i64)?,
            base_experience_reward: row.get::<_, i32>(6).map(|v| v as i64)?,
            gold_reward: row.get::<_, i32>(7).map(|v| v as i64)?,
            due_date: row.get(8)?,
            status: row.get(9)?,
            priority: row.get::<_, i32>(10).map(|v| v as i64)?,
            created_at: "".to_string(), // Not in database
            completed_at: None, // TODO: add to database schema
            task_type: row.get(11)?,
            goal_target: row.get::<_, Option<i32>>(12).ok().flatten().map(|v| v as i64),
            goal_current: row.get::<_, Option<i32>>(13).ok().flatten().map(|v| v as i64),
            goal_unit: None, // Not in database yet
            recurrence_pattern: row.get(14)?,
            parent_recurring_task_id: row.get::<_, Option<i32>>(15).ok().flatten().map(|v| v as i64),
            instance_date: row.get(16)?,
            current_streak: row.get::<_, Option<i32>>(17).ok().flatten().map(|v| v as i64),
            longest_streak: row.get::<_, Option<i32>>(18).ok().flatten().map(|v| v as i64),
            last_completed_date: row.get(19)?,
            streak_bonus_multiplier: row.get(20)?,
            project_id: row.get::<_, Option<i32>>(21).ok().flatten().map(|v| v as i64),
        })
    })
    .map_err(|e| format!("Failed to query tasks: {}", e))?;

    let tasks: Result<Vec<Task>, _> = task_iter.collect();
    tasks.map_err(|e| format!("Failed to collect tasks: {}", e))
}

#[tauri::command]
async fn create_task(db: tauri::State<'_, DbConnection>, task_data: CreateTaskRequest) -> Result<Task, String> {
    let difficulty = task_data.difficulty.unwrap_or(5);
    let category = task_data.category.unwrap_or_else(|| "general".to_string());
    let priority = task_data.priority.unwrap_or(3);
    let task_type = task_data.task_type.unwrap_or_else(|| "standard".to_string());

    // Calculate rewards based on difficulty
    let base_xp = 10 + (difficulty - 1) * 5;
    let gold_reward = 1 + (difficulty - 1);

    let conn = db.lock().await;

    // Insert task into database
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    tx.execute(
        "INSERT INTO tasks (user_id, title, description, category, difficulty,
         base_experience_reward, gold_reward, due_date, status, priority, task_type, recurrence_pattern, project_id)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?9, ?10, ?11)",
        rusqlite::params![
            task_data.title,
            task_data.description,
            category,
            difficulty as i32,
            base_xp as i32,
            gold_reward as i32,
            task_data.due_date,
            priority as i32,
            task_type,
            task_data.recurrence_pattern,
            task_data.project_id.map(|v| v as i32),
        ],
    )
    .map_err(|e| format!("Failed to insert task: {}", e))?;

    let task_id = tx.last_insert_rowid();

    // If it's a goal-based task, create progress tracking
    if task_type == "goal" && task_data.goal_target.is_some() {
        tx.execute(
            "INSERT INTO task_progress (task_id, current_progress, target_progress)
             VALUES (?1, 0, ?2)",
            rusqlite::params![task_id, task_data.goal_target.unwrap() as i32],
        )
        .map_err(|e| format!("Failed to insert task progress: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // Return the created task
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
        created_at: "".to_string(),
        completed_at: None,
        task_type,
        goal_target: task_data.goal_target,
        goal_current: if task_data.goal_target.is_some() { Some(0) } else { None },
        goal_unit: task_data.goal_unit,
        recurrence_pattern: task_data.recurrence_pattern,
        parent_recurring_task_id: None,
        instance_date: None,
        current_streak: Some(0),
        longest_streak: Some(0),
        last_completed_date: None,
        streak_bonus_multiplier: Some(1.0),
        project_id: task_data.project_id,
    })
}

#[tauri::command]
async fn complete_task(db: tauri::State<'_, DbConnection>, task_id: i64) -> Result<Task, String> {
    // Perform all database operations in a single scope
    {
        let conn = db.lock().await;

        // Start transaction for atomic updates
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        // Get task details and check if already completed
        let (task_status, xp_reward, gold_reward, parent_recurring_id, current_streak, last_completed):
            (String, i32, i32, Option<i32>, Option<i32>, Option<String>) = tx.query_row(
            "SELECT status, base_experience_reward, gold_reward, parent_recurring_task_id,
             current_streak, last_completed_date FROM tasks WHERE id = ?1 AND user_id = 1",
            [task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
        )
        .map_err(|e| format!("Task not found: {}", e))?;

        if task_status == "completed" {
            drop(tx);
            // Already completed, will fetch and return below
        } else {
            // Get user stats for bonus calculations (including skill tree and active stat buffs)
            let user = fetch_user_sync(&tx)?;
            let (_, buffed_int, _, _, buffed_luck) = apply_stat_buffs_to_user_stats(&user);

            // Calculate stat bonuses
            let int_bonus = buffed_int as f64 * 0.02; // 2% XP bonus per INT point
            let luck_bonus = buffed_luck as f64 * 0.015; // 1.5% gold bonus per LUCK point

            // Calculate streak bonus for recurring tasks
            let (new_streak, streak_multiplier) = if parent_recurring_id.is_some() {
                use chrono::{NaiveDate, Utc};
                let today = Utc::now().naive_utc().date();

                let new_streak = if let Some(last_completed_str) = last_completed {
                    // Parse last completed date
                    if let Ok(last_date) = NaiveDate::parse_from_str(&last_completed_str, "%Y-%m-%d") {
                        let days_since = (today - last_date).num_days();

                        if days_since == 1 {
                            // Consecutive day - increment streak
                            current_streak.unwrap_or(0) + 1
                        } else if days_since == 0 {
                            // Same day - keep current streak
                            current_streak.unwrap_or(0)
                        } else {
                            // Streak broken - start new streak at 1
                            1
                        }
                    } else {
                        1 // Can't parse date, start fresh
                    }
                } else {
                    1 // First completion
                };

                // Calculate streak bonus multiplier
                let multiplier = if new_streak >= 30 {
                    3.0 // 3x XP at 30+ day streak
                } else if new_streak >= 7 {
                    2.0 // 2x XP at 7+ day streak
                } else {
                    1.0 // No bonus
                };

                (new_streak, multiplier)
            } else {
                (0, 1.0) // Not a recurring task
            };

            let stat_xp = (xp_reward as f64 * (1.0 + int_bonus) * streak_multiplier) as i64;
            let stat_gold = (gold_reward as f64 * (1.0 + luck_bonus)) as i64;

            // Apply any active XP/gold buff multipliers (persisted in active_buffs)
            let (final_xp, final_gold) = apply_buff_effects_to_rewards(stat_xp, stat_gold);

            // Mark task as completed and update streak fields for recurring tasks
            if parent_recurring_id.is_some() {
                use chrono::Utc;
                let today = Utc::now().format("%Y-%m-%d").to_string();
                let longest = current_streak.unwrap_or(0).max(new_streak);

                tx.execute(
                    "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
                     current_streak = ?2, longest_streak = ?3, last_completed_date = ?4,
                     streak_bonus_multiplier = ?5 WHERE id = ?1",
                    rusqlite::params![task_id, new_streak, longest, today, streak_multiplier],
                )
                .map_err(|e| format!("Failed to update task status: {}", e))?;
            } else {
                tx.execute(
                    "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                    [task_id],
                )
                .map_err(|e| format!("Failed to update task status: {}", e))?;
            }

            // Update user stats with rewards
            tx.execute(
                "UPDATE users SET experience_points = experience_points + ?1, gold = gold + ?2 WHERE id = 1",
                rusqlite::params![final_xp, final_gold],
            )
            .map_err(|e| format!("Failed to update user stats: {}", e))?;

            println!("Task completed! Base XP: {} -> {} (with stat bonuses), Base Gold: {} -> {} (with stat bonuses)",
                xp_reward, final_xp, gold_reward, final_gold);

            tx.commit()
                .map_err(|e| format!("Failed to commit transaction: {}", e))?;
        }
    } // Connection is dropped here

    // Now fetch and return the completed task
    get_tasks(db, Some("completed".to_string()))
        .await?
        .into_iter()
        .find(|t| t.id == task_id)
        .ok_or("Task not found after completion".to_string())
}

#[tauri::command]
async fn update_task_progress(db: tauri::State<'_, DbConnection>, task_id: i64, progress_amount: i64) -> Result<Task, String> {
    let conn = db.lock().await;

    // Check if task is a goal task
    let (task_type, status, current_progress, target_progress): (String, String, Option<i32>, Option<i32>) = conn.query_row(
        "SELECT t.task_type, t.status, tp.current_progress, tp.target_progress
         FROM tasks t
         LEFT JOIN task_progress tp ON t.id = tp.task_id
         WHERE t.id = ?1",
        [task_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )
    .map_err(|e| format!("Task not found: {}", e))?;

    if task_type != "goal" {
        return Err("Task is not a goal-based task".to_string());
    }

    if status == "completed" {
        drop(conn);
        return get_tasks(db, Some("completed".to_string()))
            .await?
            .into_iter()
            .find(|t| t.id == task_id)
            .ok_or("Task not found".to_string());
    }

    // Update progress
    let current = current_progress.unwrap_or(0);
    let new_current = current + progress_amount as i32;
    let target = target_progress.ok_or("Goal task has no target")?;

    conn.execute(
        "UPDATE task_progress SET current_progress = ?1 WHERE task_id = ?2",
        rusqlite::params![new_current, task_id],
    )
    .map_err(|e| format!("Failed to update progress: {}", e))?;

    // Check if goal is reached
    if new_current >= target {
        // Mark as completed and award rewards
        let (xp_reward, gold_reward): (i32, i32) = conn.query_row(
            "SELECT base_experience_reward, gold_reward FROM tasks WHERE id = ?1",
            [task_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Failed to get rewards: {}", e))?;

        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("Failed to begin transaction: {}", e))?;

        tx.execute(
            "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [task_id],
        )
        .map_err(|e| format!("Failed to complete task: {}", e))?;

        tx.execute(
            "UPDATE users SET experience_points = experience_points + ?1, gold = gold + ?2 WHERE id = 1",
            rusqlite::params![xp_reward, gold_reward],
        )
        .map_err(|e| format!("Failed to update user: {}", e))?;

        tx.commit()
            .map_err(|e| format!("Failed to commit: {}", e))?;

        println!("Goal task completed! Awarded {} XP and {} gold", xp_reward, gold_reward);
    }

    drop(conn);

    // Return updated task
    get_tasks(db, None)
        .await?
        .into_iter()
        .find(|t| t.id == task_id)
        .ok_or("Task not found".to_string())
}

#[tauri::command]
async fn generate_recurring_instances(db: tauri::State<'_, DbConnection>) -> Result<Vec<Task>, String> {
    use chrono::Utc;
    let today = Utc::now().format("%Y-%m-%d").to_string();

    let conn = db.lock().await;

    // Get all recurring parent tasks (tasks with recurrence_pattern that are not instances themselves)
    let mut stmt = conn.prepare(
        "SELECT id, title, description, category, difficulty, base_experience_reward,
         gold_reward, priority, recurrence_pattern, current_streak, longest_streak
         FROM tasks
         WHERE recurrence_pattern IS NOT NULL
         AND parent_recurring_task_id IS NULL
         AND status = 'active'"
    )
    .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let recurring_tasks = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,  // id
            row.get::<_, String>(1)?,  // title
            row.get::<_, Option<String>>(2)?,  // description
            row.get::<_, String>(3)?,  // category
            row.get::<_, i32>(4)?,  // difficulty
            row.get::<_, i32>(5)?,  // base_xp
            row.get::<_, i32>(6)?,  // gold
            row.get::<_, i32>(7)?,  // priority
            row.get::<_, String>(8)?,  // recurrence_pattern
            row.get::<_, Option<i32>>(9)?,  // current_streak
            row.get::<_, Option<i32>>(10)?,  // longest_streak
        ))
    })
    .map_err(|e| format!("Failed to query recurring tasks: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect recurring tasks: {}", e))?;

    let mut created_instances = Vec::new();

    for (parent_id, title, description, category, difficulty, base_xp, gold, priority,
         recurrence_pattern, current_streak, longest_streak) in recurring_tasks {

        // Check if instance already exists for today
        let exists: bool = conn.query_row(
            "SELECT EXISTS(
                SELECT 1 FROM recurring_task_instances
                WHERE recurring_task_id = ?1 AND instance_date = ?2
            )",
            rusqlite::params![parent_id, &today],
            |row| row.get(0),
        )
        .unwrap_or(false);

        if !exists {
            // Create today's instance
            let tx = conn.unchecked_transaction()
                .map_err(|e| format!("Failed to begin transaction: {}", e))?;

            tx.execute(
                "INSERT INTO tasks (user_id, title, description, category, difficulty,
                 base_experience_reward, gold_reward, status, priority, task_type,
                 parent_recurring_task_id, instance_date, current_streak, longest_streak,
                 recurrence_pattern, streak_bonus_multiplier)
                 VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, 'recurring',
                 ?8, ?9, ?10, ?11, ?12, 1.0)",
                rusqlite::params![
                    title,
                    description,
                    category,
                    difficulty,
                    base_xp,
                    gold,
                    priority,
                    parent_id,
                    &today,
                    current_streak,
                    longest_streak,
                    recurrence_pattern,
                ],
            )
            .map_err(|e| format!("Failed to create instance: {}", e))?;

            let instance_id = tx.last_insert_rowid();

            // Track the instance creation
            tx.execute(
                "INSERT INTO recurring_task_instances (recurring_task_id, instance_task_id, instance_date)
                 VALUES (?1, ?2, ?3)",
                rusqlite::params![parent_id, instance_id, &today],
            )
            .map_err(|e| format!("Failed to track instance: {}", e))?;

            tx.commit()
                .map_err(|e| format!("Failed to commit: {}", e))?;

            let title_for_log = title.clone();
        created_instances.push(Task {
                id: instance_id,
                user_id: 1,
                title,
                description,
                category,
                difficulty: difficulty as i64,
                base_experience_reward: base_xp as i64,
                gold_reward: gold as i64,
                due_date: None,
                status: "active".to_string(),
                priority: priority as i64,
                created_at: today.clone(),
                completed_at: None,
                task_type: "recurring".to_string(),
                goal_target: None,
                goal_current: None,
                goal_unit: None,
                recurrence_pattern: Some(recurrence_pattern),
                parent_recurring_task_id: Some(parent_id),
                instance_date: Some(today.clone()),
                current_streak: current_streak.map(|v| v as i64),
                longest_streak: longest_streak.map(|v| v as i64),
                last_completed_date: None,
                streak_bonus_multiplier: Some(1.0),
                project_id: None,
            });

            println!("Created recurring instance for task '{}' (ID: {})", title_for_log, instance_id);
        }
    }

    Ok(created_instances)
}

// ==================== PROJECT MANAGEMENT COMMANDS ====================

#[tauri::command]
async fn get_projects(db: tauri::State<'_, DbConnection>, status: Option<String>) -> Result<Vec<Project>, String> {
    let conn = db.lock().await;

    let query = match status {
        Some(ref s) => format!(
            "SELECT id, user_id, name, description, color, icon, status, due_date, priority,
             total_tasks, completed_tasks, total_xp_earned, created_at, completed_at
             FROM projects
             WHERE user_id = 1 AND status = '{}'
             ORDER BY priority DESC, created_at DESC", s
        ),
        None => "SELECT id, user_id, name, description, color, icon, status, due_date, priority,
             total_tasks, completed_tasks, total_xp_earned, created_at, completed_at
             FROM projects
             WHERE user_id = 1
             ORDER BY priority DESC, created_at DESC".to_string(),
    };

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare projects query: {}", e))?;

    let project_iter = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get::<_, i64>(0)?,
            user_id: row.get::<_, i64>(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            color: row.get(4)?,
            icon: row.get(5)?,
            status: row.get(6)?,
            due_date: row.get(7)?,
            priority: row.get::<_, i32>(8).map(|v| v as i64)?,
            total_tasks: row.get::<_, i32>(9).map(|v| v as i64)?,
            completed_tasks: row.get::<_, i32>(10).map(|v| v as i64)?,
            total_xp_earned: row.get::<_, i32>(11).map(|v| v as i64)?,
            created_at: row.get(12)?,
            completed_at: row.get(13)?,
        })
    })
    .map_err(|e| format!("Failed to query projects: {}", e))?;

    let projects: Result<Vec<Project>, _> = project_iter.collect();
    projects.map_err(|e| format!("Failed to collect projects: {}", e))
}

#[tauri::command]
async fn create_project(db: tauri::State<'_, DbConnection>, project_data: CreateProjectRequest) -> Result<Project, String> {
    let color = project_data.color.unwrap_or_else(|| "#3B82F6".to_string());
    let icon = project_data.icon.unwrap_or_else(|| "📁".to_string());
    let priority = project_data.priority.unwrap_or(3);

    let conn = db.lock().await;

    conn.execute(
        "INSERT INTO projects (user_id, name, description, color, icon, status, due_date, priority)
         VALUES (1, ?1, ?2, ?3, ?4, 'active', ?5, ?6)",
        rusqlite::params![
            project_data.name,
            project_data.description,
            color,
            icon,
            project_data.due_date,
            priority as i32,
        ],
    )
    .map_err(|e| format!("Failed to create project: {}", e))?;

    let project_id = conn.last_insert_rowid();

    Ok(Project {
        id: project_id,
        user_id: 1,
        name: project_data.name,
        description: project_data.description,
        color,
        icon,
        status: "active".to_string(),
        due_date: project_data.due_date,
        priority,
        total_tasks: 0,
        completed_tasks: 0,
        total_xp_earned: 0,
        created_at: Utc::now().to_rfc3339(),
        completed_at: None,
    })
}

#[tauri::command]
async fn update_project(db: tauri::State<'_, DbConnection>, project_id: i64, project_data: CreateProjectRequest) -> Result<Project, String> {
    let conn = db.lock().await;

    conn.execute(
        "UPDATE projects
         SET name = ?1, description = ?2, color = COALESCE(?3, color), icon = COALESCE(?4, icon),
             due_date = ?5, priority = COALESCE(?6, priority)
         WHERE id = ?7",
        rusqlite::params![
            project_data.name,
            project_data.description,
            project_data.color,
            project_data.icon,
            project_data.due_date,
            project_data.priority.map(|v| v as i32),
            project_id,
        ],
    )
    .map_err(|e| format!("Failed to update project: {}", e))?;

    // Drop the lock before calling get_projects
    drop(conn);

    // Fetch and return the updated project
    get_projects(db, None).await?
        .into_iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| "Project not found after update".to_string())
}

#[tauri::command]
async fn delete_project(db: tauri::State<'_, DbConnection>, project_id: i64) -> Result<String, String> {
    let conn = db.lock().await;

    // This will set project_id to NULL for all tasks due to ON DELETE SET NULL
    conn.execute(
        "DELETE FROM projects WHERE id = ?1",
        rusqlite::params![project_id],
    )
    .map_err(|e| format!("Failed to delete project: {}", e))?;

    Ok(format!("Project {} deleted successfully", project_id))
}

#[tauri::command]
async fn assign_task_to_project(db: tauri::State<'_, DbConnection>, task_id: i64, project_id: Option<i64>) -> Result<String, String> {
    let conn = db.lock().await;

    conn.execute(
        "UPDATE tasks SET project_id = ?1 WHERE id = ?2",
        rusqlite::params![project_id.map(|v| v as i32), task_id],
    )
    .map_err(|e| format!("Failed to assign task to project: {}", e))?;

    Ok("Task assigned successfully".to_string())
}

// ==================== TIME TRACKING COMMANDS ====================

#[tauri::command]
async fn start_timer(db: tauri::State<'_, DbConnection>, task_id: i64, session_type: Option<String>) -> Result<ActiveTimer, String> {
    let conn = db.lock().await;
    let session_type_str = session_type.unwrap_or_else(|| "focus".to_string());
    let now = chrono::Utc::now().to_rfc3339();

    // Check if there's already an active timer for this user
    let existing: Option<i64> = conn.query_row(
        "SELECT id FROM active_timers WHERE user_id = 1",
        [],
        |row| row.get(0)
    ).ok();

    if existing.is_some() {
        return Err("Another timer is already running. Stop it first.".to_string());
    }

    // Create a new time session
    conn.execute(
        "INSERT INTO time_sessions (task_id, user_id, start_time, session_type) VALUES (?1, 1, ?2, ?3)",
        rusqlite::params![task_id, now, session_type_str],
    ).map_err(|e| format!("Failed to create time session: {}", e))?;

    let session_id = conn.last_insert_rowid();

    // Create active timer
    conn.execute(
        "INSERT INTO active_timers (task_id, user_id, session_id, start_time) VALUES (?1, 1, ?2, ?3)",
        rusqlite::params![task_id, session_id, now],
    ).map_err(|e| format!("Failed to create active timer: {}", e))?;

    let timer_id = conn.last_insert_rowid();

    // Return the created timer
    let timer = conn.query_row(
        "SELECT id, task_id, user_id, session_id, start_time, is_paused, paused_at, total_paused_seconds, created_at
         FROM active_timers WHERE id = ?1",
        [timer_id],
        |row| Ok(ActiveTimer {
            id: row.get::<_, i32>(0)? as i64,
            task_id: row.get::<_, i32>(1)? as i64,
            user_id: row.get::<_, i32>(2)? as i64,
            session_id: row.get::<_, i32>(3)? as i64,
            start_time: row.get(4)?,
            is_paused: row.get(5)?,
            paused_at: row.get(6)?,
            total_paused_seconds: row.get::<_, i32>(7)? as i64,
            created_at: row.get(8)?,
        })
    ).map_err(|e| format!("Failed to retrieve timer: {}", e))?;

    Ok(timer)
}

#[tauri::command]
async fn pause_timer(db: tauri::State<'_, DbConnection>) -> Result<ActiveTimer, String> {
    let conn = db.lock().await;
    let now = chrono::Utc::now().to_rfc3339();

    // Get active timer
    let timer_id: i64 = conn.query_row(
        "SELECT id FROM active_timers WHERE user_id = 1",
        [],
        |row| row.get::<_, i32>(0).map(|v| v as i64)
    ).map_err(|_| "No active timer found".to_string())?;

    // Update timer to paused state
    conn.execute(
        "UPDATE active_timers SET is_paused = 1, paused_at = ?1 WHERE id = ?2",
        rusqlite::params![now, timer_id],
    ).map_err(|e| format!("Failed to pause timer: {}", e))?;

    // Return updated timer
    let timer = conn.query_row(
        "SELECT id, task_id, user_id, session_id, start_time, is_paused, paused_at, total_paused_seconds, created_at
         FROM active_timers WHERE id = ?1",
        [timer_id],
        |row| Ok(ActiveTimer {
            id: row.get::<_, i32>(0)? as i64,
            task_id: row.get::<_, i32>(1)? as i64,
            user_id: row.get::<_, i32>(2)? as i64,
            session_id: row.get::<_, i32>(3)? as i64,
            start_time: row.get(4)?,
            is_paused: row.get(5)?,
            paused_at: row.get(6)?,
            total_paused_seconds: row.get::<_, i32>(7)? as i64,
            created_at: row.get(8)?,
        })
    ).map_err(|e| format!("Failed to retrieve timer: {}", e))?;

    Ok(timer)
}

#[tauri::command]
async fn stop_timer(db: tauri::State<'_, DbConnection>, notes: Option<String>) -> Result<TimeSession, String> {
    let conn = db.lock().await;
    let now = chrono::Utc::now().to_rfc3339();

    // Get active timer
    let (timer_id, session_id, task_id): (i64, i64, i64) = conn.query_row(
        "SELECT id, session_id, task_id FROM active_timers WHERE user_id = 1",
        [],
        |row| Ok((
            row.get::<_, i32>(0)? as i64,
            row.get::<_, i32>(1)? as i64,
            row.get::<_, i32>(2)? as i64,
        ))
    ).map_err(|_| "No active timer found".to_string())?;

    // Update time session with end time and notes
    conn.execute(
        "UPDATE time_sessions SET end_time = ?1, notes = ?2 WHERE id = ?3",
        rusqlite::params![now, notes, session_id],
    ).map_err(|e| format!("Failed to update session: {}", e))?;

    // Delete active timer
    conn.execute(
        "DELETE FROM active_timers WHERE id = ?1",
        [timer_id],
    ).map_err(|e| format!("Failed to delete timer: {}", e))?;

    // Return the completed session
    let session = conn.query_row(
        "SELECT id, task_id, user_id, start_time, end_time, duration_seconds, session_type, is_completed, notes, tags, created_at
         FROM time_sessions WHERE id = ?1",
        [session_id],
        |row| Ok(TimeSession {
            id: row.get::<_, i32>(0)? as i64,
            task_id: row.get::<_, i32>(1)? as i64,
            user_id: row.get::<_, i32>(2)? as i64,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            duration_seconds: row.get::<_, Option<i32>>(5)?.map(|v| v as i64),
            session_type: row.get(6)?,
            is_completed: row.get(7)?,
            notes: row.get(8)?,
            tags: row.get(9)?,
            created_at: row.get(10)?,
        })
    ).map_err(|e| format!("Failed to retrieve session: {}", e))?;

    Ok(session)
}

#[tauri::command]
async fn get_active_timer(db: tauri::State<'_, DbConnection>) -> Result<Option<ActiveTimer>, String> {
    let conn = db.lock().await;

    let timer = conn.query_row(
        "SELECT id, task_id, user_id, session_id, start_time, is_paused, paused_at, total_paused_seconds, created_at
         FROM active_timers WHERE user_id = 1",
        [],
        |row| Ok(ActiveTimer {
            id: row.get::<_, i32>(0)? as i64,
            task_id: row.get::<_, i32>(1)? as i64,
            user_id: row.get::<_, i32>(2)? as i64,
            session_id: row.get::<_, i32>(3)? as i64,
            start_time: row.get(4)?,
            is_paused: row.get(5)?,
            paused_at: row.get(6)?,
            total_paused_seconds: row.get::<_, i32>(7)? as i64,
            created_at: row.get(8)?,
        })
    ).optional()
    .map_err(|e| format!("Failed to query timer: {}", e))?;

    Ok(timer)
}

#[tauri::command]
async fn get_time_sessions(db: tauri::State<'_, DbConnection>, task_id: Option<i64>, limit: Option<i64>) -> Result<Vec<TimeSession>, String> {
    let conn = db.lock().await;
    let limit_val = limit.unwrap_or(50);

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match task_id {
        Some(tid) => (
            "SELECT id, task_id, user_id, start_time, end_time, duration_seconds, session_type, is_completed, notes, tags, created_at
             FROM time_sessions WHERE user_id = 1 AND task_id = ?1 AND end_time IS NOT NULL
             ORDER BY start_time DESC LIMIT ?2".to_string(),
            vec![Box::new(tid as i32), Box::new(limit_val as i32)]
        ),
        None => (
            "SELECT id, task_id, user_id, start_time, end_time, duration_seconds, session_type, is_completed, notes, tags, created_at
             FROM time_sessions WHERE user_id = 1 AND end_time IS NOT NULL
             ORDER BY start_time DESC LIMIT ?1".to_string(),
            vec![Box::new(limit_val as i32)]
        ),
    };

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let sessions_iter = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(TimeSession {
            id: row.get::<_, i32>(0)? as i64,
            task_id: row.get::<_, i32>(1)? as i64,
            user_id: row.get::<_, i32>(2)? as i64,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            duration_seconds: row.get::<_, Option<i32>>(5)?.map(|v| v as i64),
            session_type: row.get(6)?,
            is_completed: row.get(7)?,
            notes: row.get(8)?,
            tags: row.get(9)?,
            created_at: row.get(10)?,
        })
    }).map_err(|e| format!("Failed to query sessions: {}", e))?;

    let sessions: Result<Vec<TimeSession>, _> = sessions_iter.collect();
    sessions.map_err(|e| format!("Failed to collect sessions: {}", e))
}

#[tauri::command]
async fn get_time_stats(db: tauri::State<'_, DbConnection>, task_id: Option<i64>) -> Result<TimeStats, String> {
    let conn = db.lock().await;

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match task_id {
        Some(tid) => (
            "SELECT
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as total_sessions,
                COALESCE(SUM(CASE WHEN session_type = 'focus' THEN duration_seconds ELSE 0 END), 0) as focus_seconds,
                COALESCE(SUM(CASE WHEN session_type = 'break' THEN duration_seconds ELSE 0 END), 0) as break_seconds,
                COALESCE(SUM(CASE WHEN session_type = 'pomodoro' THEN 1 ELSE 0 END), 0) as pomodoro_sessions
             FROM time_sessions WHERE user_id = 1 AND task_id = ?1 AND end_time IS NOT NULL".to_string(),
            vec![Box::new(tid as i32)]
        ),
        None => (
            "SELECT
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as total_sessions,
                COALESCE(SUM(CASE WHEN session_type = 'focus' THEN duration_seconds ELSE 0 END), 0) as focus_seconds,
                COALESCE(SUM(CASE WHEN session_type = 'break' THEN duration_seconds ELSE 0 END), 0) as break_seconds,
                COALESCE(SUM(CASE WHEN session_type = 'pomodoro' THEN 1 ELSE 0 END), 0) as pomodoro_sessions
             FROM time_sessions WHERE user_id = 1 AND end_time IS NOT NULL".to_string(),
            vec![]
        ),
    };

    let stats = conn.query_row(&query, rusqlite::params_from_iter(params.iter()), |row| {
        Ok(TimeStats {
            total_seconds: row.get::<_, i32>(0)? as i64,
            total_sessions: row.get::<_, i32>(1)? as i64,
            focus_seconds: row.get::<_, i32>(2)? as i64,
            break_seconds: row.get::<_, i32>(3)? as i64,
            pomodoro_sessions: row.get::<_, i32>(4)? as i64,
        })
    }).map_err(|e| format!("Failed to get stats: {}", e))?;

    Ok(stats)
}

#[tauri::command]
async fn update_estimated_time(db: tauri::State<'_, DbConnection>, task_id: i64, estimated_minutes: i64) -> Result<String, String> {
    let conn = db.lock().await;

    conn.execute(
        "UPDATE tasks SET estimated_time_minutes = ?1 WHERE id = ?2",
        rusqlite::params![estimated_minutes as i32, task_id],
    ).map_err(|e| format!("Failed to update estimated time: {}", e))?;

    Ok("Estimated time updated successfully".to_string())
}

// ==================== NOTIFICATION COMMANDS ====================

#[tauri::command]
async fn schedule_notification(
    db: tauri::State<'_, DbConnection>,
    notification_data: CreateNotificationRequest
) -> Result<ScheduledNotification, String> {
    let conn = db.lock().await;
    let priority = notification_data.priority.unwrap_or_else(|| "medium".to_string());

    conn.execute(
        "INSERT INTO scheduled_notifications (user_id, task_id, notification_type, title, message, scheduled_for, priority, status)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, 'pending')",
        rusqlite::params![
            notification_data.task_id,
            notification_data.notification_type,
            notification_data.title,
            notification_data.message,
            notification_data.scheduled_for,
            priority
        ],
    ).map_err(|e| format!("Failed to schedule notification: {}", e))?;

    let notification_id = conn.last_insert_rowid();

    let notification = conn.query_row(
        "SELECT id, user_id, task_id, notification_type, title, message, scheduled_for, status,
                snoozed_until, snooze_count, priority, action_url, created_at, sent_at
         FROM scheduled_notifications WHERE id = ?1",
        [notification_id],
        |row| Ok(ScheduledNotification {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            task_id: row.get::<_, Option<i32>>(2)?.map(|v| v as i64),
            notification_type: row.get(3)?,
            title: row.get(4)?,
            message: row.get(5)?,
            scheduled_for: row.get(6)?,
            status: row.get(7)?,
            snoozed_until: row.get(8)?,
            snooze_count: row.get::<_, i32>(9)? as i64,
            priority: row.get(10)?,
            action_url: row.get(11)?,
            created_at: row.get(12)?,
            sent_at: row.get(13)?,
        })
    ).map_err(|e| format!("Failed to retrieve notification: {}", e))?;

    Ok(notification)
}

#[tauri::command]
async fn cancel_notification(db: tauri::State<'_, DbConnection>, notification_id: i64) -> Result<String, String> {
    let conn = db.lock().await;

    conn.execute(
        "UPDATE scheduled_notifications SET status = 'cancelled' WHERE id = ?1 AND status = 'pending'",
        [notification_id],
    ).map_err(|e| format!("Failed to cancel notification: {}", e))?;

    Ok("Notification cancelled successfully".to_string())
}

#[tauri::command]
async fn get_scheduled_notifications(
    db: tauri::State<'_, DbConnection>,
    status: Option<String>
) -> Result<Vec<ScheduledNotification>, String> {
    let conn = db.lock().await;

    let (query, params): (String, Vec<Box<dyn rusqlite::ToSql>>) = match status {
        Some(s) => (
            "SELECT id, user_id, task_id, notification_type, title, message, scheduled_for, status,
                    snoozed_until, snooze_count, priority, action_url, created_at, sent_at
             FROM scheduled_notifications WHERE user_id = 1 AND status = ?1
             ORDER BY scheduled_for ASC".to_string(),
            vec![Box::new(s)]
        ),
        None => (
            "SELECT id, user_id, task_id, notification_type, title, message, scheduled_for, status,
                    snoozed_until, snooze_count, priority, action_url, created_at, sent_at
             FROM scheduled_notifications WHERE user_id = 1
             ORDER BY scheduled_for ASC".to_string(),
            vec![]
        ),
    };

    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let notifications_iter = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(ScheduledNotification {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            task_id: row.get::<_, Option<i32>>(2)?.map(|v| v as i64),
            notification_type: row.get(3)?,
            title: row.get(4)?,
            message: row.get(5)?,
            scheduled_for: row.get(6)?,
            status: row.get(7)?,
            snoozed_until: row.get(8)?,
            snooze_count: row.get::<_, i32>(9)? as i64,
            priority: row.get(10)?,
            action_url: row.get(11)?,
            created_at: row.get(12)?,
            sent_at: row.get(13)?,
        })
    }).map_err(|e| format!("Failed to query notifications: {}", e))?;

    let notifications: Result<Vec<ScheduledNotification>, _> = notifications_iter.collect();
    notifications.map_err(|e| format!("Failed to collect notifications: {}", e))
}

#[tauri::command]
async fn snooze_notification(
    db: tauri::State<'_, DbConnection>,
    notification_id: i64,
    snooze_minutes: i64
) -> Result<ScheduledNotification, String> {
    let conn = db.lock().await;
    let snooze_until = chrono::Utc::now() + chrono::Duration::minutes(snooze_minutes);

    conn.execute(
        "UPDATE scheduled_notifications
         SET status = 'snoozed', snoozed_until = ?1, snooze_count = snooze_count + 1
         WHERE id = ?2",
        rusqlite::params![snooze_until.to_rfc3339(), notification_id],
    ).map_err(|e| format!("Failed to snooze notification: {}", e))?;

    // Get updated notification
    let notification = conn.query_row(
        "SELECT id, user_id, task_id, notification_type, title, message, scheduled_for, status,
                snoozed_until, snooze_count, priority, action_url, created_at, sent_at
         FROM scheduled_notifications WHERE id = ?1",
        [notification_id],
        |row| Ok(ScheduledNotification {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            task_id: row.get::<_, Option<i32>>(2)?.map(|v| v as i64),
            notification_type: row.get(3)?,
            title: row.get(4)?,
            message: row.get(5)?,
            scheduled_for: row.get(6)?,
            status: row.get(7)?,
            snoozed_until: row.get(8)?,
            snooze_count: row.get::<_, i32>(9)? as i64,
            priority: row.get(10)?,
            action_url: row.get(11)?,
            created_at: row.get(12)?,
            sent_at: row.get(13)?,
        })
    ).map_err(|e| format!("Failed to retrieve notification: {}", e))?;

    Ok(notification)
}

#[tauri::command]
async fn get_notification_preferences(db: tauri::State<'_, DbConnection>) -> Result<NotificationPreferences, String> {
    let conn = db.lock().await;

    let prefs = conn.query_row(
        "SELECT id, user_id, due_reminders_enabled, reminder_minutes_before, overdue_alerts_enabled,
                recurring_reminders_enabled, daily_agenda_enabled, daily_agenda_time,
                weekly_planning_enabled, weekly_planning_time, achievement_notifications_enabled,
                streak_notifications_enabled, timer_notifications_enabled, timer_reminder_minutes,
                quiet_hours_enabled, quiet_hours_start, quiet_hours_end, sound_enabled,
                priority_filter, created_at, updated_at
         FROM notification_preferences WHERE user_id = 1",
        [],
        |row| Ok(NotificationPreferences {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            due_reminders_enabled: row.get(2)?,
            reminder_minutes_before: row.get::<_, i32>(3)? as i64,
            overdue_alerts_enabled: row.get(4)?,
            recurring_reminders_enabled: row.get(5)?,
            daily_agenda_enabled: row.get(6)?,
            daily_agenda_time: row.get(7)?,
            weekly_planning_enabled: row.get(8)?,
            weekly_planning_time: row.get(9)?,
            achievement_notifications_enabled: row.get(10)?,
            streak_notifications_enabled: row.get(11)?,
            timer_notifications_enabled: row.get(12)?,
            timer_reminder_minutes: row.get::<_, i32>(13)? as i64,
            quiet_hours_enabled: row.get(14)?,
            quiet_hours_start: row.get(15)?,
            quiet_hours_end: row.get(16)?,
            sound_enabled: row.get(17)?,
            priority_filter: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    ).map_err(|e| format!("Failed to get notification preferences: {}", e))?;

    Ok(prefs)
}

#[tauri::command]
async fn update_notification_preferences(
    db: tauri::State<'_, DbConnection>,
    prefs: UpdateNotificationPreferencesRequest
) -> Result<NotificationPreferences, String> {
    // Scope block to ensure conn and params are dropped before the await
    {
        let conn = db.lock().await;

        // Build dynamic UPDATE query based on provided fields
        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(val) = prefs.due_reminders_enabled {
            updates.push("due_reminders_enabled = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.reminder_minutes_before {
            updates.push("reminder_minutes_before = ?");
            params.push(Box::new(val as i32));
        }
        if let Some(val) = prefs.overdue_alerts_enabled {
            updates.push("overdue_alerts_enabled = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.recurring_reminders_enabled {
            updates.push("recurring_reminders_enabled = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.daily_agenda_enabled {
            updates.push("daily_agenda_enabled = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.daily_agenda_time {
            updates.push("daily_agenda_time = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.quiet_hours_enabled {
            updates.push("quiet_hours_enabled = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.quiet_hours_start {
            updates.push("quiet_hours_start = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.quiet_hours_end {
            updates.push("quiet_hours_end = ?");
            params.push(Box::new(val));
        }
        if let Some(val) = prefs.sound_enabled {
            updates.push("sound_enabled = ?");
            params.push(Box::new(val));
        }

        if !updates.is_empty() {
            let query = format!(
                "UPDATE notification_preferences SET {} WHERE user_id = 1",
                updates.join(", ")
            );

            conn.execute(&query, rusqlite::params_from_iter(params.iter()))
                .map_err(|e| format!("Failed to update preferences: {}", e))?;
        }
    }

    // Return updated preferences
    get_notification_preferences(db).await
}

#[tauri::command]
async fn get_notification_history(
    db: tauri::State<'_, DbConnection>,
    limit: Option<i64>
) -> Result<Vec<NotificationHistory>, String> {
    let conn = db.lock().await;
    let limit_val = limit.unwrap_or(50);

    let mut stmt = conn.prepare(
        "SELECT id, user_id, task_id, scheduled_notification_id, notification_type, title, message,
                sent_at, action_taken, action_taken_at, priority, created_at
         FROM notification_history WHERE user_id = 1
         ORDER BY sent_at DESC LIMIT ?1"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let history_iter = stmt.query_map([limit_val as i32], |row| {
        Ok(NotificationHistory {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            task_id: row.get::<_, Option<i32>>(2)?.map(|v| v as i64),
            scheduled_notification_id: row.get::<_, Option<i32>>(3)?.map(|v| v as i64),
            notification_type: row.get(4)?,
            title: row.get(5)?,
            message: row.get(6)?,
            sent_at: row.get(7)?,
            action_taken: row.get(8)?,
            action_taken_at: row.get(9)?,
            priority: row.get(10)?,
            created_at: row.get(11)?,
        })
    }).map_err(|e| format!("Failed to query history: {}", e))?;

    let history: Result<Vec<NotificationHistory>, _> = history_iter.collect();
    history.map_err(|e| format!("Failed to collect history: {}", e))
}

#[tauri::command]
async fn mark_notification_actioned(
    db: tauri::State<'_, DbConnection>,
    history_id: i64,
    action: String
) -> Result<String, String> {
    let conn = db.lock().await;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE notification_history SET action_taken = ?1, action_taken_at = ?2 WHERE id = ?3",
        rusqlite::params![action, now, history_id],
    ).map_err(|e| format!("Failed to mark action: {}", e))?;

    Ok("Action recorded successfully".to_string())
}

#[tauri::command]
async fn mark_notification_sent(db: tauri::State<'_, DbConnection>, notification_id: i64) -> Result<String, String> {
    let conn = db.lock().await;

    // The mark_notification_sent DB trigger (migration 008) sets sent_at and
    // inserts the notification_history row when status transitions to 'sent'.
    conn.execute(
        "UPDATE scheduled_notifications SET status = 'sent' WHERE id = ?1 AND status IN ('pending', 'snoozed')",
        [notification_id],
    ).map_err(|e| format!("Failed to mark notification sent: {}", e))?;

    Ok("Notification marked as sent".to_string())
}

#[tauri::command]
async fn get_pending_notifications(db: tauri::State<'_, DbConnection>) -> Result<Vec<ScheduledNotification>, String> {
    let conn = db.lock().await;

    // NOTE: v_pending_notifications does not expose all columns needed here (status,
    // snooze fields, timestamps), so query the table directly with the same
    // "due within 5 minutes" window, also including snoozed notifications whose
    // snooze period has elapsed.
    let mut stmt = conn.prepare(
        "SELECT id, user_id, task_id, notification_type, title, message, scheduled_for, status,
                snoozed_until, snooze_count, priority, action_url, created_at, sent_at
         FROM scheduled_notifications
         WHERE user_id = 1
           AND ((status = 'pending' AND datetime(scheduled_for) <= datetime('now', '+5 minutes'))
             OR (status = 'snoozed' AND snoozed_until IS NOT NULL AND datetime(snoozed_until) <= datetime('now', '+5 minutes')))
         ORDER BY scheduled_for ASC"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let notifications_iter = stmt.query_map([], |row| {
        Ok(ScheduledNotification {
            id: row.get::<_, i32>(0)? as i64,
            user_id: row.get::<_, i32>(1)? as i64,
            task_id: row.get::<_, Option<i32>>(2)?.map(|v| v as i64),
            notification_type: row.get(3)?,
            title: row.get(4)?,
            message: row.get(5)?,
            scheduled_for: row.get(6)?,
            status: row.get(7)?,
            snoozed_until: row.get(8)?,
            snooze_count: row.get::<_, i32>(9)? as i64,
            priority: row.get(10)?,
            action_url: row.get(11)?,
            created_at: row.get(12)?,
            sent_at: row.get(13)?,
        })
    }).map_err(|e| format!("Failed to query pending notifications: {}", e))?;

    let notifications: Result<Vec<ScheduledNotification>, _> = notifications_iter.collect();
    notifications.map_err(|e| format!("Failed to collect notifications: {}", e))
}

#[tauri::command]
async fn get_user_achievements(db: tauri::State<'_, DbConnection>) -> Result<Vec<UserAchievement>, String> {
    let conn = db.lock().await;

    let mut stmt = conn.prepare(
        "SELECT ua.id, ua.user_id, ua.achievement_id, ua.unlocked_at,
         a.id, a.name, a.description, a.icon, a.requirements_type, a.requirements_value,
         a.experience_reward, a.gold_reward, a.rarity
         FROM user_achievements ua
         JOIN achievements a ON ua.achievement_id = a.id
         WHERE ua.user_id = 1
         ORDER BY ua.unlocked_at DESC",
    )
    .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let achievements_iter = stmt.query_map([], |row| {
        Ok(UserAchievement {
            id: row.get(0)?,
            user_id: row.get(1)?,
            achievement_id: row.get(2)?,
            unlocked_at: row.get(3)?,
            achievement: Achievement {
                id: row.get(4)?,
                name: row.get(5)?,
                description: row.get(6)?,
                icon: row.get(7)?,
                requirements_type: row.get(8)?,
                requirements_value: row.get::<_, i32>(9).map(|v| v as i64)?,
                experience_reward: row.get::<_, i32>(10).map(|v| v as i64)?,
                gold_reward: row.get::<_, i32>(11).map(|v| v as i64)?,
                rarity: row.get(12)?,
            },
        })
    })
    .map_err(|e| format!("Failed to query achievements: {}", e))?;

    let achievements: Result<Vec<UserAchievement>, _> = achievements_iter.collect();
    achievements.map_err(|e| format!("Failed to collect achievements: {}", e))
}

#[tauri::command]
async fn check_achievements(db: tauri::State<'_, DbConnection>) -> Result<Vec<Achievement>, String> {
    let conn = db.lock().await;

    // Get user stats
    let (level, gold): (i32, i32) = conn.query_row(
        "SELECT level, gold FROM users WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|e| format!("Failed to get user: {}", e))?;

    // Count completed tasks
    let completed_tasks: i32 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0);

    // Get all achievements
    let mut stmt = conn.prepare(
        "SELECT id, name, description, icon, requirements_type, requirements_value,
         experience_reward, gold_reward, rarity FROM achievements",
    )
    .map_err(|e| format!("Failed to prepare achievements: {}", e))?;

    let mut achievements: Vec<Achievement> = stmt.query_map([], |row| {
        Ok(Achievement {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
            requirements_type: row.get(4)?,
            requirements_value: row.get::<_, i32>(5).map(|v| v as i64)?,
            experience_reward: row.get::<_, i32>(6).map(|v| v as i64)?,
            gold_reward: row.get::<_, i32>(7).map(|v| v as i64)?,
            rarity: row.get(8)?,
        })
    })
    .map_err(|e| format!("Failed to query achievements: {}", e))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Failed to collect achievements: {}", e))?;

    let mut newly_unlocked = Vec::new();

    for achievement in achievements {
        // Check if already unlocked
        let already_unlocked: i32 = conn.query_row(
            "SELECT COUNT(*) FROM user_achievements WHERE user_id = 1 AND achievement_id = ?1",
            [achievement.id],
            |row| row.get(0),
        )
        .unwrap_or(0);

        if already_unlocked == 0 {
            let meets_requirement = match achievement.requirements_type.as_str() {
                "tasks_completed" | "task_count" => completed_tasks as i64 >= achievement.requirements_value,
                "level" => level as i64 >= achievement.requirements_value,
                "gold" => gold as i64 >= achievement.requirements_value,
                _ => false,
            };

            if meets_requirement {
                // Unlock achievement
                conn.execute(
                    "INSERT INTO user_achievements (user_id, achievement_id) VALUES (1, ?1)",
                    [achievement.id],
                )
                .map_err(|e| format!("Failed to unlock achievement: {}", e))?;

                // Award rewards
                conn.execute(
                    "UPDATE users SET experience_points = experience_points + ?1, gold = gold + ?2 WHERE id = 1",
                    rusqlite::params![achievement.experience_reward as i32, achievement.gold_reward as i32],
                )
                .map_err(|e| format!("Failed to award rewards: {}", e))?;

                println!("Achievement unlocked: {} - Rewarded {} XP and {} gold",
                    achievement.name, achievement.experience_reward, achievement.gold_reward);

                newly_unlocked.push(achievement);
            }
        }
    }

    Ok(newly_unlocked)
}

// Helper function to get item data by ID
fn get_item_data(item_id: &str) -> InventoryItem {
    let current_time = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    
    match item_id {
        "health_potion_small" => InventoryItem {
            id: item_id.to_string(),
            name: "Minor Health Potion".to_string(),
            description: "Restores 25 health points".to_string(),
            item_type: "consumable".to_string(),
            effect: Some("restore_health:25".to_string()),
            quantity: 1,
            max_stack: 99,
            rarity: "common".to_string(),
            icon: "heart".to_string(),
            obtained_at: current_time,
        },
        "health_potion_large" => InventoryItem {
            id: item_id.to_string(),
            name: "Major Health Potion".to_string(),
            description: "Restores 100 health points".to_string(),
            item_type: "consumable".to_string(),
            effect: Some("restore_health:100".to_string()),
            quantity: 1,
            max_stack: 99,
            rarity: "uncommon".to_string(),
            icon: "heart".to_string(),
            obtained_at: current_time,
        },
        "xp_boost" => InventoryItem {
            id: item_id.to_string(),
            name: "XP Boost Elixir".to_string(),
            description: "Doubles XP gains for 30 minutes".to_string(),
            item_type: "consumable".to_string(),
            effect: Some("xp_multiplier:2.0:30".to_string()),
            quantity: 1,
            max_stack: 10,
            rarity: "rare".to_string(),
            icon: "zap".to_string(),
            obtained_at: current_time,
        },
        "gold_boost_potion" => InventoryItem {
            id: item_id.to_string(),
            name: "Fortune Elixir".to_string(),
            description: "Increases gold gains by 50% for 60 minutes".to_string(),
            item_type: "consumable".to_string(),
            effect: Some("gold_multiplier:1.5:60".to_string()),
            quantity: 1,
            max_stack: 99,
            rarity: "uncommon".to_string(),
            icon: "coins".to_string(),
            obtained_at: current_time,
        },
        "strength_potion" => InventoryItem {
            id: item_id.to_string(),
            name: "Titan's Strength".to_string(),
            description: "Increases Strength by 10 for 45 minutes".to_string(),
            item_type: "consumable".to_string(),
            effect: Some("stat_boost:strength:10:45".to_string()),
            quantity: 1,
            max_stack: 99,
            rarity: "rare".to_string(),
            icon: "zap".to_string(),
            obtained_at: current_time,
        },
        "title_novice" => InventoryItem {
            id: item_id.to_string(),
            name: "Title: Quest Novice".to_string(),
            description: "Show your dedication to the quest system".to_string(),
            item_type: "title".to_string(),
            effect: None,
            quantity: 1,
            max_stack: 1,
            rarity: "common".to_string(),
            icon: "star".to_string(),
            obtained_at: current_time,
        },
        "title_master" => InventoryItem {
            id: item_id.to_string(),
            name: "Title: Quest Master".to_string(),
            description: "For those who have mastered the art of questing".to_string(),
            item_type: "title".to_string(),
            effect: None,
            quantity: 1,
            max_stack: 1,
            rarity: "epic".to_string(),
            icon: "crown".to_string(),
            obtained_at: current_time,
        },
        _ => InventoryItem {
            id: item_id.to_string(),
            name: "Unknown Item".to_string(),
            description: "An unknown item".to_string(),
            item_type: "consumable".to_string(),
            effect: None,
            quantity: 1,
            max_stack: 1,
            rarity: "common".to_string(),
            icon: "question".to_string(),
            obtained_at: current_time,
        }
    }
}

// ===== Inventory commands (persisted in inventory_items, catalog id stored in `name`) =====

// Convert SQLite "YYYY-MM-DD HH:MM:SS" timestamps to ISO 8601 for the frontend
fn sqlite_datetime_to_iso(ts: &str) -> String {
    if ts.contains('T') {
        ts.to_string()
    } else {
        format!("{}Z", ts.replacen(' ', "T", 1))
    }
}

#[tauri::command]
async fn get_user_inventory(db: tauri::State<'_, DbConnection>) -> Result<Vec<InventoryItem>, String> {
    let conn = db.lock().await;

    let mut stmt = conn.prepare(
        "SELECT name, quantity, created_at FROM inventory_items
         WHERE user_id = 1 ORDER BY item_type, name"
    ).map_err(|e| format!("Failed to prepare inventory query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
        ))
    }).map_err(|e| format!("Failed to query inventory: {}", e))?;

    let mut items = Vec::new();
    for row in rows {
        let (item_id, quantity, created_at) = row
            .map_err(|e| format!("Failed to read inventory row: {}", e))?;
        // The `name` column stores the catalog item id; metadata comes from the catalog
        let mut item = get_item_data(&item_id);
        item.quantity = quantity;
        item.obtained_at = sqlite_datetime_to_iso(&created_at);
        items.push(item);
    }

    Ok(items)
}

#[tauri::command]
async fn use_inventory_item(db: tauri::State<'_, DbConnection>, item_id: String) -> Result<User, String> {
    let conn = db.lock().await;

    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let quantity: i64 = tx.query_row(
        "SELECT quantity FROM inventory_items WHERE user_id = 1 AND name = ?1",
        [&item_id],
        |row| row.get(0),
    ).map_err(|_| format!("Item '{}' not found in inventory", item_id))?;

    let item = get_item_data(&item_id);
    if item.item_type != "consumable" {
        return Err(format!("{} cannot be used directly", item.name));
    }

    // Consume one item
    if quantity <= 1 {
        tx.execute(
            "DELETE FROM inventory_items WHERE user_id = 1 AND name = ?1",
            [&item_id],
        ).map_err(|e| format!("Failed to remove item: {}", e))?;
    } else {
        tx.execute(
            "UPDATE inventory_items SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = 1 AND name = ?1",
            [&item_id],
        ).map_err(|e| format!("Failed to update item quantity: {}", e))?;
    }

    // Apply the item's effect
    if let Some(effect) = &item.effect {
        apply_item_effect(&tx, effect, &item.name)?;
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    fetch_user_sync(&conn)
}

// Apply an item effect string (e.g. "restore_health:25", "xp_multiplier:2.0:30",
// "stat_boost:strength:10:45") against the database
fn apply_item_effect(conn: &Connection, effect: &str, source_name: &str) -> Result<(), String> {
    let parts: Vec<&str> = effect.split(':').collect();

    match parts[0] {
        "restore_health" => {
            let amount: i64 = parts.get(1).and_then(|p| p.parse().ok())
                .ok_or_else(|| format!("Invalid effect format: {}", effect))?;
            conn.execute(
                "UPDATE users SET current_health = MIN(max_health, current_health + ?1) WHERE id = 1",
                [amount],
            ).map_err(|e| format!("Failed to restore health: {}", e))?;
            println!("Restored {} health", amount);
        },
        "xp_multiplier" | "gold_multiplier" => {
            if parts.len() < 3 {
                return Err(format!("Invalid effect format: {}", effect));
            }
            let multiplier: f64 = parts[1].parse()
                .map_err(|_| format!("Invalid effect format: {}", effect))?;
            let duration: i64 = parts[2].parse()
                .map_err(|_| format!("Invalid effect format: {}", effect))?;
            insert_buff(conn, parts[0], multiplier, None, duration, Some(source_name))?;
            println!("Applied {}x {} for {} minutes", multiplier, parts[0], duration);
        },
        "stat_boost" => {
            if parts.len() < 4 {
                return Err(format!("Invalid effect format: {}", effect));
            }
            let amount: f64 = parts[2].parse()
                .map_err(|_| format!("Invalid effect format: {}", effect))?;
            let duration: i64 = parts[3].parse()
                .map_err(|_| format!("Invalid effect format: {}", effect))?;
            insert_buff(conn, "stat", amount, Some(parts[1].to_string()), duration, Some(source_name))?;
            println!("Applied +{} {} boost for {} minutes", amount, parts[1], duration);
        },
        _ => {
            return Err("Unknown item effect".to_string());
        }
    }

    Ok(())
}

// ===== Buff persistence helpers (active_buffs table) =====

// The active_buffs table CHECK-constrains buff_type; map between the frontend
// naming ("xp_multiplier"/"gold_multiplier"/"stat") and the DB naming.
fn buff_type_to_db(buff_type: &str) -> &'static str {
    match buff_type {
        "xp_multiplier" | "xp_boost" => "xp_boost",
        "gold_multiplier" | "gold_boost" => "gold_boost",
        "stat" | "stat_boost" => "stat_boost",
        "health_regen" => "health_regen",
        _ => "other",
    }
}

fn buff_type_from_db(db_type: &str) -> String {
    match db_type {
        "xp_boost" => "xp_multiplier".to_string(),
        "gold_boost" => "gold_multiplier".to_string(),
        "stat_boost" => "stat".to_string(),
        other => other.to_string(),
    }
}

fn buff_display_name(buff_type: &str, stat_type: &Option<String>) -> String {
    match buff_type_to_db(buff_type) {
        "xp_boost" => "XP Boost".to_string(),
        "gold_boost" => "Gold Boost".to_string(),
        "stat_boost" => match stat_type {
            Some(stat) => {
                let mut chars = stat.chars();
                let capitalized = match chars.next() {
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                    None => String::new(),
                };
                format!("{} Boost", capitalized)
            }
            None => "Stat Boost".to_string(),
        },
        "health_regen" => "Health Regeneration".to_string(),
        _ => "Mysterious Buff".to_string(),
    }
}

// Insert a buff row into active_buffs and return it in the frontend Buff shape.
// Timestamps are stored as "YYYY-MM-DD HH:MM:SS" (UTC) so they compare correctly
// against SQLite's datetime('now') / CURRENT_TIMESTAMP.
fn insert_buff(
    conn: &Connection,
    buff_type: &str,
    value: f64,
    stat_type: Option<String>,
    duration_minutes: i64,
    source: Option<&str>,
) -> Result<Buff, String> {
    let name = buff_display_name(buff_type, &stat_type);
    let applied_at = Utc::now();
    let expires_at = applied_at + Duration::minutes(duration_minutes);
    let applied_str = applied_at.format("%Y-%m-%d %H:%M:%S").to_string();
    let expires_str = expires_at.format("%Y-%m-%d %H:%M:%S").to_string();

    conn.execute(
        "INSERT INTO active_buffs (user_id, name, description, buff_type, effect_value,
         affected_stat, started_at, expires_at, source)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            name,
            format!("Active for {} minutes", duration_minutes),
            buff_type_to_db(buff_type),
            value,
            stat_type,
            applied_str,
            expires_str,
            source,
        ],
    ).map_err(|e| format!("Failed to insert buff: {}", e))?;

    Ok(Buff {
        id: conn.last_insert_rowid().to_string(),
        name,
        buff_type: buff_type_from_db(buff_type_to_db(buff_type)),
        value,
        stat_type,
        duration_minutes,
        applied_at: sqlite_datetime_to_iso(&applied_str),
        expires_at: sqlite_datetime_to_iso(&expires_str),
    })
}

// ===== Title commands (derived titles + user_titles table, equipped in users.equipped_title) =====

// Titles are derived from level and unlocked achievements, plus any title items
// owned in the inventory and titles recorded in the user_titles table.
fn compute_user_titles(conn: &Connection) -> Result<Vec<String>, String> {
    let level: i64 = conn.query_row(
        "SELECT level FROM users WHERE id = 1",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get user level: {}", e))?;

    let achievement_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM user_achievements WHERE user_id = 1",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let mut titles: Vec<String> = Vec::new();

    // Level-derived titles
    let level_titles: [(i64, &str); 6] = [
        (1, "Adventurer"),
        (5, "Rising Hero"),
        (10, "Veteran Adventurer"),
        (20, "Elite Champion"),
        (35, "Legendary Hero"),
        (50, "Ascended Legend"),
    ];
    for (required_level, title) in level_titles {
        if level >= required_level {
            titles.push(title.to_string());
        }
    }

    // Achievement-derived titles
    let achievement_titles: [(i64, &str); 3] = [
        (1, "Achievement Hunter"),
        (5, "Trophy Collector"),
        (10, "Completionist"),
    ];
    for (required_count, title) in achievement_titles {
        if achievement_count >= required_count {
            titles.push(title.to_string());
        }
    }

    // Title items owned in the inventory (display name comes from the catalog)
    let mut stmt = conn.prepare(
        "SELECT name FROM inventory_items WHERE user_id = 1 AND item_type = 'title'"
    ).map_err(|e| format!("Failed to prepare title items query: {}", e))?;
    let item_ids = stmt.query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query title items: {}", e))?;
    for item_id in item_ids.flatten() {
        let title = get_item_data(&item_id).name;
        if !titles.contains(&title) {
            titles.push(title);
        }
    }

    // Titles recorded in the user_titles table
    let mut stmt = conn.prepare(
        "SELECT title FROM user_titles WHERE user_id = 1 ORDER BY unlocked_at"
    ).map_err(|e| format!("Failed to prepare user titles query: {}", e))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query user titles: {}", e))?;
    for title in rows.flatten() {
        if !titles.contains(&title) {
            titles.push(title);
        }
    }

    Ok(titles)
}

#[tauri::command]
async fn get_user_titles(db: tauri::State<'_, DbConnection>) -> Result<Vec<String>, String> {
    let conn = db.lock().await;
    compute_user_titles(&conn)
}

#[tauri::command]
async fn equip_title(db: tauri::State<'_, DbConnection>, title: String) -> Result<User, String> {
    let conn = db.lock().await;

    let owned_titles = compute_user_titles(&conn)?;
    if !owned_titles.contains(&title) {
        return Err(format!("Title '{}' has not been unlocked", title));
    }

    conn.execute(
        "UPDATE users SET equipped_title = ?1 WHERE id = 1",
        [&title],
    ).map_err(|e| format!("Failed to equip title: {}", e))?;

    // Keep the user_titles table in sync for titles tracked there
    conn.execute(
        "UPDATE user_titles SET is_equipped = (title = ?1) WHERE user_id = 1",
        [&title],
    ).map_err(|e| format!("Failed to update title state: {}", e))?;

    fetch_user_sync(&conn)
}

#[tauri::command]
async fn unequip_title(db: tauri::State<'_, DbConnection>) -> Result<User, String> {
    let conn = db.lock().await;

    conn.execute("UPDATE users SET equipped_title = NULL WHERE id = 1", [])
        .map_err(|e| format!("Failed to unequip title: {}", e))?;
    conn.execute("UPDATE user_titles SET is_equipped = FALSE WHERE user_id = 1", [])
        .map_err(|e| format!("Failed to update title state: {}", e))?;

    fetch_user_sync(&conn)
}

// Apply active XP/gold buff multipliers (from active_buffs) to task rewards.
// Uses the strongest active multiplier of each type to prevent unbounded stacking.
fn apply_buff_effects_to_rewards(base_xp: i64, base_gold: i64) -> (i64, i64) {
    let (xp_mult, gold_mult) = match get_db_connection() {
        Ok(conn) => conn.query_row(
            "SELECT COALESCE(MAX(CASE WHEN buff_type = 'xp_boost' THEN effect_value END), 1.0),
                    COALESCE(MAX(CASE WHEN buff_type = 'gold_boost' THEN effect_value END), 1.0)
             FROM active_buffs WHERE user_id = 1 AND expires_at > datetime('now')",
            [],
            |row| Ok((row.get::<_, f64>(0)?, row.get::<_, f64>(1)?)),
        ).unwrap_or((1.0, 1.0)),
        Err(_) => (1.0, 1.0),
    };

    (
        ((base_xp as f64) * xp_mult).round() as i64,
        ((base_gold as f64) * gold_mult).round() as i64,
    )
}

fn get_user_skill_stats_sync() -> Result<UserSkillStats, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT available_skill_points, strength_bonus, intelligence_bonus, luck_bonus,
                aura_bonus, will_bonus, health_bonus, mana_bonus, total_nodes_allocated
         FROM user_skill_stats WHERE user_id = 1"
    ).map_err(|e| e.to_string())?;
    
    let result = stmt.query_row([], |row| {
        Ok(UserSkillStats {
            available_skill_points: row.get(0)?,
            strength_bonus: row.get(1)?,
            intelligence_bonus: row.get(2)?,
            luck_bonus: row.get(3)?,
            aura_bonus: row.get(4)?,
            will_bonus: row.get(5)?,
            health_bonus: row.get(6)?,
            mana_bonus: row.get(7)?,
            total_nodes_allocated: row.get(8)?,
        })
    });
    
    match result {
        Ok(stats) => Ok(stats),
        Err(_) => {
            // Return default stats if none exist
            Ok(UserSkillStats {
                available_skill_points: 10,
                strength_bonus: 0,
                intelligence_bonus: 0,
                luck_bonus: 0,
                aura_bonus: 0,
                will_bonus: 0,
                health_bonus: 0,
                mana_bonus: 0,
                total_nodes_allocated: 0,
            })
        }
    }
}

fn apply_stat_buffs_to_user_stats(user: &User) -> (i64, i64, i64, i64, i64) {
    // Start with base user stats
    let mut strength = user.strength;
    let mut intelligence = user.intelligence;
    let mut endurance = user.endurance;
    let mut charisma = user.charisma;
    let mut luck = user.luck;

    // Apply skill tree stat bonuses
    if let Ok(skill_stats) = get_user_skill_stats_sync() {
        strength += skill_stats.strength_bonus;
        intelligence += skill_stats.intelligence_bonus;
        luck += skill_stats.luck_bonus;
        // Skill tree has aura and will instead of endurance and charisma;
        // map aura to charisma and will to endurance for compatibility
        charisma += skill_stats.aura_bonus;
        endurance += skill_stats.will_bonus;
    }

    // Apply active stat buffs persisted in the database
    if let Ok(conn) = get_db_connection() {
        if let Ok(mut stmt) = conn.prepare(
            "SELECT affected_stat, effect_value FROM active_buffs
             WHERE user_id = 1 AND buff_type = 'stat_boost' AND expires_at > datetime('now')"
        ) {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok((row.get::<_, Option<String>>(0)?, row.get::<_, f64>(1)?))
            }) {
                for (stat, value) in rows.flatten() {
                    match stat.as_deref() {
                        Some("strength") => strength += value as i64,
                        Some("intelligence") => intelligence += value as i64,
                        Some("endurance") => endurance += value as i64,
                        Some("charisma") => charisma += value as i64,
                        Some("luck") => luck += value as i64,
                        _ => {}
                    }
                }
            }
        }
    }

    (strength, intelligence, endurance, charisma, luck)
}

// Compute the original duration in minutes from stored start/expiry timestamps
fn duration_minutes_between(start: &str, end: &str) -> i64 {
    use chrono::NaiveDateTime;
    let format = "%Y-%m-%d %H:%M:%S";
    match (
        NaiveDateTime::parse_from_str(start, format),
        NaiveDateTime::parse_from_str(end, format),
    ) {
        (Ok(start), Ok(end)) => (end - start).num_minutes(),
        _ => 0,
    }
}

#[tauri::command]
async fn get_active_buffs(db: tauri::State<'_, DbConnection>) -> Result<Vec<Buff>, String> {
    let conn = db.lock().await;

    // Lazily remove expired buffs
    conn.execute("DELETE FROM active_buffs WHERE expires_at < datetime('now')", [])
        .map_err(|e| format!("Failed to clean expired buffs: {}", e))?;

    let mut stmt = conn.prepare(
        "SELECT id, name, buff_type, effect_value, affected_stat, started_at, expires_at
         FROM active_buffs WHERE user_id = 1 AND expires_at > datetime('now')
         ORDER BY expires_at"
    ).map_err(|e| format!("Failed to prepare buffs query: {}", e))?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, f64>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
        ))
    }).map_err(|e| format!("Failed to query buffs: {}", e))?;

    let mut buffs = Vec::new();
    for row in rows {
        let (id, name, db_type, value, stat_type, started_at, expires_at) = row
            .map_err(|e| format!("Failed to read buff row: {}", e))?;
        buffs.push(Buff {
            id: id.to_string(),
            name,
            buff_type: buff_type_from_db(&db_type),
            value,
            stat_type,
            duration_minutes: duration_minutes_between(&started_at, &expires_at),
            applied_at: sqlite_datetime_to_iso(&started_at),
            expires_at: sqlite_datetime_to_iso(&expires_at),
        });
    }

    Ok(buffs)
}

#[tauri::command]
async fn apply_buff(db: tauri::State<'_, DbConnection>, buff_type: String, value: f64, stat_type: Option<String>, duration_minutes: i64) -> Result<Buff, String> {
    let conn = db.lock().await;
    insert_buff(&conn, &buff_type, value, stat_type, duration_minutes, Some("manual"))
}

// Database connection helper
fn get_db_connection() -> Result<Connection> {
    // During development, use the database in src-tauri directory
    let db_path = if cfg!(debug_assertions) {
        // Development mode - use src-tauri/game.db
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("game.db")
    } else {
        // Production mode - use relative path
        std::path::PathBuf::from("game.db")
    };
    
    Connection::open(&db_path)
}

// Skill Tree Command Functions
#[tauri::command]
async fn get_skill_nodes() -> Result<Vec<SkillNode>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT node_key, name, description, node_type, primary_stat, skill_point_cost, 
                level_requirement, x_position, y_position, prerequisite_nodes,
                stat_bonuses, color_hex, size
         FROM skill_nodes"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        let prerequisite_string: String = row.get(9).unwrap_or_default();
        let prerequisites: Vec<String> = if prerequisite_string.is_empty() || prerequisite_string == "[]" {
            Vec::new()
        } else {
            // Parse JSON array or comma-separated list
            if prerequisite_string.starts_with('[') {
                serde_json::from_str(&prerequisite_string).unwrap_or_default()
            } else {
                prerequisite_string.split(',').map(|s| s.trim().to_string()).collect()
            }
        };
        
        // Parse stat_bonuses JSON
        let stat_bonuses_json: String = row.get(10).unwrap_or_else(|_| "{}".to_string());
        let stat_bonuses: serde_json::Value = serde_json::from_str(&stat_bonuses_json).unwrap_or(serde_json::json!({}));
        
        Ok(SkillNode {
            node_key: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            node_type: row.get(3)?,
            primary_stat: row.get(4)?,
            skill_point_cost: row.get(5)?,
            level_requirement: row.get(6)?,
            x_position: row.get(7)?,
            y_position: row.get(8)?,
            prerequisite_nodes: prerequisites,
            stats: SkillNodeStats {
                strength: stat_bonuses["strength"].as_i64().unwrap_or(0),
                intelligence: stat_bonuses["intelligence"].as_i64().unwrap_or(0),
                luck: stat_bonuses["luck"].as_i64().unwrap_or(0),
                aura: stat_bonuses["aura"].as_i64().unwrap_or(0),
                will: stat_bonuses["will"].as_i64().unwrap_or(0),
                health: stat_bonuses["health"].as_i64().unwrap_or(0),
                mana: stat_bonuses["mana"].as_i64().unwrap_or(0),
            },
            color_hex: row.get(11)?,
            size: row.get(12)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut nodes = Vec::new();
    for row in rows {
        nodes.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(nodes)
}

#[tauri::command]
async fn get_skill_tree_connections() -> Result<Vec<SkillTreeConnection>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT from_node, to_node FROM skill_tree_connections"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(SkillTreeConnection {
            from_node: row.get(0)?,
            to_node: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut connections = Vec::new();
    for row in rows {
        connections.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(connections)
}

#[tauri::command]
async fn get_user_skill_allocations() -> Result<Vec<String>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT node_key FROM user_skill_allocations WHERE user_id = 1"
    ).map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(0)?)
    }).map_err(|e| e.to_string())?;
    
    let mut allocations = Vec::new();
    for row in rows {
        allocations.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(allocations)
}

#[tauri::command]
async fn get_user_skill_stats() -> Result<UserSkillStats, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get or create user skill stats
    let mut stmt = conn.prepare(
        "SELECT available_skill_points, strength_bonus, intelligence_bonus, luck_bonus,
                aura_bonus, will_bonus, health_bonus, mana_bonus, total_nodes_allocated
         FROM user_skill_stats WHERE user_id = 1"
    ).map_err(|e| e.to_string())?;
    
    let result = stmt.query_row([], |row| {
        Ok(UserSkillStats {
            available_skill_points: row.get(0)?,
            strength_bonus: row.get(1)?,
            intelligence_bonus: row.get(2)?,
            luck_bonus: row.get(3)?,
            aura_bonus: row.get(4)?,
            will_bonus: row.get(5)?,
            health_bonus: row.get(6)?,
            mana_bonus: row.get(7)?,
            total_nodes_allocated: row.get(8)?,
        })
    });
    
    match result {
        Ok(stats) => Ok(stats),
        Err(_) => {
            // Create default stats if none exist
            conn.execute(
                "INSERT INTO user_skill_stats 
                 (user_id, available_skill_points, strength_bonus, intelligence_bonus, luck_bonus,
                  aura_bonus, will_bonus, health_bonus, mana_bonus) 
                 VALUES (1, 10, 0, 0, 0, 0, 0, 0, 0)",
                []
            ).map_err(|e| e.to_string())?;
            
            Ok(UserSkillStats {
                available_skill_points: 10,
                strength_bonus: 0,
                intelligence_bonus: 0,
                luck_bonus: 0,
                aura_bonus: 0,
                will_bonus: 0,
                health_bonus: 0,
                mana_bonus: 0,
                total_nodes_allocated: 0,
            })
        }
    }
}

#[tauri::command]
async fn allocate_skill_node(node_key: String) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if already allocated
    let exists: bool = conn.query_row(
        "SELECT 1 FROM user_skill_allocations WHERE user_id = 1 AND node_key = ?",
        [&node_key],
        |_| Ok(true)
    ).unwrap_or(false);
    
    if exists {
        return Err("Node already allocated".to_string());
    }
    
    // Get node info
    let (cost, stats): (i64, (i64, i64, i64, i64, i64, i64, i64)) = conn.query_row(
        "SELECT skill_point_cost, strength_bonus, intelligence_bonus, luck_bonus,
                aura_bonus, will_bonus, health_bonus, mana_bonus
         FROM skill_nodes WHERE node_key = ?",
        [&node_key],
        |row| Ok((
            row.get(0)?,
            (row.get(1).unwrap_or(0), row.get(2).unwrap_or(0), row.get(3).unwrap_or(0),
             row.get(4).unwrap_or(0), row.get(5).unwrap_or(0), row.get(6).unwrap_or(0), row.get(7).unwrap_or(0))
        ))
    ).map_err(|e| format!("Node not found: {}", e))?;
    
    // Check available points
    let available_points: i64 = conn.query_row(
        "SELECT available_skill_points FROM user_skill_stats WHERE user_id = 1",
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    if available_points < cost {
        return Err("Not enough skill points".to_string());
    }
    
    // Allocate node
    conn.execute(
        "INSERT INTO user_skill_allocations (user_id, node_key) VALUES (1, ?)",
        [&node_key]
    ).map_err(|e| e.to_string())?;
    
    // Update stats
    conn.execute(
        "UPDATE user_skill_stats SET 
         available_skill_points = available_skill_points - ?,
         strength_bonus = strength_bonus + ?,
         intelligence_bonus = intelligence_bonus + ?,
         luck_bonus = luck_bonus + ?,
         aura_bonus = aura_bonus + ?,
         will_bonus = will_bonus + ?,
         health_bonus = health_bonus + ?,
         mana_bonus = mana_bonus + ?
         WHERE user_id = 1",
        [cost, stats.0, stats.1, stats.2, stats.3, stats.4, stats.5, stats.6]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn deallocate_skill_node(node_key: String) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if allocated
    let exists: bool = conn.query_row(
        "SELECT 1 FROM user_skill_allocations WHERE user_id = 1 AND node_key = ?",
        [&node_key],
        |_| Ok(true)
    ).unwrap_or(false);
    
    if !exists {
        return Err("Node not allocated".to_string());
    }
    
    // Get node info
    let (cost, stats): (i64, (i64, i64, i64, i64, i64, i64, i64)) = conn.query_row(
        "SELECT skill_point_cost, strength_bonus, intelligence_bonus, luck_bonus,
                aura_bonus, will_bonus, health_bonus, mana_bonus
         FROM skill_nodes WHERE node_key = ?",
        [&node_key],
        |row| Ok((
            row.get(0)?,
            (row.get(1).unwrap_or(0), row.get(2).unwrap_or(0), row.get(3).unwrap_or(0),
             row.get(4).unwrap_or(0), row.get(5).unwrap_or(0), row.get(6).unwrap_or(0), row.get(7).unwrap_or(0))
        ))
    ).map_err(|e| format!("Node not found: {}", e))?;
    
    // Remove allocation
    conn.execute(
        "DELETE FROM user_skill_allocations WHERE user_id = 1 AND node_key = ?",
        [&node_key]
    ).map_err(|e| e.to_string())?;
    
    // Restore stats
    conn.execute(
        "UPDATE user_skill_stats SET 
         available_skill_points = available_skill_points + ?,
         strength_bonus = strength_bonus - ?,
         intelligence_bonus = intelligence_bonus - ?,
         luck_bonus = luck_bonus - ?,
         aura_bonus = aura_bonus - ?,
         will_bonus = will_bonus - ?,
         health_bonus = health_bonus - ?,
         mana_bonus = mana_bonus - ?
         WHERE user_id = 1",
        [cost, stats.0, stats.1, stats.2, stats.3, stats.4, stats.5, stats.6]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn reset_skill_tree() -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get total allocated points
    let total_points: i64 = conn.query_row(
        "SELECT COUNT(*) * (SELECT AVG(skill_point_cost) FROM skill_nodes s 
                          INNER JOIN user_skill_allocations u ON s.node_key = u.node_key
                          WHERE u.user_id = 1)
         FROM user_skill_allocations WHERE user_id = 1",
        [],
        |row| row.get(0)
    ).unwrap_or(0);
    
    // Clear all allocations
    conn.execute(
        "DELETE FROM user_skill_allocations WHERE user_id = 1",
        []
    ).map_err(|e| e.to_string())?;
    
    // Reset stats and restore points
    conn.execute(
        "UPDATE user_skill_stats SET 
         available_skill_points = available_skill_points + ?,
         strength_bonus = 0,
         intelligence_bonus = 0,
         luck_bonus = 0,
         aura_bonus = 0,
         will_bonus = 0,
         health_bonus = 0,
         mana_bonus = 0
         WHERE user_id = 1",
        [total_points]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn update_node_position(node_key: String, x_position: f64, y_position: f64) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Update node position in database
    conn.execute(
        "UPDATE skill_nodes SET x_position = ?, y_position = ? WHERE node_key = ?",
        rusqlite::params![x_position, y_position, node_key]
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

// Get recommended task difficulty based on user stats
#[tauri::command]
async fn get_recommended_difficulty(task_category: String) -> Result<i64, String> {
    Ok(5)
}

#[tauri::command]
async fn purchase_item(db: tauri::State<'_, DbConnection>, item_id: String, price: i64) -> Result<User, String> {
    let conn = db.lock().await;

    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let gold: i64 = tx.query_row(
        "SELECT gold FROM users WHERE id = 1",
        [],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to get user gold: {}", e))?;

    if gold < price {
        return Err(format!("Not enough gold! You need {} gold but only have {}.", price, gold));
    }

    let item = get_item_data(&item_id);

    // Enforce stack limits (titles are unique, consumables cap at max_stack)
    let existing_quantity: Option<i64> = tx.query_row(
        "SELECT quantity FROM inventory_items WHERE user_id = 1 AND name = ?1",
        [&item_id],
        |row| row.get(0),
    ).optional().map_err(|e| format!("Failed to check inventory: {}", e))?;

    if let Some(quantity) = existing_quantity {
        if quantity >= item.max_stack {
            return Err(format!("You already have the maximum amount of {}.", item.name));
        }
    }

    // Deduct gold
    tx.execute("UPDATE users SET gold = gold - ?1 WHERE id = 1", [price])
        .map_err(|e| format!("Failed to deduct gold: {}", e))?;

    // Upsert the inventory row (the `name` column stores the catalog item id)
    if existing_quantity.is_some() {
        tx.execute(
            "UPDATE inventory_items SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = 1 AND name = ?1",
            [&item_id],
        ).map_err(|e| format!("Failed to update inventory: {}", e))?;
    } else {
        tx.execute(
            "INSERT INTO inventory_items (user_id, name, description, item_type, rarity, quantity, price, effects, icon)
             VALUES (1, ?1, ?2, ?3, ?4, 1, ?5, ?6, ?7)",
            rusqlite::params![
                item_id,
                item.description,
                item.item_type,
                item.rarity,
                price,
                item.effect,
                item.icon,
            ],
        ).map_err(|e| format!("Failed to add item to inventory: {}", e))?;
    }

    // Purchased title items are recorded as unlocked titles immediately
    if item.item_type == "title" {
        tx.execute(
            "INSERT OR IGNORE INTO user_titles (user_id, title, description, rarity)
             VALUES (1, ?1, ?2, ?3)",
            rusqlite::params![item.name, item.description, item.rarity],
        ).map_err(|e| format!("Failed to record title: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;

    fetch_user_sync(&conn)
}


// Calendar Integration Commands live in commands/calendar.rs (real Calendar.app
// sync via osascript/JXA — replaces the previous mock implementations).

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub id: Option<i64>,
    pub user_id: i64,
    pub date: String, // Format: YYYY-MM-DD
    pub tasks_completed: i64,
    pub xp_earned: i64,
    pub gold_earned: i64,
    pub productivity_score: f64,
}

// Database performance initialization
#[tauri::command]
async fn initialize_database() -> Result<(), String> {
    match Connection::open("game.db") {
        Ok(connection) => {
            // Enable WAL mode for better concurrent performance
            connection.pragma_update(None, "journal_mode", "WAL").map_err(|e| format!("Failed to set WAL mode: {}", e))?;
            
            // Set synchronous to NORMAL for better performance while maintaining durability
            connection.pragma_update(None, "synchronous", "NORMAL").map_err(|e| format!("Failed to set synchronous mode: {}", e))?;
            
            // Use memory for temp storage
            connection.pragma_update(None, "temp_store", "MEMORY").map_err(|e| format!("Failed to set temp store: {}", e))?;
            
            // Enable memory mapping for faster reads (256MB)
            connection.pragma_update(None, "mmap_size", 268435456).map_err(|e| format!("Failed to set mmap size: {}", e))?;
            
            // Increase cache size for better performance (10000 pages)
            connection.pragma_update(None, "cache_size", 10000).map_err(|e| format!("Failed to set cache size: {}", e))?;
            
            // Create indexes for better query performance
            create_database_indexes(&connection)?;
            
            println!("Database performance optimizations applied successfully");
            Ok(())
        }
        Err(e) => Err(format!("Failed to open database: {}", e))
    }
}

// Create database indexes for performance
fn create_database_indexes(connection: &Connection) -> Result<(), String> {
    // Index for user achievements
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_achievements ON user_achievements(user_id, achievement_id, unlocked_at)",
        []
    ).map_err(|e| format!("Failed to create user_achievements index: {}", e))?;
    
    // Index for tasks
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id, status, created_at)",
        []
    ).map_err(|e| format!("Failed to create tasks index: {}", e))?;
    
    // Index for daily stats
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_daily_stats ON daily_stats(user_id, date)",
        []
    ).map_err(|e| format!("Failed to create daily_stats index: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn get_daily_stats() -> Result<DailyStats, String> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    
    match Connection::open("game.db") {
        Ok(connection) => {
            let mut stats = DailyStats {
                id: None,
                user_id: 1, // Assuming user ID 1 for now
                date: today.clone(),
                tasks_completed: 0,
                xp_earned: 0,
                gold_earned: 0,
                productivity_score: 0.0,
            };
            
            // Try to get existing stats for today
            let query = "SELECT id, tasks_completed, xp_earned, gold_earned, productivity_score 
                        FROM daily_stats WHERE user_id = 1 AND date = ?";
            
            if let Ok(mut statement) = connection.prepare(query) {
                let result = statement.query_row([&today], |row| {
                    Ok(DailyStats {
                        id: Some(row.get(0)?),
                        user_id: 1,
                        date: today.clone(),
                        tasks_completed: row.get(1)?,
                        xp_earned: row.get(2)?,
                        gold_earned: row.get(3)?,
                        productivity_score: row.get(4)?,
                    })
                });
                
                if let Ok(existing_stats) = result {
                    stats = existing_stats;
                }
            }
            
            Ok(stats)
        }
        Err(e) => Err(format!("Database error: {}", e))
    }
}

#[tauri::command]
async fn update_daily_stats(tasks_increment: i64, xp_increment: i64, gold_increment: i64) -> Result<DailyStats, String> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    
    match Connection::open("game.db") {
        Ok(connection) => {
            // Insert or update daily stats
            let query = "INSERT OR REPLACE INTO daily_stats 
                        (user_id, date, tasks_completed, xp_earned, gold_earned, productivity_score, updated_at)
                        VALUES (1, ?, 
                               COALESCE((SELECT tasks_completed FROM daily_stats WHERE user_id = 1 AND date = ?), 0) + ?,
                               COALESCE((SELECT xp_earned FROM daily_stats WHERE user_id = 1 AND date = ?), 0) + ?,
                               COALESCE((SELECT gold_earned FROM daily_stats WHERE user_id = 1 AND date = ?), 0) + ?,
                               MIN(100, COALESCE((SELECT tasks_completed FROM daily_stats WHERE user_id = 1 AND date = ?), 0) + ? * 15 + 
                               (COALESCE((SELECT xp_earned FROM daily_stats WHERE user_id = 1 AND date = ?), 0) + ?) * 0.1),
                               CURRENT_TIMESTAMP)";
            
            match connection.execute(
                query, 
                [
                    &today.clone(),     // date
                    &today.clone(),     // date for SELECT tasks_completed
                    &tasks_increment.to_string(),   // tasks increment
                    &today.clone(),     // date for SELECT xp_earned
                    &xp_increment.to_string(),      // xp increment
                    &today.clone(),     // date for SELECT gold_earned
                    &gold_increment.to_string(),    // gold increment
                    &today.clone(),     // date for productivity score calc
                    &tasks_increment.to_string(),   // tasks for productivity score
                    &today.clone(),     // date for productivity score calc (xp)
                    &xp_increment.to_string(),      // xp for productivity score
                ]
            ) {
                Ok(_) => {
                    
                    // Return updated stats
                    get_daily_stats().await
                }
                Err(e) => Err(format!("Failed to prepare statement: {}", e))
            }
        }
        Err(e) => Err(format!("Database error: {}", e))
    }
}

// Achievement popup system
#[tauri::command]
async fn create_achievement_popup(
    _app: tauri::AppHandle,
    achievement: Achievement,
) -> Result<(), String> {
    // Temporarily disabled - will be fixed later
    println!("Achievement unlocked: {} - {}", achievement.name, achievement.description);
    Ok(())
}

// Automated backup system
#[tauri::command]
async fn create_backup() -> Result<String, String> {
    let backup_name = format!("backup_{}", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
    let backup_path = format!("{}.db", backup_name);
    
    match Connection::open("game.db") {
        Ok(connection) => {
            // Use VACUUM INTO for consistent backup
            match connection.execute(&format!("VACUUM INTO '{}'", backup_path), []) {
                Ok(_) => {
                    println!("Backup created successfully: {}", backup_path);
                    Ok(backup_path)
                }
                Err(e) => Err(format!("Failed to create backup: {}", e))
            }
        }
        Err(e) => Err(format!("Failed to open database: {}", e))
    }
}

#[tauri::command]
async fn schedule_automatic_backups() -> Result<(), String> {
    tokio::spawn(async {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600)); // Hourly backups
        
        loop {
            interval.tick().await;
            
            match create_backup().await {
                Ok(backup_path) => {
                    println!("Automatic backup created: {}", backup_path);
                    
                    // Clean up old backups (keep only last 7 days)
                    cleanup_old_backups(7).await;
                }
                Err(e) => {
                    eprintln!("Failed to create automatic backup: {}", e);
                }
            }
        }
    });
    
    println!("Automatic backup scheduling started (hourly)");
    Ok(())
}

async fn cleanup_old_backups(days_to_keep: u64) {
    let cutoff_time = chrono::Utc::now() - chrono::Duration::days(days_to_keep as i64);
    
    if let Ok(entries) = fs::read_dir(".") {
        for entry in entries.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if file_name.starts_with("backup_") && file_name.ends_with(".db") {
                    // Extract timestamp from filename
                    if let Some(timestamp_str) = file_name.strip_prefix("backup_").and_then(|s| s.strip_suffix(".db")) {
                        if let Ok(file_time) = chrono::NaiveDateTime::parse_from_str(timestamp_str, "%Y%m%d_%H%M%S") {
                            let file_time_utc = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(file_time, chrono::Utc);
                            
                            if file_time_utc < cutoff_time {
                                if let Err(e) = fs::remove_file(entry.path()) {
                                    eprintln!("Failed to remove old backup {}: {}", file_name, e);
                                } else {
                                    println!("Removed old backup: {}", file_name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[tauri::command]
async fn restore_from_backup(backup_path: String) -> Result<(), String> {
    if !Path::new(&backup_path).exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    // Create a backup of current database before restoring
    let current_backup = format!("pre_restore_backup_{}.db", chrono::Utc::now().format("%Y%m%d_%H%M%S"));
    if let Err(e) = fs::copy("game.db", &current_backup) {
        return Err(format!("Failed to backup current database: {}", e));
    }
    
    // Restore from backup
    match fs::copy(&backup_path, "game.db") {
        Ok(_) => {
            println!("Database restored from backup: {}", backup_path);
            println!("Previous database backed up as: {}", current_backup);
            Ok(())
        }
        Err(e) => {
            // Try to restore the previous backup if restore failed
            let _ = fs::copy(&current_backup, "game.db");
            Err(format!("Failed to restore from backup: {}", e))
        }
    }
}

#[tauri::command]
async fn list_available_backups() -> Result<Vec<String>, String> {
    let mut backups = Vec::new();
    
    if let Ok(entries) = fs::read_dir(".") {
        for entry in entries.flatten() {
            if let Ok(file_name) = entry.file_name().into_string() {
                if file_name.starts_with("backup_") && file_name.ends_with(".db") {
                    backups.push(file_name);
                }
            }
        }
    }
    
    // Sort by filename (which includes timestamp)
    backups.sort();
    backups.reverse(); // Most recent first
    
    Ok(backups)
}

#[tauri::command]
async fn get_backup_info(backup_path: String) -> Result<serde_json::Value, String> {
    if !Path::new(&backup_path).exists() {
        return Err("Backup file does not exist".to_string());
    }
    
    match fs::metadata(&backup_path) {
        Ok(metadata) => {
            let size = metadata.len();
            let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            
            // Try to get record counts from backup
            let mut record_counts = serde_json::Map::new();
            
            if let Ok(backup_conn) = Connection::open(&backup_path) {
                let tables = ["users", "tasks", "achievements", "user_achievements", "inventory", "daily_stats"];
                
                for table in &tables {
                    if let Ok(mut stmt) = backup_conn.prepare(&format!("SELECT COUNT(*) FROM {}", table)) {
                        if let Ok(count_result) = stmt.query_row([], |row| row.get::<_, i64>(0)) {
                            record_counts.insert(table.to_string(), serde_json::Value::Number(serde_json::Number::from(count_result)));
                        }
                    }
                }
            }
            
            Ok(serde_json::json!({
                "path": backup_path,
                "size_bytes": size,
                "modified_time": modified.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                "record_counts": record_counts
            }))
        }
        Err(e) => Err(format!("Failed to get backup info: {}", e))
    }
}

// ==================== Task Detail & Statistics Commands ====================

const TASK_SELECT: &str = "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
     t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
     COALESCE(t.task_type, 'standard') as task_type,
     tp.target_progress as goal_target, tp.current_progress as goal_current,
     t.recurrence_pattern, t.parent_recurring_task_id, t.instance_date,
     t.current_streak, t.longest_streak, t.last_completed_date, t.streak_bonus_multiplier,
     t.project_id
     FROM tasks t
     LEFT JOIN task_progress tp ON t.id = tp.task_id";

fn task_from_row(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get::<_, i64>(0)?,
        user_id: row.get::<_, i64>(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        category: row.get(4)?,
        difficulty: row.get::<_, i64>(5)?,
        base_experience_reward: row.get::<_, i64>(6)?,
        gold_reward: row.get::<_, i64>(7)?,
        due_date: row.get(8)?,
        status: row.get(9)?,
        priority: row.get::<_, i64>(10)?,
        created_at: "".to_string(),
        completed_at: None,
        task_type: row.get(11)?,
        goal_target: row.get::<_, Option<i64>>(12)?,
        goal_current: row.get::<_, Option<i64>>(13)?,
        goal_unit: None,
        recurrence_pattern: row.get(14)?,
        parent_recurring_task_id: row.get::<_, Option<i64>>(15)?,
        instance_date: row.get(16)?,
        current_streak: row.get::<_, Option<i64>>(17)?,
        longest_streak: row.get::<_, Option<i64>>(18)?,
        last_completed_date: row.get(19)?,
        streak_bonus_multiplier: row.get(20)?,
        project_id: row.get::<_, Option<i64>>(21)?,
    })
}

#[tauri::command]
async fn get_task_by_id(db: tauri::State<'_, DbConnection>, task_id: i64) -> Result<Task, String> {
    let conn = db.lock().await;
    let query = format!("{} WHERE t.id = ?1", TASK_SELECT);
    conn.query_row(&query, rusqlite::params![task_id], |row| task_from_row(row))
        .map_err(|e| format!("Failed to get task {}: {}", task_id, e))
}

#[tauri::command]
async fn get_task_statistics(db: tauri::State<'_, DbConnection>) -> Result<serde_json::Value, String> {
    let conn = db.lock().await;

    let count = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |row| row.get::<_, i64>(0))
            .map_err(|e| format!("Failed to compute task statistics: {}", e))
    };

    let total = count("SELECT COUNT(*) FROM tasks WHERE user_id = 1")?;
    let active = count("SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'active'")?;
    let completed = count("SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'")?;
    let failed = count("SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'failed'")?;
    let completed_today = count(
        "SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'
         AND date(completed_at) = date('now', 'localtime')",
    )?;
    let completed_this_week = count(
        "SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'
         AND completed_at >= datetime('now', '-7 days')",
    )?;

    // Completed counts grouped by category
    let mut by_category = serde_json::Map::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT category, COUNT(*) FROM tasks
                 WHERE user_id = 1 AND status = 'completed' GROUP BY category",
            )
            .map_err(|e| format!("Failed to prepare category statistics: {}", e))?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| format!("Failed to query category statistics: {}", e))?;
        for row in rows {
            let (category, cnt) = row.map_err(|e| format!("Failed to read category row: {}", e))?;
            by_category.insert(category, serde_json::json!(cnt));
        }
    }

    let finished = completed + failed;
    let completion_rate = if finished > 0 {
        completed as f64 / finished as f64
    } else {
        0.0
    };

    Ok(serde_json::json!({
        "total": total,
        "active": active,
        "completed": completed,
        "failed": failed,
        "completed_today": completed_today,
        "completed_this_week": completed_this_week,
        "completion_rate": completion_rate,
        "by_category": by_category,
    }))
}

#[tauri::command]
async fn get_user_detailed_stats(db: tauri::State<'_, DbConnection>) -> Result<serde_json::Value, String> {
    let conn = db.lock().await;
    let user = fetch_user_sync(&conn)?;

    let count = |sql: &str| -> Result<i64, String> {
        conn.query_row(sql, [], |row| row.get::<_, i64>(0))
            .map_err(|e| format!("Failed to compute user statistics: {}", e))
    };

    let total_tasks_completed =
        count("SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'")?;
    let tasks_completed_today = count(
        "SELECT COUNT(*) FROM tasks WHERE user_id = 1 AND status = 'completed'
         AND date(completed_at) = date('now', 'localtime')",
    )?;
    let total_xp_from_tasks = count(
        "SELECT COALESCE(SUM(base_experience_reward), 0) FROM tasks
         WHERE user_id = 1 AND status = 'completed'",
    )?;
    let achievements_unlocked =
        count("SELECT COUNT(*) FROM user_achievements WHERE user_id = 1")?;
    let (current_streak, longest_streak) = conn
        .query_row(
            "SELECT COALESCE(current_count, 0), COALESCE(longest_count, 0)
             FROM streaks WHERE user_id = 1 AND streak_type = 'daily_tasks'",
            [],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to read streaks: {}", e))?
        .unwrap_or((0, 0));

    Ok(serde_json::json!({
        "user": user,
        "total_tasks_completed": total_tasks_completed,
        "tasks_completed_today": tasks_completed_today,
        "total_xp_from_tasks": total_xp_from_tasks,
        "achievements_unlocked": achievements_unlocked,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
    }))
}

#[tauri::command]
async fn get_user_task_history(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, category, difficulty, completed_at FROM tasks
             WHERE user_id = ?1 AND status = 'completed' AND completed_at IS NOT NULL
             ORDER BY completed_at DESC LIMIT 1000",
        )
        .map_err(|e| format!("Failed to prepare task history query: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "title": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "difficulty": row.get::<_, i64>(3)?,
                "completed_at": row.get::<_, String>(4)?,
            }))
        })
        .map_err(|e| format!("Failed to query task history: {}", e))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect task history: {}", e))
}

// ==================== Reward Commands ====================

#[tauri::command]
async fn add_experience(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
    amount: i64,
) -> Result<User, String> {
    let conn = db.lock().await;
    conn.execute(
        "UPDATE users SET experience_points = experience_points + ?1 WHERE id = ?2",
        rusqlite::params![amount, user_id],
    )
    .map_err(|e| format!("Failed to add experience: {}", e))?;
    fetch_user_sync(&conn)
}

#[tauri::command]
async fn add_gold(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
    amount: i64,
) -> Result<User, String> {
    let conn = db.lock().await;
    conn.execute(
        "UPDATE users SET gold = gold + ?1 WHERE id = ?2",
        rusqlite::params![amount, user_id],
    )
    .map_err(|e| format!("Failed to add gold: {}", e))?;
    fetch_user_sync(&conn)
}

#[tauri::command]
async fn add_item_to_inventory(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
    item_id: Option<String>,
    name: Option<String>,
    description: Option<String>,
    rarity: Option<String>,
    icon: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().await;
    let name = name.or(item_id).unwrap_or_else(|| "Mystery Item".to_string());
    let rarity = rarity.unwrap_or_else(|| "common".to_string());

    // Stack onto an existing item with the same name if present
    let updated = conn
        .execute(
            "UPDATE inventory_items SET quantity = quantity + 1, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?1 AND name = ?2",
            rusqlite::params![user_id, name],
        )
        .map_err(|e| format!("Failed to update inventory: {}", e))?;

    if updated == 0 {
        conn.execute(
            "INSERT INTO inventory_items (user_id, name, description, item_type, rarity, quantity, icon)
             VALUES (?1, ?2, ?3, 'consumable', ?4, 1, ?5)",
            rusqlite::params![user_id, name, description, rarity, icon],
        )
        .map_err(|e| format!("Failed to add item to inventory: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn unlock_content(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
    content_type: String,
    content_id: String,
    name: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().await;
    conn.execute(
        "INSERT OR IGNORE INTO unlocked_content (user_id, content_type, content_id, name)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![user_id, content_type, content_id, name],
    )
    .map_err(|e| format!("Failed to unlock content: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn unlock_title(
    db: tauri::State<'_, DbConnection>,
    user_id: i64,
    title_id: Option<String>,
    title: Option<String>,
    rarity: Option<String>,
) -> Result<(), String> {
    let conn = db.lock().await;
    let title = title.or(title_id).ok_or("No title provided")?;
    let rarity = rarity.unwrap_or_else(|| "common".to_string());
    conn.execute(
        "INSERT OR IGNORE INTO user_titles (user_id, title, rarity) VALUES (?1, ?2, ?3)",
        rusqlite::params![user_id, title, rarity],
    )
    .map_err(|e| format!("Failed to unlock title: {}", e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database connection and store in app state
            let db_conn = tauri::async_runtime::block_on(async {
                match database::init_database().await {
                    Ok(conn) => {
                        println!("Database initialized successfully with performance optimizations");
                        conn
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        panic!("Cannot start app without database");
                    }
                }
            });

            // Store database connection in app state
            app.manage(db_conn);

            // Start automatic backup scheduling in background
            tauri::async_runtime::spawn(async move {
                if let Err(e) = schedule_automatic_backups().await {
                    eprintln!("Failed to start automatic backups: {}", e);
                } else {
                    println!("Automatic backup system started");
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_user,
            get_tasks,
            create_task,
            complete_task,
            update_task_progress,
            generate_recurring_instances,
            get_projects,
            create_project,
            update_project,
            delete_project,
            assign_task_to_project,
            start_timer,
            pause_timer,
            stop_timer,
            get_active_timer,
            get_time_sessions,
            get_time_stats,
            update_estimated_time,
            schedule_notification,
            cancel_notification,
            get_scheduled_notifications,
            snooze_notification,
            get_notification_preferences,
            update_notification_preferences,
            get_notification_history,
            mark_notification_actioned,
            mark_notification_sent,
            get_pending_notifications,
            get_user_achievements,
            check_achievements,
            purchase_item,
            get_user_inventory,
            use_inventory_item,
            get_user_titles,
            equip_title,
            unequip_title,
            get_recommended_difficulty,
            get_active_buffs,
            apply_buff,
            get_skill_nodes,
            get_skill_tree_connections,
            get_user_skill_allocations,
            get_user_skill_stats,
            allocate_skill_node,
            deallocate_skill_node,
            reset_skill_tree,
            update_node_position,
            avatar::get_user_equipment,
            avatar::equip_item,
            avatar::unequip_item,
            avatar::get_avatar_config,
            get_daily_stats,
            update_daily_stats,
            initialize_database,
            create_achievement_popup,
            create_backup,
            schedule_automatic_backups,
            restore_from_backup,
            list_available_backups,
            get_backup_info,
            github::github_check_cli,
            github::github_list_repos,
            github::github_add_repo,
            github::github_remove_repo,
            github::github_toggle_repo,
            github::github_get_settings,
            github::github_update_settings,
            github::github_get_task_links,
            github::github_close_issue,
            github::github_sync,
            calendar::connect_apple_calendar,
            calendar::disconnect_apple_calendar,
            calendar::get_apple_calendar_events,
            calendar::get_apple_calendar_list,
            calendar::create_calendar_event,
            calendar::update_calendar_event_title,
            calendar::get_calendar_import_rules,
            calendar::set_calendar_import_rule,
            calendar::add_task_to_calendar,
            calendar::mark_calendar_event_completed,
            calendar::import_calendar_events_as_tasks,
            health::set_health_folder,
            health::get_health_settings,
            health::scan_health_folder,
            health::get_workouts,
            health::verify_fitness_tasks,
            health::set_task_verification,
            finance::finance_get_accounts,
            finance::finance_create_account,
            finance::finance_delete_account,
            finance::import_transactions_csv,
            finance::finance_get_transactions,
            finance::finance_get_spending_summary,
            finance::finance_get_monthly_totals,
            finance::finance_set_category,
            capture::get_capture_settings,
            capture::set_capture_folder,
            capture::scan_capture_inbox,
            capture::get_capture_log,
            reminders::connect_apple_reminders,
            reminders::get_reminder_lists,
            reminders::set_reminder_list_rule,
            reminders::get_reminders_settings,
            reminders::mark_reminder_completed,
            reminders::sync_reminders,
            get_task_by_id,
            get_task_statistics,
            get_user_detailed_stats,
            get_user_task_history,
            add_experience,
            add_gold,
            add_item_to_inventory,
            unlock_content,
            unlock_title,
            oauth::start_google_oauth,
            oauth::refresh_google_token,
            oauth::get_google_calendar_events,
            oauth::create_google_calendar_event,
            oauth::update_google_calendar_event,
            oauth::delete_google_calendar_event,
            connections::get_connections,
            connections::disconnect_provider,
            simplefin::simplefin_connect,
            simplefin::simplefin_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}