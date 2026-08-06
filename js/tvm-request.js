// ═══════════════════════════════════════════════════════════════
// TVM-REQUEST.JS — TVM Yeni Müraciət (Bus Request-in TVM analoqu)
// İki-mərhələli TVM axınının 1-ci addımı: müraciət yaradılır,
// texnik TVM real-time report-dan görüb davamını yazır.
// Yalnız veb (≥901px) — Qrup rəhbəri / Admin / Call Center.
// ═══════════════════════════════════════════════════════════════
var trSelected = { problem:'', technicians:[], sn:null };
var trFormDirty = false;
var trNextTicketId = '';
var trAssignableTechnicians = [];

function openTvmRequest(){
  closeMenu();
  if(window.innerWidth < 901){ return; } // yalnız veb
  var level = getAccessLevel(currentUser.role);
  if(level === 'technician'){
    alert('Bu bölməyə giriş icazəniz yoxdur. Yalnız qrup rəhbərləri, adminlər və call center istifadə edə bilər.');
    return;
  }

  document.getElementById('dashboardView').style.display='none';
  document.getElementById('tvmRequestView').style.display='block';
  trResetForm();
  trLoadAssignableTechnicians();

  var now=new Date();
  var bParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  document.getElementById('tr_date').value = bParts;

  // TVM form datası (tvmFaults / tvmRegistry) — artıq yüklənibsə təkrar çəkmə
  var ensure = (typeof tvmFormData !== 'undefined' && tvmFormData && tvmFormData.tvmFaults)
    ? Promise.resolve(tvmFormData)
    : fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmFormData'})})
        .then(function(r){return r.json();})
        .then(function(d){ if(d.status==='OK') tvmFormData=d; return tvmFormData; });
  ensure.then(function(){ trRenderTicketBadge(); }).catch(function(){});

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getNextTicketIds'})})
    .then(function(r){return r.json();})
    .then(function(d){ if(d.status==='OK' && d.tvm){ trNextTicketId=d.tvm; trRenderTicketBadge(); } })
    .catch(function(){});
}

function trRenderTicketBadge(){
  var badge=document.getElementById('trTicketBadge');
  if(badge && trNextTicketId){
    badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(trNextTicketId)+'</span>';
  }
}

function attemptTvmRequestHome(){
  bsConfirmMode='tvmRequest';
  if(trFormDirty){
    var co=document.getElementById('bsConfirmOverlay');
    co.style.display='flex'; co.classList.add('open');
    return;
  }
  closeTvmRequest();
}
function closeTvmRequest(){
  document.getElementById('tvmRequestView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}

function trResetForm(){
  trFormDirty=false;
  trSelected={ problem:'', technicians:[], sn:null };
  ['tr_requester','tr_phone','tr_time_lbl','tr_tech_search','tr_sn'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  var lbl=document.getElementById('tr_problem_lbl');
  if(lbl){ lbl.textContent='Seçin'; lbl.style.color='#9AACC4'; lbl.classList.remove('filled'); }
  var chips=document.getElementById('tr_tech_chips'); if(chips) chips.innerHTML='';
  var locWrap=document.getElementById('tr_location_wrap'); if(locWrap) locWrap.style.display='none';
  trCloseProblemList(); trCloseSnDD();
  var tdd=document.getElementById('tr_tech_dd'); if(tdd) tdd.style.display='none';
}

// ── Nasazlıq / Problem siyahısı (TVM_PROBLEMS → tvmFormData.tvmFaults) ──
function trOpenProblemList(){
  var listEl=document.getElementById('dd_trProblem_list');
  var items=(typeof tvmFormData !== 'undefined' && tvmFormData && tvmFormData.tvmFaults) || [];
  listEl.innerHTML = items.map(function(item){
    var safe=item.replace(/'/g,"\\'");
    return '<div class="bs-dd-item" onclick="trSelectProblem(\''+safe+'\')"><div style="width:14px"></div><span>'+escapeHtml(item)+'</span></div>';
  }).join('');
  listEl.classList.add('open');
}
function trSelectProblem(value){
  trSelected.problem=value;
  trFormDirty=true;
  var lbl=document.getElementById('tr_problem_lbl');
  if(lbl){ lbl.textContent=value; lbl.style.color='#12233B'; lbl.classList.add('filled'); }
  var listEl=document.getElementById('dd_trProblem_list');
  if(listEl) listEl.classList.remove('open');
}
function trCloseProblemList(){
  var el=document.getElementById('dd_trProblem_list'); if(el) el.classList.remove('open');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#dd_trProblem')){ trCloseProblemList(); }
});

// ── TVM SN reyestr axtarışı (TVM_SN_AND_LOC → tvmFormData.tvmRegistry) ──
function trSnInputHandler(el){
  trFormDirty=true;
  var q=el.value.trim();
  if(trSelected.sn && String(trSelected.sn.id).trim().toUpperCase() !== q.toUpperCase()){
    trSelected.sn=null;
    var locWrap=document.getElementById('tr_location_wrap'); if(locWrap) locWrap.style.display='none';
  }
  if(q.length<1){ trCloseSnDD(); return; }
  var reg=(typeof tvmFormData !== 'undefined' && tvmFormData && tvmFormData.tvmRegistry) || [];
  var qUpper=q.toUpperCase();
  var matches=reg.filter(function(r){ return String(r.id||'').toUpperCase().indexOf(qUpper)!==-1; });
  trRenderSnDropdown(matches);
}
function trRenderSnDropdown(matches){
  var dd=document.getElementById('tr_sn_dd');
  if(!dd) return;
  if(!matches || matches.length===0){
    dd.innerHTML='<div class="bs-registry-empty">Uyğun TVM İD tapılmadı — məlumatları əl ilə daxil edin</div>';
  } else {
    dd.innerHTML=matches.slice(0,8).map(function(m){
      return '<div class="bs-registry-item" data-id="'+escapeHtml(m.id||'')+'">'
        +'<span class="reg-id">'+escapeHtml(m.id||'—')+'</span>'
        +'<span class="reg-meta">'+escapeHtml(m.location||'—')+'</span>'
        +'</div>';
    }).join('');
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(itemEl){
      itemEl.addEventListener('click', function(e){
        e.stopPropagation();
        var id=itemEl.getAttribute('data-id');
        var match=matches.find(function(m){ return m.id===id; });
        if(match) trSelectSnMatch(match);
      });
    });
  }
  dd.style.display='block';
}
function trSelectSnMatch(match){
  trSelected.sn=match;
  var snEl=document.getElementById('tr_sn'); if(snEl) snEl.value=match.id||'';
  var locWrap=document.getElementById('tr_location_wrap');
  var locDisp=document.getElementById('tr_location_display');
  if(match.location){
    if(locDisp) locDisp.textContent=match.location;
    if(locWrap) locWrap.style.display='block';
  } else if(locWrap){ locWrap.style.display='none'; }
  trCloseSnDD();
  trFormDirty=true;
}
function trCloseSnDD(){
  var dd=document.getElementById('tr_sn_dd'); if(dd) dd.style.display='none';
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#tr_sn_wrap') && !e.target.closest('#tr_sn_dd')){ trCloseSnDD(); }
});

// ── Texnik seçimi (USERS sheet-dən, maksimum 2, çip formada) ──
function trLoadAssignableTechnicians(){
  var statusEl = document.getElementById('tr_tech_status');
  if(statusEl) statusEl.textContent = 'Texnik siyahısı yüklənir...';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getAssignableTechnicianNames', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status==='OK'){
      trAssignableTechnicians = d.names || [];
      if(statusEl) statusEl.textContent = trAssignableTechnicians.length + ' texnik yükləndi';
    } else {
      trAssignableTechnicians = [];
      if(statusEl) statusEl.textContent = '⚠ Xəta: ' + (d.message || 'texnik siyahısı gətirilə bilmədi');
    }
  })
  .catch(function(e){
    trAssignableTechnicians = [];
    if(statusEl) statusEl.textContent = '⚠ Şəbəkə xətası: ' + e.message;
  });
}
function trTechSearchHandler(el){
  var dd=document.getElementById('tr_tech_dd');
  var q=el.value.trim();
  if(!q){ dd.style.display='none'; return; }
  if(trSelected.technicians.length>=2){
    dd.innerHTML='<div class="bs-registry-empty">Maksimum 2 texnik seçilə bilər</div>';
    dd.style.display='block';
    return;
  }
  var qUpper=q.toUpperCase();
  var matches=trAssignableTechnicians.filter(function(name){
    return name.toUpperCase().indexOf(qUpper)!==-1 && trSelected.technicians.indexOf(name)===-1;
  }).slice(0,8);
  if(matches.length===0){
    dd.innerHTML='<div class="bs-registry-empty">Uyğun texnik tapılmadı</div>';
  } else {
    dd.innerHTML=matches.map(function(name){
      return '<div class="bs-registry-item" data-name="'+escapeHtml(name)+'"><span class="reg-id">'+escapeHtml(name)+'</span></div>';
    }).join('');
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(itemEl){
      itemEl.addEventListener('click', function(e){
        e.stopPropagation();
        trTechAddChip(itemEl.getAttribute('data-name'));
        el.value=''; dd.style.display='none';
      });
    });
  }
  dd.style.display='block';
}
function trTechAddChip(name){
  if(trSelected.technicians.length>=2 || trSelected.technicians.indexOf(name)!==-1) return;
  trSelected.technicians.push(name);
  trFormDirty=true;
  trRenderTechChips();
}
function trTechRemoveChip(name){
  var idx=trSelected.technicians.indexOf(name);
  if(idx!==-1) trSelected.technicians.splice(idx,1);
  trFormDirty=true;
  trRenderTechChips();
}
function trRenderTechChips(){
  var box=document.getElementById('tr_tech_chips');
  box.innerHTML=trSelected.technicians.map(function(name){
    var safe=name.replace(/'/g,'');
    return '<span class="bs-chip">'+escapeHtml(name)+'<button type="button" class="bs-chip-x" onclick="trTechRemoveChip(\''+safe+'\')">✕</button></span>';
  }).join('');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#tr_tech_search') && !e.target.closest('#tr_tech_dd')){
    var dd=document.getElementById('tr_tech_dd'); if(dd) dd.style.display='none';
  }
});

// ── Göndər ──
function submitTvmRequest(){
  if(!document.getElementById('tr_date').value){ alert('Tarix daxil edin'); return; }
  if(!getTimeInputValue('tr_time_lbl')){ alert('Bildirilmə vaxtını seçin'); return; }
  if(!document.getElementById('tr_requester').value.trim()){ alert('Müraciət edəni daxil edin'); return; }
  if(!document.getElementById('tr_sn').value.trim()){ alert('TVM SN daxil edin'); return; }
  if(!trSelected.problem){ alert('Nasazlıq/Problemi seçin'); return; }
  if(trSelected.technicians.length===0){ alert('Ən azı bir texnik təhkim edin'); return; }

  var btn=document.getElementById('trSubmitBtn');
  btn.disabled=true; var origText=btn.textContent;

  var ov=document.getElementById('tvmLoadingOverlay');
  var sp=document.getElementById('tvmSpinner');
  var tx=document.getElementById('tvmLoadingText');
  var ic=document.getElementById('tvmSuccessIcon');
  if(ov) ov.style.display='flex';
  if(sp) sp.style.display='block';
  if(ic){ ic.style.display='none'; ic.classList.remove('show'); }
  if(tx) tx.textContent='Göndərilir...';

  var payload={
    action:'createTvmRequest',
    data:{
      report_date: document.getElementById('tr_date').value,
      fault_time: getTimeInputValue('tr_time_lbl'),
      requester_name: document.getElementById('tr_requester').value.trim(),
      requester_phone: document.getElementById('tr_phone').value.trim(),
      tvm_sn: document.getElementById('tr_sn').value.trim(),
      location: trSelected.sn ? (trSelected.sn.location || '') : '',
      service_location: trSelected.sn ? (trSelected.sn.serviceLocation || '') : '',
      fault: trSelected.problem,
      technician_1: trSelected.technicians[0] || '',
      technician_2: trSelected.technicians[1] || ''
    },
    requesterEmail: currentUser?currentUser.email:''
  };

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(sp) sp.style.display='none';
    if(ic) ic.style.display='flex';
    if(d.status==='OK'){
      if(tx) tx.textContent='Göndərildi! '+d.ticketId;
      setTimeout(function(){
        if(ov){ ov.style.display='none'; }
        trFormDirty=false;
        closeTvmRequest();
      }, 1800);
    } else {
      if(tx) tx.textContent='Xəta baş verdi';
      setTimeout(function(){ if(ov) ov.style.display='none'; alert(d.message||'Xəta baş verdi'); }, 1200);
    }
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    if(sp) sp.style.display='none';
    if(tx) tx.textContent='Şəbəkə xətası';
    setTimeout(function(){ if(ov) ov.style.display='none'; alert('Şəbəkə xətası: '+e.message); }, 1200);
  });
}
