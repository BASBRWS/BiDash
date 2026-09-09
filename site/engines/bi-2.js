
/* ═══════════════════════════════════════════════════════════
   RENDERERS
   ═══════════════════════════════════════════════════════════ */
const $=s=>document.querySelector(s);
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function ragOf(trigs){if(trigs.some(t=>t.sev==='r'))return'r';if(trigs.some(t=>t.sev==='o'))return'o';return'g'}
function ragColor(r){return r==='r'?'var(--rood)':r==='o'?'var(--oranje)':'var(--groen)'}
function sevTag(s){return s==='r'?'<span class="tag r">Kritiek</span>':s==='o'?'<span class="tag o">Aandacht</span>':'<span class="tag g">OK</span>'}
function dienstChip(d){return `<span class="dienst-chip" style="background:${DIENST_KLEUR[d]||'#5a6478'}">${d}</span>`}

/* ─────────────── DASHBOARD ─────────────── */
function renderDash(){
  const p=activeParams(),T=evalTriggers(p);
  const nR=T.filter(t=>t.sev==='r').length,nO=T.filter(t=>t.sev==='o').length;
  const rag=ragOf(T);
  const byResp={};T.forEach(t=>{(byResp[t.resp]=byResp[t.resp]||[]).push(t)});
  const mc=runMC(2000,p);

  const tiles=DOMEINEN.map(d=>{
    const dt=T.filter(t=>t.dom===d.id||(d.id==='model'&&t.dom==='richtlijn'));
    const drag=ragOf(dt);
    let stat='',sub='',target=d.id==='planning'?'planning':d.id==='model'?'rules':'data';
    if(d.id==='formatie'){
      if(DB.functies.length){const ben=DB.functies.reduce((s,f)=>s+f.benodigdFte*(1+p.verzuim/100),0),act=DB.functies.reduce((s,f)=>s+f.actueelFte,0)*(1+p.ftePct/100);stat=fmtF(act)+' / '+fmtF(ben);sub='actueel / benodigd fte (incl. verzuim)'}
      else{const capB=bridgeModel()?bridgeCapaciteit():null;
        if(capB&&capB.geconfig){const piek=Object.values(capB.perDienst).reduce((s,i)=>s+i.piek,0),grens=Object.values(capB.perDienst).reduce((s,i)=>s+(i.grens||0),0);stat=fmtF(piek)+' / '+fmtF(grens,0);sub='piek FTE-vraag / capaciteit (planning)'}
        else if(DB.p6Capaciteit){stat=fmtF(DB.p6Capaciteit.totFte);sub='FTE-vraag uit de planning (P6-import)'}
        else{stat='0 / 0';sub='actueel / benodigd fte (incl. verzuim)'}}}
    else if(d.id==='financien'){const ben=DB.functies.reduce((s,f)=>s+f.onderhoudEur,0)*p.kostenIndex,bud=DB.financien.budgetJr*(1+p.budgetPct/100);stat=fmtE(bud-ben);sub=bud>=ben?'budgetruimte (excl. boeterisico)':'budgettekort per jaar'}
    else if(d.id==='asset'){const under=DB.assets.filter(a=>(100-(100-a.besch)*p.storingsFactor)<normVoor(a)).length;stat=under+' / '+DB.assets.length;sub='assets onder de config-norm'}
    else if(d.id==='planning'){const bm=bridgeModel();stat=bm?String(dt.length):'\u2014';sub=bm?'conflicten in '+esc(bm.bestand):'planning nog niet geladen in de tool'}
    else{stat=DB.functies.length+'';sub='bedrijfsfuncties in het model'}
    return `<div class="domtile rag-${bridgeModel()||d.id!=='planning'?drag:'o'}" onclick="goto('${target}')">
      <div class="d-name">${d.naam}</div>
      <div class="d-stat" style="color:${ragColor(drag)}">${stat}</div>
      <div class="d-sub">${sub}</div>
      <div class="d-src">${d.src.map(s=>`<span>${s}</span>`).join('')}</div></div>`;
  }).join('');

  const cx=200,topY=42,ly=210,lx=52,rx=348;
  const tri=`<svg viewBox="0 0 400 268">
    <defs><linearGradient id="triline" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F9B000"/><stop offset="1" stop-color="#7fa8e0"/></linearGradient></defs>
    <polygon points="${cx},${topY+16} ${rx-40},${ly-14} ${lx+40},${ly-14}" fill="none" stroke="url(#triline)" stroke-width="1.5" stroke-dasharray="5 4" class="pulse"/>
    <circle cx="${cx}" cy="${(topY+ly)/2+14}" r="34" fill="rgba(249,176,0,.12)" stroke="${rag==='r'?'#ff6b6b':rag==='o'?'#F9B000':'#5fd08a'}" stroke-width="2"/>
    <text x="${cx}" y="${(topY+ly)/2+10}" text-anchor="middle" fill="#fff" font-size="17" font-weight="700" font-family="Consolas">${nR}<tspan fill="#9db4dd" font-size="10"> krit</tspan></text>
    <text x="${cx}" y="${(topY+ly)/2+26}" text-anchor="middle" fill="#F9B000" font-size="12" font-weight="700" font-family="Consolas">${nO}<tspan fill="#9db4dd" font-size="9"> aandacht</tspan></text>
    ${triNode(cx-60,topY-34,'BI DASH','toont & simuleert','dash')}
    ${triNode(lx-44,ly-8,'RULE ENGINE','legt vast (config.html)','rules')}
    ${triNode(rx-76,ly-8,'TRIGGER ENGINE','monitoort','triggers')}
  </svg>`;

  $('#page-dash').innerHTML=`
    <div class="pagehead"><h2>Dashboard</h2><div class="desc">Peildatum ${DB.meta.peildatum} \u00b7 regels: ${esc(DB.configBron)} \u00b7 ${simActive()?'<b style="color:var(--oranje)">simulatieparameters actief</b>':'basisuitgangspunten'} \u00b7 verzuim ${fmtF(p.verzuim)}%</div>
    <div class="actions"><button class="btn warn" onclick="goto('sim')">\u26a1 Simuleer</button></div></div>
    <div class="domtiles">${tiles}</div>
    <div class="tri-wrap">
      <div class="tri-card"><div class="tri-title">De driehoek \u2014 vastleggen \u00b7 monitoren \u00b7 tonen</div>${tri}
        <div style="display:flex;gap:14px;margin-top:6px;color:#c2d1ea;font-size:11px">
          <span>P(FTE-tekort) <b style="color:#fff;font-family:var(--mono)">${Math.round(mc.pFte*100)}%</b></span>
          <span>P(budgetoverschrijding) <b style="color:#fff;font-family:var(--mono)">${Math.round(mc.pBud*100)}%</b></span>
          <span>P(asset&lt;norm) <b style="color:#fff;font-family:var(--mono)">${Math.round(mc.pAsset*100)}%</b></span>
        </div>
        <div style="color:#7f96c4;font-size:10px;margin-top:4px">Monte Carlo \u00b7 2.000 runs \u00b7 normen en MTTR uit config.html</div>
      </div>
      <div class="card" style="margin-bottom:0"><h3>Risico\u2019s per verantwoordelijke <span class="hint">de trigger engine adresseert elk risico expliciet</span></h3>
        ${Object.keys(byResp).length?Object.entries(byResp).map(([r,ts])=>`
          <div style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="resp-chip">${esc(r)}</span><span style="font-size:11px;color:var(--sub)">${ts.length} trigger${ts.length>1?'s':''}</span></div>
          ${ts.slice(0,3).map(t=>trigHTML(t,true)).join('')}</div>`).join(''):'<div class="empty">Geen afwijkingen op de uitgangspunten. Alles binnen norm.</div>'}
      </div>
    </div>`;
}
function triNode(x,y,titel,sub,page){
  return `<g class="tri-node" onclick="goto('${page}')"><rect class="tri-box" x="${x}" y="${y}" width="120" height="44" rx="5" fill="#0050a0" stroke="#7fa8e0" stroke-width="1"/>
  <text x="${x+60}" y="${y+19}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">${titel}</text>
  <text x="${x+60}" y="${y+33}" text-anchor="middle" fill="#9db4dd" font-size="8.5">${sub}</text></g>`;
}
function trigHTML(t,compact){
  const impactRij=(t.impact&&t.impact.length)?`<div class="t-meta" style="margin-top:6px"><span style="font-size:10.5px;font-weight:700;color:var(--rws-blauw)">BREDE IMPACT \u2192</span>${t.impact.map(c=>`<span class="imp-chip imp-${c.dom}">${DOMNAAM[c.dom]}: ${esc(c.txt)}</span>`).join('')}</div>`:'';
  const afgeleidBadge=t.afgeleid?`<span class="tag b" title="${esc(t.afgeleid)}">\u26d3 afgeleid \u2190 planning</span>`:'';
  return `<div class="trig ${t.sev}"><div class="t-icon">${t.sev==='r'?'\u26d4':t.sev==='o'?'\u26a0\ufe0f':'\u2705'}</div>
    <div class="t-body"><div class="t-title">${esc(t.titel)}</div>
    ${compact?'':`<div class="t-msg">${esc(t.msg)}</div>`}
    <div class="t-meta">${sevTag(t.sev)}<span class="t-val">${esc(t.val)}</span>${afgeleidBadge}${compact?'':`<span class="resp-chip">${esc(t.resp)}</span>`}<span class="tag gy">${DOMEINEN.find(d=>d.id===t.dom)?.naam||'Richtlijn'}</span></div>${compact?'':impactRij}</div></div>`;
}

/* ─────────────── RULE ENGINE (gekoppeld aan config.html) ─────────────── */

const CIV_LTS_FASEN=['Planuitwerking/Planfase','Contractvoorbereiding','Aanbesteding','Definitief ontwerp','Bouw en Fabriekstesten','Installatie, Sitetesten en Systeemintegratie','Openstelling','Nazorg'];
const CIV_FORMATIE_ROLLEN=['CIV Service manager','CIV Keten Service Delivery manager','CIV service delivery manager','CIV contractmanager','CIV HEIJMANS TEAM','CIV SWARCO'];
let CIV_RULE_TAB='main';
const VWM_FASEN=["Planuitwerking/Planfase", "Contractvoorbereiding", "Aanbesteding", "Convergentie", "Voorontwerp", "Definitief ontwerp", "Uitvoeringsontwerp", "Bouw en Fabriekstesten", "Installatie, Sitetesten en Systeemintegratie", "Openstelling", "Nazorg"],VWM_ROLLEN=["OT/OO/NWD", "IBP", "TRM", "Operatie", "AM"],VWM_DEFAULT={"Planuitwerking/Planfase": {"OT/OO/NWD": 0.333, "IBP": 0.167, "TRM": 0.667, "Operatie": 0.111, "AM": 0.028}, "Contractvoorbereiding": {"OT/OO/NWD": 0.222, "IBP": 0.111, "TRM": 0.444, "Operatie": 0.056, "AM": 0.028}, "Aanbesteding": {"OT/OO/NWD": 0.0, "IBP": 0.0, "TRM": 0.0, "Operatie": 0.0, "AM": 0.0}, "Convergentie": {"OT/OO/NWD": 0.0, "IBP": 0.0, "TRM": 0.0, "Operatie": 0.0, "AM": 0.0}, "Voorontwerp": {"OT/OO/NWD": 0.333, "IBP": 0.167, "TRM": 0.5, "Operatie": 0.111, "AM": 0.028}, "Definitief ontwerp": {"OT/OO/NWD": 0.333, "IBP": 0.167, "TRM": 0.5, "Operatie": 0.111, "AM": 0.028}, "Uitvoeringsontwerp": {"OT/OO/NWD": 0.167, "IBP": 0.083, "TRM": 0.278, "Operatie": 0.056, "AM": 0.028}, "Bouw en Fabriekstesten": {"OT/OO/NWD": 0.333, "IBP": 0.167, "TRM": 0.5, "Operatie": 0.111, "AM": 0.028}, "Installatie, Sitetesten en Systeemintegratie": {"OT/OO/NWD": 0.556, "IBP": 0.333, "TRM": 0.667, "Operatie": 2.778, "AM": 0.111}, "Openstelling": {"OT/OO/NWD": 0.222, "IBP": 0.167, "TRM": 0.667, "Operatie": 0.028, "AM": 0.028}, "Nazorg": {"OT/OO/NWD": 0.167, "IBP": 0.111, "TRM": 0.444, "Operatie": 0.028, "AM": 0.028}};
function vwmInit(){if(!DB.vwmFte)DB.vwmFte={};VWM_FASEN.forEach(f=>{if(!DB.vwmFte[f])DB.vwmFte[f]={};VWM_ROLLEN.forEach(r=>{if(DB.vwmFte[f][r]===undefined)DB.vwmFte[f][r]=VWM_DEFAULT[f][r]||0})});if(!DB.cap)DB.cap={GPO:8,CIV:5,VWM:25,PPO:3,Regio:3};if(!DB.vwmRolCap)DB.vwmRolCap={'OT/OO/NWD':5,IBP:5,TRM:5,Operatie:5,AM:5};}
function pushForm(){let w=iplWin();if(w&&w.ipl_applyVwm)w.ipl_applyVwm(DB.vwmFte,DB.cap,DB.vwmRolCap)}function saveForm(){try{localStorage.setItem(DB_KEY,JSON.stringify(DB))}catch(e){}pushForm()}
function setV(f,r,v){vwmInit();DB.vwmFte[f][r]=Math.max(0,+v||0);saveForm();let x=document.querySelector('[data-vt="'+CSS.escape(f)+'"]');if(x)x.textContent=VWM_ROLLEN.reduce((a,q)=>a+(+DB.vwmFte[f][q]||0),0).toFixed(2)}function setC(d,v){vwmInit();DB.cap[d]=Math.max(0,+v||0);saveForm()}function setRC(r,v){vwmInit();DB.vwmRolCap[r]=Math.max(0,+v||0);DB.cap.VWM=VWM_ROLLEN.reduce((a,q)=>a+(+DB.vwmRolCap[q]||0),0);saveForm()}
function vwmPanel(){vwmInit();let z=VWM_FASEN.map(f=>`<tr><td><b>${esc(f)}</b></td>${VWM_ROLLEN.map(r=>`<td><input type="number" step=".01" min="0" value="${DB.vwmFte[f][r]}" oninput='setV(${JSON.stringify(f)},${JSON.stringify(r)},this.value)' style="width:76px"></td>`).join('')}<td><b data-vt="${esc(f)}">${VWM_ROLLEN.reduce((a,r)=>a+(+DB.vwmFte[f][r]||0),0).toFixed(2)}</b></td></tr>`).join('');return `<div id="rules-vwm-panel" style="display:none"><div class="card"><h3>VWM formatie per LTS-fase</h3><div class="hint">Wekelijkse FTE-belasting per individuele taak in deze LTS-fase. 0,5 FTE = 18 uur per week bij 36 uur per FTE. De grafieken tellen alle gelijktijdig actieve taken cumulatief op.</div><div style="overflow:auto"><table><thead><tr><th>Fase</th>${VWM_ROLLEN.map(r=>`<th>${r} FTE/project</th>`).join('')}<th>Totaal</th></tr></thead><tbody>${z}</tbody></table></div></div></div>`}
function capPanel(){vwmInit();return `<div id="rules-cap-panel" style="display:none"><div class="card"><h3>Harde capaciteitsgrenzen</h3><h4>Per dienst</h4>${Object.keys(DB.cap).map(d=>`<label style="margin-right:14px"><b>${d}</b> <input type="number" step=".5" min="0" value="${DB.cap[d]}" oninput="setC('${d}',this.value)" style="width:70px"> FTE</label>`).join('')}<h4 style="margin-top:16px">VWM per rol</h4>${VWM_ROLLEN.map(r=>`<label style="display:inline-flex;gap:6px;margin:6px 14px 6px 0"><b>${r}</b><input type="number" step=".1" min="0" value="${DB.vwmRolCap[r]}" oninput='setRC(${JSON.stringify(r)},this.value)' style="width:70px"> FTE</label>`).join('')}<div class="hint">VWM totaalcapaciteit is de som van de vijf rolgrenzen. Alle lijnen zijn vast. De inzet is de cumulatieve weekbelasting van alle actieve individuele taken.</div></div></div>`}
function civFormatieInit(){
  if(!DB.civFormatie)DB.civFormatie={};
  CIV_LTS_FASEN.forEach(f=>{if(!DB.civFormatie[f])DB.civFormatie[f]={};CIV_FORMATIE_ROLLEN.forEach(r=>{if(DB.civFormatie[f][r]===undefined)DB.civFormatie[f][r]=0;});});
}
function civFormatieBewaar(){try{localStorage.setItem(DB_KEY,JSON.stringify(DB));}catch(e){console.warn('CIV formatie kon niet lokaal worden opgeslagen',e);}}
function civFormatiePush(){const w=iplWin();if(w&&typeof w.ipl_applyCivFormatie==='function'){civFormatieInit();w.ipl_applyCivFormatie(DB.civFormatie);}}
function civFaseTotaal(fase){civFormatieInit();return CIV_FORMATIE_ROLLEN.reduce((a,r)=>a+(+DB.civFormatie[fase][r]||0),0);}
function civFormatieSet(fase,rol,val,input){
  civFormatieInit();
  const n=Math.max(0,Number(val)||0);DB.civFormatie[fase][rol]=n;
  if(input)input.value=n;
  civFormatieBewaar();
  const total=document.querySelector('[data-civ-total="'+CSS.escape(fase)+'"]');if(total)total.textContent=fmtF(civFaseTotaal(fase),2);
  const status=document.getElementById('civ-save-status');if(status){status.textContent='Opgeslagen en doorgerekend om '+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});status.style.color='#1a8a4a';}
  civFormatiePush();
}
function civFormatiePanel(){civFormatieInit();
 const rows=CIV_LTS_FASEN.map(f=>`<tr><td style="min-width:220px"><b>${esc(f)}</b></td>${CIV_FORMATIE_ROLLEN.map(r=>`<td class="num"><input type="number" min="0" step="0.1" value="${DB.civFormatie[f][r]}" oninput='civFormatieSet(${JSON.stringify(f)},${JSON.stringify(r)},this.value,this)' style="width:88px"></td>`).join('')}<td class="num"><b data-civ-total="${esc(f)}">${fmtF(civFaseTotaal(f),2)}</b></td></tr>`).join('');
 return `<div id="rules-civ-panel" style="display:none"><div class="card"><h3>CIV formatie per LTS-fase</h3><div class="hint" style="margin-bottom:12px">De waarden voeden direct de formatiegrafieken rechts van de planning. Het scherm wordt tijdens invoer niet opnieuw opgebouwd.</div><div style="overflow:auto"><table><thead><tr><th>LTS-fase</th>${CIV_FORMATIE_ROLLEN.map(r=>`<th class="num">${esc(r)}</th>`).join('')}<th class="num">Totaal FTE</th></tr></thead><tbody>${rows}</tbody></table></div><div id="civ-save-status" class="footnote">Wijzigingen worden automatisch lokaal opgeslagen.</div></div></div>`;
}
function civRuleTab(which){CIV_RULE_TAB=which;['main','civ','vwm','cap'].forEach(x=>{let p=document.getElementById('rules-'+x+'-panel'),b=document.getElementById('rules-tab-'+x);if(p)p.style.display=which===x?'':'none';if(b)b.className=which===x?'btn primary':'btn'});}

function renderRules(){
  const p=activeParams();
  /* config-parameters gegroepeerd, met per parameter de doorwerking */
  const groepen=[
    {titel:'Personeel & formatie',rows:[
      ['personeel.ziekteverzuim','%','\u2192 verzuimopslag op benodigde FTE (trigger engine + Monte Carlo)'],
      ['personeel.min_bezetting','%','\u2192 harde ondergrens bezettingsgraad: eronder = kritieke trigger'],
      ['escalatie.niveau1','%','\u2192 bezetting hieronder = aandachtstrigger'],
      ['escalatie.niveau2','%','\u2192 bezetting hieronder = kritieke trigger'],
      ['personeel.werkdagen_jaar','dg','\u2192 context capaciteitsberekening']]},
    {titel:'ATW (Arbeidstijdenwet)',rows:[
      ['atw.max_uren_week','u','\u2192 genoemd in ATW-risicotriggers bij onderbezetting'],
      ['atw.rust_dagelijks','u','\u2192 idem'],
      ['atw.max_nachten_14d','','\u2192 idem'],
      ['atw.max_werkdagen_consecutief','dg','\u2192 idem']]},
    {titel:'Asset-normen (KPI per CMDB-categorie)',rows:[
      ['kpi.asset_beschikbaarheid.tunnel','%','\u2192 norm voor CMDB Tunnel/TTI'],
      ['kpi.asset_beschikbaarheid.msi','%','\u2192 norm voor CMDB DVM'],
      ['kpi.asset_beschikbaarheid.werkplek','%','\u2192 norm voor CMDB Productieplatform'],
      ['kpi.asset_beschikbaarheid.drip','%','\u2192 norm voor CMDB Facilitair'],
      ['assets.hw_mttr','u','\u2192 hersteltijd hardware-storingen in Monte Carlo'],
      ['assets.sw_mttr','u','\u2192 hersteltijd software-storingen in Monte Carlo']]},
    {titel:'Contract & financi\u00ebn',rows:[
      ['contract.beschikbaarheidseis','%','\u2192 boeterisicotrigger als assets eronder zakken'],
      ['contract.boete_per_uur','\u20ac','\u2192 hoogte boeterisico (trigger + Monte Carlo)'],
      ['contract.boete_actief','','\u2192 boeterisico aan/uit']]},
    {titel:'Hinder & planning',rows:[
      ['hinder.max_files_werk','','\u2192 drempel gelijktijdigheidspiek in P6-planning'],
      ['kpi.planningshorizon_maanden','mnd','\u2192 context planningsdashboard']]},
    {titel:'Simulatiescenario (config.html)',rows:[
      ['sim.personeel_factor','\u00d7','\u2192 knop \u201cConfig-scenario overnemen\u201d op Simulatie'],
      ['sim.budget_factor','\u00d7','\u2192 idem'],
      ['sim.asset_factor','\u00d7','\u2192 idem (omgezet naar storingsfactor)'],
      ['sim.incident_multiplier','\u00d7','\u2192 idem']]}
  ];
  const cfgHTML=groepen.map(g=>`<details class="rulecat" ${g.titel.startsWith('Personeel')?'open':''}><summary>${g.titel}</summary><div class="rc-body"><div class="cfg-grid">
    ${g.rows.map(([k,unit,link])=>`<div class="cfg-row"><span class="k">${k}</span><span><span class="v">${esc(String(cfg(k,'\u2014')))}${unit?' '+unit:''}</span><span class="cfg-link">${link}</span></span></div>`).join('')}
  </div></div></details>`).join('');

  const rows=DB.functies.map(f=>`<tr>
    <td><b>${esc(f.naam)}</b><br><span style="font-size:11px;color:var(--sub)">doel: ${esc(f.doel)} \u00b7 systemen: ${f.systemen.join(', ')}</span></td>
    <td class="num"><input type="number" step="0.1" value="${f.benodigdFte}" style="width:72px" onchange="DB.functies.find(x=>x.id==='${f.id}').benodigdFte=+this.value;saveDB()"></td>
    <td>${f.assets.map(id=>{const a=DB.assets.find(x=>x.id===id);return a?`<span class="tag b" title="${a.cmdb}">${esc(a.naam)}</span>`:''}).join(' ')||'<span style="color:var(--sub)">\u2014</span>'}</td>
    <td class="num"><input type="number" step="1000" value="${f.onderhoudEur}" style="width:100px" onchange="DB.functies.find(x=>x.id==='${f.id}').onderhoudEur=+this.value;saveDB()"></td>
    <td>${f.richtlijnen.map(r=>`<span class="tag o">${DB.richtlijnen.find(x=>x.id===r)?.naam||r}</span>`).join(' ')||'\u2014'}</td>
    <td><span class="rule-pxq">P\u00d7Q: ${fmtF(f.benodigdFte)} fte + ${fmtE(f.onderhoudEur)}/jr</span></td></tr>`).join('');

  const assetRows=DB.assets.map(a=>`<tr>
    <td><b>${esc(a.naam)}</b></td><td><span class="tag gy">${a.cmdb}</span></td><td>${esc(a.locatie)}</td>
    <td class="num">${fmtF(normVoor(a))} <span class="cfg-src">${CAT_NORM[a.cmdb]}</span></td>
    <td class="num"><input type="number" step="0.1" value="${a.weging}" style="width:60px" onchange="DB.assets.find(x=>x.id==='${a.id}').weging=+this.value;saveDB()" title="Impactweging: asset Z op locatie Y weegt zwaarder"></td></tr>`).join('');

  $('#page-rules').innerHTML=`
    <div class="pagehead"><h2>Rule engine</h2><div class="desc">De regels komen uit config.html en werken door op alle afhankelijke onderdelen: formatie, assets, financi\u00ebn, planning en Monte Carlo.</div></div>
    <div class="card"><h3>Gekoppelde configuratie (config.html) <span class="hint">bron: ${esc(DB.configBron)}</span></h3>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <button class="btn primary" onclick="document.getElementById('cfgfile').click()">\u2b06 Importeer vwl_scenario_config.json</button>
        <button class="btn" onclick="cfgFromStorage()">\u21bb Laad uit browseropslag van config.html</button>
        <button class="btn danger" onclick="cfgReset()">Terug naar standaardregels</button>
      </div>
      ${cfgHTML}
      <div class="footnote">Gebruik in config.html de knop <b>Export voor Framework</b> (vwl_scenario_config.json) en importeer die hier; alle ${Object.keys(DB.config).length} parameters worden overgenomen en de trigger engine hertoetst direct.</div></div>
    <div class="card"><h3>Impactregels planningsafwijkingen <span class="hint">voorwaarden waarmee de trigger engine per meldingstype de brede impact duidt \u2014 doorwerking op formatie, assets, financi\u00ebn \u00e9n richtlijnen</span></h3>
      <div class="frm" style="grid-template-columns:280px 130px 1fr">
        <label>Piekinzet bij corridorconflict</label><input type="number" step="1" value="${DB.impact.fteOpslagConflict}" onchange="DB.impact.fteOpslagConflict=+this.value;saveDB()"><span class="cfg-link">% extra fte op gekoppelde functies \u2192 formatie- en ATW-triggers + meerkosten</span>
        <label>Storingsopslag tijdens werkzaamheden</label><input type="number" step="0.1" value="${DB.impact.storingsOpslag}" onchange="DB.impact.storingsOpslag=+this.value;saveDB()"><span class="cfg-link">\u00d7 storingsrisico gekoppelde assets \u2192 assettriggers + boeterisico + Monte Carlo</span>
        <label>Loonkosten per fte per jaar</label><input type="number" step="1000" value="${DB.impact.fteKostenJr}" onchange="DB.impact.fteKostenJr=+this.value;saveDB()"><span class="cfg-link">\u20ac \u2192 meerkostenberekening financi\u00ebn</span>
        <label>Regie-opslag per werk boven drempel</label><input type="number" step="0.5" value="${DB.impact.piekOpslagPct}" onchange="DB.impact.piekOpslagPct=+this.value;saveDB()"><span class="cfg-link">% \u2192 formatietrigger bij gelijktijdigheidspiek</span>
        <label>Indexatie per maand verschuiving</label><input type="number" step="0.05" value="${DB.impact.shiftKostenPctMnd}" onchange="DB.impact.shiftKostenPctMnd=+this.value;saveDB()"><span class="cfg-link">% op P\u00d7Q-onderhoud \u2192 financi\u00ebntrigger bij shift</span>
      </div>
      <div class="frm" style="grid-template-columns:280px 130px 1fr;margin-top:6px">
        ${Object.keys(DB.capgrens).map(d=>`<label>Capaciteitsgrens ${d}</label><input type="number" step="0.5" value="${DB.capgrens[d]}" onchange="DB.capgrens['${d}']=+this.value;saveDB()"><span class="cfg-link">max fte voor dit programma \u2192 capaciteitstrigger als de planningsvraag erboven piekt</span>`).join('')}
      </div>
      <div class="footnote">Koppelvoorwaarde: corridor-/locatietoken uit de planning \u2192 assets (locatie) \u2192 bedrijfsfuncties (naam of gekoppelde assets) \u2192 fte, \u20ac en richtlijnen. Schuift de planning en ontstaat er een conflict, dan verschijnen de afgeleide triggers automatisch in elk geraakt domein.</div></div>
    <div class="card"><h3>Assetmanagement-regels (ISO 55001) <span class="hint">line of sight: bedrijfsdoel \u2192 bedrijfsfunctie \u2192 bedienketen \u2192 asset \u00b7 de FW-klasse bepaalt welke regels gelden</span></h3>
      <div class="frm" style="grid-template-columns:280px 130px 1fr">
        ${[5,4,3,2,1].map(n=>`<label>Max. uitstel onderhoud FW${n}</label><input type="number" step="1" value="${amRegel('FW'+n,12)}" onchange="DB.amRegels.maxUitstel['FW${n}']=+this.value;saveDB()"><span class="cfg-link">mnd \u2192 uitsteltrigger per asset met functionele waarde ${n}${n===5?' (meest kritiek)':n===1?' (minst kritiek)':''}</span>`).join('')}
        <label>Degradatie per 6 mnd uitstel</label><input type="number" step="1" value="${amRegel('degrPer6Mnd',18)}" onchange="DB.amRegels.degrPer6Mnd=+this.value;saveDB()"><span class="cfg-link">% extra storingskans \u2192 ketenberekening \u00e9n Monte Carlo</span>
        <label>Conditiedrempel (NEN 2767)</label><input type="number" step="1" min="1" max="6" value="${amRegel('conditieDrempel',4)}" onchange="DB.amRegels.conditieDrempel=+this.value;saveDB()"><span class="cfg-link">vanaf deze conditiescore degradeert een asset \u00d71,5 zo snel</span>
        <label>SPOF-eis vanaf FW-klasse</label><input type="number" step="1" min="1" max="5" value="${amRegel('spofFw',4)}" onchange="DB.amRegels.spofFw=+this.value;saveDB()"><span class="cfg-link">vanaf deze FW is redundantie (n+1) vereist \u2192 SPOF-trigger bij enkelvoudige uitvoering met matige conditie</span>
      </div>
      <div class="footnote">De externe DVM-assets zijn randvoorwaardelijk voor het wegverkeersmanagement; bedienketens en het AM-register staan op de pagina <b>Assetmanagement</b>.</div></div>
    <div class="card"><h3>DVM-impactregels</h3><p>Dienstimpact en verkeerskosten worden uitsluitend in de DVM-module beheerd. Gebruik het centrale tabblad Regels &amp; samenhang.</p></div>
    <div class="card"><h3>Uitgangspunten per bedrijfsfunctie <span class="hint">\u201com functie X te leveren heb ik N fte, assets X/Y/Z en \u20ac K per jaar onderhoud nodig\u201d</span></h3>
      <table><thead><tr><th>Bedrijfsfunctie</th><th class="num">Benodigd FTE</th><th>Benodigde assets</th><th class="num">Onderhoud \u20ac/jr</th><th>Richtlijnen</th><th>Regel</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footnote">Benodigd FTE wordt bij toetsing verhoogd met de verzuimopslag uit config.html (personeel.ziekteverzuim = ${fmtF(p.verzuim)}%).</div></div>
    <div class="grid2">
      <div class="card"><h3>Normen & wegingen per asset <span class="hint">normen zijn afgeleid uit config.html; alleen weging is lokaal</span></h3>
        <table><thead><tr><th>Asset</th><th>CMDB</th><th>Locatie</th><th class="num">Norm % (bron)</th><th class="num">Weging</th></tr></thead><tbody>${assetRows}</tbody></table></div>
      <div class="card"><h3>Wettelijke richtlijnen</h3>
        ${DB.richtlijnen.map(r=>`<div style="padding:8px 0;border-bottom:1px solid #eef1f5"><b>${esc(r.naam)}</b><div style="font-size:12px;color:var(--sub)">${esc(r.oms)}</div></div>`).join('')}
        <div class="footnote" style="margin-top:10px">ATW-parameters: max ${cfg('atw.max_uren_week',60)} u/week \u00b7 ${cfg('atw.rust_dagelijks',11)} u dagelijkse rust \u00b7 max ${cfg('atw.max_nachten_14d',5)} nachten/14d \u00b7 ${cfg('atw.rust_na_nachtreeks',46)} u rust na nachtreeks \u2014 rechtstreeks uit config.html.</div></div>
    </div>`;
}

/* ─────────────── TRIGGER ENGINE ─────────────── */

const renderRulesBasis=renderRules;
renderRules=function(){
  renderRulesBasis();
  const p=document.getElementById('page-rules');if(!p)return;
  const basis=p.innerHTML;
  p.innerHTML='<div style="display:flex;gap:8px;margin-bottom:14px"><button id="rules-tab-main" class="btn" onclick="civRuleTab(\'main\')">Algemene regels</button><button id="rules-tab-civ" class="btn" onclick="civRuleTab(\'civ\')">CIV formatie</button><button id="rules-tab-vwm" class="btn" onclick="civRuleTab(\'vwm\')">VWM formatie</button><button id="rules-tab-cap" class="btn" onclick="civRuleTab(\'cap\')">Capaciteitsgrenzen</button></div><div id="rules-main-panel">'+basis+'</div>'+civFormatiePanel()+vwmPanel()+capPanel();
  civRuleTab(CIV_RULE_TAB);
};

function renderTriggers(){
  const p=activeParams(),T=evalTriggers(p);
  const nRegels=DB.functies.length+DB.assets.length+(DB.ketens||[]).length+(bridgeModel()?1:0)+1;
  $('#page-triggers').innerHTML=`
    <div class="pagehead"><h2>Trigger engine</h2><div class="desc">Toont afwijkingen op de config-regels en adresseert de verantwoordelijke. ${simActive()?'<b style="color:var(--oranje)">Let op: simulatieparameters actief.</b>':''}</div>
    <div class="actions"><button class="btn" onclick="refresh()">\u21bb Hertoets</button></div></div>
    <div class="mc-stats">
      <div class="mc-stat"><div class="v" style="color:var(--rood)">${T.filter(t=>t.sev==='r').length}</div><div class="l">Kritieke afwijkingen</div></div>
      <div class="mc-stat"><div class="v" style="color:var(--oranje)">${T.filter(t=>t.sev==='o').length}</div><div class="l">Aandachtspunten</div></div>
      <div class="mc-stat"><div class="v">${nRegels}</div><div class="l">Getoetste regelsets</div></div>
      <div class="mc-stat"><div class="v" style="color:var(--groen)">${Math.max(0,nRegels-T.length)}</div><div class="l">Binnen norm</div></div>
    </div>
    ${T.length?T.map(t=>trigHTML(t,false)).join(''):'<div class="card"><div class="empty">Geen afwijkingen. Alle actuele data valt binnen de regels uit config.html.</div></div>'}`;
}

/* ─────────────── ASSETMANAGEMENT (ISO 55001) ─────────────── */
let WHATIF=null; // what-if doorrekening: {assetId, extraUitstel (mnd), extraVerlies (%-punt)}
function amSetWhatIf(){
  const sel=$('#wi-asset'),u=+($('#wi-uitstel')?.value)||0,v=+($('#wi-verlies')?.value)||0;
  const id=sel?sel.value:'';
  WHATIF=id?{assetId:id,extraUitstel:u,extraVerlies:v}:null;
  renderAM();
}
function amResetWhatIf(){WHATIF=null;renderAM()}
function renderAM(){
  const p=activeParams();
  /* generieke bedienketens (taakanalyse): schakelschema per objecttype + line of sight */
  const ketenBlocks=(DB.ketens||[]).map(k=>{
    const r=ketenBesch(k,p);
    const aanwezig=r.schakels.filter(s=>s.aanwezig);
    const minB=aanwezig.length?Math.min(...aanwezig.map(s=>s.b)):100;
    const los=lineOfSight(k);
    const onderNorm=r.besch!==null&&r.besch<k.norm;
    const status=r.besch===null?'<span class="tag gy">Geen areaal geladen</span>'
      :(!r.volledig?(onderNorm?'<span class="tag r">Onder norm</span> <span class="tag o">Onvolledig</span>':'<span class="tag o">Onvolledig areaal</span>')
      :(r.besch>=k.norm?'<span class="tag g">Binnen norm</span>':((k.norm-r.besch)>=1?'<span class="tag r">Kritiek</span>':'<span class="tag o">Onder norm</span>')));
    const schema=r.schakels.map((s,i)=>{
      const pijl=i?'<span class="keten-pijl">→</span>':'';
      if(!s.aanwezig)return pijl+`<div class="schakel" style="opacity:.55;border-top-style:dashed" title="objecttype nog niet als asset in het (gescopte) areaal geladen">
        <div class="s-naam">${esc(s.label)}</div><div class="s-meta">— niet geladen · <span class="fw-chip${s.fw>=amRegel('spofFw',4)?' hoog':''}">FW${s.fw}</span></div></div>`;
      const zwak=onderNorm&&s.b===minB;
      return pijl+`<div class="schakel${zwak?' zwak':''}" title="gemiddelde effectieve beschikbaarheid van ${s.n} asset(s) van dit objecttype${s.redundant?' · incl. redundante (n+1) assets':''}">
        <div class="s-naam">${esc(s.label)}</div>
        <div class="s-meta">${fmtF(s.b,2)}% · ${s.n} asset${s.n>1?'s':''} · <span class="fw-chip${s.fw>=amRegel('spofFw',4)?' hoog':''}">FW${s.fw}</span>${s.redundant?' · n+1':''}</div></div>`;
    }).join('');
    const kleur=r.besch===null?'var(--sub)':(r.besch>=k.norm&&r.volledig?'var(--groen)':'var(--rood)');
    return `<div style="padding:12px 0;border-bottom:1px solid #eef1f5">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b>${esc(k.naam)}</b><span class="tag gy">${esc(k.bedrijfsfunctie||k.bedienfunctie||'')}</span>${status}
        <span style="margin-left:auto;font-family:var(--mono);font-size:12px;display:flex;align-items:center;gap:6px">${k.locatie?'scope '+esc(k.locatie)+' · ':''}keten <b style="color:${kleur}">${r.besch===null?'—':fmtF(r.besch,2)+'%'}</b> · norm <input type="number" step="0.1" value="${k.norm}" style="width:66px" onchange="DB.ketens.find(x=>x.id==='${k.id}').norm=+this.value;saveDB()"> %</span></div>
      <div class="keten-schema">${schema}</div>
      <div class="los-lijn">Line of sight: <b>${los.doelen.map(esc).join('</b> · <b>')||'—'}</b> ← <b>${esc(k.bedrijfsfunctie||'')}</b> ← ${r.schakels.length} objecttypen${r.ontbrekend?' ('+r.ontbrekend+' nog niet geladen)':''}</div>
    </div>`;
  }).join('');
  /* what-if doorrekening door alle bedienketens heen */
  const w=WHATIF;
  let wiResult='<div class="empty">Kies een asset en stel extra uitstel en/of beschikbaarheidsverlies in; het instrument rekent de gevolgen door alle bedienketens heen tot op doelniveau.</div>';
  if(w&&(w.extraUitstel>0||w.extraVerlies>0)){
    const wa=DB.assets.find(x=>x.id===w.assetId);
    const perUur=+cfg('contract.boete_per_uur',500);
    let risico=0;
    const rows=(DB.ketens||[]).filter(k=>ketenGeraakt(k,wa)).map(k=>{
      const voor=ketenBesch(k,p).besch,na=ketenBesch(k,p,w).besch;
      if(voor===null||na===null)return '';
      const urenOnder=Math.max(0,k.norm-na)/100*8760;
      const bedrag=urenOnder*perUur;risico+=bedrag;
      const los=lineOfSight(k);
      return `<tr><td><b>${esc(k.naam)}</b><br><span style="font-size:11px;color:var(--sub)">${los.functieNamen.map(esc).join(' · ')||'—'} → ${los.doelen.map(esc).join(' · ')||'—'}</span></td>
        <td class="num">${fmtF(voor,2)}%</td><td class="num" style="font-weight:700;color:${na>=k.norm?'var(--groen)':'var(--rood)'}">${fmtF(na,2)}%</td>
        <td class="num">${fmtF(na-voor,2)}</td><td class="num">${fmtF(k.norm)}%</td>
        <td>${na>=k.norm?'<span class="tag g">Norm</span>':'<span class="tag r">Onder norm</span>'}</td>
        <td class="num">${bedrag>0?fmtE(bedrag):'—'}</td></tr>`;
    }).join('');
    wiResult=rows?`<table style="margin-top:10px"><thead><tr><th>Bedienketen · geraakte functies → doelen</th><th class="num">Vóór</th><th class="num">Na</th><th class="num">Δ %-pt</th><th class="num">Norm</th><th>Status</th><th class="num">Risico €/jr</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footnote">Indicatief risicobedrag: uren onder de ketennorm × boetetarief ${fmtE(perUur)}/uur (contract.boete_per_uur uit config.html) · totaal <b>${fmtE(risico)}</b>/jr.</div>`
      :`<div class="empty">Asset “${esc(wa?wa.naam:'')}” maakt van geen enkele bedienketen deel uit.</div>`;
  }
  const wiSel=DB.assets.map(a=>`<option value="${a.id}" ${w&&w.assetId===a.id?'selected':''}>${esc(a.naam)}</option>`).join('');
  /* AM-register: bewerkbare ISO 55001-velden per asset */
  const regRows=DB.assets.map(a=>{
    const grens=amRegel('FW'+(+a.fw||3),12);
    const spof=(+a.fw||0)>=amRegel('spofFw',4)&&!a.redundant&&(+a.conditie||1)>=amRegel('conditieDrempel',4);
    const uitstelTeHoog=(+a.uitstelMnd||0)>grens;
    const status=(spof?'<span class="tag r">SPOF</span> ':'')+(uitstelTeHoog?'<span class="tag r">Uitstel &gt; grens</span>':(!spof?'<span class="tag g">Conform</span>':''));
    return `<tr><td><b>${esc(a.naam)}</b><br><span style="font-size:11px;color:var(--sub)">${esc(a.locatie)} · ${a.cmdb}</span></td>
      <td><select style="width:150px" onchange="DB.assets.find(x=>x.id==='${a.id}').type=this.value;saveDB()">${Object.keys(OBJECTTYPEN).map(t=>`<option value="${t}" ${a.type===t?'selected':''}>${esc(OBJECTTYPEN[t].label)}</option>`).join('')}${OBJECTTYPEN[a.type]?'':`<option value="${esc(a.type||'')}" selected>${esc(a.type||'(overig)')}</option>`}</select></td>
      <td><select style="width:64px" onchange="DB.assets.find(x=>x.id==='${a.id}').fw=+this.value;saveDB()">${[1,2,3,4,5].map(n=>`<option value="${n}" ${+a.fw===n?'selected':''}>${n}</option>`).join('')}</select></td>
      <td><select style="width:60px" onchange="DB.assets.find(x=>x.id==='${a.id}').conditie=+this.value;saveDB()">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${+a.conditie===n?'selected':''}>${n}</option>`).join('')}</select></td>
      <td class="num"><input type="number" min="0" step="1" value="${+a.uitstelMnd||0}" style="width:62px" onchange="DB.assets.find(x=>x.id==='${a.id}').uitstelMnd=+this.value;saveDB()"></td>
      <td class="num" style="color:var(--sub)">${grens}</td>
      <td style="text-align:center"><input type="checkbox" ${a.redundant?'checked':''} style="width:auto" onchange="DB.assets.find(x=>x.id==='${a.id}').redundant=this.checked;saveDB()"></td>
      <td class="num">×${fmtF(degrFactor(a),2)}</td>
      <td>${status}</td></tr>`;
  }).join('');
  $('#page-am').innerHTML=`
    <div class="pagehead"><h2>Assetmanagement</h2><div class="desc">ISO 55001 · line of sight: bedrijfsdoel → bedrijfsfunctie → bedienketen → asset. De AM-regels (max. uitstel per FW-klasse, degradatie, conditiedrempel, SPOF-eis) staan in de rule engine. ${simActive()?'<b style="color:var(--oranje)">Let op: simulatieparameters actief.</b>':''}</div>
    <div class="actions"><button class="btn" onclick="goto('rules')">⚙ AM-regels in de rule engine</button></div></div>
    <div class="card"><h3>Bedienketens <span class="hint">generiek uit de TNO-taakanalyse · ketenbeschikbaarheid = serieel product van de objecttype-schakels · gemiddelde per type over de geladen assets · degradatie door uitgesteld onderhoud telt mee</span></h3>
      <div class="footnote" style="margin-bottom:6px">De ketens zijn de <b>purpose-related functions</b> uit de abstractiehiërarchie (regionaal wegverkeersmanagement, TNO 2021). Elke schakel is een generiek <b>objecttype</b> uit de ‘physical objects’-laag; de beschikbaarheid wordt berekend over de assets van dat type die je hebt geladen (bv. via NDW-import). Een gestippelde schakel is een objecttype dat nog niet in het areaal zit.</div>
      ${ketenBlocks||'<div class="empty">Nog geen bedienketens gedefinieerd.</div>'}</div>
    <div class="card"><h3>What-if doorrekening <span class="hint">gevolgen van uitgesteld onderhoud of beschikbaarheidsverlies, door de afhankelijkheden heen zichtbaar tot op doelniveau</span></h3>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <div style="min-width:220px"><label style="font-size:11px;color:var(--sub)">Asset</label><select id="wi-asset" onchange="amSetWhatIf()">${wiSel}</select></div>
        <div style="width:150px"><label style="font-size:11px;color:var(--sub)">Extra uitstel (mnd)</label><input type="number" id="wi-uitstel" min="0" step="1" value="${w?w.extraUitstel:0}" onchange="amSetWhatIf()"></div>
        <div style="width:190px"><label style="font-size:11px;color:var(--sub)">Beschikbaarheidsverlies (%-punt)</label><input type="number" id="wi-verlies" min="0" step="0.1" value="${w?w.extraVerlies:0}" onchange="amSetWhatIf()"></div>
        <button class="btn" onclick="amResetWhatIf()">↺ Reset</button>
      </div>
      ${wiResult}</div>
    <div class="card"><h3>CMDB-koppeling NDW <span class="hint">areaalgegevens uit NDW open data: matrixsignaalinformatie (MSI) en dynamische route-informatiepanelen (DRIP) · XML of gezipte XML</span></h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn primary" onclick="document.getElementById('ndwfile').click()">⭱ Importeer NDW-bestand(en) — MSI · DRIP</button>
        ${DB.assets.some(a=>String(a.id).startsWith('ndw_'))?'<button class="btn danger" onclick="ndwVerwijder()">Verwijder NDW-assets uit het register</button>':''}
      </div>
      ${(()=>{const n=DB.ndwImport||{};const rgl=[];
        if(n.msi)rgl.push(`<div style="font-size:12px;margin-bottom:4px"><span class="tag b">MSI</span> ${esc(n.msi.bestand)} · <b>${n.msi.signs.toLocaleString('nl-NL')}</b> signaalgevers op <b>${n.msi.wegen}</b> wegen (${n.msi.nieuw} nieuw)${n.msi.peilmoment?' · peilmoment '+n.msi.peilmoment:''} · geïmporteerd ${n.msi.datum}</div>`);
        if(n.drip)rgl.push(`<div style="font-size:12px;margin-bottom:4px"><span class="tag b">DRIP</span> ${esc(n.drip.bestand)} · <b>${n.drip.totaal.toLocaleString('nl-NL')}</b> panelen op <b>${n.drip.wegen}</b> wegen + ${n.drip.overig} stedelijk/regionaal (${n.drip.nieuw} nieuw)${n.drip.peilmoment?' · peilmoment '+n.drip.peilmoment:''} · geïmporteerd ${n.drip.datum}</div>`);
        return rgl.length?rgl.join(''):'<div class="empty" style="padding:10px">Nog geen NDW-import. Download bij NDW open data de snapshots “Matrixsignaalinformatie” en “Dynamische route-informatiepanelen” en importeer ze hier.</div>'})()}
      <div class="footnote">Per wegnummer ontstaat één asset in het register (MSI → CMDB DVM, DRIP → CMDB Facilitair; norm uit config.html). De weg (locatie) is tevens het corridor-token voor de impact engine, zodat planningsconflicten op bijv. de A15 automatisch aan het MSI-/DRIP-areaal daar gekoppeld worden. Bij herimport worden naam en aantallen ververst; beheervelden (FW, conditie, uitstel, n+1, beschikbaarheid, weging) blijven behouden.</div></div>
    <div class="card"><h3>Storingsmeldingen buitenassets <span class="hint">CSV-import uit de storingsbron · doorgerekend volgens de storingsregels uit de rule engine · resultaat per weg op de geladen NDW-MSI's</span></h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <button class="btn primary" onclick="document.getElementById('srfile').click()">⭱ Importeer storingsmeldingen (CSV)</button>
        <button class="btn" onclick="goto('rules')">⚙ Storingsregels in de rule engine</button>
      </div>
      ${(()=>{const s=DB.storingsImport;if(!s)return '<div class="empty" style="padding:10px">Nog geen meldingen geïmporteerd. Verwachte kolommen (kopregel, ; of , of tab): foutcode, storingsomschrijving, asset, type, wegnummer, wegdeelletter, hm-bord, strooknummer, datum — optioneel context (bijv. voor_afrit) en duur (uren).</div>';
        const res=s.resultaat.slice(0,12).map(r=>`<tr><td><b>${esc(r.weg)}</b></td><td class="num">${r.n}</td><td class="num">${fmtF(r.stJr)}</td><td class="num" style="font-weight:700;color:${r.besch>=+cfg('kpi.asset_beschikbaarheid.msi',99.5)?'var(--groen)':'var(--rood)'}">${fmtF(r.besch,3)}%</td><td class="num">${fmtF(r.prestatie,3)}%</td></tr>`).join('');
        return `<div style="font-size:12px;margin-bottom:6px"><span class="tag b">MELDINGEN</span> ${esc(s.bestand)} · <b>${s.meldingen}</b> regels → <b>${s.toegepast}</b> toegepast (${s.dubbel} dubbel, ${s.nietGeclassificeerd} niet geclassificeerd, ${s.zonderFoutregel} zonder foutcoderegel, ${s.nietMsi} niet-MSI voor combi) · <b>${s.combiHits}</b> combinatietreffer(s) · periode ${fmtF(s.periodeJr,2)} jaar · geïmporteerd ${s.datum}</div>
        ${res?`<table style="max-width:640px"><thead><tr><th>Weg</th><th class="num">Meldingen</th><th class="num">Storingen/jr</th><th class="num">Beschikbaarheid</th><th class="num">Prestatie</th></tr></thead><tbody>${res}</tbody></table>`:''}
        ${s.zonderAreaal.length?`<div class="footnote" style="color:var(--oranje)">Geen NDW-areaal in het register voor: ${s.zonderAreaal.map(esc).join(', ')} — importeer eerst het NDW-MSI-bestand of controleer het wegnummer.</div>`:''}`})()}
      <div class="footnote">Doorrekening per melding: assettype (herkenningsregels) → foutcode → basisimpact × typegewicht × locatiefactor → combinatieregels (zelfde weg/richting binnen hm-afstand en tijdvenster) → aggregatie per weg: beschikbaarheid = 100 − Σ(impact × hersteltijd) / (areaalomvang × periode). Prestatie wordt apart bijgehouden; storingen/jr per weg telt door in de Monte Carlo.</div></div>
    <div class="card"><h3>AM-register <span class="hint">functionele waarde, conditie (NEN 2767), uitgesteld onderhoud en redundantie per asset · wijzigingen werken direct door in ketens, triggers en Monte Carlo</span></h3>
      <table><thead><tr><th>Asset</th><th>Type</th><th>FW</th><th>Conditie</th><th class="num">Uitstel mnd</th><th class="num">Grens FW</th><th style="text-align:center">n+1</th><th class="num">Degradatie</th><th>Status</th></tr></thead><tbody>${regRows}</tbody></table>
      <div class="footnote">Degradatie = factor op de storingskans: 1 + (uitstel/6) × ${amRegel('degrPer6Mnd',18)}%${' '}× 1,5 vanaf conditiescore ${amRegel('conditieDrempel',4)} (NEN 2767). Beschikbaarheid en storingen/jr blijven bewerkbaar op de pagina Databronnen.</div></div>`;
}

/* ─────────────── INTEGRALE PLANNING (originele tool embedded) ─────────────── */
function renderPlanning(){
  const host=$('#page-planning');
  if(!document.getElementById('ipl-frame')){
    host.innerHTML=`
      <div class="pagehead"><h2>Integrale planning</h2><div class="desc">De volledige planningstool (integrale-planning-rws.html) draait hieronder ongewijzigd \u2014 XML-import, shifts, FTE-capaciteit, dashboards en autosave incluis. De trigger engine leest live mee.</div>
      <div class="actions"><span id="ipl-brug-status" class="tag gy">brug: wachten op model\u2026</span></div></div>
      <div id="ipl-frame-wrap" style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow);background:#fff"></div>
      <div id="ipl-cap-card" style="margin-top:16px"></div>`;
    IPL_FRAME=document.createElement('iframe');
    IPL_FRAME.id='ipl-frame';
    IPL_FRAME.title='Integrale planning';
    IPL_FRAME.style.cssText='width:100%;height:calc(100vh - 168px);border:none;display:block;background:#fff';
    // Lokale file://-modus: laad nooit het bovenliggende HTML-bestand als frame-URL.
    // about:blank erft de context van het bovenliggende document. Daarna schrijven we
    // de vertrouwde ingebedde planning rechtstreeks in dat document. Dit voorkomt de
    // unieke file-origin fout die Edge/Chrome bij een lokaal srcdoc-frame kan geven.
    IPL_FRAME.src='about:blank';
    var frameWrap=document.getElementById('ipl-frame-wrap');
    frameWrap.appendChild(IPL_FRAME);
    var frameGestart=false;
    function startLokalePlanning(){
      if(frameGestart)return;frameGestart=true;
      try{
        var d=IPL_FRAME.contentWindow.document;
        IPL_FRAME.src='planning.html';
      }catch(ex){
        console.error('Lokale planning kon niet worden gestart',ex);
        frameWrap.innerHTML='<div style="padding:18px;color:#8b1020;background:#fde8ea;border:1px solid #c0121f"><b>Planning kon niet lokaal worden geopend.</b><br>'+String(ex.message||ex)+'</div>';
      }
    }
    IPL_FRAME.addEventListener('load',function(){
      if(!frameGestart){startLokalePlanning();return;}
      setTimeout(function(){try{pushForm();}catch(e){}try{civFormatiePush();}catch(e){}},250);
    });
    // about:blank is doorgaans direct gereed; de timeout is een fallback voor browsers
    // die voor about:blank geen afzonderlijk load-event uitsturen.
    setTimeout(startLokalePlanning,0);
  }
  const st=document.getElementById('ipl-brug-status');
  const capst=bridgeCapaciteit();
  if(st){const m=bridgeModel();
    if(m){st.className='tag g';st.textContent='brug actief: '+m.bestand+' \u00b7 '+m.regels.length+' regels'+(m.shift?(' \u00b7 shift '+(m.shift>0?'+':'')+m.shift+' mnd'):'')+(capst&&capst.geconfig?(' \u00b7 capaciteit: '+capst.nMetFte+' taken met FTE'):'')}
    else{st.className='tag gy';st.textContent='brug: nog geen planning geladen in de tool'}}
  renderCapKaart();
}
function p6CapBlok(){
  const c=DB.p6Capaciteit;
  const knop=`<button class="btn primary" onclick="document.getElementById('p6ftefile').click()">\u2b06 FTE-capaciteit uit P6-export importeren</button>`;
  if(!c)return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">${knop}<span style="font-size:11.5px;color:var(--sub)">Primavera-export (APIBusinessObjects-XML) met resource-toewijzingen \u2014 het dashboard houdt de FTE per activiteit uit dat bestand aan.</span></div>`;
  const overlapTxt=c.overlap===undefined?'':(c.overlap>0?` \u00b7 <b>${c.overlap}</b> gekoppeld aan de geladen planning`:' \u00b7 <span style="color:var(--oranje)">nog niet gekoppeld \u2014 laad dezelfde P6-export in de tool</span>');
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 10px">${knop}
    <button class="btn danger" onclick="p6VerwijderCap()">Verwijder P6-FTE</button>
    <span class="tag b">P6-FTE actief</span>
    <span style="font-size:11.5px;color:var(--sub)">${esc(c.bestand)} \u00b7 <b>${c.nActiviteiten}</b> activiteiten \u00b7 <b>${fmtF(c.totFte)}</b> fte \u00b7 ${c.rollen.length} rollen${overlapTxt} \u00b7 ge\u00efmporteerd ${c.datum}</span></div>`;
}
/* standalone capaciteitskaart uit de P6-export (zonder tool-model): totale
   FTE-vraag over de tijd + per rol, met koppelstatus. Zo is de capaciteit uit
   het bestand direct zichtbaar, ook v\u00f3\u00f3r de planning in de tool staat. */
function p6StandaloneKaartHTML(opts){
  const knoppen=!opts||opts.knoppen!==false;
  const c=DB.p6Capaciteit,kws=p6StandaloneKwartalen(c);
  let chart='<div class="empty">Geen datums in de export om de capaciteit over de tijd te tonen.</div>';
  if(kws.length){
    const W=Math.max(700,kws.length*30+120),x0=46,plotW=W-x0-14,bw=Math.max(8,plotW/kws.length-6);
    const maxT=Math.max(...kws.map(k=>k.tot),1)*1.12,yv=v=>160-v/maxT*140;
    let svg=`<svg width="${W}" height="200" font-family="Segoe UI,Arial,sans-serif">`;
    for(let g=0;g<=4;g++){const v=maxT*g/4;svg+=`<line x1="${x0}" y1="${yv(v)}" x2="${W-10}" y2="${yv(v)}" stroke="#e8ecf2"/><text x="${x0-6}" y="${yv(v)+3.5}" text-anchor="end" font-size="9" fill="#5a6478" font-family="Consolas">${v.toFixed(0)}</text>`;}
    kws.forEach((k,i)=>{const x=x0+i*(plotW/kws.length)+3;
      svg+=`<rect x="${x}" y="${yv(k.tot)}" width="${bw}" height="${160-yv(k.tot)}" fill="#0050a0" opacity=".9"><title>${k.label}: ${fmtF(k.tot)} fte</title></rect>`;
      if(k.q===1)svg+=`<text x="${x+bw/2}" y="174" text-anchor="middle" font-size="8.5" fill="#5a6478">${k.label}</text>`;});
    svg+='</svg>';chart=`<div style="overflow-x:auto">${svg}</div>`;
  }
  const projRows=Object.entries(c.perProject||{}).sort((a,b)=>b[1].fte-a[1].fte).map(([naam,p])=>
    `<tr><td><b>${esc(naam)}</b>${p.pad&&p.pad.length?`<br><span style="font-size:11px;color:var(--sub)">${esc(p.pad.join(' \u203a '))}</span>`:''}</td><td>${p.vc?`<span class="tag gy">${esc(p.vc)}</span>`:'\u2014'}</td><td class="num">${p.nAct}</td><td class="num" style="font-weight:700">${fmtF(p.fte)}</td></tr>`).join('');
  const rolRows=Object.entries(c.perRol||{}).sort((a,b)=>b[1]-a[1]).map(([r,v])=>`<tr><td>${esc(r)}</td><td class="num">${fmtF(v)}</td></tr>`).join('');
  return `<div class="card" style="margin-bottom:0"><h3>Capaciteitsvraag uit de planning <span class="hint">bron: P6-export (${esc(c.bestand)})</span></h3>
    ${knoppen?p6CapBlok():''}
    <div class="footnote" style="color:var(--oranje);margin-top:0">Nog niet gekoppeld aan de planningstool. Laad ${knoppen?'hierboven ':''}dezelfde Primavera-export in de planningstool (pagina Integrale planning) voor de uitsplitsing per dienst en toetsing aan de capaciteitsgrenzen. De capaciteit per project en over de tijd staat hieronder.</div>
    <div class="p6-stats"><span>totaal <b>${fmtF(c.totFte)}</b> fte over <b>${c.nActiviteiten}</b> activiteiten</span><span><b>${c.nAssign}</b> toewijzingen \u00b7 <b>${c.rollen.length}</b> rollen</span></div>
    <h3 style="font-size:12px;margin:12px 0 6px">Capaciteit per project <span style="font-weight:400;text-transform:none;color:var(--sub)">(uit de WBS van de export)</span></h3>
    <table style="max-width:640px"><thead><tr><th>Project (WBS)</th><th>Verkeerscentrale</th><th class="num">Activiteiten</th><th class="num">FTE</th></tr></thead><tbody>${projRows}</tbody></table>
    ${chart}
    <table style="margin-top:10px;max-width:420px"><thead><tr><th>Rol (resource)</th><th class="num">FTE</th></tr></thead><tbody>${rolRows}</tbody></table>
    <div class="footnote">Capaciteit rechtstreeks uit de resource-toewijzingen van de Primavera-export (PlannedUnitsPerTime per activiteit), toegewezen aan het project via de WBS-hi\u00ebrarchie.</div></div>`;
}
function p6ProjectTabelHTML(){
  if(!(DB.p6Capaciteit&&DB.p6Capaciteit.perProject))return '';
  return `<h3 style="font-size:12px;margin:14px 0 6px">Capaciteit per project <span style="font-weight:400;text-transform:none;color:var(--sub)">(uit de WBS van de P6-export)</span></h3>
    <table style="max-width:640px"><thead><tr><th>Project (WBS)</th><th>Verkeerscentrale</th><th class="num">Activiteiten</th><th class="num">FTE</th></tr></thead><tbody>${Object.entries(DB.p6Capaciteit.perProject).sort((a,b)=>b[1].fte-a[1].fte).map(([naam,pr])=>`<tr><td><b>${esc(naam)}</b>${pr.pad&&pr.pad.length?`<br><span style="font-size:11px;color:var(--sub)">${esc(pr.pad.join(' › '))}</span>`:''}</td><td>${pr.vc?`<span class="tag gy">${esc(pr.vc)}</span>`:'—'}</td><td class="num">${pr.nAct}</td><td class="num" style="font-weight:700">${fmtF(pr.fte)}</td></tr>`).join('')}</tbody></table>`;
}
/* de volledige capaciteitskaart als HTML-string, herbruikbaar op de planning- en
   databronnenpagina. Gekoppeld (per dienst) als de planning in de tool staat,
   anders standalone uit de P6-export. */
function capaciteitKaartHTML(opts){
  opts=opts||{};const knoppen=opts.knoppen!==false;
  const m=bridgeModel();
  const cap=m?bridgeCapaciteit():null;
  if(!(cap&&cap.geconfig)){
    if(DB.p6Capaciteit)return p6StandaloneKaartHTML(opts);
    if(!m)return '';
    return `<div class="card" style="margin-bottom:0"><h3>Capaciteitsvraag uit de planning</h3>
      ${knoppen?p6CapBlok():''}
      <div class="empty">De geladen planning bevat nog geen FTE-toewijzingen (${cap?cap.nTaken:0} taken, 0 met FTE-rollen).<br><br>
      Houd de capaciteit aan uit je <b>Primavera-export</b>${knoppen?' met de knop hierboven':' (pagina Integrale planning)'} (resource-toewijzingen → FTE per activiteit), óf gebruik de FTE-configuratie van de planningstool zelf.</div></div>`;
  }
  const kleuren=DIENST_KLEUR,kws=cap.kwartalen;
  const W=Math.max(700,kws.length*34+120),Hh=210,x0=46,plotW=W-x0-14,bw=Math.max(10,plotW/Math.max(1,kws.length)-6);
  const maxTot=Math.max(...kws.map(k=>k.tot),...Object.values(cap.perDienst).map(i=>i.grens||0),1)*1.12;
  const yv=v=>170-v/maxTot*150;
  let svg=`<svg width="${W}" height="${Hh}" font-family="Segoe UI,Arial,sans-serif">`;
  for(let g=0;g<=4;g++){const v=maxTot*g/4;svg+=`<line x1="${x0}" y1="${yv(v)}" x2="${W-10}" y2="${yv(v)}" stroke="#e8ecf2"/><text x="${x0-6}" y="${yv(v)+3.5}" text-anchor="end" font-size="9" fill="#5a6478" font-family="Consolas">${v.toFixed(0)}</text>`}
  kws.forEach((k,i)=>{
    const x=x0+i*(plotW/kws.length)+3;let y=170;
    cap.diensten.forEach(d=>{const v=k.per[d]||0;if(v<=0)return;const hh=v/maxTot*150;y-=hh;
      svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${kleuren[d]||'#5a6478'}" opacity=".9"><title>${k.label} · ${d}: ${fmtF(v)} fte</title></rect>`});
    if(k.q===1)svg+=`<text x="${x+bw/2}" y="184" text-anchor="middle" font-size="8.5" fill="#5a6478">${k.label}</text>`;
  });
  cap.diensten.forEach(d=>{const g=cap.perDienst[d].grens;if(!g)return;
    svg+=`<line x1="${x0}" y1="${yv(g)}" x2="${W-10}" y2="${yv(g)}" stroke="${kleuren[d]}" stroke-width="1.2" stroke-dasharray="5 3" opacity=".7"/><text x="${W-12}" y="${yv(g)-3}" text-anchor="end" font-size="8.5" fill="${kleuren[d]}" font-weight="700">grens ${d} (${g})</text>`});
  svg+='</svg>';
  const rijen=cap.diensten.map(d=>{const i=cap.perDienst[d];
    const status=i.grens>0?(i.piek>i.grens?(i.piek-i.grens>=2?'<span class="tag r">Overschrijding</span>':'<span class="tag o">Boven grens</span>'):'<span class="tag g">Binnen grens</span>'):'<span class="tag gy">Geen grens</span>';
    return `<tr><td>${dienstChip(d)}</td><td class="num">${fmtF(i.piek)}</td><td>${esc(i.piekKw)}</td><td class="num">${i.grens||'—'}</td><td class="num">${i.overKw||0}</td><td>${status}</td></tr>`}).join('');
  const bron=DB.p6Capaciteit?'P6-export ('+esc(DB.p6Capaciteit.bestand)+')':'FTE-config van de planningstool';
  return `<div class="card" style="margin-bottom:0"><h3>Capaciteitsvraag uit de planning <span class="hint">bron: ${bron} · grenzen instelbaar in de rule engine · telt door in triggers en Monte Carlo</span></h3>
    ${knoppen?p6CapBlok():''}
    <div class="p6-stats"><span><b>${cap.nMetFte}</b> van <b>${cap.nTaken}</b> taken met FTE</span><span>cumulatief <b>${fmtF(cap.totFte)}</b> fte-toewijzing</span></div>
    <div style="overflow-x:auto">${svg}</div>
    <table style="margin-top:10px;max-width:640px"><thead><tr><th>Dienst</th><th class="num">Piek FTE</th><th>Kwartaal</th><th class="num">Grens</th><th class="num">Kw &gt; grens</th><th>Status</th></tr></thead><tbody>${rijen}</tbody></table>
    ${p6ProjectTabelHTML()}</div>`;
}
function renderCapKaart(){
  const el=document.getElementById('ipl-cap-card');if(!el)return;
  el.innerHTML=capaciteitKaartHTML({knoppen:true});
}

/* ─────────────── DATABRONNEN ─────────────── */
function renderData(){
  const p=activeParams();
  const assetRows=DB.assets.map(a=>{const norm=normVoor(a);return `<tr>
    <td><b>${esc(a.naam)}</b></td><td><span class="tag gy">${a.cmdb}</span></td>
    <td class="num"><input type="number" step="0.1" value="${a.besch}" style="width:76px" onchange="DB.assets.find(x=>x.id==='${a.id}').besch=+this.value;saveDB()"></td>
    <td class="num" style="color:var(--sub)">${fmtF(norm)}</td>
    <td class="num"><input type="number" value="${a.storingenJr}" style="width:60px" onchange="DB.assets.find(x=>x.id==='${a.id}').storingenJr=+this.value;saveDB()"></td>
    <td>${(100-(100-a.besch)*p.storingsFactor)>=norm?'<span class="tag g">Norm</span>':'<span class="tag r">Onder norm</span>'}</td></tr>`}).join('');

  const fteRows=DB.functies.map(f=>`<tr><td>${esc(f.naam)}</td>
    <td class="num" style="color:var(--sub)">${fmtF(f.benodigdFte)}</td>
    <td class="num"><input type="number" step="0.1" value="${f.actueelFte}" style="width:76px" onchange="DB.functies.find(x=>x.id==='${f.id}').actueelFte=+this.value;saveDB()"></td>
    <td class="num" style="font-weight:700;color:${f.actueelFte>=f.benodigdFte*(1+p.verzuim/100)?'var(--groen)':'var(--rood)'}">${fmtF(f.actueelFte-f.benodigdFte*(1+p.verzuim/100))}</td></tr>`).join('');

  $('#page-data').innerHTML=`
    <div class="pagehead"><h2>Databronnen</h2><div class="desc">Actuele data per domein. De integrale planning komt uit de Primavera P6 XML-import (eigen tabblad); de normen komen uit config.html.</div>
    <div class="actions"><button class="btn danger" onclick="legModel()">\u232b Leeg model (data wissen)</button></div></div>
    ${(DB.functies.length||DB.assets.length)?'':'<div class="card" style="border-left:4px solid var(--rws-blauw-mid)"><div style="font-size:12.5px;color:var(--sub)">Het model is leeg \u2014 geen bedrijfsfuncties of assets. Voeg data toe via de knoppen op <b>Assetmanagement</b> (NDW-import, storingsmeldingen) of via <b>\u2b06 Import</b> in de topbar (volledige dataset als JSON). De regels (config, impactregels, AM-regels, storingsregels, capaciteitsgrenzen) staan al klaar.</div></div>'}
    <div class="card"><h3>Integrale planning <span class="hint">GPO \u00b7 VWM \u00b7 CIV \u00b7 bron: embedded planningstool</span></h3>
      ${(()=>{const bm=bridgeModel();return bm?`<div class="p6-stats"><span>Bron: <b>${esc(bm.bestand)}</b></span><span><b>${bm.regels.length}</b> regels</span><span>bereik <b>${bm.t0} \u2013 ${bm.t1}</b></span><span><b>${bm.nCross}</b>/<b>${bm.nRel}</b> cross-dienst relaties</span></div>
        <button class="btn primary" onclick="goto('planning')">Open de planningstool \u2192</button>`
      :`<div class="empty">Nog geen planning geladen. <button class="btn primary" onclick="goto('planning')">Open de planningstool en importeer XML \u2192</button></div>`})()}</div>
    <div class="grid2">
      <div class="card"><h3>Asset prestaties / LCM <span class="hint">actuele beschikbaarheid uit de CMDB\u2019s \u00b7 norm uit config.html</span></h3>
        <table><thead><tr><th>Asset</th><th>CMDB</th><th class="num">Actueel %</th><th class="num">Norm %</th><th class="num">Storingen/jr</th><th>Status</th></tr></thead><tbody>${assetRows}</tbody></table></div>
      <div class="card"><h3>Formatie <span class="hint">actueel vs benodigd (incl. ${fmtF(p.verzuim)}% verzuim uit config)</span></h3>
        <table><thead><tr><th>Bedrijfsfunctie</th><th class="num">Benodigd</th><th class="num">Actueel</th><th class="num">\u0394</th></tr></thead><tbody>${fteRows}</tbody></table>
        <h3 style="margin-top:16px">Financi\u00ebn</h3>
        <div class="frm"><label>Budget dienstverlening \u20ac/jr</label><input type="number" step="10000" value="${DB.financien.budgetJr}" onchange="DB.financien.budgetJr=+this.value;saveDB()">
        <label>Kostenindex</label><input type="number" step="0.01" value="${DB.params.kostenIndex}" onchange="DB.params.kostenIndex=+this.value;saveDB()"></div>
        <div class="footnote">Benodigde middelen: ${fmtE(DB.functies.reduce((s,f)=>s+f.onderhoudEur,0)*p.kostenIndex)} volgens de P\u00d7Q-regels \u00b7 contracteis ${cfg('contract.beschikbaarheidseis',99.5)}% met boete ${fmtE(+cfg('contract.boete_per_uur',500))}/uur uit config.html.</div></div>
    </div>
    ${(()=>{const h=capaciteitKaartHTML({knoppen:true});return h?`<div style="margin-top:16px">${h}</div>`:''})()}`;
}

/* ─────────────── SIMULATIE ─────────────── */
let mcResult=null;
function renderSim(){
  const p=SIM||basisParams();
  const sliders=[
    {k:'verzuim',lbl:'Ziekteverzuim %',sub:'basis '+fmtF(+cfg('personeel.ziekteverzuim',5))+'% uit config.html',min:0,max:15,step:0.5,fmt:v=>fmtF(v)+'%'},
    {k:'ftePct',lbl:'Formatie \u0394%',sub:'meer of minder inzetbare fte',min:-20,max:20,step:1,fmt:v=>(v>0?'+':'')+v+'%'},
    {k:'kostenIndex',lbl:'Kostenindex',sub:'prijsstijging onderhoud & inhuur',min:0.9,max:1.3,step:0.01,fmt:v=>'\u00d7'+fmtF(v,2)},
    {k:'budgetPct',lbl:'Budget \u0394%',sub:'taakstelling of extra middelen',min:-25,max:25,step:1,fmt:v=>(v>0?'+':'')+v+'%'},
    {k:'storingsFactor',lbl:'Storingsfactor',sub:'toename asset-uitval (veroudering, cyber)',min:0.5,max:3,step:0.1,fmt:v=>'\u00d7'+fmtF(v)}
  ];
  const baseT=evalTriggers(basisParams()),simT=evalTriggers(p);
  const cnt=(T,s)=>T.filter(t=>t.sev===s).length;

  $('#page-sim').innerHTML=`
    <div class="pagehead"><h2>Simulatie</h2><div class="desc">Maak de gevolgen van alle parameters inzichtelijk: pas ze aan, zie de triggers verschuiven en prognosticeer risico\u2019s met Monte Carlo.</div>
    <div class="actions"><button class="btn" onclick="simUitConfig()">\u2b07 Config-scenario overnemen (sim.*)</button><button class="btn" onclick="resetSim()">\u21ba Terug naar basis</button></div></div>
    <div class="grid2">
      <div class="card"><h3>Parameters <span class="hint">wijzigingen gelden direct in de hele driehoek</span></h3>
        ${sliders.map(s=>`<div class="slider-row"><label>${s.lbl}<small>${s.sub}</small></label>
          <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${p[s.k]}" oninput="setSim('${s.k}',+this.value)">
          <div class="sval" id="sv-${s.k}">${s.fmt(p[s.k])}</div></div>`).join('')}
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <select id="mcN" style="width:150px"><option value="2000">2.000 runs</option><option value="10000" selected>10.000 runs</option><option value="50000">50.000 runs</option></select>
          <button class="btn primary" onclick="doMC()">\u25b6 Monte Carlo prognose</button></div>
      </div>
      <div class="card"><h3>Effect op triggers <span class="hint">basis vs simulatie</span></h3>
        <table><thead><tr><th></th><th class="num">Basis</th><th class="num">Simulatie</th><th class="num">\u0394</th></tr></thead><tbody>
          ${[['Kritiek','r'],['Aandacht','o']].map(([l,s])=>{const b=cnt(baseT,s),v=cnt(simT,s);return `<tr><td>${sevTag(s)} ${l}</td><td class="num">${b}</td><td class="num" style="font-weight:700">${v}</td><td class="num" style="color:${v>b?'var(--rood)':v<b?'var(--groen)':'var(--sub)'}">${v-b>0?'+':''}${v-b}</td></tr>`}).join('')}
        </tbody></table>
        <div id="mcout" style="margin-top:14px">${mcResult?mcHTML(mcResult):'<div class="empty">Nog geen prognose gedraaid. Stel parameters in en start de Monte Carlo.</div>'}</div>
      </div>
    </div>`;
  if(mcResult)drawHist(mcResult);
}
function setSim(k,v){
  if(!SIM)SIM=basisParams();
  SIM[k]=v;
  $('#simbadge').classList.add('on');
  const fmts={verzuim:x=>fmtF(x)+'%',ftePct:x=>(x>0?'+':'')+x+'%',kostenIndex:x=>'\u00d7'+fmtF(x,2),budgetPct:x=>(x>0?'+':'')+x+'%',storingsFactor:x=>'\u00d7'+fmtF(x)};
  $('#sv-'+k).textContent=fmts[k](v);
  clearTimeout(setSim._t);setSim._t=setTimeout(()=>renderSim(),350);
}
function doMC(){
  const n=+$('#mcN').value;
  mcResult=runMC(n,activeParams());mcResult.n=n;
  renderSim();
}
function mcHTML(m){
  return `<div class="mc-stats" style="grid-template-columns:repeat(3,1fr)">
    <div class="mc-stat"><div class="v" style="color:${m.pFte>0.5?'var(--rood)':m.pFte>0.2?'var(--oranje)':'var(--groen)'}">${Math.round(m.pFte*100)}%</div><div class="l">Kans FTE-tekort</div></div>
    <div class="mc-stat"><div class="v" style="color:${m.pBud>0.5?'var(--rood)':m.pBud>0.2?'var(--oranje)':'var(--groen)'}">${Math.round(m.pBud*100)}%</div><div class="l">Kans budgetoverschrijding</div></div>
    <div class="mc-stat"><div class="v" style="color:${m.pAsset>0.5?'var(--rood)':m.pAsset>0.2?'var(--oranje)':'var(--groen)'}">${Math.round(m.pAsset*100)}%</div><div class="l">Kans asset extra onder norm</div></div></div>
  <table style="margin-bottom:10px"><thead><tr><th></th><th class="num">P10</th><th class="num">P50</th><th class="num">P90</th></tr></thead><tbody>
    <tr><td>FTE-gat (fte)</td><td class="num">${fmtF(m.q(m.fteGaps,.1))}</td><td class="num">${fmtF(m.q(m.fteGaps,.5))}</td><td class="num" style="font-weight:700;color:var(--rood)">${fmtF(m.q(m.fteGaps,.9))}</td></tr>
    <tr><td>Budgetgat incl. boete (\u20ac)</td><td class="num">${fmtE(m.q(m.budGaps,.1))}</td><td class="num">${fmtE(m.q(m.budGaps,.5))}</td><td class="num" style="font-weight:700;color:var(--rood)">${fmtE(m.q(m.budGaps,.9))}</td></tr>
    <tr><td>Contractboete (\u20ac)</td><td class="num">${fmtE(m.q(m.boetes,.1))}</td><td class="num">${fmtE(m.q(m.boetes,.5))}</td><td class="num" style="font-weight:700;color:var(--rood)">${fmtE(m.q(m.boetes,.9))}</td></tr>
  </tbody></table>
  <div style="font-size:11px;color:var(--sub);margin-bottom:4px">Verdeling samengestelde risicoscore \u00b7 ${m.n.toLocaleString('nl-NL')} runs \u00b7 MTTR en contracteis uit config.html</div>
  <canvas class="chart" id="histc" width="600" height="150"></canvas>`;
}
function drawHist(m){
  const c=$('#histc');if(!c)return;const ctx=c.getContext('2d');
  const B=36,min=m.scores[0],max=m.scores[m.scores.length-1]||1,bins=new Array(B).fill(0);
  m.scores.forEach(s=>{bins[Math.min(B-1,Math.floor((s-min)/(max-min||1)*B))]++});
  const mx=Math.max(...bins);
  ctx.clearRect(0,0,600,150);
  const p50=m.q(m.scores,.5),p90=m.q(m.scores,.9);
  bins.forEach((b,i)=>{
    const x=i/B*590+5,h=b/mx*120,binVal=min+(i+0.5)/B*(max-min);
    ctx.fillStyle=binVal>=p90?'#c0121f':binVal>=p50?'#e06b00':'#0050a0';
    ctx.fillRect(x,140-h,590/B-2,h);
  });
  ctx.fillStyle='#5a6478';ctx.font='10px Consolas';
  ctx.fillText('laag risico',8,149);ctx.textAlign='right';ctx.fillText('hoog risico \u2192',595,149);ctx.textAlign='left';
}

/* ─────────────── NAV & IO ─────────────── */
function goto(page){
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.querySelectorAll('.page').forEach(pg=>pg.classList.toggle('active',pg.id==='page-'+page));
  refresh();
}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>goto(b.dataset.page));
function refresh(){
  const T=evalTriggers(activeParams());
  const rag=ragOf(T);
  ['dot-dash','dot-trig'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.background=ragColor(rag)});
  $('#simbadge').classList.toggle('on',simActive());
  const act=document.querySelector('.page.active').id.replace('page-','');
  ({dash:renderDash,rules:renderRules,triggers:renderTriggers,am:renderAM,planning:renderPlanning,data:renderData,sim:renderSim})[act]();
}
/* leeg het model — wist alle actuele data (functies, assets, ketens, doelen en
   de NDW-/storingsimports) maar laat de regels staan (config, impact, amRegels,
   storingsRegels, capgrens). Handig om schoon te testen met eigen data. */
function legModel(){
  if(!confirm('Alle actuele data wissen — bedrijfsfuncties, assets en geïmporteerde NDW-/storingsdata — en met een leeg model beginnen?\n\nDe regels (config, impactregels, AM-regels, storingsregels, capaciteitsgrenzen) én de generieke bedienketens uit de taakanalyse blijven staan. Dit kan niet ongedaan worden gemaakt.'))return;
  DB.functies=[];DB.assets=[];DB.doelen=[];
  DB.financien={budgetJr:0};
  delete DB.ndwImport;delete DB.storingsImport;
  saveDB();
}
function exportJSON(){
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bidash-wvm-dataset.json';a.click();
}
function importJSON(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{try{DB=migreerDB(JSON.parse(r.result));saveDB()}catch(e){alert('Ongeldig JSON-bestand')}};r.readAsText(f);
}
refresh();
