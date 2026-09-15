import test from 'node:test';
import assert from 'node:assert/strict';
import {OPERATIONAL_STATUS,faultCausesOperationalLoss,operationalStatusForAsset,operationalStatusForFault} from '../site/core/asset-operational-status.js';

test('MSI fout 1003 maakt asset niet operationeel door storing',()=>{
  const asset={key:'MSI-1',tp:'MSI',status:'Operationeel'};
  const fault={assetKey:'MSI-1',typeId:'MSI',code:'1003'};
  assert.equal(faultCausesOperationalLoss(asset,fault),true);
  assert.equal(operationalStatusForAsset(asset,[fault]),OPERATIONAL_STATUS.FAULT_OUTAGE);
  assert.equal(operationalStatusForFault(asset,fault),OPERATIONAL_STATUS.FAULT_OUTAGE);
});

test('andere MSI fout houdt operationele bronstatus in stand',()=>{
  const asset={key:'MSI-1',tp:'MSI',status:'Operationeel'};
  assert.equal(operationalStatusForAsset(asset,[{assetKey:'MSI-1',typeId:'MSI',code:'1004'}]),OPERATIONAL_STATUS.OPERATIONAL);
});

test('statisch niet-operationeel heeft voorrang op storing',()=>{
  const asset={key:'MSI-1',tp:'MSI',status:'Niet operationeel'};
  assert.equal(operationalStatusForAsset(asset,[{assetKey:'MSI-1',typeId:'MSI',code:'1003'}]),OPERATIONAL_STATUS.NOT_OPERATIONAL);
});

test('open storing op speciale RIA4 of wind DRIP krijgt storingsstatus',()=>{
  const ria={key:'DRIP-RIA',tp:'DRIP',status:'Operationeel',specialRia4:true};
  const wind={key:'DRIP-WIND',tp:'DRIP',status:'Operationeel',specialWind:true};
  assert.equal(operationalStatusForAsset(ria,[{assetKey:'DRIP-RIA',typeId:'DRIP',code:'DBD143'}]),OPERATIONAL_STATUS.FAULT_OUTAGE);
  assert.equal(operationalStatusForAsset(wind,[{assetKey:'DRIP-WIND',typeId:'DRIP',code:'D80A'}]),OPERATIONAL_STATUS.FAULT_OUTAGE);
});
