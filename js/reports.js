// ═══════════════════════════════════════════════════════════════
// REPORTS.JS — Bus/TVM Reports, Ongoing, Dashboard Stats
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// BUS REAL-TIME REPORT
// ═══════════════════════════════════════════════════
var rptAllRows=[], rptColumns=[], rptFiltered=[], rptShownCount=20, rptPageSize=20, rptAutoRefresh=null;
var RPT_SEARCH_FIELDS=['Ticket ID','Tarix','D.Q.N.','BUS ID','Daşıyıcı'];
var rptServiceTypeFilter='all';
function setRptServiceTypeFilter(type, btn){
  rptServiceTypeFilter=type;
  document.querySelectorAll('#rptTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  if(btn) btn.classList.add('rpt-type-btn-active');
  rptShownCount=rptPageSize;
  applyFilters();
}
function rptMatchesServiceType(row){
  if(rptServiceTypeFilter==='all') return true;
  var t=(row['Xidmət Növü']||'').toLowerCase();
  if(rptServiceTypeFilter==='individual') return t.indexOf('fərdi')!==-1;
  if(rptServiceTypeFilter==='bulk') return t.indexOf('toplu')!==-1;
  return true;
}

function updateRptDate(){
  var dEl=document.getElementById('rptDateBox');
  var tEl=document.getElementById('rptClockBox');
  if(!dEl||!tEl) return;
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
  var map={}; parts.forEach(function(p){ map[p.type]=p.value; });
  dEl.textContent=map.day+'.'+map.month+'.'+map.year;
  tEl.textContent=map.hour+':'+map.minute+':'+map.second;
}
var rptDateInterval=null;

function openBusReport(forceOpenOnly){
  document.getElementById('dashboardView').style.display='none';
  var view=document.getElementById('busReportView');
  view.style.display='flex';
  document.getElementById('rptGlobalSearch').value='';
  rptServiceTypeFilter='all';
  rptForceOpenOnly=!!forceOpenOnly;
  rptDaysBack=90;
  var daysSel=document.getElementById('rptDaysBackSelect'); if(daysSel) daysSel.value='90';
  document.querySelectorAll('#rptTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  var allBtn=document.querySelector('#rptTypeFilter [data-type="all"]'); if(allBtn) allBtn.classList.add('rpt-type-btn-active');
  document.getElementById('rptExcelBtn').style.display=(getAccessLevel(currentUser.role)==='technician')?'none':'flex';
  var thBusIdEarly=document.getElementById('rptThBusId'); if(thBusIdEarly) thBusIdEarly.textContent = rptIsTechnicianView() ? 'Status' : 'BUS ID';
  rptShownCount=rptPageSize;
  updateRptDate();
  if(rptDateInterval) clearInterval(rptDateInterval);
  rptDateInterval=setInterval(updateRptDate,1000);
  loadReportData();
  if(rptAutoRefresh) clearInterval(rptAutoRefresh);
  rptAutoRefresh=setInterval(loadReportData,120000);
}
// ═══════════════════════════════════════════════════════════════
// DAVAM EDƏN SERVİS — ayrıca, müstəqil pəncərə (yalnız veb).
// Bus Real-Time Report ilə eyni struktur/düymələr, AMMA HƏMİŞƏ
// yalnız Status="Açıq" olan ticketləri göstərir.
// ═══════════════════════════════════════════════════════════════
var ongAllRows=[], ongColumns=[], ongFiltered=[], ongShownCount=20, ongPageSize=20, ongAutoRefresh=null, ongDateInterval=null;
var ongServiceTypeFilter='all';

function openBusOngoing(){
  closeMenu();
  document.getElementById('dashboardView').style.display='none';
  var view=document.getElementById('busOngoingView');
  view.style.display='flex';
  document.getElementById('ongGlobalSearch').value='';
  ongServiceTypeFilter='all';
  document.querySelectorAll('#ongTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  var allBtn=document.querySelector('#ongTypeFilter [data-type="all"]'); if(allBtn) allBtn.classList.add('rpt-type-btn-active');
  document.getElementById('ongExcelBtn').style.display=(getAccessLevel(currentUser.role)==='technician')?'none':'flex';
  ongShownCount=ongPageSize;
  updateOngDate();
  if(ongDateInterval) clearInterval(ongDateInterval);
  ongDateInterval=setInterval(updateOngDate,1000);
  loadOngoingData();
  if(ongAutoRefresh) clearInterval(ongAutoRefresh);
  ongAutoRefresh=setInterval(loadOngoingData,120000);
}
function closeBusOngoing(){
  if(ongAutoRefresh){ clearInterval(ongAutoRefresh); ongAutoRefresh=null; }
  if(ongDateInterval){ clearInterval(ongDateInterval); ongDateInterval=null; }
  document.getElementById('busOngoingView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}
function updateOngDate(){
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
  var map={}; parts.forEach(function(p){map[p.type]=p.value;});
  var d=document.getElementById('ongDateBox'); if(d) d.textContent=map.day+'.'+map.month+'.'+map.year;
  var c=document.getElementById('ongClockBox'); if(c) c.textContent=map.hour+':'+map.minute+':'+map.second;
}

function loadOngoingData(){
  document.getElementById('ongTableBody').innerHTML='<tr><td colspan="7"><div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Yüklənir...</span></div></td></tr>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData', daysBack:0})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){
      document.getElementById('ongTableBody').innerHTML='<tr><td colspan="7"><div class="rpt-empty">Xəta: '+(d.message||'məlumat gəlmədi')+'</div></td></tr>';
      return;
    }
    ongAllRows=(d.rows||[]).filter(function(row){
      var st=(row['Status']||'').trim();
      return st==='Təhkim Edildi' || st==='Texnik Tamamladı';
    }).sort(function(a,b){ return rptSortKey(b)-rptSortKey(a); });
    ongColumns=d.columns||[];
    applyOngoingFilters();
  }).catch(function(e){
    document.getElementById('ongTableBody').innerHTML='<tr><td colspan="7"><div class="rpt-empty">Şəbəkə xətası: '+e.message+'</div></td></tr>';
  });
}
var ongSearchDebounceTimer=null;
function applyOngoingFiltersDebounced(){ clearTimeout(ongSearchDebounceTimer); ongSearchDebounceTimer=setTimeout(applyOngoingFilters,180); }
function applyOngoingFilters(){
  var q=(document.getElementById('ongGlobalSearch').value||'').toLowerCase().trim();
  ongShownCount=ongPageSize;
  ongFiltered=ongAllRows.filter(function(row){
    if(ongServiceTypeFilter!=='all'){
      var t=(row['Xidmət Növü']||'').toLowerCase();
      if(ongServiceTypeFilter==='individual' && t.indexOf('fərdi')===-1) return false;
      if(ongServiceTypeFilter==='bulk' && t.indexOf('toplu')===-1) return false;
    }
    if(!q) return true;
    for(var i=0;i<RPT_SEARCH_FIELDS.length;i++){
      var f=RPT_SEARCH_FIELDS[i];
      if((row[f]||'').toLowerCase().indexOf(q)!==-1) return true;
    }
    return false;
  });
  renderOngoingTable();
}
function setOngServiceTypeFilter(type, btn){
  ongServiceTypeFilter=type;
  document.querySelectorAll('#ongTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  if(btn) btn.classList.add('rpt-type-btn-active');
  applyOngoingFilters();
}
function ongStatusBadge(status){
  var cls='dv-status-chip', color='#5C7089', bg='#F0F5FC', border='#DCE6F5';
  if(status==='Təhkim Edildi'){ color='#1B4A8A'; bg='#E6F1FB'; border='#CFE0F7'; }
  else if(status==='Texnik Tamamladı'){ color='#B8730A'; bg='#FFF5E6'; border='#F5D9A8'; }
  else if(status==='Açıq'){ color='#188A4B'; bg='#E5F6ED'; border='#BFE8D2'; }
  return '<span class="'+cls+'" style="color:'+color+';background:'+bg+';border:1px solid '+border+';">'+escapeHtml(status||'—')+'</span>';
}

function renderOngoingTable(){
  var body=document.getElementById('ongTableBody');
  document.getElementById('ongCount').textContent=ongFiltered.length+' nəticə';
  if(ongFiltered.length===0){
    body.innerHTML='<tr><td colspan="7"><div class="rpt-empty">Davam edən servis yoxdur</div></td></tr>';
    document.getElementById('ongLoadMoreWrap').style.display='none';
    return;
  }
  var visible=ongFiltered.slice(0,ongShownCount);
  var canApprove = getAccessLevel(currentUser.role)!=='technician';
  var html='';
  visible.forEach(function(row){
    var ticketId=escapeHtml(row['Ticket ID']||'');
    var safeId=(row['Ticket ID']||'').replace(/'/g,'');
    var status=(row['Status']||'').trim();
    var canComplete = canApprove; // Leader/Admin — istənilən aktiv statusda tamamlayıb bağlaya bilir
    html+='<tr>'
      +'<td class="rpt-td-id">'+ticketId+'</td>'
      +'<td>'+escapeHtml(row['Tarix']||'')+'</td>'
      +'<td class="rpt-td-plate">'+escapeHtml(row['D.Q.N.']||'')+'</td>'
      +'<td>'+escapeHtml(row['BUS ID']||'')+'</td>'
      +'<td class="col-carrier" title="'+escapeHtml(row['Daşıyıcı']||'')+'">'+escapeHtml(row['Daşıyıcı']||'')+'</td>'
      +'<td class="col-status">'+ongStatusBadge(status)+'</td>'
      +'<td class="col-act"><div class="rpt-row-actions">'
      +'<button class="rpt-icon-btn" onclick="openBusDetail(\''+safeId+'\')" aria-label="Baxış" title="Baxış"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
      +(canComplete?'<button class="rpt-icon-btn" style="color:#188A4B;border-color:#BFE8D2;" onclick="openLeaderComplete(\''+safeId+'\')" aria-label="Təsdiqlə və Bağla" title="Təsdiqlə və Bağla"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>':'')
      +'</div></td></tr>';
  });
  body.innerHTML=html;
  var loadMoreWrap=document.getElementById('ongLoadMoreWrap');
  if(ongFiltered.length>ongShownCount){
    document.getElementById('ongLoadMoreBtn').textContent='Daha çox göstər ('+(ongFiltered.length-ongShownCount)+')';
    loadMoreWrap.style.display='flex';
  } else {
    loadMoreWrap.style.display='none';
  }
}
function ongShowMore(){ ongShownCount+=ongPageSize; renderOngoingTable(); }

function ongApproveClose(ticketId){
  if(!confirm('Bu ticket-i təsdiqləyib bağlamaq istədiyinizə əminsiniz?')) return;
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'approveAndCloseTicket', ticketId:ticketId, requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
    loadOngoingData();
  })
  .catch(function(e){ alert('Şəbəkə xətası: '+e.message); });
}
function exportOngoingToExcel(){
  if(ongFiltered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
  var wsData=[ongColumns];
  ongFiltered.forEach(function(row){ wsData.push(ongColumns.map(function(c){ return row[c]||''; })); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Davam Edən Servis');
  var today=new Date();
  XLSX.writeFile(wb, 'Davam_Eden_Servis_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}


function closeBusReport(){
  if(rptAutoRefresh){ clearInterval(rptAutoRefresh); rptAutoRefresh=null; }
  if(rptDateInterval){ clearInterval(rptDateInterval); rptDateInterval=null; }
  document.getElementById('busReportView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}
function rptSortKey(row){
  var d=row['Tarix']||'';
  var t=row['Saat']||'00:00';
  var dp=d.split('.');
  if(dp.length!==3) return 0;
  var iso=dp[2]+'-'+dp[1]+'-'+dp[0]+'T'+(t||'00:00')+':00';
  var ts=new Date(iso).getTime();
  return isNaN(ts)?0:ts;
}
var rptDaysBack = 90;
function loadReportData(){
  document.getElementById('rptTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Yüklənir...</span></div></td></tr>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData', daysBack: rptDaysBack})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){
      document.getElementById('rptTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-empty">Xəta: '+(d.message||'məlumat gəlmədi')+'</div></td></tr>';
      return;
    }
    rptAllRows=(d.rows||[]).filter(function(row){ return (row['Status']||'').trim()==='Bağlandı'; }).sort(function(a,b){ return rptSortKey(b)-rptSortKey(a); });
    rptColumns=d.columns||[];
    var hiddenCount = (d.totalCount||0) - rptAllRows.length;
    var hintEl = document.getElementById('rptOldHint');
    if(hintEl){
      if(rptDaysBack > 0 && hiddenCount > 0){
        hintEl.innerHTML = hiddenCount+' köhnə ticket (seçilmiş dövrdən əvvəl) gizlədilib, sürəti artırmaq üçün. <a onclick="rptShowAllHistory()">Hamısını göstər</a>';
        hintEl.style.display='flex';
      } else {
        hintEl.style.display='none';
      }
    }
    applyFilters();
  }).catch(function(e){
    document.getElementById('rptTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-empty">Şəbəkə xətası: '+e.message+'</div></td></tr>';
  });
}
function rptChangeDaysBack(){
  rptDaysBack = Number(document.getElementById('rptDaysBackSelect').value) || 0;
  loadReportData();
}
function rptShowAllHistory(){
  rptDaysBack = 0;
  var sel = document.getElementById('rptDaysBackSelect'); if(sel) sel.value='0';
  loadReportData();
}
var rptSearchDebounceTimer=null;
function applyFiltersDebounced(){ clearTimeout(rptSearchDebounceTimer); rptSearchDebounceTimer=setTimeout(applyFilters,180); }
function rptIsTechnicianView(){ return getAccessLevel(currentUser.role)==='technician'; }
var rptForceOpenOnly=false;
function rptIsAssignedToMe(row){
  var myName=(currentUser.name||'').trim().toLowerCase();
  if(!myName) return false;
  var t1=(row['1. Texnik']||'').trim().toLowerCase();
  var t2=(row['2. Texnik']||'').trim().toLowerCase();
  return t1===myName || t2===myName;
}
function applyFilters(){
  var q=(document.getElementById('rptGlobalSearch').value||'').toLowerCase().trim();
  rptShownCount=rptPageSize;
  var techView=rptIsTechnicianView();
  rptFiltered=rptAllRows.filter(function(row){
    if(techView){
      // rptAllRows onsuz da yalnız "Bağlandı" ticket-lərdir (tarixçə) —
      // texnik burada yalnız ÖZÜNƏ təhkim olunmuş bağlanmış ticket-ləri görür
      if(!rptIsAssignedToMe(row)) return false;
    }
    if(!rptMatchesServiceType(row)) return false;
    if(!q) return true;
    for(var i=0;i<RPT_SEARCH_FIELDS.length;i++){
      var f=RPT_SEARCH_FIELDS[i];
      if((row[f]||'').toLowerCase().indexOf(q)!==-1) return true;
    }
    return false;
  });
  renderTable();
}
function canEditTicket(row){
  var level=getAccessLevel(currentUser.role);
  if(level==='leader'||level==='admin') return true;
  var createdBy=(row['_created_by']||'').toLowerCase().trim();
  var me=(currentUser.email||'').toLowerCase().trim();
  return createdBy&&me&&createdBy===me;
}
function renderTable(){
  var body=document.getElementById('rptTableBody');
  document.getElementById('rptCount').textContent=rptFiltered.length+' nəticə';
  if(rptFiltered.length===0){
    body.innerHTML='<tr><td colspan="6"><div class="rpt-empty">Məlumat tapılmadı</div></td></tr>';
    document.getElementById('rptLoadMoreWrap').style.display='none';
    return;
  }
  var techView=rptIsTechnicianView();
  var thBusId=document.getElementById('rptThBusId');
  if(thBusId) thBusId.textContent = techView ? 'Status' : 'BUS ID';
  var visible=rptFiltered.slice(0,rptShownCount);
  var html='';
  visible.forEach(function(row){
    var ticketId=escapeHtml(row['Ticket ID']||'');
    var safeId=(row['Ticket ID']||'').replace(/'/g,'');
    var fourthCol = techView
      ? '<td><span class="dv-status-chip">'+escapeHtml(row['Status']||'')+'</span></td>'
      : '<td>'+escapeHtml(row['BUS ID']||'')+'</td>';
    var editBtn = techView
      ? '<button class="rpt-icon-btn rpt-edit-btn" onclick="openTechComplete(\''+safeId+'\')" aria-label="Redaktə et" title="Servisi tamamla"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
      : (canEditTicket(row) ? '<button class="rpt-icon-btn rpt-edit-btn" onclick="openBusServiceForEdit(\''+safeId+'\')" aria-label="Redaktə et" title="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' : '');
    html+='<tr>'
      +'<td class="rpt-td-id">'+ticketId+'</td>'
      +'<td>'+escapeHtml(row['Tarix']||'')+'</td>'
      +'<td class="rpt-td-plate">'+escapeHtml(row['D.Q.N.']||'')+'</td>'
      +fourthCol
      +'<td class="col-carrier" title="'+escapeHtml(row['Daşıyıcı']||'')+'">'+escapeHtml(row['Daşıyıcı']||'')+'</td>'
      +'<td class="col-act"><div class="rpt-row-actions">'
      +'<button class="rpt-icon-btn" onclick="openBusDetail(\''+safeId+'\')" aria-label="Baxış" title="Baxış"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
      +editBtn
      +'</div></td></tr>';
  });
  body.innerHTML=html;
  var loadMoreWrap=document.getElementById('rptLoadMoreWrap');
  if(rptFiltered.length>rptShownCount){
    document.getElementById('rptLoadMoreBtn').textContent='Daha çox göstər ('+(rptFiltered.length-rptShownCount)+')';
    loadMoreWrap.style.display='flex';
  } else {
    loadMoreWrap.style.display='none';
  }
}
function rptShowMore(){ rptShownCount+=rptPageSize; renderTable(); }

var DV_FIELD_MAP=[
  {section:'Müraciət məlumatları',rows:[['Tarix','Tarix'],['Saat','Saat'],['Müraciət edən','Müraciət edən'],['Telefon','Telefon']]},
  {section:'Avtobus məlumatları',rows:[['Marşrut №','Marşrut №'],['BUS ID','BUS ID'],['Daşıyıcı','Daşıyıcı'],['D.Q.N.','D.Q.N.'],['Marka/Model','Marka/Model'],['Sistem','Sistem']]},
  {section:'Servis məlumatları',rows:[['Problem','Problem'],['Həll','Həll'],['Qeyd','Qeyd']]},
  {section:'Servis Kateqoriyası',rows:[['Servis Kat.','Servis Kat.'],['Köhnə SN','Köhnə SN'],['Yeni SN','Yeni SN']]},
  {section:'Servis vaxtı və yeri',rows:[['Başlanğıc','Başlanğıc'],['Bitiş','Bitiş'],['Servis yeri','Servis yeri']]},
  {section:'Texnik heyət',rows:[['1. Texnik','1. Texnik'],['2. Texnik','2. Texnik'],['Qrup rəhbəri','Qrup rəhbəri']]}
];
function openBusDetail(ticketId){
  var row=rptAllRows.find(function(r){ return r['Ticket ID']===ticketId; });
  if(!row&&typeof ongAllRows!=='undefined') row=ongAllRows.find(function(r){ return r['Ticket ID']===ticketId; });

  if(row){
    _renderBusDetail(ticketId, row);
    return;
  }

  // Lokal keşdə tapılmadı (məs. səhifə birbaşa bu linklə açılıb) —
  // backend-dən TAM siyahını çəkib bir daha axtar.
  document.getElementById('dvTicketTitle').textContent=ticketId;
  document.getElementById('dvBody').innerHTML='<div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Məlumatlar yüklənir...</span></div>';
  document.getElementById('busReportView').style.display='none';
  document.getElementById('busDetailView').style.display='flex';

  // Report view-un öz datasını da fon rejimində yüklə ki, "Geri" düyməsi boş cədvələ aparmasın
  if(rptAllRows.length===0 && typeof loadReportData==='function') loadReportData();

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData'})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ document.getElementById('dvBody').innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    var foundRow=(d.rows||[]).find(function(r){ return r['Ticket ID']===ticketId; });
    if(!foundRow){ document.getElementById('dvBody').innerHTML='<div class="adm-empty">Ticket tapılmadı: '+escapeHtml(ticketId)+'</div>'; return; }
    _renderBusDetail(ticketId, foundRow);
  })
  .catch(function(e){
    document.getElementById('dvBody').innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>';
  });
}

function _renderBusDetail(ticketId, row){
  document.getElementById('dvTicketTitle').textContent=ticketId;
  var html='';
  DV_FIELD_MAP.forEach(function(sec){
    var rowsHtml='';
    sec.rows.forEach(function(pair){
      var val=row[pair[1]];
      if(!val) return;
      rowsHtml+='<div class="dv-row"><span class="dv-label">'+escapeHtml(pair[0])+'</span><span class="dv-value">'+escapeHtml(val)+'</span></div>';
    });
    if(rowsHtml) html+='<div class="dv-section"><div class="dv-section-title">'+escapeHtml(sec.section)+'</div>'+rowsHtml+'</div>';
  });
  html+='<div class="dv-section"><div class="dv-section-title">Status</div><div class="dv-row"><span class="dv-label">Vəziyyət</span><span class="dv-value"><span class="dv-status-chip">'+escapeHtml(row['Status']||'')+'</span></span></div></div>';
  document.getElementById('dvBody').innerHTML=html;
  document.getElementById('busReportView').style.display='none';
  document.getElementById('busDetailView').style.display='flex';
}
function closeBusDetail(){
  document.getElementById('busDetailView').style.display='none';
  document.getElementById('busReportView').style.display='flex';
}

// ═══════════════════════════════════════════════════
// TVM REAL-TIME REPORT
// ═══════════════════════════════════════════════════
var tvmRptAllRows=[], tvmRptColumns=[], tvmRptFiltered=[], tvmRptShownCount=20, tvmRptPageSize=20, tvmRptAutoRefresh=null;
var TVM_RPT_SEARCH_FIELDS=['Ticket ID','Tarix','TVM SN','TVM Lokasiya'];

function updateTvmRptDate(){
  var dEl=document.getElementById('tvmRptDateBox');
  var tEl=document.getElementById('tvmRptClockBox');
  if(!dEl||!tEl) return;
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
  var map={}; parts.forEach(function(p){ map[p.type]=p.value; });
  dEl.textContent=map.day+'.'+map.month+'.'+map.year;
  tEl.textContent=map.hour+':'+map.minute+':'+map.second;
}
var tvmRptDateInterval=null;

function openTvmReport(){
  document.getElementById('dashboardView').style.display='none';
  var view=document.getElementById('tvmReportView');
  view.style.display='flex';
  document.getElementById('tvmRptGlobalSearch').value='';
  tvmRptDaysBack=90;
  var tvmDaysSel=document.getElementById('tvmRptDaysBackSelect'); if(tvmDaysSel) tvmDaysSel.value='90';
  document.getElementById('tvmRptExcelBtn').style.display=(getAccessLevel(currentUser.role)==='technician')?'none':'flex';
  tvmRptShownCount=tvmRptPageSize;
  updateTvmRptDate();
  if(tvmRptDateInterval) clearInterval(tvmRptDateInterval);
  tvmRptDateInterval=setInterval(updateTvmRptDate,1000);
  loadTvmReportData();
  if(tvmRptAutoRefresh) clearInterval(tvmRptAutoRefresh);
  tvmRptAutoRefresh=setInterval(loadTvmReportData,120000);
}
function closeTvmReport(){
  if(tvmRptAutoRefresh){ clearInterval(tvmRptAutoRefresh); tvmRptAutoRefresh=null; }
  if(tvmRptDateInterval){ clearInterval(tvmRptDateInterval); tvmRptDateInterval=null; }
  document.getElementById('tvmReportView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}
function tvmRptSortKey(row){
  var d=row['Tarix']||'';
  var t=row['Bildirilmə Saatı']||'00:00';
  var dp=d.split('.');
  if(dp.length!==3) return 0;
  var iso=dp[2]+'-'+dp[1]+'-'+dp[0]+'T'+(t||'00:00')+':00';
  var ts=new Date(iso).getTime();
  return isNaN(ts)?0:ts;
}
var tvmRptDaysBack = 90;
function loadTvmReportData(){
  document.getElementById('tvmRptTableBody').innerHTML='<tr><td colspan="5"><div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Yüklənir...</span></div></td></tr>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmReportData', daysBack: tvmRptDaysBack})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){
      document.getElementById('tvmRptTableBody').innerHTML='<tr><td colspan="5"><div class="rpt-empty">Xəta: '+(d.message||'məlumat gəlmədi')+'</div></td></tr>';
      return;
    }
    tvmRptAllRows=(d.rows||[]).slice().sort(function(a,b){ return tvmRptSortKey(b)-tvmRptSortKey(a); });
    tvmRptColumns=d.columns||[];
    var hiddenCount = (d.totalCount||0) - tvmRptAllRows.length;
    var hintEl = document.getElementById('tvmRptOldHint');
    if(hintEl){
      if(tvmRptDaysBack > 0 && hiddenCount > 0){
        hintEl.innerHTML = hiddenCount+' köhnə ticket (seçilmiş dövrdən əvvəl) gizlədilib, sürəti artırmaq üçün. <a onclick="tvmRptShowAllHistory()">Hamısını göstər</a>';
        hintEl.style.display='flex';
      } else {
        hintEl.style.display='none';
      }
    }
    applyTvmFilters();
  }).catch(function(e){
    document.getElementById('tvmRptTableBody').innerHTML='<tr><td colspan="5"><div class="rpt-empty">Şəbəkə xətası: '+e.message+'</div></td></tr>';
  });
}
function tvmRptChangeDaysBack(){
  tvmRptDaysBack = Number(document.getElementById('tvmRptDaysBackSelect').value) || 0;
  loadTvmReportData();
}
function tvmRptShowAllHistory(){
  tvmRptDaysBack = 0;
  var sel = document.getElementById('tvmRptDaysBackSelect'); if(sel) sel.value='0';
  loadTvmReportData();
}
var tvmRptSearchDebounceTimer=null;
function applyTvmFiltersDebounced(){ clearTimeout(tvmRptSearchDebounceTimer); tvmRptSearchDebounceTimer=setTimeout(applyTvmFilters,180); }
function applyTvmFilters(){
  var q=(document.getElementById('tvmRptGlobalSearch').value||'').toLowerCase().trim();
  tvmRptShownCount=tvmRptPageSize;
  tvmRptFiltered=q?tvmRptAllRows.filter(function(row){
    for(var i=0;i<TVM_RPT_SEARCH_FIELDS.length;i++){
      var f=TVM_RPT_SEARCH_FIELDS[i];
      if((row[f]||'').toLowerCase().indexOf(q)!==-1) return true;
    }
    return false;
  }):tvmRptAllRows;
  renderTvmTable();
}
function canEditTvmTicket(row){
  var level=getAccessLevel(currentUser.role);
  if(level==='leader'||level==='admin') return true;
  var createdBy=(row['_created_by']||'').toLowerCase().trim();
  var me=(currentUser.email||'').toLowerCase().trim();
  return createdBy&&me&&createdBy===me;
}
function renderTvmTable(){
  var body=document.getElementById('tvmRptTableBody');
  document.getElementById('tvmRptCount').textContent=tvmRptFiltered.length+' nəticə';
  if(tvmRptFiltered.length===0){
    body.innerHTML='<tr><td colspan="5"><div class="rpt-empty">Məlumat tapılmadı</div></td></tr>';
    document.getElementById('tvmRptLoadMoreWrap').style.display='none';
    return;
  }
  var visible=tvmRptFiltered.slice(0,tvmRptShownCount);
  var html='';
  visible.forEach(function(row){
    var ticketId=escapeHtml(row['Ticket ID']||'');
    var safeId=(row['Ticket ID']||'').replace(/'/g,'');
    var editable=canEditTvmTicket(row);
    html+='<tr>'
      +'<td class="rpt-td-id">'+ticketId+'</td>'
      +'<td>'+escapeHtml(row['Tarix']||'')+'</td>'
      +'<td class="rpt-td-plate">'+escapeHtml(row['TVM SN']||'')+'</td>'
      +'<td class="col-carrier" title="'+escapeHtml(row['TVM Lokasiya']||'')+'">'+escapeHtml(row['TVM Lokasiya']||'')+'</td>'
      +'<td class="col-act"><div class="rpt-row-actions">'
      +'<button class="rpt-icon-btn" onclick="openTvmDetail(\''+safeId+'\')" aria-label="Baxış" title="Baxış"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
      +(editable?'<button class="rpt-icon-btn rpt-edit-btn" onclick="openTvmServiceForEdit(\''+safeId+'\')" aria-label="Redaktə et" title="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>':'')
      +'</div></td></tr>';
  });
  body.innerHTML=html;
  var loadMoreWrap=document.getElementById('tvmRptLoadMoreWrap');
  if(tvmRptFiltered.length>tvmRptShownCount){
    document.getElementById('tvmRptLoadMoreBtn').textContent='Daha çox göstər ('+(tvmRptFiltered.length-tvmRptShownCount)+')';
    loadMoreWrap.style.display='flex';
  } else {
    loadMoreWrap.style.display='none';
  }
}
function tvmRptShowMore(){ tvmRptShownCount+=tvmRptPageSize; renderTvmTable(); }

var TVM_DV_FIELD_MAP=[
  {section:'Servis məlumatları',rows:[['Tarix','Tarix'],['Bildirilmə Saatı','Bildirilmə Saatı']]},
  {section:'Validator məlumatları',rows:[['TVM SN','TVM SN'],['TVM Lokasiya','TVM Lokasiya'],['Servis Lokasiyası','Servis Lokasiyası']]},
  {section:'Problem və həll',rows:[['Problem','Problem'],['Həll','Həll'],['Qeyd','Qeyd'],['Köhnə SN','Köhnə SN'],['Yeni SN','Yeni SN']]},
  {section:'Vaxt məlumatları',rows:[['Başlanğıc','Başlanğıc'],['Bitiş','Bitiş']]},
  {section:'Personal',rows:[['Texnik','Texnik'],['Qrup rəhbəri','Qrup rəhbəri']]}
];
function openTvmDetail(ticketId){
  var row=tvmRptAllRows.find(function(r){ return r['Ticket ID']===ticketId; });
  if(row){ _renderTvmDetail(ticketId, row); return; }

  document.getElementById('tvmDvTicketTitle').textContent=ticketId;
  document.getElementById('tvmDvBody').innerHTML='<div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Məlumatlar yüklənir...</span></div>';
  document.getElementById('tvmReportView').style.display='none';
  document.getElementById('tvmDetailView').style.display='flex';

  if(tvmRptAllRows.length===0 && typeof loadTvmReportData==='function') loadTvmReportData();

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmReportData'})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ document.getElementById('tvmDvBody').innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    var foundRow=(d.rows||[]).find(function(r){ return r['Ticket ID']===ticketId; });
    if(!foundRow){ document.getElementById('tvmDvBody').innerHTML='<div class="adm-empty">Ticket tapılmadı: '+escapeHtml(ticketId)+'</div>'; return; }
    _renderTvmDetail(ticketId, foundRow);
  })
  .catch(function(e){
    document.getElementById('tvmDvBody').innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>';
  });
}

function _renderTvmDetail(ticketId, row){
  document.getElementById('tvmDvTicketTitle').textContent=ticketId;
  var html='';
  TVM_DV_FIELD_MAP.forEach(function(sec){
    var rowsHtml='';
    sec.rows.forEach(function(pair){
      var val=row[pair[1]];
      if(!val) return;
      rowsHtml+='<div class="dv-row"><span class="dv-label">'+escapeHtml(pair[0])+'</span><span class="dv-value">'+escapeHtml(val)+'</span></div>';
    });
    if(rowsHtml) html+='<div class="dv-section"><div class="dv-section-title">'+escapeHtml(sec.section)+'</div>'+rowsHtml+'</div>';
  });
  document.getElementById('tvmDvBody').innerHTML=html;
  document.getElementById('tvmReportView').style.display='none';
  document.getElementById('tvmDetailView').style.display='flex';
}
function closeTvmDetail(){
  document.getElementById('tvmDetailView').style.display='none';
  document.getElementById('tvmReportView').style.display='flex';
}
function exportTvmToExcel(){
  if(tvmRptFiltered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
  var cols=tvmRptColumns;
  var wsData=[cols];
  tvmRptFiltered.forEach(function(row){ wsData.push(cols.map(function(c){ return row[c]||''; })); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TVM Report');
  var today=new Date();
  XLSX.writeFile(wb, 'TVM_Report_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

// ═══════════════════════════════════════════════════
// BUS DASHBOARD
// ═══════════════════════════════════════════════════
function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getBakuNowParts(){
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now);
  var map={}; parts.forEach(function(p){ map[p.type]=p.value; });
  return {y:+map.year, mo:+map.month, d:+map.day, h:+map.hour, mi:+map.minute, s:+map.second};
}
function bakuNowDate(){ var p=getBakuNowParts(); return new Date(p.y, p.mo-1, p.d, p.h, p.mi, p.s); }
function daysInCurrentMonth(){ var p=getBakuNowParts(); return new Date(p.y, p.mo, 0).getDate(); }
function dashComputeRange(period){
  if(period==='all') return {start:null, end:null};
  var end=bakuNowDate();
  var start=new Date(end);
  if(period==='24h') start.setDate(start.getDate()-1);
  else if(period==='week') start.setDate(start.getDate()-7);
  else if(period==='month') start.setDate(start.getDate()-daysInCurrentMonth());
  return {start:start, end:end};
}
function rowDate(row){
  var d=row['Tarix']||'';
  var t=row['Saat']||'00:00';
  var dp=d.split('.');
  if(dp.length!==3) return null;
  var tp=t.split(':');
  return new Date(+dp[2], +dp[1]-1, +dp[0], +(tp[0]||0), +(tp[1]||0));
}
var DASH_CATS=[
  {key:'Problem', type:'multi', getOptions:function(){ return bsFormData.busProblems||[]; }},
  {key:'Həll', type:'multi', getOptions:function(){ return bsFormData.solutions||[]; }},
  {key:'Daşıyıcı', type:'multi', getOptions:function(){ return bsFormData.carriers||[]; }},
  {key:'D.Q.N.', type:'text'},
  {key:'BUS ID', type:'numeric', maxlen:5},
  {key:'Qrup Rəhbəri', type:'multi', getOptions:function(){ return bsFormData.leaders||[]; }},
  {key:'Texnik', type:'multi', getOptions:function(){ return bsFormData.technicians||[]; }},
  {key:'Servis verilən Ünvan', type:'multi', getOptions:function(){ return bsFormData.locations||[]; }},
  {key:'Servis Kateqoriyaları', type:'multi', getOptions:function(){ return bsFormData.busEquipment||[]; }}
];
var dashActiveChips={}, dashSubfilterState={}, dashTextFilters={}, dashCustomRange=null, dashPeriod='24h', dashAllRows=[];
function dashSelectedOptions(key){
  return Object.keys(dashSubfilterState).filter(function(k){ return k.indexOf(key+'|')===0 && dashSubfilterState[k]; }).map(function(k){ return k.slice(key.length+1); });
}
function dashHasActiveOptions(key){ return dashSelectedOptions(key).length>0; }
function dashMatchMulti(val,key){ if(!val) return false; return dashSelectedOptions(key).indexOf(val)!==-1; }
function dashMatchSolution(val,key){ if(!val) return false; var sel=dashSelectedOptions(key); return val.split('|').some(function(p){ return sel.indexOf(p.trim())!==-1; }); }
function dashMatchLocation(val,key){ if(!val) return false; var base=val.replace(/\s*\(.*\)$|\.$/,'').trim(); return dashSelectedOptions(key).indexOf(base)!==-1; }
var dashServiceTypeFilter='all';
function dashGetFilteredRows(){
  var range=dashCustomRange||dashComputeRange(dashPeriod);
  return dashAllRows.filter(function(row){
    if(dashServiceTypeFilter!=='all'){
      var t=(row['Xidmət Növü']||'').toLowerCase();
      if(dashServiceTypeFilter==='individual'&&t.indexOf('fərdi')===-1) return false;
      if(dashServiceTypeFilter==='bulk'&&t.indexOf('toplu')===-1) return false;
    }
    if(range.start&&range.end){ var rd=rowDate(row); if(!rd||rd<range.start||rd>range.end) return false; }
    if(dashHasActiveOptions('Problem')&&!dashMatchMulti(row['Problem'],'Problem')) return false;
    if(dashHasActiveOptions('Həll')&&!dashMatchSolution(row['Həll'],'Həll')) return false;
    if(dashHasActiveOptions('Daşıyıcı')&&!dashMatchMulti(row['Daşıyıcı'],'Daşıyıcı')) return false;
    if(dashTextFilters['D.Q.N.']&&(row['D.Q.N.']||'').toLowerCase().indexOf(dashTextFilters['D.Q.N.'].toLowerCase())===-1) return false;
    if(dashTextFilters['BUS ID']&&(row['BUS ID']||'').indexOf(dashTextFilters['BUS ID'])===-1) return false;
    if(dashHasActiveOptions('Qrup Rəhbəri')&&!dashMatchMulti(row['Qrup rəhbəri'],'Qrup Rəhbəri')) return false;
    if(dashHasActiveOptions('Texnik')&&!(dashMatchMulti(row['1. Texnik'],'Texnik')||dashMatchMulti(row['2. Texnik'],'Texnik'))) return false;
    if(dashHasActiveOptions('Servis verilən Ünvan')&&!dashMatchLocation(row['Servis yeri'],'Servis verilən Ünvan')) return false;
    if(dashHasActiveOptions('Servis Kateqoriyaları')&&!dashMatchMulti(row['Servis Kat.'],'Servis Kateqoriyaları')) return false;
    return true;
  });
}
function setDashServiceTypeFilter(type, btn){
  dashServiceTypeFilter=type;
  document.querySelectorAll('#dashTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  if(btn) btn.classList.add('rpt-type-btn-active');
  dashComputeAndRender();
}
function dashCount(rows,field,splitMulti){
  var map={};
  rows.forEach(function(r){
    var v=r[field];
    if(!v) return;
    var vals=splitMulti?v.split('|'):[v];
    vals.forEach(function(vv){ vv=(vv||'').trim(); if(!vv) return; map[vv]=(map[vv]||0)+1; });
  });
  return Object.keys(map).map(function(k){ return {name:k, count:map[k]}; }).sort(function(a,b){ return b.count-a.count; });
}
function dashCountLocation(rows){
  var map={};
  rows.forEach(function(r){
    var v=r['Servis yeri'];
    if(!v) return;
    var base=v.replace(/\s*\(.*\)$|\.$/,'').trim();
    if(!base) return;
    map[base]=(map[base]||0)+1;
  });
  return Object.keys(map).map(function(k){ return {name:k, count:map[k]}; }).sort(function(a,b){ return b.count-a.count; });
}
function dashCountTech(rows){
  var map={};
  rows.forEach(function(r){
    [r['1. Texnik'], r['2. Texnik']].forEach(function(v){
      if(!v) return;
      map[v]=(map[v]||0)+1;
    });
  });
  return Object.keys(map).map(function(k){ return {name:k, count:map[k]}; }).sort(function(a,b){ return b.count-a.count; });
}
function dashCountRecurringBuses(rows){
  var map={};
  rows.forEach(function(r){
    var id=r['BUS ID'];
    if(!id) return;
    if(!map[id]) map[id]={plate:r['D.Q.N.'], count:0};
    map[id].count++;
  });
  return Object.keys(map).map(function(id){ return {busId:id, plate:map[id].plate, count:map[id].count}; }).filter(function(x){ return x.count>=3; }).sort(function(a,b){ return b.count-a.count; });
}
function dashFixedMetrics(){
  var now=bakuNowDate();
  var todayStart=new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  var weekStart=new Date(now);
  weekStart.setDate(weekStart.getDate()-7);
  var totalToday=0, totalWeek=0;
  dashAllRows.forEach(function(r){
    var rd=rowDate(r);
    if(!rd) return;
    if(rd>=todayStart) totalToday++;
    if(rd>=weekStart) totalWeek++;
  });
  return {totalAll:dashAllRows.length, totalToday:totalToday, totalWeek:totalWeek};
}
function dashRenderRadial(containerId, items, total){
  var el=document.getElementById(containerId);
  var top=items.slice(0,4);
  if(top.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün qeydə alınmayıb.</div>'; return; }
  var R=30, C=2*Math.PI*R, html='';
  top.forEach(function(it){
    var pct=total>0?Math.round(it.count/total*100):0;
    var offset=C-(C*pct/100);
    html+='<div class="dash-radial-card"><svg width="68" height="68" viewBox="0 0 72 72"><circle cx="36" cy="36" r="'+R+'" fill="none" stroke="#E6F1FB" stroke-width="8"/><circle cx="36" cy="36" r="'+R+'" fill="none" stroke="#2F6FED" stroke-width="8" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'" stroke-linecap="round" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="17" fill="#12233B">'+pct+'%</text></svg><div class="dash-radial-textbox">'+escapeHtml(it.name)+'</div><div class="dash-radial-count">'+it.count+' servis</div></div>';
  });
  el.innerHTML=html;
}
function buildRankTableRows(items, numStyle, countStyle){
  var html='';
  items.forEach(function(it, i){
    html+='<tr><td><span'+(numStyle?' style="'+numStyle+'"':'')+'>'+(i+1)+'</span></td><td>'+escapeHtml(it.name)+'</td><td><span class="dash-rank-count-val"'+(countStyle?' style="'+countStyle+'"':'')+'>'+it.count+'</span></td></tr>';
  });
  return html;
}
function dashRenderRankList(containerId, items, max, headerLabel, nameHeader){
  var el=document.getElementById(containerId);
  var top=items.slice(0, max||6);
  if(top.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün qeydə alınmayıb.</div>'; return; }
  el.innerHTML='<div class="dash-ranklist-wrap"><table class="dash-ranklist"><thead><tr><th class="dr-num-col"></th><th>'+(nameHeader||'Ad')+'</th><th class="dr-count-col">'+(headerLabel||'Servis sayı')+'</th></tr></thead><tbody>'+buildRankTableRows(top)+'</tbody></table></div>';
}
function dashRenderTiles(containerId, items, max){
  var el=document.getElementById(containerId);
  var top=items.slice(0, max||8);
  if(top.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün qeydə alınmayıb.</div>'; return; }
  var icon='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h6M9 12h6"/></svg>';
  var html='';
  top.forEach(function(it){ html+='<div class="dash-tile"><div class="dash-tile-icon">'+icon+'</div><div class="dash-tile-name">'+escapeHtml(it.name)+'</div><div class="dash-tile-count">'+it.count+'</div></div>'; });
  el.innerHTML=html;
}
function dashRenderLeaders(containerId, items, max){
  var el=document.getElementById(containerId);
  var top=items.slice(0, max||6);
  if(top.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün qeydə alınmayıb.</div>'; return; }
  var maxCount=top[0].count||1, html='';
  top.forEach(function(it){
    var initials=it.name.split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2).toUpperCase();
    var pct=Math.round(it.count/maxCount*100);
    html+='<div class="dash-lead-row"><div class="dash-avatar">'+escapeHtml(initials)+'</div><div class="dash-lead-name">'+escapeHtml(it.name)+'</div><div class="dash-lead-bar-wrap"><div class="dash-lead-bar" style="width:'+pct+'%;"></div></div><div class="dash-lead-count">'+it.count+'</div></div>';
  });
  el.innerHTML=html;
}
function dashRenderRecurring(containerId, items){
  var el=document.getElementById(containerId);
  if(items.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün heç bir avtobus 3 və ya daha çox servis almayıb.</div>'; return; }
  var mapped=items.slice(0,15).map(function(it){ return {name:(it.plate||'—')+' · BUS '+it.busId, count:it.count}; });
  el.innerHTML='<div class="dash-ranklist-wrap"><table class="dash-ranklist"><thead><tr><th class="dr-num-col"></th><th>Avtobus (D.Q.N. · BUS ID)</th><th class="dr-count-col">Servis sayı</th></tr></thead><tbody>'+buildRankTableRows(mapped, 'background:#FEECEC;color:#A32D2D;', 'color:#A32D2D;')+'</tbody></table></div>';
}
function dashMobileSection(title, items, max, headerLabel){
  var top=items.slice(0, max||6);
  var html='<div class="dash-m-section"><div class="dash-m-title">'+title+'</div>';
  if(top.length===0){ html+='<div class="dash-m-card-empty">Bu dövr üçün qeydə alınmayıb.</div>'; }
  else { html+='<div class="dash-ranklist-wrap"><table class="dash-ranklist"><thead><tr><th class="dr-num-col"></th><th>Ad</th><th class="dr-count-col">'+(headerLabel||'Say')+'</th></tr></thead><tbody>'+buildRankTableRows(top)+'</tbody></table></div>'; }
  html+='</div>';
  return html;
}
function dashRenderMobile(agg){
  document.getElementById('dashMTotalAll').textContent=agg.totalAll;
  document.getElementById('dashMTotalToday').textContent=agg.totalToday;
  document.getElementById('dashMTotalWeek').textContent=agg.totalWeek;
  var html='';
  html+=dashMobileSection('Ən çox rast gəlinən problem', agg.problems, 4);
  html+=dashMobileSection('Ən çox rast gəlinən həll', agg.solutions, 4);
  html+=dashMobileSection('Servis kateqoriyaları', agg.categories, 8);
  html+=dashMobileSection('Texnik fəaliyyəti', agg.tech, 8);
  html+=dashMobileSection('Qrup rəhbəri fəaliyyəti', agg.leaders, 8);
  html+=dashMobileSection('Daşıyıcı firma üzrə statistika', agg.carriers, 8);
  html+=dashMobileSection('Servis verilən ünvan', agg.locations, 8);
  var recItems=agg.recurring.map(function(it){ return {name:(it.plate||'—')+' · BUS '+it.busId, count:it.count}; });
  html+=dashMobileSection('Təkrarlanan problemli avtobuslar', recItems, 15, 'Servis sayı');
  document.getElementById('dashMobileSections').innerHTML=html;
}
function dashComputeAndRender(){
  var fixed=dashFixedMetrics();
  document.getElementById('dashTotalAll').textContent=fixed.totalAll;
  document.getElementById('dashTotalToday').textContent=fixed.totalToday;
  document.getElementById('dashTotalWeek').textContent=fixed.totalWeek;
  var filtered=dashGetFilteredRows();
  var problems=dashCount(filtered, 'Problem', false);
  var solutions=dashCount(filtered, 'Həll', true);
  var categories=dashCount(filtered, 'Servis Kat.', false);
  var tech=dashCountTech(filtered);
  var leaders=dashCount(filtered, 'Qrup rəhbəri', false);
  var carriers=dashCount(filtered, 'Daşıyıcı', false);
  var locations=dashCountLocation(filtered);
  var recurring=dashCountRecurringBuses(filtered);
  dashRenderRadial('dashProblemGrid', problems, filtered.length);
  dashRenderRankList('dashSolutionList', solutions, 4);
  dashRenderTiles('dashCategoryGrid', categories, 8);
  dashRenderLeaders('dashTechList', tech, 8);
  dashRenderLeaders('dashLeaderList', leaders, 8);
  dashRenderRankList('dashCarrierList', carriers, 8);
  dashRenderRankList('dashLocationList', locations, 8);
  dashRenderRecurring('dashRecurringPanel', recurring);
  dashRenderMobile({
    totalAll:fixed.totalAll,
    totalToday:fixed.totalToday,
    totalWeek:fixed.totalWeek,
    problems:problems,
    solutions:solutions,
    categories:categories,
    tech:tech,
    leaders:leaders,
    carriers:carriers,
    locations:locations,
    recurring:recurring
  });
}
function loadDashData(){
  var ov=document.getElementById('dashLoading');
  ov.classList.add('open');
  var reportPromise=fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData'})}).then(function(r){ return r.json(); });
  var formPromise=(bsFormData&&bsFormData.carriers)?Promise.resolve(bsFormData):fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){ return r.json(); }).then(function(d){ if(d.status==='OK') bsFormData=d; return bsFormData; });
  Promise.all([reportPromise, formPromise]).then(function(results){
    var d=results[0];
    if(d.status==='OK'){ dashAllRows=d.rows||[]; }
    ov.classList.remove('open');
    dashComputeAndRender();
  }).catch(function(){ ov.classList.remove('open'); });
}
function updateDashTabsUI(){ document.querySelectorAll('#dashTabs .dash-tab').forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-period')===dashPeriod); }); }
function openBusDashboard(){
  document.getElementById('dashboardView').style.display='none';
  document.getElementById('busDashboardView').style.display='flex';
  dashCustomRange=null;
  dashPeriod='24h';
  dashServiceTypeFilter='all';
  document.querySelectorAll('#dashTypeFilter .rpt-type-btn').forEach(function(b){ b.classList.remove('rpt-type-btn-active'); });
  var allBtn=document.querySelector('#dashTypeFilter [data-type="all"]'); if(allBtn) allBtn.classList.add('rpt-type-btn-active');
  updateDashTabsUI();
  loadDashData();
}
function closeBusDashboard(){
  document.getElementById('busDashboardView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}
document.addEventListener('DOMContentLoaded', function(){
  var tabs=document.querySelectorAll('#dashTabs .dash-tab');
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      tabs.forEach(function(x){ x.classList.remove('active'); });
      t.classList.add('active');
      dashPeriod=t.getAttribute('data-period');
      dashCustomRange=null;
      dashComputeAndRender();
    });
  });
});

// ── Modal kalendar ──────────────────────────────
function openDashModal(){ ensureDashFormDataThenBuildChips(); document.getElementById('dashModal').classList.add('open'); }
function closeDashModal(){
  document.getElementById('dashModal').classList.remove('open');
  document.getElementById('dashModalFilterBody').style.display='flex';
  document.getElementById('dashModalResults').classList.remove('open');
  document.getElementById('dashResetBtnEl').style.display='';
  document.getElementById('dashModalTitle').textContent='Tarix aralığı və filtrlər';
  document.getElementById('dashSearchWarn').style.display='none';
}
function ensureDashFormDataThenBuildChips(){
  if(bsFormData&&bsFormData.carriers){ buildDashChips(); }
  else {
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){ return r.json(); }).then(function(d){ if(d.status==='OK') bsFormData=d; buildDashChips(); });
  }
}
function buildDashChips(){
  var row=document.getElementById('dashChipRow');
  row.innerHTML='';
  DASH_CATS.forEach(function(cat){
    var c=document.createElement('div');
    c.className='dash-chip'+(dashActiveChips[cat.key]?' active':'');
    c.textContent=cat.key;
    c.onclick=function(){
      dashActiveChips[cat.key]=!dashActiveChips[cat.key];
      var warnEl=document.getElementById('dashSearchWarn');
      if(warnEl) warnEl.style.display='none';
      c.classList.toggle('active');
      renderDashSubfilters();
    };
    row.appendChild(c);
  });
  renderDashSubfilters();
}
function renderDashSubfilters(){
  var wrap=document.getElementById('dashSubfilters');
  wrap.innerHTML='';
  DASH_CATS.forEach(function(cat){
    if(!dashActiveChips[cat.key]) return;
    var box=document.createElement('div');
    box.className='dash-subfilter';
    var title=document.createElement('div');
    title.className='dash-subfilter-title';
    title.textContent=cat.key;
    box.appendChild(title);
    if(cat.type==='multi'){
      var opts=document.createElement('div');
      opts.className='dash-subfilter-opts';
      (cat.getOptions()||[]).forEach(function(opt){
        var o=document.createElement('div');
        var key=cat.key+'|'+opt;
        o.className='dash-opt-chip'+(dashSubfilterState[key]?' sel':'');
        o.textContent=opt.length>28?opt.slice(0,28)+'…':opt;
        o.title=opt;
        o.onclick=function(){ dashSubfilterState[key]=!dashSubfilterState[key]; o.classList.toggle('sel'); };
        opts.appendChild(o);
      });
      box.appendChild(opts);
    } else if(cat.type==='text'){
      var inp=document.createElement('input');
      inp.type='text';
      inp.placeholder='Axtar...';
      inp.value=dashTextFilters[cat.key]||'';
      inp.oninput=function(){ dashTextFilters[cat.key]=this.value; };
      box.appendChild(inp);
    } else if(cat.type==='numeric'){
      var inp2=document.createElement('input');
      inp2.type='text';
      inp2.inputMode='numeric';
      inp2.placeholder='ID';
      inp2.maxLength=cat.maxlen||5;
      inp2.value=dashTextFilters[cat.key]||'';
      inp2.oninput=function(){ this.value=this.value.replace(/[^0-9]/g,'').slice(0, cat.maxlen||5); dashTextFilters[cat.key]=this.value; };
      box.appendChild(inp2);
    }
    wrap.appendChild(box);
  });
}
function resetDashFilters(){
  dashActiveChips={};
  dashSubfilterState={};
  dashTextFilters={};
  dcalRangeStart=null;
  dcalRangeEnd=null;
  buildDashChips();
  renderDcal();
  document.getElementById('dashModalFilterBody').style.display='flex';
  document.getElementById('dashModalResults').classList.remove('open');
  document.getElementById('dashModalTitle').textContent='Tarix aralığı və filtrlər';
  document.getElementById('dashSearchWarn').style.display='none';

  dashCustomRange=null;
  dashPeriod='24h';
  updateDashTabsUI();
  dashComputeAndRender();
}
var dcalYear, dcalMonth, dcalRangeStart=null, dcalRangeEnd=null;
var DCAL_DOWS=['B.e','Ç.a','Ç','C.a','C','Ş','B'];
var DCAL_MONTHS=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
function initDcal(){ var now=bakuNowDate(); dcalYear=now.getFullYear(); dcalMonth=now.getMonth(); renderDcal(); }
function dcalNav(dir){ dcalMonth+=dir; if(dcalMonth<0){ dcalMonth=11; dcalYear--; } if(dcalMonth>11){ dcalMonth=0; dcalYear++; } renderDcal(); }
function renderDcal(){
  var labelEl=document.getElementById('dcalLabel');
  var grid=document.getElementById('dcalGrid');
  if(!labelEl || !grid) return;
  labelEl.textContent=DCAL_MONTHS[dcalMonth]+' '+dcalYear;
  grid.innerHTML='';
  DCAL_DOWS.forEach(function(d){ var el=document.createElement('div'); el.className='dcal-dow'; el.textContent=d; grid.appendChild(el); });
  var firstDay=new Date(dcalYear, dcalMonth, 1);
  var startOffset=(firstDay.getDay()+6)%7;
  var daysInMonth=new Date(dcalYear, dcalMonth+1, 0).getDate();
  var daysInPrev=new Date(dcalYear, dcalMonth, 0).getDate();
  for(var i=0; i<startOffset; i++){ var el=document.createElement('div'); el.className='dcal-day muted'; el.textContent=daysInPrev-startOffset+i+1; grid.appendChild(el); }
  for(var d=1; d<=daysInMonth; d++){
    (function(day){
      var el=document.createElement('div');
      el.className='dcal-day';
      el.textContent=day;
      var thisDate=new Date(dcalYear, dcalMonth, day);
      if(dcalRangeStart&&sameDayDc(thisDate, dcalRangeStart)) el.classList.add('range-start');
      if(dcalRangeEnd&&sameDayDc(thisDate, dcalRangeEnd)) el.classList.add('range-end');
      if(dcalRangeStart&&dcalRangeEnd&&thisDate>dcalRangeStart&&thisDate<dcalRangeEnd) el.classList.add('in-range');
      el.onclick=function(){ pickDcalDate(thisDate); };
      grid.appendChild(el);
    })(d);
  }
  updateDcalTxt();
}
function sameDayDc(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function pickDcalDate(d){
  if(!dcalRangeStart||(dcalRangeStart&&dcalRangeEnd)){ dcalRangeStart=d; dcalRangeEnd=null; }
  else { if(d<dcalRangeStart){ dcalRangeEnd=dcalRangeStart; dcalRangeStart=d; } else { dcalRangeEnd=d; } }
  renderDcal();
  var warnEl=document.getElementById('dashSearchWarn');
  if(warnEl) warnEl.style.display='none';
}
function fmtDc(d){ return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); }
function updateDcalTxt(){
  var t=document.getElementById('dcalSelectedTxt');
  if(!t) return;
  if(dcalRangeStart&&dcalRangeEnd) t.textContent=fmtDc(dcalRangeStart)+' → '+fmtDc(dcalRangeEnd);
  else if(dcalRangeStart) t.textContent=fmtDc(dcalRangeStart)+' seçildi — bitiş tarixini seçin';
  else t.textContent='Başlanğıc tarixi seçin';
}
initDcal();

function runDashSearch(){
  var hasRange=dcalRangeStart&&dcalRangeEnd;
  var hasActiveCat=Object.keys(dashActiveChips).some(function(k){ return dashActiveChips[k]; });
  if(!hasRange&&!hasActiveCat){ document.getElementById('dashSearchWarn').style.display='flex'; return; }
  document.getElementById('dashSearchWarn').style.display='none';
  if(hasRange){
    dashCustomRange={
      start:new Date(dcalRangeStart.getFullYear(), dcalRangeStart.getMonth(), dcalRangeStart.getDate(), 0, 0, 0),
      end:new Date(dcalRangeEnd.getFullYear(), dcalRangeEnd.getMonth(), dcalRangeEnd.getDate(), 23, 59, 59)
    };
    document.querySelectorAll('#dashTabs .dash-tab').forEach(function(t){ t.classList.remove('active'); });
  }
  document.getElementById('dashModalFilterBody').style.display='none';
  document.getElementById('dashModalTitle').textContent='Nəticələr';
  var resultsPanel=document.getElementById('dashModalResults');
  resultsPanel.classList.add('open');
  document.getElementById('dashModalResultsBody').innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:50px 0;"><div class="spinner" style="width:38px;height:38px;border-width:4px;"></div><div style="font-size:13.5px;color:#5C7089;font-weight:600;">Hazırlanır...</div></div>';
  setTimeout(function(){ dashComputeAndRender(); renderDashModalResults(); }, 1400);
}
function dashPivotBlock(title, items, countLabel, nameHeader){
  if(!items||items.length===0) return '';
  var b='<div style="font-size:12px;font-weight:700;color:#8CA0BC;margin-bottom:8px;">'+title+'</div>';
  b+='<div class="dash-ranklist-wrap" style="margin-bottom:20px;"><table class="dash-ranklist"><thead><tr><th class="dr-num-col"></th><th>'+(nameHeader||'Ad')+'</th><th class="dr-count-col">'+(countLabel||'Servis sayı')+'</th></tr></thead><tbody>'+buildRankTableRows(items.slice(0,10))+'</tbody></table></div>';
  return b;
}
function renderDashModalResults(){
  var filtered=dashGetFilteredRows();
  var activeAny=Object.keys(dashActiveChips).some(function(k){ return dashActiveChips[k]; });
  var html='<div style="font-size:13px;font-weight:700;color:#12233B;margin-bottom:16px;">Tapılan servis sayı: <span style="color:#2F6FED;">'+filtered.length+'</span></div>';
  if(dashActiveChips['Problem']) html+=dashPivotBlock('Problem üzrə bölgü', dashCount(filtered, 'Problem', false), 'Servis sayı', 'Problem');
  if(dashActiveChips['Həll']) html+=dashPivotBlock('Həll üzrə bölgü', dashCount(filtered, 'Həll', true), 'Servis sayı', 'Həll');
  if(dashActiveChips['Daşıyıcı']) html+=dashPivotBlock('Daşıyıcı üzrə bölgü', dashCount(filtered, 'Daşıyıcı', false), 'Servis sayı', 'Daşıyıcı');
  if(dashActiveChips['Qrup Rəhbəri']) html+=dashPivotBlock('Qrup Rəhbəri üzrə bölgü', dashCount(filtered, 'Qrup rəhbəri', false), 'Servis sayı', 'Qrup Rəhbəri');
  if(dashActiveChips['Texnik']) html+=dashPivotBlock('Texnik üzrə bölgü', dashCountTech(filtered), 'Servis sayı', 'Texnik');
  if(dashActiveChips['Servis verilən Ünvan']) html+=dashPivotBlock('Servis verilən ünvan üzrə bölgü', dashCountLocation(filtered), 'Servis sayı', 'Ünvan');
  if(dashActiveChips['Servis Kateqoriyaları']) html+=dashPivotBlock('Servis kateqoriyası üzrə bölgü', dashCount(filtered, 'Servis Kat.', false), 'Servis sayı', 'Kateqoriya');
  if(!activeAny) html+=dashPivotBlock('Ən çox rast gəlinən problem (ümumi baxış)', dashCount(filtered, 'Problem', false).slice(0,4), 'Servis sayı', 'Problem');
  html+='<div style="font-size:12px;color:#8CA0BC;line-height:1.5;">Tam hesabat əsas Dashboard səhifəsində də yeniləndi.</div>';
  document.getElementById('dashModalResultsBody').innerHTML=html;
}
function exportDashboardExcel(){
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
  var filtered=dashGetFilteredRows();
  var wb=XLSX.utils.book_new();
  function addSheet(name, items, headers){ var aoa=[headers]; items.forEach(function(it){ aoa.push([it.name, it.count]); }); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name); }
  addSheet('Problem', dashCount(filtered, 'Problem', false), ['Problem','Say']);
  addSheet('Hell', dashCount(filtered, 'Həll', true), ['Hell','Say']);
  addSheet('Kateqoriya', dashCount(filtered, 'Servis Kat.', false), ['Kateqoriya','Say']);
  addSheet('Texnik', dashCountTech(filtered), ['Texnik','Say']);
  addSheet('Rehber', dashCount(filtered, 'Qrup rəhbəri', false), ['Qrup Rehberi','Say']);
  addSheet('Dasiyici', dashCount(filtered, 'Daşıyıcı', false), ['Dasiyici','Say']);
  addSheet('Unvan', dashCountLocation(filtered), ['Unvan','Say']);
  var recur=dashCountRecurringBuses(filtered);
  var recurAoa=[['D.Q.N.','BUS ID','Say']];
  recur.forEach(function(it){ recurAoa.push([it.plate||'', it.busId, it.count]); });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recurAoa), 'Tekrarlanan');
  var today=new Date();
  XLSX.writeFile(wb, 'BUS_Dashboard_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}
function exportToExcel(){
  if(rptFiltered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
  var cols=rptColumns;
  var wsData=[cols];
  rptFiltered.forEach(function(row){ wsData.push(cols.map(function(c){ return row[c]||''; })); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BUS Report');
  var today=new Date();
  XLSX.writeFile(wb, 'BUS_Report_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

// ═══════════════════════════════════════════════════
// DRAFT BƏRPA WİDGET
// ═══════════════════════════════════════════════════
var pendingBsDraft=null;
function offerBsDraftRestore(draft){
  pendingBsDraft=draft;
  var minsAgo=Math.max(1, Math.round((Date.now()-(draft.savedAt||0))/60000));
  var timeText=minsAgo<60?(minsAgo+' dəqiqə əvvəl'):(Math.round(minsAgo/60)+' saat əvvəl');
  document.getElementById('bsDraftConfirmText').textContent='Bu formada '+timeText+' saxlanılmış yarımçıq məlumat var. Davam etmək istəyirsiniz?';
  document.getElementById('bsDraftConfirmOverlay').style.display='flex';
}
function acceptBsDraft(){ document.getElementById('bsDraftConfirmOverlay').style.display='none'; if(pendingBsDraft) restoreBsDraft(pendingBsDraft); pendingBsDraft=null; }
function declineBsDraft(){ document.getElementById('bsDraftConfirmOverlay').style.display='none'; clearBsDraft(); pendingBsDraft=null; }

// ═══════════════════════════════════════════════════
// PULL-TO-REFRESH
// ═══════════════════════════════════════════════════
var ptrStartY=0, ptrTracking=false, PTR_THRESHOLD=110, ptrScrollEl=null;
function ptrFindScrollParent(el){
  while(el && el!==document.body && el!==document.documentElement){
    var cs=window.getComputedStyle(el);
    if((cs.overflowY==='auto'||cs.overflowY==='scroll') && el.scrollHeight>el.clientHeight+1){ return el; }
    el=el.parentElement;
  }
  return null;
}
function ptrScrollTop(el){
  if(el) return el.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}
function isUnsavedWorkPresent(){
  var bsView=document.getElementById('busServiceView');
  var bsDirty = bsFormDirty&&bsView&&bsView.style.display!=='none';
  var tvmView=document.getElementById('tvmServiceView');
  var tvmDirty = (typeof tvmFormDirty!=='undefined') && tvmFormDirty && tvmView && tvmView.style.display!=='none';
  return bsDirty || tvmDirty;
}
document.addEventListener('touchstart', function(e){
  ptrScrollEl=ptrFindScrollParent(e.target);
  ptrTracking=(ptrScrollTop(ptrScrollEl)<=0);
  ptrStartY=e.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchmove', function(e){
  if(!ptrTracking) return;
  if(ptrScrollTop(ptrScrollEl)>0){ ptrTracking=false; return; }
  if(e.touches[0].clientY-ptrStartY>PTR_THRESHOLD){ ptrTracking=false; triggerPullRefresh(); }
}, {passive:true});
document.addEventListener('touchend', function(){ ptrTracking=false; ptrScrollEl=null; });
function isInsideServiceForm(){
  var ids=['busServiceView','busBulkView','tvmServiceView'];
  return ids.some(function(id){ var el=document.getElementById(id); return el && el.style.display!=='none'; });
}
function getOpenReportRefresher(){
  var map={
    busReportView: (typeof loadReportData==='function') ? loadReportData : null,
    tvmReportView: (typeof loadTvmReportData==='function') ? loadTvmReportData : null,
    busDashboardView: (typeof loadDashData==='function') ? loadDashData : null
  };
  for(var id in map){
    var el=document.getElementById(id);
    if(el && el.style.display!=='none' && map[id]) return map[id];
  }
  return null;
}
function isInsideReadOnlyView(){
  var ids=['busDetailView','tvmDetailView','dashboardView'];
  return ids.some(function(id){ var el=document.getElementById(id); return el && el.style.display!=='none'; });
}
function triggerPullRefresh(){
  var softRefresh = getOpenReportRefresher();
  if(softRefresh){ softRefresh(); return; }
  if(isInsideReadOnlyView()){ return; }
  if(isUnsavedWorkPresent()||isInsideServiceForm()){ document.getElementById('bsRefreshConfirmOverlay').style.display='flex'; }
  else { location.reload(); }
}
function cancelPullRefresh(){ document.getElementById('bsRefreshConfirmOverlay').style.display='none'; }
function confirmPullRefresh(){ document.getElementById('bsRefreshConfirmOverlay').style.display='none'; clearBsDraft(); location.reload(); }
window.addEventListener('beforeunload', function(e){ if(isUnsavedWorkPresent()){ e.preventDefault(); e.returnValue=''; } });

// ═══════════════════════════════════════════════════
// BUS BULK SERVICE
// ═══════════════════════════════════════════════════
var bkCalYear, bkCalMonth, bkSelectedDate=null;
var BK_DOWS=['B','E','Ç','A','C','Ş','B'];
var BK_MONTHS=['Yanvar','Fevral','Mart','Aprel','May','İyun','İyul','Avqust','Sentyabr','Oktyabr','Noyabr','Dekabr'];
var bkPreviewData=null, bkFormDataLoaded=false;

var bkReturnTarget = 'busService';
function openBusBulk(){
  if(currentUser){
    var level = getAccessLevel(currentUser.role);
    if(level === 'technician'){
      alert('Bu bölməyə giriş icazəniz yoxdur. Yalnız admin və qrup rəhbərləri istifadə edə bilər.');
      return;
    }
  }

  // Haradan açıldığını yadda saxla ki, Home düyməsi düz yerə qaytarsın
  var dashVisible = getComputedStyle(document.getElementById('dashboardView')).display !== 'none';
  bkReturnTarget = dashVisible ? 'dashboard' : 'busService';

  var now = bakuNowDate();
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('busServiceView').style.display = 'none';
  document.getElementById('busBulkView').style.display = 'flex';

  var needsFetch = !(bsFormData && bsFormData.carriers);
  if(needsFetch){
    var ov=document.getElementById('bsLoadingOverlay'); var sp=document.getElementById('bsSpinner');
    var tx=document.getElementById('bsLoadingText'); var ic=document.getElementById('bsSuccessIcon');
    ov.style.display='flex'; ov.classList.add('open'); sp.style.display='block'; ic.style.display='none'; tx.textContent='Yüklənir...';
  }
  ensureBulkFormData(function(){
    if(needsFetch){
      var ov2=document.getElementById('bsLoadingOverlay');
      ov2.classList.remove('open'); ov2.style.display='none';
    }
  });
  if(!bkSelectedDate){
    bkCalYear = now.getFullYear();
    bkCalMonth = now.getMonth();
    bkSelectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  renderBkCal();
  bkUpdateSnFieldsState();
  bkUpdateImportCount();
}

function attemptBusBulkHome(){
  bsConfirmMode='busBulk';
  if(typeof bkFormDirty!=='undefined' && bkFormDirty){
    var co=document.getElementById('bsConfirmOverlay');
    co.style.display='flex'; co.classList.add('open');
    return;
  }
  closeBusBulk();
}

function closeBusBulk(){
  document.getElementById('busBulkView').style.display = 'none';
  if(bkReturnTarget === 'dashboard'){
    document.getElementById('dashboardView').style.display = 'block';
  } else {
    document.getElementById('busServiceView').style.display = 'block';
  }
  resetBulkForm();
}

function ensureBulkFormData(callback){
  if(bsFormData && bsFormData.carriers){ bkFillSelects(); bkFormDataLoaded=true; if(callback) callback(); return; }
  fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action:'getFormData'})
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status === 'OK'){
      bsFormData = d;
    }
    bkFillSelects();
    bkFormDataLoaded = true;
    if(callback) callback();
  })
  .catch(function(){ if(callback) callback(); });
}

function bkFillSelects(){
  var d = bsFormData || {};
  bkFillSel('bk_carrier', d.carriers, 'Seçin');
  bkFillSel('bk_category', d.busEquipment, 'Seçin');
  bkFillSel('bk_location', d.locations, 'Seçin (könüllü)');
  bkFillSel('bk_leader', d.leaders, 'Seçin');
  
  bkFillSel('bk_request_tmpl', d.busProblems, 'Seçin');
  bkFillSel('bk_solution_tmpl', d.solutions, 'Seçin');
  
  var locEl = document.getElementById('bk_location');
  if(locEl){
    locEl.onchange = function(){
      var isDigar = (this.value || '').toLowerCase().indexOf('digər') !== -1;
      document.getElementById('bk_location_note_wrap').style.display = isDigar ? 'block' : 'none';
    };
  }
}

function bkFillSel(id, arr, placeholder){
  var el = document.getElementById(id);
  if(!el) return;
  el.innerHTML = '<option value="">' + placeholder + '</option>' + (arr || []).map(function(x){ return '<option value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</option>'; }).join('');
}

function renderBkCal(){
  var labelEl = document.getElementById('bkCalLabel');
  var daysEl = document.getElementById('bkCalGrid');
  if(!labelEl || !daysEl) return;
  
  labelEl.textContent = BK_MONTHS[bkCalMonth] + ' ' + bkCalYear;
  daysEl.innerHTML = '';
  
  var firstDay = new Date(bkCalYear, bkCalMonth, 1);
  var startOffset = (firstDay.getDay() + 6) % 7;
  var daysInMonth = new Date(bkCalYear, bkCalMonth + 1, 0).getDate();
  var daysInPrev = new Date(bkCalYear, bkCalMonth, 0).getDate();
  var today = bakuNowDate();
  
  for(var i = 0; i < startOffset; i++){
    var el = document.createElement('div');
    el.className = 'bk-cal-day muted';
    el.textContent = daysInPrev - startOffset + i + 1;
    daysEl.appendChild(el);
  }
  
  for(var d = 1; d <= daysInMonth; d++){
    (function(day){
      var el = document.createElement('div');
      el.className = 'bk-cal-day';
      el.textContent = day;
      var thisDate = new Date(bkCalYear, bkCalMonth, day);
      if(bkSameDay(thisDate, today)) el.classList.add('today');
      if(bkSelectedDate && bkSameDay(thisDate, bkSelectedDate)) el.classList.add('selected');
      el.onclick = function(){
        bkSelectedDate = thisDate;
        renderBkCal();
        bkUpdateImportCount();
        updateSelectedDateDisplay();
      };
      daysEl.appendChild(el);
    })(d);
  }
  
  updateSelectedDateDisplay();
}

function updateSelectedDateDisplay(){
  var lbl = document.getElementById('bkSelectedDateLabel');
  if(!lbl) return;
  if(bkSelectedDate){
    lbl.textContent = '📅 ' + bkDateAz(bkSelectedDate);
    lbl.style.display = 'flex';
  } else {
    lbl.style.display = 'none';
  }
}

function bkSameDay(a, b){
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function bkCalNav(dir){
  bkCalMonth += dir;
  if(bkCalMonth < 0){ bkCalMonth = 11; bkCalYear--; }
  if(bkCalMonth > 11){ bkCalMonth = 0; bkCalYear++; }
  renderBkCal();
}

function bkFormatTime(el){
  var digits = el.value.replace(/[^0-9]/g, '').slice(0, 4);
  el.value = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
}

function bkGetTime(id){
  var v = (document.getElementById(id) || {}).value || '';
  v = v.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '';
}

function bkCollectData(){
  var _carrier = (typeof bkSelectedCarrier!=='undefined'&&bkSelectedCarrier)
    ? bkSelectedCarrier
    : (document.getElementById('bk_carrier')?document.getElementById('bk_carrier').value:'');
  return {
    carrier: _carrier,
    selectedDqns: (!bkAllMode&&typeof bkSelectedDqns!=='undefined'&&bkSelectedDqns.length>0)
      ? bkSelectedDqns.map(function(x){return x.dqn;}) : [],
    report_date: bkSelectedDate ? bkDateIso(bkSelectedDate) : '',
    service_start_time: bkGetTime('bk_start_time'),
    service_end_time: bkGetTime('bk_end_time'),
    changed_device_type: document.getElementById('bk_category').value,
    service_location: document.getElementById('bk_location').value,
    service_location_note: document.getElementById('bk_location_note') ? document.getElementById('bk_location_note').value : '',
    request_template: document.getElementById('bk_request_tmpl').value.trim(),
    note: document.getElementById('bk_note').value.trim(),
    solution_template: document.getElementById('bk_solution_tmpl').value.trim(),
    old_sn: '',
    new_sn: '',
    snByDqn: (function(){
      var out = {};
      Object.keys(bkSnByDqn||{}).forEach(function(dqn){
        out[dqn] = { oldSn: (bkSnByDqn[dqn].oldSn||[]).join(' | '), newSn: (bkSnByDqn[dqn].newSn||[]).join(' | ') };
      });
      return out;
    })(),
    technician_1: document.getElementById('bk_tech1').value,
    technician_2: document.getElementById('bk_tech2').value,
    team_leader: document.getElementById('bk_leader').value
  };
}

function bkValidate(data){
  if(!data.carrier) return 'Daşıyıcı firma seçilməyib';
  if(!data.report_date) return 'Servis tarixi seçilməyib';
  if(!data.service_start_time) return 'Servis başlanğıc saatı düzgün deyil';
  if(!data.service_end_time) return 'Servis bitiş saatı düzgün deyil';
  if(!data.changed_device_type) return 'Servis kateqoriyası seçilməyib';
  if(!data.request_template) return 'Tələb (şablon) mətni boşdur';
  if(!data.solution_template) return 'Həll (şablon) mətni boşdur';
  if(!data.team_leader) return 'Qrup rəhbəri seçilməyib';
  if(data.service_location && data.service_location.toLowerCase().indexOf('digər') !== -1 && !data.service_location_note) return 'Ünvan qeydi yazın';
  if(typeof bkAnySnConflict==='function' && bkAnySnConflict()) return 'Bir və ya bir neçə DQN-də eyni SN həm Köhnə, həm Yeni xanada var — düzəldin';
  return null;
}

function bkSubmitDirect(){
  var data = bkCollectData();
  var err = bkValidate(data);
  if(err){ alert(err); return; }
  
  var btn = document.getElementById('bkDirectSubmitBtn');
  btn.disabled = true;
  
  var ov = document.getElementById('bkLoadingOverlay');
  var sp = document.getElementById('bkSpinner');
  var ic = document.getElementById('bkSuccessIcon');
  var tx = document.getElementById('bkLoadingText');
  
  ov.style.display = 'flex';
  ov.classList.add('open');
  sp.style.display = 'block';
  ic.style.display = 'none';
  ic.classList.remove('show');
  tx.textContent = 'İdxal edilir...';
  
  fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action:'previewBulkImport', data: data})
  })
  .then(function(r){ return r.json(); })
  .then(function(d){
    btn.disabled = false;
    if(d.status !== 'OK'){
      sp.style.display = 'none';
      tx.textContent = 'Xəta: ' + (d.message || '');
      setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; }, 2000);
      return;
    }
    if(d.count === 0){
      sp.style.display = 'none';
      tx.textContent = '"' + data.carrier + '" daşıyıcısına aid avtobus tapılmadı.';
      setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; }, 2000);
      return;
    }
    bkRunImport(data, d.count);
  })
  .catch(function(e){
    btn.disabled = false;
    sp.style.display = 'none';
    tx.textContent = 'Şəbəkə xətası: ' + e.message;
    setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; }, 2000);
  });
}

function bkRunImport(data, count){
  var ov = document.getElementById('bkLoadingOverlay');
  var sp = document.getElementById('bkSpinner');
  var ic = document.getElementById('bkSuccessIcon');
  var tx = document.getElementById('bkLoadingText');
  
  ov.style.display = 'flex';
  ov.classList.add('open');
  sp.style.display = 'block';
  ic.style.display = 'none';
  ic.classList.remove('show');
  tx.textContent = count + ' ticket idxal edilir...';
  
  var btn = document.getElementById('bkDirectSubmitBtn');
  if(btn) btn.disabled = false;
  
  fetch(API_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      action: 'submitBulkImport',
      data: data,
      userEmail: currentUser ? currentUser.email : ''
    })
  })
  .then(function(r){ return r.json(); })
  .then(function(result){
    sp.style.display = 'none';
    ic.style.display = 'flex';
    ic.classList.add('show');
    
    if(result.status === 'OK'){
      tx.textContent = '✅ Yekunlaşdı! ' + result.count + ' ticket (' + result.firstTicketId + ' → ' + result.lastTicketId + ')';
    } else {
      tx.textContent = '❌ Xəta: ' + (result.message || '');
    }
    
    setTimeout(function(){
      ov.classList.remove('open');
      ov.style.display = 'none';
      ic.classList.remove('show');
      ic.style.display = 'none';
      
      resetBulkForm();
      closeBusBulk();
      if(typeof loadReportData === 'function') loadReportData();
      
    }, 2000);
  })
  .catch(function(e){
    sp.style.display = 'none';
    tx.textContent = '❌ Şəbəkə xətası: ' + e.message;
    setTimeout(function(){ 
      ov.classList.remove('open');
      ov.style.display = 'none';
      resetBulkForm();
      closeBusBulk();
    }, 2000);
  });
}

var bkFormDirty = false;
function resetBulkForm(){
  bkFormDirty = false;
  bkClosePreview();
  bkPreviewData = null;
  ['bk_carrier','bk_category','bk_location','bk_tech1','bk_tech2','bk_leader'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value = '';
  });
  ['bk_location_note','bk_request_tmpl','bk_note','bk_solution_tmpl','bk_start_time','bk_end_time'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.value = '';
  });
  document.getElementById('bk_location_note_wrap').style.display = 'none';

  bkSelectedCarrier = '';
  var carrierLbl = document.getElementById('bk_carrier_lbl');
  if(carrierLbl) carrierLbl.textContent = 'Seçin';
  var carrierDD = document.getElementById('bkCarrierDDList');
  if(carrierDD) carrierDD.style.display = 'none';
  document.getElementById('bkCarrierCountWrap').style.display = 'none';
  var countNumEl = document.getElementById('bkCountNum');
  if(countNumEl) countNumEl.textContent = '0';
  var countBadgeEl = document.getElementById('bkCountBadge');
  if(countBadgeEl) countBadgeEl.classList.remove('active','empty');

  bkSelectedDqns = [];
  bkAllMode = true;
  var toggle = document.getElementById('bkAllToggle');
  if(toggle) toggle.classList.remove('checked');
  var searchWrap = document.getElementById('bkDqnSearchWrap');
  if(searchWrap) searchWrap.style.display = 'none';
  var searchBox = document.getElementById('bkDqnSearchBox');
  if(searchBox) searchBox.classList.remove('active');
  var dqnInput = document.getElementById('bkDqnInput');
  if(dqnInput) dqnInput.value = '';
  var dqnClear = document.getElementById('bkDqnClear');
  if(dqnClear) dqnClear.style.display = 'none';
  var dqnSugg = document.getElementById('bkDqnSuggestions');
  if(dqnSugg){ dqnSugg.classList.remove('open'); dqnSugg.innerHTML = ''; }
  var noticeEl = document.getElementById('bkDqnNotice');
  if(noticeEl) noticeEl.style.display = 'none';
  bkRenderDqnChips();
  bkUpdateSnFieldsState();

  var now = bakuNowDate();
  bkCalYear = now.getFullYear();
  bkCalMonth = now.getMonth();
  bkSelectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  renderBkCal();
  bkUpdateImportCount();
}

function bkOpenPreview(){ /* Ön baxış funksiyası artıq istifadə olunmur */ }
function bkClosePreview(){ /* Ön baxış funksiyası artıq istifadə olunmur */ }
function bkDateChanged(val){
  if(!val) return;
  var parts = val.split('-');
  var d = new Date(+parts[0], +parts[1]-1, +parts[2]);
  bkSelectedDate = d;
  renderBkCal();
  bkUpdateImportCount();
}
function bkDateIso(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function bkDateAz(d){ return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }

function bkUpdateImportCount(){
  var btn = document.getElementById('bkDirectSubmitBtn');
  if(!btn) return;
  var carrier = '';
  var selEl = document.getElementById('bk_carrier');
  if(selEl) carrier = selEl.value;
  if(!carrier && typeof bkSelectedCarrier !== 'undefined') carrier = bkSelectedCarrier;
  var allMatches = (bsFormData && bsFormData.busRegistry || []).filter(function(r){
    return String(r.carrier||'').trim().toLowerCase() === carrier.trim().toLowerCase();
  });
  var count = (!bkAllMode && bkSelectedDqns.length > 0) ? bkSelectedDqns.length : allMatches.length;
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
    + ' İdxal et (' + count + ')';
}

if(typeof bkSelectedDqns === 'undefined') var bkSelectedDqns = [];
if(typeof bkAllMode     === 'undefined') var bkAllMode = true;

function bkSelectDqn(match){
  if(!match || !match.dqn) return;
  var already = bkSelectedDqns.find(function(x){ return x.dqn === match.dqn; });
  if(already) return;
  bkSelectedDqns.push({dqn: match.dqn, id: match.id, model: match.model});
  bkRenderDqnChips();
  bkUpdateDqnNotice();
  bkUpdateImportCount();
  bkRenderSnBlocks();
}

function bkRemoveDqn(dqn){
  bkSelectedDqns = bkSelectedDqns.filter(function(x){ return x.dqn !== dqn; });
  bkRenderDqnChips();
  bkUpdateDqnNotice();
  bkUpdateImportCount();
  bkRenderSnBlocks();
}

function bkRenderDqnChips(){
  var container = document.getElementById('bkDqnChips');
  if(!container) return;
  container.innerHTML = '';
  if(bkSelectedDqns.length === 0) return;
  bkSelectedDqns.forEach(function(x){
    var chip = document.createElement('div');
    chip.className = 'bk-dqn-chip';
    var safeDqn = x.dqn.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    chip.innerHTML = escapeHtml(x.dqn)
      + '<button class="bk-dqn-chip-x" onclick="bkRemoveDqn(\'' + safeDqn + '\')">&#x2715;</button>';
    container.appendChild(chip);
  });
}

function bkUpdateDqnNotice(){
  var noticeEl = document.getElementById('bkDqnNoticeText');
  if(!noticeEl) return;
  if(bkAllMode){
    noticeEl.textContent = 'Bütün avtobuslar seçilidir.';
  } else if(bkSelectedDqns.length === 0){
    noticeEl.textContent = 'DQN seçin — axtarış xanasından tapıb seçin.';
  } else {
    noticeEl.textContent = bkSelectedDqns.length + ' DQN seçildi. İdxal yalnız bunlar üçün olacaq.';
  }
}

var bkSelectedCarrier = '';

function bkToggleCarrierDD(){
  var dd = document.getElementById('bkCarrierDDList');
  if(!dd) return;
  if(dd.style.display === 'none' || !dd.style.display){
    var carriers = bsFormData && bsFormData.carriers ? bsFormData.carriers : [];
    if(!carriers.length){ ensureBulkFormData(); setTimeout(bkToggleCarrierDD, 700); return; }
    dd.innerHTML = carriers.map(function(c){
      var safe = c.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      return '<div class="bk-carrier-dd-item'+(c===bkSelectedCarrier?' selected':'')+'" onclick="bkSelectCarrier(\'' + safe + '\')">' + escapeHtml(c) + '</div>';
    }).join('');
    dd.style.display = 'block';
  } else {
    dd.style.display = 'none';
  }
}

// ── Bulk: Texnik 1/2 axtarışı (tək dəyər, köhnə select-in davranışını təqlid edir) ──
function bkTechSearchHandler(el, fieldId, excludeId){
  var ddId = fieldId + '_dd';
  var dd = document.getElementById(ddId);
  var q = el.value.trim();
  bkFormDirty = true;
  if(!q){ if(dd) dd.style.display='none'; return; }

  var allTech = (bsFormData && bsFormData.technicians) || [];
  var excludeVal = (document.getElementById(excludeId)?document.getElementById(excludeId).value:'').trim().toUpperCase();
  var qUpper = q.toUpperCase();
  var matches = allTech.filter(function(name){
    if(excludeVal && name.trim().toUpperCase() === excludeVal) return false;
    return name.toUpperCase().indexOf(qUpper) !== -1;
  }).slice(0,8);

  if(!dd) return;
  if(matches.length===0){
    dd.innerHTML = '<div class="bs-registry-empty">Uyğun texnik tapılmadı</div>';
  } else {
    dd.innerHTML = matches.map(function(name){
      return '<div class="bs-registry-item" data-name="'+escapeHtml(name)+'"><span class="reg-id">'+escapeHtml(name)+'</span></div>';
    }).join('');
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(itemEl){
      itemEl.addEventListener('click', function(e){
        e.stopPropagation();
        el.value = itemEl.getAttribute('data-name');
        dd.style.display = 'none';
      });
    });
  }
  dd.style.display = 'block';
}
document.addEventListener('click', function(e){
  ['bk_tech1','bk_tech2'].forEach(function(id){
    if(!e.target.closest('#'+id) && !e.target.closest('#'+id+'_dd')){
      var dd = document.getElementById(id+'_dd'); if(dd) dd.style.display='none';
    }
  });
});

function bkSelectCarrier(carrier){
  bkSelectedCarrier = carrier;
  bkFormDirty = true;
  var lbl = document.getElementById('bk_carrier_lbl');
  if(lbl) lbl.textContent = carrier;
  var dd = document.getElementById('bkCarrierDDList');
  if(dd) dd.style.display = 'none';
  var sel = document.getElementById('bk_carrier');
  if(sel){
    var found = false;
    for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value===carrier){ sel.selectedIndex=i; found=true; break; } }
    if(!found){ var opt=document.createElement('option'); opt.value=carrier; opt.textContent=carrier; sel.appendChild(opt); sel.value=carrier; }
  }
  bkOnCarrierChange();
}

function bkOnCarrierChange(){
  var carrier = bkSelectedCarrier || (document.getElementById('bk_carrier')?document.getElementById('bk_carrier').value:'');
  if(typeof bkSelectedDqns !== 'undefined') bkSelectedDqns = [];
  if(typeof bkAllMode !== 'undefined') bkAllMode = true;
  bkPreviewData = null;

  var countWrap = document.getElementById('bkCarrierCountWrap');
  var searchWrap = document.getElementById('bkDqnSearchWrap');
  var noticeEl = document.getElementById('bkDqnNotice');
  var toggle = document.getElementById('bkAllToggle');

  if(!carrier){
    if(countWrap) countWrap.style.display = 'none';
    if(searchWrap) searchWrap.style.display = 'none';
    if(noticeEl) noticeEl.style.display = 'none';
    bkUpdateSnFieldsState();
    bkUpdateImportCount(); return;
  }

  var matches = (bsFormData&&bsFormData.busRegistry||[]).filter(function(r){
    return String(r.carrier||'').trim().toLowerCase() === carrier.trim().toLowerCase();
  });

  if(countWrap){
    countWrap.style.display = 'flex';
    var numEl = document.getElementById('bkCountNum');
    if(numEl) numEl.textContent = matches.length;
    var badge = document.getElementById('bkCountBadge');
    if(badge){ badge.classList.remove('active','empty'); badge.classList.add(matches.length===0?'empty':'active'); }
  }

  if(toggle){ toggle.classList.add('checked'); }

  if(searchWrap) searchWrap.style.display = matches.length>0?'block':'none';
  var searchBox = document.getElementById('bkDqnSearchBox');
  if(searchBox){ searchBox.classList.remove('active'); }

  if(noticeEl) noticeEl.style.display = matches.length>0?'flex':'none';

  var inp = document.getElementById('bkDqnInput'); if(inp) inp.value='';
  var sugg = document.getElementById('bkDqnSuggestions'); if(sugg){ sugg.classList.remove('open'); sugg.innerHTML=''; }
  if(typeof bkRenderDqnChips==='function') bkRenderDqnChips();
  if(typeof bkUpdateDqnNotice==='function') bkUpdateDqnNotice();
  bkUpdateSnFieldsState();
  bkUpdateImportCount();
}

// ── Toplu İdxal: hər seçilmiş DQN üçün ayrıca Köhnə/Yeni SN blokları ──
// (Bus Service-dəki Validator SN + SAM Card SN çip məntiqinin eyni məntiqlə
// təkrarıdır — amma ayrı funksiyalarda saxlanılıb ki, işlək Bus Service
// kodu toxunulmasın.)
var bkSnByDqn = {}; // { "77-JA-568": {oldSn:[], newSn:[]} }

function bkDqnSafeId(dqn){ return String(dqn||'').replace(/[^a-zA-Z0-9]/g,'_'); }

function bkUpdateSnFieldsState(){
  bkRenderSnBlocks();
}

function bkRenderSnBlocks(){
  var container = document.getElementById('bkSnPerDqnContainer');
  var emptyState = document.getElementById('bkSnEmptyState');
  if(!container || !emptyState) return;

  var active = (typeof bkAllMode !== 'undefined') && !bkAllMode && typeof bkSelectedDqns !== 'undefined' && bkSelectedDqns.length > 0;
  if(!active){
    emptyState.style.display = 'block';
    container.innerHTML = '';
    bkSnByDqn = {};
    return;
  }
  emptyState.style.display = 'none';

  // Artıq seçili olmayan DQN-lərin datasını təmizlə
  var validDqns = bkSelectedDqns.map(function(x){ return x.dqn; });
  Object.keys(bkSnByDqn).forEach(function(d){ if(validDqns.indexOf(d)===-1) delete bkSnByDqn[d]; });

  container.innerHTML = bkSelectedDqns.map(function(x){
    var dqn = x.dqn;
    var safeId = bkDqnSafeId(dqn);
    if(!bkSnByDqn[dqn]) bkSnByDqn[dqn] = { oldSn: [], newSn: [] };
    return '<div class="bk-dqn-sn-block">'
      + '<div class="bk-dqn-sn-block-title">DQN: '+escapeHtml(dqn)+'</div>'
      + '<div class="bk-dqn-sn-row">'
      + '<div class="bk-field" style="position:relative;margin-bottom:0;">'
      +   '<label class="bk-label" style="font-size:12px;">Köhnə SN</label>'
      +   '<input type="text" class="bk-input" placeholder="SN axtar və seç..." autocomplete="off" '
      +   'oninput="bkSnInputHandler(this,\''+safeId+'\',\'old\')" '
      +   'onfocus="bkSnInputHandler(this,\''+safeId+'\',\'old\')" '
      +   'onkeydown="bkSnInputKeydown(event,this,\''+safeId+'\',\'old\')">'
      +   '<div class="bs-registry-dd" id="bkSnDD_'+safeId+'_old" style="display:none;"></div>'
      +   '<div class="bs-chips" id="bkSnChips_'+safeId+'_old"></div>'
      + '</div>'
      + '<div class="bk-field" style="position:relative;margin-bottom:0;">'
      +   '<label class="bk-label" style="font-size:12px;">Yeni SN</label>'
      +   '<input type="text" class="bk-input" placeholder="SN axtar və seç..." autocomplete="off" '
      +   'oninput="bkSnInputHandler(this,\''+safeId+'\',\'new\')" '
      +   'onfocus="bkSnInputHandler(this,\''+safeId+'\',\'new\')" '
      +   'onkeydown="bkSnInputKeydown(event,this,\''+safeId+'\',\'new\')">'
      +   '<div class="bs-registry-dd" id="bkSnDD_'+safeId+'_new" style="display:none;"></div>'
      +   '<div class="bs-chips" id="bkSnChips_'+safeId+'_new"></div>'
      + '</div>'
      + '</div>'
      + '<div class="bs-sn-conflict-err" id="bkSnConflict_'+safeId+'" style="display:none;margin-top:10px;">✕ Eyni SN həm Köhnə, həm Yeni xanada ola bilməz</div>'
      + '</div>';
  }).join('');

  bkSelectedDqns.forEach(function(x){ bkSnRenderChipsFor(x.dqn, 'old'); bkSnRenderChipsFor(x.dqn, 'new'); });
}

function bkFindDqnBySafeId(safeId){
  var found = bkSelectedDqns.find(function(x){ return bkDqnSafeId(x.dqn) === safeId; });
  return found ? found.dqn : null;
}

function bkSnInputHandler(el, safeId, type){
  var dqn = bkFindDqnBySafeId(safeId);
  if(!dqn) return;
  var dd = document.getElementById('bkSnDD_'+safeId+'_'+type);
  var q = el.value.trim();
  bkFormDirty = true;
  if(!q){ if(dd) dd.style.display='none'; return; }
  var matches = (typeof busSnSearchMatches==='function') ? busSnSearchMatches(q) : [];
  if(dd){
    if(matches.length===0){
      dd.innerHTML = '<div class="bs-registry-empty">Uyğun SN tapılmadı — Enter ilə yenə də əlavə edə bilərsiniz</div>';
    } else {
      dd.innerHTML = matches.map(function(sn){
        return '<div class="bs-registry-item" data-sn="'+escapeHtml(sn)+'"><span class="reg-id">'+escapeHtml(sn)+'</span></div>';
      }).join('');
      Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(itemEl){
        itemEl.addEventListener('click', function(e){
          e.stopPropagation();
          bkSnAddChip(dqn, type, itemEl.getAttribute('data-sn'));
          el.value = '';
          dd.style.display = 'none';
        });
      });
    }
    dd.style.display = 'block';
  }
}

function bkSnInputKeydown(e, el, safeId, type){
  if(e.key === 'Enter'){
    e.preventDefault();
    var dqn = bkFindDqnBySafeId(safeId);
    if(!dqn) return;
    var v = el.value.trim();
    if(v){
      bkSnAddChip(dqn, type, v);
      el.value = '';
      var dd = document.getElementById('bkSnDD_'+safeId+'_'+type);
      if(dd) dd.style.display = 'none';
    }
  }
}

function bkSnFindCrossDqnDuplicate(currentDqn, type, sn){
  var snUpper = sn.toUpperCase();
  var foundDqn = null;
  Object.keys(bkSnByDqn).forEach(function(otherDqn){
    if(otherDqn === currentDqn || foundDqn) return;
    var arr = type==='old' ? bkSnByDqn[otherDqn].oldSn : bkSnByDqn[otherDqn].newSn;
    if(arr.some(function(x){ return x.toUpperCase()===snUpper; })) foundDqn = otherDqn;
  });
  return foundDqn;
}

function showWarnToast(message){
  var ov=document.getElementById('warnToastOverlay');
  var tx=document.getElementById('warnToastText');
  if(tx) tx.textContent=message;
  if(ov){ ov.style.display='flex'; ov.classList.add('open'); }
}
function closeWarnToast(){
  var ov=document.getElementById('warnToastOverlay');
  if(ov){ ov.classList.remove('open'); ov.style.display='none'; }
}

function showWarnToast(message){
  var tx = document.getElementById('warnToastText');
  var ov = document.getElementById('warnToastOverlay');
  if(tx) tx.textContent = message;
  if(ov) ov.classList.add('open');
}
function closeWarnToast(){
  var ov = document.getElementById('warnToastOverlay');
  if(ov) ov.classList.remove('open');
}

function bkSnAddChip(dqn, type, sn){
  sn = String(sn||'').trim();
  if(!sn || !bkSnByDqn[dqn]) return;
  var arr = type==='old' ? bkSnByDqn[dqn].oldSn : bkSnByDqn[dqn].newSn;
  var already = arr.some(function(x){ return x.toUpperCase()===sn.toUpperCase(); });
  if(!already){
    arr.push(sn);
    var dupDqn = bkSnFindCrossDqnDuplicate(dqn, type, sn);
    if(dupDqn){
      showWarnToast('Diqqət: "'+sn+'" SN artıq '+dupDqn+' DQN-nin '+(type==='old'?'Köhnə':'Yeni')+' SN xanasında istifadə olunub. Səhv yazma ehtimalını yoxlayın.');
    }
  }
  bkFormDirty = true;
  bkSnRenderChipsFor(dqn, type);
  bkSnCheckConflict(dqn);
  bkSnRenderAllChipsOfType(type); // digər DQN-lərdəki eyni SN-in vizual işarəsi də yenilənsin
}

function bkSnRemoveChip(dqn, type, sn){
  if(!bkSnByDqn[dqn]) return;
  var arr = type==='old' ? bkSnByDqn[dqn].oldSn : bkSnByDqn[dqn].newSn;
  var idx = arr.findIndex(function(x){ return x.toUpperCase()===sn.toUpperCase(); });
  if(idx!==-1) arr.splice(idx,1);
  bkFormDirty = true;
  bkSnRenderChipsFor(dqn, type);
  bkSnCheckConflict(dqn);
  bkSnRenderAllChipsOfType(type);
}

function bkSnRenderAllChipsOfType(type){
  Object.keys(bkSnByDqn).forEach(function(dqn){ bkSnRenderChipsFor(dqn, type); });
}

function bkSnRenderChipsFor(dqn, type){
  if(!bkSnByDqn[dqn]) return;
  var arr = type==='old' ? bkSnByDqn[dqn].oldSn : bkSnByDqn[dqn].newSn;
  var safeId = bkDqnSafeId(dqn);
  var box = document.getElementById('bkSnChips_'+safeId+'_'+type);
  if(!box) return;
  box.innerHTML = arr.map(function(sn){
    var notInDb = (typeof busSnExists==='function') && (typeof busValidatorSNLoaded!=='undefined') && busValidatorSNLoaded && !busSnExists(sn);
    var dupDqn = bkSnFindCrossDqnDuplicate(dqn, type, sn);
    var warn = notInDb || dupDqn;
    var title = dupDqn ? ('Diqqət: bu SN '+dupDqn+' DQN-də də istifadə olunub') : (notInDb ? 'Bu SN bazada tapılmadı — diqqətlə yoxlayın' : '');
    var safeSn = sn.replace(/'/g,'');
    return '<span class="bs-chip'+(warn?' bs-chip-warn':'')+'"'+(warn?' title="'+escapeHtml(title)+'">⚠ ':'>')
      + escapeHtml(sn)
      + '<button type="button" class="bs-chip-x" onclick="bkSnRemoveChip(\''+dqn.replace(/'/g,'')+'\',\''+type+'\',\''+safeSn+'\')">✕</button></span>';
  }).join('');
}

function bkSnCheckConflict(dqn){
  var safeId = bkDqnSafeId(dqn);
  var errEl = document.getElementById('bkSnConflict_'+safeId);
  if(!errEl || !bkSnByDqn[dqn]) return false;
  var oldSet = bkSnByDqn[dqn].oldSn.map(function(s){ return s.toUpperCase(); });
  var newSet = bkSnByDqn[dqn].newSn.map(function(s){ return s.toUpperCase(); });
  var conflict = newSet.some(function(s){ return oldSet.indexOf(s)!==-1; });
  errEl.style.display = conflict ? 'block' : 'none';
  return conflict;
}

function bkAnySnConflict(){
  return Object.keys(bkSnByDqn).some(function(dqn){ return bkSnCheckConflict(dqn); });
}

document.addEventListener('click', function(e){
  if(!e.target.closest('.bk-dqn-sn-block .bk-input') && !e.target.closest('.bk-dqn-sn-block .bs-registry-dd')){
    document.querySelectorAll('.bk-dqn-sn-block .bs-registry-dd').forEach(function(dd){ dd.style.display='none'; });
  }
});


function bkToggleAllMode(){
  if(typeof bkAllMode === 'undefined') bkAllMode = true;
  bkAllMode = !bkAllMode;
  var toggle = document.getElementById('bkAllToggle');
  var badge  = document.getElementById('bkCountBadge');
  var searchBox = document.getElementById('bkDqnSearchBox');

  if(bkAllMode){
    if(toggle) toggle.classList.add('checked');
    if(badge) badge.classList.add('active');
    if(searchBox) searchBox.classList.remove('active');
    if(typeof bkSelectedDqns!=='undefined') bkSelectedDqns=[];
    if(typeof bkRenderDqnChips==='function') bkRenderDqnChips();
  } else {
    if(toggle) toggle.classList.remove('checked');
    if(badge) badge.classList.remove('active');
    if(searchBox) searchBox.classList.add('active');
  }
  if(typeof bkUpdateDqnNotice==='function') bkUpdateDqnNotice();
  bkUpdateSnFieldsState();
  bkUpdateImportCount();
}

function bkDqnInputHandler(el){
  var raw = el.value.toUpperCase().replace(/[^0-9A-Z]/g,'');
  var p1=raw.slice(0,2), rest=raw.slice(2), letters='', nums='';
  for(var i=0;i<rest.length;i++){
    if(/[A-Z]/.test(rest[i])&&letters.length<2) letters+=rest[i];
    else if(/[0-9]/.test(rest[i])&&letters.length===2&&nums.length<3) nums+=rest[i];
  }
  var fmt = raw.length>0 ? (p1+(letters?'-'+letters:'')+(nums?'-'+nums:'')) : '';
  el.value = fmt;
  var clr=document.getElementById('bkDqnClear'); if(clr) clr.style.display=fmt?'flex':'none';

  var carrier = bkSelectedCarrier||(document.getElementById('bk_carrier')?document.getElementById('bk_carrier').value:'');
  var sugg = document.getElementById('bkDqnSuggestions');
  if(!sugg) return;
  if(raw.length<2){ sugg.classList.remove('open'); return; }

  var already = (typeof bkSelectedDqns!=='undefined') ? bkSelectedDqns.map(function(x){ return x.dqn.replace(/-/g,'').toUpperCase(); }) : [];
  var reg = (bsFormData&&bsFormData.busRegistry||[]).filter(function(r){
    if(String(r.carrier||'').trim().toLowerCase()!==carrier.trim().toLowerCase()) return false;
    var dqn = String(r.dqn||'').toUpperCase().replace(/-/g,'');
    return already.indexOf(dqn)===-1 && dqn.indexOf(raw)!==-1;
  });

  sugg.innerHTML='';
  if(!reg.length){
    sugg.innerHTML='<div class="bk-dqn-suggest-item"><span class="bk-dqn-suggest-dqn" style="color:#9AACC4;">Tapılmadı</span></div>';
  } else {
    reg.slice(0,10).forEach(function(r){
      var div=document.createElement('div'); div.className='bk-dqn-suggest-item';
      div.innerHTML='<span class="bk-dqn-suggest-dqn">'+escapeHtml(r.dqn)+'</span><span class="bk-dqn-suggest-meta">'+escapeHtml(r.id)+' · '+escapeHtml(r.model)+'</span>';
      (function(m){ div.addEventListener('click',function(){
        bkSelectDqn(m); el.value=''; if(clr) clr.style.display='none'; sugg.classList.remove('open'); el.focus();
      }); })(r);
      sugg.appendChild(div);
    });
  }
  sugg.classList.add('open');
}

function bkClearDqnInput(){
  var el=document.getElementById('bkDqnInput'); if(el) el.value='';
  var clr=document.getElementById('bkDqnClear'); if(clr) clr.style.display='none';
  var sugg=document.getElementById('bkDqnSuggestions'); if(sugg) sugg.classList.remove('open');
}

document.addEventListener('click',function(e){
  if(!e.target.closest('.bk-carrier-dd-wrap')){
    var dd=document.getElementById('bkCarrierDDList'); if(dd) dd.style.display='none';
  }
  if(!e.target.closest('#bkDqnSearchWrap')){
    var sugg=document.getElementById('bkDqnSuggestions'); if(sugg) sugg.classList.remove('open');
  }
});

// ═══════════════════════════════════════════════════
// TVM SERVICE — TAM MODUL
// ═══════════════════════════════════════════════════

var tvmFormData = null;
var tvmNextTicketId = '';
var tvmFormDataLoaded = false;
var tvmSelectedSn = null;
var tvmFormDirty = false;
var tvmEditMode = false, tvmEditTicketId = null, tvmReturnTarget = 'dashboard';

function openTvmService(){
  if(currentUser){
    var lvl = getAccessLevel(currentUser.role);
    if(lvl === 'technician'){
    }
  }
  tvmEditMode = false; tvmEditTicketId = null; tvmReturnTarget = 'dashboard';
  var btn = document.getElementById('tvmSubmitBtnText'); if(btn) btn.textContent = 'Göndər';
  document.getElementById('dashboardView').style.display = 'none';
  document.getElementById('tvmServiceView').style.display = 'block';
  resetTvmFormFields();
  var bParts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  var dateEl = document.getElementById('tvm_date');
  if(dateEl) dateEl.value = bParts;

  var badge = document.getElementById('tvmTicketBadge');
  if(badge){
    badge.innerHTML = tvmNextTicketId
      ? '<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+tvmNextTicketId+'</span>'
      : '<span style="display:inline-flex;align-items:center;background:#B0C4E0;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">yüklənir...</span>';
  }
  loadFastTicketIds();
  if(!tvmFormData || !tvmFormData.tvmLeaders){ loadTvmFormData(); }
}

function closeTvmService(){
  closeAllDD();
  closeTvmSnDD();
  document.getElementById('tvmServiceView').style.display = 'none';
  if(tvmReturnTarget === 'report'){ document.getElementById('tvmReportView').style.display = 'flex'; }
  else { document.getElementById('dashboardView').style.display = 'block'; }
  tvmEditMode = false; tvmEditTicketId = null; tvmReturnTarget = 'dashboard';
}

function attemptTvmHome(){
  if(tvmFormDirty){
    var co = document.getElementById('tvmConfirmOverlay');
    co.style.display = 'flex'; co.classList.add('open');
  } else {
    closeTvmService();
  }
}
function closeTvmConfirm(){
  var co = document.getElementById('tvmConfirmOverlay');
  co.classList.remove('open'); co.style.display = 'none';
}
function confirmTvmExit(){
  var co = document.getElementById('tvmConfirmOverlay');
  co.classList.remove('open'); co.style.display = 'none';
  closeTvmService();
}

document.addEventListener('DOMContentLoaded', function(){
  var inputs = document.querySelectorAll('#tvmServiceView input, #tvmServiceView select, #tvmServiceView textarea');
  inputs.forEach(function(el){
    el.addEventListener('input', function(){ tvmFormDirty = true; });
    el.addEventListener('change', function(){ tvmFormDirty = true; });
  });
});

function loadTvmFormData(){
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmFormData'})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status !== 'OK') {
      var badge = document.getElementById('tvmTicketBadge');
      if(badge && !tvmEditMode && !tvmNextTicketId) badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#6B7280;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">OFFLINE</span>';
      return;
    }
    tvmFormData = d;
    tvmFormDataLoaded = true;
  })
  .catch(function(){
    var badge = document.getElementById('tvmTicketBadge');
    if(badge && !tvmEditMode && !tvmNextTicketId) badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#6B7280;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">OFFLINE</span>';
  });
}

function openTvmServiceForEdit(ticketId){
  var ov = document.getElementById('busOpenOverlay'); if(ov) ov.style.display = 'flex';
  var ensureFormData = (tvmFormData && tvmFormData.tvmLeaders) ? Promise.resolve(tvmFormData) :
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK') tvmFormData=d; return tvmFormData; });
  ensureFormData.then(function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmServiceById',ticketId:ticketId})}).then(function(r){return r.json();});
  }).then(function(d){
    if(ov) ov.style.display = 'none';
    if(d.status !== 'OK'){ alert(d.message||'Ticket yüklənə bilmədi'); return; }

    tvmEditMode = true; tvmEditTicketId = ticketId; tvmReturnTarget = 'report';
    resetTvmFormFields();
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('tvmReportView').style.display = 'none';
    document.getElementById('tvmServiceView').style.display = 'block';
    document.getElementById('tvmServiceView').scrollTop = 0;

    var badge = document.getElementById('tvmTicketBadge');
    if(badge) badge.innerHTML = '<span style="display:inline-flex;align-items:center;background:#D97706;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">REDAKTƏ: '+d.ticketId+'</span>';
    var btnText = document.getElementById('tvmSubmitBtnText'); if(btnText) btnText.textContent = 'Yadda saxla';

    document.getElementById('tvm_date').value = d.report_date_raw || '';
    document.getElementById('tvm_fault_time').value = d.fault_time || '';
    document.getElementById('tvm_sn').value = d.tvm_sn || '';
    document.getElementById('tvm_start_time').value = d.service_start_time || '';
    document.getElementById('tvm_end_time').value = d.service_end_time || '';
    document.getElementById('tvm_note').value = d.note || '';
    document.getElementById('tvm_old_sn').value = d.old_sn || '';
    document.getElementById('tvm_new_sn').value = d.new_sn || '';

    tvmSelectedSn = { id: d.tvm_sn||'', location: d.location||'', serviceLocation: d.service_location||'' };
    var locWrap = document.getElementById('tvm_location_wrap'), locDisp = document.getElementById('tvm_location_display');
    if(d.location){ if(locDisp) locDisp.textContent = d.location; if(locWrap) locWrap.style.display = 'block'; }
    var svcWrap = document.getElementById('tvm_service_location_wrap'), svcDisp = document.getElementById('tvm_service_location_display');
    if(d.service_location){ if(svcDisp) svcDisp.textContent = d.service_location; if(svcWrap) svcWrap.style.display = 'block'; }

    bsSelected.tvm_fault = Array.isArray(d.fault) ? d.fault.slice() : [];
    bsSelected.tvm_solution = Array.isArray(d.solution) ? d.solution.slice() : [];
    updateMultiLabel('tvm_fault'); updateTvmChips('fault');
    updateMultiLabel('tvm_solution'); updateTvmChips('solution');
    if(d.technician) setDDValue('tvm_tech', d.technician);
    if(d.team_leader) setDDValue('tvm_leader', d.team_leader);

    tvmFormDirty = false;
  }).catch(function(){ if(ov) ov.style.display = 'none'; alert('Şəbəkə xətası: ticket yüklənə bilmədi'); });
}

function resetTvmFormFields(){
  tvmFormDirty = false;
  tvmSelectedSn = null;
  ['tvm_fault_time','tvm_sn','tvm_start_time','tvm_end_time','tvm_note','tvm_old_sn','tvm_new_sn'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.value = '';
  });
  var dateEl = document.getElementById('tvm_date'); if(dateEl) dateEl.value = '';

  bsSelected.tvm_fault = []; bsSelected.tvm_solution = []; bsSelected.tvm_tech = ''; bsSelected.tvm_leader = '';
  ['tvm_fault','tvm_solution','tvm_tech','tvm_leader'].forEach(function(k){
    var m = ddMeta[k]; var el = document.getElementById(m.lbl);
    if(el){
      if(el.tagName==='INPUT'){ el.value=''; }
      else { el.textContent = (k==='tvm_fault'||k==='tvm_solution') ? 'Seçin (çoxlu seçim)' : 'Seçin'; el.style.color = '#9AACC4'; el.style.fontSize=''; el.style.fontWeight=''; el.classList.remove('filled'); }
    }
    closeDD(k);
  });
  updateTvmChips('fault'); updateTvmChips('solution');

  var locWrap = document.getElementById('tvm_location_wrap'); if(locWrap) locWrap.style.display = 'none';
  var svcLocWrap = document.getElementById('tvm_service_location_wrap'); if(svcLocWrap) svcLocWrap.style.display = 'none';
  closeTvmSnDD();
}

function tvmFormatTime(el){ formatTimeInput(el); tvmFormDirty = true; }

// ═══════════════════════════════════════════════════════════════
// BUS SN ÇİPLƏRİ — Validator SN + SAM Card SN reyestrləri ilə
// uyğunlaşdırma (Köhnə/Yeni cihaz SN). Hər ikisi sayt açılanda BİR
// DƏFƏ yüklənir, sonra hər yazışda backendə getmədən, birbaşa
// yaddaşdan axtarılır. Çox-seçimli (çip) formadır — bir ticket-də
// həm Validator, həm SAM Card dəyişdirilibsə, hər ikisi eyni xanaya
// ayrı-ayrı çiplər kimi əlavə oluna bilər.
// ═══════════════════════════════════════════════════════════════
var busValidatorSNList = [];
var busSamCardSNList = [];
var busCombinedSNSet = null; // Set — O(1) tam-uyğunluq yoxlaması üçün (hər iki baza birlikdə)
var busValidatorSNLoaded = false;
var busValidatorSNLoading = false;

// ═══════════════════════════════════════════════════════════════
// BİLDİRİŞLƏR (yalnız mobil) — Admin-dən göndərilən mesajlar.
// "Oxundu" statusu bu cihazda (localStorage) saxlanılır — sadə,
// server tərəfində əlavə "istifadəçi başına" izləmə cədvəli tələb
// etmir. Mesajlar 48 saatdan sonra siyahıdan avtomatik çıxır
// (backend bunu artıq filtrləyir).
// ═══════════════════════════════════════════════════════════════
var notifList = [];
var notifCurrentOpenId = null;
var NOTIF_READ_KEY = 'ctech_notif_read_ids';

function notifGetReadIds(){
  try { return JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]'); } catch(e){ return []; }
}
function notifMarkReadLocal(id){
  var ids = notifGetReadIds();
  if(ids.indexOf(id) === -1){ ids.push(id); try{ localStorage.setItem(NOTIF_READ_KEY, JSON.stringify(ids)); }catch(e){} }
}
function notifIsRead(id){ return notifGetReadIds().indexOf(id) !== -1; }

function preloadNotifications(){
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getActiveNotifications', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK') return;
    notifList = d.notifications || [];
    notifUpdateBadge();
    // Bildiriş siyahısı görünüşü açıqdırsa (istifadəçi hazırda ora baxırsa), onu da sakitcə yenilə
    var notifView = document.getElementById('notifView');
    var listView = document.getElementById('notifListView');
    if(notifView && notifView.style.display==='block' && listView && listView.style.display!=='none'){
      notifRenderList();
    }
  })
  .catch(function(){});
}

function notifUpdateBadge(){
  var readIds = notifGetReadIds();
  var unread = notifList.filter(function(n){ return readIds.indexOf(n.id)===-1; }).length;
  var badge = document.getElementById('notifBadge');
  if(!badge) return;
  if(unread > 0){ badge.textContent = unread > 99 ? '99+' : String(unread); badge.style.display='flex'; }
  else { badge.style.display='none'; }
}

function openNotifications(){
  if(window.innerWidth >= 901) return; // yalnız mobil
  document.getElementById('dashboardView').style.display='none';
  document.getElementById('notifView').style.display='block';
  document.getElementById('notifListView').style.display='block';
  document.getElementById('notifDetailView').style.display='none';
  notifRenderList();
  preloadNotifications(); // hər açılışda təzələ
}

function closeNotifications(){
  document.getElementById('notifView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}

function notifRenderList(){
  var box = document.getElementById('notifList');
  if(!box) return;
  if(notifList.length===0){
    box.innerHTML = '<div class="adm-empty">Hazırda bildiriş yoxdur</div>';
    return;
  }
  box.innerHTML = notifList.map(function(n){
    var unread = !notifIsRead(n.id);
    var preview = n.message.length>90 ? n.message.slice(0,90)+'…' : n.message;
    return '<div class="notif-item'+(unread?' unread':'')+'" onclick="notifOpenDetail(\''+n.id+'\')">'
      + '<div class="notif-item-top">'
      + (unread ? '<span class="notif-item-dot"></span><span class="notif-item-label">Yeni mesaj var</span>' : '<span class="notif-item-label" style="color:#9AACC4;">Mesaj</span>')
      + '<span class="notif-item-time">'+escapeHtml(n.date)+' '+escapeHtml(n.time)+'</span>'
      + '</div>'
      + '<div class="notif-item-preview">'+escapeHtml(preview)+'</div>'
      + '</div>';
  }).join('');
}

function notifOpenDetail(id){
  var n = notifList.find(function(x){ return x.id===id; });
  if(!n) return;
  notifCurrentOpenId = id;
  document.getElementById('notifListView').style.display='none';
  document.getElementById('notifDetailView').style.display='block';
  document.getElementById('notifDetailDateTime').textContent = n.date + ' ' + n.time;
  document.getElementById('notifDetailText').textContent = n.message;
}

function markNotificationReadAndClose(){
  if(notifCurrentOpenId){ notifMarkReadLocal(notifCurrentOpenId); notifCurrentOpenId=null; }
  notifUpdateBadge();
  closeNotifications();
}

// ── ADMIN PANEL: MESSAGES (bildiriş göndərmə + tarixçə) ──
function loadAdminMessages(){
  var dateEl = document.getElementById('admMsgDate');
  var timeEl = document.getElementById('admMsgTime');
  if(dateEl && !dateEl.value){ var now=bakuNowDate(); dateEl.value = now.toISOString().slice(0,10); }
  if(timeEl && !timeEl.value){ var now2=bakuNowDate(); timeEl.value = String(now2.getHours()).padStart(2,'0')+':'+String(now2.getMinutes()).padStart(2,'0'); }
  admRenderMessageHistory();
}

function admRenderMessageHistory(){
  var box = document.getElementById('admMsgHistoryList');
  if(!box) return;
  box.innerHTML = '<div class="adm-empty">Yüklənir...</div>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getActiveNotifications', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ box.innerHTML='<div class="adm-empty">Xəta baş verdi</div>'; return; }
    var list = d.notifications || [];
    if(list.length===0){ box.innerHTML='<div class="adm-empty">Son 48 saatda göndərilmiş bildiriş yoxdur</div>'; return; }
    box.innerHTML = list.map(function(n){
      var preview = n.message.length>70 ? n.message.slice(0,70)+'…' : n.message;
      return '<div class="adm-reorder-row">'
        + '<span class="adm-reorder-text">'+escapeHtml(n.date)+' '+escapeHtml(n.time)+' — '+escapeHtml(preview)+'</span>'
        + '<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteNotification(\''+n.id+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        + '</div>';
    }).join('');
  })
  .catch(function(){ box.innerHTML='<div class="adm-empty">Şəbəkə xətası</div>'; });
}

function admDeleteNotification(id){
  admOpenDeleteConfirm('Bu bildirişi silmək istədiyinizə əminsiniz? Mobil tətbiqdəki bildiriş bölməsindən də silinəcək.', function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteNotification', id:id, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admRenderMessageHistory();
    });
  });
}

function submitAdminNotification(){
  var dateEl = document.getElementById('admMsgDate');
  var timeEl = document.getElementById('admMsgTime');
  var textEl = document.getElementById('admMsgText');
  var errEl = document.getElementById('admMsgFormError');
  errEl.style.display='none';

  var message = textEl.value.trim();
  if(!message){ errEl.textContent='Mesaj mətni boş ola bilməz.'; errEl.style.display='block'; return; }
  var timeVal = getTimeInputValue('admMsgTime');
  if(!timeVal){ errEl.textContent='Saat düzgün deyil (HH:MM formatında olmalıdır).'; errEl.style.display='block'; return; }

  // ISO tarixi (yyyy-mm-dd) DD.MM.YYYY formatına çeviririk (sistemin qalan hissəsi ilə uyğun)
  var dateVal = dateEl.value;
  var dateFormatted = dateVal ? dateVal.split('-').reverse().join('.') : '';

  var btn = document.getElementById('admMsgSendBtn');
  btn.disabled = true; var origText = btn.textContent; btn.textContent='Göndərilir...';

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({
    action:'sendNotification',
    data:{ date: dateFormatted, time: timeVal, message: message },
    requesterEmail: currentUser?currentUser.email:''
  })})
  .then(function(r){ return r.json(); })
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    textEl.value='';
    admRenderMessageHistory();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}

// ── ADMIN PANEL: HOME DASHBOARDS (stat kartların konfiqurasiyası) ──
var HOME_DASH_METRICS = [
  { value:'bus_open', label:'Açıq Servislər (Bus)' },
  { value:'bus_today', label:'Bugünkü Servislər (Bus)' },
  { value:'bus_active_tech', label:'Aktiv Texniklər (Bus)' },
  { value:'bus_latest', label:'Son Servis (Bus)' },
  { value:'none', label:'Heç biri (boş)' }
];
var admHomeDashConfig = [];

function loadAdminHomeDashboard(){
  var box=document.getElementById('admHomeDashSlots');
  box.innerHTML='<div class="adm-empty">Yüklənir...</div>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getDashboardConfig', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status!=='OK'){ box.innerHTML='<div class="adm-empty">Xəta baş verdi</div>'; return; }
    admHomeDashConfig = d.config || [];
    renderHomeDashSlots();
  })
  .catch(function(){ box.innerHTML='<div class="adm-empty">Şəbəkə xətası</div>'; });
}
function renderHomeDashSlots(){
  var box=document.getElementById('admHomeDashSlots');
  box.innerHTML = admHomeDashConfig.map(function(c, idx){
    var options = HOME_DASH_METRICS.map(function(m){
      return '<option value="'+m.value+'"'+(m.value===c.metric?' selected':'')+'>'+m.label+'</option>';
    }).join('');
    return '<div class="adm-msg-compose" style="margin-bottom:0;">'
      + '<div class="adm-msg-compose-title">Qutucuq '+(idx+1)+'</div>'
      + '<div class="adm-form-field"><label>Başlıq</label><input type="text" data-slot-title="'+idx+'" value="'+escapeHtml(c.title)+'"></div>'
      + '<div class="adm-form-field" style="margin-bottom:0;"><label>Göstərilən Məlumat</label><select data-slot-metric="'+idx+'">'+options+'</select></div>'
      + '</div>';
  }).join('');
}
function submitDashboardConfig(){
  var errEl=document.getElementById('admHomeDashError');
  errEl.style.display='none';
  admHomeDashConfig.forEach(function(c, idx){
    var titleEl=document.querySelector('[data-slot-title="'+idx+'"]');
    var metricEl=document.querySelector('[data-slot-metric="'+idx+'"]');
    if(titleEl) c.title=titleEl.value.trim()||c.title;
    if(metricEl) c.metric=metricEl.value;
  });
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'saveDashboardConfig', config:admHomeDashConfig, requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    alert('Yadda saxlanıldı. Əsas menyuda görmək üçün səhifəni yeniləyin.');
  })
  .catch(function(e){ errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block'; });
}

// ── DASHBOARD: stat kartlarının real datası ──
function loadHomeDashStats(){
  if(window.innerWidth < 901) return; // yalnız desktop görünüşdə lazımdır
  var dashVisible = document.getElementById('dashboardView') && document.getElementById('dashboardView').style.display !== 'none';
  var badge = document.getElementById('dashStatsRefreshBadge');
  if(dashVisible && badge){
    badge.style.display = 'flex';
    setTimeout(function(){ badge.style.display = 'none'; }, 2500);
  }
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getDashboardConfig', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status!=='OK') return;
    var config=d.config||[];
    var titleEls=Array.from(document.querySelectorAll('.ctd-stat-card .ctd-stat-label'));
    config.forEach(function(c, idx){ if(titleEls[idx]) titleEls[idx].textContent=c.title; });

    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData', daysBack:1})})
    .then(function(r){return r.json();})
    .then(function(rd){
      if(rd.status!=='OK') return;
      var rows=rd.rows||[];
      var todayStr=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()).split('/').join('.');
      var valueEls=[document.getElementById('dashStatOpen'),document.getElementById('dashStatToday'),document.getElementById('dashStatTech')];
      config.forEach(function(c, idx){
        if(c.metric==='bus_open'){
          var v=rows.filter(function(r){
            var st=(r['Status']||'').trim();
            return st==='Təhkim Edildi' || st==='Texnik Tamamladı';
          }).length;
          setHomeDashSlotValue(idx, v);
        } else if(c.metric==='bus_today'){
          var v2=rows.filter(function(r){return (r['Tarix']||'').trim()===todayStr;}).length;
          setHomeDashSlotValue(idx, v2);
        } else if(c.metric==='bus_active_tech'){
          var names={};
          rows.forEach(function(r){
            if((r['Tarix']||'').trim()!==todayStr) return;
            if(r['1. Texnik']) names[r['1. Texnik'].trim()]=true;
            if(r['2. Texnik']) names[r['2. Texnik'].trim()]=true;
          });
          setHomeDashSlotValue(idx, Object.keys(names).length);
        } else if(c.metric==='bus_latest'){
          if(rows.length>0){
            var latest=rows[0];
            var timeEl=document.getElementById('dashStatLatestTime');
            var infoEl=document.getElementById('dashStatLatestInfo');
            if(timeEl) timeEl.textContent=latest['Tarix']||'—';
            if(infoEl) infoEl.textContent=(latest['Daşıyıcı']||'')+' · '+(latest['D.Q.N.']||'');
          }
        }
      });
    }).catch(function(){});
  }).catch(function(){});
}
function setHomeDashSlotValue(idx, val){
  var ids=['dashStatOpen','dashStatToday','dashStatTech'];
  if(idx<3 && document.getElementById(ids[idx])) document.getElementById(ids[idx]).textContent=val;
}


// ═══════════════════════════════════════════════════════════════
// TVM DASHBOARD
// ═══════════════════════════════════════════════════════════════
var tvmDashAllRows=[], tvmDashPeriod='24h', tvmDashCustomRange=null, tvmDashFormData=null;
var tvmDashActiveChips={}, tvmDashSubfilterState={}, tvmDashTextFilters={};

var TVM_DONUT_COLORS=['#378ADD','#1D9E75','#D85A30','#D4537E','#BA7517','#888780'];

function tvmRowDate(row){
  var d=row['Tarix']||'';
  var t=row['Bildirilmə Saatı']||'00:00';
  var dp=d.split('.');
  if(dp.length!==3) return null;
  var tp=t.split(':');
  return new Date(+dp[2], +dp[1]-1, +dp[0], +(tp[0]||0), +(tp[1]||0));
}

var TVM_DASH_CATS=[
  {key:'Problem', type:'multi', getOptions:function(){ return (tvmDashFormData&&tvmDashFormData.tvmFaults)||[]; }},
  {key:'Həll', type:'multi', getOptions:function(){ return (tvmDashFormData&&tvmDashFormData.tvmSolutions)||[]; }},
  {key:'Texnik', type:'multi', getOptions:function(){ return (tvmDashFormData&&tvmDashFormData.technicians)||[]; }},
  {key:'Qrup Rəhbəri', type:'multi', getOptions:function(){ return (tvmDashFormData&&tvmDashFormData.tvmLeaders)||[]; }},
  {key:'Lokasiya Tipi', type:'multi', getOptions:function(){ return ['Metro','Digər']; }},
  {key:'TVM SN', type:'text'}
];

function tvmDashSelectedOptions(key){
  return Object.keys(tvmDashSubfilterState).filter(function(k){ return k.indexOf(key+'|')===0 && tvmDashSubfilterState[k]; }).map(function(k){ return k.slice(key.length+1); });
}
function tvmDashHasActiveOptions(key){ return tvmDashSelectedOptions(key).length>0; }
function tvmDashMatchMulti(val,key){ if(!val) return false; return tvmDashSelectedOptions(key).indexOf(val)!==-1; }
function tvmDashMatchSplit(val,key){ if(!val) return false; var sel=tvmDashSelectedOptions(key); return val.split('|').some(function(p){ return sel.indexOf(p.trim())!==-1; }); }
function tvmLocType(row){ return (row['Servis Lokasiyası']||'').trim()==='Metro' ? 'Metro' : 'Digər'; }

function tvmDashGetFilteredRows(){
  var range=tvmDashCustomRange||dashComputeRange(tvmDashPeriod);
  return tvmDashAllRows.filter(function(row){
    if(range.start&&range.end){ var rd=tvmRowDate(row); if(!rd||rd<range.start||rd>range.end) return false; }
    if(tvmDashHasActiveOptions('Problem')&&!tvmDashMatchSplit(row['Problem'],'Problem')) return false;
    if(tvmDashHasActiveOptions('Həll')&&!tvmDashMatchSplit(row['Həll'],'Həll')) return false;
    if(tvmDashHasActiveOptions('Texnik')&&!tvmDashMatchMulti(row['Texnik'],'Texnik')) return false;
    if(tvmDashHasActiveOptions('Qrup Rəhbəri')&&!tvmDashMatchMulti(row['Qrup rəhbəri'],'Qrup Rəhbəri')) return false;
    if(tvmDashHasActiveOptions('Lokasiya Tipi')&&!tvmDashMatchMulti(tvmLocType(row),'Lokasiya Tipi')) return false;
    if(tvmDashTextFilters['TVM SN']&&(row['TVM SN']||'').toLowerCase().indexOf(tvmDashTextFilters['TVM SN'].toLowerCase())===-1) return false;
    return true;
  });
}

function tvmDashCount(rows, field, splitMulti){
  var map={};
  rows.forEach(function(r){
    var v=r[field];
    if(!v) return;
    var vals=splitMulti?v.split('|'):[v];
    vals.forEach(function(vv){ vv=(vv||'').trim(); if(!vv) return; map[vv]=(map[vv]||0)+1; });
  });
  return Object.keys(map).map(function(k){ return {name:k, count:map[k]}; }).sort(function(a,b){ return b.count-a.count; });
}
function tvmDashCountLocation(rows){ return tvmDashCount(rows, 'TVM Lokasiya'); }
function tvmDashCountTech(rows){ return tvmDashCount(rows, 'Texnik'); }
function tvmCountRecurringDevices(rows){
  var map={};
  rows.forEach(function(r){
    var sn=r['TVM SN']; if(!sn) return;
    if(!map[sn]) map[sn]={location:r['TVM Lokasiya'], count:0};
    map[sn].count++;
  });
  return Object.keys(map).map(function(sn){ return {sn:sn, location:map[sn].location, count:map[sn].count}; }).filter(function(x){ return x.count>=3; }).sort(function(a,b){ return b.count-a.count; });
}
function tvmParseHM(t){ if(!t) return null; var p=String(t).split(':'); if(p.length<2) return null; return (+p[0])*60+(+p[1]); }
function tvmAvgResolutionMinutes(rows){
  var total=0, n=0;
  rows.forEach(function(r){
    var s=tvmParseHM(r['Başlanğıc']), e=tvmParseHM(r['Bitiş']);
    if(s===null||e===null) return;
    var diff=e-s;
    if(diff<0) return; // Bitiş < Başlanğıc — çox güman məlumat səhvidir, hesablamaya qatma
    total+=diff; n++;
  });
  return n>0 ? Math.round(total/n) : 0;
}

function _tvmPickIcon(name, kind){
  var n=(name||'').toLowerCase();
  var I={
    box:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>',
    wifi:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
    coin:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6v4"/></svg>',
    cash:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
    receipt:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/></svg>',
    card:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>',
    alert:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    refresh:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>',
    check:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    gear:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    pin:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    wrench:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
  };
  if(n.indexOf('qutu')!==-1) return I.box;
  if(n.indexOf('şəbəkə')!==-1) return I.wifi;
  if(n.indexOf('əlaqə')!==-1) return I.wifi;
  if(n.indexOf('ayarland')!==-1) return I.gear;
  if(n.indexOf('qəpik')!==-1) return I.coin;
  if(n.indexOf('lent')!==-1) return I.coin;
  if(n.indexOf('manat')!==-1) return I.cash;
  if(n.indexOf('qəbz')!==-1) return I.receipt;
  if(n.indexOf('kart')!==-1) return I.card;
  if(n.indexOf('nasaz')!==-1) return I.alert;
  if(n.indexOf('xəta')!==-1) return I.alert;
  if(n.indexOf('ilişmə')!==-1) return I.alert;
  if(n.indexOf('proqram')!==-1) return I.refresh;
  if(n.indexOf('yenilə')!==-1) return I.refresh;
  if(n.indexOf('dəyişil')!==-1) return I.refresh;
  if(n.indexOf('dəyişdi')!==-1) return I.refresh;
  if(n.indexOf('təmizlə')!==-1) return I.check;
  if(kind==='solution') return I.check;
  if(kind==='location') return I.pin;
  return I.wrench;
}

function tvmRenderDonutPanel(containerId, items, total){
  var el=document.getElementById(containerId);
  if(!el) return;
  if(total===0||items.length===0){
    el.innerHTML='<div class="tvm-donut-empty">Bu d\u00f6vr \u00fc\u00e7\u00fcn qeyd\u0259 al\u0131nmay\u0131b.</div>';
    return;
  }
  var kind = containerId.indexOf('Location')!==-1 ? 'location' : (containerId.indexOf('Solution')!==-1 ? 'solution' : 'problem');

  var top5=items.slice(0,5);
  var restItems=items.slice(5);
  var restCount=restItems.reduce(function(s,it){return s+it.count;},0);
  var chartItems=top5.slice();
  if(restCount>0) chartItems.push({name:'Dig\u0259r',count:restCount});

  // Sol siyahi — nomre + ikon + ad + [say][faiz]
  var listHtml=top5.map(function(it,i){
    var pct=Math.round(it.count/total*100);
    var c=TVM_DONUT_COLORS[i];
    return '<div class="tvm-donut-row-sm" style="border-left-color:'+c+';">'
      +'<div class="tvm-donut-rank" style="background:'+c+';">'+(i+1)+'</div>'
      +'<div class="tvm-donut-row-icon" style="background:'+c+'18;color:'+c+';">'+_tvmPickIcon(it.name,kind)+'</div>'
      +'<div class="tvm-donut-row-name" title="'+escapeHtml(it.name)+'">'+escapeHtml(it.name)+'</div>'
      +'<div class="tvmd-row-badge">'
        +'<span class="tvmd-badge-count">'+it.count+'</span>'
        +'<span class="tvmd-badge-pct" style="background:'+c+'18;color:'+c+';border:1.5px solid '+c+'55;">'+pct+'%</span>'
      +'</div>'
      +'</div>';
  }).join('');

  // Sag sutun — Diger elementleri, SOL siyahi ile EYNI sətir stilində (statik, duyme yoxdur)
  var hasDiger = restItems.length>0;
  var digerHtml='';
  if(hasDiger){
    var digerRows=restItems.map(function(it,i){
      var pct=Math.round(it.count/total*100);
      return '<div class="tvm-donut-row-sm tvm-donut-row-muted">'
        +'<div class="tvm-donut-rank tvm-donut-rank-muted">'+(6+i)+'</div>'
        +'<div class="tvm-donut-row-icon tvm-donut-row-icon-muted">'+_tvmPickIcon(it.name,kind)+'</div>'
        +'<div class="tvm-donut-row-name" title="'+escapeHtml(it.name)+'">'+escapeHtml(it.name)+'</div>'
        +'<div class="tvmd-row-badge">'
          +'<span class="tvmd-badge-count">'+it.count+'</span>'
          +'<span class="tvmd-badge-pct tvmd-badge-pct-muted">'+pct+'%</span>'
        +'</div>'
        +'</div>';
    }).join('');
    digerHtml='<div class="tvm-donut-diger-col">'
      +'<div class="tvm-donut-diger-title">Dig\u0259r <span>('+restCount+')</span></div>'
      +'<div class="tvm-donut-diger-rows">'+digerRows+'</div>'
      +'</div>';
  }

  // Donut SVG — sade, funksional: ortada say, halqa reng ile
  var R=90, strokeW=26, gap=2, circ=2*Math.PI*R;
  var cx=R+strokeW/2+6, cy=R+strokeW/2+6;
  var W=cx*2, H=cy*2;
  var offset=0, segs='';
  chartItems.forEach(function(it,i){
    var frac=it.count/total;
    var len=Math.max(frac*circ-gap,0);
    var c=TVM_DONUT_COLORS[i];
    segs+='<circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" fill="none"'
      +' stroke="'+c+'" stroke-width="'+strokeW+'"'
      +' stroke-linecap="round"'
      +' stroke-dasharray="0 '+circ.toFixed(2)+'"'
      +' stroke-dashoffset="'+(-offset).toFixed(2)+'"'
      +' transform="rotate(-90 '+cx+' '+cy+')"'
      +' class="tvm-donut-seg" data-len="'+len.toFixed(2)+'" data-total="'+circ.toFixed(2)+'"'
      +' style="transition:stroke-dasharray 0.9s cubic-bezier(.2,.8,.3,1) '+(i*0.07)+'s;"/>';
    offset+=frac*circ;
  });
  var innerR=R-strokeW/2-2;
  var bgCircle='<circle cx="'+cx+'" cy="'+cy+'" r="'+innerR+'" fill="rgba(247,250,254,0.9)"/>';
  var centerText=''
    +'<text x="'+cx+'" y="'+(cy-4)+'" text-anchor="middle" dominant-baseline="middle"'
    +' font-size="32" font-weight="800" fill="#12233B" font-family="Rajdhani,sans-serif">'+total+'</text>'
    +'<text x="'+cx+'" y="'+(cy+20)+'" text-anchor="middle"'
    +' font-size="10" font-weight="600" fill="#8CA0BC" font-family="Inter,Arial,sans-serif">\u00dcmumi</text>';

  var gridCols = hasDiger ? 'minmax(210px,260px) 220px 1fr' : 'minmax(210px,320px) 1fr';

  el.innerHTML='<div class="tvm-donut-panel-new" style="grid-template-columns:'+gridCols+';">'
    +'<div class="tvm-donut-list-sm">'+listHtml+'</div>'
    +'<div class="tvmd-donut-mid">'
      +'<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg"'
      +' style="width:210px;height:210px;flex-shrink:0;filter:drop-shadow(0 4px 14px rgba(30,68,130,0.10));">'
      +bgCircle+segs+centerText+'</svg>'
    +'</div>'
    +digerHtml
    +'</div>';

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      el.querySelectorAll('.tvm-donut-seg').forEach(function(seg){
        var l=parseFloat(seg.dataset.len),t=parseFloat(seg.dataset.total);
        seg.setAttribute('stroke-dasharray',l.toFixed(2)+' '+(t-l).toFixed(2));
      });
    });
  });
}
function tvmRenderLocSplit(rows){
  var el=document.getElementById('tvmLocSplit');
  if(!el) return;
  var metro=rows.filter(function(r){ return tvmLocType(r)==='Metro'; }).length;
  var other=rows.length-metro;
  var total=rows.length||1;
  var mp=Math.round(metro/total*100), op=100-mp;
  var metroIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h10M7 12h10M7 15h4"/></svg>';
  var otherIcon='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  el.innerHTML=
    '<div class="tvm-loc-card"><div class="tvm-loc-card-icon" style="background:#E6F1FB;color:#2F6FED;">'+metroIcon+'</div><div class="tvm-loc-card-body"><div class="tvm-loc-card-top"><span>Metro</span><b>'+metro+' · '+mp+'%</b></div><div class="tvm-loc-bar-track"><div class="tvm-loc-bar-fill" data-w="'+mp+'" style="background:#378ADD;"></div></div></div></div>'+
    '<div class="tvm-loc-card"><div class="tvm-loc-card-icon" style="background:#E0F5F0;color:#0E8C7A;">'+otherIcon+'</div><div class="tvm-loc-card-body"><div class="tvm-loc-card-top"><span>Digər</span><b>'+other+' · '+op+'%</b></div><div class="tvm-loc-bar-track"><div class="tvm-loc-bar-fill" data-w="'+op+'" style="background:#1D9E75;"></div></div></div></div>';
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      el.querySelectorAll('.tvm-loc-bar-fill').forEach(function(bar){ bar.style.width=bar.dataset.w+'%'; });
    });
  });
}

var tvmAllTechsOpen=false;
var tvmLastFilteredRows=[];

function tvmRenderTechList(rows){
  tvmLastFilteredRows=rows;
  var el=document.getElementById('tvmTechList');
  if(el) el.innerHTML='';

  var tbody=document.getElementById('tvmTechTableBody');
  if(!tbody) return;

  var techCounts=tvmDashCountTech(rows);
  var showAllBtn=document.getElementById('tvmTechShowAllBtn');

  if(techCounts.length===0){
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:#8CA0BC;padding:20px;">Bu dövr üçün qeydə alınmayıb.</td></tr>';
    if(showAllBtn) showAllBtn.style.display='none';
    return;
  }

  // Yalnız top 5 göstər (açılmayıbsa)
  var displayList=tvmAllTechsOpen ? techCounts : techCounts.slice(0,5);

  tbody.innerHTML=displayList.map(function(it){
    var techRows=rows.filter(function(r){ return (r['Texnik']||'').trim()===it.name.trim(); });
    var avgMin=tvmAvgResolutionMinutes(techRows);
    var avgTxt=avgMin>0?(avgMin+' dəq'):'—';
    var slaPct=avgMin<=0?100:(avgMin<=30?100:(avgMin<=60?67:50));
    var slaColor=slaPct>=90?'#3FCB78':(slaPct>=65?'#D97706':'#E24B4A');
    return '<tr>'
      +'<td><span class="tvmd-tech-name">'+escapeHtml(it.name)+'</span></td>'
      +'<td><span class="tvmd-tech-num">'+it.count+'</span></td>'
      +'<td>'+avgTxt+'</td>'
      +'<td><div class="tvmd-sla-bar-wrap"><div class="tvmd-sla-bar-track"><div class="tvmd-sla-bar-fill" style="width:'+slaPct+'%;background:'+slaColor+';"></div></div><span class="tvmd-sla-pct">'+slaPct+'%</span></div></td>'
      +'</tr>';
  }).join('');

  // "Hamısını göstər" düyməsi — yalnız 5-dən çox texnik varsa göstər
  if(showAllBtn){
    if(techCounts.length>5){
      showAllBtn.style.display='flex';
      if(tvmAllTechsOpen){
        showAllBtn.innerHTML='Yığ <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>';
      } else {
        showAllBtn.innerHTML='Hamısını göstər ('+techCounts.length+') <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>';
      }
    } else {
      showAllBtn.style.display='none';
    }
  }
}

function tvmToggleAllTechs(){
  tvmAllTechsOpen=!tvmAllTechsOpen;
  tvmRenderTechList(tvmLastFilteredRows);
}

var tvmAllLocationsOpen=false;
function tvmToggleAllLocations(filteredRows){
  tvmAllLocationsOpen=!tvmAllLocationsOpen;
  var panel=document.getElementById('tvmAllLocationsPanel');
  // Düyməni tap (kartın içindədir)
  var locCard=document.getElementById('tvmLocationsPanel');
  var btn=locCard?locCard.querySelector('.tvmd-showall-inside'):null;

  if(tvmAllLocationsOpen){
    panel.style.display='block';
    if(btn){ btn.innerHTML='Gizlət <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>'; }
    var rows=filteredRows||tvmDashGetFilteredRows();
    tvmRenderAllLocations(rows);
  } else {
    panel.style.display='none';
    if(btn){ btn.innerHTML='Hamısını göstər <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>'; }
  }
}
function tvmRenderAllLocations(rows){
  var el=document.getElementById('tvmAllLocationsPanel');
  if(!el) return;
  var items=tvmDashCountLocation(rows);
  var total=rows.length||1;
  if(items.length===0){
    el.innerHTML='<div class="tvm-donut-empty" style="padding:20px;">Bu dövr üçün qeydə alınmayıb.</div>';
    return;
  }
  el.innerHTML=items.map(function(it,i){
    var pct=Math.round(it.count/total*100);
    var color=TVM_DONUT_COLORS[i]||'#8CA0BC';
    return '<div class="tvm-all-loc-row">'
      +'<div class="tvm-all-loc-num" style="background:'+color+'22;color:'+color+';">'+(i+1)+'</div>'
      +'<div class="tvm-all-loc-name" title="'+escapeHtml(it.name)+'">'+escapeHtml(it.name)+'</div>'
      +'<div class="tvm-all-loc-bar-track"><div class="tvm-all-loc-bar-fill" data-w="'+pct+'" style="background:'+color+';"></div></div>'
      +'<div class="tvm-all-loc-pct">'+it.count+' · '+pct+'%</div>'
      +'</div>';
  }).join('');
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      el.querySelectorAll('.tvm-all-loc-bar-fill').forEach(function(bar){ bar.style.width=bar.dataset.w+'%'; });
    });
  });
}

function tvmRenderRecurring(rows){
  var el=document.getElementById('tvmRecurringPanel');
  if(!el) return;
  var items=tvmCountRecurringDevices(rows);
  if(items.length===0){ el.innerHTML='<div class="dash-empty-txt">Bu dövr üçün heç bir TVM cihazı 3 və ya daha çox servis almayıb.</div>'; return; }
  el.innerHTML='<div class="dash-ranklist-wrap"><table class="dash-ranklist"><thead><tr><th class="dr-num-col"></th><th>TVM SN · Lokasiya</th><th class="dr-count-col">Servis sayı</th></tr></thead><tbody>'+
    items.slice(0,15).map(function(it,i){
      return '<tr><td><span style="background:#FEECEC;color:#A32D2D;">'+(i+1)+'</span></td><td>'+escapeHtml(it.sn)+' · '+escapeHtml(it.location||'—')+'</td><td><span class="dash-rank-count-val" style="color:#A32D2D;">'+it.count+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
}

function tvmDashComputeAndRender(){
  var filtered=tvmDashGetFilteredRows();

  // ── Əvvəlki dövr hesabla (müqayisə üçün) ──
  var prevRows=tvmDashGetPrevPeriodRows();
  var prevTotal=prevRows.length;
  var prevAvgMin=tvmAvgResolutionMinutes(prevRows);
  var prevDeviceChanges=prevRows.filter(function(r){ return r['Köhnə SN']&&r['Yeni SN']; }).length;

  // Cari dəyərlər
  var curTotal=filtered.length;
  var avgMin=tvmAvgResolutionMinutes(filtered);
  var deviceChanges=filtered.filter(function(r){ return r['Köhnə SN']&&r['Yeni SN']; }).length;

  // Metrika kartlar — dəyər + trend
  _tvmSetMetric('tvmDashTotal', curTotal, prevTotal, '', false);
  _tvmSetMetric('tvmDashAvgTime', avgMin>0?avgMin:0, prevAvgMin>0?prevAvgMin:0, ' dəq', true);
  _tvmSetMetric('tvmDashDeviceChanges', deviceChanges, prevDeviceChanges, '', false);

  // Sparkline-lar
  _tvmDrawSparkline('tvmSparkTotal', filtered, 'count', '#2F6FED');
  _tvmDrawSparkline('tvmSparkAvg', filtered, 'avg', '#0E8C7A');

  // Tarix aralığı mətni
  var dateRangeEl=document.getElementById('tvmDashDateRangeTxt');
  if(dateRangeEl){
    if(tvmDashCustomRange&&tvmDashCustomRange.start&&tvmDashCustomRange.end){
      var fmtD=function(d){ return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); };
      dateRangeEl.textContent=fmtD(tvmDashCustomRange.start)+' - '+fmtD(tvmDashCustomRange.end);
    } else {
      var periodMap={'24h':'Son 24 saat','week':'Son 1 həftə','month':'Son 1 ay','all':'Bütün dövr'};
      dateRangeEl.textContent=periodMap[tvmDashPeriod]||'Bütün dövr';
    }
  }

  // Köhnə widget-lar (DOM-da varsa)
  var mttrEl=document.getElementById('tvmSideMTTR');
  if(mttrEl) mttrEl.textContent=avgMin>0?(avgMin+' dəq'):'—';
  var slaVal=filtered.length===0?'—':(avgMin<=0?'100%':(avgMin<=30?'100%':(avgMin<=60?'80%':'60%')));
  var slaEl=document.getElementById('tvmSideSLA');
  if(slaEl) slaEl.textContent=slaVal;
  var techSet={};
  filtered.forEach(function(r){ if(r['Texnik']&&r['Texnik'].trim()) techSet[r['Texnik'].trim()]=true; });
  var activeTechEl=document.getElementById('tvmSideActiveTech');
  if(activeTechEl) activeTechEl.textContent=Object.keys(techSet).length;

  // Panellər
  tvmRenderLocSplit(filtered);
  var problemItems=tvmDashCount(filtered,'Problem',true);
  var solutionItems=tvmDashCount(filtered,'Həll',true);
  var problemTotal=problemItems.reduce(function(s,it){ return s+it.count; },0);
  var solutionTotal=solutionItems.reduce(function(s,it){ return s+it.count; },0);
  tvmRenderDonutPanel('tvmProblemsPanel', problemItems, problemTotal);
  tvmRenderDonutPanel('tvmSolutionsPanel', solutionItems, solutionTotal);
  tvmRenderDonutPanel('tvmLocationsPanel', tvmDashCountLocation(filtered), filtered.length);
  tvmRenderTechList(filtered);
  tvmRenderRecurring(filtered);
  if(tvmAllLocationsOpen) tvmRenderAllLocations(filtered);
}

// ── Metrika kart dəyəri + trend mətn ──
function _tvmSetMetric(valueId, cur, prev, suffix, lowerIsBetter){
  var valEl=document.getElementById(valueId);
  if(valEl) valEl.textContent=(cur>0||cur===0)?(cur+(suffix||'')):'—';

  var trendMap={'tvmDashTotal':'tvmDashTotalTrend','tvmDashAvgTime':'tvmDashAvgTrend','tvmDashDeviceChanges':'tvmDashDeviceTrend'};
  var tid=trendMap[valueId];
  var trendEl=tid?document.getElementById(tid):null;
  if(!trendEl) return;

  // "Hamısı" seçiləndə trend göstərmə
  if(tvmDashPeriod==='all'&&!tvmDashCustomRange){
    trendEl.textContent='';
    trendEl.className='tvmd-metric-trend';
    return;
  }

  // Əvvəlki dövrdə data yoxdursa
  if(prev===0&&cur===0){ trendEl.textContent='0% keçən dövrə görə'; trendEl.className='tvmd-metric-trend'; return; }
  if(prev===0){ trendEl.textContent='+100% keçən dövrə görə'; trendEl.className='tvmd-metric-trend up'; return; }

  var diff=cur-prev;
  var pct=Math.round(Math.abs(diff)/prev*100);
  var isUp=diff>0;
  var isBetter=lowerIsBetter?!isUp:isUp;
  var sign=isUp?'+':'';
  var arrow=isUp?'\u2191':'\u2193';
  var cls='tvmd-metric-trend '+(diff===0?'':isBetter?'up':'down');
  trendEl.textContent=arrow+' '+sign+pct+'% keçən dövrə görə';
  trendEl.className=cls;
}

// ── Sparkline çək (Canvas) ──
function _tvmDrawSparkline(canvasId, rows, type, color){
  var c=color||'#2F6FED';
  var canvas=document.getElementById(canvasId);
  if(!canvas||!canvas.getContext) return;
  var ctx=canvas.getContext('2d');
  var W=canvas.offsetWidth||120, H=canvas.offsetHeight||36;
  canvas.width=W*window.devicePixelRatio||W;
  canvas.height=H*window.devicePixelRatio||H;
  ctx.scale(window.devicePixelRatio||1, window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H);

  var points=[];
  var now=new Date();
  for(var i=6;i>=0;i--){
    var dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
    var dayEnd=new Date(dayStart.getTime()+86400000);
    var dayRows=rows.filter(function(r){
      var d=tvmRowDate(r);
      return d&&d>=dayStart&&d<dayEnd;
    });
    if(type==='count') points.push(dayRows.length);
    else{ var a=tvmAvgResolutionMinutes(dayRows); points.push(a||0); }
  }

  var max=Math.max.apply(null,points)||1;
  var min=Math.min.apply(null,points);
  var range=(max-min)||1;
  var pad=3;
  var n=points.length;

  // hex → rgb helper
  function hexToRgb(hex){
    var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return r+','+g+','+b;
  }
  var rgb=hexToRgb(c);

  ctx.beginPath();
  points.forEach(function(v,i){
    var x=pad+(W-pad*2)*i/(n-1);
    var y=H-pad-(H-pad*2)*(v-min)/range;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  var lastX=pad+(W-pad*2)*(n-1)/(n-1);
  ctx.lineTo(lastX,H-pad);
  ctx.lineTo(pad,H-pad);
  ctx.closePath();
  var grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba('+rgb+',0.18)');
  grad.addColorStop(1,'rgba('+rgb+',0.01)');
  ctx.fillStyle=grad;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle='rgba('+rgb+',0.80)';
  ctx.lineWidth=1.8;
  ctx.lineJoin='round';
  ctx.lineCap='round';
  points.forEach(function(v,i){
    var x=pad+(W-pad*2)*i/(n-1);
    var y=H-pad-(H-pad*2)*(v-min)/range;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// ── Əvvəlki dövr sətirləri ──
function tvmDashGetPrevPeriodRows(){
  if(!tvmDashAllRows||!tvmDashAllRows.length) return [];
  var now=new Date();
  var start,end;
  if(tvmDashCustomRange&&tvmDashCustomRange.start&&tvmDashCustomRange.end){
    var dur=tvmDashCustomRange.end.getTime()-tvmDashCustomRange.start.getTime();
    end=new Date(tvmDashCustomRange.start.getTime());
    start=new Date(end.getTime()-dur);
  } else {
    switch(tvmDashPeriod){
      case '24h': end=new Date(now.getTime()-86400000); start=new Date(end.getTime()-86400000); break;
      case 'week': end=new Date(now.getTime()-7*86400000); start=new Date(end.getTime()-7*86400000); break;
      case 'month': end=new Date(now.getTime()-30*86400000); start=new Date(end.getTime()-30*86400000); break;
      default: return [];
    }
  }
  return tvmDashAllRows.filter(function(r){
    var d=tvmRowDate(r);
    return d&&d>=start&&d<end;
  });
}

// "Hamısını göstər" düyməsini lokasiyalar kartına əlavə edir
function updateTvmDashTabsUI(){
  document.querySelectorAll('#tvmDashTabs .tvmd-tab').forEach(function(t){
    t.classList.toggle('active', t.getAttribute('data-period')===tvmDashPeriod && !tvmDashCustomRange);
  });
}

function loadTvmDashData(){
  document.getElementById('dashLoading').style.display='flex';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmReportData'})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    document.getElementById('dashLoading').style.display='none';
    if(d.status!=='OK') return;
    tvmDashAllRows=(d.rows||[]).slice().sort(function(a,b){ var da=tvmRowDate(a),db=tvmRowDate(b); return (db?db.getTime():0)-(da?da.getTime():0); });
    tvmDashComputeAndRender();
  })
  .catch(function(){ document.getElementById('dashLoading').style.display='none'; });
}

function openTvmDashboard(){
  document.getElementById('dashboardView').style.display='none';
  var tv=document.getElementById('tvmDashboardView');
  tv.style.display='flex';
  tv.scrollTop=0;
  var body=tv.querySelector('.tvmd-body');
  if(body) body.scrollTop=0;
  tvmDashCustomRange=null;
  tvmDashPeriod='24h';
  tvmDashActiveChips={}; tvmDashSubfilterState={}; tvmDashTextFilters={};
  updateTvmDashTabsUI();
  loadTvmDashData();
  if(!tvmDashFormData){
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmFormData'})})
    .then(function(r){ return r.json(); })
    .then(function(d){ if(d.status==='OK') tvmDashFormData=d; });
  }
}
function closeTvmDashboard(){
  var loading = document.getElementById('dashLoading');
  if(loading) loading.style.display='flex';

  setTimeout(function(){
    if(typeof routerNavigate === 'function' && typeof ROUTER_READY !== 'undefined' && ROUTER_READY && currentUser){
      routerNavigate('dashboard', true);
    } else {
      document.getElementById('tvmDashboardView').style.display='none';
      document.getElementById('dashboardView').style.display='block';
      window.scrollTo(0,0);
    }
    if(loading) loading.style.display='none';
  }, 700);
}
document.addEventListener('DOMContentLoaded', function(){
  var tabs=document.querySelectorAll('#tvmDashTabs .tvmd-tab');
  tabs.forEach(function(t){
    t.addEventListener('click', function(){
      tvmDashPeriod=t.getAttribute('data-period');
      tvmDashCustomRange=null;
      tvmAllTechsOpen=false;
      updateTvmDashTabsUI();
      tvmDashComputeAndRender();
    });
  });
});

var tvmTechSearchOpen=false;
function tvmToggleTechSearch(){
  tvmTechSearchOpen=!tvmTechSearchOpen;
  var panel=document.getElementById('tvmTechSearchPanel');
  if(panel) panel.style.display=tvmTechSearchOpen?'block':'none';
  if(tvmTechSearchOpen){
    var inp=document.getElementById('tvmTechSearchInput');
    if(inp){ inp.value=''; inp.focus(); }
    var out=document.getElementById('tvmTechSearchResult');
    if(out) out.textContent='';
  }
}

function tvmClearTechSearch(){
  var inp=document.getElementById('tvmTechSearchInput');
  if(inp){ inp.value=''; inp.focus(); }
  var out=document.getElementById('tvmTechSearchResult');
  if(out) out.textContent='';
}

function tvmSearchTech(){
  var inp=document.getElementById('tvmTechSearchInput');
  var out=document.getElementById('tvmTechSearchResult');
  if(!out) return;
  var q=(inp?inp.value:'').trim();
  if(!q){ out.textContent=''; return; }
  var filtered=tvmDashGetFilteredRows();
  var counts=tvmDashCountTech(filtered);
  var match=counts.find(function(it){ return it.name.toLowerCase().indexOf(q.toLowerCase())!==-1; });
  if(match){
    out.innerHTML='<span style="color:#12233B;font-weight:700;">'+escapeHtml(match.name)+'</span>'
      +' — seçilmiş dövrdə <span style="color:#2F6FED;font-weight:700;">'+match.count+'</span> TVM ticket';
    return;
  }
  var allCounts=tvmDashCountTech(tvmDashAllRows);
  var allMatch=allCounts.find(function(it){ return it.name.toLowerCase().indexOf(q.toLowerCase())!==-1; });
  if(allMatch){
    out.innerHTML='<span style="color:#12233B;font-weight:700;">'+escapeHtml(allMatch.name)+'</span>'
      +' — seçilmiş dövrdə nəticə yoxdur (bütün tarixçədə: <span style="color:#2F6FED;font-weight:700;">'+allMatch.count+'</span>)';
  } else {
    out.innerHTML='<span style="color:#8CA0BC;">Uyğun texnik tapılmadı.</span>';
  }
}

function exportTvmDashboardExcel(){
  var rows=tvmDashGetFilteredRows();
  if(rows.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  var cols=['Ticket ID','Tarix','Bildirilmə Saatı','TVM SN','TVM Lokasiya','Problem','Həll','Köhnə SN','Yeni SN','Başlanğıc','Bitiş','Servis Lokasiyası','Texnik','Qrup rəhbəri'];
  var wsData=[cols];
  rows.forEach(function(row){ wsData.push(cols.map(function(c){ return row[c]||''; })); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TVM Dashboard');
  XLSX.writeFile(wb, 'tvm_dashboard.xlsx');
}

// ── TVM Dashboard təqvim modalı ──────────────────────────────
function openTvmDashModal(){ ensureTvmDashFormDataThenBuildChips(); document.getElementById('tvmDashModal').classList.add('open'); }
function closeTvmDashModal(){
  document.getElementById('tvmDashModal').classList.remove('open');
  document.getElementById('tvmDashModalFilterBody').style.display='flex';
  document.getElementById('tvmDashModalResults').classList.remove('open');
  document.getElementById('tvmDashResetBtnEl').style.display='';
  document.getElementById('tvmDashModalTitle').textContent='Tarix aralığı və filtrlər';
  document.getElementById('tvmDashSearchWarn').style.display='none';
}
function ensureTvmDashFormDataThenBuildChips(){
  if(tvmDashFormData){ buildTvmDashChips(); }
  else {
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmFormData'})}).then(function(r){ return r.json(); }).then(function(d){ if(d.status==='OK') tvmDashFormData=d; buildTvmDashChips(); });
  }
}
function buildTvmDashChips(){
  var row=document.getElementById('tvmDashChipRow');
  row.innerHTML='';
  TVM_DASH_CATS.forEach(function(cat){
    var c=document.createElement('div');
    c.className='dash-chip'+(tvmDashActiveChips[cat.key]?' active':'');
    c.textContent=cat.key;
    c.onclick=function(){
      tvmDashActiveChips[cat.key]=!tvmDashActiveChips[cat.key];
      buildTvmDashChips();
      renderTvmDashSubfilters();
    };
    row.appendChild(c);
  });
  renderTvmDashSubfilters();
}
function renderTvmDashSubfilters(){
  var wrap=document.getElementById('tvmDashSubfilters');
  wrap.innerHTML='';
  TVM_DASH_CATS.forEach(function(cat){
    if(!tvmDashActiveChips[cat.key]) return;
    var box=document.createElement('div');
    box.className='dash-subfilter';
    var title=document.createElement('div');
    title.className='dash-subfilter-title';
    title.textContent=cat.key;
    box.appendChild(title);
    if(cat.type==='multi'){
      var opts=document.createElement('div');
      opts.className='dash-subfilter-opts';
      (cat.getOptions()||[]).forEach(function(opt){
        var o=document.createElement('div');
        var key=cat.key+'|'+opt;
        o.className='dash-opt-chip'+(tvmDashSubfilterState[key]?' sel':'');
        o.textContent=opt.length>28?opt.slice(0,28)+'…':opt;
        o.title=opt;
        o.onclick=function(){ tvmDashSubfilterState[key]=!tvmDashSubfilterState[key]; o.classList.toggle('sel'); };
        opts.appendChild(o);
      });
      box.appendChild(opts);
    } else if(cat.type==='text'){
      var inp=document.createElement('input');
      inp.type='text';
      inp.placeholder='Axtar...';
      inp.value=tvmDashTextFilters[cat.key]||'';
      inp.oninput=function(){ tvmDashTextFilters[cat.key]=this.value; };
      box.appendChild(inp);
    }
    wrap.appendChild(box);
  });
}
function resetTvmDashFilters(){
  tvmDashActiveChips={}; tvmDashSubfilterState={}; tvmDashTextFilters={};
  tvmDcalRangeStart=null; tvmDcalRangeEnd=null;
  buildTvmDashChips();
  renderTvmDcal();
  document.getElementById('tvmDashModalFilterBody').style.display='flex';
  document.getElementById('tvmDashModalResults').classList.remove('open');
  document.getElementById('tvmDashModalTitle').textContent='Tarix aralığı və filtrlər';
  document.getElementById('tvmDashSearchWarn').style.display='none';
  tvmDashCustomRange=null;
  tvmDashPeriod='24h';
  updateTvmDashTabsUI();
  tvmDashComputeAndRender();
}

var tvmDcalYear, tvmDcalMonth, tvmDcalRangeStart=null, tvmDcalRangeEnd=null;
function initTvmDcal(){ var now=bakuNowDate(); tvmDcalYear=now.getFullYear(); tvmDcalMonth=now.getMonth(); renderTvmDcal(); }
function tvmDcalNav(dir){ tvmDcalMonth+=dir; if(tvmDcalMonth<0){ tvmDcalMonth=11; tvmDcalYear--; } if(tvmDcalMonth>11){ tvmDcalMonth=0; tvmDcalYear++; } renderTvmDcal(); }
function renderTvmDcal(){
  var labelEl=document.getElementById('tvmDcalLabel');
  var grid=document.getElementById('tvmDcalGrid');
  if(!labelEl || !grid) return;
  labelEl.textContent=DCAL_MONTHS[tvmDcalMonth]+' '+tvmDcalYear;
  grid.innerHTML='';
  DCAL_DOWS.forEach(function(d){ var el=document.createElement('div'); el.className='dcal-dow'; el.textContent=d; grid.appendChild(el); });
  var firstDay=new Date(tvmDcalYear, tvmDcalMonth, 1);
  var startOffset=(firstDay.getDay()+6)%7;
  var daysInMonth=new Date(tvmDcalYear, tvmDcalMonth+1, 0).getDate();
  var daysInPrev=new Date(tvmDcalYear, tvmDcalMonth, 0).getDate();
  for(var i=0; i<startOffset; i++){ var el=document.createElement('div'); el.className='dcal-day muted'; el.textContent=daysInPrev-startOffset+i+1; grid.appendChild(el); }
  for(var d=1; d<=daysInMonth; d++){
    (function(day){
      var el=document.createElement('div');
      el.className='dcal-day';
      el.textContent=day;
      var thisDate=new Date(tvmDcalYear, tvmDcalMonth, day);
      if(tvmDcalRangeStart&&sameDayDc(thisDate, tvmDcalRangeStart)) el.classList.add('range-start');
      if(tvmDcalRangeEnd&&sameDayDc(thisDate, tvmDcalRangeEnd)) el.classList.add('range-end');
      if(tvmDcalRangeStart&&tvmDcalRangeEnd&&thisDate>tvmDcalRangeStart&&thisDate<tvmDcalRangeEnd) el.classList.add('in-range');
      el.onclick=function(){ pickTvmDcalDate(thisDate); };
      grid.appendChild(el);
    })(d);
  }
  updateTvmDcalTxt();
}
function pickTvmDcalDate(d){
  if(!tvmDcalRangeStart||(tvmDcalRangeStart&&tvmDcalRangeEnd)){ tvmDcalRangeStart=d; tvmDcalRangeEnd=null; }
  else { if(d<tvmDcalRangeStart){ tvmDcalRangeEnd=tvmDcalRangeStart; tvmDcalRangeStart=d; } else { tvmDcalRangeEnd=d; } }
  renderTvmDcal();
  var warnEl=document.getElementById('tvmDashSearchWarn');
  if(warnEl) warnEl.style.display='none';
}
function updateTvmDcalTxt(){
  var t=document.getElementById('tvmDcalSelectedTxt');
  if(!t) return;
  if(tvmDcalRangeStart&&tvmDcalRangeEnd) t.textContent=fmtDc(tvmDcalRangeStart)+' → '+fmtDc(tvmDcalRangeEnd);
  else if(tvmDcalRangeStart) t.textContent=fmtDc(tvmDcalRangeStart)+' seçildi — bitiş tarixini seçin';
  else t.textContent='Başlanğıc tarixi seçin';
}
initTvmDcal();

function runTvmDashSearch(){
  var hasRange=tvmDcalRangeStart&&tvmDcalRangeEnd;
  var hasActiveCat=Object.keys(tvmDashActiveChips).some(function(k){ return tvmDashActiveChips[k]; });
  if(!hasRange&&!hasActiveCat){ document.getElementById('tvmDashSearchWarn').style.display='flex'; return; }
  document.getElementById('tvmDashSearchWarn').style.display='none';
  if(hasRange){
    tvmDashCustomRange={
      start:new Date(tvmDcalRangeStart.getFullYear(), tvmDcalRangeStart.getMonth(), tvmDcalRangeStart.getDate(), 0, 0, 0),
      end:new Date(tvmDcalRangeEnd.getFullYear(), tvmDcalRangeEnd.getMonth(), tvmDcalRangeEnd.getDate(), 23, 59, 59)
    };
    updateTvmDashTabsUI();
  }
  closeTvmDashModal();
  tvmDashComputeAndRender();
}
