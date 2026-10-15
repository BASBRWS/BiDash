/* Opslagindeling, los van het werkruimte- en exportmodel. */
export const WORKSPACE_PART_BYTES=4*1024*1024;
const plain=v=>v&&typeof v==='object'&&(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
export function storageSize(value,limit=WORKSPACE_PART_BYTES){
  const seen=new WeakSet();let size=0;
  function visit(v){
    if(size>limit)return;
    if(typeof v==='string'){size+=64+v.length*2;return;}
    if(v===null||typeof v!=='object'){size+=32;return;}
    if(seen.has(v)){size+=32;return;}seen.add(v);size+=128;
    if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer){size+=v.byteLength;return;}
    if(v instanceof Blob){size+=256;return;}
    if(v instanceof Map){for(const [k,x] of v){visit(k);visit(x);if(size>limit)break;}return;}
    if(v instanceof Set){for(const x of v){visit(x);if(size>limit)break;}return;}
    for(const k of Object.keys(v)){size+=64+k.length*2;visit(v[k]);if(size>limit)break;}
  }
  visit(value);return size;
}
export function* workspaceParts(value,{budget=WORKSPACE_PART_BYTES}={}){
  if(!Number.isSafeInteger(budget)||budget<1024)throw Error('Ongeldige blokgrootte.');
  const inlineLimit=Math.floor(budget/4),ids=new WeakMap();let nextId=0;
  function* describe(v){
    if(v&&typeof v==='object'&&ids.has(v))return {ref:ids.get(v)};
    if(storageSize(v,inlineLimit)<=inlineLimit)return {value:v};
    const id=nextId++;
    if(typeof v==='string'){
      const length=Math.max(1,Math.floor((inlineLimit-256)/2));
      for(let start=0;start<v.length;start+=length)yield {kind:'string',id,length:v.length,text:v.slice(start,start+length),end:start+length>=v.length};
      return {ref:id};
    }
    if(!plain(v))throw Error('Dit grote object kan niet veilig over opslagblokken worden verdeeld.');
    ids.set(v,id);
    const header={kind:Array.isArray(v)?'array':'object',id,...(Array.isArray(v)?{length:v.length}:{nullPrototype:Object.getPrototypeOf(v)===null})};
    yield {...header,entries:[]};
    let entries=[],size=1024;
    for(const key of Object.keys(v)){
      const k=yield* describe(key),child=yield* describe(v[key]);
      const cost=384+storageSize(k,inlineLimit+512)+storageSize(child,inlineLimit+512);
      if(entries.length&&size+cost>budget){yield {...header,entries};entries=[];size=1024;}
      entries.push([k,child]);size+=cost;
    }
    if(entries.length)yield {...header,entries};
    return {ref:id};
  }
  return yield* describe(value);
}
export function workspaceDecoder(){
  const nodes=new Map(),strings=new Map();
  const resolve=d=>{
    if(d&&Object.hasOwn(d,'value'))return d.value;
    if(d&&Number.isSafeInteger(d.ref)&&nodes.has(d.ref))return nodes.get(d.ref);
    throw Error('Opgeslagen werkruimte is onvolledig, een verwijzing ontbreekt.');
  };
  return {
    add(part){
      if(!part||!Number.isSafeInteger(part.id)||part.id<0)throw Error('Ongeldig opslagblok.');
      if(part.kind==='string'){
        const list=strings.get(part.id)||[];if(typeof part.text!=='string')throw Error('Ongeldig tekstblok.');list.push(part.text);strings.set(part.id,list);
        if(part.end){const text=list.join('');if(text.length!==part.length)throw Error('Opgeslagen werkruimte is onvolledig, tekst is afgebroken.');nodes.set(part.id,text);strings.delete(part.id);}return;
      }
      if(!['array','object'].includes(part.kind)||!Array.isArray(part.entries))throw Error('Ongeldig gegevensblok.');
      if(!nodes.has(part.id))nodes.set(part.id,part.kind==='array'?new Array(part.length):part.nullPrototype?Object.create(null):{});
      const target=nodes.get(part.id);
      for(const [k,v] of part.entries){const key=resolve(k);if(typeof key!=='string')throw Error('Ongeldige veldnaam.');Object.defineProperty(target,key,{value:resolve(v),enumerable:true,writable:true,configurable:true});}
    },
    finish(root){if(strings.size)throw Error('Opgeslagen werkruimte is onvolledig, tekstblokken ontbreken.');return resolve(root);}
  };
}
