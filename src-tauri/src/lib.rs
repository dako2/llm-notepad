use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{DialogExt};
use std::fs;

#[derive(Serialize, Deserialize)]
struct FileResult {
    path: String,
    content: String,
}

#[derive(Serialize, Deserialize)]
struct LLMRequest {
    content: String,
    mode: String,
    cursor_position: usize,
}

#[derive(Serialize, Deserialize)]
struct LLMResponse {
    content: String,
    mode: String,
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

#[tauri::command]
async fn send_to_llm(request: LLMRequest) -> Result<LLMResponse, String> {
    
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found in environment variables")?;
    
    let payload = serde_json::json!({
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "system",
                "content": format!("You are a helpful text editor assistant. Mode: {}. Respond with only the text that should be inserted/replaced.", request.mode)
            },
            {
                "role": "user", 
                "content": request.content
            }
        ],
        "max_tokens": 1000
    });
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;
    
    let status = response.status();
    let response_text = response.text().await
        .map_err(|e| format!("Failed to read response text: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("OpenAI API error ({}): {}", status, response_text));
    }
    
    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse JSON response: {} - Response: {}", e, response_text))?;
        
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
        
    Ok(LLMResponse {
        content,
        mode: request.mode,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file, save_file_as, send_to_llm])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
