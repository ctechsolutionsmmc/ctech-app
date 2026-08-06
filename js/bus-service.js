// ═══════════════════════════════════════════════════════════════
// BUS-SERVICE.JS — Bus Service Form, Dropdown, Submit
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════

var bsFormData = {};
var bsFormDirty = false;
var bsNextTicketId = '';
var bsRegistryLocked = false;
var bsSelected = { carrier:'', brand:'', problem:'', solution:[], location:'', tech1:'', tech2:'', leader:'', tvm_fault:[], tvm_solution:[], tvm_tech:'', tvm_leader:'', oldSn:[], newSn:[] };
var activeDDKey = null;

var ddMeta = {
  carrier:   { lbl:'bs_carrier_lbl',   list:'dd_carrier_list',   multi:false, onSelect:null },
  brand:     { lbl:'bs_brand_lbl',     list:'dd_brand_list',     multi:false, onSelect:null },
  system:    { lbl:'bs_system_lbl',    list:'dd_system_list',    multi:false, onSelect:null },
  problem:   { lbl:'bs_problem_lbl',   list:'dd_problem_list',   multi:false, onSelect:onProblemSelect },
  solution:  { lbl:'bs_solution_lbl',  list:'dd_solution_list',  multi:true,  onSelect:onSolutionSelect },
  location:  { lbl:'bs_location_lbl',  list:'dd_location_list',  multi:false, onSelect:onLocationSelect },
  tech1:     { lbl:'bs_tech1_lbl',     list:'dd_tech1_list',     multi:false, onSelect:null },
  tech2:     { lbl:'bs_tech2_lbl',     list:'dd_tech2_list',     multi:false, onSelect:null },
  leader:    { lbl:'bs_leader_lbl',    list:'dd_leader_list',    multi:false, onSelect:null },
  tvm_fault:    { lbl:'bs_tvm_fault_lbl',    list:'dd_tvm_fault_list',    multi:true,  onSelect:onTvmFaultSelect },
  tvm_solution: { lbl:'bs_tvm_solution_lbl', list:'dd_tvm_solution_list', multi:true,  onSelect:onTvmSolutionSelect },
  tvm_tech:     { lbl:'bs_tvm_tech_lbl',     list:'dd_tvm_tech_list',     multi:false, onSelect:null },
  tvm_leader:   { lbl:'bs_tvm_leader_lbl',   list:'dd_tvm_leader_list',   multi:false, onSelect:null }
};

function toggleDD(key){
  if((key==='carrier'||key==='brand') && bsRegistryLocked) return;
  if(activeDDKey && activeDDKey!==key){ closeDD(activeDDKey); }
  var listEl=document.getElementById('dd_'+key+'_list');
  var arrow=document.getElementById('dd_'+key+'_arrow');
  if(!listEl) return;
  var isOpen=listEl.classList.contains('open');
  if(isOpen){ closeDD(key); } else { renderDD(key); listEl.classList.add('open'); if(arrow)arrow.style.transform='rotate(180deg)'; activeDDKey=key; }
}
function closeDD(key){
  var listEl=document.getElementById('dd_'+key+'_list');
  var arrow=document.getElementById('dd_'+key+'_arrow');
  if(listEl)listEl.classList.remove('open');
  if(arrow)arrow.style.transform='';
  if(activeDDKey===key)activeDDKey=null;
}
function closeAllDD(){ Object.keys(ddMeta).forEach(function(k){closeDD(k);}); }
document.addEventListener('click',function(e){ if(!e.target.closest('.bs-inline-dd')&&!e.target.closest('#bs_time_wrap')){closeAllDD();} });

function renderDD(key){
  var meta=ddMeta[key];
  var listEl=document.getElementById(meta.list);
  if(!listEl)return;
  var items=getListForKey(key);
  listEl.innerHTML='';
  items.forEach(function(item){
    var div=document.createElement('div');
    div.className='bs-dd-item';
    var isMulti=meta.multi;
    var isSelected=isMulti?(bsSelected[key].indexOf(item)!==-1):(bsSelected[key]===item);
    if(isSelected)div.classList.add('selected');
    if(isMulti){
      div.innerHTML='<div class="bs-dd-check">'+(isSelected?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M4 12l6 6L20 6"/></svg>':'')+'</div><span>'+item+'</span>';
    } else {
      div.innerHTML=(isSelected?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2.5"><path d="M4 12l6 6L20 6"/></svg>':'<div style="width:14px"></div>')+'<span>'+escapeHtml(item)+'</span>';
    }
    div.addEventListener('click',function(e){e.stopPropagation();selectDDItem(key,item);});
    listEl.appendChild(div);
  });
  if(meta.multi){
    var done=document.createElement('button');
    done.type='button'; done.className='bs-dd-done'; done.textContent='Təsdiqlə';
    done.addEventListener('click',function(e){e.stopPropagation();closeDD(key);});
    listEl.appendChild(done);
  }
}

// Bütün dropdown siyahılarını yenidən render et (yeni getFormData gələndə çağırılır).
function renderAllDDs(){
  Object.keys(ddMeta).forEach(function(k){ renderDD(k); });
}

function getListForKey(key){
  var map={
    carrier:bsFormData.carriers||[],
    brand:bsFormData.busModels||[],
    problem:bsFormData.busProblems||[],
    solution:bsFormData.solutions||[],
    location:bsFormData.locations||[],
    tech1:bsFormData.technicians||[],
    tech2:bsFormData.technicians||[],
    leader:bsFormData.leaders||[],
    tvm_fault:    (tvmFormData&&tvmFormData.tvmFaults)||[],
    tvm_solution: (tvmFormData&&tvmFormData.tvmSolutions)||[],
    tvm_tech:     (tvmFormData&&tvmFormData.technicians)||[],
    tvm_leader:   (tvmFormData&&tvmFormData.tvmLeaders)||[]
  };
  return map[key]||[];
}

function selectDDItem(key,item){
  var meta=ddMeta[key];
  if(key.indexOf('tvm_')===0){ tvmFormDirty=true; } else { bsFormDirty=true; scheduleBsDraftSave(); }
  if(meta.multi){
    var arr=bsSelected[key]; var idx=arr.indexOf(item);
    if(idx!==-1)arr.splice(idx,1);else arr.push(item);
    renderDD(key); updateMultiLabel(key);
    if(meta.onSelect)meta.onSelect(item);
  } else {
    bsSelected[key]=item;
    var lblEl=document.getElementById(meta.lbl);
    if(lblEl){ lblEl.textContent=item; lblEl.style.color='#12233B'; lblEl.style.fontSize='14px'; lblEl.style.fontWeight='400'; lblEl.classList.add('filled'); }
    if(meta.onSelect)meta.onSelect(item);
    closeDD(key);
  }
}

function updateMultiLabel(key){
  var arr=bsSelected[key]; var meta=ddMeta[key];
  var lblEl=document.getElementById(meta.lbl);
  if(lblEl){
    lblEl.textContent=arr.length?(arr.length+' seçim'):'Seçin (çoxlu seçim)';
    lblEl.style.color=arr.length?'#12233B':'#9AACC4';
    lblEl.style.fontSize='14px'; lblEl.style.fontWeight='400';
    if(arr.length)lblEl.classList.add('filled'); else lblEl.classList.remove('filled');
  }
}

function onProblemSelect(item){}
function onSolutionSelect(item){ updateSolutionChips(); }
function onLocationSelect(item){
  var isDigar=item.toLowerCase().indexOf('digər')!==-1;
  document.getElementById('bs_location_note_wrap').style.display=isDigar?'block':'none';
  if(!isDigar)document.getElementById('bs_location_note').value='';
}

function updateSolutionChips(){
  var arr=bsSelected.solution;
  var chips=document.getElementById('bs_solution_chips');
  chips.innerHTML='';
  arr.forEach(function(a){
    var c=document.createElement('span'); c.className='bs-chip';
    c.textContent=a.length>32?a.slice(0,32)+'…':a;
    chips.appendChild(c);
  });
}

function onTvmFaultSelect(item){ updateTvmChips('fault'); }
function onTvmSolutionSelect(item){ updateTvmChips('solution'); }
function updateTvmChips(which){
  var arr=bsSelected['tvm_'+which];
  var chips=document.getElementById('tvm_'+which+'_chips');
  if(!chips) return;
  chips.innerHTML='';
  arr.forEach(function(a){
    var c=document.createElement('span'); c.className='bs-chip';
    c.textContent=a.length>32?a.slice(0,32)+'…':a;
    chips.appendChild(c);
  });
}

function formatTimeInput(el){
  var digits=el.value.replace(/[^0-9]/g,'').slice(0,4);
  var formatted=digits.length>2?digits.slice(0,2)+':'+digits.slice(2):digits;
  el.value=formatted; el.setSelectionRange(formatted.length,formatted.length); bsFormDirty=true;
}
function getTimeInputValue(id){
  var el=document.getElementById(id); if(!el)return'';
  var v=el.value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:'';
}
function setTimeInputValue(id,hhmm){ var el=document.getElementById(id); if(el&&hhmm)el.value=hhmm; }
function getTimeValue(){ return getTimeInputValue('bs_time_lbl'); }
function fillAllDDs(data){ bsFormData=data; if(typeof renderAllDDs==='function') renderAllDDs(); }

var bsEditMode=false, bsEditTicketId=null, bsReturnTarget='dashboard', bsCompletionMode=false, bsLeaderCloseMode=false;

function startBusService(){
  var ov=document.getElementById('busOpenOverlay');
  ov.style.display='flex';
  preloadBusData(function(){ ov.style.display='none'; openBusService(); });
}

function preloadBusData(callback){
  setTimeout(callback,900);
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status==='OK'){
      bsFormData=d;
      var tid=d.nextTicketId||'BUS-00001'; bsNextTicketId=tid;
      var badge=document.getElementById('bsTicketBadge');
      if(badge&&!bsEditMode&&document.getElementById('busServiceView').style.display!=='none'){
        badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(tid)+'</span>';
      }
      // Yeni siyahılar gələndə dropdown-ları yenilə — admin paneldəki dəyişiklik dərhal görünsün.
      if(typeof renderAllDDs==='function') renderAllDDs();
    }
  }).catch(function(){});
}

function resetBusFormFields(){
  ['bs_time_lbl','bs_start_lbl','bs_end_lbl'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
  bsFormDirty=false;
  bsCompletionMode=false;
  bsLeaderCloseMode=false;
  if(typeof bsLockStage1Fields==='function') bsLockStage1Fields(false);
  bsSelected={carrier:'',brand:'',problem:'',solution:[],location:'',tech1:'',tech2:'',leader:'',oldSn:[],newSn:[]};
  Object.keys(ddMeta).forEach(function(k){
    var m=ddMeta[k]; var el=document.getElementById(m.lbl);
    if(el){
      if(el.tagName==='INPUT'){ el.value=''; }
      else { el.textContent=(k==='tech2'||k==='tech1')?'Seçin (könüllü)':(k==='solution'?'Seçin (çoxlu seçim)':'Seçin'); el.style.color='#9AACC4'; el.style.fontSize=''; el.style.fontWeight=''; el.classList.remove('filled'); }
    }
    closeDD(k);
  });
  ['bs_requester','bs_phone','bs_route','bs_busid','bs_plate','bs_note','bs_location_note'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
  document.getElementById('bs_solution_chips').innerHTML='';
  var oldSnInput=document.getElementById('bs_old_sn'); if(oldSnInput) oldSnInput.value='';
  var newSnInput=document.getElementById('bs_new_sn'); if(newSnInput) newSnInput.value='';
  if(typeof busSnRenderChips==='function'){ busSnRenderChips('old'); busSnRenderChips('new'); }
  var snConflictErr=document.getElementById('bs_sn_conflict_err'); if(snConflictErr) snConflictErr.style.display='none';
  document.getElementById('bs_location_note_wrap').style.display='none';
  if(typeof unlockRegistryFields==='function')unlockRegistryFields();
  closeBusRegistryDD();
}
function closeBusRegistryDD(){ var dd=document.getElementById('bs_registry_dd'); if(dd)dd.classList.remove('open'); }

function loadFastTicketIds(){
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getNextTicketIds'})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK') return;
    if(d.bus){
      bsNextTicketId=d.bus;
      var bsView=document.getElementById('busServiceView');
      if(!bsEditMode && bsView && bsView.style.display!=='none'){
        document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(bsNextTicketId)+'</span>';
      }
    }
    if(d.tvm){
      tvmNextTicketId=d.tvm;
      var tvmView=document.getElementById('tvmServiceView');
      if(!tvmEditMode && tvmView && tvmView.style.display!=='none'){
        var badge=document.getElementById('tvmTicketBadge');
        if(badge) badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(tvmNextTicketId)+'</span>';
      }
    }
  })
  .catch(function(){});
}

function openBusService(){
  bsEditMode=false; bsEditTicketId=null; bsReturnTarget='dashboard';
  var now=new Date();
  var bParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  resetBusFormFields();
  unlockRegistryFields();
  document.getElementById('bs_date').value=bParts;
  document.getElementById('dashboardView').style.display='none';
  document.getElementById('busReportView').style.display='none';
  document.getElementById('busServiceView').style.display='block';
  document.getElementById('busServiceView').scrollTop=0;
  var _bkLvl=getAccessLevel(currentUser?currentUser.role:'');
  var _bkWrap=document.getElementById('bsBulkBannerWrap');
  if(_bkWrap)_bkWrap.style.display=(_bkLvl==='leader'||_bkLvl==='admin')?'block':'none';
  var draft=loadBsDraft(); if(draft){offerBsDraftRestore(draft);}
  var btn=document.getElementById('bsSubmitBtn'); if(btn)btn.textContent='Göndər';
  if(bsNextTicketId){
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(bsNextTicketId)+'</span>';
  } else {
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#B0C4E0;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">yüklənir...</span>';
  }
  loadFastTicketIds();
  if(!bsFormData || !bsFormData.carriers){ loadBusFormData(); }
}

function loadBusFormData(){
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status!=='OK')return;
    bsFormData=d;
    if(!bsNextTicketId) bsNextTicketId = d.nextTicketId||'BUS-00001';
    // Yeni siyahılar gələndə açıq dropdown-ları da yenilə — köhnə şablonlar görünməsin.
    if(typeof renderAllDDs==='function') renderAllDDs();
  })
  .catch(function(){
    bsFormData={
      carriers:['BakuBus MMC','Xaliq Faiqoğlu MMC','Çinar-Trans MMC','General Auto Company MMC','ENA Transport MMC','Transkontrol MMC','Vətən-Az MMC','Vətən MMC','K-Group MMC','AYNA - Monitoring'],
      busModels:['BMC','BYD','Daewoo','Isuzu','Karsan','Otokar','Iveco','King-Long','Dragon','Digər'],
      busProblems:['Validator ödəniş kartını qəbul etmir','Validator açılmır','Validator elektrik almır','Digər'],
      solutions:['Validator dəyişdirildi','Problem aşkar olunmadı','Elektrik söndürülüb-yandırıldı','Digər'],
      systems:['LIT','LIT-2'],
      locations:['Daşıyıcı qarajı','Son dayanacaq','Dayanacaq','Digər'],
      technicians:['Tural Əmmədov','Amil İbrahimov','Rövşən Nurəhmədov','Sənan Nuriyev','Surxay Qasımov','Hikmət Musazadə'],
      leaders:['Mustafa Salmanov','Ramil İbrahimov','Elvin Şamilov','Vüsal Məmmədov','Toğrul Əliyev','Nazim Dinavasov']
    };
    if(!bsEditMode && !bsNextTicketId){ document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#6B7280;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">OFFLINE</span>'; }
  });
}

function setDDValue(key,value){
  if(!value)return; var meta=ddMeta[key]; if(!meta)return;
  bsSelected[key]=value;
  var lblEl=document.getElementById(meta.lbl);
  if(!lblEl) return;
  if(lblEl.tagName==='INPUT'){ lblEl.value=value; }
  else { lblEl.textContent=value; lblEl.style.color='#12233B'; lblEl.style.fontSize='14px'; lblEl.style.fontWeight='400'; lblEl.classList.add('filled'); }
}
function setTimeLabel(which,hhmm){
  if(!hhmm)return;
  var lblId=(which==='main')?'bs_time_lbl':('bs_'+which+'_lbl');
  setTimeInputValue(lblId,hhmm);
}

function openBusServiceForEdit(ticketId){
  var ov=document.getElementById('busOpenOverlay'); ov.style.display='flex';
  // HƏMİŞƏ təzə form məlumatı çək — admin paneldə şablon dəyişilibsə, köhnə
  // bsFormData keşi istifadə olunmasın (köhnə siyahılar görünməsin).
  var ensureFormData=
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK'){bsFormData=d;bsNextTicketId=d.nextTicketId||bsNextTicketId;} return bsFormData; })
    .catch(function(){ return bsFormData; }); // şəbəkə xətası olarsa, keşlə davam et
  ensureFormData.then(function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getServiceById',ticketId:ticketId})}).then(function(r){return r.json();});
  }).then(function(d){
    ov.style.display='none';
    if(d.status!=='OK'){ alert(d.message||'Ticket yüklənə bilmədi'); return; }
    bsEditMode=true; bsEditTicketId=ticketId; bsReturnTarget='report';
    resetBusFormFields();
    document.getElementById('dashboardView').style.display='none';
    document.getElementById('busReportView').style.display='none';
    document.getElementById('busServiceView').style.display='block';
    document.getElementById('busServiceView').scrollTop=0;
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#D97706;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">REDAKTƏ: '+escapeHtml(d.ticketId)+'</span>';
    var btn=document.getElementById('bsSubmitBtn'); if(btn)btn.textContent='Yadda saxla';
    document.getElementById('bs_date').value=d.report_date_raw||'';
    document.getElementById('bs_requester').value=d.requester_name||'';
    document.getElementById('bs_phone').value=d.requester_phone||'';
    document.getElementById('bs_route').value=d.route_number||'';
    document.getElementById('bs_busid').value=d.bus_id||'';
    document.getElementById('bs_plate').value=d.license_plate||'';
    bsSelected.oldSn = d.old_sn ? String(d.old_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    bsSelected.newSn = d.new_sn ? String(d.new_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    if(typeof busSnRenderChips==='function'){ busSnRenderChips('old'); busSnRenderChips('new'); }
    document.getElementById('bs_note').value=d.note||'';
    document.getElementById('bs_location_note').value=d.service_location_note||'';
    setTimeLabel('main',d.report_time); setTimeLabel('start',d.service_start_time); setTimeLabel('end',d.service_end_time);
    setDDValue('carrier',d.carrier); setDDValue('brand',d.brand_model);
    setDDValue('problem',d.problem); setDDValue('location',d.service_location);
    setDDValue('tech1',d.technician_1); if(d.technician_2)setDDValue('tech2',d.technician_2); setDDValue('leader',d.team_leader);
    bsSelected.solution=Array.isArray(d.solution)?d.solution.slice():[];
    updateMultiLabel('solution'); updateSolutionChips();
    document.getElementById('bs_location_note_wrap').style.display=(d.service_location||'').toLowerCase().indexOf('digər')!==-1?'block':'none';
    bsFormDirty=false;
  }).catch(function(){ ov.style.display='none'; alert('Şəbəkə xətası: ticket yüklənə bilmədi'); });
}

// Seçilən həllərin QISA HƏLLƏRİNİ (BUS_SOLUTIONS C sütunu = Service_Category)
// qaytarır — Q sütunu üçün. Həllin qısa həlli yoxdursa, həllin özü yazılır.
// Təkrarlananlar bir dəfə sayılır.
function deriveShortSolutions(){
  var cats=(bsFormData&&bsFormData.solutionCategories)||{};
  var seen={}, out=[];
  (bsSelected.solution||[]).forEach(function(s){
    var v=String(cats[s]||'').trim()||s;
    if(v&&!seen[v]){ seen[v]=1; out.push(v); }
  });
  return out;
}

function submitBusService(){
  if(!document.getElementById('bs_date').value){alert('Tarix daxil edin');return;}
  if(getTimeValue()===''){alert('Saat seçin');return;}
  if(!document.getElementById('bs_requester').value.trim()){alert('Müraciət edəni daxil edin');return;}
  if(!document.getElementById('bs_plate').value.trim()){alert('D.Q.N. daxil edin');return;}
  if(!document.getElementById('bs_busid').value.trim()){alert('BUS ID daxil edin');return;}
  if(!bsSelected.carrier){alert('Daşıyıcı şirkəti seçin');return;}
  if(!bsSelected.brand){alert('Marka/Modeli seçin');return;}
  if(!bsSelected.problem){alert('Müraciət/Problemi seçin');return;}
  if(bsSelected.problem.toLowerCase().indexOf('digər')!==-1&&!document.getElementById('bs_note').value.trim()){alert('Problem üçün qeyd yazın');return;}
  if(bsSelected.solution.length===0){alert('Həll / Açıqlama seçin');return;}
  if(typeof busSnCheckOldNewConflict==='function' && busSnCheckOldNewConflict()){ alert('Köhnə və Yeni cihaz SN eyni ola bilməz'); return; }
  if(techCheckDuplicate('tech1','tech2')){ alert('1. Texnik və 2. Texnik eyni ola bilməz'); return; }
  var startVal=getTimeInputValue('bs_start_lbl'); var endVal=getTimeInputValue('bs_end_lbl');
  if(!startVal){alert('Başlanğıc saatını seçin');return;}
  if(!endVal){alert('Bitiş saatını seçin');return;}
  if(!bsSelected.location){alert('Servis verilən ünvanı seçin');return;}
  if(bsSelected.location.toLowerCase().indexOf('digər')!==-1&&!document.getElementById('bs_location_note').value.trim()){alert('Ünvan qeydi yazın');return;}
  if(!bsSelected.leader){alert('Qrup rəhbərini seçin');return;}
  var hasDigarSol=bsSelected.solution.some(function(s){return s.toLowerCase().indexOf('digər')!==-1;});
  if(hasDigarSol&&!document.getElementById('bs_note').value.trim()){alert('Həll üçün qeyd yazın');return;}
  var data={
    report_date:document.getElementById('bs_date').value,
    report_time:getTimeValue(),
    requester_name:document.getElementById('bs_requester').value,
    requester_phone:document.getElementById('bs_phone').value,
    route_number:document.getElementById('bs_route').value,
    bus_id:document.getElementById('bs_busid').value,
    carrier:bsSelected.carrier,
    license_plate:document.getElementById('bs_plate').value,
    brand_model:bsSelected.brand,
    problem:bsSelected.problem,
    solution:bsSelected.solution,
    changed_device_type:deriveShortSolutions(), // Qısa Həllər (Q sütunu) — seçilən həllərin C-dəki qısa həlləri
    old_sn:bsSelected.oldSn.join(' | '),
    new_sn:bsSelected.newSn.join(' | '),
    service_start_time:startVal,
    service_end_time:endVal,
    service_location:bsSelected.location,
    service_location_note:document.getElementById('bs_location_note').value,
    technician_1:bsSelected.tech1,
    technician_2:bsSelected.tech2,
    team_leader:bsSelected.leader,
    note:document.getElementById('bs_note').value
  };
  var ov=document.getElementById('bsLoadingOverlay'); var sp=document.getElementById('bsSpinner');
  var tx=document.getElementById('bsLoadingText'); var ic=document.getElementById('bsSuccessIcon');
  ov.style.display='flex'; ov.classList.add('open'); sp.style.display='block'; ic.style.display='none';
  tx.textContent=bsLeaderCloseMode?'Təsdiqlənir...':(bsCompletionMode?'Tamamlanır...':(bsEditMode?'Yadda saxlanılır...':'Göndərilir...'));
  var payload = bsLeaderCloseMode
    ? {action:'leaderCompleteAndCloseTicket',ticketId:bsEditTicketId,data:data,requesterEmail:currentUser?currentUser.email:''}
    : bsCompletionMode
    ? {action:'completeTechnicianTicket',ticketId:bsEditTicketId,data:data,userEmail:currentUser?currentUser.email:''}
    : (bsEditMode?{action:'updateBusService',ticketId:bsEditTicketId,data:data,userEmail:currentUser?currentUser.email:''}:{action:'submitBusService',data:data,userEmail:currentUser?currentUser.email:''});
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(result){
    sp.style.display='none'; ic.style.display='flex';
    if(result.status==='OK'){ tx.textContent=bsLeaderCloseMode?('Təsdiqləndi və bağlandı! '+result.ticketId):(bsEditMode?('Yadda saxlanıldı! '+result.ticketId):('Göndərildi! '+result.ticketId)); }
    else { tx.textContent='Xəta baş verdi'; }
    setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; if(result.status==='OK'){ bsFormDirty=false; if(!bsEditMode)clearBsDraft(); var wasEdit=bsEditMode; bsGoBack(); if(wasEdit)loadReportData(); } },1800);
  }).catch(function(){ sp.style.display='none'; tx.textContent='Şəbəkə xətası'; setTimeout(function(){ov.classList.remove('open');ov.style.display='none';},1500); });
}

function openTechComplete(ticketId){
  var ov=document.getElementById('busOpenOverlay'); ov.style.display='flex';
  // HƏMİŞƏ təzə form məlumatı çək — admin dəyişiklikləri köhnə bsFormData-da görünməz.
  var ensureFormData=
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK'){bsFormData=d;} return bsFormData; })
    .catch(function(){ return bsFormData; }); // şəbəkə xətası olarsa, keşlə davam et
  ensureFormData.then(function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getServiceById',ticketId:ticketId})}).then(function(r){return r.json();});
  }).then(function(d){
    ov.style.display='none';
    if(d.status!=='OK'){ alert(d.message||'Ticket yüklənə bilmədi'); return; }
    bsEditMode=true; bsEditTicketId=ticketId; bsReturnTarget='report';
    resetBusFormFields();
    bsCompletionMode=true;
    document.getElementById('dashboardView').style.display='none';
    document.getElementById('busReportView').style.display='none';
    document.getElementById('busServiceView').style.display='block';
    document.getElementById('busServiceView').scrollTop=0;
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#D97706;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">SERVİSİ TAMAMLA: '+escapeHtml(d.ticketId)+'</span>';
    var btn=document.getElementById('bsSubmitBtn'); if(btn)btn.textContent='Tamamla';
    document.getElementById('bs_date').value=d.report_date_raw||'';
    document.getElementById('bs_requester').value=d.requester_name||'';
    document.getElementById('bs_phone').value=d.requester_phone||'';
    document.getElementById('bs_route').value=d.route_number||'';
    document.getElementById('bs_busid').value=d.bus_id||'';
    document.getElementById('bs_plate').value=d.license_plate||'';
    bsSelected.oldSn = d.old_sn ? String(d.old_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    bsSelected.newSn = d.new_sn ? String(d.new_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    if(typeof busSnRenderChips==='function'){ busSnRenderChips('old'); busSnRenderChips('new'); }
    document.getElementById('bs_note').value=d.note||'';
    document.getElementById('bs_location_note').value=d.service_location_note||'';
    setTimeLabel('main',d.report_time); setTimeLabel('start',d.service_start_time); setTimeLabel('end',d.service_end_time);
    setDDValue('carrier',d.carrier); setDDValue('brand',d.brand_model);
    setDDValue('problem',d.problem); setDDValue('location',d.service_location);
    setDDValue('tech1',d.technician_1); if(d.technician_2)setDDValue('tech2',d.technician_2); setDDValue('leader',d.team_leader);
    bsSelected.solution=Array.isArray(d.solution)?d.solution.slice():[];
    updateMultiLabel('solution'); updateSolutionChips();
    document.getElementById('bs_location_note_wrap').style.display=(d.service_location||'').toLowerCase().indexOf('digər')!==-1?'block':'none';
    bsFormDirty=false;
    bsLockStage1Fields(true);
  }).catch(function(){ ov.style.display='none'; alert('Şəbəkə xətası: ticket yüklənə bilmədi'); });
}

// Stage-1 sahələr (Müraciət/Avtobus məlumatları + Problem) — texnik tamamlama rejimində
// dəyişdirilə bilməz, yalnız baxış üçün göstərilir. Solution/SN/Servis vaxtı-yeri/Texnik/Rəhbər redaktə olunandır.
var BS_STAGE1_LOCKABLE_IDS=['bs_date','bs_time_lbl','bs_requester','bs_phone','bs_plate','bs_busid','bs_route','bs_carrier_btn','bs_brand_btn','bs_problem_btn'];
// Leader/Admin "Davam Edən Servislər"dən açır — texnikdən fərqli olaraq
// BÜTÜN sahələr redaktə oluna bilir (səhv düzəltmək üçün), submit edəndə
// ticket birbaşa TAMAMLANIR və bağlanır (leaderCompleteAndCloseTicket).
function openLeaderComplete(ticketId){
  var ov=document.getElementById('busOpenOverlay'); ov.style.display='flex';
  // HƏMİŞƏ təzə form məlumatı çək — admin dəyişiklikləri köhnə bsFormData-da görünməz.
  var ensureFormData=
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK'){bsFormData=d;} return bsFormData; })
    .catch(function(){ return bsFormData; }); // şəbəkə xətası olarsa, keşlə davam et
  ensureFormData.then(function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getServiceById',ticketId:ticketId})}).then(function(r){return r.json();});
  }).then(function(d){
    ov.style.display='none';
    if(d.status!=='OK'){ alert(d.message||'Ticket yüklənə bilmədi'); return; }
    bsEditMode=true; bsEditTicketId=ticketId; bsReturnTarget='ongoing';
    resetBusFormFields();
    bsLeaderCloseMode=true;
    document.getElementById('dashboardView').style.display='none';
    document.getElementById('busOngoingView').style.display='none';
    document.getElementById('busServiceView').style.display='block';
    document.getElementById('busServiceView').scrollTop=0;
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#188A4B;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">TƏSDİQLƏ VƏ BAĞLA: '+escapeHtml(d.ticketId)+'</span>';
    var btn=document.getElementById('bsSubmitBtn'); if(btn)btn.textContent='Təsdiqlə və Bağla';
    document.getElementById('bs_date').value=d.report_date_raw||'';
    document.getElementById('bs_requester').value=d.requester_name||'';
    document.getElementById('bs_phone').value=d.requester_phone||'';
    document.getElementById('bs_route').value=d.route_number||'';
    document.getElementById('bs_busid').value=d.bus_id||'';
    document.getElementById('bs_plate').value=d.license_plate||'';
    bsSelected.oldSn = d.old_sn ? String(d.old_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    bsSelected.newSn = d.new_sn ? String(d.new_sn).split(' | ').map(function(s){return s.trim();}).filter(Boolean) : [];
    if(typeof busSnRenderChips==='function'){ busSnRenderChips('old'); busSnRenderChips('new'); }
    document.getElementById('bs_note').value=d.note||'';
    document.getElementById('bs_location_note').value=d.service_location_note||'';
    setTimeLabel('main',d.report_time); setTimeLabel('start',d.service_start_time); setTimeLabel('end',d.service_end_time);
    setDDValue('carrier',d.carrier); setDDValue('brand',d.brand_model);
    setDDValue('problem',d.problem); setDDValue('location',d.service_location);
    setDDValue('tech1',d.technician_1); if(d.technician_2)setDDValue('tech2',d.technician_2); setDDValue('leader',d.team_leader);
    bsSelected.solution=Array.isArray(d.solution)?d.solution.slice():[];
    updateMultiLabel('solution'); updateSolutionChips();
    document.getElementById('bs_location_note_wrap').style.display=(d.service_location||'').toLowerCase().indexOf('digər')!==-1?'block':'none';
    bsFormDirty=false;
    // DİQQƏT: Leader/Admin üçün Stage-1 sahələr KİLİDLƏNMİR — bütün formu redaktə edə bilər
  }).catch(function(){ ov.style.display='none'; alert('Şəbəkə xətası: ticket yüklənə bilmədi'); });
}

function bsLockStage1Fields(lock){
  BS_STAGE1_LOCKABLE_IDS.forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    el.disabled=lock;
    el.classList.toggle('bs-field-locked', lock);
  });
  var resetBtn=document.getElementById('bs_registry_reset');
  if(resetBtn) resetBtn.style.display = lock ? 'none' : resetBtn.style.display;
}

var bsConfirmMode = 'busService';
function attemptBusHome(){ bsConfirmMode='busService'; if(bsFormDirty){var co=document.getElementById('bsConfirmOverlay'); co.style.display='flex'; co.classList.add('open');}else{bsGoBack();} }
function closeConfirm(){ var co=document.getElementById('bsConfirmOverlay'); co.classList.remove('open'); co.style.display='none'; }
function confirmExit(){
  var co=document.getElementById('bsConfirmOverlay'); co.classList.remove('open'); co.style.display='none';
  if(bsConfirmMode==='busRequest'){
    brFormDirty=false;
    closeBusRequest();
    return;
  }
  if(bsConfirmMode==='busBulk'){
    bkFormDirty=false;
    closeBusBulk();
    return;
  }
  if(!bsEditMode)clearBsDraft();
  var ov=document.getElementById('bsLoadingOverlay'); var sp=document.getElementById('bsSpinner');
  var tx=document.getElementById('bsLoadingText'); var ic=document.getElementById('bsSuccessIcon');
  ov.style.display='flex'; ov.classList.add('open'); sp.style.display='block'; ic.style.display='none'; tx.textContent='Gözləyin...';
  setTimeout(function(){ov.classList.remove('open');ov.style.display='none';bsGoBack();},900);
}
function bsGoBack(){
  closeAllDD(); document.getElementById('busServiceView').style.display='none';
  if(bsReturnTarget==='report'){document.getElementById('busReportView').style.display='flex';}
  else if(bsReturnTarget==='ongoing'){
    document.getElementById('busOngoingView').style.display='flex';
    if(typeof loadOngoingData==='function') loadOngoingData();
  }
  else{document.getElementById('dashboardView').style.display='block';}
  bsEditMode=false; bsEditTicketId=null; bsReturnTarget='dashboard';
}

// ═══════════════════════════════════════════════════
// DQN REYESTR AXTARIŞI - DÜZƏLDİLMİŞ VERSİYA
// ═══════════════════════════════════════════════════

var bsRegistryLocked = false;

function normalizeDqn(s){
  return String(s||"").toUpperCase().replace(/[^0-9A-Z]/g,'');
}

function filterBusRegistry(query){
  var reg = (bsFormData && bsFormData.busRegistry) || [];
  if(!query || query.length < 2) return [];
  var q = query.toUpperCase().replace(/\s/g,'');
  return reg.filter(function(r){
    var dqn = String(r.dqn || "").toUpperCase().replace(/\s/g,'');
    return dqn.indexOf(q) !== -1;
  });
}

function renderBusRegistryDropdown(matches){
  var dd = document.getElementById('bs_registry_dd');
  if(!dd) return;
  
  if(!matches || matches.length === 0){
    dd.innerHTML = '<div class="bs-registry-empty">Uyğun D.Q.N. tapılmadı — məlumatları əl ilə daxil edin</div>';
  } else {
    dd.innerHTML = matches.slice(0, 8).map(function(m){
      // FAZA 2 (XSS): reyestr məlumatları istifadəçi tərəfindən yazılır — hamısı escape olunur
      var dqnE = escapeHtml(m.dqn || '');
      var idE = escapeHtml(m.id || '');
      var carrierE = escapeHtml(m.carrier || '');
      var modelE = escapeHtml(m.model || '');
      return '<div class="bs-registry-item" data-dqn="' + dqnE + '" data-id="' + idE + '" data-carrier="' + carrierE + '" data-model="' + modelE + '">' +
        '<span class="reg-id">' + (dqnE || '—') + '</span>' +
        '<span class="reg-meta">BUS ID: ' + (idE || '—') + ' · ' + (carrierE || '—') + ' · ' + (modelE || '—') + '</span>' +
        '</div>';
    }).join('');
    
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation();
        var match = {
          dqn: el.getAttribute('data-dqn'),
          id: el.getAttribute('data-id'),
          carrier: el.getAttribute('data-carrier'),
          model: el.getAttribute('data-model')
        };
      
        if(match.dqn) selectBusRegistryMatch(match);
      });
    });
  }
  dd.classList.add('open');
}

function selectBusRegistryMatch(match){

  
  var plateEl = document.getElementById('bs_plate');
  var busidEl = document.getElementById('bs_busid');
  if(plateEl) plateEl.value = match.dqn || '';
  if(busidEl) busidEl.value = match.id || '';
  
  unlockRegistryFields();
  
  if(match.carrier){
    var cleanCarrier = match.carrier.replace(/^"|"$/g, '').trim();

    
    bsSelected.carrier = cleanCarrier;
    
    var cLbl = document.getElementById('bs_carrier_lbl');
    if(cLbl){
      cLbl.textContent = cleanCarrier;
      cLbl.style.color = '#12233B';
      cLbl.classList.add('filled');
    }
    
    var cBtn = document.getElementById('bs_carrier_btn');
    if(cBtn){
      var span = cBtn.querySelector('span');
      if(span){
        span.textContent = cleanCarrier;
        span.style.color = '#12233B';
        span.classList.add('filled');
      }
      cBtn.classList.add('filled');
    }
  }
  
  if(match.model){

    bsSelected.brand = match.model;
    
    var bLbl = document.getElementById('bs_brand_lbl');
    if(bLbl){
      bLbl.textContent = match.model;
      bLbl.style.color = '#12233B';
      bLbl.classList.add('filled');
    }
    
    var bBtn = document.getElementById('bs_brand_btn');
    if(bBtn){
      var span = bBtn.querySelector('span');
      if(span){
        span.textContent = match.model;
        span.style.color = '#12233B';
        span.classList.add('filled');
      }
      bBtn.classList.add('filled');
    }
  }
  
  closeBusRegistryDD();
  lockRegistryFields();
  bsFormDirty = true;
  scheduleBsDraftSave();
  

}
  
function lockRegistryFields(){
  bsRegistryLocked = true;
  var busidEl = document.getElementById('bs_busid');
  if(busidEl){
    busidEl.classList.add('bs-locked');
    busidEl.setAttribute('readonly', 'readonly');
  }
  var carrierBtn = document.getElementById('bs_carrier_btn');
  var brandBtn = document.getElementById('bs_brand_btn');
  if(carrierBtn) carrierBtn.classList.add('bs-locked');
  if(brandBtn) brandBtn.classList.add('bs-locked');
  
  var resetEl = document.getElementById('bs_registry_reset');
  if(resetEl) resetEl.classList.add('show');
}

function unlockRegistryFields(){
  bsRegistryLocked = false;
  var busidEl = document.getElementById('bs_busid');
  if(busidEl){
    busidEl.classList.remove('bs-locked');
    busidEl.removeAttribute('readonly');
  }
  var carrierBtn = document.getElementById('bs_carrier_btn');
  var brandBtn = document.getElementById('bs_brand_btn');
  if(carrierBtn) carrierBtn.classList.remove('bs-locked');
  if(brandBtn) brandBtn.classList.remove('bs-locked');
  
  var resetEl = document.getElementById('bs_registry_reset');
  if(resetEl) resetEl.classList.remove('show');
}

function resetRegistrySelection(){
  var plateEl = document.getElementById('bs_plate');
  var busidEl = document.getElementById('bs_busid');
  if(plateEl) plateEl.value = '';
  if(busidEl) busidEl.value = '';
  
  bsSelected.carrier = '';
  var cLbl = document.getElementById('bs_carrier_lbl');
  if(cLbl){
    cLbl.textContent = 'Seçin';
    cLbl.style.color = '#9AACC4';
    cLbl.classList.remove('filled');
  }
  
  bsSelected.brand = '';
  var bLbl = document.getElementById('bs_brand_lbl');
  if(bLbl){
    bLbl.textContent = 'Seçin';
    bLbl.style.color = '#9AACC4';
    bLbl.classList.remove('filled');
  }
  
  unlockRegistryFields();
  closeBusRegistryDD();
  bsFormDirty = true;
  scheduleBsDraftSave();
}

document.addEventListener('click', function(e){
  if(!e.target.closest('.bs-busid-wrap')){
    closeBusRegistryDD();
  }
});

document.addEventListener('DOMContentLoaded', function(){
  var brPlateEl = document.getElementById('br_plate');
  if(!brPlateEl) return;

  brPlateEl.addEventListener('input', function(e){
    var raw = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if(raw.length > 8) raw = raw.slice(0, 8);
    var res = '';
    if(raw.length <= 2){
      res = raw.replace(/[^0-9]/g, '').slice(0, 2);
    } else if(raw.length <= 4){
      var d1 = raw.slice(0, 2).replace(/[^0-9]/g, '');
      var l = raw.slice(2).replace(/[^A-Z]/g, '').slice(0, 2);
      res = d1 + (d1.length === 2 ? '-' : '') + l;
    } else {
      var d1b = raw.slice(0, 2).replace(/[^0-9]/g, '');
      var l2 = raw.slice(2, 4).replace(/[^A-Z]/g, '').slice(0, 2);
      var d2 = raw.slice(4).replace(/[^0-9]/g, '').slice(0, 3);
      res = d1b;
      if(d1b.length === 2) res += '-';
      res += l2;
      if(l2.length === 2) res += '-';
      res += d2;
    }
    e.target.value = res;
    e.target.setSelectionRange(res.length, res.length);
    brFormDirty = true;

    if(res.replace(/[^0-9A-Z]/g, '').length >= 2){
      brRenderRegistryDropdown(brFilterRegistry(res));
    } else {
      brCloseRegistryDD();
    }
  });

  brPlateEl.addEventListener('focus', function(){
    var v = this.value;
    if(v.replace(/[^0-9A-Z]/g, '').length >= 2){
      brRenderRegistryDropdown(brFilterRegistry(v));
    }
  });

  brPlateEl.addEventListener('paste', function(){
    setTimeout(function(){ brPlateEl.dispatchEvent(new Event('input')); }, 0);
  });
});

document.addEventListener('DOMContentLoaded', function(){
  var plateEl = document.getElementById('bs_plate');
  if(!plateEl) return;

  plateEl.addEventListener('input', function(e){
    if(bsRegistryLocked) unlockRegistryFields();
    
    var raw = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if(raw.length > 8) raw = raw.slice(0, 8);
    var res = '';
    if(raw.length <= 2){
      res = raw.replace(/[^0-9]/g, '').slice(0, 2);
    } else if(raw.length <= 4){
      var d1 = raw.slice(0, 2).replace(/[^0-9]/g, '');
      var l = raw.slice(2).replace(/[^A-Z]/g, '').slice(0, 2);
      res = d1 + (d1.length === 2 ? '-' : '') + l;
    } else {
      var d1 = raw.slice(0, 2).replace(/[^0-9]/g, '');
      var l = raw.slice(2, 4).replace(/[^A-Z]/g, '').slice(0, 2);
      var d2 = raw.slice(4).replace(/[^0-9]/g, '').slice(0, 3);
      res = d1;
      if(d1.length === 2) res += '-';
      res += l;
      if(l.length === 2) res += '-';
      res += d2;
    }
    e.target.value = res;
    e.target.setSelectionRange(res.length, res.length);
    bsFormDirty = true;
    scheduleBsDraftSave();

    if(res.replace(/[^0-9A-Z]/g, '').length >= 2){
      renderBusRegistryDropdown(filterBusRegistry(res));
    } else {
      closeBusRegistryDD();
    }
  });

  plateEl.addEventListener('focus', function(){
    var v = this.value;
    if(v.replace(/[^0-9A-Z]/g, '').length >= 2 && !bsRegistryLocked){
      renderBusRegistryDropdown(filterBusRegistry(v));
    }
  });

  plateEl.addEventListener('paste', function(){
    setTimeout(function(){ plateEl.dispatchEvent(new Event('input')); }, 0);
  });
});

document.addEventListener('DOMContentLoaded', function(){
  var busidEl = document.getElementById('bs_busid');
  if(busidEl){
    busidEl.addEventListener('input', function(){
      this.value = this.value.replace(/[^0-9]/g, '').slice(0, 5);
      bsFormDirty = true;
      scheduleBsDraftSave();
    });
  }
});

document.addEventListener('DOMContentLoaded', function(){
  var routeEl = document.getElementById('bs_route');
  if(routeEl){
    routeEl.addEventListener('input', function(){
      var pos = this.selectionStart;
      this.value = this.value.toUpperCase();
      this.setSelectionRange(pos, pos);
      bsFormDirty = true;
    });
  }
});

document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter') return;
  var view = document.getElementById('busServiceView');
  if(!view || view.style.display === 'none') return;
  var active = document.activeElement;
  if(!active || !view.contains(active)) return;
  if(active.tagName === 'BUTTON' || active.tagName === 'TEXTAREA') return;
  e.preventDefault();
  var focusable = Array.from(view.querySelectorAll('input:not([type=hidden]), select, textarea, button:not([tabindex="-1"])')).filter(function(el){ return !el.disabled && el.offsetParent !== null; });
  var idx = focusable.indexOf(active);
  if(idx !== -1 && idx < focusable.length - 1) focusable[idx + 1].focus();
});

function bsDraftKey(){ return 'ctech_bs_draft'; }
function saveBsDraft(){
  if(bsEditMode) return;
  try{
    var draft = {
      date: (document.getElementById('bs_date') || {}).value || '',
      time: (document.getElementById('bs_time_lbl') || {}).value || '',
      requester: (document.getElementById('bs_requester') || {}).value || '',
      phone: (document.getElementById('bs_phone') || {}).value || '',
      route: (document.getElementById('bs_route') || {}).value || '',
      busid: (document.getElementById('bs_busid') || {}).value || '',
      plate: (document.getElementById('bs_plate') || {}).value || '',
      start: (document.getElementById('bs_start_lbl') || {}).value || '',
      end: (document.getElementById('bs_end_lbl') || {}).value || '',
      note: (document.getElementById('bs_note') || {}).value || '',
      locationNote: (document.getElementById('bs_location_note') || {}).value || '',
      selected: bsSelected,
      savedAt: Date.now()
    };
    localStorage.setItem(bsDraftKey(), JSON.stringify(draft));
  } catch(e){}
}
var bsDraftSaveTimer = null;
function scheduleBsDraftSave(){ if(bsDraftSaveTimer) clearTimeout(bsDraftSaveTimer); bsDraftSaveTimer = setTimeout(saveBsDraft, 500); }
function clearBsDraft(){ try{ localStorage.removeItem(bsDraftKey()); } catch(e){} }
function loadBsDraft(){
  try{
    var raw = localStorage.getItem(bsDraftKey());
    if(!raw) return null;
    var d = JSON.parse(raw);
    var hasContent = d.requester || d.phone || d.route || d.busid || d.plate || d.note || (d.selected && (d.selected.carrier || d.selected.brand || d.selected.problem || (d.selected.solution && d.selected.solution.length) || (d.selected.oldSn && d.selected.oldSn.length) || (d.selected.newSn && d.selected.newSn.length)));
    return hasContent ? d : null;
  } catch(e){ return null; }
}
function restoreBsDraft(draft){
  if(draft.date) document.getElementById('bs_date').value = draft.date;
  setTimeInputValue('bs_time_lbl', draft.time);
  document.getElementById('bs_requester').value = draft.requester || '';
  document.getElementById('bs_phone').value = draft.phone || '';
  document.getElementById('bs_route').value = draft.route || '';
  document.getElementById('bs_busid').value = draft.busid || '';
  document.getElementById('bs_plate').value = draft.plate || '';
  setTimeInputValue('bs_start_lbl', draft.start);
  setTimeInputValue('bs_end_lbl', draft.end);
  document.getElementById('bs_note').value = draft.note || '';
  document.getElementById('bs_location_note').value = draft.locationNote || '';
  bsSelected = draft.selected || bsSelected;
  if(!bsSelected.oldSn) bsSelected.oldSn=[];
  if(!bsSelected.newSn) bsSelected.newSn=[];
  if(typeof busSnRenderChips==='function'){ busSnRenderChips('old'); busSnRenderChips('new'); }
  Object.keys(ddMeta).forEach(function(k){
    if(k === 'solution'){
      updateMultiLabel('solution');
      updateSolutionChips();
    } else if(bsSelected[k]){
      setDDValue(k, bsSelected[k]);
    }
  });
  document.getElementById('bs_location_note_wrap').style.display = (bsSelected.location || '').toLowerCase().indexOf('digər') !== -1 ? 'block' : 'none';
  bsFormDirty = true;
}
document.addEventListener('DOMContentLoaded', function(){
  var inputs = document.querySelectorAll('#busServiceView input, #busServiceView select, #busServiceView textarea');
  inputs.forEach(function(el){
    el.addEventListener('input', function(){ bsFormDirty = true; scheduleBsDraftSave(); });
    el.addEventListener('change', function(){ bsFormDirty = true; scheduleBsDraftSave(); });
  });
});

