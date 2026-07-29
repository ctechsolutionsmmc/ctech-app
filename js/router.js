// ═══════════════════════════════════════════════════════════════
// ROUTER.JS — Hash-based SPA Router
// CTECH Service Platform
// Mövcud open/close funksiyalarına toxunmadan history idarəsi
// ═══════════════════════════════════════════════════════════════

var ROUTER_READY = false;
var _routerIgnoreNext = false; // proqramatik hash dəyişəndə popstate-i keç

// ── Bütün view ID-ləri ──
var ALL_VIEWS = [
  'loginView','dashboardView','busServiceView','tvmServiceView',
  'busReportView','tvmReportView','busDashboardView','busOngoingView',
  'busRequestView','busBulkView','adminPanelView','notifView',
  'collectivesView','busDetailView','tvmDetailView'
];

// ── Hash → view açma funksiyası xəritəsi ──
// Hər hash üçün: { open: fn, close: fn, authCheck: fn }
function routerGetMap(){
  return {
    'dashboard':    { open: function(){ goHome(); },                          needsAuth: true  },
    'bus-service':  { open: function(){ openBusService(); },                  needsAuth: true  },
    'tvm-service':  { open: function(){ openTvmService(); },                  needsAuth: true  },
    'bus-report':   { open: function(){ openBusReport(); },                   needsAuth: true  },
    'tvm-report':   { open: function(){ openTvmReport(); },                   needsAuth: true  },
    'bus-dashboard':{ open: function(){ openBusDashboard(); },                needsAuth: true  },
    'bus-ongoing':  { open: function(){ openBusOngoing(); },                  needsAuth: true  },
    'bus-request':  { open: function(){ openBusRequest(); },                  needsAuth: true,
                      desktopOnly: true },
    'bus-bulk':     { open: function(){ openBusBulk(); },                     needsAuth: true,
                      desktopOnly: true },
    'admin':        { open: function(){ openAdminPanel(); },                  needsAuth: true,
                      desktopOnly: true },
    'notifications':{ open: function(){ openNotifications(); },               needsAuth: true,
                      mobileOnly: true  },
    'collectives':  { open: function(){ openCollectives(); },                 needsAuth: true,
                      desktopOnly: true }
  };
}

// ── Cari hash-i oxu (# olmadan) ──
function routerCurrentHash(){
  var h = window.location.hash.replace('#','').split('/')[0];
  return h || 'dashboard';
}

// ── Detail ID-ni oxu: #bus-detail/BUS-00123 → BUS-00123 ──
function routerDetailId(){
  var parts = window.location.hash.replace('#','').split('/');
  return parts[1] || null;
}

// ── Hash dəyiş (history-ə əlavə et) ──
function routerPush(hash){
  if(window.location.hash === '#'+hash) return;
  _routerIgnoreNext = false;
  window.location.hash = hash;
}

// ── Hash dəyiş (history-ə əlavə etmədən — replace) ──
function routerReplace(hash){
  _routerIgnoreNext = true;
  history.replaceState(null, '', '#'+hash);
}

// ── Bütün view-ları bağla (loginView xaric) ──
function routerHideAll(){
  ALL_VIEWS.forEach(function(id){
    if(id === 'loginView') return;
    var el = document.getElementById(id);
    if(!el) return;
    el.style.display = 'none';
  });
}

// ── Əsas navigate funksiyası ──
function routerNavigate(hash, fromPopState){
  if(!ROUTER_READY) return;

  // Login tələb edir amma user yoxdur
  if(!currentUser){
    routerReplace('login');
    return;
  }

  var map = routerGetMap();

  // Detail view-lar
  if(hash.indexOf('bus-detail') === 0){
    var bid = routerDetailId();
    if(bid && typeof openBusDetail === 'function'){
      openBusDetail(bid);
    }
    return;
  }
  if(hash.indexOf('tvm-detail') === 0){
    var tid = routerDetailId();
    if(tid && typeof openTvmDetail === 'function'){
      openTvmDetail(tid);
    }
    return;
  }

  var route = map[hash];
  if(!route){
    // Naməlum hash → dashboard-a yönləndir
    routerReplace('dashboard');
    routerNavigate('dashboard', false);
    return;
  }

  // Desktop-only yoxlaması
  if(route.desktopOnly && window.innerWidth < 901){
    routerReplace('dashboard');
    routerNavigate('dashboard', false);
    return;
  }

  // Mobile-only yoxlaması
  if(route.mobileOnly && window.innerWidth >= 901){
    routerReplace('dashboard');
    routerNavigate('dashboard', false);
    return;
  }

  route.open();
}

// ── popstate (Back/Forward düyməsi + iPhone swipe) ──
window.addEventListener('popstate', function(){
  if(_routerIgnoreNext){ _routerIgnoreNext = false; return; }
  var hash = routerCurrentHash();

  // Unsaved work yoxlaması
  if(typeof isUnsavedWorkPresent === 'function' && isUnsavedWorkPresent()){
    // Geri getməni bloklayıb confirm göstər
    history.pushState(null, '', window.location.href);
    if(typeof showUnsavedWarning === 'function') showUnsavedWarning();
    return;
  }

  routerNavigate(hash, true);
});

// ── Wrapper-lər: mövcud open funksiyaları çağırıldıqda hash-i yenilə ──
// Bu pattern ilə mövcud JS-ə toxunmuruq, sadəcə sonradan override edirik

function _routerWrap(originalFnName, hash, originalFn){
  return function(){
    var result = originalFn.apply(this, arguments);
    if(currentUser) routerPush(hash);
    return result;
  };
}

// ── Router-i başlat (bütün JS faylları yüklənəndən sonra) ──
function initRouter(){
  ROUTER_READY = true;

  var map = routerGetMap();

  // openBusService
  if(typeof openBusService === 'function'){
    var _obs = openBusService;
    openBusService = function(){ _obs.apply(this,arguments); if(currentUser) routerPush('bus-service'); };
  }
  // openTvmService
  if(typeof openTvmService === 'function'){
    var _ots = openTvmService;
    openTvmService = function(){ _ots.apply(this,arguments); if(currentUser) routerPush('tvm-service'); };
  }
  // openBusReport
  if(typeof openBusReport === 'function'){
    var _obr = openBusReport;
    openBusReport = function(){ _obr.apply(this,arguments); if(currentUser) routerPush('bus-report'); };
  }
  // openTvmReport
  if(typeof openTvmReport === 'function'){
    var _otr = openTvmReport;
    openTvmReport = function(){ _otr.apply(this,arguments); if(currentUser) routerPush('tvm-report'); };
  }
  // openBusDashboard
  if(typeof openBusDashboard === 'function'){
    var _obd = openBusDashboard;
    openBusDashboard = function(){ _obd.apply(this,arguments); if(currentUser) routerPush('bus-dashboard'); };
  }
  // openBusOngoing
  if(typeof openBusOngoing === 'function'){
    var _obo = openBusOngoing;
    openBusOngoing = function(){ _obo.apply(this,arguments); if(currentUser) routerPush('bus-ongoing'); };
  }
  // openBusRequest
  if(typeof openBusRequest === 'function'){
    var _obreq = openBusRequest;
    openBusRequest = function(){ _obreq.apply(this,arguments); if(currentUser) routerPush('bus-request'); };
  }
  // openBusBulk
  if(typeof openBusBulk === 'function'){
    var _obb = openBusBulk;
    openBusBulk = function(){ _obb.apply(this,arguments); if(currentUser) routerPush('bus-bulk'); };
  }
  // openAdminPanel
  if(typeof openAdminPanel === 'function'){
    var _oadm = openAdminPanel;
    openAdminPanel = function(){ _oadm.apply(this,arguments); if(currentUser) routerPush('admin'); };
  }
  // openNotifications
  if(typeof openNotifications === 'function'){
    var _on = openNotifications;
    openNotifications = function(){ _on.apply(this,arguments); if(currentUser) routerPush('notifications'); };
  }
  // openCollectives
  if(typeof openCollectives === 'function'){
    var _oc = openCollectives;
    openCollectives = function(){ _oc.apply(this,arguments); if(currentUser) routerPush('collectives'); };
  }
  // openBusDetail
  if(typeof openBusDetail === 'function'){
    var _obdet = openBusDetail;
    openBusDetail = function(ticketId){
      _obdet.apply(this,arguments);
      if(currentUser && ticketId) routerPush('bus-detail/'+ticketId);
    };
  }
  // openTvmDetail
  if(typeof openTvmDetail === 'function'){
    var _otdet = openTvmDetail;
    openTvmDetail = function(ticketId){
      _otdet.apply(this,arguments);
      if(currentUser && ticketId) routerPush('tvm-detail/'+ticketId);
    };
  }
  // goHome / dashboard
  if(typeof goHome === 'function'){
    var _gh = goHome;
    goHome = function(){ _gh.apply(this,arguments); if(currentUser) routerPush('dashboard'); };
  }
  // showDashboard (login sonrası)
  if(typeof showDashboard === 'function'){
    var _sd = showDashboard;
    showDashboard = function(){
      _sd.apply(this,arguments);
      // Hash-dən restore et
      var hash = routerCurrentHash();
      if(hash && hash !== 'dashboard' && hash !== 'login'){
        setTimeout(function(){ routerNavigate(hash, false); }, 100);
      } else {
        routerPush('dashboard');
      }
    };
  }

  // Refresh zamanı cari hash-dən view-u restore et
  var startHash = routerCurrentHash();
  if(currentUser && startHash && startHash !== 'login'){
    setTimeout(function(){ routerNavigate(startHash, false); }, 150);
  } else if(currentUser){
    routerReplace('dashboard');
  }
}

// ── Sağ klik "Open in new tab" dəstəyi ──
// onclick olan elementlərə avtomatik href əlavə edir
var ONCLICK_HASH_MAP = {
  'openBusService':   'bus-service',
  'startBusService':  'bus-service',
  'openTvmService':   'tvm-service',
  'openBusReport':    'bus-report',
  'openTvmReport':    'tvm-report',
  'openBusDashboard': 'bus-dashboard',
  'openBusOngoing':   'bus-ongoing',
  'openBusRequest':   'bus-request',
  'openBusBulk':      'bus-bulk',
  'openAdminPanel':   'admin',
  'openNotifications':'notifications',
  'openCollectives':  'collectives'
};

function applyHrefToClickables(){
  var allClickable = document.querySelectorAll('[onclick]');
  allClickable.forEach(function(el){
    var oc = el.getAttribute('onclick') || '';
    Object.keys(ONCLICK_HASH_MAP).forEach(function(fnName){
      if(oc.indexOf(fnName) !== -1){
        var hash = ONCLICK_HASH_MAP[fnName];
        // <a> elementə çevir ki sağ klik işləsin
        if(el.tagName !== 'A'){
          el.setAttribute('href', '#'+hash);
          // Normal klikdə default href davranışını bloklayıb router işlətmə
          // (router artıq hash dəyişikliyini tutur, ikiqat açılmasın)
          el.addEventListener('click', function(e){
            // Yeni tabda açmaq üçün Ctrl/Cmd + klik və ya orta klik keç
            if(e.ctrlKey || e.metaKey || e.button === 1) return;
            e.preventDefault();
          }, { passive: false });
        }
      }
    });
  });
}

// DOM hazır olandan sonra başlat
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    initRouter();
    applyHrefToClickables();
  }, 0);
});
