'use strict';
// English for the management panel (crm.html). The panel is written in Arabic; with English chosen, every Arabic
// interface text is replaced as it appears (exact phrases first, then patterns with numbers or names).
// Data typed by people (client names, notes, messages) stays as written. Choice: ?lang=en / ?lang=ar, or the button in the header.
(function(){
const KEY='basira_crm_lang';
const q=new URLSearchParams(location.search).get('lang');
try{if(q==='en'||q==='ar')localStorage.setItem(KEY,q)}catch(e){}
let lang='ar';try{lang=localStorage.getItem(KEY)==='en'?'en':'ar'}catch(e){}
const EN=lang==='en';
window.CRM_LANG=lang;

const W={
// header, tabs, sign-in
'لوحة الإدارة | بصيرة للمعاملات':'Admin panel | Basira for Transactions','لوحة الإدارة':'Admin panel','أقسام لوحة الإدارة':'Admin panel sections',
'لوحة المتابعة':'Dashboard','الطلبات':'Requests','العملاء':'Clients','المعاملات':'Transactions','المراسلات':'Messages','السجل':'Log','الموظفون':'Staff','حسابي':'My account','خروج':'Sign out',
'دخول الإدارة والموظفين':'Manager and staff sign-in','اسم المستخدم':'Username','كلمة المرور':'Password','دخول':'Sign in','دخول العملاء':'Client sign-in',
'غيّر بيانات الدخول':'Change your sign-in details','هذا أول دخول. لحماية بيانات العملاء اختر اسم مستخدم وكلمة مرور جديدين.':'This is the first sign-in. To protect client data, choose a new username and password.',
'اسم المستخدم الجديد':'New username','كلمة المرور الجديدة (8 أحرف على الأقل)':'New password (at least 8 characters)','أعد كتابة كلمة المرور':'Repeat the password','حفظ والمتابعة':'Save and continue',
'اكتب اسم المستخدم وكلمة المرور.':'Type your username and password.','كلمتا المرور غير متطابقتين.':'The two passwords do not match.','تم حفظ بيانات الدخول الجديدة':'Your new sign-in details are saved',
// errors
'ليست لديك صلاحية لهذا الإجراء. راجع المدير.':'You do not have permission for this. Please ask the manager.','اسم المستخدم أو كلمة المرور غير صحيحة.':'The username or password is incorrect.',
'محاولات كثيرة، حاول بعد ساعة.':'Too many attempts. Try again in an hour.','كلمة المرور 8 أحرف على الأقل.':'The password must be at least 8 characters.',
'اسم المستخدم غير صالح (3 أحرف على الأقل وبدون مسافات).':'Invalid username (at least 3 characters, no spaces).','اسم المستخدم مستخدم من قبل.':'This username is already taken.',
'غيّر اسم المستخدم (ليس 123) وكلمة المرور معاً.':'Change both the username (not 123) and the password.','هذا الإجراء للمدير فقط.':'Only the manager can do this.',
'لا يمكن إيقاف آخر مدير أو تحويله إلى موظف.':'The last manager cannot be suspended or changed to staff.','الملف أكبر من 10 ميجابايت.':'The file is larger than 10 MB.',
'غير موجود.':'Not found.','بيانات غير مكتملة.':'Incomplete details.','لا يمكن تعديل هذا السجل مباشرة.':'This record cannot be edited directly.','غيّر بيانات الدخول أولاً.':'Change your sign-in details first.',
'انتهت الجلسة، سجّل الدخول مرة أخرى':'Your session has ended. Please sign in again.','خطأ':'Error',
'تعمل هذه الميزة بعد تشغيل الخادم (راجع ملف «اقرأني - تشغيل نظام العملاء»).':'This works once the server is running (see the “Client system setup” guide).',
'تعمل بعد تشغيل الخادم (ملف «اقرأني - تشغيل نظام العملاء»).':'Works once the server is running (see the “Client system setup” guide).',
'المراسلات مع العملاء تعمل بعد تشغيل الخادم.':'Messages with clients work once the server is running.',
// mode bar
'متصل بخادم المكتب. البيانات محفوظة في Google Sheets ويصل الرد بالبريد للعملاء تلقائياً.':'Connected to the office server. Data is saved in Google Sheets and replies reach clients by email automatically.',
'وضع محلي:':'Local mode:','البيانات تُحفظ في هذا المتصفح على هذا الجهاز فقط، والبريد يُفتح في برنامج البريد لديك. لتشغيل الحفظ المركزي والرد التلقائي اتبع ملف «اقرأني - تشغيل نظام العملاء». خذ نسخة احتياطية من قسم السجل بانتظام.':'Data is saved in this browser on this device only, and email opens in your mail app. To save centrally and reply automatically, follow the “Client system setup” guide. Take a backup from the Log section regularly.',
// statuses and values
'جديدة':'New','بانتظار المستندات':'Waiting for documents','قيد التقديم':'Being submitted','قيد المتابعة لدى الجهة':'With the authority','بانتظار العميل':'Waiting for the client','منجزة':'Completed','ملغاة':'Cancelled',
'جديد':'New','تم التواصل':'Contacted','تحوّل إلى معاملة':'Became a transaction','مغلق':'Closed',
'مفعّل':'Active','بانتظار التفعيل':'Waiting for activation','موقوف':'Suspended','نعم':'Yes','فرد':'Individual','منشأة':'Company',
'بدون باقة':'No package','أساس':'Asas','شامل':'Shamel','نخبة':'Nukhba','الذهبية':'Gold','باقات التأسيس':'Setup bundles',
'الموقع':'Website','زيارة المكتب':'Office visit','توصية':'Referral','شبكة المالك':'Owner’s network','أخرى':'Other','حساب الموقع':'Website account','المكتب':'Office',
'المدير العام':'General manager','مدير العلاقات الحكومية':'Government relations manager','المندوب':'Representative','منسق خدمة العملاء':'Customer service coordinator','مندوب':'Representative','محاسب':'Accountant','مستشار':'Consultant',
'المدير':'Manager','مدير':'Manager','موظف':'Staff','انتهت دون خروج':'Ended without signing out',
// dashboard
'طلبات جديدة من الموقع':'New requests from the website','معاملات تجاوزت الموعد المتوقع':'Transactions past their expected date','مستندات تنتهي خلال 30 يوماً':'Documents expiring within 30 days',
'اشتراكات باقات تنتهي خلال 30 يوماً':'Package subscriptions ending within 30 days','رسائل العملاء التي تنتظر الرد':'Client messages waiting for a reply','حسابات تنتظر التفعيل':'Accounts waiting for activation',
'طلبات جديدة':'New requests','معاملات مفتوحة':'Open transactions','رسائل تنتظر الرد':'Messages waiting for a reply','متأخرة':'Late','منجزة هذا الشهر':'Completed this month','أتعاب منجزة هذا الشهر':'Fees completed this month',
'ر.ق':'QAR','مستحق على العملاء':'Owed by clients','لا يوجد.':'None.','لا يوجد':'None','لا توجد بيانات.':'No data.','اتصل بالعميل للتأكد ثم فعّل الحساب من ملفه':'Call the client to confirm, then activate the account from their file',
// requests
'الطلبات الواردة':'Incoming requests','كل الحالات':'All statuses','بحث بالاسم أو الجوال':'Search by name or mobile','تصدير Excel':'Export to Excel','أُرسل':'Sent','رد بالبريد':'Reply by email','تحويل إلى معاملات':'Convert to transactions',
'الرقم':'No.','العميل':'Client','الخدمات المطلوبة':'Requested services','الباقة':'Package','التأكيد بالبريد':'Email confirmation','الحالة والإجراء':'Status and action',
// clients
'بحث بالاسم أو الجوال أو الرقم الشخصي أو السجل':'Search by name, mobile, QID or CR','عميل جديد':'New client','رجوع إلى العملاء':'Back to clients','تعديل البيانات':'Edit details','معاملة جديدة':'New transaction','إرسال بريد':'Send email','واتساب':'WhatsApp','إضافة ملاحظة':'Add a note',
'البيانات والأرقام':'Details and numbers','المتطلبات والملاحظات':'Requirements and notes','معاملات العميل وأعماله':'Client’s transactions and work','المراسلات مع العميل':'Messages with the client',
'اكتب ردك على العميل. يظهر في حسابه ويصله بالبريد إن كان مسجلاً.':'Write your reply to the client. It shows in their account and reaches them by email if they have one.','إرسال الرد':'Send reply','إرسال نسخة بالبريد':'Also send by email',
'حساب العميل على الموقع':'Client’s website account','الملفات والتراخيص المرفوعة للعميل':'Files and licences uploaded for the client','عنوان الملف كما يراه العميل':'File title as the client sees it','مثال: السجل التجاري بعد التجديد':'e.g. Commercial registration after renewal',
'المعاملة المرتبطة (اختياري)':'Related transaction (optional)','بدون':'None','الملف (حتى 10 ميجابايت)':'File (up to 10 MB)','أو رابط (Google Drive أو غيره)':'Or a link (Google Drive or other)','رفع للعميل':'Upload for the client',
'بيانات الدخول إلى البوابات الحكومية':'Government portal logins','كلمات المرور مشفرة. كل إظهار يُسجَّل باسمك في سجل العميل.':'Passwords are encrypted. Every reveal is recorded under your name in the client’s log.',
'الموافقات القانونية':'Legal acceptances','سجل التواصل':'Contact log','فتح الملف الكامل للعميل':'Open the client’s full file','الملف':'File','الاسم':'Name','الجوال':'Mobile','الرقم الشخصي أو السجل':'QID or CR','الحساب':'Account','المعاملات / المفتوحة':'Transactions / open',
'المتطلبات':'Requirements','الرقم الشخصي':'QID','السجل التجاري':'CR','بطاقة المنشأة':'Establishment card','الرقم الضريبي':'Tax no.','البريد':'Email','نهاية الاشتراك':'Subscription ends','العنوان':'Address','المصدر':'Source','تاريخ الإضافة':'Date added',
'لا توجد بيانات إضافية.':'No further details.','لا توجد متطلبات مسجلة.':'No requirements recorded.','لا يوجد تواصل مسجل.':'No contact recorded.','اكتب الملاحظة أو ملخص المكالمة':'Write the note or a summary of the call','حفظ':'Save','ملاحظة':'Note',
'اكتب جوالاً قطرياً من 8 أرقام':'Enter an 8-digit Qatari mobile','إضافة عميل جديد':'Add a new client','حذف العميل؟ لن تُحذف معاملاته.':'Delete the client? Their transactions are kept.','حذف':'Delete',
'لا توجد رسائل بعد. اكتب للعميل وسيراها في حسابه.':'No messages yet. Write to the client and they will see it in their account.','لم يدخل بعد':'Not signed in yet','الحالة':'Status','تاريخ الإنشاء':'Created','آخر دخول':'Last sign-in',
'ليس للعميل حساب على الموقع. يمكنه إنشاؤه بنفسه من صفحة «حسابي»، أو أنشئه له هنا.':'The client has no website account. They can create one from the “My account” page, or you can create it here.',
'تفعيل الحساب':'Activate account','تعديل أو إعادة تعيين كلمة المرور':'Edit or reset the password','إنشاء حساب للعميل':'Create an account for the client','إيقاف الحساب':'Suspend account',
'لم يُرفع للعميل أي ملف بعد.':'No file has been uploaded for this client yet.','يُحفظ الملف خاصاً في Google Drive للمكتب، ولا يصل إليه إلا العميل من حسابه.':'The file is kept private in the office’s Google Drive; only the client can reach it, from their account.',
'الوضع المحلي: أضف رابطاً فقط.':'Local mode: add a link only.','إظهار':'Reveal','لم يضف العميل بيانات دخول لأي بوابة.':'The client has not added any portal login.','لا توجد موافقات مسجلة.':'No acceptances recorded.',
'أُرسل الرد وظهر في حساب العميل ووصله بالبريد':'Reply sent: it shows in the client’s account and was emailed','أُرسل الرد وظهر في حساب العميل':'Reply sent: it shows in the client’s account',
'تم تحديث الحساب':'Account updated','تم الحفظ':'Saved','اكتب العنوان واختر ملفاً أو ضع رابطاً':'Type a title and choose a file or paste a link','جارٍ الرفع…':'Uploading…','أُضيف الملف إلى حساب العميل':'The file was added to the client’s account',
'حذف الملف من حساب العميل؟ يُنقل ملف Drive إلى سلة المهملات.':'Remove the file from the client’s account? The Drive file moves to the bin.','نسخ':'Copy','نُسخت كلمة المرور':'Password copied','فتح':'Open',
'آخر رسالة':'Last message','من':'From','التاريخ':'Date','بيانات العميل':'Client details','الاسم أو اسم المنشأة':'Name or company name','النوع':'Type','البريد الإلكتروني':'Email','الرقم الشخصي (QID)':'Personal ID (QID)','رقم السجل التجاري':'CR number','رقم بطاقة المنشأة':'Establishment card no.',
'مصدر العميل':'Client source','متطلبات العميل (ما يحتاجه حالياً ولاحقاً)':'Client requirements (what they need now and later)','ملاحظات':'Notes','إلغاء':'Cancel','حذف العميل':'Delete client',
'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)':'New password (leave empty to keep the current one)','أرسل للعميل اسم المستخدم وكلمة المرور على واتساب، واطلب منه تغييرها من «حسابي».':'Send the client the username and password on WhatsApp, and ask them to change it from “My account”.',
'كلمة مرور عشوائية':'Random password',
// transactions
'المفتوحة فقط':'Open only','بحث بالعميل أو الخدمة أو رقم الطلب لدى الجهة':'Search by client, service or authority reference','بيانات المعاملة':'Transaction details','الخدمة':'Service','المسؤول':'Assigned to',
'أتعاب بصيرة (ر.ق)':'Basira fee (QAR)','الرسوم الحكومية (ر.ق)':'Government fees (QAR)','المدفوع من العميل (ر.ق)':'Paid by the client (QAR)','رقم الطلب لدى الجهة':'Authority reference no.','تاريخ البدء':'Start date','الموعد المتوقع للإنجاز':'Expected completion',
'تاريخ انتهاء المستند الناتج (للتذكير بالتجديد)':'Expiry of the resulting document (for renewal reminders)','تاريخ الإغلاق':'Closing date','المستندات المطلوبة (علّم ما استُلم)':'Required documents (tick what was received)','أضف مستنداً آخر':'Add another document','إضافة':'Add',
'حذف المعاملة':'Delete transaction','الأتعاب':'Fee','الرسوم':'Gov. fees','المتبقي':'Balance','الموعد المتوقع':'Expected','انتهاء المستند':'Document expiry','المستندات':'Documents','اختر الخدمة…':'Choose the service…','خدمة أخرى غير مدرجة':'Another service, not listed',
'اختر الخدمة لتظهر مستنداتها.':'Choose the service to see its documents.','اختر العميل…':'Choose the client…','خدمة أخرى':'Other service','تغيرت حالة المعاملة. هل تريد إبلاغ العميل بالبريد؟':'The transaction status changed. Do you want to tell the client by email?','اكتب البريد':'Write the email',
'حذف المعاملة نهائياً؟':'Delete the transaction permanently?',
// email dialog
'إرسال بريد للعميل':'Email the client','القالب':'Template','إلى':'To','الموضوع':'Subject','الرسالة':'Message','إرسال':'Send','لغة البريد':'Email language',
'تأكيد استلام الطلب':'Request received','طلب المستندات':'Documents needed','تحديث حالة المعاملة':'Status update','إنجاز المعاملة':'Transaction completed','تذكير بالتجديد':'Renewal reminder','عرض سعر':'Quote','رسالة حرة':'Free message',
'يُرسل من بريد المكتب مباشرة ويُسجَّل في سجل العميل.':'Sent from the office email directly and recorded in the client’s log.','الوضع المحلي: سيفتح برنامج البريد لديك برسالة جاهزة، وتُسجَّل في سجل العميل.':'Local mode: your mail app opens with the message ready, and it is recorded in the client’s log.',
'أُرسل البريد':'Email sent','فُتح برنامج البريد':'Mail app opened','تعذر الإرسال:':'Could not send:',
// log
'سجل التواصل والأحداث':'Contacts and events log','نسخة احتياطية كاملة':'Full backup','استرجاع نسخة':'Restore a backup','بريد':'Email','تحديث':'Update','طلب من الموقع':'Website request','حساب':'Account','ملف':'File','بوابة':'Portal','مراسلة':'Message','تسجيل':'Registration',
'لا توجد أحداث.':'No events.','آخر تحديث':'Last updated','رقم العميل':'Client no.','رمز الخدمة':'Service code','الرسوم الحكومية':'Government fees','المدفوع':'Paid','الخدمات':'Services','الرموز':'Codes','اللغة':'Language','أُرسل التأكيد':'Confirmation sent','رقم المعاملة':'Transaction no.','النص':'Text','بواسطة':'By',
'سيستبدل هذا كل البيانات الحالية على هذا الجهاز. متابعة؟':'This replaces all current data on this device. Continue?','استرجاع':'Restore','تم الاسترجاع':'Restored','ملف غير صالح':'Invalid file','تعذر الحفظ:':'Could not save:',
'status':'status','account':'account','file':'file','message':'message','credential':'credential','note':'note','email':'email','request':'request','error':'error',
// staff
'الموظفون: الحضور والإنجاز':'Staff: attendance and work','إضافة موظف':'Add staff member','اليوم':'Today','أمس':'Yesterday','آخر 7 أيام':'Last 7 days','هذا الشهر':'This month','فترة محددة':'Custom period','عرض التقرير':'Show report','إرسال بالبريد للمكتب':'Email to the office',
'الحضور اليومي':'Daily attendance','آخر أعماله':'Latest work','حسابات الموظفين':'Staff accounts','المراسلات مع العملاء':'Messages with clients','بيانات دخولي':'My sign-in details','كلمة المرور الحالية':'Current password','كلمة المرور الجديدة (اتركها فارغة إن لم تغيّرها)':'New password (leave empty to keep it)',
'أعد كتابة كلمة المرور الجديدة':'Repeat the new password','صلاحياتي':'My permissions','بيانات الموظف':'Staff details','الاسم الكامل':'Full name','المسمى الوظيفي':'Job title','كلمة مرور مؤقتة':'Temporary password','تاريخ التعيين':'Hire date','بداية الدوام':'Shift starts','نهاية الدوام':'Shift ends',
'أيام العمل':'Working days','مثال: الأحد إلى الخميس':'e.g. Sunday to Thursday','نوع الحساب':'Account type','مدير (كل الصلاحيات)':'Manager (all permissions)','الصلاحيات':'Permissions','صلاحيات كاملة':'All permissions','إلغاء الكل':'Clear all',
'عرض العملاء وملفاتهم':'View clients and their files','إضافة العملاء وتعديلهم':'Add and edit clients','المعاملات وحالاتها':'Transactions and their status','الأتعاب والمدفوعات':'Fees and payments','المراسلات والرد على العملاء':'Messages and replies to clients','رفع الملفات والتراخيص':'Upload files and licences',
'حسابات العملاء (تفعيل وكلمات مرور)':'Client accounts (activation and passwords)','إظهار كلمات مرور البوابات':'Reveal portal passwords','إرسال البريد للعملاء':'Email clients','الحذف':'Delete','السجل الكامل':'Full log',
'مدير: كل الصلاحيات، وإدارة الموظفين وتقاريرهم.':'Manager: all permissions, plus staff and their reports.','لا توجد صلاحيات بعد. راجع المدير.':'No permissions yet. Please ask the manager.','اتركها فارغة للإبقاء على كلمة مروره.':'Leave it empty to keep their password.',
'أرسلها للموظف، وسيغيّرها عند أول دخول.':'Send it to the staff member; they change it at first sign-in.','المسمى':'Title','الدوام':'Shift','مدير: كاملة':'Manager: all','كاملة':'All','لم يغيّر كلمة المرور المؤقتة':'Has not changed the temporary password','تعديل':'Edit',
'الموظف':'Staff member','أيام الحضور':'Days present','ساعات العمل':'Hours worked','تأخير':'Late days','كل الإجراءات':'All actions','معاملات أضافها':'Transactions added','معاملات أنجزها':'Transactions completed','تغيير حالات':'Status changes','ردود على العملاء':'Replies to clients',
'ملفات رفعها':'Files uploaded','عملاء أضافهم':'Clients added','التفاصيل':'Details','أول دخول':'First sign-in','آخر خروج':'Last sign-out','مدة العمل':'Time worked','ما زال داخلاً':'Still signed in','تأخر':'Late','خرج مبكراً':'Left early','جلسات':'sessions',
'لا توجد أعمال مسجلة في هذه الفترة.':'No work recorded in this period.','الإجراءات (الفترة)':'Actions (period)','ردود':'Replies','ملفات':'Files','أُرسل التقرير إلى':'Report sent to','الاسم الكامل للموظف':'Full name',
// email templates (subjects/bodies get their own English versions in crm.js)
'- (حدد المستندات)':'- (list the documents)','الخدمة المطلوبة':'the requested service',
};
const CODE={};
// the catalogue's own English names for services and authorities
try{const D=window.DETAILS||{},DT=typeof DATA!=='undefined'?DATA:null;if(DT){(DT.G||[]).forEach(([code,name,list])=>{const e=(D._entities||{})[code];if(e)W[name]=e;
  list.forEach(([c,n])=>{const x=(D[c]||{}).en;if(x&&x.name)W[n]=x.name})});(DT.SETUP||[]).forEach(([c,n])=>{const x=(D[c]||{}).en;if(x&&x.name)W[n]=x.name});
  (DT.CONSULT||[]).forEach(g=>{if(g.ar&&g.en)W[g.ar]=g.en;(g.items||[]).forEach(i=>{if(i.ar&&i.en){W[i.ar.n]=i.en.n;CODE[i.c]=i.en.n}})});
  (DT.G||[]).forEach(([,,list])=>list.forEach(([c])=>{const x=(D[c]||{}).en;if(x&&x.name)CODE[c]=x.name}));(DT.SETUP||[]).forEach(([c])=>{const x=(D[c]||{}).en;if(x&&x.name)CODE[c]=x.name})}}catch(e){}

const P=[ // patterns: Arabic text with numbers, names or ids → English
[/^(-?[\d,.]+) ر\.ق$/,(m,n)=>`${n} QAR`],
[/^(.+) \(([A-Z]{2}-\d{2})\)( × \d+)?$/,(m,n,c,q)=>`${CODE[c]||tr(n)} (${c})${q||''}`],
[/^(.+) · ([\d,]+)$/,(m,n,p)=>W[n]?`${W[n]} · ${p}`:m],
[/^الدوام (.+)$/,(m,x)=>`Shift ${x}`],
[/^(.+): (\d{4}-\d\d-\d\d) إلى (\d{4}-\d\d-\d\d)$/,(m,n,a,b)=>`${n}: ${a} to ${b}`],
[/^متأخرة (-?\d+) يوم$/,(m,n)=>`${n} day${n==1?'':'s'} late`],
[/^· تنتهي بعد (-?\d+) يوم$/,(m,n)=>`· expires in ${n} day${n==1?'':'s'}`],
[/^· باقة (.+?) · تنتهي بعد (-?\d+) يوم$/,(m,p,n)=>`· ${tr(p)} package · ends in ${n} day${n==1?'':'s'}`],
[/^· (\d+) رسالة ·(.*)$/,(m,n,r)=>`· ${n} message${n==1?'':'s'} ·${r}`],
[/^تحويل الطلب (\S+) إلى (\d+) معاملة$/,(m,id,n)=>`Request ${id} converted to ${n} transactions`],
[/^أُنشئت (\d+) معاملة$/,(m,n)=>`${n} transaction${n==1?'':'s'} created`],
[/^فتح الملف الكامل لـ (.+)$/,(m,n)=>`Open the full file of ${n}`],
[/^(.*) · الإصدار (\S+)$/,(m,d,v)=>`${docs(d)} · version ${v}`],
[/^(.*) · وقّع باسم «(.+)» · (.*)$/,(m,d,n,s)=>`${d} · signed as “${n}” · ${src(s)}`],
[/^تم الحفظ\. أرسل للعميل: (.+)$/,(m,x)=>`Saved. Send the client: ${x}`],
[/^تم الحفظ\. أرسل للموظف: (.+)$/,(m,x)=>`Saved. Send the staff member: ${x}`],
[/^تعديل الموظف (.+)$/,(m,x)=>`Edit staff member ${x}`],
[/^جزئية \((\d+) من (\d+)\)$/,(m,a,b)=>`Partial (${a} of ${b})`],
[/^· الدوام (.+)$/,(m,x)=>`· shift ${x}`],
[/^المعاملة (\S+)$/,(m,x)=>`Transaction ${x}`],
[/^رقم الطلب لدى الجهة: (.+)$/,(m,x)=>`Authority reference: ${x}`],
[/^تاريخ انتهاء المستند: (.+)$/,(m,x)=>`Document expiry: ${x}`],
[/^أُرسل التقرير إلى (.+)$/,(m,x)=>`Report sent to ${x}`],
[/^تعذر الإرسال: (.*)$/,(m,x)=>`Could not send: ${tr(x)}`],[/^تعذر الحفظ: (.*)$/,(m,x)=>`Could not save: ${tr(x)}`],
[/^(\d+) جلسات$/,(m,n)=>`${n} sessions`],
// activity and log lines written by the server
[/^إضافة (معاملة|عميل|طلب|ملف): (.+?)( · (.+))?$/,(m,w,l,_,s)=>`Added ${({'معاملة':'transaction','عميل':'client','طلب':'request','ملف':'file'})[w]}: ${tr(l)}${s?' · '+tr(s):''}`],
[/^تعديل (معاملة|عميل|طلب|ملف) (\S+) \((.+)\)$/,(m,w,id,l)=>`Edited ${({'معاملة':'transaction','عميل':'client','طلب':'request','ملف':'file'})[w]} ${id} (${tr(l)})`],
[/^(معاملة|عميل|طلب|ملف) (\S+) \((.+)\): (.*) ← (.+)$/,(m,w,id,l,a,b)=>`${({'معاملة':'Transaction','عميل':'Client','طلب':'Request','ملف':'File'})[w]} ${id} (${tr(l)}): ${tr(a)||'—'} → ${tr(b)}`],
[/^رد على العميل: (.*)$/,(m,x)=>`Reply to the client: ${x}`],[/^رفع ملف: (.+)$/,(m,x)=>`Uploaded file: ${x}`],[/^رفع ملف للعميل: (.+)$/,(m,x)=>`File uploaded for the client: ${x}`],
[/^بريد للعميل: (.+)$/,(m,x)=>`Email to the client: ${x}`],[/^حساب العميل: (.+)$/,(m,x)=>`Client account: ${tr(x.replace(/ · كلمة مرور جديدة$/,''))}${/كلمة مرور جديدة/.test(x)?' · new password':''}`],
[/^إظهار كلمة مرور بوابة: (.+)$/,(m,x)=>`Portal password revealed: ${x}`],[/^حذف (.+)$/,(m,x)=>`Deleted ${tr(x)}`],
[/^إنشاء حساب على الموقع: (\S+)( \(بانتظار التفعيل\))?$/,(m,u,p)=>`Website account created: ${u}${p?' (waiting for activation)':''}`],
[/^العميل غيّر كلمة المرور$/,()=>'The client changed the password'],[/^العميل عيّن كلمة مرور جديدة برمز البريد$/,()=>'The client set a new password with an email code'],
[/^طلب العميل رمز استعادة كلمة المرور$/,()=>'The client asked for a password reset code'],[/^رد على العميل من المراسلات( \(أُرسل بالبريد أيضاً\))?$/,(m,e)=>`Reply to the client from Messages${e?' (also emailed)':''}`],
[/^رسالة من العميل$/,()=>'Message from the client'],
[/^(.+) ← (.+)$/,(m,a,b)=>`${tr(a)} → ${tr(b)}`],
[/^(.+): (.+)$/,(m,a,b)=>W[a]?`${W[a]}: ${tr(b)}`:m],
];
const docs=s=>s==='اتفاقية الخدمة، حدود المسؤولية، التفويض، البيانات والسرية'?'Service agreement, limitation of liability, authorization, data and confidentiality':s;
const src=s=>s.replace(/^إنشاء الحساب( عن (.+))?$/,(m,_,c)=>'Account created'+(c?' for '+c:'')).replace(/^التسجيل في الموقع$/,'Website registration');
function tr(s){if(!EN||s==null)return s;const t=String(s).replace(/\s+/g,' ').trim();if(!t||!/[؀-ۿ]/.test(t))return s;
  if(Object.prototype.hasOwnProperty.call(W,t))return W[t];
  for(const [re,fn] of P){const m=t.match(re);if(m){const r=fn(...m);if(r!==m[0])return r}}
  // a phrase between separator dots, or a list: translate the known parts, keep names and typed text
  const edge=t.match(/^([·\s]*)(.*?)([·\s]*)$/);if(edge&&(edge[1]||edge[3])&&edge[2]){const r=tr(edge[2]);if(r!==edge[2])return edge[1]+r+edge[3]}
  if(t.includes(' · ')){const parts=t.split(' · '),r=parts.map(x=>tr(x));if(r.some((x,i)=>x!==parts[i]))return r.join(' · ')}
  if(t.includes('، ')){const parts=t.split('، '),r=parts.map(x=>tr(x));if(r.every((x,i)=>x!==parts[i]))return r.join(', ')}
  return s}
// text nodes keep their surrounding spaces; only the words change
function fixText(n){const v=n.nodeValue;if(!v||!/[؀-ۿ]/.test(v))return;const p=n.parentNode;if(p&&(p.closest&&p.closest('.basmala,textarea,[data-keep]')))return;
  const t=tr(v);if(t!==v){const lead=v.match(/^\s*/)[0],trail=v.match(/\s*$/)[0];n.nodeValue=lead+String(t).trim()+trail}}
const ATTR=['placeholder','title','aria-label'];
function fixEl(el){ATTR.forEach(a=>{const v=el.getAttribute&&el.getAttribute(a);if(v&&/[؀-ۿ]/.test(v)){const t=tr(v);if(t!==v)el.setAttribute(a,t)}})}
function walk(root){if(root.nodeType===3){fixText(root);return}if(root.nodeType!==1)return;if(root.closest&&root.closest('.basmala'))return;fixEl(root);
  const it=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);let n;while((n=it.nextNode())){if(n.nodeType===3)fixText(n);else fixEl(n)}}

function start(){
  // language button in the header
  const hdr=document.querySelector('header.top .wrap');
  if(hdr&&!document.getElementById('langBtn')){const b=document.createElement('button');b.type='button';b.id='langBtn';b.className='ghostbtn langbtn';
    b.textContent=EN?'العربية':'English';b.lang=EN?'ar':'en';b.dataset.keep='';b.onclick=()=>{try{localStorage.setItem(KEY,EN?'ar':'en')}catch(e){}const u=new URL(location.href);u.searchParams.delete('lang');location.href=u.pathname+u.search};
    hdr.appendChild(b)}
  if(!EN)return;
  document.documentElement.lang='en';document.documentElement.dir='ltr';document.title=tr(document.title);
  document.querySelectorAll('a[href="portal.html"]').forEach(a=>a.setAttribute('href','en/portal.html'));
  walk(document.body);
  new MutationObserver(ms=>{for(const m of ms){if(m.type==='characterData')fixText(m.target);else if(m.type==='attributes')fixEl(m.target);else m.addedNodes.forEach(walk)}})
    .observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTR});
}
window.CRM_I18N={en:EN,tr,
  // CSV exports: translate header labels and fixed values, keep typed data as is
  csv(text){if(!EN)return text;const bom=text[0]==='\ufeff'?'\ufeff':'';return bom+text.slice(bom.length).split('\r\n').map(line=>line.split(',').map(c=>{const q=/^".*"$/.test(c),v=q?c.slice(1,-1).replace(/""/g,'"'):c;const t=tr(v);return t===v?c:(q?'"'+String(t).replace(/"/g,'""')+'"':t)}).join(',')).join('\r\n')}};
start();
})();
