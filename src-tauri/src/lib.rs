// src-tauri/src/lib.rs
// Library entry point — required by Cargo.toml [lib] declaration.
// Tauri mobile builds need this; desktop-only builds don't strictly need it
// but we keep it for forward compatibility.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}