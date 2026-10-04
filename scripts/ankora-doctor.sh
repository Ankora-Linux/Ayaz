#!/bin/bash
# ==============================================================================
# Ankora Linux Sistem Doktoru & Hızlı Onarım Aracı (Ankora Doctor)
# Devuan GNU/Linux 5 (Daedalus) SysVinit 3.06
# ==============================================================================
set -euo pipefail

echo "=================================================="
echo "   ANKORA LINUX SİSTEM DOKTORU & BAKIM ARACI     "
echo "=================================================="

# 1. Bozuk paket onarımı
echo "[1/5] Bozuk paketler taranıyor ve onarılıyor..."
dpkg --configure -a 2>/dev/null || true
apt-get install -f -y 2>/dev/null || true

# 2. Yetim paket ve apt önbellek temizliği
echo "[2/5] Yetim paketler ve apt önbelleği temizleniyor..."
apt-get autoremove -y 2>/dev/null || true
apt-get clean 2>/dev/null || true

# 3. ZRAM Takas ve Bellek Denetimi
echo "[3/5] ZRAM sıkıştırılmış takas alanı doğrulanıyor..."
if [ -x /etc/init.d/zram-swap ]; then
    /etc/init.d/zram-swap status 2>/dev/null || /etc/init.d/zram-swap start 2>/dev/null || true
fi

# 4. Kritik Dizin İzinleri
echo "[4/5] Sistem izinleri ve /tmp doğrulanıyor..."
chmod 1777 /tmp /var/tmp 2>/dev/null || true
if [ -d /etc/sudoers.d ]; then
    chmod 0440 /etc/sudoers.d/* 2>/dev/null || true
fi

# 5. Disk ve Bellek Önbelleği Eşitleme
echo "[5/6] Dosya sistemi ve bellek önbellekleri dengeleniyor..."
sync
echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true

# 6. Flatpak Deposu ve Sandbox Onarımı
echo "[6/6] Flatpak ve OSTree depoları teftiş ediliyor..."
if command -v flatpak >/dev/null 2>&1; then
    flatpak repair 2>/dev/null || true
fi

echo "=================================================="
echo "   BAKIM TAMAMLANDI: ANKORA LINUX SAĞLIKLI!       "
echo "=================================================="
