#!/bin/bash
# ==============================================================================
# Ayaz DE Güncelleme Yardımcısı (Ayaz Desktop Update Helper)
# Ankora Linux (Devuan Daedalus SysVinit) Güvenli Kurulum Scripti
# Depo: https://github.com/Ankora-Linux/Ayaz
# ==============================================================================
# GÜVENLİK DÜZELTMELERİ:
#   - /tmp yerine root-owned 0700 staging dizini (/var/cache/ayaz-updates/)
#   - Symlink takibi engelleme (readlink -f + O_NOFOLLOW semantiği)
#   - Paket adı doğrulaması (yalnızca ayaz-de veya ankora-de paketleri)
#   - Dosya sahipliği doğrulaması (root:root olmalı)
# ==============================================================================

set -euo pipefail

STAGING_DIR="/var/cache/ayaz-updates"
DEB_PATH="${1:-${STAGING_DIR}/ayaz-update.deb}"

# 1. Staging dizini güvenlik kontrolü
if [[ ! -d "$STAGING_DIR" ]]; then
    mkdir -p "$STAGING_DIR"
    chown root:root "$STAGING_DIR"
    chmod 0700 "$STAGING_DIR"
fi

# Staging dizini sahipliği doğrulaması
STAGING_OWNER=$(stat -c '%u:%g' "$STAGING_DIR" 2>/dev/null || echo "unknown")
if [[ "$STAGING_OWNER" != "0:0" ]]; then
    echo "[HATA] Staging dizini root sahipliğinde değil: $STAGING_DIR ($STAGING_OWNER)" >&2
    exit 10
fi

# 2. Dosya yolu güvenlik kontrolü — yalnızca staging dizini kabul edilir
CANONICAL_PATH=$(readlink -f "$DEB_PATH" 2>/dev/null || echo "")
if [[ -z "$CANONICAL_PATH" || ! -f "$CANONICAL_PATH" ]]; then
    echo "[HATA] Güncelleme paketi bulunamadı veya geçersiz yol: $DEB_PATH" >&2
    exit 1
fi

# Staging dizini sınırı kontrolü (path traversal engeli)
if [[ "$CANONICAL_PATH" != "${STAGING_DIR}/"* ]]; then
    echo "[HATA] Paket güvenli staging dizininde değil: $CANONICAL_PATH (beklenen: $STAGING_DIR/)" >&2
    exit 2
fi

# 3. Symlink kontrolü — dosyanın kendisi symlink olmamalı
if [[ -L "$DEB_PATH" ]]; then
    echo "[HATA] Güvenlik: Sembolik bağlantılar kabul edilmez: $DEB_PATH" >&2
    exit 3
fi

# 4. Dosya uzantısı kontrolü
if [[ "$CANONICAL_PATH" != *.deb ]]; then
    echo "[HATA] Geçersiz dosya uzantısı. Yalnızca .deb dosyaları kabul edilir." >&2
    exit 4
fi

# 5. Paket adı doğrulaması — yalnızca bilinen Ayaz/Ankora paketleri
PKG_NAME=$(dpkg-deb --showformat='${Package}' -W "$CANONICAL_PATH" 2>/dev/null || echo "unknown")
case "$PKG_NAME" in
    ayaz-de|ankora-de|ankora-ayaz-de)
        ;;
    *)
        echo "[HATA] Güvenlik: Bilinmeyen paket adı '$PKG_NAME'. Yalnızca ayaz-de veya ankora-de paketleri kurulabilir." >&2
        exit 5
        ;;
esac

# 6. Dosya sahipliği kontrolü — root tarafından oluşturulmuş olmalı
FILE_OWNER=$(stat -c '%u' "$CANONICAL_PATH" 2>/dev/null || echo "-1")
if [[ "$FILE_OWNER" != "0" ]]; then
    echo "[HATA] Güvenlik: Paket dosyası root sahipliğinde değil (uid=$FILE_OWNER). TOCTOU koruması." >&2
    exit 6
fi

echo "[AYAZ GÜNCELLEYİCİ] Güvenlik doğrulamaları geçildi. Kurulum: $CANONICAL_PATH (paket: $PKG_NAME)"

# 7. Dpkg ile Ayaz DE paketini kur
dpkg -i "$CANONICAL_PATH" || {
    echo "[UYARI] Eksik bağımlılıklar tamamlanıyor (apt-get install -f)..."
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -f -y -qq
}

# 8. Senkronize et
sync

# 9. Geçici kurulum paketini güvenle temizle
rm -f "$CANONICAL_PATH"

echo "[AYAZ GÜNCELLEYİCİ] Ayaz Masaüstü Ortamı başarıyla güncellendi."
exit 0
