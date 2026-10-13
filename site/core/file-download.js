/* Een export blijft rechtstreeks aanklikbaar zolang de pagina open is.
   Het programma kan een download aanvragen, maar niet bewijzen dat de browser
   het bestand heeft opgeslagen. Alleen een volgende export of pagehide wist
   deze lokale kopie en trekt haar object-URL in. */
export function createFileDownload(link,scope=globalThis){
  if(!link)throw Error('De downloadlink ontbreekt.');
  let objectUrl=null;
  function clear(){
    if(objectUrl){scope.URL.revokeObjectURL(objectUrl);objectUrl=null;}
    link.removeAttribute('href');link.removeAttribute('download');
    link.hidden=true;link.textContent='';
  }
  function prepare({text,name,type='application/xml'}){
    const blob=new scope.Blob([text],{type});
    const nextUrl=scope.URL.createObjectURL(blob);
    clear();objectUrl=nextUrl;
    link.href=objectUrl;link.download=name;
    link.textContent='Download XML, '+name;link.hidden=false;
  }
  function attempt(){
    if(!objectUrl)return false;
    try{link.click();return true;}catch{return false;}
  }
  scope.addEventListener?.('pagehide',clear);
  return {prepare,attempt,clear};
}
