// ═══════════════════════════════════════════════════════════════
// DESKTOP-NOTIF.JS — Desktop bildiriş paneli (müstəqil komponent)
// Topbar-dakı zəng düyməsi + dropdown panel. Mobil notifView koduna
// TOXUNMUR — öz state-i, öz render-i, öz polling-i var.
// Məlumat mənbəyi eynidir (getActiveNotifications) və oxunmuş
// işarələmə localStorage 'ctech_notif_read_ids' ilə mobil ilə
// PAYLAŞILIR (bir yerdə oxunan digərində də oxunmuş görünür).
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var dskNotifList = [];
  var dskNotifStarted = false;

  // ── Panel aç/bağla ──
  function dskNotifToggle(ev){
    if(ev){ ev.stopPropagation(); }
    var panel = document.getElementById('dskNotifPanel');
    if(!panel) return;
    var isOpen = panel.classList.contains('open');
    panel.classList.toggle('open', !isOpen);
    if(!isOpen) dskNotifLoad(); // hər açılışda təzə məlumat
  }
  function dskNotifClose(){
    var panel = document.getElementById('dskNotifPanel');
    if(panel) panel.classList.remove('open');
  }

  // ── Oxunmuş işarələmə (mobil ilə ortaq key) ──
  function dskNotifReadIds(){
    try { return JSON.parse(localStorage.getItem('ctech_notif_read_ids') || '[]'); } catch(e){ return []; }
  }
  function dskNotifMarkRead(id){
    var ids = dskNotifReadIds();
    if(ids.indexOf(id) === -1){ ids.push(id); try{ localStorage.setItem('ctech_notif_read_ids', JSON.stringify(ids)); }catch(e){} }
  }
  function dskNotifIsRead(id){ return dskNotifReadIds().indexOf(id) !== -1; }

  // ── Məlumat yüklə ──
  function dskNotifLoad(){
    if(!window.currentUser) return;
    fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getActiveNotifications', requesterEmail: currentUser?currentUser.email:''})})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.status !== 'OK') return;
      dskNotifList = d.notifications || [];
      dskNotifRender();
    })
    .catch(function(){});
  }

  // ── Render: badge + siyahı ──
  function dskNotifRender(){
    var box = document.getElementById('dskNotifList');
    var badge = document.getElementById('dskNotifBadge');
    if(!box) return;

    var unreadCount = dskNotifList.filter(function(n){ return !dskNotifIsRead(n.id); }).length;
    if(badge){
      if(unreadCount > 0){ badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount); badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    }

    if(dskNotifList.length === 0){
      box.innerHTML = '<div class="dsk-notif-empty">Hazırda bildiriş yoxdur</div>';
      return;
    }

    box.innerHTML = dskNotifList.map(function(n){
      var safeId = String(n.id).replace(/'/g,'');
      var unread = !dskNotifIsRead(n.id);
      return '<div class="dsk-notif-item'+(unread?' unread':'')+'" onclick="dskNotifItemClick(\''+safeId+'\', this)">'
        + '<div class="dsk-notif-item-dot'+(unread?'':' read')+'"></div>'
        + '<div class="dsk-notif-item-body">'
        +   '<div class="dsk-notif-item-text">'+escapeHtml(n.message)+'</div>'
        +   '<div class="dsk-notif-item-time">'+escapeHtml(n.date)+' '+escapeHtml(n.time)+'</div>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  // ── Elementə klik: oxundu kimi işarələ ──
  function dskNotifItemClick(id, el){
    dskNotifMarkRead(id);
    if(el) el.classList.remove('unread');
    dskNotifRender(); // badge yenilənsin
  }

  // ── Hamısını oxundu et ──
  function dskNotifMarkAllRead(){
    dskNotifList.forEach(function(n){ dskNotifMarkRead(n.id); });
    dskNotifRender();
  }

  // ── Start (core.js showDashboard çağırır; fallback də var) ──
  function dskNotifStart(){
    if(dskNotifStarted) return;
    if(window.innerWidth < 901) return; // yalnız masaüstü — mobil öz notifView-ını işlədir
    if(!window.currentUser) return; // hələ login deyil — sonra yenidən çağırılacaq
    dskNotifStarted = true;
    dskNotifLoad();
    setInterval(dskNotifLoad, 60000); // 1 dəqiqədən bir təzələ
  }

  // ── Qlobal çıxışlar ──
  window.dskNotifToggle = dskNotifToggle;
  window.dskNotifItemClick = dskNotifItemClick;
  window.dskNotifMarkAllRead = dskNotifMarkAllRead;
  window.dskNotifStart = dskNotifStart;

  // ── Panel xaricə klik / Escape ilə bağlanır ──
  document.addEventListener('click', function(e){
    var wrap = document.getElementById('dskNotifWrap');
    if(wrap && !wrap.contains(e.target)) dskNotifClose();
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') dskNotifClose(); });

  // ── Fallback: saved session bərpasında (core.js setTimeout(0) ilə currentUser
  //    set olunur) panel özü də bir neçə saniyə sonra başlaya bilər ──
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      if(window.currentUser) dskNotifStart();
    }, 2500);
  });
  window.addEventListener('resize', function(){
    // Tablet/mobilə keçəndə poll dayansın; yenidən desktop genişliyə dönəndə başlasın
    if(window.innerWidth >= 901 && !dskNotifStarted && window.currentUser) dskNotifStart();
  });
})();
