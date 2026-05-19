use std::path::{Path, PathBuf};
use std::process::Command;

fn non_empty_env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

fn resolve_project_root() -> Result<PathBuf, String> {
    if let Some(project_root) = non_empty_env("AI_OPS_STUDIO_PROJECT_ROOT") {
        return Ok(PathBuf::from(project_root));
    }

    std::env::current_dir()
        .map_err(|error| format!("failed to resolve current directory: {error}"))
}

fn make_absolute_path(path: PathBuf) -> Result<PathBuf, String> {
    if path.is_absolute() {
        return Ok(path);
    }

    std::env::current_dir()
        .map(|current_dir| current_dir.join(path))
        .map_err(|error| format!("failed to resolve current directory: {error}"))
}

fn canonicalize_cli_bin(path: &Path) -> Result<PathBuf, String> {
    if !path.exists() {
        return Err(format!("CLI build missing: {}", path.display()));
    }

    path.canonicalize()
        .map_err(|error| format!("failed to resolve CLI bin: {}: {error}", path.display()))
}

fn resolve_cli_bin() -> Result<PathBuf, String> {
    let candidate = non_empty_env("AI_OPS_CLI_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../cli/dist/bin/index.js"));

    canonicalize_cli_bin(&make_absolute_path(candidate)?)
}

fn output_to_string(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).trim().to_string()
}

#[tauri::command]
fn load_studio_snapshot() -> Result<String, String> {
    let project_root = resolve_project_root()?;
    let cli_bin = resolve_cli_bin()?;

    let output = Command::new("node")
        .arg(&cli_bin)
        .arg("studio")
        .arg("snapshot")
        .arg("--json")
        .current_dir(&project_root)
        .output()
        .map_err(|error| format!("failed to run studio snapshot: {error}"))?;

    if !output.status.success() {
        let stderr = output_to_string(&output.stderr);
        let stdout = output_to_string(&output.stdout);
        let detail = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("studio snapshot failed: {detail}"));
    }

    String::from_utf8(output.stdout)
        .map_err(|error| format!("studio snapshot stdout was not UTF-8: {error}"))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_studio_snapshot])
        .run(tauri::generate_context!())
        .expect("failed to run ai-ops Studio");
}
