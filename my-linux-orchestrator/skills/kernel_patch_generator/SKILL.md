---
name: kernel_patch_generator
description: Linux çekirdeğine eklenecek bir özellik veya sürücü için C dilinde standartlara uygun yama (patch) yazar — Kconfig girdisi, Makefile bağlantısı ve checkpatch uyumu dahil. "Çekirdeğe sürücü ekle", "Kconfig'a opsiyon koy", "bu yamayı yaz" taleplerinde kullan.
---

# Kernel-Patch-Generator — çekirdek yaması

## Ne yapar
Çekirdek ağacına (veya harici modül dizinine) Linux kernel standartlarına uygun C kodu + Kconfig + Makefile değişikliği üretir; `git format-patch` biçiminde `.patch` dosyası verir.

## Girdi
- Amaç: hangi özellik/sürücü, hangi alt sistem (`drivers/`, `net/`, `fs/`)
- Çekirdek ağacı yolu veya mevcut harici modül projesi
- Hedef: ana ağaç mı, harici modül mü (`out-of-tree`)

## Adımlar
1. **Referansı bul** — benzer sürücüyü şablon al:
   `grep -rn "obj-\$(CONFIG_" drivers/ | head; ls Documentation/devicetree/bindings/`
2. **Kconfig**: özelliği tanımla
   `config MY_FEATURE` / `tristate "..."` / `default n` / `depends on NET && OF`
3. **Makefile**: `obj-$(CONFIG_MY_FEATURE) += my_driver.o`
4. **C kodu**: kernel stili — sekme girinti, `printk` yerine `pr_*`, `kmalloc(..., GFP_KERNEL)`,
   `goto` ile hata temizliği, `MODULE_LICENSE("GPL v2")`.
5. **Yamayı üret**: değişiklikleri `git add -p` ile topla →
   `git format-patch -1 --stdout > my-feature.patch`
   (harici modül ise `diff -u` + `patch --dry-run` ile doğrula).

## Çıktı
- `my-feature.patch` (+ varsa Kconfig/Makefile satırları yamanın içinde)
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
scripts/checkpatch.pl --strict -v my-feature.patch   # 0 error hedefi
make defconfig && make modules_prepare
make M=$PWD/harici_modul modules                      # harici modülse
patch --dry-run -p1 < my-feature.patch                # temiz uygulanmalı
```

## Sınırlar
- Ana ağaç derlemesi tam ağaç ister (saatler sürebilir) → önce `modules_prepare` + `M=`.
- Çekirdek sürümüne göre API farkı varsa (`LINUX_VERSION_CODE`) belirt.
- `set -euo pipefail` altında betik yazıyorsan `bash -n` ile doğrula.
