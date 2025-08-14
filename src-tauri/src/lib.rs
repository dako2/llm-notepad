use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{DialogExt};
use std::fs;
use log::{info, warn, error, debug};

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
            let path_buf = match path.as_path() {
                Some(p) => p,
                None => {
                    error!("Failed to convert file path to PathBuf");
                    return Err("Invalid file path".to_string());
                }
            };
            info!("Opening file: {}", path_buf.display());
            match fs::read_to_string(&path_buf) {
                Ok(content) => {
                    info!("Successfully read file with {} bytes", content.len());
                    Ok(FileResult {
                        path: path_buf.to_string_lossy().to_string(),
                        content,
                    })
                },
                Err(e) => {
                    error!("Failed to read file {}: {}", path_buf.display(), e);
                    Err(format!("Failed to read file: {}", e))
                },
            }
        }
        None => {
            warn!("No file selected by user");
            Err("No file selected".to_string())
        },
    }
}

#[tauri::command]
async fn save_file(_app: tauri::AppHandle, path: String, content: String) -> Result<(), String> {
    info!("Saving file: {} ({} bytes)", path, content.len());
    match fs::write(&path, content) {
        Ok(_) => {
            info!("Successfully saved file: {}", path);
            Ok(())
        },
        Err(e) => {
            error!("Failed to save file {}: {}", path, e);
            Err(format!("Failed to save file: {}", e))
        },
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
            let path_buf = match path.as_path() {
                Some(p) => p,
                None => {
                    error!("Failed to convert save path to PathBuf");
                    return Err("Invalid file path".to_string());
                }
            };
            info!("Saving file as: {}", path_buf.display());
            match fs::write(&path_buf, &content) {
                Ok(_) => {
                    info!("Successfully saved file as: {}", path_buf.display());
                    Ok(path_buf.to_string_lossy().to_string())
                },
                Err(e) => {
                    error!("Failed to save file {}: {}", path_buf.display(), e);
                    Err(format!("Failed to save file: {}", e))
                },
            }
        }
        None => {
            warn!("No file path selected for save as");
            Err("No file path selected".to_string())
        },
    }
}

#[tauri::command]
async fn send_to_llm(request: LLMRequest) -> Result<LLMResponse, String> {
    info!("LLM request - Mode: {}, Content length: {}, Cursor position: {}", 
          request.mode, request.content.len(), request.cursor_position);
    
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| {
            error!("OpenAI API key not found in environment variables");
            "OpenAI API key not found in environment variables"
        })?;
    
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
    
    debug!("Sending request to OpenAI API");
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            error!("HTTP request failed: {}", e);
            format!("HTTP request failed: {}", e)
        })?;
    
    let status = response.status();
    debug!("OpenAI API response status: {}", status);
    
    let response_text = response.text().await
        .map_err(|e| {
            error!("Failed to read response text: {}", e);
            format!("Failed to read response text: {}", e)
        })?;
    
    if !status.is_success() {
        error!("OpenAI API error ({}): {}", status, response_text);
        return Err(format!("OpenAI API error ({}): {}", status, response_text));
    }
    
    let json: serde_json::Value = serde_json::from_str(&response_text)
        .map_err(|e| {
            error!("Failed to parse JSON response: {} - Response: {}", e, response_text);
            format!("Failed to parse JSON response: {} - Response: {}", e, response_text)
        })?;
    
    let content = json
        .get("choices")
        .and_then(|choices| choices.get(0))
        .and_then(|choice| choice.get("message"))
        .and_then(|message| message.get("content"))
        .and_then(|content| content.as_str())
        .unwrap_or("");
    
    if content.is_empty() {
        warn!("OpenAI API returned empty content");
    } else {
        info!("LLM response received - Content length: {}", content.len());
    }
        
    Ok(LLMResponse {
        content: content.to_string(),
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
