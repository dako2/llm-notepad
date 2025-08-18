use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::{DialogExt};
use std::fs;
use log::{info, warn, error, debug};
use tokio_stream::StreamExt;
use tauri::Emitter;

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
struct StreamingRequest {
    content: String,
    mode: String,
    cursor_position: usize,
    instruction: String,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
enum StreamingMessage {
    #[serde(rename = "llm_start")]
    LlmStart { id: String },
    #[serde(rename = "llm_delta")]
    LlmDelta { id: String, delta: String },
    #[serde(rename = "llm_done")]
    LlmDone { id: String },
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

#[tauri::command]
async fn check_api_key_status() -> Result<bool, String> {
    match std::env::var("OPENAI_API_KEY") {
        Ok(key) if !key.is_empty() => Ok(true),
        _ => Ok(false)
    }
}

#[tauri::command]
async fn stream_to_llm(app: tauri::AppHandle, request: StreamingRequest) -> Result<String, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OpenAI API key not found in environment variables")?;
    
    let request_id = format!("req-{}", rand::random::<u32>());
    
    let system_prompt = match request.mode.as_str() {
        "edit" => format!("You are a helpful text editor assistant. Edit and improve the following text. Instruction: {}. Respond with only the improved text that should replace the original.", request.instruction),
        "append" => format!("You are a helpful text editor assistant. Continue the following text. Instruction: {}. Respond with only the text that should be appended.", request.instruction),
        "respond" => format!("You are a helpful text editor assistant. Respond to or analyze the following text. Instruction: {}. Provide your response.", request.instruction),
        _ => format!("You are a helpful text editor assistant. Process the following text. Instruction: {}.", request.instruction),
    };
    
    let payload = serde_json::json!({
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user", 
                "content": request.content
            }
        ],
        "max_tokens": 1000,
        "stream": true
    });
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;
    
    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("OpenAI API error: {}", error_text));
    }
    
    let request_id_clone = request_id.clone();
    let app_clone = app.clone();
    
    tokio::spawn(async move {
        let start_msg = StreamingMessage::LlmStart { id: request_id_clone.clone() };
        let _ = app_clone.emit("streaming_message", &start_msg);
        
        let mut stream = response.bytes_stream();
        let mut buffer = String::new();
        
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    buffer.push_str(&chunk_str);
                    
                    while let Some(line_end) = buffer.find('\n') {
                        let line = buffer[..line_end].trim().to_string();
                        buffer.drain(..line_end + 1);
                        
                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            if data == "[DONE]" {
                                break;
                            }
                            
                            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                                if let Some(choices) = parsed["choices"].as_array() {
                                    if let Some(choice) = choices.first() {
                                        if let Some(delta) = choice["delta"]["content"].as_str() {
                                            let delta_msg = StreamingMessage::LlmDelta {
                                                id: request_id_clone.clone(),
                                                delta: delta.to_string(),
                                            };
                                            let _ = app_clone.emit("streaming_message", &delta_msg);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
        
        let done_msg = StreamingMessage::LlmDone { id: request_id_clone };
        let _ = app_clone.emit("streaming_message", &done_msg);
    });
    
    Ok(request_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file, save_file_as, send_to_llm, stream_to_llm, check_api_key_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
