(function(){
'use strict';
const C=globalThis.AICostComparison,$=id=>document.getElementById(id);
let catalogModels=[],state=C.initial(),range=50,lastRate=.45,lastResult=null,loadVersion=0;
const NS='http://www.w3.org/2000/svg';
const format=(n,d=2)=>n===null?'—':new Intl.NumberFormat('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const usd=(n,d=2)=>n===null?'—':new Intl.NumberFormat('es-PE',{style:'currency',currency:'USD',minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const num=n=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(n);
function el(tag,text,attrs={}){const e=document.createElement(tag);if(text!==null)e.textContent=text;for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
function cell(tr,text,attrs={}){const e=el('td',text,attrs);tr.append(e);return e;}
function field(label,value,callback,min=0,step='any'){
 const l=el('label',label),input=el('input',null,{type:'number',min,step});input.value=value;input.addEventListener('input',()=>{callback(input.valueAsNumber);update();});l.append(input);return l;
}
function renderCards(){
 $('cards').replaceChildren();
 state.models.forEach(m=>{
  const article=el('article',null,{class:'card'});article.style.borderTop='3px solid '+m.color;
  const top=el('div',null,{class:'row'});top.append(el('span',m.name,{class:'card-name'}));
  const label=el('label',null,{class:'toggle no-print'}),toggle=el('input',null,{type:'checkbox','aria-label':'Mostrar '+m.name+' en el gráfico'});toggle.checked=m.visible;toggle.addEventListener('change',()=>{m.visible=toggle.checked;update();});label.append(toggle,el('span','Ver'));top.append(label);
  article.append(top,el('div','—',{id:'cost-'+m.id,class:'card-cost','data-output':''}),el('p','IA para el período',{class:'tiny muted'}),el('p','—',{id:'detail-'+m.id,class:'tiny muted','data-output':''}));$('cards').append(article);
 });
}
function renderPrices(){
 $('prices').replaceChildren();
 state.models.forEach(m=>{const tr=el('tr',null);const name=cell(tr,null);name.append(el('strong',m.name),el('div',m.apiId,{class:'tiny muted'}));for(const [key,label]of [['input','entrada'],['output','salida'],['toolSystemTokens','tokens adicionales por solicitud tools']]){
  const input=el('input',null,{type:'number',min:0,step:'any','aria-label':'Precio '+label+' de '+m.name});input.value=m[key];input.addEventListener('input',()=>{m[key]=input.valueAsNumber;update();});cell(tr,null).append(input);
 }$('prices').append(tr);});
}
function renderProfiles(){
 $('profiles').replaceChildren();
 for(const [key,title]of [['complete','Con compra'],['abandon','Sin compra']]){
  const p=state.profiles[key],box=el('div',null,{class:'token-profile'});box.append(el('h3',title,{class:'font-semibold mb-3'}));const grid=el('div',null,{class:'token-fields'});
  for(const [prop,label]of [['input','Input acumulado'],['output','Output facturable'],['calls','Llamadas LLM'],['tools','Solicitudes con tools']])grid.append(field(label,p[prop],v=>p[prop]=v,0,['calls','tools'].includes(prop)?'1':'any'));
  box.append(grid);$('profiles').append(box);
 }
}
function svgEl(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
function renderChart(result){
 const svg=$('chart');svg.replaceChildren(svgEl('title',{id:'svgTitle'},'Costo de IA frente a conversaciones diarias'),svgEl('desc',{id:'svgDesc'},'El eje horizontal indica conversaciones por día y el vertical el costo en dólares para '+state.days+' días. Se mantiene la tasa actual de conversión. La tabla muestra los valores del volumen seleccionado.'));
 const visible=state.models.filter(m=>m.visible),W=940,H=385,left=74,right=25,top=22,bottom=68,pw=W-left-right,ph=H-top-bottom;
 $('chartLegend').replaceChildren();
 if(!visible.length){svg.append(svgEl('text',{x:W/2,y:H/2,'text-anchor':'middle',fill:'#52657b','font-size':16},'Activa al menos un modelo en las tarjetas.'));return;}
 const limit=Math.max(range,state.daily,1),endpoint=C.estimate(state,limit);const axis=C.chartAxis(state,limit,$('chartScale').value);
 $('chartScaleNote').textContent=axis.logarithmic?'Escala logarítmica suavizada: expande los costos bajos y conserva el cero. Las distancias verticales no representan incrementos iguales en USD.':'Escala lineal: las distancias verticales representan incrementos iguales en USD.';
 $('svgDesc').textContent+=' '+$('chartScaleNote').textContent;
 const x=n=>left+n/limit*pw,y=n=>top+ph-axis.position(n)*ph;
 for(let i=0;i<=5;i++){
  const yt=top+ph-i/5*ph,value=axis.value(i/5);
  svg.append(svgEl('line',{x1:left,x2:W-right,y1:yt,y2:yt,stroke:'#e4eaf2','stroke-width':1}));
  svg.append(svgEl('text',{x:left-10,y:yt+4,'text-anchor':'end',fill:'#52657b','font-size':12},usd(value,value>0&&value<.01?4:2)));
  const xv=limit*i/5,xt=x(xv);
  svg.append(svgEl('text',{x:xt,y:H-bottom+25,'text-anchor':'middle',fill:'#52657b','font-size':12},num(xv)));
 }
 svg.append(svgEl('text',{x:left+pw/2,y:H-12,'text-anchor':'middle',fill:'#52657b','font-size':13},'Conversaciones diarias (tasa de conversión constante)'));
 svg.append(svgEl('text',{x:18,y:top+ph/2,transform:`rotate(-90 18 ${top+ph/2})`,'text-anchor':'middle',fill:'#52657b','font-size':13},'Costo por período · USD'));
 for(const m of visible){
  const end=endpoint.models.find(v=>v.id===m.id),current=result.models.find(v=>v.id===m.id);
  svg.append(svgEl('path',{d:Array.from({length:161},(_,i)=>`${i?'L':'M'} ${x(limit*i/160)} ${y(end.total*i/160)}`).join(' '),fill:'none',stroke:m.color,'stroke-width':m.lineWidth,'stroke-dasharray':m.dash, 'stroke-linecap':'round'}));
  svg.append(svgEl('circle',{cx:x(state.daily),cy:y(current.total),r:5.5,fill:m.color,stroke:'#fff','stroke-width':2}));
  const legend=el('span',null),key=el('i',null,{class:'line-key'});key.style.borderTopColor=m.color;if(m.dash)key.style.borderTopStyle='dashed';legend.append(key,el('span',m.name));$('chartLegend').append(legend);
 }
 svg.append(svgEl('line',{x1:x(state.daily),x2:x(state.daily),y1:top,y2:H-bottom,stroke:'#8193a9','stroke-dasharray':'4 5'}));
 const markerLabel=svgEl('text',{x:Math.max(left+35,Math.min(W-right-35,x(state.daily))),y:top+12,'text-anchor':'middle',fill:'#52657b','font-size':12},num(state.daily)+' / día');svg.append(markerLabel);
 const cross=svgEl('line',{y1:top,y2:H-bottom,stroke:'#516e91','stroke-dasharray':'3 4',visibility:'hidden'});svg.append(cross);
 const hit=svgEl('rect',{x:left,y:top,width:pw,height:ph,fill:'transparent'});svg.append(hit);
 hit.addEventListener('pointermove',event=>{
  const bounds=svg.getBoundingClientRect();const sx=(event.clientX-bounds.left)/bounds.width*W;
  const daily=Math.max(0,Math.min(limit,Math.round((sx-left)/pw*limit))),r=C.estimate(state,daily);
  cross.setAttribute('x1',x(daily));cross.setAttribute('x2',x(daily));cross.setAttribute('visibility','visible');
  const tooltip=$('tooltip');tooltip.replaceChildren(el('strong',num(daily)+' conversaciones/día'),el('div',num(r.purchases)+' compras / '+state.days+' días'));
  r.models.filter(m=>m.visible).forEach(m=>tooltip.append(el('div',m.name+': '+usd(m.total,4))));tooltip.hidden=false;
  const wrap=tooltip.parentElement.getBoundingClientRect();tooltip.style.left=Math.max(0,Math.min(wrap.width-tooltip.offsetWidth,event.clientX-wrap.left+12))+'px';tooltip.style.top=Math.max(0,event.clientY-wrap.top-tooltip.offsetHeight-10)+'px';
 });
 hit.addEventListener('pointerleave',()=>{cross.setAttribute('visibility','hidden');$('tooltip').hidden=true;});
}
function update(){
 try{
  C.validate(state);if(!Number.isFinite(range)||range<1||range>2e9)throw new Error('El rango del gráfico debe estar entre 1 y 2,000,000,000 conversaciones diarias.');
  const r=C.estimate(state);lastResult=r;lastRate=r.conversion;$('error').hidden=true;$('downloadCsv').disabled=false;
  $('rateNote').textContent=`Conversión: ${num(r.conversion*100)}% · ${num(state.daily*r.conversion)} compras y ${num(state.daily*(1-r.conversion))} abandonos por día.`;
  $('chartSubtitle').textContent=`Proyección para ${num(state.days)} días con ${num(r.conversion*100)}% de conversión. Referencia vertical común para los tres escenarios. Pasa el cursor para explorar volúmenes.`;
  $('totalConversations').textContent=num(r.conversations);$('totalPurchases').textContent=num(r.purchases);$('totalAbandoned').textContent=num(r.abandoned);
  $('results').replaceChildren();
  r.models.forEach(m=>{
   $('cost-'+m.id).textContent=usd(m.total);$('detail-'+m.id).textContent=usd(m.completeCost)+' compras + '+usd(m.abandonCost)+' sin compra';
   const tr=el('tr',null);[m.name,usd(m.completeCost),usd(m.abandonCost),usd(m.total),usd(m.perConversation,6),usd(m.perPurchase,6)].forEach((text,i)=>cell(tr,text,{class:i===3?'font-bold text-slate-900':''}));$('results').append(tr);
  });
  renderChart(r);
 }catch(error){lastResult=null;$('error').textContent=error.message;$('error').hidden=false;$('downloadCsv').disabled=true;document.querySelectorAll('[data-output]').forEach(e=>e.textContent='—');$('results').replaceChildren();$('tooltip').hidden=true;$('chartLegend').replaceChildren();const svg=$('chart');svg.replaceChildren(svgEl('text',{x:470,y:190,'text-anchor':'middle',fill:'#9e251c','font-size':16},'Corrige los parámetros para calcular.'));}
}
$('daily').addEventListener('input',()=>{state.daily=$('daily').valueAsNumber;if(Number.isFinite(state.daily)&&state.daily>range){range=state.daily*2;$('chartRange').value=range;}update();});
$('conversion').addEventListener('input',()=>{state.conversion=$('conversion').valueAsNumber;update();});
$('conversionMode').addEventListener('change',()=>{
 state.mode=$('conversionMode').value;state.conversion=state.mode==='percent'?lastRate*100:state.daily*lastRate;
 $('conversion').value=Number.isFinite(state.conversion)?Number(state.conversion.toFixed(8)):0;
 $('conversionLabel').textContent=state.mode==='percent'?'Conversión (%)':'Compras por día';
 if(state.mode==='percent')$('conversion').max='100';else $('conversion').removeAttribute('max');update();
});
$('days').addEventListener('input',()=>{state.days=$('days').valueAsNumber;update();});
$('scenario').addEventListener('change',()=>{state.scenario=$('scenario').value;state.profiles=C.profile(state.scenario);renderProfiles();update();});
$('chartScale').addEventListener('change',()=>update());
$('chartRange').addEventListener('input',()=>{range=$('chartRange').valueAsNumber;update();});
$('includeOverhead').addEventListener('change',()=>{state.includeOverhead=$('includeOverhead').checked;update();});
$('reset').addEventListener('click',()=>{
 state=C.initial(catalogModels);range=50;lastRate=.45;
 for(const [id,value]of Object.entries({daily:20,days:30,conversion:45,conversionMode:'percent',scenario:'average',chartRange:50,chartScale:'auto'}))$(id).value=value;
 $('conversionLabel').textContent='Conversión (%)';$('conversion').max='100';$('includeOverhead').checked=true;
 renderCards();renderPrices();renderProfiles();update();
});
$('print').addEventListener('click',()=>window.print());
const csvCell=v=>{let text=String(v??'');if(/^[=+\-@\t\r]/.test(text.trimStart()))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
$('downloadCsv').addEventListener('click',()=>{
 if(!lastResult)return;
 const r=lastResult,rows=[['Comparativa de costos IA — USD'],['Fecha',new Date().toISOString()],['Tokens estimados; no medidos'],['Escenario',state.scenario],['Conversaciones diarias',state.daily],['Modo conversión',state.mode],['Valor conversión',state.conversion],['Tasa efectiva',r.conversion],['Días',state.days],['Conversaciones período',r.conversations],['Compras período',r.purchases],['Sin compra período',r.abandoned],['Provisión por modelo habilitada',state.includeOverhead],[],['Perfil','Input base acumulado','Output facturable acumulado','Llamadas','Solicitudes con tools']];
 for(const [name,p]of Object.entries(state.profiles))rows.push([name,p.input,p.output,p.calls,p.tools]);
 rows.push([],['Modelo','API ID','Precio input / 1M','Precio output / 1M','Tokens adicionales por solicitud tools','IA con compra','IA sin compra','Total IA período','IA por conversación','IA asignado por compra']);
 r.models.forEach(m=>rows.push([m.name,m.apiId,m.input,m.output,m.toolSystemTokens,m.completeCost,m.abandonCost,m.total,m.perConversation,m.perPurchase]));
 rows.push([],['Sensibilidad: tasa y días constantes'],['Conversaciones diarias','Conversaciones período','Compras período',...state.models.map(m=>m.name+' USD')]);
 const limit=Math.max(range,state.daily,1);
 for(let i=0;i<=20;i++){const daily=limit*i/20,x=C.estimate(state,daily);rows.push([daily,x.conversations,x.purchases,...x.models.map(m=>m.total)]);}
 const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a',null,{href:url,download:'comparativa-ia.csv'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
function applyCatalog(data,label){
 const parsed=C.parseCatalog(data);
 catalogModels=JSON.parse(JSON.stringify(parsed.models));
 state.models=JSON.parse(JSON.stringify(parsed.models));
 $('catalogStatus').textContent=`${parsed.models.length} modelos cargados · ${label} · Tarifas: ${parsed.updatedAt}.`;
 renderCards();renderPrices();update();
}
async function fetchCatalog(){
 const version=++loadVersion;
 $('catalogStatus').textContent='Cargando models.json…';
 try{
  const response=await fetch(new URL('/models.json',location.origin),{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(version!==loadVersion)return;
  applyCatalog(data,'models.json');
 }catch(error){
  if(version!==loadVersion)return;
  $('catalogStatus').textContent='No se cargó el catálogo: '+error.message+'. Puedes seleccionar un archivo con Cargar JSON.';
  if(!state.models.length)update();
 }
}
$('importCatalog').addEventListener('click',()=>$('catalogFile').click());
$('reloadCatalog').addEventListener('click',()=>{if(location.protocol==='file:')$('catalogFile').click();else fetchCatalog();});
$('catalogFile').addEventListener('change',async()=>{
 const file=$('catalogFile').files[0];if(!file)return;
 const version=++loadVersion;
 try{
  const data=JSON.parse(await file.text());
  if(version===loadVersion)applyCatalog(data,file.name);
 }catch(error){if(version===loadVersion)$('catalogStatus').textContent='JSON no cargado: '+error.message+'. Se conserva el catálogo anterior.';}
 finally{$('catalogFile').value='';}
});
renderCards();renderPrices();renderProfiles();update();
if(location.protocol==='file:')$('catalogStatus').textContent='Selecciona models.json con Cargar JSON, o inicia npm start para cargarlo automáticamente.';
else fetchCatalog();
})();
