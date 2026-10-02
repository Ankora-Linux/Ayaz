---
name: dependency_resolver
description: Geliştirmek istenen özelliğin çalışması için sistemde eksik olan kütüphaneleri ve paketleri tespit eder (glibc, openssl, libwebkit2gtk, dtc, qemu...), sürüm uyumunu listeler. "Eksik bağımlılıkları bul", "neden bağlanmıyor", "bu özellik için ne kurulmalı" sorularında kullan.
---

# Dependency-Resolver — bağımlılık çözücü

## Ne yapar
Kodun ihtiyaç duyduğu ve sistemde eksik/yanlış sürümde olan paketleri listeler; kurulacakları (varsa sürüm şartıyla) tek satırda raporlar. **Kendisi kurmaz** — kurulum yetkisi olan katmana (şef/kullanıcı) bildirir.

## Girdi
- Kaynak ağacı (nokta-dosyaları, `#include`, `pkg-config` çağrıları) veya çalışan ikili
- Hedef ortam: Debian/Devuan (`apt`) mi, RPM mi

## Adımlar
1. İhtiyacı koddan oku: `grep -rhE '#include <(openssl|zlib|glib|gtk)' --include='*.c' .`
2. Paket eşlemesi: `apt-file search <header>` (yoksa `grep -r <header> /usr/include`)
   — `apt-file` yoksa: `apt-cache search` + `dpkg -S`.
3. Sürüm kontrolü: `pkg-config --modversion openssl`, `dpkg-query -W -f='${Version}' libssl-dev`
   — istenen sürümle karşılaştır (`grep`/`dpkg --compare-versions`).
4. Bağlı kitaplık denetimi (varsa ikili): `ldd ./a.out | grep 'not found'`
5. Eksikleri grupla: **derleme zamanı** (libssl-dev, pkg-config) / **çalışma zamanı** (libssl3).

## Çıktı
```text
EKSIK-DERLEME: libssl-dev (>=3.0), pkg-config
EKSIK-CALISMA: libwebkit2gtk-4.0-37
KURULUM: sudo apt-get install -y libssl-dev pkg-config
SONUC: OK
```

## Doğrulama
```bash
pkg-config --exists <modul> && echo VAR || echo YOK
ldd ./a.out | grep -c 'not found'   # 0 olmalı
```

## Sınırlar
- Ağ erişimli sorgularda (`apt-get update`) hata alınırsa dur, kullanıcıya sor.
- Yetki isteyen kurulum komutlarını kendin çalıştırma; raporla (şef sırayı kurar).
- Bilinen ortam notu: Ankora canlı ISO'da `libssl-dev` kurulu değilse cargo/openssl derlemesi durur (`libssl-dev` gerekir).
