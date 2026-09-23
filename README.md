<div align="center">
  <img src="assets/logo.png" alt="Ayaz DE Logo" width="200" style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
  <br><br>
  <h1>Ayaz Desktop Environment (Ayaz DE)</h1>
  <p><b>Ankora Linux İçin Minimalist, Ultra Hafif ve Kiosk Uyumlu Masaüstü Ortamı</b></p>

  <p>
    <img src="https://img.shields.io/badge/S%C3%9CR%C3%9CM-2.0.0-ffffff?style=for-the-badge&labelColor=111111" alt="Sürüm">
    <img src="https://img.shields.io/badge/%C3%87EK%C4%B0RDEK-TAURI_%2B_RUST-059669?style=for-the-badge&labelColor=111111" alt="Çekirdek">
    <img src="https://img.shields.io/badge/HEDEF-ANKORA_LINUX-2563eb?style=for-the-badge&labelColor=111111" alt="Dağıtım">
    <img src="https://img.shields.io/badge/L%C3%B0SANS-MIT-41a013?style=for-the-badge&labelColor=111111" alt="Lisans">
  </p>
</div>

---

## ❄️ Ayaz Masaüstü Ortamı Nedir?

**Ayaz DE**, **Ankora Linux** işletim sistemi için özel olarak tasarlanmış, systemd kirliliğinden arındırılmış (Devuan SysVinit uyumlu), ultra hafif ve yüksek tepkiselliğe sahip bağımsız bir masaüstü ortamıdır.

Geleneksel ağır masaüstü ortamlarının (GNOME/KDE) aksine, **Rust** ve **WebKitGTK (Tauri 1.5)** mimarisi üzerinde çalışır. Kiosk modunda sıfır çökme, minimal bellek ayak izi (~80-120 MB RAM) ve endüstriyel monokrom cam tasarımı sunar.

---

## ✨ Öne Çıkan Özellikler

* **🚀 Ultra Düşük Bellek ve CPU Tüketimi:** Gereksiz arka plan servisleri olmadan doğrudan donanım verimliliğine odaklanır.
* **🔄 Ayaz Güncelleyici (GUI Update Manager):** Kullanıcıların terminale girmeden doğrudan masaüstü arayüzünden tek tıkla en son `.deb` güncellemelerini denetlemesini, indirmesini ve kurmasını sağlar.
* **🧠 Yerel Yapay Zeka Teftiş Ajanı:** Ollama (localhost), Google Gemini ve Groq modellerini destekleyen, onaylı sistem komutları (`apt-get clean`, `df -h`) üretebilen akıllı asistan.
* **🎨 Modern Cam (Glassmorphism) Tasarım:**
  * 3 farklı tema (Nordik Açık, Modern Grafit, Derin Gece).
  * 8 adet yüksek çözünürlüklü vektörel (SVG) monokrom duvar kağıdı.
  * Windows 11 ve Chrome OS Flex'ten ilham alan ortalanmış Görev Çubuğu ve Başlat Menüsü.
* **🔒 Kiosk ve Donanım Güvenliği:**
  * Binary blacklist kalkanı (`sudo`, `su`, `pkexec`, `dd` vb. yetkisiz doğrudan çalıştırma engeli).
  * Hardlink ve Path Traversal korumalı belge görüntüleyici (PDF/Markdown/Metin).
  * Devuan SysVinit ve X11 `nodm` oto-oturum açma uyumluluğu.

---

## 📁 Proje Dizin Yapısı

```
Ayaz/
├── .github/workflows/
│   └── release-de.yml          # GitHub Actions otomatik .deb derleme iş akışı
├── assets/                     # Logo ve masaüstü önizleme görselleri
├── scripts/
│   ├── ayaz-update-helper.sh   # Şifresiz güvenli root paket kurucu
│   └── ankora-updater-sudoers  # Helper için tek satırlık sudoers izni
├── src/                        # Ayaz DE Web Kullanıcı Arayüzü
│   ├── app.js                  # Pencere yöneticisi, güncelleyici ve masaüstü mantığı
│   ├── index.html              # Masaüstü çalışma alanı, pencereler ve başlat menüsü
│   ├── style.css               # Monokrom cam tasarım sistemi ve tema stilleri
│   └── *.svg                   # Vektörel arka planlar ve sistem ikonları
├── src-tauri/                  # Ayaz DE Rust Arka Planı
│   ├── Cargo.toml              # Rust bağımlılıkları ve ayaz-de paketi
│   ├── tauri.conf.json         # Kiosk pencere kuralları, CSP güvenlik politikası
│   └── src/main.rs             # Sistem telemetrisi, IPC köprüsü, güncelleme motoru
└── package.json
```

---

## 🛠️ Yerel Geliştirme ve Derleme

### Gereksinimler

* **Rust:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* **Node.js:** v18 veya v20
* **Linux Kütüphaneleri (Debian/Devuan):**
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Geliştirme Modunda Çalıştırma

```bash
cargo install tauri-cli --version "^1.5"
cargo tauri dev
```

### Üretim `.deb` Paketini Derleme

```bash
cargo tauri build --bundles deb
```
Derlenen paket `src-tauri/target/release/bundle/deb/ayaz-de_2.0.0_amd64.deb` dizininde üretilir.

---

## 🚀 Sürüm Dağıtımı (Release)

Bu depoda yeni bir etiket (tag) push edildiğinde:
```bash
git tag v2.0.1
git push origin v2.0.1
```
GitHub Actions iş akışı (`release-de.yml`) otomatik olarak Ubuntu üzerinde derlemeyi tamamlar ve `.deb` paketini GitHub Releases sayfasına yükler. Ankora Linux kullanıcıları masaüstündeki **Ayaz Güncelleyici** ile yeni sürüme anında geçer.

---

## 📄 Lisans

Bu proje **MIT** lisansı ile lisanslanmıştır. Ankora Linux projesinin bir parçasıdır.
