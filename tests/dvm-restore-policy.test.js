import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dvmRestoreProfile,shouldDeferDvmRestore} from '../site/core/dvm-restore-policy.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

function source(n){return {rijen:Array.from({length:n},(_,i)=>({id:i}))};}

test('grote opgeslagen DVM-werkruimte wordt niet automatisch volledig herbouwd',()=>{
  const dvm={assetregister:source(50852),storingshistorie:[source(57970)],liveStoringen:[source(130)]};
  const profile=dvmRestoreProfile(dvm);
  assert.equal(profile.assetRows,50852);
  assert.equal(profile.historyRows,57970);
  assert.equal(profile.liveRows,130);
  assert.equal(shouldDeferDvmRestore(dvm),true);
});

test('kleine DVM-werkruimte mag nog automatisch herstellen',()=>{
  const dvm={assetregister:source(1000),storingshistorie:[source(250)],liveStoringen:[source(25)]};
  assert.equal(shouldDeferDvmRestore(dvm),false);
});

test('adapter herkent opstart en bronbeheer en omzeilt dan de totaalimport',()=>{
  const adapter=read('site/engines/dvm-adapter.js');
  assert.match(adapter,/Werkruimte starten/);
  assert.match(adapter,/#sources/);
  assert.match(adapter,/shouldDeferDvmRestore\(bundle\)/);
  assert.match(adapter,/DVM_RESTORE_DEFERRED/);
});

test('bron-specifieke upload meldt wijziging terug aan de centrale werkruimte',()=>{
  const sourceManager=read('site/engines/dvm-source-manager.js');
  assert.match(sourceManager,/hub:changed/);
  assert.match(sourceManager,/sourceSpecific:true/);
  assert.match(sourceManager,/DVM_VERSION='97'/);
  // De schilversie staat sinds de versiebalk in site/core/versie.js, niet hier.
  assert.match(read('site/core/versie.js'),/BIDASH_VERSIE='2\.14'/);
  assert.doesNotMatch(sourceManager,/BIDASH_VERSION=/);
});
