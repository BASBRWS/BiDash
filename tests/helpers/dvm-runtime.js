import {readFileSync} from 'node:fs';
import vm from 'node:vm';
export function dvmRuntime(){
const element=()=>({value:'',style:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(){},appendChild(){},querySelectorAll(){return []},querySelector(){return null},getContext(){return {}},options:[],dataset:{},innerHTML:''});
const doc={addEventListener(){},getElementById:()=>element(),querySelectorAll:()=>[],querySelector:()=>null,createElement:element,body:element(),documentElement:element()};
const c={document:doc,console,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},requestAnimationFrame(){},localStorage:{getItem(){return null},setItem(){}},sessionStorage:{getItem(){return null},setItem(){}},location:{origin:'http://localhost'},navigator:{},performance,URL,Blob,File,TextDecoder,structuredClone,addEventListener(){}};c.window=c;c.globalThis=c;c.parent=c;vm.createContext(c);
vm.runInContext(readFileSync(new URL('../../site/core/incident-lifecycle.js',import.meta.url),'utf8'),c);
vm.runInContext(readFileSync(new URL('../../site/engines/dvm-memo-besluit.js',import.meta.url),'utf8'),c);
for(const p of ['dvm-1.js','dvm-2.js','dvm-3.js'])vm.runInContext(readFileSync(new URL('../../site/engines/'+p,import.meta.url),'utf8'),c,{filename:p});
vm.runInContext(readFileSync(new URL('../../site/engines/dvm-mtm-bss.js',import.meta.url),'utf8'),c,{filename:'dvm-mtm-bss.js'});
return c;
}
