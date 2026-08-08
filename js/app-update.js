// ═══════════════════════════════════════════════════════════════
// APP-UPDATE.JS — Yenilənmə Sistemi (APK/WebView üçün)
// Serverdəki version.json ilə cari versiya müqayisə edilir. Yeni versiya
// varsa, login-dən sonra MƏCBURİ yenilənmə ekranı göstərilir (keçmək/ertələmək
// olmaz). Təsdiqləndikdə yeni versiyanın faylları CİHAZA REAL yüklənir
// (0-100% bayt progressi + fırlanan simvol), bitdikdə "Yenilənmə tamamlandı"
// göstərilir və "Başla" düyməsi tətbiqi yeni kodla yenidən işə salır.
// Qeyd: APK qabıqdır — dəyişən tətbiqin məzmunudur (serverdəki kod).
//
// v4.5 düzəlişləri:
//  1) Reload sonrası URL-də qalan keş-busting `?u=<rəqəm>` parametri dərhal
//     təmizlənir (adres çubuğunda rəqəmlər qalmır).
//  2) Progress REAL-dır: content-length məlum deyilsə bar ilk chunk-a görə
//     99%-ə SICRAMIR — ölçüsü naməlum fayllar fayl-vahidi ilə addımlanır.
//  3) "Yenilənmə tamamlandı" yalnız bütün fayllar endirilib yenilənmə
//     backend-ə QEYDƏ ALINDIQDAN SONRA göstərilir (arxa plan işi bitməmiş
//     vidget yekunlaşmır).
//  4) Cihaz növü (Mobil / Kompüter) Telegram bildirişinə əlavə olunur və
//     backend-ə göndərilir.
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  // ── Reload sonrası URL-dən keş-busting `u=` parametrini təmizlə ──
  // Update bitən kimi səhifə `?u=<timestamp>` ilə yenidən yüklənir (keşi
  // sıfırlamaq üçün). Parametrin işi o reload-la bitir — adresdə qalmamalıdır.
  try{
    if(location.search && /(^|[?&])u=\d+(&|$)/.test(location.search)){
      var _cleanUrl = location.pathname + location.hash;
      history.replaceState({ route: (location.hash || '').replace('#', '') || 'dashboard' }, '', _cleanUrl);
    }
  }catch(uErr){}

  var UPDATE_VERSION_KEY = 'app_version';
  var VERSION_URL = 'version.json';
  var OVERLAY_ID = 'appUpdateOverlay';

  var busy = false;

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
  // ƏSAS DÜZƏLİŞ: content-length məlum deyilsə `total` 0 ötürülür — ilk
  // chunk ölçüsü ümumi ölçü kimi UYDURULMUR (əvvəl bar dərhal ~99%-ə atılırdı).
  function streamFetch(url, onBytes){
    // cache:'reload' → real şəbəkə yüklənməsi (progress real baytdır) və
    // fayl brauzer keşinə yazılır ki, "Başla" reload-ində dərhal açılsın.
    return fetch(url, { cache: 'reload' }).then(function(res){
      if(!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      var total = parseInt(res.headers.get('content-length') || '0', 10) || 0;
      if(!res.body || !res.body.getReader){
        // WebView / köhnə brauzer: stream yoxdur — bütöv blob yüklənir.
        // Ölçü məlumdursa onu ötür, yoxsa 0 (fayl bitəndə 1 vahid sayılır).
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
  // Progress modeli (v4.5): məlum content-length → baytla REAL; ölçüsü
  // naməlum fayl → 1 vahid (fayl bitəndə addımlanır). Heç nə uydurulmur.
  function runUpdate(version){
    var urls = [];
    var filesDone = 0;            // bitmiş fayl sayı
    var currentUrl = '';          // hazırda yüklənən fayl
    var currentTotal = 0;         // hazırkı faylın məlum ölçüsü (0 = naməlum)
    var currentLoaded = 0;        // hazırkı fayldan yüklənən bayt
    var failStage = false;

    showStage('Yenilənmə yüklənir...', 'Fayllar yüklənir, zəhmət olmasa gözləyin.', '', false, true, true);
    setProgress(0, 'Hazırlanır...');

    // Progress per-fayl modeli (v4.5): ümumi % = (bitmiş fayllar + hazırkı
    // faylın daxilindəki real irəliləyiş) / fayl sayı. MONOTON — geriyə düşmür
    // (əvvəlki modeldə yeni böyük faylın ölçüsü əlavə olanda bar geriyə atılırdı).
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

    // Yenilənməni backend-ə bildirir — APP_UPDATES sheet-ə yazılır və
    // Database-LOG (CTECH) qrupuna canlı bildiriş göndərilir. Səssizdir.
    // PROMISE qaytarır ki, finish() reload-dan ƏVVƏL onu gözləyə bilsin.
    // (Əvvəl "Başla" klikində atılıb + dərhal reload edilirdi → WebView-də
    // gedən sorğu ləğv olunur, mobil-dən Telegram bildirişi çatmırdı.)
    function reportUpdateToBackend(version){
      var api = (typeof API_URL === 'string') ? API_URL : null;
      if(!api) return null;
      var payload = {
        action: 'logAppUpdate',
        version: String(version || ''),
        message: 'Cihaz yenilənməsi təsdiqləndi (v' + version + ')',
        device: detectDevice()
      };
      // İstifadəçi email-i sessiyadan; token-i core.js fetch wrapper-i avtomatik əlavə edir
      try{
        var s = JSON.parse(localStorage.getItem('ctech_session') || 'null');
        if(s && s.user && s.user.email) payload.userEmail = s.user.email;
      }catch(e){}
      try{
        return fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(function(){});
      }catch(fErr){
        return null;
      }
    }

    function finish(){
      try{ localStorage.setItem(UPDATE_VERSION_KEY, String(version)); }catch(e){}

      // Yenilənmə ARTIQ CİHAZDA TƏTBİQ OLUNUB (fayllar keşə yazılıb) — indi
      // backend qeydiyyatı göndərilir. Vidget yalnız bundan SONRA yekunlaşır.
      setProgress(100, '');
      showStage('Yenilənmə yekunlaşdırılır...', 'Yenilənmə qeydə alınır, zəhmət olmasa gözləyin.', '', false, true, false);

      var settled = false;
      function showDone(){
        if(settled) return;
        settled = true;
        showStage('Yenilənmə tamamlandı', 'Tətbiq yeniləndi. Yeni versiya ilə davam edin.', 'Başla', true, false, false);
        var btn = document.getElementById('updBtn');
        if(btn){
          btn.onclick = function(){
            lockBody(false);
            var o = overlayEl(); if(o) o.style.display = 'none';
            // Səhifəni keşsiz yenidən yüklə → sessiya qorunur, əsas menyu açılır.
            // URL-dəki `u=` parametri yüklənən kimi (bu faylın başında) təmizlənir.
            var sep = window.location.pathname.indexOf('?') === -1 ? '?' : '&';
            window.location.href = window.location.pathname + sep + 'u=' + Date.now();
          };
        }
      }

      var rep = null;
      try{ rep = reportUpdateToBackend(version); }catch(repErr){}
      if(rep && typeof rep.then === 'function'){
        rep.then(showDone, showDone);
      } else {
        showDone();
      }
      // Təhlükəsizlik: şəbəkə yavaş/bağlı olsa belə vidget ilişib qalmasın.
      // 8s — GAS ilk çağırışları (cold start) bəzən 2-6s çəkir.
      setTimeout(showDone, 8000);
    }

    function onBytes(url, recv, total){
      if(url !== currentUrl){
        // Yeni fayl başladı — hazırkı fayl göstəricilərini sıfırla
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
