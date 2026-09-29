#!/bin/bash
# ==============================================================================
# Ayaz Paket Yöneticisi Yardımcısı (Ayaz Package Helper)
# Ankora Linux (Devuan Daedalus SysVinit) Güvenli Paket İşlem Betiği
# ==============================================================================
set -euo pipefail

ACTION="${1:-}"
PKG="${2:-}"

if [[ -z "$ACTION" || -z "$PKG" ]]; then
    echo "[HATA] Kullanım: ayaz-pkg-helper <install|remove> <paket_adi>" >&2
    exit 1
fi

# Yalnızca geçerli Debian paket isimleri kabul edilir: [a-zA-Z0-9.+_-]
# Kesinlikle bayrak (- veya -- ile başlayan argümanlar) veya enjeksiyon kabul edilmez
if [[ ! "$PKG" =~ ^[a-zA-Z0-9][a-zA-Z0-9.+_-]*$ ]]; then
    echo "[HATA] Güvenlik İlkesi İhlali: Geçersiz paket adı biçimi: '$PKG'" >&2
    exit 2
fi

# Tehlikeli / sistem kritik paketlerin kaldırılmasını engelle
if [[ "$ACTION" == "remove" ]]; then
    CRITICAL_PKGS="libc6|linux-image.*|dpkg|apt|sysvinit-core|bash|coreutils|libgtk-3-0|libwebkit2gtk.*"
    if [[ "$PKG" =~ ^($CRITICAL_PKGS)$ ]]; then
        echo "[HATA] Güvenlik: Kritik sistem bileşeni kaldırılamaz: '$PKG'" >&2
        exit 3
    fi
fi

export DEBIAN_FRONTEND=noninteractive

case "$ACTION" in
    install)
        # Sadece resmi depolardan güvenli kurulum (asla --allow-unauthenticated kabul edilmez)
        exec /usr/bin/apt-get install -y --no-install-recommends -- "$PKG"
        ;;
    remove)
        exec /usr/bin/apt-get remove -y -- "$PKG"
        ;;
    *)
        echo "[HATA] Bilinmeyen işlem: '$ACTION'. Yalnızca 'install' veya 'remove' kabul edilir." >&2
        exit 4
        ;;
esac
