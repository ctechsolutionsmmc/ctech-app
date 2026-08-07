// ═══════════════════════════════════════════════════════════════
// APP-UPDATE.JS — Yenilənmə Sistemi (APK/WebView üçün)
// Serverdəki version.json ilə cari versiya müqayisə edilir. Yeni versiya
// varsa, login-dən sonra MƏCBURİ yenilənmə ekranı göstərilir (keçmək/ertələmək
// olmaz). Təsdiqləndikdə yeni versiyanın faylları CİHAZA REAL yüklənir
// (0-100% bayt progressi + fırlanan simvol), bitdikdə "Yenilənmə tamamlandı"
// göstərilir və "Başla" düyməsi tətbiqi yeni kodla yenidən işə salır.
// Qeyd: APK qabıqdır — dəyişən tətbiqin məzmunudur (serverdəki kod).
// ═══════════════════════════════════════════════════════════════

(function(){
  'use strict';

  var UPDATE_VERSION_KEY = 'app_version';
  var VERSION_URL = 'version.json';
  var OVERLAY_ID = 'appUpdateOverlay';

  var busy = false;

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

  // ── Faylı stream ilə yüklə, progress callback-i real baytla çağır ──
  function streamFetch(url, onBytes){
    // cache:'reload' → real şəbəkə yüklənməsi (progress real baytdır) və
    // fayl brauzer keşinə yazılır ki, "Başla" reload-ində dərhal açılsın.
    return fetch(url, { cache: 'reload' }).then(function(res){
      if(!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      var total = parseInt(res.headers.get('content-length') || '0', 10) || 0;
      if(!res.body || !res.body.getReader){
        return res.blob().then(function(blob){ onBytes(blob.size, total || blob.size); });
      }
      var reader = res.body.getReader();
      var recv = 0;
      function pump(){
        return reader.read().then(function(r){
          if(r.done) return;
          recv += (r.value && r.value.byteLength) || 0;
          onBytes(recv, total || recv);
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

  // ── Əsas yenilənmə axını ──
  // Fayllar ardıcıl yüklənir; ümumi % = yüklənmiş bayt / ümumi bayt (real).
  function runUpdate(version){
    var urls = [];
    var fileInfo = {};     // url → { total, loaded }
    var totalBytes = 0;    // məlum content-length cəmi (+ naməlumlar bitdikcə)
    var loadedBytes = 0;
    var filesDone = 0;
    var failStage = false;

    showStage('Yenilənmə yüklənir...', 'Fayllar yüklənir, zəhmət olmasa gözləyin.', '', false, true, true);
    setProgress(0, 'Hazırlanır...');

    function overallPct(){
      if(totalBytes > 0) return Math.min(99, (loadedBytes / totalBytes) * 100);
      if(urls.length > 0) return Math.min(99, (filesDone / urls.length) * 100);
      return 0;
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
      try{ localStorage.setItem(UPDATE_VERSION_KEY, String(version)); }catch(e){}
      setProgress(100, '');
      showStage('Yenilənmə tamamlandı', 'Tətbiq yeniləndi. Yeni versiya ilə davam edin.', 'Başla', true, false, false);
      var btn = document.getElementById('updBtn');
      if(btn){
        btn.onclick = function(){
          lockBody(false);
          var o = overlayEl(); if(o) o.style.display = 'none';
          // Səhifəni keşsiz yenidən yüklə → sessiya qorunur, əsas menyu açılır
          var sep = window.location.pathname.indexOf('?') === -1 ? '?' : '&';
          window.location.href = window.location.pathname + sep + 'u=' + Date.now();
        };
      }
    }

    function onBytes(url, recv, total){
      var info = fileInfo[url] || (fileInfo[url] = { total: 0, loaded: 0 });
      if(!info.total && total > 0){ info.total = total; totalBytes += total; }
      if(recv > info.loaded){
        loadedBytes += recv - info.loaded;
        info.loaded = recv;
      }
      setProgress(overallPct(), url.split('/').pop().split('?')[0]);
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
              var info = fileInfo[url];
              if(info && !info.total){ info.total = info.loaded; totalBytes += info.loaded; }
              setProgress(overallPct(), url.split('/').pop().split('?')[0]);
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
