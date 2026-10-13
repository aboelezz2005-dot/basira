'use strict';
const AVG=300;
const fmt=n=>n.toLocaleString('en-US');
const all=[];DATA.G.forEach(([code,name,list])=>list.forEach(([c,n,inc,p,core])=>all.push({c,n,inc,p,core,ent:code,entName:name})));
DATA.SETUP.forEach(([c,n,inc,p])=>all.push({c,n,inc,p,core:false,ent:'ST',entName:'باقات التأسيس'}));
const byCode=Object.fromEntries(all.map(s=>[s.c,s]));
const ents=[...DATA.G.map(g=>[g[0],g[1]]),['ST','باقات التأسيس']];
document.getElementById('fEnt').textContent=DATA.G.length;
document.getElementById('fSvc2').textContent=all.filter(s=>s.ent!=='ST').length;
let ent='all';const cart=new Map();
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,1800)}
// chips
const chips=document.getElementById('chips');
[['all','كل الجهات'],...ents].forEach(([k,n])=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=n;b.dataset.k=k;b.setAttribute('aria-pressed',k==='all');b.onclick=()=>{ent=k;chips.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x.dataset.k===k));render()};chips.appendChild(b)});
function weight(s){return s.p<=400?1:(s.p<=750?2:3)}
function covered(s,p){return s.ent!=='ST'&&(p.scope==='all'||s.core)}
function units(s){return s.core?weight(s):0}
function render(){
  const q=document.getElementById('q').value.trim();const co=document.getElementById('coreOnly').checked;
  const cat=document.getElementById('catalog');cat.innerHTML='';let shown=0;
  ents.forEach(([k,n])=>{
    if(ent!=='all'&&ent!==k)return;
    const items=all.filter(s=>s.ent===k&&(!co||s.core)&&(!q||(s.n+' '+s.inc+' '+s.c+' '+s.entName).includes(q)));
    if(!items.length)return;shown+=items.length;
    const box=document.createElement('div');box.className='ent';
    box.innerHTML=`<h3><span class="code">${k}</span>${n}</h3>`;
    const list=document.createElement('div');list.className='list';
    items.forEach(s=>{const r=document.createElement('div');r.className='svc';
      r.innerHTML=`<span class="code">${s.c}</span><div class="t"><b>${s.n}${s.core?'<span class="tag">ضمن الباقات</span>':''}</b><small>${s.inc}</small></div><span class="price num">${fmt(s.p)} <small>ر.ق</small></span>`;
      const b=document.createElement('button');b.type='button';b.className='add';b.dataset.c=s.c;b.setAttribute('aria-pressed',cart.has(s.c));b.textContent=cart.has(s.c)?'مضافة ✓':'أضف';b.setAttribute('aria-label',(cart.has(s.c)?'إزالة ':'إضافة ')+s.n);
      b.onclick=()=>{if(cart.has(s.c))cart.delete(s.c);else cart.set(s.c,1);render();renderCart();toast(cart.has(s.c)?'أضيفت إلى الحاسبة':'أزيلت من الحاسبة')};
      r.appendChild(b);list.appendChild(r)});
    box.appendChild(list);cat.appendChild(box)});
  if(!shown)cat.innerHTML='<div class="empty">لا توجد خدمة بهذا الاسم. جرّب كلمة أخرى، أو اطلب الخدمة من نموذج الطلب وسنسعّرها لك.</div>';
}
document.getElementById('q').addEventListener('input',render);
document.getElementById('coreOnly').addEventListener('change',render);
// plans
let yearly=false;
function renderPlans(){
  const el=document.getElementById('plans');el.innerHTML='';const tb=document.getElementById('ptbody');tb.innerHTML='';
  DATA.PLANS.forEach(p=>{const v=p.n*AVG,ym=Math.round(p.y/12),md=Math.round(100*(1-p.m/v)),yd=Math.round(100*(1-ym/v));
    const d=document.createElement('div');d.className='plan'+(p.key==='full'?' feat':'')+(p.key==='elite'?' elite':'')+(p.key==='gold'?' gold':'');
    d.innerHTML=`${p.key==='gold'?'<span class="badge">الأكثر شمولاً</span>':''}<h3>${p.key==='gold'?'الباقة الذهبية':`باقة «${p.name}»`}</h3><span class="who">${p.staff}</span>
    <div class="amt num">${fmt(yearly?p.y:p.m)} <small>ر.ق / ${yearly?'سنوياً':'شهرياً'}</small></div>
    <div class="save">${yearly?`تعادل ${fmt(ym)} ر.ق شهرياً، بخصم ${yd}% عن السعر المنفرد`:`${p.n} ${p.n<=10?'خدمات':'خدمة'} قيمتها ${fmt(v)} ر.ق، بخصم ${md}%`}</div>
    <ul>${p.feat.map(f=>`<li>${f}</li>`).join('')}</ul>
    <a class="btn ${p.key!=='basic'?'pri':'ghost'}" href="#request" data-plan="${p.name}">اشترك في «${p.name}»</a>`;
    d.querySelector('a').onclick=()=>{document.getElementById('fPlan').value=p.name;document.getElementById('fType').value='منشأة';syncPlan()};
    el.appendChild(d);
    tb.insertAdjacentHTML('beforeend',`<tr><td><b>«${p.name}»</b></td><td class="num">${p.n}</td><td class="num">${fmt(v)}</td><td class="num"><b>${fmt(p.m)}</b></td><td class="num">${md}%</td><td class="num"><b>${fmt(p.y)}</b></td><td class="num">${yd}%</td><td class="num">${p.extra}%</td></tr>`)});
  document.getElementById('bm').setAttribute('aria-pressed',!yearly);document.getElementById('by').setAttribute('aria-pressed',yearly);
}
document.getElementById('bm').onclick=()=>{yearly=false;renderPlans()};
document.getElementById('by').onclick=()=>{yearly=true;renderPlans()};
// estimator
const SAMPLE={'MI-05':3,'MC-03':1,'MI-02':1,'ML-02':2};
function renderCart(){
  const c=document.getElementById('cart');c.innerHTML='';let single=0,u=0,out=0;
  if(!cart.size)c.innerHTML='<div class="empty">لم تختر خدمات بعد. اضغط «أضف» بجانب أي خدمة في القائمة.</div>';
  document.getElementById('cartCount').textContent=cart.size?`(${cart.size})`:'';
  cart.forEach((q,code)=>{const s=byCode[code];single+=s.p*q;if(s.core)u+=units(s)*q;else out+=s.p*q;
    const r=document.createElement('div');r.className='ci';
    r.innerHTML=`<span>${s.n} <span class="code">${s.c}</span><small class="ent-n">${s.entName}${s.ent==='ST'?' · لمرة واحدة':''}</small></span><span class="num lt">${fmt(s.p*q)}</span>`;
    const i=document.createElement('input');i.type='number';i.min=1;i.max=200;i.value=q;i.id='q-'+code;i.setAttribute('aria-label','عدد مرات '+s.n);
    i.oninput=()=>{const v=Math.max(1,Math.min(200,parseInt(i.value)||1));cart.set(code,v);r.querySelector('.lt').textContent=fmt(s.p*v);updateTotals()};
    const x=document.createElement('button');x.className='x';x.type='button';x.textContent='×';x.setAttribute('aria-label','إزالة '+s.n);x.onclick=()=>{cart.delete(code);renderCart();render()};
    r.append(i,x);c.appendChild(r)});
  updateTotals();
}
function updateTotals(){
  // Setup packages (ST) are one-time fees, so they stay out of the monthly comparison
  let single=0,u=0,out=0,once=0;cart.forEach((q,code)=>{const s=byCode[code];if(s.ent==='ST'){once+=s.p*q;return}single+=s.p*q;if(s.core)u+=units(s)*q;else out+=s.p*q});
  document.getElementById('tSingle').textContent=fmt(single)+' ر.ق';document.getElementById('tUnits').textContent=u;document.getElementById('tOut').textContent=fmt(out)+' ر.ق';
  const v=document.getElementById('verdict');
  if(!cart.size){v.textContent='أضف خدمات لنقارن لك بين الدفع لكل خدمة والباقات.';return}
  const onceNote=once?`<br><b>رسوم تأسيس لمرة واحدة: ${fmt(once)} ر.ق</b> (لا تتكرر شهرياً)`:'';
  if(!single){v.innerHTML=onceNote.slice(4);return}
  const opts=[{name:'الدفع لكل خدمة',cost:single}];
  DATA.PLANS.forEach(p=>{let pu=0,pv=0,po=0;cart.forEach((q,code)=>{const s=byCode[code];if(s.ent==='ST')return;if(covered(s,p)){pu+=weight(s)*q;pv+=s.p*q}else po+=s.p*q});
    const extraUnits=Math.max(0,pu-p.n);const avg=pu?pv/pu:AVG;
    const cost=p.m+Math.round(extraUnits*avg*(1-p.extra/100))+Math.round(po*(1-p.extra/100));opts.push({name:`باقة «${p.name}»`,cost,p})});
  opts.sort((a,b)=>a.cost-b.cost);const best=opts[0];
  v.innerHTML=opts.map(o=>`${o===best?'<b>':''}${o.name}: ${fmt(o.cost)} ر.ق شهرياً${o===best?' (الأوفر)</b>':''}`).join('<br>')+(best.p?`<br>توفر ${fmt(single-best.cost)} ر.ق شهرياً مقارنة بالدفع لكل خدمة.`:'')+onceNote;
}
document.getElementById('clear').onclick=()=>{cart.clear();renderCart();render()};
document.getElementById('sample').onclick=()=>{cart.clear();Object.entries(SAMPLE).forEach(([k,q])=>cart.set(k,q));renderCart();render()};
const cartText=()=>[...cart].map(([c,q])=>`${byCode[c].n} (${c}) × ${q}`).join('\n');
document.getElementById('toReq').onclick=()=>{document.getElementById('fSvc').value=cartText()};
// full service pickers (calculator + request form), grouped by authority
function fillPicker(sel){ents.forEach(([k,n])=>{const g=document.createElement('optgroup');g.label=n;all.filter(s=>s.ent===k).forEach(s=>{const o=document.createElement('option');o.value=s.c;o.textContent=`${s.n} · ${fmt(s.p)} ر.ق`;g.appendChild(o)});sel.appendChild(g)})}
function pickAdd(code){cart.set(code,(cart.get(code)||0)+1);render();renderCart();toast('أضيفت: '+byCode[code].n)}
const pick=document.getElementById('pick'),fPick=document.getElementById('fPick');fillPicker(pick);fillPicker(fPick);
pick.onchange=()=>{if(pick.value)pickAdd(pick.value);pick.value=''};
fPick.onchange=()=>{if(fPick.value){pickAdd(fPick.value);document.getElementById('fSvc').value=cartText()}fPick.value=''};
// form: company packages apply to establishments only
const fType=document.getElementById('fType'),fPlan=document.getElementById('fPlan');
function syncPlan(){const ind=fType.value==='فرد';if(ind)fPlan.value='';fPlan.disabled=ind}
fType.addEventListener('change',syncPlan);fPlan.addEventListener('change',()=>{if(fPlan.value)fType.value='منشأة'});syncPlan();
document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();
  const n=document.getElementById('fName').value.trim(),ph=document.getElementById('fPhone').value.replace(/\s/g,''),sv=document.getElementById('fSvc').value.trim();
  let ok=true;
  document.getElementById('eName').textContent=n?'':'اكتب الاسم أو اسم المنشأة.';if(!n)ok=false;
  const phOk=/^(\+?974)?[3-7]\d{7}$/.test(ph);document.getElementById('ePhone').textContent=phOk?'':'اكتب رقم جوال قطري من 8 أرقام يبدأ بـ 3 أو 5 أو 6 أو 7.';if(!phOk)ok=false;
  document.getElementById('eSvc').textContent=sv?'':'اكتب الخدمة المطلوبة أو أضفها من الحاسبة.';if(!sv)ok=false;
  if(!ok)return;
  const plan=document.getElementById('fPlan').value;
  const msg=`السلام عليكم، أرغب في طلب خدمة من بصيرة للمعاملات.\nالاسم: ${n}\nالجوال: ${ph}\nنوع العميل: ${document.getElementById('fType').value}\n${plan?'الباقة: '+plan+'\n':''}الخدمات:\n${sv}`;
  document.getElementById('out').textContent=msg;document.getElementById('sendWa').href='https://wa.me/97455482829?text='+encodeURIComponent(msg);document.getElementById('outWrap').hidden=false;document.getElementById('outWrap').scrollIntoView({block:'nearest'});
});
function copy(text,el){(navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(()=>toast('تم النسخ')).catch(()=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('حدد النص وانسخه يدوياً')})}
document.getElementById('copyMsg').onclick=()=>copy(document.getElementById('out').textContent,document.getElementById('out'));
document.getElementById('copyPh').onclick=()=>copy('+97455482829',document.getElementById('ph'));
Object.entries(SAMPLE).forEach(([k,q])=>cart.set(k,q));
render();renderPlans();renderCart();
