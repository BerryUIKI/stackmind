use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize)]
pub struct PingResponse {
    pub message: String,
    pub timestamp: u64,
}

#[tauri::command]
pub fn ping() -> PingResponse {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    PingResponse {
        message: "pong from Stackmynd Rust Core".to_string(),
        timestamp,
    }
}
