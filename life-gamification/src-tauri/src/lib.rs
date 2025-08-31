use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// Global state for user and tasks
static USER_STATE: Mutex<Option<User>> = Mutex::new(None);
static TASKS_STATE: Mutex<Vec<Task>> = Mutex::new(Vec::new());
static TASK_COUNTER: Mutex<i64> = Mutex::new(4); // Starting after initial tasks

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

// Basic commands to test the app is working
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Helper function to calculate level from XP
fn calculate_level_and_progress(xp: i64) -> (i64, i64) {
    let level = 1 + (xp / 100);
    let xp_for_next_level = (level + 1) * 100;
    let xp_to_next = xp_for_next_level - xp;
    (level, xp_to_next)
}

// Initialize default user and tasks
fn initialize_default_data() {
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
    Ok(vec![])
}

#[tauri::command]
async fn check_achievements() -> Result<Vec<Achievement>, String> {
    Ok(vec![])
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
            check_achievements
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}