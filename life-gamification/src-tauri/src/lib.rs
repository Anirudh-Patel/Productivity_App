use serde::{Deserialize, Serialize};
use serde_json;
use std::sync::Mutex;
use chrono::{DateTime, Utc};
use std::path::Path;
use rusqlite::{Connection, Result};

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
    }
    
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
                        unlocked_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
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
    let current_time = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    
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
fn add_item_to_inventory(user_id: i64, mut item: InventoryItem) {
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
    let now = chrono::Utc::now();
    let expires_at = now + chrono::Duration::minutes(duration_minutes);
    
    let buff = Buff {
        id: format!("buff_{}", chrono::Utc::now().timestamp_millis()),
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
    let now = chrono::Utc::now();
    
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
    clean_expired_buffs();
    let buffs = ACTIVE_BUFFS.lock().unwrap();
    
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
        // Note: Skill tree has aura and will instead of endurance and charisma
        // For now, map aura to charisma and will to endurance for compatibility
        charisma += skill_stats.aura_bonus;
        endurance += skill_stats.will_bonus;
    }
    
    // Apply temporary buffs on top of skill tree bonuses
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
    let now = chrono::Utc::now();
    let expires_at = now + chrono::Duration::minutes(duration_minutes);
    
    let buff = Buff {
        id: format!("buff_{}", chrono::Utc::now().timestamp_millis()),
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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            avatar::get_user_equipment,
            avatar::equip_item,
            avatar::unequip_item,
            avatar::get_avatar_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}