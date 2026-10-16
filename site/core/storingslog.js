/* Vroege, lokale diagnose voor schil, engines en losse importer. Geen broninhoud
   of invoervelden verzamelen. Logging mag de applicatie nooit onderbreken. */
(function(scope){
  'use strict';
  if(scope.BIDASH_DIAGNOSTICS)return;
  const KEY='bidash-storingslog-v1',MAX=600,BUDGET=500000;
  const source=scope.location.pathname.split('/').pop()||'index.html';
  let parentLog;
  try{if(scope.parent!==scope&&scope.parent.location.origin===scope.location.origin)parentLog=scope.parent.BIDASH_DIAGNOSTICS;}catch{}
  let entries=[],bytes=2,dropped=0,timer,persistence='beschikbaar',context=()=>({});
  const session=scope.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
  function clean(value){
    return String(value??'').slice(0,2400)
      .replace(/https?:\/\/[^\s<>"')]+/gi,url=>{try{const u=new URL(url);return u.origin+u.pathname;}catch{return '[URL]';}})
      .replace(/\b(?:Bearer\s+)[\w.\-]+/gi,'Bearer [afgeschermd]')
      .replace(/((?:token|password|authorization|api[_-]?key|secret)\s*[=:]\s*)[^\s,;]+/gi,'$1[afgeschermd]')
      .replace(/(?:[A-Z]:\\|\/Users\/|\/home\/)[^\s"<>]+/gi,'[lokaal pad]');
  }
  function detail(value,depth=0){
    try{
      if(value==null||typeof value==='boolean'||typeof value==='number')return value;
      if(typeof value==='string')return clean(value);
      if(depth>4)return '[begrensd]';
      if(value instanceof scope.Error||Object.prototype.toString.call(value).endsWith('Error]'))return {name:clean(value.name),message:clean(value.message),stack:clean(value.stack),cause:value.cause?detail(value.cause,depth+1):undefined};
      if(Array.isArray(value))return {type:'array',length:value.length};
      // Alleen technische velden uit expliciete record-aanroepen.
      const out={};for(const key of Object.keys(value).slice(0,16))out[clean(key)]=detail(value[key],depth+1);return out;
    }catch{return '[niet leesbaar]';}
  }
  function save(){
    timer=null;
    try{scope.sessionStorage.setItem(KEY,JSON.stringify({entries,dropped}));}catch{persistence='niet beschikbaar, alleen in geheugen';}
  }
  function record(level,event,data,module=source){
    try{
      if(parentLog){parentLog.record(level,event,data,module);return;}
      const entry={time:new Date().toISOString(),session,module:clean(module),level,event:clean(event),data:detail(data)};
      const previous=entries[entries.length-1];
      if(previous&&previous.session===session&&previous.module===entry.module&&previous.level===level&&previous.event===entry.event&&JSON.stringify(previous.data)===JSON.stringify(entry.data)){
        bytes-=JSON.stringify(previous).length;previous.count=(previous.count||1)+1;previous.lastTime=entry.time;bytes+=JSON.stringify(previous).length;
      }else{
        entries.push(entry);bytes+=JSON.stringify(entry).length+1;
      }
      while(entries.length>MAX||bytes>BUDGET){bytes-=JSON.stringify(entries.shift()).length+1;dropped++;}
      if(!timer)timer=scope.setTimeout(save,1500);
    }catch{}
  }
  if(!parentLog){try{const old=JSON.parse(scope.sessionStorage.getItem(KEY)||'null');if(Array.isArray(old?.entries)){
    entries=old.entries.slice(-MAX);dropped=Number(old.dropped)||0;bytes=JSON.stringify(entries).length;
    while(bytes>BUDGET&&entries.length){bytes-=JSON.stringify(entries.shift()).length+1;dropped++;}
  }}catch{persistence='niet beschikbaar, alleen in geheugen';}}
  function report(){
    if(parentLog)return parentLog.report();
    let app={};try{app=detail(context());}catch{}
    const memory=scope.performance?.memory;
    return {formaat:'bidash-storingslog',versie:1,exported:new Date().toISOString(),session,
      environment:{page:source,browser:clean(scope.navigator.userAgent),language:scope.navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,online:scope.navigator.onLine,viewport:{width:scope.innerWidth,height:scope.innerHeight},memory:memory?{used:memory.usedJSHeapSize,limit:memory.jsHeapSizeLimit}:null},
      context:app,retention:{maxEntries:MAX,maxCharacters:BUDGET,dropped,persistence},entries:entries.map(e=>({...e}))};
  }
  function download(){
    record('info','log.export');save();
    const url=scope.URL.createObjectURL(new scope.Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));
    const a=scope.document.createElement('a');a.href=url;a.download='bidash-storingslog_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';scope.document.body.append(a);a.click();a.remove();scope.setTimeout(()=>scope.URL.revokeObjectURL(url),30000);
  }
  scope.BIDASH_DIAGNOSTICS={record,report,download,setContext(fn){context=fn;},flush:save,clear(){entries=[];bytes=2;dropped=0;record('info','log.cleared');save();}};
  for(const level of ['warn','error']){
    const original=scope.console[level];
    scope.console[level]=function(...args){
      // Console-objecten kunnen volledige operationele datasets bevatten.
      try{const values={};
      args.slice(0,6).forEach((v,i)=>{values[i]=typeof v==='string'?clean(v):v instanceof scope.Error?detail(v):v==null?v:typeof v==='object'?{type:Array.isArray(v)?'array':'object'}:clean(v);});
      record(level,'console.'+level,{arguments:values});}catch{}
      return original.apply(this,args);
    };
  }
  scope.addEventListener('error',event=>{
    const target=event.target;
    if(target&&target!==scope)record('error','resource.error',{tag:target.tagName,url:clean(target.src||target.href||'')});
    else record('error','javascript.error',{message:event.message,file:clean(event.filename),line:event.lineno,column:event.colno,error:event.error});
  },true);
  scope.addEventListener('unhandledrejection',event=>record('error','promise.unhandled',{reason:event.reason instanceof scope.Error?event.reason:clean(event.reason)}));
  scope.addEventListener('securitypolicyviolation',event=>record('error','security.csp',{directive:event.violatedDirective,blocked:clean(event.blockedURI)}));
  scope.addEventListener('online',()=>record('info','network.online'));
  scope.addEventListener('offline',()=>record('warn','network.offline'));
  scope.addEventListener('pagehide',()=>{record('info','page.hide');if(!parentLog)save();});
  scope.document.addEventListener('click',event=>{
    const button=event.target.closest?.('button,[data-route]');if(!button)return;
    const action=button.dataset.route||button.id;
    if(action)record('info','ui.action',{action});
    if(button.hasAttribute('data-download-diagnostics'))download();
    if(button.hasAttribute('data-clear-diagnostics'))scope.BIDASH_DIAGNOSTICS.clear();
  },true);
  scope.document.addEventListener('change',event=>{
    const input=event.target;
    if(input.type!=='file'||!input.files)return;
    record('info','files.selected',{input:input.id,count:input.files.length,totalBytes:(()=>{let n=0;for(const f of input.files)n+=f.size;return n;})(),first:input.files[0]?.name});
  },true);
  scope.document.addEventListener('DOMContentLoaded',()=>{
    record('info','page.ready');
    const status=scope.document.getElementById('status');let last='',lastAt=0;
    if(status&&scope.MutationObserver)new scope.MutationObserver(()=>{
      const text=status.textContent||'',error=status.classList.contains('error'),now=Date.now();
      if(text===last||(!error&&now-lastAt<3000))return;last=text;lastAt=now;
      record(error?'error':'info','status',{message:text});
    }).observe(status,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  },{once:true});
  let lastProgress='',lastProgressAt=0;
  scope.addEventListener('message',event=>{
    if(event.origin!==scope.location.origin||!Array.from(scope.document.querySelectorAll('iframe')).some(f=>f.contentWindow===event.source))return;
    const p=event.data;if(p?.type!=='hub:import-progress')return;
    const stage=String(p.fase||''),key=String(p.engine)+stage,now=Date.now();
    if(!p.error&&p.active!==false&&key===lastProgress&&now-lastProgressAt<10000)return;
    // Veranderende regeltellingen mogen het log niet vullen.
    if(!p.error&&p.active!==false&&now-lastProgressAt<1000)return;
    lastProgress=key;lastProgressAt=now;
    record(p.error?'error':'info','import.progress',{engine:p.engine,file:p.bestand,stage,percent:p.pct,active:p.active});
  });
  try{if(scope.PerformanceObserver){const observer=new scope.PerformanceObserver(list=>{
    for(const item of list.getEntries())if(item.duration>=500)record('warn','performance.longtask',{durationMs:Math.round(item.duration)});
  });observer.observe({type:'longtask',buffered:true});}}catch{}
  try{if(scope.PerformanceObserver){const observer=new scope.PerformanceObserver(list=>{
    for(const item of list.getEntries())if(item.responseStatus>=400)record('error','network.http',{url:clean(item.name),status:item.responseStatus,durationMs:Math.round(item.duration)});
  });observer.observe({type:'resource',buffered:true});}}catch{}
  let tick=Date.now(),wasVisible=scope.document.visibilityState==='visible';
  scope.document.addEventListener('visibilitychange',()=>{tick=Date.now();wasVisible=scope.document.visibilityState==='visible';});
  const heartbeat=scope.setInterval(()=>{const now=Date.now(),visible=scope.document.visibilityState==='visible';if(wasVisible&&visible&&now-tick>5000)record('warn','performance.delay',{durationMs:now-tick-3000});tick=now;wasVisible=visible;},3000);
  heartbeat?.unref?.();
  record('info','session.start',{page:source});
})(window);
