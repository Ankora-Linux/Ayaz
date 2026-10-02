---
name: code_hardener
description: C/C++ kodunu statik analize sokar — bellek sızıntısı (memory leak), buffer overflow, use-after-free risklerini bulur, kodu düzeltir ve tekrar denetler. "kodu sertleştir", "statik analiz çalıştır", "sızıntı var mı bak" taleplerinde kullan.
---

# Code-Hardener — kod sertleştirici

## Ne yapar
Derleyici/analiz araçlarıyla kodu tarar, bulguları satır bazında raporlar, **kodu düzeltir** ve temiz çıktıyı kanıtlayacak şekilde yeniden çalıştırır.

## Girdi
- Kaynak dizini + derleme komutu (varsa `compile_commands.json`)

## Adımlar
1. **Derleyici analizi** (en hızlı geri bildirim):
   `gcc -fanalyzer -Wall -Wextra -c <dosya>.c`  (veya `make CFLAGS="-fanalyzer -Wall -Wextra"`)
2. **Cppcheck**: `cppcheck --enable=all --std=c11 --suppress=missingIncludeSystem .`
3. **Clang**: `clang --analyze *.c` (`.plist` rapor) / `scan-build make`
4. **Çalışma zamanı** (özellikle bellek işleri):
   ```bash
   gcc -fsanitize=address,undefined -g -O1 -o app app.c
   ASAN_OPTIONS=detect_leaks=1 ./app
   valgrind --leak-check=full --error-exitcode=1 ./app
   ```
5. **Düzeltme desenleri**: buffer → `snprintf`/`strlcpy`; tahsis → çıkış yolunda
   `free` (tek `goto cleanup`); tamsayı → taşma kontrollü (`checked` ailesi);
   hata yolu → return değeri kontrolü.
6. Aynı analizi yeniden çalıştır; **0 hata / 0 uyarı** hedefi.

## Çıktı
- Düzeltilmiş kaynak + `analysis.log` (önce/sonra sayıları)
- `SONUC / CIKTI / DOGRULAMA` raporu

## Doğrulama
```bash
gcc -fanalyzer -Wall -Wextra -Werror -c *.c     # çıkış 0
valgrind --error-exitcode=1 ./app                # çıkış 0
```

## Sınırlar
- Düzenleme kapsamı dar tut: bulguyu ve düzeltmeyi aynı dosyada, en küçük diff.
- Üçüncü parti dizinleri (`vendor/`, `*.d`) analize sokma.
- Yanlış pozitif bastırırken (`#pragma`, suppress) gerekçeyi satır üstü yorumda yaz.
