<div align="center">
  <img src="assets/logo.png" alt="Ayaz DE Logo" width="200" style="border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
  <br><br>
  <h1>Ayaz Desktop Environment (Ayaz DE)</h1>
  <p><b>Ankora Linux için hafif, kiosk odaklı masaüstü ortamı</b></p>

  <p>
    <img src="https://img.shields.io/badge/S%C3%9CR%C3%9CM-2.0.0-ffffff?style=for-the-badge&labelColor=111111" alt="Sürüm">
    <img src="https://img.shields.io/badge/%C3%87EK%C4%B0RDEK-TAURI_%2B_RUST-059669?style=for-the-badge&labelColor=111111" alt="Çekirdek">
    <img src="https://img.shields.io/badge/HEDEF-ANKORA_LINUX-2563eb?style=for-the-badge&labelColor=111111" alt="Dağıtım">
    <img src="https://img.shields.io/badge/L%C3%B0SANS-GPL--3.0-41a013?style=for-the-badge&labelColor=111111" alt="Lisans">
  </p>
</div>

## Ayaz DE nedir?

Ayaz DE, **Ankora Linux** için geliştirilmiş, SysVinit tabanlı masaüstü ortamıdır. GNOME ve KDE'nin aksine arayüzü Rust ve WebKitGTK (Tauri 1.5) ile çalışır; boşta ~80-120 MB RAM harcar. Kiosk kullanımı için monokrom cam görünüm ve ortalanmış görev çubuğu kullanır.

## Özellikler

* Gereksiz arka plan servisleri olmadan çalışır; boşta ~80-120 MB RAM harcar.
* Ayaz Güncelleyici, `.deb` güncellemelerini terminale girmeden masaüstünden denetler, indirir ve kurar.
* Yapay zeka ajanı Ollama (localhost), Google Gemini ve Groq ile çalışır; `apt-get clean`, `df -h` gibi komutları onayınızla çalıştırır.
* Üç tema (Nordik Açık, Modern Grafit, Derin Gece) ve 8 vektörel monokrom duvar kağıdı gelir.
* Görev çubuğu ve başlat menüsü ortalanır; düzen Windows 11 ve Chrome OS Flex'ten esinlenir.
* İkili kara liste, `sudo`, `su`, `pkexec`, `dd` gibi araçların yetkisiz çalıştırılmasını engeller.
* Belge görüntüleyici hardlink ve path traversal'a karşı korumalıdır; PDF, Markdown ve metin dosyalarını açar.
* Devuan SysVinit ve X11 `nodm` oto-oturumuyla uyumludur

## Dizin yapısı

```
Ayaz/
├── .github/workflows/
│   ├── build-iso.yml            # Ankora Linux canlı ISO derleme iş akışı (manuel tetiklemeli)
│   └── release-de.yml           # Etiket push'ında otomatik .deb derleme
├── assets/                      # Logo ve masaüstü önizleme görselleri
├── scripts/
│   ├── ankora-updater-sudoers   # Helper'lar için sudoers izni
│   ├── ayaz-pkg-helper.sh       # Root yetkisiyle paket kurma yardımcısı
│   ├── ayaz-update-helper.sh    # Şifresiz güvenli .deb kurulum yardımcısı
│   ├── ayaz-session.desktop     # X11 oturum kaydı
│   ├── ayaz.desktop             # Uygulama kısayolu
│   ├── build-iso.sh             # Hibrit canlı ISO derleme betiği
│   ├── build-on-windows.ps1     # Windows'tan ISO derleme yardımcısı
│   ├── package-deb.sh           # Yerel .deb paketleme betiği
│   └── xinitrc                  # X oturum başlangıç betiği
├── src/                         # Arayüz
│   ├── app.js                   # Pencere yöneticisi, güncelleyici, yapay zeka ajanı
│   ├── index.html               # Masaüstü, pencereler ve başlat menüsü
│   ├── style.css                # Monokrom cam tasarımı ve temalar
│   └── wallpaper-*.svg          # Monokrom duvar kağıtları
├── src-tauri/                   # Rust arka ucu
│   ├── Cargo.toml
│   ├── tauri.conf.json          # Kiosk pencere kuralları ve CSP
│   └── src/main.rs              # Sistem telemetrisi, IPC, güncelleme motoru
├── my-linux-orchestrator/       # Yapılandırma orkestratörü ve beceri tanımları
├── AGENTS.md
├── LICENSE                      # GPL-3.0
└── package.json
```

## Geliştirme ve derleme

### Gereksinimler

* Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* Node.js v18 veya v20
* Debian/Devuan kütüphaneleri:
  ```bash
  sudo apt-get install -y libwebkit2gtk-4.0-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

### Geliştirme modunda çalıştırma

```bash
cargo install tauri-cli --version "^1.5"
cargo tauri dev
```

### Üretim `.deb` paketini derleme

```bash
cargo tauri build --bundles deb
```

Paket `src-tauri/target/release/bundle/deb/ayaz-de_2.0.0_amd64.deb` dizininde oluşur.

## Sürüm dağıtımı

Depoda yeni bir etiket push edildiğinde:

```bash
git tag v2.0.1
git push origin v2.0.1
```

`release-de.yml` iş akışı derlemeyi Ubuntu üzerinde tamamlar ve `.deb` paketini GitHub Releases sayfasına yükler. Güncellemeler masaüstündeki **Ayaz Güncelleyici** ile kurulur.

## Lisans

Bu proje **GNU General Public License v3.0** ile lisanslıdır; tam metin `LICENSE` dosyasındadır. Ankora Linux projesinin parçasıdır.
