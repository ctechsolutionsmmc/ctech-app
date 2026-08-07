# ctech-app

CTECH Service Platform — Bus/TVM texniki servis idarəetmə sistemi.

## Telegram hesabatları (Services-REPORT qrupuna avtomatik)

| Hesabat | Nə vaxt | Tarix aralığı | Funksiya |
|---|---|---|---|
| **BUS Gündəlik** | Hər səhər **09:00** | Dünən 08:00 → bu gün 08:00 | `sendBusDailyReport` |
| **BUS Həftəlik** | Hər **bazar ertəsi 09:10** | Əvvəlki təqvim həftəsi (BE 00:00 → Bazar 24:00) | `sendBusWeeklyReport` |
| **BUS Aylıq** | Hər **ayın 1-i 09:15** | Bitmiş təqvim ayı (01.XX → son gün, 31/30/28/29 avtomatik) | `sendBusMonthlyReport` |
| **TVM** | 09:05 | — | `sendTvmDailyReport` (növbəti mərhələdə əlavə olunacaq) |

- Məlumat **DASHBOARD_CACHE** keşindən oxunur — əsas database yüklənmir.
- Servis "Tarix" xanası + Başlanğıc/Bitiş saatları ilə (real təqvim + saat üzrə) hesablanır: **əsas meyar BİTİŞ saatıdır** — bitişi aralığa düşən "tamamlanmış" servislər daxil edilir (ikiqat sayılmır). Bitiş boşdursa, Başlanğıca baxılır.
- Gündəlikdə sərhəd saat **08:00**, həftəlik/aylıqda **00:00**-dır.

### Quraşdırma (bir dəfəlik)

1. **Şablonları əlavə et** — Apps Script redaktorunda ▶ Run edin:
   ```
   migrateTelegramTemplatesForDailyReports()
   ```
   `Telegram_Templates` sheet-ə `bus_daily_report`, `bus_weekly_report`, `bus_monthly_report` şablonlarını əlavə edir (mövcud redaktələrə toxunmur). Şablon mətni admin panel → **Telegram Templates** bölməsindən redaktə oluna bilər.

2. **Qrup chat ID-sini qeyd edin** — Script Properties → `TELEGRAM_REPORT_CHAT_ID` (Services-REPORT qrupunun chat id-si). Yoxdursa `TELEGRAM_CHAT_ID` işləyir.

3. **Trigger-ləri qur** — ▶ Run edin (icazə soruşacaq):
   ```
   setupDailyReportTriggers()
   ```
   (və ya yeni adla: `setupReportTriggers()`). Hamısını silmək üçün: `deleteDailyReportTriggers()` / `deleteReportTriggers()`.

4. **Test** — istənilən vaxt funksiyaları ▶ Run edərək dərhal göndərin: `sendBusDailyReport()`, `sendBusWeeklyReport()`, `sendBusMonthlyReport()`.

### Placeholder-lar (üç şablon da eyni dəst)

`{dateRange}` `{windowStart}` `{windowEnd}` `{totalCount}` `{validatorChanged}` `{samChanged}` `{ethernetCount}` `{rjCount}` `{topProblems}` `{topTechnicians}` `{topLeaders}` `{montajByCarrier}` `{demontajByCarrier}` `{distributionsByCarrier}` `{routeUpdateByCarrier}` `{topCarriers}` `{topAddresses}` `{ownerAyna}` `{ownerBakikart}` `{ownerBoth}`

Qeydlər:
- "Ən çox gələn problem" bölməsində sayı **2 və daha çox** olan müraciət növləri göstərilir (dəyişmək üçün `_buildBusReportData`-dakı `x.count >= 2` şərti).
- Texniklər həm "1. Texnik", həm də "2. Texnik" sahəsindən sayılır.
- Məhsul sahibi sayı "Problem Owner" sahəsindən: AYNA / BakıKart / hər ikisi.
- Hər siyahı maks. **20 sətir**; mesaj Telegram-ın 4096 simvol limitini aşsa 10 sətirə yığılır, qalanı "+N daha..." ilə göstərilir.
- Kateqoriya sayları əsasən "Qısa Həllər" sütunundan; köhnə sətirlərdə boşdursa "Həll" mətnindən.

## Yenilənmə sistemi (APK/WebView üçün)

Tətbiq WebView APK (qabıq) kimi quraşdırılır — kod telefonda saxlanmır, serverdən yüklənir. Buna görə APK-nın özü heç vaxt yenidən qurulmur; dəyişən **tətbiqin məzmunudur**.

### Necə işləyir

1. **`version.json`** — serverdəki cari versiya (məs. `4.1`) və qısa yenilənmə mesajı. Hər yayımlamada buradakı versiya nömrəsi artırılır.
2. **`js/app-update.js`** — istifadəçi login olduqda (və sessiya bərpa olunanda) `checkForAppUpdate()` çağırır:
   - Cihazdakı `app_version` dəyəri ilə `version.json`-dakı versiya müqayisə edilir.
   - Yeni versiya **varsa** → məcburi ekran çıxır (keçmək/ertələmək olmur): "Yenilənmə mövcuddur".
   - "Yenilənmələri təsdiqlə" düyməsi basılanda **real yüklənmə** başlayır: yeni `index.html` çəkilir, oradakı bütün css/js faylları **0–100% bayt progressi** və fırlanan simvolla cihaz keşinə yüklənir.
   - Bitdikdə "Yenilənmə tamamlandı" → **Başla** düyməsi tətbiqi yeni kodla yenidən işə salır (sessiya qorunur).

### Yeni versiya yayımlayanda (3 addım)

1. `index.html`-də bütün `?v=` versiya nömrələrini artırın (keş-busting).
2. `version.json`-da `version` nömrəsini artırın + mesajı yazın.
3. (Backend dəyişibsə) Apps Script-də **Dağıtımı yönet → Yeni sürüm** yaradın.

İlk açılışda sistem versiyanı səssizcə qeyd edir (ekran çıxmır); bundan sonra hər yeni versiya üçün ekran göstərilir.
