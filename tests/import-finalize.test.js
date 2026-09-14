import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installDvmImportFastCapture} from '../site/core/dvm-import-fast-capture.js';

test('eerste export na DVM-import hergebruikt de reeds geïmporteerde bundel', async()=>{
  let rawExports=0;
  const scope={
    HUB:{
      async import(bundle){return {ok:true,n:bundle.assetregister.rijen.length};},
      export(){rawExports++;return {fresh:true};}
    }
  };
  assert.equal(installDvmImportFastCapture(scope),true);
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{rijen:[{id:1}]}};
  await scope.HUB.import(bundle);
  assert.equal(scope.HUB.export(),bundle);
  assert.deepEqual(scope.HUB.export(),{fresh:true});
  assert.equal(rawExports,1);
});

test('voortgang gebruikt geen hardgecodeerd 92 procent eindplateau',()=>{
  const source=fs.readFileSync(new URL('../site/core/load-progress.js',import.meta.url),'utf8');
  assert.equal(source.includes('pct:92'),false);
  assert.match(source,/DVM-import is klaar/);
});
