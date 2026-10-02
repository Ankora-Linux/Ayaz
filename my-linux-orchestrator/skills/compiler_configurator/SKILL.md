---
name: compiler_configurator
description: Hedef mimariye (x86_64, arm64, riscv64) göre Makefile, CMakeLists.txt veya Yocto recipe hazırlar ve derlemeyi yürütür. "Şu proje için build dosyası yaz", "arm64 için derle", "cross-compile kur" taleplerinde kullan.
---

# Compiler-Configurator — derleme ayarlayıcı

## Ne yapar
Kaynak ağacına hedefe uygun derleme sistemi kurar (Makefile / CMake / Yocto), derler, çıktıyı ve derleme logunu raporlar.

## Girdi
- Kaynak dizini ve hedef mimari (`x86_64 | arm64 | riscv64`)
- Seçili ise toolchain yolu (varsayılan: sistem `gcc`/`clang`)

## Adımlar
1. Mevcut durumu tara — var olan build dosyasını **ezme**, gerekirse genişlet:
   `ls Makefile CMakeLists.txt meson.build configure.ac 2>/dev/null`
2. Derleyici kapasitesini yazdır (toolchain raporu):
   `gcc -dumpmachine; gcc -dumpfullversion; ld --version | head -1`
3. Derleme sistemi seç:
   - **Make**: şablon hedefler (`all`, `clean`, `install PREFIX=...`), `CFLAGS += -Wall -Wextra -Werror`.
   - **CMake**: `cmake -S . -B build -DCMAKE_BUILD_TYPE=Release` + opsiyonel
     `cmake -DCMAKE_TOOLCHAIN_FILE=toolchain-<arch>.cmake`.
   - **Cross** (farklı mimari): `aarch64-linux-gnu-gcc` gibi öneki algıla,
     `PKG_CONFIG_LIBDIR` ve `--sysroot` ayarla.
   - **Yocto**: recipe + `.bbappend`; `bitbake -e <recipe> | grep ^CC` ile doğrula.
4. Derle: önce `make -n` / `ninja -n` (kuru çalıştırma), sonra gerçek derleme.

## Çıktı
- Derleme dosyaları + `build/` altında log (`build.log`)
- `SONUC / CIKTI / DOGRULAMA` tek satır raporu (şef formatı)

## Doğrulama
```bash
make -n >/dev/null            # sözdizimi; Makefile için
cmake -S . -B build >/dev/null 2>&1
./build/<binary> --version || true
```

## Sınırlar
- Toolchain paketleri yoksa **kurulum yapmadan önce** dependency_resolver'a git.
- Uyarısız derleme hedeftir (`-Wall -Wextra`); uyarılar code_hardener'a devredilir.
- Repo betikleri için: `bash -n` / `node --check` zorunlu.
