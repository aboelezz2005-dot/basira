'use strict';
// نظام العملاء: يعمل مع خادم Google Apps Script إذا وُضع رابطه في config.js، وإلا يحفظ في متصفح هذا الجهاز.
const CFG=window.BASIRA_CONFIG||{};
const D=window.DETAILS||{};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>(Number(n)||0).toLocaleString('en-US');
const STATUSES=['جديدة','بانتظار المستندات','قيد التقديم','قيد المتابعة لدى الجهة','بانتظار العميل','منجزة','ملغاة'];
const CLOSED=['منجزة','ملغاة'];
const REQ_ST=['جديد','تم التواصل','تحوّل إلى معاملة','مغلق'];
const SHEETS=['Clients','Transactions','Requests','Log'];
const PREFIX={Clients:'C',Transactions:'T',Requests:'R',Log:'L'};
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2200)}
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const days=s=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:Math.round((d-today())/864e5)};
const now=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
const iso=()=>now().slice(0,10);
// in-page replacements for confirm() and prompt(), which some browsers and embedded viewers block
function ask(msg,{input=false,ok='نعم'}={}){return new Promise(res=>{const d=$('dlgQ');$('qT').textContent=msg;$('qIn').hidden=!input;$('qIn').value='';$('qOk').textContent=ok;
  d.onclose=()=>res(d.returnValue==='ok'?(input?$('qIn').value.trim()||null:true):(input?null:false));d.returnValue='';d.showModal();if(input)$('qIn').focus()})}

// ---- catalogue (government + setup + consultancy) ----
const CAT=[];
DATA.G.forEach(([k,n,l])=>l.forEach(s=>CAT.push({c:s[0],n:s[1],p:s[3],g:n})));
DATA.SETUP.forEach(s=>CAT.push({c:s[0],n:s[1],p:s[3],g:'باقات التأسيس'}));
(DATA.CONSULT||[]).forEach(cat=>cat.items.forEach(i=>CAT.push({c:i.c,n:i.ar.n,p:i.p,g:cat.ar,docs:i.ar.docs})));
const SVC=Object.fromEntries(CAT.map(s=>[s.c,s]));
const docsFor=c=>((D[c]||{}).ar||{}).docs||(SVC[c]||{}).docs||[];

// ---- storage: remote (Apps Script) or local (this browser) ----
const LKEY='basira_crm_v1',PKEY='basira_crm_pw',TKEY='basira_crm_token';
const Remote={
  async call(body){const r=await fetch(CFG.API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});const j=await r.json();if(!j.ok){if(j.error==='auth'){logout();throw new Error('انتهت الجلسة، سجّل الدخول مرة أخرى')}throw new Error(j.error||'خطأ')}return j},
  async login(pw){const j=await this.call({action:'login',password:pw});sessionStorage.setItem(TKEY,j.token)},
  tok(){return sessionStorage.getItem(TKEY)},
  async list(){return (await this.call({action:'list',token:this.tok()})).data},
  async save(sheet,row){return (await this.call({action:'save',token:this.tok(),sheet,row})).row},
  async del(sheet,id){await this.call({action:'delete',token:this.tok(),sheet,id})},
  async mail(m){await this.call(Object.assign({action:'sendEmail',token:this.tok()},m))}
};
const Local={
  db(){try{return JSON.parse(localStorage.getItem(LKEY))||{}}catch(e){return {}}},
  put(db){localStorage.setItem(LKEY,JSON.stringify(db))},
  async login(pw){const h=await hash(pw),saved=localStorage.getItem(PKEY);if(!saved){localStorage.setItem(PKEY,h)}else if(saved!==h)throw new Error('كلمة المرور غير صحيحة');sessionStorage.setItem(TKEY,'local')},
  tok(){return sessionStorage.getItem(TKEY)},
  async list(){const db=this.db();SHEETS.forEach(s=>db[s]=db[s]||[]);return db},
  async save(sheet,row){const db=await this.list();const arr=db[sheet];
    if(!row.id){const max=arr.reduce((m,r)=>Math.max(m,+(String(r.id).match(/(\d+)$/)||[0,0])[1]),0);row.id=PREFIX[sheet]+'-'+String(max+1).padStart(4,'0');row.created=now()}
    if(sheet!=='Log')row.updated=now();
    const i=arr.findIndex(r=>r.id===row.id);if(i>=0)arr[i]=row;else arr.push(row);this.put(db);return row},
  async del(sheet,id){const db=await this.list();db[sheet]=db[sheet].filter(r=>r.id!==id);this.put(db)},
  async mail(m){location.href=`mailto:${encodeURIComponent(m.to)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`;
    await this.save('Log',{clientId:m.clientId||'',txnId:m.txnId||'',kind:'email',subject:m.subject,body:m.body,by:'CRM'})}
};
async function hash(s){try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('basira:'+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){let h=0;for(const ch of 'basira:'+s)h=(h*31+ch.charCodeAt(0))|0;return 'x'+h}}
const S=CFG.API?Remote:Local;
let DB={Clients:[],Transactions:[],Requests:[],Log:[]};
const cli=id=>DB.Clients.find(c=>c.id===id)||{};
const parseDocs=v=>{if(Array.isArray(v))return v;try{return JSON.parse(v||'[]')}catch(e){return []}};

// ---- login / mode ----
function showMode(){const m=$('modeBar');m.hidden=false;
  m.innerHTML=CFG.API?'متصل بخادم المكتب. البيانات محفوظة في Google Sheets ويصل الرد بالبريد للعملاء تلقائياً.'
  :'<b>وضع محلي:</b> البيانات تُحفظ في هذا المتصفح على هذا الجهاز فقط، والبريد يُفتح في برنامج البريد لديك. لتشغيل الحفظ المركزي والرد التلقائي اتبع ملف «اقرأني - تشغيل نظام العملاء». خذ نسخة احتياطية من قسم السجل بانتظام.';
  m.className='modebar'+(CFG.API?' ok':'')}
function needsSetup(){return !CFG.API&&!localStorage.getItem(PKEY)}
function showLogin(){$('login').hidden=false;$('tabs').hidden=true;document.querySelectorAll('.view').forEach(v=>v.hidden=true);
  const first=needsSetup();$('pw2Wrap').hidden=!first;$('loginBtn').textContent=first?'إنشاء كلمة المرور والدخول':'دخول';
  $('loginHint').textContent=first?'أول استخدام على هذا الجهاز: اختر كلمة مرور لحماية بيانات العملاء.':(CFG.API?'كلمة المرور التي ظهرت عند إعداد الخادم.':'اكتب كلمة المرور التي اخترتها على هذا الجهاز.');$('pw').focus()}
$('loginF').onsubmit=async e=>{e.preventDefault();$('loginErr').textContent='';
  const pw=$('pw').value;if(needsSetup()){if(pw.length<6){$('loginErr').textContent='اختر كلمة مرور من 6 أحرف على الأقل.';return}if(pw!==$('pw2').value){$('loginErr').textContent='كلمتا المرور غير متطابقتين.';return}}
  try{$('loginBtn').disabled=true;await S.login(pw);$('pw').value='';$('pw2').value='';await start()}catch(err){$('loginErr').textContent=err.message==='wrong_password'?'كلمة المرور غير صحيحة':err.message}finally{$('loginBtn').disabled=false}};
function logout(){sessionStorage.removeItem(TKEY);showLogin()}
$('logout').onclick=logout;
async function start(){$('login').hidden=true;$('tabs').hidden=false;await reload();go('dash')}
async function reload(){try{DB=await S.list();SHEETS.forEach(s=>DB[s]=DB[s]||[])}catch(e){toast(e.message)}renderAll()}

// ---- navigation ----
let tab='dash',curClient=null;
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)go(b.dataset.tab)});
function go(t,id){tab=t;document.querySelectorAll('.view').forEach(v=>v.hidden=true);
  if(t==='client'){curClient=id;$('v-client').hidden=false;renderClient()}else $('v-'+t).hidden=false;
  document.querySelectorAll('#tabs [data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===(t==='client'?'cli':t)));window.scrollTo(0,0)}
function renderAll(){renderDash();renderReq();renderCli();renderTx();renderLog();if(tab==='client')renderClient()}
const table=(head,rows)=>rows.length?`<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`:'<div class="empty">لا توجد بيانات.</div>';
const stTag=s=>`<span class="st st-${STATUSES.indexOf(s)}">${esc(s)}</span>`;
const link=(id,txt)=>`<a href="#" data-client="${esc(id)}">${esc(txt||id)}</a>`;
document.addEventListener('click',e=>{const a=e.target.closest('[data-client]');if(a){e.preventDefault();go('client',a.dataset.client)}
  const t=e.target.closest('[data-txn]');if(t){e.preventDefault();openTx(DB.Transactions.find(x=>x.id===t.dataset.txn))}
  const x=e.target.closest('[data-export]');if(x)exportCsv(x.dataset.export)});

// ---- dashboard ----
function renderDash(){
  const open=DB.Transactions.filter(t=>!CLOSED.includes(t.status));
  const late=open.filter(t=>{const d=days(t.dueDate);return d!==null&&d<0});
  const renew=DB.Transactions.filter(t=>{const d=days(t.expiryDate);return d!==null&&d>=0&&d<=30}).sort((a,b)=>a.expiryDate>b.expiryDate?1:-1);
  const plans=DB.Clients.filter(c=>{const d=days(c.planEnd);return d!==null&&d>=0&&d<=30});
  const nreq=DB.Requests.filter(r=>r.status==='جديد');
  const month=iso().slice(0,7),done=DB.Transactions.filter(t=>t.status==='منجزة'&&String(t.closed||t.updated).slice(0,7)===month);
  const due=open.reduce((a,t)=>a+Math.max(0,(+t.fee||0)+(+t.govFee||0)-(+t.paid||0)),0);
  $('nReq').textContent=nreq.length||'';
  $('kpis').innerHTML=[['العملاء',DB.Clients.length],['طلبات جديدة',nreq.length],['معاملات مفتوحة',open.length],['متأخرة',late.length],['منجزة هذا الشهر',done.length],['أتعاب منجزة هذا الشهر',fmt(done.reduce((a,t)=>a+(+t.fee||0),0))+' ر.ق'],['مستحق على العملاء',fmt(due)+' ر.ق']]
    .map(([k,v])=>`<div class="kpi"><b class="num">${v}</b><span>${k}</span></div>`).join('');
  const li=(arr,f)=>arr.length?`<ul class="plain">${arr.slice(0,12).map(x=>`<li>${f(x)}</li>`).join('')}</ul>`:'<p class="mute">لا يوجد.</p>';
  $('dReq').innerHTML=li(nreq,r=>`${link(r.clientId,r.name)} · <span class="num">${esc(r.phone)}</span> · <small class="mute">${esc(r.created)}</small>`);
  $('dLate').innerHTML=li(late,t=>`<a href="#" data-txn="${t.id}">${esc(t.service)}</a> · ${link(t.clientId,cli(t.clientId).name)} · <span class="bad">متأخرة ${-days(t.dueDate)} يوم</span>`);
  $('dRenew').innerHTML=li(renew,t=>`<a href="#" data-txn="${t.id}">${esc(t.service)}</a> · ${link(t.clientId,cli(t.clientId).name)} · تنتهي بعد ${days(t.expiryDate)} يوم`);
  $('dPlans').innerHTML=li(plans,c=>`${link(c.id,c.name)} · باقة ${esc(c.plan)} · تنتهي بعد ${days(c.planEnd)} يوم`);
}

// ---- requests ----
REQ_ST.forEach(s=>$('reqF').insertAdjacentHTML('beforeend',`<option>${s}</option>`));
$('reqF').onchange=$('reqQ').oninput=renderReq;
function renderReq(){const f=$('reqF').value,q=$('reqQ').value.trim();
  const rows=DB.Requests.filter(r=>(!f||r.status===f)&&(!q||(r.name+' '+r.phone+' '+r.id).includes(q))).sort((a,b)=>a.created<b.created?1:-1).map(r=>`<tr>
    <td class="num">${esc(r.id)}<br><small class="mute">${esc(r.created)}</small></td><td>${link(r.clientId,r.name)}<br><small class="num">${esc(r.phone)}</small>${r.email?`<br><small dir="ltr">${esc(r.email)}</small>`:''}</td>
    <td class="pre">${esc(r.services)}</td><td>${esc(r.plan||'')}</td><td>${r.mailed==='نعم'?'أُرسل':'—'}</td>
    <td><select data-rq="${esc(r.id)}">${REQ_ST.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select>
    <div class="acts"><button class="btn xs ghost" type="button" data-conv="${esc(r.id)}">تحويل إلى معاملات</button>${r.email?`<button class="btn xs ghost" type="button" data-rmail="${esc(r.id)}">رد بالبريد</button>`:''}</div></td></tr>`);
  $('reqT').innerHTML=table(['الرقم','العميل','الخدمات المطلوبة','الباقة','التأكيد بالبريد','الحالة والإجراء'],rows)}
$('reqT').addEventListener('change',async e=>{const s=e.target.closest('[data-rq]');if(!s)return;const r=DB.Requests.find(x=>x.id===s.dataset.rq);r.status=s.value;await saveRow('Requests',r);renderDash()});
$('reqT').addEventListener('click',async e=>{
  const c=e.target.closest('[data-conv]');if(c){const r=DB.Requests.find(x=>x.id===c.dataset.conv);
    const codes=String(r.codes||'').split(/\s+/).filter(x=>SVC[x]);if(!codes.length){openTx({clientId:r.clientId,notes:r.services});return}
    for(const code of codes)await saveRow('Transactions',newTx(r.clientId,code,r.services));
    r.status='تحوّل إلى معاملة';await saveRow('Requests',r);await saveRow('Log',{clientId:r.clientId,kind:'status',subject:`تحويل الطلب ${r.id} إلى ${codes.length} معاملة`,by:'CRM'});toast(`أُنشئت ${codes.length} معاملة`);renderAll();return}
  const m=e.target.closest('[data-rmail]');if(m){const r=DB.Requests.find(x=>x.id===m.dataset.rmail);openMail(cli(r.clientId).id?cli(r.clientId):{name:r.name,email:r.email},null,'docs')}});
function newTx(clientId,code,notes){const s=SVC[code]||{};return {clientId,code,service:s.n||'',status:'بانتظار المستندات',fee:s.p||'',govFee:'',paid:'',startDate:iso(),docs:JSON.stringify(docsFor(code).map(t=>({t,ok:false}))),notes:notes||''}}

// ---- clients ----
$('cliQ').oninput=renderCli;
function renderCli(){const q=$('cliQ').value.trim();
  const rows=DB.Clients.filter(c=>!q||[c.name,c.phone,c.qid,c.cr,c.estCard,c.email,c.id].join(' ').includes(q)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'ar')).map(c=>{
    const tx=DB.Transactions.filter(t=>t.clientId===c.id),open=tx.filter(t=>!CLOSED.includes(t.status)).length;
    return `<tr><td class="num">${esc(c.id)}</td><td>${link(c.id,c.name)}<br><small class="mute">${esc(c.type)}</small></td><td class="num">${esc(c.phone)}</td><td class="num">${esc(c.qid||c.cr||'')}</td><td>${esc(c.plan||'')}</td><td class="num">${tx.length} / ${open}</td><td><small>${esc(String(c.requirements||'').slice(0,80))}</small></td></tr>`});
  $('cliT').innerHTML=table(['الرقم','الاسم','الجوال','الرقم الشخصي أو السجل','الباقة','المعاملات / المفتوحة','المتطلبات'],rows)}
const FIELDS={qid:'الرقم الشخصي',cr:'السجل التجاري',estCard:'بطاقة المنشأة',taxNo:'الرقم الضريبي',phone:'الجوال',email:'البريد',plan:'الباقة',planEnd:'نهاية الاشتراك',address:'العنوان',source:'المصدر',created:'تاريخ الإضافة'};
function renderClient(){const c=cli(curClient);if(!c.id){go('cli');return}
  $('cName').textContent=`${c.name} · ${c.id}`;$('cWa').href='https://wa.me/974'+String(c.phone||'').slice(-8);
  $('cInfo').innerHTML=Object.entries(FIELDS).filter(([k])=>c[k]).map(([k,l])=>`<dt>${l}</dt><dd class="${/qid|cr|estCard|taxNo|phone/.test(k)?'num':''}" ${k==='email'?'dir="ltr"':''}>${esc(c[k])}</dd>`).join('')||'<p class="mute">لا توجد بيانات إضافية.</p>';
  $('cReq').innerHTML=`<p class="pre">${esc(c.requirements||'لا توجد متطلبات مسجلة.')}</p>${c.notes?`<p class="pre mute">${esc(c.notes)}</p>`:''}`;
  const tx=DB.Transactions.filter(t=>t.clientId===c.id).sort((a,b)=>a.created<b.created?1:-1);
  $('cTx').innerHTML=txTable(tx,false);
  const lg=DB.Log.filter(l=>l.clientId===c.id).sort((a,b)=>a.created<b.created?1:-1);
  $('cLog').innerHTML=lg.length?lg.map(logItem).join(''):'<p class="mute">لا يوجد تواصل مسجل.</p>'}
$('backCli').onclick=()=>go('cli');$('newCli').onclick=()=>openCli({});$('cEdit').onclick=()=>openCli(cli(curClient));
$('cTxn').onclick=()=>openTx({clientId:curClient,status:'بانتظار المستندات',startDate:iso()});$('cMail').onclick=()=>openMail(cli(curClient));
$('cNote').onclick=async()=>{const t=await ask('اكتب الملاحظة أو ملخص المكالمة',{input:true,ok:'حفظ'});if(!t)return;await saveRow('Log',{clientId:curClient,kind:'note',subject:'ملاحظة',body:t,by:'CRM'});renderClient();renderLog()};
let editC=null;
function openCli(c){editC=c;const f=$('fC');f.reset();Object.keys(c).forEach(k=>{if(f.elements[k])f.elements[k].value=c[k]==null?'':c[k]});$('delC').hidden=!c.id;$('dlgC').showModal()}
$('fC').addEventListener('submit',async e=>{if(e.submitter&&e.submitter.value!=='save')return;const f=$('fC');
  const ph=f.elements.phone.value.replace(/\s/g,'').replace(/^\+?974/,'');if(!/^[3567]\d{7}$/.test(ph)){e.preventDefault();toast('اكتب جوالاً قطرياً من 8 أرقام');return}
  const row=Object.assign({},editC);[...f.elements].forEach(el=>{if(el.name)row[el.name]=el.value.trim()});row.phone=ph;
  const r=await saveRow('Clients',row);if(!editC.id){await saveRow('Log',{clientId:r.id,kind:'status',subject:'إضافة عميل جديد',by:'CRM'});go('client',r.id)}renderAll()});
$('delC').onclick=async()=>{$('dlgC').close();if(!await ask('حذف العميل؟ لن تُحذف معاملاته.',{ok:'حذف'}))return;await S.del('Clients',editC.id);await reload();go('cli')};

// ---- transactions ----
STATUSES.forEach(s=>$('txF').insertAdjacentHTML('beforeend',`<option>${s}</option>`));
$('txF').onchange=$('txQ').oninput=renderTx;
function txTable(list,withClient=true){return table(['الرقم','الخدمة',...(withClient?['العميل']:[]),'الحالة','الأتعاب','الرسوم','المتبقي','الموعد المتوقع','انتهاء المستند','المستندات'],list.map(t=>{
  const docs=parseDocs(t.docs),got=docs.filter(d=>d.ok).length,dd=days(t.dueDate),rem=(+t.fee||0)+(+t.govFee||0)-(+t.paid||0);
  return `<tr><td class="num"><a href="#" data-txn="${t.id}">${esc(t.id)}</a></td><td>${esc(t.service)} <span class="code">${esc(t.code)}</span></td>${withClient?`<td>${link(t.clientId,cli(t.clientId).name)}</td>`:''}<td>${stTag(t.status)}</td><td class="num">${fmt(t.fee)}</td><td class="num">${fmt(t.govFee)}</td><td class="num ${rem>0?'bad':''}">${fmt(rem)}</td>
  <td class="num ${dd!==null&&dd<0&&!CLOSED.includes(t.status)?'bad':''}">${esc(t.dueDate||'')}</td><td class="num">${esc(t.expiryDate||'')}</td><td class="num">${docs.length?`${got}/${docs.length}`:''}</td></tr>`}))}
function renderTx(){const f=$('txF').value,q=$('txQ').value.trim();
  const list=DB.Transactions.filter(t=>(!f||(f==='open'?!CLOSED.includes(t.status):t.status===f))&&(!q||[t.service,t.code,t.govRef,t.id,cli(t.clientId).name].join(' ').includes(q))).sort((a,b)=>a.created<b.created?1:-1);
  $('txT').innerHTML=txTable(list)}
$('newTx').onclick=()=>openTx({status:'بانتظار المستندات',startDate:iso()});
const fT=$('fT');
STATUSES.forEach(s=>fT.elements.status.insertAdjacentHTML('beforeend',`<option>${s}</option>`));
(()=>{const sel=fT.elements.code;sel.innerHTML='<option value="">اختر الخدمة…</option>';const groups={};CAT.forEach(s=>(groups[s.g]=groups[s.g]||[]).push(s));
  Object.entries(groups).forEach(([g,l])=>{const og=document.createElement('optgroup');og.label=g;l.forEach(s=>og.insertAdjacentHTML('beforeend',`<option value="${s.c}">${esc(s.n)} · ${fmt(s.p)}</option>`));sel.appendChild(og)});
  sel.insertAdjacentHTML('beforeend','<option value="OTHER">خدمة أخرى غير مدرجة</option>')})();
let editT=null,tDocs=[];
function drawDocs(){$('tDocs').innerHTML=tDocs.map((d,i)=>`<label class="chk"><input type="checkbox" data-di="${i}" ${d.ok?'checked':''}> ${esc(d.t)}</label>`).join('')||'<p class="mute sm">اختر الخدمة لتظهر مستنداتها.</p>'}
$('tDocs').addEventListener('change',e=>{const i=e.target.dataset.di;if(i!=null)tDocs[i].ok=e.target.checked});
$('tDocAdd').onclick=()=>{const v=$('tDocNew').value.trim();if(v){tDocs.push({t:v,ok:false});$('tDocNew').value='';drawDocs()}};
function openTx(t){if(!t)return;editT=t;fT.reset();
  fT.elements.clientId.innerHTML='<option value="">اختر العميل…</option>'+DB.Clients.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.phone)}</option>`).join('');
  Object.keys(t).forEach(k=>{if(fT.elements[k]&&k!=='docs')fT.elements[k].value=t[k]==null?'':t[k]});
  tDocs=parseDocs(t.docs);drawDocs();$('delT').hidden=!t.id;$('dlgTT').textContent=t.id?`المعاملة ${t.id}`:'معاملة جديدة';$('dlgT').showModal()}
fT.elements.code.onchange=()=>{const s=SVC[fT.elements.code.value];if(!s)return;if(!fT.elements.fee.value)fT.elements.fee.value=s.p;
  if(!tDocs.length){tDocs=docsFor(s.c).map(t=>({t,ok:false}));drawDocs()}};
fT.elements.status.onchange=()=>{if(CLOSED.includes(fT.elements.status.value)&&!fT.elements.closed.value)fT.elements.closed.value=iso()};
fT.addEventListener('submit',async e=>{if(e.submitter&&e.submitter.value!=='save')return;
  const row=Object.assign({},editT),before=editT.status;[...fT.elements].forEach(el=>{if(el.name)row[el.name]=el.value.trim()});
  row.service=(SVC[row.code]||{}).n||row.service||'خدمة أخرى';row.docs=JSON.stringify(tDocs);
  const r=await saveRow('Transactions',row);
  if(before!==r.status)await saveRow('Log',{clientId:r.clientId,txnId:r.id,kind:'status',subject:`${r.service}: ${before?before+' ← ':''}${r.status}`,by:'CRM'});
  renderAll();
  if(before&&before!==r.status&&cli(r.clientId).email&&await ask('تغيرت حالة المعاملة. هل تريد إبلاغ العميل بالبريد؟',{ok:'اكتب البريد'}))openMail(cli(r.clientId),r,r.status==='منجزة'?'done':(r.status==='بانتظار المستندات'?'docs':'status'))});
$('delT').onclick=async()=>{$('dlgT').close();if(!await ask('حذف المعاملة نهائياً؟',{ok:'حذف'}))return;await S.del('Transactions',editT.id);await reload()};

// ---- email ----
const TPL={
  recv:['تأكيد استلام الطلب','استلمنا طلبك | بصيرة للمعاملات','السلام عليكم {name}،\n\nشكراً لتواصلك مع بصيرة للمعاملات. استلمنا طلبك وسنراجعه ونعود إليك خلال ساعتين عمل بقائمة المستندات والسعر.\n\nمع التحية،\nفريق بصيرة للمعاملات'],
  docs:['طلب المستندات','المستندات المطلوبة لمعاملتك | بصيرة للمعاملات','السلام عليكم {name}،\n\nلإتمام {service} نحتاج المستندات التالية:\n{docs}\n\nأتعاب بصيرة: {fee} ر.ق، والرسوم الحكومية تُدفع منفصلة بإيصالها الرسمي.\nيمكنك الرد على هذا البريد بالمستندات أو إرسالها على واتساب ‎+974 72232609.\n\nمع التحية،\nفريق بصيرة للمعاملات'],
  status:['تحديث حالة المعاملة','تحديث على معاملتك {txn} | بصيرة للمعاملات','السلام عليكم {name}،\n\nنبلغك أن حالة معاملتك ({service}) أصبحت: {status}.\n{ref}\nسنبلغك بأي تحديث جديد.\n\nمع التحية،\nفريق بصيرة للمعاملات'],
  done:['إنجاز المعاملة','تم إنجاز معاملتك {txn} | بصيرة للمعاملات','السلام عليكم {name}،\n\nيسعدنا إبلاغك بإنجاز معاملتك ({service}).\n{expiry}\nسنسلّمك المستند والإيصالات الرسمية، وسنذكّرك قبل موعد التجديد.\n\nشكراً لثقتك،\nفريق بصيرة للمعاملات'],
  renew:['تذكير بالتجديد','تذكير: موعد تجديد قريب | بصيرة للمعاملات','السلام عليكم {name}،\n\nنذكّرك بأن {service} ينتهي بتاريخ {expiryDate}. يمكننا تجديده لك قبل الموعد لتجنب الغرامات.\nرد على هذا البريد أو راسلنا على واتساب ‎+974 72232609 لنبدأ.\n\nمع التحية،\nفريق بصيرة للمعاملات'],
  quote:['عرض سعر','عرض سعر من بصيرة للمعاملات','السلام عليكم {name}،\n\nبناءً على طلبك، نرفق عرض السعر التالي:\n- الخدمة: {service}\n- أتعاب بصيرة: {fee} ر.ق\n- الرسوم الحكومية التقديرية: {govFee} ر.ق (تُدفع بإيصال رسمي)\n\nالعرض ساري 14 يوماً.\n\nمع التحية،\nفريق بصيرة للمعاملات'],
  free:['رسالة حرة','','السلام عليكم {name}،\n\n\n\nمع التحية،\nفريق بصيرة للمعاملات']
};
Object.entries(TPL).forEach(([k,[n]])=>$('mTpl').insertAdjacentHTML('beforeend',`<option value="${k}">${n}</option>`));
let mCtx=null;
function fill(s){const c=mCtx.c||{},t=mCtx.t||{};const docs=parseDocs(t.docs).filter(d=>!d.ok).map(d=>'- '+d.t).join('\n')||(t.code?docsFor(t.code).map(d=>'- '+d).join('\n'):'- (حدد المستندات)');
  return s.replace(/\{name\}/g,c.name||'').replace(/\{service\}/g,t.service||'الخدمة المطلوبة').replace(/\{txn\}/g,t.id||'').replace(/\{status\}/g,t.status||'').replace(/\{fee\}/g,fmt(t.fee)).replace(/\{govFee\}/g,fmt(t.govFee))
    .replace(/\{docs\}/g,docs).replace(/\{ref\}/g,t.govRef?`رقم الطلب لدى الجهة: ${t.govRef}`:'').replace(/\{expiry\}/g,t.expiryDate?`تاريخ انتهاء المستند: ${t.expiryDate}`:'').replace(/\{expiryDate\}/g,t.expiryDate||'')}
function applyTpl(){const [,sub,body]=TPL[$('mTpl').value];const f=$('fM');f.elements.subject.value=fill(sub);f.elements.body.value=fill(body)}
$('mTpl').onchange=applyTpl;
function openMail(c,t,tpl){if(!t&&c&&c.id){t=DB.Transactions.filter(x=>x.clientId===c.id).sort((a,b)=>a.created<b.created?1:-1)[0]||null}
  mCtx={c,t};const f=$('fM');f.reset();f.elements.to.value=c.email||'';$('mTpl').value=tpl||(t?'status':'recv');applyTpl();
  $('mHint').textContent=CFG.API?'يُرسل من بريد المكتب مباشرة ويُسجَّل في سجل العميل.':'الوضع المحلي: سيفتح برنامج البريد لديك برسالة جاهزة، وتُسجَّل في سجل العميل.';$('dlgM').showModal()}
$('fM').addEventListener('submit',async e=>{if(e.submitter&&e.submitter.value!=='send')return;const f=$('fM');
  try{await S.mail({to:f.elements.to.value.trim(),subject:f.elements.subject.value,body:f.elements.body.value,clientId:(mCtx.c||{}).id||'',txnId:(mCtx.t||{}).id||''});toast(CFG.API?'أُرسل البريد':'فُتح برنامج البريد');await reload()}catch(err){toast('تعذر الإرسال: '+err.message)}});

// ---- log, export, backup ----
const KIND={email:'بريد',note:'ملاحظة',status:'تحديث',request:'طلب من الموقع',error:'خطأ'};
const logItem=l=>`<div class="logi"><span class="k k-${esc(l.kind)}">${KIND[l.kind]||esc(l.kind)}</span><div><b>${esc(l.subject)}</b> ${l.txnId?`<a href="#" data-txn="${esc(l.txnId)}" class="code">${esc(l.txnId)}</a>`:''}${l.body?`<div class="pre mute sm">${esc(String(l.body).slice(0,400))}</div>`:''}</div><small class="mute num">${esc(l.created)}</small></div>`;
function renderLog(){const l=[...DB.Log].sort((a,b)=>a.created<b.created?1:-1).slice(0,300);
  $('logL').innerHTML=l.length?l.map(x=>`${x.clientId?`<div class="mute sm">${link(x.clientId,cli(x.clientId).name)}</div>`:''}${logItem(x)}`).join(''):'<div class="empty">لا توجد أحداث.</div>';$('restoreL').hidden=!!CFG.API}
const HEAD={Clients:['الرقم','تاريخ الإضافة','الاسم','النوع','الجوال','البريد','الرقم الشخصي','السجل التجاري','بطاقة المنشأة','الرقم الضريبي','الباقة','نهاية الاشتراك','العنوان','المصدر','المتطلبات','ملاحظات','آخر تحديث'],
  Transactions:['الرقم','تاريخ الإنشاء','رقم العميل','رمز الخدمة','الخدمة','الحالة','الأتعاب','الرسوم الحكومية','المدفوع','رقم الطلب لدى الجهة','تاريخ البدء','الموعد المتوقع','انتهاء المستند','المسؤول','المستندات','ملاحظات','تاريخ الإغلاق','آخر تحديث'],
  Requests:['الرقم','التاريخ','الاسم','الجوال','البريد','النوع','الباقة','الخدمات','الرموز','اللغة','الحالة','رقم العميل','أُرسل التأكيد','ملاحظات','آخر تحديث'],
  Log:['الرقم','التاريخ','رقم العميل','رقم المعاملة','النوع','الموضوع','النص','بواسطة']};
const COLS={Clients:['id','created','name','type','phone','email','qid','cr','estCard','taxNo','plan','planEnd','address','source','requirements','notes','updated'],
  Transactions:['id','created','clientId','code','service','status','fee','govFee','paid','govRef','startDate','dueDate','expiryDate','assignee','docs','notes','closed','updated'],
  Requests:['id','created','name','phone','email','type','plan','services','codes','lang','status','clientId','mailed','notes','updated'],
  Log:['id','created','clientId','txnId','kind','subject','body','by']};
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.hidden=true;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}
function exportCsv(sheet){const q=v=>{v=v==null?'':String(v);if(sheet==='Transactions'&&v.startsWith('[{'))v=parseDocs(v).map(d=>(d.ok?'✓ ':'✗ ')+d.t).join(' | ');return '"'+v.replace(/"/g,'""')+'"'};
  const rows=[HEAD[sheet].map(q).join(','),...DB[sheet].map(r=>COLS[sheet].map(c=>q(c==='phone'||c==='qid'?(r[c]?'‎'+r[c]:''):r[c])).join(','))];
  download(`basira-${{Clients:'clients',Transactions:'transactions',Requests:'requests',Log:'log'}[sheet]}-${iso()}.csv`,'﻿'+rows.join('\r\n'),'text/csv;charset=utf-8')}
$('backup').onclick=()=>download(`basira-backup-${iso()}.json`,JSON.stringify(DB,null,1),'application/json');
$('restore').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!SHEETS.every(s=>Array.isArray(d[s])))throw 0;
  if(!await ask('سيستبدل هذا كل البيانات الحالية على هذا الجهاز. متابعة؟',{ok:'استرجاع'}))return;Local.put(d);await reload();toast('تم الاسترجاع')}catch(err){toast('ملف غير صالح')}e.target.value=''};

async function saveRow(sheet,row){try{const r=await S.save(sheet,row);const arr=DB[sheet],i=arr.findIndex(x=>x.id===r.id);if(i>=0)arr[i]=r;else arr.push(r);return r}catch(e){toast('تعذر الحفظ: '+e.message);throw e}}

showMode();
if(S.tok())start();else showLogin();
