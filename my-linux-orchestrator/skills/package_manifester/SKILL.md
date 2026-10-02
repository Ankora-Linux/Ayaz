---
name: package_manifester
description: Yazılan bir yazılımı dağıtıma eklemek için .deb (debian/control, rules) veya .rpm (.spec) paket şablonlarını doldurur, paketi kurulabilir hale getirir ve lintian/rpmlint ile denetler. "deb paketi yap", "rpm spec yaz", "dağıtıma ekle" taleplerinde kullan.
---

# Package-Manifester — paket şabloncusu

## Ne yapar
Projeyi kurulabilir pakete çevirir: Debian için `debian/` (control, rules, install, changelog), RPM için `.spec`; `dpkg-deb`/`rpmbuild` ile üretir, kalite denetimi çalıştırır.

## Girdi
- Üretilen ikili/kaynak yolu, ad + sürüm (repo: **2.0**), mimari
- Bağımlılıklar (dependency_resolver çıktısı doğrudan kullanılır)

## Adımlar
1. **Klasör düzeni** (deb):
   ```
   debian/control   # Package, Version, Architecture, Depends, Maintainer
   debian/rules     # %: + dh veya elle: $(MAKE) install DESTDIR=
   debian/install   # <kaynak> <hedef yol>
   debian/changelog # Sürüm notu (Türkçe)
   ```
2. `control` örneği:
   ```
   Package: ayaz-de
   Version: 2.0
   Architecture: amd64
   Depends: ${shlibs:Depends}, libwebkit2gtk-4.0-37
   Description: Ayaz masaüstü ortami (Ankora Linux)
   ```
3. Derle/kur: `dpkg-buildpackage -us -uc -b` ya da hafif yol:
   `dpkg-deb --build --root-owner-group pkgdir ayaz-de_2.0_amd64.deb`
4. RPM: `.spec` (`Name/Version/Source/%build/%install`) → `rpmbuild -ba`.

## Çıktı
- `ayaz-de_2.0_<arch>.deb` (veya `.rpm`) + `debian/` dosyaları
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
dpkg-deb --info ayaz-de_2.0_amd64.deb
dpkg-deb --contents ayaz-de_2.0_amd64.deb | head
lintian --pedantic ayaz-de_2.0_amd64.deb || true
sudo dpkg -i ... && dpkg -r ayaz-de     # temiz kurulum/kaldırma
```

## Sınırlar
- `Rules-Requires-Root` ve `Build-Depends` alanlarını atla.
- Mimari üretimi (arm64 için amd64 paketi) imzalama; `dpkg --print-architecture` ile doğrula.
- Paket içine kimlik bilgisi/hassas dosya koyma; `.gitignore`'daki artıkları (`target/`, `*.log`) hariç tut.
