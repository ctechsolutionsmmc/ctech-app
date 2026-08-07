# ctech-app

CTECH Service Platform — Bus/TVM texniki servis idarəetmə sistemi.

## Gündəlik 24 saatlıq Telegram hesabatları

Hər səhər **Services-REPORT (CETCH)** Telegram qrupuna avtomatik analitik hesabat göndərilir:

- **09:00 — BUS** (`sendBusDailyReport`)
- **09:05 — TVM** (`sendTvmDailyReport` — növbəti mərhələdə əlavə olunacaq)

Hesabat pəncərəsi: **dünən 08:00 → bu gün 08:00** (Bakı vaxtı). Servis "Tarix" xanası ilə Başlanğıc/Bitiş saatları birləşdirilərək (real təqvim + saat üzrə) hesablanır: **əsas meyar BİTİŞ saatıdır** — bitişi pəncərəyə düşən "tamamlanmış" servislər daxil edilir (bununla hesabat iki günə ikiqat sayılmır). Bitiş saatı boşdursa, Başlanğıc saatına baxılır. Məlumat **DASHBOARD_CACHE** keşindən oxunur — əsas database yüklənmir.

### Quraşdırma (bir dəfəlik)

1. **Şablonu əlavə et** — Apps Script redaktorunda bu funksiyanı ▶ Run edin:
   ```
   migrateTelegramTemplatesForDailyReports()
   ```
   Bu, `Telegram_Templates` sheet-ə `bus_daily_report` şablonunu əlavə edir (mövcud redaktələrə toxunmur). Şablon mətni admin panel → **Telegram Templates** bölməsindən redaktə oluna bilər.

2. **Qrup chat ID-sini qeyd edin** — Script Properties → `TELEGRAM_REPORT_CHAT_ID` (Services-REPORT qrupunun chat id-si). Yoxdursa `TELEGRAM_CHAT_ID` işləyir.

3. **Trigger-i qur** — bu funksiyanı ▶ Run edin (icazə soruşacaq):
   ```
   setupDailyReportTriggers()
   ```
   BUS trigger-i hər gün 09:00 (Asia/Baku) qurulur. Silmək üçün: `deleteDailyReportTriggers()`.

4. **Test** — istənilən vaxt `sendBusDailyReport()` funksiyasını ▶ Run edərək hesabatı dərhal göndərin (pəncərə yenə dünən 08:00 → bu gün 08:00 hesablanır).

### Placeholder-lar (`bus_daily_report`)

`{dateRange}` `{windowStart}` `{windowEnd}` `{totalCount}` `{validatorChanged}` `{samChanged}` `{ethernetCount}` `{rjCount}` `{topProblems}` `{topTechnicians}` `{topLeaders}` `{montajByCarrier}` `{demontajByCarrier}` `{distributionsByCarrier}` `{routeUpdateByCarrier}` `{topCarriers}` `{topAddresses}`

Qeydlər:
- "Ən çox gələn problem" bölməsində sayı **2 və daha çox** olan müraciət növləri göstərilir (dəyişmək istəsəniz `_buildBusDailyReportData`-dakı `x.count >= 2` şərtinə baxın).
- Texniklər həm "1. Texnik", həm də "2. Texnik" sahəsindən sayılır.
- Hər siyahı (texnik, daşıyıcı, ünvan və s.) maks. **20 sətir** göstərilir; mesaj Telegram-ın 4096 simvol limitini aşarsa 10 sətirə qədər yığılır və qalanı "+N daha..." ilə göstərilir.
- Kateqoriya sayları əsasən "Qısa Həllər" (servis kateqoriyası) sütunundan hesablanır; köhnə sətirlərdə o boşdursa "Həll" mətninə baxılır.
