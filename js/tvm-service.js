// ═══════════════════════════════════════════════════════════════
// TVM-SERVICE.JS — TVM Servis Formu
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

function submitTvmService(){
  if(!document.getElementById('tvm_date').value){ alert('Tarix daxil edin'); return; }
  if(!document.getElementById('tvm_fault_time').value.trim()){ alert('Nasazlığın yaranma vaxtını daxil edin'); return; }
  if(!document.getElementById('tvm_sn').value.trim()){ alert('TVM SN daxil edin'); return; }
  var startVal = document.getElementById('tvm_start_time').value.trim();
  var endVal = document.getElementById('tvm_end_time').value.trim();
  if(!startVal){ alert('Servis başlama saatını daxil edin'); return; }
  if(!endVal){ alert('Servis bitmə saatını daxil edin'); return; }
  if(bsSelected.tvm_fault.length === 0){ alert('Nasazlığı seçin'); return; }
  if(bsSelected.tvm_solution.length === 0){ alert('Görülən işi seçin'); return; }
  if(!bsSelected.tvm_tech){ alert('Texniki seçin'); return; }
  if(!bsSelected.tvm_leader){ alert('Qrup rəhbərini seçin'); return; }

  var data = {
    report_date: document.getElementById('tvm_date').value,
    fault_time: document.getElementById('tvm_fault_time').value.trim(),
    tvm_sn: document.getElementById('tvm_sn').value.trim(),
    location: tvmSelectedSn ? (tvmSelectedSn.location || '') : '',
    service_location: tvmSelectedSn ? (tvmSelectedSn.serviceLocation || '') : '',
    fault: bsSelected.tvm_fault,
    solution: bsSelected.tvm_solution,
    service_start_time: startVal,
    service_end_time: endVal,
    technician: bsSelected.tvm_tech,
    team_leader: bsSelected.tvm_leader,
    old_sn: document.getElementById('tvm_old_sn') ? document.getElementById('tvm_old_sn').value.trim() : '',
    new_sn: document.getElementById('tvm_new_sn') ? document.getElementById('tvm_new_sn').value.trim() : '',
    note: document.getElementById('tvm_note').value.trim()
  };
  // v4.14: fotolar payload-da YOXDUR — submit yüngül qalır. OK qayıtdıqdan sonra
  // enqueuePhotosAfterSubmit ilə ayrıca, arxa planda göndərilir.
  var photosToEnqueue = (typeof getPhotosForSubmit==='function') ? getPhotosForSubmit('tvm') : [];

  var ov = document.getElementById('tvmLoadingOverlay');
  var sp = document.getElementById('tvmSpinner');
  var ic = document.getElementById('tvmSuccessIcon');
  var tx = document.getElementById('tvmLoadingText');

  ov.style.display = 'flex';
  sp.style.display = 'block';
  ic.style.display = 'none';
  ic.classList.remove('show');
  tx.textContent = tvmEditMode ? 'Yadda saxlanılır...' : 'Göndərilir...';

  var payload = tvmEditMode
    ? { action:'updateTvmService', ticketId: tvmEditTicketId, data:data, userEmail: currentUser ? currentUser.email : '' }
    : { action:'submitTvmService', data:data, userEmail: currentUser ? currentUser.email : '' };

  fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  })
  .then(function(r){ return r.json(); })
  .then(function(result){
    sp.style.display = 'none';
    ic.style.display = 'flex';
    ic.classList.add('show');
    if(result.status === 'OK'){
      tx.textContent = tvmEditMode ? ('✅ Yadda saxlanıldı! ' + result.ticketId) : ('✅ Göndərildi! ' + result.ticketId);
      // v4.14: fotoları OK-dan sonra arxa planda göndər — UI bloklanmır
      if(result.ticketId && photosToEnqueue.length){
        if(typeof enqueuePhotosAfterSubmit==='function') enqueuePhotosAfterSubmit(result.ticketId,'TVM',photosToEnqueue);
      }
    } else {
      tx.textContent = '❌ Xəta: ' + (result.message || '');
    }
    setTimeout(function(){
      ov.style.display = 'none';
      ic.classList.remove('show');
      ic.style.display = 'none';
      if(result.status === 'OK'){
        var wasEdit = tvmEditMode;
        var backTarget = tvmReturnTarget;
        // Servis dəyişdi → davam edən servis keşini sil (təzə çəkilsin)
        if(typeof invalidateOngoingCache === 'function') invalidateOngoingCache();
        closeTvmService();
        if(wasEdit){
          // Haradan açılıbsa həmin bölməni yenilə: davam edən servis və ya report
          if(backTarget === 'ongoing' && typeof loadTvmOngoingData === 'function'){ loadTvmOngoingData(); }
          else if(typeof loadTvmReportData === 'function'){ loadTvmReportData(); }
        }
      }
    }, 1800);
  })
  .catch(function(e){
    sp.style.display = 'none';
    tx.textContent = '❌ Şəbəkə xətası: ' + e.message;
    setTimeout(function(){ ov.style.display = 'none'; }, 1800);
  });
}

