---
name: qemu_automator
description: Derlenen yeni ISO'yu, kernel'i veya rootfs'yi otomatik olarak QEMU/KVM sanal makinesinde başlatacak bash betiklerini hazırlar; boot sonrası seri port logunu dosyaya yakalar ve başarı/başarısızlığı söyler. "ISO'yu QEMU'da dene", "kernel'i boot et", "otomatik test sanal makinesi kur" taleplerinde kullan.
---

# Qemu-Automator — sanal makine test betiği

## Ne yapar
Üretilen artefaktı (ISO / bzImage+initrd / qcow2) QEMU'da başlatan, boot'u seri porttan izleyen, timeout ve başarı ölçütüyle sonuçlandıran tekrarlanabilir bash betiği üretir.

## Girdi
- Artefakt yolu: `iso | kernel(+initrd+append) | disk`
- Başarı ölçütü: log'da beklenen imza (ör. `login:` veya `Ayaz DE hazir`)

## Adımlar
1. **KVM var mı** bak: `test -w /dev/kvm && KVM="-enable-kvm -cpu host" || KVM=""`
2. **Betik iskeleti** (`qemu-boot-test.sh`):
   ```bash
   #!/bin/bash
   set -euo pipefail
   ISO="$1"; LOG="${2:-/tmp/qemu-boot.log}"
   timeout 300 qemu-system-x86_64 $KVM -m 2048 -cdrom "$ISO" \
     -boot d -display none -serial file:"$LOG" \
     -no-reboot
   grep -q "login:" "$LOG" && echo "SONUC: OK" || { echo "SONUC: HATA"; exit 1; }
   ```
3. **Kernel boot** (ISO'suz): `-kernel bzImage -initrd initrd.img -append "console=ttyS0"` —
   `console=ttyS0` **zorunlu**, yoksa seri log boş kalır.
4. **Headless erişim** gerekiyorsa `-nographic` + `Ctrl-a x` çıkış notu.
5. Betiği çalıştır, logu log_analyst'e devret (workflow: `boot_test` → `log_triage`).

## Çıktı
- `qemu-boot-test.sh` + `qemu-boot.log`
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
bash -n qemu-boot-test.sh            # zorunlu
qemu-system-x86_64 --version         # araç var mı
./qemu-boot-test.sh dist/x.iso; echo $?   # 0 = boot OK
```

## Sınırlar
- `-snapshot` kullan; test diske yazmasın.
- RAM 2048 altına düşme (live ISO için), timeout makul (300 sn).
- KVM yoksa `-accel tcg` ile yavaş ama çalışır modu seç.
