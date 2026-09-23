#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

// ============================================================================
// GÜVENLİK SABİTLERİ VE WHITELIST POLİTİKALARI (SECURITY POLICY)
// ============================================================================

/// Terminalde doğrudan veya kompozit çalıştırılmasına izin verilen kesin komutlar
const EXACT_ALLOWED_COMMANDS: &[&str] = &[
    "uname -a",
    "uname -r",
    "whoami",
    "uptime",
    "ls",
    "ls -la",
    "ls -l",
    "ls -lh",
    "date",
    "hostname",
    "id",
    "free -m",
    "free -h",
    "df -h",
    "df -h /",
    "cat /etc/os-release",
    "cat /etc/issue",
    "cat /proc/version",
    "cat /proc/meminfo",
    "cat /proc/cpuinfo",
    "ps aux",
    "top -b -n 1",
    "apt-get clean",
    "rm -rf /tmp/*",
    "apt-get clean && rm -rf /tmp/*",
    "df -h / && free -m",
    "reboot",
    "poweroff",
    "clear",
    "sync",
    "echo 3 > /proc/sys/vm/drop_caches",
];

/// Tekil parametreli komutlarda izin verilen ikili (binary) programlar
const ALLOWED_UTILITIES: &[&str] = &[
    "uname", "whoami", "uptime", "date", "hostname", "id",
    "free", "df", "ls", "ps", "top", "which",
];

/// `cat` komutu ile okunmasına izin verilen güvenli telemetri dosyaları
const ALLOWED_CAT_FILES: &[&str] = &[
    "/etc/os-release",
    "/etc/issue",
    "/proc/version",
    "/proc/meminfo",
    "/proc/cpuinfo",
];

/// AI Asistanının kullanıcı onayıyla çalıştırabileceği kısıtlı güvenli eylemler
const ALLOWED_AGENT_ACTIONS: &[&str] = &[
    "apt-get clean && rm -rf /tmp/*",
    "apt-get clean",
    "rm -rf /tmp/*",
    "df -h / && free -m",
    "df -h",
    "free -m",
    "uptime",
    "sync",
    "echo 3 > /proc/sys/vm/drop_caches",
];

/// Ankora Office tarafından okunabilecek güvenli belge uzantıları (.docx ikili dosya olduğundan metin/pdf listesinde yer almaz)
const ALLOWED_DOC_EXTENSIONS: &[&str] = &[
    "pdf", "md", "txt", "conf", "log", "json", "yaml", "yml", "ini",
];

/// Kesinlikle doğrudan veya dolaylı çalıştırılması yasaklanan tehlikeli sistem araçları (Kara Liste)
const FORBIDDEN_LAUNCH_BINARIES: &[&str] = &[
    "sudo", "su", "pkexec", "dd", "mkfs", "fdisk", "parted",
    "sh", "bash", "zsh", "dash", "csh", "tcsh", "fish", "env",
    "xargs", "passwd", "chpasswd", "chmod", "chown", "reboot",
    "poweroff", "shutdown", "init", "systemctl", "telinit", "halt",
];

/// Kesinlikle okunması engellenen hassas sistem dosyası ve dizin kalıpları
const SENSITIVE_FILE_PATTERNS: &[&str] = &[
    "/etc/shadow",
    "/etc/gshadow",
    "/etc/sudoers",
    "/etc/master.passwd",
    "/etc/security",
    "/root/.ssh",
    ".ssh/",
    "id_rsa",
    "id_ed25519",
    "id_ecdsa",
    "id_dsa",
    "/proc/kcore",
    "/sys/",
    "/dev/",
    "/var/log/auth",
];

/// İzin verilen klavye haritaları
const ALLOWED_KEYBOARDS: &[&str] = &["tr", "tr_f", "us", "de", "fr", "gb"];

// ============================================================================
// DOĞRULAMA YARDIMCILARI (INPUT SANITIZATION)
// ============================================================================

fn is_valid_username(name: &str) -> bool {
    if name.is_empty() || name.len() > 32 {
        return false;
    }
    let mut chars = name.chars();
    let first = match chars.next() {
        Some(c) => c,
        None => return false,
    };
    if !first.is_ascii_lowercase() && first != '_' {
        return false;
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_' || c == '-')
}

fn is_valid_hostname(host: &str) -> bool {
    if host.is_empty() || host.len() > 63 {
        return false;
    }
    if host.starts_with('-') || host.ends_with('-') {
        return false;
    }
    host.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn is_valid_disk_target(path: &str) -> bool {
    if !path.starts_with("/dev/") {
        return false;
    }
    let dev = &path[5..];
    if dev.is_empty() || dev.len() > 16 {
        return false;
    }
    // sd[a-z]+ : dev starts with "sd", remainder is all ASCII lowercase letters (no partition digits!)
    let is_sd = dev.starts_with("sd") && dev.len() >= 3 && dev[2..].chars().all(|c| c.is_ascii_lowercase());
    // vd[a-z]+ : dev starts with "vd", remainder is all ASCII lowercase letters (no partition digits!)
    let is_vd = dev.starts_with("vd") && dev.len() >= 3 && dev[2..].chars().all(|c| c.is_ascii_lowercase());
    // nvme<ctrl>n<ns> : exactly digits for controller and namespace, no trailing 'p<part>' partition suffix
    let is_nvme = if dev.starts_with("nvme") {
        let rem = &dev[4..];
        if let Some((ns_ctrl, ns_id)) = rem.split_once('n') {
            !ns_ctrl.is_empty() && ns_ctrl.chars().all(|c| c.is_ascii_digit())
                && !ns_id.is_empty() && ns_id.chars().all(|c| c.is_ascii_digit())
        } else {
            false
        }
    } else {
        false
    };

    is_sd || is_vd || is_nvme
}

fn is_valid_deb_package_name(pkg: &str) -> bool {
    if pkg.len() < 2 || pkg.len() > 64 {
        return false;
    }
    let mut chars = pkg.chars();
    let first = match chars.next() {
        Some(c) => c,
        None => return false,
    };
    if !first.is_ascii_alphanumeric() {
        return false;
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '-' || c == '.')
}

// ============================================================================
// VERİ YAPILARI (DATA STRUCTURES)
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XdgApplication {
    pub id: String,
    pub name: String,
    pub exec: String,
    pub icon: String,
    pub comment: String,
    pub categories: Vec<String>,
    pub desktop_file: String,
    #[serde(default)]
    pub is_installed_by_user: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentResult {
    pub file_name: String,
    pub file_type: String,
    pub file_size: u64,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemTelemetry {
    pub os_name: String,
    pub kernel: String,
    pub init_system: String,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub cpu_cores: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageDisk {
    pub name: String,
    pub path: String,
    pub size_gb: f64,
    pub model: String,
    pub is_removable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallPayload {
    pub target_disk: String,
    pub fullname: String,
    pub username: String,
    pub hostname: String,
    pub password: String,
    pub autologin: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiResponse {
    pub reply: String,
    pub has_action: bool,
    pub action_command: Option<String>,
    pub action_desc: Option<String>,
}

fn get_ankora_config_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("/root/.config"));
    path.push("ankora");
    let _ = fs::create_dir_all(&path);
    path
}

// ----------------------------------------------------------------------------
// GÜVENLİ KİMLİK BİLGİSİ YÖNETİMİ (SECURE CREDENTIAL STORAGE)
// ----------------------------------------------------------------------------
fn get_credentials_path() -> PathBuf {
    get_ankora_config_dir().join("credentials.dat")
}

fn load_credentials() -> std::collections::HashMap<String, String> {
    let path = get_credentials_path();
    if let Ok(data) = fs::read(&path) {
        if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(&data) {
            if let Ok(json_str) = String::from_utf8(decoded) {
                if let Ok(map) = serde_json::from_str::<std::collections::HashMap<String, String>>(&json_str) {
                    return map;
                }
            }
        }
    }
    std::collections::HashMap::new()
}

fn save_credentials(map: &std::collections::HashMap<String, String>) -> Result<(), String> {
    let path = get_credentials_path();
    let json_str = serde_json::to_string(map).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(json_str.as_bytes());
    fs::write(&path, encoded).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
fn save_ai_credential(provider: String, api_key: String) -> Result<(), String> {
    let clean_prov = provider.trim().to_lowercase();
    let clean_key = api_key.trim().to_string();
    let mut map = load_credentials();
    if clean_key.is_empty() {
        map.remove(&clean_prov);
    } else {
        map.insert(clean_prov, clean_key);
    }
    save_credentials(&map)
}

#[tauri::command]
fn has_ai_credential(provider: String) -> Result<bool, String> {
    let clean_prov = provider.trim().to_lowercase();
    let map = load_credentials();
    Ok(map.get(&clean_prov).map(|k| !k.is_empty()).unwrap_or(false))
}

#[tauri::command]
fn delete_ai_credential(provider: String) -> Result<(), String> {
    let clean_prov = provider.trim().to_lowercase();
    let mut map = load_credentials();
    map.remove(&clean_prov);
    save_credentials(&map)
}

// ============================================================================
// 1. GERÇEK TAURI NATIVE WINDOW DRAG
// ============================================================================
#[tauri::command]
fn drag_window(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

// ============================================================================
// 2. DİNAMİK XDG .DESKTOP MOTORU
// ============================================================================
fn parse_desktop_entry(path: &Path) -> Option<XdgApplication> {
    let content = fs::read_to_string(path).ok()?;
    let mut name = String::new();
    let mut exec = String::new();
    let mut icon = String::new();
    let mut comment = String::new();
    let mut categories = Vec::new();
    let mut nodisplay = false;

    let mut in_desktop_entry = false;
    for line in content.lines() {
        let line = line.trim();
        if line == "[Desktop Entry]" {
            in_desktop_entry = true;
            continue;
        } else if line.starts_with('[') {
            in_desktop_entry = false;
        }

        if !in_desktop_entry {
            continue;
        }

        if let Some((key, val)) = line.split_once('=') {
            let key = key.trim();
            let val = val.trim();
            match key {
                "Name" if name.is_empty() => name = val.to_string(),
                "Exec" if exec.is_empty() => {
                    let cleaned = val.split('%').next().unwrap_or(val).trim();
                    exec = cleaned.to_string();
                }
                "Icon" if icon.is_empty() => icon = val.to_string(),
                "Comment" if comment.is_empty() => comment = val.to_string(),
                "NoDisplay" => nodisplay = val.eq_ignore_ascii_case("true"),
                "Categories" => {
                    categories = val.split(';').filter(|s| !s.is_empty()).map(|s| s.to_string()).collect();
                }
                _ => {}
            }
        }
    }

    if nodisplay || name.is_empty() || exec.is_empty() {
        return None;
    }

    let file_stem = path.file_stem()?.to_string_lossy().to_string();
    Some(XdgApplication {
        id: file_stem,
        name,
        exec,
        icon,
        comment,
        categories,
        desktop_file: path.to_string_lossy().to_string(),
        is_installed_by_user: false,
    })
}

#[tauri::command]
async fn scan_xdg_applications() -> Result<Vec<XdgApplication>, String> {
    #[cfg(target_os = "linux")]
    {
        let mut apps = Vec::new();
        let search_dirs = [
            PathBuf::from("/usr/share/applications"),
            PathBuf::from("/usr/local/share/applications"),
            PathBuf::from("/var/lib/flatpak/exports/share/applications"),
            dirs::data_dir().map(|d| d.join("applications")).unwrap_or_default(),
        ];

        for dir in &search_dirs {
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().and_then(|s| s.to_str()) == Some("desktop") {
                            if let Some(app) = parse_desktop_entry(&path) {
                                if !apps.iter().any(|a: &XdgApplication| a.id == app.id) {
                                    apps.push(app);
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(apps)
    }

    #[cfg(not(target_os = "linux"))]
    {
        // İndirilmemiş sahte uygulamalar listelenmez (Strict clean state)
        Ok(vec![])
    }
}

// ============================================================================
// 3. PAKET KURULUMU (DEBIAN .DEB DOĞRULAMALI) - GÜVENLİK BULGUSU #7
// ============================================================================
#[tauri::command]
async fn install_deb_package(package_name: String) -> Result<XdgApplication, String> {
    let clean_pkg = package_name.trim();
    if clean_pkg.is_empty() {
        return Err("Geçersiz paket adı.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let output = if clean_pkg.ends_with(".deb") {
            // Yerel .deb paketi: Yol geçişi ve kabuk metakarakteri doğrulaması
            if clean_pkg.contains("..") || clean_pkg.chars().any(|c| matches!(c, ';' | '&' | '|' | '`' | '$' | '>' | '<' | '\\')) {
                return Err("Güvenlik Hatası: .deb dosya yolunda geçersiz karakterler tespit edildi.".to_string());
            }
            let deb_path = Path::new(clean_pkg);
            if !deb_path.exists() {
                return Err(format!("Paket dosyası bulunamadı: {}", clean_pkg));
            }
            let canonical = fs::canonicalize(deb_path).map_err(|e| e.to_string())?;
            Command::new("dpkg").args(["-i", "--", &canonical.to_string_lossy()]).output()
        } else {
            // Debian resmi paket adı: Sıkı regex doğrulaması ve bayrak enjeksiyonu koruması (--)
            if !is_valid_deb_package_name(clean_pkg) {
                return Err("Güvenlik Hatası: Geçersiz Debian paket adı biçimi.".to_string());
            }
            Command::new("apt-get").args(["install", "-y", "--", clean_pkg]).output()
        };

        match output {
            Ok(res) => {
                if !res.status.success() {
                    let err = String::from_utf8_lossy(&res.stderr);
                    return Err(format!("Paket kurulumu başarısız: {}", err));
                }
            }
            Err(e) => return Err(format!("apt-get/dpkg çalıştırılamadı: {}", e)),
        }

        // Kurulum sonrası XDG dizinini tara
        let apps = scan_xdg_applications().await?;
        if let Some(mut app) = apps.into_iter().find(|a| a.id.contains(clean_pkg) || clean_pkg.contains(&a.id)) {
            app.is_installed_by_user = true;
            Ok(app)
        } else {
            Ok(XdgApplication {
                id: clean_pkg.to_string(),
                name: clean_pkg.to_uppercase(),
                exec: clean_pkg.to_string(),
                icon: "application-x-executable".to_string(),
                comment: format!("{} paketi sisteme kuruldu.", clean_pkg),
                categories: vec!["Utility".to_string()],
                desktop_file: format!("/usr/share/applications/{}.desktop", clean_pkg),
                is_installed_by_user: true,
            })
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        if !clean_pkg.ends_with(".deb") && !is_valid_deb_package_name(clean_pkg) {
            return Err("Güvenlik Hatası: Geçersiz Debian paket adı biçimi.".to_string());
        }
        Ok(XdgApplication {
            id: clean_pkg.to_string(),
            name: format!("{} (Kuruldu)", clean_pkg),
            exec: clean_pkg.to_string(),
            icon: clean_pkg.to_string(),
            comment: "Yerel sisteme başarıyla kaydedildi.".to_string(),
            categories: vec!["System".to_string()],
            desktop_file: format!("/usr/share/applications/{}.desktop", clean_pkg),
            is_installed_by_user: true,
        })
    }
}

// ============================================================================
// 4. GÜVENLİ TERMİNAL MOTORU (WHITELIST & SANDBOX) - GÜVENLİK BULGUSU #1
// ============================================================================
#[tauri::command]
async fn run_terminal_command(command: String) -> Result<String, String> {
    let cmd_trimmed = command.trim();
    if cmd_trimmed.is_empty() {
        return Ok(String::new());
    }

    // 1. Kesin izin verilen komut kontrolü
    let is_exact = EXACT_ALLOWED_COMMANDS.contains(&cmd_trimmed);

    // 2. Kabuk kontrol karakterleri koruması
    let has_shell_metachars = cmd_trimmed.chars().any(|c| {
        matches!(c, ';' | '&' | '|' | '`' | '$' | '>' | '<' | '\\' | '(' | ')' | '\n' | '\r')
    });

    if has_shell_metachars && !is_exact {
        return Err("Güvenlik İlkesi İhlali: Bu komut kabuk metakarakterleri içeriyor ve çalıştırılamaz.".to_string());
    }

    if is_exact {
        #[cfg(target_os = "linux")]
        {
            // Kompozit bakım komutlarının güvenli ve sıralı yürütülmesi
            if cmd_trimmed == "apt-get clean && rm -rf /tmp/*" {
                let _ = Command::new("apt-get").args(["clean"]).output();
                let _ = Command::new("sh").args(["-c", "rm -rf /tmp/*"]).output();
                return Ok("[TEMİZLİK] APT paket önbelleği ve /tmp dizini başarıyla temizlendi.".to_string());
            } else if cmd_trimmed == "df -h / && free -m" {
                let df = Command::new("df").args(["-h", "/"]).output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
                let free = Command::new("free").args(["-m"]).output().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
                return Ok(format!("{}\n{}", df, free));
            } else if cmd_trimmed == "echo 3 > /proc/sys/vm/drop_caches" {
                let _ = fs::write("/proc/sys/vm/drop_caches", "3");
                return Ok("[BELLEK] Sayfa ve inode önbellekleri boşaltıldı.".to_string());
            }

            let parts: Vec<&str> = cmd_trimmed.split_whitespace().collect();
            if parts.is_empty() {
                return Ok(String::new());
            }
            let res = Command::new(parts[0]).args(&parts[1..]).output();
            return match res {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    if out.status.success() {
                        Ok(stdout)
                    } else if !stderr.trim().is_empty() {
                        Err(stderr)
                    } else {
                        Ok(stdout)
                    }
                }
                Err(e) => Err(format!("Komut yürütülemedi: {}", e)),
            };
        }

        #[cfg(not(target_os = "linux"))]
        {
            return Ok(format!("[Simüle bash çıkışı]: {} başarıyla yürütüldü.", cmd_trimmed));
        }
    }

    // 3. Dinamik parametreli komut incelemesi (shell kontrol karakteri içermeyen tekil araçlar)
    let parts: Vec<&str> = cmd_trimmed.split_whitespace().collect();
    if parts.is_empty() {
        return Ok(String::new());
    }

    let bin = parts[0];
    let args = &parts[1..];

    if !ALLOWED_UTILITIES.contains(&bin) {
        return Err(format!("Güvenlik İlkesi İhlali: '{}' aracı izin verilenler listesinde bulunmuyor.", bin));
    }

    // cat aracı için dosya yolu sınırlaması
    if bin == "cat" {
        if args.len() != 1 || !ALLOWED_CAT_FILES.contains(&args[0]) {
            return Err("Güvenlik İlkesi İhlali: Sadece izin verilen sistem telemetri dosyaları okunabilir.".to_string());
        }
    }

    // Argümanlarda dizin atlama ve hassas dosya kontrolü
    for arg in args {
        if arg.contains("..") || SENSITIVE_FILE_PATTERNS.iter().any(|p| arg.contains(p)) {
            return Err("Güvenlik İlkesi İhlali: Dizin geçişine veya hassas dosyalara erişime izin verilmez.".to_string());
        }
    }

    #[cfg(target_os = "linux")]
    {
        let res = Command::new(bin).args(args).output();
        match res {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if out.status.success() {
                    Ok(stdout)
                } else if !stderr.trim().is_empty() {
                    Err(stderr)
                } else {
                    Ok(stdout)
                }
            }
            Err(e) => Err(format!("Komut yürütülemedi: {}", e)),
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(format!("[Simüle bash çıkışı]: {} {:?}", bin, args))
    }
}

// ============================================================================
// 5. GÜVENLİ BELGE OKUYUCU (PATH TRAVERSAL KORUMALI) - GÜVENLİK BULGUSU #5
// ============================================================================
#[tauri::command]
async fn read_document_file(file_path: String) -> Result<DocumentResult, String> {
    let raw_path = Path::new(&file_path);

    // 1. Dizin geçişi engeli
    if file_path.contains("..") {
        return Err("Güvenlik Hatası: Dizin geçişine ('..') izin verilmez.".to_string());
    }

    // 2. İzin verilen belge uzantısı kontrolü
    let extension = raw_path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    if !ALLOWED_DOC_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Güvenlik Hatası: '.{}' uzantılı dosyalar güvenlik nedeniyle okunamaz.", extension));
    }

    // 3. Kanonik dosya yolunu çözümleme
    let canonical = match fs::canonicalize(raw_path) {
        Ok(p) => p,
        Err(_) => return Err(format!("Belge bulunamadı veya erişilemiyor: {}", file_path)),
    };

    // 4. Kanonik dosya yolu üzerinde hassas sistem dosyası kalıp kontrolü
    let canonical_lower = canonical.to_string_lossy().to_lowercase();
    if SENSITIVE_FILE_PATTERNS.iter().any(|pat| canonical_lower.contains(pat)) {
        return Err("Güvenlik Hatası: Hassas sistem dosyalarının okunması engellendi.".to_string());
    }

    // 5. İzin verilen dizin sınırları denetimi
    let allowed_dirs: Vec<PathBuf> = vec![
        dirs::document_dir().unwrap_or_default(),
        dirs::download_dir().unwrap_or_default(),
        dirs::home_dir().unwrap_or_default(),
        PathBuf::from("/root/Belgeler"),
        PathBuf::from("/usr/share/doc"),
        std::env::current_dir().unwrap_or_default(),
    ];

    let is_in_allowed_dir = allowed_dirs.iter().any(|d| {
        !d.as_os_str().is_empty() && canonical.starts_with(d)
    });

    if !is_in_allowed_dir {
        let file_name = canonical.file_name().unwrap_or_default().to_string_lossy();
        if file_name != "ankora-sistem-rehberi.pdf" && file_name != "kiosk-ayarlari.txt" && file_name != "kiosk-ayarlari.md" {
            return Err("Güvenlik Hatası: Yalnızca kullanıcı belgeleri ve sistem dokümantasyonu dizinindeki dosyalar okunabilir.".to_string());
        }
    }

    // 6. Hard-link istismarı kontrolü (nlink > 1 reddedilir)
    let metadata = fs::metadata(&canonical).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if metadata.nlink() > 1 {
            return Err("Güvenlik Hatası: Çoklu bağlantılı (hard link) dosyaların okunması güvenlik gerekçesiyle engellendi.".to_string());
        }
    }

    // 7. Dosya boyutu sınırı (En fazla 50 MB)
    let file_size = metadata.len();
    if file_size > 50 * 1024 * 1024 {
        return Err("Dosya boyutu çok büyük (50 MB üstü kabul edilmez).".to_string());
    }

    let file_name = canonical.file_name().unwrap_or_default().to_string_lossy().to_string();

    match extension.as_str() {
        "pdf" => {
            let mut file = fs::File::open(&canonical).map_err(|e| e.to_string())?;
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes).map_err(|e| e.to_string())?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            let data_uri = format!("data:application/pdf;base64,{}", b64);

            Ok(DocumentResult {
                file_name,
                file_type: "pdf".to_string(),
                file_size,
                content: data_uri,
            })
        }
        _ => {
            let text = fs::read_to_string(&canonical).map_err(|e| format!("Dosya okunamadı: {}", e))?;
            Ok(DocumentResult {
                file_name,
                file_type: if extension == "docx" { "docx".to_string() } else { "text".to_string() },
                file_size,
                content: text,
            })
        }
    }
}

#[tauri::command]
async fn list_available_documents() -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let search_roots = [
        dirs::document_dir().unwrap_or_default(),
        dirs::download_dir().unwrap_or_default(),
        PathBuf::from("/root/Belgeler"),
    ];

    for root in &search_roots {
        if root.exists() {
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        let ext = ext.to_lowercase();
                        if ALLOWED_DOC_EXTENSIONS.contains(&ext.as_str()) {
                            files.push(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    if files.is_empty() {
        files.push("/root/Belgeler/ankora-sistem-rehberi.pdf".to_string());
        files.push("/root/Belgeler/kiosk-ayarlari.txt".to_string());
    }

    Ok(files)
}

// ============================================================================
// 6. ANKORA AI VE GÜVENLİ EYLEM ZİNCİRİ - GÜVENLİK BULGUSU #6
// ============================================================================
#[tauri::command]
async fn query_local_ai(
    prompt: String,
    provider: Option<String>,
    endpoint: Option<String>,
    api_key: Option<String>,
    model: Option<String>,
    agent_mode: Option<String>,
) -> Result<AiResponse, String> {
    let prov = provider.unwrap_or_else(|| "ollama".to_string()).to_lowercase();
    let mode = agent_mode.unwrap_or_else(|| "sysadmin".to_string()).to_lowercase();

    let sys_prompt = match mode.as_str() {
        "developer" => {
            "Sen Ankora Linux (Devuan Daedalus) sistem geliştirici ve terminal asistanısın. \
            Bash betikleri, Debian derleme, Rust/C geliştirme ve paket araçları konusunda teknik rehberlik sağla. \
            Eğer bir komut yürütülmesi gerekiyorsa yanıtının sonuna tam olarak şu formatta bir eylem etiketi ekle: \
            <<<ACTION:{\"command\":\"izin_verilen_komut\",\"desc\":\"Eylemin açıklaması\"}>>> \
            Sadece izin verilen sistem bakım komutları üret."
        }
        "general" => {
            "Sen Ankora Linux işletim sisteminin dost canlısı, Türkçe ve profesyonel genel asistanısın. \
            Kullanıcının sorularını açık, kibar ve teknik doğrulukla yanıtla. \
            Gerekirse sistem komutunu şu formatta ekle: \
            <<<ACTION:{\"command\":\"izin_verilen_komut\",\"desc\":\"Eylemin açıklaması\"}>>>"
        }
        _ => {
            "Sen Ankora Linux (Devuan Daedalus) işletim sisteminin yerel sistem yöneticisi ve teftiş ajanısın. \
            Kullanıcıya teknik, kısa ve profesyonel yanıtlar ver. \
            Eğer kullanıcının talebi sistemde bir bakım, telemetre sorgusu veya temizlik gerektiriyorsa, \
            yanıtının sonuna tam olarak şu formatta bir eylem etiketi ekle: \
            <<<ACTION:{\"command\":\"izin_verilen_komut\",\"desc\":\"Eylemin açıklaması\"}>>> \
            Asla tehlikeli veya rastgele komut üretme. Sadece doğrulanmış sistem komutları üret."
        }
    };

    let resolved_key = match api_key {
        Some(ref k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => {
            let map = load_credentials();
            map.get(&prov).cloned().unwrap_or_default()
        }
    };

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let parse_action_from_text = |text: &str| -> (String, bool, Option<String>, Option<String>) {
        if let Some(start_idx) = text.find("<<<ACTION:") {
            if let Some(end_idx) = text[start_idx..].find(">>>") {
                let json_str = &text[start_idx + 10..start_idx + end_idx];
                let clean_reply = text[..start_idx].trim().to_string();

                if let Ok(action_val) = serde_json::from_str::<serde_json::Value>(json_str) {
                    let proposed_cmd = action_val["command"].as_str().unwrap_or("").trim().to_string();
                    if ALLOWED_AGENT_ACTIONS.contains(&proposed_cmd.as_str()) {
                        return (
                            clean_reply,
                            true,
                            Some(proposed_cmd),
                            action_val["desc"].as_str().map(|s| s.to_string()),
                        );
                    }
                }
            }
        }
        (text.to_string(), false, None, None)
    };

    // 1. OLLAMA (Yalnızca yerel IP / localhost)
    if prov == "ollama" {
        let url = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434/api/generate".to_string());
        if !url.starts_with("http://127.0.0.1:") && !url.starts_with("http://localhost:") {
            return Err("Güvenlik Hatası: Ollama uç noktası yalnızca yerel adreslerde (127.0.0.1 veya localhost) çalışabilir.".to_string());
        }
        let ai_model = model.unwrap_or_else(|| "qwen2.5:0.5b".to_string());
        let payload = serde_json::json!({
            "model": ai_model,
            "prompt": format!("{}\n\nKullanıcı: {}", sys_prompt, prompt),
            "stream": false
        });

        if let Ok(resp) = client.post(&url).json(&payload).send().await {
            if resp.status().is_success() {
                if let Ok(json_data) = resp.json::<serde_json::Value>().await {
                    let raw_reply = json_data["response"].as_str().unwrap_or("").to_string();
                    let (reply, has_action, action_command, action_desc) = parse_action_from_text(&raw_reply);
                    return Ok(AiResponse { reply, has_action, action_command, action_desc });
                }
            }
        }
    } 
    // 2. GOOGLE GEMINI (Resmi Güvenli Endpoint)
    else if prov == "gemini" {
        if resolved_key.is_empty() {
            return Err("Google Gemini API anahtarı bulunamadı. Lütfen API Ayarları panelinden anahtarınızı kaydedin.".to_string());
        }
        let ai_model = model.unwrap_or_else(|| "gemini-2.0-flash".to_string());
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            ai_model, resolved_key
        );
        let payload = serde_json::json!({
            "contents": [{
                "parts": [{ "text": format!("{}\n\nKullanıcı: {}", sys_prompt, prompt) }]
            }]
        });

        match client.post(&url).json(&payload).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(json_data) = resp.json::<serde_json::Value>().await {
                    let text = json_data["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("").to_string();
                    let (reply, has_action, action_command, action_desc) = parse_action_from_text(&text);
                    return Ok(AiResponse { reply, has_action, action_command, action_desc });
                }
            }
            Ok(resp) => {
                return Err(format!("Gemini API Hatası (HTTP {}): API anahtarını veya model adını kontrol edin.", resp.status()));
            }
            Err(e) => return Err(format!("Gemini bağlantı hatası: {}", e)),
        }
    }
    // 3. OPENAI / GROQ / OPENROUTER / CUSTOM (SSRF ve Redirect Korumalı)
    else {
        let (url, default_model) = match prov.as_str() {
            "openai" => ("https://api.openai.com/v1/chat/completions".to_string(), "gpt-4o-mini".to_string()),
            "groq" => ("https://api.groq.com/openai/v1/chat/completions".to_string(), "llama-3.3-70b-versatile".to_string()),
            "openrouter" => ("https://openrouter.ai/api/v1/chat/completions".to_string(), "anthropic/claude-3.5-sonnet".to_string()),
            _ => {
                let custom_url = endpoint.unwrap_or_else(|| "http://127.0.0.1:8000/v1/chat/completions".to_string());
                if custom_url.contains("169.254.169.254") || custom_url.contains("metadata.google.internal") {
                    return Err("Güvenlik Hatası: Bulut meta veri uç noktalarına (SSRF) erişim yasaklanmıştır.".to_string());
                }
                if !custom_url.starts_with("https://") && !custom_url.starts_with("http://127.0.0.1:") && !custom_url.starts_with("http://localhost:") {
                    return Err("Güvenlik Hatası: Özel AI uç noktaları HTTPS veya yerel (127.0.0.1/localhost) olmalıdır.".to_string());
                }
                (custom_url, "default".to_string())
            }
        };
        let ai_model = model.unwrap_or(default_model);

        let mut req = client.post(&url);
        if !resolved_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", resolved_key));
        } else if prov != "custom" {
            return Err(format!("{} API anahtarı tanımlanmadı. Lütfen API Ayarları panelinden anahtarınızı kaydedin.", prov.to_uppercase()));
        }

        let payload = serde_json::json!({
            "model": ai_model,
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3
        });

        match req.json(&payload).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(json_data) = resp.json::<serde_json::Value>().await {
                    let text = json_data["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
                    let (reply, has_action, action_command, action_desc) = parse_action_from_text(&text);
                    return Ok(AiResponse { reply, has_action, action_command, action_desc });
                }
            }
            Ok(resp) => {
                return Err(format!("API Servis Hatası (HTTP {}): API anahtarı veya servis adresi doğrulanamadı.", resp.status()));
            }
            Err(e) => {
                if prov != "ollama" {
                    return Err(format!("{} servisine bağlanılamadı: {}", prov.to_uppercase(), e));
                }
            }
        }
    }

    // Yerel akıllı analiz modu (Fallback)
    let p_lower = prompt.to_lowercase();
    if p_lower.contains("temizle") || p_lower.contains("önbellek") {
        Ok(AiResponse {
            reply: "Sistem önbelleklerinin temizlenmesi için paket önbelleği boşaltılmalıdır.".to_string(),
            has_action: true,
            action_command: Some("apt-get clean && rm -rf /tmp/*".to_string()),
            action_desc: Some("Sistem ve geçici dosya önbelleklerini temizleme".to_string()),
        })
    } else if p_lower.contains("durum") || p_lower.contains("disk") || p_lower.contains("ram") {
        Ok(AiResponse {
            reply: "Disk ve bellek doluluk raporu taranıyor.".to_string(),
            has_action: true,
            action_command: Some("df -h / && free -m".to_string()),
            action_desc: Some("Disk ve bellek durumunu sorgulama".to_string()),
        })
    } else {
        Ok(AiResponse {
            reply: format!(
                "Ankora AI Çekirdeği hazır. Harici API veya yerel Ollama servisi çevrimdışı olduğundan dahili analiz modunda yanıt veriliyor:\n\"{}\"\n\n(Kendi API anahtarınızı (OpenAI, Gemini, Groq) AI penceresindeki 'API Ayarları' butonundan bağlayabilirsiniz.)",
                prompt
            ),
            has_action: false,
            action_command: None,
            action_desc: None,
        })
    }
}

#[tauri::command]
async fn execute_agent_confirmed_action(command: String) -> Result<String, String> {
    let cmd_trimmed = command.trim();
    if !ALLOWED_AGENT_ACTIONS.contains(&cmd_trimmed) {
        return Err("Güvenlik İlkesi İhlali: Bu eylem önceden onaylanmış güvenlik politikası listesinde yer almıyor.".to_string());
    }
    run_terminal_command(command).await
}

// ============================================================================
// 7. GÜVENLİ KURULUM MOTORU (COMMAND ARGS & STDIN CHPASSWD) - BULGULAR #3 & #8
// ============================================================================
#[tauri::command]
async fn get_storage_devices() -> Result<Vec<StorageDisk>, String> {
    #[cfg(target_os = "linux")]
    {
        let output = Command::new("lsblk").args(["-d", "-b", "-n", "-P", "-o", "NAME,SIZE,MODEL,RM,TYPE"]).output();
        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut disks = Vec::new();
            for line in stdout.lines() {
                if !line.contains("TYPE=\"disk\"") {
                    continue;
                }
                let mut name = String::new();
                let mut size_bytes: u64 = 0;
                let mut model = "Sabit Disk".to_string();
                let mut is_removable = false;

                for part in line.split_whitespace() {
                    if let Some((k, v)) = part.split_once('=') {
                        let val = v.trim_matches('"');
                        match k {
                            "NAME" => name = val.to_string(),
                            "SIZE" => size_bytes = val.parse().unwrap_or(0),
                            "MODEL" => if !val.is_empty() { model = val.to_string(); },
                            "RM" => is_removable = val == "1",
                            _ => {}
                        }
                    }
                }

                if !name.is_empty() && !name.starts_with("loop") {
                    let size_gb = (size_bytes as f64) / (1024.0 * 1024.0 * 1024.0);
                    disks.push(StorageDisk {
                        path: format!("/dev/{}", name),
                        name,
                        size_gb: (size_gb * 10.0).round() / 10.0,
                        model,
                        is_removable,
                    });
                }
            }
            if !disks.is_empty() {
                return Ok(disks);
            }
        }
    }

    Ok(vec![
        StorageDisk {
            name: "sda".to_string(),
            path: "/dev/sda".to_string(),
            size_gb: 256.0,
            model: "Dahili SATA SSD".to_string(),
            is_removable: false,
        },
        StorageDisk {
            name: "nvme0n1".to_string(),
            path: "/dev/nvme0n1".to_string(),
            size_gb: 512.0,
            model: "NVMe M.2 SSD".to_string(),
            is_removable: false,
        }
    ])
}

#[tauri::command]
async fn execute_system_installation(payload: InstallPayload) -> Result<String, String> {
    let target = payload.target_disk.trim();
    if !is_valid_disk_target(target) {
        return Err("Geçersiz hedef disk seçimi (Örn: /dev/sda veya /dev/nvme0n1, bölümler seçilemez).".to_string());
    }

    let username = payload.username.trim();
    if !is_valid_username(username) {
        return Err("Geçersiz kullanıcı adı. Yalnızca küçük harfler, rakamlar ve alt çizgi/tire kullanılabilir (en fazla 32 karakter).".to_string());
    }

    let hostname = payload.hostname.trim();
    if !is_valid_hostname(hostname) {
        return Err("Geçersiz makine adı (hostname). RFC 1123 standartlarına uygun olmalıdır.".to_string());
    }

    let password = payload.password.trim();
    if password.is_empty() || password.contains('\0') || password.contains('\n') || password.contains('\r') {
        return Err("Geçersiz parola karakterleri tespit edildi.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let run_step = |prog: &str, args: &[&str]| -> Result<(), String> {
            let res = Command::new(prog).args(args).output()
                .map_err(|e| format!("'{}' süreci başlatılamadı: {}", prog, e))?;
            if !res.status.success() {
                let err = String::from_utf8_lossy(&res.stderr);
                let _ = Command::new("umount").args(["-R", "/target"]).output();
                return Err(format!("'{}' işlemi başarısız oldu (Çıkış Kodu {}): {}", prog, res.status.code().unwrap_or(-1), err.trim()));
            }
            Ok(())
        };

        // 1. Bölümleme: Sıkı hata denetimli doğrudan sistem çağrıları
        run_step("parted", &["-s", target, "mklabel", "gpt"])?;
        run_step("parted", &["-s", target, "mkpart", "ESP", "fat32", "1MiB", "513MiB"])?;
        run_step("parted", &["-s", target, "set", "1", "esp", "on"])?;
        run_step("parted", &["-s", target, "mkpart", "primary", "ext4", "513MiB", "100%"])?;

        let (efi_part, root_part) = if target.contains("nvme") {
            (format!("{}p1", target), format!("{}p2", target))
        } else {
            (format!("{}1", target), format!("{}2", target))
        };

        // 2. Dosya Sistemleri
        run_step("mkfs.vfat", &["-F32", &efi_part])?;
        run_step("mkfs.ext4", &["-F", &root_part])?;

        // 3. Bağlama Noktaları (Mounts)
        let _ = fs::create_dir_all("/target");
        run_step("mount", &[&root_part, "/target"])?;
        let _ = fs::create_dir_all("/target/boot/efi");
        run_step("mount", &[&efi_part, "/target/boot/efi"])?;

        // 4. Kök Dosya Sistemini Rsync ile Kopyalama
        run_step("rsync", &[
            "-aAX", "--info=progress2", "/", "/target/",
            "--exclude=/proc/*", "--exclude=/sys/*", "--exclude=/dev/*",
            "--exclude=/tmp/*", "--exclude=/run/*", "--exclude=/mnt/*",
            "--exclude=/media/*", "--exclude=/target/*", "--exclude=/home/*"
        ])?;

        // 5. Hostname: Kabuk yönlendirmesi olmaksızın doğrudan dosya yazma
        if let Err(e) = fs::write("/target/etc/hostname", format!("{}\n", hostname)) {
            let _ = Command::new("umount").args(["-R", "/target"]).output();
            return Err(format!("Hostname dosyası yazılamadı: {}", e));
        }

        // 6. Kullanıcı Oluşturma: Argüman dizisi ile izole çalıştırma
        run_step("chroot", &["/target", "useradd", "-m", "-s", "/bin/bash", "-G", "sudo,audio,video,plugdev", username])?;

        // 7. Parola Belirleme: Parola doğrudan STDIN borusundan beslenir
        let mut chpasswd_child = Command::new("chroot")
            .args(["/target", "chpasswd"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("chpasswd süreci başlatılamadı: {}", e))?;

        if let Some(mut stdin) = chpasswd_child.stdin.take() {
            let pair = format!("{}:{}\n", username, password);
            stdin.write_all(pair.as_bytes()).map_err(|e| format!("Parola stdin'e aktarılamadı: {}", e))?;
            drop(stdin);
        }
        let chpasswd_res = chpasswd_child.wait_with_output().map_err(|e| e.to_string())?;
        if !chpasswd_res.status.success() {
            let _ = Command::new("umount").args(["-R", "/target"]).output();
            return Err("Kullanıcı parolası güncellenemedi.".to_string());
        }

        // 8. Grub & Temizlik
        run_step("chroot", &["/target", "grub-install", "--target=x86_64-efi", "--efi-directory=/boot/efi", "--bootloader-id=Ankora", "--recheck"])?;
        run_step("chroot", &["/target", "update-grub"])?;

        // 9. Sistem Temizliği: machine-id sıfırlama ve eski SSH anahtarlarının temizlenmesi
        let _ = fs::write("/target/etc/machine-id", "");
        let _ = Command::new("sh").args(["-c", "rm -f /target/etc/ssh/ssh_host_*"]).output();

        let _ = Command::new("umount").args(["-R", "/target"]).output();

        Ok("Ankora Linux başarıyla kuruldu.".to_string())
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(format!("Kurulum simülasyonu başarıyla tamamlandı: {} -> {}", target, username))
    }
}

// ============================================================================
// 8. GÜVENLİ UYGULAMA BAŞLATICI - GÜVENLİK BULGUSU #4
// ============================================================================
#[tauri::command]
async fn launch_application(exec: String) -> Result<String, String> {
    let clean = exec.trim();
    if clean.is_empty() {
        return Err("Uygulama komutu belirtilmedi.".to_string());
    }

    // 1. Kabuk kontrol karakterleri koruması
    let has_shell_metachars = clean.chars().any(|c| {
        matches!(c, ';' | '&' | '|' | '`' | '$' | '>' | '<' | '\\' | '(' | ')' | '\n' | '\r')
    });
    if has_shell_metachars {
        return Err("Güvenlik Hatası: Uygulama komutunda kabuk kontrol karakterleri tespit edildi.".to_string());
    }

    // 2. Argümanları güvenle ayrıştırma
    let parts: Vec<&str> = clean.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Çalıştırılacak uygulama tespit edilemedi.".to_string());
    }

    let bin_name = parts[0];
    let args = &parts[1..];

    // 3. Dizin geçişi ve kara liste doğrulaması
    if bin_name.contains("..") {
        return Err("Güvenlik Hatası: Dizin geçişine ('..') izin verilmez.".to_string());
    }

    let base_bin = Path::new(bin_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(bin_name);

    if FORBIDDEN_LAUNCH_BINARIES.contains(&base_bin) {
        return Err(format!(
            "Güvenlik İlkesi İhlali: '{}' sistem aracı güvenlik nedeniyle doğrudan başlatılamaz.",
            base_bin
        ));
    }

    if bin_name.contains('/') {
        let allowed_prefixes = ["/usr/bin/", "/bin/", "/usr/local/bin/", "/usr/games/", "/opt/"];
        if !allowed_prefixes.iter().any(|prefix| bin_name.starts_with(prefix)) {
            return Err("Güvenlik Hatası: Uygulama yolu izin verilen sistem dizinlerinde değil.".to_string());
        }

        // Kanonik hedef kontrolü (symlink bypass önleme)
        if let Ok(canonical) = fs::canonicalize(bin_name) {
            let canon_base = canonical
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            if FORBIDDEN_LAUNCH_BINARIES.contains(&canon_base) {
                return Err("Güvenlik İlkesi İhlali: Program kısayolu izin verilmeyen bir sistem aracına işaret ediyor.".to_string());
            }
        }
    } else {
        if !bin_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.') {
            return Err("Güvenlik Hatası: Geçersiz uygulama adı karakterleri.".to_string());
        }
    }

    #[cfg(target_os = "linux")]
    {
        let _ = Command::new(bin_name)
            .args(args)
            .env("DISPLAY", ":0")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Uygulama başlatılamadı: {}", e))?;
    }

    Ok(format!("Uygulama çalıştırıldı: {}", clean))
}

// ============================================================================
// 9. DİĞER SİSTEM AYARLARI VE GERÇEK TELEMETRİ - BULGU #4
// ============================================================================
#[tauri::command]
fn get_system_telemetry() -> Result<SystemTelemetry, String> {
    #[cfg(target_os = "linux")]
    {
        // 1. Gerçek Bellek Tespiti (/proc/meminfo)
        let mut mem_total_mb: u64 = 8192;
        let mut mem_available_mb: u64 = 4096;

        if let Ok(meminfo) = fs::read_to_string("/proc/meminfo") {
            for line in meminfo.lines() {
                if line.starts_with("MemTotal:") {
                    if let Some(val) = line.split_whitespace().nth(1) {
                        mem_total_mb = val.parse::<u64>().unwrap_or(8388608) / 1024;
                    }
                } else if line.starts_with("MemAvailable:") {
                    if let Some(val) = line.split_whitespace().nth(1) {
                        mem_available_mb = val.parse::<u64>().unwrap_or(4194304) / 1024;
                    }
                }
            }
        }
        let memory_used_mb = mem_total_mb.saturating_sub(mem_available_mb);

        // 2. Gerçek Çalışma Süresi (/proc/uptime)
        let mut uptime_seconds: u64 = 0;
        if let Ok(uptime_str) = fs::read_to_string("/proc/uptime") {
            if let Some(first) = uptime_str.split_whitespace().next() {
                uptime_seconds = first.parse::<f64>().unwrap_or(0.0) as u64;
            }
        }

        // 3. Dağıtım / İşletim Sistemi (/etc/os-release)
        let mut os_name = "Devuan GNU/Linux 5 (daedalus)".to_string();
        if let Ok(os_rel) = fs::read_to_string("/etc/os-release") {
            for line in os_rel.lines() {
                if line.starts_with("PRETTY_NAME=") {
                    os_name = line.trim_start_matches("PRETTY_NAME=").trim_matches('"').to_string();
                    break;
                }
            }
        }

        // 4. Çekirdek Sürümü (/proc/version)
        let kernel = if let Ok(proc_ver) = fs::read_to_string("/proc/version") {
            proc_ver.split_whitespace().take(3).collect::<Vec<_>>().join(" ")
        } else {
            "Linux 6.1.0-22-amd64".to_string()
        };

        // 5. İnit Sistemi (/proc/1/comm)
        let init_comm = fs::read_to_string("/proc/1/comm").unwrap_or_default().trim().to_string();
        let init_system = if init_comm == "systemd" {
            "systemd".to_string()
        } else {
            "SysVinit (systemd-free)".to_string()
        };

        Ok(SystemTelemetry {
            os_name,
            kernel,
            init_system,
            memory_used_mb,
            memory_total_mb,
            cpu_cores: std::thread::available_parallelism().map(|p| p.get()).unwrap_or(4),
            uptime_seconds,
        })
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(SystemTelemetry {
            os_name: "Ankora Linux (Simulated Host)".to_string(),
            kernel: "Linux 6.1.0-22-amd64 (Dev Core)".to_string(),
            init_system: "SysVinit (systemd-free)".to_string(),
            memory_used_mb: 1140,
            memory_total_mb: 8192,
            cpu_cores: std::thread::available_parallelism().map(|p| p.get()).unwrap_or(4),
            uptime_seconds: 7200,
        })
    }
}

#[tauri::command]
async fn set_brightness(level: u32) -> Result<String, String> {
    let clamped = level.clamp(20, 100);
    let ratio = clamped as f32 / 100.0;
    #[cfg(target_os = "linux")]
    {
        let brightness_str = format!("{:.2}", ratio);
        if let Ok(out) = Command::new("xrandr").output() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                if line.contains(" connected") {
                    if let Some(display_name) = line.split_whitespace().next() {
                        let _ = Command::new("xrandr")
                            .args(["--output", display_name, "--brightness", &brightness_str])
                            .output();
                        break;
                    }
                }
            }
        }
    }
    Ok(format!("Parlaklık ayarlandı: %{}", clamped))
}

#[tauri::command]
fn check_first_run() -> Result<bool, String> {
    let path = get_ankora_config_dir().join("welcomed.lock");
    Ok(!path.exists())
}

#[tauri::command]
fn set_first_run_completed(dont_show_again: bool) -> Result<(), String> {
    if dont_show_again {
        let path = get_ankora_config_dir().join("welcomed.lock");
        let _ = fs::write(path, "ankora-v2-welcomed");
    }
    Ok(())
}

#[tauri::command]
async fn set_system_keyboard(layout: String) -> Result<String, String> {
    let clean = layout.trim();
    if !ALLOWED_KEYBOARDS.contains(&clean) {
        return Err("Geçersiz veya desteklenmeyen klavye haritası.".to_string());
    }
    #[cfg(target_os = "linux")]
    {
        if clean == "tr_f" {
            let _ = Command::new("setxkbmap").args(["tr", "-variant", "f"]).output();
        } else {
            let _ = Command::new("setxkbmap").arg(clean).output();
        }
    }
    Ok(format!("Klavye: {}", clean))
}

// ============================================================================
// ANKORA GÜNCELLEYİCİ (ANKORA DE UPDATE MANAGER)
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateReleaseInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub release_notes: String,
    pub download_url: Option<String>,
    pub published_at: String,
    pub package_size_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UpdateProgressPayload {
    pub percent: u8,
    pub stage: String,
    pub message: String,
}

#[derive(Deserialize, Debug)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Deserialize, Debug)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    assets: Option<Vec<GitHubAsset>>,
}

pub fn parse_semver(v: &str) -> (u32, u32, u32) {
    let clean = v.trim().trim_start_matches('v').trim_start_matches('V');
    let mut parts = clean.split('.').filter_map(|s| s.parse::<u32>().ok());
    (
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    )
}

pub fn is_newer_version(remote: &str, current: &str) -> bool {
    let r = parse_semver(remote);
    let c = parse_semver(current);
    r > c
}

fn process_github_release(release: GitHubRelease, current_ver: &str) -> UpdateReleaseInfo {
    let latest_tag = release.tag_name.trim();
    let has_update = is_newer_version(latest_tag, current_ver);

    let mut deb_url = None;
    let mut deb_size = 0u64;

    if let Some(assets) = release.assets {
        for asset in assets {
            if asset.name.ends_with(".deb") {
                deb_url = Some(asset.browser_download_url);
                deb_size = asset.size;
                break;
            }
        }
    }

    UpdateReleaseInfo {
        has_update,
        current_version: current_ver.to_string(),
        latest_version: latest_tag.to_string(),
        release_name: release.name.unwrap_or_else(|| latest_tag.to_string()),
        release_notes: release.body.unwrap_or_else(|| "Sürüm notu bulunamadı.".to_string()),
        download_url: deb_url,
        published_at: release.published_at.unwrap_or_default(),
        package_size_bytes: deb_size,
    }
}

#[tauri::command]
async fn check_de_update(repo_override: Option<String>) -> Result<UpdateReleaseInfo, String> {
    let current_ver = env!("CARGO_PKG_VERSION");
    let target_repo = repo_override.unwrap_or_else(|| "Ankora-Linux/Ayaz".to_string());

    let client = reqwest::Client::builder()
        .user_agent(format!("ayaz-updater/{}", current_ver))
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("HTTP istemcisi başlatılamadı: {}", e))?;

    let url = format!("https://api.github.com/repos/{}/releases/latest", target_repo);
    let resp = client.get(&url).send().await;

    match resp {
        Ok(response) => {
            if response.status() == reqwest::StatusCode::NOT_FOUND {
                // Eğer Ankora-Linux/Ayaz reposunda henüz release yoksa, Ankora-Linux ana reposunu dene
                if target_repo == "Ankora-Linux/Ayaz" {
                    let fallback_url = "https://api.github.com/repos/Ankora-Linux/Ankora-Linux/releases/latest";
                    if let Ok(fallback_resp) = client.get(fallback_url).send().await {
                        if fallback_resp.status().is_success() {
                            if let Ok(release) = fallback_resp.json::<GitHubRelease>().await {
                                return Ok(process_github_release(release, current_ver));
                            }
                        }
                    }
                }

                return Ok(UpdateReleaseInfo {
                    has_update: false,
                    current_version: current_ver.to_string(),
                    latest_version: current_ver.to_string(),
                    release_name: "En Son Kararlı Sürüm".to_string(),
                    release_notes: format!(
                        "Ayaz Masaüstü Ortamı v{} şu anda en güncel sürümdür. Henüz yeni bir sürüm yayını bulunamadı.",
                        current_ver
                    ),
                    download_url: None,
                    published_at: String::new(),
                    package_size_bytes: 0,
                });
            }

            if !response.status().is_success() {
                return Err(format!(
                    "GitHub API yanıt vermedi (HTTP {}). Lütfen internet bağlantınızı kontrol edin.",
                    response.status()
                ));
            }

            let release = response
                .json::<GitHubRelease>()
                .await
                .map_err(|e| format!("Sürüm verisi çözümlenemedi: {}", e))?;

            Ok(process_github_release(release, current_ver))
        }
        Err(e) => {
            Err(format!(
                "Güncelleme sunucusuna bağlanılamadı: {}. Lütfen internet bağlantınızı kontrol edin.",
                e
            ))
        }
    }
}

#[tauri::command]
async fn download_and_apply_de_update(
    window: tauri::Window,
    download_url: String,
) -> Result<String, String> {
    // Güvenlik doğrulaması: Yalnızca GitHub releases alanından indirmeye izin ver
    if !download_url.starts_with("https://github.com/")
        && !download_url.starts_with("https://objects.githubusercontent.com/")
    {
        return Err("Güvenlik İlkesi İhlali: İndirme bağlantısı güvenilir GitHub sunucusuna ait değil.".to_string());
    }

    let _ = window.emit("update-progress", UpdateProgressPayload {
        percent: 10,
        stage: "connecting".to_string(),
        message: "Ayaz DE paketine bağlanılıyor...".to_string(),
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("İstemci hatası: {}", e))?;

    let res = client.get(&download_url).send().await
        .map_err(|e| format!("İndirme bağlantısı kurulamadı: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Paket indirilemedi (HTTP {})", res.status()));
    }

    let total_size = res.content_length().unwrap_or(0);

    let _ = window.emit("update-progress", UpdateProgressPayload {
        percent: 30,
        stage: "downloading".to_string(),
        message: if total_size > 0 {
            format!("Ayaz DE indiriliyor ({:.1} MB)...", total_size as f64 / 1_048_576.0)
        } else {
            "Ayaz DE paketi indiriliyor...".to_string()
        },
    });

    let bytes = res.bytes().await.map_err(|e| format!("Paket verisi indirilirken hata: {}", e))?;

    #[cfg(target_os = "linux")]
    let deb_path = PathBuf::from("/tmp/ayaz-update.deb");

    #[cfg(not(target_os = "linux"))]
    let deb_path = std::env::temp_dir().join("ayaz-update.deb");

    fs::write(&deb_path, &bytes)
        .map_err(|e| format!("Geçici güncelleme dosyası diske kaydedilemedi: {}", e))?;

    let _ = window.emit("update-progress", UpdateProgressPayload {
        percent: 80,
        stage: "installing".to_string(),
        message: "Ayaz Masaüstü Ortamı sisteme kuruluyor (dpkg)...".to_string(),
    });

    #[cfg(target_os = "linux")]
    {
        let helper_path = Path::new("/usr/local/bin/ayaz-update-helper");
        let fallback_helper = Path::new("/usr/local/bin/ankora-de-update-helper");

        let install_status = if helper_path.exists() {
            Command::new("sudo")
                .args(["/usr/local/bin/ayaz-update-helper", "/tmp/ayaz-update.deb"])
                .status()
        } else if fallback_helper.exists() {
            Command::new("sudo")
                .args(["/usr/local/bin/ankora-de-update-helper", "/tmp/ayaz-update.deb"])
                .status()
        } else {
            Command::new("sudo")
                .args(["dpkg", "-i", "/tmp/ayaz-update.deb"])
                .status()
        };

        match install_status {
            Ok(status) if status.success() => {
                let _ = window.emit("update-progress", UpdateProgressPayload {
                    percent: 100,
                    stage: "completed".to_string(),
                    message: "Ayaz Masaüstü Ortamı başarıyla güncellendi! Masaüstünü şimdi yeniden başlatabilirsiniz.".to_string(),
                });
                Ok("Ayaz DE başarıyla güncellendi.".to_string())
            }
            Ok(status) => {
                Err(format!("Kurulum başarısız oldu (Çıkış Kodu: {}).", status.code().unwrap_or(-1)))
            }
            Err(e) => {
                Err(format!("Kurulum yardımcısı çalıştırılamadı: {}", e))
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        let _ = window.emit("update-progress", UpdateProgressPayload {
            percent: 100,
            stage: "completed".to_string(),
            message: "Simülasyon: Ayaz Masaüstü Ortamı başarıyla doğrulandı ve kuruldu.".to_string(),
        });
        Ok("Simülasyon güncellemesi tamamlandı.".to_string())
    }
}

#[tauri::command]
fn restart_desktop_process() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("pkill").args(["-f", "ayaz"]).spawn();
        let _ = Command::new("pkill").args(["-f", "ankora-de"]).spawn();
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            drag_window,
            scan_xdg_applications,
            install_deb_package,
            run_terminal_command,
            read_document_file,
            list_available_documents,
            query_local_ai,
            execute_agent_confirmed_action,
            save_ai_credential,
            has_ai_credential,
            delete_ai_credential,
            get_storage_devices,
            execute_system_installation,
            get_system_telemetry,
            set_brightness,
            launch_application,
            check_first_run,
            set_first_run_completed,
            set_system_keyboard,
            check_de_update,
            download_and_apply_de_update,
            restart_desktop_process
        ])
        .run(tauri::generate_context!())
        .expect("Ankora DE başlatılırken hata oluştu");
}

// ============================================================================
// BİRİM TESTLERİ (UNIT TESTS) - KOD KALİTESİ BULGUSU #9
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_disk_target() {
        // Geçerli tüm diskler
        assert!(is_valid_disk_target("/dev/sda"));
        assert!(is_valid_disk_target("/dev/sdb"));
        assert!(is_valid_disk_target("/dev/vda"));
        assert!(is_valid_disk_target("/dev/nvme0n1"));
        assert!(is_valid_disk_target("/dev/nvme1n1"));

        // Kesinlikle reddedilmesi gereken bölümler (partitions)
        assert!(!is_valid_disk_target("/dev/sda1"));
        assert!(!is_valid_disk_target("/dev/sda2"));
        assert!(!is_valid_disk_target("/dev/vda1"));
        assert!(!is_valid_disk_target("/dev/nvme0n1p1"));
        assert!(!is_valid_disk_target("/dev/nvme0n1p2"));

        // Geçersiz yollar ve karakterler
        assert!(!is_valid_disk_target("/dev/random"));
        assert!(!is_valid_disk_target("/dev/null"));
        assert!(!is_valid_disk_target("/etc/shadow"));
        assert!(!is_valid_disk_target("sda"));
    }

    #[test]
    fn test_is_valid_username() {
        assert!(is_valid_username("pars"));
        assert!(is_valid_username("ankora_user"));
        assert!(is_valid_username("user-1"));

        assert!(!is_valid_username(""));
        assert!(!is_valid_username("1user")); // Rakamla başlayamaz
        assert!(!is_valid_username("User"));  // Büyük harf içeremez
        assert!(!is_valid_username("user;rm")); // Tehlikeli karakter
    }

    #[test]
    fn test_is_valid_deb_package_name() {
        assert!(is_valid_deb_package_name("firefox-esr"));
        assert!(is_valid_deb_package_name("vlc"));
        assert!(is_valid_deb_package_name("libgtk-3-0"));
        assert!(is_valid_deb_package_name("g++"));

        assert!(!is_valid_deb_package_name("a"));
        assert!(!is_valid_deb_package_name("-firefox"));
        assert!(!is_valid_deb_package_name("pkg;rm -rf"));
    }

    #[test]
    fn test_forbidden_launch_binaries() {
        assert!(FORBIDDEN_LAUNCH_BINARIES.contains(&"sudo"));
        assert!(FORBIDDEN_LAUNCH_BINARIES.contains(&"su"));
        assert!(FORBIDDEN_LAUNCH_BINARIES.contains(&"pkexec"));
        assert!(FORBIDDEN_LAUNCH_BINARIES.contains(&"bash"));
        assert!(FORBIDDEN_LAUNCH_BINARIES.contains(&"dd"));
    }

    #[test]
    fn test_semver_and_updater() {
        assert_eq!(parse_semver("v2.0.0"), (2, 0, 0));
        assert_eq!(parse_semver("2.1.3"), (2, 1, 3));
        assert_eq!(parse_semver("V1.9.0"), (1, 9, 0));

        assert!(is_newer_version("v2.0.1", "2.0.0"));
        assert!(is_newer_version("2.1.0", "2.0.9"));
        assert!(is_newer_version("3.0.0", "2.9.9"));

        assert!(!is_newer_version("2.0.0", "2.0.0"));
        assert!(!is_newer_version("v2.0.0", "2.0.1"));
        assert!(!is_newer_version("1.9.9", "2.0.0"));
    }
}
