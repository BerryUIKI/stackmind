pub mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::ping::ping])
        .run(tauri::generate_context!())
        .expect("error while running Stackmynd application");
}

#[cfg(test)]
mod tests {
    use crate::commands::ping::ping;

    #[test]
    fn test_ping_response() {
        let res = ping();
        assert!(res.message.contains("pong"));
        assert!(res.timestamp > 0);
    }
}
