# AGENTS.md — Ayaz DE (Ankora Linux)

Bu depo, **Ayaz Desktop Environment**: Devuan tabanlı Ankora Linux için Tauri 1.5 + Rust + WebKitGTK üzerine kurulu, systemd yerine SysVinit kullanan hafif bir masaüstü ortamı. `.deb` paketi ve hibrit canlı ISO üretir.

Kaynak haritası:

| Dosya | İçerik |
|---|---|
| `src/index.html` | Masaüstü kabuğu, pencereler, başlat menüsü |
| `src/app.js` | Pencere yöneticisi, güncelleyici, XDG tarayıcı, AI ajanı |
| `src/style.css` | Monokrom cam tasarım sistemi + 3 tema |
| `src-tauri/src/main.rs` | Sistem telemetrisi, IPC, güncelleme motoru, güvenlik kalkanı |
| `scripts/*.sh` | ISO üretimi, şifresiz paket kurucu, sudoers |

Kurallar: hiçbir şeyi bozmadan ilerle, değişiklikleri küçük tut, çalışmayan bir komut/betik eklerken `bash -n` / `node --check` ile doğrula.

<!-- antislop:start -->
## antislop

Arayüz, metin, erişilebilirlik, mobil düzen veya kod yorumu işine başlaman gerekiyorsa önce `antislop.md` (çekirdek) oku, sonra işe uygun skill'e geç:

- UI / görsel (tasarım): `.agents/skills/antislop-ui/SKILL.md`
- Metin & kopya: `.agents/skills/antislop-copywriting/SKILL.md`
- İnsan & erişilebilirlik: `.agents/skills/antislop-human/SKILL.md`
- Mobil / duyarlı düzen: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Kod yorumları: `.agents/skills/antislop-code/SKILL.md`
- Çekirdek: `.agents/skills/antislop/SKILL.md`

Tasarım yönü: `DESIGN.md` yoksa yönü kullanıcıdan iste, sakin varsayılana düşme (R-37).

İş başlarken kullanıcıya sor: antislop **çalışma sırasında** mı uygulansın, **bittiğinden sonra** mı denetim (audit) yapılsın?

<!-- antislop:end -->

<!-- ai-humanizm:start -->
## ai-humanizm

Yazılan her metin, kod yorumu ve arayüz metni için `.agents/skills/ai-humanizm/SKILL.md` kurallarını uygula.

Özet: zorlama üçlü ("hızlı, güvenli ve modern"), sahte giriş övgüleri ("harika bir soru!"), mekanik zıtlıklar, dolgu sözcükleri, başlıklara döşenmiş klişe emoji (`🚀` `💡` `⚡` `🎯`) ve "Bu fonksiyon iki sayıyı toplar" tarzı anlamsız kod yorumları yasak. Hitap samimi ise samimi kal, boş laf kalabalığı yapma.

<!-- ai-humanizm:end -->
