// ═══════════════════════════════════════════════════
// CORE.JS — Auth, Session, Clock, Navigation, Theme
// CTECH Service Platform
// ═══════════════════════════════════════════════════

// ── Qlobal dəyişənlər ──
var API_URL = "https://script.google.com/macros/s/AKfycby7rOjeLccsAlKPRlmeuysbNkHGijAqfXqZGZ2W9X1IbLgSa7d0RKez6l3pkPwlrVCdsw/exec";
var currentUser = null;
var SESSION_KEY = "ctech_session";
var clockStarted = false;
var notifPollingStarted = false;
var dashStatsPollingStarted = false;
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
  ['keydown','mousedown','touchstart','scroll'].forEach(function(ev){
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

// ── FAZA 2: Token əsaslı auth ──
// Login-də backend token qaytarır (checkUser) və o, saveSession vasitəsilə
// sessiyada saxlanılır. Bütün API sorğularına buradan avtomatik əlavə olunur.
function getAuthToken(){
  if(currentUser && currentUser.token) return currentUser.token;
  var s = loadSession();
  return (s && s.user && s.user.token) ? s.user.token : null;
}

// AUTH_EXPIRED yoxlaması ağır oxuma aksiyalarında iki dəfə JSON.parse
// etməsin deyə onlar atlanır (token bitdikdə onlar sadəcə xəta qaytarır;
// login ekranı növbəti yazma əməliyyatında çıxır).
var AUTH_EXPIRED_SKIP_ACTIONS = { getReportData:1, getTvmReportData:1, getDashboardData:1, getFormData:1, getTvmFormData:1, getNextTicketIds:1, getUsersData:1, getBusManagementData:1, getTvmManagementData:1, getCollectivesAdminData:1, getValidatorSNList:1, getSamCardSNList:1, getAdminListData:1, logAppUpdate:1, getHomeDashData:1 };

// window.fetch-i bükür: hər API sorğusuna token əlavə edir və sessiya
// bitibsə (AUTH_EXPIRED) istifadəçini login-ə yönləndirir.
var _coreFetch = window.fetch.bind(window);
window.fetch = function(url, opts){
  opts = opts || {};
  var token = getAuthToken();
  var action = '';
  if(token && opts.body && typeof opts.body === 'string'){
    try{
      var payload = JSON.parse(opts.body);
      if(payload && typeof payload === 'object'){
        action = payload.action || '';
        if(!payload.token){
          payload.token = token;
          opts.body = JSON.stringify(payload);
        }
      }
    }catch(parseErr){}
  }
  var p = _coreFetch(url, opts);
  if(!token || !action || AUTH_EXPIRED_SKIP_ACTIONS[action]) return p;
  return p.then(function(res){
    try{
      var ct = res.headers.get('content-type') || '';
      if(ct.indexOf('application/json') !== -1){
        return res.clone().json().then(function(d){
          if(d && d.status === 'AUTH_EXPIRED'){ sessionExpired(); }
          return res;
        }).catch(function(){ return res; });
      }
    }catch(ctErr){}
    return res;
  });
};

function sessionExpired(){
  clearSession();
  currentUser = null;
  showLoginError('Sessiya müddəti bitib. Zəhmət olmasa yenidən daxil olun.');
  try{
    if(typeof routerHideAll === 'function') routerHideAll();
    var lv = document.getElementById('loginView');
    if(lv) lv.style.display = (window.innerWidth <= 900) ? 'block' : 'flex';
    try{ history.replaceState({ route:'login' }, '', window.location.pathname); }catch(hErr){}
    if(typeof ROUTER_READY !== 'undefined') ROUTER_READY = false;
  }catch(e){}
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
function showLoadingSuccess(cb){ document.getElementById('loadingSpinner').style.display='none'; document.getElementById('successIcon').classList.add('show'); document.getElementById('loadingText').innerHTML='Uğurlu!'; // Yalnız uğur ikonasının görünməsi üçün qısa pauza — dashboard-u 700ms gecikdirən köhnə süni gözləmə silindi.
  setTimeout(function(){ var ov2=document.getElementById('loadingOverlay'); if(ov2){ ov2.classList.remove('open'); ov2.style.display='none'; } cb(); }, 200); }
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
        // Yenilənmə yoxlaması — login olduqdan sonra (yenisi varsa məcburi ekran çıxır)
        if(typeof checkForAppUpdate==='function') checkForAppUpdate();
      });
    }
    else if(result.status==='LOCKED'){ showLoadingFail(result.message||'Hesabınız müvəqqəti bloklanmışdır.'); }
    // FAZA 2: yanlış şifrə və naməlum email EYNİ cavabı (DENIED) alır —
    // email enumeration bağlıdır, ona görə mesaj da vahiddir.
    else { showLoadingFail('Email və ya şifrə yanlışdır'); }
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
  // Əsas statistikalar dərhal çəkilir (indi tək backend çağırışı — getHomeDashData).
  if(typeof loadHomeDashStats==='function') loadHomeDashStats();
  // Köməkçi yükləmələr ardıcıl gecikdirmə ilə gedir — əvvəl login anında eyni anda
  // 5-6 GAS sorğusu atılırdı, backend növbəyə düşüb login + dashboard göstərilməsini ləngidirdi.
  setTimeout(function(){ if(typeof preloadNotifications==='function') preloadNotifications(); }, 1500);
  setTimeout(function(){ if(typeof preloadValidatorSNList==='function') preloadValidatorSNList(); }, 3000);
  if(!notifPollingStarted){
    notifPollingStarted = true;
    setInterval(function(){
      if(typeof preloadNotifications==='function') preloadNotifications();
    }, 120000);
  }
  if(!dashStatsPollingStarted){
    dashStatsPollingStarted = true;
    setInterval(function(){
      if(typeof loadHomeDashStats==='function') loadHomeDashStats();
    }, 180000);
  }
  if(!clockStarted){ clockStarted=true; updateClock(); setInterval(updateClock,1000); }
}

function getAccessLevel(role){ var r=(role||'').toLowerCase(); if(r.indexOf('admin')!==-1)return'admin'; if(r.indexOf('call center')!==-1||r.indexOf('callcenter')!==-1)return'callcenter'; if(r.indexOf('guest')!==-1)return'guest'; if(r.indexOf('team')!==-1||r.indexOf('leader')!==-1||r.indexOf('rəhbər')!==-1)return'leader'; return'technician'; }
function isGuestBakikart(role){ return (role||'').toLowerCase().indexOf('bakikart')!==-1; }

function applyAccessLevel(){
  var level=getAccessLevel(currentUser.role);
  var isLeaderOrAdmin=(level==='leader'||level==='admin');

  // ── GUEST (AYNA / Bakikart) — sadə, məhdud görünüş ──
  if(level==='guest'){
    var ctdHeroG=document.getElementById('ctdHero'); if(ctdHeroG) ctdHeroG.classList.add('guest-hero');
    var elDashSec=document.getElementById('dashboardsSection'); if(elDashSec) elDashSec.style.display='none';
    document.getElementById('reportsSection').style.display='none';
    document.getElementById('adminMenuItem').style.display='none';
    var brBtnG=document.getElementById('busRequestQuickBtn'); if(brBtnG) brBtnG.style.display='none';
    var ctdAdminBtnG=document.getElementById('ctdAdminBtn'); if(ctdAdminBtnG) ctdAdminBtnG.style.display='none';
    var ctdBrBtnG=document.getElementById('ctdBrBtn'); if(ctdBrBtnG) ctdBrBtnG.style.display='none';
    var ctdBulkBtnG=document.getElementById('ctdBulkBtn'); if(ctdBulkBtnG) ctdBulkBtnG.style.display='none';

    // Normal bölmələri tam gizlət
    var wrapEl=document.getElementById('ctdContentTopWrap'); if(wrapEl) wrapEl.style.display='none';
    var banner2El=document.getElementById('ctdBanner2Section'); if(banner2El) banner2El.style.display='none';
    var contEl=document.getElementById('dashboardContainer'); if(contEl) contEl.style.display='none';
    var footEl=document.getElementById('ctdFooter'); if(footEl) footEl.style.display='none';

    // "Heyət haqqında" və "Tətbiq haqqında" gizlət
    var collBtnG=document.getElementById('ctdCollectivesBtn'); if(collBtnG) collBtnG.style.display='none';
    var aboutBtnG=document.getElementById('ctdAboutBtn'); if(aboutBtnG) aboutBtnG.style.display='none';
    var aboutSepG=document.getElementById('ctdAboutSep'); if(aboutSepG) aboutSepG.style.display='none';

    // Alt yazını sadələşdir
    var subW=document.getElementById('ctdSubwelcome'); if(subW) subW.textContent='Servislərin ümumi vəziyyəti aşağıda göstərilir.';

    // Guest kart bölməsini göstər
    var guestCards=document.getElementById('guestDashboardCards'); if(guestCards) guestCards.style.display='block';
    var guestTvmCard=document.getElementById('guestTvmDashboardCard');
    if(guestTvmCard) guestTvmCard.style.display = isGuestBakikart(currentUser.role) ? 'flex' : 'none';

    return;
  }

  // ── CALL CENTER — Bus əməliyyatları + TVM service/request + real-time hesabatlar ──
  // Dashboard (BUS/TVM) və Admin panel GİZLİ;
  // Bus: Yeni müraciət / Yeni servis / Davam edən / Toplu idxal GÖRÜNÜR;
  // TVM: Yeni müraciət / Yeni servis GÖRÜNÜR, TVM dashboard GİZLİ.
  if(level==='callcenter'){
    var ccHero=document.getElementById('ctdHero'); if(ccHero) ccHero.classList.remove('guest-hero');
    document.getElementById('dashboardsSection').style.display='none';
    document.getElementById('reportsSection').style.display='block';
    document.getElementById('adminMenuItem').style.display='none';
    var ccAdminBtn=document.getElementById('ctdAdminBtn'); if(ccAdminBtn) ccAdminBtn.style.display='none';
    var ccBrBtn=document.getElementById('ctdBrBtn'); if(ccBrBtn) ccBrBtn.style.display='flex';
    var ccBulkBtn=document.getElementById('ctdBulkBtn'); if(ccBulkBtn) ccBulkBtn.style.display='flex';
    var ccBrQuick=document.getElementById('busRequestQuickBtn');
    if(ccBrQuick) ccBrQuick.style.display=(window.innerWidth>=901)?'inline-flex':'none';
    var ccTvmMod=document.getElementById('ctdTvmServiceModule'); if(ccTvmMod) ccTvmMod.style.display='';
    var ccTvmDash=document.getElementById('ctdTvmDashTile'); if(ccTvmDash) ccTvmDash.style.display='none';
    var ccTvmRpt=document.getElementById('ctdTvmRptTile'); if(ccTvmRpt) ccTvmRpt.style.display='';
    var ccBusDashW=document.getElementById('ctdBusDashWidget'); if(ccBusDashW) ccBusDashW.style.display='none';
    var ccBusRptW=document.getElementById('ctdBusRptWidget'); if(ccBusRptW) ccBusRptW.style.display='';
    var ccGuestCards=document.getElementById('guestDashboardCards'); if(ccGuestCards) ccGuestCards.style.display='none';
    return;
  }

  document.getElementById('dashboardsSection').style.display=(level==='technician'||window.innerWidth<901)?'none':'block';
  document.getElementById('reportsSection').style.display='block';
  var ctdHeroN=document.getElementById('ctdHero'); if(ctdHeroN) ctdHeroN.classList.remove('guest-hero');

  // ── Guest görünüşündən qalan hər şeyi sıfırla (əvvəlki sessiyada guest test edilibsə) ──
  var wrapElN=document.getElementById('ctdContentTopWrap'); if(wrapElN) wrapElN.style.display='';
  var banner2ElN=document.getElementById('ctdBanner2Section'); if(banner2ElN) banner2ElN.style.display='';
  var contElN=document.getElementById('dashboardContainer'); if(contElN) contElN.style.display='';
  var footElN=document.getElementById('ctdFooter'); if(footElN) footElN.style.display='';
  var aboutBtnN=document.getElementById('ctdAboutBtn'); if(aboutBtnN) aboutBtnN.style.display='';
  var aboutSepN=document.getElementById('ctdAboutSep'); if(aboutSepN) aboutSepN.style.display='';
  var collBtnN=document.getElementById('ctdCollectivesBtn'); if(collBtnN) collBtnN.style.display='';
  var subWN=document.getElementById('ctdSubwelcome'); if(subWN) subWN.textContent='Servislərin ümumi vəziyyəti aşağıda göstərilir.';
  var guestCardsN=document.getElementById('guestDashboardCards'); if(guestCardsN) guestCardsN.style.display='none';
  // Call Center sessiyasından qalan gizlətmələri sıfırla (rol dəyişəndə)
  var ccTvmModN=document.getElementById('ctdTvmServiceModule'); if(ccTvmModN) ccTvmModN.style.display='';
  var ccTvmDashN=document.getElementById('ctdTvmDashTile'); if(ccTvmDashN) ccTvmDashN.style.display='';
  var ccTvmRptN=document.getElementById('ctdTvmRptTile'); if(ccTvmRptN) ccTvmRptN.style.display='';
  var ccBusDashWN=document.getElementById('ctdBusDashWidget'); if(ccBusDashWN) ccBusDashWN.style.display='';
  var ccBusRptWN=document.getElementById('ctdBusRptWidget'); if(ccBusRptWN) ccBusRptWN.style.display='';

  document.getElementById('adminMenuItem').style.display=(isLeaderOrAdmin && window.innerWidth>=901)?'flex':'none';
  var brBtn=document.getElementById('busRequestQuickBtn');
  if(brBtn){
    var showBr=isLeaderOrAdmin && window.innerWidth>=901;
    brBtn.style.display = showBr ? 'inline-flex' : 'none';
    if(showBr && typeof brLoadAssignableTechnicians==='function') brLoadAssignableTechnicians();
  }
  var ctdAdminBtn=document.getElementById('ctdAdminBtn');
  if(ctdAdminBtn) ctdAdminBtn.style.display=isLeaderOrAdmin?'flex':'none';
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

  // FAZA 2: backend tokenini dərhal ləğv et — oğurlanmış token çıxışdan sonra işləməsin
  var outTok = getAuthToken();
  if(outTok){
    try{ fetch(API_URL,{ method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'logout', token:outTok}) }).catch(function(){}); }catch(loErr){}
  }

  // "Çıxış..." vidjeti göstər — mövcud dashLoading overlay-i yenidən istifadə edirik,
  // mətnini müvəqqəti dəyişib sonra geri qaytarırıq ki, başqa yerlərdə ("Hazırlanır...")
  // istifadə olunan mətnə təsir etməsin.
  var loading = document.getElementById('dashLoading');
  var loadingTextEl = loading ? loading.querySelector('.dash-loading-text') : null;
  var originalLoadingText = loadingTextEl ? loadingTextEl.textContent : null;
  if(loadingTextEl) loadingTextEl.textContent = 'Çıxış...';
  if(loading) loading.style.display = 'flex';

  setTimeout(function(){
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

    // Vidjeti gizlət, mətni geri qaytar
    if(loading) loading.style.display = 'none';
    if(loadingTextEl && originalLoadingText !== null) loadingTextEl.textContent = originalLoadingText;

    // Bir tick sonra YENİDƏN yoxla — hər hansı gecikmiş kod loginView-u gizlətsə, geri qaytar
    setTimeout(function(){
      var lv2 = document.getElementById('loginView');
      if(lv2 && getComputedStyle(lv2).display === 'none'){
        lv2.style.display = (window.innerWidth <= 900) ? 'block' : 'flex';
      }
      if(typeof ROUTER_READY !== 'undefined') ROUTER_READY = true;
    }, 250);
  }, 650);
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

// ── Excel kitabxanası (xlsx) — yalnız "Export" düyməsi basılanda yüklənir ──
// Əvvəllər hər səhifə açılışında <head>-də sinxron yüklənirdi (~900KB) və
// ilk göstərilməni BLOCK edirdi. İndi lazım olanda, birdəfəlik yüklənir və
// sonrakı Export-lar üçün brauzer keşində qalır.
var _xlsxLoading = null;
function ensureXlsx(cb){
  if(typeof XLSX!=='undefined'){ if(cb) cb(); return; }
  if(!_xlsxLoading){
    _xlsxLoading = new Promise(function(resolve, reject){
      var s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload=function(){ resolve(); };
      s.onerror=function(){ reject(new Error('xlsx load failed')); };
      document.head.appendChild(s);
    });
  }
  if(cb){
    _xlsxLoading.then(cb).catch(function(){
      // Uğursuz yüklənməni keşləmə — növbəti cəhddə yenidən yükləməyə çalış
      _xlsxLoading = null;
      alert('Excel kitabxanası yüklənə bilmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.');
    });
  }
}

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
    // Yenilənmə yoxlaması — sessiya bərpa olunanda da (login olmadan)
    if(typeof checkForAppUpdate==='function') checkForAppUpdate();
  }, 0);
} else if(_savedSession){
  clearSession();
}
try{ var savedTheme=localStorage.getItem('ctech_theme'); if(savedTheme==='dark'&&window.innerWidth<901){applyTheme(true);} }catch(e){}
