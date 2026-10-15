'use strict';
// النسخة التجريبية: تُفتح بإضافة ?demo=1 إلى رابط «حسابي» أو لوحة الإدارة، وتُغلق بـ ?demo=0 أو من شريطها.
// تشغّل كود الخادم الحقيقي (assets/demo-server.js، المولّد من Code.gs) داخل المتصفح على بيانات تجريبية محفوظة في هذا الجهاز فقط.
(function(){
const FLAG='basira_demo',DBKEY='basira_demo_db',EN=document.documentElement.lang==='en';
const q=new URLSearchParams(location.search).get('demo');
try{if(q==='1')localStorage.setItem(FLAG,'1');if(q==='0'){localStorage.removeItem(FLAG);localStorage.removeItem(DBKEY)}}catch(e){}
let on=false;try{on=localStorage.getItem(FLAG)==='1'}catch(e){}
const CFG=window.BASIRA_CONFIG=window.BASIRA_CONFIG||{};
window.BASIRA_DEMO=on;
if(!on||CFG.API)return;   // a real server always wins over the demo
CFG.API='demo';

// ---- SHA-256 and HMAC (synchronous, as Apps Script's Utilities are) ----
const K=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(bytes){const l=bytes.length,n=((l+9+63)>>6)<<6,m=new Uint8Array(n);m.set(bytes);m[l]=0x80;const bl=l*8;
  m[n-4]=bl>>>24;m[n-3]=bl>>>16;m[n-2]=bl>>>8;m[n-1]=bl;const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
  const r=(x,k)=>(x>>>k)|(x<<(32-k));
  for(let o=0;o<n;o+=64){for(let i=0;i<16;i++)w[i]=(m[o+i*4]<<24)|(m[o+i*4+1]<<16)|(m[o+i*4+2]<<8)|m[o+i*4+3];
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))|0}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const t1=(hh+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0}
    h[0]+=a;h[1]+=b;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh}
  const out=new Uint8Array(32);for(let i=0;i<8;i++){out[i*4]=h[i]>>>24;out[i*4+1]=h[i]>>>16;out[i*4+2]=h[i]>>>8;out[i*4+3]=h[i]}return out}
const enc=s=>new TextEncoder().encode(String(s));
function hmac(msg,key){let k=enc(key);if(k.length>64)k=sha256(k);const ip=new Uint8Array(64),op=new Uint8Array(64);for(let i=0;i<64;i++){ip[i]=(k[i]||0)^0x36;op[i]=(k[i]||0)^0x5c}
  const m=enc(msg),a=new Uint8Array(64+m.length);a.set(ip);a.set(m,64);const inner=sha256(a),b=new Uint8Array(96);b.set(op);b.set(inner,64);return sha256(b)}
const signed=u8=>Array.from(u8,x=>x>127?x-256:x);
const toU8=a=>Uint8Array.from(a,x=>x&255);
const b64=a=>{let s='';toU8(a).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
const unb64=s=>{const t=atob(s);return Array.from(t,c=>c.charCodeAt(0))};

// ---- in-browser Apps Script services backed by localStorage ----
let DB=null;
function load(){try{DB=JSON.parse(localStorage.getItem(DBKEY)||'null')}catch(e){DB=null}}
function persist(){try{localStorage.setItem(DBKEY,JSON.stringify(DB))}catch(e){console.warn('demo storage full',e)}}
function mkSheet(name){const data=DB.sheets[name]=DB.sheets[name]||[];return {
  getLastRow:()=>DB.sheets[name].length,
  getRange:(r,c,nr,nc)=>({setValues(v){const d=DB.sheets[name];for(let i=0;i<nr;i++){d[r-1+i]=d[r-1+i]||[];for(let j=0;j<nc;j++)d[r-1+i][c-1+j]=v[i][j]}return this},
    getValues(){const d=DB.sheets[name],o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++)row.push(((d[r-1+i]||[])[c-1+j])??'');o.push(row)}return o},setFontWeight(){return this},setNumberFormat(){return this}}),
  setFrozenRows(){},deleteRow:i=>DB.sheets[name].splice(i-1,1)}}
const cache={};
const fmtDate=(d,tz,f)=>{const p=n=>String(n).padStart(2,'0'),s=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;return /HH/.test(f)?`${s} ${p(d.getHours())}:${p(d.getMinutes())}`:s};
const blob=(bytes,mime,name)=>{if(typeof bytes==='string')bytes=signed(enc(bytes));return {getName:()=>name,getContentType:()=>mime,getBytes:()=>bytes,getDataAsString:()=>new TextDecoder().decode(toU8(bytes))}};
function driveFile(id){const f=DB.drive[id];if(!f)throw new Error('no file');return {getId:()=>id,getUrl:()=>'#demo-file-'+id,getBlob:()=>blob(unb64(f.data),f.mime,f.name),setTrashed:t=>{f.trashed=t}}}
function folder(id){return {getId:()=>id,createFolder:n=>{const k='fo'+Object.keys(DB.folders).length+'_'+Date.now();DB.folders[k]={name:n,parent:id};return folder(k)},
  getFoldersByName:n=>{const m=Object.keys(DB.folders).filter(k=>DB.folders[k].parent===id&&DB.folders[k].name===n);return {hasNext:()=>m.length>0,next:()=>folder(m.shift())}},
  createFile:b=>{const k='fi'+Date.now()+Math.floor(Math.random()*1e4);DB.drive[k]={name:b.getName(),mime:b.getContentType(),data:b64(b.getBytes()),folder:id,trashed:false};return driveFile(k)}}}
const GAS={
  SpreadsheetApp:{getActive:()=>({getSheetByName:n=>DB.sheets[n]?mkSheet(n):null,insertSheet:n=>{DB.sheets[n]=[];return mkSheet(n)}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>DB.props[k]??null,setProperty:(k,v)=>{DB.props[k]=v}})},
  Utilities:{computeHmacSha256Signature:(s,k)=>signed(hmac(s,k)),computeDigest:(a,v)=>signed(sha256(enc(v))),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    base64EncodeWebSafe:a=>b64(a).replace(/\+/g,'-').replace(/\//g,'_'),base64Encode:b64,base64Decode:unb64,newBlob:blob,
    getUuid:()=>(crypto.randomUUID?crypto.randomUUID():'u'+Math.random().toString(16).slice(2)+Date.now().toString(16)),sleep(){},formatDate:fmtDate},
  Session:{getScriptTimeZone:()=>'Asia/Qatar'},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({setMimeType(){return this},t})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  CacheService:{getScriptCache:()=>({get:k=>cache[k]??null,put:(k,v)=>{cache[k]=v}})},
  MailApp:{sendEmail:o=>{DB.mails.push({to:o.to,subject:o.subject,at:fmtDate(new Date(),'','HH')});DB.mails=DB.mails.slice(-50)},getRemainingDailyQuota:()=>100},
  DriveApp:{createFolder:n=>{const k='root';DB.folders[k]={name:n,parent:''};return folder(k)},getFolderById:id=>{if(!DB.folders[id])throw new Error('no folder');return folder(id)},getFileById:driveFile},
  ScriptApp:{getProjectTriggers:()=>[],newTrigger:()=>({timeBased(){return this},everyDays(){return this},atHour(){return this},create(){}}),deleteTrigger(){}},
  Logger:{log(){}}
};
let SRV=null,ready=null;
function server(){if(ready)return ready;ready=new Promise((res,rej)=>{const s=document.createElement('script');
  s.src=document.currentScript?'':'';const base=(document.querySelector('script[src*="assets/demo.js"]')||{}).src||'assets/demo.js';s.src=base.replace(/demo\.js.*$/,'demo-server.js?v=20261015l');
  s.onload=()=>{SRV=window.BasiraDemoServer(GAS.SpreadsheetApp,GAS.PropertiesService,GAS.Utilities,GAS.Session,GAS.ContentService,GAS.LockService,GAS.CacheService,GAS.MailApp,GAS.DriveApp,GAS.ScriptApp,GAS.Logger);
    load();if(!DB||!DB.seeded){DB={sheets:{},props:{OFFICE_EMAIL:'demo@basira.local'},drive:{},folders:{},mails:[]};SRV.setup();seed();DB.seeded=1;persist()}res()};
  s.onerror=rej;document.head.appendChild(s)});return ready}
const realFetch=window.fetch.bind(window);
window.fetch=async(url,opt)=>{if(url!=='demo')return realFetch(url,opt);await server();load();
  const out=SRV.doPost({postData:{contents:opt&&opt.body||'{}'}});persist();const txt=out.t;
  return {ok:true,status:200,json:async()=>JSON.parse(txt),text:async()=>txt}};

// ---- sample data (fictional companies, clearly marked) ----
function seed(){const S=SRV,day=n=>{const d=new Date();d.setDate(d.getDate()+n);return fmtDate(d,'','')},at=(n,hm)=>day(n)+' '+hm;
  const row=(sheet,o,created)=>{o.id=S.nextId(sheet);o.created=created||S.now();return S.saveRow(sheet,o)};
  const pw=p=>{const salt=GAS.Utilities.getUuid();return {salt,hash:S.hashPw(salt,p)}};
  // staff: the admin keeps 123/123 in the demo (no forced change), plus two employees with partial permissions
  const adm=S.rows('Staff')[0];Object.assign(adm,{name:'المدير (تجريبي)',mustChange:'',jobTitle:'المدير العام',shiftStart:'08:00',shiftEnd:'16:00'});S.saveRow('Staff',adm);
  const sara=row('Staff',Object.assign({username:'sara',name:'سارة (موظفة تجريبية)',role:'staff',status:'مفعّل',mustChange:'',jobTitle:'منسقة خدمة العملاء',phone:'55000001',shiftStart:'08:00',shiftEnd:'16:00',workDays:'الأحد إلى الخميس',perms:'requests,clients_view,clients_edit,transactions,messages,files,email'},pw('sara1234')),at(-20,'09:00'));
  const omar=row('Staff',Object.assign({username:'omar',name:'عمر (مندوب تجريبي)',role:'staff',status:'مفعّل',mustChange:'',jobTitle:'مندوب',phone:'55000002',shiftStart:'07:30',shiftEnd:'15:30',workDays:'الأحد إلى الخميس',perms:'clients_view,transactions'},pw('omar1234')),at(-20,'09:05'));
  // clients and their accounts
  const c1=row('Clients',{name:'شركة النور للتجارة (تجريبي)',type:'منشأة',phone:'50000001',email:'noor@example.com',cr:'100001',estCard:'21-100001',taxNo:'5000100001',plan:'شامل',planEnd:day(20),address:'الدوحة، الخليج الغربي',source:'حساب الموقع',notes:'عميل تجريبي'},at(-18,'10:00'));
  const c2=row('Clients',{name:'مؤسسة الريان للمقاولات (تجريبي)',type:'منشأة',phone:'50000002',email:'rayyan@example.com',cr:'100002',estCard:'21-100002',address:'الريان',source:'حساب الموقع',notes:'عميل تجريبي'},at(-9,'11:30'));
  const c3=row('Clients',{name:'أحمد محمد (تجريبي)',type:'فرد',phone:'50000003',source:'الموقع',requirements:'تجديد استمارة مركبة',notes:'عميل تجريبي'},at(-1,'18:20'));
  [[c1,'noor','noor1234'],[c2,'rayyan','rayyan1234']].forEach(([c,u,p])=>{row('Accounts',Object.assign({clientId:c.id,username:u,status:'مفعّل',lastLogin:at(-1,'20:10')},pw(p)),c.created);
    row('Consents',{clientId:c.id,name:c.name.replace(' (تجريبي)',''),phone:c.phone,docs:S.LEGAL_DOCS,version:S.LEGAL_VERSION,lang:'ar',source:'إنشاء الحساب'},c.created)});
  const tx=(c,code,service,status,start,due,exp,fee,gov,paid,ref)=>row('Transactions',{clientId:c.id,code,service,status,fee,govFee:gov,paid,govRef:ref||'',startDate:day(start),dueDate:due==null?'':day(due),expiryDate:exp==null?'':day(exp),assignee:'عمر',docs:'[]',notes:'',closed:status==='منجزة'?day(start+3):''},at(start,'10:15'));
  const t1=tx(c1,'MC-03','تجديد سجل تجاري','منجزة',-15,-11,350,350,500,850,'MC-2026-55821');
  const t2=tx(c1,'MI-02','تجديد أو تعديل بطاقة المنشأة','قيد المتابعة لدى الجهة',-4,2,null,350,1000,1350,'MOI-88213');
  const t3=tx(c1,'MI-05','تجديد إقامة موظف','بانتظار المستندات',-2,5,null,750,0,0);
  const t4=tx(c2,'ML-02','توثيق عقد عمل إلكترونياً','قيد التقديم',-6,-1,null,400,0,200);
  const t5=tx(c2,'MB-01','توثيق عقد إيجار تجاري أو سكني','منجزة',-8,-5,28,300,0,300,'BL-77102');
  // requests from the website and from accounts
  row('Requests',{name:c1.name,phone:c1.phone,email:c1.email,type:'منشأة',plan:'شامل',services:'تجديد إقامة موظف (MI-05) × 3',codes:'MI-05',lang:'ar',status:'تحوّل إلى معاملة',clientId:c1.id,mailed:'نعم',notes:'من حساب العميل (noor)'},at(-3,'09:40'));
  row('Requests',{name:c2.name,phone:c2.phone,email:c2.email,type:'منشأة',plan:'',services:'شهادة دفاع مدني لمحل أو مكتب (CD-01) × 1',codes:'CD-01',lang:'ar',status:'جديد',clientId:c2.id,mailed:'نعم',notes:'من حساب العميل (rayyan)'},at(0,'08:55'));
  row('Requests',{name:c3.name,phone:c3.phone,email:'',type:'فرد',plan:'',services:'تجديد استمارة مركبة (TR-01) × 1',codes:'TR-01',lang:'ar',status:'جديد',clientId:c3.id,mailed:'لا',notes:'وسيلة التواصل المفضلة: واتساب'},at(-1,'18:20'));
  // a licence file in the client's account
  const pdf='%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 60 Td (Demo file - Basira demo) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  const fid='fi_demo_cr';DB.drive[fid]={name:'cr-renewal-demo.pdf',mime:'application/pdf',data:btoa(pdf),folder:'root',trashed:false};
  row('Files',{clientId:c1.id,txnId:t1.id,title:'السجل التجاري بعد التجديد (ملف تجريبي)',url:'#demo-file-'+fid,fileId:fid,by:'sara'},at(-11,'13:00'));
  row('Files',{clientId:c2.id,txnId:t5.id,title:'عقد الإيجار الموثق (ملف تجريبي)',url:'#demo-file-'+fid,fileId:fid,by:'sara'},at(-5,'12:30'));
  // messages
  row('Messages',{clientId:c1.id,from:'client',by:'noor',body:'السلام عليكم، متى تنتهي معاملة بطاقة المنشأة؟',read:'نعم'},at(-2,'10:05'));
  row('Messages',{clientId:c1.id,from:'office',by:'sara',body:'وعليكم السلام، المعاملة لدى وزارة الداخلية ونتوقع إنجازها خلال يومين، وسنرفع البطاقة إلى حسابك فور صدورها.',read:'نعم'},at(-2,'10:40'));
  row('Messages',{clientId:c2.id,from:'client',by:'rayyan',body:'أرسلت طلب شهادة الدفاع المدني، ما المستندات المطلوبة؟',read:''},at(0,'09:00'));
  // a government-portal login the client added (encrypted)
  row('Credentials',{clientId:c1.id,portal:'مطراش 2 / وزارة الداخلية',username:'alnoor_demo',secret:S.encrypt('Demo#Pass1'),note:'بيانات تجريبية',by:'العميل (noor)'},at(-3,'09:30'));
  // attendance and activity for the last working days, so the staff report has something to show
  [[sara,'08:00','16:00'],[omar,'07:30','15:30']].forEach(([st,a,b],k)=>{for(let d=-6;d<=-1;d++){const dt=new Date();dt.setDate(dt.getDate()+d);if(dt.getDay()===5||dt.getDay()===6)continue;
    const late=(d===-3&&k===0)||(d===-2&&k===1),inT=late?(k?'08:05':'08:40'):(k?'07:25':'07:55'),outT=k?'15:35':'16:05';
    row('Sessions',{staffId:st.id,username:st.username,login:at(d,inT),lastSeen:at(d,outT),logout:at(d,outT),minutes:String((+outT.slice(0,2)*60+ +outT.slice(3))-(+inT.slice(0,2)*60+ +inT.slice(3))),closedBy:'خروج'},at(d,inT))}});
  const act=(st,d,hm,action,sheet,rid,cid,summary)=>row('Activity',{staffId:st.id,username:st.username,action,sheet,recordId:rid,clientId:cid,summary},at(d,hm));
  act(sara,-15,'10:15','create','Transactions',t1.id,c1.id,'إضافة معاملة: تجديد سجل تجاري · بانتظار المستندات');
  act(omar,-11,'12:40','status','Transactions',t1.id,c1.id,`معاملة ${t1.id} (تجديد سجل تجاري): قيد المتابعة لدى الجهة ← منجزة`);
  act(sara,-11,'13:00','file','Files','',c1.id,'رفع ملف: السجل التجاري بعد التجديد');
  act(sara,-6,'10:15','create','Transactions',t4.id,c2.id,'إضافة معاملة: توثيق عقد عمل إلكترونياً · قيد التقديم');
  act(omar,-5,'11:10','status','Transactions',t5.id,c2.id,`معاملة ${t5.id} (توثيق عقد إيجار): قيد التقديم ← منجزة`);
  act(sara,-4,'10:15','create','Transactions',t2.id,c1.id,'إضافة معاملة: تجديد أو تعديل بطاقة المنشأة · قيد التقديم');
  act(omar,-3,'09:20','status','Transactions',t2.id,c1.id,`معاملة ${t2.id} (بطاقة المنشأة): قيد التقديم ← قيد المتابعة لدى الجهة`);
  act(sara,-2,'10:40','reply','Messages','',c1.id,'رد على العميل: المعاملة لدى وزارة الداخلية…');
  act(sara,-2,'11:00','create','Transactions',t3.id,c1.id,'إضافة معاملة: تجديد إقامة موظف · بانتظار المستندات');
}

// ---- banner ----
function banner(){const b=document.createElement('div');b.className='demobar';b.setAttribute('role','note');
  b.innerHTML=EN?'<b>Demo version</b> <span>Sample data saved in this browser only. Nothing is sent to the office.</span> <button type="button" data-d="reset">Reset sample data</button> <button type="button" data-d="exit">Leave the demo</button>'
    :'<b>نسخة تجريبية</b> <span>بيانات تجريبية محفوظة في هذا المتصفح فقط، ولا يصل منها شيء إلى المكتب.</span> <button type="button" data-d="reset">إعادة البيانات التجريبية</button> <button type="button" data-d="exit">الخروج من التجربة</button>';
  b.onclick=e=>{const k=(e.target.closest('[data-d]')||{}).dataset;if(!k||!k.d)return;
    try{localStorage.removeItem(DBKEY);localStorage.removeItem('basira_portal');sessionStorage.removeItem('basira_crm_token');if(k.d==='exit')localStorage.removeItem(FLAG)}catch(err){}
    location.href=location.pathname+(k.d==='exit'?'?demo=0':'')};
  document.body.prepend(b)}
// demo Drive links (#demo-file-…) open the stored file in the browser
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="#demo-file-"]');if(!a)return;e.preventDefault();load();
  const f=DB&&DB.drive&&DB.drive[a.getAttribute('href').slice(11)];if(!f||f.trashed)return;
  const u=URL.createObjectURL(new Blob([toU8(unb64(f.data))],{type:f.mime||'application/octet-stream'}));const d=document.createElement('a');d.href=u;d.download=f.name||'file';document.body.appendChild(d);d.click();setTimeout(()=>{URL.revokeObjectURL(u);d.remove()},2000)});
if(document.body)banner();else document.addEventListener('DOMContentLoaded',banner);
})();
