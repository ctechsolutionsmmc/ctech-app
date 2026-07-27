var API_URL = "https://script.google.com/macros/s/AKfycbytFqFdrsHqKrD2YnurKsXATyjAMLbFAtV3gEcLxmPF_DjfGk2A9yyBrhs7XgoM-uYcbw/exec";
var currentUser = null;
var SESSION_KEY = "ctech_session";
var SESSION_DAYS = 14;

function saveSession(u){ try{ localStorage.setItem(SESSION_KEY, JSON.stringify({user:u, expires:Date.now()+(SESSION_DAYS*86400000)})); }catch(e){} }
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }
function loadSession(){ try{ var r=localStorage.getItem(SESSION_KEY); if(!r)return null; var d=JSON.parse(r); if(Date.now()>d.expires){clearSession();return null;} return d.user; }catch(e){return null;} }

var clockStarted = false;

function togglePassword(){
  var pw=document.getElementById('password');
  var icon=document.getElementById('eyeIcon');
  if(pw.type==='password'){ pw.type='text'; icon.innerHTML='<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.9 19.9 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>'; }
  else { pw.type='password'; icon.innerHTML='<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'; }
}

function showLoading(){ var ov=document.getElementById('loadingOverlay'); if(ov){ ov.style.display='flex'; ov.classList.add('open'); } document.getElementById('loadingSpinner').style.display='block'; document.getElementById('successIcon').classList.remove('show'); document.getElementById('failIcon').classList.remove('show'); document.getElementById('loadingText').innerHTML='Yoxlanılır...'; }
function showLoadingSuccess(cb){ document.getElementById('loadingSpinner').style.display='none'; document.getElementById('successIcon').classList.add('show'); document.getElementById('loadingText').innerHTML='Uğurlu!'; setTimeout(function(){ var ov2=document.getElementById('loadingOverlay'); if(ov2){ ov2.classList.remove('open'); ov2.style.display='none'; } cb(); }, 700); }
function showLoadingFail(msg){ document.getElementById('loadingSpinner').style.display='none'; document.getElementById('failIcon').classList.add('show'); document.getElementById('loadingText').innerHTML='Uğursuz'; setTimeout(function(){ document.getElementById('loadingOverlay').classList.remove('open'); var btn=document.getElementById('loginBtn'); btn.disabled=false; btn.innerHTML='Daxil ol'; alert(msg); }, 700); }

function login(){
  var email=document.getElementById('email').value;
  var password=document.getElementById('password').value;
  var btn=document.getElementById('loginBtn');
  if(!email){ alert('Email daxil edin'); return; }
  if(!password){ alert('Şifrəni daxil edin'); return; }
  btn.disabled=true; btn.innerHTML='Yoxlanılır...'; showLoading();
  fetch(API_URL,{ method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'checkUser',email:email,password:password}) })
  .then(function(r){return r.json();})
  .then(function(result){
    if(result.status==='OK'){ currentUser=result; if(document.getElementById('rememberMe').checked){saveSession(result);}else{clearSession();} showLoadingSuccess(function(){showDashboard();}); }
    else if(result.status==='WRONG_PASSWORD'){ showLoadingFail('Şifrə yanlışdır'); }
    else { showLoadingFail(result.debug?'DENIED\n\n'+result.debug:'Bu hesab üçün giriş icazəsi yoxdur'); }
  })
  .catch(function(e){ showLoadingFail('XƏTA: '+e.message); });
}

document.getElementById('password').addEventListener('keydown',function(e){ if(e.key==='Enter'){login();} });

var notifPollingStarted = false;
function showDashboard(){
  document.getElementById('loginView').style.display='none';
  document.getElementById('busServiceView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
  document.getElementById('welcomeName').innerHTML='Xoş gəlmisiniz';
  document.getElementById('profileName').textContent=currentUser.name;
  document.getElementById('profileRole').textContent=currentUser.role;
  // Yeni masaüstü dizaynının (ctd-) elementləri
  var ctdWelcomeName=document.getElementById('ctdWelcomeName');
  if(ctdWelcomeName) ctdWelcomeName.textContent=(currentUser.name||'').split(' ')[0]||currentUser.name||'';
  var ctdUserName=document.getElementById('ctdUserName');
  if(ctdUserName) ctdUserName.textContent=currentUser.name||'';
  var ctdUserRole=document.getElementById('ctdUserRole');
  if(ctdUserRole) ctdUserRole.textContent=currentUser.role||'';
  var ctdAvatarInitials=document.getElementById('ctdAvatarInitials');
  if(ctdAvatarInitials){
    var nameParts=(currentUser.name||'').trim().split(/\s+/);
    var initials=(nameParts[0]?nameParts[0][0]:'')+(nameParts[1]?nameParts[1][0]:'');
    ctdAvatarInitials.textContent=(initials||'--').toUpperCase();
  }
  applyAccessLevel();
  if(typeof updateCollectivesBtnVisibility==='function') updateCollectivesBtnVisibility();
  if(typeof preloadValidatorSNList==='function') preloadValidatorSNList();
  if(typeof preloadNotifications==='function') preloadNotifications();
  if(typeof loadHomeDashStats==='function') loadHomeDashStats();
  if(!notifPollingStarted){
    notifPollingStarted = true;
    // Arxa planda sakit yenilənmə — istifadəçiyə heç bir görünən reload/flicker olmadan,
    // database-dəki dəyişiklikləri (yeni/silinmiş bildirişlər) tutur.
    setInterval(function(){
      if(typeof preloadNotifications==='function') preloadNotifications();
    }, 120000);
  }
  if(!clockStarted){ clockStarted=true; updateClock(); setInterval(updateClock,1000); }
}

function getAccessLevel(role){ var r=(role||'').toLowerCase(); if(r.indexOf('admin')!==-1)return'admin'; if(r.indexOf('team')!==-1||r.indexOf('leader')!==-1||r.indexOf('rəhbər')!==-1)return'leader'; return'technician'; }

function applyAccessLevel(){
  var level=getAccessLevel(currentUser.role);
  document.getElementById('dashboardsSection').style.display=(level==='technician')?'none':'block';
  document.getElementById('reportsSection').style.display='block';
  document.getElementById('adminMenuItem').style.display=(level==='admin')?'flex':'none';
  var brBtn=document.getElementById('busRequestQuickBtn');
  var isLeaderOrAdmin=(level==='leader'||level==='admin');
  if(brBtn){
    var showBr=isLeaderOrAdmin && window.innerWidth>=901;
    brBtn.style.display = showBr ? 'inline-flex' : 'none';
    if(showBr && typeof brLoadAssignableTechnicians==='function') brLoadAssignableTechnicians();
  }
  // Yeni desktop dizaynının (ctd-) admin/rəhbər görünürlük düymələri
  var ctdCollectivesBtn=document.getElementById('ctdCollectivesBtn');
  var ctdAdminBtn=document.getElementById('ctdAdminBtn');
  if(ctdAdminBtn) ctdAdminBtn.style.display=(level==='admin')?'flex':'none';
  var ctdBrBtn=document.getElementById('ctdBrBtn');
  if(ctdBrBtn){
    ctdBrBtn.style.display=isLeaderOrAdmin?'flex':'none';
    if(isLeaderOrAdmin && window.innerWidth>=901 && typeof brLoadAssignableTechnicians==='function') brLoadAssignableTechnicians();
  }
  var ctdBulkBtn=document.getElementById('ctdBulkBtn');
  if(ctdBulkBtn) ctdBulkBtn.style.display=isLeaderOrAdmin?'flex':'none';
}

var _dotVisible=true;
function updateClock(){
  var now=new Date();
  var parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
  var map={}; parts.forEach(function(p){map[p.type]=p.value;});
  document.getElementById('clockDate').innerHTML=map.day+'.'+map.month+'.'+map.year;
  document.getElementById('clock').innerHTML=map.hour+':'+map.minute;
  var ctdClockText=document.getElementById('ctdClockText');
  if(ctdClockText) ctdClockText.textContent=map.day+'.'+map.month+'.'+map.year+' · '+map.hour+':'+map.minute;
  _dotVisible=!_dotVisible;
  var dot=document.querySelector('.status-dot'); if(dot) dot.style.opacity=_dotVisible?'1':'0';
  var ctdDot=document.querySelector('.ctd-clock-pill .dot'); if(ctdDot) ctdDot.style.opacity=_dotVisible?'1':'0';
}

function goHome(){ document.getElementById('loginView').style.display='none'; document.getElementById('busServiceView').style.display='none'; document.getElementById('dashboardView').style.display='block'; closeMenu(); }
function toggleMenu(){ document.getElementById('menuPanel').classList.toggle('open'); }
function closeMenu(){ document.getElementById('menuPanel').classList.remove('open'); }

// ═══════════════════════════════════════════════════
// ADMIN PANEL (yalnız veb versiya — vizual qat, arxa plan yoxdur)
// ═══════════════════════════════════════════════════
function openAdminPanel(){
  closeMenu();
  if(window.innerWidth < 901){ return; }
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
}

function closeAdminPanel(){
  document.getElementById('adminPanelView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}

function switchAdminSection(key, btn){
  document.querySelectorAll('.adm-nav-item').forEach(function(el){ el.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.adm-section').forEach(function(el){ el.style.display='none'; });
  var target=document.getElementById('admSection-'+key);
  if(target) target.style.display='block';
  
  if(key==='users' && typeof loadAdminUsers==='function') loadAdminUsers();
  if(key==='tvm' && typeof loadTvmManagementData==='function') loadTvmManagementData();
  if(key==='tech' && typeof loadAdminTechnicians==='function') loadAdminTechnicians();
  if(key==='leaders' && typeof loadAdminLeaders==='function') loadAdminLeaders();
  if(key==='collectives' && typeof loadAdminCollectives==='function') loadAdminCollectives();
  if(key==='messages' && typeof loadAdminMessages==='function') loadAdminMessages();
  if(key==='homedash' && typeof loadAdminHomeDashboard==='function') loadAdminHomeDashboard();

  // BUS Management
  if(key==='bus' && typeof loadBusManagementData==='function') loadBusManagementData();
}

document.addEventListener('click',function(e){ var panel=document.getElementById('menuPanel'); if(!panel)return; if(!panel.contains(e.target)&&!e.target.closest('.icon-btn'))closeMenu(); });

// ── USER MANAGEMENT ─────────────────────────────────
var admUsersAllRows=[], admUsersLoaded=false, admUsrCurrentPage=1, admUsrPageSize=7, admUsrEditingId=null, admUsrDeletingId=null;
var admUsersSearchDebounceTimer=null;
function admUsersDebouncedRender(){ clearTimeout(admUsersSearchDebounceTimer); admUsersSearchDebounceTimer=setTimeout(function(){ admUsrCurrentPage=1; admRenderUsersTable(); },180); }

function loadAdminUsers(){
  var body=document.getElementById('admUsrTableBody');
  if(body) body.innerHTML='<tr><td colspan="5"><div class="adm-empty">Yüklənir...</div></td></tr>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getUsersData', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
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
  if(r.indexOf('leader')!==-1||r.indexOf('rəhbər')!==-1) return 'adm-pill-purple';
  if(r.indexOf('technician')!==-1||r.indexOf('texnik')!==-1) return 'adm-pill-green';
  return 'adm-pill-blue';
}
function admRoleCategory(role){
  var r=(role||'').toLowerCase();
  if(r.indexOf('admin')!==-1) return 'admin';
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
      return '<tr>'
        +'<td><div class="adm-name-cell"><span class="adm-avatar">'+escapeHtml(admInitials(u.fullName))+'</span>'+escapeHtml(u.fullName)+'</div></td>'
        +'<td>'+escapeHtml(u.email)+'</td>'
        +'<td><span class="adm-pill '+admRoleClass(u.role)+'">'+escapeHtml(u.role||'—')+'</span></td>'
        +'<td><span class="adm-status '+(isActive?'adm-status-active':'adm-status-inactive')+'">'+escapeHtml(u.status||'—')+'</span></td>'
        +'<td class="adm-th-act">'
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
  var opts=['Admin','Group Leader','Technician','User'];
  var cat=admRoleCategory(role);
  if(cat==='admin') return 'Admin';
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

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
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
function admOpenDeleteConfirm(text, actionFn){
  admDeleteConfirmAction=actionFn;
  document.getElementById('admDeleteText').textContent=text;
  var ov=document.getElementById('admDeleteConfirm');
  ov.style.display='flex'; ov.classList.add('open');
}
function openDeleteConfirm(userId, name){
  admOpenDeleteConfirm('"'+name+'" istifadəçisini silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteUser', userId:userId, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadAdminUsers();
    });
  });
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
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
  var cols=['Full Name','Email','Role','Status'];
  var wsData=[cols];
  filtered.forEach(function(u){ wsData.push([u.fullName, u.email, u.role, u.status]); });
  var ws=XLSX.utils.aoa_to_sheet(wsData);
  var wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  var today=new Date();
  XLSX.writeFile(wb, 'Users_'+String(today.getDate()).padStart(2,'0')+'.'+String(today.getMonth()+1).padStart(2,'0')+'.'+today.getFullYear()+'.xlsx');
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
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTvmManagementData', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
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

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteTvmRegistryEntry', id:id, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadTvmManagementData();
    });
  });
}
function admExportTvmRegistry(){
  var filtered=admGetFilteredTvmRegistry();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
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
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'moveTvmListItem', sheetName:sheetName, value:value, direction:direction, requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
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

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteTvmListItem', sheetName:sheetName, value:value, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admReloadListSource(sheetName);
    });
  });
}
function showAbout(){ closeMenu(); document.getElementById('aboutModal').classList.add('open'); }
function toggleUserMenu(){ var dd=document.getElementById('ctdUserDropdown'); if(!dd)return; dd.classList.toggle('open'); }
document.addEventListener('click',function(e){ var chip=document.getElementById('ctdUserChip'); var dd=document.getElementById('ctdUserDropdown'); if(!dd||!chip)return; if(!chip.contains(e.target))dd.classList.remove('open'); });

// ── TECHNICIANS / GROUP LEADERS (əsas admin bölmələri) ──
function loadAdminTechnicians(){
  var listEl=document.getElementById('admTechList');
  if(listEl) listEl.innerHTML='<div class="adm-empty">Yüklənir...</div>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getAdminListData', sheetName:'TECHNICALS', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
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
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getAdminListData', sheetName:'TEAM_LEADERS', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ if(listEl) listEl.innerHTML='<div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div>'; return; }
    admLeadersAll=d.items||[];
    admRenderTvmSimpleList('TEAM_LEADERS', admLeadersAll);
  })
  .catch(function(e){ if(listEl) listEl.innerHTML='<div class="adm-empty">Şəbəkə xətası: '+escapeHtml(e.message)+'</div>'; });
}
function hideAbout(){ document.getElementById('aboutModal').classList.remove('open'); }
function signOut(){ closeMenu(); clearSession(); currentUser=null; document.getElementById('email').value=''; document.getElementById('password').value=''; var btn=document.getElementById('loginBtn'); btn.disabled=false; btn.innerHTML='Daxil ol'; document.getElementById('dashboardView').style.display='none'; document.getElementById('busServiceView').style.display='none'; document.getElementById('loginView').style.display=''; }
function moduleAlert(n){ alert(n+' modulu tezliklə hazır olacaq'); }

var MOON_PATH='<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
var SUN_PATH='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';
function applyTheme(isDark){
  var icons=[document.getElementById('themeIcon'),document.getElementById('rptThemeIcon'),document.getElementById('dashThemeIcon'),document.getElementById('bkThemeIcon'),document.getElementById('tvmRptThemeIcon'),document.getElementById('ctdThemeIcon')];
  icons.forEach(function(icon){ if(!icon)return; icon.innerHTML=isDark?SUN_PATH:MOON_PATH; });
  if(isDark){document.body.classList.add('dark-mode');}else{document.body.classList.remove('dark-mode');}

  // Kollektiv düyməsinin rəngini gecə/gündüz rejiminə uyğunlaşdır (görünmə deyil — o ayrıca idarə olunur)
  var collBtn = document.getElementById('collectivesBtn');
  if(collBtn) {
    collBtn.style.color = isDark ? '#E8EEF5' : '#12233B';
  }
}
function updateCollectivesBtnVisibility(){
  var collBtn = document.getElementById('collectivesBtn');
  if(collBtn) collBtn.style.display = 'none'; // köhnə header düyməsi — sidebar-a köçürülüb, artıq göstərilmir
  var sidebarBtn = document.getElementById('sidebarCollectivesBtn');
  if(sidebarBtn) sidebarBtn.style.display = (window.innerWidth >= 901) ? 'flex' : 'none';
}
window.addEventListener('resize', updateCollectivesBtnVisibility);
function toggleTheme(){ if(window.innerWidth>=901)return; var isDark=!document.body.classList.contains('dark-mode'); applyTheme(isDark); try{localStorage.setItem('ctech_theme',isDark?'dark':'light');}catch(e){} }

// Service Worker artıq istifadə olunmur (faydasız, xəta-idarəetməsiz idi) —
// əvvəllər quraşdırılmış ola biləcək versiyaları təmizləyirik ki, heç kimdə
// köhnə/"boş" SW arxa planda qalıb qarışıqlıq yaratmasın.
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(function(regs){
    regs.forEach(function(reg){ reg.unregister(); });
  }).catch(function(){});
}
if('caches' in window){
  caches.keys().then(function(names){
    names.forEach(function(name){ caches.delete(name); });
  }).catch(function(){});
}
var savedUser=loadSession();
if(savedUser && savedUser.email){
  currentUser=savedUser;
  showDashboard();
} else if(savedUser){
  // Köhnə/yarımçıq sessiya (email sahəsi yoxdur) — sakitcə davam etmək əvəzinə
  // təmiz bir giriş məcburiləşdiririk ki, email kimi vacib sahələr yenidən düzgün dolsun
  clearSession();
}
try{ var savedTheme=localStorage.getItem('ctech_theme'); if(savedTheme==='dark'&&window.innerWidth<901){applyTheme(true);} }catch(e){}

// ═══════════════════════════════════════════════════
// BUS SERVICE — İNLİNE DROPDOWN SİSTEMİ
// ═══════════════════════════════════════════════════

var bsFormData = {};
var bsFormDirty = false;
var bsNextTicketId = '';
var bsRegistryLocked = false;
var bsSelected = { carrier:'', brand:'', problem:'', solution:[], equipment:'', location:'', tech1:'', tech2:'', leader:'', tvm_fault:[], tvm_solution:[], tvm_tech:'', tvm_leader:'', oldSn:[], newSn:[] };
var activeDDKey = null;

var ddMeta = {
  carrier:   { lbl:'bs_carrier_lbl',   list:'dd_carrier_list',   multi:false, onSelect:null },
  brand:     { lbl:'bs_brand_lbl',     list:'dd_brand_list',     multi:false, onSelect:null },
  system:    { lbl:'bs_system_lbl',    list:'dd_system_list',    multi:false, onSelect:null },
  equipment: { lbl:'bs_equipment_lbl', list:'dd_equipment_list', multi:false, onSelect:null },
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
      div.innerHTML=(isSelected?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F6FED" stroke-width="2.5"><path d="M4 12l6 6L20 6"/></svg>':'<div style="width:14px"></div>')+'<span>'+item+'</span>';
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

function getListForKey(key){
  var map={
    carrier:bsFormData.carriers||[],
    brand:bsFormData.busModels||[],
    equipment:bsFormData.busEquipment||[],
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
function fillAllDDs(data){ bsFormData=data; }

var bsEditMode=false, bsEditTicketId=null, bsReturnTarget='dashboard', bsCompletionMode=false;

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
        badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+tid+'</span>';
      }
    }
  }).catch(function(){});
}

function resetBusFormFields(){
  ['bs_time_lbl','bs_start_lbl','bs_end_lbl'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; });
  bsFormDirty=false;
  bsCompletionMode=false;
  if(typeof bsLockStage1Fields==='function') bsLockStage1Fields(false);
  bsSelected={carrier:'',brand:'',problem:'',solution:[],equipment:'',location:'',tech1:'',tech2:'',leader:'',oldSn:[],newSn:[]};
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
        document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+bsNextTicketId+'</span>';
      }
    }
    if(d.tvm){
      tvmNextTicketId=d.tvm;
      var tvmView=document.getElementById('tvmServiceView');
      if(!tvmEditMode && tvmView && tvmView.style.display!=='none'){
        var badge=document.getElementById('tvmTicketBadge');
        if(badge) badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+tvmNextTicketId+'</span>';
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
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+bsNextTicketId+'</span>';
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
  })
  .catch(function(){
    bsFormData={
      carriers:['BakuBus MMC','Xaliq Faiqoğlu MMC','Çinar-Trans MMC','General Auto Company MMC','ENA Transport MMC','Transkontrol MMC','Vətən-Az MMC','Vətən MMC','K-Group MMC','AYNA - Monitoring'],
      busModels:['BMC','BYD','Daewoo','Isuzu','Karsan','Otokar','Iveco','King-Long','Dragon','Digər'],
      busProblems:['Validator ödəniş kartını qəbul etmir','Validator açılmır','Validator elektrik almır','Digər'],
      solutions:['Validator dəyişdirildi','Problem aşkar olunmadı','Elektrik söndürülüb-yandırıldı','Digər'],
      busEquipment:['Validator','SAM Card','Ethernet Cable','RJ45','Broket','Avtobus elektrik problemi','Demontaj','Montaj','Təmir sonrası baxış','Call center vasitəsilə uzaqdan servis','Route-Update','Distributions'],
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
  var ensureFormData=(bsFormData&&bsFormData.carriers)?Promise.resolve(bsFormData):
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK'){bsFormData=d;bsNextTicketId=d.nextTicketId||bsNextTicketId;} return bsFormData; });
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
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#D97706;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">REDAKTƏ: '+d.ticketId+'</span>';
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
    setDDValue('carrier',d.carrier); setDDValue('brand',d.brand_model); setDDValue('equipment',d.changed_device_type);
    setDDValue('problem',d.problem); setDDValue('location',d.service_location);
    setDDValue('tech1',d.technician_1); if(d.technician_2)setDDValue('tech2',d.technician_2); setDDValue('leader',d.team_leader);
    bsSelected.solution=Array.isArray(d.solution)?d.solution.slice():[];
    updateMultiLabel('solution'); updateSolutionChips();
    document.getElementById('bs_location_note_wrap').style.display=(d.service_location||'').toLowerCase().indexOf('digər')!==-1?'block':'none';
    bsFormDirty=false;
  }).catch(function(){ ov.style.display='none'; alert('Şəbəkə xətası: ticket yüklənə bilmədi'); });
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
  if(!bsSelected.equipment){alert('Servis Kategoriyasını seçin');return;}
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
    request:bsSelected.problem,
    solution:bsSelected.solution,
    changed_device_type:bsSelected.equipment||'',
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
  tx.textContent=bsCompletionMode?'Tamamlanır...':(bsEditMode?'Yadda saxlanılır...':'Göndərilir...');
  var payload = bsCompletionMode
    ? {action:'completeTechnicianTicket',ticketId:bsEditTicketId,data:data,userEmail:currentUser?currentUser.email:''}
    : (bsEditMode?{action:'updateBusService',ticketId:bsEditTicketId,data:data,userEmail:currentUser?currentUser.email:''}:{action:'submitBusService',data:data,userEmail:currentUser?currentUser.email:''});
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(result){
    sp.style.display='none'; ic.style.display='flex';
    if(result.status==='OK'){ tx.textContent=bsEditMode?('Yadda saxlanıldı! '+result.ticketId):('Göndərildi! '+result.ticketId); }
    else { tx.textContent='Xəta baş verdi'; }
    setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; if(result.status==='OK'){ bsFormDirty=false; if(!bsEditMode)clearBsDraft(); var wasEdit=bsEditMode; bsGoBack(); if(wasEdit)loadReportData(); } },1800);
  }).catch(function(){ sp.style.display='none'; tx.textContent='Şəbəkə xətası'; setTimeout(function(){ov.classList.remove('open');ov.style.display='none';},1500); });
}

function openTechComplete(ticketId){
  var ov=document.getElementById('busOpenOverlay'); ov.style.display='flex';
  var ensureFormData=(bsFormData&&bsFormData.carriers)?Promise.resolve(bsFormData):
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})}).then(function(r){return r.json();}).then(function(d){ if(d.status==='OK'){bsFormData=d;} return bsFormData; });
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
    document.getElementById('bsTicketBadge').innerHTML='<span style="display:inline-flex;align-items:center;background:#D97706;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">SERVİSİ TAMAMLA: '+d.ticketId+'</span>';
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
    setDDValue('carrier',d.carrier); setDDValue('brand',d.brand_model); setDDValue('equipment',d.changed_device_type);
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
      var carrierAttr = m.carrier || '';
      return '<div class="bs-registry-item" data-dqn="' + (m.dqn || '') + '" data-id="' + (m.id || '') + '" data-carrier="' + carrierAttr + '" data-model="' + (m.model || '') + '">' +
        '<span class="reg-id">' + (m.dqn || '—') + '</span>' +
        '<span class="reg-meta">BUS ID: ' + (m.id || '—') + ' · ' + (m.carrier || '—') + ' · ' + (m.model || '—') + '</span>' +
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
        console.log('🔍 Seçilən match:', match);
        if(match.dqn) selectBusRegistryMatch(match);
      });
    });
  }
  dd.classList.add('open');
}

function selectBusRegistryMatch(match){
  console.log('🔍 selectBusRegistryMatch çağırıldı:', match);
  
  var plateEl = document.getElementById('bs_plate');
  var busidEl = document.getElementById('bs_busid');
  if(plateEl) plateEl.value = match.dqn || '';
  if(busidEl) busidEl.value = match.id || '';
  
  unlockRegistryFields();
  
  if(match.carrier){
    var cleanCarrier = match.carrier.replace(/^"|"$/g, '').trim();
    console.log('✅ Təmizlənmiş daşıyıcı:', cleanCarrier);
    
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
    console.log('✅ Model təyin edilir:', match.model);
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
  
  console.log('✅ Tamamlandı - bsSelected:', bsSelected);
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
  document.getElementById('ongTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-loading"><div class="spinner" style="width:36px;height:36px;border-width:4px;"></div><span>Yüklənir...</span></div></td></tr>';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getReportData', daysBack:0})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){
      document.getElementById('ongTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-empty">Xəta: '+(d.message||'məlumat gəlmədi')+'</div></td></tr>';
      return;
    }
    ongAllRows=(d.rows||[]).filter(function(row){ return (row['Status']||'').trim()==='Açıq'; }).sort(function(a,b){ return rptSortKey(b)-rptSortKey(a); });
    ongColumns=d.columns||[];
    applyOngoingFilters();
  }).catch(function(e){
    document.getElementById('ongTableBody').innerHTML='<tr><td colspan="6"><div class="rpt-empty">Şəbəkə xətası: '+e.message+'</div></td></tr>';
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
function renderOngoingTable(){
  var body=document.getElementById('ongTableBody');
  document.getElementById('ongCount').textContent=ongFiltered.length+' nəticə';
  if(ongFiltered.length===0){
    body.innerHTML='<tr><td colspan="6"><div class="rpt-empty">Davam edən servis yoxdur</div></td></tr>';
    document.getElementById('ongLoadMoreWrap').style.display='none';
    return;
  }
  var visible=ongFiltered.slice(0,ongShownCount);
  var html='';
  visible.forEach(function(row){
    var ticketId=escapeHtml(row['Ticket ID']||'');
    var safeId=(row['Ticket ID']||'').replace(/'/g,'');
    var editable=canEditTicket(row);
    html+='<tr>'
      +'<td class="rpt-td-id">'+ticketId+'</td>'
      +'<td>'+escapeHtml(row['Tarix']||'')+'</td>'
      +'<td class="rpt-td-plate">'+escapeHtml(row['D.Q.N.']||'')+'</td>'
      +'<td>'+escapeHtml(row['BUS ID']||'')+'</td>'
      +'<td class="col-carrier" title="'+escapeHtml(row['Daşıyıcı']||'')+'">'+escapeHtml(row['Daşıyıcı']||'')+'</td>'
      +'<td class="col-act"><div class="rpt-row-actions">'
      +'<button class="rpt-icon-btn" onclick="openBusDetail(\''+safeId+'\')" aria-label="Baxış" title="Baxış"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg></button>'
      +(editable?'<button class="rpt-icon-btn rpt-edit-btn" onclick="openBusServiceForEdit(\''+safeId+'\')" aria-label="Redaktə et" title="Redaktə et"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>':'')
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
    rptAllRows=(d.rows||[]).slice().sort(function(a,b){ return rptSortKey(b)-rptSortKey(a); });
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
      // Texnik yalnız ÖZÜNƏ təhkim olunmuş və hələ AÇIQ olan (davam edən) ticketləri görür
      if((row['Status']||'').trim()!=='Açıq') return false;
      if(!rptIsAssignedToMe(row)) return false;
    } else if(rptForceOpenOnly){
      // Qrup rəhbəri/admin "Davam edən Servis" ilə açılıbsa — yalnız Status=Açıq
      if((row['Status']||'').trim()!=='Açıq') return false;
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
  if(!row){ alert('Ticket tapılmadı'); return; }
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
  if(!row){ alert('Ticket tapılmadı'); return; }
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
          var v=rows.filter(function(r){return (r['Status']||'').trim()==='Açıq';}).length;
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
// YENİ MÜRACİƏT — iki-mərhələli servis axınının 1-ci addımı.
// Qəsdən Bus Service-in bsSelected/draft sistemindən TAM AYRIDIR
// ki, iki forma bir-birinin state-inə qarışmasın.
// ═══════════════════════════════════════════════════════════════
var brSelected = { carrier:'', brand:'', problem:'', technicians:[] };
var brFormDirty = false;
var brNextTicketId = '';

function openBusRequest(){
  closeMenu();
  if(window.innerWidth < 901){ return; } // yalnız veb
  var level = getAccessLevel(currentUser.role);
  if(level === 'technician'){ return; } // yalnız qrup rəhbəri/admin

  document.getElementById('dashboardView').style.display='none';
  document.getElementById('busRequestView').style.display='block';
  brResetForm();
  brLoadAssignableTechnicians();

  var now=new Date();
  var bParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  document.getElementById('br_date').value = bParts;

  // Bus Service-in artıq yüklədiyi carriers/busModels/busProblems/busRegistry datasını təkrar istifadə edir
  if(bsFormData && bsFormData.carriers){
    brRenderTicketBadge();
  } else {
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getFormData'})})
    .then(function(r){return r.json();})
    .then(function(d){ if(d.status==='OK'){ bsFormData=d; brNextTicketId=d.nextTicketId||''; brRenderTicketBadge(); } })
    .catch(function(){});
  }
  if(!brNextTicketId && bsFormData) brNextTicketId = bsFormData.nextTicketId || '';
  brRenderTicketBadge();
}

function brRenderTicketBadge(){
  var badge=document.getElementById('brTicketBadge');
  if(badge && brNextTicketId){
    badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+brNextTicketId+'</span>';
  }
}

function attemptBusRequestHome(){
  bsConfirmMode='busRequest';
  if(brFormDirty){
    var co=document.getElementById('bsConfirmOverlay');
    co.style.display='flex'; co.classList.add('open');
    return;
  }
  closeBusRequest();
}
function closeBusRequest(){
  document.getElementById('busRequestView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
}

function brResetForm(){
  brFormDirty=false;
  brSelected={carrier:'',brand:'',problem:'',technicians:[]};
  ['br_requester','br_phone','br_route','br_busid','br_plate','br_time_lbl','br_tech_search'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  ['br_carrier_lbl','br_brand_lbl','br_problem_lbl'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.textContent='Seçin'; el.style.color='#9AACC4'; el.classList.remove('filled'); }
  });
  document.getElementById('br_tech_chips').innerHTML='';
  brCloseAllDD();
  brCloseRegistryDD();
}

// ── Sadə açılan siyahılar (Daşıyıcı / Marka / Problem) ──
function brOpenSimpleList(fieldKey, listSourceKey, lblId, listId){
  brCloseAllDD();
  var listEl=document.getElementById(listId);
  var items=(bsFormData && bsFormData[listSourceKey]) || [];
  listEl.innerHTML = items.map(function(item){
    var safe=item.replace(/'/g,"\\'");
    return '<div class="bs-dd-item" onclick="brSelectSimple(\''+fieldKey+'\',\''+safe+'\',\''+lblId+'\',\''+listId+'\')"><div style="width:14px"></div><span>'+escapeHtml(item)+'</span></div>';
  }).join('');
  listEl.classList.add('open');
}
function brSelectSimple(fieldKey, value, lblId, listId){
  brSelected[fieldKey]=value;
  brFormDirty=true;
  var lbl=document.getElementById(lblId);
  if(lbl){ lbl.textContent=value; lbl.style.color='#12233B'; lbl.classList.add('filled'); }
  var listEl=document.getElementById(listId);
  if(listEl) listEl.classList.remove('open');
}
function brCloseAllDD(){
  ['dd_brCarrier_list','dd_brBrand_list','dd_brProblem_list'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.remove('open');
  });
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#dd_brCarrier') && !e.target.closest('#dd_brBrand') && !e.target.closest('#dd_brProblem')){ brCloseAllDD(); }
});

// ── D.Q.N. reyestr axtarışı (Bus Service-in eyni məntiqi, ayrı elementlərə) ──
function brFilterRegistry(query){
  var reg=(bsFormData && bsFormData.busRegistry) || [];
  if(!query || query.length<2) return [];
  var q=query.toUpperCase().replace(/\s/g,'');
  return reg.filter(function(r){ return String(r.dqn||'').toUpperCase().replace(/\s/g,'').indexOf(q)!==-1; });
}
function brRenderRegistryDropdown(matches){
  var dd=document.getElementById('br_registry_dd');
  if(!dd) return;
  if(!matches || matches.length===0){
    dd.innerHTML='<div class="bs-registry-empty">Uyğun D.Q.N. tapılmadı — məlumatları əl ilə daxil edin</div>';
  } else {
    dd.innerHTML=matches.slice(0,8).map(function(m){
      return '<div class="bs-registry-item" data-dqn="'+(m.dqn||'')+'" data-id="'+(m.id||'')+'" data-carrier="'+(m.carrier||'')+'" data-model="'+(m.model||'')+'">'
        +'<span class="reg-id">'+(m.dqn||'—')+'</span>'
        +'<span class="reg-meta">BUS ID: '+(m.id||'—')+' · '+(m.carrier||'—')+' · '+(m.model||'—')+'</span></div>';
    }).join('');
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation();
        brSelectRegistryMatch({ dqn:el.getAttribute('data-dqn'), id:el.getAttribute('data-id'), carrier:el.getAttribute('data-carrier'), model:el.getAttribute('data-model') });
      });
    });
  }
  dd.classList.add('open');
}
function brSelectRegistryMatch(match){
  brFormDirty=true;
  var plateEl=document.getElementById('br_plate'); if(plateEl) plateEl.value=match.dqn||'';
  var busidEl=document.getElementById('br_busid'); if(busidEl) busidEl.value=match.id||'';
  if(match.carrier){
    var cleanCarrier=match.carrier.replace(/^"|"$/g,'').trim();
    brSelected.carrier=cleanCarrier;
    var cLbl=document.getElementById('br_carrier_lbl');
    if(cLbl){ cLbl.textContent=cleanCarrier; cLbl.style.color='#12233B'; cLbl.classList.add('filled'); }
  }
  if(match.model){
    brSelected.brand=match.model;
    var bLbl=document.getElementById('br_brand_lbl');
    if(bLbl){ bLbl.textContent=match.model; bLbl.style.color='#12233B'; bLbl.classList.add('filled'); }
  }
  brCloseRegistryDD();
}
function brResetRegistrySelection(){
  brSelected.carrier=''; brSelected.brand='';
  ['br_carrier_lbl','br_brand_lbl'].forEach(function(id){
    var el=document.getElementById(id); if(el){ el.textContent='Seçin'; el.style.color='#9AACC4'; el.classList.remove('filled'); }
  });
  var plateEl=document.getElementById('br_plate'); if(plateEl) plateEl.value='';
  var busidEl=document.getElementById('br_busid'); if(busidEl) busidEl.value='';
  brFormDirty=true;
}
function brCloseRegistryDD(){ var dd=document.getElementById('br_registry_dd'); if(dd) dd.classList.remove('open'); }
document.addEventListener('click', function(e){
  if(!e.target.closest('#br_busid_wrap') && !e.target.closest('#br_registry_dd')){ brCloseRegistryDD(); }
});

// ── Texnik seçimi (USERS sheet-dən, maksimum 2, çip formada) ──
var brAssignableTechnicians = [];
function brLoadAssignableTechnicians(){
  var statusEl = document.getElementById('br_tech_status');
  var userDiag = 'currentUser: ' + JSON.stringify(currentUser);
  if(statusEl) statusEl.textContent = 'Texnik siyahısı yüklənir... [' + userDiag + ']';
  var emailToSend = currentUser?currentUser.email:'';
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getAssignableTechnicianNames', requesterEmail: emailToSend})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.status==='OK'){
      brAssignableTechnicians = d.names || [];
      if(statusEl) statusEl.textContent = brAssignableTechnicians.length + ' texnik yükləndi';
    } else {
      brAssignableTechnicians = [];
      if(statusEl) statusEl.textContent = '⚠ Xəta: ' + (d.message || 'texnik siyahısı gətirilə bilmədi') + ' [Göndərilən email: \'' + emailToSend + '\' | ' + userDiag + ']';
    }
  })
  .catch(function(e){
    brAssignableTechnicians = [];
    if(statusEl) statusEl.textContent = '⚠ Şəbəkə xətası: ' + e.message + ' [' + userDiag + ']';
  });
}
function brTechSearchHandler(el){
  var dd=document.getElementById('br_tech_dd');
  var q=el.value.trim();
  if(!q){ dd.style.display='none'; return; }
  if(brSelected.technicians.length>=2){
    dd.innerHTML='<div class="bs-registry-empty">Maksimum 2 texnik seçilə bilər</div>';
    dd.style.display='block';
    return;
  }
  var qUpper=q.toUpperCase();
  var matches=brAssignableTechnicians.filter(function(name){
    return name.toUpperCase().indexOf(qUpper)!==-1 && brSelected.technicians.indexOf(name)===-1;
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
        brTechAddChip(itemEl.getAttribute('data-name'));
        el.value=''; dd.style.display='none';
      });
    });
  }
  dd.style.display='block';
}
function brTechAddChip(name){
  if(brSelected.technicians.length>=2 || brSelected.technicians.indexOf(name)!==-1) return;
  brSelected.technicians.push(name);
  brFormDirty=true;
  brRenderTechChips();
}
function brTechRemoveChip(name){
  var idx=brSelected.technicians.indexOf(name);
  if(idx!==-1) brSelected.technicians.splice(idx,1);
  brFormDirty=true;
  brRenderTechChips();
}
function brRenderTechChips(){
  var box=document.getElementById('br_tech_chips');
  box.innerHTML=brSelected.technicians.map(function(name){
    var safe=name.replace(/'/g,'');
    return '<span class="bs-chip">'+escapeHtml(name)+'<button type="button" class="bs-chip-x" onclick="brTechRemoveChip(\''+safe+'\')">✕</button></span>';
  }).join('');
}
document.addEventListener('click', function(e){
  if(!e.target.closest('#br_tech_search') && !e.target.closest('#br_tech_dd')){
    var dd=document.getElementById('br_tech_dd'); if(dd) dd.style.display='none';
  }
});

// ── Göndər ──
function submitBusRequest(){
  if(!document.getElementById('br_date').value){ alert('Tarix daxil edin'); return; }
  if(!getTimeInputValue('br_time_lbl')){ alert('Saat seçin'); return; }
  if(!document.getElementById('br_requester').value.trim()){ alert('Müraciət edəni daxil edin'); return; }
  if(!document.getElementById('br_plate').value.trim()){ alert('D.Q.N. daxil edin'); return; }
  if(!document.getElementById('br_busid').value.trim()){ alert('BUS ID daxil edin'); return; }
  if(!brSelected.carrier){ alert('Daşıyıcı şirkəti seçin'); return; }
  if(!brSelected.brand){ alert('Marka/Modeli seçin'); return; }
  if(!brSelected.problem){ alert('Müraciət/Problemi seçin'); return; }
  if(brSelected.technicians.length===0){ alert('Ən azı bir texnik təhkim edin'); return; }

  var btn=document.getElementById('brSubmitBtn');
  btn.disabled=true; var origText=btn.textContent;

  var ov=document.getElementById('bsLoadingOverlay'); var sp=document.getElementById('bsSpinner');
  var tx=document.getElementById('bsLoadingText'); var ic=document.getElementById('bsSuccessIcon');
  ov.style.display='flex'; ov.classList.add('open'); sp.style.display='block'; ic.style.display='none'; tx.textContent='Göndərilir...';

  var payload={
    action:'createBusRequest',
    data:{
      report_date: document.getElementById('br_date').value,
      report_time: getTimeInputValue('br_time_lbl'),
      requester_name: document.getElementById('br_requester').value.trim(),
      requester_phone: document.getElementById('br_phone').value.trim(),
      carrier: brSelected.carrier,
      route_number: document.getElementById('br_route').value.trim(),
      bus_id: document.getElementById('br_busid').value.trim(),
      license_plate: document.getElementById('br_plate').value.trim(),
      brand_model: brSelected.brand,
      problem: brSelected.problem,
      technician_1: brSelected.technicians[0] || '',
      technician_2: brSelected.technicians[1] || ''
    },
    requesterEmail: currentUser?currentUser.email:''
  };

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    sp.style.display='none'; ic.style.display='flex';
    if(d.status==='OK'){
      tx.textContent='Göndərildi! '+d.ticketId;
      setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; brFormDirty=false; closeBusRequest(); }, 1800);
    } else {
      tx.textContent='Xəta baş verdi';
      setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; alert(d.message||'Xəta baş verdi'); }, 1200);
    }
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    sp.style.display='none'; tx.textContent='Şəbəkə xətası';
    setTimeout(function(){ ov.classList.remove('open'); ov.style.display='none'; alert('Şəbəkə xətası: '+e.message); }, 1200);
  });
}

function preloadValidatorSNList(force){
  if(busValidatorSNLoading) return;
  if(busValidatorSNLoaded && !force) return;
  busValidatorSNLoading = true;
  Promise.all([
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getValidatorSNList', requesterEmail: currentUser?currentUser.email:''})}).then(function(r){return r.json();}),
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getSamCardSNList', requesterEmail: currentUser?currentUser.email:''})}).then(function(r){return r.json();})
  ]).then(function(results){
    busValidatorSNLoading = false;
    if(results[0] && results[0].status==='OK') busValidatorSNList = results[0].list || [];
    if(results[1] && results[1].status==='OK') busSamCardSNList = results[1].list || [];
    var combined = busValidatorSNList.concat(busSamCardSNList);
    busCombinedSNSet = new Set(combined.map(function(s){ return s.toUpperCase(); }));
    busValidatorSNLoaded = true;
  }).catch(function(){ busValidatorSNLoading = false; });
}

function busSnExists(sn){
  if(!busCombinedSNSet) return true; // hələ yüklənməyibsə, xəbərdarlıq göstərmə (yalançı-mənfi olmasın)
  return busCombinedSNSet.has(String(sn||'').trim().toUpperCase());
}

function busSnSearchMatches(query){
  var q = String(query||'').trim().toUpperCase();
  if(!q) return [];
  var combined = busValidatorSNList.concat(busSamCardSNList);
  return combined.filter(function(s){ return s.toUpperCase().indexOf(q) !== -1; }).slice(0,8);
}

// ═══════════════════════════════════════════════════════════════
// TEXNİK AXTARIŞI — bütün "Texnik" sahələrində (Bus Service Texnik 1/2,
// TVM Service Texnik) eyni axtar-yaz-seç məntiqi (Validator/SAM SN
// pattern-i ilə eyni). Texnik 1-ə seçilən ad Texnik 2-də (və əksinə)
// təklif edilmir — bir avtobusa iki eyni texnik yazıla bilməz.
// ═══════════════════════════════════════════════════════════════
function techSearchHandler(el, fieldKey, excludeKey){
  var ddId = 'bs_' + fieldKey + '_dd';
  var dd = document.getElementById(ddId);
  var q = el.value.trim();
  bsFormDirty = true;
  bsSelected[fieldKey] = el.value; // sərbəst yazılan mətn də saxlanılsın (əvvəlki davranışla uyğun elastiklik)
  if(!q){ if(dd) dd.style.display='none'; return; }

  var allTech = fieldKey === 'tvm_tech'
    ? ((typeof tvmFormData !== 'undefined' && tvmFormData && tvmFormData.technicians) || [])
    : ((bsFormData && bsFormData.technicians) || []);
  var excludeVal = excludeKey ? (bsSelected[excludeKey] || '').trim().toUpperCase() : null;
  var qUpper = q.toUpperCase();
  var matches = allTech.filter(function(name){
    if(excludeVal && name.trim().toUpperCase() === excludeVal) return false; // digər texnik sahəsində artıq seçilib
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
        var name = itemEl.getAttribute('data-name');
        setDDValue(fieldKey, name);
        dd.style.display = 'none';
      });
    });
  }
  dd.style.display = 'block';
}

function techCheckDuplicate(key1, key2){
  var v1 = (bsSelected[key1]||'').trim().toUpperCase();
  var v2 = (bsSelected[key2]||'').trim().toUpperCase();
  return !!(v1 && v2 && v1 === v2);
}

document.addEventListener('click', function(e){
  ['tech1','tech2','tvm_tech'].forEach(function(k){
    if(!e.target.closest('#bs_'+k+'_lbl') && !e.target.closest('#bs_'+k+'_dd')){
      var dd = document.getElementById('bs_'+k+'_dd');
      if(dd) dd.style.display='none';
    }
  });
});

function busSnInputHandler(el, ddId, warnId){
  var dd = document.getElementById(ddId);
  var q = el.value.trim();
  bsFormDirty = true;
  if(!q){ if(dd) dd.style.display='none'; return; }
  var type = ddId.indexOf('old')!==-1 ? 'old' : 'new';
  var matches = busSnSearchMatches(q);
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
          busSnAddChip(type, itemEl.getAttribute('data-sn'));
          el.value = '';
          dd.style.display = 'none';
        });
      });
    }
    dd.style.display = 'block';
  }
}

function busSnInputKeydown(e, el, type){
  if(e.key === 'Enter'){
    e.preventDefault();
    var v = el.value.trim();
    if(v){
      busSnAddChip(type, v);
      el.value = '';
      closeBusSnDD('bs_'+type+'_sn_dd');
    }
  }
}

function busSnAddChip(type, sn){
  sn = String(sn||'').trim();
  if(!sn) return;
  var arr = type==='old' ? bsSelected.oldSn : bsSelected.newSn;
  var already = arr.some(function(x){ return x.toUpperCase()===sn.toUpperCase(); });
  if(!already) arr.push(sn);
  bsFormDirty = true;
  busSnRenderChips(type);
  busSnCheckOldNewConflict();
}

function busSnRemoveChip(type, sn){
  var arr = type==='old' ? bsSelected.oldSn : bsSelected.newSn;
  var idx = arr.findIndex(function(x){ return x.toUpperCase()===sn.toUpperCase(); });
  if(idx!==-1) arr.splice(idx,1);
  bsFormDirty = true;
  busSnRenderChips(type);
  busSnCheckOldNewConflict();
}

function busSnRenderChips(type){
  var arr = type==='old' ? bsSelected.oldSn : bsSelected.newSn;
  var box = document.getElementById('bs_'+type+'_sn_chips');
  if(!box) return;
  box.innerHTML = arr.map(function(sn){
    var unknown = busValidatorSNLoaded && !busSnExists(sn);
    var safeSn = sn.replace(/'/g,'');
    return '<span class="bs-chip'+(unknown?' bs-chip-warn':'')+'"'+(unknown?' title="Bu SN bazada tapılmadı — diqqətlə yoxlayın">⚠ ':'>')
      + escapeHtml(sn)
      + '<button type="button" class="bs-chip-x" onclick="busSnRemoveChip(\''+type+'\',\''+safeSn+'\')">✕</button></span>';
  }).join('');
}

// Eyni SN həm Köhnə, həm Yeni xanada ola bilməz (məcburi qayda, xəbərdarlıq deyil)
function busSnCheckOldNewConflict(){
  var errEl = document.getElementById('bs_sn_conflict_err');
  if(!errEl) return false;
  var oldSet = bsSelected.oldSn.map(function(s){ return s.toUpperCase(); });
  var newSet = bsSelected.newSn.map(function(s){ return s.toUpperCase(); });
  var conflict = newSet.some(function(s){ return oldSet.indexOf(s)!==-1; });
  errEl.style.display = conflict ? 'block' : 'none';
  return conflict;
}

function closeBusSnDD(id){
  var dd = document.getElementById(id);
  if(dd) dd.style.display = 'none';
}

function tvmSnInputHandler(el){
  var digits = el.value.replace(/[^0-9]/g,'');
  el.value = digits;
  tvmFormDirty = true;

  if(tvmSelectedSn && tvmSelectedSn.id.replace(/[^0-9]/g,'') !== digits){
    tvmSelectedSn = null;
    var locWrap = document.getElementById('tvm_location_wrap'); if(locWrap) locWrap.style.display = 'none';
    var svcLocWrap = document.getElementById('tvm_service_location_wrap'); if(svcLocWrap) svcLocWrap.style.display = 'none';
  }

  if(digits.length < 1){ closeTvmSnDD(); return; }

  var reg = (tvmFormData && tvmFormData.tvmRegistry) || [];
  var matches = reg.filter(function(r){
    var idDigits = String(r.id||'').replace(/[^0-9]/g,'');
    return idDigits.indexOf(digits) !== -1;
  });
  renderTvmSnDropdown(matches);
}

function renderTvmSnDropdown(matches){
  var dd = document.getElementById('tvm_sn_dd');
  if(!dd) return;
  if(!matches || matches.length === 0){
    dd.innerHTML = '<div class="bs-registry-empty">Uyğun TVM İD tapılmadı</div>';
  } else {
    dd.innerHTML = matches.slice(0,8).map(function(m){
      return '<div class="bs-registry-item" data-id="'+escapeHtml(m.id||'')+'">'
        + '<span class="reg-id">'+escapeHtml(m.id||'—')+'</span>'
        + '<span class="reg-meta">'+escapeHtml(m.location||'—')+'</span>'
        + '</div>';
    }).join('');
    Array.from(dd.querySelectorAll('.bs-registry-item')).forEach(function(itemEl){
      itemEl.addEventListener('click', function(e){
        e.stopPropagation();
        var id = itemEl.getAttribute('data-id');
        var match = matches.find(function(m){ return m.id === id; });
        if(match) selectTvmSnMatch(match);
      });
    });
  }
  dd.style.display = 'block';
}

function selectTvmSnMatch(match){
  tvmSelectedSn = match;
  var snEl = document.getElementById('tvm_sn'); if(snEl) snEl.value = match.id || '';

  var locWrap = document.getElementById('tvm_location_wrap');
  var locDisp = document.getElementById('tvm_location_display');
  if(match.location){
    if(locDisp) locDisp.textContent = match.location;
    if(locWrap) locWrap.style.display = 'block';
  } else if(locWrap){ locWrap.style.display = 'none'; }

  var svcLocWrap = document.getElementById('tvm_service_location_wrap');
  var svcLocDisp = document.getElementById('tvm_service_location_display');
  if(match.serviceLocation){
    if(svcLocDisp) svcLocDisp.textContent = match.serviceLocation;
    if(svcLocWrap) svcLocWrap.style.display = 'block';
  } else if(svcLocWrap){ svcLocWrap.style.display = 'none'; }

  closeTvmSnDD();
  tvmFormDirty = true;
}

function closeTvmSnDD(){
  var dd = document.getElementById('tvm_sn_dd');
  if(dd) dd.style.display = 'none';
}

document.addEventListener('click', function(e){
  if(!e.target.closest('#tvm_sn') && !e.target.closest('#tvm_sn_dd')){ closeTvmSnDD(); }
  if(!e.target.closest('#bs_old_sn') && !e.target.closest('#bs_old_sn_dd')){ closeBusSnDD('bs_old_sn_dd'); }
  if(!e.target.closest('#bs_new_sn') && !e.target.closest('#bs_new_sn_dd')){ closeBusSnDD('bs_new_sn_dd'); }
});

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
    } else {
      tx.textContent = '❌ Xəta: ' + (result.message || '');
    }
    setTimeout(function(){
      ov.style.display = 'none';
      ic.classList.remove('show');
      ic.style.display = 'none';
      if(result.status === 'OK'){
        var wasEdit = tvmEditMode;
        closeTvmService();
        if(wasEdit && typeof loadTvmReportData === 'function') loadTvmReportData();
      }
    }, 1800);
  })
  .catch(function(e){
    sp.style.display = 'none';
    tx.textContent = '❌ Şəbəkə xətası: ' + e.message;
    setTimeout(function(){ ov.style.display = 'none'; }, 1800);
  });
}

// ═══════════════════════════════════════════════════
// BUS MANAGEMENT — Admin Panel üçün tam frontend (YENİ)
// ═══════════════════════════════════════════════════

var admBusRegistryAll=[], admBusProblems=[], admBusSolutions=[], admBusEquipment=[], admBusLocations=[];
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
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getBusManagementData', requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){
      if(body) body.innerHTML='<tr><td colspan="4"><div class="adm-empty">Xəta: '+escapeHtml(d.message||'')+'</div></td></tr>';
      return;
    }
    admBusRegistryAll=d.registry||[];
    admBusProblems=d.problems||[];
    admBusSolutions=d.solutions||[];
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

  var payload = admBusRegEditingId
    ? { action:'updateBusRegistryEntry', originalId:admBusRegEditingId, data:{id:id, carrier:carrier, dqn:dqn, model:model}, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addBusRegistryEntry', data:{id:id, carrier:carrier, dqn:dqn, model:model}, requesterEmail: currentUser?currentUser.email:'' };

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeBusRegistryModal();
    loadBusManagementData();
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}
function admDeleteBusRegistry(id){
  admOpenDeleteConfirm('"'+id+'" avtobusunu silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteBusRegistryEntry', id:id, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      loadBusManagementData();
    });
  });
}
function admExportBusRegistry(){
  var filtered=admGetFilteredBusRegistry();
  if(filtered.length===0){ alert('Export üçün məlumat yoxdur'); return; }
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'bulkDeleteValidatorSN', snList:snList, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteValidatorSN', sn:sn, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
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

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'bulkDeleteSamCardSN', snList:snList, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
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
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteSamCardSN', sn:sn, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
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

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
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
  listEl.innerHTML=arr.map(function(val, idx){
    var safeVal=val.replace(/'/g,'');
    return '<div class="adm-reorder-row">'
      +'<span class="adm-reorder-num">'+(idx+1)+'</span>'
      +'<span class="adm-reorder-text">'+escapeHtml(val)+'</span>'
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
  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'moveBusListItem', sheetName:sheetName, value:value, direction:direction, requesterEmail: currentUser?currentUser.email:''})})
  .then(function(r){ return r.json(); })
  .then(function(d){
    if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
    admReloadBusListSource(sheetName);
  })
  .catch(function(e){ alert('Şəbəkə xətası: '+e.message); });
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

  var btn=document.getElementById('admBusListSaveBtn');
  btn.disabled=true; var origText=btn.textContent; btn.textContent='Yadda saxlanılır...';

  var payload = admBusListEditingValue
    ? { action:'updateBusListItem', sheetName:admBusListEditingSheet, oldValue:admBusListEditingValue, newValue:value, requesterEmail: currentUser?currentUser.email:'' }
    : { action:'addBusListItem', sheetName:admBusListEditingSheet, value:value, requesterEmail: currentUser?currentUser.email:'' };

  fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)})
  .then(function(r){ return r.json(); })
  .then(function(d){
    btn.disabled=false; btn.textContent=origText;
    if(d.status!=='OK'){ errEl.textContent=d.message||'Xəta baş verdi'; errEl.style.display='block'; return; }
    closeBusListModal();
    admReloadBusListSource(admBusListEditingSheet);
  })
  .catch(function(e){
    btn.disabled=false; btn.textContent=origText;
    errEl.textContent='Şəbəkə xətası: '+e.message; errEl.style.display='block';
  });
}
function admDeleteBusListItem(sheetName, value){
  var label=ADM_BUS_SHEET_LABEL[sheetName]||'dəyəri';
  admOpenDeleteConfirm('"'+value+'" '+label+'ni silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.', function(){
    return fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'deleteBusListItem', sheetName:sheetName, value:value, requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status!=='OK'){ alert(d.message||'Xəta baş verdi'); return; }
      admReloadBusListSource(sheetName);
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
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getCollectivesData' })
  })
  .then(function(r) { return r.json(); })
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

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'getCollectivesAdminData', requesterEmail: currentUser ? currentUser.email : '' })
  })
  .then(function(r) { return r.json(); })
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
  if(typeof XLSX==='undefined'){ alert('Excel kitabxanası yüklənməyib'); return; }
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

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json(); })
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
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteCollectiveMember', name: name, requesterEmail: currentUser ? currentUser.email : '' })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.status !== 'OK') {
        alert(d.message || 'Xəta baş verdi');
        return;
      }
      loadAdminCollectives();
    });
  });
}
