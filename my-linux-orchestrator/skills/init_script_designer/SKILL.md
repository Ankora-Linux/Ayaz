---
name: init_script_designer
description: İşletim sistemi açılırken servislerin hangi sıra ile başlayacağını belirleyen init scriptlerini yazar — systemd.service, OpenRC init.d veya SysVinit (inittab/RC) — ve sıralama bağımlılıklarını (önceki/sonraki) doğrular. "servis ekle", "açılışta başlasın", "systemd birimi yaz" taleplerinde kullan.
---

# Init-Script-Designer — açılış servisi tasarımcısı

## Ne yapar
Bir programı açılış servisine çevirir; doğru sıra/ bağımlılıkla başlatır, durdurur, yeniden başlatır. **Hedef init'i önce tespit eder** (Ankora Linux SysVinit'dir, systemd yoktur).

## Girdi
- Servis adı + çalıştırılacak komut, çalıştıracağı kullanıcı
- Init sistemi: `sysvinit | systemd | openrc` (belirsizse tespit et:
  `test -d /run/systemd/system && echo systemd || echo sysvinit`)

## Adımlar
1. **Init tespiti** (yukarıdaki komut) → doğru şablonu seç.
2. **systemd** ise (`/etc/systemd/system/<ad>.service`):
   - `Type=`, `ExecStart=`, `Restart=on-failure`, `User=`
   - Sıra: `After=network.target` + `Wants=` (zorunlu değil `Requires=`)
   - `WantedBy=multi-user.target` + `systemctl enable`
3. **SysVinit** ise (Ankora öncelikli):
   - `/etc/init.d/<ad>` — LSB başlıkları (`### BEGIN INIT INFO`:
     `Required-Start: $network $remote_fs`, `Default-Start: 2 3 4 5`)
   - TTY1 oturumu / inittab satırı gerekiyorsa:
     `1:2345:respawn:...` kalıbına uy, mevcut satırı **değiştirme**, ekle/öner.
   - Kayıt: `update-rc.d <ad> defaults` (veya `insserv`)
4. **OpenRC** ise: `/etc/init.d/<ad>` + `rc-update add <ad> default`.

## Çıktı
- Servis dosyası + enable komutu + sıra gerekçesi (neye after/before, neden)
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
systemd-analyze verify /etc/systemd/system/<ad>.service   # systemd
bash -n /etc/init.d/<ad>                                  # SysVinit/OpenRC
service <ad> start && service <ad> status; service <ad> stop
```

## Sınırlar
- Servis komutunda mutlak yol kullan (`/usr/bin/...`); PATH'e güvenme.
- Ağ/şifre gibi sırları servis dosyasına **koyma** (dosya 0644 okunur);
  `EnvironmentFile=` + 0600 dosya kullan.
- Varsa mevcut init dosyasını silme; farkı yama olarak öner.
