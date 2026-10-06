const PATCH_SOURCE=String.raw`
(function(){
  if(globalThis.__BIDASH_NDW_LOADER_ACTIVE__)return;
  if(typeof ndw69Summary!=='function'||typeof kostenDagRows!=='function')return;

  const originalSummary=ndw69Summary;
  const DEFAULT_BRON='NDW verkeersintensiteit; hinderuren: spits 07:00–10:00 en 16:00–19:00; generieke snelheidsreductie 30%';

  function loaderHtml(){
    return '<div class="bidash-ndw-loader" style="margin:12px 0;padding:12px;background:#fff;border:1px solid #b7c9d8;border-radius:6px">'
      +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="tb-btn primary" id="bidashNdwLoadButton" onclick="bidashLaadNdw()">Gebruik NDW uit werkruimte</button><button type="button" class="tb-btn" id="bidashNdwChooseButton" onclick="bidashKiesNdwBestand()">Kies export met NDW</button></div>'
      +'<p class="muted" style="margin:8px 0 0">Voor de verkeerskosten wordt NDW-verkeersintensiteit gebruikt. Dit is een andere bron dan de NDW CMDB-import van MSI- en DRIP-areaal. Laad bij voorkeur het actuele NDW DATEX II v3 bestand snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz. Een eerdere Business Intelligence Dashboard WVM/DVM JSON- of HTML-export met ndw69Snapshot blijft ook bruikbaar.</p>'
      +'<p class="muted" style="margin:6px 0 0"><b>Let op:</b> NDW levert het voertuigaantal. De standaard 6 hinderuren en 30% snelheidsreductie zijn scenarioaannames en geen NDW-metingen. Controleer die per wegdeel als je kosten gebruikt.</p>'
      +'<input id="bidashNdwSourceFile" type="file" accept=".xml,.gz,.json,.html,.htm" style="display:none" onchange="bidashNdwBestand(this)">'
      +'<div id="bidashNdwProgress" style="margin-top:8px;display:none"><div style="height:8px;background:#dbe5ec;border-radius:6px;overflow:hidden"><span id="bidashNdwProgressBar" style="display:block;height:100%;width:0;background:#007bc7;transition:width .15s"></span></div><div id="bidashNdwProgressLabel" style="font-size:12px;margin-top:5px">Nog niet gestart</div></div>'
      +'</div>';
  }

  function inject(html){
    const block=loaderHtml();
    const m=String(html||'').match(/<h3>NDW[^<]*<\/h3>/i);
    return m?html.replace(m[0],m[0]+block):block+html;
  }
  ndw69Summary=function(rows){return inject(originalSummary(rows));};

  function setProgress(pct,label,error){
    const root=document.getElementById('bidashNdwProgress'),bar=document.getElementById('bidashNdwProgressBar'),text=document.getElementById('bidashNdwProgressLabel');
    if(root)root.style.display='block';
    if(bar){bar.style.width=Math.max(0,Math.min(100,Number(pct)||0))+'%';bar.style.background=error?'#d52b1e':'#007bc7';}
    if(text)text.textContent=label||'';
  }
  function buttonBusy(busy){for(const id of ['bidashNdwLoadButton','bidashNdwChooseButton']){const b=document.getElementById(id);if(b)b.disabled=!!busy;}}
  function hasValue(v){return v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));}
  function pause(){return new Promise(resolve=>setTimeout(resolve,0));}

  function readStoredWorkspace(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('bidash-integraal',1);
      req.onerror=()=>reject(req.error||new Error('Lokale werkruimte kon niet worden geopend.'));
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('workspace'))req.result.createObjectStore('workspace');};
      req.onsuccess=()=>{
        const db=req.result;let tx;
        try{tx=db.transaction('workspace');}catch(error){db.close();reject(error);return;}
        const get=tx.objectStore('workspace').get('current');
        get.onsuccess=()=>{const value=get.result;db.close();resolve(value);};
        get.onerror=()=>{const error=get.error;db.close();reject(error);};
      };
    });
  }
  function snapshotFromWorkspace(state){
    return state?.dvm?.parameters?.kosten?.ndw69Snapshot||state?.delen?.dvm?.parameters?.kosten?.ndw69Snapshot||state?.parameters?.kosten?.ndw69Snapshot||state?.kosten?.ndw69Snapshot||state?.ndw69Snapshot||null;
  }

  function parseJsonWorker(text){
    return new Promise((resolve,reject)=>{
      if(typeof Worker==='undefined'||typeof Blob==='undefined'||typeof URL==='undefined'){
        try{resolve(JSON.parse(text));}catch(error){reject(error);}return;
      }
      const src='onmessage=function(e){try{postMessage({ok:true,value:JSON.parse(e.data)})}catch(err){postMessage({ok:false,error:err&&err.message||String(err)})}}';
      const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
      const worker=new Worker(url);
      worker.onmessage=e=>{worker.terminate();URL.revokeObjectURL(url);e.data&&e.data.ok?resolve(e.data.value):reject(new Error(e.data?.error||'NDW JSON kon niet worden gelezen.'));};
      worker.onerror=e=>{worker.terminate();URL.revokeObjectURL(url);reject(new Error(e.message||'NDW JSON worker is gestopt.'));};
      worker.postMessage(text);
    });
  }

  function xmlNodes(root,name){return root?Array.from(root.getElementsByTagNameNS('*',name)||[]):[];}
  function xmlOne(root,name){const xs=root?root.getElementsByTagNameNS('*',name):null;return xs&&xs.length?xs[0]:null;}
  function xmlText(node){return node?String(node.textContent||'').trim():'';}
  function xmlFirstText(root,names){
    for(const name of names){const n=xmlOne(root,name),t=xmlText(n);if(t)return t;}
    return '';
  }
  function ndwRoadFromText(){
    const texts=Array.from(arguments).map(v=>String(v||'').toUpperCase()).join(' ');
    const m=texts.match(/(?:^|[^A-Z0-9])([AN])\s*0*(\d{1,3})(?=[^0-9]|$)/);
    return m?m[1]+String(Number(m[2])):'';
  }
  function ndwHmFromText(){
    const texts=Array.from(arguments).map(v=>String(v||'').replace(',','.')).join(' ');
    const tagged=texts.match(/\b(?:KM|HM|HMP|HECTOMETER)\s*[:=\-]?\s*(\d{1,3}(?:\.\d{1,3})?)/i);
    if(tagged)return Number(tagged[1]);
    return null;
  }
  function ndwDirectionFromText(){
    const s=Array.from(arguments).map(v=>String(v||'').toUpperCase()).join(' ');
    if(/(?:^|[^A-Z])(RE|RECHTS)(?:[^A-Z]|$)/.test(s))return 'RE';
    if(/(?:^|[^A-Z])(LI|LINKS)(?:[^A-Z]|$)/.test(s))return 'LI';
    return '';
  }
  function ndwMonibasLocation(){
    const s=Array.from(arguments).map(v=>String(v||'')).join(' ');
    const m=s.match(/(?:^|[_\\s])(\\d{3})[01][a-z]{3}(\\d{4})r[a-z](?:$|[_\\s])/i);
    return m?{road:'A'+String(Number(m[1])),hm:Number(m[2])/10}:{road:'',hm:null};
  }
  function ndwWgs84ToRd(lat,lon){
    lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    const dN=.36*(lat-52.15517440),dE=.36*(lon-5.38720621);
    const R=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]];
    const S=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]];
    let x=155000,y=463000;for(const [p,q,k] of R)x+=k*dN**p*dE**q;for(const [p,q,k] of S)y+=k*dN**p*dE**q;return {x,y};
  }
  function ndwAssetGrid(){
    let assets=[];try{if(typeof ASSET_REGISTER_STATE!=='undefined'&&Array.isArray(ASSET_REGISTER_STATE?.assets))assets=ASSET_REGISTER_STATE.assets;}catch(error){}
    const size=500,map=new Map(),num=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null;};
    for(const a of assets){const x=num(a.rdX),y=num(a.rdY),hm=num(a.hm);if(x==null||y==null||hm==null||!a.weg)continue;const key=Math.floor(x/size)+'|'+Math.floor(y/size),list=map.get(key)||[];list.push({x,y,hm,road:String(a.weg).toUpperCase(),direction:String(a.richting||'').toUpperCase()});map.set(key,list);}
    return {size,map,count:assets.length};
  }
  function ndwEnrichLocation(site,grid){
    if(!grid?.map?.size||site.lat==null||site.lon==null)return site;
    const rd=ndwWgs84ToRd(site.lat,site.lon);if(!rd)return site;
    const gx=Math.floor(rd.x/grid.size),gy=Math.floor(rd.y/grid.size),hint=String(site.road||'').toUpperCase();let best=null,second=null;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const a of (grid.map.get((gx+dx)+'|'+(gy+dy))||[])){
      if(hint&&a.road!==hint)continue;const dist=Math.hypot(a.x-rd.x,a.y-rd.y);
      if(!best||dist<best.dist){second=best;best={a,dist};}else if(!second||dist<second.dist)second={a,dist};
    }
    if(!best||best.dist>200)return {...site,rdX:rd.x,rdY:rd.y,locationMethod:(site.locationMethod||'')+'; WGS84-coördinaat zonder All Assets-match binnen 200 m'};
    return {...site,rdX:rd.x,rdY:rd.y,road:best.a.road||site.road,direction:best.a.direction||site.direction,hm:best.a.hm??site.hm,
      locationUncertain:!!(second&&second.dist-best.dist<3&&second.a.direction!==best.a.direction),
      locationMethod:'NDW DATEX II v3 WGS84 → RD; dichtstbijzijnde All Assets-locatie '+Math.round(best.dist)+' m'};
  }
  async function ndwFileText(file){
    const buf=await file.arrayBuffer(),bytes=new Uint8Array(buf);
    let text='';
    const gzip=/\.gz$/i.test(file.name)||((bytes[0]===0x1f)&&(bytes[1]===0x8b));
    if(gzip){
      if(typeof DecompressionStream!=='function')throw new Error('Deze browser kan NDW .gz niet uitpakken. Gebruik Edge of Chrome, of pak het XML-bestand eerst uit.');
      text=await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }else text=new TextDecoder('utf-8').decode(buf);
    let hash='';
    try{
      if(crypto&&crypto.subtle){const h=await crypto.subtle.digest('SHA-256',buf);hash=Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('');}
    }catch(error){}
    return {text,hash};
  }
  function ndwXmlSnapshot(xml,fileName,hash){
    if(typeof DOMParser!=='function')throw new Error('XML-parser is niet beschikbaar in deze browser.');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(xmlNodes(doc,'parsererror').length)throw new Error('NDW XML kon niet worden gelezen.');
    const configs=new Map();
    const configSites=[...xmlNodes(doc,'measurementSiteRecord'),...xmlNodes(doc,'measurementSite')];
    for(const site of configSites){
      const id=site.getAttribute('id')||'';if(!id||configs.has(id))continue;
      const version=site.getAttribute('version')||'';
      const nameBox=xmlOne(site,'measurementSiteName'),name=xmlFirstText(nameBox,['value'])||id;
      const identification=xmlFirstText(site,['measurementSiteIdentification','measurementEquipmentReference']);
      const loc=xmlOne(site,'measurementSiteLocation');
      const roadNumber=xmlFirstText(loc,['roadNumber'])||xmlFirstText(site,['roadNumber']),monibas=ndwMonibasLocation(id,name,identification);
      const road=ndwRoadFromText(roadNumber,name,identification,id)||monibas.road;
      let hm=null;
      const hmRaw=xmlFirstText(loc,['kilometrePoint','kilometerPoint','hectometre','hectometer','distanceAlong']);
      if(hmRaw&&Number.isFinite(Number(String(hmRaw).replace(',','.'))))hm=Number(String(hmRaw).replace(',','.'));
      if(hm==null)hm=ndwHmFromText(name,identification,id);
      if(hm==null)hm=monibas.hm;
      const direction=ndwDirectionFromText(name,identification,id);
      const latRaw=xmlFirstText(loc,['latitude']),lonRaw=xmlFirstText(loc,['longitude']);
      const lat=Number.isFinite(Number(latRaw))?Number(latRaw):null,lon=Number.isFinite(Number(lonRaw))?Number(lonRaw):null;
      const characteristics=new Map();let flowLane=0,speedLane=0;
      for(const ch of xmlNodes(site,'measurementSpecificCharacteristics')){
        if(!ch.hasAttribute('index'))continue;
        const index=String(ch.getAttribute('index')),type=xmlFirstText(ch,['specificMeasurementValueType']);
        let lane=xmlFirstText(ch,['laneNumber','specificLane'])||'all';
        lane=String(lane).replace(/^lane/i,'')||'all';
        const vehicleType=xmlFirstText(ch,['vehicleType']),hasLength=xmlNodes(ch,'lengthCharacteristic').length>0;
        const anyVehicle=vehicleType==='anyVehicle'||(!vehicleType&&!hasLength);
        if(anyVehicle&&lane==='all'&&type==='trafficFlow')lane=String(++flowLane);
        else if(anyVehicle&&lane==='all'&&type==='trafficSpeed')lane=String(++speedLane);
        const period=Number(xmlFirstText(ch,['period']))||60;
        characteristics.set(index,{index,type,lane,anyVehicle,period});
      }
      configs.set(id,{id,version,name,road,hm,direction,lat,lon,characteristics});
    }
    const measurementSites=xmlNodes(doc,'siteMeasurements'),sites=[];
    let publication='';
    const pubTimes=xmlNodes(doc,'publicationTime').map(xmlText).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b)-Date.parse(a));
    if(pubTimes.length)publication=pubTimes[0];
    for(const sm of measurementSites){
      const ref=xmlOne(sm,'measurementSiteReference'),id=ref?.getAttribute('id')||'';if(!id)continue;
      const cfg=configs.get(id)||{id,version:ref?.getAttribute('version')||'',name:id,road:'',hm:null,direction:'',lat:null,lon:null,characteristics:new Map()};
      const timeBox=xmlOne(sm,'measurementTimeDefault');
      const time=xmlFirstText(timeBox,['timeValue'])||xmlText(timeBox)||publication;
      if(!Number.isFinite(Date.parse(time)))continue;
      const quantities=[
        ...xmlNodes(sm,'physicalQuantity').filter(x=>x.hasAttribute('index')),
        ...xmlNodes(sm,'measuredValue').filter(x=>x.hasAttribute('index'))
      ];
      const laneFlows=new Map(),laneSpeeds=new Map(),issues=[];let period=60;
      for(const qn of quantities){
        const index=String(qn.getAttribute('index')),ch=cfg.characteristics.get(index)||{index,type:'',lane:index,anyVehicle:true,period:60};
        period=ch.period||period;
        const dataError=xmlFirstText(qn,['dataError']).toLowerCase()==='true';
        const flowRaw=xmlFirstText(qn,['vehicleFlowRate']),speedRaw=xmlFirstText(qn,['speed']);
        const isFlow=ch.type==='trafficFlow'||flowRaw!=='',isSpeed=ch.type==='trafficSpeed'||speedRaw!=='';
        if(isFlow&&ch.anyVehicle){
          const v=Number(flowRaw);
          if(dataError||!Number.isFinite(v)||v<0){issues.push('ongeldige intensiteit index '+index);continue;}
          const key=String(ch.lane||index);
          if(laneFlows.has(key)){issues.push('dubbele anyVehicle-intensiteit rijstrook '+key);continue;}
          laneFlows.set(key,{lane:key,index,q:v});
        }
        if(isSpeed&&ch.anyVehicle){
          const v=Number(speedRaw);if(!dataError&&Number.isFinite(v)&&v>=0&&v<=255)laneSpeeds.set(String(ch.lane||index),v);
        }
      }
      const lanes=[...laneFlows.values()].sort((a,b)=>String(a.lane).localeCompare(String(b.lane),undefined,{numeric:true}));
      const q=lanes.length&&!issues.length?lanes.reduce((s,x)=>s+x.q,0):null;
      const speedValues=[...laneSpeeds.values()],speed=speedValues.length?speedValues.reduce((s,x)=>s+x,0)/speedValues.length:null;
      if(!lanes.length)issues.push('geen anyVehicle-intensiteit');
      sites.push({id,version:cfg.version||ref?.getAttribute('version')||'',name:cfg.name||id,time,road:cfg.road||'',direction:cfg.direction||'',hm:cfg.hm,lat:cfg.lat,lon:cfg.lon,
        q,period,speed,lanes,issues,locationMethod:'NDW DATEX II v3 gecombineerd bestand; weg/richting/hectometer uit configuratie of herkenbare meetlocatienaam'});
    }
    if(!measurementSites.length&&configs.size)throw new Error('NDW-configuratiebestand herkend met '+configs.size.toLocaleString('nl-NL')+' meetlocaties, maar zonder actuele meetwaarden. Dit bestand is alleen de meetlocatieconfiguratie. Kies snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz.');
    if(!sites.length)throw new Error('Geen gekoppelde NDW meetgegevens gevonden. Kies het gecombineerde bestand snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz.');
    const grid=ndwAssetGrid(),gekoppeldeSites=sites.map(s=>ndwEnrichLocation(s,grid));
    const validSites=gekoppeldeSites.filter(s=>s.q!==null).length;
    const locationSites=gekoppeldeSites.filter(s=>s.road&&s.hm!=null&&s.direction).length;
    return {schema:1,publication:publication||new Date().toISOString(),configurationPublication:publication||'',files:[fileName],sha256:[hash||''],stats:{sites:gekoppeldeSites.length,validSites,locationSites,assetRegister:grid.count},sites:gekoppeldeSites};
  }
  async function snapshotFromRawNdw(file){
    const naam=String(file?.name||'').toLowerCase();
    if(naam.includes('snelheden_en_intensiteiten_configuratie_meetlocaties')&&!naam.includes('meetgegevens_en_configuratie')){
      throw new Error('Dit is alleen het NDW-configuratiebestand met meetlocaties en bevat geen actuele intensiteiten. Kies snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz.');
    }
    if(naam.includes('snelheden_en_intensiteiten_meetgegevens')&&!naam.includes('meetgegevens_en_configuratie')&&!naam.includes('configuratie_meetlocaties')){
      throw new Error('Dit bestand bevat alleen NDW-meetwaarden zonder de meetlocatieconfiguratie. Kies snelheden_en_intensiteiten_meetgegevens_en_configuratie_meetlocaties.xml.gz.');
    }
    const raw=await ndwFileText(file);
    setProgress(45,'NDW DATEX II XML lezen en meetlocaties koppelen…');
    const snapshot=ndwXmlSnapshot(raw.text,file.name,raw.hash);
    if(typeof ndw69ValidateData==='function')ndw69ValidateData(snapshot);
    return snapshot;
  }

  async function snapshotFromFile(file){
    if(/\.(?:xml|gz)$/i.test(file.name))return snapshotFromRawNdw(file);
    const chunkSize=1024*1024;let offset=0,carry='',found=false,depth=0,inString=false,escaped=false,done=false,parts=[];
    function startIndex(text){
      const markers=['"ndw69Snapshot"','const NDW69_DATA'];let best=-1;
      markers.forEach(marker=>{const p=text.indexOf(marker);if(p>=0&&(best<0||p<best))best=p;});
      return best;
    }
    function feed(text){
      let last=0;
      for(let i=0;i<text.length;i++){
        const ch=text[i];
        if(inString){
          if(escaped){escaped=false;continue;}
          if(ch==='\\'){escaped=true;continue;}
          if(ch==='"')inString=false;
          continue;
        }
        if(ch==='"'){inString=true;continue;}
        if(ch==='{')depth++;
        else if(ch==='}'){
          depth--;
          if(depth===0){parts.push(text.slice(last,i+1));done=true;return;}
        }
      }
      parts.push(text.slice(last));
    }

    while(offset<file.size&&!done){
      const end=Math.min(file.size,offset+chunkSize),text=await file.slice(offset,end).text();offset=end;
      if(!found){
        const joined=carry+text,p=startIndex(joined);
        if(p>=0){
          const objectStart=joined.indexOf('{',p);
          if(objectStart>=0){found=true;feed(joined.slice(objectStart));}
          else carry=joined.slice(Math.max(0,p));
        }else carry=joined.slice(-512);
      }else feed(text);
      const pct=Math.min(65,5+Math.round((offset/Math.max(1,file.size))*55));
      setProgress(pct,'NDW bronbestand lezen: '+Math.round(offset/1024/1024)+' van '+Math.round(file.size/1024/1024)+' MB');
      await pause();
    }
    if(!found||!done)throw new Error('In dit bestand is geen complete NDW-meetdataset gevonden. Kies een BiDash/DVM-export waarin NDW-verkeersdata zit.');
    setProgress(68,'NDW-meetdataset in achtergrond controleren…');
    const snapshot=await parseJsonWorker(parts.join(''));
    if(!snapshot||!Array.isArray(snapshot.sites)||!snapshot.sites.length)throw new Error('De gevonden NDW-meetdataset bevat geen meetlocaties.');
    return snapshot;
  }

  async function applySnapshot(snapshot,bronNaam){
    if(typeof ndw69ValidateData==='function')ndw69ValidateData(snapshot);
    const c=kostenBasis();c.ndw69Snapshot=snapshot;c.scenario67={...(c.scenario67||{})};
    if(!hasValue(c.scenario67.uren))c.scenario67.uren=6;
    if(!hasValue(c.scenario67.reductie))c.scenario67.reductie=30;
    if(!String(c.scenario67.bron||'').trim())c.scenario67.bron=DEFAULT_BRON;
    c.scenario67.status='scenario';RULES.kosten=c;

    const rows=kostenDagRows();
    setProgress(70,snapshot.sites.length.toLocaleString('nl-NL')+' NDW-meetlocaties gevonden. '+rows.length.toLocaleString('nl-NL')+' wegdelen koppelen…');
    const perRoad={...(c.scenarioWegen67||{})},choices={...(c.ndw69||{})};let matched=0,unmatched=0;
    for(let i=0;i<rows.length;i++){
      const w=rows[i],link=ndw69Link(w),local={...(perRoad[w.key]||{})};
      if(!hasValue(local.uren))local.uren=6;
      if(!hasValue(local.reductie))local.reductie=30;
      if(!String(local.bron||'').trim())local.bron=DEFAULT_BRON;
      local.status='scenario';
      if(link?.s&&link.s.q!==null&&link.s.q!==undefined&&Number.isFinite(Number(link.s.q))){
        local.q='';local.ndwAuto=true;
        choices[w.key]={...(choices[w.key]||{}),siteId:link.s.id,disabled:false,confirmed:false,confirmationKey:''};matched++;
      }else unmatched++;
      perRoad[w.key]=local;
      if(i%8===0||i===rows.length-1){
        const pct=70+Math.round(((i+1)/Math.max(1,rows.length))*28);
        setProgress(pct,'Wegdelen koppelen: '+(i+1)+' van '+rows.length+'. '+matched+' met NDW-meting.');await pause();
      }
    }
    c.scenarioWegen67=perRoad;c.ndw69=choices;RULES.kosten=c;
    if(typeof SC67_CACHE!=='undefined')SC67_CACHE={fingerprint:'',routes:{},busy:false,error:''};
    globalThis.__BIDASH_LAST_NDW_LOAD__={tijd:new Date().toISOString(),bron:bronNaam||'lokaal',sites:snapshot.sites.length,wegdelen:rows.length,gekoppeld:matched,nietGekoppeld:unmatched,hinderuren:6,snelheidsreductie:30};
    setProgress(100,'Gereed. '+matched+' van '+rows.length+' wegdelen hebben een NDW-intensiteit. Het voertuigaantal komt uit NDW. Hinderuren en snelheidsreductie blijven scenario-invoer; standaard worden alleen ontbrekende waarden op 6 uur en 30% gezet.',matched===0);
    if(typeof kostenDagVervers==='function')kostenDagVervers();
    try{if(parent!==globalThis)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'ndw'},location.origin);}catch(error){}
  }

  globalThis.bidashLaadNdw=async function(){
    buttonBusy(true);
    try{
      setProgress(2,'NDW-verkeersdata zoeken in de huidige en lokaal opgeslagen werkruimte…');
      let snapshot=(typeof ndw69Data==='function'&&ndw69Data()?.sites?.length)?ndw69Data():null;
      if(!snapshot){try{snapshot=snapshotFromWorkspace(await readStoredWorkspace());}catch(error){console.warn(error);}}
      if(snapshot&&Array.isArray(snapshot.sites)&&snapshot.sites.length){await applySnapshot(snapshot,'lokale werkruimte');return;}
      setProgress(100,'Geen NDW-verkeerssnapshot gevonden in de huidige of lokaal opgeslagen werkruimte. Gebruik "Kies export met NDW" en selecteer een eerdere Business Intelligence Dashboard WVM/DVM JSON- of HTML-export met NDW-verkeersdata.',true);
    }catch(error){console.error(error);setProgress(100,error.message||String(error),true);alert(error.message||String(error));}
    finally{buttonBusy(false);}
  };

  globalThis.bidashKiesNdwBestand=function(){
    const input=document.getElementById('bidashNdwSourceFile');
    if(!input){setProgress(100,'Bestandskiezer voor NDW is niet beschikbaar. Herlaad de pagina.',true);return;}
    input.value='';
    input.click();
  };

  globalThis.bidashLaadNdwFile=async function(file){
    if(!file)throw new Error('Geen NDW-bronbestand gekozen.');
    buttonBusy(true);
    try{
      setProgress(5,'NDW-data uit '+file.name+' halen…');
      const snapshot=await snapshotFromFile(file);
      await applySnapshot(snapshot,file.name);
      return globalThis.__BIDASH_LAST_NDW_LOAD__||null;
    }catch(error){
      console.error(error);setProgress(100,error.message||String(error),true);throw error;
    }finally{buttonBusy(false);}
  };

  globalThis.bidashNdwBestand=async function(input){
    const file=input?.files?.[0];if(!file)return;
    try{await globalThis.bidashLaadNdwFile(file);}
    catch(error){alert(error.message||String(error));}
    finally{if(input)input.value='';}
  };

  globalThis.__BIDASH_NDW_LOADER_ACTIVE__=true;
})();`;

export function installNdwLoader(scope=globalThis){
  if(!scope||!scope.document||typeof scope.eval!=='function')return false;
  if(scope.__BIDASH_NDW_LOADER_ACTIVE__)return true;
  try{scope.eval(PATCH_SOURCE);return !!scope.__BIDASH_NDW_LOADER_ACTIVE__;}
  catch(error){console.error('BiDash NDW-laadknop kon niet worden gestart.',error);return false;}
}
