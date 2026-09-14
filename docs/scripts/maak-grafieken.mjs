/* Genereert de figuren bij docs/rekenvoorbeeld-signaalgevers.md uit de
   uitkomsten van bereken-rekenvoorbeeld.mjs. Alle opmaak staat als attribuut
   op het element zelf, zodat de SVG ook blijft kloppen wanneer een viewer
   stijlblokken verwijdert (GitHub doet dat). */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HIER=dirname(fileURLToPath(import.meta.url));
const UIT=join(HIER,'..','afbeeldingen');
mkdirSync(UIT,{recursive:true});

const data=JSON.parse(readFileSync(join(HIER,'..','rekenvoorbeeld.json'),'utf8'));
const rows=data.rows;

/* Palet: dezelfde kleurfamilies als de DIENSTEN in de engine, maar gecontroleerd
   op kleurenblindheid en contrast. De vier lijnen dragen bovendien een eigen
   eindlabel, zodat kleur nooit de enige drager van identiteit is. */
const KLEUR={im:'#cc3347',vm:'#3a72cc',rri:'#0f9a70',wiu:'#bd7d05'};
const INK='#1a2332', MUTED='#68778c', GRID='#e4e9f0', LIJN='#b7c2d2', VLAK='#ffffff';
const F="'Segoe UI',Helvetica,Arial,sans-serif";
const M="'DejaVu Sans Mono',Consolas,monospace";

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const nl=(n,d=0)=>Number(n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const t=(x,y,s,{size=11,fill=MUTED,anchor='start',weight=400,font=F}={})=>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

function kader(w,h,titel,onder){
  return {
    open:`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(onder)}">`
      +`<rect x="0" y="0" width="${w}" height="${h}" fill="${VLAK}"/>`
      +t(24,30,titel,{size:15,fill:INK,weight:600}),
    close:'</svg>\n'
  };
}

/* ─────────── Figuur 1 · beschikbaarheid van het wegdeel ─────────── */
{
  const W=780,H=400,L=68,R=W-150,T=62,B=H-58;
  const x=i=>L+(R-L)*i/(rows.length-1);
  const y=v=>B-(B-T)*v/100;
  const k=kader(W,H,'Beschikbaarheid signaalgevers A12 rechterrijbaan, hm 60,0–78,0',
    'Lijndiagram: de beschikbaarheid van de signaalgevers daalt van 100 procent in 2026 naar 35,6 procent in 2036, terwijl de permanent uitgevallen signaalgevers vanaf 2033 oplopen tot 33,2 procent.');
  let s=k.open;
  s+=t(24,48,'aandeel van de 90 matrixsignaalgevers, in procenten',{size:11.5});
  for(let v=0;v<=100;v+=20){
    s+=`<line x1="${L}" y1="${y(v)}" x2="${R}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s+=t(L-10,y(v)+4,v+'%',{anchor:'end',size:10.5,font:M});
  }
  s+=`<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${LIJN}" stroke-width="1"/>`;
  rows.forEach((r,i)=>{ if(i%2===0||i===rows.length-1) s+=t(x(i),B+20,r.jaar,{anchor:'middle',size:10.5,font:M}); });

  // markeer het jaar waarin de eerste aanlegfase zijn EoL bereikt
  const iEol=rows.findIndex(r=>r.jaar===2032);
  s+=`<line x1="${x(iEol)}" y1="${T-8}" x2="${x(iEol)}" y2="${B}" stroke="${LIJN}" stroke-width="1" stroke-dasharray="4 4"/>`;
  s+=t(x(iEol)+6,T-12,'EoL fase 1 (2032)',{size:10,font:M});

  const pad=(sel)=>rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(sel(r)).toFixed(1)}`).join(' ');
  s+=`<path d="${pad(r=>r.beschPct)} L${x(rows.length-1).toFixed(1)} ${B} L${L} ${B} Z" fill="${KLEUR.vm}" fill-opacity="0.10"/>`;
  s+=`<path d="${pad(r=>r.beschPct)}" fill="none" stroke="${KLEUR.vm}" stroke-width="2" stroke-linejoin="round"/>`;
  s+=`<path d="${pad(r=>r.permPct)}" fill="none" stroke="${KLEUR.im}" stroke-width="2" stroke-linejoin="round"/>`;
  rows.forEach((r,i)=>{
    s+=`<circle cx="${x(i)}" cy="${y(r.beschPct)}" r="4" fill="${KLEUR.vm}" stroke="${VLAK}" stroke-width="2"/>`;
    s+=`<circle cx="${x(i)}" cy="${y(r.permPct)}" r="4" fill="${KLEUR.im}" stroke="${VLAK}" stroke-width="2"/>`;
  });
  // eindlabels uit elkaar houden: 35,6% en 33,2% liggen te dicht op elkaar
  const eind=[{n:'beschikbaar',v:rows.at(-1).beschPct,c:KLEUR.vm},{n:'permanent uit',v:rows.at(-1).permPct,c:KLEUR.im}]
    .map(e=>({...e,yy:y(e.v)})).sort((a,b)=>a.yy-b.yy);
  let vorige=-1e9;
  for(const e of eind){
    const yy=Math.max(e.yy+4,vorige+32); vorige=yy;
    s+=t(R+12,yy,e.n,{fill:e.c,size:11.5,weight:600});
    s+=t(R+12,yy+15,nl(e.v,1)+'%',{fill:MUTED,size:10.5,font:M});
  }
  s+=t(24,H-18,'Bron: bereken-rekenvoorbeeld.mjs · 1.000 Monte Carlo-runs, seed 7102026 · geen vervanging tussen 2026 en 2036',{size:10,font:M});
  writeFileSync(join(UIT,'voorbeeld-beschikbaarheid.svg'),s+k.close);
}

/* ─────────── Figuur 2 · dienstverlening tegen de norm ─────────── */
{
  const W=780,H=420,L=68,R=W-172,T=68,B=H-58,YMIN=60;
  const x=i=>L+(R-L)*i/(rows.length-1);
  const y=v=>B-(B-T)*(v-YMIN)/(100-YMIN);
  const k=kader(W,H,'Wat de uitval doet met de vier dienstverleningen',
    'Lijndiagram: verkeersmanagement zakt van 100 naar 64,6 procent en duikt als eerste onder zijn norm van 99 procent; incidentmanagement, werk in uitvoering en reis- en route-informatie volgen met kleinere dalingen.');
  let s=k.open;
  s+=t(24,48,'beschikbaarheid van de dienst, in procenten — de verticale as begint bij 60%',{size:11.5});
  for(let v=YMIN;v<=100;v+=10){
    s+=`<line x1="${L}" y1="${y(v)}" x2="${R}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s+=t(L-10,y(v)+4,v+'%',{anchor:'end',size:10.5,font:M});
  }
  s+=`<line x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${LIJN}" stroke-width="1"/>`;
  rows.forEach((r,i)=>{ if(i%2===0||i===rows.length-1) s+=t(x(i),B+20,r.jaar,{anchor:'middle',size:10.5,font:M}); });

  // De twee normen liggen 1 procentpunt uit elkaar; hun bijschriften krijgen
  // daarom een eigen plek rechtsboven in plaats van op de lijn zelf.
  for(const norm of [99,98])
    s+=`<line x1="${L}" y1="${y(norm)}" x2="${R}" y2="${y(norm)}" stroke="${INK}" stroke-width="1.25" stroke-dasharray="6 4"/>`;
  s+=`<line x1="${R-150}" y1="${T+22}" x2="${R-132}" y2="${T+22}" stroke="${INK}" stroke-width="1.25" stroke-dasharray="6 4"/>`;
  s+=t(R-126,T+26,'norm 99% · IM en VM',{size:10,fill:INK,font:M});
  s+=`<line x1="${R-150}" y1="${T+40}" x2="${R-132}" y2="${T+40}" stroke="${INK}" stroke-width="1.25" stroke-dasharray="6 4"/>`;
  s+=t(R-126,T+44,'norm 98% · RRI en WIU',{size:10,fill:INK,font:M});
  const NAAM={vm:'Verkeersmanagement',im:'Incidentmanagement',wiu:'Werk in Uitvoering',rri:'Reis- & route-info'};
  const volgorde=['vm','im','wiu','rri'];
  for(const d of volgorde){
    const p=rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(r.diensten[d]).toFixed(1)}`).join(' ');
    s+=`<path d="${p}" fill="none" stroke="${KLEUR[d]}" stroke-width="2" stroke-linejoin="round"/>`;
    rows.forEach((r,i)=>{ s+=`<circle cx="${x(i)}" cy="${y(r.diensten[d])}" r="4" fill="${KLEUR[d]}" stroke="${VLAK}" stroke-width="2"/>`; });
  }
  // eindlabels, uit elkaar gehouden zodat ze elkaar niet raken
  const eind=volgorde.map(d=>({d,v:rows.at(-1).diensten[d],yy:y(rows.at(-1).diensten[d])})).sort((a,b)=>a.yy-b.yy);
  let vorige=-1e9;
  for(const e of eind){
    const yy=Math.max(e.yy,vorige+30); vorige=yy;
    s+=t(R+12,yy,NAAM[e.d],{fill:KLEUR[e.d],size:11,weight:600});
    s+=t(R+12,yy+14,nl(e.v,1)+'%',{fill:MUTED,size:10.5,font:M});
  }
  s+=t(24,H-18,'Alleen de signaalgevers verslechteren; camera, detectie, DRIP en communicatie staan in dit voorbeeld op 100%.',{size:10,font:M});
  writeFileSync(join(UIT,'voorbeeld-diensten.svg'),s+k.close);
}

/* ─────────── Figuur 3 · WIS-compensatie en kosten ─────────── */
{
  const W=780,H=414,T=96,B=H-78;
  const PB=[62,376], PC=[438,752];              // twee panelen, elk een eigen schaal
  const maxJaar=Math.max(...rows.map(r=>r.kosten));
  const maxCum=Math.max(...rows.map(r=>r.cumKosten));
  /* Ronde asstappen, zodat de labels leesbare bedragen tonen in plaats van
     willekeurige delen van het maximum. */
  const nette=max=>{const ruw=max/3,e=10**Math.floor(Math.log10(ruw));
    return [1,2,2.5,5,10].map(m=>m*e).find(v=>v>=ruw)||10*e;};
  const stapJaar=nette(maxJaar), stapCum=nette(maxCum);
  const topJaar=maxJaar*1.08, topCum=maxCum*1.08;
  const k=kader(W,H,'Kosten van de WIS-compensatie',
    'Twee diagrammen: links de meerkosten per jaar, oplopend tot 134.497 euro in 2036; rechts het cumulatieve bedrag, dat over elf jaar uitkomt op 650.732 euro.');
  let s=k.open;
  s+=t(24,50,'inzet van weginspecteurs ter compensatie van uitgevallen signaalgevers, in euro',{size:11.5});

  // paneel A — per jaar (staven)
  const bw=(PB[1]-PB[0])/rows.length-2;
  const ya=v=>B-(B-T)*v/topJaar;
  s+=t(PB[0],T-18,'per jaar',{size:12,fill:INK,weight:600});
  for(let v=0;v<=topJaar;v+=stapJaar){
    s+=`<line x1="${PB[0]}" y1="${ya(v)}" x2="${PB[1]}" y2="${ya(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s+=t(PB[0]-8,ya(v)+4,'€'+nl(Math.round(v/1000))+'k',{anchor:'end',size:10,font:M});}
  s+=`<line x1="${PB[0]}" y1="${B}" x2="${PB[1]}" y2="${B}" stroke="${LIJN}" stroke-width="1"/>`;
  rows.forEach((r,i)=>{
    const bx=PB[0]+i*((PB[1]-PB[0])/rows.length)+1, h=B-ya(r.kosten);
    if(h>0.5)s+=`<rect x="${bx.toFixed(1)}" y="${ya(r.kosten).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${KLEUR.vm}"/>`;
    if(i%2===0||i===rows.length-1)s+=t(bx+bw/2,B+18,String(r.jaar).slice(2),{anchor:'middle',size:10,font:M});
  });
  s+=t(PB[0],B+38,"piek € "+nl(maxJaar)+' in 2036',{size:10,font:M});

  // paneel B — cumulatief (vlak)
  const xc=i=>PC[0]+(PC[1]-PC[0])*i/(rows.length-1);
  const yc=v=>B-(B-T)*v/topCum;
  s+=t(PC[0],T-18,'cumulatief',{size:12,fill:INK,weight:600});
  for(let v=0;v<=topCum;v+=stapCum){
    s+=`<line x1="${PC[0]}" y1="${yc(v)}" x2="${PC[1]}" y2="${yc(v)}" stroke="${GRID}" stroke-width="1"/>`;
    s+=t(PC[0]-8,yc(v)+4,'€'+nl(Math.round(v/1000))+'k',{anchor:'end',size:10,font:M});}
  s+=`<line x1="${PC[0]}" y1="${B}" x2="${PC[1]}" y2="${B}" stroke="${LIJN}" stroke-width="1"/>`;
  const pc=rows.map((r,i)=>`${i?'L':'M'}${xc(i).toFixed(1)} ${yc(r.cumKosten).toFixed(1)}`).join(' ');
  s+=`<path d="${pc} L${xc(rows.length-1).toFixed(1)} ${B} L${PC[0]} ${B} Z" fill="${KLEUR.vm}" fill-opacity="0.12"/>`;
  s+=`<path d="${pc}" fill="none" stroke="${KLEUR.vm}" stroke-width="2" stroke-linejoin="round"/>`;
  rows.forEach((r,i)=>{
    s+=`<circle cx="${xc(i)}" cy="${yc(r.cumKosten)}" r="4" fill="${KLEUR.vm}" stroke="${VLAK}" stroke-width="2"/>`;
    if(i%2===0||i===rows.length-1)s+=t(xc(i),B+18,String(r.jaar).slice(2),{anchor:'middle',size:10,font:M});
  });
  s+=t(PC[1],T-18,'€ '+nl(maxCum)+' totaal',{anchor:'end',size:12,fill:INK,weight:600});
  s+=t(PC[0],B+38,nl(data.cumulatief.fteJaren,2)+' FTE-jaren à € '+nl(data.regels.fteCostYear),{size:10,font:M});
  s+=t(24,H-14,'Meerkosten ten opzichte van 2026; de basisformatie van 300 WIS-FTE zit er niet in.',{size:10,font:M});
  writeFileSync(join(UIT,'voorbeeld-kosten.svg'),s+k.close);
}

console.log('Figuren geschreven naar',UIT);

/* ─────────── Figuur 4 · de keten van asset tot euro ───────────
   Eén momentopname (2032) met daarnaast het eindbeeld (2036), zodat te volgen
   is welke rekenstap welk getal oplevert. */
{
  const W=1000,H=470,BW=280,BH=152;
  const r32=rows.find(r=>r.jaar===2032), r36=rows.at(-1);
  const c=data.corridor, g=data.signaalgewichtPerDienst, N=data.normen, R=data.regels;
  const kol=[40,360,680], rij=[76,286];
  const k=kader(W,H,'Van signaalgever tot euro: de keten in zes stappen',
    'Stroomschema in zes stappen: van 90 signaalgevers met hun levensduur, via de uitvalsprognose en de beschikbaarheid van het wegdeel, naar de vier dienstverleningen, de benodigde WIS-inzet en de kosten per jaar en cumulatief.');
  let s=k.open;
  s+=t(24,50,`momentopname ${r32.jaar}, met het eindbeeld ${r36.jaar} ernaast`,{size:11.5});
  s+=`<defs><marker id="pijl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${LIJN}"/></marker></defs>`;

  const NAAM={vm:'Verkeersmanagement',wiu:'Werk in Uitvoering',im:'Incidentmanagement',rri:'Reis- & route-info'};
  const blok=(i,titel,regels,accent)=>{
    const x=kol[i%3], y=rij[Math.floor(i/3)];
    let o=`<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="4" fill="${i===5?'#f6f8fc':VLAK}" stroke="${accent||LIJN}" stroke-width="${accent?1.6:1.2}"/>`;
    o+=t(x+14,y+24,`${i+1} · ${titel}`,{size:12,fill:accent||INK,weight:600});
    regels.forEach((l,j)=>{o+=t(x+14,y+46+j*17,l,{size:10.5,font:l.mono===false?F:M,fill:MUTED});});
    return o;
  };
  s+=blok(0,'Areaal en levensduur',[
    `${c.aantalSignaalgevers} signaalgevers · ${nl(c.routeKm,1)} km`,
    `${c.weg} ${c.richting}, hm ${nl(c.vanHm,1)}–${nl(c.totHm,1)}`,
    `bouwjaren ${c.fases.map(f=>f.bouwjaar).join(' / ')}`,
    `levensduur ${R.defaultLifeYears} jaar`,
    `EoL ${c.eolJaren.join(' / ')}`]);
  s+=blok(1,'Uitvalsprognose',[
    `${nl(R.mcRuns)} Monte Carlo-runs`,
    `degradatie vanaf ${R.degradeStartPct}% voor EoL`,
    `kans permanent na EoL ${R.permanentChancePct}%`,
    `${r32.jaar}: ${nl(r32.uitvalPct,1)}% uit`,
    `${r36.jaar}: ${nl(r36.uitvalPct,1)}% uit`]);
  s+=blok(2,'Beschikbaarheid wegdeel',[
    `100% − ${nl(r32.uitvalPct,1)}% = ${nl(r32.beschPct,1)}%`,
    `in ${r36.jaar}: ${nl(r36.beschPct,1)}%`,
    `permanent uit ${r36.jaar}: ${nl(r36.permPct,1)}%`,
    '',
    'aandeel dat nog functioneert']);
  s+=blok(3,'Dienstverlening',
    ['dienst = 100 − gewicht × uitval'].concat(
      ['vm','wiu','im','rri'].map(d=>
        `${NAAM[d].slice(0,18)} ${nl(g[d]*100,0)}% → ${nl(r32.diensten[d],1)}%`)));
  s+=blok(4,'WIS-compensatie',[
    `${nl(c.routeKm,1)} km × ${nl(r32.uitvalPct,1)}% = ${nl(r32.aangetastKm,2)} km`,
    `norm ${R.ftePerReferenceKm} FTE per ${R.referenceKm} km`,
    `${nl(r32.aangetastKm,2)} × ${R.ftePerReferenceKm} ÷ ${R.referenceKm} = ${nl(r32.fte,2)} FTE`,
    `in ${r36.jaar}: ${nl(r36.fte,2)} FTE`,
    `bovenop de basis van ${nl(R.baseFte)} FTE`]);
  s+=blok(5,'Kosten',[
    `${nl(r32.fte,2)} FTE × € ${nl(R.fteCostYear)}`,
    `= € ${nl(r32.kosten)} in ${r32.jaar}`,
    `cumulatief t/m ${r32.jaar}: € ${nl(r32.cumKosten)}`,
    `cumulatief t/m ${r36.jaar}: € ${nl(r36.cumKosten)}`,
    `${nl(data.cumulatief.fteJaren,2)} FTE-jaren totaal`],KLEUR.vm);

  const my=(i)=>rij[Math.floor(i/3)]+BH/2;
  for(const i of [0,1,3,4])
    s+=`<line x1="${kol[i%3]+BW}" y1="${my(i)}" x2="${kol[(i+1)%3]-4}" y2="${my(i)}" stroke="${LIJN}" stroke-width="1.5" marker-end="url(#pijl)"/>`;
  s+=`<polyline points="${kol[2]+BW/2},${rij[0]+BH} ${kol[2]+BW/2},${rij[0]+BH+26} ${kol[0]+BW/2},${rij[0]+BH+26} ${kol[0]+BW/2},${rij[1]-4}" fill="none" stroke="${LIJN}" stroke-width="1.5" marker-end="url(#pijl)"/>`;
  s+=t(24,H-16,'Normen: IM en VM 99%, RRI en WIU 98% — alle vier worden in dit voorbeeld al in 2028 doorbroken.',{size:10,font:M});
  writeFileSync(join(UIT,'voorbeeld-keten.svg'),s+k.close);
}
