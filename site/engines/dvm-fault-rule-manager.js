/* Beheer van zelfgemaakte foutcodes en expliciete toewijzingen.
   Toewijzingen krijgen voorrang op tekstherkenning, maar nooit op de
   locatie- en assetcontroles in doorrekenen(). */
(() => {
  const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text=value=>String(value??'').trim();
  const assignments=()=>{
    RULES.cfg=RULES.cfg||{};
    if(!RULES.cfg.foutToewijzingen||typeof RULES.cfg.foutToewijzingen!=='object')RULES.cfg.foutToewijzingen={};
    return RULES.cfg.foutToewijzingen;
  };
  const messageKey=message=>text(message?.eventId)||[
    message?.osid,message?.tVan,message?.tTot,message?.weg,message?.richting,message?.hm,message?.melding,message?.gevolg
  ].map(text).join('|');
  const isLocationConflict=message=>message?.assetMatchStatus==='locatieconflict'||/locatieconflict/i.test(text(message?.rekenStatus));
  const isAssignable=message=>!isLocationConflict(message)&&/foutregel/i.test(text(message?.rekenStatus));
  const unresolved=()=>Array.isArray(STATE?.nietDoorgerekend)?STATE.nietDoorgerekend:[];
  const selected=()=>[...document.querySelectorAll('[data-fault-select]:checked')].map(input=>decodeURIComponent(input.dataset.faultSelect));
  const ruleByCode=code=>RULES.foutcodes.find(rule=>text(rule.code)===text(code));

  function assignedRule(message,typeId){
    const assignment=assignments()[messageKey(message)];
    if(!assignment)return null;
    const rule=ruleByCode(assignment.code);
    return rule&&rule.actief&&rule.assetType===typeId?rule:null;
  }

  function validateRule(input){
    const rule={
      code:text(input.code),patroon:text(input.patroon),assetType:text(input.assetType).toUpperCase(),
      severity:text(input.severity).toLowerCase(),availPct:Number(input.availPct),perfPct:Number(input.perfPct),
      oms:text(input.oms),actief:true,userMade:true
    };
    if(!rule.code)throw Error('Vul een foutcode in.');
    if(ruleByCode(rule.code))throw Error('Deze foutcode bestaat al.');
    if(!rule.patroon)throw Error('Vul een herkenbaar tekstpatroon in.');
    if(!RULES.assetTypen.some(type=>type.id===rule.assetType))throw Error('Kies een geldig assettype.');
    if(!['laag','middel','hoog','kritiek'].includes(rule.severity))throw Error('Kies een geldige ernst.');
    if(text(input.availPct)===''||!Number.isFinite(rule.availPct)||rule.availPct<0||rule.availPct>100)throw Error('Beschikbaarheidsimpact moet tussen 0 en 100 liggen.');
    if(text(input.perfPct)===''||!Number.isFinite(rule.perfPct)||rule.perfPct<0||rule.perfPct>100)throw Error('Prestatie-impact moet tussen 0 en 100 liggen.');
    if(!rule.oms)throw Error('Vul een onderbouwing in.');
    return rule;
  }

  function createRule(input){const rule=validateRule(input);RULES.foutcodes.push(rule);return rule;}
  function assign(keys,code){
    const rule=ruleByCode(code);if(!rule||!rule.actief)throw Error('Kies een actieve foutcode.');
    let count=0;
    for(const message of unresolved()){
      const key=messageKey(message);
      if(!keys.includes(key)||!isAssignable(message))continue;
      if(message.typeId!==rule.assetType)continue;
      assignments()[key]={code:rule.code,label:rule.oms,typeId:rule.assetType,createdAt:new Date().toISOString()};count++;
    }
    if(!count)throw Error('Geen geselecteerde melding past bij het assettype van deze foutcode.');
    return count;
  }
  function unassign(key){delete assignments()[key];}
  function removeRule(code){
    const index=RULES.foutcodes.findIndex(rule=>rule.userMade&&text(rule.code)===text(code));
    if(index<0)throw Error('Alleen zelfgemaakte foutcodes kunnen hier worden verwijderd.');
    RULES.foutcodes.splice(index,1);
    for(const [key,value] of Object.entries(assignments()))if(text(value?.code)===text(code))delete assignments()[key];
  }
  function rerun(message){
    parametersToepassen();
    if(message){const status=document.getElementById('faultRuleStatus');if(status){status.textContent=message;status.className='re-status ok';}}
  }

  function renderRows(){
    const rows=unresolved();
    if(!rows.length)return '<div class="asset-config-note">Alle open meldingen zijn doorgerekend.</div>';
    return `<div class="tbl-scroll"><table class="tbl"><thead><tr><th></th><th>Melding</th><th>Type</th><th>Locatie</th><th>Reden</th><th>Toewijzing</th></tr></thead><tbody>${rows.map(message=>{
      const key=messageKey(message),assignment=assignments()[key],eligible=isAssignable(message);
      return `<tr><td><input type="checkbox" data-fault-select="${h(encodeURIComponent(key))}" ${eligible?'':'disabled'} aria-label="Melding selecteren"></td><td><b>${h(message.assetNaam||message.osid||message.eventId||'Onbekende melding')}</b><br><small>${h(message.melding||message.gevolg||'')}</small></td><td><span class="tag gy">${h(message.typeId||'onbekend')}</span></td><td>${h([message.weg,message.richting,message.hm!=null?'hm '+message.hm:''].filter(Boolean).join(' ')||'onbekend')}</td><td>${h(message.rekenStatus||'Onbekend')}</td><td>${assignment?`<b>${h(assignment.code)}</b><br><button class="tb-btn re-sec" onclick="foutcodeToewijzingVerwijderen('${h(encodeURIComponent(key))}')">Ongedaan maken</button>`:eligible?'Nog niet toegewezen':'Los op via Assetconfiguratie'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function renderCustomRules(){
    const rules=RULES.foutcodes.filter(rule=>rule.userMade);
    if(!rules.length)return '<p class="muted">Nog geen zelfgemaakte foutcodes.</p>';
    return `<table class="tbl"><thead><tr><th>Code</th><th>Patroon</th><th>Type</th><th>Impact</th><th></th></tr></thead><tbody>${rules.map(rule=>`<tr><td><b>${h(rule.code)}</b></td><td>${h(rule.patroon)}<br><small>${h(rule.oms)}</small></td><td>${h(rule.assetType)}</td><td>${h(rule.availPct)}% beschikbaarheid · ${h(rule.perfPct)}% prestatie</td><td><button class="dataset-del" onclick="foutcodeVerwijderen('${h(rule.code)}')">Verwijderen</button></td></tr>`).join('')}</tbody></table>`;
  }

  function renderPane(){
    const options=RULES.foutcodes.filter(rule=>rule.actief).map(rule=>`<option value="${h(rule.code)}">${h(rule.code)} · ${h(rule.assetType)} · ${h(rule.oms)}</option>`).join('');
    const types=RULES.assetTypen.filter(type=>type.actief).map(type=>`<option value="${h(type.id)}">${h(type.id)} · ${h(type.functie)}</option>`).join('');
    return `<div class="card"><h3>Foutcodes maken en toewijzen <span class="badge">bewerkbaar</span></h3><p class="muted">Selecteer meldingen waarvoor alleen een passende foutregel ontbreekt. Locatieconflicten kun je hier bewust niet omzeilen.</p><div class="re-toolbar"><select id="faultAssignCode" class="re-in" style="min-width:280px"><option value="">Kies een bestaande foutcode</option>${options}</select><button class="tb-btn primary" onclick="foutcodeSelectieToewijzen()">Toewijzen en herberekenen</button><span id="faultRuleStatus" class="re-status"></span></div>${renderRows()}</div>
    <div class="card"><h3>Nieuwe foutcode</h3><p class="muted">Leg patroon, assettype en beide impactpercentages expliciet vast. Gebruik geen impactwaarde die niet inhoudelijk is onderbouwd.</p><div class="fault-rule-form"><label>Code<input id="faultNewCode" class="re-in" placeholder="bijv. 7001"></label><label>Tekstpatroon<input id="faultNewPattern" class="re-in" placeholder="herkenbare tekst uit de melding"></label><label>Assettype<select id="faultNewType" class="re-in">${types}</select></label><label>Ernst<select id="faultNewSeverity" class="re-in"><option value="laag">Laag</option><option value="middel">Middel</option><option value="hoog">Hoog</option><option value="kritiek">Kritiek</option></select></label><label>Beschikbaarheidsimpact %<input id="faultNewAvail" class="re-in" type="number" min="0" max="100" step="1"></label><label>Prestatie-impact %<input id="faultNewPerf" class="re-in" type="number" min="0" max="100" step="1"></label><label class="fault-rule-wide">Onderbouwing<input id="faultNewDescription" class="re-in" placeholder="waarom deze impact passend is"></label></div><div class="re-toolbar"><button class="tb-btn primary" onclick="foutcodeMaken(false)">Foutcode maken</button><button class="tb-btn" onclick="foutcodeMaken(true)">Maken en geselecteerde meldingen toewijzen</button></div>${renderCustomRules()}</div>`;
  }

  function injectPane(){
    const host=document.getElementById('tab-regels');if(!host)return;
    const tabs=host.querySelector('.rule-subtabs');if(!tabs)return;
    if(!document.getElementById('ruleSubFaults'))tabs.insertAdjacentHTML('beforeend',`<button id="ruleSubFaults" class="${ASSET_CFG_UI.subtab==='foutcodes'?'active':''}" onclick="toonRuleSubtab('foutcodes')">Foutcodes en toewijzing${unresolved().length?` · ${unresolved().length}`:''}</button>`);
    let pane=document.getElementById('rulePaneFaults');
    if(!pane){pane=document.createElement('div');pane.id='rulePaneFaults';tabs.insertAdjacentElement('afterend',pane);}
    pane.classList.toggle('hidden',ASSET_CFG_UI.subtab!=='foutcodes');
    if(ASSET_CFG_UI.subtab==='foutcodes')pane.innerHTML=renderPane();
  }

  const baseFaultRule=window.foutregel;
  if(typeof baseFaultRule==='function')window.foutregel=function(message,typeId){return assignedRule(message,typeId)||baseFaultRule(message,typeId);};
  try{foutregel=window.foutregel;}catch(error){}

  const baseRender=window.renderRegels;
  if(typeof baseRender==='function')window.renderRegels=function(...args){const result=baseRender.apply(this,args);injectPane();return result;};
  try{renderRegels=window.renderRegels;}catch(error){}
  const baseSubtab=window.toonRuleSubtab;
  if(typeof baseSubtab==='function')window.toonRuleSubtab=function(tab){
    if(tab!=='foutcodes')return baseSubtab(tab);
    ASSET_CFG_UI.subtab='foutcodes';injectPane();
    for(const id of ['rulePaneRules','rulePaneAssets'])document.getElementById(id)?.classList.add('hidden');
    for(const id of ['ruleSubRegels','ruleSubAssets'])document.getElementById(id)?.classList.remove('active');
    document.getElementById('ruleSubFaults')?.classList.add('active');document.getElementById('rulePaneFaults')?.classList.remove('hidden');
  };
  try{toonRuleSubtab=window.toonRuleSubtab;}catch(error){}

  window.foutcodeSelectieToewijzen=()=>{try{const count=assign(selected(),document.getElementById('faultAssignCode')?.value);rerun(`${count} melding${count===1?'':'en'} toegewezen.`);}catch(error){alert(error.message);}};
  window.foutcodeMaken=withAssignment=>{let rule=null;try{
    const get=id=>document.getElementById(id)?.value;
    rule=createRule({code:get('faultNewCode'),patroon:get('faultNewPattern'),assetType:get('faultNewType'),severity:get('faultNewSeverity'),availPct:get('faultNewAvail'),perfPct:get('faultNewPerf'),oms:get('faultNewDescription')});
    let count=0;if(withAssignment)count=assign(selected(),rule.code);rerun(`Foutcode ${rule.code} gemaakt${count?` en aan ${count} meldingen toegewezen`:''}.`);
  }catch(error){if(rule)removeRule(rule.code);alert(error.message);}};
  window.foutcodeToewijzingVerwijderen=encoded=>{unassign(decodeURIComponent(encoded));rerun('Toewijzing verwijderd.');};
  window.foutcodeVerwijderen=code=>{if(confirm(`Foutcode ${code} en bijbehorende toewijzingen verwijderen?`)){removeRule(code);rerun(`Foutcode ${code} verwijderd.`);}};

  if(window.HUB){window.HUB.openFaultRules=async()=>{await window.HUB.open('regels');window.toonRuleSubtab('foutcodes');};}
  window.BIDASH_FAULT_RULES={messageKey,isAssignable,validateRule,createRule,assign,unassign,removeRule,assignedRule};
})();
