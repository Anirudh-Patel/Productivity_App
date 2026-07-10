use serde::{Deserialize, Serialize};
use serde_json;
use std::sync::Mutex;
use chrono::{DateTime, Utc, Duration};
use rusqlite::{Connection, Result};
use tauri::Manager;
use std::fs;
use std::path::Path;

// Import avatar commands
mod commands;
use commands::avatar;

mod database;
use database::DbConnection;


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
    pub task_type: String,  // "standard" or "goal"
    pub goal_target: Option<i64>,
    pub goal_current: Option<i64>,
    pub goal_unit: Option<String>,
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

#[tauri::command]
async fn get_user(db: tauri::State<'_, DbConnection>) -> Result<User, String> {
    let conn = db.lock().await;

    let user = conn.query_row(
        "SELECT id, username, level, experience_points, experience_to_next_level,
         strength, intelligence, endurance, charisma, luck,
         current_health, max_health, gold, theme_preference, equipped_title
         FROM users WHERE id = 1",
        [],
        |row| {
            Ok(User {
                id: row.get::<_, i64>(0)?,
                username: row.get(1)?,
                level: row.get::<_, i32>(2).map(|v| v as i64)?,
                experience_points: row.get::<_, i32>(3).map(|v| v as i64)?,
                experience_to_next_level: row.get::<_, i32>(4).map(|v| v as i64)?,
                strength: row.get::<_, i32>(5).map(|v| v as i64)?,
                intelligence: row.get::<_, i32>(6).map(|v| v as i64)?,
                endurance: row.get::<_, i32>(7).map(|v| v as i64)?,
                charisma: row.get::<_, i32>(8).map(|v| v as i64)?,
                luck: row.get::<_, i32>(9).map(|v| v as i64)?,
                current_health: row.get::<_, i32>(10).map(|v| v as i64)?,
                max_health: row.get::<_, i32>(11).map(|v| v as i64)?,
                gold: row.get::<_, i32>(12).map(|v| v as i64)?,
                theme_preference: row.get(13)?,
                equipped_title: row.get(14)?,
            })
        },
    )
    .map_err(|e| format!("Failed to get user: {}", e))?;

    Ok(user)
}

#[tauri::command]
async fn get_tasks(db: tauri::State<'_, DbConnection>, status: Option<String>) -> Result<Vec<Task>, String> {
    let conn = db.lock().await;

    let query = match status {
        Some(ref s) => format!(
            "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
             t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
             COALESCE(t.task_type, 'standard') as task_type,
             tp.target_progress as goal_target, tp.current_progress as goal_current
             FROM tasks t
             LEFT JOIN task_progress tp ON t.id = tp.task_id
             WHERE t.user_id = 1 AND t.status = '{}' AND t.status != 'archived'
             ORDER BY t.priority DESC, t.due_date ASC", s
        ),
        None => "SELECT t.id, t.user_id, t.title, t.description, t.category, t.difficulty,
             t.base_experience_reward, t.gold_reward, t.due_date, t.status, t.priority,
             COALESCE(t.task_type, 'standard') as task_type,
             tp.target_progress as goal_target, tp.current_progress as goal_current
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
         base_experience_reward, gold_reward, due_date, status, priority, task_type)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'active', ?8, ?9)",
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
        let (task_status, xp_reward, gold_reward): (String, i32, i32) = tx.query_row(
            "SELECT status, base_experience_reward, gold_reward FROM tasks WHERE id = ?1 AND user_id = 1",
            [task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Task not found: {}", e))?;

        if task_status == "completed" {
            drop(tx);
            // Already completed, will fetch and return below
        } else {
            // Get user stats for bonus calculations
            let (intelligence, luck): (i32, i32) = tx.query_row(
                "SELECT intelligence, luck FROM users WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Failed to get user stats: {}", e))?;

            // Calculate stat bonuses
            let int_bonus = intelligence as f64 * 0.02; // 2% XP bonus per INT point
            let luck_bonus = luck as f64 * 0.015; // 1.5% gold bonus per LUCK point

            let final_xp = (xp_reward as f64 * (1.0 + int_bonus)) as i32;
            let final_gold = (gold_reward as f64 * (1.0 + luck_bonus)) as i32;

            // Mark task as completed
            tx.execute(
                "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                [task_id],
            )
            .map_err(|e| format!("Failed to update task status: {}", e))?;

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

// Helper function to add item to inventory
fn add_item_to_inventory(_user_id: i64, item: InventoryItem) {
    // TODO: Implement with database
}

#[tauri::command]
async fn get_user_inventory() -> Result<Vec<InventoryItem>, String> {
    Err("Inventory system not yet refactored - coming soon!".to_string())
}

#[tauri::command]
async fn use_inventory_item(item_id: String) -> Result<User, String> {
    Err("Inventory system not yet refactored - coming soon!".to_string())
}

// Helper function to apply item effects
fn apply_item_effect(user: &mut User, effect: &str) -> Result<(), String> {
    let parts: Vec<&str> = effect.split(':').collect();
    
    match parts[0] {
        "restore_health" => {
            if let Ok(amount) = parts[1].parse::<i64>() {
                user.current_health = std::cmp::min(user.max_health, user.current_health + amount);
                println!("Restored {} health to user {}", amount, user.username);
            }
        },
        "xp_multiplier" => {
            if parts.len() >= 3 {
                if let (Ok(multiplier), Ok(duration)) = (parts[1].parse::<f64>(), parts[2].parse::<i64>()) {
                    create_buff("xp_multiplier".to_string(), multiplier, None, duration);
                    println!("Applied {}x XP multiplier for {} minutes", multiplier, duration);
                }
            }
        },
        "gold_multiplier" => {
            if parts.len() >= 3 {
                if let (Ok(multiplier), Ok(duration)) = (parts[1].parse::<f64>(), parts[2].parse::<i64>()) {
                    create_buff("gold_multiplier".to_string(), multiplier, None, duration);
                    println!("Applied {}x Gold multiplier for {} minutes", multiplier, duration);
                }
            }
        },
        "stat_boost" => {
            if parts.len() >= 4 {
                if let (Ok(amount), Ok(duration)) = (parts[2].parse::<f64>(), parts[3].parse::<i64>()) {
                    create_buff("stat".to_string(), amount, Some(parts[1].to_string()), duration);
                    println!("Applied +{} {} boost for {} minutes", amount, parts[1], duration);
                }
            }
        },
        _ => {
            return Err("Unknown item effect".to_string());
        }
    }
    
    Ok(())
}

// Helper function to create buffs
fn create_buff(buff_type: String, value: f64, stat_type: Option<String>, duration_minutes: i64) -> Buff {
    Buff {
        id: "stub".to_string(),
        name: "Not Available".to_string(),
        buff_type,
        value,
        stat_type,
        duration_minutes,
        applied_at: "".to_string(),
        expires_at: "".to_string(),
    }
}

// Title management functions
#[tauri::command]
async fn get_user_titles() -> Result<Vec<String>, String> {
    Ok(vec![])
}

#[tauri::command]
async fn equip_title(title: String) -> Result<User, String> {
    Err("Title system not yet refactored".to_string())
}

#[tauri::command]
async fn unequip_title() -> Result<User, String> {
    Err("Title system not yet refactored".to_string())
}

// Buff management functions
fn clean_expired_buffs() {
    // Stubbed
}

fn apply_buff_effects_to_rewards(base_xp: i64, base_gold: i64) -> (i64, i64) {
    (base_xp, base_gold)
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

    (strength, intelligence, endurance, charisma, luck)
}

#[tauri::command]
async fn get_active_buffs() -> Result<Vec<Buff>, String> {
    Ok(vec![])
}

#[tauri::command]
async fn apply_buff(buff_type: String, value: f64, stat_type: Option<String>, duration_minutes: i64) -> Result<Buff, String> {
    Err("Buff system not yet refactored".to_string())
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
async fn purchase_item(item_id: String, price: i64) -> Result<User, String> {
    Err("Shop system not yet refactored".to_string())
}


// Calendar Integration Commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start: String,
    pub end: Option<String>,
    pub all_day: Option<bool>,
    pub description: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarConnectionResult {
    pub connected: bool,
    pub calendar_id: Option<String>,
}

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

#[tauri::command]
async fn connect_apple_calendar() -> Result<CalendarConnectionResult, String> {
    // For now, return a mock connection
    // In a real implementation, you would:
    // 1. Request calendar permissions
    // 2. Access EventKit on macOS
    // 3. Return the primary calendar ID
    
    Ok(CalendarConnectionResult {
        connected: true,
        calendar_id: Some("primary".to_string()),
    })
}

#[tauri::command]
async fn disconnect_apple_calendar() -> Result<(), String> {
    // Disconnect from Apple Calendar
    Ok(())
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

#[tauri::command]
async fn get_apple_calendar_events(calendar_id: String) -> Result<Vec<CalendarEvent>, String> {
    // For now, return empty events
    // In a real implementation, you would:
    // 1. Use EventKit to fetch events from the specified calendar
    // 2. Convert them to CalendarEvent structs
    // 3. Return the list
    
    let _calendar_id = calendar_id; // Avoid unused parameter warning
    
    // Mock events for demonstration
    let events = vec![
        CalendarEvent {
            id: "apple-event-1".to_string(),
            title: "Team Meeting".to_string(),
            start: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            end: Some((Utc::now() + Duration::hours(1)).format("%Y-%m-%dT%H:%M:%SZ").to_string()),
            all_day: Some(false),
            description: Some("Weekly team sync".to_string()),
            source: "apple".to_string(),
        },
    ];
    
    Ok(events)
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
        .invoke_handler(tauri::generate_handler![
            greet,
            get_user,
            get_tasks,
            create_task,
            complete_task,
            update_task_progress,
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
            connect_apple_calendar,
            disconnect_apple_calendar,
            get_apple_calendar_events,
            initialize_database,
            create_achievement_popup,
            create_backup,
            schedule_automatic_backups,
            restore_from_backup,
            list_available_backups,
            get_backup_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}