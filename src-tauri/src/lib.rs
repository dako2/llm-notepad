use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{DialogExt};
use std::fs;

#[derive(Serialize, Deserialize)]
struct FileResult {
    path: String,
    content: String,
}

#[tauri::command]
async fn open_file(app: tauri::AppHandle) -> Result<FileResult, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("All Files", &["*"])
        .add_filter("Text Files", &["txt", "md", "js", "ts", "json", "html", "css", "py", "rs", "java", "cpp", "c", "h"])
        .blocking_pick_file();
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            match fs::read_to_string(&path_buf) {
                Ok(content) => Ok(FileResult {
                    path: path_buf.to_string_lossy().to_string(),
                    content,
                }),
                Err(e) => Err(format!("Failed to read file: {}", e)),
            }
        }
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
async fn save_file(_app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    match fs::write(&path, content) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to save file: {}", e)),
    }
}

#[tauri::command]
async fn save_file_as(app: tauri::AppHandle, content: String) -> Result<String, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("All Files", &["*"])
        .add_filter("Text Files", &["txt", "md", "js", "ts", "json", "html", "css", "py", "rs", "java", "cpp", "c", "h"])
        .blocking_save_file();
    
    match file_path {
        Some(path) => {
            let path_buf = path.as_path().unwrap();
            match fs::write(&path_buf, &content) {
                Ok(_) => Ok(path_buf.to_string_lossy().to_string()),
                Err(e) => Err(format!("Failed to save file: {}", e)),
            }
        }
        None => Err("No file path selected".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file, save_file_as])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
