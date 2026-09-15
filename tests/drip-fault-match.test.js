import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenVariants,matchDripIncident} from '../site/core/drip-fault-match.js';

test('DRIP code wordt ook uit assetnaam tussen haakjes gehaald',()=>{
  const t=tokenVariants('NWN DRI BD A9L 42,200 (dBD143)');
  assert.equal(t.has('DBD143'),true);
  assert.equal(tokenVariants('NWN DRI DRIP A8L 4,395 DRIP 080').has('D80'),true);
});

test('dubbele DRIP-code wordt met VC, weg, richting en hm naar juiste asset gekoppeld',()=>{
  const incident={asset:'dBD143',code:'DBD143',vc:'NWN',weg:'A9',richting:'LI',hm:42.2};
  const assets=[
    {key:'NWN-143',tp:'DRIP',naam:'NWN DRI BD A9L 42,200 (dBD143)',vc:'NWN',weg:'A9',richting:'LI',hm:42.2,specialRia4:true},
    {key:'ZWN-143',tp:'DRIP',naam:'ZWN DRI D+ A15L 48,690 (dBD143)',vc:'ZWN',weg:'A15',richting:'LI',hm:48.69},
    {key:'NON-143',tp:'DRIP',naam:'NON DRI BD A50R 166,850 (dBD143)',vc:'NON',weg:'A50',richting:'RE',hm:166.85}
  ];
  const m=matchDripIncident(incident,assets,[]);
  assert.equal(m.assetKey,'NWN-143');
  assert.equal(m.asset.naam.includes('A9L 42,200'),true);
});

test('open DRIP incident met code in assetnaam krijgt assetKey zonder vooraf bestaande matchAssetKey',()=>{
  const incident={asset:'D80a',code:'D80A',vc:'NWN',weg:'A8',richting:'LI',hm:4.395};
  const assets=[{key:'A8-D80A',tp:'DRIP',naam:'NWN DRI DRIP A8L 4,395 (D80a)',vc:'NWN',weg:'A8',richting:'LI',hm:4.395,specialWind:true}];
  const m=matchDripIncident(incident,assets,[]);
  assert.equal(m.assetKey,'A8-D80A');
});
