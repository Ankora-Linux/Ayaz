#!/bin/bash
# ==============================================================================
# Ankora Linux — Ayaz DE .deb Paket Derleme Betiği
# Target: Devuan 5 (Daedalus) / Debian 12 (Bookworm) x86_64
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo "  Ankora Linux — Ayaz DE Debian Paketi Derleniyor...   "
echo "========================================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Bağımlılık kontrolü
MISSING_PKGS=()
for cmd in cargo npm dpkg; do
    if ! command -v "$cmd" &>/dev/null; then
        MISSING_PKGS+=("$cmd")
    fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
    echo "[HATA] Aşağıdaki gerekli araçlar eksik: ${MISSING_PKGS[*]}"
    echo "Lütfen kurun: sudo apt-get update && sudo apt-get install -y cargo rustc nodejs npm libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev"
    exit 1
fi

# 2. Node bağımlılıkları
if [ ! -d "node_modules" ]; then
    echo "[1/4] NPM bağımlılıkları kuruluyor..."
    npm install
fi

# 3. Tauri CLI ile .deb derlemesi
echo "[2/4] Tauri ile .deb paketi derleniyor..."
npm run tauri build -- --target deb

# 4. Derlenen paketin kontrolü
DEB_FILE=$(find src-tauri/target/release/bundle/deb/ -name "*.deb" 2>/dev/null | head -n 1)

if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
    echo "[3/4] Paket başarıyla oluşturuldu:"
    ls -lh "$DEB_FILE"
    
    mkdir -p dist
    cp -v "$DEB_FILE" dist/ayaz-de-latest-amd64.deb
    echo "[4/4] Çıktı: dist/ayaz-de-latest-amd64.deb"
    echo "Tebrikler! .deb paketi ISO derleme adımına hazır."
else
    echo "[HATA] .deb paketi bulunamadı! Lütfen derleme loglarını inceleyin."
    exit 2
fi
