import {h,go} from '../core/dom.js';
import {dayWhen,STATUS} from '../core/format.js';

export const whenCell=d=>h('span',{class:'nowrap'},dayWhen(d));
export const pill=(s,label)=>{const key=String(s).toLowerCase(),[txt,cls]=STATUS[key]||[String(s).replaceAll('_',' '),/approved|ready|closed|issued|verified|accepted/.test(key)?'good':/rejected|failed|revoked|late/.test(key)?'alert':/pending|open|generating/.test(key)?'wait':'neutral'];return h('span',{class:'pill '+cls},label||txt)};
export const card=(...c)=>h('div',{class:'card'},...c),half=(...c)=>h('div',{class:'card half'},...c);
export const heading=(eyebrow,title,...right)=>h('div',{class:'card-heading'},h('div',{},eyebrow&&h('span',{class:'page-eyebrow'},eyebrow),h('h3',{},title)),right.length?h('div',{class:'pill-row'},...right):null);
export const empty=(title,text,...actions)=>h('div',{class:'empty-state'},h('span',{class:'empty-mark'},'✦'),h('strong',{},title),text&&h('span',{},text),actions.length?h('div',{},...actions):null);
export const btn=(t,f,c='')=>h('button',{type:'button',class:c,onclick:async e=>{const el=e.currentTarget;if(el.disabled)return;el.disabled=true;el.replaceChildren(h('span',{class:'button-spinner'}),'Working…');try{await go(f)}finally{if(el.isConnected){el.disabled=false;el.textContent=t}}}},t);
export const tbl=(r,cols,emptyText='Nothing to show yet')=>r.length?h('div',{class:'table-wrap',role:'region',tabindex:'0','aria-label':'Scrollable data table'},h('table',{},h('thead',{},h('tr',{},cols.map(c=>h('th',{},c[0])))),h('tbody',{},r.map(x=>h('tr',{},cols.map(c=>h('td',{},typeof c[1]=='function'?c[1](x):x[c[1]]??'—'))))))):h('div',{class:'empty-state'},h('span',{class:'empty-mark'},'✦'),h('span',{},emptyText));
export const statGrid=items=>h('div',{class:'stat-grid'},items.map(([label,value,sub])=>h('div',{class:'stat'},h('small',{},label),h('strong',{},value),sub&&h('span',{},sub))));
export const clean=d=>{Object.keys(d).forEach(k=>d[k]===''&&delete d[k]);return d};
export const picker=(o,attrs={})=>h('select',attrs,o.map(x=>h('option',{value:x[0]},x[1])));
export const multiFilter=(options,attrs={})=>{
 let opts=[...options];
 if(!opts.some(o=>o[0]===''||o[0]==='all'))opts.unshift(['','All']);
 const selected=new Set(['']);
 const container=h('div',{class:'multi-filter-group',role:'group','aria-label':attrs['aria-label']||'Filter options',style:'display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;'});
 const updateClasses=()=>{
  container.querySelectorAll('.multi-filter-chip').forEach(btn=>{
   const val=btn.dataset.val;
   const isSel=selected.has(val);
   btn.className=`multi-filter-chip s ${isSel?'primary active':''}`;
   btn.setAttribute('aria-pressed',isSel?'true':'false');
  });
 };
 const getValues=()=>Array.from(selected).filter(v=>v!==''&&v!=='all');
 const notify=()=>{
  updateClasses();
  if(typeof container.onchange==='function')container.onchange({target:container,currentTarget:container});
  container.dispatchEvent(new Event('change',{bubbles:true}));
 };
 opts.forEach(([val,label])=>{
  const isAll=(val===''||val==='all');
  const chip=h('button',{
   type:'button',
   class:`multi-filter-chip s ${isAll?'primary active':''}`,
   'data-val':String(val),
   'aria-pressed':isAll?'true':'false',
   onclick:()=>{
    if(isAll){
     selected.clear();
     selected.add(val);
    }else{
     selected.delete('');
     selected.delete('all');
     if(selected.has(String(val))){
      selected.delete(String(val));
      if(selected.size===0){
       const allVal=opts.find(o=>o[0]===''||o[0]==='all')?.[0]??'';
       selected.add(allVal);
      }
     }else{
      selected.add(String(val));
     }
    }
    notify();
   }
  },label);
  container.append(chip);
 });
 Object.defineProperty(container,'values',{get:getValues});
 Object.defineProperty(container,'value',{
  get:()=>getValues().join(','),
  set:newVal=>{
   selected.clear();
   if(!newVal||newVal==='all'){
    const allVal=opts.find(o=>o[0]===''||o[0]==='all')?.[0]??'';
    selected.add(allVal);
   }else{
    String(newVal).split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>selected.add(p));
    if(selected.size===0)selected.add('');
   }
   updateClasses();
  }
 });
 return container;
};

