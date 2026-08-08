// ═══════════════════════════════════════════════════════════════
// APP-UPDATE.JS — Yenilənmə Sistemi (APK/WebView üçün)
// Serverdəki version.json ilə cari versiya müqayisə edilir. Yeni versiya
// varsa, login-dən sonra MƏCBURİ yenilənmə ekranı göstərilir (keçmək/ertələmək
// olmaz). Təsdiqləndikdə yeni versiyanın faylları CİHAZA REAL yüklənir
// (0-100% bayt progressi + fırlanan simvol), bitdikdə "Yenilənmə tamamlandı"
// göstərilir və "Başla" düyməsi tətbiqi yeni kodla yenidən işə salır.
// Qeyd: APK qabıqdır — dəyişən tətbiqin məzmunudur (serverdəki kod).
//
// v4.6 — Yenilənmə bildirişi (Telegram) RELOAD-DAN SONRA göndərilir:
//   Əvvəlki versiyalar "Başla" klikində fetch-i atıb DƏRHAL səhifəni yenidən
//   yükləyirdi → WebView-də gedən sorğu ləğv olunur, mobil-dən Telegram
//   bildirişi çatmırdı (desktop-da təsadüfən çatırdı). İndi:
//     • finish() cihazda tətbiq bitən kimi "Yenilənmə tamamlandı" göstərir və
//       "Başla" reload-ində ?u=<vaxt> parametri + gözləyən-qeyd bayrağı qoyur.
//     • Səhifə reload olunanda (DOMContentLoaded — bütün scriptlər hazır)
//       qeydiyyat göndərilir: sorğu heç bir naviqasiya ilə ləğv OLUNMUR,
//       token bitmiş olsa belə (raw fetch) mütləq çatır.
//   Digər düzəlişlər: URL-dən ?u= təmizlənir; progress realdır (per-fayl);
//   cihaz növü (Mobil/Kompüter) qeydiyyata əlavə olunur.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  var UPDATE_VERSION_KEY = 'app_version';
  var VERSION_URL = 'version.json';
  var OVERLAY_ID = 'appUpdateOverlay';
  var PENDING_REPORT_KEY = 'ctech_pending_update_report';

  var busy = false;
  var _reportInFlight = false;

  // ── Reload sonrası (u= ilə gələn səhifə): qeydiyyatı göndər + URL-i təmizlə ──
  try{
    if(location.search && /(^|[?&])u=\d+(&|$)/.test(location.search)){
      // Səhifə TAM yüklənəndən sonra (bütün defer scriptlər + DOMContentLoaded)
      // göndərilir — API_URL və core.js-in orijinal fetch-i hazır olur.
      // Bu sorğu heç bir reload/naviqasiya ilə LƏĞV OLUNMUR.
      document.addEventListener('DOMContentLoaded', flushPendingReport);

      // Adres çubuğundan keş-busting parametrini sil (işi o reload-la bitdi)
      var _cleanUrl = location.pathname + location.hash;
      history.replaceState({ route: (location.hash || '').replace('#', '') || 'dashboard' }, '', _cleanUrl);
    }
  }catch(uErr){}

  function clearPendingReport(){
    try{ localStorage.removeItem(PENDING_REPORT_KEY); }catch(e){}
  }

  // Gözləyən qeydiyyat varsa göndər. UĞURSUZ olarsa bayraq qalır → növbəti
  // açılışda (checkForAppUpdate) avtomatik TƏKRAR cəhd edilir — bildiriş itməz.
  function flushPendingReport(){
    if(_reportInFlight) return;
    var ver = '';
    try{ ver = localStorage.getItem(PENDING_REPORT_KEY) || ''; }catch(e){}
    if(!ver) return;
    _reportInFlight = true;
    var p = null;
    try{ p = reportUpdateToBackend(ver); }catch(repErr){}
    if(p && typeof p.then === 'function'){
      p.then(function(){ _reportInFlight = false; clearPendingReport(); },
             function(){ _reportInFlight = false; }); // uğursuz → bayraq qalır, təkrar
    } else {
      _reportInFlight = false;
      clearPendingReport();
    }
  }

  // ── Cihaz təyini: mobil vs masaüstü (Telegram bildirişi üçün) ──
  function detectDevice(){
    var ua = navigator.userAgent || '';
    var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)
      || (navigator.maxTouchPoints > 1 && window.innerWidth < 901);
    if(isMobile){
      if(/Android/i.test(ua)) return 'Mobil (Android) 📱';
      if(/iPhone|iPad|iPod/i.test(ua)) return 'Mobil (iOS) 📱';
      return 'Mobil cihaz 📱';
    }
    return 'Kompüter/Brauzer 💻';
  }

  // ── Yenilənməni backend-ə bildirir (APP_UPDATES + Database-LOG Telegram) ──
  // IIFE səviyyəsindədir ki, həm reload-time qeydiyyat, həm (gələcəkdə) başqa
  // nöqtələr çağıra bilsin. Token olmadan da işləyir (backend legacy yolu) —
  // mobil WebView-də sessiya tokeni bitmiş olsa belə bildiriş MÜTLƏQ çatsın.
  function reportUpdateToBackend(version){
    var api = (typeof API_URL === 'string') ? API_URL : null;
    if(!api) return null;
    var payload = {
      action: 'logAppUpdate',
      version: String(version || ''),
      message: 'Cihaz yenilənməsi təsdiqləndi (v' + version + ')',
      device: detectDevice()
    };
    // İstifadəçi email-i sessiyadan
    try{
      var s = JSON.parse(localStorage.getItem('ctech_session') || 'null');
      if(s && s.user && s.user.email) payload.userEmail = s.user.email;
    }catch(e){}
    // core.js-in bükülməmiş ORİJİNAL fetch-i (mövcuddursa) — token-ə etibar etmə
    var rawFetch = (typeof window._coreFetch === 'function') ? window._coreFetch : window.fetch.bind(window);
    try{
      return rawFetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function(res){
        // HTTP xətası (4xx/5xx) da UĞURSUZ sayılır → reject edirik ki, gözləyən
        // bayraq qalsın və növbəti açılışda bildiriş TƏKRAR göndərilsin.
        // (Əvvəl .catch(function(){}) hər şeyi udurdu → retry heç işləmirdi.)
        if(!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
        return res;
      });
    }catch(fErr){
      return null;
    }
  }

  // ── Versiya müqayisəsi: "4.1" vs "4.0.3" → 1 / 0 / -1 ──
  function cmpVer(a, b){
    var pa = String(a || '').split('.').map(Number);
    var pb = String(b || '').split('.').map(Number);
    for(var i = 0; i < Math.max(pa.length, pb.length); i++){
      var x = pa[i] || 0, y = pb[i] || 0;
      if(x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  // ── Yüklənən index.html-dən bütün css/js asset URL-lərini çıxar ──
  function extractAssets(html){
    var urls = [];
    var seen = {};
    var re = /(?:src|href)="([^"]+\.(?:js|css)[^"]*)"/g, m;
    while((m = re.exec(html))){
      var u = m[1];
      if(!seen[u]){ seen[u] = 1; urls.push(u); }
    }
    var mm = html.match(/<link[^>]+rel="manifest"[^>]+href="([^"]+)"/i);
    if(mm && !seen[mm[1]]) urls.push(mm[1]);
    return urls;
  }

  // ── Faylı stream ilə yüklə, progress callback-i REAL baytla çağır ──
  // content-length məlum deyilsə `total` 0 ötürülür — bar fayl-vahidi ilə addımlanır.
  function streamFetch(url, onBytes){
    // cache:'reload' → real şəbəkə yüklənməsi (progress real baytdır) və
    // fayl brauzer keşinə yazılır ki, "Başla" reload-ində dərhal açılsın.
    return fetch(url, { cache: 'reload' }).then(function(res){
      if(!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      var total = parseInt(res.headers.get('content-length') || '0', 10) || 0;
      if(!res.body || !res.body.getReader){
        // WebView / köhnə brauzer: stream yoxdur — bütöv blob yüklənir.
        return res.blob().then(function(blob){ onBytes(blob.size, total); });
      }
      var reader = res.body.getReader();
      var recv = 0;
      function pump(){
        return reader.read().then(function(r){
          if(r.done) return;
          recv += (r.value && r.value.byteLength) || 0;
          onBytes(recv, total);
          return pump();
        });
      }
      return pump();
    });
  }

  // ── Overlay HTML ──
  function buildOverlay(){
    var el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'upd-overlay';
    el.setAttribute('role', 'dialog');
    el.innerHTML =
      '<div class="upd-card">'
      + '<div class="upd-brand">CTECH <span>SOLUTIONS</span></div>'
      + '<div class="upd-icon" id="updIcon">'
      +   '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>'
      + '</div>'
      + '<div class="upd-title" id="updTitle">Yenilənmə mövcuddur</div>'
      + '<div class="upd-sub" id="updSub"></div>'
      + '<div class="upd-spin-wrap" id="updSpinWrap" style="display:none;">'
      +   '<div class="upd-spin"></div>'
      + '</div>'
      + '<div class="upd-progress-wrap" id="updProgressWrap" style="display:none;">'
      +   '<div class="upd-bar"><div class="upd-bar-fill" id="updBarFill"></div></div>'
      +   '<div class="upd-meta"><span class="upd-pct" id="updPct">0%</span><span class="upd-file" id="updFile"></span></div>'
      + '</div>'
      + '<button class="upd-btn" id="updBtn" type="button">Yenilənmələri təsdiqlə</button>'
      + '</div>';
    document.body.appendChild(el);
  }

  function overlayEl(){ return document.getElementById(OVERLAY_ID); }
  function setText(id, txt){ var e = document.getElementById(id); if(e) e.textContent = txt; }
  function setDisplay(id, v){ var e = document.getElementById(id); if(e) e.style.display = v; }

  function lockBody(lock){
    document.body.style.overflow = lock ? 'hidden' : '';
    if(lock){
      document.documentElement.classList.add('upd-open');
    } else {
      document.documentElement.classList.remove('upd-open');
    }
  }

  function showStage(title, sub, btnLabel, btnVisible, progressVisible, spinVisible){
    setText('updTitle', title);
    setText('updSub', sub || '');
    setDisplay('updProgressWrap', progressVisible ? 'flex' : 'none');
    setDisplay('updSpinWrap', spinVisible ? 'flex' : 'none');
    var btn = document.getElementById('updBtn');
    if(btn){
      btn.style.display = btnVisible ? '' : 'none';
      btn.textContent = btnLabel;
    }
    lockBody(true);
  }

  function setProgress(pct, fileText){
    var fill = document.getElementById('updBarFill');
    if(fill) fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    setText('updPct', Math.round(pct) + '%');
    setText('updFile', fileText || '');
  }

  function fileLabel(url){
    return String(url || '').split('/').pop().split('?')[0];
  }

  // ── Əsas yenilənmə axını ──
  // Progress per-fayl modeli: ümumi % = (bitmiş fayllar + hazırkı faylın daxilindəki
  // real irəliləyiş) / fayl sayı. MONOTON — geriyə düşmür, heç nə uydurulmur.
  function runUpdate(version){
    var urls = [];
    var filesDone = 0;
    var currentUrl = '';
    var currentTotal = 0;
    var currentLoaded = 0;
    var failStage = false;

    showStage('Yenilənmə yüklənir...', 'Fayllar yüklənir, zəhmət olmasa gözləyin.', '', false, true, true);
    setProgress(0, 'Hazırlanır...');

    function overallPct(){
      var n = urls.length;
      if(n <= 0) return 0;
      var within = 0;
      if(currentTotal > 0) within = Math.min(1, currentLoaded / currentTotal);
      return Math.min(99, ((filesDone + within) / n) * 100);
    }

    function fail(err){
      if(failStage) return;
      failStage = true;
      setProgress(0, '');
      showStage('Yenilənmə yüklənmədi',
        'Şəbəkə problemi: ' + String((err && err.message) || 'naməlum xəta') + '\n\nZəhmət olmasa yenidən cəhd edin.',
        'Yenidən cəhd et', true, false, false);
      var btn = document.getElementById('updBtn');
      if(btn) btn.onclick = function(){ failStage = false; runUpdate(version); };
    }

    function finish(){
      // Yenilənmə ARTIQ CİHAZDA TƏTBİQ OLUNUB (fayllar keşə yazıldı).
      try{ localStorage.setItem(UPDATE_VERSION_KEY, String(version)); }catch(e){}
      // Backend qeydiyyatı üçün "gözləyən" bayraq — reload-dan SONRA göndəriləcək
      // (bu səhifədə göndərsək, "Başla" reload-i WebView-də sorğunu ləğv edə bilər).
      try{ localStorage.setItem(PENDING_REPORT_KEY, String(version)); }catch(e){}

      setProgress(100, '');
      showStage('Yenilənmə tamamlandı', 'Tətbiq yeniləndi. Yeni versiya ilə davam edin.', 'Başla', true, false, false);
      var btn = document.getElementById('updBtn');
      if(btn){
        btn.onclick = function(){
          lockBody(false);
          var o = overlayEl(); if(o) o.style.display = 'none';
          // Səhifəni keşsiz yenidən yüklə → sessiya qorunur, əsas menyu açılır.
          // ?u= parametri yüklənən kimi (bu faylın başında) qeydiyyatı göndərib təmizlənir.
          var sep = window.location.pathname.indexOf('?') === -1 ? '?' : '&';
          window.location.href = window.location.pathname + sep + 'u=' + Date.now();
        };
      }
    }

    function onBytes(url, recv, total){
      if(url !== currentUrl){
        currentUrl = url;
        currentTotal = 0;
        currentLoaded = 0;
      }
      if(!currentTotal && total > 0) currentTotal = total;
      if(recv > currentLoaded) currentLoaded = recv;
      setProgress(overallPct(), fileLabel(url));
    }

    // index.html-in YENİ versiyasını çək → asset siyahısını çıxar → hamısını yüklə
    fetch('index.html', { cache: 'no-store' })
      .then(function(r){
        if(!r.ok) throw new Error('index.html → HTTP ' + r.status);
        return r.text();
      })
      .then(function(html){
        urls = extractAssets(html);
        if(urls.length === 0) throw new Error('Yenilənəcək fayl tapılmadı');
        urls.push('version.json');
        var i = 0;
        function next(){
          if(i >= urls.length){ finish(); return; }
          var url = urls[i++];
          setText('updFile', 'Fayl ' + i + ' / ' + urls.length);
          streamFetch(url, function(recv, total){ onBytes(url, recv, total); })
            .then(function(){
              filesDone++;
              setProgress(overallPct(), fileLabel(url));
              next();
            })
            .catch(fail);
        }
        next();
      })
      .catch(fail);
  }

  // ── Giriş: versiyanı yoxla ──
  window.checkForAppUpdate = function(){
    // Əvvəlki yenilənmənin bildirişi çatmayıbsa (uğursuzluq) — bu açılışda təkrar cəhd
    flushPendingReport();
    if(busy) return;
    busy = true;
    fetch(VERSION_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function(r){
        if(!r.ok) throw new Error('version.json tapılmadı');
        return r.json();
      })
      .then(function(d){
        busy = false;
        var serverVer = String((d && d.version) || '').trim();
        if(!serverVer) return;
        var local = '';
        try{ local = String(localStorage.getItem(UPDATE_VERSION_KEY) || '').trim(); }catch(e){}
        // İlk işləmə — səssiz qeyd et, yenilənmə ekranı GÖSTƏRMƏ
        if(!local){
          try{ localStorage.setItem(UPDATE_VERSION_KEY, serverVer); }catch(e){}
          return;
        }
        if(cmpVer(serverVer, local) <= 0) return; // yeni versiya yoxdur

        // YENİ VERSİYA VAR → məcburi ekran
        if(!overlayEl()) buildOverlay();
        var msg = (d.message || ('Yeni versiya: v' + serverVer));
        showStage('Yenilənmə mövcuddur',
          'Yeni versiya: v' + serverVer + '\n\n' + msg + '\n\nYenilənməni təsdiqlədikdən sonra tətbiq tam yenilənəcək.',
          'Yenilənmələri təsdiqlə', true, false, false);
        var btn = document.getElementById('updBtn');
        if(btn) btn.onclick = function(){ runUpdate(serverVer); };
      })
      .catch(function(){ busy = false; }); // version.json yoxdursa / offline → sakitcə keç
  };
})();
