export const TEXT_OPERATORS=[
  ['contains','bevat'],['notContains','bevat niet'],['equals','is gelijk aan'],['notEquals','is niet gelijk aan'],
  ['startsWith','begint met'],['endsWith','eindigt met'],['empty','is leeg'],['notEmpty','is niet leeg']
];
export const NUMBER_OPERATORS=[
  ['equals','is gelijk aan'],['notEquals','is niet gelijk aan'],['greater','is groter dan'],['greaterEqual','is minimaal'],
  ['less','is kleiner dan'],['lessEqual','is maximaal'],['empty','is leeg'],['notEmpty','is niet leeg']
];

const clean=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const empty=value=>Array.isArray(value)?value.length===0:value==null||String(value).trim()==='';

export function operatorsFor(type='text'){return type==='number'?NUMBER_OPERATORS:TEXT_OPERATORS;}

export function matchesRule(item,rule,fields){
  const field=fields.find(entry=>entry.key===rule.field);if(!field)return true;
  const value=typeof field.value==='function'?field.value(item):item?.[field.key],operator=rule.operator||'contains';
  if(operator==='empty')return empty(value);
  if(operator==='notEmpty')return !empty(value);
  if(field.type==='number'){
    const actual=Number(value),expected=Number(rule.value);if(!Number.isFinite(actual)||!Number.isFinite(expected))return false;
    if(operator==='equals')return actual===expected;if(operator==='notEquals')return actual!==expected;
    if(operator==='greater')return actual>expected;if(operator==='greaterEqual')return actual>=expected;
    if(operator==='less')return actual<expected;if(operator==='lessEqual')return actual<=expected;
    return true;
  }
  const values=(Array.isArray(value)?value:[value]).map(clean),expected=clean(rule.value);
  if(operator==='contains')return values.some(actual=>actual.includes(expected));if(operator==='notContains')return values.every(actual=>!actual.includes(expected));
  if(operator==='equals')return values.some(actual=>actual===expected);if(operator==='notEquals')return values.every(actual=>actual!==expected);
  if(operator==='startsWith')return values.some(actual=>actual.startsWith(expected));if(operator==='endsWith')return values.some(actual=>actual.endsWith(expected));
  return true;
}

export function applyQuery(items,query,fields){
  const rules=(query?.rules||[]).filter(rule=>rule.field&&(['empty','notEmpty'].includes(rule.operator)||String(rule.value??'').trim()!==''));
  if(!rules.length)return items.slice();
  if(rules.some((rule,index)=>index>0&&rule.join)){
    const groups=[];let current=[];
    for(const [index,rule] of rules.entries()){
      if(index>0&&rule.join==='or'){groups.push(current);current=[];}current.push(rule);
    }
    if(current.length)groups.push(current);
    return items.filter(item=>groups.some(group=>group.every(rule=>matchesRule(item,rule,fields))));
  }
  const method=query?.mode==='any'?'some':'every';
  return items.filter(item=>rules[method](rule=>matchesRule(item,rule,fields)));
}
