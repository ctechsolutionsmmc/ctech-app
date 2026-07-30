// ═══════════════════════════════════════════════════
// CORE.JS — Auth, Session, Clock, Navigation, Theme
// CTECH Service Platform
// ═══════════════════════════════════════════════════

// ── Qlobal dəyişənlər ──
var API_URL = "https://script.google.com/macros/s/AKfycbytFqFdrsHqKrD2YnurKsXATyjAMLbFAtV3gEcLxmPF_DjfGk2A9yyBrhs7XgoM-uYcbw/exec";
var currentUser = null;
var SESSION_KEY = "ctech_session";
var clockStarted = false;
var notifPollingStarted = false;
var _dotVisible = true;
var MOON_PATH = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
var SUN_PATH = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>';

// ── Session sabitləri ──
var IDLE_TIMEOUT_MS   = 60 * 60 * 1000;       // 1 saat fəaliyyətsizlik
var MAX_SESSION_MS    = 8  * 60 * 60 * 1000;  // 8 saat maksimum sessiya
var REMEMBER_ME_MS    = 14 * 24 * 60 * 60 * 1000; // 14 gün (Remember Me)

// ── Idle timer ──
var _idleTimer = null;
var _sessionTimer = null;

function resetIdleTimer(){
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(function(){
    signOut();
  }, IDLE_TIMEOUT_MS);
}

function startSessionTimer(expiresAt){
  clearTimeout(_sessionTimer);
  var remaining = expiresAt - Date.now();
  if(remaining <= 0){ signOut(); return; }
  _sessionTimer = setTimeout(function(){ signOut(); }, remaining);
}

function attachIdleListeners(){
  ['mousemove','keydown','mousedown','touchstart','scroll'].forEach(function(ev){
    document.addEventListener(ev, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

// ── Session idarəetməsi ──
function saveSession(u, rememberMe){
  var duration = rememberMe ? REMEMBER_ME_MS : MAX_SESSION_MS;
  var expiresAt = Date.now() + duration;
  try{
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      user: u,
      expires: expiresAt,
      rememberMe: !!rememberMe
    }));
  }catch(e){}
  return expiresAt;
}

function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
  clearTimeout(_idleTimer);
  clearTimeout(_sessionTimer);
}

function loadSession(){
  try{
    var r = localStorage.getItem(SESSION_KEY);
    if(!r) return null;
    var d = JSON.parse(r);
    if(Date.now() > d.expires){ clearSession(); return null; }
    return d;
  }catch(e){ return null; }
}

// ── Login xəta modalı ──
function showLoginError(msg){
  var el = document.getElementById('loginErrorText');
  if(el) el.textContent = msg;
  var modal = document.getElementById('loginErrorModal');
  if(modal) modal.style.display = 'flex';
}

function closeLoginError(){
  var modal = document.getElementById('loginErrorModal');
  if(modal) modal.style.display = 'none';
  var pw = document.getElementById('password');
  if(pw){ pw.value = ''; pw.focus(); }
}

// ── Login ──
function togglePassword(){
  var pw=document.getElementById('password');
  var icon=document.getElementById('eyeIcon');
  if(pw.type==='password'){ pw.type='text'; icon.innerHTML='<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.9 19.9 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>'; }
  else { pw.type='password'; icon.innerHTML='<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>'; }
}

function showLoading(){ var ov=document.getElementById('loadingOverlay'); if(ov){ ov.style.display='flex'; ov.classList.add('open'); } document.getElementById('loadingSpinner').style.display='block'; document.getElementById('successIcon').classList.remove('show'); document.getElementById('failIcon').classList.remove('show'); document.getElementById('loadingText').innerHTML='Yoxlanılır...'; }
function showLoadingSuccess(cb){ document.getElementById('loadingSpinner').style.display='none'; document.getElementById('successIcon').classList.add('show'); document.getElementById('loadingText').innerHTML='Uğurlu!'; setTimeout(function(){ var ov2=document.getElementById('loadingOverlay'); if(ov2){ ov2.classList.remove('open'); ov2.style.display='none'; } cb(); }, 700); }
function showLoadingFail(msg){
  document.getElementById('loadingSpinner').style.display='none';
  document.getElementById('failIcon').classList.add('show');
  document.getElementById('loadingText').innerHTML='Uğursuz';
  setTimeout(function(){
    document.getElementById('loadingOverlay').classList.remove('open');
    document.getElementById('loadingOverlay').style.display='none';
    var btn=document.getElementById('loginBtn');
    btn.disabled=false;
    btn.innerHTML='Daxil ol';
    showLoginError(msg);
  }, 700);
}

function login(){
  var email=document.getElementById('email').value;
  var password=document.getElementById('password').value;
  var btn=document.getElementById('loginBtn');
  if(!email){ showLoginError('Email daxil edin'); return; }
  if(!password){ showLoginError('Şifrəni daxil edin'); return; }
  btn.disabled=true; btn.innerHTML='Yoxlanılır...'; showLoading();
  fetch(API_URL,{ method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'checkUser',email:email,password:password}) })
  .then(function(r){return r.json();})
  .then(function(result){
    if(result.status==='OK'){
      currentUser=result;
      var rememberMe = document.getElementById('rememberMe').checked;
      var expiresAt = saveSession(result, rememberMe);
      showLoadingSuccess(function(){
        showDashboard();
        attachIdleListeners();
        startSessionTimer(expiresAt);
      });
    }
    else if(result.status==='WRONG_PASSWORD'){ showLoadingFail('Şifrə yanlışdır'); }
    else if(result.status==='LOCKED'){ showLoadingFail(result.message||'Hesabınız müvəqqəti bloklanmışdır.'); }
    else { showLoadingFail(result.debug?'Giriş rədd edildi:\n'+result.debug:'Bu hesab üçün giriş icazəsi yoxdur'); }
  })
  .catch(function(e){ showLoadingFail('Şəbəkə xətası: '+e.message); });
}

document.getElementById('password').addEventListener('keydown',function(e){ if(e.key==='Enter'){login();} });

// ── Dashboard ──
function showDashboard(){
  document.getElementById('loginView').style.display='none';
  document.getElementById('busServiceView').style.display='none';
  document.getElementById('dashboardView').style.display='block';
  document.getElementById('welcomeName').innerHTML='Xoş gəlmisiniz';
  document.getElementById('profileName').textContent=currentUser.name;
  document.getElementById('profileRole').textContent=currentUser.role;
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

// ── Saat ──
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

// ── Naviqasiya ──
function goHome(){ document.getElementById('loginView').style.display='none'; document.getElementById('busServiceView').style.display='none'; document.getElementById('dashboardView').style.display='block'; closeMenu(); }
function toggleMenu(){ document.getElementById('menuPanel').classList.toggle('open'); }
function closeMenu(){ document.getElementById('menuPanel').classList.remove('open'); }
function showAbout(){ closeMenu(); document.getElementById('aboutModal').classList.add('open'); }
function hideAbout(){ document.getElementById('aboutModal').classList.remove('open'); }
function toggleUserMenu(){ var dd=document.getElementById('ctdUserDropdown'); if(!dd)return; dd.classList.toggle('open'); }

function signOut(){
  closeMenu();
  clearSession();
  currentUser=null;
  // Refresh-flash önləyici sinifi sil (yoxsa loginView !important ilə gizli qalır)
  document.documentElement.classList.remove('has-session');
  // CTD dropdown açıq qalıbsa bağla
  var ctdDD = document.getElementById('ctdUserDropdown');
  if(ctdDD) ctdDD.classList.remove('open');
  // Remember Me sıfırla
  var rm=document.getElementById('rememberMe');
  if(rm) rm.checked=false;
  // Login formu təmizlə
  document.getElementById('email').value='';
  document.getElementById('password').value='';
  var btn=document.getElementById('loginBtn');
  btn.disabled=false;
  btn.innerHTML='Daxil ol';
  // Bütün view-ları bağla (router varsa hamısını, yoxdursa əsasları)
  if(typeof routerHideAll === 'function'){
    routerHideAll();
  } else {
    document.getElementById('dashboardView').style.display='none';
    document.getElementById('busServiceView').style.display='none';
  }
  // Login-i MÜTLƏQ göstər — CSS-in default cascade-inə güvənmə, sərt təyin et
  // (mobil ≤900px üçün 'block', desktop üçün 'flex' — login.css-dəki media query ilə eyni)
  var lv = document.getElementById('loginView');
  lv.style.display = (window.innerWidth <= 900) ? 'block' : 'flex';
  // URL-i təmizlə
  try{ history.replaceState({ route:'login' }, '', window.location.pathname); }catch(e){}
  if(typeof _currentRoute !== 'undefined') _currentRoute = 'dashboard';
  if(typeof ROUTER_READY !== 'undefined') ROUTER_READY = false; // hər hansı gecikmiş routerNavigate çağırışının qarşısını al

  // Bir tick sonra YENİDƏN yoxla — hər hansı gecikmiş kod loginView-u gizlətsə, geri qaytar
  setTimeout(function(){
    var lv2 = document.getElementById('loginView');
    if(lv2 && getComputedStyle(lv2).display === 'none'){
      lv2.style.display = (window.innerWidth <= 900) ? 'block' : 'flex';
    }
    if(typeof ROUTER_READY !== 'undefined') ROUTER_READY = true;
  }, 250);
}

function moduleAlert(n){ alert(n+' modulu tezliklə hazır olacaq'); }

document.addEventListener('click',function(e){ var panel=document.getElementById('menuPanel'); if(!panel)return; if(!panel.contains(e.target)&&!e.target.closest('.icon-btn'))closeMenu(); });
document.addEventListener('click',function(e){ var chip=document.getElementById('ctdUserChip'); var dd=document.getElementById('ctdUserDropdown'); if(!dd||!chip)return; if(!chip.contains(e.target))dd.classList.remove('open'); });

// ── Tema ──
function applyTheme(isDark){
  var icons=[document.getElementById('themeIcon'),document.getElementById('rptThemeIcon'),document.getElementById('dashThemeIcon'),document.getElementById('bkThemeIcon'),document.getElementById('tvmRptThemeIcon'),document.getElementById('ctdThemeIcon')];
  icons.forEach(function(icon){ if(!icon)return; icon.innerHTML=isDark?SUN_PATH:MOON_PATH; });
  if(isDark){document.body.classList.add('dark-mode');}else{document.body.classList.remove('dark-mode');}
  var collBtn = document.getElementById('collectivesBtn');
  if(collBtn) collBtn.style.color = isDark ? '#E8EEF5' : '#12233B';
}
function updateCollectivesBtnVisibility(){
  var collBtn = document.getElementById('collectivesBtn');
  if(collBtn) collBtn.style.display = 'none';
  var sidebarBtn = document.getElementById('sidebarCollectivesBtn');
  if(sidebarBtn) sidebarBtn.style.display = (window.innerWidth >= 901) ? 'flex' : 'none';
}
window.addEventListener('resize', updateCollectivesBtnVisibility);
function toggleTheme(){ if(window.innerWidth>=901)return; var isDark=!document.body.classList.contains('dark-mode'); applyTheme(isDark); try{localStorage.setItem('ctech_theme',isDark?'dark':'light');}catch(e){} }

// ── Köməkçi ──
function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Service Worker təmizlənməsi ──
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

// ── Session yükləmə (səhifə açılanda) ──
// DİQQƏT: setTimeout(...,0) ilə növbəti "tick"-ə keçirilir ki, bütün digər
// scriptlər (bus-request.js və s.) artıq yüklənmiş olsun. Əks halda
// preloadValidatorSNList() kimi digər fayllardakı funksiyalar hələ mövcud
// olmadığı üçün səssizcə keçilir və bir daha çağırılmır.
var _savedSession = loadSession();
if(_savedSession && _savedSession.user && _savedSession.user.email){
  currentUser = _savedSession.user;
  setTimeout(function(){
    showDashboard();
    attachIdleListeners();
    startSessionTimer(_savedSession.expires);
  }, 0);
} else if(_savedSession){
  clearSession();
}
try{ var savedTheme=localStorage.getItem('ctech_theme'); if(savedTheme==='dark'&&window.innerWidth<901){applyTheme(true);} }catch(e){}
