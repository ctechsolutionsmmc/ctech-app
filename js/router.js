// ═══════════════════════════════════════════════════════════════
// ROUTER.JS — SPA Router (pushState + hash)
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

var ROUTER_READY = false;
var _currentRoute = 'dashboard';
var _isNavigating = false;
var _rawFns = {}; // hər wrap olunan funksiyanın ORİJİNAL (bir dəfə çağırılan) versiyası

// ── Bütün view ID-ləri ──
var ALL_VIEWS = [
  'loginView','dashboardView','busServiceView','tvmServiceView',
  'busReportView','tvmReportView','busDashboardView','tvmDashboardView','busOngoingView',
  'tvmOngoingView',
  'busRequestView','tvmRequestView','busBulkView','adminPanelView','notifView',
  'collectivesView','busDetailView','tvmDetailView'
];

// ── Route xəritəsi — HƏMİŞƏ _rawFns-dən çağırır, ikiqat icradan qorunur ──
function routerGetMap(){
  return {
    'dashboard':     { open: _openDashboardRaw,                                       needsAuth: true },
    'bus-service':   { open: function(){ _callRaw('startBusService'); },              needsAuth: true },
    'tvm-service':   { open: function(){ _callRaw('openTvmService'); },               needsAuth: true },
    'tvm-request':   { open: function(){ _callRaw('openTvmRequest'); },               needsAuth: true, desktopOnly: true },
    'bus-report':    { open: function(){ _callRaw('openBusReport'); },                needsAuth: true },
    'tvm-report':    { open: function(){ _callRaw('openTvmReport'); },                needsAuth: true },
    'bus-dashboard': { open: function(){ _callRaw('openBusDashboard'); },             needsAuth: true, desktopOnly: true, denyCallCenter: true },
    'tvm-dashboard': { open: function(){ _callRaw('openTvmDashboard'); },             needsAuth: true, desktopOnly: true, denyCallCenter: true },
    'bus-ongoing':   { open: function(){ _callRaw('openBusOngoing'); },               needsAuth: true },
    'tvm-ongoing':   { open: function(){ _callRaw('openTvmOngoing'); },               needsAuth: true, desktopOnly: true },
    'bus-request':   { open: function(){ _callRaw('openBusRequest'); },               needsAuth: true, desktopOnly: true },
    'bus-bulk':      { open: function(){ _callRaw('openBusBulk'); },                  needsAuth: true, desktopOnly: true },
    'admin':         { open: function(){ _callRaw('openAdminPanel'); },               needsAuth: true, desktopOnly: true, denyCallCenter: true },
    'notifications': { open: function(){ _callRaw('openNotifications'); },            needsAuth: true, mobileOnly: true },
    'collectives':   { open: function(){ _callRaw('openCollectives'); },              needsAuth: true, desktopOnly: true }
  };
}

// ── Raw funksiyanı bir dəfə çağır (varsa) ──
function _callRaw(name){
  if(_rawFns[name]) _rawFns[name]();
}

// ── Yalnız URL/tarixçəni sinxronlaşdır — view-u YENİDƏN AÇMIR ──
// Giriş nöqtəsi funksiyaları (startBusService, openBusBulk və s.) artıq
// öz DOM-larını düzgün açıblar, buraya yalnız tarixçə yazmaq üçün gəlir.
function _pushRouteOnly(route){
  var newHash = '#' + route;
  if(window.location.hash !== newHash){
    history.pushState({ route: route }, '', newHash);
  }
  _currentRoute = route;
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
    // Call Center rolu üçün qadağan olunmuş bölmələr (dashboards, admin panel) —
    // birbaşa URL/hash ilə açma cəhdlərində də bloklanır.
    if(r.denyCallCenter && currentUser && getAccessLevel(currentUser.role) === 'callcenter'){
      _isNavigating = false;
      routerNavigate('dashboard', pushToHistory);
      return;
    }
  }

  // Ağır görünüşlərdən çıxarkən (TVM Dashboard, Toplu idxal və s.):
  // yükləmə vidjetini göstər, sonra keçidi et — Home düyməsi VƏ brauzerin
  // Geri düyməsi bu funksiyaya gətirən hər iki yol eyni məntiqdən keçir.
  var _LOADING_EXIT_VIEWS = {
    'tvmDashboardView':'tvm-dashboard',
    'busBulkView':'bus-bulk',
    'busOngoingView':'bus-ongoing',
    'tvmOngoingView':'tvm-ongoing',
    'busDashboardView':'bus-dashboard',
    'busReportView':'bus-report',
    'tvmReportView':'tvm-report',
    'adminPanelView':'admin'
  };
  var leavingHeavyView = false;
  for(var _vid in _LOADING_EXIT_VIEWS){
    var _ve = document.getElementById(_vid);
    if(_ve && _ve.style.display !== 'none' && base !== _LOADING_EXIT_VIEWS[_vid]){
      leavingHeavyView = true;
      break;
    }
  }

  function _doNav(){
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
      if(_rawFns['openBusDetail']) _rawFns['openBusDetail'](detailId);
      var ld1=document.getElementById('dashLoading'); if(ld1) ld1.style.display='none';
      _isNavigating = false;
      return;
    }
    if(base === 'tvm-detail' && detailId){
      if(_rawFns['openTvmDetail']) _rawFns['openTvmDetail'](detailId);
      var ld2=document.getElementById('dashLoading'); if(ld2) ld2.style.display='none';
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

    var ld=document.getElementById('dashLoading'); if(ld) ld.style.display='none';
    _isNavigating = false;
  }

  if(leavingHeavyView){
    var loading = document.getElementById('dashLoading');
    if(loading) loading.style.display='flex';
    // Əvvəlki 700ms süni gözləmə 250ms-ə endirildi — keçidlər daha cəld hiss olunur.
    setTimeout(_doNav, 250);
  } else {
    _doNav();
  }
}

// ── Aktiv formaya uyğun "Home cəhdi" funksiyasını tap ──
// Bu, hər formanın öz Home düyməsinin çağırdığı EYNİ funksiyadır —
// dirty-dirsə xəbərdarlıq göstərir, deyilsə avtomatik bağlayır.
function _findActiveAttemptHomeFn(){
  var mapping = [
    { viewId:'busServiceView', fn:'attemptBusHome' },
    { viewId:'tvmServiceView', fn:'attemptTvmHome' },
    { viewId:'busRequestView', fn:'attemptBusRequestHome' },
    { viewId:'tvmRequestView', fn:'attemptTvmRequestHome' },
    { viewId:'busBulkView',    fn:'attemptBusBulkHome' }
  ];
  for(var i=0;i<mapping.length;i++){
    var el = document.getElementById(mapping[i].viewId);
    if(el && el.style.display !== 'none' && typeof window[mapping[i].fn] === 'function'){
      return window[mapping[i].fn];
    }
  }
  return null;
}

// ── popstate: Back/Forward + Safari swipe + Android back ──
window.addEventListener('popstate', function(e){
  if(!ROUTER_READY || !currentUser) return;
  try{
    var route;
    if(e.state && e.state.route){
      route = e.state.route;
    } else {
      route = _currentRoute || _getHashFromUrl();
    }
    if(!route || route === 'login') route = 'dashboard';

    // Açıq formada "Home cəhdi" funksiyası varsa (bus-service, tvm-service,
    // bus-request, bus-bulk) — geri getməni ləğv et, EYNİ funksiyanı çağır.
    // O, dirty-dirsə xəbərdarlıq göstərəcək, deyilsə özü bağlayıb düzgün yerə keçəcək.
    var attemptFn = _findActiveAttemptHomeFn();
    if(attemptFn){
      history.pushState({ route: _currentRoute }, '', '#' + _currentRoute);
      attemptFn();
      return;
    }

    routerNavigate(route, false);
  } catch(err){
    console.error('[ROUTER] popstate xətası:', err);
  }
});

// ── Router başlat ──
function initRouter(){
  var entryPoints = {
    startBusService:        'bus-service',
    openBusServiceForEdit:  'bus-service',
    openTvmService:         'tvm-service',
    openTvmServiceForEdit:  'tvm-service',
    openBusReport:          'bus-report',
    openTvmReport:          'tvm-report',
    openBusDashboard:       'bus-dashboard',
    openTvmDashboard:       'tvm-dashboard',
    openBusOngoing:         'bus-ongoing',
    openTvmOngoing:         'tvm-ongoing',
    openBusRequest:         'bus-request',
    openTvmRequest:         'tvm-request',
    openBusBulk:            'bus-bulk',
    openAdminPanel:         'admin',
    openNotifications:      'notifications',
    openCollectives:        'collectives'
  };

  // Hər giriş nöqtəsi üçün: RAW funksiyanı yadda saxla, sonra QLOBAL adı wrap et.
  // VACIB: wrapper YALNIZ raw funksiyanı çağırır (bir dəfə) və sonra sadəcə
  // URL/tarixçəni sinxronlaşdırır — routerNavigate-in özünü YENİDƏN açmasına
  // ehtiyac yoxdur, çünki raw funksiya artıq DOM-u düzgün açıb.
  Object.keys(entryPoints).forEach(function(fnName){
    try{
      if(typeof window[fnName] === 'function'){
        _rawFns[fnName] = window[fnName]; // orijinal, bir dəfə çağırılan versiya
        var routeHash = entryPoints[fnName];
        window[fnName] = function(){
          _rawFns[fnName].apply(this, arguments); // YALNIZ BİR DƏFƏ
          if(currentUser && ROUTER_READY){
            _pushRouteOnly(routeHash); // sadəcə URL/tarixçə, TƏKRAR AÇMA YOX
          }
        };
      }
    } catch(e){
      console.error('[ROUTER] '+fnName+' wrap xətası:', e);
    }
  });

  // openBusDetail / openTvmDetail — ticketId parametrli
  try{
    if(typeof openBusDetail === 'function'){
      _rawFns['openBusDetail'] = openBusDetail;
      openBusDetail = function(ticketId){
        _rawFns['openBusDetail'].apply(this, arguments);
        if(currentUser && ROUTER_READY && ticketId){
          _pushRouteOnly('bus-detail/'+ticketId);
        }
      };
    }
  } catch(e){ console.error('[ROUTER] openBusDetail wrap xətası:', e); }
  try{
    if(typeof openTvmDetail === 'function'){
      _rawFns['openTvmDetail'] = openTvmDetail;
      openTvmDetail = function(ticketId){
        _rawFns['openTvmDetail'].apply(this, arguments);
        if(currentUser && ROUTER_READY && ticketId){
          _pushRouteOnly('tvm-detail/'+ticketId);
        }
      };
    }
  } catch(e){ console.error('[ROUTER] openTvmDetail wrap xətası:', e); }

  // goHome → dashboard
  try{
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
  } catch(e){ console.error('[ROUTER] goHome wrap xətası:', e); }

  // ── "Bağla / X" funksiyaları — URL-i və tarixçəni sinxronlaşdır ──
  var simpleCloseFns = ['closeCollectives','closeBusRequest','closeTvmRequest','closeNotifications','closeAdminPanel','closeTvmDashboard','closeTvmOngoing'];
  simpleCloseFns.forEach(function(fnName){
    try{
      if(typeof window[fnName] === 'function'){
        var _origClose = window[fnName];
        window[fnName] = function(){
          _origClose.apply(this, arguments);
          if(currentUser && ROUTER_READY){
            _currentRoute = 'dashboard';
            try{ history.replaceState({ route:'dashboard' }, '', '#dashboard'); }catch(e2){}
          }
        };
      }
    } catch(e){ console.error('[ROUTER] '+fnName+' close-wrap xətası:', e); }
  });

  var smartCloseFns = {
    'bsGoBack':      function(){ return (typeof bsReturnTarget!=='undefined' && bsReturnTarget==='report') ? 'bus-report' : 'dashboard'; },
    'closeTvmService': function(){ return (typeof tvmReturnTarget!=='undefined' && tvmReturnTarget==='report') ? 'tvm-report' : (typeof tvmReturnTarget!=='undefined' && tvmReturnTarget==='ongoing') ? 'tvm-ongoing' : 'dashboard'; },
    'closeBusBulk':  function(){ return (typeof bkReturnTarget!=='undefined' && bkReturnTarget==='busService') ? 'bus-service' : 'dashboard'; },
    'closeBusDetail': function(){ return 'bus-report'; },
    'closeTvmDetail': function(){ return 'tvm-report'; }
  };
  Object.keys(smartCloseFns).forEach(function(fnName){
    try{
      if(typeof window[fnName] === 'function'){
        var _origSmartClose = window[fnName];
        var targetFn = smartCloseFns[fnName];
        window[fnName] = function(){
          var target = targetFn();
          _origSmartClose.apply(this, arguments);
          if(currentUser && ROUTER_READY){
            _currentRoute = target;
            try{ history.replaceState({ route:target }, '', '#'+target); }catch(e2){}
          }
        };
      }
    } catch(e){ console.error('[ROUTER] '+fnName+' smart-close-wrap xətası:', e); }
  });

  // showDashboard — login sonrası
  try{
    if(typeof showDashboard === 'function'){
      var _sdOrig = showDashboard;
      showDashboard = function(){
        _sdOrig.apply(this, arguments);
        if(ROUTER_READY){
          var hash = _getHashFromUrl();
          var validRoutes = ['bus-service','tvm-service','tvm-request','bus-report','tvm-report',
                             'bus-dashboard','bus-ongoing','tvm-ongoing','bus-request','bus-bulk',
                             'admin','notifications','collectives'];
          if(hash && hash !== 'dashboard' && hash !== 'login' && validRoutes.indexOf(hash.split('/')[0]) !== -1){
            setTimeout(function(){ routerNavigate(hash, false); }, 100);
          } else {
            routerNavigate('dashboard', false);
          }
        }
      };
    }
  } catch(e){ console.error('[ROUTER] showDashboard wrap xətası:', e); }

  ROUTER_READY = true;
  _currentRoute = _getHashFromUrl();

  // ── Gecikmiş (stale) açılış qoruyucusu ──
  // startBusService() məlumat gələn kimi openBusService()-i çağırır (6s təhlükəsizlik
  // limiti var). Əgər bu müddətdə istifadəçi artıq başqa yerə keçibsə (məs. geri
  // sürüşdürübsə), bu gecikmiş çağırış səssizcə formu yenidən göstərməsin.
  try{
    if(typeof openBusService === 'function'){
      var _rawOpenBusService = openBusService;
      openBusService = function(){
        if(_currentRoute !== 'bus-service') return; // artıq başqa yerdəyik, keç
        _rawOpenBusService.apply(this, arguments);
      };
    }
  } catch(e){ console.error('[ROUTER] openBusService guard xətası:', e); }

  var startHash = _getHashFromUrl();
  if(currentUser){
    history.replaceState({ route: startHash }, '', '#' + startHash);
    setTimeout(function(){
      routerNavigate(startHash, false);
    }, 100);
  }
}

// ── Sağ klik "Open in new tab" dəstəyi ──
var ONCLICK_HASH_MAP = {
  'openBusService':'bus-service','startBusService':'bus-service',
  'openTvmService':'tvm-service','openBusReport':'bus-report',
  'openTvmReport':'tvm-report','openBusDashboard':'bus-dashboard',
  'openBusOngoing':'bus-ongoing','openTvmOngoing':'tvm-ongoing','openBusRequest':'bus-request',
  'openTvmRequest':'tvm-request','openBusBulk':'bus-bulk','openAdminPanel':'admin',
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
    try{
      initRouter();
      applyHrefToClickables();
      console.log('%c[ROUTER] Uğurla başladı', 'color:#3FCB78;font-weight:bold;');
    } catch(err){
      console.error('[ROUTER] XƏTA — initRouter() uğursuz oldu:', err);
      console.error('[ROUTER] Stack:', err.stack);
      // Görünən xəbərdarlıq — səssiz uğursuzluq olmasın
      var errBox = document.createElement('div');
      errBox.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#DC2626;color:#fff;padding:12px 16px;font-family:monospace;font-size:12px;z-index:99999;text-align:center;';
      errBox.textContent = 'Router xətası: ' + err.message + ' (F12 → Console-da ətraflı bax)';
      document.body.appendChild(errBox);
    }
  }, 0);
});
