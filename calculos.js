/* Cálculos locales. Los tokens son presupuestos, no mediciones. */
(function(root){
'use strict';
const presets={
 best:{complete:{input:18750,output:1830,calls:12,tools:8},abandon:{input:12600,output:1275,calls:8,tools:6}},
 average:{complete:{input:65375,output:5115,calls:34,tools:20},abandon:{input:45225,output:3562.5,calls:24,tools:14}},
 worst:{complete:{input:112000,output:8400,calls:56,tools:32},abandon:{input:77850,output:5850,calls:39,tools:22}}
};
function profile(name){if(!presets[name])throw new Error('Escenario desconocido.');return JSON.parse(JSON.stringify(presets[name]));}
function initial(models=[]){return {daily:20,days:30,mode:'percent',conversion:45,scenario:'average',profiles:profile('average'),includeOverhead:true,models:JSON.parse(JSON.stringify(models))};}
const palette=['#2563eb','#7c3aed','#ea580c','#059669','#db2777','#0891b2','#9a3412','#4d7c0f'];
function parseCatalog(data){
 if(!data||data.schemaVersion!==1)throw new Error('El JSON debe declarar schemaVersion: 1.');
 if(data.currency!=='USD'||data.pricingBasis!=='per_million_tokens')throw new Error('El catálogo debe usar USD y pricingBasis: "per_million_tokens".');
 if(!Array.isArray(data.models)||!data.models.length)throw new Error('El JSON debe incluir al menos un elemento en models.');
 const seen=new Set();
 const models=data.models.map((m,i)=>{
  if(!m||typeof m!=='object'||Array.isArray(m))throw new Error(`Modelo ${i+1}: formato inválido.`);
  if(typeof m.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(m.id))throw new Error(`Modelo ${i+1}: id debe empezar con una letra minúscula y usar letras, números o guiones.`);
  if(seen.has(m.id))throw new Error(`ID duplicado: ${m.id}.`);seen.add(m.id);
  for(const k of ['name','apiId'])if(typeof m[k]!=='string'||!m[k].trim()||m[k].length>160)throw new Error(`${m.id}: falta ${k} o supera 160 caracteres.`);
  nonnegative(m.input,`${m.id}: precio input`);nonnegative(m.output,`${m.id}: precio output`);
  const toolSystemTokens=m.toolSystemTokens??0;
  nonnegative(toolSystemTokens,`${m.id}: toolSystemTokens`);
  if(!Number.isInteger(toolSystemTokens))throw new Error(`${m.id}: toolSystemTokens debe ser entero.`);
  if(m.visible!==undefined&&typeof m.visible!=='boolean')throw new Error(`${m.id}: visible debe ser true o false.`);
  const color=m.color??palette[i%palette.length];
  if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))throw new Error(`${m.id}: color debe ser hexadecimal como #2563eb.`);
  const dash=m.dash??'';
  if(typeof dash!=='string'||(dash!==''&&!/^\d+(?:\.\d+)?(?:[ ,]+\d+(?:\.\d+)?)*$/.test(dash)))throw new Error(`${m.id}: dash debe contener números separados por espacios.`);
  const lineWidth=m.lineWidth??3;
  if(!Number.isFinite(lineWidth)||lineWidth<1||lineWidth>8)throw new Error(`${m.id}: lineWidth debe estar entre 1 y 8.`);
  return {id:m.id,name:m.name.trim(),apiId:m.apiId.trim(),company:typeof m.company==='string'?m.company:'',input:m.input,output:m.output,toolSystemTokens,color,dash,lineWidth,visible:m.visible??true};
 });
 return {models,updatedAt:typeof data.updatedAt==='string'?data.updatedAt:'No indicada'};
}
function nonnegative(v,name){if(!Number.isFinite(v)||v<0)throw new Error(name+': introduce un número válido mayor o igual a cero.');}
function rate(s){return s.mode==='percent'?s.conversion/100:(s.daily?s.conversion/s.daily:0);}
function validate(s){
 nonnegative(s.daily,'Conversaciones diarias');nonnegative(s.days,'Días');nonnegative(s.conversion,'Conversión');
 if(s.days<1||!Number.isInteger(s.days))throw new Error('El período debe tener al menos un día y ser entero.');
 if(s.daily>1e9||s.days>100000)throw new Error('Reduce el volumen o el período para mantener una escala legible.');
 if(!['percent','count'].includes(s.mode))throw new Error('Modo de conversión inválido.');
 if(s.mode==='percent'&&s.conversion>100)throw new Error('La conversión debe estar entre 0% y 100%.');
 if(s.mode==='count'&&s.conversion>s.daily)throw new Error('Las compras diarias no pueden superar las conversaciones diarias.');
 for(const [name,p]of Object.entries(s.profiles)){
  ['input','output','calls','tools'].forEach(k=>nonnegative(p[k],name+' / '+k));
  if(!Number.isInteger(p.calls)||!Number.isInteger(p.tools)||p.tools>p.calls)throw new Error('Las llamadas deben ser enteras y las solicitudes con herramientas no pueden superar las llamadas LLM.');
 }
 if(!s.models.length)throw new Error('Carga un catálogo de modelos para calcular.');
 s.models.forEach(m=>{nonnegative(m.input,'Precio entrada de '+m.name);nonnegative(m.output,'Precio salida de '+m.name);nonnegative(m.toolSystemTokens,'Tokens de herramientas de '+m.name);if(!Number.isInteger(m.toolSystemTokens))throw new Error('Los tokens adicionales por solicitud deben ser enteros.');});
}
function unit(p,m,s){const additional=s.includeOverhead?m.toolSystemTokens*p.tools:0;const inputCost=(p.input+additional)*m.input/1e6;const outputCost=p.output*m.output/1e6;return {inputTokens:p.input+additional,outputTokens:p.output,inputCost,outputCost,total:inputCost+outputCost};}
function estimate(s,daily=s.daily){
 const conversion=rate(s),conversations=daily*s.days,purchases=conversations*conversion,abandoned=conversations-purchases;
 const models=s.models.map(m=>{const a=unit(s.profiles.complete,m,s),b=unit(s.profiles.abandon,m,s);const complete=a.total*purchases,abandon=b.total*abandoned,total=complete+abandon;
 if(!Number.isFinite(total))throw new Error('El cálculo supera el rango numérico. Reduce los valores.');
 return {...m,completeUnit:a,abandonUnit:b,completeCost:complete,abandonCost:abandon,total,perConversation:conversations?total/conversations:null,perPurchase:purchases?total/purchases:null};});
 return {conversations,purchases,abandoned,conversion,models};
}
function niceMaximum(value){if(value<=0)return 1;const scale=10**Math.floor(Math.log10(value));const factor=value/scale;return (factor<=1?1:factor<=2?2:factor<=5?5:10)*scale;}
// Escala compartida entre escenarios: cambiar de perfil no cambia la referencia visual.
function chartScale(s,limit){
 const states=[s,...['best','average','worst'].map(name=>({...s,profiles:profile(name)}))];
 const peaks=states.flatMap(value=>estimate(value,limit).models.filter(m=>m.visible).map(m=>m.total));
 return niceMaximum(Math.max(0,...peaks)*1.12);
}
// La transformación log1p conserva el cero y separa mejor costos de distinto orden.
function chartAxis(s,limit,mode='auto'){
 const states=[s,...['best','average','worst'].map(name=>({...s,profiles:profile(name)}))];
 const peaks=s.models.filter(m=>m.visible).map(m=>Math.max(...states.map(value=>estimate(value,limit).models.find(v=>v.id===m.id).total))).filter(v=>v>0);
 const maximum=chartScale(s,limit),smallest=Math.min(...peaks),largest=Math.max(0,...peaks);
 const logarithmic=mode==='log'||(mode==='auto'&&peaks.length>1&&largest/smallest>=8);
 const threshold=peaks.length?smallest/10:1;
 const span=Math.log1p(maximum/threshold);
 return {maximum,logarithmic,position:value=>logarithmic?Math.log1p(value/threshold)/span:value/maximum,value:fraction=>logarithmic?threshold*Math.expm1(fraction*span):fraction*maximum};
}
const api={chartAxis,initial,parseCatalog,profile,rate,validate,unit,estimate,niceMaximum,chartScale};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AICostComparison=api;
})(globalThis);
