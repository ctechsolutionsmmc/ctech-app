// ═══════════════════════════════════════════════════════════════
// PHOTO-UPLOAD.JS — Servis Fotoları (v4.13)
// Bus/TVM servis forma view-larında foto seçimi:
//   • canvas sıxışdırma (maksimum 1280px, JPEG keyfiyyət 0.7)
//   • seçilən fotolar base64 olaraq submit payload-a qoşulur
//   • hər fotonun üzərində X işarəsi ilə silmə
// Ticket detail view (Real-Time Report + Davam edən servis):
//   • "Servis Fotoları" bölməsi — thumbnail grid, klik → lightbox
//   • Ticket BAĞLI deyilsə X ilə silmə, bağlıdırsa yalnız oxuma
// Mövcud heç bir komponentə zərər vermir — yalnız əlavə edir.
// ═══════════════════════════════════════════════════════════════

var PHOTO_STATE = { bus: [], tvm: [] };
var PHOTO_MAX = { bus: 4, tvm: 3 };
var PHOTO_COMPRESS_MAX = 1280;    // px — ən uzun tərəf
var PHOTO_COMPRESS_QUALITY = 0.7; // JPEG keyfiyyət

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

// Canvas sıxışdırma: max 1280px, JPEG 0.7 → base64 data-URL
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
      callback(canvas.toDataURL('image/jpeg', PHOTO_COMPRESS_QUALITY));
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

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getTicketPhotos', ticketId: ticketId, device: device })
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    var grid = document.getElementById(containerId + 'PhotoGrid');
    if(!grid) return;
    if(d.status !== 'OK' || !d.photos || !d.photos.length){
      grid.innerHTML = '<div class="svc-photo-empty">Foto yoxdur</div>';
      return;
    }
    grid.innerHTML = d.photos.map(function(ph, i){
      var tidJs = JSON.stringify(String(ticketId));
      return '<div class="svc-photo-tile svc-photo-view">' +
        '<img class="svc-photo-thumb" src="' + ph.thumb + '" alt="Foto ' + (i + 1) + '" onclick="openPhotoLightbox(\'' + ph.full + '\')">' +
        (canDel ? '<button type="button" class="svc-photo-x" onclick="deleteTicketPhoto(' + tidJs + ',\'' + device + '\',\'' + ph.fileId + '\',this)" aria-label="Sil">&times;</button>' : '') +
        '</div>';
    }).join('');
  })
  .catch(function(){
    var grid = document.getElementById(containerId + 'PhotoGrid');
    if(grid) grid.innerHTML = '<div class="svc-photo-empty">Fotolar yüklənə bilmədi</div>';
  });
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
