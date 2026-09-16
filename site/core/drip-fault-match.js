const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
const txt=v=>String(v??'').trim();

function addCodeTokens(value,out){
  const raw=txt(value).toUpperCase();
  if(!raw)return;
  const codeRe=/(?:^|[^A-Z0-9])(DBD\s*0*\d{1,4}[A-Z]?|D\s*0*\d{1,4}[A-Z]?)(?=$|[^A-Z0-9])/g;
  for(const m of raw.matchAll(codeRe)){
    const c=norm(m[1]);
    const hit=c.match(/^(DBD|D)0*(\d+)([A-Z]?)$/);
    if(hit)out.add(hit[1]+String(Number(hit[2]))+(hit[3]||''));
  }
  const dripRe=/DRIP\s*[-_:]?\s*0*(\d{1,4})([A-Z]?)/g;
  for(const m of raw.matchAll(dripRe))out.add('D'+String(Number(m[1]))+(m[2]||''));
}

export function tokenVariants(value){
  const out=new Set(),full=norm(value);
  if(full.length>=3)out.add(full);
  addCodeTokens(value,out);
  return out;
}

const TOKEN_FIELDS=['entityid','id','key','naam','asset','assetNaam','code','foutcode','idCdms','histCode','uid','osid','logId','dynac','cdms','locatie','drip_code','dripCode','melding','omschrijving'];
export function objectTokens(obj){
  const out=new Set();
  for(const field of TOKEN_FIELDS)for(const t of tokenVariants(obj?.[field]))out.add(t);
  return out;
}

const canonVc=v=>norm(v).replace(/^VC/,'');
const canonRoad=v=>norm(v).replace(/^RW0*/,'');
const canonDirection=v=>{
  const s=norm(v);
  if(['LI','LINKS','L'].includes(s))return 'L';
  if(['RE','RECHTS','R'].includes(s))return 'R';
  return s;
};
const num=v=>{if(v==null||v==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?n:null;};

function intersectionCount(a,b){let n=0;for(const x of a)if(b.has(x))n++;return n;}
function locationScore(source,candidate){
  let score=0;
  const svc=canonVc(source?.vc||source?.regio),cvc=canonVc(candidate?.vc||candidate?.regio);
  if(svc&&cvc&&svc===cvc)score+=12;
  const sr=canonRoad(source?.weg||source?.wegnummer),cr=canonRoad(candidate?.weg||candidate?.wegnummer);
  if(sr&&cr&&sr===cr)score+=16;
  const sd=canonDirection(source?.richting),cd=canonDirection(candidate?.richting);
  if(sd&&cd&&sd===cd)score+=6;
  const sh=num(source?.hm??source?.hectometer),ch=num(candidate?.hm??candidate?.hectometer);
  if(sh!=null&&ch!=null){const delta=Math.abs(sh-ch);if(delta<=0.02)score+=25;else if(delta<=0.10)score+=20;else if(delta<=0.35)score+=10;}
  return score;
}

export function compatibleDripLocation(source,candidate){
  const sr=canonRoad(source?.weg||source?.wegnummer),cr=canonRoad(candidate?.weg||candidate?.wegnummer);
  if(sr&&cr&&sr!==cr)return false;
  const sd=canonDirection(source?.richting),cd=canonDirection(candidate?.richting);
  if(sd&&cd&&sd!==cd)return false;
  const sh=num(source?.hm??source?.hectometer),ch=num(candidate?.hm??candidate?.hectometer);
  return sh==null||ch==null||Math.abs(sh-ch)<=.35;
}
function scoreCandidate(source,candidate){
  if(!compatibleDripLocation(source,candidate))return null;
  const overlap=intersectionCount(objectTokens(source),objectTokens(candidate));
  const loc=locationScore(source,candidate);
  if(!overlap&&loc<38)return null;
  return {candidate,overlap,location:loc,score:overlap*100+loc};
}

export function bestDripMatch(source,candidates){
  const scored=(Array.isArray(candidates)?candidates:[]).map(c=>scoreCandidate(source,c)).filter(Boolean).sort((a,b)=>b.score-a.score);
  if(!scored.length)return null;
  if(scored[1]&&scored[0].score===scored[1].score)return null;
  return scored[0];
}

export function matchDripIncident(incident,assets=[],drips=[]){
  const assetList=(Array.isArray(assets)?assets:[]).filter(a=>String(a?.tp||a?.assetType||a?.type||'').toUpperCase()==='DRIP');
  const byKey=new Map(assetList.map(a=>[String(a.key||a.id||''),a]));
  const explicit=String(incident?.matchAssetKey||incident?.assetKey||'');
  if(explicit&&byKey.has(explicit)&&!compatibleDripLocation(incident,byKey.get(explicit)))return null;
  if(explicit&&byKey.has(explicit))return {asset:byKey.get(explicit),drip:null,assetKey:explicit,method:'expliciete assetkoppeling',score:10000};

  let dripMatch=bestDripMatch(incident,drips),drip=dripMatch?.candidate||null;
  let asset=null,assetMatch=null;
  const linkedKey=String(drip?._assetKey||drip?.assetKey||'');
  if(linkedKey&&byKey.has(linkedKey)&&!compatibleDripLocation(incident,byKey.get(linkedKey)))return null;
  if(linkedKey&&byKey.has(linkedKey)&&compatibleDripLocation(incident,byKey.get(linkedKey)))asset=byKey.get(linkedKey);
  if(!asset){
    assetMatch=bestDripMatch(drip||incident,assetList);
    asset=assetMatch?.candidate||null;
  }
  if(!drip&&asset){dripMatch=bestDripMatch(asset,drips);drip=dripMatch?.candidate||null;}
  const assetKey=String(asset?.key||asset?.id||drip?._assetKey||drip?.assetKey||'');
  if(!assetKey&&!drip)return null;
  return {asset,drip,assetKey,method:dripMatch?.overlap||assetMatch?.overlap?'identificatie + locatie':'locatie',score:Math.max(dripMatch?.score||0,assetMatch?.score||0)};
}
