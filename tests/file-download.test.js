import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileDownload} from '../site/core/file-download.js';

function setup(){
  const revoked=[],blobs=[],events={};let clicked=0;
  const link={hidden:true,textContent:'',removeAttribute(name){delete this[name];},click(){clicked++;}};
  const scope={Blob,URL:{createObjectURL(blob){blobs.push(blob);return 'blob:test-'+blobs.length;},revokeObjectURL(url){revoked.push(url);}},addEventListener(name,handler){events[name]=handler;}};
  return {link,revoked,blobs,events,clicked:()=>clicked,api:createFileDownload(link,scope)};
}

test('de aanklikbare download bewaart UTF-8 XML, bestandsnaam en type',async()=>{
  const s=setup();s.api.prepare({text:'<Name>€ &amp; één</Name>',name:'planning.xml',type:'application/xml'});
  assert.equal(await s.blobs[0].text(),'<Name>€ &amp; één</Name>');assert.equal(s.blobs[0].type,'application/xml');
  assert.equal(s.link.download,'planning.xml');assert.equal(s.link.hidden,false);assert.match(s.link.textContent,/planning.xml/);
  s.api.attempt();s.api.attempt();assert.equal(s.clicked(),2);assert.deepEqual(s.revoked,[]);
});
test('een geweigerde automatische klik houdt de rechtstreekse download beschikbaar',()=>{
  const s=setup();s.api.prepare({text:'<Project/>',name:'planning.xml'});
  s.link.click=()=>{throw Error('Download geweigerd');};assert.equal(s.api.attempt(),false);
  assert.equal(s.link.href,'blob:test-1');assert.equal(s.link.hidden,false);assert.deepEqual(s.revoked,[]);
});
test('de volgende voorbereiding vervangt de oude lokale download',()=>{
  const s=setup();s.api.prepare({text:'oud',name:'oud.xml'});s.api.prepare({text:'nieuw',name:'nieuw.xml'});
  assert.deepEqual(s.revoked,['blob:test-1']);assert.equal(s.link.href,'blob:test-2');assert.equal(s.link.download,'nieuw.xml');
});
test('wissen en de pagina verlaten trekken de URL in en verbergen de link',()=>{
  const s=setup();assert.equal(s.api.attempt(),false);s.api.prepare({text:'xml',name:'planning.xml'});s.events.pagehide();
  assert.deepEqual(s.revoked,['blob:test-1']);assert.equal(s.link.hidden,true);assert.equal(s.link.href,undefined);assert.equal(s.api.attempt(),false);
  s.api.clear();assert.deepEqual(s.revoked,['blob:test-1']);
});
