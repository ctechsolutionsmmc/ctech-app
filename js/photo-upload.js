// ═══════════════════════════════════════════════════════════════
// PHOTO-UPLOAD.JS — Servis Fotoları (v4.16)
// Bus/TVM servis forma view-larında foto seçimi:
//   • canvas sıxışdırma (maksimum 1024px, WebP 0.6 / JPEG fallback) — kiçik + sürətli
//   • fotolar submit payload-dan AYRI, OK-dan sonra enqueueTicketPhotos
//     action-ı ilə göndərilir (submit sürətli qalır)
//   • İTLİK QORUMASI: fotolar göndərmədən ƏVVƏL localStorage-da saxlanır;
//     app bağlansa / internet kəsilsə belə növbəti açılışda avtomatik təkrar göndərilir
//     (idempotent batch — dublikat yaranmır)
//   • hər fotonun üzərində X işarəsi ilə silmə
// Ticket detail view (Real-Time Report + Davam edən servis):
//   • "Servis Fotoları" bölməsi — thumbnail grid, klik → lightbox
//   • Ticket BAĞLI deyilsə X ilə silmə, bağlıdırsa yalnız oxuma
// Mövcud heç bir komponentə zərər vermir — yalnız əlavə edir.
// ═══════════════════════════════════════════════════════════════

var PHOTO_STATE = { bus: [], tvm: [] };
var PHOTO_MAX = { bus: 4, tvm: 3 };
var PHOTO_COMPRESS_MAX = 1024;    // px — ən uzun tərəf (cihaz ekranındakı yazı üçün yetərli)
var PHOTO_COMPRESS_QUALITY = 0.6; // sıxışdırma keyfiyyəti (WebP/JPEG)
var PHOTO_USE_WEBP = true;        // WebP dəstəklənirsə istifadə et (~30-40% kiçik → sürətli)

// ── Görünürlük qaydaları ──
// Desktop: bütün rollar üçün görünür. Mobil: yalnız texnik.
function photoSectionVisible(which){
  var lvl = getAccessLevel(currentUser ? currentUser.role : '');
  if(window.innerWidth >= 901) return true;
  return lvl === 'technician';
}

// Mobil Bus formasında texnik üçün minimum 1 foto MƏCBURİDİR.
function photoSectionRequired(which){
  var lvl = getAccessLevel(currentUser ? currentUser.role : '');
  if(window.innerWidth >= 901) return false;
  return (which === 'bus') && lvl === 'technician';
}

// Hər forma açılışında / viewport dəyişəndə bölmələrin görünürlüyünü təzələ
function updatePhotoSections(){
  var secs = { bus: 'bsPhotoSection', tvm: 'tvmPhotoSection' };
  Object.keys(secs).forEach(function(k){
    var el = document.getElementById(secs[k]);
    if(!el) return;
    el.style.display = photoSectionVisible(k) ? 'block' : 'none';
    var hint = el.querySelector('.svc-photo-hint');
    if(hint){
      hint.textContent = photoSectionRequired(k)
        ? 'Məcburi — ən azı 1 foto (maksimum ' + PHOTO_MAX[k] + ')'
        : 'Maksimum ' + PHOTO_MAX[k] + ' foto (könüllü)';
    }
  });
  renderPhotoGrid('bus');
  renderPhotoGrid('tvm');
}

function clearPhotos(which){
  PHOTO_STATE[which] = [];
  var grid = document.getElementById(which === 'bus' ? 'bsPhotoGrid' : 'tvmPhotoGrid');
  if(grid) grid.innerHTML = '';
  var err = document.getElementById(which === 'bus' ? 'bsPhotoError' : 'tvmPhotoError');
  if(err) err.style.display = 'none';
}

function triggerPhotoInput(which){
  var input = document.getElementById(which === 'bus' ? 'bsPhotoInput' : 'tvmPhotoInput');
  if(!input) return;
  input.value = '';
  input.click();
}

function onPhotoInputChange(which, inputEl){
  var files = inputEl.files || [];
  if(!files.length) return;
  var max = PHOTO_MAX[which];
  var remaining = max - PHOTO_STATE[which].length;
  if(remaining <= 0){
    alert('Maksimum ' + max + ' foto seçə bilərsiniz');
    return;
  }
  var toProcess = Array.prototype.slice.call(files).slice(0, remaining);
  var done = 0;
  toProcess.forEach(function(file){
    compressImage(file, function(dataUrl){
      if(dataUrl && PHOTO_STATE[which].length < max){
        PHOTO_STATE[which].push(dataUrl);
      }
      done++;
      if(done === toProcess.length){
        renderPhotoGrid(which);
        var err = document.getElementById(which === 'bus' ? 'bsPhotoError' : 'tvmPhotoError');
        if(err) err.style.display = 'none';
      }
    });
  });
  inputEl.value = '';
}

// Canvas sıxışdırma (v4.16): max 1024px, WebP 0.6 → base64 data-URL.
// Məqsəd: cihazın servis fotosu + ekrandakı yazıların oxunması — Drive-da yüksək
// keyfiyyətə ehtiyac YOXDUR. WebP kiçik olduğu üçün enqueue + Drive yükləmə sürətlənir.
// WebP dəstəklənmirsə avtomatik JPEG-ə düşür.
function compressImage(file, callback){
  if(!file || !file.type || file.type.indexOf('image/') !== 0){
    callback(null);
    return;
  }
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function(){
    try{
      var w = img.width, h = img.height;
      var scale = Math.min(1, PHOTO_COMPRESS_MAX / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      var out = null;
      if(PHOTO_USE_WEBP){
        try{
          var wp = canvas.toDataURL('image/webp', PHOTO_COMPRESS_QUALITY);
          if(wp && wp.indexOf('data:image/webp') === 0) out = wp;
        }catch(we){}
      }
      if(!out) out = canvas.toDataURL('image/jpeg', PHOTO_COMPRESS_QUALITY);
      callback(out);
    }catch(e){
      callback(null);
    }finally{
      URL.revokeObjectURL(url);
    }
  };
  img.onerror = function(){ URL.revokeObjectURL(url); callback(null); };
  img.src = url;
}

function removePhoto(which, idx){
  PHOTO_STATE[which].splice(idx, 1);
  renderPhotoGrid(which);
}

function renderPhotoGrid(which){
  var grid = document.getElementById(which === 'bus' ? 'bsPhotoGrid' : 'tvmPhotoGrid');
  if(!grid) return;
  var photos = PHOTO_STATE[which] || [];
  var max = PHOTO_MAX[which];
  var html = '';
  photos.forEach(function(p, i){
    html += '<div class="svc-photo-tile">' +
      '<img class="svc-photo-thumb" src="' + p + '" alt="Foto ' + (i + 1) + '">' +
      '<button type="button" class="svc-photo-x" onclick="removePhoto(\'' + which + '\',' + i + ')" aria-label="Sil">&times;</button>' +
      '</div>';
  });
  if(photos.length < max){
    html += '<button type="button" class="svc-photo-add" onclick="triggerPhotoInput(\'' + which + '\')">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>' +
      '<span>' + (photos.length ? 'Əlavə et' : 'Foto əlavə et') + '</span></button>';
  }
  grid.innerHTML = html;
}

function getPhotosForSubmit(which){
  return (PHOTO_STATE[which] || []).slice();
}

function photoError(which, msg){
  var err = document.getElementById(which === 'bus' ? 'bsPhotoError' : 'tvmPhotoError');
  if(err){ err.textContent = msg; err.style.display = 'block'; }
}

// ═══════════════════════════════════════════════════════════════
// v4.16 — İTLİK QORUMASI + ASİNXRON GÖNDƏRMƏ
// Submit OK qayıtdıqdan sonra fotolar ayrıca enqueueTicketPhotos action-ı ilə
// göndərilir. FOTOLAR GÖNDƏRMƏDƏN ƏVVƏL localStorage-da saxlanır — app bağlansa,
// internet kəsilsə belə itmir: növbəti açılışda flushPendingPhotos() təkrar göndərir.
// batchId hər göndərmədə sabitdir → backend təkrar cəhddə DUBLİKAT yazmır.
// v4.16: HƏR çağırışda təzə hesablanır (keş saxlanmır) — başqa istifadəçi
// daxil olanda əvvəlki istifadəçinin gözləyən fotolarına toxunulmasın.
function pendingPhotoKey(){
  var u = (currentUser && currentUser.email) ? currentUser.email.replace(/[^a-z0-9@._-]/gi,'').toLowerCase() : 'anon';
  return 'ctech_pending_photos_' + u;
}
function getPendingPhotos(){
  try{ var raw = localStorage.getItem(pendingPhotoKey()); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
}
function savePendingPhotos(list){
  // v4.16: Quota aşılarsa ən köhnə giriş atılaraq yenidən cəhd olunur (səssiz itki olmaz)
  for(var attempt = 0; attempt < 3 && list.length > 0; attempt++){
    try{
      localStorage.setItem(pendingPhotoKey(), JSON.stringify(list));
      return true;
    }catch(e){
      list = list.slice(1); // ən köhnə girişi at → yenidən cəhd
    }
  }
  return false;
}
function addPendingPhoto(entry){
  var l = getPendingPhotos();
  l.push(entry);
  if(l.length > 5) l = l.slice(-5); // maksimum 5 gözləyən qrup — ən köhnəsi atılır
  savePendingPhotos(l);
}
function removePendingPhoto(batchId){
  savePendingPhotos(getPendingPhotos().filter(function(e){ return e.batchId !== batchId; }));
}
function removePendingPhotosForTicket(ticketId, device){
  savePendingPhotos(getPendingPhotos().filter(function(e){
    return !(e.ticketId === String(ticketId) && e.device === String(device));
  }));
}
function makeBatchId(){
  return 'b' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
}

function enqueuePhotosAfterSubmit(ticketId, device, photos){
  if(!ticketId || !photos || !photos.length) return;
  var batchId = makeBatchId();
  // 1) ƏVVƏLCƏ lokal saxla — app bağlansa/İnternet kəsilsə belə itmir
  addPendingPhoto({ batchId: batchId, ticketId: String(ticketId), device: String(device), photos: photos, ts: Date.now() });
  // 2) Arxa planda göndər
  _sendEnqueue(batchId, String(ticketId), String(device), photos);
}

function _sendEnqueue(batchId, ticketId, device, photos){
  try{
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'enqueueTicketPhotos', ticketId: ticketId, device: device, photos: photos, batchId: batchId })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d && d.status === 'OK' && d.batchId === batchId) removePendingPhoto(batchId);
    })
    .catch(function(){ /* şəbəkə kəsildi — növbəti açılışda flushPendingPhotos təkrar edəcək */ });
  }catch(e){}
}

// App açılışında (login/sessiya bərpası) çağırılır: yarımçıq qalmış foto
// göndərmələrini təkrar edir. Ticket-də artıq foto varsa giriş təmizlənir.
function flushPendingPhotos(){
  var list = getPendingPhotos();
  if(!list.length) return;
  list.forEach(function(entry){
    if(!entry || !entry.ticketId || !entry.photos || !entry.photos.length) return;
    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'getTicketPhotos', ticketId: entry.ticketId, device: entry.device })
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      // v4.16: Yalnız BÜTÜN fotolar yüklənibsə təmizlə. Qismən yüklənibsə
      // giriş saxlanır — qalanlar növbə/trigger vasitəsilə öz-özünə tamamlanır.
      if(d && d.status === 'OK' && d.photos && d.photos.length >= (entry.photos ? entry.photos.length : 0)){
        removePendingPhoto(entry.batchId); // artıq yüklənib — təmizlə
        return;
      }
      _sendEnqueue(entry.batchId, entry.ticketId, entry.device, entry.photos);
    })
    .catch(function(){ /* şəbəkə yoxdur — növbəti açılışda yenə cəhd */ });
  });
}

// ── Detail view-da AVTOMATİK TƏKRAR YÜKLƏMƏ ──
// v4.16+: enqueue action fotoları DƏRHAL inline işlədiyi üçün (~2-5 saniyə)
// Drive-da tez görünür; 60s trigger yalnız uğursuzluqda ehtiyatdır. Bu helper
// boş nəticəni bir neçə dəfə təkrar çəkir ki, yükləmə bitən kimi fotolar görünsün.
// v4.17: backend getTicketPhotos Drive-dan birbaşa skan etdiyi üçün (foto Drive-da
// olduğu müddətcə) ilk cəhddə tapılır — uzun fırlanma/"Foto yoxdur" yox olur.
function _pollTicketPhotos(gridId, ticketId, device, canDel, attempt){
  var grid = document.getElementById(gridId);
  if(!grid) return;
  var maxAttempts = 5; // ~20 saniyəlik pəncərə — inline ~2-5s olduğu üçün yetərlidir;
  if(attempt > maxAttempts){
    // Foto tapılmadı — bu ticket üçün yarımçıq göndərmə varsa təkrar cəhd (öz-özünə sağalma)
    if(typeof flushPendingPhotos === 'function') flushPendingPhotos();
    grid.innerHTML = '<div class="svc-photo-empty">Foto yoxdur</div>';
    return;
  }
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getTicketPhotos', ticketId: ticketId, device: device })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(!document.getElementById(gridId)) return;
    if(d.status === 'OK' && d.photos && d.photos.length){
      // Fotolar gəldi — bu ticket üçün gözləyən göndərmə varsa təmizlə
      if(typeof removePendingPhotosForTicket === 'function') removePendingPhotosForTicket(ticketId, device);
      grid.innerHTML = d.photos.map(function(ph, i){
        var tidJs = JSON.stringify(String(ticketId));
        return '<div class="svc-photo-tile svc-photo-view">' +
          '<img class="svc-photo-thumb" src="' + ph.thumb + '" alt="Foto ' + (i + 1) + '" onclick="openPhotoLightbox(\'' + ph.full + '\')">' +
          (canDel ? '<button type="button" class="svc-photo-x" onclick="deleteTicketPhoto(' + tidJs + ',\'' + device + '\',\'' + ph.fileId + '\',this)" aria-label="Sil">&times;</button>' : '') +
          '</div>';
      }).join('');
    } else {
      // Hələ boş — bir az gözləyib təkrar cəhd et (yükləmə davam edir)
      grid.innerHTML = '<div class="rpt-loading"><div class="spinner" style="width:26px;height:26px;border-width:3px;"></div><span>Fotolar yüklənir...</span></div>';
      setTimeout(function(){ _pollTicketPhotos(gridId, ticketId, device, canDel, attempt + 1); }, 4000);
    }
  })
  .catch(function(){
    setTimeout(function(){ _pollTicketPhotos(gridId, ticketId, device, canDel, attempt + 1); }, 4000);
  });
}

// ═══════════════════════════════════════════════════════════════
// TICKET DETAIL VIEW — "Servis Fotoları" bölməsi
// ═══════════════════════════════════════════════════════════════

// Texnik yalnız AÇIQ (bağlanmamış) ticketlərdə fotoları görür;
// admin/leader həmişə görür.
function canViewTicketPhotos(status){
  var lvl = getAccessLevel(currentUser ? currentUser.role : '');
  if(lvl === 'admin' || lvl === 'leader') return true;
  return String(status || '').trim() !== 'Bağlandı';
}

function canDeleteTicketPhotos(status){
  return String(status || '').trim() !== 'Bağlandı';
}

// Detail view-un sonuna foto bölməsi əlavə edib fotoları çəkir.
function appendPhotoSectionToDetail(ticketId, device, status, containerId){
  var container = document.getElementById(containerId);
  if(!container) return;
  if(!canViewTicketPhotos(status)) return;
  var secId = containerId + 'PhotoSec';
  if(document.getElementById(secId)) return; // təkrar əlavə olunmasın

  var canDel = canDeleteTicketPhotos(status);
  var html = '<div class="dv-section svc-photo-detail-section" id="' + secId + '">' +
    '<div class="dv-section-title">Servis Fotoları</div>' +
    '<div class="svc-photo-detail" id="' + containerId + 'PhotoGrid">' +
    '<div class="rpt-loading"><div class="spinner" style="width:26px;height:26px;border-width:3px;"></div><span>Fotolar yüklənir...</span></div>' +
    '</div></div>';
  container.insertAdjacentHTML('beforeend', html);

  // v4.14: Fotolar avtomatik təkrar yükləmə ilə çəkilir — trigger ~60 saniyəyə
  // Drive-a yüklədiyi üçün boş nəticə "Foto yoxdur" kimi göstərilməz, yükləmə
  // bitən kimi grid-ə düşər.
  _pollTicketPhotos(containerId + 'PhotoGrid', ticketId, device, canDel, 1);
}

function deleteTicketPhoto(ticketId, device, fileId, btnEl){
  if(!confirm('Bu foto silinsin?')) return;
  btnEl.disabled = true;
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'deleteTicketPhoto',
      ticketId: ticketId,
      device: device,
      fileId: fileId,
      userEmail: currentUser ? currentUser.email : ''
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status === 'OK'){
      var tile = btnEl.closest('.svc-photo-tile');
      if(tile) tile.remove();
      if(typeof invalidateOngoingCache === 'function') invalidateOngoingCache();
    } else {
      alert(d.message || 'Silinmə xətası');
      btnEl.disabled = false;
    }
  })
  .catch(function(){
    alert('Şəbəkə xətası');
    btnEl.disabled = false;
  });
}

// ── Lightbox (tam ölçüdə baxış) ──
function openPhotoLightbox(url){
  var lb = document.getElementById('photoLightbox');
  if(!lb){
    lb = document.createElement('div');
    lb.id = 'photoLightbox';
    lb.className = 'photo-lightbox';
    lb.innerHTML = '<button type="button" class="photo-lightbox-close" onclick="closePhotoLightbox()" aria-label="Bağla">&times;</button><img class="photo-lightbox-img" alt="">';
    document.body.appendChild(lb);
  }
  lb.querySelector('img').src = url;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closePhotoLightbox(){
  var lb = document.getElementById('photoLightbox');
  if(lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePhotoLightbox(); });
document.addEventListener('click', function(e){
  if(e.target && e.target.id === 'photoLightbox') closePhotoLightbox();
});

// Viewport dəyişəndə (mobil ↔ desktop) bölmə görünürlüyünü təzələ
var _photoResizeTimer = null;
window.addEventListener('resize', function(){
  clearTimeout(_photoResizeTimer);
  _photoResizeTimer = setTimeout(function(){
    if(typeof updatePhotoSections === 'function') updatePhotoSections();
  }, 250);
});
