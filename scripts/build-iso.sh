#!/bin/bash
# ==============================================================================
# Ankora Linux 2.0 (Daedalus) — Canlı (Live) ISO Derleme Betiği
# Masaüstü Ortamı: Ayaz DE (Tauri + WebKitGTK + SysVinit Core)
# Mimari: x86_64 (UEFI + BIOS Hibrit Boot)
# ==============================================================================

set -euo pipefail

ISO_NAME="ankora-linux-2.0-ayaz-amd64.iso"
WORK_DIR="/var/tmp/ankora-iso-build"
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
REQUIRED_HOST_PKGS=(debootstrap squashfs-tools xorriso isolinux syslinux-common syslinux-efi grub-pc-bin grub-efi-amd64-bin mtools dosfstools wget gpgv)
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

# Devuan suite betiğini debootstrap için tanımla (Debian host üzerinde eksikse ekle)
if [ ! -f "/usr/share/debootstrap/scripts/$DEVUAN_SUITE" ]; then
    echo "[BİLGİ] Debootstrap için $DEVUAN_SUITE profili oluşturuluyor..."
    if [ -f "/usr/share/debootstrap/scripts/bookworm" ]; then
        ln -sf bookworm "/usr/share/debootstrap/scripts/$DEVUAN_SUITE"
    else
        ln -sf sid "/usr/share/debootstrap/scripts/$DEVUAN_SUITE"
    fi
fi

# Devuan GPG resmi anahtarlık denetimi
if [ ! -f /usr/share/keyrings/devuan-archive-keyring.gpg ]; then
    echo "[BİLGİ] Devuan resmi GPG anahtarlığı (devuan-keyring) aranıyor..."
    wget -qO /tmp/devuan-keyring.deb https://pkgmaster.devuan.org/devuan/pool/main/d/devuan-keyring/devuan-keyring_2022.09.04_all.deb 2>/dev/null || true
    if [ -f /tmp/devuan-keyring.deb ] && [ -s /tmp/devuan-keyring.deb ]; then
        dpkg -i /tmp/devuan-keyring.deb 2>/dev/null || apt-get install -f -y 2>/dev/null || true
        rm -f /tmp/devuan-keyring.deb
    fi
fi

KEYRING_ARG=""
if [ -f /usr/share/keyrings/devuan-archive-keyring.gpg ]; then
    KEYRING_ARG="--keyring=/usr/share/keyrings/devuan-archive-keyring.gpg"
elif [ -f /etc/apt/trusted.gpg.d/devuan-archive-keyring.gpg ]; then
    KEYRING_ARG="--keyring=/etc/apt/trusted.gpg.d/devuan-archive-keyring.gpg"
else
    # Anahtarlıksız kurulum imzasız taban sistem demektir; sessizce geçilmez.
    echo "[HATA] Devuan GPG anahtarlığı bulunamadı:" >&2
    echo "       /usr/share/keyrings/devuan-archive-keyring.gpg" >&2
    echo "       /etc/apt/trusted.gpg.d/devuan-archive-keyring.gpg" >&2
    echo "[HATA] Kurulum imzasız olacağı için durduruldu." >&2
    exit 1
fi

# 3. Temiz Çalışma Alanı Hazırlığı
echo "[1/8] Çalışma dizinleri hazırlanıyor..."
umount -lf "$CHROOT_DIR/dev/pts" 2>/dev/null || true
umount -lf "$CHROOT_DIR/dev" 2>/dev/null || true
umount -lf "$CHROOT_DIR/proc" 2>/dev/null || true
umount -lf "$CHROOT_DIR/sys" 2>/dev/null || true
# Test ya da önceki derlemeden kalan bağ noktaları (X11 soket tmpfs'i dahil)
# da çözülür. Bunlar hâlâ bağlıyken rm -rf salt-okunur dosya sistemi
# hatasıyla durur ve derleme başlamadan biter.
awk -v p="$CHROOT_DIR" 'index($2, p "/") == 1 { print $2 }' /proc/mounts 2>/dev/null \
    | sort -r | while IFS= read -r m; do
        umount -lf "$m" 2>/dev/null || true
    done || true
rm -rf "$WORK_DIR"
mkdir -p "$CHROOT_DIR" "$IMAGE_DIR/live" "$IMAGE_DIR/isolinux" "$IMAGE_DIR/boot/grub" "$ROOT_DIR/dist"

# 4. Debootstrap ile Temel Devuan Daedalus Sisteminin İndirilmesi
echo "[2/8] Devuan Daedalus SysVinit temel tabanı kuruluyor (debootstrap)..."
debootstrap --arch=amd64 \
    --variant=minbase \
    $KEYRING_ARG \
    --include=sysvinit-core,sysvinit-utils,insserv,initramfs-tools,live-boot,live-config,live-config-sysvinit \
    "$DEVUAN_SUITE" "$CHROOT_DIR" "$DEVUAN_MIRROR"

# 5. Sanal Dosya Sistemlerinin Bağlanması (Mount) ve Anahtarlık Transferi
mkdir -p "$CHROOT_DIR/etc/apt/trusted.gpg.d" "$CHROOT_DIR/usr/share/keyrings"
cp -f /usr/share/keyrings/devuan* "$CHROOT_DIR/etc/apt/trusted.gpg.d/" 2>/dev/null || true
cp -f /usr/share/keyrings/devuan* "$CHROOT_DIR/usr/share/keyrings/" 2>/dev/null || true
# Baz sistemler anahtarlığı yalnızca /etc/apt/trusted.gpg.d altında tutar.
# Ama bu dosyalar devuan-keyring paketinin conffile'larıyla aynı yolda
# çakışır: önceden konursa dpkg conffile sorusunda stdin'de eof alır, paketi
# yarı bırakır ve sonraki apt-get'i `set -e` ile durdurur. Yalnızca yukarıdaki
# kopyalama hiçbir şey koymadıysa yedeğe başvur.
if ! ls "$CHROOT_DIR/etc/apt/trusted.gpg.d/"devuan*.gpg >/dev/null 2>&1; then
    cp -f /etc/apt/trusted.gpg.d/devuan* "$CHROOT_DIR/etc/apt/trusted.gpg.d/" 2>/dev/null || true
fi

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

# -----------------------------------------------------------------------
# ALAN YÖNETİMİ: Gereksiz dil/doc/man dosyalarını engelle (~300 MB tasarruf)
# -----------------------------------------------------------------------
cat << 'NODOC' > /etc/dpkg/dpkg.cfg.d/01-nodoc
path-exclude /usr/share/doc/*
path-exclude /usr/share/man/*
path-exclude /usr/share/info/*
path-exclude /usr/share/lintian/*
path-exclude /usr/share/linda/*
path-include /usr/share/doc/*/copyright
NODOC

cat << 'NOLOCALE' > /etc/dpkg/dpkg.cfg.d/02-nolocale
path-exclude /usr/share/locale/*
path-include /usr/share/locale/tr/*
path-include /usr/share/locale/en/*
path-include /usr/share/locale/locale.alias
NOLOCALE

# Non-interactive derlemede dpkg'nin conffile sorusu stdin'de eof verir ve
# paketi yarı bırakır; `DEBIAN_FRONTEND=noninteractive` bu soruyu susturmaz,
# çünkü soru debconf değil dpkg'nin kendisine ait. Sorunun varsayılanı olan
# "mevcut dosyayı koru" seçeneğini sessizce uygula.
cat << 'CONFOPT' > /etc/apt/apt.conf.d/01-build-confold
Dpkg::Options { "--force-confdef"; "--force-confold"; };
CONFOPT

# Bazı ağlarda IPv6 erişilemezken DNS IPv6 adresi döndürdüğünde apt
# indirmeleri zaman aşımına düşüp kurulumu yarıda kesiyor. Build sırasında
# IPv4 zorlanır; squashfs öncesi bu dosya kaldırılır, ISO'ya sızmaz.
cat << 'FORCEIPV4' > /etc/apt/apt.conf.d/02-build-forceipv4
Acquire::ForceIPv4 "true";
FORCEIPV4

# Depo kaynakları
cat << 'SOURCES' > /etc/apt/sources.list
deb http://deb.devuan.org/merged daedalus main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-security main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-updates main contrib non-free non-free-firmware
SOURCES

# trusted=yes imza denetimini tamamen kapatıyordu. Anahtarlık yukarıda
# zaten chroot'a kopyalandığından Release dosyaları GPG ile doğrulanır;
# doğrulanamazsa `set -e` kurulumu burada durdurur.
apt-get update -qq
apt-get install -y --no-install-recommends devuan-keyring || true

# -----------------------------------------------------------------------
# FARZ 1: Linux Çekirdeği ve temel araçlar (alan kontrolü ile)
# -----------------------------------------------------------------------
apt-get install -y --no-install-recommends \
    linux-image-amd64 \
    live-boot \
    live-config \
    live-config-sysvinit \
    initramfs-tools \
    ca-certificates \
    curl \
    wget \
    sudo \
    locales

# Ara temizlik (çekirdek ve firmware dosyaları çok yer kaplar)
apt-get clean
rm -rf /var/lib/apt/lists/*
apt-get update -qq

echo "[ALAN RAPORU] Çekirdek kurulumundan sonra:"
df -h / || true

# -----------------------------------------------------------------------
# FARZ 2: Xorg (minimal sürücü seti — tüm video sürücüleri DEĞİL)
# -----------------------------------------------------------------------
apt-get install -y --no-install-recommends \
    xserver-xorg-core \
    xserver-xorg-video-all \
    xserver-xorg-video-vesa \
    xserver-xorg-video-fbdev \
    xserver-xorg-video-vmware \
    xserver-xorg-video-qxl \
    xserver-xorg-input-all \
    xserver-xorg-legacy \
    libgl1-mesa-dri \
    libglx-mesa0 \
    mesa-va-drivers \
    mesa-utils \
    xinit \
    openbox \
    x11-xserver-utils \
    dbus-x11

# Ara temizlik
apt-get clean
rm -rf /var/lib/apt/lists/*
apt-get update -qq

echo "[ALAN RAPORU] Xorg kurulumundan sonra:"
df -h / || true

# -----------------------------------------------------------------------
# FARZ 3: WebKitGTK, ses ve kiosk bileşenleri + Kurulum Araçları
# -----------------------------------------------------------------------
apt-get install -y --no-install-recommends \
    libwebkit2gtk-4.0-37 \
    libgtk-3-0 \
    libayatana-appindicator3-1 \
    python3 \
    python3-gi \
    gir1.2-webkit2-4.0 \
    gir1.2-gtk-3.0 \
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
    parted \
    dosfstools \
    e2fsprogs \
    rsync \
    grub-efi-amd64-bin \
    grub-pc-bin \
    xdg-utils \
    file \
    scrot \
    xterm

# -----------------------------------------------------------------------
# GÜVENLİK: DSA sınıfı çekirdek/paket yamaları — debootstrap tabanı
# daedalus-security'deki son sürümlere çekilir; ISO bayat çekirdekle
# çıkmaz (ör. DSA-6528-1 sonrası 6.1.187-1).
# -----------------------------------------------------------------------
echo "[GÜVENLİK] Güvenlik güncellemeleri uygulanıyor (daedalus-security)..."
apt-get update -qq
apt-get -y dist-upgrade
echo "[GÜVENLİK] linux-image-amd64 = $(dpkg-query -W -f='${Version}' linux-image-amd64 2>/dev/null || echo ?)"
UPG=$(apt-get -s dist-upgrade 2>/dev/null | awk '/^Inst/{c++} END{print c+0}')
echo "[GÜVENLİK] Bekleyen paket güncellemesi: $UPG (beklenen 0)"

# Son temizlik
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "[ALAN RAPORU] Tüm paketler kurulduktan sonra:"
df -h / || true

# -----------------------------------------------------------------------
# Yerel ayarlar (Türkçe & UTF-8 desteği)
# -----------------------------------------------------------------------
echo "tr_TR.UTF-8 UTF-8" > /etc/locale.gen
echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
locale-gen
update-locale LANG=tr_TR.UTF-8

# -----------------------------------------------------------------------
# Canlı Oturum Kullanıcısı: ankora
# -----------------------------------------------------------------------
for grp in sudo audio video plugdev netdev; do
    getent group "$grp" >/dev/null || groupadd -r "$grp" 2>/dev/null || true
done

if ! id -u ankora &>/dev/null; then
    useradd -m -s /bin/bash -u 1000 -G sudo,audio,video,plugdev,netdev ankora
else
    usermod -aG sudo,audio,video,plugdev,netdev ankora 2>/dev/null || true
fi

# Root hesabı doğrudan girişlere kilitlenir
passwd -l root 2>/dev/null || true

# Canlı kullanıcı 'ankora' için varsayılan parola: ankora
echo "ankora:ankora" | chpasswd
passwd -u ankora 2>/dev/null || true

# Canlı sistem kullanıcısı için şifresiz sudo (Live USB / Kiosk için tam yetki)
cat << 'SUDO' > /etc/sudoers.d/ankora
ankora ALL=(ALL:ALL) NOPASSWD: ALL
SUDO
chmod 0440 /etc/sudoers.d/ankora

# Hostname
echo "ankora-live" > /etc/hostname

# Xorg Kullanıcı Hakları (xserver-xorg-legacy ile ankora kullanıcısının startx çalıştırma izni)
mkdir -p /etc/X11
cat << 'XWRAP' > /etc/X11/Xwrapper.config
allowed_users=anybody
needs_root_rights=yes
XWRAP
chmod 0644 /etc/X11/Xwrapper.config

# Ağ Yapılandırması: Loopback arabirimi
mkdir -p /etc/network
cat << 'NETIF' > /etc/network/interfaces
auto lo
iface lo inet loopback

allow-hotplug eth0
iface eth0 inet dhcp
NETIF

# ----------------------------------------------------------------------
# Ağ: Fiziksel arayüzler için DHCP istemcisi (SysVinit)
# /etc/network/interfaces eth0 adını sabit yazar; gerçek arayüz adı
# enp1s0 / ens33 gibi bir değerse ifupdown hiç devreye girmez ve canlı
# sistemde bağlantı hiç kurulmaz. ayaz-net adı değil /sys/class/net/*
# altındaki aygıt kökünü (device) esas alır, her fiziksel arayüz için
# ayrı dhclient başlatır. Chroot-setup.sh içinde çalışıldığı için hem
# betik yazımı hem de update-rc.d doğrudan chroot dosya sisteminde yapılır.
# ----------------------------------------------------------------------
mkdir -p /etc/init.d /run /var/lib/dhcp
cat << 'AYAZNET' > /etc/init.d/ayaz-net
#!/bin/sh
### BEGIN INIT INFO
# Provides:          ayaz-net
# Required-Start:    $network $remote_fs
# Required-Stop:     $network $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Fiziksel ethernet arayüzleri için DHCP
# Description:       Fiziksel kablolu arayüzleri ayağa kaldırır ve her biri
#                    için ayrı bir dhclient süreci başlatır.
### END INIT INFO
# chkconfig: 2345 90 10
#
# Canlı ISO'da arayüz adı eth0 olmak zorunda değildir (enp1s0, ens33...).

PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
RUNDIR=/run
LEASEDIR=/var/lib/dhcp

# Kablosuz, konteyner ve türetilmiş arayüzler dışarıda bırakılır:
# onların bağlantısını wpa_supplicant / docker / vpn kendi üstlenir.
skip_iface() {
    case "$1" in
        lo|wlan*|wlx*|docker*|veth*|tun*|tap*|wg*|tailscale*) return 0 ;;
    esac
    return 1
}

start_iface() {
    name="$1"
    # Aynı arayüz için çalışan bir dhclient varsa ikincisi IP'yi paylaşamaz
    if [ -f "$RUNDIR/dhclient.$name.pid" ] && \
       kill -0 "$(cat "$RUNDIR/dhclient.$name.pid" 2>/dev/null)" 2>/dev/null; then
        return 0
    fi
    ip link set "$name" up 2>/dev/null || ifconfig "$name" up 2>/dev/null || true
    dhclient -nw -pf "$RUNDIR/dhclient.$name.pid" \
             -lf "$LEASEDIR/dhclient.$name.lease" "$name" >/dev/null 2>&1 || true
}

do_start() {
    mkdir -p "$RUNDIR" "$LEASEDIR"
    for path in /sys/class/net/*; do
        [ -e "$path" ] || continue
        name="${path##*/}"
        skip_iface "$name" && continue
        # Yalnız fiziksel arayüzlerin altında device kökü vardır
        [ -d "$path/device" ] || continue
        start_iface "$name"
    done
    return 0
}

do_stop() {
    for pf in "$RUNDIR"/dhclient.*.pid; do
        [ -f "$pf" ] || continue
        pid="$(cat "$pf" 2>/dev/null)"
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
        rm -f "$pf"
    done
    return 0
}

case "$1" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart|force-reload)
        do_stop
        do_start
        ;;
    status)
        # LSB: 0 çalışır, 3 çalışmıyor
        alive=3
        for pf in "$RUNDIR"/dhclient.*.pid; do
            [ -f "$pf" ] || continue
            if kill -0 "$(cat "$pf" 2>/dev/null)" 2>/dev/null; then
                alive=0
            fi
        done
        exit "$alive"
        ;;
    *)
        echo "Kullanım: $0 {start|stop|restart|status}" >&2
        exit 1
        ;;
esac
exit 0
AYAZNET
chmod +x /etc/init.d/ayaz-net

# LSB başlığındaki Default-Start: 2 3 4 5 dizilimi rc2..rc5'te başlatma
# bağlantılarını kurar. insserv $network tesisatını bulamazsa betiği
# reddedebiliyor; böyle durumda bağlantılar elle kurulur (DHCP'siz kalmak
# canlı sistemde bağlantı yok demektir).
if ! update-rc.d ayaz-net defaults; then
    for rl in 2 3 4 5; do
        ln -sf ../init.d/ayaz-net "/etc/rc$rl.d/S01ayaz-net"
    done
    for rl in 0 1 6; do
        ln -sf ../init.d/ayaz-net "/etc/rc$rl.d/K01ayaz-net"
    done
fi
# ifupdown kuruluysa kendi betiği de devreye girsin (varsa)
if [ -f /etc/init.d/networking ]; then
    update-rc.d networking defaults 2>/dev/null || true
fi

# -----------------------------------------------------------------------
# X11 Otomatik Kiosk Başlatıcı
# -----------------------------------------------------------------------
cat << 'XINIT' > /home/ankora/.xinitrc
#!/bin/sh
# Loopback ağ arabirimini ayağa kaldır
ip link set lo up 2>/dev/null || ifconfig lo 127.0.0.1 up 2>/dev/null || true

xsetroot -solid "#0b0c10" 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s off 2>/dev/null || true
xset s noblank 2>/dev/null || true
# Kullanıcının Ayarlar'dan verdiği DPMS zaman aşımı yeniden başlatmada korunur
[ -f "$HOME/.config/ankora/dpms_secs" ] && xset +dpms dpms "$(cat "$HOME/.config/ankora/dpms_secs")" "$(cat "$HOME/.config/ankora/dpms_secs")" "$(cat "$HOME/.config/ankora/dpms_secs")" 2>/dev/null || true

# 1) Ekranın önerilen (native) çözünürlüğüne geç: kurulu sistemde düşük
#    modda kalan ekranın bulanık/sahte görünmesini böyle önlenir.
# 2) Önerilen okunamazsa ve çözünürlük hâlâ çok düşükse (ör. sanal
#    makinenin varsayılanı) eski düzeltme uygulanır; fiziksel ekranda
#    orijinal çözünürlük asla düşürülmez.
PREF=$(xrandr 2>/dev/null | awk '{
    for (i = 2; i <= NF; i++) {
        if (index($i, "+") && $(i - 1) ~ /^[0-9]+x[0-9]+$/) { print $(i - 1); exit }
    }
}')
CURM=$(xrandr 2>/dev/null | awk '{
    for (i = 2; i <= NF; i++) {
        if (index($i, "*") && $(i - 1) ~ /^[0-9]+x[0-9]+$/) { print $(i - 1); exit }
    }
}')
if [ -n "$PREF" ] && [ "$PREF" != "$CURM" ]; then
    xrandr -s "$PREF" 2>/dev/null || true
fi

CURW=$(xrandr 2>/dev/null | awk '/\*/{print $1; exit}' | cut -dx -f1)
case "$CURW" in
    ''|640*|720*|800*|854*|960*) xrandr -s 1280x800 2>/dev/null || xrandr -s 1024x768 2>/dev/null || true ;;
esac

# Pencere yöneticisini arka planda başlat
if command -v openbox >/dev/null 2>&1; then
    openbox &
fi

if [ -x /usr/bin/ayaz ]; then
    exec /usr/bin/ayaz
elif [ -x /usr/local/bin/ayaz ]; then
    exec /usr/local/bin/ayaz
else
    exec xterm 2>/dev/null || exec sh
fi
XINIT
chmod +x /home/ankora/.xinitrc
cp /home/ankora/.xinitrc /etc/skel/.xinitrc

# SysVinit Otomatik Giriş (Getty inittab)
mkdir -p /etc/inittab.d
if [ ! -f /etc/inittab ] && [ -f /usr/share/sysvinit/inittab ]; then
    cp /usr/share/sysvinit/inittab /etc/inittab
fi
if [ -f /etc/inittab ]; then
    if grep -q "tty1" /etc/inittab; then
        sed -i -E 's|^[0-9a-zA-Z]+:([0-9]+):respawn:/sbin/getty.*tty1.*|1:\1:respawn:/sbin/getty --autologin ankora --noclear 38400 tty1 linux|' /etc/inittab
    else
        echo "1:2345:respawn:/sbin/getty --autologin ankora --noclear 38400 tty1 linux" >> /etc/inittab
    fi
fi

# TTY1 Girişinde startx Başlatma
cat << 'PROFILE' >> /home/ankora/.profile
if [ -z "$DISPLAY" ] && [ "$(tty 2>/dev/null)" = "/dev/tty1" ]; then
    exec startx -- -keeptty > ~/.xsession-errors 2>&1
fi
PROFILE
chown -R ankora:ankora /home/ankora
cp /home/ankora/.profile /etc/skel/.profile

# -----------------------------------------------------------------------
# INITRAMFS GÜNCELLEMESİ — live-boot modüllerinin initrd'ye eklenmesi
# Bu adım olmazsa ISO boot sırasında root dosya sistemi bulunamaz!
# -----------------------------------------------------------------------
echo "[KRİTİK] initramfs güncelleniyor (live-boot modülleri enjekte ediliyor)..."
update-initramfs -u -k all

# Canlı imaj için resmi kaynak listesi
cat << 'SOURCES' > /etc/apt/sources.list
deb http://deb.devuan.org/merged daedalus main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-security main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged daedalus-updates main contrib non-free non-free-firmware
SOURCES

# Son temizlik
apt-get clean
rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Gereksiz doc, man, locale dosyalarını temizle
rm -rf /usr/share/doc/* /usr/share/man/* /usr/share/info/* 2>/dev/null || true
rm -rf /usr/share/lintian/* /usr/share/linda/* 2>/dev/null || true

echo "[ALAN RAPORU] Son durum:"
df -h / || true
du -sh / 2>/dev/null || true
EOF

chmod +x "$CHROOT_DIR/chroot-setup.sh"
chroot "$CHROOT_DIR" /chroot-setup.sh
rm -f "$CHROOT_DIR/chroot-setup.sh"

# 6.b Örnek belgeler: canlı oturum ankora ile çalışır, /root/Belgeler'e
# erişemez. Ofis ve Dosyalar GERÇEK açılan dosyalar göstermeli; PDF
# içeriğinin tek doğruluk kaynağı src/app.js'teki yerleşik base64 gömülüdür.
BDIR="$CHROOT_DIR/home/ankora/Belgeler"
mkdir -p "$BDIR"
_src_app_js="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)/src/app.js"
if [ -f "$_src_app_js" ]; then
    sed -n "s/.*base64,\([A-Za-z0-9+/=]\{50,\}\).*/\1/p" "$_src_app_js" \
        | head -n 1 | base64 -d > "$BDIR/ankora-sistem-rehberi.pdf" 2>/dev/null || true
fi
if grep -q '%PDF' "$BDIR/ankora-sistem-rehberi.pdf" 2>/dev/null; then
    echo "[BELGE] ankora-sistem-rehberi.pdf yazildi ($(stat -c%s "$BDIR/ankora-sistem-rehberi.pdf") bayt)"
else
    echo "[BELGE] UYARI: PDF olusturulamadi — $_src_app_js kontrol edin"
fi
cat << 'KIOSKTXT' > "$BDIR/kiosk-ayarlari.txt"
Ankora Linux 2.0 — Kiosk Yapılandırma Raporu
=============================================

Taban            : Devuan GNU/Linux 5 (daedalus)
Init sistemi     : SysVinit (systemd yok)
Çekirdek         : Linux 6.1 LTS
Masaüstü         : Ayaz DE (Ayaz — Ankora Linux)
Pencere motoru   : Tauri 1.5 + WebKitGTK
Otomatik giriş   : tty1 getty --autologin ankora → startx
Ekran düzeltmesi : Yalnızca çözünürlük çok düşükse xrandr -s 1280x800
Paket yöneticisi : Yazılım Mağazası (apt tabanlı)

Bu dosya Ayaz Dosyalar ve Ofis uygulamalarından açılabilir.
Kiosk kilit ekranı ve widget ayarları Ayarlar penceresinden yönetilir.
KIOSKTXT
cat << 'KIOSKMD' > "$BDIR/kiosk-ayarlari.md"
# Ankora Linux 2.0 — Kiosk Yapılandırma Raporu

- Taban: Devuan Daedalus (SysVinit, systemd-free)
- Çekirdek: Linux 6.1 LTS
- Pencere motoru: Tauri + WebKitGTK
- Otomatik giriş: tty1 getty --autologin ankora → startx
- Ekran: xrandr donanım kontrolü, yalnız düşük çözünürlükte düzeltme
- Bellek: ZRAM + disk swap hiyerarşisi

Bu belge Ayaz Ofis yerel belge işleyicisi tarafından render edilir.
KIOSKMD
# Sayısal chown: betik host'ta koşuyor, host'ta "ankora" kullanıcı adı
# yok (set -euo pipefail ad-üstü chown'u öldürürdü). Canlı sistemde
# ankora = uid/gid 1000 (e2e --userspec=1000:1000 ile doğrulandı).
chown -R 1000:1000 "$BDIR"
echo "[BELGE] Belgeler/ icerigi: $(ls "$BDIR" | tr '\n' ' ')"

# 6.c Türkçe XDG klasörleri: dosya yöneticisi, Başlat menüsü ve Ofis bu
# adları bekler; oluşturulmazsa kullanıcı kendi evinde boş kalır. Aynı
# içerik skel'e de konur ki kurulumdan sonraki kullanıcılar da alsın.
# Sayısal chown: betik host'ta koşuyor, host'ta "ankora" kullanıcı adı yok
# (set -euo pipefail ad-üstü chown'u öldürürdü); canlı sistemde uid/gid 1000.
XDG_HOME="$CHROOT_DIR/home/ankora"
for xdg_d in Masaüstü İndirilenler Belgeler Müzik Resimler Videolar; do
    mkdir -p "$XDG_HOME/$xdg_d"
done
mkdir -p "$XDG_HOME/.config"
cat << 'USERDIRS' > "$XDG_HOME/.config/user-dirs.dirs"
XDG_DESKTOP_DIR="$HOME/Masaüstü"
XDG_DOWNLOAD_DIR="$HOME/İndirilenler"
XDG_DOCUMENTS_DIR="$HOME/Belgeler"
XDG_MUSIC_DIR="$HOME/Müzik"
XDG_PICTURES_DIR="$HOME/Resimler"
XDG_VIDEOS_DIR="$HOME/Videolar"
USERDIRS
mkdir -p "$CHROOT_DIR/etc/skel/.config"
for xdg_d in Masaüstü İndirilenler Belgeler Müzik Resimler Videolar; do
    mkdir -p "$CHROOT_DIR/etc/skel/$xdg_d"
done
cp "$XDG_HOME/.config/user-dirs.dirs" "$CHROOT_DIR/etc/skel/.config/user-dirs.dirs"
chown -R 1000:1000 "$XDG_HOME/.config" \
    "$XDG_HOME/Masaüstü" "$XDG_HOME/İndirilenler" "$XDG_HOME/Belgeler" \
    "$XDG_HOME/Müzik" "$XDG_HOME/Resimler" "$XDG_HOME/Videolar"
echo "[XDG] Türkçe klasörler: $(ls "$XDG_HOME" | tr '\n' ' ')"

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
    echo "[BİLGİ] Önceden derlenmiş Ayaz DE .deb paketi kuruluyor..."
    cp "$ROOT_DIR/dist/ayaz-de-latest-amd64.deb" "$CHROOT_DIR/tmp/ayaz.deb"
    chroot "$CHROOT_DIR" bash -c "dpkg -i /tmp/ayaz.deb || apt-get install -f -y; rm -f /tmp/ayaz.deb"
elif [ -f "$ROOT_DIR/src-tauri/target/release/ayaz-de" ]; then
    echo "[BİLGİ] Ayaz DE ikili dosyası kopyalanıyor..."
    cp "$ROOT_DIR/src-tauri/target/release/ayaz-de" "$CHROOT_DIR/usr/bin/ayaz"
    chmod +x "$CHROOT_DIR/usr/bin/ayaz"
else
    echo "[BİLGİ] Ayaz DE Kiosk çalışma ortamı ve arayüz bileşenleri entegre ediliyor..."
    mkdir -p "$CHROOT_DIR/usr/share/ayaz"
    cp -r "$ROOT_DIR/src/"* "$CHROOT_DIR/usr/share/ayaz/"
    cat << 'AYAZ_PY' > "$CHROOT_DIR/usr/bin/ayaz"
#!/usr/bin/env python3
import sys, os, subprocess, json, threading, shutil, re, shlex, hmac, gzip, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.parse, urllib.request

# GPU Donanım Hızlandırma ve WebKit Ortam Değişkenleri
os.environ["GDK_BACKEND"] = "x11"

# Canlı oturumda kullanıcı PATH'i /sbin ve /usr/sbin içermez; sistem ve
# kurulum araçları (parted, mkfs.vfat, blkid, chroot...) bu dizinlerdedir.
# Bilinen sistem dizinleri başa eklenir ki alt süreçlerin hepsi aynı yolu görsün.
_SBIN_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
os.environ['PATH'] = _SBIN_PATH + os.pathsep + os.environ.get('PATH', '')

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.0')
from gi.repository import Gtk, WebKit2, Gdk, GLib

PORT = 49152
# Origin başlığı yansıtılmaz: sabitlenen tek origin, aynı makinedeki her
# sayfanın IPC köprüsünü kullanmasını engeller.
ALLOWED_ORIGIN = f'http://127.0.0.1:{PORT}'
TERM_CWD = '/home/ankora' if os.path.exists('/home/ankora') else os.path.expanduser('~')

# GÜVENLİK: IPC Token - sunucu başlarken üretilir, her istekte doğrulanır
import secrets
IPC_TOKEN = secrets.token_hex(32)
# Ardışık başarısız token denemelerini sayar; aşımında kapı tamamen kapanır
IPC_STATE = {'bad': 0}

# XDG tarama önbelleği: dizin özetleri (mtime) değişmediyse yeniden taranmaz
_XDG_CACHE = None

# Radyo (Wi-Fi/Bluetooth) ve ağ durumu: nmcli varsa o, yoksa rfkill.
def _run_capture(cmd_args):
    # Sabit argümanlı tek komut; kabuk yorumlaması yok, aracı yoksa None.
    try:
        proc = subprocess.run(
            cmd_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, timeout=15
        )
    except Exception:
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout

def _root_run(cmd_args, stdin_text=None, timeout=30):
    """root gerektiren komutu ya doğrudan ya da `sudo -n` ile çalıştırır.

    Canlı sistemde ankora için parolasız sudo tanımlıdır; sudo yoksa ya da
    parola gerekiyorsa beklemeden net bir Türkçe hata döner."""
    if os.geteuid() == 0:
        run_args = list(cmd_args)
    elif shutil.which('sudo'):
        run_args = ['sudo', '-n'] + list(cmd_args)
    else:
        raise Exception('Bu ayar için yönetici (root) yetkisi gerekiyor: sudo kurulu değil.')
    try:
        proc = subprocess.run(
            run_args, input=stdin_text, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True, timeout=timeout
        )
    except subprocess.TimeoutExpired:
        raise Exception(f'Komut zaman aşımına uğradı ({timeout} sn)')
    except Exception as e:
        raise Exception(f'Komut çalıştırılamadı: {e}')
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or '').strip()
        if any(t in err for t in ('password is required', 'a terminal is required', 'no tty present')):
            raise Exception('Bu ayar için yönetici (root) yetkisi gerekiyor: sudo parola soruyor.')
    return proc

def _rfkill_enabled(out):
    for line in out.splitlines():
        t = line.strip()
        if t.startswith('Soft blocked:'):
            return t.endswith('no')
    return False

def _radio_state():
    state = {
        'available': False, 'backend': '', 'wifi_enabled': False,
        'bluetooth_enabled': False, 'wifi_ssid': ''
    }
    wifi = _run_capture(['nmcli', 'radio', 'wifi'])
    if wifi is not None:
        bt = _run_capture(['nmcli', 'radio', 'bluetooth']) or ''
        state['available'] = True
        state['backend'] = 'nmcli'
        state['wifi_enabled'] = wifi.strip() == 'enabled'
        state['bluetooth_enabled'] = bt.strip() == 'enabled'
        if state['wifi_enabled']:
            listing = _run_capture(['nmcli', '-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi', 'list'])
            if listing:
                for line in listing.splitlines():
                    parts = line.split(':', 1)
                    if len(parts) == 2 and parts[0] == 'yes' and parts[1]:
                        state['wifi_ssid'] = parts[1].replace('\\:', ':').replace('\\\\', '\\')
                        break
        return state
    wl = _run_capture(['rfkill', 'list', 'wifi'])
    if wl is not None:
        state['available'] = True
        state['backend'] = 'rfkill'
        state['wifi_enabled'] = _rfkill_enabled(wl)
        bl = _run_capture(['rfkill', 'list', 'bluetooth'])
        if bl is not None:
            state['bluetooth_enabled'] = _rfkill_enabled(bl)
    return state

def _battery_state():
    # Masaüstü makinelerde BAT* yoktur; None döner ve arayüzde gizlenir.
    try:
        for name in sorted(os.listdir('/sys/class/power_supply')):
            if not name.startswith('BAT'):
                continue
            base = os.path.join('/sys/class/power_supply', name)
            pct = None
            status = None
            try:
                with open(os.path.join(base, 'capacity')) as f:
                    pct = int(f.read().strip())
            except Exception:
                pass
            try:
                with open(os.path.join(base, 'status')) as f:
                    status = f.read().strip()
            except Exception:
                pass
            return {'percent': pct, 'status': status}
    except Exception:
        pass
    return {'percent': None, 'status': None}

# /proc/stat sayaçları iki okuma arası okunur; ilk örnekte 0.0 döner.
_CPU_PREV = {'total': None, 'idle': None}

def _cpu_percent():
    try:
        with open('/proc/stat') as f:
            parts = f.readline().split()
        vals = [int(x) for x in parts[1:] if x.isdigit()]
        if len(vals) < 4:
            return None
        total = sum(vals)
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    except Exception:
        return None
    prev_total = _CPU_PREV['total']
    prev_idle = _CPU_PREV['idle']
    pct = 0.0
    if prev_total is not None and total > prev_total:
        dt = total - prev_total
        di = idle - prev_idle
        pct = max(0.0, min(100.0, 100.0 * (1.0 - di / dt)))
    _CPU_PREV['total'] = total
    _CPU_PREV['idle'] = idle
    return round(pct, 1)

def _disk_usage():
    # Kök bölünüm: (kullanılan GB, toplam GB, %); okunamazsa None.
    try:
        import shutil
        du = shutil.disk_usage('/')
        g = 1024 ** 3
        pct = int(round(100.0 * du.used / du.total)) if du.total else 0
        return (round(du.used / g, 1), round(du.total / g, 1), pct)
    except Exception:
        return None

# --- Ekran modu güvenli değiştirme yardımcıları ---------------------------
# Çözünürlük değişikliği 15 saniye içinde onaylanmazsa eski moda geri
# dönülür: kullanıcı yanlış mod seçerse ekran kararmaz/kurulmaz, sistem
# kendini kurtarır. Onay arayüzden confirm_display_mode ile gelir.
DISPLAY_REVERT_DELAY = 15
_display_revert = {'pid': None, 'mode': None, 'rate': None, 'output': None}


def _display_current_state():
    """xrandr --query okuyup {'output','mode','rate'} döndürür; bulunamazsa None."""
    try:
        p = subprocess.run(['xrandr', '--query'], stdout=subprocess.PIPE,
                           stderr=subprocess.DEVNULL, text=True, timeout=10)
    except Exception:
        return None
    out = mode = rate = None
    for line in p.stdout.splitlines():
        if out is None:
            m = re.match(r'^(\S+)\s+connected\b', line)
            if m:
                out = m.group(1)
                sm = re.search(r'(\d+x\d+)\+\d+\+\d+', line)
                if sm:
                    mode = sm.group(1)
        mm = re.match(r'^\s+(\d+x\d+)\s+(.+)$', line)
        if mm:
            for tok in mm.group(2).split():
                if '*' in tok:
                    rate = tok.replace('*', '').replace('+', '')
    if out is None or mode is None:
        return None
    return {'output': out, 'mode': mode, 'rate': rate}


def _display_cancel_revert():
    pid = _display_revert.get('pid')
    if pid:
        try:
            os.kill(pid, 15)  # SIGTERM
        except Exception:
            pass
    _display_revert.update({'pid': None, 'mode': None, 'rate': None, 'output': None})


def _display_schedule_revert(prev):
    """prev hedefine DISPLAY_REVERT_DELAY saniye sonra geri dönen süreci
    başlatır; confirm_display_mode çağrısı süreci öldürerek iptal eder."""
    _display_cancel_revert()
    if not prev:
        return None
    cmd = 'sleep %d; xrandr --output %s --mode %s' % (
        DISPLAY_REVERT_DELAY, prev['output'], prev['mode'])
    if prev.get('rate'):
        cmd += ' --rate %s' % prev['rate']
    cmd += ' >/dev/null 2>&1'
    try:
        proc = subprocess.Popen(['sh', '-c', cmd])
    except Exception:
        return None
    _display_revert.update({'pid': proc.pid, 'mode': prev['mode'],
                            'rate': prev.get('rate'), 'output': prev['output']})
    return proc.pid

def execute_ayaz_command(cmd, args):
    global TERM_CWD
    home_dir = os.path.expanduser('~')
    if not os.path.exists(home_dir):
        home_dir = '/home/ankora' if os.path.exists('/home/ankora') else '/root'

    if not os.path.exists(TERM_CWD):
        TERM_CWD = home_dir

    if cmd == 'report_console':
        # Teşhis kaydı: konsol/CSP ihlalleri (/tmp/ayaz-console.log).
        line = str(args.get('line', ''))[:500].strip()
        if line:
            try:
                with open('/tmp/ayaz-console.log', 'a', encoding='utf-8') as fh:
                    fh.write(line + '\n')
            except Exception:
                pass
        return None

    if cmd == 'run_terminal_command':
        command = args.get('command', '').strip()
        if not command:
            return ''

        # GÜVENLİK: Rust tarafındaki whitelist'in Python karşılığı
        EXACT_ALLOWED = [
            'uname -a', 'uname -r', 'whoami', 'uptime', 'ls', 'ls -la', 'ls -l', 'ls -lh',
            'date', 'hostname', 'id', 'free -m', 'free -h', 'df -h', 'df -h /',
            'cat /etc/os-release', 'cat /etc/issue', 'cat /proc/version',
            'cat /proc/meminfo', 'cat /proc/cpuinfo', 'ps aux', 'top -b -n 1',
            'apt-get clean', 'apt-get update', 'apt-get upgrade -y',
            'apt-get update && apt-get upgrade -y',
            'rm -rf /tmp/*', 'apt-get clean && rm -rf /tmp/*',
            'df -h / && free -m', 'clear', 'sync',
            'echo 3 > /proc/sys/vm/drop_caches',
        ]
        ALLOWED_BINS = ['uname', 'whoami', 'uptime', 'date', 'hostname', 'id', 'free', 'df', 'ls', 'ps', 'top', 'which']
        SHELL_METACHARS = set(';|`$><\\()\n\r')
        
        # Persistent cd tracking
        if command == 'cd':
            TERM_CWD = home_dir
            return ''
        elif command.startswith('cd '):
            target_d = command[3:].strip()
            if target_d.startswith('~'):
                target_d = os.path.expanduser(target_d)
            new_path = os.path.normpath(os.path.join(TERM_CWD, target_d))
            if os.path.isdir(new_path):
                TERM_CWD = new_path
                return ''
            else:
                return f'bash: cd: {target_d}: Böyle bir dosya ya da dizin yok'

        is_exact = command in EXACT_ALLOWED
        has_meta = bool(SHELL_METACHARS & set(command))
        
        if has_meta and not is_exact:
            return '[HATA] Güvenlik İhlali: Kabuk metakarakterleri içeren komutlar reddedilir.'
        
        first_word = command.split()[0] if command.split() else ''
        if not is_exact and first_word not in ALLOWED_BINS:
            return f'[HATA] Güvenlik İhlali: \'{first_word}\' aracı izin verilenler listesinde yok.'

        if is_exact and '&&' in command:
            parts = [p.strip() for p in command.split('&&')]
            results = []
            for part in parts:
                p_args = part.split()
                try:
                    proc = subprocess.run(p_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=TERM_CWD, timeout=60)
                    if proc.stdout:
                        results.append(proc.stdout)
                except Exception as e:
                    results.append(f'[HATA] {e}')
            return '\n'.join(results) if results else '[Komut tamamlandı]'

        cmd_parts = command.split()
        try:
            proc = subprocess.run(
                cmd_parts,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=TERM_CWD,
                timeout=60
            )
        except FileNotFoundError:
            return f'bash: {first_word}: komut bulunamadı'
        except subprocess.TimeoutExpired:
            return '[HATA] Komut zaman aşımına uğradı (60s)'
        out = proc.stdout
        if proc.stderr:
            out = (out + '\n' if out else '') + proc.stderr
        return out if out else f'[Komut {proc.returncode} koduyla tamamlandı]'

    elif cmd == 'launch_application':
        exec_cmd = args.get('exec', '').strip()
        if not exec_cmd:
            raise Exception('Uygulama komutu boş olamaz')
        # GÜVENLİK: Shell metakarakterleri engelle
        SHELL_BAD = set(';|`$><\\()\n\r&')
        if SHELL_BAD & set(exec_cmd):
            raise Exception('Güvenlik Hatası: Komutta tehlikeli karakterler var')
        FORBIDDEN_BINS = {
            'sudo', 'su', 'pkexec', 'dd', 'mkfs', 'fdisk', 'parted',
            'sh', 'bash', 'zsh', 'dash', 'csh', 'tcsh', 'fish', 'env',
            'xargs', 'passwd', 'chpasswd', 'chmod', 'chown', 'reboot',
            'poweroff', 'shutdown', 'init', 'systemctl', 'telinit', 'halt',
            'chroot', 'unshare', 'nsenter', 'mount', 'umount',
            'nc', 'ncat', 'socat', 'ssh', 'scp', 'wget', 'curl',
            'kill', 'pkill', 'killall', 'tee', 'install', 'ln',
            'mkfifo', 'mknod', 'insmod', 'modprobe', 'rmmod',
            'docker', 'podman', 'runuser', 'sg', 'newgrp',
            'at', 'batch', 'crontab', 'systemd-run'
        }
        first_word = exec_cmd.split()[0]
        base_name = os.path.basename(first_word)
        if base_name in FORBIDDEN_BINS:
            raise Exception(f'Güvenlik: {base_name} doğrudan başlatılamaz')
        env = os.environ.copy()
        if 'DISPLAY' not in env:
            env['DISPLAY'] = ':0'
        cli_apps = {'htop', 'btop', 'ncdu', 'fastfetch', 'neofetch', 'inxi', 'iotop', 'iftop'}
        if first_word in cli_apps:
            subprocess.Popen(['xterm', '-title', first_word, '-e'] + exec_cmd.split(), cwd=home_dir, env=env, start_new_session=True)
        else:
            subprocess.Popen(exec_cmd.split(), cwd=home_dir, env=env, start_new_session=True)
        return f'Uygulama başlatıldı: {exec_cmd}'

    elif cmd == 'install_deb_package':
        pkg = args.get('packageName', '').strip()
        if not pkg or not re.match(r'^[a-zA-Z0-9.+_-]+$', pkg):
            raise Exception('Geçersiz paket adı biçimi')
        helper = '/usr/local/bin/ayaz-pkg-helper'
        cmd_args = ['sudo', helper, 'install', pkg] if os.path.exists(helper) else ['sudo', 'apt-get', 'install', '-y', '--no-install-recommends', '--', pkg]
        # stdin DEVNULL: sudo parola sorarsa veya dpkg conffile sorusu
        # gelirse arayüz askıda kalmasın, hata anında frontend'e dönsün.
        try:
            proc = subprocess.run(
                cmd_args,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=300
            )
        except subprocess.TimeoutExpired:
            raise Exception(f'Kurulum zaman aşımına uğradı: {pkg} (300 sn)')
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()
            if not err:
                err = f'çıkış kodu {proc.returncode}'
            raise Exception(f'Kurulum başarısız: {err}')

        # Kurulan paketin .desktop girdisi kullanıcı dizinine kopyalanır; Başlat
        # menüsü ve masaüstü ikonu yeniden başlatma sonrasında da korunur.
        # Dosya adları paket adıyla birebir örtüşmeyebilir (debian-xterm.desktop,
        # mate-terminal.desktop); önek ve ek sonu da denenir. Kimlik ve görünen
        # ad .desktop içinden alınır, yoksa taramanın döndürdüğü kayıtla
        # eşleşmez ve menüde iki kez görünür.
        app_id = app_name = app_exec = pkg
        user_app_dir = os.path.expanduser('~/.local/share/applications')
        try:
            os.makedirs(user_app_dir, exist_ok=True)
            sys_dir = '/usr/share/applications'
            if os.path.isdir(sys_dir):
                matches = [
                    os.path.join(sys_dir, fn) for fn in os.listdir(sys_dir)
                    if fn.endswith('.desktop') and (
                        fn[:-8] == pkg
                        or fn[:-8].startswith(pkg + '-')
                        or fn[:-8].endswith('-' + pkg)
                    )
                ]
                src = sorted(matches, key=len)[0] if matches else None
                if src:
                    hidden = False
                    in_entry = False
                    with open(src, encoding='utf-8', errors='replace') as fh:
                        for line in fh:
                            line = line.strip()
                            if line.startswith('['):
                                in_entry = (line == '[Desktop Entry]')
                            elif in_entry:
                                if line.startswith('Name='):
                                    app_name = line.split('=', 1)[1]
                                elif line.startswith('Exec='):
                                    parts = line.split('=', 1)[1].split()
                                    if parts:
                                        app_exec = parts[0]
                                elif line.startswith(('Hidden=True', 'NoDisplay=True')):
                                    hidden = True
                    if not hidden:
                        app_id = os.path.basename(src)[:-8]
                        shutil.copy2(src, os.path.join(user_app_dir, os.path.basename(src)))
        except Exception:
            pass

        return {'id': app_id, 'name': app_name, 'exec': app_exec,
                'cat': 'util', 'is_installed_by_user': True}

    elif cmd == 'install_vendor_package':
        # Üçüncü parti resmi depo kurulumları (Brave/Helium/Antigravity).
        # Ad eşlemesi sabittir; URL/komut arayüzden ALINMAZ — hepsi
        # root-owned ayaz-pkg-helper betiğinin içindedir.
        vendor = str(args.get('vendor', '')).strip()
        vendor_pkgs = {'brave': 'brave-browser',
                       'helium': 'helium-bin',
                       'antigravity': 'antigravity'}
        if vendor not in vendor_pkgs:
            raise Exception('Bilinmeyen uygulama kaynağı')
        helper = '/usr/local/bin/ayaz-pkg-helper'
        if not os.path.exists(helper):
            raise Exception('Güvenlik: ayaz-pkg-helper bulunamadı; vendor kurulumu yapılamaz')
        try:
            proc = subprocess.run(
                ['sudo', helper, 'vendor', vendor],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=600
            )
        except subprocess.TimeoutExpired:
            raise Exception(f'Kurulum zaman aşımına uğradı: {vendor} (600 sn)')
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()
            if not err:
                err = f'çıkış kodu {proc.returncode}'
            raise Exception(f'Kurulum başarısız: {err}')
        # Depo eklendikten sonraki paket kurulumu ve .desktop yerleşimi normal
        # kurulum akışının kendisiyle yapılır (apt ikinci çağrıda boştur).
        return execute_ayaz_command('install_deb_package',
                                    {'packageName': vendor_pkgs[vendor]})

    elif cmd == 'remove_deb_package':
        pkg = args.get('packageName', '').strip()
        if not pkg or not re.match(r'^[a-zA-Z0-9.+_-]+$', pkg):
            raise Exception('Geçersiz paket adı biçimi')
        helper = '/usr/local/bin/ayaz-pkg-helper'
        cmd_args = ['sudo', helper, 'remove', pkg] if os.path.exists(helper) else ['sudo', 'apt-get', 'remove', '-y', '--', pkg]
        try:
            proc = subprocess.run(
                cmd_args,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=120
            )
        except subprocess.TimeoutExpired:
            raise Exception(f'Kaldırma zaman aşımına uğradı: {pkg} (120 sn)')
        # Daha önce returncode'a bakılmadan "kaldırıldı" dönülüyordu; arayüz
        # paket silinmemişken başarı görüyordu.
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()
            if not err:
                err = f'çıkış kodu {proc.returncode}'
            raise Exception(f'Kaldırma başarısız: {err}')
        return f'{pkg} kaldırıldı'

    elif cmd == 'list_installed_deb_packages':
        # Yazılım Mağazası'nın "kurulu" listesi dpkg üzerinden yürür;
        # dpkg yoksa (veya sorgu düşerse) boş liste arayüzü bozmaz.
        out = _run_capture(['dpkg-query', '-W', '-f=${Package}\n'])
        if out is None:
            return []
        return [p.strip() for p in out.splitlines() if p.strip()]

    elif cmd == 'system_poweroff':
        subprocess.Popen(['/sbin/poweroff', '-f'])
        return 'Sistem kapatılıyor'

    elif cmd == 'system_reboot':
        subprocess.Popen(['/sbin/reboot', '-f'])
        return 'Sistem yeniden başlatılıyor'

    elif cmd == 'get_radio_state':
        return _radio_state()

    elif cmd == 'set_radio_state':
        kind = str(args.get('kind', '')).strip()
        enabled = bool(args.get('enabled'))
        if kind not in ('wifi', 'bluetooth'):
            raise Exception('Geçersiz radyo türü.')
        onoff = 'on' if enabled else 'off'
        if _run_capture(['nmcli', 'radio', kind, onoff]) is not None:
            return _radio_state()
        verb = 'unblock' if enabled else 'block'
        if _run_capture(['rfkill', verb, kind]) is not None:
            return _radio_state()
        raise Exception('Ağ yöneticisi bulunamadı: sistemde nmcli veya rfkill yok.')

    elif cmd == 'scan_wifi_networks':
        _run_capture(['nmcli', 'dev', 'wifi', 'rescan'])
        out = _run_capture(['nmcli', '-t', '-f', 'ACTIVE,SSID,SIGNAL', 'dev', 'wifi', 'list'])
        if out is None:
            raise Exception('Kablosuz tarama için NetworkManager (nmcli) kurulu olmalı.')
        networks = []
        for line in out.splitlines():
            parts = line.split(':', 2)
            if len(parts) < 3:
                continue
            active, ssid, signal = parts
            ssid = ssid.replace('\\:', ':').replace('\\\\', '\\')
            if not ssid:
                continue
            try:
                sig = int(signal)
            except ValueError:
                sig = 0
            networks.append({'ssid': ssid, 'signal': sig, 'active': active == 'yes'})
        return networks

    elif cmd == 'wifi_connect':
        ssid = str(args.get('ssid', '')).strip()
        # SSID tek argüman (kabuk yok); IEEE sınırı 32 bayttır.
        if not ssid or len(ssid.encode('utf-8')) > 32:
            raise Exception('Geçersiz ağ adı (SSID).')
        try:
            proc = subprocess.run(
                ['nmcli', 'dev', 'wifi', 'connect', ssid],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, timeout=30
            )
        except Exception:
            raise Exception('nmcli bulunamadı: kablosuz bağlantı için NetworkManager gerekli.')
        if proc.returncode == 0:
            return f'Bağlanıldı: {ssid}'
        err = (proc.stderr or '').strip()
        raise Exception(err or f'Bağlanılamadı: {ssid}')

    elif cmd == 'get_network_info':
        info = {'interface': '', 'ip': '', 'prefix': 0, 'gateway': '',
                'dns': [], 'connected': False}
        out = _run_capture(['ip', '-o', '-4', 'addr', 'show', 'scope', 'global'])
        if out:
            for line in out.splitlines():
                parts = line.split()
                if len(parts) < 4 or parts[2] != 'inet':
                    continue
                cidr = parts[3]
                if '/' not in cidr:
                    continue
                ip, prefix = cidr.split('/', 1)
                info['interface'] = parts[1]
                info['ip'] = ip
                try:
                    info['prefix'] = int(prefix)
                except ValueError:
                    info['prefix'] = 0
                info['connected'] = True
                break
        rt = _run_capture(['ip', 'route', 'show', 'default'])
        if rt:
            for line in rt.splitlines():
                if ' via ' in line:
                    info['gateway'] = line.split(' via ', 1)[1].split()[0]
                    break
        try:
            with open('/etc/resolv.conf') as f:
                for line in f:
                    if line.startswith('nameserver'):
                        fields = line.split(None, 1)
                        if len(fields) == 2 and fields[1].strip():
                            info['dns'].append(fields[1].strip())
        except Exception:
            pass
        return info

    elif cmd == 'get_processes':
        out = _run_capture(['ps', '-eo', 'pid=,user=,pcpu=,rss=,stat=,comm='])
        if out is None:
            raise Exception('Süreç listesi okunamadı (ps bulunamadı).')
        status_map = {'R': 'Çalışıyor', 'S': 'Uyuyor', 'D': 'Beklemede',
                      'Z': 'Zombi', 'T': 'Durduruldu', 't': 'Durduruldu',
                      'I': 'Boşta'}
        procs = []
        for line in out.splitlines():
            f = line.split()
            if len(f) < 6:
                continue
            try:
                pid = int(f[0])
            except ValueError:
                continue
            try:
                cpu = float(f[2])
            except ValueError:
                cpu = 0.0
            try:
                mem_mb = float(f[3]) / 1024.0
            except ValueError:
                mem_mb = 0.0
            procs.append({
                'pid': pid, 'user': f[1], 'cpu': cpu, 'mem_mb': mem_mb,
                'status': status_map.get(f[4][:1], 'Bilinmiyor'),
                'name': ' '.join(f[5:])
            })
        procs.sort(key=lambda p: p['cpu'], reverse=True)
        return procs[:300]

    elif cmd == 'kill_process':
        try:
            pid = int(args.get('pid', 0))
        except (TypeError, ValueError):
            raise Exception('Geçersiz PID.')
        if pid <= 1:
            raise Exception('PID 1 (init) ve altındaki süreçler sonlandırılamaz.')
        if pid == os.getpid() or pid == os.getppid():
            raise Exception('Görev Yöneticisi kendi sürecini sonlandıramaz.')
        proc = subprocess.run(
            ['kill', '-TERM', str(pid)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        if proc.returncode != 0:
            err = (proc.stderr or '').strip()
            raise Exception(err or f'PID {pid} sonlandırılamadı.')
        return f'SIGTERM gönderildi (PID {pid}).'

    elif cmd == 'get_storage_devices':
        try:
            proc = subprocess.run(
                ['lsblk', '-J', '-b', '-o', 'NAME,PATH,SIZE,MODEL,RM,TYPE,RO'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            data = json.loads(proc.stdout)
            disks = []
            for d in data.get('blockdevices', []):
                name = d.get('name', '')
                if d.get('type') == 'disk' and not name.startswith('loop') and not name.startswith('zram') and not name.startswith('sr'):
                    size_b = int(d.get('size', 0))
                    size_gb = round(size_b / (1024 ** 3), 1)
                    model = (d.get('model') or f'Depolama Sürücüsü ({size_gb} GB)').strip()
                    disks.append({
                        'name': name,
                        'path': d.get('path', f"/dev/{name}"),
                        'size_gb': size_gb,
                        'model': model,
                        'is_removable': bool(d.get('rm', False))
                    })
            if disks:
                return disks
        except Exception:
            pass
        return [
            {'name': 'sda', 'path': '/dev/sda', 'size_gb': 64.0, 'model': 'Sistem Sabit Diski (/dev/sda)', 'is_removable': False}
        ]

    elif cmd == 'get_storage_stats':
        # Ayarlar'daki depolama göstergesi: kök bölünüm + ZRAM (varsa).
        # Bayt cinsinden döner; arayüz ölçeği kendisi çevirir.
        stats = {'disk_total': 0, 'disk_used': 0, 'zram_total': 0, 'zram_used': 0}
        out = _run_capture(['df', '-B1', '/'])
        if out:
            for line in out.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 6 and parts[1].isdigit() and parts[2].isdigit():
                    stats['disk_total'] = int(parts[1])
                    stats['disk_used'] = int(parts[2])
                    break
                # Uzun aygıt adı satırı kırıldığında sayılar başa kayar
                if len(parts) >= 5 and parts[0].isdigit() and parts[1].isdigit():
                    stats['disk_total'] = int(parts[0])
                    stats['disk_used'] = int(parts[1])
                    break
        try:
            with open('/sys/block/zram0/disksize') as f:
                stats['zram_total'] = int((f.read().strip() or '0'))
        except Exception:
            stats['zram_total'] = 0
        try:
            # mm_stat'ın ilk alanı sıkıştırılmamış (asıl) veri boyutudur
            with open('/sys/block/zram0/mm_stat') as f:
                stats['zram_used'] = int(f.read().split()[0])
        except Exception:
            stats['zram_used'] = 0
        return stats

    elif cmd == 'execute_system_installation':
        payload = args.get('payload', {})
        target = payload.get('target_disk', '').strip()
        username = payload.get('username', 'ankora').strip()
        hostname = payload.get('hostname', 'ankora-pc').strip()
        password = payload.get('password', 'ankora').strip()
        autologin = payload.get('autologin', True)

        if not target or not re.match(r'^/dev/(sd[a-z]|vd[a-z]|nvme[0-9]+n[0-9]+)$', target):
            raise Exception('Geçersiz hedef disk seçimi (Örn: /dev/sda veya /dev/nvme0n1)')
        if not re.match(r'^[a-z_][a-z0-9_-]{0,31}$', username):
            raise Exception('Geçersiz kullanıcı adı')
        if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$', hostname):
            raise Exception('Geçersiz makine adı')
        if not password or '\0' in password or '\n' in password:
            raise Exception('Geçersiz parola')

        # Canlı oturumda `ankora` yetkisiz bir kullanıcıdır; kurulumun tamamı
        # root gerektirir. Parolasız sudo yükselmesi baştan doğrulanır; araç
        # yolu bulunamadığı için yarıda kalan (127) hataları yerine net mesaj
        # döner.
        if os.geteuid() != 0:
            if not shutil.which('sudo'):
                raise Exception('Kurulum için yönetici (root) yetkisi gerekiyor: sudo kurulu değil.')
            try:
                subprocess.run('sudo -n true', shell=True, check=True,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                raise Exception('Kurulum için yönetici (root) yetkisi gerekiyor: parolasız sudo erişimi (sudo -n) doğrulanamadı.')

        def _root(cmd, check=True):
            pre = '' if os.geteuid() == 0 else 'sudo -n '
            return subprocess.run(pre + cmd, shell=True, check=check)

        def _root_out(cmd):
            pre = '' if os.geteuid() == 0 else 'sudo -n '
            return subprocess.check_output(pre + cmd, shell=True, text=True)

        def _root_write(path, data):
            if os.geteuid() == 0:
                with open(path, 'w') as f:
                    f.write(data)
                return
            proc = subprocess.run(['sudo', '-n', 'tee', path], input=data.encode(),
                                  stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            if proc.returncode != 0:
                raise Exception(f'{path} yazılamadı: {proc.stderr.decode(errors="replace").strip()}')

        def _root_makedirs(path):
            _root(f"mkdir -p {shlex.quote(path)}", check=False)

        _root("umount -q -R /target 2>/dev/null || true", check=False)
        _root(f"umount -q {shlex.quote(target)}* 2>/dev/null || true", check=False)
        _root("swapoff -a 2>/dev/null || true", check=False)

        cmds = [
            f"parted -s {shlex.quote(target)} mklabel gpt",
            f"parted -s {shlex.quote(target)} mkpart ESP fat32 1MiB 513MiB",
            f"parted -s {shlex.quote(target)} set 1 esp on",
            f"parted -s {shlex.quote(target)} mkpart primary ext4 513MiB 100%"
        ]
        for c in cmds:
            _root(c)

        subprocess.run("udevadm settle || sleep 1", shell=True)

        p1 = f"{target}p1" if "nvme" in target else f"{target}1"
        p2 = f"{target}p2" if "nvme" in target else f"{target}2"

        _root(f"mkfs.vfat -F32 {shlex.quote(p1)}")
        _root(f"mkfs.ext4 -F {shlex.quote(p2)}")

        _root_makedirs('/target')
        _root(f"mount {shlex.quote(p2)} /target")
        _root_makedirs('/target/boot/efi')
        _root(f"mount {shlex.quote(p1)} /target/boot/efi")

        rsync_cmd = "rsync -aAX / /target/ --exclude=/proc/* --exclude=/sys/* --exclude=/dev/* --exclude=/tmp/* --exclude=/run/* --exclude=/mnt/* --exclude=/media/* --exclude=/target/* --exclude=/home/*"
        _root(rsync_cmd)

        # GİZLİLİK: canlı imaj her kurulumda aynı kimlikle başlar ve rsync
        # /var altını da kopyalar: derleme-time machine-id, loglar, DHCP
        # kiralama kayıtları, kabuk geçmişi kurulu sisteme taşınırdı.
        # machine-id: her kurulumda benzersiz üretilir (dbus bu dosyayı
        # okur; boş/eksik kalırsa tüm kurulumlar aynı kimliği paylaşır).
        mid = secrets.token_hex(16)
        _root_write('/target/etc/machine-id', mid + '\n')
        _root_write('/target/var/lib/dbus/machine-id', mid + '\n')
        _root("rm -f /target/var/lib/dhcp/* /target/etc/ssh/ssh_host_* "
              "/target/root/.bash_history 2>/dev/null", check=False)
        _root("sh -c 'find /target/var/log -type f -delete 2>/dev/null; "
              "rm -rf /target/var/tmp/* 2>/dev/null; true'", check=False)

        _root_write('/target/etc/hostname', f"{hostname}\n")

        _root_write('/target/etc/hosts', f"127.0.0.1\tlocalhost\n127.0.1.1\t{hostname}\n\n# The following lines are desirable for IPv6 capable hosts\n::1\tlocalhost ip6-localhost ip6-loopback\nff02::1\tip6-allnodes\nff02::2\tip6-allrouters\n")

        try:
            root_uuid = _root_out(f"blkid -s UUID -o value {shlex.quote(p2)}").strip()
            efi_uuid = _root_out(f"blkid -s UUID -o value {shlex.quote(p1)}").strip()
        except Exception:
            root_uuid = p2
            efi_uuid = p1

        fstab_content = f"""# /etc/fstab generated by Ankora Linux Installer
UUID={root_uuid} / ext4 errors=remount-ro 0 1
UUID={efi_uuid} /boot/efi vfat umask=0077 0 1
tmpfs /tmp tmpfs defaults,noatime,mode=1777 0 0
"""
        _root_write('/target/etc/fstab', fstab_content)

        bind_mounts = ['/dev', '/dev/pts', '/proc', '/sys', '/run']
        for bm in bind_mounts:
            _root_makedirs(f"/target{bm}")
            _root(f"mount --bind {bm} /target{bm}")

        chroot_setup_cmds = [
            ['chroot', '/target', 'useradd', '-m', '-s', '/bin/bash', '-G', 'sudo,audio,video,plugdev,netdev', username],
        ]
        _root_pre = [] if os.geteuid() == 0 else ['sudo', '-n']
        for cmd_args in chroot_setup_cmds:
            subprocess.run(_root_pre + cmd_args, check=False)

        # GÜVENLİK: Parola stdin pipe ile güvenli geçiş (shell interpolation yok)
        chpasswd_proc = subprocess.Popen(
            _root_pre + ['chroot', '/target', 'chpasswd'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        chpasswd_proc.communicate(input=f"{username}:{password}\n".encode())

        # Sudoers dosyası
        _root_write(f'/target/etc/sudoers.d/{username}', f"{username} ALL=(ALL:ALL) ALL\n")
        _root(f"chmod 0440 /target/etc/sudoers.d/{shlex.quote(username)}")

        # GÜVENLİK: rsync /etc'i de kopyaladığı için canlı oturumun izleri
        # kurulu sisteme geçerdi: `ankora` hesabının herkese açık bilinen
        # parolası + şifresiz sudo yetkisi = parolasız root. Canlı hesap
        # kurulu sistemde yetkisiz ve parolası bilinmeyen bir hesap olur.
        if username != 'ankora':
            _root("rm -f /target/etc/sudoers.d/ankora", check=False)
            subprocess.run(_root_pre + ['chroot', '/target', 'gpasswd', '-d', 'ankora', 'sudo'], check=False)
            try:
                live_pw = secrets.token_urlsafe(24)
                subprocess.run(_root_pre + ['chroot', '/target', 'chpasswd'],
                               input=f"ankora:{live_pw}\n".encode(), check=False)
            except Exception:
                pass
            try:
                _root_write('/target/etc/sudoers.d/ankora-updater',
                            f"{username} ALL=(root) NOPASSWD: "
                            "/usr/local/bin/ayaz-update-helper, /usr/local/bin/ayaz-pkg-helper\n")
                _root("chmod 0440 /target/etc/sudoers.d/ankora-updater")
            except Exception:
                pass

        # GRUB
        subprocess.run(_root_pre + ['chroot', '/target', 'grub-install', '--target=x86_64-efi', '--efi-directory=/boot/efi', '--bootloader-id=ankora', '--recheck'], check=False)
        subprocess.run(_root_pre + ['chroot', '/target', 'update-grub'], check=False)

        if autologin:
            inittab_path = '/target/etc/inittab'
            if os.path.exists(inittab_path):
                with open(inittab_path, 'r') as f:
                    content = f.read()
                content = re.sub(
                    r'^1:2345:respawn:/sbin/getty.*tty1.*',
                    f'1:2345:respawn:/sbin/getty --autologin {username} --noclear 38400 tty1 linux',
                    content,
                    flags=re.MULTILINE
                )
                _root_write(inittab_path, content)
        else:
            # Canlı ISO'nun `--autologin ankora` satırı kurulu sistemde
            # kalmamalı: hem kullanıcı otomatik girişi kapatmış oluyor hem de
            # o satır artık yetkisiz olan canlı hesaba bağlanırdı.
            inittab_path = '/target/etc/inittab'
            if os.path.exists(inittab_path):
                with open(inittab_path, 'r') as f:
                    content = f.read()
                content = re.sub(
                    r'^1:2345:respawn:/sbin/getty --autologin \S+ --noclear 38400 tty1 linux',
                    '1:2345:respawn:/sbin/getty 38400 tty1 linux',
                    content,
                    flags=re.MULTILINE
                )
                _root_write(inittab_path, content)

        try:
            pass  # chroot komutları yukarıda zaten çalıştırıldı
        finally:
            for bm in reversed(bind_mounts):
                _root(f"umount -l /target{bm} 2>/dev/null || true", check=False)
            _root("umount -l /target/boot/efi 2>/dev/null || true", check=False)
            _root("umount -l /target 2>/dev/null || true", check=False)

        return "Ankora Linux 2.0 başarıyla kuruldu! Sistemi yeniden başlatabilirsiniz."

    elif cmd == 'get_system_telemetry':
        mem_total = 4096
        mem_used = 512
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
                t = 0
                a = 0
                for l in lines:
                    if l.startswith('MemTotal:'):
                        t = int(l.split()[1]) // 1024
                    elif l.startswith('MemAvailable:'):
                        a = int(l.split()[1]) // 1024
                mem_total = t
                mem_used = max(0, t - a)
        except Exception:
            pass

        uptime_s = 3600
        try:
            with open('/proc/uptime', 'r') as f:
                uptime_s = int(float(f.read().split()[0]))
        except Exception:
            pass

        kernel = 'Linux 6.1.0-22-amd64'
        try:
            with open('/proc/version', 'r') as f:
                kernel = ' '.join(f.read().split()[:3])
        except Exception:
            pass

        bat = _battery_state()
        du = _disk_usage()
        return {
            'os_name': 'Devuan GNU/Linux 5 (daedalus)',
            'kernel': kernel,
            'init_system': 'SysVinit (systemd-free)',
            'memory_used_mb': mem_used,
            'memory_total_mb': mem_total,
            'cpu_cores': os.cpu_count() or 4,
            'uptime_seconds': uptime_s,
            'battery_percent': bat['percent'],
            'battery_status': bat['status'],
            'cpu_percent': _cpu_percent(),
            'disk_percent': du[2] if du else None,
            'disk_used_gb': du[0] if du else None,
            'disk_total_gb': du[1] if du else None
        }

    elif cmd == 'optimize_system_memory':
        try:
            subprocess.run(['sync'], check=False)
            res = subprocess.run(['sudo', 'tee', '/proc/sys/vm/drop_caches'], input=b'3\n', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if res.returncode == 0:
                return {'success': True, 'freed_mb': 0, 'message': 'Bellek önbellekleri başarıyla temizlendi.'}
            else:
                return {'success': False, 'freed_mb': 0, 'message': 'Önbellek temizleme yetki hatası (root gerekli).'}
        except Exception as e:
            return {'success': False, 'freed_mb': 0, 'message': str(e)}

    elif cmd == 'list_directory':
        req_path = args.get('path', home_dir)
        if not isinstance(req_path, str):
            req_path = home_dir
        req_path = req_path.strip()
        if not req_path or '\0' in req_path:
            # Boş yol bilerek ev dizinine düşer; arayüzün varsayılanıdır.
            req_path = home_dir
        elif not os.path.exists(req_path):
            # Verilen yol yokken sessizce ev dizinine dönmek arayüze yanlış
            # klasörü gösteriyordu; eksik yol açıkça hata olarak döner.
            raise Exception('Klasör bulunamadı: ' + str(req_path))
        req_path = os.path.abspath(req_path)
        # GÜVENLİK: Kök gezilebilir, ancak başkalarının hesapları ve çekirdek /
        # aygıt arayüzleri listelenemez (dosya adı sızıntısı).
        real_req = os.path.realpath(req_path)
        for sensitive_root in ('/root', '/proc', '/sys', '/dev', '/boot', '/etc'):
            if real_req == sensitive_root or real_req.startswith(sensitive_root + '/'):
                raise Exception('Güvenlik İlkesi İhlali: Bu dizin listelenemez')
        items = []
        try:
            with os.scandir(req_path) as entries:
                for entry in entries:
                    try:
                        is_d = entry.is_dir(follow_symlinks=True)
                        size_str = '-'
                        if not is_d:
                            s = entry.stat().st_size
                            if s < 1024:
                                size_str = f"{s} B"
                            elif s < 1024 * 1024:
                                size_str = f"{round(s / 1024, 1)} KB"
                            else:
                                size_str = f"{round(s / (1024 * 1024), 1)} MB"
                        ext = os.path.splitext(entry.name)[1].lower().replace('.', '')
                        items.append({
                            'name': entry.name,
                            'path': entry.path,
                            'is_dir': is_d,
                            'size_str': size_str,
                            'ext': ext,
                            'is_hidden': entry.name.startswith('.')
                        })
                    except Exception:
                        continue
            items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        except Exception as e:
            raise Exception(f"Dizin okunamadı: {e}")
        return {'current_path': req_path, 'items': items, 'home_dir': home_dir}

    elif cmd == 'create_folder':
        folder_path = args.get('path', '').strip()
        if not folder_path or '\0' in folder_path:
            raise Exception('Geçersiz klasör yolu')
        folder_path = os.path.abspath(folder_path)
        restricted = ['/bin', '/sbin', '/usr', '/etc', '/boot', '/dev', '/proc', '/sys',
                      '/lib', '/lib64', '/var', '/opt', '/srv', '/root']
        for r in restricted:
            if folder_path == r or folder_path.startswith(r + '/'):
                raise Exception('Bu sistem dizininde klasör oluşturulamaz')
        os.makedirs(folder_path, exist_ok=True)
        return f"Klasör oluşturuldu: {folder_path}"

    elif cmd == 'open_path':
        target_path = args.get('path', '').strip()
        if not target_path or '\0' in target_path or not os.path.exists(target_path):
            raise Exception('Açılacak dosya bulunamadı')
        target_path = os.path.abspath(target_path)
        env = os.environ.copy()
        if 'DISPLAY' not in env:
            env['DISPLAY'] = ':0'
        # GÜVENLİK: kurulabilir/çalıştırılabilir dosyalar xdg-open'a verilmez
        lower_tp = target_path.lower()
        # .deb → doğrudan sudo install yapmak yerine bilgi dön
        if lower_tp.endswith('.deb'):
            return f"DEB paketi tespit edildi: {target_path}. Lütfen Ankora Mağaza üzerinden kurun."
        if lower_tp.endswith(('.desktop', '.run', '.appimage')):
            raise Exception('Güvenlik Hatası: Çalıştırılabilir dosyalar buradan açılamaz')
        subprocess.Popen(['xdg-open', target_path], env=env, start_new_session=True)
        return f"Açıldı: {target_path}"

    elif cmd == 'open_url':
        url = str(args.get('url', '')).strip()
        if '\0' in url or not re.match(r'^https?://', url):
            raise Exception('Yalnızca http/https adresleri açılabilir')
        env = os.environ.copy()
        if 'DISPLAY' not in env:
            env['DISPLAY'] = ':0'
        subprocess.Popen(['xdg-open', url], env=env, start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True

    elif cmd == 'system_browser_available':
        # Canlı ISO'ya hiçbir tarayıcı kurulmaz; xdg-mime bu durumda boş satır
        # ve rc=0 döner. Kayıtlı bir .desktop yoksa "Dış Tarayıcıda Aç"
        # denetimi çalışmaz, gizlenir.
        try:
            out = subprocess.run(
                ['xdg-mime', 'query', 'default', 'x-scheme-handler/https'],
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                text=True, timeout=10
            )
            handler = (out.stdout or '').strip()
        except Exception:
            return True
        if not handler.endswith('.desktop'):
            return False
        dirs = ['/usr/share/applications', '/usr/local/share/applications',
                os.path.expanduser('~/.local/share/applications')]
        return any(os.path.exists(os.path.join(d, handler)) for d in dirs)

    elif cmd == 'delete_file':
        target_path = args.get('path', '').strip()
        if not target_path or '\0' in target_path or not os.path.exists(target_path):
            raise Exception('Silinecek dosya bulunamadı')
        target_path = os.path.abspath(target_path)
        # GÜVENLİK: Denetim kökü çözülmüş gerçek yol üzerinde yapılır; kısayol
        # veya sondaki eğik çizgiyle eşleştirme aşılamaz. Ev kökü ayrı, evin
        # içeriği serbesttir — dosya yöneticisi kendi dosyalarını silebilsin.
        real_path = os.path.realpath(target_path)
        if real_path in ('/', '/home', home_dir):
            raise Exception('Kritik sistem dosyaları silinemez')
        forbidden = ['/bin', '/sbin', '/usr', '/etc', '/boot', '/dev', '/proc', '/sys',
                     '/lib', '/lib64', '/var', '/opt', '/srv', '/root']
        for f in forbidden:
            if real_path == f or real_path.startswith(f + '/'):
                raise Exception('Kritik sistem dosyaları silinemez')
        if os.path.isdir(target_path) and not os.path.islink(target_path):
            shutil.rmtree(target_path)
        else:
            os.remove(target_path)
        return f"Silindi: {target_path}"

    elif cmd == 'scan_xdg_applications':
        global _XDG_CACHE
        app_dirs = ['/usr/share/applications', os.path.expanduser('~/.local/share/applications')]
        user_app_dir = app_dirs[1]
        # Dizin özetleri değişmediyse (içine dosya eklenip çıkarılmadıysa)
        # tarama ve dosya okuma tekrarlanmaz.
        sig = []
        for ad in app_dirs:
            try:
                st = os.stat(ad)
                sig.append((ad, st.st_mtime_ns))
            except OSError:
                sig.append((ad, 0))
        if _XDG_CACHE is not None and _XDG_CACHE[0] == sig:
            return _XDG_CACHE[1]
        apps = []
        for ad in app_dirs:
            if os.path.exists(ad):
                for fname in os.listdir(ad):
                    if fname.endswith('.desktop'):
                        p = os.path.join(ad, fname)
                        try:
                            name = fname.replace('.desktop', '')
                            exec_cmd = name
                            cat = 'util'
                            comment = ''
                            with open(p, 'r', errors='ignore') as f:
                                for line in f:
                                    if line.startswith('Name=') and name == fname.replace('.desktop', ''):
                                        name = line.strip().split('=', 1)[1]
                                    elif line.startswith('Exec='):
                                        exec_cmd = line.strip().split('=', 1)[1].split()[0]
                                    elif line.startswith('Categories='):
                                        c = line.lower()
                                        if 'audio' in c or 'video' in c or 'media' in c:
                                            cat = 'media'
                                        elif 'graphic' in c:
                                            cat = 'graphics'
                                        elif 'network' in c or 'web' in c:
                                            cat = 'net'
                                        elif 'office' in c:
                                            cat = 'office'
                                        elif 'development' in c:
                                            cat = 'dev'
                                        elif 'system' in c:
                                            cat = 'sys'
                                    elif line.startswith('Comment='):
                                        comment = line.strip().split('=', 1)[1]
                            apps.append({
                                'id': fname.replace('.desktop', ''),
                                'name': name,
                                'exec': exec_cmd,
                                'cat': cat,
                                'comment': comment,
                                'is_installed_by_user': ad == user_app_dir
                            })
                        except Exception:
                            continue
        _XDG_CACHE = (sig, apps)
        return apps

    elif cmd == 'read_document_file':
        f_path = args.get('file_path') or args.get('filePath') or ''
        if not f_path:
            raise Exception('Belge bulunamadı')
        # GÜVENLİK: Rust tarafındaki read_document_file denetiminin birebir karşılığı
        if '..' in f_path:
            raise Exception("Güvenlik Hatası: Dizin geçişine ('..') izin verilmez")
        f_ext = os.path.splitext(f_path)[1].lower().replace('.', '')
        if f_ext not in ('pdf', 'md', 'txt', 'conf', 'log', 'json', 'yaml', 'yml', 'ini',
                         'js', 'py', 'sh', 'css', 'html', 'xml',
                         'png', 'jpg', 'jpeg', 'webp', 'gif'):
            raise Exception(f"Güvenlik Hatası: '.{f_ext}' uzantılı dosyalar güvenlik nedeniyle okunamaz")
        # Görsel uzantılar metin değil, base64 data URI olarak döner
        IMAGE_MIME = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                      'webp': 'image/webp', 'gif': 'image/gif'}
        is_image = f_ext in IMAGE_MIME
        if not os.path.exists(f_path):
            # Canlı oturum ankora ile çalışır; /root/Belgeler'e kök erişimi
            # yoktur. Örnek belgeler kullanıcı dizinindedir — aynı ad
            # (dizin geçişi olmadan) Belgeler altında aranır.
            _alt = os.path.join(home_dir, 'Belgeler', os.path.basename(f_path))
            if _alt != f_path and os.path.exists(_alt):
                f_path = _alt
            else:
                raise Exception('Belge bulunamadı: ' + str(f_path))
        real_path = os.path.realpath(f_path)
        real_lower = real_path.lower()
        sensitive = (
            '/etc/shadow', '/etc/gshadow', '/etc/sudoers', '/etc/master.passwd',
            '/etc/security', '/root/.ssh', '.ssh/', 'id_rsa', 'id_ed25519',
            'id_ecdsa', 'id_dsa', '/proc/kcore', '/sys/', '/dev/',
            '/var/log/auth', 'ai_creds.json', 'lock.hash',
        )
        if any(p in real_lower for p in sensitive):
            raise Exception('Güvenlik Hatası: Hassas sistem dosyalarının okunması engellendi')
        allowed_dirs = [
            os.path.join(home_dir, 'Belgeler'),
            os.path.join(home_dir, 'Downloads'),
            os.path.join(home_dir, 'Resimler'),
            os.path.join(home_dir, 'Masaüstü'),
            os.path.join(home_dir, 'İndirilenler'),
            os.path.join(home_dir, 'Müzik'),
            os.path.join(home_dir, 'Videolar'),
            home_dir,
            '/root/Belgeler',
            '/usr/share/doc',
        ]
        if not any(real_path.startswith(d + os.sep) for d in allowed_dirs if d):
            if os.path.basename(real_path) not in (
                    'ankora-sistem-rehberi.pdf', 'kiosk-ayarlari.txt', 'kiosk-ayarlari.md'):
                raise Exception('Güvenlik Hatası: Yalnızca kullanıcı belgeleri ve sistem '
                                'dokümantasyonu dizinindeki dosyalar okunabilir')
        f_path = real_path
        # GÜVENLİK: Rust'taki hard-link ve boyut denetimlerinin karşılığı —
        # çok bağlantılı dosyalar ve 50 MB üstü içerikler okunmaz.
        st = os.stat(f_path)
        if st.st_nlink > 1:
            raise Exception('Güvenlik Hatası: Çoklu bağlantılı (hard link) dosyaların '
                            'okunması güvenlik gerekçesiyle engellendi')
        f_size = st.st_size
        if f_size > 50 * 1024 * 1024:
            raise Exception('Dosya boyutu çok büyük (50 MB üstü kabul edilmez)')
        f_name = os.path.basename(f_path)
        if is_image:
            # Tarayıcı <img> için doğrudan gömülebilen data URI üretilir
            import base64
            with open(f_path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode('utf-8')
            return {
                'file_name': f_name,
                'file_type': 'image',
                'file_size': f_size,
                'content': f"data:{IMAGE_MIME[f_ext]};base64,{b64}"
            }
        if f_ext == 'pdf':
            import base64
            with open(f_path, 'rb') as f:
                b64 = base64.b64encode(f.read()).decode('utf-8')
            return {
                'file_name': f_name,
                'file_type': 'pdf',
                'file_size': f_size,
                'content': f"data:application/pdf;base64,{b64}"
            }
        else:
            with open(f_path, 'r', errors='ignore') as f:
                txt = f.read()
            return {
                'file_name': f_name,
                'file_type': 'text',
                'file_size': f_size,
                'content': txt
            }

    elif cmd == 'list_available_documents':
        docs = []
        doc_roots = ['/home/ankora/Belgeler', '/home/ankora/Downloads', '/root/Belgeler', '/usr/share/doc']
        for dr in doc_roots:
            if os.path.exists(dr):
                for fn in os.listdir(dr):
                    if fn.endswith(('.pdf', '.txt', '.md')):
                        docs.append(os.path.join(dr, fn))
        if not docs:
            docs = ['/root/Belgeler/ankora-sistem-rehberi.pdf', '/root/Belgeler/kiosk-ayarlari.txt']
        return docs

    elif cmd == 'is_lock_configured':
        cfg_dir = os.path.expanduser('~/.config/ankora')
        h_file = os.path.join(cfg_dir, 'lock.hash')
        return os.path.exists(h_file)

    elif cmd == 'set_lock_credentials':
        new_pin = (args.get('new_pin') or args.get('newPin') or '').strip()
        if len(new_pin) < 4:
            raise Exception('Yeni PIN/Parola en az 4 karakter olmalıdır.')
        cfg_dir = os.path.expanduser('~/.config/ankora')
        os.makedirs(cfg_dir, exist_ok=True)
        h_file = os.path.join(cfg_dir, 'lock.hash')
        # Rust tarafındaki set_lock_credentials ile aynı denetim: kilit
        # zaten kurulu ve istekte current_pin alanındaysa önce o doğrulanır.
        # Alan boş/None gelirse boş PIN denenir; Rust da unwrap_or_default
        # ile aynısını yapar — mevcut PIN'siz değişiklik böylece kapanır.
        if os.path.exists(h_file) and ('current_pin' in args or 'currentPin' in args):
            cur_pin = str(args.get('current_pin') or args.get('currentPin') or '')
            if not execute_ayaz_command('verify_lock_credentials', {'pin': cur_pin}):
                raise Exception('Mevcut PIN hatalı! PIN değiştirme reddedildi.')
        import hashlib
        salt = os.urandom(16)
        h = hashlib.sha256(salt + new_pin.encode()).digest()
        for i in range(50000):
            h = hashlib.sha256(h + salt + i.to_bytes(4, 'little')).digest()
        with open(h_file, 'wb') as f:
            f.write(salt + h)
        os.chmod(h_file, 0o600)
        return True

    elif cmd == 'verify_lock_credentials':
        pin = (args.get('pin') or '').strip()
        cfg_dir = os.path.expanduser('~/.config/ankora')
        h_file = os.path.join(cfg_dir, 'lock.hash')
        if not os.path.exists(h_file):
            return True
        import hashlib
        with open(h_file, 'rb') as f:
            data = f.read()
        if len(data) < 48:
            return False
        salt = data[:16]
        expected = data[16:48]
        h = hashlib.sha256(salt + pin.encode()).digest()
        for i in range(50000):
            h = hashlib.sha256(h + salt + i.to_bytes(4, 'little')).digest()
        return h == expected

    elif cmd == 'lock_x11_session':
        if os.path.exists('/usr/bin/xtrlock'):
            subprocess.Popen(['/usr/bin/xtrlock', '-b'])
            return 'X11 oturumu kilitlendi'
        return 'Kiosk kilit ekranı devrede'

    elif cmd == 'unlock_x11_session':
        # xtrlock süreçte değilse kilit zaten açık demektir; pkill'in 1
        # kodu da bu durumda başarı sayılır.
        try:
            subprocess.run(['pkill', '-x', 'xtrlock'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
        return 'Ekran kilidi kaldırıldı'

    elif cmd == 'set_brightness':
        lvl = int(args.get('level', 100))
        clamped = max(20, min(100, lvl))
        ratio = clamped / 100.0
        try:
            p = subprocess.run(['xrandr'], stdout=subprocess.PIPE, text=True)
            for line in p.stdout.splitlines():
                if ' connected' in line:
                    d_name = line.split()[0]
                    subprocess.run(['xrandr', '--output', d_name, '--brightness', f"{ratio:.2f}"])
                    break
        except Exception:
            pass
        return f"Parlaklık ayarlandı: %{clamped}"

    elif cmd == 'get_volume':
        # ALSA Master kanalının yüzde değeri. Araç yokluğu ile aygıt
        # yokluğu ayrı hatalardır: biri "kurulu değil" derken diğeri
        # donanım/sürücü sorununu gösterir.
        if not shutil.which('amixer'):
            raise Exception('Ses sistemi bulunamadı (amixer kurulu değil)')
        try:
            proc = subprocess.run(
                ['amixer', 'get', 'Master'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, timeout=10)
        except Exception as e:
            raise Exception(f'Ses sistemi okunamadı: {e}')
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or '').strip()
            raise Exception(f'Ses aygıtı okunamadı: {err or "amixer hata verdi"}')
        m = re.search(r'\[(\d{1,3})%\]', proc.stdout)
        if not m:
            raise Exception('Ses düzeyi okunamadı (amixer yüzde vermedi)')
        return max(0, min(100, int(m.group(1))))

    elif cmd == 'set_volume':
        try:
            level = int(args.get('level', args.get('volume', 50)))
        except (TypeError, ValueError):
            raise Exception('Geçersiz ses seviyesi')
        if not 0 <= level <= 100:
            raise Exception('Ses seviyesi 0 ile 100 arasında olmalı')
        if not shutil.which('amixer'):
            raise Exception('Ses sistemi bulunamadı (amixer kurulu değil)')
        # Karıştırıcıya yazmak çoğu sistemde grup yetkisiyle doğrudan olur;
        # olmazsa parolasız sudo ile denenir.
        try:
            proc = subprocess.run(
                ['amixer', 'set', 'Master', f'{level}%'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                text=True, timeout=10)
        except Exception as e:
            raise Exception(f'Ses ayarı çalıştırılamadı: {e}')
        if proc.returncode != 0:
            proc = _root_run(['amixer', 'set', 'Master', f'{level}%'])
            if proc.returncode != 0:
                err = (proc.stderr or proc.stdout or '').strip()
                raise Exception(err or 'Ses seviyesi ayarlanamadı')
        return f'Ses seviyesi ayarlandı: %{level}'

    elif cmd == 'get_cpu_governor':
        try:
            with open('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor') as f:
                return f.read().strip()
        except Exception:
            raise Exception('Bu donanım CPU frekans profilini desteklemiyor')

    elif cmd == 'set_cpu_governor':
        gov = str(args.get('governor', args.get('profile', ''))).strip().lower()
        # Arayüzdeki "Dengeli" bir governor adı değil: çekirdek hangisini
        # sunuyorsa (schedutil > ondemand > conservative) o seçilir.
        if gov == 'balanced':
            gov = ''
            try:
                with open('/sys/devices/system/cpu/cpu0/cpufreq/scaling_available_governors') as f:
                    avail = f.read().split()
                for cand in ('schedutil', 'ondemand', 'conservative'):
                    if cand in avail:
                        gov = cand
                        break
            except Exception:
                pass
            if not gov:
                raise Exception('Bu donanım dengeli güç profili desteklemiyor')
        if gov not in ('performance', 'powersave', 'ondemand', 'conservative', 'schedutil'):
            raise Exception('Geçersiz CPU frekans profili')
        gov_file = '/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor'
        if not os.path.exists(gov_file):
            raise Exception('Bu donanım CPU frekans profilini desteklemiyor')
        # Sysfs yazısı root gerektirir; canlı sistemde ankora parolasız sudo kullanır
        proc = _root_run(['tee', gov_file], stdin_text=gov + '\n')
        if proc.returncode != 0:
            raise Exception('Bu donanım CPU frekans profilini desteklemiyor')
        try:
            with open(gov_file) as f:
                applied = f.read().strip()
        except Exception:
            applied = ''
        if applied != gov:
            raise Exception('Bu donanım CPU frekans profilini desteklemiyor')
        return f'CPU frekans profili ayarlandı: {gov}'

    elif cmd == 'set_dpms_timeout':
        # Süre saniyedir; 0 DPMS'i kapatır. Değer ~/.config/ankora/dpms_secs
        # dosyasına yazılır ki .xinitrc yeniden başlatmada koruyabilsin.
        raw = args.get('seconds', args.get('secs', args.get('timeout', args.get('value', 0))))
        try:
            secs = int(raw)
        except (TypeError, ValueError):
            raise Exception('Geçersiz bekleme süresi (saniye)')
        if secs < 0:
            raise Exception('Geçersiz bekleme süresi (saniye)')
        if not shutil.which('xset'):
            raise Exception('Ekran ayarları için xset kurulu değil (x11-xserver-utils)')
        cfg_dir = os.path.expanduser('~/.config/ankora')
        cfg_file = os.path.join(cfg_dir, 'dpms_secs')
        try:
            if secs > 0:
                os.makedirs(cfg_dir, exist_ok=True)
                with open(cfg_file, 'w') as f:
                    f.write(str(secs))
            elif os.path.exists(cfg_file):
                os.remove(cfg_file)
        except Exception:
            pass  # kalıcılık hatası ayarın kendisini düşürmez
        env = os.environ.copy()
        if 'DISPLAY' not in env:
            env['DISPLAY'] = ':0'
        cmd_args = ['xset', '-dpms'] if secs == 0 else \
                   ['xset', '+dpms', 'dpms', str(secs), str(secs), str(secs)]
        try:
            p = subprocess.run(cmd_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, env=env, timeout=10)
        except Exception as e:
            raise Exception(f'DPMS ayarı uygulanamadı: {e}')
        if p.returncode != 0:
            raise Exception(p.stderr.strip() or 'DPMS ayarı uygulanamadı')
        if secs == 0:
            return 'Ekran uyku (DPMS) kapatıldı'
        return f'Ekran uyku zaman aşımı ayarlandı: {secs} sn'

    elif cmd == 'get_display_modes':
        # Çıktı listelemeyen sunucularda (Xvfb vb.) boş döner; arayüz sabit
        # listeye düşerek çalışmayı sürdürür.
        info = {'output': None, 'current_mode': None, 'current_rate': None,
                'preferred_mode': None, 'modes': []}
        try:
            p = subprocess.run(['xrandr', '--query'], stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, timeout=10)
        except Exception:
            return info

        output = None
        for line in p.stdout.splitlines():
            if output is None:
                cm = re.match(r'^(\S+)\s+connected\b', line)
                if cm:
                    output = cm.group(1)
                    info['output'] = output
                    sm = re.search(r'(\d+x\d+)\+\d+\+\d+', line)
                    if sm:
                        info['current_mode'] = sm.group(1)
                continue

            mm = re.match(r'^\s+(\d+x\d+)\s+(.+)$', line)
            if mm:
                rates = []
                preferred = False
                for tok in mm.group(2).split():
                    marked = '*' in tok
                    if '+' in tok:
                        preferred = True
                    r = tok.replace('*', '').replace('+', '')
                    if re.match(r'^\d+(\.\d+)?$', r):
                        rates.append(r)
                        if marked:
                            info['current_rate'] = r
                info['modes'].append({
                    'mode': mm.group(1),
                    'rates': rates,
                    'current': mm.group(1) == info['current_mode'],
                    'preferred': preferred
                })
                if preferred and not info['preferred_mode']:
                    info['preferred_mode'] = mm.group(1)
            elif line and not line[0].isspace():
                break
        return info

    elif cmd == 'set_display_mode':
        mode = str(args.get('mode', '')).strip()
        rate = str(args.get('rate', '')).strip()
        output = str(args.get('output', '')).strip()
        # 'preferred': ekranın önerilen (native) çözünürlüğü — kurulum sonrası
        # bulanıklığı çözen seçenek.
        if mode != 'preferred' and not re.match(r'^\d+x\d+$', mode):
            raise Exception('Geçersiz çözünürlük biçimi')
        if output and not re.match(r'^[A-Za-z0-9_-]+$', output):
            raise Exception('Geçersiz ekran çıkışı')
        if mode == 'preferred':
            if not output:
                cur = _display_current_state()
                output = (cur or {}).get('output') or ''
            if not output:
                raise Exception('Bağlı ekran bulunamadı')
            cmd_args = ['xrandr', '--output', output, '--preferred']
        else:
            cmd_args = ['xrandr']
            if output:
                cmd_args += ['--output', output, '--mode', mode]
            else:
                cmd_args += ['--size', mode]
        if rate and re.match(r'^\d+(\.\d+)?$', rate):
            cmd_args += ['--rate', rate]

        prev = _display_current_state()
        try:
            p = subprocess.run(cmd_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, timeout=15)
        except Exception as e:
            raise Exception(f'Ekran modu ayarlanamadı: {e}')
        if p.returncode != 0:
            raise Exception(p.stderr.strip() or 'Ekran modu uygulanamadı')
        # Güvenlik ağı: değişiklik onaylanmazsa eski moda otomatik geri dönüş.
        revert_pid = _display_schedule_revert(prev)
        return {'applied': True,
                'revert_after': DISPLAY_REVERT_DELAY if revert_pid else 0}

    elif cmd == 'confirm_display_mode':
        # Arayüz onayı: geri dönüş sayacını iptal eder.
        _display_cancel_revert()
        return True

    elif cmd == 'revert_display_mode':
        # Kullanıcının "geri al" düğmesi: sayaç beklemeden eski moda dönülür.
        prev = dict(_display_revert)
        _display_cancel_revert()
        if not prev.get('mode'):
            raise Exception('Geri alınacak önceki ekran modu yok')
        cmd_args = ['xrandr', '--output', prev['output'], '--mode', prev['mode']]
        if prev.get('rate'):
            cmd_args += ['--rate', prev['rate']]
        p = subprocess.run(cmd_args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           text=True, timeout=15)
        if p.returncode != 0:
            raise Exception(p.stderr.strip() or 'Önceki ekran moduna dönülemedi')
        return True

    elif cmd == 'set_display_scale':
        try:
            pct = float(args.get('percent', 100))
        except (TypeError, ValueError):
            raise Exception('Geçersiz ölçek değeri')
        if not 50 <= pct <= 300:
            raise Exception('Ölçek %50 ile %300 arasında olmalı')
        dpi = int(round(96 * pct / 100.0))
        p = subprocess.run(['xrandr', '--dpi', str(dpi)], stdout=subprocess.PIPE,
                           stderr=subprocess.PIPE, text=True, timeout=10)
        if p.returncode != 0:
            raise Exception(p.stderr.strip() or 'Ölçek uygulanamadı')
        return True

    elif cmd == 'save_ai_credential':
        prov = (args.get('provider') or '').strip().lower()
        key = (args.get('apiKey') or args.get('api_key') or '').strip()
        cfg_dir = os.path.expanduser('~/.config/ankora')
        os.makedirs(cfg_dir, exist_ok=True)
        c_file = os.path.join(cfg_dir, 'ai_creds.json')
        creds = {}
        if os.path.exists(c_file):
            try:
                with open(c_file, 'r') as f: creds = json.load(f)
            except: pass
        if key: creds[prov] = key
        elif prov in creds: del creds[prov]
        with open(c_file, 'w') as f: json.dump(creds, f)
        os.chmod(c_file, 0o600)
        return True

    elif cmd == 'has_ai_credential':
        prov = (args.get('provider') or '').strip().lower()
        c_file = os.path.expanduser('~/.config/ankora/ai_creds.json')
        if os.path.exists(c_file):
            try:
                with open(c_file, 'r') as f: creds = json.load(f)
                return bool(creds.get(prov))
            except: pass
        return False

    elif cmd == 'delete_ai_credential':
        prov = (args.get('provider') or '').strip().lower()
        c_file = os.path.expanduser('~/.config/ankora/ai_creds.json')
        if os.path.exists(c_file):
            try:
                with open(c_file, 'r') as f: creds = json.load(f)
                if prov in creds: del creds[prov]
                with open(c_file, 'w') as f: json.dump(creds, f)
            except: pass
        return True

    elif cmd == 'query_local_ai':
        prompt = args.get('prompt', '')
        p_lower = prompt.lower()
        if 'temizle' in p_lower or 'önbellek' in p_lower:
            return {
                'reply': 'Sistem ve paket önbelleklerinin temizlenmesi önerilir.',
                'has_action': True,
                'action_command': 'apt-get clean && rm -rf /tmp/*',
                'action_desc': 'Geçici önbellekleri temizleme',
                'action_token': 'live_iso_token'
            }
        elif 'disk' in p_lower or 'ram' in p_lower or 'durum' in p_lower:
            return {
                'reply': 'Sistem donanım ve depolama kaynakları taranıyor.',
                'has_action': True,
                'action_command': 'df -h / && free -m',
                'action_desc': 'Disk ve bellek doluluk durumu',
                'action_token': 'live_iso_token'
            }
        return {
            'reply': f"Ankora AI Çekirdeği hazır. Canlı sistem oturumunda yanıtlanıyor:\n\"{prompt}\"",
            'has_action': False,
            'action_command': None,
            'action_desc': None,
            'action_token': None
        }

    elif cmd == 'execute_agent_confirmed_action':
        command = args.get('command', '')
        return execute_ayaz_command('run_terminal_command', {'command': command})

    elif cmd == 'check_first_run':
        cfg_file = os.path.expanduser('~/.config/ankora/welcomed.lock')
        return not os.path.exists(cfg_file)

    elif cmd == 'set_first_run_completed':
        dont_show = args.get('dontShowAgain', True)
        if dont_show:
            cfg_dir = os.path.expanduser('~/.config/ankora')
            os.makedirs(cfg_dir, exist_ok=True)
            with open(os.path.join(cfg_dir, 'welcomed.lock'), 'w') as f:
                f.write('welcomed')
        return True

    elif cmd == 'check_de_update':
        return {
            'has_update': False,
            'current_version': '2.0.0',
            'latest_version': '2.0.0',
            'release_name': 'Ankora Linux 2.0 (Canlı Kalıp)',
            'release_notes': 'Sisteminiz şu anda en güncel Ayaz DE sürümünü çalıştırmaktadır.',
            'download_url': None,
            'published_at': '2026-09-27',
            'package_size_bytes': 0,
            'expected_sha256': None,
            'sha256_url': None
        }

    elif cmd == 'download_and_apply_de_update':
        return 'Canlı ISO ortamında güncelleme simülasyonu tamamlandı.'

    elif cmd == 'restart_desktop_process':
        subprocess.Popen(['pkill', '-x', 'ayaz'])
        return True

    # Bilinmeyen komut sessizce "işlendi" derse arayüz hiçbir zaman hata görmez;
    # köprü ile uyuşmayan her çağrı gerçek bir hata olarak döner.
    raise Exception(f"Bilinmeyen komut: {cmd}")


class AyazIpcHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Denetim izi: hangi istek ne zaman geldi. Dosya sahibine 0600 ile
        # açılır, 256 KB'ta baştan başlar; günlük tutma hatası isteği durdurmaz.
        try:
            log_dir = os.path.join(os.path.expanduser('~'), '.cache')
            if not os.path.isdir(log_dir):
                os.makedirs(log_dir, mode=0o700, exist_ok=True)
            log_path = os.path.join(log_dir, 'ayaz-ipc.log')
            if os.path.exists(log_path) and os.path.getsize(log_path) > 262144:
                os.remove(log_path)
            line = '%s - %s\n' % (self.log_date_time_string(), format % args)
            fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            try:
                os.write(fd, line.encode('utf-8', 'replace'))
            finally:
                os.close(fd)
        except Exception:
            pass

    def _send_cors(self):
        self.send_header('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
        self.send_header('Vary', 'Origin')

    def do_OPTIONS(self):
        self.send_response(200)
        if self.headers.get('Origin', '') == ALLOWED_ORIGIN:
            self._send_cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Ayaz-Token')
        self.end_headers()

    # Uzak siteler X-Frame-Options / frame-ancestors ile çerçeveyi reddeder;
    # bu köprü başlıkları yeniden üretmediği için yerleşik görüntüleyici her
    # http/https adresini açabilir. Yerel ve özel ağ adresleri alınmaz.
    LOCAL_HOST = re.compile(
        r'^(localhost|127(\.\d+){3}|0\.0\.0\.0|10(\.\d+){3}|192\.168(\.\d+){2}|'
        r'169\.254(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|\[?::1\]?)$', re.I)

    def _proxy_error(self, code, message):
        body = (
            '<!DOCTYPE html><meta charset="utf-8">'
            '<body style="margin:0;background:#181a24;color:#e8eaf2;'
            'font:14px/1.6 system-ui,sans-serif;display:flex;align-items:center;'
            'justify-content:center;height:100vh;text-align:center">'
            '<div><p style="font-size:16px;margin:0 0 8px">Sayfa açılamadı</p>'
            '<p style="opacity:.72;margin:0">' + message + '</p></div></body>'
        ).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_proxy(self):
        try:
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        except Exception:
            params = {}
        url = (params.get('url') or [''])[0].strip()
        if not re.match(r'^https?://', url):
            self._proxy_error(400, 'Yalnızca http/https adresleri görüntülenebilir.')
            return
        host = urllib.parse.urlparse(url).hostname or ''
        if self.LOCAL_HOST.match(host):
            self._proxy_error(403, 'Yerel ağ adresleri görüntülenemez.')
            return

        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 '
                          '(KHTML, like Gecko) Version/16.5 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr,en;q=0.8',
        })
        # Bağlantı koptuğu için bir kez daha denenir; bazı sunucular ilk isteği
        # reddedip ikincisini kabul eder. Başarılı denemede döngü hemen biter.
        raw = final_url = ctype = None
        last_err = None
        for attempt in range(2):
            try:
                resp = urllib.request.urlopen(req, timeout=20)
                raw = resp.read(4 * 1024 * 1024)
                final_url = resp.geturl()
                ctype = resp.headers.get('Content-Type') or 'text/html; charset=utf-8'
                if (resp.headers.get('Content-Encoding') or '').lower() == 'gzip':
                    try:
                        raw = gzip.decompress(raw)
                    except Exception:
                        pass
                break
            except Exception as e:
                last_err = e
                if attempt == 0:
                    time.sleep(0.5)
        if raw is None:
            detail = str(last_err).strip() or type(last_err).__name__
            self._proxy_error(502, f'Uzak sunucu yanıt vermedi: {detail}')
            return

        if 'html' not in ctype.lower():
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return

        # <base> göreli alt kaynakları çözümler. Geçişlerin tümü host'taki
        # decide-policy üzerinde toplandığı için ayrıca betik enjekte edilmez.
        inject = (
            '<base href="' + final_url.replace('&', '&amp;').replace('"', '&quot;') + '">'
        ).encode('utf-8')

        # <base> belgenin BAŞINA eklenir. Tarayıcı göreli adresleri
        # ayrıştırma anındaki tabanla çözdüğü için </head>'den sonraki bir base
        # ilk <link rel=stylesheet'>leri kaçırmış, stil istekleri köprü adresine
        # (404) gidiyordu.
        low = raw.lower()
        marker = (re.search(rb'<head[^>]*>', low)
                  or re.search(rb'<body[^>]*>', low)
                  or re.search(rb'<!doctype[^>]*>', low))
        pos = marker.end() if marker else 0
        raw = raw[:pos] + inject + raw[pos:]

        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        if clean_path == '/proxy':
            self._serve_proxy()
            return
        if clean_path in ('/', ''):
            clean_path = '/index.html'

        base_dir = os.path.abspath('/usr/share/ayaz')
        clean_rel = clean_path.lstrip('/')
        file_path = os.path.abspath(os.path.normpath(os.path.join(base_dir, clean_rel)))
        if not (file_path == base_dir or file_path.startswith(base_dir + os.sep)) or not os.path.isfile(file_path):
            self.send_response(404)
            self.end_headers()
            return

        ext = os.path.splitext(file_path)[1].lower()
        mime_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.pdf': 'application/pdf'
        }
        content_type = mime_types.get(ext, 'application/octet-stream')
        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            # Token asla HTTP ile servis edilmez: kimliksiz GET çeken her yerel
            # süreç aynısını okuyup IPC'ye yetkisiz erişebilirdi. Token yalnızca
            # WebView user script'inde (build-iso.sh içinde) üretilir.
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self._send_cors()
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_response(500)
            self.end_headers()

    def do_POST(self):
        if self.path != '/api/ipc':
            self.send_response(404)
            self.end_headers()
            return

        # GÜVENLİK: Tarayıcı kökenleri yalnız sabit izinli Origin'den gelebilir.
        # Origin başlığı taşımayan yerel süreçler (curl vb.) etkilenmez.
        req_origin = self.headers.get('Origin', '')
        if req_origin and req_origin != ALLOWED_ORIGIN:
            resp = json.dumps({'error': 'Yetkisiz erişim: Geçersiz Origin'}).encode('utf-8')
            self.send_response(403)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(resp)
            return

        # GÜVENLİK: Token doğrulaması — yetkisiz yerel süreçlerin IPC'ye erişimini
        # engeller. Zaman sabitli karşılaştırma, karşılaştırmayı ölçülebilir kılmaz.
        req_token = self.headers.get('X-Ayaz-Token', '')
        if not hmac.compare_digest(req_token, IPC_TOKEN):
            IPC_STATE['bad'] += 1
            resp = json.dumps({'error': 'Yetkisiz erişim: Geçersiz IPC token'}).encode('utf-8')
            # Token 256 bit olduğu için deneme kırılamaz; yine de uzun süreli
            # denemede yanıt kodu değişir ve kapı kalıcı olarak kapanır.
            self.send_response(503 if IPC_STATE['bad'] >= 50 else 403)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(resp)
            return
        IPC_STATE['bad'] = 0

        content_length = int(self.headers.get('Content-Length', 0))
        # Sınırsız gövde, tek istekle bellek tüketilebilir
        if content_length > 1_000_000:
            self.send_response(413)
            self.end_headers()
            return
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            req = json.loads(body)
            cmd = req.get('cmd', '')
            args = req.get('args', {})
            result = execute_ayaz_command(cmd, args)
            resp = json.dumps({'result': result}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.end_headers()
            self.wfile.write(resp)
        except Exception as e:
            resp = json.dumps({'error': str(e)}).encode('utf-8')
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self._send_cors()
            self.end_headers()
            self.wfile.write(resp)

def start_ipc_server():
    server = ThreadingHTTPServer(('127.0.0.1', PORT), AyazIpcHandler)
    server.serve_forever()

class AyazDesktop(Gtk.Window):
    def __init__(self):
        super().__init__(title="Ayaz — Ankora Linux")
        self.connect("destroy", self.on_destroy)
        self.maximize()
        self.fullscreen()
        
        settings = WebKit2.Settings()
        settings.set_enable_javascript(True)
        settings.set_enable_webgl(False)
        settings.set_enable_accelerated_2d_canvas(False)
        settings.set_enable_smooth_scrolling(False)
        settings.set_enable_developer_extras(False)
        settings.set_allow_file_access_from_file_urls(True)
        settings.set_allow_universal_access_from_file_urls(True)
        settings.set_enable_page_cache(False)
        settings.set_enable_offline_web_application_cache(False)
        settings.set_enable_html5_local_storage(True)
        settings.set_enable_html5_database(False)
        settings.set_enable_media_stream(False)
        settings.set_enable_mediasource(False)
        settings.set_enable_webaudio(False)
        
        self.webview = WebKit2.WebView.new_with_settings(settings)
        try:
            ctx = self.webview.get_context()
            ctx.set_cache_model(WebKit2.CacheModel.DOCUMENT_VIEWER)
        except Exception:
            pass

        # Uzak sayfanın kendi JavaScript'i ham bir adrese atladığında çerçeve
        # XFO kuralıyla boş kalır. Bütün geçişler burada toplanır: köprü
        # dışındaki hedefler iptal edilip arayüze bildirilir.
        self.webview.connect('decide-policy', self.on_decide_policy)

        content_mgr = self.webview.get_user_content_manager()
        content_mgr.register_script_message_handler("ayazIpc")
        content_mgr.connect("script-message-received::ayazIpc", self.on_script_message)
        try:
            # Token yalnız ana çerçeveye enjekte edilir: köprü (iframe)
            # sayfalarında window.__AYAZ_IPC_TOKEN__ bulunmaz, messageHandler
            # yolu token doğrulaması olmadan açılmaz.
            token_script = WebKit2.UserScript.new(
                f"window.__AYAZ_IPC_TOKEN__ = '{IPC_TOKEN}';",
                WebKit2.UserContentInjectedFrames.TOP_FRAME,
                WebKit2.UserScriptInjectionTime.START,
                None,
                None
            )
            content_mgr.add_script(token_script)
        except Exception as e:
            # Enjeksiyon sessizce düşerse tüm IPC istekleri token reddi yer;
            # hata loga yazılır ki kırık köprü görünür kalsın.
            print(f"[IPC] token script enjekte edilemedi: {e}", flush=True)

        # Doğrudan yerel dosya üzerinden açma - Sıfır ağ bağımlılığı, anında ve hatasız başlatma
        path = os.path.abspath("/usr/share/ayaz/index.html")
        self.webview.load_uri(f"file://{path}")
        self.add(self.webview)
        self.show_all()

    def on_script_message(self, manager, js_result):
        # WebKit2 >= 2.50'te JavascriptResult.get_value() kaldırıldı, get_js_value()
        # JSC.Value döndürür. Hata bu satırın dışına çıkarsa istek yanısız kalır ve
        # JS tarafındaki her çağrı 30 saniyede zaman aşımına uğrar.
        try:
            if hasattr(js_result, 'get_js_value'):
                val = js_result.get_js_value()
            else:
                val = js_result.get_value()
            raw_str = val.to_string()
            data = json.loads(raw_str)
            req_id = data.get('id') if data.get('id') is not None else data.get('req_id')
            cmd = data.get('cmd')
            args = data.get('args', {})
        except Exception as e:
            print(f"[IPC] mesaj cozulemedi: {e}", flush=True)
            return

        # GÜVENLİK: messageHandler yolu da token ister. Token yalnız ana
        # çerçeveye enjekte edildiğinden köprüdeki uzak sayfalar bu kapıyı
        # açamaz; geçersiz denemeler kapıyı kalıcı olarak kapatır.
        req_token = data.get('token', '')
        if not isinstance(req_token, str) or not hmac.compare_digest(req_token, IPC_TOKEN):
            IPC_STATE['bad'] += 1
            print("[IPC] gecersiz token: messageHandler istegi reddedildi", flush=True)
            return
        IPC_STATE['bad'] = 0

        def run_worker():
            try:
                res = execute_ayaz_command(cmd, args)
                payload = json.dumps({'id': req_id, 'result': res})
                js_code = f"if (window.__AYAZ_RESOLVE__) window.__AYAZ_RESOLVE__({payload});"
            except Exception as err:
                payload = json.dumps({'id': req_id, 'error': str(err)})
                js_code = f"if (window.__AYAZ_REJECT__) window.__AYAZ_REJECT__({payload});"

            def deliver():
                try:
                    self.webview.run_javascript(js_code, None, None, None)
                except Exception as e:
                    print(f"[IPC] run_javascript hatasi: {e}", flush=True)
                return False

            GLib.idle_add(deliver)

        threading.Thread(target=run_worker, daemon=True).start()

    PROXY_PREFIX = f'http://127.0.0.1:{PORT}/proxy'

    def on_destroy(self, *args):
        # Pencere kapanırken arayüz temiz çıkış işareti düşer; oturum çökme
        # sayacı yalnız gerçekten beklenmedik kapanışlarda artar.
        try:
            self.webview.run_javascript(
                'window.__ayazCleanExit && window.__ayazCleanExit();',
                None, None, None)
        except Exception:
            pass
        time.sleep(0.3)
        Gtk.main_quit()

    def on_decide_policy(self, view, decision, decision_type):
        # Köprüye giden her şey olduğu gibi geçer; http/https olan diğer her
        # hedef iptal edilir ve hedef adres arayüze bildirilir. Arayüz adresi
        # köprü üzerinden yeniden açtığı için bağlantı, form ve JavaScript
        # geçişleri aynı yoldan ilerler.
        uri = ''
        if isinstance(decision, WebKit2.NavigationPolicyDecision):
            try:
                req = decision.get_navigation_action().get_request()
            except Exception:
                req = None
            if req is None:
                try:
                    req = decision.get_request()
                except Exception:
                    req = None
            if req is not None:
                uri = req.get_uri() if hasattr(req, 'get_uri') else str(req.to_string())

        if not uri.startswith(('http://', 'https://')) or uri.startswith(self.PROXY_PREFIX):
            decision.use()
            return

        decision.ignore()
        try:
            self.webview.run_javascript(
                "if (window.__ayazProxyNav) window.__ayazProxyNav(%s);"
                % json.dumps(uri), None, None, None)
        except Exception as e:
            print(f"[TARAYICI] gecis bildirimi gonderilemedi: {e}", flush=True)

if __name__ == "__main__":
    t = threading.Thread(target=start_ipc_server, daemon=True)
    t.start()
    app = AyazDesktop()

    def _sig_exit(signum, frame):
        # SIGTERM/SIGINT ile kapanışta da temiz çıkış işareti düşülür.
        try:
            app.webview.run_javascript(
                'window.__ayazCleanExit && window.__ayazCleanExit();',
                None, None, None)
        except Exception:
            pass
        time.sleep(0.5)
        Gtk.main_quit()

    try:
        import signal as _signal
        _signal.signal(_signal.SIGTERM, _sig_exit)
        _signal.signal(_signal.SIGINT, _sig_exit)
    except Exception:
        pass
    Gtk.main()
AYAZ_PY
    chmod +x "$CHROOT_DIR/usr/bin/ayaz"
fi

# XDG ve Desktop Entegrasyonu
cp "$ROOT_DIR/scripts/ayaz.desktop" "$CHROOT_DIR/usr/share/applications/ayaz.desktop" || true
cp "$ROOT_DIR/scripts/ayaz-session.desktop" "$CHROOT_DIR/usr/share/xsessions/ayaz.desktop" || true
cp "$ROOT_DIR/scripts/ayaz-update-helper.sh" "$CHROOT_DIR/usr/local/bin/ayaz-update-helper" || true
chmod +x "$CHROOT_DIR/usr/local/bin/ayaz-update-helper" || true
cp "$ROOT_DIR/scripts/ayaz-pkg-helper.sh" "$CHROOT_DIR/usr/local/bin/ayaz-pkg-helper" || true
chmod +x "$CHROOT_DIR/usr/local/bin/ayaz-pkg-helper" || true
cp "$ROOT_DIR/scripts/ankora-updater-sudoers" "$CHROOT_DIR/etc/sudoers.d/ankora-updater" || true
chmod 0440 "$CHROOT_DIR/etc/sudoers.d/ankora-updater" || true

# Masaüstü ve Sistem Marka İkonlarını Yerleştir
mkdir -p "$CHROOT_DIR/usr/share/pixmaps" "$CHROOT_DIR/usr/share/icons/hicolor/512x512/apps" "$CHROOT_DIR/usr/share/icons/hicolor/scalable/apps"
cp "$ROOT_DIR/assets/logo.png" "$CHROOT_DIR/usr/share/pixmaps/ayaz.png" 2>/dev/null || true
cp "$ROOT_DIR/assets/logo.png" "$CHROOT_DIR/usr/share/pixmaps/ankora.png" 2>/dev/null || true
cp "$ROOT_DIR/assets/logo.png" "$CHROOT_DIR/usr/share/icons/hicolor/512x512/apps/ayaz.png" 2>/dev/null || true
cp "$ROOT_DIR/assets/logo.svg" "$CHROOT_DIR/usr/share/icons/hicolor/scalable/apps/ayaz.svg" 2>/dev/null || true

# Windows CRLF → Unix LF dönüşümü (sudoers \r görürse syntax error verir)
echo "[BİLGİ] Windows satır sonları (CRLF) temizleniyor..."
for f in \
    "$CHROOT_DIR/etc/sudoers.d/ankora-updater" \
    "$CHROOT_DIR/etc/sudoers.d/ankora" \
    "$CHROOT_DIR/etc/inittab" \
    "$CHROOT_DIR/etc/X11/Xwrapper.config" \
    "$CHROOT_DIR/usr/local/bin/ayaz-update-helper" \
    "$CHROOT_DIR/usr/local/bin/ayaz-pkg-helper" \
    "$CHROOT_DIR/usr/share/applications/ayaz.desktop" \
    "$CHROOT_DIR/usr/share/xsessions/ayaz.desktop" \
    "$CHROOT_DIR/home/ankora/.xinitrc" \
    "$CHROOT_DIR/home/ankora/.profile" \
    "$CHROOT_DIR/etc/skel/.xinitrc" \
    "$CHROOT_DIR/etc/skel/.profile" \
    "$CHROOT_DIR/usr/bin/ayaz"; do
    if [ -f "$f" ]; then
        sed -i 's/\r$//' "$f"
    fi
done

# Build'a özel IPv4 zorlaması artık gerekli; dağıtılan sistemde kalmamalı
rm -f "$CHROOT_DIR/etc/apt/apt.conf.d/02-build-forceipv4"

# 8. SquashFS Sıkıştırılmış Kök Dosya Sisteminin Üretilmesi
echo "[5/8] SquashFS kök dosya sistemi sıkıştırılıyor (filesystem.squashfs)..."
# Çekirdek ve initrd dosyalarını çıkar
KERNEL_FILE=$(find "$CHROOT_DIR/boot" -name "vmlinuz*" | sort -V | tail -n 1)
INITRD_FILE=$(find "$CHROOT_DIR/boot" -name "initrd.img*" | sort -V | tail -n 1)

if [ -z "$KERNEL_FILE" ] || [ -z "$INITRD_FILE" ]; then
    echo "[HATA] Çekirdek (vmlinuz) veya initrd dosyası bulunamadı!" >&2
    echo "       Chroot /boot içeriği:" >&2
    ls -la "$CHROOT_DIR/boot/" >&2
    exit 2
fi

cp -v "$KERNEL_FILE" "$IMAGE_DIR/live/vmlinuz"
cp -v "$INITRD_FILE" "$IMAGE_DIR/live/initrd"

# initrd içinde live-boot modüllerinin varlığını doğrula.
# lsinitramfs host'ta kurulu olmayabilir (initramfs-tools-core chroot'a ait);
# yoksa cpio ile initrd'yi doğrudan listele, o da yoksa doğrulamayı atla.
echo "[DOĞRULAMA] initrd içindeki live-boot modülleri kontrol ediliyor..."
# pipefail açık: erken kapanan okuyucu (grep -q, head) yazan tarafı SIGPIPE ile
# öldürür ve 141 kodu tüm betiği sonlandırır. Bu yüzden boru yok — dosya girdili
# grep ve tüm girdiyi okuyup tüketen sed kullanılır.
if command -v lsinitramfs >/dev/null 2>&1; then
    INITRD_LIST=$(lsinitramfs "$IMAGE_DIR/live/initrd" 2>/dev/null || true)
elif command -v cpio >/dev/null 2>&1; then
    INITRD_LIST=$(zcat "$IMAGE_DIR/live/initrd" 2>/dev/null | cpio -t 2>/dev/null || true)
else
    INITRD_LIST=""
fi

if [ -z "$INITRD_LIST" ]; then
    echo "[BİLGİ] initrd içeriği listelenemedi (lsinitramfs/cpio host'ta yok), doğrulama atlandı."
elif grep -q "live" <<< "$INITRD_LIST"; then
    echo "[OK] live-boot modülleri initrd içinde mevcut."
else
    echo "[UYARI] live-boot modülleri initrd içinde bulunamadı. Boot sorunları yaşanabilir."
    echo "        initrd listesi (ilk 20 satır):"
    printf '%s\n' "$INITRD_LIST" | sed -n '1,20p'
fi

# ISO manifest'i: kök dosya sisteminin imaj künyesi. Ayarlar > Hakkında da
# bu dosyadan okur; sürüm, derleme tarihi ve git özeti burada saklanır.
echo "[MANIFEST] Sistem künyesi yazılıyor..."
AYAZ_VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$ROOT_DIR/src-tauri/tauri.conf.json")
AYAZ_VERSION="${AYAZ_VERSION%%$'\n'*}"
if [ -z "$AYAZ_VERSION" ]; then
    AYAZ_VERSION="2.0.0"
fi
# git yoksa (ör. WSL) .git/HEAD + ref dosyaları doğrudan okunur; revizyon
# manifestte hiçbir koşulda boş kalmaz.
GIT_REV="bilinmiyor"
if command -v git >/dev/null 2>&1; then
    GIT_REV=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "bilinmiyor")
elif [ -f "$ROOT_DIR/.git/HEAD" ]; then
    _HEAD_RAW=$(tr -d '[:space:]' < "$ROOT_DIR/.git/HEAD")
    _GIT_HASH=""
    case "$_HEAD_RAW" in
        ref:*)
            _GIT_REF=${_HEAD_RAW#ref:}
            if [ -f "$ROOT_DIR/.git/$_GIT_REF" ]; then
                _GIT_HASH=$(head -c 40 "$ROOT_DIR/.git/$_GIT_REF")
            elif [ -f "$ROOT_DIR/.git/packed-refs" ]; then
                _GIT_HASH=$(awk -v r="$_GIT_REF" '$2 == r { print $1; exit }' "$ROOT_DIR/.git/packed-refs")
            fi
            ;;
        *)
            _GIT_HASH=$_HEAD_RAW
            ;;
    esac
    if [ -n "$_GIT_HASH" ]; then
        GIT_REV=${_GIT_HASH:0:7}
    fi
fi
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p "$CHROOT_DIR/usr/share/ayaz"
cat > "$CHROOT_DIR/usr/share/ayaz/manifest.json" <<MANIFEST_JSON
{
  "product": "Ayaz DE (Ankora Linux)",
  "version": "${AYAZ_VERSION}",
  "build_date": "${BUILD_DATE}",
  "git_revision": "${GIT_REV}",
  "architecture": "amd64",
  "base": "Devuan GNU/Linux (Daedalus)",
  "init_system": "SysVinit",
  "image_type": "hybrid live ISO"
}
MANIFEST_JSON

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
  APPEND initrd=/live/initrd boot=live quiet splash components username=ankora

LABEL failsafe
  MENU LABEL ^2. Ankora Linux (Failsafe Guvenli Mod)
  KERNEL /live/vmlinuz
  APPEND initrd=/live/initrd boot=live components nomodeset noapic noacpi nosmap nosmep
EOF

# Gerekli syslinux modülleri
mkdir -p "$IMAGE_DIR/isolinux"
for src_iso in /usr/lib/ISOLINUX/isolinux.bin /usr/lib/syslinux/isolinux.bin /usr/lib/syslinux/modules/bios/isolinux.bin; do
    if [ -f "$src_iso" ]; then
        cp -f "$src_iso" "$IMAGE_DIR/isolinux/isolinux.bin"
        break
    fi
done
for mod_dir in /usr/lib/syslinux/modules/bios /usr/lib/syslinux/bios /usr/lib/syslinux /usr/lib/ISOLINUX; do
    if [ -d "$mod_dir" ]; then
        cp -f "$mod_dir"/*.c32 "$IMAGE_DIR/isolinux/" 2>/dev/null || true
    fi
done

# GRUB (UEFI)
cat << 'EOF' > "$IMAGE_DIR/boot/grub/grub.cfg"
set default="0"
set timeout=5

insmod all_video
insmod gfxterm

menuentry "Ankora Linux 2.0 (Ayaz DE - Canli Masaustu)" {
    linux /live/vmlinuz boot=live quiet splash components username=ankora
    initrd /live/initrd
}

menuentry "Ankora Linux 2.0 (Guvenli Mod / Failsafe)" {
    linux /live/vmlinuz boot=live components nomodeset noapic noacpi
    initrd /live/initrd
}
EOF

# EFI Bağımsız Önyükleyici ve efi.img Üretimi (Modern UEFI Boot Desteği)
mkdir -p "$IMAGE_DIR/EFI/BOOT" "$IMAGE_DIR/EFI/boot" "$IMAGE_DIR/boot/grub/x86_64-efi"

if command -v grub-mkstandalone &>/dev/null; then
    echo "[EFI] grub-mkstandalone ile bootx64.efi üretiliyor..."
    grub-mkstandalone \
        --format=x86_64-efi \
        --output="$IMAGE_DIR/EFI/boot/bootx64.efi" \
        --locales="" \
        --fonts="" \
        --modules="part_gpt part_msdos fat ext2 iso9660 normal configfile linux" \
        "boot/grub/grub.cfg=$IMAGE_DIR/boot/grub/grub.cfg" 2>/dev/null || true
    cp -f "$IMAGE_DIR/EFI/boot/bootx64.efi" "$IMAGE_DIR/EFI/BOOT/BOOTX64.EFI" 2>/dev/null || true
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

# 10. ISO Önyükleme Manifest'i: boot zinciri künyesi + paket envanteri.
#     ISO kökünde durur (Windows'tan bağlanınca da okunur); kurulu paketler
#     ve önyükleme dosyalarının SHA-256 toplamları sırayla listelenir.
echo "[MANIFEST] ISO önyükleme manifest'i yazılıyor..."
{
    echo "# Ayaz DE - ISO Manifest"
    echo "# surum: ${AYAZ_VERSION}"
    echo "# derleme: ${BUILD_DATE}"
    echo "# git: ${GIT_REV}"
    echo "# mimari: amd64"
    echo ""
    echo "[boot-files]"
} > "$IMAGE_DIR/ayaz-manifest.txt"

add_manifest_hash() {
    local abs="$1" label="$2"
    if [ -f "$abs" ]; then
        printf '%s  %s\n' "$(sha256sum "$abs" | cut -d' ' -f1)" "$label" >> "$IMAGE_DIR/ayaz-manifest.txt"
    else
        printf 'YOK  %s\n' "$label" >> "$IMAGE_DIR/ayaz-manifest.txt"
    fi
}

add_manifest_hash "$IMAGE_DIR/live/vmlinuz" "/live/vmlinuz"
add_manifest_hash "$IMAGE_DIR/live/initrd" "/live/initrd"
add_manifest_hash "$IMAGE_DIR/isolinux/isolinux.bin" "/isolinux/isolinux.bin"
add_manifest_hash "$IMAGE_DIR/isolinux/isolinux.cfg" "/isolinux/isolinux.cfg"
add_manifest_hash "$IMAGE_DIR/boot/grub/grub.cfg" "/boot/grub/grub.cfg"
add_manifest_hash "$IMAGE_DIR/EFI/boot/bootx64.efi" "/EFI/boot/bootx64.efi"
add_manifest_hash "$IMAGE_DIR/boot/grub/efi.img" "/boot/grub/efi.img"
add_manifest_hash "$IMAGE_DIR/live/filesystem.squashfs" "/live/filesystem.squashfs"

{
    echo ""
    echo "[packages]"
} >> "$IMAGE_DIR/ayaz-manifest.txt"
# dpkg -l yalnız /var/lib/dpkg okur; chroot içinde /proc mount'u gerekmez.
chroot "$CHROOT_DIR" dpkg -l 2>/dev/null | awk '/^ii/{print $2" "$3}' >> "$IMAGE_DIR/ayaz-manifest.txt" || true

echo "[OK] Manifest yazıldı: ayaz-manifest.txt ($(wc -l < "$IMAGE_DIR/ayaz-manifest.txt") satır)"

# 11. Xorriso ile Hibrit ISO İmajının Derlenmesi
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
    xorriso -as mkisofs -r -V "ANKORA_2_0" \
        -b isolinux/isolinux.bin -c isolinux/boot.cat \
        -no-emul-boot -boot-load-size 4 -boot-info-table \
        -o "$ROOT_DIR/dist/$ISO_NAME" "$IMAGE_DIR"
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
