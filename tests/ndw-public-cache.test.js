import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

test('openbare NDW-kopie valideert gzip, XML, tijd, hash en veilige terugval zonder netwerk',()=>{
  execFileSync('python3',[new URL('./ndw_fetch_cases.py',import.meta.url).pathname,'-q'],{stdio:'pipe'});
});
test('NDW wordt uitsluitend in Pages-artifact bijgewerkt, geen gebruikersupload of Git-write',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(workflow,/cron: '2-57\/5 \* \* \* \*'/);
  assert.match(workflow,/fetch-ndw\.py --output site\/ndw/);
  assert.match(workflow,/contents: read/);assert.doesNotMatch(workflow,/contents: write|git push/);
  assert.match(readFileSync(new URL('../.gitignore',import.meta.url),'utf8'),/site\/ndw\//);
  const frame=readFileSync(new URL('../site/engines/dvm.html',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(frame,/connect-src 'self';/);assert.match(shell,/connect-src 'none';/);
});
