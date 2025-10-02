use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tokio::sync::oneshot;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
    pub token_type: String,
    pub scope: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthConfig {
    pub client_id: String,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
}

pub struct OAuthState {
    pub pending_auth: Arc<Mutex<HashMap<String, oneshot::Sender<Result<OAuthTokens, String>>>>>,
}

impl OAuthState {
    pub fn new() -> Self {
        Self {
            pending_auth: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn start_google_oauth(
    app: tauri::AppHandle,
    client_id: String,
    scopes: Vec<String>,
) -> Result<String, String> {
    // Generate a random state parameter for security
    let state = uuid::Uuid::new_v4().to_string();

    // Build the OAuth URL
    let redirect_uri = "http://localhost:9898/oauth/callback";
    let scope = scopes.join(" ");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=token&scope={}&state={}&access_type=offline&prompt=consent",
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&state)
    );

    // Open the auth URL in the default browser
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }

    // Start local server to handle callback
    start_callback_server(state.clone(), app).await;

    Ok(state)
}

async fn start_callback_server(state: String, app: tauri::AppHandle) {
    use std::io::prelude::*;
    use std::net::{TcpListener, TcpStream};
    use std::thread;

    thread::spawn(move || {
        let listener = TcpListener::bind("127.0.0.1:9898").unwrap();

        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut buffer = [0; 2048];
                stream.read(&mut buffer).unwrap();

                let request = String::from_utf8_lossy(&buffer);

                // Parse the URL fragment (OAuth tokens are in the fragment for implicit flow)
                if request.contains("GET /oauth/callback") {
                    // Extract tokens from the request
                    let tokens = extract_tokens_from_request(&request);

                    // Send success response to browser
                    let response = if tokens.is_some() {
                        "HTTP/1.1 200 OK\r\n\r\n<html><body><h1>Authentication successful!</h1><p>You can close this window.</p><script>window.close();</script></body></html>"
                    } else {
                        "HTTP/1.1 400 Bad Request\r\n\r\n<html><body><h1>Authentication failed</h1><p>Please try again.</p></body></html>"
                    };

                    stream.write(response.as_bytes()).unwrap();
                    stream.flush().unwrap();

                    // Emit event to frontend with tokens
                    if let Some(tokens) = tokens {
                        app.emit("oauth-success", tokens).unwrap();
                    } else {
                        app.emit("oauth-error", "Failed to extract tokens").unwrap();
                    }

                    // Close the server after handling one request
                    break;
                }
            }
        }
    });
}

fn extract_tokens_from_request(request: &str) -> Option<OAuthTokens> {
    // For implicit flow, tokens come in the fragment
    // We need to handle the redirect and extract from the fragment
    // This is a simplified version - you may need to enhance based on actual response

    if request.contains("access_token=") {
        let mut access_token = String::new();
        let mut token_type = String::from("Bearer");
        let mut expires_in = None;
        let mut scope = String::new();

        // Parse query parameters from the request
        for part in request.split('&') {
            if let Some(token) = part.strip_prefix("access_token=") {
                access_token = token.split(' ').next().unwrap_or("").to_string();
            } else if let Some(exp) = part.strip_prefix("expires_in=") {
                expires_in = exp.split(' ').next().unwrap_or("").parse().ok();
            } else if let Some(s) = part.strip_prefix("scope=") {
                scope = urlencoding::decode(s.split(' ').next().unwrap_or(""))
                    .unwrap_or_default()
                    .to_string();
            }
        }

        if !access_token.is_empty() {
            return Some(OAuthTokens {
                access_token,
                refresh_token: None,
                expires_in,
                token_type,
                scope,
            });
        }
    }

    None
}

#[tauri::command]
pub async fn refresh_google_token(refresh_token: String, client_id: String) -> Result<OAuthTokens, String> {
    // Implement token refresh logic here
    // This would make a POST request to Google's token endpoint
    Err("Token refresh not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_google_calendar_events(
    access_token: String,
    time_min: Option<String>,
    time_max: Option<String>,
    max_results: Option<i32>
) -> Result<String, String> {
    // Build query parameters
    let mut url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime".to_string();

    if let Some(min) = time_min {
        url.push_str(&format!("&timeMin={}", urlencoding::encode(&min)));
    }

    if let Some(max) = time_max {
        url.push_str(&format!("&timeMax={}", urlencoding::encode(&max)));
    }

    if let Some(max_res) = max_results {
        url.push_str(&format!("&maxResults={}", max_res));
    }

    // Make API call to Google Calendar
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch calendar events: {}", e))?;

    if response.status().is_success() {
        let body = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(body)
    } else {
        Err(format!("API request failed with status: {}", response.status()))
    }
}

#[tauri::command]
pub async fn create_google_calendar_event(
    access_token: String,
    event_data: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://www.googleapis.com/calendar/v3/calendars/primary/events")
        .bearer_auth(access_token)
        .header("Content-Type", "application/json")
        .body(event_data)
        .send()
        .await
        .map_err(|e| format!("Failed to create calendar event: {}", e))?;

    let status = response.status();
    if status.is_success() {
        let body = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(body)
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("API request failed with status: {}, body: {}", status, error_text))
    }
}

#[tauri::command]
pub async fn update_google_calendar_event(
    access_token: String,
    event_id: String,
    event_data: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.googleapis.com/calendar/v3/calendars/primary/events/{}", event_id);

    let response = client
        .put(&url)
        .bearer_auth(access_token)
        .header("Content-Type", "application/json")
        .body(event_data)
        .send()
        .await
        .map_err(|e| format!("Failed to update calendar event: {}", e))?;

    let status = response.status();
    if status.is_success() {
        let body = response.text().await
            .map_err(|e| format!("Failed to read response: {}", e))?;
        Ok(body)
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("API request failed with status: {}, body: {}", status, error_text))
    }
}

#[tauri::command]
pub async fn delete_google_calendar_event(
    access_token: String,
    event_id: String
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("https://www.googleapis.com/calendar/v3/calendars/primary/events/{}", event_id);

    let response = client
        .delete(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Failed to delete calendar event: {}", e))?;

    if response.status().is_success() || response.status() == 410 {
        // 410 Gone means already deleted
        Ok(())
    } else {
        Err(format!("API request failed with status: {}", response.status()))
    }
}