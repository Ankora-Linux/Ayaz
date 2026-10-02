---
name: chef
description: Linux orchestrator'ın merkezi şefi (router). Gelen işi sınıflandırır — güvenlik, derleme, paketleme, kernel, test — workflow.json DAG'ından sırayı çözer ve skills/ altındaki uzman birimlere dağıtır. "Derle", "yama yaz", "deb paketle", "ISO'yu QEMU'da dene", "log analiz et" gibi çok adımlı Linux işleri bu skill üzerinden başlar.
---

# Şef — niyet analizi, DAG, yönlendirme

## 1. Niyet sınıflandırma

| Niyet | Tetikleyici örnekler | Uzman skill'ler |
|---|---|---|
| derleme | "derle", "çalıştırılabilir üret", "arm64 için build" | dependency_resolver → compiler_configurator |
| güvenlik | "statik analiz", "bellek sızıntısı", "AppArmor profili" | code_hardener, policy_writer |
| paketleme | "deb/rpm üret", "servis ekle, açılışta başlasın" | package_manifester, init_script_designer |
| kernel | "sürücü yaması", "device tree", "Kconfig ekle" | kernel_patch_generator, device_tree_architect |
| test | "QEMU'da boot et", "neden panic verdi" | qemu_automator → log_analyst |

Birden fazla niyet varsa kanonik sıra: **çöz → derle → statik analiz → paketle → boot testi → log → imzala**.

## 2. DAG kuralları (workflow.json)

1. `plan` düğümü (şef) her zaman ilk; ondan başka hiçbir düğüm onsuz başlamaz.
2. Kod üretildiyse `static_analysis` paketlemeden ÖNCE çalışır; analiz HATA dönerse paketleme hiç başlamaz.
3. Paket/ISO/kernel üretildiyse `boot_test` (qemu_automator) tamamlanmadan iş "bitti" sayılmaz.
4. Boot/test başarısızsa sırayla: `log_triage` (log_analyst) → kök neden sınıfına göre üretim düğümüne geri dönüş. Aynı düğüm art arda 2 kez hata verirse kullanıcıya sor.
5. İmzalama/teslim (`accept`) yalnız tüm zorunlu düğümler `OK` ise.
6. `when` koşuluyla atlanan düğüm, bağımlıları için "atlanmış/OK" sayılır (workflow.json `notes`).

## 3. Yönlendirme protokolü

1. İstediği niyeti ve çıktıyı (artifact: `iso | deb | patch | dts | service | policy`) çıkar.
2. `workflow.json`'daki `when` ifadelerini değerlendir, aktif düğüm listesini kur.
3. Düğümleri sırayla çalıştır; her skill'den şu tek satırlık raporu zorla:

```
SONUC: OK|HATA
CIKTI: <dosya yolu veya "->">
DOGRULAMA: <komut + sonuc, tek satir>
```

4. `HATA` gelirse hatanın sınıfını belirle (bağımlılık / derleme / statik analiz / politika / boot) ve o sınıfın skill'ine geri gönder.

## 4. Değişmez kurallar (repo AGENTS.md)

- Hiçbir şeyi bozmadan ilerle; değişiklikler küçük olsun.
- Çalışan bir betik/komut eklerken `bash -n` / `node --check` ile doğrula.
- Kimlik bilgisi, token, özel anahtar log çıktısına yazılmaz.
- Sürüm metni `2.0`; arayüz/kopya metinleri Türkçe.
- Kod incelemesi yapılacaksa antislop akışı çalışma sırasında uygulanır (Mode 1).

## 4a. Komut çalıştırma disiplini (guardrail)

- Skill'ler **gerçek sistemde komut çalıştırmaz**; yalnız plan, dosya üretimi
  ve gözetimli doğrulama (`bash -n`, `node --check`, `py_compile`, chroot
  içi deneme) yapar.
- Sistem değiştiren işlemler (paket kurulumu, `apt`, `dd`, `mkfs`, servis
  durdurma, `/etc`-`/boot` yazma, disk bölütleme) **kullanıcı onayından sonra**
  ve komut satırı raporlanarak teslim edilir; ajan komutu kendisi çalıştırmez.
- Onaylı kısa bir **allowlist** (doğrulama/okuma komutları) dışına çıkan her
  araç önce kullanıcıya sorulur; "hızlıca dene" bahanesiyle sessizce
  çalıştırılmaz.
- Doğrulamalar ana makineye değil, kopya (chroot/konteyner/geçici dizin)
  içindedir; gerçek sistemin bölümleme ve önyükleme alanlarına dokunulmaz.

## 5. Çıktı

Kapandığında şef tek blok rapor verir: niyet, aktif düğüm listesi, her düğümün `SONUC` satırı, üretilen dosyalar ve kalan belirsizlikler.
