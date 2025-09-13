use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::{DateTime, Utc, Duration};
use rusqlite::Connection;
use tauri::Manager;
use std::fs;
use std::path::Path;

// Import avatar commands
mod commands;
use commands::avatar;

// Global state for user and tasks
static USER_STATE: Mutex<Option<User>> = Mutex::new(None);
static TASKS_STATE: Mutex<Vec<Task>> = Mutex::new(Vec::new());
static TASK_COUNTER: Mutex<i64> = Mutex::new(4); // Starting after initial tasks
static INVENTORY_STATE: Mutex<Vec<InventoryItem>> = Mutex::new(Vec::new());
static ACHIEVEMENTS_STATE: Mutex<Vec<Achievement>> = Mutex::new(Vec::new());
static USER_ACHIEVEMENTS_STATE: Mutex<Vec<UserAchievement>> = Mutex::new(Vec::new());
static ACTIVE_BUFFS: Mutex<Vec<Buff>> = Mutex::new(Vec::new());


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
    pub active_title: Option<String>,
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
fn initialize_default_data() {
    // Initialize achievements if not already done
    let mut achievements_guard = ACHIEVEMENTS_STATE.lock().unwrap();
    if achievements_guard.is_empty() {
        *achievements_guard = vec![
            Achievement {
                id: 1,
                name: "First Quest".to_string(),
                description: "Complete your first task".to_string(),
                icon: "trophy".to_string(),
                requirements_type: "tasks_completed".to_string(),
                requirements_value: 1,
                experience_reward: 50,
                gold_reward: 25,
                rarity: "common".to_string(),
            },
            Achievement {
                id: 2,
                name: "Quest Master".to_string(),
                description: "Complete 10 tasks".to_string(),
                icon: "crown".to_string(),
                requirements_type: "tasks_completed".to_string(),
                requirements_value: 10,
                experience_reward: 200,
                gold_reward: 100,
                rarity: "rare".to_string(),
            },
            Achievement {
                id: 3,
                name: "Level Up!".to_string(),
                description: "Reach level 5".to_string(),
                icon: "star".to_string(),
                requirements_type: "level".to_string(),
                requirements_value: 5,
                experience_reward: 150,
                gold_reward: 75,
                rarity: "uncommon".to_string(),
            },
            Achievement {
                id: 4,
                name: "Gold Hoarder".to_string(),
                description: "Accumulate 500 gold".to_string(),
                icon: "coins".to_string(),
                requirements_type: "gold".to_string(),
                requirements_value: 500,
                experience_reward: 100,
                gold_reward: 50,
                rarity: "uncommon".to_string(),
            },
            Achievement {
                id: 5,
                name: "Legendary Hero".to_string(),
                description: "Complete 50 tasks".to_string(),
                icon: "award".to_string(),
                requirements_type: "tasks_completed".to_string(),
                requirements_value: 50,
                experience_reward: 500,
                gold_reward: 250,
                rarity: "legendary".to_string(),
            },
        ];
    }
    drop(achievements_guard);
    
    let mut user_guard = USER_STATE.lock().unwrap();
    if user_guard.is_none() {
        let (level, xp_to_next) = calculate_level_and_progress(450);
        *user_guard = Some(User {
            id: 1,
            username: "Test Player".to_string(),
            level,
            experience_points: 450,
            experience_to_next_level: xp_to_next,
            strength: 15,
            intelligence: 12,
            endurance: 18,
            charisma: 10,
            luck: 8,
            current_health: 85,
            max_health: 100,
            gold: 250,
            theme_preference: "solo_leveling".to_string(),
            active_title: Some("Dragon Slayer".to_string()),
        });
    }
    drop(user_guard);

    let mut tasks_guard = TASKS_STATE.lock().unwrap();
    if tasks_guard.is_empty() {
        tasks_guard.extend(vec![
            Task {
                id: 1,
                user_id: 1,
                title: "Complete morning routine".to_string(),
                description: Some("Brush teeth, shower, eat breakfast".to_string()),
                category: "health".to_string(),
                difficulty: 3,
                base_experience_reward: 20,
                gold_reward: 5,
                due_date: None,
                status: "active".to_string(),
                priority: 2,
                created_at: "2025-08-28T08:00:00Z".to_string(),
                completed_at: None,
                task_type: "standard".to_string(),
                goal_target: None,
                goal_current: None,
                goal_unit: None,
            },
            Task {
                id: 2,
                user_id: 1,
                title: "Read for 30 minutes".to_string(),
                description: Some("Continue reading current book".to_string()),
                category: "learning".to_string(),
                difficulty: 2,
                base_experience_reward: 15,
                gold_reward: 3,
                due_date: None,
                status: "active".to_string(),
                priority: 1,
                created_at: "2025-08-28T09:00:00Z".to_string(),
                completed_at: None,
                task_type: "standard".to_string(),
                goal_target: None,
                goal_current: None,
                goal_unit: None,
            },
            Task {
                id: 3,
                user_id: 1,
                title: "Daily Steps Goal".to_string(),
                description: Some("Walk 10,000 steps today".to_string()),
                category: "fitness".to_string(),
                difficulty: 4,
                base_experience_reward: 30,
                gold_reward: 8,
                due_date: None,
                status: "active".to_string(),
                priority: 2,
                created_at: "2025-08-28T10:00:00Z".to_string(),
                completed_at: None,
                task_type: "goal".to_string(),
                goal_target: Some(10000),
                goal_current: Some(2500),
                goal_unit: Some("steps".to_string()),
            },
        ]);
    }
}

#[tauri::command]
async fn get_user() -> Result<User, String> {
    initialize_default_data();
    
    let user_guard = USER_STATE.lock().unwrap();
    match user_guard.as_ref() {
        Some(user) => Ok(user.clone()),
        None => Err("User not found".to_string()),
    }
}

#[tauri::command]
async fn get_tasks(status: Option<String>) -> Result<Vec<Task>, String> {
    initialize_default_data();
    
    let tasks_guard = TASKS_STATE.lock().unwrap();
    let filtered_tasks: Vec<Task> = match status {
        Some(status_filter) => tasks_guard.iter()
            .filter(|task| task.status == status_filter)
            .cloned()
            .collect(),
        None => tasks_guard.clone(),
    };
    
    Ok(filtered_tasks)
}

#[tauri::command]
async fn create_task(task_data: CreateTaskRequest) -> Result<Task, String> {
    initialize_default_data();
    
    let difficulty = task_data.difficulty.unwrap_or(5);
    let category = task_data.category.unwrap_or_else(|| "general".to_string());
    let priority = task_data.priority.unwrap_or(3);
    let task_type = task_data.task_type.unwrap_or_else(|| "standard".to_string());
    
    // Calculate rewards based on difficulty
    let base_xp = 10 + (difficulty - 1) * 5;
    let gold_reward = 1 + (difficulty - 1);
    
    // Generate new task ID
    let mut counter = TASK_COUNTER.lock().unwrap();
    let task_id = *counter;
    *counter += 1;
    drop(counter);
    
    let new_task = Task {
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
        created_at: "2025-08-28T10:00:00Z".to_string(),
        completed_at: None,
        task_type,
        goal_target: task_data.goal_target,
        goal_current: if task_data.goal_target.is_some() { Some(0) } else { None },
        goal_unit: task_data.goal_unit,
    };
    
    // Add to global state
    let mut tasks_guard = TASKS_STATE.lock().unwrap();
    tasks_guard.push(new_task.clone());
    
    Ok(new_task)
}

#[tauri::command]
async fn complete_task(task_id: i64) -> Result<Task, String> {
    initialize_default_data();
    
    // Find and update the task
    let mut tasks_guard = TASKS_STATE.lock().unwrap();
    let task_index = tasks_guard.iter().position(|t| t.id == task_id)
        .ok_or("Task not found".to_string())?;
        
    let mut task = tasks_guard[task_index].clone();
    
    // Only complete if not already completed
    if task.status == "completed" {
        return Ok(task);
    }
    
    // Mark as completed
    task.status = "completed".to_string();
    task.completed_at = Some("2025-08-28T10:00:00Z".to_string());
    tasks_guard[task_index] = task.clone();
    drop(tasks_guard);
    
    // Award XP and gold to user with stat bonuses AND buff effects
    let (final_xp, final_gold) = {
        let mut user_guard = USER_STATE.lock().unwrap();
        if let Some(ref mut user) = user_guard.as_mut() {
            // Get buffed stats for calculations
            let (_, buffed_int, _, _, buffed_luck) = apply_stat_buffs_to_user_stats(user);
            
            // Calculate stat bonuses with buffed stats
            let int_bonus = buffed_int as f64 * 0.02; // 2% XP bonus per INT point
            let luck_bonus = buffed_luck as f64 * 0.015; // 1.5% gold bonus per LUCK point
            
            // Apply stat bonuses to base rewards
            let stat_xp_reward = (task.base_experience_reward as f64 * (1.0 + int_bonus)) as i64;
            let stat_gold_reward = (task.gold_reward as f64 * (1.0 + luck_bonus)) as i64;
            
            // Apply buff multipliers on top of stat bonuses
            let (final_xp, final_gold) = apply_buff_effects_to_rewards(stat_xp_reward, stat_gold_reward);
            
            user.experience_points += final_xp;
            user.gold += final_gold;
            
            println!("Task completed! Base XP: {} -> {} (with stat+buff bonuses), Base Gold: {} -> {} (with stat+buff bonuses)", 
                task.base_experience_reward, final_xp, task.gold_reward, final_gold);
            
            // Recalculate level and XP to next level
            let (new_level, xp_to_next) = calculate_level_and_progress(user.experience_points);
            let level_up = new_level > user.level;
            user.level = new_level;
            user.experience_to_next_level = xp_to_next;
            
            // Level up bonus - restore health
            if level_up {
                user.current_health = user.max_health;
            }
            
            (final_xp, final_gold)
        } else {
            (0, 0) // Default values if user is None
        }
    };
    
    // Update daily stats (temporarily disabled due to async complexity)
    // TODO: Re-enable with proper thread-safe approach
    // let _ = update_daily_stats(1, final_xp, final_gold).await;
    
    Ok(task)
}

#[tauri::command]
async fn update_task_progress(task_id: i64, progress_amount: i64) -> Result<Task, String> {
    initialize_default_data();
    
    // Find and update the task
    let mut tasks_guard = TASKS_STATE.lock().unwrap();
    let task_index = tasks_guard.iter().position(|t| t.id == task_id)
        .ok_or("Task not found".to_string())?;
        
    let mut task = tasks_guard[task_index].clone();
    
    // Only update if it's a goal task and not completed
    if task.task_type != "goal" {
        return Err("Task is not a goal-based task".to_string());
    }
    
    if task.status == "completed" {
        return Ok(task);
    }
    
    // Update progress
    let current = task.goal_current.unwrap_or(0);
    let new_current = current + progress_amount;
    task.goal_current = Some(new_current);
    
    // Check if goal is reached
    if let Some(target) = task.goal_target {
        if new_current >= target {
            // Mark as completed
            task.status = "completed".to_string();
            task.completed_at = Some("2025-08-28T10:00:00Z".to_string());
            
            // Award XP and gold to user
            let mut user_guard = USER_STATE.lock().unwrap();
            if let Some(ref mut user) = user_guard.as_mut() {
                user.experience_points += task.base_experience_reward;
                user.gold += task.gold_reward;
                
                // Recalculate level and XP to next level
                let (new_level, xp_to_next) = calculate_level_and_progress(user.experience_points);
                let level_up = new_level > user.level;
                user.level = new_level;
                user.experience_to_next_level = xp_to_next;
                
                // Level up bonus - restore health
                if level_up {
                    user.current_health = user.max_health;
                }
            }
        }
    }
    
    tasks_guard[task_index] = task.clone();
    drop(tasks_guard);
    
    Ok(task)
}

#[tauri::command]
async fn get_user_achievements() -> Result<Vec<UserAchievement>, String> {
    initialize_default_data();
    let user_achievements = USER_ACHIEVEMENTS_STATE.lock().unwrap();
    Ok(user_achievements.clone())
}

#[tauri::command]
async fn check_achievements() -> Result<Vec<Achievement>, String> {
    initialize_default_data();
    
    let mut newly_unlocked = Vec::new();
    let user_guard = USER_STATE.lock().unwrap();
    
    if let Some(ref user) = user_guard.as_ref() {
        let achievements = ACHIEVEMENTS_STATE.lock().unwrap();
        let mut user_achievements = USER_ACHIEVEMENTS_STATE.lock().unwrap();
        let tasks = TASKS_STATE.lock().unwrap();
        
        // Count completed tasks
        let completed_tasks = tasks.iter().filter(|t| t.status == "completed").count() as i64;
        
        for achievement in achievements.iter() {
            // Check if already unlocked
            let already_unlocked = user_achievements.iter().any(|ua| ua.achievement_id == achievement.id);
            
            if !already_unlocked {
                let meets_requirement = match achievement.requirements_type.as_str() {
                    "tasks_completed" => completed_tasks >= achievement.requirements_value,
                    "level" => user.level >= achievement.requirements_value,
                    "gold" => user.gold >= achievement.requirements_value,
                    _ => false,
                };
                
                if meets_requirement {
                    // Unlock achievement
                    let new_user_achievement = UserAchievement {
                        id: (user_achievements.len() + 1) as i64,
                        user_id: user.id,
                        achievement_id: achievement.id,
                        achievement: achievement.clone(),
                        unlocked_at: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                    };
                    
                    user_achievements.push(new_user_achievement);
                    newly_unlocked.push(achievement.clone());
                }
            }
        }
        
        // Award rewards for newly unlocked achievements
        if !newly_unlocked.is_empty() {
            drop(user_achievements);
            drop(achievements);
            drop(user_guard);
            
            let mut user_guard = USER_STATE.lock().unwrap();
            if let Some(ref mut user) = user_guard.as_mut() {
                for achievement in &newly_unlocked {
                    user.experience_points += achievement.experience_reward;
                    user.gold += achievement.gold_reward;
                    
                    println!("Achievement unlocked: {} - Rewarded {} XP and {} gold", 
                        achievement.name, achievement.experience_reward, achievement.gold_reward);
                }
                
                // Recalculate level
                let (new_level, xp_to_next) = calculate_level_and_progress(user.experience_points);
                user.level = new_level;
                user.experience_to_next_level = xp_to_next;
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
    let mut inventory = INVENTORY_STATE.lock().unwrap();
    
    // Check if item already exists in inventory (for stacking)
    if let Some(existing_item) = inventory.iter_mut().find(|i| i.id == item.id) {
        if existing_item.quantity + item.quantity <= existing_item.max_stack {
            existing_item.quantity += item.quantity;
            return;
        }
    }
    
    // Add as new item
    inventory.push(item);
}

#[tauri::command]
async fn get_user_inventory() -> Result<Vec<InventoryItem>, String> {
    let inventory = INVENTORY_STATE.lock().unwrap();
    Ok(inventory.clone())
}

#[tauri::command]
async fn use_inventory_item(item_id: String) -> Result<User, String> {
    let mut inventory = INVENTORY_STATE.lock().unwrap();
    let mut user_guard = USER_STATE.lock().unwrap();
    
    // Find the item in inventory
    if let Some(item_index) = inventory.iter().position(|i| i.id == item_id) {
        let item = &mut inventory[item_index];
        
        if item.quantity <= 0 {
            return Err("Item not available".to_string());
        }
        
        // Apply item effect to user
        if let Some(ref mut user) = user_guard.as_mut() {
            if let Some(ref effect) = item.effect {
                apply_item_effect(user, effect)?;
            }
            
            // Decrease quantity
            item.quantity -= 1;
            
            // Remove item if quantity is 0
            if item.quantity == 0 {
                inventory.remove(item_index);
            }
            
            Ok(user.clone())
        } else {
            Err("User not found".to_string())
        }
    } else {
        Err("Item not found in inventory".to_string())
    }
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
fn create_buff(buff_type: String, value: f64, stat_type: Option<String>, duration_minutes: i64) {
    let now = Utc::now();
    let expires_at = now + Duration::minutes(duration_minutes);
    
    let buff = Buff {
        id: format!("buff_{}", Utc::now().timestamp_millis()),
        name: format!("{} Boost", buff_type),
        buff_type,
        value,
        stat_type,
        duration_minutes,
        applied_at: now.to_rfc3339(),
        expires_at: expires_at.to_rfc3339(),
    };
    
    let mut buffs = ACTIVE_BUFFS.lock().unwrap();
    buffs.push(buff);
}

// Title management functions
#[tauri::command]
async fn get_user_titles() -> Result<Vec<String>, String> {
    let inventory = INVENTORY_STATE.lock().unwrap();
    
    // Get all titles from inventory
    let titles: Vec<String> = inventory
        .iter()
        .filter(|item| item.item_type == "title")
        .map(|item| item.name.clone())
        .collect();
    
    Ok(titles)
}

#[tauri::command]
async fn equip_title(title: String) -> Result<User, String> {
    let mut user_guard = USER_STATE.lock().unwrap();
    let inventory = INVENTORY_STATE.lock().unwrap();
    
    // Check if user owns this title
    let owns_title = inventory
        .iter()
        .any(|item| item.item_type == "title" && item.name == title);
    
    if !owns_title {
        return Err("You don't own this title".to_string());
    }
    
    if let Some(ref mut user) = user_guard.as_mut() {
        user.active_title = Some(title.clone());
        println!("User {} equipped title: {}", user.username, title);
        Ok(user.clone())
    } else {
        Err("User not found".to_string())
    }
}

#[tauri::command]
async fn unequip_title() -> Result<User, String> {
    let mut user_guard = USER_STATE.lock().unwrap();
    
    if let Some(ref mut user) = user_guard.as_mut() {
        user.active_title = None;
        println!("User {} unequipped title", user.username);
        Ok(user.clone())
    } else {
        Err("User not found".to_string())
    }
}

// Buff management functions
fn clean_expired_buffs() {
    let mut buffs = ACTIVE_BUFFS.lock().unwrap();
    let now = Utc::now();
    
    buffs.retain(|buff| {
        if let Ok(expires_at) = DateTime::parse_from_rfc3339(&buff.expires_at) {
            expires_at > now
        } else {
            false // Remove buffs with invalid timestamps
        }
    });
}

fn apply_buff_effects_to_rewards(base_xp: i64, base_gold: i64) -> (i64, i64) {
    clean_expired_buffs();
    let buffs = ACTIVE_BUFFS.lock().unwrap();
    
    let mut xp_multiplier = 1.0;
    let mut gold_multiplier = 1.0;
    
    for buff in buffs.iter() {
        match buff.buff_type.as_str() {
            "xp_multiplier" => xp_multiplier += buff.value - 1.0,
            "gold_multiplier" => gold_multiplier += buff.value - 1.0,
            _ => {}
        }
    }
    
    let final_xp = (base_xp as f64 * xp_multiplier) as i64;
    let final_gold = (base_gold as f64 * gold_multiplier) as i64;
    
    (final_xp, final_gold)
}

fn apply_stat_buffs_to_user_stats(user: &User) -> (i64, i64, i64, i64, i64) {
    clean_expired_buffs();
    let buffs = ACTIVE_BUFFS.lock().unwrap();
    
    let mut strength = user.strength;
    let mut intelligence = user.intelligence;
    let mut endurance = user.endurance;
    let mut charisma = user.charisma;
    let mut luck = user.luck;
    
    for buff in buffs.iter() {
        if buff.buff_type == "stat" {
            if let Some(ref stat_type) = buff.stat_type {
                match stat_type.as_str() {
                    "strength" => strength += buff.value as i64,
                    "intelligence" => intelligence += buff.value as i64,
                    "endurance" => endurance += buff.value as i64,
                    "charisma" => charisma += buff.value as i64,
                    "luck" => luck += buff.value as i64,
                    _ => {}
                }
            }
        }
    }
    
    (strength, intelligence, endurance, charisma, luck)
}

#[tauri::command]
async fn get_active_buffs() -> Result<Vec<Buff>, String> {
    clean_expired_buffs();
    let buffs = ACTIVE_BUFFS.lock().unwrap();
    Ok(buffs.clone())
}

#[tauri::command]
async fn apply_buff(buff_type: String, value: f64, stat_type: Option<String>, duration_minutes: i64) -> Result<Buff, String> {
    let now = Utc::now();
    let expires_at = now + Duration::minutes(duration_minutes);
    
    let buff = Buff {
        id: format!("buff_{}", Utc::now().timestamp_millis()),
        name: format!("{} Boost", buff_type),
        buff_type,
        value,
        stat_type,
        duration_minutes,
        applied_at: now.to_rfc3339(),
        expires_at: expires_at.to_rfc3339(),
    };
    
    let mut buffs = ACTIVE_BUFFS.lock().unwrap();
    buffs.push(buff.clone());
    
    println!("Applied buff: {} for {} minutes", buff.name, duration_minutes);
    Ok(buff)
}

// Get recommended task difficulty based on user stats
#[tauri::command]
async fn get_recommended_difficulty(task_category: String) -> Result<i64, String> {
    initialize_default_data();
    
    let user_guard = USER_STATE.lock().unwrap();
    if let Some(ref user) = user_guard.as_ref() {
        // Base difficulty should be around user level
        let base_difficulty = user.level.min(10).max(1);
        
        // Adjust based on stats for this category
        let effective_diff = calculate_effective_difficulty(base_difficulty, user, &task_category);
        
        // Return recommended difficulty (1-10 scale)
        Ok(effective_diff.round() as i64)
    } else {
        Err("User not found".to_string())
    }
}

#[tauri::command]
async fn purchase_item(item_id: String, price: i64) -> Result<User, String> {
    initialize_default_data();
    
    let mut user_guard = USER_STATE.lock().unwrap();
    if let Some(ref mut user) = user_guard.as_mut() {
        if user.gold < price {
            return Err("Not enough gold".to_string());
        }
        
        // Deduct gold
        user.gold -= price;
        
        // Add item to inventory
        let item_data = get_item_data(&item_id);
        add_item_to_inventory(user.id, item_data);
        
        println!("User {} purchased item {} for {} gold", user.username, item_id, price);
        
        Ok(user.clone())
    } else {
        Err("User not found".to_string())
    }
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
            // Initialize database with performance optimizations on app startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = initialize_database().await {
                    eprintln!("Failed to initialize database: {}", e);
                } else {
                    println!("Database initialized successfully with performance optimizations");
                }
                
                // Start automatic backup scheduling
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