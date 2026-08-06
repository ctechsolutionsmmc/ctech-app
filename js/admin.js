// ═══════════════════════════════════════════════════════════════
// ADMIN.JS — Admin Panel, User/TVM/Bus/Collectives Management
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

// ── Universal Admin Loading Overlay ──
// Bütün CRUD əməliyyatları bu funksiya ilə loading göstərir/gizlədir.
// afterFn: prosses bitəndə hansı yükləmə funksiyası çağırılsın.
function admShowProcessing(msgText){
  var ov=document.getElementById('admProcessingOverlay');
  var txt=document.getElementById('admProcessingText');
  if(ov){ ov.style.display='flex'; setTimeout(function(){ ov.classList.add('open'); },10); }
  if(txt) txt.textContent=msgText||'İcra olunur...';
}
function admHideProcessing(){
  var ov=document.getElementById('admProcessingOverlay');
  if(ov){ ov.classList.remove('open'); setTimeout(function(){ ov.style.display='none'; },300); }
}

// ── Robust fetch: GAS HTML xəta səhifəsi qaytaranda avtomatik 1 dəfə yenidən cəhd edir.
// Keçici GAS xətaları (deploy dəyişikliyi/limit/soyuq başlanğıc) öz-özünə düzəlir —
// "Unexpected token '<'" xətası əvəzinə avtomatik təkrar cəhd, əl ilə refresh lazım olmur. ──
function admFetch(payload, retries){
  if(retries===undefined) retries=2;
  return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.text(); })
  .then(function(txt){
    var first=(txt||'').replace(/^\s+/,'').charAt(0);
    if(first==='{'||first==='['){
      try{ return JSON.parse(txt); }catch(e){}
    }
    // Cavab JSON deyil — GAS HTML xəta səhifəsi qaytarıb (deploy/limit/avtorizasiya).
    // Keçicidirsə artan gözləmə ilə (0.9s → 2s) təkrar cəhd et:
    if(retries>0){
      var delay=retries===2?900:2000;
      return new Promise(function(res){ setTimeout(res, delay); })
        .then(function(){ return admFetch(payload, retries-1); });
    }
    var m=(txt||'').match(/<title>([^<]*)<\/title>/i);
    var reason=m?m[1].trim():'Server müvəqqəti cavab vermədi';
    throw new Error('Server xətası ('+reason+'). Səhifəni yeniləyib yenidən cəhd edin.');
  });
}

function openAdminPanel(){
  closeMenu();
  if(window.innerWidth < 901){ return; }

  // Giriş vidjeti — digər ağır bölmələrlə eyni 700ms pattern
  var loading = document.getElementById('dashLoading');
  if(loading) loading.style.display='flex';

  setTimeout(function(){
    var nameEl=document.getElementById('admProfileName');
    var roleEl=document.getElementById('admProfileRole');
    if(currentUser){
      if(nameEl) nameEl.textContent=currentUser.name||'—';
      if(roleEl) roleEl.textContent=currentUser.role||'—';
    }
    document.getElementById('dashboardView').style.display='none';
    document.getElementById('adminPanelView').style.display='flex';

    // BUS Management məlumatlarını da yüklə
    loadAdminUsers();
    loadBusManagementData();

    if(loading) loading.style.display='none';
  }, 700);
}

function closeAdminPanel(){
  // Router vasitəsilə — digər bölmələrlə eyni "Hazırlanır..." vidjeti
  // avtomatik göstərilir (_LOADING_EXIT_VIEWS-də adminPanelView var).
  if(typeof routerNavigate === 'function' && typeof ROUTER_READY !== 'undefined' && ROUTER_READY && currentUser){
    routerNavigate('dashboard', true);
  } else {
    document.getElementById('adminPanelView').style.display='none';
    document.getElementById('dashboardView').style.display='block';
  }
}

function switchAdminSection(key, btn){
  document.querySelectorAll('.adm-nav-item').forEach(function(el){ el.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.adm-section').forEach(function(el){ el.style.display='none'; });
  var target=document.getElementById('admSection-'+key);
  if(target) target.style.display='block';
  
  if(key==='users' && typeof loadAdminUsers==='function') loadAdminUsers();
  if(key==='guests' && typeof loadAdminGuests==='function') loadAdminGuests();
  if(key==='tvm' && typeof loadTvmManagementData==='function') loadTvmManagementData();
  if(key==='tech' && typeof loadAdminTechnicians==='function') loadAdminTechnicians();
  if(key==='leaders' && typeof loadAdminLeaders==='function') loadAdminLeaders();
  if(key==='collectives' && typeof loadAdminCollectives==='function') loadAdminCollectives();
  if(key==='messages' && typeof loadAdminMessages==='function') loadAdminMessages();
  if(key==='tgtemplates' && typeof loadTelegramTemplates==='function') loadTelegramTemplates();
  if(key==='homedash' && typeof loadAdminHomeDashboard==='function') loadAdminHomeDashboard();

  // BUS Management
  if(key==='bus' && typeof loadBusManagementData==='function') loadBusManagementData();
}

// ── USER MANAGEMENT ─────────────────────────────────
var admUsersAllRows=[], admUsersLoaded=false, admUsrCurrentPage=1, admUsrPageSize=7, admUsrEditingId=null, admUsrDeletingId=null;
var admUsersSearchDebounceTimer=null;
function admUsersDebouncedRender(){ clearTimeout(admUsersSearchDebounceTimer); admUsersSearchDebounceTimer=setTimeout(function(){ admUsrCurrentPage=1; admRenderUsersTable(); },180); }

function loadAdminUsers(){
  var body=document.getElementById('admUsrTableBody');
  if(body) body.innerHTML='<tr><td colspan="5"><div class="adm-empty">Yüklənir...</div></td></tr>';
  admFetch({action:'getUsersData', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){
      if(body) body.innerHTML='<tr><td colspan="5"><div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div></td></tr>';
      return;
    }
    admUsersAllRows=d.users||[];
    admUsersLoaded=true;
    var s=d.stats||{};
    var elT=document.getElementById('admUsrStatTotal'); if(elT) elT.textContent=s.total!=null?s.total:'0';
    var elA=document.getElementById('admUsrStatActive'); if(elA) elA.textContent=s.active!=null?s.active:'0';
    var elI=document.getElementById('admUsrStatInactive'); if(elI) elI.textContent=s.inactive!=null?s.inactive:'0';
    var elAd=document.getElementById('admUsrStatAdmins'); if(elAd) elAd.textContent=s.admins!=null?s.admins:'0';
    var elTe=document.getElementById('admUsrStatTech'); if(elTe) elTe.textContent=s.technicians!=null?s.technicians:'0';
    admUsrCurrentPage=1;
    admRenderUsersTable();
  })
  .catch(function(e){
    if(body) body.innerHTML='<tr><td colspan="5"><div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div></td></tr>';
  });
}

function admRoleClass(role){
  var r=(role||'').toLowerCase();
  if(r.indexOf('admin')!==-1) return 'adm-pill-blue';
  if(r.indexOf('call center')!==-1||r.indexOf('callcenter')!==-1) return 'adm-pill-teal';
  if(r.indexOf('guest')!==-1) return 'adm-pill-amber';
  if(r.indexOf('leader')!==-1||r.indexOf('rəhbər')!==-1) return 'adm-pill-purple';
  if(r.indexOf('technician')!==-1||r.indexOf('texnik')!==-1) return 'adm-pill-green';
  return 'adm-pill-blue';
}
function admRoleCategory(role){
  var r=(role||'').toLowerCase();
  if(r.indexOf('admin')!==-1) return 'admin';
  if(r.indexOf('call center')!==-1||r.indexOf('callcenter')!==-1) return 'call center';
  if(r.indexOf('guest')!==-1) return 'guest';
  if(r.indexOf('leader')!==-1||r.indexOf('rəhbər')!==-1) return 'group leader';
  if(r.indexOf('technician')!==-1||r.indexOf('texnik')!==-1) return 'technician';
  return 'user';
}
function admInitials(name){
  var parts=(name||'').trim().split(/\s+/).filter(Boolean);
  if(parts.length===0) return '—';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}

function admGetFilteredUsers(){
  var q=(document.getElementById('admUsrSearch').value||'').toLowerCase().trim();
  var roleF=document.getElementById('admUsrRoleFilter').value;
  var statusF=document.getElementById('admUsrStatusFilter').value;
  return admUsersAllRows.filter(function(u){
    if(q && u.fullName.toLowerCase().indexOf(q)===-1 && u.email.toLowerCase().indexOf(q)===-1) return false;
    if(roleF && admRoleCategory(u.role)!==roleF) return false;
    if(statusF && (u.status||'').toLowerCase()!==statusF) return false;
    return true;
  });
}

function admRenderUsersTable(){
  var filtered=admGetFilteredUsers();
  var totalPages=Math.max(1, Math.ceil(filtered.length/admUsrPageSize));
  if(admUsrCurrentPage>totalPages) admUsrCurrentPage=totalPages;
  var startIdx=(admUsrCurrentPage-1)*admUsrPageSize;
  var visible=filtered.slice(startIdx, startIdx+admUsrPageSize);

  var body=document.getElementById('admUsrTableBody');
  if(visible.length===0){
    body.innerHTML='<tr><td colspan="5"><div class="adm-empty">İstifadəçi tapılmadı</div></td></tr>';
  } else {
    body.innerHTML=visible.map(function(u){
      var isActive=(u.status||'').toLowerCase()==='active';
      var safeId=u.userId.replace(/'/g,'');
      var lockedBadge='';
      if(u.isLocked){
        var untilTxt='';
        if(u.lockedUntil){
          try{
            var d=new Date(u.lockedUntil);
            untilTxt=' — '+d.toLocaleDateString('az-AZ')+' '+d.toLocaleTimeString('az-AZ',{hour:'2-digit',minute:'2-digit'})+'-ə qədər';
          }catch(e){}
        }
        lockedBadge='<div class="adm-locked-badge" title="Yanlış cəhdlər: '+(u.failedAttempts||0)+'/4">🔒 Bloklu'+untilTxt+'</div>';
      } else if(u.failedAttempts>0){
        lockedBadge='<div class="adm-failed-badge">Yanlış cəhd: '+u.failedAttempts+'/4</div>';
      }
      return '<tr>'
        +'<td><div class="adm-name-cell"><span class="adm-avatar">'+escapeHtml(admInitials(u.fullName))+'</span>'+escapeHtml(u.fullName)+'</div></td>'
        +'<td>'+escapeHtml(u.email)+'</td>'
        +'<td><span class="adm-pill '+admRoleClass(u.role)+'">'+escapeHtml(u.role||'—')+'</span></td>'
        +'<td><div class="adm-status-cell"><span class="adm-status '+(isActive?'adm-status-active':'adm-status-inactive')+'">'+escapeHtml(u.status||'—')+'</span>'+lockedBadge+'</div></td>'
        +'<td class="adm-th-act">'
        +(u.isLocked?'<button class="adm-icon-btn adm-icon-btn-unlock" onclick="admUnlockUser(\''+safeId+'\')" aria-label="Blokdan çıxar" title="Blokdan çıxar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></button>':'')
        +'<button class="adm-icon-btn" onclick="openUserModal(\''+safeId+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
        +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="openDeleteConfirm(\''+safeId+'\',\''+escapeHtml(u.fullName).replace(/'/g,'')+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        +'</td></tr>';
    }).join('');
  }

  var infoEl=document.getElementById('admUsrPageInfo');
  if(filtered.length===0){ infoEl.textContent='Showing 0 entries'; }
  else { infoEl.textContent='Showing '+(startIdx+1)+' to '+Math.min(startIdx+admUsrPageSize,filtered.length)+' of '+filtered.length+' entries'; }

  var btnsEl=document.getElementById('admUsrPageBtns');
  var html='';
  html+='<button class="adm-page-btn" '+(admUsrCurrentPage<=1?'disabled':'')+' onclick="admUsrGoPage('+(admUsrCurrentPage-1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>';
  var startPage=Math.max(1, admUsrCurrentPage-1), endPage=Math.min(totalPages, startPage+3);
  startPage=Math.max(1, endPage-3);
  for(var p=startPage; p<=endPage; p++){
    html+='<button class="adm-page-btn'+(p===admUsrCurrentPage?' adm-page-btn-active':'')+'" onclick="admUsrGoPage('+p+')">'+p+'</button>';
  }
  html+='<button class="adm-page-btn" '+(admUsrCurrentPage>=totalPages?'disabled':'')+' onclick="admUsrGoPage('+(admUsrCurrentPage+1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>';
  btnsEl.innerHTML=html;
}
function admUsrGoPage(p){ if(p<1) return; admUsrCurrentPage=p; admRenderUsersTable(); }

function openUserModal(userId){
  admUsrEditingId=userId||null;
  document.getElementById('admUsrFormError').style.display='none';
  document.getElementById('admUsrFullName').value='';
  document.getElementById('admUsrEmail').value='';
  document.getElementById('admUsrPassword').value='';
  document.getElementById('admUsrRole').value='Technician';
  document.getElementById('admUsrStatus').value='Active';

  if(userId){
    var u=admUsersAllRows.find(function(x){ return x.userId===userId; });
    document.getElementById('admUserModalTitle').textContent='Edit User';
    document.getElementById('admUsrPasswordLabel').textContent='Password (dəyişmək istəmirsinizsə boş buraxın)';
    document.getElementById('admUsrSaveBtn').textContent='Save Changes';
    if(u){
      document.getElementById('admUsrFullName').value=u.fullName;
      document.getElementById('admUsrEmail').value=u.email;
      document.getElementById('admUsrRole').value=admRoleExactMatch(u.role);
      document.getElementById('admUsrStatus').value=(u.status||'').toLowerCase()==='active'?'Active':'Inactive';
    }
  } else {
    document.getElementById('admUserModalTitle').textContent='Add User';
    document.getElementById('admUsrPasswordLabel').textContent='Password *';
    document.getElementById('admUsrSaveBtn').textContent='Save';
  }
  var ov=document.getElementById('admUserModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function admRoleExactMatch(role){
  var opts=['Admin','Group Leader','Technician','Call Center','User'];
  var cat=admRoleCategory(role);
  if(cat==='admin') return 'Admin';
  if(cat==='call center') return 'Call Center';
  if(cat==='group leader') return 'Group Leader';
  if(cat==='technician') return 'Technician';
  return 'User';
}
function closeUserModal(){
  var ov=document.getElementById('admUserModal');
  ov.classList.remove('open'); ov.style.display='none';
  admUsrEditingId=null;
}
function submitUserModal(){
  var fullName=document.getElementById('admUsrFullName').value.trim();
  var email=document.getElementById('admUsrEmail').value.trim();
  var password=document.getElementById('admUsrPassword').value.trim();
  var role=document.getElementById('admUsrRole').value;
  var status=document.getElementById('admUsrStatus').value;
  var errEl=document.getElementById('admUsrFormError');
  errEl.style.display='none';

  if(!fullName || !email || (!admUsrEditingId && !password)){
    errEl.textContent='Zəhmət olmasa bütün zəruri (*) sahələri doldurun.';
    errEl.style.display='block';
    return;
  }
  if(email.indexOf('@')===-1){
    errEl.textContent='Düzgün email daxil edin.';
    errEl.style.display='block';
    return;
  }

  var btn=document.getElementById('admUsrSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admUsrEditingId
    ? { action:'updateUser', userId:admUsrEditingId, data:{fullName:fullName, email:email, password:password, role:role, status:status}, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addUser', data:{fullName:fullName, email:email, password:password, role:role, status:status}, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){
      errEl.textContent=d.message||'Xəta baş verdi';
      errEl.style.display='block';
      return;
    }
    closeUserModal();
    loadAdminUsers();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message;
    errEl.style.display='block';
  });
}

var admDeleteConfirmAction=null;
function admOpenDeleteConfirm(text, actionFn, opts){
  opts = opts || {};
  admDeleteConfirmAction=actionFn;
  document.getElementById('admDeleteText').textContent=text;
  document.getElementById('admDeleteTitle').textContent = opts.title || 'İstifadəçini sil?';
  var btn = document.getElementById('admDeleteConfirmBtn');
  btn.textContent = opts.buttonLabel || 'Delete';
  btn.className = 'adm-modal-save ' + (opts.buttonClass || 'adm-modal-save-danger');
  var iconEl = document.getElementById('admDeleteIcon');
  iconEl.className = 'adm-delete-icon' + (opts.iconClass ? ' '+opts.iconClass : '');
  if(opts.iconSvg) iconEl.innerHTML = opts.iconSvg;
  else iconEl.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  var ov = document.getElementById('admDeleteConfirm');
  ov.style.display='flex'; ov.classList.add('open');
}
function openDeleteConfirm(userId, name){
  admOpenDeleteConfirm('"'+name+'" istifadəçisini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return admFetch({action:'deleteUser', userId:userId, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadAdminUsers();
    });
  });
}
function admUnlockUser(userId){
  var u=admUsersAllRows.find(function(x){ return x.userId===userId; });
  var name=u?u.fullName:userId;
  admOpenDeleteConfirm(
    '"'+name+'" istifadəçisinin hesabını blokdan çıxarmaq istədiyinizə əminsiniz?',
    function(){
      return admFetch({action:'unlockUser', userId:userId, requesterEmail: currentUser?currentUser.email:''})
      .then(function(d){
        if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
        // Dərhal lokal state-i yenilə (server refetch-i gözləmədən UI-da əks olunsun)
        if(u){ u.isLocked=false; u.failedAttempts=0; u.lockedUntil=''; }
        admRenderUsersTable();
        // Server-dən təzə məlumatla təsdiqlə
        loadAdminUsers();
      });
    },
    {
      title: 'Hesabı blokdan çıxar?',
      buttonLabel: 'Unlock',
      buttonClass: 'adm-modal-save-unlock',
      iconClass: 'adm-unlock-icon',
      iconSvg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
    }
  );
}
function closeDeleteConfirm(){
  var ov=document.getElementById('admDeleteConfirm');
  ov.classList.remove('open'); ov.style.display='none';
  admDeleteConfirmAction=null;
}
function admConfirmDelete(){
  if(!admDeleteConfirmAction) return;
  var action=admDeleteConfirmAction;
  closeDeleteConfirm();
  action().catch(function(e){ alert('Şəbəkə xətası: '+e.message); });
}

function admExportUsers(){
  var filtered=admGetFilteredUsers();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ ensureXlsx(function(){ admExportUsers(); }); return; }
  var cols=['Full Name','Email','Role','Status'];
  var wsData=[cols];
  filtered.forEach(function(u){ wsData.push([u.fullName, u.email, u.role, u.status]); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  var today=new Date();
  XLSX.writeFile(wb, 'Users_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

// ── GUEST ACCOUNTS ───────────────────────────────────
var admGuestsAllRows=[], admGuestsLoaded=false, admGstCurrentPage=1, admGstPageSize=7, admGstEditingId=null;
var admGuestsSearchDebounceTimer=null;
function admGuestsDebouncedRender(){ clearTimeout(admGuestsSearchDebounceTimer); admGuestsSearchDebounceTimer=setTimeout(function(){ admGstCurrentPage=1; admRenderGuestsTable(); },180); }

function admIsGuestRole(role){ return (role||'').toLowerCase().indexOf('guest')!==-1; }
function admGuestType(role){ return (role||'').toLowerCase().indexOf('bakikart')!==-1 ? 'bakikart' : 'ayna'; }

function loadAdminGuests(){
  var body=document.getElementById('admGstTableBody');
  if(body) body.innerHTML='<tr><td colspan="6"><div class="adm-empty">Yüklənir...</div></td></tr>';
  admFetch({action:'getUsersData', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){
      if(body) body.innerHTML='<tr><td colspan="6"><div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div></td></tr>';
      return;
    }
    var allUsers=d.users||[];
    admGuestsAllRows = allUsers.filter(function(u){ return admIsGuestRole(u.role); });
    admGuestsLoaded=true;

    var totalAyna=0, totalBakikart=0;
    admGuestsAllRows.forEach(function(u){
      if(admGuestType(u.role)==='bakikart') totalBakikart++; else totalAyna++;
    });
    var elT=document.getElementById('admGstStatTotal'); if(elT) elT.textContent=admGuestsAllRows.length;
    var elA=document.getElementById('admGstStatAyna'); if(elA) elA.textContent=totalAyna;
    var elB=document.getElementById('admGstStatBakikart'); if(elB) elB.textContent=totalBakikart;

    admGstCurrentPage=1;
    admRenderGuestsTable();
  })
  .catch(function(e){
    if(body) body.innerHTML='<tr><td colspan="6"><div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div></td></tr>';
  });
}

function admGetFilteredGuests(){
  var q=(document.getElementById('admGstSearch').value||'').toLowerCase().trim();
  var typeF=document.getElementById('admGstTypeFilter').value;
  var statusF=document.getElementById('admGstStatusFilter').value;
  return admGuestsAllRows.filter(function(u){
    if(q && u.fullName.toLowerCase().indexOf(q)===-1 && u.email.toLowerCase().indexOf(q)===-1) return false;
    if(typeF && admGuestType(u.role)!==typeF) return false;
    if(statusF && (u.status||'').toLowerCase()!==statusF) return false;
    return true;
  });
}

function admRenderGuestsTable(){
  var filtered=admGetFilteredGuests();
  var totalPages=Math.max(1, Math.ceil(filtered.length/admGstPageSize));
  if(admGstCurrentPage>totalPages) admGstCurrentPage=totalPages;
  var startIdx=(admGstCurrentPage-1)*admGstPageSize;
  var visible=filtered.slice(startIdx, startIdx+admGstPageSize);

  var body=document.getElementById('admGstTableBody');
  if(visible.length===0){
    body.innerHTML='<tr><td colspan="6"><div class="adm-empty">Guest hesabı tapılmadı</div></td></tr>';
  } else {
    body.innerHTML=visible.map(function(u){
      var isActive=(u.status||'').toLowerCase()==='active';
      var safeId=u.userId.replace(/'/g,'');
      var type=admGuestType(u.role);
      var typeLabel = type==='bakikart' ? 'Bakikart' : 'AYNA';
      var typePill = type==='bakikart' ? 'adm-pill-purple' : 'adm-pill-amber';
      var access = type==='bakikart' ? 'Bus + TVM' : 'Bus';
      return '<tr>'
        +'<td><div class="adm-name-cell"><span class="adm-avatar">'+escapeHtml(admInitials(u.fullName))+'</span>'+escapeHtml(u.fullName)+'</div></td>'
        +'<td>'+escapeHtml(u.email)+'</td>'
        +'<td><span class="adm-pill '+typePill+'">'+typeLabel+'</span></td>'
        +'<td>'+access+'</td>'
        +'<td><span class="adm-status '+(isActive?'adm-status-active':'adm-status-inactive')+'">'+escapeHtml(u.status||'—')+'</span></td>'
        +'<td class="adm-th-act">'
        +'<button class="adm-icon-btn" onclick="openGuestModal(\''+safeId+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
        +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="openDeleteConfirm(\''+safeId+'\',\''+escapeHtml(u.fullName).replace(/'/g,'')+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        +'</td></tr>';
    }).join('');
  }

  var infoEl=document.getElementById('admGstPageInfo');
  if(filtered.length===0){ infoEl.textContent='Showing 0 entries'; }
  else { infoEl.textContent='Showing '+(startIdx+1)+' to '+Math.min(startIdx+admGstPageSize,filtered.length)+' of '+filtered.length+' entries'; }

  var btnsEl=document.getElementById('admGstPageBtns');
  var html='';
  html+='<button class="adm-page-btn" '+(admGstCurrentPage<=1?'disabled':'')+' onclick="admGstGoPage('+(admGstCurrentPage-1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>';
  var startPage=Math.max(1, admGstCurrentPage-1), endPage=Math.min(totalPages, startPage+3);
  startPage=Math.max(1, endPage-3);
  for(var p=startPage; p<=endPage; p++){
    html+='<button class="adm-page-btn'+(p===admGstCurrentPage?' adm-page-btn-active':'')+'" onclick="admGstGoPage('+p+')">'+p+'</button>';
  }
  html+='<button class="adm-page-btn" '+(admGstCurrentPage>=totalPages?'disabled':'')+' onclick="admGstGoPage('+(admGstCurrentPage+1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>';
  btnsEl.innerHTML=html;
}
function admGstGoPage(p){ if(p<1) return; admGstCurrentPage=p; admRenderGuestsTable(); }

function openGuestModal(userId){
  admGstEditingId=userId||null;
  document.getElementById('admGstFormError').style.display='none';
  document.getElementById('admGstPassword').value='';
  if(userId){
    var u=admGuestsAllRows.find(function(x){ return x.userId===userId; });
    document.getElementById('admGuestModalTitle').textContent='Edit Guest';
    document.getElementById('admGstFullName').value=u?u.fullName:'';
    document.getElementById('admGstEmail').value=u?u.email:'';
    document.getElementById('admGstStatus').value=u?(u.status||'Active'):'Active';
    document.getElementById('admGstPasswordLabel').textContent='Password (boş saxlasan dəyişməz)';
    document.getElementById('admGstTvmDash').checked = u ? admGuestType(u.role)==='bakikart' : false;
  } else {
    document.getElementById('admGuestModalTitle').textContent='Add Guest';
    document.getElementById('admGstFullName').value='';
    document.getElementById('admGstEmail').value='';
    document.getElementById('admGstStatus').value='Active';
    document.getElementById('admGstPasswordLabel').textContent='Password *';
    document.getElementById('admGstTvmDash').checked=false;
  }
  var ov=document.getElementById('admGuestModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeGuestModal(){
  var ov=document.getElementById('admGuestModal');
  ov.classList.remove('open'); ov.style.display='none';
  admGstEditingId=null;
}
function submitGuestModal(){
  var fullName=document.getElementById('admGstFullName').value.trim();
  var email=document.getElementById('admGstEmail').value.trim();
  var password=document.getElementById('admGstPassword').value;
  var status=document.getElementById('admGstStatus').value;
  var isBakikart=document.getElementById('admGstTvmDash').checked;
  var role = isBakikart ? 'Guest Bakikart' : 'Guest AYNA';
  var errEl=document.getElementById('admGstFormError');
  errEl.style.display='none';

  if(!fullName || !email){ errEl.textContent='Ad və Email məcburidir'; errEl.style.display='block'; return; }
  if(!admGstEditingId && !password){ errEl.textContent='Yeni guest üçün şifrə məcburidir'; errEl.style.display='block'; return; }

  var btn=document.getElementById('admGstSaveBtn');
  btn.disabled=true; btn.textContent='Saxlanılır...';

  var payload = admGstEditingId
    ? { action:'updateUser', userId:admGstEditingId, data:{fullName:fullName, email:email, password:password, role:role, status:status}, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addUser', data:{fullName:fullName, email:email, password:password, role:role, status:status}, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent='Save';
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeGuestModal();
    loadAdminGuests();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent='Save';
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}

// ── TVM MANAGEMENT ───────────────────────────────────
var admTvmRegistryAll=[], admTvmProblems=[], admTvmSolutions=[], admTvmLeaders=[];
var admTvmRegCurrentPage=1, admTvmRegPageSize=8, admTvmRegEditingId=null;
var admTvmListEditingSheet=null, admTvmListEditingValue=null;
var admTvmRegSearchDebounceTimer=null;
var ADM_TVM_SHEET_LABEL={ 'TVM_PROBLEMS':'Nasazlıq', 'TVM_SOLUTIONS':'Həll', 'TVM_TeamLeaders':'Qrup Rəhbəri', 'TECHNICALS':'Texnik', 'TEAM_LEADERS':'Qrup Rəhbəri' };
var ADM_TVM_LIST_MAP={ 'TVM_PROBLEMS':'admTvmProblemsList', 'TVM_SOLUTIONS':'admTvmSolutionsList', 'TVM_TeamLeaders':'admTvmLeadersList', 'TECHNICALS':'admTechList', 'TEAM_LEADERS':'admLeadersList' };
var ADM_TVM_COUNT_MAP={ 'TVM_PROBLEMS':'admTvmProblemsCount', 'TVM_SOLUTIONS':'admTvmSolutionsCount', 'TVM_TeamLeaders':'admTvmLeadersCount', 'TECHNICALS':'admTechCount', 'TEAM_LEADERS':'admLeadersCount' };
var admTechAll=[], admLeadersAll=[];

function switchTvmSubtab(key, btn){
  document.querySelectorAll('#admSection-tvm .adm-subtab').forEach(function(el){ el.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.adm-tvm-sub').forEach(function(el){ el.style.display='none'; });
  var target=document.getElementById('admTvmSub-'+key);
  if(target) target.style.display='block';
}

function loadTvmManagementData(){
  var body=document.getElementById('admTvmRegTableBody');
  if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Yüklənir...</div></td></tr>';
  admFetch({action:'getTvmManagementData', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){
      if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div></td></tr>';
      return;
    }
    admTvmRegistryAll=d.registry||[];
    admTvmProblems=d.problems||[];
    admTvmSolutions=d.solutions||[];
    admTvmLeaders=d.leaders||[];
    var s=d.registryStats||{};
    var elT=document.getElementById('admTvmStatTotal'); if(elT) elT.textContent=s.total!=null?s.total:'0';
    var elM=document.getElementById('admTvmStatMetro'); if(elM) elM.textContent=s.metro!=null?s.metro:'0';
    var elS=document.getElementById('admTvmStatStops'); if(elS) elS.textContent=s.stops!=null?s.stops:'0';
    admTvmRegCurrentPage=1;
    admRenderTvmRegistryTable();
    admRenderTvmSimpleList('TVM_PROBLEMS', admTvmProblems);
    admRenderTvmSimpleList('TVM_SOLUTIONS', admTvmSolutions);
    admRenderTvmSimpleList('TVM_TeamLeaders', admTvmLeaders);
  })
  .catch(function(e){
    if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div></td></tr>';
  });
}

// ── TVM Reyestri (TVM_SN_AND_LOC) ──
function admTvmRegDebouncedRender(){ clearTimeout(admTvmRegSearchDebounceTimer); admTvmRegSearchDebounceTimer=setTimeout(function(){ admTvmRegCurrentPage=1; admRenderTvmRegistryTable(); },180); }
function admGetFilteredTvmRegistry(){
  var q=(document.getElementById('admTvmRegSearch').value||'').toLowerCase().trim();
  if(!q) return admTvmRegistryAll;
  return admTvmRegistryAll.filter(function(r){
    return r.id.toLowerCase().indexOf(q)!==-1 || r.location.toLowerCase().indexOf(q)!==-1 || r.serviceLocation.toLowerCase().indexOf(q)!==-1;
  });
}
function admRenderTvmRegistryTable(){
  var filtered=admGetFilteredTvmRegistry();
  var totalPages=Math.max(1, Math.ceil(filtered.length/admTvmRegPageSize));
  if(admTvmRegCurrentPage>totalPages) admTvmRegCurrentPage=totalPages;
  var startIdx=(admTvmRegCurrentPage-1)*admTvmRegPageSize;
  var visible=filtered.slice(startIdx, startIdx+admTvmRegPageSize);

  var body=document.getElementById('admTvmRegTableBody');
  if(visible.length===0){
    body.innerHTML='<tr><td colspan="4"><div class="adm-empty">TVM tapılmadı</div></td></tr>';
  } else {
    body.innerHTML=visible.map(function(r){
      var safeId=r.id.replace(/'/g,'');
      return '<tr>'
        +'<td class="adm-mono">'+escapeHtml(r.id)+'</td>'
        +'<td>'+escapeHtml(r.location||'—')+'</td>'
        +'<td>'+escapeHtml(r.serviceLocation||'—')+'</td>'
        +'<td class="adm-th-act">'
        +'<button class="adm-icon-btn" onclick="openTvmRegistryModal(\''+safeId+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
        +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteTvmRegistry(\''+safeId+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        +'</td></tr>';
    }).join('');
  }

  var infoEl=document.getElementById('admTvmRegPageInfo');
  if(filtered.length===0){ infoEl.textContent='Showing 0 entries'; }
  else { infoEl.textContent='Showing '+(startIdx+1)+' to '+Math.min(startIdx+admTvmRegPageSize,filtered.length)+' of '+filtered.length+' entries'; }

  var btnsEl=document.getElementById('admTvmRegPageBtns');
  var html='';
  html+='<button class="adm-page-btn" '+(admTvmRegCurrentPage<=1?'disabled':'')+' onclick="admTvmRegGoPage('+(admTvmRegCurrentPage-1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>';
  var startPage=Math.max(1, admTvmRegCurrentPage-1), endPage=Math.min(totalPages, startPage+3);
  startPage=Math.max(1, endPage-3);
  for(var p=startPage; p<=endPage; p++){
    html+='<button class="adm-page-btn'+(p===admTvmRegCurrentPage?' adm-page-btn-active':'')+'" onclick="admTvmRegGoPage('+p+')">'+p+'</button>';
  }
  html+='<button class="adm-page-btn" '+(admTvmRegCurrentPage>=totalPages?'disabled':'')+' onclick="admTvmRegGoPage('+(admTvmRegCurrentPage+1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>';
  btnsEl.innerHTML=html;
}
function admTvmRegGoPage(p){ if(p<1) return; admTvmRegCurrentPage=p; admRenderTvmRegistryTable(); }

function openTvmRegistryModal(id){
  admTvmRegEditingId=id||null;
  document.getElementById('admTvmRegFormError').style.display='none';
  document.getElementById('admTvmRegId').value='';
  document.getElementById('admTvmRegLocation').value='';
  document.getElementById('admTvmRegServiceLocation').value='';
  if(id){
    var r=admTvmRegistryAll.find(function(x){ return x.id===id; });
    document.getElementById('admTvmRegModalTitle').textContent='Edit TVM';
    document.getElementById('admTvmRegSaveBtn').textContent='Save Changes';
    if(r){
      document.getElementById('admTvmRegId').value=r.id;
      document.getElementById('admTvmRegLocation').value=r.location;
      document.getElementById('admTvmRegServiceLocation').value=r.serviceLocation;
    }
  } else {
    document.getElementById('admTvmRegModalTitle').textContent='Add TVM';
    document.getElementById('admTvmRegSaveBtn').textContent='Save';
  }
  var ov=document.getElementById('admTvmRegModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeTvmRegistryModal(){
  var ov=document.getElementById('admTvmRegModal');
  ov.classList.remove('open'); ov.style.display='none';
  admTvmRegEditingId=null;
}
function submitTvmRegistryModal(){
  var id=document.getElementById('admTvmRegId').value.trim();
  var location=document.getElementById('admTvmRegLocation').value.trim();
  var serviceLocation=document.getElementById('admTvmRegServiceLocation').value.trim();
  var errEl=document.getElementById('admTvmRegFormError');
  errEl.style.display='none';
  if(!id){ errEl.textContent='TVM İD daxil edin.'; errEl.style.display='block'; return; }

  var btn=document.getElementById('admTvmRegSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admTvmRegEditingId
    ? { action:'updateTvmRegistryEntry', originalId:admTvmRegEditingId, data:{id:id, location:location, serviceLocation:serviceLocation}, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addTvmRegistryEntry', data:{id:id, location:location, serviceLocation:serviceLocation}, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeTvmRegistryModal();
    loadTvmManagementData();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}
function admDeleteTvmRegistry(id){
  admOpenDeleteConfirm('"'+id+'" TVM cihazını silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return admFetch({action:'deleteTvmRegistryEntry', id:id, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadTvmManagementData();
    });
  });
}
function admExportTvmRegistry(){
  var filtered=admGetFilteredTvmRegistry();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ ensureXlsx(function(){ admExportTvmRegistry(); }); return; }
  var wsData=[['TVM İD','Lokasiya','Servis Lokasiyası']];
  filtered.forEach(function(r){ wsData.push([r.id, r.location, r.serviceLocation]); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TVM Registry');
  var today=new Date();
  XLSX.writeFile(wb, 'TVM_Registry_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

// ── Sadə siyahılar (Nasazlıq/Həll/Qrup Rəhbəri) — sıralana bilən ──
function admGetListArray(sheetName){
  if(sheetName==='TVM_PROBLEMS') return admTvmProblems;
  if(sheetName==='TVM_SOLUTIONS') return admTvmSolutions;
  if(sheetName==='TVM_TeamLeaders') return admTvmLeaders;
  return [];
}
function admRenderTvmSimpleList(sheetName, arr){
  var listEl=document.getElementById(ADM_TVM_LIST_MAP[sheetName]);
  var countEl=document.getElementById(ADM_TVM_COUNT_MAP[sheetName]);
  var label=ADM_TVM_SHEET_LABEL[sheetName]||'Element';
  if(countEl) countEl.textContent=arr.length+' '+label;
  if(!listEl) return;
  if(arr.length===0){ listEl.innerHTML='<div class="adm-empty">Siyahı boşdur</div>'; return; }
  listEl.innerHTML=arr.map(function(val, idx){
    var safeVal=val.replace(/'/g,'');
    return '<div class="adm-reorder-row">'
      +'<span class="adm-reorder-num">'+(idx+1)+'</span>'
      +'<span class="adm-reorder-text">'+escapeHtml(val)+'</span>'
      +'<div class="adm-reorder-arrows">'
      +'<button class="adm-reorder-arrow" '+(idx===0?'disabled':'')+' onclick="admMoveTvmListItem(\''+sheetName+'\',\''+safeVal+'\',\'up\')" aria-label="Yuxarı"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg></button>'
      +'<button class="adm-reorder-arrow" '+(idx===arr.length-1?'disabled':'')+' onclick="admMoveTvmListItem(\''+sheetName+'\',\''+safeVal+'\',\'down\')" aria-label="Aşağı"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg></button>'
      +'</div>'
      +'<button class="adm-icon-btn" onclick="openTvmListModal(\''+sheetName+'\',\''+safeVal+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
      +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteTvmListItem(\''+sheetName+'\',\''+safeVal+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
      +'</div>';
  }).join('');
}
function admReloadListSource(sheetName){
  if(sheetName==='TECHNICALS'){ if(typeof loadAdminTechnicians==='function') loadAdminTechnicians(); }
  else if(sheetName==='TEAM_LEADERS'){ if(typeof loadAdminLeaders==='function') loadAdminLeaders(); }
  else { if(typeof loadTvmManagementData==='function') loadTvmManagementData(); }
}
function admMoveTvmListItem(sheetName, value, direction){
  admFetch({action:'moveTvmListItem', sheetName:sheetName, value:value, direction:direction, requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
    admReloadListSource(sheetName);
  })
  .catch(function(e){ alert('Şəbəkə xətası: '+e.message); });
}
function openTvmListModal(sheetName, oldValue){
  admTvmListEditingSheet=sheetName;
  admTvmListEditingValue=oldValue||null;
  document.getElementById('admTvmListFormError').style.display='none';
  var label=ADM_TVM_SHEET_LABEL[sheetName]||'Dəyər';
  document.getElementById('admTvmListModalTitle').textContent=(oldValue?'Edit ':'Add ')+label;
  document.getElementById('admTvmListFieldLabel').textContent=label+' *';
  document.getElementById('admTvmListValue').placeholder=label+' daxil edin';
  document.getElementById('admTvmListValue').value=oldValue||'';
  document.getElementById('admTvmListSaveBtn').textContent=oldValue?'Save Changes':'Save';
  var ov=document.getElementById('admTvmListModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeTvmListModal(){
  var ov=document.getElementById('admTvmListModal');
  ov.classList.remove('open'); ov.style.display='none';
  admTvmListEditingSheet=null; admTvmListEditingValue=null;
}
function submitTvmListModal(){
  var value=document.getElementById('admTvmListValue').value.trim();
  var errEl=document.getElementById('admTvmListFormError');
  errEl.style.display='none';
  if(!value){ errEl.textContent='Boş dəyər saxlanıla bilməz.'; errEl.style.display='block'; return; }

  var btn=document.getElementById('admTvmListSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admTvmListEditingValue
    ? { action:'updateTvmListItem', sheetName:admTvmListEditingSheet, oldValue:admTvmListEditingValue, newValue:value, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addTvmListItem', sheetName:admTvmListEditingSheet, value:value, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeTvmListModal();
    admReloadListSource(admTvmListEditingSheet);
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}
function admDeleteTvmListItem(sheetName, value){
  var label=ADM_TVM_SHEET_LABEL[sheetName]||'dəyəri';
  admOpenDeleteConfirm('"'+value+'" '+label+'ni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return admFetch({action:'deleteTvmListItem', sheetName:sheetName, value:value, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admReloadListSource(sheetName);
    });
  });
}
// ── TECHNICIANS / GROUP LEADERS (əsas admin bölmələri) ──
function loadAdminTechnicians(){
  var listEl=document.getElementById('admTechList');
  if(listEl) listEl.innerHTML='<div class="adm-empty">Yüklənir...</div>';
  admFetch({action:'getAdminListData', sheetName:'TECHNICALS', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){ if(listEl) listEl.innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    admTechAll=d.items||[];
    admRenderTvmSimpleList('TECHNICALS', admTechAll);
  })
  .catch(function(e){ if(listEl) listEl.innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>'; });
}
function loadAdminLeaders(){
  var listEl=document.getElementById('admLeadersList');
  if(listEl) listEl.innerHTML='<div class="adm-empty">Yüklənir...</div>';
  admFetch({action:'getAdminListData', sheetName:'TEAM_LEADERS', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){ if(listEl) listEl.innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    admLeadersAll=d.items||[];
    admRenderTvmSimpleList('TEAM_LEADERS', admLeadersAll);
  })
  .catch(function(e){ if(listEl) listEl.innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>'; });
}
// ═══════════════════════════════════════════════════
// BUS MANAGEMENT — Admin Panel üçün tam frontend (YENİ)
// ═══════════════════════════════════════════════════

var admBusRegistryAll=[], admBusProblems=[], admBusSolutions=[], admBusEquipment=[], admBusLocations=[];
var admBusSolutionOwners={}; // { "həll mətni": "AYNA"/"BakıKart"/"AYNA və BakıKart" }
var admBusSolutionCategories={}; // { "həll mətni": "Validator"/"SAM Card"/... }
var admBusRegCurrentPage=1, admBusRegPageSize=8, admBusRegEditingId=null;
var admBusListEditingSheet=null, admBusListEditingValue=null;
var admBusRegSearchDebounceTimer=null;
var ADM_BUS_SHEET_LABEL={ 'BUS_PROBLEMS':'Nasazlıq', 'BUS_SOLUTIONS':'Həll', 'BUS_EQUIPMENT':'Avadanlıq', 'BUS_LOCATIONS':'Lokasiya' };
var ADM_BUS_LIST_MAP={ 'BUS_PROBLEMS':'admBusProblemsList', 'BUS_SOLUTIONS':'admBusSolutionsList', 'BUS_EQUIPMENT':'admBusEquipmentList', 'BUS_LOCATIONS':'admBusLocationsList' };
var ADM_BUS_COUNT_MAP={ 'BUS_PROBLEMS':'admBusProblemsCount', 'BUS_SOLUTIONS':'admBusSolutionsCount', 'BUS_EQUIPMENT':'admBusEquipmentCount', 'BUS_LOCATIONS':'admBusLocationsCount' };

function switchBusSubtab(key, btn){
  document.querySelectorAll('#admSection-bus .adm-subtab').forEach(function(el){ el.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.adm-bus-sub').forEach(function(el){ el.style.display='none'; });
  var target=document.getElementById('admBusSub-'+key);
  if(target) target.style.display='block';
  if(key==='validatorsn'){
    admValSnClearSelection();
    document.getElementById('admValSnSearch').value='';
    document.getElementById('admValSnResults').innerHTML='<div class="adm-empty">Axtarış edin (məs: SN-in son rəqəmləri) — nəticələr aşağıda görünəcək</div>';
    preloadValidatorSNList(true); // admin panelində həmişə təzə siyahı ilə işlə
  }
  if(key==='samcardsn'){
    admSamSnClearSelection();
    document.getElementById('admSamSnSearch').value='';
    document.getElementById('admSamSnResults').innerHTML='<div class="adm-empty">Axtarış edin (məs: SN-in son rəqəmləri) — nəticələr aşağıda görünəcək</div>';
    preloadValidatorSNList(true); // admin panelində həmişə təzə siyahı ilə işlə (hər iki reyestri də yeniləyir)
  }
}

function loadBusManagementData(){
  var body=document.getElementById('admBusRegTableBody');
  if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Yüklənir...</div></td></tr>';
  admFetch({action:'getBusManagementData', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){
      if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div></td></tr>';
      return;
    }
    admBusRegistryAll=d.registry||[];
    admBusProblems=d.problems||[];
    admBusSolutions=d.solutions||[];
    admBusSolutionOwners=d.solutionOwners||{};
    admBusSolutionCategories=d.solutionCategories||{};
    admBusEquipment=d.equipment||[];
    admBusLocations=d.locations||[];
    admBusRegCurrentPage=1;
    admRenderBusRegistryTable();
    admRenderBusSimpleList('BUS_PROBLEMS', admBusProblems);
    admRenderBusSimpleList('BUS_SOLUTIONS', admBusSolutions);
    admRenderBusSimpleList('BUS_EQUIPMENT', admBusEquipment);
    admRenderBusSimpleList('BUS_LOCATIONS', admBusLocations);
  })
  .catch(function(e){
    if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div></td></tr>';
  });
}

function admBusRegDebouncedRender(){ clearTimeout(admBusRegSearchDebounceTimer); admBusRegSearchDebounceTimer=setTimeout(function(){ admBusRegCurrentPage=1; admRenderBusRegistryTable(); },180); }
function admGetFilteredBusRegistry(){
  var q=(document.getElementById('admBusRegSearch').value||'').toLowerCase().trim();
  if(!q) return admBusRegistryAll;
  return admBusRegistryAll.filter(function(r){
    return r.id.toLowerCase().indexOf(q)!==-1 || r.dqn.toLowerCase().indexOf(q)!==-1 || r.carrier.toLowerCase().indexOf(q)!==-1;
  });
}
function admRenderBusRegistryTable(){
  var filtered=admGetFilteredBusRegistry();
  var totalPages=Math.max(1, Math.ceil(filtered.length/admBusRegPageSize));
  if(admBusRegCurrentPage>totalPages) admBusRegCurrentPage=totalPages;
  var startIdx=(admBusRegCurrentPage-1)*admBusRegPageSize;
  var visible=filtered.slice(startIdx, startIdx+admBusRegPageSize);

  var body=document.getElementById('admBusRegTableBody');
  if(visible.length===0){
    body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Avtobus tapılmadı</div></td></tr>';
  } else {
    body.innerHTML=visible.map(function(r){
      var safeId=r.id.replace(/'/g,'');
      return '<tr>'
        +'<td class="adm-mono">'+escapeHtml(r.id)+'</td>'
        +'<td class="adm-mono">'+escapeHtml(r.dqn||'—')+'</td>'
        +'<td>'+escapeHtml(r.carrier||'—')+'</td>'
        +'<td>'+escapeHtml(r.model||'—')+'</td>'
        +'<td class="adm-th-act">'
        +'<button class="adm-icon-btn" onclick="openBusRegistryModal(\''+safeId+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
        +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteBusRegistry(\''+safeId+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        +'</td></tr>';
    }).join('');
  }

  var infoEl=document.getElementById('admBusRegPageInfo');
  if(filtered.length===0){ infoEl.textContent='Showing 0 entries'; }
  else { infoEl.textContent='Showing '+(startIdx+1)+' to '+Math.min(startIdx+admBusRegPageSize,filtered.length)+' of '+filtered.length+' entries'; }

  var btnsEl=document.getElementById('admBusRegPageBtns');
  var html='';
  html+='<button class="adm-page-btn" '+(admBusRegCurrentPage<=1?'disabled':'')+' onclick="admBusRegGoPage('+(admBusRegCurrentPage-1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>';
  var startPage=Math.max(1, admBusRegCurrentPage-1), endPage=Math.min(totalPages, startPage+3);
  startPage=Math.max(1, endPage-3);
  for(var p=startPage; p<=endPage; p++){
    html+='<button class="adm-page-btn'+(p===admBusRegCurrentPage?' adm-page-btn-active':'')+'" onclick="admBusRegGoPage('+p+')">'+p+'</button>';
  }
  html+='<button class="adm-page-btn" '+(admBusRegCurrentPage>=totalPages?'disabled':'')+' onclick="admBusRegGoPage('+(admBusRegCurrentPage+1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>';
  btnsEl.innerHTML=html;
}
function admBusRegGoPage(p){ if(p<1) return; admBusRegCurrentPage=p; admRenderBusRegistryTable(); }

function openBusRegistryModal(id){
  admBusRegEditingId=id||null;
  document.getElementById('admBusRegFormError').style.display='none';
  document.getElementById('admBusRegId').value='';
  document.getElementById('admBusRegCarrier').value='';
  document.getElementById('admBusRegDqn').value='';
  document.getElementById('admBusRegModel').value='';
  if(id){
    var r=admBusRegistryAll.find(function(x){ return x.id===id; });
    document.getElementById('admBusRegModalTitle').textContent='Edit Bus';
    document.getElementById('admBusRegSaveBtn').textContent='Save Changes';
    if(r){
      document.getElementById('admBusRegId').value=r.id;
      document.getElementById('admBusRegCarrier').value=r.carrier;
      document.getElementById('admBusRegDqn').value=r.dqn;
      document.getElementById('admBusRegModel').value=r.model;
    }
  } else {
    document.getElementById('admBusRegModalTitle').textContent='Add Bus';
    document.getElementById('admBusRegSaveBtn').textContent='Save';
  }
  var ov=document.getElementById('admBusRegModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeBusRegistryModal(){
  var ov=document.getElementById('admBusRegModal');
  ov.classList.remove('open'); ov.style.display='none';
  admBusRegEditingId=null;
}
function submitBusRegistryModal(){
  var id=document.getElementById('admBusRegId').value.trim();
  var carrier=document.getElementById('admBusRegCarrier').value.trim();
  var dqn=document.getElementById('admBusRegDqn').value.trim();
  var model=document.getElementById('admBusRegModel').value.trim();
  var errEl=document.getElementById('admBusRegFormError');
  errEl.style.display='none';
  if(!id && !dqn){ errEl.textContent='BUS ID və ya D.Q.N. daxil edin.'; errEl.style.display='block'; return; }

  var btn=document.getElementById('admBusRegSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';
  closeBusRegistryModal();
  admShowProcessing(admBusRegEditingId ? 'Bus yenilənir...' : 'Yeni Bus əlavə olunur...');

  var payload = admBusRegEditingId
    ? { action:'updateBusRegistryEntry', originalId:admBusRegEditingId, data:{id:id, carrier:carrier, dqn:dqn, model:model}, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addBusRegistryEntry', data:{id:id, carrier:carrier, dqn:dqn, model:model}, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    admHideProcessing();
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); loadBusManagementData(); return; }
    loadBusManagementData();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    admHideProcessing();
    alert('Şəbəkə xətası: '+e.message);
    loadBusManagementData();
  });
}
function admDeleteBusRegistry(id){
  admOpenDeleteConfirm('"'+id+'" avtobusunu silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    admShowProcessing('Bus silinir...');
    return admFetch({action:'deleteBusRegistryEntry', id:id, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      admHideProcessing();
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadBusManagementData();
    })
    .catch(function(e){
      admHideProcessing();
      alert('Şəbəkə xətası: '+e.message);
      loadBusManagementData();
    });
  });
}
function admExportBusRegistry(){
  var filtered=admGetFilteredBusRegistry();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ ensureXlsx(function(){ admExportBusRegistry(); }); return; }
  var wsData=[['BUS ID','D.Q.N.','Daşıyıcı','Model']];
  filtered.forEach(function(r){ wsData.push([r.id, r.dqn, r.carrier, r.model]); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BUS Registry');
  var today=new Date();
  XLSX.writeFile(wb, 'BUS_Registry_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

// ── ADMIN: VALIDATOR SN (axtarış-əsaslı, çox-seçimli idarəetmə) ──
var admValSnSearchDebounceTimer = null;
var admValSnSelected = {}; // { "IKB...": true }
var admValSnEditingOld = null;

function admValSnDebouncedSearch(){ clearTimeout(admValSnSearchDebounceTimer); admValSnSearchDebounceTimer=setTimeout(admRenderValSnResults,180); }

function admRenderValSnResults(){
  var q = document.getElementById('admValSnSearch').value.trim();
  var resultsEl = document.getElementById('admValSnResults');
  if(!q){
    resultsEl.innerHTML = '<div class="adm-empty">Axtarış edin (məs: SN-in son rəqəmləri) — nəticələr aşağıda görünəcək</div>';
    return;
  }
  if(!busValidatorSNLoaded){
    resultsEl.innerHTML = '<div class="adm-empty">Siyahı yüklənir, bir az gözləyin...</div>';
    return;
  }
  var qUpper = q.toUpperCase();
  var matches = busValidatorSNList.filter(function(sn){ return sn.toUpperCase().indexOf(qUpper) !== -1; }).slice(0,50);

  if(matches.length===0){
    resultsEl.innerHTML = '<div class="adm-empty">Uyğun SN tapılmadı</div>';
    return;
  }
  resultsEl.innerHTML = matches.map(function(sn){
    var safeSn = sn.replace(/'/g,'');
    var checked = admValSnSelected[sn] ? 'checked' : '';
    return '<div class="adm-reorder-row">'
      + '<input type="checkbox" class="adm-valsn-checkbox" '+checked+' onchange="admValSnToggleSelect(\''+safeSn+'\',this)">'
      + '<span class="adm-valsn-sn">'+escapeHtml(sn)+'</span>'
      + '<button class="adm-icon-btn" onclick="openValidatorSNModal(\''+safeSn+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
      + '<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteValidatorSN(\''+safeSn+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
      + '</div>';
  }).join('') + (busValidatorSNList.filter(function(sn){ return sn.toUpperCase().indexOf(qUpper)!==-1; }).length > 50 ? '<div class="adm-empty">İlk 50 nəticə göstərilir, axtarışı dəqiqləşdirin...</div>' : '');
}

function admValSnToggleSelect(sn, checkboxEl){
  if(checkboxEl.checked) admValSnSelected[sn]=true; else delete admValSnSelected[sn];
  admValSnUpdateBulkBar();
}
function admValSnUpdateBulkBar(){
  var count = Object.keys(admValSnSelected).length;
  var bar = document.getElementById('admValSnBulkBar');
  document.getElementById('admValSnSelectedCount').textContent = count + ' seçildi';
  bar.style.display = count > 0 ? 'flex' : 'none';
}
function admValSnClearSelection(){
  admValSnSelected = {};
  admValSnUpdateBulkBar();
}

function admBulkDeleteValidatorSN(){
  var snList = Object.keys(admValSnSelected);
  if(snList.length===0) return;
  admOpenDeleteConfirm(snList.length+' Validator SN silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return admFetch({action:'bulkDeleteValidatorSN', snList:snList, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admValSnClearSelection();
      preloadValidatorSNList(true);
      setTimeout(admRenderValSnResults, 400);
    });
  });
}

function admDeleteValidatorSN(sn){
  admOpenDeleteConfirm('"'+sn+'" SN-ni silmək istədiyinizə əminsiniz?', function(){
    return admFetch({action:'deleteValidatorSN', sn:sn, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      delete admValSnSelected[sn];
      admValSnUpdateBulkBar();
      preloadValidatorSNList(true);
      setTimeout(admRenderValSnResults, 400);
    });
  });
}

function openValidatorSNModal(oldSn){
  admValSnEditingOld = oldSn || null;
  document.getElementById('admValSnFormError').style.display='none';
  document.getElementById('admValSnValue').value = oldSn || '';
  document.getElementById('admValSnModalTitle').textContent = oldSn ? 'Edit Validator SN' : 'Add Validator SN';
  document.getElementById('admValSnSaveBtn').textContent = oldSn ? 'Save Changes' : 'Save';
  var ov=document.getElementById('admValSnModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeValidatorSNModal(){
  var ov=document.getElementById('admValSnModal');
  ov.classList.remove('open'); ov.style.display='none';
  admValSnEditingOld = null;
}
function submitValidatorSNModal(){
  var val = document.getElementById('admValSnValue').value.trim();
  var errEl = document.getElementById('admValSnFormError');
  errEl.style.display='none';
  if(!val){ errEl.textContent='SN daxil edin.'; errEl.style.display='block'; return; }

  var btn = document.getElementById('admValSnSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admValSnEditingOld
    ? { action:'updateValidatorSN', oldSn:admValSnEditingOld, newSn:val, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addValidatorSN', sn:val, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeValidatorSNModal();
    preloadValidatorSNList(true);
    setTimeout(admRenderValSnResults, 400);
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}

// ── ADMIN: SAM CARD SN (axtarış-əsaslı, çox-seçimli idarəetmə) ──
var admSamSnSearchDebounceTimer = null;
var admSamSnSelected = {};
var admSamSnEditingOld = null;

function admSamSnDebouncedSearch(){ clearTimeout(admSamSnSearchDebounceTimer); admSamSnSearchDebounceTimer=setTimeout(admRenderSamSnResults,180); }

function admRenderSamSnResults(){
  var q = document.getElementById('admSamSnSearch').value.trim();
  var resultsEl = document.getElementById('admSamSnResults');
  if(!q){
    resultsEl.innerHTML = '<div class="adm-empty">Axtarış edin (məs: SN-in son rəqəmləri) — nəticələr aşağıda görünəcək</div>';
    return;
  }
  if(!busValidatorSNLoaded){
    resultsEl.innerHTML = '<div class="adm-empty">Siyahı yüklənir, bir az gözləyin...</div>';
    return;
  }
  var qUpper = q.toUpperCase();
  var matches = busSamCardSNList.filter(function(sn){ return sn.toUpperCase().indexOf(qUpper) !== -1; }).slice(0,50);

  if(matches.length===0){
    resultsEl.innerHTML = '<div class="adm-empty">Uyğun SN tapılmadı</div>';
    return;
  }
  resultsEl.innerHTML = matches.map(function(sn){
    var safeSn = sn.replace(/'/g,'');
    var checked = admSamSnSelected[sn] ? 'checked' : '';
    return '<div class="adm-reorder-row">'
      + '<input type="checkbox" class="adm-valsn-checkbox" '+checked+' onchange="admSamSnToggleSelect(\''+safeSn+'\',this)">'
      + '<span class="adm-valsn-sn">'+escapeHtml(sn)+'</span>'
      + '<button class="adm-icon-btn" onclick="openSamCardSNModal(\''+safeSn+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
      + '<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteSamCardSN(\''+safeSn+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
      + '</div>';
  }).join('') + (busSamCardSNList.filter(function(sn){ return sn.toUpperCase().indexOf(qUpper)!==-1; }).length > 50 ? '<div class="adm-empty">İlk 50 nəticə göstərilir, axtarışı dəqiqləşdirin...</div>' : '');
}

function admSamSnToggleSelect(sn, checkboxEl){
  if(checkboxEl.checked) admSamSnSelected[sn]=true; else delete admSamSnSelected[sn];
  admSamSnUpdateBulkBar();
}
function admSamSnUpdateBulkBar(){
  var count = Object.keys(admSamSnSelected).length;
  var bar = document.getElementById('admSamSnBulkBar');
  document.getElementById('admSamSnSelectedCount').textContent = count + ' seçildi';
  bar.style.display = count > 0 ? 'flex' : 'none';
}
function admSamSnClearSelection(){
  admSamSnSelected = {};
  admSamSnUpdateBulkBar();
}

function admBulkDeleteSamCardSN(){
  var snList = Object.keys(admSamSnSelected);
  if(snList.length===0) return;
  admOpenDeleteConfirm(snList.length+' SAM Card SN silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return admFetch({action:'bulkDeleteSamCardSN', snList:snList, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admSamSnClearSelection();
      preloadValidatorSNList(true);
      setTimeout(admRenderSamSnResults, 400);
    });
  });
}

function admDeleteSamCardSN(sn){
  admOpenDeleteConfirm('"'+sn+'" SN-ni silmək istədiyinizə əminsiniz?', function(){
    return admFetch({action:'deleteSamCardSN', sn:sn, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      delete admSamSnSelected[sn];
      admSamSnUpdateBulkBar();
      preloadValidatorSNList(true);
      setTimeout(admRenderSamSnResults, 400);
    });
  });
}

function openSamCardSNModal(oldSn){
  admSamSnEditingOld = oldSn || null;
  document.getElementById('admSamSnFormError').style.display='none';
  document.getElementById('admSamSnValue').value = oldSn || '';
  document.getElementById('admSamSnModalTitle').textContent = oldSn ? 'Edit SAM Card SN' : 'Add SAM Card SN';
  document.getElementById('admSamSnSaveBtn').textContent = oldSn ? 'Save Changes' : 'Save';
  var ov=document.getElementById('admSamSnModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeSamCardSNModal(){
  var ov=document.getElementById('admSamSnModal');
  ov.classList.remove('open'); ov.style.display='none';
  admSamSnEditingOld = null;
}
function submitSamCardSNModal(){
  var val = document.getElementById('admSamSnValue').value.trim();
  var errEl = document.getElementById('admSamSnFormError');
  errEl.style.display='none';
  if(!val){ errEl.textContent='SN daxil edin.'; errEl.style.display='block'; return; }

  var btn = document.getElementById('admSamSnSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admSamSnEditingOld
    ? { action:'updateSamCardSN', oldSn:admSamSnEditingOld, newSn:val, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addSamCardSN', sn:val, requesterEmail: currentUser?currentUser.email:'' };

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeSamCardSNModal();
    preloadValidatorSNList(true);
    setTimeout(admRenderSamSnResults, 400);
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}

function admGetBusListArray(sheetName){
  if(sheetName==='BUS_PROBLEMS') return admBusProblems;
  if(sheetName==='BUS_SOLUTIONS') return admBusSolutions;
  if(sheetName==='BUS_EQUIPMENT') return admBusEquipment;
  if(sheetName==='BUS_LOCATIONS') return admBusLocations;
  return [];
}
function admRenderBusSimpleList(sheetName, arr){
  var listEl=document.getElementById(ADM_BUS_LIST_MAP[sheetName]);
  var countEl=document.getElementById(ADM_BUS_COUNT_MAP[sheetName]);
  var label=ADM_BUS_SHEET_LABEL[sheetName]||'Element';
  if(countEl) countEl.textContent=arr.length+' '+label;
  if(!listEl) return;
  if(arr.length===0){ listEl.innerHTML='<div class="adm-empty">Siyahı boşdur</div>'; return; }
  var isSolutions=(sheetName==='BUS_SOLUTIONS');
  var OWNER_COLORS={ 'AYNA':'#2F6FED', 'BakıKart':'#D97706', 'AYNA və BakıKart':'#8B5CF6' };
  listEl.innerHTML=arr.map(function(val, idx){
    var safeVal=val.replace(/'/g,'');
    var ownerBadge='';
    var categoryBadge='';
    if(isSolutions){
      var owner=admBusSolutionOwners[val]||'';
      var c=OWNER_COLORS[owner]||'#8CA0BC';
      ownerBadge='<span class="adm-owner-badge" style="background:'+c+'18;color:'+c+';border:1px solid '+c+'44;">'+(owner?escapeHtml(owner):'Owner yoxdur')+'</span>';
      var category=admBusSolutionCategories[val]||'';
      categoryBadge='<span class="adm-owner-badge" style="background:#5C708918;color:#5C7089;border:1px solid #5C708944;">'+(category?escapeHtml(category):'Kateqoriya yoxdur')+'</span>';
    }
    return '<div class="adm-reorder-row">'
      +'<span class="adm-reorder-num">'+(idx+1)+'</span>'
      +'<span class="adm-reorder-text">'+escapeHtml(val)+'</span>'
      +ownerBadge
      +categoryBadge
      +'<div class="adm-reorder-arrows">'
      +'<button class="adm-reorder-arrow" '+(idx===0?'disabled':'')+' onclick="admMoveBusListItem(\''+sheetName+'\',\''+safeVal+'\',\'up\')" aria-label="Yuxarı"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg></button>'
      +'<button class="adm-reorder-arrow" '+(idx===arr.length-1?'disabled':'')+' onclick="admMoveBusListItem(\''+sheetName+'\',\''+safeVal+'\',\'down\')" aria-label="Aşağı"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg></button>'
      +'</div>'
      +'<button class="adm-icon-btn" onclick="openBusListModal(\''+sheetName+'\',\''+safeVal+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
      +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteBusListItem(\''+sheetName+'\',\''+safeVal+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
      +'</div>';
  }).join('');
}
function admReloadBusListSource(sheetName){
  if(typeof loadBusManagementData==='function') loadBusManagementData();
}
function admMoveBusListItem(sheetName, value, direction){
  var action = (sheetName==='BUS_SOLUTIONS') ? 'moveBusSolutionWithOwner' : 'moveBusListItem';
  var payload = (sheetName==='BUS_SOLUTIONS')
    ? { action:action, solution:value, direction:direction, requesterEmail: currentUser?currentUser.email:'' }
    : { action:action, sheetName:sheetName, value:value, direction:direction, requesterEmail: currentUser?currentUser.email:'' };
  admShowProcessing('Sıra dəyişdirilir...');
  admFetch(payload)
  .then(function(d){
    admHideProcessing();
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
    admReloadBusListSource(sheetName);
  })
  .catch(function(e){ admHideProcessing(); alert('Şəbəkə xətası: '+e.message); });
}
function openBusListModal(sheetName, oldValue){
  admBusListEditingSheet=sheetName;
  admBusListEditingValue=oldValue||null;
  document.getElementById('admBusListFormError').style.display='none';
  var label=ADM_BUS_SHEET_LABEL[sheetName]||'Dəyər';
  document.getElementById('admBusListModalTitle').textContent=(oldValue?'Edit ':'Add ')+label;
  document.getElementById('admBusListFieldLabel').textContent=label+' *';
  document.getElementById('admBusListValue').placeholder=label+' daxil edin';
  document.getElementById('admBusListValue').value=oldValue||'';
  document.getElementById('admBusListSaveBtn').textContent=oldValue?'Save Changes':'Save';
  var ownerWrap=document.getElementById('admBusListOwnerWrap');
  var categoryWrap=document.getElementById('admBusListCategoryWrap');
  if(sheetName==='BUS_SOLUTIONS'){
    ownerWrap.style.display='block';
    document.getElementById('admBusListOwner').value=oldValue?(admBusSolutionOwners[oldValue]||''):'';
    categoryWrap.style.display='block';
    var catSel=document.getElementById('admBusListCategory');
    catSel.innerHTML='<option value="">Seçin</option>'+admBusEquipment.map(function(eq){
      return '<option value="'+escapeHtml(eq)+'">'+escapeHtml(eq)+'</option>';
    }).join('');
    catSel.value=oldValue?(admBusSolutionCategories[oldValue]||''):'';
  } else {
    ownerWrap.style.display='none';
    categoryWrap.style.display='none';
  }
  var ov=document.getElementById('admBusListModal');
  ov.style.display='flex'; ov.classList.add('open');
}
function closeBusListModal(){
  var ov=document.getElementById('admBusListModal');
  ov.classList.remove('open'); ov.style.display='none';
  admBusListEditingSheet=null; admBusListEditingValue=null;
}
function submitBusListModal(){
  var value=document.getElementById('admBusListValue').value.trim();
  var errEl=document.getElementById('admBusListFormError');
  errEl.style.display='none';
  if(!value){ errEl.textContent='Boş dəyər saxlanıla bilməz.'; errEl.style.display='block'; return; }

  var isSolutions=(admBusListEditingSheet==='BUS_SOLUTIONS');
  var ownerVal='', categoryVal='';
  if(isSolutions){
    ownerVal=document.getElementById('admBusListOwner').value;
    if(!ownerVal){ errEl.textContent='Problem Owner seçilməlidir.'; errEl.style.display='block'; return; }
    categoryVal=document.getElementById('admBusListCategory').value;
    if(!categoryVal){ errEl.textContent='Servis Kateqoriyası seçilməlidir.'; errEl.style.display='block'; return; }
  }

  var btn=document.getElementById('admBusListSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';
  var sheetForReload=admBusListEditingSheet;
  closeBusListModal();
  admShowProcessing(admBusListEditingValue ? 'Dəyər yenilənir...' : 'Yeni dəyər əlavə olunur...');

  var payload;
  if(isSolutions){
    payload = admBusListEditingValue
      ? { action:'updateBusSolutionWithOwner', oldSolution:admBusListEditingValue, newSolution:value, newOwner:ownerVal, newCategory:categoryVal, requesterEmail: currentUser?currentUser.email:'' }
      : { action:'addBusSolutionWithOwner', solution:value, owner:ownerVal, category:categoryVal, requesterEmail: currentUser?currentUser.email:'' };
  } else {
    payload = admBusListEditingValue
      ? { action:'updateBusListItem', sheetName:sheetForReload, oldValue:admBusListEditingValue, newValue:value, requesterEmail: currentUser?currentUser.email:'' }
      : { action:'addBusListItem', sheetName:sheetForReload, value:value, requesterEmail: currentUser?currentUser.email:'' };
  }

  admFetch(payload)
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    admHideProcessing();
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); admReloadBusListSource(sheetForReload); return; }
    admReloadBusListSource(sheetForReload);
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    admHideProcessing();
    alert('Şəbəkə xətası: '+e.message);
    admReloadBusListSource(sheetForReload);
  });
}
function admDeleteBusListItem(sheetName, value){
  var label=ADM_BUS_SHEET_LABEL[sheetName]||'dəyəri';
  admOpenDeleteConfirm('"'+value+'" '+label+'ni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    admShowProcessing('Silinir...');
    return admFetch({action:'deleteBusListItem', sheetName:sheetName, value:value, requesterEmail: currentUser?currentUser.email:''})
    .then(function(d){
      admHideProcessing();
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admReloadBusListSource(sheetName);
    })
    .catch(function(e){
      admHideProcessing();
      alert('Şəbəkə xətası: '+e.message);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// COLLECTIVES — Kollektiv haqqında məlumat
// ═══════════════════════════════════════════════════════════════

function openCollectives() {
  if (window.innerWidth < 901) return;
  var overlay = document.getElementById('collectivesView');
  overlay.style.display = 'flex';
  if (currentUser) {
    var nameEl = document.getElementById('clProfileName');
    var roleEl = document.getElementById('clProfileRole');
    if (nameEl) nameEl.textContent = currentUser.name || '—';
    if (roleEl) roleEl.textContent = currentUser.role || '—';
  }
  var loader = document.getElementById('collectivesLoader');
  var content = document.getElementById('collectivesContent');
  loader.style.display = 'flex';
  content.style.display = 'none';
  admFetch({ action: 'getCollectivesData' })
  .then(function(d) {
    if (d.status !== 'OK') {
      alert('Xəta: ' + (d.message || 'Məlumat yüklənə bilmədi'));
      closeCollectives();
      return;
    }
    setTimeout(function() {
  loader.style.display = 'none';
  content.style.display = 'block';
  var grid = document.getElementById('collectivesGrid');
  var director = document.getElementById('collectivesDirector');
  if(grid) grid.innerHTML = '';
  if(director) director.innerHTML = '';
  renderCollectives(d.employees, d.groupOrder, d.groupIcons);
}, 2000);
  })
  .catch(function(e) {
    alert('Şəbəkə xətası: ' + e.message);
    closeCollectives();
  });
}

function closeCollectives() {
  document.getElementById('collectivesView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'block';
}
function renderCollectives(employees, groupOrder, groupIcons) {
  var director = document.getElementById('collectivesDirector');
  var grid = document.getElementById('collectivesGrid');
  if (!director || !grid) return;
  director.innerHTML = '';
  grid.innerHTML = '';

  var directorEmployee = (employees || []).find(function(e) { return e.group === 'Direktor'; });
  if (directorEmployee) {
    var dc = document.createElement('div');
    dc.className = 'cl-director-card';
    dc.innerHTML = '<div class="cl-director-row"><div class="cl-director-avatar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div><div class="cl-director-label">Direktor</div><div class="cl-director-name">' + escapeHtml(directorEmployee.name || '') + '</div></div></div>';
    director.appendChild(dc);
  }

  var groups = {};
  (employees || []).forEach(function(emp) {
    if (emp.group === 'Direktor') return;
    if (!groups[emp.group]) groups[emp.group] = [];
    groups[emp.group].push(emp);
  });

  var order = groupOrder || Object.keys(groups);
  order.forEach(function(groupName) {
    if (!groups[groupName] || groups[groupName].length === 0) return;
    var card = document.createElement('div');
    card.className = 'cl-card';
    var header = document.createElement('div');
    header.className = 'cl-header';
    var iconWrap = document.createElement('div');
    iconWrap.className = 'cl-icon';
    iconWrap.style.background = '#EAF1FE';
    iconWrap.style.color = '#2F6FED';
    iconWrap.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>';
    var titleEl = document.createElement('div');
    titleEl.className = 'cl-title';
    titleEl.textContent = groupName;
    var badge = document.createElement('div');
    badge.className = 'cl-badge';
    badge.textContent = groups[groupName].length + ' nəfər';
    header.appendChild(iconWrap);
    header.appendChild(titleEl);
    header.appendChild(badge);
    card.appendChild(header);
    var list = document.createElement('div');
    list.className = 'cl-list';
    groups[groupName].forEach(function(emp) {
      var row = document.createElement('div');
      row.className = 'cl-row';
      var colors = ['#E6F1FB','#E8F5F0','#FEF3E2','#F3E8FE','#FFE8E8'];
      var ci = (emp.name||'').charCodeAt(0) % colors.length;
      var avatar = document.createElement('div');
      avatar.className = 'cl-avatar';
      avatar.textContent = (emp.name || '?')[0].toUpperCase();
      avatar.style.background = colors[ci];
      avatar.style.color = '#1B4A8A';
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:13.5px;font-weight:600;color:#12233B;';
      nameEl.textContent = emp.name || '';
      var subtitleEl = document.createElement('div');
      subtitleEl.style.cssText = 'font-size:11.5px;color:#5C7089;margin-top:1px;';
      subtitleEl.textContent = emp.title || emp.group || '';
      info.appendChild(nameEl);
      info.appendChild(subtitleEl);
      row.appendChild(avatar);
      row.appendChild(info);
      list.appendChild(row);
    });
    card.appendChild(list);
    grid.appendChild(card);
  });
}
// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL: COLLECTIVES MANAGEMENT
// ═══════════════════════════════════════════════════════════════

var admCollectivesAll = [];
var admCollectivesEditingName = null;
var admClCurrentPage = 1, admClPageSize = 7;
var admClSearchDebounceTimer = null;

function loadAdminCollectives() {
  var body = document.getElementById('admClTableBody');
  if (body) body.innerHTML = '<tr><td colspan="4"><div class="adm-empty">Yüklənir...</div></td></tr>';

  admFetch({ action: 'getCollectivesAdminData', requesterEmail: currentUser ? currentUser.email : '' })
  .then(function(d) {
    if (d.status !== 'OK') {
      if (body) body.innerHTML = '<tr><td colspan="4"><div class="adm-empty">Xəta: ' + escapeHtml(d.message || '') + '</div></td></tr>';
      return;
    }
    admCollectivesAll = d.employees || [];

    // Statistika — heç bir sərt uyğunlaşdırmaya bağlı deyil, ona görə həmişə düzgün göstərir
    var elT = document.getElementById('admClStatTotal'); if (elT) elT.textContent = admCollectivesAll.length;
    var groupCounts = {};
    admCollectivesAll.forEach(function(emp) {
      var g = (emp.group || 'Digər').trim();
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });
    var elC = document.getElementById('admClStatCategories'); if (elC) elC.textContent = Object.keys(groupCounts).length;
    var largestName = '—', largestCount = 0;
    Object.keys(groupCounts).forEach(function(g) { if (groupCounts[g] > largestCount) { largestCount = groupCounts[g]; largestName = g; } });
    var elL = document.getElementById('admClStatLargest'); if (elL) elL.textContent = largestCount || '0';
    var elLN = document.getElementById('admClStatLargestName'); if (elLN) elLN.textContent = largestName;

    admClCurrentPage = 1;
    admRenderCollectivesTable();
  })
  .catch(function(e) {
    if (body) body.innerHTML = '<tr><td colspan="4"><div class="adm-empty">Şəbəkə xətası: ' + escapeHtml(e.message) + '</div></td></tr>';
  });
}

function admClDebouncedRender(){ clearTimeout(admClSearchDebounceTimer); admClSearchDebounceTimer=setTimeout(function(){ admClCurrentPage=1; admRenderCollectivesTable(); },180); }

function admGetFilteredCollectives(){
  var q=(document.getElementById('admClSearch').value||'').toLowerCase().trim();
  var groupF=document.getElementById('admClGroupFilter').value;
  return admCollectivesAll.filter(function(emp){
    if(q && emp.name.toLowerCase().indexOf(q)===-1 && (emp.title||'').toLowerCase().indexOf(q)===-1) return false;
    if(groupF && (emp.group||'').trim().toLowerCase()!==groupF.trim().toLowerCase()) return false;
    return true;
  });
}

function admRenderCollectivesTable(){
  var filtered=admGetFilteredCollectives();
  var totalPages=Math.max(1, Math.ceil(filtered.length/admClPageSize));
  if(admClCurrentPage>totalPages) admClCurrentPage=totalPages;
  var startIdx=(admClCurrentPage-1)*admClPageSize;
  var visible=filtered.slice(startIdx, startIdx+admClPageSize);

  var body=document.getElementById('admClTableBody');
  if(visible.length===0){
    body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Əməkdaş tapılmadı</div></td></tr>';
  } else {
    body.innerHTML=visible.map(function(emp){
      var safeName=emp.name.replace(/'/g,'');
      return '<tr>'
        +'<td><div class="adm-name-cell"><span class="adm-avatar">'+escapeHtml(admInitials(emp.name))+'</span>'+escapeHtml(emp.name)+'</div></td>'
        +'<td>'+escapeHtml(emp.title||'—')+'</td>'
        +'<td>'+escapeHtml(emp.group||'—')+'</td>'
        +'<td class="adm-th-act">'
        +'<button class="adm-icon-btn" onclick="openCollectiveEditModal(\''+safeName+'\')" aria-label="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>'
        +'<button class="adm-icon-btn adm-icon-btn-danger" onclick="admDeleteCollectiveMember(\''+safeName+'\')" aria-label="Sil"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>'
        +'</td></tr>';
    }).join('');
  }

  var infoEl=document.getElementById('admClPageInfo');
  if(filtered.length===0){ infoEl.textContent='Showing 0 entries'; }
  else { infoEl.textContent='Showing '+(startIdx+1)+' to '+Math.min(startIdx+admClPageSize,filtered.length)+' of '+filtered.length+' entries'; }

  var btnsEl=document.getElementById('admClPageBtns');
  var html='';
  html+='<button class="adm-page-btn" '+(admClCurrentPage<=1?'disabled':'')+' onclick="admClGoPage('+(admClCurrentPage-1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>';
  var startPage=Math.max(1, admClCurrentPage-1), endPage=Math.min(totalPages, startPage+3);
  startPage=Math.max(1, endPage-3);
  for(var p=startPage; p<=endPage; p++){
    html+='<button class="adm-page-btn'+(p===admClCurrentPage?' adm-page-btn-active':'')+'" onclick="admClGoPage('+p+')">'+p+'</button>';
  }
  html+='<button class="adm-page-btn" '+(admClCurrentPage>=totalPages?'disabled':'')+' onclick="admClGoPage('+(admClCurrentPage+1)+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>';
  btnsEl.innerHTML=html;
}
function admClGoPage(p){ if(p<1) return; admClCurrentPage=p; admRenderCollectivesTable(); }

function admExportCollectives(){
  var filtered=admGetFilteredCollectives();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ ensureXlsx(function(){ admExportCollectives(); }); return; }
  var wsData=[['Full Name','Vəzifə','Qrup']];
  filtered.forEach(function(emp){ wsData.push([emp.name, emp.title, emp.group]); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Collectives');
  var today=new Date();
  XLSX.writeFile(wb, 'Collectives_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
}

function openCollectiveAddModal() {
  document.getElementById('admCollectiveFormError').style.display = 'none';
  document.getElementById('admCollectiveName').value = '';
  document.getElementById('admCollectiveTitle').value = '';
  document.getElementById('admCollectiveGroup').value = '';
  document.getElementById('admCollectiveModalTitle').textContent = 'Add Member';
  document.getElementById('admCollectiveSaveBtn').textContent = 'Save';
  admCollectivesEditingName = null;
  document.getElementById('admCollectiveModal').style.display = 'flex';
  document.getElementById('admCollectiveModal').classList.add('open');
}

function openCollectiveEditModal(name) {
  var emp = admCollectivesAll.find(function(e) { return e.name === name; });
  if (!emp) return;

  document.getElementById('admCollectiveFormError').style.display = 'none';
  document.getElementById('admCollectiveName').value = emp.name;
  document.getElementById('admCollectiveTitle').value = emp.title;
  document.getElementById('admCollectiveGroup').value = emp.group;
  document.getElementById('admCollectiveModalTitle').textContent = 'Edit Member';
  document.getElementById('admCollectiveSaveBtn').textContent = 'Save Changes';
  admCollectivesEditingName = name;
  document.getElementById('admCollectiveModal').style.display = 'flex';
  document.getElementById('admCollectiveModal').classList.add('open');
}

function closeCollectiveModal() {
  var ov = document.getElementById('admCollectiveModal');
  ov.classList.remove('open');
  ov.style.display = 'none';
  admCollectivesEditingName = null;
}

function submitCollectiveModal() {
  var name = document.getElementById('admCollectiveName').value.trim();
  var title = document.getElementById('admCollectiveTitle').value.trim();
  var group = document.getElementById('admCollectiveGroup').value;
  var errEl = document.getElementById('admCollectiveFormError');
  errEl.style.display = 'none';

  if (!name || !title || !group) {
    errEl.textContent = 'Ad, Vəzifə və Qrup sahələrini doldurun.';
    errEl.style.display = 'block';
    return;
  }

  var btn = document.getElementById('admCollectiveSaveBtn');
  btn.disabled = true;
  var origText = btn.textContent;
  btn.textContent = 'Saving...';

  var payload = admCollectivesEditingName
    ? { action: 'updateCollectiveMember', oldName: admCollectivesEditingName, data: { name: name, title: title, group: group }, requesterEmail: currentUser ? currentUser.email : '' }
    : { action: 'addCollectiveMember', data: { name: name, title: title, group: group }, requesterEmail: currentUser ? currentUser.email : '' };

  admFetch(payload)
  .then(function(d) {
    btn.disabled = false;
    btn.textContent = origText;
    if (d.status !== 'OK') {
      errEl.textContent = d.message || 'Xəta baş verdi';
      errEl.style.display = 'block';
      return;
    }
    closeCollectiveModal();
    loadAdminCollectives();
  })
  .catch(function(e) {
    btn.disabled = false;
    btn.textContent = origText;
    errEl.textContent = 'Şəbəkə xətası: ' + e.message;
    errEl.style.display = 'block';
  });
}

function admDeleteCollectiveMember(name) {
  admOpenDeleteConfirm('"' + name + '" əməkdaşını silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function() {
    return admFetch({ action: 'deleteCollectiveMember', name: name, requesterEmail: currentUser ? currentUser.email : '' })
    .then(function(d) {
      if (d.status !== 'OK') {
        alert(d.message || 'Xəta baş verdi');
        return;
      }
      loadAdminCollectives();
    });
  });
}

// ── TELEGRAM TEMPLATES ───────────────────────────────
function loadTelegramTemplates(){
  var wrap=document.getElementById('admTgTemplatesList');
  wrap.innerHTML='<div class="adm-empty">Yüklənir...</div>';
  admFetch({action:'getTelegramTemplates', requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){ wrap.innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    wrap.innerHTML=(d.templates||[]).map(function(t){
      var safeKey=t.key.replace(/'/g,'');
      return '<div class="adm-tg-card">'
        +'<div class="adm-tg-card-head">'
        +'<div class="adm-tg-card-title">'+escapeHtml(t.label)+'</div>'
        +'<label class="adm-guest-check"><input type="checkbox" id="admTg_active_'+safeKey+'" '+(t.active?'checked':'')+'><span>Aktiv</span></label>'
        +'</div>'
        +'<textarea class="adm-tg-textarea" id="admTg_text_'+safeKey+'" rows="6">'+escapeHtml(t.template)+'</textarea>'
        +'<button class="adm-modal-save" style="margin-top:10px;" onclick="saveTelegramTemplate(\''+safeKey+'\')">Saxla</button>'
        +'</div>';
    }).join('');
  })
  .catch(function(e){ wrap.innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>'; });
}

function saveTelegramTemplate(key){
  var textEl=document.getElementById('admTg_text_'+key);
  var activeEl=document.getElementById('admTg_active_'+key);
  var template=textEl.value;
  var active=activeEl.checked;

  admFetch({action:'updateTelegramTemplate', key:key, template:template, active:active, requesterEmail: currentUser?currentUser.email:''})
  .then(function(d){
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
    alert('Şablon saxlanıldı');
  })
  .catch(function(e){ alert('Şəbəkə xətası: '+e.message); });
}
