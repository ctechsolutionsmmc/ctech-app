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
// Diqqət: bu funksiyalar birbaşa qlobal adları çağırır (wrap olunub-olunmamasından asılı olmayaraq).
// Reentrancy _isNavigating flaqı ilə qorunur, ona görə wrap olunmuş versiyanı çağırmaq təhlükəsizdir.
function routerGetMap(){
  return {
    'dashboard':     { open: _openDashboardRaw,                                              needsAuth: true },
    'bus-service':   { open: function(){ if(typeof openBusService==='function') openBusService(); },       needsAuth: true },
    'tvm-service':   { open: function(){ if(typeof openTvmService==='function') openTvmService(); },        needsAuth: true },
    'bus-report':    { open: function(){ if(typeof openBusReport==='function') openBusReport(); },          needsAuth: true },
    'tvm-report':    { open: function(){ if(typeof openTvmReport==='function') openTvmReport(); },          needsAuth: true },
    'bus-dashboard': { open: function(){ if(typeof openBusDashboard==='function') openBusDashboard(); },    needsAuth: true },
    'bus-ongoing':   { open: function(){ if(typeof openBusOngoing==='function') openBusOngoing(); },        needsAuth: true },
    'bus-request':   { open: function(){ if(typeof openBusRequest==='function') openBusRequest(); },        needsAuth: true, desktopOnly: true },
    'bus-bulk':      { open: function(){ if(typeof openBusBulk==='function') openBusBulk(); },               needsAuth: true, desktopOnly: true },
    'admin':         { open: function(){ if(typeof openAdminPanel==='function') openAdminPanel(); },        needsAuth: true, desktopOnly: true },
    'notifications': { open: function(){ if(typeof openNotifications==='function') openNotifications(); },  needsAuth: true, mobileOnly: true },
    'collectives':   { open: function(){ if(typeof openCollectives==='function') openCollectives(); },       needsAuth: true, desktopOnly: true }
  };
}

// ── Raw dashboard açma ──
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

  var newHash = '#' + route;
  if(window.location.hash !== newHash){
    if(pushToHistory){
      history.pushState({ route: route }, '', newHash);
    } else {
      history.replaceState({ route: route }, '', newHash);
    }
  }

  _currentRoute = route;
  routerHideAll();

  if(base === 'bus-detail' && detailId){
    if(typeof openBusDetail === 'function') openBusDetail(detailId);
    _isNavigating = false;
    return;
  }
  if(base === 'tvm-detail' && detailId){
    if(typeof openTvmDetail === 'function') openTvmDetail(detailId);
    _isNavigating = false;
    return;
  }

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

  if(typeof isUnsavedWorkPresent === 'function' && isUnsavedWorkPresent()){
    history.pushState({ route: _currentRoute }, '', '#' + _currentRoute);
    if(typeof showUnsavedWarning === 'function') showUnsavedWarning();
    return;
  }

  if(!route || route === 'login') route = 'dashboard';

  routerNavigate(route, false);
});

// ── Funksiya wrapper: yalnız HƏQİQİ giriş nöqtələri üçün ──
// Qeyd: bu yalnız "user-facing" funksiyalara tətbiq olunur (kartlara basanda çağırılan),
// daxili köməkçi funksiyalara (məs. openBusService) YOX — çünki onlar bəzən
// gecikməli (setTimeout/fetch) daxili çağırışlarla işə düşür və səhv tarixçə yaza bilər.
function _wrapFn(fnRef, routeHash){
  if(typeof fnRef !== 'function') return fnRef;
  var wrapped = function(){
    fnRef.apply(this, arguments);
    if(currentUser && ROUTER_READY && !_isNavigating){
      routerNavigate(routeHash, true);
    }
  };
  return wrapped;
}

// ── Router başlat ──
function initRouter(){
  var entryPoints = {
    // Bus Service — YALNIZ həqiqi giriş nöqtələri wrap olunur (openBusService YOX)
    startBusService:        'bus-service',
    openBusServiceForEdit:  'bus-service',
    // TVM Service
    openTvmService:         'tvm-service',
    openTvmServiceForEdit:  'tvm-service',
    // Hesabatlar
    openBusReport:          'bus-report',
    openTvmReport:          'tvm-report',
    openBusDashboard:       'bus-dashboard',
    openBusOngoing:         'bus-ongoing',
    // Digər bölmələr
    openBusRequest:         'bus-request',
    openBusBulk:            'bus-bulk',
    openAdminPanel:         'admin',
    openNotifications:      'notifications',
    openCollectives:        'collectives'
  };

  Object.keys(entryPoints).forEach(function(fnName){
    if(typeof window[fnName] === 'function'){
      window[fnName] = _wrapFn(window[fnName], entryPoints[fnName]);
    }
  });

  // openBusDetail / openTvmDetail — ticketId parametrli
  if(typeof openBusDetail === 'function'){
    var _obdOrig = openBusDetail;
    openBusDetail = function(ticketId){
      _obdOrig.apply(this, arguments);
      if(currentUser && ROUTER_READY && !_isNavigating && ticketId){
        routerNavigate('bus-detail/'+ticketId, true);
      }
    };
  }
  if(typeof openTvmDetail === 'function'){
    var _otdOrig = openTvmDetail;
    openTvmDetail = function(ticketId){
      _otdOrig.apply(this, arguments);
      if(currentUser && ROUTER_READY && !_isNavigating && ticketId){
        routerNavigate('tvm-detail/'+ticketId, true);
      }
    };
  }

  // goHome → dashboard
  if(typeof goHome === 'function'){
    var _ghOrig = goHome;
    goHome = function(){
      if(currentUser && ROUTER_READY && !_isNavigating){
        routerNavigate('dashboard', true);
        if(typeof closeMenu === 'function') closeMenu();
      } else {
        _ghOrig.apply(this, arguments);
      }
    };
  }

  // showDashboard — login sonrası
  if(typeof showDashboard === 'function'){
    var _sdOrig = showDashboard;
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
  }

  ROUTER_READY = true;

  var startHash = _getHashFromUrl();
  if(currentUser){
    history.replaceState({ route: startHash }, '', '#' + startHash);
    setTimeout(function(){
      routerNavigate(startHash, false);
    }, 100);
  }
}

// ── Sağ klik "Open in new tab" dəstəyi (HTML-də <a href> olmayan qalıqlar üçün) ──
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
    if(el.tagName === 'A') return;
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
