#!/bin/bash
# ==============================================================================
# Ankora DE Güncelleme Yardımcısı (Ankora Update Helper)
# Devuan GNU/Linux Daedalus (SysVinit) Kiosk Ortamı İçin Güvenli Kurulum Scripti
# ==============================================================================

set -e

DEB_PATH="${1:-/tmp/ankora-de-update.deb}"

# 1. Dosya yolu güvenlik kontrolü (yalnızca /tmp altındaki .deb dosyalarına izin verilir)
if [[ ! "$DEB_PATH" =~ ^/tmp/[a-zA-Z0-9._-]+\.deb$ ]]; then
    echo "[HATA] Geçersiz paket yolu: $DEB_PATH. Paket /tmp dizininde olmalı ve .deb ile bitmelidir." >&2
    exit 1
fi

if [[ ! -f "$DEB_PATH" ]]; then
    echo "[HATA] Güncelleme paketi bulunamadı: $DEB_PATH" >&2
    exit 2
fi

echo "[ANKORA GÜNCELLEYİCİ] Kurulum başlatılıyor: $DEB_PATH"

# 2. Dpkg ile paketi kur
dpkg -i "$DEB_PATH" || {
    echo "[UYARI] Eksik bağımlılıklar tamamlanıyor (apt-get install -f)..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -f -y -qq
}

# 3. İzinleri ve ikili dosyaları senkronize et
sync

# 4. Geçici kurulum paketini temizle
rm -f "$DEB_PATH"

echo "[ANKORA GÜNCELLEYİCİ] Kurulum başarıyla tamamlandı."
exit 0
