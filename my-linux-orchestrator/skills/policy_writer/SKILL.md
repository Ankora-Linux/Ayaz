---
name: policy_writer
description: Yeni eklenen bir servis veya uygulama için SELinux (.te/.fc/.pp) veya AppArmor erişim izin protokollerini (profillerini) yazar, enforce modda test eder. "AppArmor profili yaz", "SELinux policy ekle", "erişim izinlerini kısıtla" taleplerinde kullan.
---

# Policy-Writer — erişim politikası yazarı

## Ne yapar
Programın dosya/ağ/çalıştırma erişimlerini politika ile kısıtlar; uygulanabilir profil dosyası üretir, parser ile doğrular, enforce modda dener.

## Girdi
- Hedef binary/servis yolu, hangi framework: `apparmor | selinux`
- İhtiyaç erişimleri (okunacak yollar, portlar, çalıştırılacak komutlar)

## Adımlar
1. **Framework tespiti**: `aa-status 2>/dev/null | head -3`;
   `getenforce 2>/dev/null` → hangisi etkin/etkin değil.
2. **AppArmor** (`/etc/apparmor.d/<ad>`):
   ```apparmor
   /usr/bin/ayaz {
     #include <abstractions/base>
     /usr/bin/ayaz mr,
     /usr/share/ayaz/** r,
     /home/*/.local/share/ayaz/** rwk,
     network inet stream,
     /etc/sudoers.d/ayaz r,
   }
   ```
   - Şablon profil ile başla: `cp /etc/apparmor.d/usr.sbin.mysqld ...` (kalıp).
3. **SELinux**: `sesearch`/`semanage` ile mevcut tipi bul → `.te` yaz →
   `checkmodule -M -m -o mod.mod` → `semodule_package` → `semodule -i`.
4. **Sertleştir**: `deny` kuralı yerine varsayılan-dredda **allow** listesi;
   gereksiz her `rw` kaldır.
5. Uygula ve test et (aşağıda).

## Çıktı
- Profil dosyası (+ varsa `.fc` dosya bağlamı) ve yükleme komutu
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
apparmor_parser -Q /etc/apparmor.d/<ad>     # ayrıştırma hatasız
aa-enforce /etc/apparmor.d/<ad>; aa-status # enforcing listesinde mi
sudo dmesg | grep -i 'apparmor="DENIED"'   # yanlış deny taraması
getenforce                                  # SELinux: Enforcing
```

## Sınırlar
- Profil dosyasında sır/tokan yazma; `@{HOME}`/`@{PROC}` makrolarını kullan.
- `/**` geniş yazma tek başına test amaçlı; teslim öncesi daralt.
- Öncelikle **talep edilen minimum erişimi** ver; onaylanmayan erişimi iletme.
