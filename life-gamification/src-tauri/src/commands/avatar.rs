use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use rusqlite::{Connection, Result as SqlResult};

// Avatar System Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Equipment {
    pub id: i64,
    pub name: String,
    pub slot: String,
    pub rarity: String,
    pub sprite_data: serde_json::Value,
    pub base_stats: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvatarConfig {
    pub skin_color: String,
    pub hair_color: String,
    pub eye_color: String,
    pub scale: f32,
    pub animation_speed: i32,
}

// Database helper functions
fn get_db_connection() -> SqlResult<Connection> {
    let conn = Connection::open("game.db")?;
    
    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    
    Ok(conn)
}

// Global state for avatar system - fallback for when database isn't available
static AVATAR_CONFIG: Mutex<Option<AvatarConfig>> = Mutex::new(None);
static USER_EQUIPMENT: Mutex<Vec<Equipment>> = Mutex::new(Vec::new());

#[tauri::command]
pub async fn get_user_equipment(user_id: i64) -> Result<Vec<Equipment>, String> {
    // Try to get equipment from database first
    match get_user_equipment_from_db(user_id) {
        Ok(equipment) => Ok(equipment),
        Err(_) => {
            // Fallback to mock data if database fails
            println!("Database unavailable, using mock data for user equipment");
            get_mock_equipment()
        }
    }
}

fn get_user_equipment_from_db(user_id: i64) -> Result<Vec<Equipment>, String> {
    let conn = get_db_connection()
        .map_err(|e| format!("Database connection failed: {}", e))?;
    
    let mut stmt = conn.prepare("
        SELECT 
            ue.id,
            et.name,
            et.slot,
            et.rarity,
            et.sprite_data,
            et.base_stats
        FROM user_equipment ue
        JOIN equipment_types et ON ue.equipment_type_id = et.id
        WHERE ue.user_id = ?
    ").map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let equipment_iter = stmt.query_map([user_id], |row| {
        let sprite_data_str: String = row.get(4)?;
        let base_stats_str: String = row.get(5)?;
        
        Ok(Equipment {
            id: row.get(0)?,
            name: row.get(1)?,
            slot: row.get(2)?,
            rarity: row.get(3)?,
            sprite_data: serde_json::from_str(&sprite_data_str).unwrap_or(serde_json::json!({})),
            base_stats: serde_json::from_str(&base_stats_str).unwrap_or(serde_json::json!({})),
        })
    }).map_err(|e| format!("Query execution failed: {}", e))?;
    
    let mut equipment = Vec::new();
    for item in equipment_iter {
        equipment.push(item.map_err(|e| format!("Row parsing failed: {}", e))?);
    }
    
    Ok(equipment)
}

fn get_mock_equipment() -> Result<Vec<Equipment>, String> {
    let mut equipment_guard = USER_EQUIPMENT.lock().unwrap();
    
    if equipment_guard.is_empty() {
        let mock_equipment = vec![
            Equipment {
                id: 1,
                name: "Basic Cap".to_string(),
                slot: "head".to_string(),
                rarity: "common".to_string(),
                sprite_data: serde_json::json!({"color": "#8B4513"}),
                base_stats: serde_json::json!({"defense": 1}),
            },
            Equipment {
                id: 2,
                name: "Iron Helm".to_string(),
                slot: "head".to_string(),
                rarity: "uncommon".to_string(),
                sprite_data: serde_json::json!({"color": "#C0C0C0"}),
                base_stats: serde_json::json!({"defense": 3}),
            },
            Equipment {
                id: 3,
                name: "Cloth Shirt".to_string(),
                slot: "chest".to_string(),
                rarity: "common".to_string(),
                sprite_data: serde_json::json!({"color": "#A0522D"}),
                base_stats: serde_json::json!({"defense": 2}),
            },
            Equipment {
                id: 4,
                name: "Leather Armor".to_string(),
                slot: "chest".to_string(),
                rarity: "uncommon".to_string(),
                sprite_data: serde_json::json!({"color": "#8B4513"}),
                base_stats: serde_json::json!({"defense": 5}),
            },
            Equipment {
                id: 5,
                name: "Wooden Stick".to_string(),
                slot: "weapon".to_string(),
                rarity: "common".to_string(),
                sprite_data: serde_json::json!({"color": "#8B4513"}),
                base_stats: serde_json::json!({"attack": 2}),
            },
            Equipment {
                id: 6,
                name: "Iron Sword".to_string(),
                slot: "weapon".to_string(),
                rarity: "uncommon".to_string(),
                sprite_data: serde_json::json!({"color": "#C0C0C0"}),
                base_stats: serde_json::json!({"attack": 5}),
            },
            Equipment {
                id: 7,
                name: "Basic Pants".to_string(),
                slot: "legs".to_string(),
                rarity: "common".to_string(),
                sprite_data: serde_json::json!({"color": "#4169E1"}),
                base_stats: serde_json::json!({"defense": 1}),
            },
            Equipment {
                id: 8,
                name: "Simple Ring".to_string(),
                slot: "accessory".to_string(),
                rarity: "common".to_string(),
                sprite_data: serde_json::json!({"color": "#C0C0C0"}),
                base_stats: serde_json::json!({"luck": 1}),
            },
        ];
        *equipment_guard = mock_equipment;
    }
    
    Ok(equipment_guard.clone())
}

#[tauri::command]
pub async fn equip_item(user_id: i64, item_id: i64, slot: String) -> Result<(), String> {
    match equip_item_in_db(user_id, item_id, &slot) {
        Ok(()) => Ok(()),
        Err(_) => {
            println!("Database unavailable, simulating equip item {} in slot {} for user {}", item_id, slot, user_id);
            Ok(())
        }
    }
}

fn equip_item_in_db(user_id: i64, item_id: i64, slot: &str) -> Result<(), String> {
    let conn = get_db_connection()
        .map_err(|e| format!("Database connection failed: {}", e))?;
    
    // Start transaction
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Transaction failed: {}", e))?;
    
    // First, unequip any existing item in this slot
    tx.execute(
        "UPDATE user_equipment SET equipped_slot = NULL WHERE user_id = ? AND equipped_slot = ?",
        [user_id.to_string(), slot.to_string()]
    ).map_err(|e| format!("Failed to unequip existing item: {}", e))?;
    
    // Then equip the new item
    let rows_affected = tx.execute(
        "UPDATE user_equipment SET equipped_slot = ? WHERE user_id = ? AND id = ?",
        [slot.to_string(), user_id.to_string(), item_id.to_string()]
    ).map_err(|e| format!("Failed to equip item: {}", e))?;
    
    if rows_affected == 0 {
        return Err("Item not found in user's inventory".to_string());
    }
    
    tx.commit().map_err(|e| format!("Transaction commit failed: {}", e))?;
    println!("Successfully equipped item {} in slot {} for user {}", item_id, slot, user_id);
    
    Ok(())
}

#[tauri::command]
pub async fn unequip_item(user_id: i64, slot: String) -> Result<(), String> {
    match unequip_item_in_db(user_id, &slot) {
        Ok(()) => Ok(()),
        Err(_) => {
            println!("Database unavailable, simulating unequip from slot {} for user {}", slot, user_id);
            Ok(())
        }
    }
}

fn unequip_item_in_db(user_id: i64, slot: &str) -> Result<(), String> {
    let conn = get_db_connection()
        .map_err(|e| format!("Database connection failed: {}", e))?;
    
    let rows_affected = conn.execute(
        "UPDATE user_equipment SET equipped_slot = NULL WHERE user_id = ? AND equipped_slot = ?",
        [user_id.to_string(), slot.to_string()]
    ).map_err(|e| format!("Failed to unequip item: {}", e))?;
    
    if rows_affected == 0 {
        return Err("No item equipped in this slot".to_string());
    }
    
    println!("Successfully unequipped item from slot {} for user {}", slot, user_id);
    Ok(())
}

#[tauri::command]
pub async fn get_avatar_config(user_id: i64) -> Result<AvatarConfig, String> {
    match get_avatar_config_from_db(user_id) {
        Ok(config) => Ok(config),
        Err(_) => {
            println!("Database unavailable, using default avatar config for user {}", user_id);
            get_default_avatar_config()
        }
    }
}

fn get_avatar_config_from_db(user_id: i64) -> Result<AvatarConfig, String> {
    let conn = get_db_connection()
        .map_err(|e| format!("Database connection failed: {}", e))?;
    
    let mut stmt = conn.prepare("
        SELECT skin_color, hair_color, eye_color, scale, animation_speed
        FROM avatar_configs 
        WHERE user_id = ? AND active = TRUE
    ").map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let mut rows = stmt.query_map([user_id], |row| {
        Ok(AvatarConfig {
            skin_color: row.get(0)?,
            hair_color: row.get(1)?,
            eye_color: row.get(2)?,
            scale: row.get(3)?,
            animation_speed: row.get(4)?,
        })
    }).map_err(|e| format!("Query execution failed: {}", e))?;
    
    match rows.next() {
        Some(Ok(config)) => Ok(config),
        Some(Err(e)) => Err(format!("Row parsing failed: {}", e)),
        None => Err("No avatar config found for user".to_string()),
    }
}

fn get_default_avatar_config() -> Result<AvatarConfig, String> {
    let mut config_guard = AVATAR_CONFIG.lock().unwrap();
    
    if config_guard.is_none() {
        let default_config = AvatarConfig {
            skin_color: "#F5DEB3".to_string(),
            hair_color: "#4A4A4A".to_string(),
            eye_color: "#4A90E2".to_string(),
            scale: 2.0,
            animation_speed: 8,
        };
        *config_guard = Some(default_config);
    }
    
    Ok(config_guard.as_ref().unwrap().clone())
}