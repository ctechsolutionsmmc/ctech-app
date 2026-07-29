// ═══════════════════════════════════════════════════════════════
// ROUTER.JS — SPA Router (pushState + hash)
// CTECH Service Platform
// Safari swipe-back, Android back, URL sync, scroll reset
// ═══════════════════════════════════════════════════════════════

var ROUTER_READY = false;
var _currentRoute = 'dashboard';
var _isNavigating = false;

// ── Bütün view ID-ləri ──
var ALL_VIEWS = [
  'loginView','dashboardView','busServiceView','tvmServiceView',
  'busReportView','tvmReportView','busDashboardView','busOngoingView',
  'busRequestView','busBulkView','adminPanelView','notifView',
  'collectivesView','busDetailView','tvmDetailView'
];

// ── Route xəritəsi ──
function routerGetMap(){
  return {
    'dashboard':     { open: _openDashboardRaw,    needsAuth: true },
    'bus-service':   { open: function(){ typeof openBusService === 'function' && openBusService._orig && openBusService._orig(); },   needsAuth: true },
    'tvm-service':   { open: function(){ typeof openTvmService === 'function' && openTvmService._orig && openTvmService._orig(); },   needsAuth: true },
    'bus-report':    { open: function(){ typeof openBusReport === 'function' && openBusReport._orig && openBusReport._orig(); },      needsAuth: true },
    'tvm-report':    { open: function(){ typeof openTvmReport === 'function' && openTvmReport._orig && openTvmReport._orig(); },      needsAuth: true },
    'bus-dashboard': { open: function(){ typeof openBusDashboard === 'function' && openBusDashboard._orig && openBusDashboard._orig(); }, needsAuth: true },
    'bus-ongoing':   { open: function(){ typeof openBusOngoing === 'function' && openBusOngoing._orig && openBusOngoing._orig(); },   needsAuth: true },
    'bus-request':   { open: function(){ typeof openBusRequest === 'function' && openBusRequest._orig && openBusRequest._orig(); },   needsAuth: true, desktopOnly: true },
    'bus-bulk':      { open: function(){ typeof openBusBulk === 'function' && openBusBulk._orig && openBusBulk._orig(); },            needsAuth: true, desktopOnly: true },
    'admin':         { open: function(){ typeof openAdminPanel === 'function' && openAdminPanel._orig && openAdminPanel._orig(); },   needsAuth: true, desktopOnly: true },
    'notifications': { open: function(){ typeof openNotifications === 'function' && openNotifications._orig && openNotifications._orig(); }, needsAuth: true, mobileOnly: true },
    'collectives':   { open: function(){ typeof openCollectives === 'function' && openCollectives._orig && openCollectives._orig(); }, needsAuth: true, desktopOnly: true }
  };
}

// ── Raw dashboard açma (router loop olmadan) ──
function _openDashboardRaw(){
  var dv = document.getElementById('dashboardView');
  var lv = document.getElementById('loginView');
  var bv = document.getElementById('busServiceView');
  if(lv) lv.style.display = 'none';
  if(bv) bv.style.display = 'none';
  if(dv) dv.style.display = 'block';
}

// ── URL-dən hash oxu ──
function _getHashFromUrl(){
  var h = window.location.hash.replace('#','').trim();
  return h || 'dashboard';
}

function _getDetailId(){
  var parts = window.location.hash.replace('#','').split('/');
  return parts[1] || null;
}

// ── Bütün view-ları bağla + scroll sıfırla ──
function routerHideAll(){
  ALL_VIEWS.forEach(function(id){
    if(id === 'loginView') return;
    var el = document.getElementById(id);
    if(!el) return;
    el.style.display = 'none';
    el.scrollTop = 0;
  });
  window.scrollTo(0,0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

// ── Əsas navigate: view-u aç, URL-i yenilə ──
function routerNavigate(route, pushToHistory){
  if(!ROUTER_READY || !currentUser) return;
  if(_isNavigating) return;
  _isNavigating = true;

  var base = route.split('/')[0];
  var detailId = route.indexOf('/') !== -1 ? route.split('/')[1] : null;

  var map = routerGetMap();

  // Desktop/mobile məhdudiyyəti
  var r = map[base];
  if(r){
    if(r.desktopOnly && window.innerWidth < 901){
      _isNavigating = false;
      routerNavigate('dashboard', pushToHistory);
      return;
    }
    if(r.mobileOnly && window.innerWidth >= 901){
      _isNavigating = false;
      routerNavigate('dashboard', pushToHistory);
      return;
    }
  }

  // URL-i yenilə
  var newHash = '#' + route;
  if(window.location.hash !== newHash){
    if(pushToHistory){
      history.pushState({ route: route }, '', newHash);
    } else {
      history.replaceState({ route: route }, '', newHash);
    }
  }

  _currentRoute = route;

  // View-ları bağla
  routerHideAll();

  // Detail view-lar
  if(base === 'bus-detail' && detailId){
    if(typeof openBusDetail === 'function' && openBusDetail._orig){
      openBusDetail._orig(detailId);
    }
    _isNavigating = false;
    return;
  }
  if(base === 'tvm-detail' && detailId){
    if(typeof openTvmDetail === 'function' && openTvmDetail._orig){
      openTvmDetail._orig(detailId);
    }
    _isNavigating = false;
    return;
  }

  // Normal route
  if(r){
    r.open();
  } else {
    _openDashboardRaw();
    _currentRoute = 'dashboard';
    history.replaceState({ route: 'dashboard' }, '', '#dashboard');
  }

  _isNavigating = false;
}

// ── popstate: Back/Forward + Safari swipe + Android back ──
window.addEventListener('popstate', function(e){
  if(!ROUTER_READY || !currentUser) return;

  var route;
  if(e.state && e.state.route){
    route = e.state.route;
  } else {
    route = _getHashFromUrl();
  }

  // Unsaved work yoxlaması
  if(typeof isUnsavedWorkPresent === 'function' && isUnsavedWorkPresent()){
    history.pushState({ route: _currentRoute }, '', '#' + _currentRoute);
    if(typeof showUnsavedWarning === 'function') showUnsavedWarning();
    return;
  }

  // Hash yoxdursa (Safari bəzən boş state verir) → dashboard
  if(!route || route === 'login') route = 'dashboard';

  routerNavigate(route, false);
});

// ── Funksiya wrapper: orijinalı saxla, hash push et ──
function _wrapFn(fnRef, routeHash){
  if(typeof fnRef !== 'function') return fnRef;
  var wrapped = function(){
    fnRef._orig.apply(this, arguments);
    if(currentUser && ROUTER_READY && !_isNavigating){
      routerNavigate(routeHash, true);
    }
  };
  wrapped._orig = fnRef._orig || fnRef;
  return wrapped;
}

// ── Router başlat ──
function initRouter(){
  // Orijinal funksiyaları saxla
  var fns = {
    openBusService:   typeof openBusService   === 'function' ? openBusService   : null,
    openTvmService:   typeof openTvmService   === 'function' ? openTvmService   : null,
    openBusReport:    typeof openBusReport    === 'function' ? openBusReport    : null,
    openTvmReport:    typeof openTvmReport    === 'function' ? openTvmReport    : null,
    openBusDashboard: typeof openBusDashboard === 'function' ? openBusDashboard : null,
    openBusOngoing:   typeof openBusOngoing   === 'function' ? openBusOngoing   : null,
    openBusRequest:   typeof openBusRequest   === 'function' ? openBusRequest   : null,
    openBusBulk:      typeof openBusBulk      === 'function' ? openBusBulk      : null,
    openAdminPanel:   typeof openAdminPanel   === 'function' ? openAdminPanel   : null,
    openNotifications:typeof openNotifications=== 'function' ? openNotifications: null,
    openCollectives:  typeof openCollectives  === 'function' ? openCollectives  : null,
    openBusDetail:    typeof openBusDetail    === 'function' ? openBusDetail    : null,
    openTvmDetail:    typeof openTvmDetail    === 'function' ? openTvmDetail    : null,
    goHome:           typeof goHome           === 'function' ? goHome           : null,
    showDashboard:    typeof showDashboard    === 'function' ? showDashboard    : null,
    startBusService:  typeof startBusService  === 'function' ? startBusService  : null
  };

  // Hər funksiyaya ._orig əlavə et
  Object.keys(fns).forEach(function(name){
    if(fns[name]) fns[name]._orig = fns[name]._orig || fns[name];
  });

  // Wrapper-lər qur
  if(fns.openBusService)   openBusService   = _wrapFn(fns.openBusService,   'bus-service');
  if(fns.startBusService)  startBusService  = _wrapFn(fns.startBusService,  'bus-service');
  if(fns.openTvmService)   openTvmService   = _wrapFn(fns.openTvmService,   'tvm-service');
  if(fns.openBusReport)    openBusReport    = _wrapFn(fns.openBusReport,    'bus-report');
  if(fns.openTvmReport)    openTvmReport    = _wrapFn(fns.openTvmReport,    'tvm-report');
  if(fns.openBusDashboard) openBusDashboard = _wrapFn(fns.openBusDashboard, 'bus-dashboard');
  if(fns.openBusOngoing)   openBusOngoing   = _wrapFn(fns.openBusOngoing,   'bus-ongoing');
  if(fns.openBusRequest)   openBusRequest   = _wrapFn(fns.openBusRequest,   'bus-request');
  if(fns.openBusBulk)      openBusBulk      = _wrapFn(fns.openBusBulk,      'bus-bulk');
  if(fns.openAdminPanel)   openAdminPanel   = _wrapFn(fns.openAdminPanel,   'admin');
  if(fns.openNotifications)openNotifications= _wrapFn(fns.openNotifications,'notifications');
  if(fns.openCollectives)  openCollectives  = _wrapFn(fns.openCollectives,  'collectives');

  // openBusDetail / openTvmDetail — ticketId parametri var
  if(fns.openBusDetail){
    var _obdOrig = fns.openBusDetail._orig || fns.openBusDetail;
    openBusDetail = function(ticketId){
      _obdOrig.apply(this, arguments);
      if(currentUser && ROUTER_READY && !_isNavigating && ticketId){
        routerNavigate('bus-detail/'+ticketId, true);
      }
    };
    openBusDetail._orig = _obdOrig;
  }
  if(fns.openTvmDetail){
    var _otdOrig = fns.openTvmDetail._orig || fns.openTvmDetail;
    openTvmDetail = function(ticketId){
      _otdOrig.apply(this, arguments);
      if(currentUser && ROUTER_READY && !_isNavigating && ticketId){
        routerNavigate('tvm-detail/'+ticketId, true);
      }
    };
    openTvmDetail._orig = _otdOrig;
  }

  // goHome → dashboard
  if(fns.goHome){
    var _ghOrig = fns.goHome._orig || fns.goHome;
    goHome = function(){
      if(currentUser && ROUTER_READY && !_isNavigating){
        routerNavigate('dashboard', true);
        if(typeof closeMenu === 'function') closeMenu();
      } else {
        _ghOrig.apply(this, arguments);
      }
    };
    goHome._orig = _ghOrig;
  }

  // showDashboard — login sonrası
  if(fns.showDashboard){
    var _sdOrig = fns.showDashboard._orig || fns.showDashboard;
    showDashboard = function(){
      _sdOrig.apply(this, arguments);
      if(ROUTER_READY){
        var hash = _getHashFromUrl();
        var validRoutes = ['bus-service','tvm-service','bus-report','tvm-report',
                           'bus-dashboard','bus-ongoing','bus-request','bus-bulk',
                           'admin','notifications','collectives'];
        if(hash && hash !== 'dashboard' && hash !== 'login' && validRoutes.indexOf(hash.split('/')[0]) !== -1){
          setTimeout(function(){ routerNavigate(hash, false); }, 100);
        } else {
          routerNavigate('dashboard', false);
        }
      }
    };
    showDashboard._orig = _sdOrig;
  }

  ROUTER_READY = true;

  // İlk yükləmə: hash-dən route restore et
  var startHash = _getHashFromUrl();
  if(currentUser){
    // İlk state-i history-ə yaz
    history.replaceState({ route: startHash }, '', '#' + startHash);
    setTimeout(function(){
      routerNavigate(startHash, false);
    }, 100);
  }
}

// ── Sağ klik "Open in new tab" dəstəyi (artıq HTML-də <a href> var) ──
// onclick olan qalan elementlər üçün href əlavə et
var ONCLICK_HASH_MAP = {
  'openBusService':'bus-service','startBusService':'bus-service',
  'openTvmService':'tvm-service','openBusReport':'bus-report',
  'openTvmReport':'tvm-report','openBusDashboard':'bus-dashboard',
  'openBusOngoing':'bus-ongoing','openBusRequest':'bus-request',
  'openBusBulk':'bus-bulk','openAdminPanel':'admin',
  'openNotifications':'notifications','openCollectives':'collectives'
};

function applyHrefToClickables(){
  document.querySelectorAll('[onclick]').forEach(function(el){
    if(el.tagName === 'A') return; // artıq <a> olanlar keç
    var oc = el.getAttribute('onclick') || '';
    Object.keys(ONCLICK_HASH_MAP).forEach(function(fnName){
      if(oc.indexOf(fnName) !== -1){
        el.setAttribute('href', '#' + ONCLICK_HASH_MAP[fnName]);
        el.addEventListener('click', function(e){
          if(e.ctrlKey || e.metaKey || e.button === 1) return;
          e.preventDefault();
        }, { passive: false });
      }
    });
  });
}

// ── Başlat ──
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    initRouter();
    applyHrefToClickables();
  }, 0);
});
