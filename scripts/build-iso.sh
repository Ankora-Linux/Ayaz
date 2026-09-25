#!/bin/bash
# ==============================================================================
# Ankora Linux 2.0 (Daedalus) — Canlı (Live) ISO Derleme Betiği
# Masaüstü Ortamı: Ayaz DE (Tauri + WebKitGTK + SysVinit Core)
# Mimari: x86_64 (UEFI + BIOS Hibrit Boot)
# ==============================================================================

set -euo pipefail

ISO_NAME="ankora-linux-2.0-ayaz-amd64.iso"
WORK_DIR="/tmp/ankora-iso-build"
CHROOT_DIR="$WORK_DIR/chroot"
IMAGE_DIR="$WORK_DIR/image"
DEVUAN_MIRROR="http://deb.devuan.org/merged"
DEVUAN_SUITE="daedalus"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "======================================================================"
echo "      ANKORA LINUX 2.0 (AYAZ DE) CANLI ISO DERLEME SİSTEMİ            "
echo "======================================================================"
echo "Sürüm: 2.0.0 (Daedalus / SysVinit Core)"
echo "Çıktı Hedefi: $ROOT_DIR/dist/$ISO_NAME"
echo "======================================================================"

# 1. Kök Kullanıcı Denetimi
if [ "$(id -u)" -ne 0 ]; then
    echo "[HATA] ISO derleme işlemi kök (root) yetkisi gerektirir." >&2
    echo "Lütfen 'sudo bash scripts/build-iso.sh' ile çalıştırın." >&2
    exit 1
fi

# 2. Gerekli Host Paketlerinin Denetimi
REQUIRED_HOST_PKGS=(debootstrap squashfs-tools xorriso isolinux syslinux-efi grub-pc-bin grub-efi-amd64-bin mtools dosfstools)
MISSING_HOST_PKGS=()
for pkg in "${REQUIRED_HOST_PKGS[@]}"; do
    if ! dpkg -s "$pkg" &>/dev/null; then
        MISSING_HOST_PKGS+=("$pkg")
    fi
done

if [ ${#MISSING_HOST_PKGS[@]} -gt 0 ]; then
    echo "[BİLGİ] Eksik host araçları kuruluyor: ${MISSING_HOST_PKGS[*]}"
    apt-get update -qq
    apt-get install -y --no-install-recommends "${MISSING_HOST_PKGS[@]}"
fi

# 3. Temiz Çalışma Alanı Hazırlığı
echo "[1/8] Çalışma dizinleri hazırlanıyor..."
rm -rf "$WORK_DIR"
mkdir -p "$CHROOT_DIR" "$IMAGE_DIR/live" "$IMAGE_DIR/isolinux" "$IMAGE_DIR/boot/grub" "$ROOT_DIR/dist"

# 4. Debootstrap ile Temel Devuan Daedalus Sisteminin İndirilmesi
echo "[2/8] Devuan Daedalus SysVinit temel tabanı kuruluyor (debootstrap)..."
debootstrap --arch=amd64 \
    --variant=minbase \
    --include=sysvinit-core,sysvinit-utils,insserv,initramfs-tools,live-boot,live-config,live-config-sysvinit \
    "$DEVUAN_SUITE" "$CHROOT_DIR" "$DEVUAN_MIRROR"

# 5. Sanal Dosya Sistemlerinin Bağlanması (Mount)
mount --bind /dev "$CHROOT_DIR/dev"
mount --bind /dev/pts "$CHROOT_DIR/dev/pts"
mount -t proc none "$CHROOT_DIR/proc"
mount -t sysfs none "$CHROOT_DIR/sys"

cleanup() {
    echo "[TEMİZLİK] Sanal dosya sistemleri ayrılıyor..."
    umount -lf "$CHROOT_DIR/dev/pts" 2>/dev/null || true
    umount -lf "$CHROOT_DIR/dev" 2>/dev/null || true
    umount -lf "$CHROOT_DIR/proc" 2>/dev/null || true
    umount -lf "$CHROOT_DIR/sys" 2>/dev/null || true
}
trap cleanup EXIT

# 6. Chroot İçinde Sistem ve Kiosk Paketlerinin Yapılandırılması
echo "[3/8] Çekirdek, X11 ve WebKit bağımlılıkları kuruluyor..."
cat << 'EOF' > "$CHROOT_DIR/chroot-setup.sh"
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
export HOME=/root
export LC_ALL=C

# Depo kaynakları
cat << 'SOURCES' > /etc/apt/sources.list
deb http://deb.devuan.org/merged daedalus main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-security main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-updates main contrib non-free non-free-firmware
SOURCES

apt-get update -qq

# Linux Çekirdeği, Xorg, WebKitGTK ve Temel Kiosk Bileşenleri
apt-get install -y --no-install-recommends \
    linux-image-amd64 \
    xserver-xorg-core \
    xserver-xorg-video-all \
    xserver-xorg-input-all \
    xinit \
    x11-xserver-utils \
    libwebkit2gtk-4.0-37 \
    libgtk-3-0 \
    libayatana-appindicator3-1 \
    ca-certificates \
    curl \
    wget \
    sudo \
    dbus-x11 \
    alsa-utils \
    pulseaudio \
    pavucontrol \
    fonts-inter \
    fonts-noto-core \
    fonts-noto-color-emoji \
    xtrlock \
    isc-dhcp-client \
    iproute2 \
    net-tools \
    wpasupplicant \
    locales

# Yerel ayarlar (Türkçe & UTF-8 desteği)
echo "tr_TR.UTF-8 UTF-8" > /etc/locale.gen
echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
locale-gen
update-locale LANG=tr_TR.UTF-8

# Canlı Oturum Kullanıcısı: pars
useradd -m -s /bin/bash -u 1000 -G sudo,audio,video,plugdev,netdev pars

# GÜVENLİK İYİLEŞTİRMESİ (BULGU #1 & #2 GİDERİLDİ):
# 1. Root hesabı doğrudan yerel/uzaktan girişlere tamamen kilitlenir
passwd -l root

# 2. Canlı kullanıcı 'pars' için rastgele güvenli parola oluşturulur ve ilk girişte değişim zorunlu tutulur
RANDPASS=$(openssl rand -hex 12 2>/dev/null || tr -dc 'A-Za-z0-9!@#%' </dev/urandom | head -c 16)
echo "pars:${RANDPASS}" | chpasswd
chage -d 0 pars

# 3. NOPASSWD: ALL (Sınırsız Root) KESİNLİKLE KALDIRILDI.
# Yalnızca Ayaz DE kiosk arayüzünün ihtiyaç duyduğu yardımcı güncelleme scriptlerine izin verilir (asgari yetki ilkesi).
cat << 'SUDO' > /etc/sudoers.d/pars
pars ALL=(ALL) NOPASSWD: /usr/local/bin/ayaz-update-helper, /usr/local/bin/ankora-de-update-helper
SUDO
chmod 0440 /etc/sudoers.d/pars

# Hostname
echo "ankora-live" > /etc/hostname

# X11 Otomatik Kiosk Başlatıcı
cat << 'XINIT' > /home/pars/.xinitrc
#!/bin/sh
xsetroot -solid "#0b0c10"
xset -dpms
xset s off
xset s noblank
if [ -x /usr/bin/ayaz ]; then
    exec /usr/bin/ayaz
else
    exec xterm
fi
XINIT
chmod +x /home/pars/.xinitrc
chown pars:pars /home/pars/.xinitrc

# SysVinit Otomatik Giriş (Getty inittab)
sed -i 's|^1:2345:respawn:/sbin/getty 38400 tty1|1:2345:respawn:/sbin/getty --autologin pars --noclear 38400 tty1|' /etc/inittab

# TTY1 Girişinde startx Başlatma
cat << 'PROFILE' >> /home/pars/.profile
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
    exec startx
fi
PROFILE
chown pars:pars /home/pars/.profile

apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/*
EOF

chmod +x "$CHROOT_DIR/chroot-setup.sh"
chroot "$CHROOT_DIR" /chroot-setup.sh
rm -f "$CHROOT_DIR/chroot-setup.sh"

# 7. Ayaz DE Paketinin Sisteme Enjekte Edilmesi
echo "[4/8] Ayaz DE ikili dosyası ve sistem bileşenleri sisteme kopyalanıyor..."
# Eğer dist altında deb yoksa ve host ortamında cargo/npm mevcutsa otomatik derle
if [ ! -f "$ROOT_DIR/dist/ayaz-de-latest-amd64.deb" ] && [ ! -f "$ROOT_DIR/src-tauri/target/release/ayaz-de" ]; then
    echo "[BİLGİ] Ayaz DE paketi bulunamadı, host ortamında derleme başlatılıyor..."
    if command -v cargo &>/dev/null && command -v npm &>/dev/null; then
        bash "$ROOT_DIR/scripts/package-deb.sh" || echo "[UYARI] Paketleme tamamlanamadı, mevcut dosyalarla devam ediliyor..."
    fi
fi

# Eğer dist altında deb varsa kur, yoksa mevcut src dosyalarını kopyala
if [ -f "$ROOT_DIR/dist/ayaz-de-latest-amd64.deb" ]; then
    cp "$ROOT_DIR/dist/ayaz-de-latest-amd64.deb" "$CHROOT_DIR/tmp/ayaz.deb"
    chroot "$CHROOT_DIR" bash -c "dpkg -i /tmp/ayaz.deb || apt-get install -f -y; rm -f /tmp/ayaz.deb"
elif [ -f "$ROOT_DIR/src-tauri/target/release/ayaz-de" ]; then
    cp "$ROOT_DIR/src-tauri/target/release/ayaz-de" "$CHROOT_DIR/usr/bin/ayaz"
    chmod +x "$CHROOT_DIR/usr/bin/ayaz"
fi

# XDG ve Desktop Entegrasyonu
cp "$ROOT_DIR/scripts/ayaz.desktop" "$CHROOT_DIR/usr/share/applications/ayaz.desktop" || true
cp "$ROOT_DIR/scripts/ayaz-session.desktop" "$CHROOT_DIR/usr/share/xsessions/ayaz.desktop" || true
cp "$ROOT_DIR/scripts/ayaz-update-helper.sh" "$CHROOT_DIR/usr/local/bin/ayaz-update-helper" || true
chmod +x "$CHROOT_DIR/usr/local/bin/ayaz-update-helper" || true
cp "$ROOT_DIR/scripts/ankora-updater-sudoers" "$CHROOT_DIR/etc/sudoers.d/ankora-updater" || true
chmod 0440 "$CHROOT_DIR/etc/sudoers.d/ankora-updater" || true

# 8. SquashFS Sıkıştırılmış Kök Dosya Sisteminin Üretilmesi
echo "[5/8] SquashFS kök dosya sistemi sıkıştırılıyor (filesystem.squashfs)..."
# Çekirdek ve initrd dosyalarını çıkar
KERNEL_FILE=$(find "$CHROOT_DIR/boot" -name "vmlinuz*" | sort -V | tail -n 1)
INITRD_FILE=$(find "$CHROOT_DIR/boot" -name "initrd.img*" | sort -V | tail -n 1)

cp -v "$KERNEL_FILE" "$IMAGE_DIR/live/vmlinuz"
cp -v "$INITRD_FILE" "$IMAGE_DIR/live/initrd"

# Sanal bağlantıları kaldır
umount -lf "$CHROOT_DIR/dev/pts" 2>/dev/null || true
umount -lf "$CHROOT_DIR/dev" 2>/dev/null || true
umount -lf "$CHROOT_DIR/proc" 2>/dev/null || true
umount -lf "$CHROOT_DIR/sys" 2>/dev/null || true

mksquashfs "$CHROOT_DIR" "$IMAGE_DIR/live/filesystem.squashfs" -comp xz -b 1048576 -noappend

# 9. Önyükleyici (Bootloader: Syslinux BIOS + GRUB EFI) Yapılandırması
echo "[6/8] EFI ve BIOS hibrit önyükleyicileri hazırlanıyor..."
# ISOLINUX (BIOS)
cat << 'EOF' > "$IMAGE_DIR/isolinux/isolinux.cfg"
UI vesamenu.c32
PROMPT 0
TIMEOUT 50
DEFAULT ankora

MENU TITLE Ankora Linux 2.0 (Ayaz DE) Live Boot
MENU COLOR border       30;44   #40ffffff #a0000000 std
MENU COLOR title        1;36;44 #ffffffff #a0000000 std
MENU COLOR sel          7;37;40 #e0000000 #20ffffff all

LABEL ankora
  MENU LABEL ^1. Ankora Linux 2.0 (Canli Masaustu / Kiosk)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live quiet splash components username=pars

LABEL failsafe
  MENU LABEL ^2. Ankora Linux (Failsafe Guvenli Mod)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live components nomodeset noapic noacpi nosmap nosmep
EOF

# Gerekli syslinux modülleri
cp /usr/lib/ISOLINUX/isolinux.bin "$IMAGE_DIR/isolinux/" 2>/dev/null || true
cp /usr/lib/syslinux/modules/bios/* "$IMAGE_DIR/isolinux/" 2>/dev/null || true

# GRUB (UEFI)
cat << 'EOF' > "$IMAGE_DIR/boot/grub/grub.cfg"
set default="0"
set timeout=5

menuentry "Ankora Linux 2.0 (Ayaz DE - Canli Masaustu)" {
    linux /live/vmlinuz boot=live quiet splash components username=pars
    initrd /live/initrd
}

menuentry "Ankora Linux 2.0 (Guvenli Mod / Failsafe)" {
    linux /live/vmlinuz boot=live components nomodeset noapic noacpi
    initrd /live/initrd
}
EOF

# EFI Bağımsız Önyükleyici ve efi.img Üretimi (Modern UEFI Boot Desteği)
mkdir -p "$IMAGE_DIR/EFI/boot" "$IMAGE_DIR/boot/grub/x86_64-efi"

if command -v grub-mkstandalone &>/dev/null; then
    echo "[EFI] grub-mkstandalone ile bootx64.efi üretiliyor..."
    grub-mkstandalone \
        --format=x86_64-efi \
        --output="$IMAGE_DIR/EFI/boot/bootx64.efi" \
        --locales="" \
        --fonts="" \
        "boot/grub/grub.cfg=$IMAGE_DIR/boot/grub/grub.cfg" 2>/dev/null || true
fi

if [ -f "$IMAGE_DIR/EFI/boot/bootx64.efi" ]; then
    echo "[EFI] efi.img FAT disk imajı hazırlanıyor..."
    dd if=/dev/zero of="$IMAGE_DIR/boot/grub/efi.img" bs=1M count=8 2>/dev/null || true
    mkfs.vfat "$IMAGE_DIR/boot/grub/efi.img" 2>/dev/null || true
    if command -v mmd &>/dev/null && command -v mcopy &>/dev/null; then
        mmd -i "$IMAGE_DIR/boot/grub/efi.img" ::/EFI ::/EFI/BOOT 2>/dev/null || true
        mcopy -i "$IMAGE_DIR/boot/grub/efi.img" "$IMAGE_DIR/EFI/boot/bootx64.efi" ::/EFI/BOOT/BOOTX64.EFI 2>/dev/null || true
    fi
fi

# 10. Xorriso ile Hibrit ISO İmajının Derlenmesi
echo "[7/8] Xorriso ile bootable hibrit ISO oluşturuluyor..."
ISOHDPFX=$(find /usr/lib/ISOLINUX /usr/lib/syslinux -name "isohdpfx.bin" 2>/dev/null | head -n 1 || true)

XORRISO_CMD=(
    xorriso -as mkisofs
    -iso-level 3
    -full-iso9660-filenames
    -volid "ANKORA_2_0"
    -eltorito-boot isolinux/isolinux.bin
    -eltorito-catalog isolinux/boot.cat
    -no-emul-boot -boot-load-size 4 -boot-info-table
)

if [ -n "$ISOHDPFX" ] && [ -f "$ISOHDPFX" ]; then
    XORRISO_CMD+=(-isohybrid-mbr "$ISOHDPFX")
fi

if [ -f "$IMAGE_DIR/boot/grub/efi.img" ]; then
    XORRISO_CMD+=(
        -eltorito-alt-boot
        -e boot/grub/efi.img
        -no-emul-boot
        -isohybrid-gpt-basdat
    )
fi

XORRISO_CMD+=(-output "$ROOT_DIR/dist/$ISO_NAME" "$IMAGE_DIR")

"${XORRISO_CMD[@]}" 2>/dev/null || {
    echo "[UYARI] Hibrit xorriso komutu tamamlanamadı, standart mod ile deneniyor..."
    xorriso -as mkisofs -r -V "ANKORA_2_0" -o "$ROOT_DIR/dist/$ISO_NAME" "$IMAGE_DIR"
}

# 11. Bitiş ve Doğrulama
echo "[8/8] ISO Doğrulaması ve SHA256..."
if [ -f "$ROOT_DIR/dist/$ISO_NAME" ]; then
    cd "$ROOT_DIR/dist"
    sha256sum "$ISO_NAME" > "$ISO_NAME.sha256"
    echo "======================================================================"
    echo "  BAŞARILI: Ankora Linux ISO Kalıbı Hazır!"
    echo "  Konum: $ROOT_DIR/dist/$ISO_NAME"
    echo "  Boyut: $(du -h "$ISO_NAME" | cut -f1)"
    echo "  SHA256: $(cat "$ISO_NAME.sha256" | cut -d' ' -f1)"
    echo "======================================================================"
else
    echo "[HATA] ISO derleme işlemi tamamlanamadı!" >&2
    exit 3
fi
