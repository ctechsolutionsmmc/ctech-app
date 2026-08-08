// ═══════════════════════════════════════════════════════════════
// BUS-REQUEST.JS — Yeni Müraciət + Texnik Axtarış + SN
// CTECH Service Platform
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// YENİ MÜRACİƏT — iki-mərhələli servis axınının 1-ci addımı.
// Qəsdən Bus Service-in bsSelected/draft sistemindən TAM AYRIDIR
// ki, iki forma bir-birinin state-inə qarışmasın.
// ═══════════════════════════════════════════════════════════════
var brSelected = { carrier:'', brand:'', problem:'', technicians:[] };
var brFormDirty = false;
var brNextTicketId = '';

// Validator / SAM kart SN siyahıları — əvvəlcədən elan olunmalıdır,
// yoxsa fetch bitməzdən əvvəl axtarış undefined üzərində .concat() çağırıb səssiz xəta verir
var busValidatorSNList = [];
var busSamCardSNList = [];
var busCombinedSNSet = null;
var busValidatorSNLoaded = false;
var busValidatorSNLoading = false;
var busValidatorSNLoadingPromise = null;

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
    badge.innerHTML='<span style="display:inline-flex;align-items:center;background:#2F6FED;border-radius:10px;padding:6px 16px;font-family:IBM Plex Mono,monospace;font-weight:700;font-size:14px;color:#FFFFFF;letter-spacing:1px;">'+escapeHtml(brNextTicketId)+'</span>';
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
      // FAZA 2 (XSS): reyestr məlumatları istifadəçi tərəfindən yazılır — hamısı escape olunur
      var dqnE=escapeHtml(m.dqn||'');
      var idE=escapeHtml(m.id||'');
      var carrierE=escapeHtml(m.carrier||'');
      var modelE=escapeHtml(m.model||'');
      return '<div class="bs-registry-item" data-dqn="'+dqnE+'" data-id="'+idE+'" data-carrier="'+carrierE+'" data-model="'+modelE+'">'
        +'<span class="reg-id">'+(dqnE||'—')+'</span>'
        +'<span class="reg-meta">BUS ID: '+(idE||'—')+' · '+(carrierE||'—')+' · '+(modelE||'—')+'</span></div>';
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
      // Yeni müraciət davam edən servislərə düşür → keşi sil
      if(typeof invalidateOngoingCache==='function') invalidateOngoingCache();
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
  if(busValidatorSNLoading) return busValidatorSNLoadingPromise;
  if(busValidatorSNLoaded && !force) return Promise.resolve();
  busValidatorSNLoading = true;
  busValidatorSNLoadingPromise = Promise.all([
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
  return busValidatorSNLoadingPromise;
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

  // Data hələ yüklənməyibsə — yüklə, bitəndə (əgər istifadəçi hələ eyni mətni
  // yazırsa) axtarışı avtomatik təkrarla. Boş dayanıb gözləmə.
  if(!busValidatorSNLoaded){
    if(dd){ dd.innerHTML = '<div class="bs-registry-empty">Yüklənir...</div>'; dd.style.display='block'; }
    preloadValidatorSNList().then(function(){
      if(el.value.trim() === q) busSnInputHandler(el, ddId, warnId);
    });
    return;
  }

  var matches = busSnSearchMatches(q);
  if(dd){
    if(matches.length===0){
      dd.innerHTML = '<div class="bs-registry-empty">Uyğun SN tapılmadı</div>';
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
      if(busValidatorSNLoaded && !busSnExists(v)){
        alert('Bu SN Validator və ya SAM Card bazasında tapılmadı.\nYalnız mövcud SN-lər əlavə edilə bilər.');
        return;
      }
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
