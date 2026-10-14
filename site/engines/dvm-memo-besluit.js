/* Alleen memoformulering en invoercontrole. Geen dienst- of impactberekening. */
(function(scope){
  const velden=['actie','eigenaar','einddatum','resultaat','terugDatum','besluitvormer'];
  const labels={actie:'Opdracht',eigenaar:'Verantwoordelijke eigenaar',einddatum:'Uiterste opleverdatum',resultaat:'Toetsbaar resultaat',terugDatum:'Datum vervolgbesluit',besluitvormer:'Ontvanger voor het vervolgbesluit'};
  const tekst=v=>typeof v==='string'?v.trim():'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function datum(v){
    const s=tekst(v),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!m)return null;
    const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),t=new Date(s+'T12:00:00Z');
    if(y<1000||!Number.isFinite(+t)||t.getUTCFullYear()!==y||t.getUTCMonth()+1!==mo||t.getUTCDate()!==d)return null;
    return s;
  }
  function datumTekst(v){const s=datum(v);if(!s)return '';const [y,m,d]=s.split('-');return Number(d)+' '+['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'][Number(m)-1]+' '+y;}
  function basisTekst(v){return String(v??'').replace(/&(?:amp|lt|gt|quot|#39);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[s]));}
  function rijen(acties,opgeslagen=[]){
    return (acties||[]).map(a=>{const basis=basisTekst(a),oud=Array.isArray(opgeslagen)?opgeslagen.find(r=>r&&r.basis===basis):null;
      return {basis,...Object.fromEntries(velden.map(k=>[k,oud&&Object.hasOwn(oud,k)?tekst(oud[k]):k==='actie'?basis:'']))};});
  }
  function samenvoegen(bewaard,actueel){
    const basis=new Set(actueel.map(r=>r.basis));
    return [...actueel,...(Array.isArray(bewaard)?bewaard:[]).filter(r=>r&&typeof r.basis==='string'&&!basis.has(r.basis))];
  }
  function controle(r){
    const fouten=velden.filter(k=>!tekst(r[k])).map(k=>labels[k]+' ontbreekt');
    for(const k of ['einddatum','terugDatum'])if(tekst(r[k])&&!datum(r[k]))fouten.push(labels[k]+' is ongeldig');
    if(datum(r.einddatum)&&datum(r.terugDatum)&&r.terugDatum<r.einddatum)fouten.push('Het vervolgbesluit ligt vóór de opleverdatum');
    return fouten;
  }
  function zin(r){
    const eigenaar=tekst(r.eigenaar)||'de nog aan te wijzen eigenaar',wie=tekst(r.eigenaar)||'De nog aan te wijzen eigenaar';
    const actie=tekst(r.actie)||'De opdracht moet nog worden vastgesteld';
    const opdracht=/[.!?]$/.test(actie)?actie:actie+'.';
    return `Instemmen met een uitvoeringsopdracht aan ${eigenaar}. ${opdracht} ${wie} levert uiterlijk ${datumTekst(r.einddatum)||'een nog vast te stellen datum'} ${tekst(r.resultaat).replace(/[.!?]+$/,'')||'een nog vast te stellen, toetsbaar resultaat'} op. ${wie} legt de uitkomsten uiterlijk ${datumTekst(r.terugDatum)||'een nog vast te stellen datum'} aan ${tekst(r.besluitvormer)||'een nog vast te stellen besluitvormer'} voor, ter vaststelling en voor een besluit over het vervolg.`;
  }
  function html(rows){
    const open=rows.filter(r=>controle(r).length).length;
    return `<div class="memo-besluitblok"><p class="memo-besluitstatus">${open?'Conceptbeslispunten. '+open+' van '+rows.length+' opdrachten zijn nog niet volledig ingevuld.':'De beslispunten bevatten opdracht, eigenaar, opleverdatum, toetsbaar resultaat en het volgende besluitmoment.'}</p><ol>${rows.map(r=>`<li><p>${esc(zin(r))}</p>${controle(r).length?'<p class="memo-besluit-open">Nog vast te leggen. '+esc(controle(r).join('; '))+'.</p>':''}</li>`).join('')}</ol></div>`;
  }
  scope.DVM_MEMO_BESLUIT=Object.freeze({velden:Object.freeze(velden),labels:Object.freeze(labels),datum,datumTekst,rijen,samenvoegen,controle,zin,html});
})(globalThis);
