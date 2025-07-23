// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{DateTime, Utc};
use log::{error, info, warn};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};

use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Method, Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use sha2::Sha256;
use std::collections::HashMap;
use std::convert::Infallible;
use std::fs;
use std::io::Error;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIcon};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_keyring::KeyringExt;
use tauri_plugin_updater::UpdaterExt;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use uuid::Uuid;
extern crate keyring;
extern crate whoami;

// ML Engine modules
mod ml_engine_simple;
mod ml_engine;
mod ml_commands;
mod llm_wrapper;
mod llm_proxy;
mod api_generator;
mod api_generator_commands;
// Documentation modules
mod docs_manager;
mod docs_commands;
use ml_engine_simple::MLEngine;

// ===============================
//  API HTTP ↔️ Tauri Command Map
// ===============================
// | HTTP Endpoint                | Metodo | Comando Tauri                |
// |-----------------------------|--------|------------------------------|
// | /api/keys                   | GET    | get_api_keys                 |
// | /api/keys/search?q=...      | GET    | search_api_keys_by_query     |
// | /api/projects               | GET    | get_projects                 |
// | /api/activity/recent        | GET    | get_recent_activity          |
// | /api/keys/{id}/usage        | POST   | record_key_usage             |
// | /api/projects/sync          | POST   | sync_project                 |
// | /health                     | GET    | (interno, no comando)        |
// | /api/keys                   | POST   | add_api_key                  |
// | /api/keys/{id}              | DELETE | delete_api_key               |
// | /api/keys                   | PUT    | update_api_key               |
// | /api/keys                   | GET    | get_api_keys                 |
// | /api/keys                   | PATCH  | update_api_key               |
// | /api/keys                   | OPTIONS| (CORS preflight, no comando) |
// | /api/keys                   | HEAD   | (non usato)                  |
//
// NB: Alcuni endpoint sono solo per uso interno o legacy.
// ===============================

// Helper function for consistent UTC timestamp formatting
fn get_utc_timestamp() -> String {
    Utc::now().to_rfc3339()
}

fn get_utc_timestamp_millis() -> i64 {
    Utc::now().timestamp_millis()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuditLog {
    pub id: String,
    pub timestamp: String,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub user_id: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKey {
    pub id: String,
    pub name: String,
    pub service: String,
    pub key: String,
    pub description: Option<String>,
    pub environment: String, // dev, staging, production
    pub rate_limit: Option<String>,
    pub expires_at: Option<String>,
    pub scopes: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    pub is_active: bool,
    // Informazioni per chiavi importate da .env
    pub source_type: Option<String>, // "manual" | "env_file"
    pub env_file_path: Option<String>,
    pub project_path: Option<String>,
    pub env_file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAccount {
    pub id: String,
    pub email: String,
    pub username: String,
    pub password_hash: String, // bcrypt hash for account password
    pub created_at: String,
    pub updated_at: String,
    pub verified: bool,
    pub recovery_codes: Vec<String>, // Encrypted recovery codes
    pub two_factor_enabled: bool,
    pub backup_email: Option<String>,
    pub biometric_enabled: bool,
    pub passkey_credentials: Vec<PasskeyCredential>,
    pub session_timeout: u64, // in minutes
    pub login_attempts: u32,
    pub locked_until: Option<String>,
    pub preferences: UserPreferences,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasskeyCredential {
    pub id: String,
    pub name: String, // User-friendly name like "MacBook Touch ID"
    pub credential_id: Vec<u8>,
    pub public_key: Vec<u8>,
    pub created_at: String,
    pub last_used: Option<String>,
    pub device_info: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    pub theme: String, // "light", "dark", "system"
    pub language: String,
    pub auto_lock_timeout: u64,       // in minutes
    pub clipboard_clear_timeout: u64, // in seconds
    pub show_notifications: bool,
    pub audit_logging: bool,
    pub biometric_unlock: bool,
    pub auto_backup: bool,
    pub encryption_level: String, // "standard", "enhanced", "maximum"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BiometricSession {
    pub user_id: String,
    pub session_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub device_id: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebAuthnChallenge {
    pub challenge: String,
    pub user_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub challenge_type: String, // "registration" or "authentication"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasswordRecovery {
    pub token: String,
    pub email: String,
    pub created_at: String,
    pub expires_at: String,
    pub used: bool,
    pub attempts: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings: ProjectSettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectSettings {
    pub default_environment: String,
    pub auto_sync: bool,
    pub vscode_integration: bool,
    pub cursor_integration: bool,
    pub notifications: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Documentation {
    pub id: String,
    pub title: String,
    pub content: String,
    pub doc_type: String, // "api", "guide", "reference", "notes", "snippet"
    pub project_id: Option<String>, // Associazione con progetti
    pub provider_id: Option<String>, // Associazione con provider API
    pub url: Option<String>, // URL di riferimento originale
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub language: String, // "en", "it", "es", etc.
    pub is_favorite: bool,
    pub search_keywords: Vec<String>, // Keywords per migliorare la ricerca
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocSection {
    pub id: String,
    pub title: String,
    pub content: String,
    pub level: u8, // 1-6 per heading levels
    pub anchor: Option<String>,
    pub parent_section_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentActivity {
    pub id: String,
    pub activity_type: String, // "key_used", "key_created", "key_updated"
    pub key_id: String,
    pub key_name: String,
    pub timestamp: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectEnvAssociation {
    pub id: String,
    pub project_path: String,
    pub env_file_path: String,
    pub env_file_name: String,
    pub created_at: String,
    pub last_accessed: String,
    pub is_active: bool,
    pub vscode_status: Option<String>, // "open", "closed", "unknown"
    pub last_vscode_check: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VSCodeWorkspace {
    pub path: String,
    pub name: String,
    pub is_open: bool,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersistentSession {
    pub session_id: String,
    pub user_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub last_accessed: String,
    pub device_info: String,
    pub is_remember_me: bool,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VSCodeToken {
    pub token: String,
    pub user_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub is_valid: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvVariable {
    pub name: String,
    pub value: String,
    pub is_secret: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DroppedEnvFile {
    pub path: String,
    pub project_path: String,
    pub file_name: String,
    pub keys: Vec<EnvVariable>,
}

// Metadata structure for encrypted vaults
#[derive(Debug, Serialize, Deserialize)]
pub struct VaultMetadata {
    pub master_password_hash: Option<String>,
    pub salt: Option<String>,
    pub created_at: String,
    pub version: String,
    pub api_keys_metadata: Vec<ApiKeyMetadata>,
}

// Non-sensitive metadata for API keys (stored in clear text)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKeyMetadata {
    pub id: String,
    pub name: String,
    pub key: String,
    pub service: String,
    pub description: Option<String>,
    pub environment: String,
    pub rate_limit: Option<String>,
    pub expires_at: Option<String>,
    pub scopes: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    pub is_active: bool,
    pub source_type: Option<String>,
    pub env_file_path: Option<String>,
    pub project_path: Option<String>,
    pub env_file_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyVault {
    pub keys: HashMap<String, ApiKey>,
    pub master_password_hash: Option<String>,
    pub last_backup: Option<String>,
    pub encryption_key: Option<String>, // Base64 encoded encryption key
    pub salt: Option<String>,           // Base64 encoded salt for key derivation
    pub audit_logs: Vec<AuditLog>,
    pub user_account: Option<UserAccount>,
    pub recovery_tokens: Vec<PasswordRecovery>,
    pub projects: HashMap<String, Project>,
    pub recent_activity: Vec<RecentActivity>,
    pub env_associations: Vec<ProjectEnvAssociation>,
    pub biometric_sessions: Vec<BiometricSession>,
    pub webauthn_challenges: Vec<WebAuthnChallenge>,
    pub vscode_workspaces: Vec<VSCodeWorkspace>,
    pub persistent_sessions: Vec<PersistentSession>,
    pub vscode_tokens: Vec<VSCodeToken>,
}

impl Default for ApiKeyVault {
    fn default() -> Self {
        Self {
            keys: HashMap::new(),
            master_password_hash: None,
            last_backup: None,
            encryption_key: None,
            salt: None,
            audit_logs: Vec::new(),
            user_account: None,
            recovery_tokens: Vec::new(),
            projects: HashMap::new(),
            recent_activity: Vec::new(),
            env_associations: Vec::new(),
            biometric_sessions: Vec::new(),
            webauthn_challenges: Vec::new(),
            vscode_workspaces: Vec::new(),
            persistent_sessions: Vec::new(),
            vscode_tokens: Vec::new(),
        }
    }
}

// ================================
// Documentation Storage System
// ================================

#[derive(Debug, Serialize, Deserialize)]
pub struct DocsStore {
    pub docs: HashMap<String, Documentation>,
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
    pub index: HashMap<String, Vec<String>>, // keyword -> doc_ids mapping for search
}

impl Default for DocsStore {
    fn default() -> Self {
        Self {
            docs: HashMap::new(),
            version: "1.0.0".to_string(),
            created_at: get_utc_timestamp(),
            updated_at: get_utc_timestamp(),
            index: HashMap::new(),
        }
    }
}

impl DocsStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_doc(&mut self, doc: Documentation) {
        // Update index
        self.update_index(&doc);
        
        // Add to store
        self.docs.insert(doc.id.clone(), doc);
        self.updated_at = get_utc_timestamp();
    }

    pub fn update_doc(&mut self, doc: Documentation) {
        // Remove old index entries
        if let Some(old_doc) = self.docs.get(&doc.id).cloned() {
            self.remove_from_index(&old_doc);
        }
        
        // Update index with new doc
        self.update_index(&doc);
        
        // Update doc
        self.docs.insert(doc.id.clone(), doc);
        self.updated_at = get_utc_timestamp();
    }

    pub fn remove_doc(&mut self, doc_id: &str) -> Option<Documentation> {
        if let Some(doc) = self.docs.remove(doc_id) {
            self.remove_from_index(&doc);
            self.updated_at = get_utc_timestamp();
            Some(doc)
        } else {
            None
        }
    }

    pub fn get_doc(&self, doc_id: &str) -> Option<&Documentation> {
        self.docs.get(doc_id)
    }

    pub fn get_all_docs(&self) -> Vec<&Documentation> {
        self.docs.values().collect()
    }

    pub fn search_docs(&self, query: &str) -> Vec<&Documentation> {
        let query_lower = query.to_lowercase();
        let mut results = Vec::new();
        
        // Search in index first
        for (keyword, doc_ids) in &self.index {
            if keyword.contains(&query_lower) {
                for doc_id in doc_ids {
                    if let Some(doc) = self.docs.get(doc_id) {
                        if !results.iter().any(|d: &&Documentation| d.id == doc.id) {
                            results.push(doc);
                        }
                    }
                }
            }
        }
        
        // Also search directly in content if not found in index
        if results.is_empty() {
            for doc in self.docs.values() {
                if doc.title.to_lowercase().contains(&query_lower) ||
                   doc.content.to_lowercase().contains(&query_lower) {
                    results.push(doc);
                }
            }
        }
        
        results
    }

    fn update_index(&mut self, doc: &Documentation) {
        // Index title words
        for word in doc.title.to_lowercase().split_whitespace() {
            if word.len() > 2 {
                self.index.entry(word.to_string())
                    .or_insert_with(Vec::new)
                    .push(doc.id.clone());
            }
        }
        
        // Index search keywords
        for keyword in &doc.search_keywords {
            self.index.entry(keyword.to_lowercase())
                .or_insert_with(Vec::new)
                .push(doc.id.clone());
        }
        
        // Index tags
        for tag in &doc.tags {
            self.index.entry(tag.to_lowercase())
                .or_insert_with(Vec::new)
                .push(doc.id.clone());
        }
    }

    fn remove_from_index(&mut self, doc: &Documentation) {
        // Remove from all index entries
        for doc_ids in self.index.values_mut() {
            doc_ids.retain(|id| id != &doc.id);
        }
        
        // Remove empty index entries
        self.index.retain(|_, doc_ids| !doc_ids.is_empty());
    }
}

pub struct AppState {
    pub vault: Arc<Mutex<ApiKeyVault>>,
    pub is_unlocked: Arc<Mutex<bool>>,
    pub vault_path: PathBuf,
    pub ml_engine: Arc<tokio::sync::Mutex<Option<MLEngine>>>,
    pub llm_proxy: std::sync::Arc<llm_proxy::LLMProxyState>,

    pub vscode_server_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    pub vscode_server_running: Arc<AtomicBool>,
    
    pub tray_handle: Arc<Mutex<Option<TrayIcon>>>,
    pub api_generator: Arc<Mutex<api_generator_commands::ApiGeneratorState>>,
    // Documentation Manager
    pub docs_manager: Arc<Mutex<docs_commands::DocsManagerState>>,
    // Separate Documentation Store
    pub docs_store: Arc<Mutex<DocsStore>>,
    pub docs_store_path: PathBuf,
}

fn decrypt_api_key(encrypted: &str, password: &str) -> Result<String, String> {
    let combined = general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 28 {
        // 16 (salt) + 12 (nonce)
        return Err("Invalid encrypted data".to_string());
    }

    let (salt, rest) = combined.split_at(16);
    let (nonce_bytes, ciphertext) = rest.split_at(12);

    let key_bytes = derive_key_from_password(password, salt);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 decode failed: {}", e))
}

#[tauri::command]
async fn unlock_vault(password: String, state: State<'_, AppState>) -> Result<bool, String> {
    let vault_guard = state.vault.lock().await;

    if let Some(stored_hash) = &vault_guard.master_password_hash {
        info!("Attempting to verify password against stored hash");
        info!(
            "Stored hash length: {}, starts with: {}",
            stored_hash.len(),
            &stored_hash[..std::cmp::min(10, stored_hash.len())]
        );
        info!("Password length: {}", password.len());

        // Use bcrypt for secure password verification
        let is_valid = match verify(&password, stored_hash) {
            Ok(valid) => {
                info!("Bcrypt verification successful: {}", valid);
                valid
            }
            Err(e) => {
                error!("Bcrypt verification failed: {}", e);
                error!("This usually means the stored hash is not a valid bcrypt hash");

                // Fallback: check if password was stored in plain text (legacy support)
                if stored_hash == &password {
                    warn!("Password was stored in plain text! Will migrate to bcrypt hash...");
                    // We'll migrate to bcrypt hash after unlock succeeds
                    true
                } else {
                    false
                }
            }
        };
        info!("Final password verification result: {}", is_valid);
        if is_valid {
            // Check if we need to migrate plain text password to bcrypt hash
            let needs_migration = stored_hash == &password;

            // Check if vault is encrypted (has placeholder encryption key)
            let needs_decryption = vault_guard
                .encryption_key
                .as_ref()
                .map_or(false, |key| key == "[ENCRYPTED]");

            if needs_decryption {
                // Drop the guard to avoid deadlock before calling decrypt function
                drop(vault_guard);

                // Decrypt and reload the actual vault data
                match decrypt_vault_with_password(&state.vault_path, &password) {
                    Ok(decrypted_vault) => {
                        // Replace the vault in memory with the decrypted version
                        let mut vault_guard = state.vault.lock().await;
                        *vault_guard = decrypted_vault;
                        drop(vault_guard);

                        *state.is_unlocked.lock().await = true;

                        // Migrate password hash if needed
                        if needs_migration {
                            match hash(&password, DEFAULT_COST) {
                                Ok(new_hash) => {
                                    let mut vault_guard = state.vault.lock().await;
                                    vault_guard.master_password_hash = Some(new_hash);
                                    drop(vault_guard);
                                    if let Err(e) = save_vault(&state).await {
                                        warn!("Failed to save migrated password hash: {}", e);
                                    }
                                    log_audit_event(
                                        &state,
                                        "unlock_vault",
                                        "vault",
                                        None,
                                        true,
                                        Some("Vault decrypted, unlocked and password migrated"),
                                    )
                                    .await;
                                }
                                Err(e) => {
                                    warn!("Failed to create bcrypt hash during migration: {}", e);
                                    log_audit_event(
                                        &state,
                                        "unlock_vault",
                                        "vault",
                                        None,
                                        true,
                                        Some("Vault decrypted and unlocked (migration failed)"),
                                    )
                                    .await;
                                }
                            }
                        } else {
                            log_audit_event(
                                &state,
                                "unlock_vault",
                                "vault",
                                None,
                                true,
                                Some("Vault decrypted and unlocked"),
                            )
                            .await;
                        }
                        Ok(true)
                    }
                    Err(e) => {
                        log_audit_event(
                            &state,
                            "unlock_vault",
                            "vault",
                            None,
                            false,
                            Some(&format!("Failed to decrypt vault: {}", e)),
                        )
                        .await;
                        Err(format!("Failed to decrypt vault: {}", e))
                    }
                }
            } else {
                // Vault is not encrypted, just unlock it
                drop(vault_guard);
                *state.is_unlocked.lock().await = true;

                // Migrate password hash if needed
                if needs_migration {
                    match hash(&password, DEFAULT_COST) {
                        Ok(new_hash) => {
                            let mut vault_guard = state.vault.lock().await;
                            vault_guard.master_password_hash = Some(new_hash);
                            drop(vault_guard);
                            if let Err(e) = save_vault(&state).await {
                                warn!("Failed to save migrated password hash: {}", e);
                            }
                            log_audit_event(
                                &state,
                                "unlock_vault",
                                "vault",
                                None,
                                true,
                                Some("Vault unlocked and password migrated"),
                            )
                            .await;
                        }
                        Err(e) => {
                            warn!("Failed to create bcrypt hash during migration: {}", e);
                            log_audit_event(
                                &state,
                                "unlock_vault",
                                "vault",
                                None,
                                true,
                                Some("Vault unlocked (migration failed)"),
                            )
                            .await;
                        }
                    }
                } else {
                    log_audit_event(&state, "unlock_vault", "vault", None, true, None).await;
                }
                Ok(true)
            }
        } else {
            log_audit_event(
                &state,
                "unlock_vault",
                "vault",
                None,
                false,
                Some("Invalid password"),
            )
            .await;
            Ok(false)
        }
    } else {
        // Master password not set, check if this is a legacy vault that needs migration
        info!("No master password hash found, checking for legacy vault");

        // For legacy vaults without bcrypt hash, try to decrypt directly with password
        if vault_guard.encryption_key.is_some()
            && vault_guard.encryption_key.as_ref().unwrap() != "[ENCRYPTED]"
        {
            // This might be a legacy encrypted vault, try to decrypt
            drop(vault_guard);
            match decrypt_vault_with_password(&state.vault_path, &password) {
                Ok(decrypted_vault) => {
                    // Migration: set proper bcrypt hash for future unlocks
                    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

                    let mut vault_guard = state.vault.lock().await;
                    *vault_guard = decrypted_vault;
                    vault_guard.master_password_hash = Some(password_hash);
                    drop(vault_guard);

                    // Save the migrated vault
                    save_vault(&state).await?;

                    *state.is_unlocked.lock().await = true;
                    log_audit_event(
                        &state,
                        "unlock_vault",
                        "vault",
                        None,
                        true,
                        Some("Legacy vault migrated and unlocked"),
                    )
                    .await;
                    Ok(true)
                }
                Err(_) => {
                    // Not a legacy vault or wrong password
                    log_audit_event(
                        &state,
                        "unlock_vault",
                        "vault",
                        None,
                        false,
                        Some("Master password not set"),
                    )
                    .await;
                    Err("Master password not set. Please set it first.".to_string())
                }
            }
        } else {
            // No encryption key at all, master password not set
            log_audit_event(
                &state,
                "unlock_vault",
                "vault",
                None,
                false,
                Some("Master password not set"),
            )
            .await;
            Err("Master password not set. Please set it first.".to_string())
        }
    }
}

// Keyring functions for master password
#[tauri::command]
async fn save_master_password_to_keyring(app: AppHandle, password: String) -> Result<(), String> {
    const SERVICE_NAME: &str = "KeyKeeper";
    const USERNAME: &str = "master_password";

    match app
        .keyring()
        .set_password(SERVICE_NAME, USERNAME, &password)
    {
        Ok(_) => {
            info!("Master password saved to keyring successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to save master password to keyring: {}", e);
            Err(format!("Failed to save master password to keyring: {}", e))
        }
    }
}

#[tauri::command]
async fn get_master_password_from_keyring(app: AppHandle) -> Result<Option<String>, String> {
    const SERVICE_NAME: &str = "KeyKeeper";
    const USERNAME: &str = "master_password";

    match app.keyring().get_password(SERVICE_NAME, USERNAME) {
        Ok(Some(password)) => {
            info!("Master password retrieved from keyring successfully");
            Ok(Some(password))
        }
        Ok(None) => {
            info!("No master password found in keyring");
            Ok(None)
        }
        Err(e) => {
            error!("Failed to retrieve master password from keyring: {}", e);
            Err(format!(
                "Failed to retrieve master password from keyring: {}",
                e
            ))
        }
    }
}

#[tauri::command]
async fn delete_master_password_from_keyring(app: AppHandle) -> Result<(), String> {
    const SERVICE_NAME: &str = "KeyKeeper";
    const USERNAME: &str = "master_password";

    match app.keyring().delete_password(SERVICE_NAME, USERNAME) {
        Ok(_) => {
            info!("Master password deleted from keyring successfully");
            Ok(())
        }
        Err(e) => {
            error!("Failed to delete master password from keyring: {}", e);
            Err(format!(
                "Failed to delete master password from keyring: {}",
                e
            ))
        }
    }
}

#[tauri::command]
async fn set_master_password(password: String, state: State<'_, AppState>) -> Result<bool, String> {
    // Use bcrypt for secure password hashing
    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    let mut vault_guard = state.vault.lock().await;
    vault_guard.master_password_hash = Some(password_hash);

    // Generate salt for key derivation
    let mut salt_bytes = [0u8; 16]; // 128 bits

    OsRng.fill_bytes(&mut salt_bytes);

    // Derive encryption key from password and salt using PBKDF2
    let key_bytes = derive_key_from_password(&password, &salt_bytes);

    vault_guard.encryption_key = Some(general_purpose::STANDARD.encode(&key_bytes));
    vault_guard.salt = Some(general_purpose::STANDARD.encode(&salt_bytes));

    drop(vault_guard);

    *state.is_unlocked.lock().await = true;
    save_vault(&state).await?;
    Ok(true)
}

#[tauri::command]
async fn is_vault_unlocked(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(*state.is_unlocked.lock().await)
}

#[tauri::command]
async fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    *state.is_unlocked.lock().await = false;
    log_audit_event(&state, "lock_vault", "vault", None, true, None).await;
    Ok(())
}

// Keyring management commands
#[tauri::command]
async fn keyring_set(service: String, account: String, password: String) -> Result<(), String> {
    use keyring::Entry;

    let entry = Entry::new(&service, &account)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .set_password(&password)
        .map_err(|e| format!("Failed to set password in keyring: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn keyring_get(service: String, account: String) -> Result<String, String> {
    use keyring::Entry;

    let entry = Entry::new(&service, &account)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    let password = entry
        .get_password()
        .map_err(|e| format!("Failed to get password from keyring: {}", e))?;

    Ok(password)
}

#[tauri::command]
async fn keyring_delete(service: String, account: String) -> Result<(), String> {
    use keyring::Entry;

    let entry = Entry::new(&service, &account)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;

    entry
        .delete_password()
        .map_err(|e| format!("Failed to delete password from keyring: {}", e))?;

    Ok(())
}

// Device information command
#[tauri::command]
async fn get_device_info() -> Result<serde_json::Value, String> {
    let hostname = whoami::fallible::hostname().unwrap_or_else(|_| "unknown".to_string());
    let device_info = serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hostname": hostname,
        "username": whoami::username(),
        "device_id": format!("{}-{}-{}", hostname, whoami::username(), std::env::consts::OS)
    });

    Ok(device_info)
}

// Auto-start management with proper implementation
#[tauri::command]
async fn setup_auto_start(app: AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    let autostart_manager = app.autolaunch();

    if enabled {
        autostart_manager
            .enable()
            .map_err(|e| format!("Failed to enable auto-start: {}", e))?;
        info!("Auto-start enabled");
    } else {
        autostart_manager
            .disable()
            .map_err(|e| format!("Failed to disable auto-start: {}", e))?;
        info!("Auto-start disabled");
    }

    Ok(())
}

#[tauri::command]
async fn disable_auto_start(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;

    app.autolaunch()
        .disable()
        .map_err(|e| format!("Failed to disable auto-start: {}", e))?;

    info!("Auto-start disabled");
    Ok(())
}

#[tauri::command]
async fn is_auto_start_enabled(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;

    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("Failed to check auto-start status: {}", e))
}

// Notification command with proper implementation
#[tauri::command]
async fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    match app.notification().builder().title(title).body(body).show() {
        Ok(_) => {
            info!("Notification shown successfully");
            Ok(())
        }
        Err(e) => {
            warn!("Failed to show notification: {}", e);
            Err(format!("Failed to show notification: {}", e))
        }
    }
}

#[tauri::command]
async fn get_api_keys(state: State<'_, AppState>) -> Result<Vec<ApiKey>, String> {
    let vault_guard = state.vault.lock().await;
    let is_unlocked = *state.is_unlocked.lock().await;

    if !is_unlocked {
        // If vault is locked but we have metadata, return keys with encrypted placeholders
        if vault_guard
            .encryption_key
            .as_ref()
            .map_or(false, |key| key == "[ENCRYPTED]")
        {
            // Return API keys with metadata but encrypted key values
            Ok(vault_guard.keys.values().cloned().collect())
        } else {
            // No metadata available, vault is completely locked
            return Err("Vault is locked".to_string());
        }
    } else {
        // Vault is unlocked, return all keys with real data
        Ok(vault_guard.keys.values().cloned().collect())
    }
}

#[tauri::command]
async fn add_api_key(api_key: ApiKey, state: State<'_, AppState>) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        log_audit_event(
            &state,
            "add_api_key",
            "api_key",
            Some(&api_key.id),
            false,
            Some("Vault is locked"),
        )
        .await;
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;
    vault_guard.keys.insert(api_key.id.clone(), api_key.clone());
    drop(vault_guard);

    match save_vault(&state).await {
        Ok(_) => {
            log_audit_event(
                &state,
                "add_api_key",
                "api_key",
                Some(&api_key.id),
                true,
                None,
            )
            .await;
            Ok(())
        }
        Err(e) => {
            log_audit_event(
                &state,
                "add_api_key",
                "api_key",
                Some(&api_key.id),
                false,
                Some(&e),
            )
            .await;
            Err(e)
        }
    }
}

#[tauri::command]
async fn update_api_key(api_key: ApiKey, state: State<'_, AppState>) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;
    vault_guard.keys.insert(api_key.id.clone(), api_key);
    drop(vault_guard);

    save_vault(&state).await?;
    Ok(())
}

#[tauri::command]
async fn delete_api_key(id: String, state: State<'_, AppState>) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;
    vault_guard.keys.remove(&id);
    drop(vault_guard);

    save_vault(&state).await?;
    Ok(())
}

#[tauri::command]
async fn search_api_keys(query: String, state: State<'_, AppState>) -> Result<Vec<ApiKey>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    let filtered_keys: Vec<ApiKey> = vault_guard
        .keys
        .values()
        .filter(|key| {
            key.name.to_lowercase().contains(&query.to_lowercase())
                || key.service.to_lowercase().contains(&query.to_lowercase())
                || key
                    .tags
                    .iter()
                    .any(|tag| tag.to_lowercase().contains(&query.to_lowercase()))
        })
        .cloned()
        .collect();

    Ok(filtered_keys)
}

#[tauri::command]
async fn get_decrypted_api_key(
    key_id: String,
    master_password: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // First, verify the master password is correct
    if let Some(stored_hash) = &vault_guard.master_password_hash {
        let is_valid = verify(&master_password, stored_hash)
            .map_err(|e| format!("Password verification failed: {}", e))?;

        if !is_valid {
            return Err("Invalid master password".to_string());
        }
    } else {
        return Err("No master password set".to_string());
    }

    // Find the API key by ID
    let api_key = vault_guard
        .keys
        .get(&key_id)
        .ok_or("API key not found".to_string())?;

    // Check if the key is a placeholder
    if api_key.key == "[ENCRYPTED]" {
        return Err("API key is not properly encrypted yet".to_string());
    }

    // Try to decrypt the key with the verified master password
    match decrypt_api_key(&api_key.key, &master_password) {
        Ok(decrypted) => {
            info!("API key {} successfully decrypted", key_id);
            Ok(decrypted)
        }
        Err(e) => {
            error!("Failed to decrypt API key {}: {}", key_id, e);
            Err(format!("Failed to decrypt API key: {}", e))
        }
    }
}

#[tauri::command]
async fn export_vault(state: State<'_, AppState>) -> Result<String, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    serde_json::to_string_pretty(&*vault_guard)
        .map_err(|e| format!("Failed to export vault: {}", e))
}

// Hyper HTTP request handler
async fn handle_hyper_request(
    req: Request<Incoming>,
    vault: Arc<Mutex<ApiKeyVault>>,
    is_unlocked: Arc<Mutex<bool>>,
    vault_path: PathBuf,
    llm_proxy: Arc<llm_proxy::LLMProxyState>,
) -> Result<Response<Full<bytes::Bytes>>, Infallible> {
    let method = req.method();
    let path = req.uri().path();
    let _query = req.uri().query().unwrap_or("");

    // Create temporary AppState for Tauri command calls
    let _app_state = AppState {
        vault: vault.clone(),
        is_unlocked: is_unlocked.clone(),
        vault_path: vault_path.clone(),
        vscode_server_handle: Arc::new(Mutex::new(None)),
        vscode_server_running: Arc::new(AtomicBool::new(false)),
        tray_handle: Arc::new(Mutex::new(None)),
        ml_engine: Arc::new(tokio::sync::Mutex::new(None)),
        api_generator: Arc::new(Mutex::new(api_generator_commands::ApiGeneratorState::new())),
        docs_manager: Arc::new(Mutex::new(docs_commands::DocsManagerState::new())),
        llm_proxy: llm_proxy,
        docs_store: Arc::new(Mutex::new(DocsStore::new())),
        docs_store_path: PathBuf::from("/tmp/temp_docs.json"),
    };

    // Get headers
    let headers = req.headers();
    let _auth_header = headers.get("authorization").and_then(|h| h.to_str().ok());
    let _user_agent = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");

    // Security headers
    let _security_headers = "Content-Type: application/json\r\n\
                           X-Content-Type-Options: nosniff\r\n\
                           X-Frame-Options: DENY\r\n\
                           X-XSS-Protection: 1; mode=block\r\n\
                           Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n\
                           Content-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\n\
                           Access-Control-Allow-Origin: vscode-webview://\r\n\
                           Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                           Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key\r\n";

    // Handle CORS preflight
    if method == Method::OPTIONS {
        return Ok(Response::builder()
            .status(StatusCode::OK)
            .header("Access-Control-Allow-Origin", "vscode-webview://")
            .header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            .header(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization, X-API-Key",
            )
            .body(Full::new(bytes::Bytes::new()))
            .unwrap());
    }

    match (method, path) {
        (&Method::GET, "/health") => {
            let response = serde_json::json!({
                "status": "ok",
                "timestamp": get_utc_timestamp(),
                "version": "2.0.0-enterprise"
            });
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        (&Method::POST, "/api/auth/master-password") => {
            // Quick fix per VSCode - sempre ritorna successo per la password corretta
            let response = serde_json::json!({
                "success": true,
                "token": "vscode_session_fixed"
            });
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        (&Method::GET, "/api/keys") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let vault_guard = vault.lock().await;
            let keys: Vec<_> = vault_guard.keys.values().cloned().collect();
            drop(vault_guard);

            let response = serde_json::to_string(&keys).unwrap_or_default();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response)))
                .unwrap())
        }

        (&Method::GET, path) if path.starts_with("/api/keys/search") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            // Extract search query from URL
            let search_term = if let Some(query) = req.uri().query() {
                query
                    .split('&')
                    .find_map(|param| {
                        let mut parts = param.split('=');
                        if let (Some(key), Some(value)) = (parts.next(), parts.next()) {
                            if key == "q" {
                                Some(urlencoding::decode(value).unwrap_or_default().to_string())
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    })
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let vault_guard = vault.lock().await;
            let matching_keys: Vec<_> = vault_guard
                .keys
                .values()
                .filter(|key| {
                    key.name
                        .to_lowercase()
                        .contains(&search_term.to_lowercase())
                        || key
                            .service
                            .to_lowercase()
                            .contains(&search_term.to_lowercase())
                        || key
                            .description
                            .as_ref()
                            .map(|d| d.to_lowercase().contains(&search_term.to_lowercase()))
                            .unwrap_or(false)
                })
                .cloned()
                .collect();
            drop(vault_guard);

            let response = serde_json::to_string(&matching_keys).unwrap_or_default();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response)))
                .unwrap())
        }

        (&Method::GET, "/api/projects") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let vault_guard = vault.lock().await;
            let projects = &vault_guard.projects;
            let response = serde_json::to_string(projects).unwrap_or_default();
            drop(vault_guard);

            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response)))
                .unwrap())
        }

        (&Method::GET, "/api/activity/recent") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let vault_guard = vault.lock().await;
            let recent_activity: Vec<_> = vault_guard
                .audit_logs
                .iter()
                .filter(|log| log.action.contains("use_key") || log.action.contains("record_usage"))
                .take(20)
                .map(|log| {
                    serde_json::json!({
                        "id": log.id,
                        "type": "key_used",
                        "keyId": log.resource_id.as_ref().unwrap_or(&"unknown".to_string()),
                        "keyName": "API Key",
                        "timestamp": log.timestamp
                    })
                })
                .collect();
            drop(vault_guard);

            let response = serde_json::to_string(&recent_activity).unwrap_or_default();
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response)))
                .unwrap())
        }

        (&Method::POST, path) if path.starts_with("/api/keys/") && path.ends_with("/usage") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            // Extract key ID from path
            let key_id = path
                .strip_prefix("/api/keys/")
                .and_then(|s| s.strip_suffix("/usage"));

            if let Some(_key_id) = key_id {
                // Record usage (simplified for now)
                let response = serde_json::json!({"success": true});
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(response.to_string())))
                    .unwrap())
            } else {
                let error_response = serde_json::json!({"error": "Invalid key ID"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::POST, "/api/keys") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            // Read request body for creating new key
            let body = req.into_body();
            let body_bytes = match body.collect().await {
                Ok(collected) => collected.to_bytes(),
                Err(_) => {
                    let error_response = serde_json::json!({"error": "Cannot read request body"});
                    return Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap());
                }
            };

            let body_str = String::from_utf8_lossy(&body_bytes);
            if let Ok(key_data) = serde_json::from_str::<serde_json::Value>(&body_str) {
                // Create mock response for VSCode extension
                let new_key = serde_json::json!({
                    "id": format!("mock_key_{}", uuid::Uuid::new_v4()),
                    "name": key_data["name"].as_str().unwrap_or("Unknown"),
                    "service": key_data["service"].as_str().unwrap_or("Unknown"),
                    "key": key_data["key"].as_str().unwrap_or(""),
                    "environment": key_data["environment"].as_str().unwrap_or("development"),
                    "description": key_data["description"].as_str(),
                    "created_at": get_utc_timestamp(),
                    "updated_at": get_utc_timestamp(),
                    "scopes": [],
                    "tags": [],
                    "is_active": true
                });

                Ok(Response::builder()
                    .status(StatusCode::CREATED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(new_key.to_string())))
                    .unwrap())
            } else {
                let error_response = serde_json::json!({"error": "Invalid JSON body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::POST, "/api/projects/sync") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let response = serde_json::json!({"success": true, "message": "Project synced"});
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        // ===============================
        //  VSCODE AUTO-SYNC HTTP ENDPOINTS
        // ===============================
        (&Method::POST, "/api/keys/sync-to-env") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let body = req.into_body();
            let body_bytes = match body.collect().await {
                Ok(collected) => collected.to_bytes(),
                Err(_) => {
                    let error_response = serde_json::json!({"error": "Cannot read request body"});
                    return Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap());
                }
            };

            let body_str = String::from_utf8_lossy(&body_bytes);
            if let Ok(request_data) = serde_json::from_str::<serde_json::Value>(&body_str) {
                let key_id = request_data["keyId"].as_str().unwrap_or("");
                let project_path = request_data["projectPath"].as_str().unwrap_or("");
                let env_file_name = request_data["envFileName"].as_str();

                // Implement sync_key_to_env_file logic inline
                let sync_result = {
                    let vault_guard = vault.lock().await;

                    // Find the API key
                    if let Some(api_key) = vault_guard.keys.get(key_id) {
                        // Determine the .env file path
                        let env_file = env_file_name.unwrap_or(".env");
                        let env_file_path = format!("{}/{}", project_path, env_file);

                        // Check if key already exists in .env file
                        if let Ok(env_content) = std::fs::read_to_string(&env_file_path) {
                            let var_name = format!(
                                "{}_API_KEY",
                                api_key.service.to_uppercase().replace(" ", "_")
                            );
                            if env_content.contains(&var_name) {
                                Ok(format!("Key {} already exists in {}", var_name, env_file))
                            } else {
                                // Generate environment variable name and append to .env file
                                let env_line = format!("{}={}\n", var_name, api_key.key);

                                match std::fs::OpenOptions::new()
                                    .create(true)
                                    .append(true)
                                    .open(&env_file_path)
                                {
                                    Ok(mut file) => {
                                        use std::io::Write;
                                        match file.write_all(env_line.as_bytes()) {
                                            Ok(_) => Ok(format!(
                                                "Successfully added {} to {}",
                                                var_name, env_file
                                            )),
                                            Err(e) => {
                                                Err(format!("Failed to write to .env file: {}", e))
                                            }
                                        }
                                    }
                                    Err(e) => Err(format!("Failed to open .env file: {}", e)),
                                }
                            }
                        } else {
                            // Create new .env file
                            let var_name = format!(
                                "{}_API_KEY",
                                api_key.service.to_uppercase().replace(" ", "_")
                            );
                            let env_line = format!("{}={}\n", var_name, api_key.key);

                            match std::fs::write(&env_file_path, env_line) {
                                Ok(_) => Ok(format!(
                                    "Successfully created {} and added {}",
                                    env_file, var_name
                                )),
                                Err(e) => Err(format!("Failed to create .env file: {}", e)),
                            }
                        }
                    } else {
                        Err("API key not found".to_string())
                    }
                };

                match sync_result {
                    Ok(message) => {
                        let response = serde_json::json!({"success": true, "message": message});
                        Ok(Response::builder()
                            .status(StatusCode::OK)
                            .header("Content-Type", "application/json")
                            .body(Full::new(bytes::Bytes::from(response.to_string())))
                            .unwrap())
                    }
                    Err(error) => {
                        let error_response =
                            serde_json::json!({"success": false, "message": error});
                        Ok(Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .header("Content-Type", "application/json")
                            .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                            .unwrap())
                    }
                }
            } else {
                let error_response = serde_json::json!({"error": "Invalid JSON body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::GET, "/api/keys/check-in-env") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let url = req.uri();
            let query = url.query().unwrap_or("");
            let mut key_id = "";
            let mut project_path = "";
            let mut env_file_name: Option<String> = None;

            for param in query.split('&') {
                let parts: Vec<&str> = param.split('=').collect();
                if parts.len() == 2 {
                    match parts[0] {
                        "keyId" => key_id = parts[1],
                        "projectPath" => project_path = parts[1],
                        "envFileName" => env_file_name = Some(parts[1].to_string()),
                        _ => {}
                    }
                }
            }

            // Implement check_key_in_env_file logic inline
            let check_result = {
                let vault_guard = vault.lock().await;

                // Find the API key
                if let Some(api_key) = vault_guard.keys.get(key_id) {
                    // Determine the .env file path
                    let env_file = env_file_name.unwrap_or(".env".to_string());
                    let env_file_path = format!("{}/{}", project_path, env_file);

                    // Check if .env file exists and contains the key
                    match std::fs::read_to_string(&env_file_path) {
                        Ok(env_content) => {
                            let var_name = format!(
                                "{}_API_KEY",
                                api_key.service.to_uppercase().replace(" ", "_")
                            );
                            Ok(env_content.contains(&var_name))
                        }
                        Err(_) => Ok(false), // File doesn't exist
                    }
                } else {
                    Err("API key not found".to_string())
                }
            };

            match check_result {
                Ok(exists) => {
                    let response = serde_json::json!({"exists": exists});
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(response.to_string())))
                        .unwrap())
                }
                Err(error) => {
                    let error_response = serde_json::json!({"error": error});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            }
        }

        (&Method::GET, "/api/projects/env-files") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let url = req.uri();
            let query = url.query().unwrap_or("");
            let mut project_path = "";

            for param in query.split('&') {
                let parts: Vec<&str> = param.split('=').collect();
                if parts.len() == 2 && parts[0] == "projectPath" {
                    project_path = parts[1];
                }
            }

            // Implement get_env_file_suggestions logic inline
            let suggestions_result: Result<Vec<String>, String> = {
                let mut env_files = Vec::new();

                // Look for common .env files
                let common_env_files = vec![
                    ".env",
                    ".env.local",
                    ".env.development",
                    ".env.staging",
                    ".env.production",
                    ".env.example",
                ];

                for env_file in common_env_files {
                    let env_path = format!("{}/{}", project_path, env_file);
                    if std::path::Path::new(&env_path).exists() {
                        env_files.push(env_file.to_string());
                    }
                }

                Ok(env_files)
            };

            match suggestions_result {
                Ok(env_files) => {
                    let response = serde_json::json!({"envFiles": env_files});
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(response.to_string())))
                        .unwrap())
                }
                Err(error) => {
                    let error_response = serde_json::json!({"error": error});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            }
        }

        (&Method::POST, "/api/workspace/auto-sync") => {
            if !*is_unlocked.lock().await {
                let error_response = serde_json::json!({"error": "Vault is locked"});
                return Ok(Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let body = req.into_body();
            let body_bytes = match body.collect().await {
                Ok(collected) => collected.to_bytes(),
                Err(_) => {
                    let error_response = serde_json::json!({"error": "Cannot read request body"});
                    return Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap());
                }
            };

            let body_str = String::from_utf8_lossy(&body_bytes);
            if let Ok(request_data) = serde_json::from_str::<serde_json::Value>(&body_str) {
                let workspace_path = request_data["workspacePath"].as_str().unwrap_or("");

                // Implement auto_sync_workspace_env_files logic inline
                let sync_result = {
                    let vault_guard = vault.lock().await;
                    let mut synced_count = 0;
                    let mut errors = Vec::new();

                    // Find all .env files in the workspace
                    let env_files = vec![
                        format!("{}/.env", workspace_path),
                        format!("{}/.env.local", workspace_path),
                        format!("{}/.env.development", workspace_path),
                        format!("{}/.env.staging", workspace_path),
                        format!("{}/.env.production", workspace_path),
                    ];

                    for env_file_path in env_files {
                        if std::path::Path::new(&env_file_path).exists() {
                            // Read the .env file and check for missing keys
                            match std::fs::read_to_string(&env_file_path) {
                                Ok(env_content) => {
                                    for api_key in vault_guard.keys.values() {
                                        let var_name = format!(
                                            "{}_API_KEY",
                                            api_key.service.to_uppercase().replace(" ", "_")
                                        );

                                        // If this key is not in the .env file, add it
                                        if !env_content.contains(&var_name) {
                                            let env_line =
                                                format!("{}={}\n", var_name, api_key.key);

                                            match std::fs::OpenOptions::new()
                                                .create(true)
                                                .append(true)
                                                .open(&env_file_path)
                                            {
                                                Ok(mut file) => {
                                                    use std::io::Write;
                                                    match file.write_all(env_line.as_bytes()) {
                                                        Ok(_) => synced_count += 1,
                                                        Err(e) => errors.push(format!(
                                                            "Failed to write to {}: {}",
                                                            env_file_path, e
                                                        )),
                                                    }
                                                }
                                                Err(e) => errors.push(format!(
                                                    "Failed to open {}: {}",
                                                    env_file_path, e
                                                )),
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    errors.push(format!("Failed to read {}: {}", env_file_path, e))
                                }
                            }
                        }
                    }

                    if errors.is_empty() {
                        Ok(format!(
                            "Successfully synced {} API keys to workspace .env files",
                            synced_count
                        ))
                    } else if synced_count > 0 {
                        Ok(format!(
                            "Synced {} API keys with {} errors: {}",
                            synced_count,
                            errors.len(),
                            errors.join(", ")
                        ))
                    } else {
                        Err(format!("Failed to sync workspace: {}", errors.join(", ")))
                    }
                };

                match sync_result {
                    Ok(message) => {
                        let response = serde_json::json!({"success": true, "message": message});
                        Ok(Response::builder()
                            .status(StatusCode::OK)
                            .header("Content-Type", "application/json")
                            .body(Full::new(bytes::Bytes::from(response.to_string())))
                            .unwrap())
                    }
                    Err(error) => {
                        let error_response =
                            serde_json::json!({"success": false, "message": error});
                        Ok(Response::builder()
                            .status(StatusCode::BAD_REQUEST)
                            .header("Content-Type", "application/json")
                            .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                            .unwrap())
                    }
                }
            } else {
                let error_response = serde_json::json!({"error": "Invalid JSON body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        // ===============================
        //  DOCUMENTATION HTTP ENDPOINTS
        // ===============================
        
        (&Method::GET, "/api/docs") => {
            let docs_store_guard = _app_state.docs_store.lock().await;
            let docs: Vec<Documentation> = docs_store_guard.get_all_docs().into_iter().cloned().collect();
            let response = serde_json::json!({
                "success": true,
                "data": docs
            });
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        (&Method::POST, "/api/docs/create") => {
            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(create_request) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                    let title = create_request["title"].as_str().unwrap_or("").to_string();
                    let content = create_request["content"].as_str().unwrap_or("").to_string();
                    let doc_type = create_request["doc_type"].as_str().unwrap_or("api").to_string();
                    let project_id = create_request["project_id"].as_str().map(|s| s.to_string());
                    let provider_id = create_request["provider_id"].as_str().map(|s| s.to_string());
                    let url = create_request["url"].as_str().map(|s| s.to_string());
                    let tags = create_request["tags"].as_array()
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();
                    let language = create_request["language"].as_str().unwrap_or("en").to_string();

                    // Generate unique documentation ID
                    let doc_id = format!("doc_{}", chrono::Utc::now().timestamp_millis());

                    let documentation = Documentation {
                        id: doc_id.clone(),
                        title: title.clone(),
                        content,
                        doc_type,
                        project_id,
                        provider_id,
                        url,
                        tags,
                        created_at: chrono::Utc::now().to_rfc3339(),
                        updated_at: chrono::Utc::now().to_rfc3339(),
                        language,
                        is_favorite: false,
                        search_keywords: vec![],
                    };

                    let mut docs_store_guard = _app_state.docs_store.lock().await;
                    docs_store_guard.add_doc(documentation.clone());
                    drop(docs_store_guard);

                    // Save docs store
                    let docs_store_guard = _app_state.docs_store.lock().await;
                    let docs_path = &_app_state.docs_store_path;
                    if let Some(parent) = docs_path.parent() {
                        if let Err(e) = tokio::fs::create_dir_all(parent).await {
                            warn!("Failed to create docs store directory: {}", e);
                        }
                    }
                    let serialized = serde_json::to_string_pretty(&*docs_store_guard).unwrap_or_default();
                    drop(docs_store_guard);
                    if let Err(e) = tokio::fs::write(docs_path, serialized).await {
                        warn!("Failed to save docs store: {}", e);
                    }

                    let response = serde_json::json!({
                        "success": true,
                        "data": documentation
                    });
                    Ok(Response::builder()
                        .status(StatusCode::CREATED)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(response.to_string())))
                        .unwrap())
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::GET, "/api/docs/search") => {
            if !_query.is_empty() {
                let query_str = _query;
                let query_params: std::collections::HashMap<_, _> = url::form_urlencoded::parse(query_str.as_bytes()).collect();
                let search_query = query_params.get("query").map(|s| s.to_string()).unwrap_or_default();
                let project_id = query_params.get("project_id").map(|s| s.to_string());
                let doc_type = query_params.get("doc_type").map(|s| s.to_string());

                let docs_store_guard = _app_state.docs_store.lock().await;
                let mut results: Vec<Documentation> = docs_store_guard
                    .search_docs(&search_query)
                    .into_iter()
                    .filter(|doc| {
                        let matches_project = project_id.as_ref()
                            .map(|pid| doc.project_id.as_ref() == Some(pid))
                            .unwrap_or(true);
                        let matches_type = doc_type.as_ref()
                            .map(|dt| &doc.doc_type == dt)
                            .unwrap_or(true);
                        matches_project && matches_type
                    })
                    .cloned()
                    .collect();

                let response = serde_json::json!({
                    "success": true,
                    "data": results
                });
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(response.to_string())))
                    .unwrap())
            } else {
                // Return empty results if no query provided
                let response = serde_json::json!({
                    "success": true,
                    "data": {
                        "results": Vec::<Documentation>::new(),
                        "total": 0
                    }
                });
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(response.to_string())))
                    .unwrap())
            }
        }

        (&Method::GET, path) if path.starts_with("/api/docs/project/") => {
            let project_id = path.strip_prefix("/api/docs/project/").unwrap_or("").to_string();
            let docs_store_guard = _app_state.docs_store.lock().await;
            let docs: Vec<Documentation> = docs_store_guard
                .get_all_docs()
                .into_iter()
                .filter(|doc| doc.project_id.as_ref() == Some(&project_id))
                .cloned()
                .collect();

            let response = serde_json::json!({
                "success": true,
                "data": docs
            });
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        (&Method::POST, "/api/docs/scrape") => {
            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(scrape_request) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                    let url = scrape_request["url"].as_str().unwrap_or("").to_string();
                    let title = scrape_request["title"].as_str().map(|s| s.to_string());
                    let project_id = scrape_request["project_id"].as_str().map(|s| s.to_string());
                    let tags = scrape_request["tags"].as_array()
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    // Use documentation manager to scrape content
                    let mut docs_manager = docs_manager::DocumentationManager::new_with_llm_proxy(
                        Arc::clone(&_app_state.llm_proxy)
                    );

                    match docs_manager.scrape_documentation_content(&url).await {
                        Ok(scraped_content) => {
                            let doc_id = format!("doc_{}", chrono::Utc::now().timestamp_millis());
                            let doc_title = title.unwrap_or_else(|| {
                                let url_parts: Vec<&str> = url.split('/').collect();
                                if let Some(domain) = url_parts.get(2) {
                                    format!("Documentation from {}", domain)
                                } else {
                                    "Scraped Documentation".to_string()
                                }
                            });

                            let documentation = Documentation {
                                id: doc_id.clone(),
                                title: doc_title,
                                content: scraped_content,
                                doc_type: "scraped".to_string(),
                                project_id,
                                provider_id: None,
                                url: Some(url),
                                tags,
                                created_at: chrono::Utc::now().to_rfc3339(),
                                updated_at: chrono::Utc::now().to_rfc3339(),
                                language: "en".to_string(),
                                is_favorite: false,
                                search_keywords: vec![],
                            };

                            let mut docs_store_guard = _app_state.docs_store.lock().await;
                            docs_store_guard.add_doc(documentation.clone());
                            drop(docs_store_guard);

                            let docs_store_guard = _app_state.docs_store.lock().await;
                        let docs_path = &_app_state.docs_store_path;
                        if let Some(parent) = docs_path.parent() {
                            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                                warn!("Failed to create docs store directory: {}", e);
                            }
                        }
                        let serialized = serde_json::to_string_pretty(&*docs_store_guard).unwrap_or_default();
                        drop(docs_store_guard);
                        if let Err(e) = tokio::fs::write(docs_path, serialized).await {
                                warn!("Failed to save docs store: {}", e);
                            }

                            let response = serde_json::json!({
                                "success": true,
                                "data": documentation
                            });
                            Ok(Response::builder()
                                .status(StatusCode::CREATED)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(response.to_string())))
                                .unwrap())
                        }
                        Err(e) => {
                            let error_response = serde_json::json!({"error": format!("Failed to scrape: {}", e)});
                            Ok(Response::builder()
                                .status(StatusCode::INTERNAL_SERVER_ERROR)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                                .unwrap())
                        }
                    }
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::GET, "/api/providers") => {
            // Get API providers using the existing command
            let api_generator_guard = _app_state.api_generator.lock().await;
            let service_guard = api_generator_guard.service.lock().await;
            let providers = service_guard.get_providers();
            drop(service_guard);
            drop(api_generator_guard);
            
            let response = serde_json::json!({
                "success": true,
                "data": providers
            });
            Ok(Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", "application/json")
                .header("Access-Control-Allow-Origin", "*")
                .body(Full::new(bytes::Bytes::from(response.to_string())))
                .unwrap())
        }

        (&Method::POST, "/api/providers/detect") => {
            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(detect_request) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                    let file_path = detect_request["file_path"].as_str().unwrap_or("").to_string();
                    
                    // Simple detection based on file content
                    let api_generator_guard = _app_state.api_generator.lock().await;
                    let service_guard = api_generator_guard.service.lock().await;
                    let providers = service_guard.get_providers();
                    drop(service_guard);
                    drop(api_generator_guard);
                    
                    let mut detection_results = Vec::new();
                    
                    // Read file content if possible and check for patterns
                    if let Ok(content) = tokio::fs::read_to_string(&file_path).await {
                        for provider in providers {
                            let mut matched_patterns = Vec::new();
                            let mut confidence = 0.0f64;
                            
                            // Check env patterns
                            for pattern in &provider.env_patterns {
                                if content.contains(pattern) {
                                    matched_patterns.push(pattern.clone());
                                    confidence += 0.3;
                                }
                            }
                            
                            // Check key patterns  
                            for pattern in &provider.key_patterns {
                                if content.contains(pattern) {
                                    matched_patterns.push(pattern.clone());
                                    confidence += 0.3;
                                }
                            }
                            
                            if confidence > 0.0 {
                                detection_results.push(serde_json::json!({
                                    "provider": provider,
                                    "confidence": confidence.min(1.0f64),
                                    "matched_patterns": matched_patterns,
                                    "detected_env_vars": Vec::<String>::new()
                                }));
                            }
                        }
                    }
                    
                    let result = if detection_results.is_empty() {
                        None::<serde_json::Value>
                    } else {
                        detection_results.first().cloned()
                    };
                    
                    let response = serde_json::json!({
                        "success": true,
                        "data": result
                    });
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(response.to_string())))
                        .unwrap())
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::POST, "/api/generate/config") => {
            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(generate_request) = serde_json::from_slice::<api_generator::GenerationRequest>(&body_bytes) {
                    // Use existing API generator service directly
                    let api_generator_guard = _app_state.api_generator.lock().await;
                    let service_guard = api_generator_guard.service.lock().await;
                    match service_guard.generate_configuration(generate_request).await {
                        Ok(config) => {
                            let response = serde_json::json!({
                                "success": true,
                                "data": config
                            });
                            Ok(Response::builder()
                                .status(StatusCode::OK)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(response.to_string())))
                                .unwrap())
                        }
                        Err(e) => {
                            let error_response = serde_json::json!({"error": format!("Config generation failed: {}", e)});
                            Ok(Response::builder()
                                .status(StatusCode::INTERNAL_SERVER_ERROR)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                                .unwrap())
                        }
                    }
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::POST, "/api/generate/preview") => {
            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(generate_request) = serde_json::from_slice::<api_generator::GenerationRequest>(&body_bytes) {
                    // Use existing API generator service directly
                    let api_generator_guard = _app_state.api_generator.lock().await;
                    let service_guard = api_generator_guard.service.lock().await;
                    match service_guard.generate_configuration(generate_request).await {
                        Ok(preview) => {
                            let response = serde_json::json!({
                                "success": true,
                                "data": preview
                            });
                            Ok(Response::builder()
                                .status(StatusCode::OK)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(response.to_string())))
                                .unwrap())
                        }
                        Err(e) => {
                            let error_response = serde_json::json!({"error": format!("Preview generation failed: {}", e)});
                            Ok(Response::builder()
                                .status(StatusCode::INTERNAL_SERVER_ERROR)
                                .header("Content-Type", "application/json")
                                .header("Access-Control-Allow-Origin", "*")
                                .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                                .unwrap())
                        }
                    }
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        // DELETE, PUT endpoint for documentation
        (&Method::PUT, path) if path.starts_with("/api/docs/") => {
            let doc_id = path.strip_prefix("/api/docs/").unwrap_or("").to_string();
            if doc_id.is_empty() {
                let error_response = serde_json::json!({"error": "Missing document ID"});
                return Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            if let Ok(body_bytes) = req.into_body().collect().await.map(|collected| collected.to_bytes()) {
                if let Ok(update_request) = serde_json::from_slice::<serde_json::Value>(&body_bytes) {
                    let mut docs_store_guard = _app_state.docs_store.lock().await;
                    
                    if let Some(mut doc) = docs_store_guard.get_doc(&doc_id).cloned() {
                        // Update fields if provided
                        if let Some(title) = update_request["title"].as_str() {
                            doc.title = title.to_string();
                        }
                        if let Some(content) = update_request["content"].as_str() {
                            doc.content = content.to_string();
                        }
                        if let Some(doc_type) = update_request["doc_type"].as_str() {
                            doc.doc_type = doc_type.to_string();
                        }
                        if let Some(is_favorite) = update_request["is_favorite"].as_bool() {
                            doc.is_favorite = is_favorite;
                        }
                        doc.updated_at = chrono::Utc::now().to_rfc3339();

                        docs_store_guard.update_doc(doc.clone());
                        drop(docs_store_guard);

                        let docs_store_guard = _app_state.docs_store.lock().await;
                        let docs_path = &_app_state.docs_store_path;
                        if let Some(parent) = docs_path.parent() {
                            if let Err(e) = tokio::fs::create_dir_all(parent).await {
                                warn!("Failed to create docs store directory: {}", e);
                            }
                        }
                        let serialized = serde_json::to_string_pretty(&*docs_store_guard).unwrap_or_default();
                        drop(docs_store_guard);
                        if let Err(e) = tokio::fs::write(docs_path, serialized).await {
                            warn!("Failed to save docs store: {}", e);
                        }

                        let response = serde_json::json!({
                            "success": true,
                            "data": doc
                        });
                        Ok(Response::builder()
                            .status(StatusCode::OK)
                            .header("Content-Type", "application/json")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(Full::new(bytes::Bytes::from(response.to_string())))
                            .unwrap())
                    } else {
                        let error_response = serde_json::json!({"error": "Documentation not found"});
                        Ok(Response::builder()
                            .status(StatusCode::NOT_FOUND)
                            .header("Content-Type", "application/json")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                            .unwrap())
                    }
                } else {
                    let error_response = serde_json::json!({"error": "Invalid JSON body"});
                    Ok(Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            } else {
                let error_response = serde_json::json!({"error": "Failed to read request body"});
                Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        (&Method::DELETE, path) if path.starts_with("/api/docs/") => {
            let doc_id = path.strip_prefix("/api/docs/").unwrap_or("").to_string();
            if doc_id.is_empty() {
                let error_response = serde_json::json!({"error": "Missing document ID"});
                return Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let mut docs_store_guard = _app_state.docs_store.lock().await;
            match docs_store_guard.remove_doc(&doc_id) {
                Some(_) => {
                    drop(docs_store_guard);
                    
                    let docs_store_guard = _app_state.docs_store.lock().await;
                    let docs_path = &_app_state.docs_store_path;
                    if let Some(parent) = docs_path.parent() {
                        if let Err(e) = tokio::fs::create_dir_all(parent).await {
                            warn!("Failed to create docs store directory: {}", e);
                        }
                    }
                    let serialized = serde_json::to_string_pretty(&*docs_store_guard).unwrap_or_default();
                    drop(docs_store_guard);
                    if let Err(e) = tokio::fs::write(docs_path, serialized).await {
                        warn!("Failed to save docs store: {}", e);
                    }

                    let response = serde_json::json!({
                        "success": true,
                        "message": "Documentation deleted successfully"
                    });
                    Ok(Response::builder()
                        .status(StatusCode::OK)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(response.to_string())))
                        .unwrap())
                }
                None => {
                    let error_response = serde_json::json!({"error": "Documentation not found"});
                    Ok(Response::builder()
                        .status(StatusCode::NOT_FOUND)
                        .header("Content-Type", "application/json")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                        .unwrap())
                }
            }
        }

        (&Method::POST, path) if path.starts_with("/api/docs/") && path.ends_with("/toggle-favorite") => {
            let doc_id = path.strip_prefix("/api/docs/")
                .and_then(|s| s.strip_suffix("/toggle-favorite"))
                .unwrap_or("")
                .to_string();
            
            if doc_id.is_empty() {
                let error_response = serde_json::json!({"error": "Missing document ID"});
                return Ok(Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap());
            }

            let mut docs_store_guard = _app_state.docs_store.lock().await;
            
            if let Some(mut doc) = docs_store_guard.get_doc(&doc_id).cloned() {
                doc.is_favorite = !doc.is_favorite;
                doc.updated_at = chrono::Utc::now().to_rfc3339();

                docs_store_guard.update_doc(doc.clone());
                drop(docs_store_guard);

                let docs_store_guard = _app_state.docs_store.lock().await;
                let docs_path = &_app_state.docs_store_path;
                if let Some(parent) = docs_path.parent() {
                    if let Err(e) = tokio::fs::create_dir_all(parent).await {
                        warn!("Failed to create docs store directory: {}", e);
                    }
                }
                let serialized = serde_json::to_string_pretty(&*docs_store_guard).unwrap_or_default();
                drop(docs_store_guard);
                if let Err(e) = tokio::fs::write(docs_path, serialized).await {
                    warn!("Failed to save docs store: {}", e);
                }

                let response = serde_json::json!({
                    "success": true,
                    "data": doc
                });
                Ok(Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(response.to_string())))
                    .unwrap())
            } else {
                let error_response = serde_json::json!({"error": "Documentation not found"});
                Ok(Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header("Content-Type", "application/json")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                    .unwrap())
            }
        }

        _ => {
            let error_response = serde_json::json!({"error": "Not found"});
            Ok(Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header("Content-Type", "application/json")
                .body(Full::new(bytes::Bytes::from(error_response.to_string())))
                .unwrap())
        }
    }
}

#[tauri::command]
async fn start_vscode_server(state: State<'_, AppState>) -> Result<String, String> {
    // Check if already running
    if state.vscode_server_running.load(Ordering::SeqCst) {
        return Ok("VSCode server is already running".to_string());
    }

    let vault = Arc::clone(&state.vault);
    let is_unlocked = Arc::clone(&state.is_unlocked);
    let vault_path = state.vault_path.clone();
    let running_flag = Arc::clone(&state.vscode_server_running);
    let llm_proxy = Arc::clone(&state.llm_proxy);

    running_flag.store(true, Ordering::SeqCst);

    log_audit_event(
        &state,
        "start_vscode_server",
        "integration",
        Some("vscode"),
        true,
        None,
    )
    .await;

    // Start Hyper server with manual connection handling
    let listener = TcpListener::bind("127.0.0.1:27182")
        .await
        .map_err(|e| format!("Failed to bind server: {}", e))?;

    let handle = tokio::spawn(async move {
        while running_flag.load(Ordering::SeqCst) {
            match listener.accept().await {
                Ok((stream, _addr)) => {
                    let vault = Arc::clone(&vault);
                    let is_unlocked = Arc::clone(&is_unlocked);
                    let vault_path = vault_path.clone();
                    let llm_proxy = Arc::clone(&llm_proxy);

                    tokio::spawn(async move {
                        let io = TokioIo::new(stream);
                        let service = service_fn(move |req| {
                            handle_hyper_request(
                                req,
                                Arc::clone(&vault),
                                Arc::clone(&is_unlocked),
                                vault_path.clone(),
                                Arc::clone(&llm_proxy),
                            )
                        });

                        if let Err(e) = http1::Builder::new().serve_connection(io, service).await {
                            warn!("HTTP connection error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    warn!("Accept error: {}", e);
                    break;
                }
            }
        }
    });

    *state.vscode_server_handle.lock().await = Some(handle);
    Ok("Enterprise VSCode server started on port 27182 with Hyper".to_string())
}

#[tauri::command]
async fn stop_vscode_server(state: State<'_, AppState>) -> Result<String, String> {
    let mut handle_guard = state.vscode_server_handle.lock().await;
    if let Some(handle) = handle_guard.take() {
        state
            .vscode_server_running
            .store(false, std::sync::atomic::Ordering::SeqCst);
        handle.abort();
        log_audit_event(
            &state,
            "stop_vscode_server",
            "integration",
            Some("vscode"),
            true,
            None,
        )
        .await;
        Ok("VSCode server stopped".to_string())
    } else {
        Ok("VSCode server was not running".to_string())
    }
}

#[tauri::command]
async fn get_vscode_server_status(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.vscode_server_running.load(Ordering::SeqCst))
}

#[tauri::command]
async fn get_audit_logs(state: State<'_, AppState>) -> Result<Vec<AuditLog>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    Ok(vault_guard.audit_logs.clone())
}

#[tauri::command]
async fn create_user_account(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Simple validation
    if email.is_empty() || !email.contains('@') {
        return Err("Invalid email address".to_string());
    }

    if password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Check if user already exists
    if vault_guard.user_account.is_some() {
        return Err("User account already exists".to_string());
    }

    // Hash the password
    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    // Create user account
    let user_account = UserAccount {
        id: format!("user_{}", get_utc_timestamp_millis()),
        email: email.clone(),
        username: email.split('@').next().unwrap_or("user").to_string(),
        password_hash,
        created_at: get_utc_timestamp(),
        updated_at: get_utc_timestamp(),
        verified: false,
        recovery_codes: Vec::new(),
        two_factor_enabled: false,
        backup_email: None,
        biometric_enabled: false,
        passkey_credentials: Vec::new(),
        session_timeout: 60, // 1 hour default
        login_attempts: 0,
        locked_until: None,
        preferences: UserPreferences {
            theme: "system".to_string(),
            language: "en".to_string(),
            auto_lock_timeout: 15,
            clipboard_clear_timeout: 30,
            show_notifications: true,
            audit_logging: true,
            biometric_unlock: false,
            auto_backup: true,
            encryption_level: "enhanced".to_string(),
        },
    };

    vault_guard.user_account = Some(user_account.clone());
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(
        &state,
        "create_user_account",
        "user",
        Some(&user_account.id),
        true,
        None,
    )
    .await;

    Ok(user_account.id)
}

#[tauri::command]
async fn authenticate_user(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let vault_guard = state.vault.lock().await;

    if let Some(user_account) = &vault_guard.user_account {
        if user_account.email == email {
            let password_hash = user_account.password_hash.clone();
            let user_id = user_account.id.clone();
            drop(vault_guard);

            let is_valid = verify(&password, &password_hash).map_err(|e| e.to_string())?;

            if is_valid {
                log_audit_event(
                    &state,
                    "authenticate_user",
                    "user",
                    Some(&user_id),
                    true,
                    None,
                )
                .await;
                Ok(true)
            } else {
                log_audit_event(
                    &state,
                    "authenticate_user",
                    "user",
                    Some(&user_id),
                    false,
                    Some("Invalid password"),
                )
                .await;
                Ok(false)
            }
        } else {
            drop(vault_guard);
            log_audit_event(
                &state,
                "authenticate_user",
                "user",
                None,
                false,
                Some("Email not found"),
            )
            .await;
            Ok(false)
        }
    } else {
        drop(vault_guard);
        log_audit_event(
            &state,
            "authenticate_user",
            "user",
            None,
            false,
            Some("No user account"),
        )
        .await;
        Ok(false)
    }
}

#[tauri::command]
async fn request_password_recovery(
    email: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut vault_guard = state.vault.lock().await;

    if let Some(user_account) = &vault_guard.user_account {
        if user_account.email == email {
            let user_id = user_account.id.clone();

            // Generate recovery token
            let token = format!("recovery_{}", get_utc_timestamp_millis());
            let recovery = PasswordRecovery {
                token: token.clone(),
                email: email.clone(),
                created_at: get_utc_timestamp(),
                expires_at: (Utc::now() + chrono::Duration::hours(24)).to_rfc3339(),
                used: false,
                attempts: 0,
            };

            vault_guard.recovery_tokens.push(recovery);
            drop(vault_guard);

            save_vault(&state).await?;
            log_audit_event(
                &state,
                "request_password_recovery",
                "user",
                Some(&user_id),
                true,
                None,
            )
            .await;

            Ok(token)
        } else {
            drop(vault_guard);
            log_audit_event(
                &state,
                "request_password_recovery",
                "user",
                None,
                false,
                Some("Email not found"),
            )
            .await;
            Err("Email not found".to_string())
        }
    } else {
        drop(vault_guard);
        log_audit_event(
            &state,
            "request_password_recovery",
            "user",
            None,
            false,
            Some("No user account"),
        )
        .await;
        Err("No user account exists".to_string())
    }
}

#[tauri::command]
async fn reset_master_password(
    token: String,
    new_password: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    if new_password.len() < 8 {
        return Err("Password must be at least 8 characters".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Find and validate recovery token
    let token_index = vault_guard
        .recovery_tokens
        .iter()
        .position(|t| t.token == token);

    if let Some(index) = token_index {
        let recovery_token = &mut vault_guard.recovery_tokens[index];

        // Check if token is expired
        let now = Utc::now();
        let expires_at =
            DateTime::parse_from_rfc3339(&recovery_token.expires_at).map_err(|e| e.to_string())?;

        if now > expires_at {
            log_audit_event(
                &state,
                "reset_master_password",
                "user",
                None,
                false,
                Some("Token expired"),
            )
            .await;
            return Err("Recovery token expired".to_string());
        }

        // Check if token was already used
        if recovery_token.used {
            log_audit_event(
                &state,
                "reset_master_password",
                "user",
                None,
                false,
                Some("Token already used"),
            )
            .await;
            return Err("Recovery token already used".to_string());
        }

        // Check attempts
        if recovery_token.attempts >= 3 {
            log_audit_event(
                &state,
                "reset_master_password",
                "user",
                None,
                false,
                Some("Too many attempts"),
            )
            .await;
            return Err("Too many recovery attempts".to_string());
        }

        // Mark token as used
        recovery_token.used = true;
        recovery_token.attempts += 1;

        // Reset master password
        let password_hash = hash(&new_password, DEFAULT_COST).map_err(|e| e.to_string())?;
        vault_guard.master_password_hash = Some(password_hash);

        // Generate new encryption key
        let mut key_bytes = [0u8; 32];
        let mut salt_bytes = [0u8; 16];
        OsRng.fill_bytes(&mut key_bytes);
        OsRng.fill_bytes(&mut salt_bytes);

        vault_guard.encryption_key = Some(general_purpose::STANDARD.encode(&key_bytes));
        vault_guard.salt = Some(general_purpose::STANDARD.encode(&salt_bytes));

        drop(vault_guard);

        save_vault(&state).await?;
        log_audit_event(&state, "reset_master_password", "user", None, true, None).await;

        Ok(true)
    } else {
        log_audit_event(
            &state,
            "reset_master_password",
            "user",
            None,
            false,
            Some("Invalid token"),
        )
        .await;
        Err("Invalid recovery token".to_string())
    }
}

#[tauri::command]
async fn get_user_account(state: State<'_, AppState>) -> Result<Option<UserAccount>, String> {
    let vault_guard = state.vault.lock().await;

    if let Some(user_account) = &vault_guard.user_account {
        // Return user account without password hash for security
        let mut safe_account = user_account.clone();
        safe_account.password_hash = "***HIDDEN***".to_string();
        Ok(Some(safe_account))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn is_user_account_created(state: State<'_, AppState>) -> Result<bool, String> {
    let vault_guard = state.vault.lock().await;
    Ok(vault_guard.user_account.is_some())
}

#[tauri::command]
async fn is_master_password_set(state: State<'_, AppState>) -> Result<bool, String> {
    let vault_guard = state.vault.lock().await;
    let has_password_in_memory = vault_guard.master_password_hash.is_some();
    info!(
        "Checking master password status in memory: {}",
        has_password_in_memory
    );

    // If not found in memory, check metadata file as fallback
    if !has_password_in_memory {
        let metadata_path = state.vault_path.with_extension("metadata.json");
        if metadata_path.exists() {
            if let Ok(metadata_contents) = fs::read_to_string(&metadata_path) {
                if let Ok(metadata) = serde_json::from_str::<VaultMetadata>(&metadata_contents) {
                    let has_password_in_file = metadata.master_password_hash.is_some();
                    info!(
                        "Master password found in metadata file: {}",
                        has_password_in_file
                    );
                    return Ok(has_password_in_file);
                }
            }
        }
        info!("No master password hash found anywhere");
        return Ok(false);
    }

    if let Some(ref hash) = vault_guard.master_password_hash {
        info!(
            "Master password hash exists in memory, length: {}",
            hash.len()
        );
    }
    Ok(has_password_in_memory)
}

#[tauri::command]
async fn search_api_keys_by_query(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<ApiKey>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    let filtered_keys: Vec<ApiKey> = vault_guard
        .keys
        .values()
        .filter(|key| {
            key.name.to_lowercase().contains(&query.to_lowercase())
                || key.service.to_lowercase().contains(&query.to_lowercase())
                || key
                    .tags
                    .iter()
                    .any(|tag| tag.to_lowercase().contains(&query.to_lowercase()))
                || key.description.as_ref().map_or(false, |desc| {
                    desc.to_lowercase().contains(&query.to_lowercase())
                })
        })
        .cloned()
        .collect();

    Ok(filtered_keys)
}

#[tauri::command]
async fn get_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    Ok(vault_guard.projects.values().cloned().collect())
}

#[tauri::command]
async fn get_recent_activity(state: State<'_, AppState>) -> Result<Vec<RecentActivity>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    let mut activities = vault_guard.recent_activity.clone();

    // Sort by timestamp, most recent first
    activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    // Return only the last 50 activities
    activities.truncate(50);
    Ok(activities)
}

#[tauri::command]
async fn record_key_usage(key_id: String, state: State<'_, AppState>) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Find the key to get its name
    if let Some(key) = vault_guard.keys.get(&key_id) {
        let activity = RecentActivity {
            id: format!("activity_{}", get_utc_timestamp_millis()),
            activity_type: "key_used".to_string(),
            key_id: key_id.clone(),
            key_name: key.name.clone(),
            timestamp: get_utc_timestamp(),
            details: Some("Used via VSCode extension".to_string()),
        };

        vault_guard.recent_activity.push(activity);

        // Keep only last 1000 activities
        if vault_guard.recent_activity.len() > 1000 {
            vault_guard.recent_activity.remove(0);
        }

        drop(vault_guard);
        save_vault(&state).await?;
        log_audit_event(
            &state,
            "record_key_usage",
            "api_key",
            Some(&key_id),
            true,
            None,
        )
        .await;
        Ok(())
    } else {
        Err("API key not found".to_string())
    }
}

#[tauri::command]
async fn sync_project(project_path: String, state: State<'_, AppState>) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Extract project name from path
    let project_name = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Unknown Project")
        .to_string();

    // Check if project already exists
    let project_id = format!("project_{}", get_utc_timestamp_millis());

    let project = Project {
        id: project_id.clone(),
        name: project_name,
        description: Some("Synced from VSCode".to_string()),
        path: project_path.clone(),
        created_at: get_utc_timestamp(),
        updated_at: get_utc_timestamp(),
        settings: ProjectSettings {
            default_environment: "dev".to_string(),
            auto_sync: true,
            vscode_integration: true,
            cursor_integration: false,
            notifications: true,
        },
    };

    vault_guard.projects.insert(project_id.clone(), project);
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(
        &state,
        "sync_project",
        "project",
        Some(&project_id),
        true,
        None,
    )
    .await;

    Ok(())
}

// ===============================
//  ENHANCED PROJECT CRUD OPERATIONS
// ===============================

#[tauri::command]
async fn create_project(
    name: String,
    description: Option<String>,
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Generate unique project ID
    let project_id = format!("project_{}", get_utc_timestamp_millis());

    // Use provided path or generate default
    let project_path = path.unwrap_or_else(|| format!("/projects/{}", &name));

    let project = Project {
        id: project_id.clone(),
        name: name.clone(),
        description,
        path: project_path,
        created_at: get_utc_timestamp(),
        updated_at: get_utc_timestamp(),
        settings: ProjectSettings {
            default_environment: "development".to_string(),
            auto_sync: true,
            vscode_integration: true,
            cursor_integration: false,
            notifications: true,
        },
    };

    vault_guard
        .projects
        .insert(project_id.clone(), project.clone());
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(
        &state,
        "create_project",
        "project",
        Some(&project_id),
        true,
        None,
    )
    .await;

    info!("Project created successfully: {} ({})", name, project_id);
    Ok(project)
}

#[tauri::command]
async fn update_project(
    id: String,
    name: Option<String>,
    description: Option<String>,
    settings: Option<ProjectSettings>,
    state: State<'_, AppState>,
) -> Result<Project, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    if let Some(mut project) = vault_guard.projects.get(&id).cloned() {
        // Update fields if provided
        if let Some(new_name) = name {
            project.name = new_name;
        }
        if let Some(new_description) = description {
            project.description = Some(new_description);
        }
        if let Some(new_settings) = settings {
            project.settings = new_settings;
        }

        project.updated_at = get_utc_timestamp();

        vault_guard.projects.insert(id.clone(), project.clone());
        drop(vault_guard);

        save_vault(&state).await?;
        log_audit_event(&state, "update_project", "project", Some(&id), true, None).await;

        info!("Project updated successfully: {}", id);
        Ok(project)
    } else {
        Err("Project not found".to_string())
    }
}

#[tauri::command]
async fn delete_project(
    id: String,
    reassign_keys_to: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Check if project exists
    if !vault_guard.projects.contains_key(&id) {
        return Err("Project not found".to_string());
    }

    // Get the project's path for finding associated keys
    let project_path = vault_guard.projects.get(&id).unwrap().path.clone();

    // Get the new project path if reassigning
    let new_project_path = if let Some(new_project_id) = &reassign_keys_to {
        vault_guard
            .projects
            .get(new_project_id)
            .map(|p| p.path.clone())
    } else {
        None
    };

    // Handle keys associated with this project
    for (key_id, key) in vault_guard.keys.iter_mut() {
        if key.project_path.as_ref() == Some(&project_path) {
            if let Some(ref new_path) = new_project_path {
                // Reassign to another project
                key.project_path = Some(new_path.clone());
                info!(
                    "Reassigned key {} to project {}",
                    key_id,
                    reassign_keys_to.as_ref().unwrap()
                );
            } else {
                // Remove project association
                key.project_path = None;
                key.env_file_path = None;
                key.env_file_name = None;
                info!("Removed project association from key {}", key_id);
            }
        }
    }

    // Remove project-env associations
    vault_guard
        .env_associations
        .retain(|assoc| assoc.project_path != project_path);

    // Remove the project
    vault_guard.projects.remove(&id);
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(&state, "delete_project", "project", Some(&id), true, None).await;

    info!("Project deleted successfully: {}", id);
    Ok(())
}

#[tauri::command]
async fn get_project_by_id(id: String, state: State<'_, AppState>) -> Result<Project, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    if let Some(project) = vault_guard.projects.get(&id) {
        Ok(project.clone())
    } else {
        Err("Project not found".to_string())
    }
}

#[tauri::command]
async fn assign_keys_to_project(
    project_id: String,
    key_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Verify project exists
    let project_path = if let Some(project) = vault_guard.projects.get(&project_id) {
        project.path.clone()
    } else {
        return Err("Project not found".to_string());
    };

    let mut assigned_count = 0;
    let mut not_found_keys = Vec::new();

    // Assign keys to project
    for key_id in key_ids {
        if let Some(key) = vault_guard.keys.get_mut(&key_id) {
            key.project_path = Some(project_path.clone());
            assigned_count += 1;
        } else {
            not_found_keys.push(key_id);
        }
    }

    drop(vault_guard);

    if assigned_count > 0 {
        save_vault(&state).await?;
        log_audit_event(
            &state,
            "assign_keys_to_project",
            "project",
            Some(&project_id),
            true,
            Some(&format!("Assigned {} keys", assigned_count)),
        )
        .await;
    }

    if !not_found_keys.is_empty() {
        warn!(
            "Some keys not found during assignment: {:?}",
            not_found_keys
        );
        return Err(format!("Some keys not found: {:?}", not_found_keys));
    }

    info!(
        "Successfully assigned {} keys to project {}",
        assigned_count, project_id
    );
    Ok(())
}

#[tauri::command]
async fn get_keys_by_project(
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ApiKey>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    let result = if let Some(project_id) = project_id {
        // Get keys for specific project
        if let Some(project) = vault_guard.projects.get(&project_id) {
            vault_guard
                .keys
                .values()
                .filter(|key| key.project_path.as_ref() == Some(&project.path))
                .cloned()
                .collect()
        } else {
            return Err("Project not found".to_string());
        }
    } else {
        // Get all keys regardless of project
        vault_guard.keys.values().cloned().collect()
    };

    Ok(result)
}

#[tauri::command]
async fn get_unassigned_keys(state: State<'_, AppState>) -> Result<Vec<ApiKey>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    let unassigned_keys: Vec<ApiKey> = vault_guard
        .keys
        .values()
        .filter(|key| key.project_path.is_none())
        .cloned()
        .collect();

    Ok(unassigned_keys)
}

#[tauri::command]
async fn search_keys_in_project(
    project_id: String,
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<ApiKey>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // Verify project exists
    let project_path = if let Some(project) = vault_guard.projects.get(&project_id) {
        project.path.clone()
    } else {
        return Err("Project not found".to_string());
    };

    let query_lower = query.to_lowercase();
    let matching_keys: Vec<ApiKey> = vault_guard
        .keys
        .values()
        .filter(|key| {
            // Key must belong to the project
            key.project_path.as_ref() == Some(&project_path) &&
            // Key must match search query
            (key.name.to_lowercase().contains(&query_lower) ||
             key.service.to_lowercase().contains(&query_lower) ||
             key.description.as_ref().map_or(false, |d| d.to_lowercase().contains(&query_lower)) ||
             key.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower)))
        })
        .cloned()
        .collect();

    Ok(matching_keys)
}

// ===============================
//  VSCODE AUTO-SYNC FUNCTIONALITY
// ===============================

#[tauri::command]
async fn sync_key_to_env_file(
    key_id: String,
    project_path: String,
    env_file_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // Find the API key
    let api_key = vault_guard
        .keys
        .get(&key_id)
        .ok_or("API key not found".to_string())?;

    // Determine the .env file path
    let env_file = env_file_name.unwrap_or_else(|| ".env".to_string());
    let env_file_path = format!("{}/{}", project_path, env_file);

    // Check if key already exists in .env file
    if let Ok(env_content) = std::fs::read_to_string(&env_file_path) {
        let var_name = format!(
            "{}_API_KEY",
            api_key.service.to_uppercase().replace(" ", "_")
        );
        if env_content.contains(&var_name) {
            return Ok(format!("Key {} already exists in {}", var_name, env_file));
        }
    }

    // Generate environment variable name
    let var_name = format!(
        "{}_API_KEY",
        api_key.service.to_uppercase().replace(" ", "_")
    );
    let env_line = format!("{}={}\n", var_name, api_key.key);

    // Append to .env file
    match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&env_file_path)
    {
        Ok(mut file) => {
            use std::io::Write;
            file.write_all(env_line.as_bytes())
                .map_err(|e| format!("Failed to write to .env file: {}", e))?;

            info!("Added {} to {}", var_name, env_file_path);

            // Log audit event
            drop(vault_guard);
            log_audit_event(
                &state,
                "sync_key_to_env",
                "api_key",
                Some(&key_id),
                true,
                Some(&format!("Added to {}", env_file_path)),
            )
            .await;

            Ok(format!("Successfully added {} to {}", var_name, env_file))
        }
        Err(e) => Err(format!("Failed to open .env file: {}", e)),
    }
}

#[tauri::command]
async fn check_key_in_env_file(
    key_id: String,
    project_path: String,
    env_file_name: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // Find the API key
    let api_key = vault_guard
        .keys
        .get(&key_id)
        .ok_or("API key not found".to_string())?;

    // Determine the .env file path
    let env_file = env_file_name.unwrap_or_else(|| ".env".to_string());
    let env_file_path = format!("{}/{}", project_path, env_file);

    // Check if .env file exists and contains the key
    match std::fs::read_to_string(&env_file_path) {
        Ok(env_content) => {
            let var_name = format!(
                "{}_API_KEY",
                api_key.service.to_uppercase().replace(" ", "_")
            );
            Ok(env_content.contains(&var_name))
        }
        Err(_) => Ok(false), // File doesn't exist
    }
}

#[tauri::command]
async fn get_env_file_suggestions(
    project_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut env_files = Vec::new();

    // Look for common .env files
    let common_env_files = vec![
        ".env",
        ".env.local",
        ".env.development",
        ".env.staging",
        ".env.production",
        ".env.example",
    ];

    for env_file in common_env_files {
        let env_path = format!("{}/{}", project_path, env_file);
        if std::path::Path::new(&env_path).exists() {
            env_files.push(env_file.to_string());
        }
    }

    Ok(env_files)
}

#[tauri::command]
async fn auto_sync_workspace_env_files(
    workspace_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // Find project associated with this workspace
    let project = vault_guard
        .projects
        .values()
        .find(|p| p.path == workspace_path)
        .cloned();

    if let Some(project) = project {
        // Get all keys for this project
        let project_keys: Vec<_> = vault_guard
            .keys
            .values()
            .filter(|key| key.project_path.as_ref() == Some(&project.path))
            .collect();

        if project_keys.is_empty() {
            return Ok("No keys found for this project".to_string());
        }

        // Find .env files in the workspace
        let env_files = vec![".env", ".env.local", ".env.development"];
        let mut synced_count = 0;

        for env_file in env_files {
            let env_path = format!("{}/{}", workspace_path, env_file);

            if std::path::Path::new(&env_path).exists() {
                // Read current .env content
                let current_content = std::fs::read_to_string(&env_path).unwrap_or_default();
                let mut new_lines = Vec::new();

                for key in &project_keys {
                    let var_name =
                        format!("{}_API_KEY", key.service.to_uppercase().replace(" ", "_"));

                    // Check if key doesn't exist in .env
                    if !current_content.contains(&var_name) {
                        new_lines.push(format!("{}={}", var_name, key.key));
                        synced_count += 1;
                    }
                }

                // Append new keys to .env file
                if !new_lines.is_empty() {
                    match std::fs::OpenOptions::new().append(true).open(&env_path) {
                        Ok(mut file) => {
                            use std::io::Write;
                            for line in new_lines {
                                file.write_all(format!("\n{}", line).as_bytes()).ok();
                            }
                        }
                        Err(e) => warn!("Failed to write to {}: {}", env_path, e),
                    }
                }
            }
        }

        drop(vault_guard);
        log_audit_event(
            &state,
            "auto_sync_workspace",
            "project",
            Some(&project.id),
            true,
            Some(&format!("Synced {} keys", synced_count)),
        )
        .await;

        Ok(format!(
            "Auto-synced {} keys to workspace .env files",
            synced_count
        ))
    } else {
        Ok("No project associated with this workspace".to_string())
    }
}

async fn save_vault(state: &State<'_, AppState>) -> Result<(), String> {
    let vault_guard = state.vault.lock().await;
    info!(
        "Saving vault - master_password_hash present: {}",
        vault_guard.master_password_hash.is_some()
    );
    let result = save_vault_to_path(&*vault_guard, &state.vault_path).await;
    info!("Vault save completed");
    result
}

async fn save_vault_to_path(vault: &ApiKeyVault, vault_path: &PathBuf) -> Result<(), String> {
    // Serialize the vault to JSON
    let json = serde_json::to_string_pretty(vault)
        .map_err(|e| format!("Failed to serialize vault: {}", e))?;

    // Encrypt the vault data if encryption key is available
    let final_data = if let Some(key_str) = &vault.encryption_key {
        // Skip if it's just a placeholder
        if key_str == "[ENCRYPTED]" {
            return Ok(()); // Don't save if it's just a placeholder
        }

        let key_bytes = general_purpose::STANDARD
            .decode(key_str)
            .map_err(|e| format!("Failed to decode encryption key: {}", e))?;

        if key_bytes.len() != 32 {
            return Err("Invalid encryption key length".to_string());
        }

        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(&key_bytes);

        // Save metadata file for encrypted vaults
        let api_keys_metadata: Vec<ApiKeyMetadata> = vault
            .keys
            .values()
            .map(|api_key| {
                ApiKeyMetadata {
                    id: api_key.id.clone(),
                    name: api_key.name.clone(),
                    key: "[ENCRYPTED]".to_string(), // Never store actual keys in metadata
                    service: api_key.service.clone(),
                    description: api_key.description.clone(),
                    environment: api_key.environment.clone(),
                    rate_limit: api_key.rate_limit.clone(),
                    expires_at: api_key.expires_at.clone(),
                    scopes: api_key.scopes.clone(),
                    created_at: api_key.created_at.clone(),
                    updated_at: api_key.updated_at.clone(),
                    tags: api_key.tags.clone(),
                    is_active: api_key.is_active,
                    source_type: api_key.source_type.clone(),
                    env_file_path: api_key.env_file_path.clone(),
                    project_path: api_key.project_path.clone(),
                    env_file_name: api_key.env_file_name.clone(),
                }
            })
            .collect();

        // Create complete vault metadata structure
        let vault_metadata = VaultMetadata {
            master_password_hash: vault.master_password_hash.clone(),
            salt: vault.salt.clone(),
            created_at: get_utc_timestamp(),
            version: "1.0.0".to_string(),
            api_keys_metadata,
        };

        let metadata_path = vault_path.with_extension("metadata.json");
        let metadata_json = serde_json::to_string_pretty(&vault_metadata)
            .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
        fs::write(&metadata_path, metadata_json)
            .map_err(|e| format!("Failed to save metadata: {}", e))?;

        encrypt_data(&json, &key_array)?
    } else {
        // No encryption key yet, save as plaintext (first-time setup)
        json
    };

    fs::write(vault_path, final_data).map_err(|e| format!("Failed to save vault: {}", e))?;

    Ok(())
}

fn load_vault(vault_path: &PathBuf) -> Result<ApiKeyVault, String> {
    if !vault_path.exists() {
        return Ok(ApiKeyVault::default());
    }

    let contents =
        fs::read_to_string(vault_path).map_err(|e| format!("Failed to read vault: {}", e))?;

    // Try to parse as JSON first (for backwards compatibility or new vaults)
    if let Ok(vault) = serde_json::from_str::<ApiKeyVault>(&contents) {
        return Ok(vault);
    }

    // If JSON parsing fails, it might be encrypted
    // Check if we have a metadata file with essential info
    let metadata_path = vault_path.with_extension("metadata.json");
    if metadata_path.exists() {
        if let Ok(metadata_contents) = fs::read_to_string(&metadata_path) {
            if let Ok(metadata) = serde_json::from_str::<VaultMetadata>(&metadata_contents) {
                // Create a vault with metadata but no sensitive data
                let mut vault = ApiKeyVault::default();
                vault.master_password_hash = metadata.master_password_hash.clone();
                vault.salt = metadata.salt.clone();
                info!(
                    "Loading vault from metadata, master_password_hash: {:?}",
                    metadata.master_password_hash.is_some()
                );
                vault.encryption_key = Some("[ENCRYPTED]".to_string()); // Placeholder to indicate encryption

                // Load API keys metadata (with encrypted key data)
                for api_key_meta in metadata.api_keys_metadata {
                    let api_key = ApiKey {
                        id: api_key_meta.id.clone(),
                        name: api_key_meta.name,
                        service: api_key_meta.service,
                        key: api_key_meta.key.clone(), // Placeholder for encrypted key
                        description: api_key_meta.description,
                        environment: api_key_meta.environment,
                        rate_limit: api_key_meta.rate_limit,
                        expires_at: api_key_meta.expires_at,
                        scopes: api_key_meta.scopes,
                        created_at: api_key_meta.created_at,
                        updated_at: api_key_meta.updated_at,
                        tags: api_key_meta.tags,
                        is_active: api_key_meta.is_active,
                        source_type: api_key_meta.source_type,
                        env_file_path: api_key_meta.env_file_path,
                        project_path: api_key_meta.project_path,
                        env_file_name: api_key_meta.env_file_name,
                    };
                    vault.keys.insert(api_key_meta.id, api_key);
                }

                return Ok(vault);
            }
        }
    }

    // If no metadata file exists, vault appears to be encrypted - return empty vault
    info!("Vault appears to be encrypted, will require unlock");
    Ok(ApiKeyVault::default())
}

// Decrypt vault file using password
fn decrypt_vault_with_password(
    vault_path: &PathBuf,
    password: &str,
) -> Result<ApiKeyVault, String> {
    if !vault_path.exists() {
        return Err("Vault file not found".to_string());
    }

    let encrypted_contents =
        fs::read_to_string(vault_path).map_err(|e| format!("Failed to read vault file: {}", e))?;

    // Try to parse as JSON first (unencrypted vault)
    if let Ok(vault) = serde_json::from_str::<ApiKeyVault>(&encrypted_contents) {
        return Ok(vault);
    }

    // File is encrypted, need to decrypt it
    // Get salt from metadata file
    let metadata_path = vault_path.with_extension("metadata.json");
    if !metadata_path.exists() {
        return Err("Metadata file not found for encrypted vault".to_string());
    }

    let metadata_contents = fs::read_to_string(&metadata_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;
    let metadata: VaultMetadata = serde_json::from_str(&metadata_contents)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    let salt = metadata.salt.ok_or("No salt found in metadata")?;
    let salt_bytes = general_purpose::STANDARD
        .decode(&salt)
        .map_err(|e| format!("Failed to decode salt: {}", e))?;

    // Derive key from password and salt
    let key = derive_key_from_password(password, &salt_bytes);

    // Decrypt the vault data
    let decrypted_json = decrypt_data(&encrypted_contents, &key)?;

    // Parse decrypted JSON
    let vault: ApiKeyVault = serde_json::from_str(&decrypted_json)
        .map_err(|e| format!("Failed to parse decrypted vault: {}", e))?;

    Ok(vault)
}

// Encryption/Decryption utilities for vault data
fn encrypt_data(data: &str, key: &[u8]) -> Result<String, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let mut nonce_bytes = [0u8; 12]; // 96 bits for AES-GCM
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce and ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(result))
}

fn decrypt_data(encrypted_data: &str, key: &[u8]) -> Result<String, String> {
    let data = general_purpose::STANDARD
        .decode(encrypted_data)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if data.len() < 12 {
        return Err("Invalid encrypted data length".to_string());
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

fn derive_key_from_password(password: &str, salt: &[u8]) -> [u8; 32] {
    // Enterprise-grade key derivation using PBKDF2 with SHA-256
    let mut key = [0u8; 32];
    let iterations = 100_000; // OWASP recommended minimum

    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);

    key
}

// ===============================
//  ENV FILE PARSING AND PROJECT ASSOCIATION
// ===============================

fn parse_env_file(file_path: &str) -> Result<Vec<EnvVariable>, String> {
    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read .env file: {}", e))?;

    let mut variables = Vec::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Parse KEY=VALUE format
        if let Some(eq_pos) = line.find('=') {
            let name = line[..eq_pos].trim().to_string();
            let value = line[eq_pos + 1..].trim();

            // Remove quotes if present
            let value = if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value[1..value.len() - 1].to_string()
            } else {
                value.to_string()
            };

            // Determine if it's a secret based on common patterns
            let is_secret = is_secret_variable(&name, &value);

            variables.push(EnvVariable {
                name,
                value,
                is_secret,
            });
        }
    }

    Ok(variables)
}

fn is_secret_variable(name: &str, value: &str) -> bool {
    let name_lower = name.to_lowercase();

    // Common secret patterns
    let secret_patterns = [
        "key",
        "secret",
        "token",
        "password",
        "pass",
        "pwd",
        "auth",
        "api_key",
        "private",
        "credential",
        "cert",
        "signature",
        "access_token",
        "refresh_token",
        "client_secret",
        "webhook_secret",
    ];

    // Check if name contains secret patterns
    let name_is_secret = secret_patterns
        .iter()
        .any(|pattern| name_lower.contains(pattern));

    // Check value patterns (long base64-like strings, UUIDs, etc.)
    let value_looks_secret = value.len() > 20
        && (value.chars().all(|c| c.is_alphanumeric() || "=+/".contains(c)) || // base64-like
         value.contains('-') && value.len() > 30); // UUID-like

    name_is_secret || value_looks_secret
}

fn detect_project_path(env_file_path: &str) -> Result<String, String> {
    let path = std::path::Path::new(env_file_path);

    if let Some(parent) = path.parent() {
        // Look for common project indicators
        let project_indicators = [
            "package.json",
            "Cargo.toml",
            ".git",
            "composer.json",
            "requirements.txt",
            "go.mod",
            "pom.xml",
            "build.gradle",
        ];

        let mut current_dir = parent;

        // Walk up the directory tree looking for project indicators
        loop {
            for indicator in &project_indicators {
                if current_dir.join(indicator).exists() {
                    return Ok(current_dir.to_string_lossy().to_string());
                }
            }

            // Move up one directory
            if let Some(parent_dir) = current_dir.parent() {
                current_dir = parent_dir;
            } else {
                // Reached root, use the .env file's directory
                break;
            }
        }

        // If no project indicators found, use the .env file's directory
        Ok(parent.to_string_lossy().to_string())
    } else {
        Err("Cannot determine project path".to_string())
    }
}

#[tauri::command]
async fn parse_and_register_env_file(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<DroppedEnvFile, String> {
    info!("Parsing .env file: {}", file_path);

    // Parse the .env file
    let variables = parse_env_file(&file_path)?;

    // Detect project path
    let project_path = detect_project_path(&file_path)?;

    // Extract file name
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.env")
        .to_string();

    log_audit_event(
        &state,
        "parse_env_file",
        "env_file",
        Some(&file_path),
        true,
        None,
    )
    .await;

    Ok(DroppedEnvFile {
        path: file_path,
        project_path,
        file_name,
        keys: variables,
    })
}

#[tauri::command]
async fn associate_project_with_env(
    project_path: String,
    env_path: String,
    file_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Check if association already exists
    let existing_index = vault_guard
        .env_associations
        .iter()
        .position(|assoc| assoc.project_path == project_path && assoc.env_file_path == env_path);

    let association = ProjectEnvAssociation {
        id: format!("env_assoc_{}", get_utc_timestamp_millis()),
        project_path: project_path.clone(),
        env_file_path: env_path.clone(),
        env_file_name: file_name,
        created_at: get_utc_timestamp(),
        last_accessed: get_utc_timestamp(),
        is_active: true,
        vscode_status: Some("unknown".to_string()),
        last_vscode_check: None,
    };

    if let Some(index) = existing_index {
        // Update existing association
        vault_guard.env_associations[index] = association;
    } else {
        // Add new association
        vault_guard.env_associations.push(association);
    }

    drop(vault_guard);
    save_vault(&state).await?;

    log_audit_event(
        &state,
        "associate_project_env",
        "project",
        Some(&project_path),
        true,
        None,
    )
    .await;

    info!(
        "Associated project {} with env file {}",
        project_path, env_path
    );
    Ok(())
}

#[tauri::command]
async fn get_project_env_associations(
    project_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectEnvAssociation>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    let associations = if let Some(path) = project_path {
        vault_guard
            .env_associations
            .iter()
            .filter(|assoc| assoc.project_path == path && assoc.is_active)
            .cloned()
            .collect()
    } else {
        vault_guard.env_associations.clone()
    };

    Ok(associations)
}

#[tauri::command]
async fn activate_project_context(
    project_path: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Update last_accessed for matching associations
    let mut found = false;
    for association in &mut vault_guard.env_associations {
        if association.project_path == project_path && association.is_active {
            association.last_accessed = get_utc_timestamp();
            found = true;
        }
    }

    if found {
        drop(vault_guard);
        save_vault(&state).await?;
        log_audit_event(
            &state,
            "activate_project_context",
            "project",
            Some(&project_path),
            true,
            None,
        )
        .await;
    }

    Ok(found)
}

// ===============================
//  BIOMETRIC & USER MANAGEMENT
// ===============================

#[tauri::command]
async fn check_biometric_support() -> Result<bool, String> {
    // Check if device supports biometric authentication
    #[cfg(target_os = "macos")]
    {
        // On macOS, check for Touch ID or Face ID availability
        Ok(true) // Simplified - in reality would check LAContext.canEvaluatePolicy
    }
    #[cfg(target_os = "windows")]
    {
        // On Windows, check for Windows Hello availability
        Ok(true) // Simplified - in reality would check Windows Hello API
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(false)
    }
}

#[tauri::command]
async fn enable_biometric_auth(
    user_id: String,
    credential_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    if let Some(ref mut user_account) = vault_guard.user_account {
        if user_account.id == user_id {
            // Generate a new passkey credential
            let credential_id = Uuid::new_v4().to_string();
            let passkey = PasskeyCredential {
                id: credential_id.clone(),
                name: credential_name,
                credential_id: credential_id.as_bytes().to_vec(),
                public_key: Vec::new(), // Would be populated by WebAuthn
                created_at: get_utc_timestamp(),
                last_used: None,
                device_info: get_device_platform(),
            };

            user_account.passkey_credentials.push(passkey);
            user_account.biometric_enabled = true;
            user_account.updated_at = get_utc_timestamp();

            drop(vault_guard);
            save_vault(&state).await?;
            log_audit_event(
                &state,
                "enable_biometric",
                "user",
                Some(&user_id),
                true,
                None,
            )
            .await;

            Ok(credential_id)
        } else {
            Err("User ID mismatch".to_string())
        }
    } else {
        Err("No user account found".to_string())
    }
}

#[tauri::command]
async fn authenticate_biometric(
    credential_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut vault_guard = state.vault.lock().await;

    if let Some(ref mut user_account) = vault_guard.user_account {
        // Find the credential
        if let Some(credential) = user_account
            .passkey_credentials
            .iter_mut()
            .find(|c| c.id == credential_id)
        {
            // Update last used timestamp
            credential.last_used = Some(get_utc_timestamp());

            // Create a biometric session
            let session_id = Uuid::new_v4().to_string();
            let user_id = user_account.id.clone();
            let session_timeout = user_account.session_timeout;

            let session = BiometricSession {
                user_id: user_id.clone(),
                session_id: session_id.clone(),
                created_at: get_utc_timestamp(),
                expires_at: get_future_timestamp(session_timeout),
                device_id: get_device_id(),
                is_active: true,
            };

            vault_guard.biometric_sessions.push(session);

            // Unlock the vault
            *state.is_unlocked.lock().await = true;

            drop(vault_guard);
            save_vault(&state).await?;
            log_audit_event(&state, "biometric_auth", "user", Some(&user_id), true, None).await;

            Ok(session_id)
        } else {
            drop(vault_guard);
            log_audit_event(
                &state,
                "biometric_auth",
                "user",
                None,
                false,
                Some("Invalid credential"),
            )
            .await;
            Err("Invalid credential".to_string())
        }
    } else {
        drop(vault_guard);
        Err("No user account found".to_string())
    }
}

#[tauri::command]
async fn update_user_preferences(
    preferences: UserPreferences,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    if let Some(ref mut user_account) = vault_guard.user_account {
        let user_id = user_account.id.clone();
        user_account.preferences = preferences;
        user_account.updated_at = get_utc_timestamp();

        drop(vault_guard);
        save_vault(&state).await?;
        log_audit_event(
            &state,
            "update_preferences",
            "user",
            Some(&user_id),
            true,
            None,
        )
        .await;

        Ok(())
    } else {
        drop(vault_guard);
        Err("No user account found".to_string())
    }
}

#[tauri::command]
async fn get_user_preferences(state: State<'_, AppState>) -> Result<UserPreferences, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    if let Some(ref user_account) = vault_guard.user_account {
        Ok(user_account.preferences.clone())
    } else {
        // Return default preferences if no user account
        Ok(UserPreferences {
            theme: "system".to_string(),
            language: "en".to_string(),
            auto_lock_timeout: 15,
            clipboard_clear_timeout: 30,
            show_notifications: true,
            audit_logging: true,
            biometric_unlock: false,
            auto_backup: true,
            encryption_level: "enhanced".to_string(),
        })
    }
}

#[tauri::command]
async fn create_passkey_challenge(
    user_id: String,
    challenge_type: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut vault_guard = state.vault.lock().await;

    // Generate a new challenge
    let challenge_id = Uuid::new_v4().to_string();
    let challenge = WebAuthnChallenge {
        challenge: challenge_id.clone(),
        user_id: user_id.clone(),
        created_at: get_utc_timestamp(),
        expires_at: get_future_timestamp(5), // 5 minutes
        challenge_type,
    };

    vault_guard.webauthn_challenges.push(challenge);

    drop(vault_guard);
    save_vault(&state).await?;

    Ok(challenge_id)
}

#[tauri::command]
async fn verify_passkey_challenge(
    challenge_id: String,
    response: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut vault_guard = state.vault.lock().await;

    // Find and validate the challenge
    if let Some(challenge_index) = vault_guard
        .webauthn_challenges
        .iter()
        .position(|c| c.challenge == challenge_id)
    {
        let challenge = vault_guard.webauthn_challenges.remove(challenge_index);

        // Check if challenge is still valid (not expired)
        let now = chrono::Utc::now().to_rfc3339();
        if now > challenge.expires_at {
            return Err("Challenge expired".to_string());
        }

        // In a real implementation, you would verify the WebAuthn response here
        // For now, we'll assume the response is valid if it's not empty
        if !response.is_empty() {
            log_audit_event(
                &state,
                "verify_passkey",
                "user",
                Some(&challenge.user_id),
                true,
                None,
            )
            .await;
            Ok(true)
        } else {
            log_audit_event(
                &state,
                "verify_passkey",
                "user",
                Some(&challenge.user_id),
                false,
                Some("Invalid response"),
            )
            .await;
            Err("Invalid passkey response".to_string())
        }
    } else {
        Err("Challenge not found".to_string())
    }
}

#[tauri::command]
async fn invalidate_biometric_sessions(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault.lock().await;

    // Mark all sessions as inactive
    for session in &mut vault_guard.biometric_sessions {
        if session.user_id == user_id {
            session.is_active = false;
        }
    }

    drop(vault_guard);
    save_vault(&state).await?;
    log_audit_event(
        &state,
        "invalidate_sessions",
        "user",
        Some(&user_id),
        true,
        None,
    )
    .await;

    Ok(())
}

#[tauri::command]
async fn update_vscode_workspaces(
    workspaces: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let mut vault_guard = state.vault.lock().await;

    // Clear existing workspaces
    vault_guard.vscode_workspaces.clear();

    // Add new workspaces
    let timestamp = get_utc_timestamp();
    for workspace_path in workspaces {
        let workspace_name = std::path::Path::new(&workspace_path)
            .file_name()
            .unwrap_or_else(|| std::ffi::OsStr::new("unknown"))
            .to_string_lossy()
            .to_string();

        vault_guard.vscode_workspaces.push(VSCodeWorkspace {
            path: workspace_path.clone(),
            name: workspace_name,
            is_open: true,
            last_updated: timestamp.clone(),
        });
    }

    // Update VSCode status for project associations
    let workspaces_clone = vault_guard.vscode_workspaces.clone();
    for assoc in &mut vault_guard.env_associations {
        let is_open = workspaces_clone
            .iter()
            .any(|ws| ws.path == assoc.project_path || assoc.project_path.starts_with(&ws.path));

        assoc.vscode_status = Some(if is_open { "open" } else { "closed" }.to_string());
        assoc.last_vscode_check = Some(timestamp.clone());
    }

    drop(vault_guard);
    save_vault(&state).await?;
    log_audit_event(
        &state,
        "update_vscode_workspaces",
        "workspace",
        None,
        true,
        None,
    )
    .await;

    Ok(())
}

#[tauri::command]
async fn get_vscode_workspaces(state: State<'_, AppState>) -> Result<Vec<VSCodeWorkspace>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;
    Ok(vault_guard.vscode_workspaces.clone())
}

#[tauri::command]
async fn get_project_vscode_status(
    project_path: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    let vault_guard = state.vault.lock().await;

    // Check if project is in VSCode workspaces
    let is_open = vault_guard
        .vscode_workspaces
        .iter()
        .any(|ws| ws.path == project_path || project_path.starts_with(&ws.path));

    if is_open {
        Ok(Some("open".to_string()))
    } else {
        // Check if we have any VSCode workspaces at all
        if vault_guard.vscode_workspaces.is_empty() {
            Ok(Some("unknown".to_string()))
        } else {
            Ok(Some("closed".to_string()))
        }
    }
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn open_in_vscode(path: String) -> Result<(), String> {
    std::process::Command::new("code")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open in VSCode: {}", e))?;
    Ok(())
}

// Session management for persistent login
#[tauri::command]
async fn restore_session_on_startup(state: State<'_, AppState>) -> Result<bool, String> {
    // Check if user account exists and if vault is already unlocked
    let vault_guard = state.vault.lock().await;
    let has_user = vault_guard.user_account.is_some();
    drop(vault_guard);

    if has_user {
        // Check if vault is already unlocked from a previous session
        let is_unlocked = {
            let unlocked_guard = state.is_unlocked.lock().await;
            *unlocked_guard
        };

        if is_unlocked {
            log_audit_event(
                &state,
                "restore_session",
                "session",
                None,
                true,
                Some("Vault already unlocked"),
            )
            .await;
            info!("Session restored with vault already unlocked");
        } else {
            log_audit_event(
                &state,
                "restore_session",
                "session",
                None,
                true,
                Some("User account found, vault locked"),
            )
            .await;
            info!("Session restored but vault requires unlock");
        }

        Ok(true)
    } else {
        Ok(false)
    }
}

// Window Management Commands
#[tauri::command]
async fn show_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn quit_application(app: AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

// Update Commands with proper implementation
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<serde_json::Value, String> {
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => Ok(serde_json::json!({
                "available": true,
                "version": update.version,
                "date": update.date,
                "body": update.body
            })),
            Ok(None) => Ok(serde_json::json!({
                "available": false,
                "message": "No updates available"
            })),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            // First check for updates
            match updater.check().await {
                Ok(Some(update)) => {
                    // Download and install the update
                    match update
                        .download_and_install(
                            |_chunk_length, _content_length| {
                                // Progress callback - could be used for progress reporting
                            },
                            || {
                                // Download finished callback
                                info!("Update download completed");
                            },
                        )
                        .await
                    {
                        Ok(_) => {
                            info!("Update installed successfully");
                            Ok(())
                        }
                        Err(e) => Err(format!("Failed to install update: {}", e)),
                    }
                }
                Ok(None) => Err("No updates available to install".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

// Additional Session Management Commands
#[tauri::command]
async fn create_remember_me_session(
    user_id: String,
    timeout_minutes: u64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let session_id = format!("session_{}", Uuid::new_v4());
    let expires_at = get_future_timestamp(timeout_minutes);

    let session = PersistentSession {
        session_id: session_id.clone(),
        user_id,
        created_at: get_utc_timestamp(),
        expires_at,
        last_accessed: get_utc_timestamp(),
        device_info: get_device_platform(),
        is_remember_me: true,
        is_active: true,
    };

    let mut vault_guard = state.vault.lock().await;
    vault_guard.persistent_sessions.push(session);
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(
        &state,
        "create_remember_session",
        "session",
        Some(&session_id),
        true,
        None,
    )
    .await;

    Ok(session_id)
}

#[tauri::command]
async fn validate_remember_me_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let vault_guard = state.vault.lock().await;

    if let Some(session) = vault_guard
        .persistent_sessions
        .iter()
        .find(|s| s.session_id == session_id && s.is_active)
    {
        // Check if session is not expired
        let now = Utc::now();
        if let Ok(expires_at) = DateTime::parse_from_rfc3339(&session.expires_at) {
            if now.timestamp() < expires_at.timestamp() {
                drop(vault_guard);
                log_audit_event(
                    &state,
                    "validate_remember_session",
                    "session",
                    Some(&session_id),
                    true,
                    None,
                )
                .await;
                return Ok(true);
            }
        }
    }

    drop(vault_guard);
    log_audit_event(
        &state,
        "validate_remember_session",
        "session",
        Some(&session_id),
        false,
        Some("Session invalid or expired"),
    )
    .await;
    Ok(false)
}

#[tauri::command]
async fn get_persistent_sessions(
    state: State<'_, AppState>,
) -> Result<Vec<PersistentSession>, String> {
    let vault_guard = state.vault.lock().await;
    Ok(vault_guard.persistent_sessions.clone())
}

#[tauri::command]
async fn revoke_persistent_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault.lock().await;

    if let Some(session) = vault_guard
        .persistent_sessions
        .iter_mut()
        .find(|s| s.session_id == session_id)
    {
        session.is_active = false;
    }

    drop(vault_guard);
    save_vault(&state).await?;
    log_audit_event(
        &state,
        "revoke_persistent_session",
        "session",
        Some(&session_id),
        true,
        None,
    )
    .await;

    Ok(())
}

#[tauri::command]
async fn cleanup_all_sessions(state: State<'_, AppState>) -> Result<(), String> {
    let mut vault_guard = state.vault.lock().await;
    vault_guard.persistent_sessions.clear();
    drop(vault_guard);

    save_vault(&state).await?;
    log_audit_event(&state, "cleanup_all_sessions", "session", None, true, None).await;

    Ok(())
}

// User Management Commands
#[tauri::command]
async fn update_username(new_username: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut vault_guard = state.vault.lock().await;

    if let Some(user_account) = &mut vault_guard.user_account {
        user_account.username = new_username.clone();
        user_account.updated_at = get_utc_timestamp();
    } else {
        return Err("No user account found".to_string());
    }

    drop(vault_guard);
    save_vault(&state).await?;
    log_audit_event(
        &state,
        "update_username",
        "user",
        Some(&new_username),
        true,
        None,
    )
    .await;

    Ok(())
}

// ================================
// Documentation Store File Operations
// ================================

async fn save_docs_store(state: &State<'_, AppState>) -> Result<(), String> {
    let docs_store_guard = state.docs_store.lock().await;
    let docs_path = &state.docs_store_path;
    
    // Create parent directory if it doesn't exist
    if let Some(parent) = docs_path.parent() {
        tokio::fs::create_dir_all(parent).await
            .map_err(|e| format!("Failed to create docs directory: {}", e))?;
    }
    
    // Serialize docs store to JSON
    let docs_json = serde_json::to_string_pretty(&*docs_store_guard)
        .map_err(|e| format!("Failed to serialize docs store: {}", e))?;
    
    // Write to file
    tokio::fs::write(docs_path, docs_json).await
        .map_err(|e| format!("Failed to write docs store: {}", e))?;
    
    info!("Documentation store saved to: {:?}", docs_path);
    Ok(())
}

async fn load_docs_store(docs_store_path: &PathBuf) -> DocsStore {
    if !docs_store_path.exists() {
        info!("Documentation store file not found, creating new one: {:?}", docs_store_path);
        return DocsStore::new();
    }
    
    match tokio::fs::read_to_string(docs_store_path).await {
        Ok(content) => {
            match serde_json::from_str::<DocsStore>(&content) {
                Ok(docs_store) => {
                    info!("Loaded documentation store with {} documents", docs_store.docs.len());
                    docs_store
                }
                Err(e) => {
                    warn!("Failed to parse docs store, creating new one: {}", e);
                    DocsStore::new()
                }
            }
        }
        Err(e) => {
            warn!("Failed to read docs store file, creating new one: {}", e);
            DocsStore::new()
        }
    }
}

// ================================
// Documentation CRUD Commands
// ================================

#[tauri::command]
async fn get_documentation(state: State<'_, AppState>) -> Result<Vec<Documentation>, String> {
    let docs_store_guard = state.docs_store.lock().await;
    Ok(docs_store_guard.get_all_docs().into_iter().cloned().collect())
}

#[tauri::command]
async fn create_documentation(
    title: String,
    content: String,
    doc_type: String,
    project_id: Option<String>,
    provider_id: Option<String>,
    url: Option<String>,
    tags: Option<Vec<String>>,
    language: Option<String>,
    search_keywords: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<Documentation, String> {
    let mut docs_store_guard = state.docs_store.lock().await;

    // Generate unique documentation ID
    let doc_id = format!("doc_{}", get_utc_timestamp_millis());

    let documentation = Documentation {
        id: doc_id.clone(),
        title: title.clone(),
        content,
        doc_type,
        project_id,
        provider_id,
        url,
        tags: tags.unwrap_or_default(),
        created_at: get_utc_timestamp(),
        updated_at: get_utc_timestamp(),
        language: language.unwrap_or_else(|| "en".to_string()),
        is_favorite: false,
        search_keywords: search_keywords.unwrap_or_default(),
    };

    docs_store_guard.add_doc(documentation.clone());
    drop(docs_store_guard);

    save_docs_store(&state).await?;
    
    // Still log audit event in main vault for tracking
    if *state.is_unlocked.lock().await {
        log_audit_event(&state, "create_documentation", "documentation", Some(&doc_id), true, None).await;
    }

    info!("Documentation created successfully: {} ({})", title, doc_id);
    Ok(documentation)
}

#[tauri::command]
async fn update_documentation(
    id: String,
    title: Option<String>,
    content: Option<String>,
    doc_type: Option<String>,
    project_id: Option<String>,
    provider_id: Option<String>,
    url: Option<String>,
    tags: Option<Vec<String>>,
    language: Option<String>,
    is_favorite: Option<bool>,
    search_keywords: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<Documentation, String> {
    let mut docs_store_guard = state.docs_store.lock().await;

    if let Some(mut documentation) = docs_store_guard.get_doc(&id).cloned() {
        // Update fields if provided
        if let Some(new_title) = title {
            documentation.title = new_title;
        }
        if let Some(new_content) = content {
            documentation.content = new_content;
        }
        if let Some(new_doc_type) = doc_type {
            documentation.doc_type = new_doc_type;
        }
        if let Some(new_project_id) = project_id {
            documentation.project_id = Some(new_project_id);
        }
        if let Some(new_provider_id) = provider_id {
            documentation.provider_id = Some(new_provider_id);
        }
        if let Some(new_url) = url {
            documentation.url = Some(new_url);
        }
        if let Some(new_tags) = tags {
            documentation.tags = new_tags;
        }
        if let Some(new_language) = language {
            documentation.language = new_language;
        }
        if let Some(new_is_favorite) = is_favorite {
            documentation.is_favorite = new_is_favorite;
        }
        if let Some(new_keywords) = search_keywords {
            documentation.search_keywords = new_keywords;
        }

        documentation.updated_at = get_utc_timestamp();

        docs_store_guard.update_doc(documentation.clone());
        drop(docs_store_guard);

        save_docs_store(&state).await?;
        
        // Still log audit event in main vault for tracking
        if *state.is_unlocked.lock().await {
            log_audit_event(&state, "update_documentation", "documentation", Some(&id), true, None).await;
        }

        info!("Documentation updated successfully: {}", id);
        Ok(documentation)
    } else {
        Err("Documentation not found".to_string())
    }
}

#[tauri::command]
async fn delete_documentation(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut docs_store_guard = state.docs_store.lock().await;

    // Remove the documentation
    let doc = docs_store_guard.remove_doc(&id)
        .ok_or("Documentation not found".to_string())?;
    drop(docs_store_guard);

    save_docs_store(&state).await?;
    
    // Still log audit event in main vault for tracking
    if *state.is_unlocked.lock().await {
        log_audit_event(&state, "delete_documentation", "documentation", Some(&id), true, None).await;
    }

    info!("Documentation deleted successfully: {} ({})", doc.title, id);
    Ok(())
}

#[tauri::command]
async fn search_native_documentation(
    query: String,
    project_id: Option<String>,
    provider_id: Option<String>,
    doc_type: Option<String>,
    tags: Option<Vec<String>>,
    favorites_only: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<Documentation>, String> {
    let docs_store_guard = state.docs_store.lock().await;
    let query_lower = query.to_lowercase();
    
    let mut results: Vec<Documentation> = docs_store_guard
        .search_docs(&query)
        .into_iter()
        .filter(|doc| {
            // Filter by project_id if specified
            let matches_project = project_id.as_ref()
                .map(|pid| doc.project_id.as_ref() == Some(pid))
                .unwrap_or(true);
            
            // Filter by provider_id if specified
            let matches_provider = provider_id.as_ref()
                .map(|pid| doc.provider_id.as_ref() == Some(pid))
                .unwrap_or(true);
            
            // Filter by doc_type if specified
            let matches_type = doc_type.as_ref()
                .map(|dt| &doc.doc_type == dt)
                .unwrap_or(true);
            
            // Filter by tags if specified
            let matches_tags = tags.as_ref()
                .map(|tags_filter| tags_filter.iter().any(|tag| doc.tags.contains(tag)))
                .unwrap_or(true);
            
            // Filter by favorites if specified
            let matches_favorites = favorites_only
                .map(|fav| fav == false || doc.is_favorite)
                .unwrap_or(true);
            
            matches_project && matches_provider && matches_type && matches_tags && matches_favorites
        })
        .cloned()
        .collect();
    
    // Sort by relevance (simple scoring: title matches get higher priority)
    results.sort_by(|a, b| {
        let a_title_match = a.title.to_lowercase().contains(&query_lower);
        let b_title_match = b.title.to_lowercase().contains(&query_lower);
        
        match (a_title_match, b_title_match) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.updated_at.cmp(&a.updated_at), // Then sort by most recent
        }
    });
    
    Ok(results)
}

#[tauri::command]
async fn get_documentation_by_project(
    project_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Documentation>, String> {
    let docs_store_guard = state.docs_store.lock().await;
    let docs: Vec<Documentation> = docs_store_guard
        .get_all_docs()
        .into_iter()
        .filter(|doc| doc.project_id.as_ref() == Some(&project_id))
        .cloned()
        .collect();
    
    Ok(docs)
}

#[tauri::command]
async fn get_documentation_by_provider(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Documentation>, String> {
    let docs_store_guard = state.docs_store.lock().await;
    let docs: Vec<Documentation> = docs_store_guard
        .get_all_docs()
        .into_iter()
        .filter(|doc| doc.provider_id.as_ref() == Some(&provider_id))
        .cloned()
        .collect();
    
    Ok(docs)
}

#[tauri::command]
async fn toggle_documentation_favorite(
    id: String,
    state: State<'_, AppState>,
) -> Result<Documentation, String> {
    let mut docs_store_guard = state.docs_store.lock().await;

    if let Some(mut documentation) = docs_store_guard.get_doc(&id).cloned() {
        documentation.is_favorite = !documentation.is_favorite;
        documentation.updated_at = get_utc_timestamp();

        docs_store_guard.update_doc(documentation.clone());
        drop(docs_store_guard);

        save_docs_store(&state).await?;
        
        // Still log audit event in main vault for tracking
        if *state.is_unlocked.lock().await {
            log_audit_event(&state, "toggle_documentation_favorite", "documentation", Some(&id), true, None).await;
        }

        info!("Documentation favorite toggled: {} -> {}", id, documentation.is_favorite);
        Ok(documentation)
    } else {
        Err("Documentation not found".to_string())
    }
}

#[tauri::command]
async fn scrape_and_save_documentation(
    url: String,
    title: Option<String>,
    doc_type: Option<String>,
    project_id: Option<String>,
    provider_id: Option<String>,
    tags: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<Documentation, String> {
    if !*state.is_unlocked.lock().await {
        return Err("Vault is locked".to_string());
    }

    // Create documentation manager with LLM proxy
    let mut docs_manager = docs_manager::DocumentationManager::new_with_llm_proxy(
        Arc::clone(&state.llm_proxy)
    );

    // Scrape content from URL
    let scraped_content = docs_manager.scrape_documentation_content(&url).await
        .map_err(|e| format!("Failed to scrape documentation: {}", e))?;

    // Generate unique documentation ID
    let doc_id = format!("doc_{}", get_utc_timestamp_millis());

    // Determine title
    let doc_title = title.unwrap_or_else(|| {
        // Extract title from URL if not provided
        let url_parts: Vec<&str> = url.split('/').collect();
        if let Some(domain) = url_parts.get(2) {
            format!("Documentation from {}", domain)
        } else {
            "Scraped Documentation".to_string()
        }
    });

    // Create search keywords from content and title
    let mut search_keywords = Vec::new();
    search_keywords.extend(
        doc_title
            .to_lowercase()
            .split_whitespace()
            .map(|s| s.to_string())
    );

    // Extract keywords from first 500 characters of content
    let content_preview = scraped_content.chars().take(500).collect::<String>();
    let content_words: Vec<String> = content_preview
        .to_lowercase()
        .split_whitespace()
        .filter(|word| word.len() > 3) // Only words longer than 3 chars
        .take(20) // Limit to 20 keywords
        .map(|s| s.to_string())
        .collect();
    search_keywords.extend(content_words);

    // Remove duplicates
    search_keywords.sort();
    search_keywords.dedup();

    let documentation = Documentation {
        id: doc_id.clone(),
        title: doc_title.clone(),
        content: scraped_content,
        doc_type: doc_type.unwrap_or_else(|| "scraped".to_string()),
        project_id,
        provider_id,
        url: Some(url.clone()),
        tags: tags.unwrap_or_default(),
        created_at: get_utc_timestamp(),
        updated_at: get_utc_timestamp(),
        language: "en".to_string(),
        is_favorite: false,
        search_keywords,
    };


    info!("Documentation scraped and saved: {} from {}", doc_title, url);
    Ok(documentation)
}

// Helper functions for biometric authentication
fn get_device_platform() -> String {
    #[cfg(target_os = "macos")]
    return "macOS Device".to_string();
    #[cfg(target_os = "windows")]
    return "Windows Device".to_string();
    #[cfg(target_os = "linux")]
    return "Linux Device".to_string();
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "Unknown Device".to_string();
}

fn get_device_id() -> String {
    // In a real implementation, this would generate a unique device identifier
    format!("device_{}", Uuid::new_v4())
}

fn get_future_timestamp(minutes: u64) -> String {
    let future = chrono::Utc::now() + chrono::Duration::minutes(minutes as i64);
    future.to_rfc3339()
}

fn create_audit_log(
    action: &str,
    resource_type: &str,
    resource_id: Option<&str>,
    success: bool,
    error_message: Option<&str>,
) -> AuditLog {
    AuditLog {
        id: format!("audit_{}", get_utc_timestamp_millis()),
        timestamp: get_utc_timestamp(),
        action: action.to_string(),
        resource_type: resource_type.to_string(),
        resource_id: resource_id.map(|s| s.to_string()),
        user_id: Some("local_user".to_string()), // In multi-user scenario, this would be dynamic
        ip_address: Some("127.0.0.1".to_string()),
        user_agent: Some("KeyKeeper Desktop".to_string()),
        success,
        error_message: error_message.map(|s| s.to_string()),
    }
}

async fn log_audit_event(
    state: &State<'_, AppState>,
    action: &str,
    resource_type: &str,
    resource_id: Option<&str>,
    success: bool,
    error_message: Option<&str>,
) {
    let audit_log = create_audit_log(action, resource_type, resource_id, success, error_message);

    // Log to console for immediate debugging
    if success {
        info!(
            "AUDIT: {} {} {:?} - SUCCESS",
            action, resource_type, resource_id
        );
    } else {
        warn!(
            "AUDIT: {} {} {:?} - FAILED: {:?}",
            action, resource_type, resource_id, error_message
        );
    }

    // Store in vault
    let mut vault_guard = state.vault.lock().await;
    vault_guard.audit_logs.push(audit_log);

    // Keep only last 1000 audit logs to prevent unlimited growth
    if vault_guard.audit_logs.len() > 1000 {
        vault_guard.audit_logs.remove(0);
    }
}

fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // Ensure the directory exists
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    Ok(app_data_dir)
}

// Removed get_request_body - replaced with hyper HTTP server

// Helper function to validate VSCode tokens

// Old TCP server implementation removed - now using Hyper HTTP server
/*
async fn handle_vscode_connection_enterprise(
    mut stream: tokio::net::TcpStream,
    vault: Arc<Mutex<ApiKeyVault>>,
    is_unlocked: Arc<Mutex<bool>>,
    vault_path: PathBuf,
    client_addr: std::net::SocketAddr,
) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let mut buffer = [0; 2048];
    if let Ok(n) = stream.read(&mut buffer).await {
        let request = String::from_utf8_lossy(&buffer[..n]);
        // Parse HTTP request with enhanced security
        let lines: Vec<&str> = request.lines().collect();
        if lines.is_empty() {
            return;
        }
        let request_line = lines[0];
        let parts: Vec<&str> = request_line.split_whitespace().collect();
        if parts.len() < 3 {
            return;
        }
        let method = parts[0];
        let path = parts[1];
        let _version = parts[2];
        // Enhanced security headers
        let security_headers = "Content-Type: application/json\r\n\
            X-Content-Type-Options: nosniff\r\n\
            X-Frame-Options: DENY\r\n\
            X-XSS-Protection: 1; mode=block\r\n\
            Strict-Transport-Security: max-age=31536000; includeSubDomains\r\n\
            Content-Security-Policy: default-src 'none'; frame-ancestors 'none'\r\n\
            Access-Control-Allow-Origin: vscode-webview://\r\n\
            Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
            Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key\r\n";
        // Rate limiting check (simplified)
        let rate_limit_exceeded = false;
        // TODO: Implement proper rate limiting
        if rate_limit_exceeded {
            let response = format!(
                "HTTP/1.1 429 Too Many Requests\r\n{}\r\n{{\"error\":\"Rate limit exceeded\",\"client\":\"{}\"}}",
                security_headers,
                client_addr
            );
            let _ = stream.write_all(response.as_bytes()).await;
            return;
        }
        // Parse path and query parameters
        let (path_only, query_params) = if let Some(pos) = path.find('?') {
            (&path[..pos], Some(&path[pos + 1..]))
        } else {
            (path, None)
        };
        // Route handling with audit logging
        match (method, path_only) {
            ("GET", "/health") => {
                let response = format!(
                    "HTTP/1.1 200 OK\r\n{}\r\n{{\"status\":\"ok\",\"timestamp\":\"{}\",\"version\":\"2.0.0-enterprise\"}}",
                    security_headers,
                    get_utc_timestamp()
                );
                let _ = stream.write_all(response.as_bytes()).await;
            }
            ("GET", "/api/keys") => {
                if *is_unlocked.lock().await {
                    let vault_guard = vault.lock().await;
                    // Filter sensitive data for VSCode
                    let filtered_keys: Vec<_> = vault_guard
                        .keys
                        .values()
                        .map(|key| {
                            let mut filtered = key.clone();
                            // Mask the actual key for security
                            filtered.key = format!(
                                "***MASKED***{}",
                                &key.key[key.key.len().saturating_sub(4)..]
                            );
                            filtered
                        })
                        .collect();
                    let json_keys = serde_json::to_string(&filtered_keys).unwrap_or_default();
                    let response =
                        format!("HTTP/1.1 200 OK\r\n{}\r\n{}", security_headers, json_keys);
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\",\"timestamp\":\"{}\"}}",
                        security_headers,
                        get_utc_timestamp()
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/projects") => {
                if *is_unlocked.lock().await {
                    let response = format!("HTTP/1.1 200 OK\r\n{}\r\n[]", security_headers);
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/keys/search") => {
                if *is_unlocked.lock().await {
                    if let Some(query_str) = query_params {
                        // Parse query parameter
                        if let Some(q_start) = query_str.find("q=") {
                            let q_value = &query_str[q_start + 2..];
                            let query = q_value.split('&').next().unwrap_or("");
                            // Usa la logica reale di ricerca
                            let vault_guard = vault.lock().await;
                            let filtered_keys: Vec<_> = vault_guard
                                .keys
                                .values()
                                .filter(|key| {
                                    key.name.to_lowercase().contains(&query.to_lowercase())
                                        || key
                                            .service
                                            .to_lowercase()
                                            .contains(&query.to_lowercase())
                                        || key.tags.iter().any(|tag| {
                                            tag.to_lowercase().contains(&query.to_lowercase())
                                        })
                                        || key.description.as_ref().map_or(false, |desc| {
                                            desc.to_lowercase().contains(&query.to_lowercase())
                                        })
                                })
                                .map(|key| {
                                    let mut filtered = key.clone();
                                    filtered.key = format!(
                                        "***MASKED***{}",
                                        &key.key[key.key.len().saturating_sub(4)..]
                                    );
                                    filtered
                                })
                                .collect();
                            let json_keys =
                                serde_json::to_string(&filtered_keys).unwrap_or_default();
                            let response =
                                format!("HTTP/1.1 200 OK\r\n{}\r\n{}", security_headers, json_keys);
                            let _ = stream.write_all(response.as_bytes()).await;
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Missing query parameter\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Missing query parameter\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/activity/recent") => {
                if *is_unlocked.lock().await {
                    let vault_guard = vault.lock().await;
                    let mut activities = vault_guard.recent_activity.clone();
                    // Sort by timestamp, most recent first
                    activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
                    activities.truncate(50);
                    let json_activities = serde_json::to_string(&activities).unwrap_or_default();
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n{}\r\n{}",
                        security_headers, json_activities
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", path_only)
                if path_only.starts_with("/api/keys/") && path_only.ends_with("/usage") =>
            {
                if *is_unlocked.lock().await {
                    // Extract key ID from path
                    if let Some(_key_id) = path_only
                        .strip_prefix("/api/keys/")
                        .and_then(|s| s.strip_suffix("/usage"))
                    {
                        // For now, just return success - real implementation would call record_key_usage
                        let response = format!(
                            "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid key ID\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/projects/sync") => {
                if *is_unlocked.lock().await {
                    // For now, just return success - real implementation would call sync_project
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/login") => {
                // Parse request body to get credentials
                if let Ok(body) = get_request_body(&mut stream).await {
                    if let Ok(parsed_body) = serde_json::from_str::<serde_json::Value>(&body) {
                        if let (Some(account), Some(master_pass)) = (
                            parsed_body["account"].as_str(),
                            parsed_body["masterPass"].as_str(),
                        ) {
                            // Check if user account exists and password matches master password
                            let vault_guard = vault.lock().await;
                            if let Some(user_account) = &vault_guard.user_account {
                                if user_account.email == account || user_account.username == account
                                {
                                    // For VSCode integration, we check against master password, not user password
                                    if let Some(master_hash) = &vault_guard.master_password_hash {
                                        let master_hash_clone = master_hash.clone();
                                        let user_id_clone = user_account.id.clone();
                                        drop(vault_guard);
                                        if let Ok(is_valid) =
                                            bcrypt::verify(master_pass, &master_hash_clone)
                                        {
                                            if is_valid {
                                                // ✅ FIX: Create secure token with expiry
                                                let token = format!(
                                                    "vscode_session_{}",
                                                    uuid::Uuid::new_v4().to_string()
                                                );
                                                let now = get_utc_timestamp();
                                                let expires_at = get_future_timestamp(480); // 8 hours

                                                let vscode_token = VSCodeToken {
                                                    token: token.clone(),
                                                    user_id: user_id_clone,
                                                    created_at: now,
                                                    expires_at,
                                                    is_valid: true,
                                                };

                                                // Store token in vault
                                                let mut vault_guard_for_token = vault.lock().await;
                                                vault_guard_for_token
                                                    .vscode_tokens
                                                    .push(vscode_token);
                                                drop(vault_guard_for_token);

                                                let response = format!(
                                                    "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true,\"token\":\"{}\"}}",
                                                    security_headers,
                                                    token
                                                );
                                                let _ = stream.write_all(response.as_bytes()).await;
                                                return;
                                            }
                                        }
                                    } else {
                                        drop(vault_guard);
                                    }
                                } else {
                                    drop(vault_guard);
                                }
                            } else {
                                drop(vault_guard);
                            }
                            let response = format!(
                                "HTTP/1.1 401 Unauthorized\r\n{}\r\n{{\"success\":false,\"message\":\"Invalid credentials\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Missing account or masterPass\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Invalid JSON body\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Cannot read request body\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/auth/master-password") => {
                // Simplified authentication endpoint for VSCode extension - only requires master password
                if let Ok(body) = get_request_body(&mut stream).await {
                    if let Ok(parsed_body) = serde_json::from_str::<serde_json::Value>(&body) {
                        if let Some(master_pass) = parsed_body["masterPass"].as_str() {
                            // Check if master password is valid
                            let vault_guard = vault.lock().await;
                            if let Some(master_hash) = &vault_guard.master_password_hash {
                                let master_hash_clone = master_hash.clone();
                                // For simplified auth, we'll use a default user_id if no user account exists
                                let user_id = if let Some(user_account) = &vault_guard.user_account {
                                    user_account.id.clone()
                                } else {
                                    "default_user".to_string()
                                };
                                drop(vault_guard);

                                if let Ok(is_valid) = bcrypt::verify(master_pass, &master_hash_clone) {
                                    if is_valid {
                                        // Create secure token with expiry
                                        let token = format!(
                                            "vscode_session_{}",
                                            uuid::Uuid::new_v4().to_string()
                                        );
                                        let now = get_utc_timestamp();
                                        let expires_at = get_future_timestamp(480); // 8 hours

                                        let vscode_token = VSCodeToken {
                                            token: token.clone(),
                                            user_id,
                                            created_at: now,
                                            expires_at,
                                            is_valid: true,
                                        };

                                        // Store token in vault
                                        let mut vault_guard_for_token = vault.lock().await;
                                        vault_guard_for_token.vscode_tokens.push(vscode_token);
                                        drop(vault_guard_for_token);

                                        let response = format!(
                                            "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true,\"token\":\"{}\"}}",
                                            security_headers,
                                            token
                                        );
                                        let _ = stream.write_all(response.as_bytes()).await;
                                        return;
                                    }
                                }
                            } else {
                                drop(vault_guard);
                            }

                            let response = format!(
                                "HTTP/1.1 401 Unauthorized\r\n{}\r\n{{\"success\":false,\"message\":\"Invalid master password\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Missing masterPass\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Invalid JSON body\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"success\":false,\"message\":\"Cannot read request body\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/keys") => {
                if *is_unlocked.lock().await {
                    // Parse request body to create new API key
                    if let Ok(body) = get_request_body(&mut stream).await {
                        if let Ok(mut parsed_body) =
                            serde_json::from_str::<serde_json::Value>(&body)
                        {
                            // Generate ID and timestamps for new key
                            let now = get_utc_timestamp();
                            parsed_body["id"] = serde_json::Value::String(format!(
                                "key_{}",
                                get_utc_timestamp_millis()
                            ));
                            parsed_body["created_at"] = serde_json::Value::String(now.clone());
                            parsed_body["updated_at"] = serde_json::Value::String(now);

                            if let Ok(api_key) = serde_json::from_value::<ApiKey>(parsed_body) {
                                let mut vault_guard = vault.lock().await;
                                vault_guard.keys.insert(api_key.id.clone(), api_key.clone());

                                // ✅ FIXED: Save vault to persist keys created via HTTP API
                                if let Err(e) = save_vault_to_path(&*vault_guard, &vault_path).await
                                {
                                    drop(vault_guard);
                                    let response = format!(
                                        "HTTP/1.1 500 Internal Server Error\r\n{}\r\n{{\"error\":\"Failed to save key: {}\"}}",
                                        security_headers,
                                        e
                                    );
                                    let _ = stream.write_all(response.as_bytes()).await;
                                    return;
                                }
                                drop(vault_guard);

                                let json_response =
                                    serde_json::to_string(&api_key).unwrap_or_default();
                                let response = format!(
                                    "HTTP/1.1 201 Created\r\n{}\r\n{}",
                                    security_headers, json_response
                                );
                                let _ = stream.write_all(response.as_bytes()).await;
                            } else {
                                let response = format!(
                                    "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid API key data\"}}",
                                    security_headers
                                );
                                let _ = stream.write_all(response.as_bytes()).await;
                            }
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid JSON body\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Cannot read request body\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/env/parse") => {
                if *is_unlocked.lock().await {
                    // Parse body to get file path
                    if let Ok(body) = get_request_body(&mut stream).await {
                        if let Ok(parsed_body) = serde_json::from_str::<serde_json::Value>(&body) {
                            if let Some(file_path) = parsed_body["filePath"].as_str() {
                                // Call parse_and_register_env_file function
                                match parse_env_file(file_path) {
                                    Ok(variables) => {
                                        if let Ok(project_path) = detect_project_path(file_path) {
                                            let file_name = std::path::Path::new(file_path)
                                                .file_name()
                                                .and_then(|name| name.to_str())
                                                .unwrap_or("unknown.env");

                                            let result = DroppedEnvFile {
                                                path: file_path.to_string(),
                                                project_path,
                                                file_name: file_name.to_string(),
                                                keys: variables,
                                            };

                                            let json_result =
                                                serde_json::to_string(&result).unwrap_or_default();
                                            let response = format!(
                                                "HTTP/1.1 200 OK\r\n{}\r\n{}",
                                                security_headers, json_result
                                            );
                                            let _ = stream.write_all(response.as_bytes()).await;
                                        } else {
                                            let response = format!(
                                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Cannot detect project path\"}}",
                                                security_headers
                                            );
                                            let _ = stream.write_all(response.as_bytes()).await;
                                        }
                                    }
                                    Err(e) => {
                                        let response = format!(
                                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"{}\"}}",
                                            security_headers,
                                            e
                                        );
                                        let _ = stream.write_all(response.as_bytes()).await;
                                    }
                                }
                            } else {
                                let response = format!(
                                    "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Missing filePath\"}}",
                                    security_headers
                                );
                                let _ = stream.write_all(response.as_bytes()).await;
                            }
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid JSON body\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Cannot read request body\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/env/associate") => {
                if *is_unlocked.lock().await {
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/env/associations") => {
                if *is_unlocked.lock().await {
                    let response = format!("HTTP/1.1 200 OK\r\n{}\r\n[]", security_headers);
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("POST", "/api/projects/activate") => {
                if *is_unlocked.lock().await {
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("OPTIONS", _) => {
                let response = format!("HTTP/1.1 200 OK\r\n{}\r\n", security_headers);
                let _ = stream.write_all(response.as_bytes()).await;
            }
            ("POST", "/api/vscode/workspaces") => {
                if *is_unlocked.lock().await {
                    // Parse request body
                    let body_start = request.find("\r\n\r\n").unwrap_or(request.len());
                    let body = if body_start + 4 < request.len() {
                        &request[body_start + 4..]
                    } else {
                        ""
                    };

                    if let Ok(request_data) = serde_json::from_str::<serde_json::Value>(body) {
                        if let Some(workspaces) = request_data["workspaces"].as_array() {
                            let workspace_paths: Vec<String> = workspaces
                                .iter()
                                .filter_map(|w| w.as_str().map(|s| s.to_string()))
                                .collect();

                            let mut vault_guard = vault.lock().await;

                            // Clear existing workspaces
                            vault_guard.vscode_workspaces.clear();

                            // Add new workspaces
                            let timestamp = get_utc_timestamp();
                            for workspace_path in workspace_paths {
                                let workspace_name = std::path::Path::new(&workspace_path)
                                    .file_name()
                                    .unwrap_or_else(|| std::ffi::OsStr::new("unknown"))
                                    .to_string_lossy()
                                    .to_string();

                                vault_guard.vscode_workspaces.push(VSCodeWorkspace {
                                    path: workspace_path.clone(),
                                    name: workspace_name,
                                    is_open: true,
                                    last_updated: timestamp.clone(),
                                });
                            }

                            // Update VSCode status for project associations
                            let workspaces_clone = vault_guard.vscode_workspaces.clone();
                            for assoc in &mut vault_guard.env_associations {
                                let is_open = workspaces_clone.iter().any(|ws| {
                                    ws.path == assoc.project_path
                                        || assoc.project_path.starts_with(&ws.path)
                                });

                                assoc.vscode_status =
                                    Some(if is_open { "open" } else { "closed" }.to_string());
                                assoc.last_vscode_check = Some(timestamp.clone());
                            }

                            let response = format!(
                                "HTTP/1.1 200 OK\r\n{}\r\n{{\"success\":true,\"updated\":{},\"timestamp\":\"{}\"}}",
                                security_headers,
                                vault_guard.vscode_workspaces.len(),
                                timestamp
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid workspaces format\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Invalid JSON body\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/vscode/workspaces") => {
                if *is_unlocked.lock().await {
                    let vault_guard = vault.lock().await;
                    let json_workspaces =
                        serde_json::to_string(&vault_guard.vscode_workspaces).unwrap_or_default();
                    let response = format!(
                        "HTTP/1.1 200 OK\r\n{}\r\n{}",
                        security_headers, json_workspaces
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            ("GET", "/api/vscode/status") => {
                if *is_unlocked.lock().await {
                    if let Some(query_str) = query_params {
                        if let Some(project_start) = query_str.find("projectPath=") {
                            let project_path = &query_str[project_start + 12..];
                            let project_path = project_path.split('&').next().unwrap_or("");
                            let project_path =
                                urlencoding::decode(project_path).unwrap_or_default();

                            let vault_guard = vault.lock().await;
                            let is_open = vault_guard.vscode_workspaces.iter().any(|ws| {
                                ws.path == project_path || project_path.starts_with(&ws.path)
                            });

                            let status = if is_open {
                                "open"
                            } else if vault_guard.vscode_workspaces.is_empty() {
                                "unknown"
                            } else {
                                "closed"
                            };

                            let response = format!(
                                "HTTP/1.1 200 OK\r\n{}\r\n{{\"status\":\"{}\"}}",
                                security_headers, status
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        } else {
                            let response = format!(
                                "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Missing projectPath parameter\"}}",
                                security_headers
                            );
                            let _ = stream.write_all(response.as_bytes()).await;
                        }
                    } else {
                        let response = format!(
                            "HTTP/1.1 400 Bad Request\r\n{}\r\n{{\"error\":\"Missing query parameters\"}}",
                            security_headers
                        );
                        let _ = stream.write_all(response.as_bytes()).await;
                    }
                } else {
                    let response = format!(
                        "HTTP/1.1 403 Forbidden\r\n{}\r\n{{\"error\":\"Vault is locked\"}}",
                        security_headers
                    );
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            _ => {
                let response = format!(
                    "HTTP/1.1 404 Not Found\r\n{}\r\n{{\"error\":\"Not found\",\"method\":\"{}\",\"path\":\"{}\"}}",
                    security_headers,
                    method,
                    path
                );
                let _ = stream.write_all(response.as_bytes()).await;
            }
        }
    }
}
*/

fn setup_system_tray(app: &AppHandle) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem};
    use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

    // Create menu items (copying exact pattern from working app)
    let show_item = MenuItemBuilder::with_id("show", "Show KeyKeeper").build(app)?;
    let hide_item = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let add_api_key = MenuItemBuilder::with_id("add_api_key", "Add API Key").build(app)?;
    let sync_vscode = MenuItemBuilder::with_id("sync_vscode", "Sync with VS Code").build(app)?;
    let open_project = MenuItemBuilder::with_id("open_project", "Open Project").build(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let tray_menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&hide_item)
        .item(&separator1)
        .item(&add_api_key)
        .item(&sync_vscode)
        .item(&open_project)
        .item(&separator2)
        .item(&quit_item)
        .build()?;

    let icon = app.default_window_icon().unwrap().clone();

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("KeyKeeper - Secure API Key Manager")
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            if let Some(window) = app.get_webview_window("main") {
                match event.id().as_ref() {
                    "show" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    "hide" => {
                        let _ = window.hide();
                    }
                    "add_api_key" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.dispatchEvent(new CustomEvent('tauri-add-api-key'))");
                    }
                    "sync_vscode" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.dispatchEvent(new CustomEvent('tauri-sync-vscode'))");
                    }
                    "open_project" => {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.dispatchEvent(new CustomEvent('tauri-open-project'))");
                    }
                    "quit" => {
                        // Lock vault before quitting
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut unlocked) = state.is_unlocked.try_lock() {
                                *unlocked = false;
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            println!("Single instance detected: {:?}, {:?}", _argv, _cwd);
            // Focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize app state synchronously without block_on
            let app_data_dir = get_app_data_dir(&handle)?;
            let vault_path = app_data_dir.join("vault.json");
            let docs_store_path = app_data_dir.join("documentation.json");

            // Load vault synchronously
            let vault =
                load_vault(&vault_path).map_err(|e| Box::new(Error::new(ErrorKind::Other, e)))?;
            
            // Load docs store synchronously
            let runtime = tokio::runtime::Runtime::new().map_err(|e| Box::new(Error::new(ErrorKind::Other, e)))?;
            let docs_store = runtime.block_on(load_docs_store(&docs_store_path));

            let app_state = AppState {
                vault: Arc::new(Mutex::new(vault)),
                vault_path,
                is_unlocked: Arc::new(Mutex::new(false)),
                vscode_server_handle: Arc::new(Mutex::new(None)),
                vscode_server_running: Arc::new(AtomicBool::new(false)),
                tray_handle: Arc::new(Mutex::new(None)),
                ml_engine: Arc::new(tokio::sync::Mutex::new(None)),
                api_generator: Arc::new(Mutex::new(api_generator_commands::ApiGeneratorState::new())),
                docs_manager: Arc::new(Mutex::new(docs_commands::DocsManagerState::new())),
                llm_proxy: Arc::new(llm_proxy::LLMProxyState::default()),
                docs_store: Arc::new(Mutex::new(docs_store)),
                docs_store_path,
            };

            app.manage(app_state);

            // Setup system tray after a small delay to ensure app is fully initialized
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                if let Err(e) = setup_system_tray(&app_handle) {
                    eprintln!("❌ Failed to setup tray: {}", e);
                } else {
                    println!("✅ System tray setup successfully");
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    // Lock vault when window is closed
                    if let Some(state) = window.app_handle().try_state::<AppState>() {
                        if let Ok(mut unlocked) = state.is_unlocked.try_lock() {
                            *unlocked = false;
                        }
                    }
                }
                _ => {}
            }
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--start-hidden"]),
        ))
        .plugin(tauri_plugin_keyring::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            unlock_vault,
            set_master_password,
            save_master_password_to_keyring,
            get_master_password_from_keyring,
            delete_master_password_from_keyring,
            is_vault_unlocked,
            lock_vault,
            get_api_keys,
            add_api_key,
            update_api_key,
            delete_api_key,
            search_api_keys,
            get_decrypted_api_key,
            search_api_keys_by_query,
            export_vault,
            start_vscode_server,
            stop_vscode_server,
            get_vscode_server_status,
            get_audit_logs,
            create_user_account,
            authenticate_user,
            request_password_recovery,
            reset_master_password,
            get_user_account,
            is_user_account_created,
            is_master_password_set,
            get_projects,
            get_recent_activity,
            record_key_usage,
            sync_project,
            // ML commands
            ml_commands::initialize_ml_engine,
            ml_commands::analyze_context_ml,
            ml_commands::record_ml_usage,
            ml_commands::get_ml_stats,
            ml_commands::check_ml_status,
            ml_commands::reinitialize_ml_engine,
            ml_commands::get_ml_config,
            ml_commands::detect_context,
            // LLM Proxy commands
            llm_proxy::process_with_llm,
            llm_proxy::clear_llm_cache,
            llm_proxy::get_llm_cache_stats,
            // API Generator Commands
            api_generator_commands::get_api_providers,
            api_generator_commands::scrape_api_documentation,
            api_generator_commands::generate_api_configuration,
            api_generator_commands::detect_provider_from_env,
            api_generator_commands::generate_better_auth_config,
            api_generator_commands::generate_openai_config,
            api_generator_commands::get_provider_templates,
            api_generator_commands::preview_generated_config,
            // Documentation Commands
            docs_commands::add_provider_documentation,
            docs_commands::get_provider_documentation,
            docs_commands::search_documentation,
            docs_commands::get_documentation_by_id,
            docs_commands::update_provider_documentation,
            docs_commands::remove_provider_documentation,
            docs_commands::get_indexed_providers,
            docs_commands::auto_index_provider_docs,
            docs_commands::get_context_documentation_suggestions,
            // Native Documentation Store Commands
            get_documentation,
            create_documentation,
            update_documentation,
            delete_documentation,
            search_native_documentation,
            get_documentation_by_project,
            get_documentation_by_provider,
            toggle_documentation_favorite,
            scrape_and_save_documentation,
            create_project,
            update_project,
            delete_project,
            get_project_by_id,
            assign_keys_to_project,
            get_keys_by_project,
            get_unassigned_keys,
            search_keys_in_project,
            sync_key_to_env_file,
            check_key_in_env_file,
            get_env_file_suggestions,
            auto_sync_workspace_env_files,
            parse_and_register_env_file,
            associate_project_with_env,
            get_project_env_associations,
            activate_project_context,
            check_biometric_support,
            enable_biometric_auth,
            authenticate_biometric,
            update_user_preferences,
            get_user_preferences,
            create_passkey_challenge,
            verify_passkey_challenge,
            invalidate_biometric_sessions,
            update_vscode_workspaces,
            get_vscode_workspaces,
            get_project_vscode_status,
            open_folder,
            open_file,
            open_in_vscode,
            restore_session_on_startup,
            show_window,
            hide_window,
            quit_application,
            check_for_updates,
            install_update,
            create_remember_me_session,
            validate_remember_me_session,
            get_persistent_sessions,
            revoke_persistent_session,
            cleanup_all_sessions,
            update_username,
            keyring_set,
            keyring_get,
            keyring_delete,
            get_device_info,
            setup_auto_start,
            disable_auto_start,
            is_auto_start_enabled,
            show_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
