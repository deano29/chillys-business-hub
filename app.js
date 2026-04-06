// ── CLERK AUTH ──
let clerkInstance=null;
let authToken=null;

async function initClerk(){
  // Wait for Clerk SDK to load (it loads async via the script tag)
  let attempts=0;
  while(!window.Clerk&&attempts<50){await new Promise(r=>setTimeout(r,100));attempts++;}

  try{
    const clerk=window.Clerk;
    if(!clerk||!clerk.load) throw new Error('Clerk SDK not available');

    // If not already loaded, load it
    if(!clerk.user&&!clerk.loaded) await clerk.load();

    clerkInstance=clerk;

    if(!clerk.user){
      // Show sign-in UI
      clerk.mountSignIn(document.getElementById('clerk-auth'));
      // Wait for sign-in
      await new Promise(resolve=>{
        clerk.addListener(({user})=>{if(user) resolve();});
      });
    }
    // User is signed in — get token and show app
    authToken=await clerk.session?.getToken();
    document.getElementById('auth-overlay').style.display='none';
    // Now load data (auth token is ready)
    loadFromNotion();
    // Refresh token periodically (tokens expire after ~60s)
    setInterval(async()=>{
      if(clerkInstance?.session) authToken=await clerkInstance.session.getToken();
    },50000);
    // Add user info to sidebar
    const userPill=document.querySelector('.user-pill');
    if(userPill&&clerk.user){
      userPill.innerHTML=`<span style="font-size:12px">👤 ${clerk.user.firstName||clerk.user.emailAddresses?.[0]?.emailAddress||'User'}</span>
        <button onclick="clerkInstance.signOut().then(()=>location.reload())" style="background:none;border:none;cursor:pointer;font-size:10px;color:var(--ink-light);margin-left:8px">Sign out</button>`;
    }
  }catch(e){
    console.warn('Clerk init failed, running without auth:',e.message);
    document.getElementById('auth-overlay').style.display='none';
    loadFromNotion();// Load without auth as fallback
  }
}
initClerk();

// Auth-aware fetch wrapper
async function authFetch(url,options={}){
  // Wait for auth token if not ready yet (max 5 seconds)
  if(!authToken&&clerkInstance){
    for(let i=0;i<50&&!authToken;i++) await new Promise(r=>setTimeout(r,100));
  }
  // Refresh token if we have a session (tokens expire quickly)
  if(clerkInstance?.session){
    try{authToken=await clerkInstance.session.getToken();}catch{}
  }
  if(authToken){
    options.headers={...options.headers,'Authorization':'Bearer '+authToken};
  }
  return fetch(url,options);
}

// ── STAGES ──
const STAGES=[
  {id:'new',label:'New',color:'#3b82f6'},
  {id:'contacted',label:'Contacted',color:'#f59e0b'},
  {id:'qualified',label:'Qualified',color:'#06b6d4'},
  {id:'closed-won',label:'Closed Won',color:'#22c55e'},
  {id:'not-suitable',label:'Not Suitable',color:'#ef4444'},
  {id:'closed-lost',label:'Closed Lost',color:'#6b7280'},
  {id:'uncontactable',label:'Uncontactable',color:'#9ca3af'},
  {id:'not-interested',label:'Not Interested',color:'#a1a1aa'},
  {id:'archived',label:'Archived',color:'#d1d5db'},
];

const OB_STEPS=[
  'Intake form sent to client',
  'Intake form received & reviewed',
  'T&Cs / contract signed (Dropbox Sign)',
  'Meet & greet scheduled (Calendly)',
  'Meet & greet completed',
  'Dog profile added to Time to Pet',
  'First walk scheduled & confirmed',
  'Welcome pack / Bonjoro video sent',
];

// ── DUMMY DATA ──
const DUMMY_ENQ=[
  {id:'e1',name:'Sarah Mitchell',phone:'0412 345 678',email:'sarah.mitchell@gmail.com',channel:'WhatsApp',dogName:'Buddy',dogBreed:'Golden Retriever',services:'Daily group walks',stage:'new',followup:'2026-03-28',notes:'Has a friendly dog, looking for 5 days/week.',dateAdded:'2026-03-27',source:'Meta Ads',suburb:'Fitzroy'},
  {id:'e2',name:'James Thompson',phone:'0423 456 789',email:'james.t@outlook.com',channel:'Instagram',dogName:'Bella',dogBreed:'Labrador',services:'Solo walks, drop-ins',stage:'new',followup:'2026-03-27',notes:'Enquired via Instagram DM. 2yr old lab.',dateAdded:'2026-03-26',source:'Instagram',suburb:'Richmond'},
  {id:'e3',name:'Emma Chen',phone:'0434 567 890',email:'emma.chen@gmail.com',channel:'Facebook',dogName:'Max',dogBreed:'Border Collie',services:'Group walks',stage:'new',followup:'2026-04-01',notes:'Very active dog, needs stimulation.',dateAdded:'2026-03-25',source:'Meta Ads',suburb:'Collingwood'},
  {id:'e4',name:'Michael Torres',phone:'0445 678 901',email:'mtorres@hotmail.com',channel:'Website',dogName:'Luna',dogBreed:'Poodle',services:'Solo walks',stage:'new',followup:'2026-04-02',notes:'Prefers afternoon walks. Luna is well trained.',dateAdded:'2026-03-24',source:'Website',suburb:'South Yarra'},
  {id:'e5',name:'Priya Sharma',phone:'0456 789 012',email:'priya.sharma@gmail.com',channel:'Referral',dogName:'Coco',dogBreed:'Cavoodle',services:'Group walks, puppy visits',stage:'contacted',followup:'2026-04-03',notes:'Referred by Amy Foster. 6-month old puppy.',dateAdded:'2026-03-23',source:'Referral',suburb:'Northcote'},
  {id:'e6',name:'Tom Wilson',phone:'0467 890 123',email:'tom.wilson@gmail.com',channel:'Email',dogName:'Archie',dogBreed:'Staffy',services:'Daily walks',stage:'contacted',followup:'2026-04-04',notes:'Works from home, wants 9am walks Mon-Fri.',dateAdded:'2026-03-22',source:'Google',suburb:'Brunswick'},
  {id:'e7',name:'Rachel Green',phone:'0478 901 234',email:'rachel.g@gmail.com',channel:'Instagram',dogName:'Daisy',dogBreed:'Maltese',services:'Solo walks',stage:'qualified',followup:'2026-04-06',notes:'Sent info pack. Daisy is reactive on lead.',dateAdded:'2026-03-20',source:'Instagram',suburb:'Carlton'},
  {id:'e8',name:'David Kim',phone:'0489 012 345',email:'david.kim@gmail.com',channel:'Facebook',dogName:'Milo',dogBreed:'Beagle',services:'Group walks, drop-ins',stage:'qualified',followup:'2026-04-05',notes:'Meet & greet booked April 5. Very friendly dog.',dateAdded:'2026-03-19',source:'Meta Ads',suburb:'Fitzroy North'},
  {id:'e9',name:'Lisa Park',phone:'0490 123 456',email:'lisa.park@gmail.com',channel:'WhatsApp',dogName:'Charlie',dogBreed:'French Bulldog',services:'Solo walks',stage:'closed-won',followup:'2026-04-07',notes:'Intake form sent. Waiting on T&Cs signature.',dateAdded:'2026-03-10',source:'Referral',suburb:'St Kilda'},
  {id:'e10',name:'Nick Patel',phone:'0401 234 567',email:'nick.patel@gmail.com',channel:'Website',dogName:'Rosie',dogBreed:'Golden Retriever',services:'Group walks',stage:'closed-won',followup:'2026-04-08',notes:'T&Cs signed. Adding to Time to Pet this week.',dateAdded:'2026-03-08',source:'Google',suburb:'Prahran'},
  {id:'e11',name:'Amy Foster',phone:'0412 345 670',email:'amy.foster@gmail.com',channel:'Facebook',dogName:'Biscuit',dogBreed:'Spoodle',services:'Daily walks',stage:'closed-won',followup:null,notes:'Fully onboarded. 5 days/week group walks.',dateAdded:'2026-03-01',source:'Meta Ads',suburb:'Fitzroy'},
  {id:'e12',name:'Marcus Webb',phone:'0423 456 780',email:'marcus.webb@gmail.com',channel:'Referral',dogName:'Zeus',dogBreed:'Rottweiler',services:'Solo walks',stage:'not-suitable',followup:null,notes:'Dog too aggressive for our service.',dateAdded:'2026-03-18',source:'Referral',suburb:'Richmond'},
];

const DUMMY_CLIENTS=[];

let TODAY_WALKS=[];

const EMAILS=[
  {id:'m1',from:'Sarah Mitchell',email:'sarah.mitchell@gmail.com',subject:"Dog walking enquiry for Buddy 🐶",preview:"Hi! I saw your Instagram and would love to find out more...",time:'9:23am',read:false,tag:'enquiry',body:`Hi Chilly's team!\n\nI came across your Instagram and honestly your service looks amazing — Buddy would absolutely love it! 🐶\n\nHe's a 3-year-old Golden Retriever, super friendly and loves other dogs. I'm looking for someone to walk him 5 days a week while I'm at work. We're based in Fitzroy.\n\nCould you let me know your pricing and availability? Happy to arrange a meet and greet whenever suits.\n\nThanks so much!\nSarah 😊`},
  {id:'m2',from:'Emma Chen',email:'emma.chen@gmail.com',subject:"Re: Chilly's Dog Walking - Info Pack",preview:"Thanks so much for sending through all the info! Max and I would love...",time:'8:45am',read:false,tag:'reply',body:`Hi there!\n\nThanks so much for sending through all the info — Max and I would absolutely love to get started! The group walks sound perfect for his energy levels 😄\n\nI've had a look at the pricing and we'd like to go ahead with 5 group walks per week. Is next Monday too soon to start?\n\nAlso is there a form I need to fill in? Happy to get it done today.\n\nEmma & Max 🐾`},
  {id:'m3',from:'Time to Pet',email:'noreply@timetopet.com',subject:'New booking request — Jessica Lee',preview:'A new service request has been submitted by Jessica Lee for...',time:'Yesterday',read:true,tag:'booking',body:`Hi Chilly's,\n\nA new service request has been submitted through your client portal.\n\nClient: Jessica Lee\nPet: Pepper (Cavoodle, 2 years)\nService: Group Walk (1 hour)\nRequested dates: Mon 30 Mar – Fri 3 Apr\nTime preference: 8:30–10:30am\n\nPlease log in to Time to Pet to confirm or decline.\n\n— Time to Pet`},
  {id:'m4',from:'Nick Patel',email:'nick.patel@gmail.com',subject:"T&Cs signed — ready to start! 🎉",preview:"Hi! Just signed the T&Cs and filled out the intake form. So excited to...",time:'Yesterday',read:true,tag:'onboarding',body:`Hi!\n\nJust signed the T&Cs and filled in Rosie's intake form. So excited to get started! 🎉\n\nRosie is a 4-year-old Golden Retriever, no medical issues, up to date on all vaccinations. Her vet is Dr. Kim at Brunswick Vet Clinic.\n\nShe LOVES other dogs so the group walks will be perfect. Looking forward to meeting the team!\n\nNick & Rosie 🐕`},
  {id:'m5',from:'Xero',email:'no-reply@xero.com',subject:'Invoice #INV-0234 paid — $180.00',preview:'Amy Foster has paid invoice #INV-0234 for $180.00...',time:'2 days ago',read:true,tag:'payment',body:`Hi Chilly's,\n\nGreat news — the following invoice has been paid:\n\nInvoice: #INV-0234\nClient: Amy Foster\nAmount: $180.00 AUD\nDate paid: 27 March 2026\nPayment method: Credit card\n\nThis has been recorded in Xero automatically.\n\n— Xero`},
];

const TEMPLATES=[
  {id:'t1',cat:'first',catLabel:'First Response',catClass:'tc-first',name:'First Response',
   body:`Hey {name}!\n\nThanks for reaching out about {dog_name}. I'm Jess from Chilly's.\n\nWe do group walks, solo walks and adventure days across Melbourne's south-east. Happy to chat about what'd suit {dog_name} best.\n\nWhat area are you in and how many days a week were you thinking?\n\nJess`},
  {id:'t2',cat:'info',catLabel:'Info Pack',catClass:'tc-info',name:'Pricing & Info',
   body:`Hey {name}!\n\nHere's a quick rundown:\n\n- Group walk (60 min) — $55\n- Solo walk (45 min) — $60\n- 2hr adventure — $75\n- Home visit (20 min) — $30\n\nWe do a free meet & greet first so {dog_name} can meet us at home. No commitment.\n\nWant me to lock one in?\n\nJess`},
  {id:'t3',cat:'followup',catLabel:'Follow-up',catClass:'tc-followup',name:'Follow-up',
   body:`Hey {name}, just checking in!\n\nStill keen to get {dog_name} out with us? Happy to answer any questions.\n\nNo rush — just didn't want my message to get buried.\n\nJess`},
  {id:'t4',cat:'meet',catLabel:'Meet & Greet',catClass:'tc-meet',name:'Meet & Greet Booked',
   body:`Hey {name}!\n\nLocked in your meet & greet:\n\n[DATE] at [TIME]\n[ADDRESS]\n\nI'll come to you — takes about 20 mins. We'll meet {dog_name}, have a chat and go from there.\n\nSee you then!\n\nJess`},
  {id:'t5',cat:'welcome',catLabel:'Onboarding',catClass:'tc-welcome',name:'Welcome!',
   body:`Hey {name}!\n\nSo good to meet {dog_name} — we're excited to get started!\n\nQuick next steps:\n1. Fill in {dog_name}'s profile: [LINK]\n2. Sign the T&Cs: [LINK]\n3. First walk: [DATE] at [TIME]\n\nYou'll get a login to our app where you can see walk updates, photos and invoices.\n\nAny questions just text me.\n\nJess`},
  {id:'t6',cat:'decline',catLabel:'Decline',catClass:'tc-decline',name:'Not the Right Fit',
   body:`Hey {name},\n\nThanks so much for thinking of us for {dog_name}.\n\nUnfortunately we're not the best fit right now — but I can recommend a few great walkers in your area if you'd like?\n\nAll the best with {dog_name}!\n\nJess`},
  {id:'t7',cat:'followup',catLabel:'Follow-up',catClass:'tc-followup',name:'Second Follow-up',
   body:`Hey {name}!\n\nJust me again. Totally understand if the timing isn't right — just wanted to make sure you got my earlier message about {dog_name}.\n\nIf you ever want to revisit, we're here. No expiry on the offer!\n\nJess`},
  {id:'t8',cat:'first',catLabel:'First Response',catClass:'tc-first',name:'Quick Callback Missed',
   body:`Hey {name}!\n\nSorry I missed you — tried calling just now about {dog_name}.\n\nGive me a buzz back when you're free or just reply here and I'll sort you out.\n\nJess\n0430 921 951`},
];

const INTEGRATIONS=[
  {icon:'📔',name:'Notion',desc:'CRM database — enquiries & clients',status:'connected',bg:'#f3f0ff'},
  {icon:'✉️',name:'Microsoft Outlook',desc:'Email — send templates, view inbox, sync calendar',status:'connected',bg:'#dbeafe'},
  {icon:'📊',name:'Xero',desc:'Accounting — invoices, payments, revenue reports',status:'connected',bg:'#dcfce7'},
  {icon:'🕐',name:'Time to Pet',desc:'Client walks, scheduling, GPS reports (via Zapier)',status:'connected',bg:'#fde8d8'},
  {icon:'📘',name:'Facebook Lead Ads',desc:'Auto-capture new ad leads into pipeline',status:'connected',bg:'#dbeafe'},
  {icon:'📷',name:'Instagram',desc:'DM enquiries captured automatically via Make.com',status:'pending',bg:'#fce7f3'},
  {icon:'📅',name:'Calendly',desc:'Meet & greet auto-booking — link sent in templates',status:'pending',bg:'#f0fdf4'},
  {icon:'📝',name:'Typeform',desc:'Client intake forms — feeds into Notion + Time to Pet',status:'disconnected',bg:'#fff4ed'},
  {icon:'⚡',name:'Make.com',desc:'Automation engine — powers all workflow automations',status:'connected',bg:'#ede9fe'},
  {icon:'✍️',name:'Dropbox Sign',desc:'Digital T&Cs signing',status:'disconnected',bg:'#f0f9ff'},
];

const AUTOMATION_LOG_BASE=[
  {id:'al1',event:'Enquiry added',detail:'Sarah Mitchell → New stage (via WhatsApp)',time:'9:23am today',status:'success',icon:'📥'},
  {id:'al2',event:'Stage changed',detail:'Emma Chen: Info Sent → Meet & Greet',time:'8:45am today',status:'success',icon:'📊'},
  {id:'al3',event:'Template copied',detail:'First Response — used for James Thompson',time:'8:30am today',status:'info',icon:'📋'},
  {id:'al4',event:'Follow-up overdue',detail:'Sarah Mitchell — was due 28 Mar',time:'8:00am today',status:'warning',icon:'⚠️'},
  {id:'al5',event:'Onboarding step updated',detail:'Lisa Park: T&Cs signed (step 3 of 8)',time:'Yesterday 4:12pm',status:'success',icon:'✅'},
  {id:'al6',event:'Stage changed',detail:'Nick Patel: Meet & Greet → Onboarding',time:'Yesterday 2:30pm',status:'success',icon:'📊'},
  {id:'al7',event:'Enquiry added',detail:'Emma Chen → New stage (via Meta Ads)',time:'25 Mar, 11:02am',status:'success',icon:'📥'},
  {id:'al8',event:'Converted to client',detail:'Amy Foster: Onboarding → Converted 🎉',time:'1 Mar, 9:15am',status:'success',icon:'🎉'},
];

// ── STATE ──
let enquiries=[...DUMMY_ENQ];
let clients=[...DUMMY_CLIENTS];
let editingId=null;
let activeEmail=null;
let aiDraftText='';
let currentAiEnqId=null;
let dataLoaded=false;

function load(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}

// Load from localStorage cache first (instant)
const stored=load('cw_enq',null);
if(stored&&stored.length>0)enquiries=stored;
const storedClients=load('cw_clients',null);
if(storedClients&&storedClients.length>0)clients=storedClients;

// Async load from APIs
async function loadFromNotion(){
  try{
    const [enqRes,cliRes]=await Promise.all([
      authFetch('/api/notion/enquiries').then(r=>r.ok?r.json():null).catch(()=>null),
      fetch('/api/walks/clients').then(r=>r.ok?r.json():null).catch(()=>null),
    ]);
    if(enqRes&&enqRes.length>0){
      enquiries=enqRes;
      save('cw_enq',enquiries);
    }
    if(cliRes&&cliRes.length>0){
      clients=cliRes;
      save('cw_clients',clients);
    }
    dataLoaded=true;
    renderDashboard();
    // Re-render clients page if user is already viewing it
    if(document.getElementById('view-clients')?.classList.contains('active'))renderClients();
    logEvent('Data sync','Loaded '+enquiries.length+' enquiries, '+clients.length+' clients from TTP','success','📔');
  }catch(e){
    console.warn('Notion sync failed, using cached data:',e.message);
  }
}
// Data load is triggered after Clerk auth completes (see initClerk)
// Fallback: if Clerk fails, load anyway after 3 seconds
setTimeout(()=>{if(!dataLoaded) loadFromNotion();},3000);
// Load TTP pricing data (non-blocking)
loadTTPPricing();

// ── UTILS ──
function today(){return new Date().toISOString().slice(0,10)}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmtDate(d){if(!d)return '';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-AU',{day:'numeric',month:'short'})}
function fuStatus(d){if(!d)return null;if(d<today())return 'overdue';if(d===today())return 'today';return 'upcoming'}

function showToast(msg,emoji='✅'){
  const el=document.getElementById('toast');
  el.innerHTML=`<span>${emoji}</span> ${msg}`;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),2400);
}

function logEvent(event,detail,status='success',icon='📊'){
  const log=load('cw_log',[]);
  const now=new Date();
  const t=now.toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',hour12:true});
  log.unshift({id:'l'+Date.now(),event,detail,time:t+' today',status,icon});
  save('cw_log',log.slice(0,30));
}

// ── WEBHOOKS ──
function fireWebhook(type,payload){
  const url=getWebhookUrl('wh-'+type);
  if(!url) return;
  fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({event:type,timestamp:new Date().toISOString(),...payload})
  })
  .then(r=>{if(r.ok) logEvent('Webhook fired',type+' → Make.com','success','⚡');})
  .catch(()=>logEvent('Webhook failed',type,'warning','⚠️'));
}

// ── EMAIL ──
function composeEmail(to,subject,body){
  const mailto=`mailto:${encodeURIComponent(to||'')}?subject=${encodeURIComponent(subject||'')}&body=${encodeURIComponent(body||'')}`;
  window.open(mailto,'_blank');
  logEvent('Email composed','To: '+(to||'(blank)')+' — '+(subject||'(no subject)'),'info','✉️');
  showToast('Opening mail client...','✉️');
}
function sendEmailWebhook(to,subject,body){
  const url=getWebhookUrl('wh-send-email');
  if(!url){composeEmail(to,subject,body);return;}
  fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({to,subject,body,timestamp:new Date().toISOString()})
  })
  .then(r=>{if(r.ok){showToast('Email sent via Make.com!','✉️');logEvent('Email sent','To: '+to,'success','✉️');}else{composeEmail(to,subject,body);}})
  .catch(()=>composeEmail(to,subject,body));
}

// ── FIT SCORE ──
function calcFitScore(e){
  let s=0;
  const src={Referral:5,'Meta Ads':3,WhatsApp:3,Instagram:3,Facebook:2,Website:2,Email:1,Google:1,Other:1};
  s+=src[e.source]||src[e.channel]||1;
  const svc=(e.services||'').toLowerCase();
  if(/daily|5 day/i.test(svc))s+=3;
  else if(/solo|private/i.test(svc))s+=2;
  else if(/group/i.test(svc))s+=2;
  else s+=1;
  if(e.followup)s+=1;
  if(e.followup&&fuStatus(e.followup)!=='overdue')s+=1;
  const sb={new:0,contacted:1,qualified:2,'closed-won':3};
  s+=sb[e.stage]||0;
  const norm=Math.min(10,Math.max(1,Math.round((s/13)*10)));
  let label,cls;
  if(norm>=8){label='Hot';cls='fit-hot';}
  else if(norm>=6){label='Good';cls='fit-good';}
  else if(norm>=4){label='Medium';cls='fit-medium';}
  else{label='Low';cls='fit-low';}
  return{score:norm,label,cls};
}

// ── NEXT ACTIONS ──
function getEnqNextAction(e){
  if(['closed-won','not-suitable'].includes(e.stage))return null;
  const fu=fuStatus(e.followup);
  if(e.stage==='new'&&!e.followup)return{icon:'📅',text:'Set a follow-up date'};
  if(e.stage==='new'&&fu==='overdue')return{icon:'⚠️',text:'Follow up now — overdue!'};
  if(e.stage==='new'&&fu==='today')return{icon:'📞',text:'Call or message today'};
  if(e.stage==='new')return{icon:'💬',text:'Send first reply'};
  if(e.stage==='contacted')return{icon:'📄',text:'Send info pack'};
  if(e.stage==='qualified')return{icon:'📋',text:'Follow up to close'};
  return null;
}

function getClientNextAction(c){
  if(c.health==='win-back')return{icon:'💌',text:'Send reactivation offer'};
  if(c.health==='at-risk')return{icon:'💬',text:'Check in this week'};
  if(c.tags&&c.tags.includes('review-due'))return{icon:'⭐',text:'Schedule review call'};
  return null;
}

function getObNextAction(e){
  const checks=load('cw_ob_'+e.id,new Array(OB_STEPS.length).fill(false));
  const nextIdx=checks.findIndex(c=>!c);
  if(nextIdx===-1)return{icon:'🎉',text:'All done — ready to convert!'};
  return{icon:'▶️',text:'Next: '+OB_STEPS[nextIdx].split('(')[0].trim()};
}

// ── NAV ──
const VIEW_TITLES={
  dashboard:'Dashboard',enquiries:'Enquiry Pipeline',
  clients:'Clients',walks:'Walk Schedule',inbox:'Inbox',routes:'Profitability & Growth',coverage:'Coverage Map',parks:'Off-Leash Parks',templates:'Message Templates',
  reports:'Reports & KPIs',settings:'Settings',
};

function navigate(v){
  document.body.classList.remove('sidebar-open');// Close mobile sidebar
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v)?.classList.add('active');
  document.querySelector(`.nav-item[data-view="${v}"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent=VIEW_TITLES[v];
  const actions={
    enquiries:`<button class="btn btn-ghost btn-sm" onclick="openAiDraftNew()">🤖 AI Draft</button><button class="btn btn-primary btn-sm" onclick="openAddEnquiry()">+ Add Enquiry</button>`,
    templates:`<button class="btn btn-ghost btn-sm" onclick="openAiDraftNew()">🤖 AI Draft Reply</button>`,
    reports:`<button class="btn btn-secondary btn-sm" onclick="window.print()">📥 Export PDF</button>`,
    coverage:`<button class="btn btn-ghost btn-sm" onclick="covDataLoaded=false;covClientLocations=[];renderCoverage();showToast('Map data reloaded','🗑️')">🔄 Reload Map</button>`,
  };
  document.getElementById('topbar-actions').innerHTML=actions[v]||'<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-light)"><span class="int-live-dot"></span> Live sync</div>';
  if(v==='dashboard')renderDashboard();
  if(v==='enquiries')renderPipeline();
  if(v==='clients')renderClients();
  if(v==='walks')renderWalks();
  if(v==='routes')renderRoutes();
  if(v==='inbox')renderInbox();
  if(v==='coverage')renderCoverage();
  if(v==='routeplanner')renderRoutePlanner();
  if(v==='parks')renderParksPage();
  if(v==='templates')renderTemplates();
  if(v==='reports')renderReports();
  if(v==='settings')renderSettings();
  updateBadges();
}

document.querySelectorAll('.nav-item[data-view]').forEach(el=>{
  el.addEventListener('click',()=>navigate(el.dataset.view));
});

function updateBadges(){
  const n=enquiries.filter(e=>e.stage==='new').length;
  const be=document.getElementById('badge-enq');
  be.textContent=n;be.style.display=n>0?'inline-block':'none';
}

// ── CHART ──
function buildChart(containerId,labelId,data,h=110){
  const max=Math.max(...data.map(d=>d.val))*1.1;
  const min=Math.min(...data.map(d=>d.val))*.85;
  const W=600,H=h,n=data.length;
  const pts=data.map((d,i)=>{
    const x=i*(W/(n-1));
    const y=H-((d.val-min)/(max-min))*H;
    return[x,y];
  });
  const pathD=pts.map((p,i)=>i===0?`M${p[0]},${p[1]}`:`C${pts[i-1][0]+40},${pts[i-1][1]} ${p[0]-40},${p[1]} ${p[0]},${p[1]}`).join(' ');
  const areaD=pathD+` L${pts[n-1][0]},${H} L0,${H} Z`;
  const uid='g'+Math.random().toString(36).slice(2,7);
  document.getElementById(containerId).innerHTML=`<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="none" style="height:${H}px">
    <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F26B21" stop-opacity=".18"/><stop offset="100%" stop-color="#F26B21" stop-opacity="0"/></linearGradient></defs>
    <path d="${areaD}" fill="url(#${uid})"/>
    <path d="${pathD}" fill="none" stroke="#F26B21" stroke-width="2.5" stroke-linecap="round"/>
    ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#F26B21" stroke="#fff" stroke-width="2"/><text x="${p[0]}" y="${p[1]-10}" text-anchor="middle" font-size="11" fill="#6b6b6b" font-family="Inter">$${(data[i].val/1000).toFixed(1)}k</text>`).join('')}
  </svg>`;
  document.getElementById(labelId).innerHTML=data.map(d=>`<span>${d.month}</span>`).join('');
}

// ── SHARED: Build shifts from walk data (used by Dashboard + Profitability) ──
function buildShiftsFromWalks(walks,settings){
  // Only group by known walkers — ICS sometimes puts dog names in walker field
  const KNOWN_WALKERS=['Jessica Lauritz','Alex Cass'];
  const isKnownWalker=name=>KNOWN_WALKERS.some(k=>name.toLowerCase().includes(k.split(' ')[0].toLowerCase()));

  const walkerGroups={};
  walks.forEach(w=>{
    let walker=w.walker||'Unknown';
    // If walker is not a known walker (likely a dog name), reassign to a known walker on same date
    if(!isKnownWalker(walker)){
      // Find a known walker who has walks on the same date
      const knownOnDate=walks.find(x=>x.date===w.date&&x.walker&&isKnownWalker(x.walker));
      walker=knownOnDate?knownOnDate.walker:KNOWN_WALKERS[0];
    }
    const key=walker+'_'+w.date;
    if(!walkerGroups[key]) walkerGroups[key]={walks:[],walker,date:w.date};
    walkerGroups[key].walks.push(w);
  });
  return Object.values(walkerGroups).map(g=>{
    const sorted=g.walks.sort((a,b)=>(a.start||'').localeCompare(b.start||''));
    const firstStart=sorted[0]?.time||'';
    const lastEnd=sorted[sorted.length-1]?.endTime||'';
    const slots=[];
    sorted.forEach(w=>{
      const ws=new Date(w.start).getTime();
      const we=new Date(w.end).getTime();
      const existing=slots.find(sl=>ws<sl.end&&we>sl.start);
      if(existing){existing.dogs.push(w);existing.start=Math.min(existing.start,ws);existing.end=Math.max(existing.end,we)}
      else slots.push({start:ws,end:we,dogs:[w]});
    });
    const actualServiceMins=slots.reduce((s,sl)=>s+((sl.end-sl.start)/60000),0);
    const groupSlots=slots.filter(sl=>sl.dogs.length>1);
    const soloSlots=slots.filter(sl=>sl.dogs.length===1);
    const maxGroupSize=Math.max(0,...slots.map(sl=>sl.dogs.length));
    const bookings=g.walks.map(w=>{
      const slot=slots.find(sl=>sl.dogs.includes(w));
      const isGroup=slot&&slot.dogs.length>1;
      let price=getClientPrice(w.client,w.service);
      return {dogName:w.client,client:w.client,suburb:'',serviceType:w.service,price,
        durationMins:w.start&&w.end?Math.round((new Date(w.end)-new Date(w.start))/60000):45,
        groupSuitable:isGroup,_slotDogs:slot?slot.dogs.length:1};
    });
    const estimatedTravelBetweenSlots=Math.max(0,(slots.length-1)*10);
    const totalShiftMins=actualServiceMins+estimatedTravelBetweenSlots;
    const estimatedKm=slots.length*5;
    const wConfig=getWalkerConfig(g.walker);
    const wType=wConfig?.type||'founder';
    const wRate=wConfig?.rate||0;
    const shift={
      id:'ttp_'+g.walker.replace(/\s+/g,'_')+'_'+g.date,
      date:g.date,walker:g.walker,walkerType:wType,
      startTime:parseAmPmTo24(firstStart),endTime:parseAmPmTo24(lastEnd),
      breakMins:0,maxDogs:settings.maxDogsPerShift,hourlyRate:wRate,
      travelDistanceKm:estimatedKm,travelMins:estimatedTravelBetweenSlots,
      variableCost:0,paymentFee:0,adminAlloc:0,
      bookings,source:'ttp-auto',
      _actualServiceMins:actualServiceMins,_overrideShiftMins:totalShiftMins,
    };
    const metrics=calcShiftMetrics(shift,settings);
    return {shift,metrics,walkCount:g.walks.length,slots:slots.length,groupSlots:groupSlots.length,soloSlots:soloSlots.length,maxGroupSize,actualServiceMins};
  });
}

// Shared revenue cache — keeps dashboard + profitability in sync
let _weeklyRevenueCache={revenue:0,profit:0,margin:0,walks:0};

// ── DASHBOARD ──
async function renderDashboard(){
  // Fetch today's walks for real data
  const todayWalksData=await fetch('/api/walks/today?range=today').then(r=>r.ok?r.json():[]).catch(()=>[]);
  if(todayWalksData.length) TODAY_WALKS=todayWalksData;

  // Fetch this week's walks for weekly stats
  const weekWalks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const nowLocal=new Date();
  const todayStr=`${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}-${String(nowLocal.getDate()).padStart(2,'0')}`;
  // This week (Mon-Sun)
  const dow=nowLocal.getDay()||7;
  const monDate=new Date(nowLocal);monDate.setDate(nowLocal.getDate()-(dow-1));
  const monStr=`${monDate.getFullYear()}-${String(monDate.getMonth()+1).padStart(2,'0')}-${String(monDate.getDate()).padStart(2,'0')}`;
  const sunDate=new Date(monDate);sunDate.setDate(monDate.getDate()+6);
  const sunStr=`${sunDate.getFullYear()}-${String(sunDate.getMonth()+1).padStart(2,'0')}-${String(sunDate.getDate()).padStart(2,'0')}`;
  const thisWeekWalks=weekWalks.filter(w=>w.date>=monStr&&w.date<=sunStr);

  // Calculate real stats
  const activeLeads=enquiries.filter(e=>['new','contacted','qualified'].includes(e.stage)).length;
  const activeClients=clients.filter(c=>c.status==='active').length;
  const todayWalkCount=TODAY_WALKS.length;
  const weekWalkCount=thisWeekWalks.length;

  // Estimated weekly revenue + profit (using same engine as Profitability page)
  const settings=getRouteSettings();
  const weekShifts=buildShiftsFromWalks(thisWeekWalks,settings);
  const weekRev=weekShifts.reduce((s,sh)=>s+sh.metrics.totalRevenue,0);
  const weekProfit=weekShifts.reduce((s,sh)=>s+sh.metrics.grossProfit,0);
  const weekMargin=weekRev>0?(weekProfit/weekRev)*100:0;
  _weeklyRevenueCache={revenue:weekRev,profit:weekProfit,margin:weekMargin,walks:weekWalkCount};

  // Follow-ups
  const due=enquiries.filter(e=>{const s=fuStatus(e.followup);return s==='overdue'||s==='today';}).sort((a,b)=>(a.followup||'').localeCompare(b.followup||''));
  const overdue=due.filter(e=>fuStatus(e.followup)==='overdue').length;

  // Clients needing attention (booked < 7 days ahead)
  const needsAttention=clients.filter(c=>c.status==='active'&&c.daysAhead>0&&c.daysAhead<=7).length;
  const noUpcoming=clients.filter(c=>c.status==='no-upcoming').length;
  const unpricedClients=clients.filter(c=>c.name&&!isClientPriced(c.name.replace(/\\+$/g,'').trim())).length;

  // KPI Stats
  document.getElementById('dash-stats').innerHTML=`
    <div class="stat-card orange" onclick="navigate('enquiries')" style="cursor:pointer">
      <div class="stat-icon">📥</div><div class="stat-label">Active Leads</div>
      <div class="stat-value">${activeLeads}</div>
      <div class="stat-sub">${overdue>0?`<span class="trend-down" style="color:var(--danger)">⚠️ ${overdue} overdue follow-ups</span>`:'All followed up ✅'}</div>
    </div>
    <div class="stat-card green" onclick="navigate('clients')" style="cursor:pointer">
      <div class="stat-icon">🐕</div><div class="stat-label">Active Clients</div>
      <div class="stat-value">${activeClients}</div>
      <div class="stat-sub">${needsAttention>0?`<span style="color:var(--warning)">${needsAttention} need rebooking</span>`:noUpcoming>0?`<span style="color:var(--danger)">${noUpcoming} no upcoming walks</span>`:'All booked ✅'}</div>
    </div>
    <div class="stat-card blue" onclick="navigate('walks')" style="cursor:pointer">
      <div class="stat-icon">🦮</div><div class="stat-label">Walks This Week</div>
      <div class="stat-value">${weekWalkCount}</div>
      <div class="stat-sub">${todayWalkCount} today</div>
    </div>
    <div class="stat-card purple" onclick="navigate('routes')" style="cursor:pointer">
      <div class="stat-icon">💰</div><div class="stat-label">Est. Weekly Revenue</div>
      <div class="stat-value">$${weekRev.toFixed(0)}</div>
      <div class="stat-sub">${unpricedClients>0?`<span style="color:var(--warning)">${unpricedClients} clients need pricing</span>`:`<span style="color:${weekProfit>=0?'var(--success)':'var(--danger)'}">$${weekProfit.toFixed(0)} profit</span> · ${weekMargin.toFixed(0)}% margin`}</div>
    </div>
  `;

  // Today's Walks
  const walksBadge=document.getElementById('dash-walks-badge');
  if(walksBadge) walksBadge.textContent=todayWalkCount+' walks';
  const walksEl=document.getElementById('dash-walks');
  if(todayWalkCount){
    walksEl.innerHTML=TODAY_WALKS.map(w=>`
      <div class="walk-item">
        <div class="walk-time">${w.time||''}</div>
        <div class="walk-info"><div class="walk-dogs">🐕 ${esc(w.client||w.dogs||'')}</div><div class="walk-type">${esc(w.service||w.type||'')}</div></div>
        <div class="walk-walker">${esc(w.walker||'')}</div>
        <div class="walk-status ws-${w.status}">${w.status==='completed'?'Done':w.status==='inprogress'?'On Walk':'Upcoming'}</div>
      </div>`).join('');
  }else{
    walksEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-xlight);font-size:13px">No walks scheduled today</div>';
  }

  // Follow-ups
  const fuBadge=document.getElementById('fu-badge-count');
  const lastFuCheck=load('cw_fu_last_check','');
  if(lastFuCheck!==today()&&overdue>0){
    due.filter(e=>fuStatus(e.followup)==='overdue').forEach(e=>fireWebhook('followup-overdue',{name:e.name,email:e.email,dogName:e.dogName,followup:e.followup,stage:e.stage}));
    save('cw_fu_last_check',today());
  }
  fuBadge.textContent=overdue>0?overdue+' overdue':due.length?due.length+' today':'All clear';
  fuBadge.style.background=overdue>0?'var(--danger-bg)':due.length?'var(--warning-bg)':'var(--success-bg)';
  fuBadge.style.color=overdue>0?'var(--danger)':due.length?'var(--warning)':'var(--success)';

  const fuEl=document.getElementById('dash-followups');
  if(!due.length){fuEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-xlight);font-size:13px">🎉 All caught up!</div>';}
  else fuEl.innerHTML=due.map(e=>{
    const s=fuStatus(e.followup);
    return `<div class="followup-item" onclick="navigate('enquiries')">
      <div class="fu-dot ${s}"></div>
      <div style="flex:1"><div class="followup-name">${esc(e.name)}</div><div class="followup-detail">${STAGES.find(st=>st.id===e.stage)?.label||''} · ${esc(e.source||'')}</div></div>
      <div class="followup-date ${s}">${s==='overdue'?'⚠️ ':'📅 '}${fmtDate(e.followup)}</div>
    </div>`;
  }).join('');

  // Pipeline
  const pipelineEl=document.getElementById('dash-pipeline');
  const pipelineCount=document.getElementById('dash-pipeline-count');
  const totalActive=enquiries.filter(e=>!['closed-won','not-suitable','closed-lost','archived','uncontactable','not-interested'].includes(e.stage)).length;
  if(pipelineCount) pipelineCount.textContent=totalActive+' active leads';
  const totalForBar=totalActive||1;
  pipelineEl.innerHTML=STAGES.filter(s=>!['closed-won','not-suitable','closed-lost','archived','uncontactable','not-interested'].includes(s.id)).map(s=>{
    const c=enquiries.filter(e=>e.stage===s.id).length;
    if(!c) return '';
    return `<div class="pm-row">
      <div class="pm-dot" style="background:${s.color}"></div>
      <div class="pm-label">${s.label}</div>
      <div class="pm-bar-wrap"><div class="pm-bar" style="width:${(c/totalForBar)*100}%;background:${s.color}"></div></div>
      <div class="pm-count">${c}</div>
    </div>`;
  }).join('');

  acTab('urgent');
}

// ── XERO FETCH ──
async function fetchXeroData(){
  const url=getWebhookUrl('wh-xero');
  if(!url){
    const cache=load('cw_xero_cache',null);
    if(cache){
      document.getElementById('xero-paid').textContent=cache.paid;
      document.getElementById('xero-outstanding').textContent=cache.outstanding;
      document.getElementById('xero-overdue').textContent=cache.overdue;
      document.getElementById('xero-expenses').textContent=cache.expenses;
    }
    return;
  }
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const data=await res.json();
    if(data.paid) document.getElementById('xero-paid').textContent=data.paid;
    if(data.outstanding) document.getElementById('xero-outstanding').textContent=data.outstanding;
    if(data.overdue) document.getElementById('xero-overdue').textContent=data.overdue;
    if(data.expenses) document.getElementById('xero-expenses').textContent=data.expenses;
    save('cw_xero_cache',data);
  }catch(e){/* silent fail — keep showing current values */}
}

// ── FETCH TODAY'S WALKS (Google Calendar via Make.com) ──
async function fetchTodaysWalks(){
  try{
    const res=await fetch('/api/walks/today?range=today');
    if(!res.ok) return;
    const walks=await res.json();
    if(walks.length>0){
      TODAY_WALKS=walks;
      renderWalksList();
      const wb=document.querySelector('#dash-walks')?.closest('.card')?.querySelector('.badge');
      if(wb) wb.textContent=walks.length+' walks';
    }
  }catch(e){/* silent fail — keep showing current data */}
}
function renderWalksList(){
  const el=document.getElementById('dash-walks');
  if(!el) return;
  if(TODAY_WALKS.length&&TODAY_WALKS[0].client){
    // Real walk data from API
    el.innerHTML=TODAY_WALKS.map(w=>`
      <div class="walk-item">
        <div class="walk-time">${w.time}</div>
        <div class="walk-info"><div class="walk-dogs">🐕 ${esc(w.client)}</div><div class="walk-type">${esc(w.service)}</div></div>
        <div class="walk-walker">${esc(w.walker||'')}</div>
        <div class="walk-status ws-${w.status}">${w.status==='completed'?'Done':w.status==='inprogress'?'On Walk':'Upcoming'}</div>
      </div>`).join('');
  }else{
    // Fallback dummy data format
    el.innerHTML=TODAY_WALKS.map(w=>`
      <div class="walk-item">
        <div class="walk-time">${w.time}</div>
        <div class="walk-info"><div class="walk-dogs">🐕 ${w.dogs||''}</div><div class="walk-type">${w.type||''}</div></div>
        <div class="walk-walker">${w.walker||''}</div>
        <div class="walk-status ws-${w.status}">${w.status==='completed'?'Done':w.status==='inprogress'?'On Walk':'Upcoming'}</div>
      </div>`).join('');
  }
}

// ── FETCH NEW LEADS (FB/Instagram) ──
let lastLeadFetch=0;
async function fetchNewLeads(){
  const url=getWebhookUrl('wh-fetch-leads');
  if(!url) return;
  if(Date.now()-lastLeadFetch<300000) return; // max once per 5 min
  lastLeadFetch=Date.now();
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lastFetch:load('cw_leads_last','')})});
    const data=await res.json();
    const leads=Array.isArray(data)?data:(data.leads||[]);
    if(!leads.length) return;
    let added=0;
    leads.forEach(lead=>{
      const exists=enquiries.some(e=>e.email===lead.email||e.phone===lead.phone||(e.name===lead.name&&e.dogName===lead.dogName));
      if(exists) return;
      enquiries.push({
        id:'e'+Date.now()+Math.random().toString(36).slice(2,6),
        name:lead.name||'',phone:lead.phone||'',email:lead.email||'',
        channel:lead.channel||lead.source||'Facebook',
        dogName:lead.dogName||lead.dog_name||'',dogBreed:lead.dogBreed||lead.dog_breed||'',
        services:lead.services||'',stage:'new',followup:null,
        notes:lead.notes||lead.message||'',suburb:lead.suburb||'',
        source:lead.source||'Meta Ads',dateAdded:today()
      });
      added++;
    });
    if(added>0){
      save('cw_enq',enquiries);
      save('cw_leads_last',new Date().toISOString());
      showToast(`${added} new lead${added>1?'s':''} imported!`,'📥');
      logEvent('Leads imported',`${added} new lead${added>1?'s':''} from Facebook/Instagram`,'success','📥');
      renderPipeline();updateBadges();
    }
  }catch(e){/* silent fail */}
}

// ── ACTION CENTRE ──
function acTab(tab){
  document.querySelectorAll('.ac-tab').forEach(t=>t.classList.toggle('active',t.dataset.ac===tab));
  document.querySelectorAll('.ac-panel').forEach(p=>p.classList.toggle('active',p.id==='ac-'+tab));
  renderAcPanel(tab);
}

function renderAcPanel(tab){
  const el=document.getElementById('ac-'+tab);
  if(!el)return;
  let items=[];

  if(tab==='urgent'){
    enquiries.filter(e=>fuStatus(e.followup)==='overdue').forEach(e=>{
      items.push({cls:'urgent',icon:'⚠️',title:`Follow up ${esc(e.name)}`,sub:`${esc(e.dogName)} · ${STAGES.find(s=>s.id===e.stage)?.label} · Overdue since ${fmtDate(e.followup)}`,cta:'Open enquiry',fn:`openEditEnquiry('${e.id}')`});
    });
    enquiries.filter(e=>e.stage==='qualified').forEach(e=>{
      const days=Math.floor((new Date()-new Date(e.dateAdded+'T00:00:00'))/(864e5));
      if(days>=14)items.push({cls:'urgent',icon:'🔄',title:`Stalled lead: ${esc(e.name)}`,sub:`${days} days as qualified — follow up to close`,cta:'Open enquiry',fn:`openEditEnquiry('${e.id}')`});
    });
    clients.filter(c=>c.health==='win-back').forEach(c=>{
      items.push({cls:'urgent',icon:'💔',title:`Re-engage ${esc(c.owner)}`,sub:`${esc(c.dog)} hasn't walked recently — send reactivation message`,cta:'Email client',fn:`composeEmail('${c.email||''}','We miss ${esc(c.dog)}!','Hi ${esc(c.owner)},\\n\\nWe noticed ${esc(c.dog)} hasn\\'t been on a walk recently. We\\'d love to have them back!\\n\\nBest,\\n${getSetting("s-your-name","Chilly")}')`});
    });
    if(!items.length)el.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-xlight);font-size:13px">🎉 Nothing urgent right now — great work!</div>';
    else el.innerHTML=items.map(renderAcItem).join('');
  }

  if(tab==='today'){
    enquiries.filter(e=>fuStatus(e.followup)==='today').forEach(e=>{
      items.push({cls:'warn',icon:'📅',title:`Follow up today: ${esc(e.name)}`,sub:`${esc(e.dogName)} · ${STAGES.find(s=>s.id===e.stage)?.label}`,cta:'Open',fn:`openEditEnquiry('${e.id}')`});
    });
    TODAY_WALKS.filter(w=>w.status==='upcoming').forEach(w=>{
      items.push({cls:'',icon:'🦮',title:`Walk at ${w.time}: ${w.dogs}`,sub:`${w.type} · Walker: ${w.walker}`,cta:'View clients',fn:`navigate('clients')`});
    });
    if(!items.length)el.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-xlight);font-size:13px">✅ Nothing else on for today!</div>';
    else el.innerHTML=items.map(renderAcItem).join('');
  }

  if(tab==='opportunities'){
    enquiries.filter(e=>e.stage==='new'&&e.source==='Referral').forEach(e=>{
      items.push({cls:'',icon:'⭐',title:`Referral lead: ${esc(e.name)}`,sub:`${esc(e.dogName)} · Referrals convert at 2× the rate — contact now`,cta:'Contact now',fn:`openEditEnquiry('${e.id}')`});
    });
    clients.filter(c=>c.health==='at-risk').forEach(c=>{
      items.push({cls:'warn',icon:'📉',title:`At risk: ${esc(c.owner)}`,sub:`${esc(c.dog)}'s walk frequency has dropped — check in this week`,cta:'Send message',fn:`composeEmail('${c.email||''}','Checking in — ${esc(c.dog)}','Hi ${esc(c.owner)},\\n\\nJust checking in — we noticed ${esc(c.dog)}\\'s walk schedule has dropped off. Everything okay?\\n\\nBest,\\n${getSetting("s-your-name","Chilly")}')`});
    });
    enquiries.filter(e=>e.stage==='new').forEach(e=>{
      const fit=calcFitScore(e);
      if(fit.score>=8)items.push({cls:'',icon:'🔥',title:`Hot lead: ${esc(e.name)}`,sub:`${esc(e.dogName)} · Fit score ${fit.score}/10 — don't let this one cool`,cta:'Follow up',fn:`openEditEnquiry('${e.id}')`});
    });
    if(!items.length)el.innerHTML='<div style="text-align:center;padding:24px;color:var(--ink-xlight);font-size:13px">👀 Check back later for opportunities.</div>';
    else el.innerHTML=items.map(renderAcItem).join('');
  }
}

function renderAcItem(item){
  return `<div class="ac-item ${item.cls}" onclick="${item.fn}">
    <div class="ac-icon">${item.icon}</div>
    <div class="ac-content"><div class="ac-title">${item.title}</div><div class="ac-sub">${item.sub}</div></div>
    <div class="ac-cta">${item.cta} →</div>
  </div>`;
}

// ── PIPELINE ──
let pipelineFilter='all';
let pipelineViewMode='cards';
let showClosedStages=false;
const CLOSED_STAGES=['closed-won','not-suitable','closed-lost','uncontactable','not-interested','archived'];
const ACTIVE_STAGES=STAGES.filter(s=>!CLOSED_STAGES.includes(s.id));

function getFilteredEnquiries(){
  const search=(document.getElementById('enq-search')?.value||'').toLowerCase().trim();
  let list=enquiries;
  if(search){
    list=list.filter(e=>(e.name||'').toLowerCase().includes(search)||(e.suburb||'').toLowerCase().includes(search)||(e.source||'').toLowerCase().includes(search)||(e.dogName||'').toLowerCase().includes(search)||(e.email||'').toLowerCase().includes(search)||(e.phone||'').toLowerCase().includes(search));
  }
  // Sort newest first
  return [...list].sort((a,b)=>(b.dateAdded||'').localeCompare(a.dateAdded||''));
}

function daysAgo(dateStr){
  if(!dateStr)return '';
  const diff=Math.floor((new Date()-new Date(dateStr+'T00:00:00'))/864e5);
  if(diff===0)return 'Today';
  if(diff===1)return '1d ago';
  if(diff<7)return diff+'d ago';
  if(diff<30)return Math.floor(diff/7)+'w ago';
  return Math.floor(diff/30)+'mo ago';
}

function renderPipeline(){
  const filtered=getFilteredEnquiries();
  // Build filter pills
  const filtersEl=document.getElementById('pipeline-filters');
  if(filtersEl){
    const activeCount=filtered.filter(e=>!CLOSED_STAGES.includes(e.stage)).length;
    const closedCount=filtered.filter(e=>CLOSED_STAGES.includes(e.stage)).length;
    const counts={all:activeCount};
    const visibleStages=showClosedStages?STAGES:ACTIVE_STAGES;
    visibleStages.forEach(s=>{counts[s.id]=filtered.filter(e=>e.stage===s.id).length;});
    filtersEl.innerHTML=`<div class="filter-pill${pipelineFilter==='all'?' active':''}" onclick="setPipelineFilter('all')">Active <strong>${activeCount}</strong></div>`+
      visibleStages.filter(s=>counts[s.id]>0).map(s=>
        `<div class="filter-pill${pipelineFilter===s.id?' active':''}" style="cursor:pointer" onclick="setPipelineFilter('${s.id}')">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.color};margin-right:4px"></span>${s.label} <strong>${counts[s.id]}</strong>
        </div>`
      ).join('')+
      `<button class="show-closed-toggle" onclick="showClosedStages=!showClosedStages;if(!showClosedStages&&CLOSED_STAGES.includes(pipelineFilter))pipelineFilter='all';renderPipeline()">${showClosedStages?'Hide closed ▲':'Closed '+closedCount+' ▼'}</button>`;
  }
  // Update view toggle buttons
  document.querySelectorAll('.vt-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`.vt-btn[onclick*="${pipelineViewMode}"]`)?.classList.add('active');

  const board=document.getElementById('kanban-board');

  if(pipelineViewMode==='list'){
    board.className='kanban-grid';
    const stagesToShow=pipelineFilter==='all'?(showClosedStages?STAGES:ACTIVE_STAGES):STAGES.filter(s=>s.id===pipelineFilter);
    const rows=stagesToShow.flatMap(s=>filtered.filter(e=>e.stage===s.id));
    board.innerHTML=rows.length?`<table class="enq-list-table">
      <thead><tr><th>Name</th><th>Dog</th><th>Suburb</th><th>Stage</th><th>Added</th><th></th><th>Follow-up</th></tr></thead>
      <tbody>${rows.map(e=>{
        const s=STAGES.find(s=>s.id===e.stage);
        const fs=fuStatus(e.followup);
        const da=daysAgo(e.dateAdded);
        return `<tr onclick="openEditEnquiry('${e.id}')">
          <td><strong>${esc(e.name)}</strong>${e.phone?`<div style="font-size:11px;color:var(--ink-light)">${esc(e.phone)}</div>`:''}</td>
          <td>${esc(e.dogName||'—')}</td>
          <td>${esc(e.suburb||'—')}</td>
          <td><span class="enq-list-stage" style="background:${s?.color||'#999'}">${s?.label||e.stage}</span></td>
          <td style="font-weight:600">${e.dateAdded?fmtDate(e.dateAdded):'—'}</td>
          <td style="font-size:11px;color:var(--ink-muted)">${da}</td>
          <td>${fs?`<span style="color:${fs==='overdue'?'var(--danger)':fs==='today'?'var(--warning)':'var(--ink-light)'}; font-weight:${fs==='overdue'?'700':'500'}">${fs==='overdue'?'⚠️ ':''}${e.followup?fmtDate(e.followup):fs}</span>`:'—'}</td>
        </tr>`}).join('')}</tbody></table>`
      :'<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No enquiries found</div>';
    return;
  }

  // Card view
  const singleStage=pipelineFilter!=='all';
  board.className=singleStage?'kanban-grid':'kanban';
  if(singleStage){
    const s=STAGES.find(s=>s.id===pipelineFilter);
    const cards=filtered.filter(e=>e.stage===pipelineFilter);
    board.innerHTML=`<div class="k-col-head" style="margin-bottom:12px">
        <div class="k-stage-dot" style="background:${s.color}"></div>
        <div class="k-stage-title">${s.label}</div>
        <div class="k-count">${cards.length}</div>
      </div>
      <div class="k-grid">${cards.length?cards.map(renderEnqCard).join(''):'<div class="k-empty">No enquiries</div>'}</div>`;
  }else{
    const stagesToShow=showClosedStages?STAGES:ACTIVE_STAGES;
    const MAX_VISIBLE=5;
    board.innerHTML=stagesToShow.map(s=>{
      const cards=filtered.filter(e=>e.stage===s.id);
      const visible=cards.slice(0,MAX_VISIBLE);
      const hidden=cards.length-MAX_VISIBLE;
      return `<div class="k-col">
        <div class="k-col-head">
          <div class="k-stage-dot" style="background:${s.color}"></div>
          <div class="k-stage-title">${s.label}</div>
          <div class="k-count">${cards.length}</div>
        </div>
        <div class="k-cards">${cards.length?visible.map(renderEnqCard).join('')+''+(hidden>0?`<button class="k-show-more" onclick="expandColumn(this,'${s.id}')">Show ${hidden} more...</button>`:''):'<div class="k-empty">○</div>'}</div>
      </div>`;
    }).join('');
  }
}
function setPipelineFilter(f){pipelineFilter=f;renderPipeline();}
function setViewMode(m){pipelineViewMode=m;renderPipeline();}
function expandColumn(btn,stageId){
  const filtered=getFilteredEnquiries();
  const cards=filtered.filter(e=>e.stage===stageId);
  const container=btn.closest('.k-cards');
  btn.remove();
  container.innerHTML+=cards.slice(5).map(renderEnqCard).join('');
}

function renderEnqCard(e){
  const fs=fuStatus(e.followup);
  const fuHtml=fs?`<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;background:${fs==='overdue'?'var(--danger-bg)':fs==='today'?'var(--warning-bg)':'var(--cream-dark)'};color:${fs==='overdue'?'var(--danger)':fs==='today'?'var(--warning)':'var(--ink-light)'}">${fs==='overdue'?'⚠️ Overdue':fs==='today'?'Due today':'📅 '+fmtDate(e.followup)}</span>`:'';
  const da=daysAgo(e.dateAdded);
  return `<div class="enq-card" onclick="openEditEnquiry('${e.id}')">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
      <div class="enq-name">${esc(e.name)}</div>
      <span style="font-size:10px;color:var(--ink-muted);white-space:nowrap;flex-shrink:0">${da}</span>
    </div>
    <div class="enq-dog">${e.dogName?`🐶 ${esc(e.dogName)}${e.dogBreed?' · '+esc(e.dogBreed):''}`:''}${e.suburb?` · 📍${esc(e.suburb)}`:''}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
      ${fuHtml}
      ${e.phone?`<span style="font-size:10px;color:var(--ink-muted)">${esc(e.phone)}</span>`:''}
    </div>
  </div>`;
}

// ── ONBOARDING ──
function renderOnboarding(){
  const clients=enquiries.filter(e=>e.stage==='onboarding');
  const el=document.getElementById('ob-list');
  if(!clients.length){el.innerHTML=`<div class="empty"><div class="ei">✅</div><h4>No clients in onboarding</h4><p>Move an enquiry to "Onboarding" to track them here.</p></div>`;return;}
  el.innerHTML=clients.map(e=>{
    const checks=load('cw_ob_'+e.id,new Array(OB_STEPS.length).fill(false));
    const done=checks.filter(Boolean).length;
    const pct=Math.round((done/OB_STEPS.length)*100);
    const na=getObNextAction(e);
    const days=Math.floor((new Date()-new Date(e.dateAdded+'T00:00:00'))/(864e5));
    return `<div class="ob-card">
      <div class="ob-head" onclick="toggleOb('${e.id}')">
        <div style="font-size:28px">🐕</div>
        <div>
          <div class="name">${esc(e.name)}</div>
          <div class="dog">${e.dogName?`${esc(e.dogName)} · ${esc(e.dogBreed||'')}`:'No dog info'}</div>
          ${na?`<div class="next-action" style="margin-top:4px"><span>${na.icon}</span>${na.text}</div>`:''}
        </div>
        <div class="ob-meta">
          <div style="text-align:right">
            <div class="progress-wrap">
              <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
              <div class="progress-label">${done}/${OB_STEPS.length} complete · ${pct}%</div>
            </div>
            <div style="font-size:10px;color:${days>=14?'var(--danger)':'var(--ink-xlight)'};margin-top:3px">${days} days in onboarding${days>=14?' ⚠️':''}</div>
          </div>
          <span class="ob-toggle" id="ob-tog-${e.id}">▼</span>
        </div>
      </div>
      <div class="ob-checklist" id="ob-cl-${e.id}">
        ${OB_STEPS.map((step,i)=>`
          <div class="check-item">
            <input type="checkbox" id="ck-${e.id}-${i}" ${checks[i]?'checked':''} onchange="toggleObStep('${e.id}',${i},this.checked)">
            <label for="ck-${e.id}-${i}">${step}</label>
            <span class="check-badge ${checks[i]?'done':'pending'}">${checks[i]?'Done':'Pending'}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function toggleOb(id){
  document.getElementById('ob-cl-'+id).classList.toggle('open');
  document.getElementById('ob-tog-'+id).classList.toggle('open');
}

function toggleObStep(id,i,val){
  const checks=load('cw_ob_'+id,new Array(OB_STEPS.length).fill(false));
  checks[i]=val;save('cw_ob_'+id,checks);
  logEvent('Onboarding step updated',`${enquiries.find(e=>e.id===id)?.name||id}: step ${i+1} ${val?'completed':'unchecked'}`,'success','✅');
  renderOnboarding();
  document.getElementById('ob-cl-'+id)?.classList.add('open');
  document.getElementById('ob-tog-'+id)?.classList.add('open');
  showToast(val?'Step marked complete':'Step unchecked');
}

// ── CLIENTS ──
let clientFilter='all';
function renderClients(){
  const search=(document.getElementById('client-search')?.value||'').toLowerCase().trim();
  let list=clients;
  if(search){
    list=list.filter(c=>((c.name||c.owner||'').toLowerCase().includes(search))||(c.suburb||'').toLowerCase().includes(search)||(c.primaryService||'').toLowerCase().includes(search)||(c.services||'').toLowerCase().includes(search));
  }

  // Build filter pills
  const filtersEl=document.getElementById('client-filters');
  if(filtersEl){
    const statusCounts={
      all:clients.length,
      active:clients.filter(c=>c.status==='active').length,
      'no-upcoming':clients.filter(c=>c.status==='no-upcoming').length,
      'needs-attention':clients.filter(c=>c.status==='active'&&c.daysAhead>0&&c.daysAhead<=7).length,
      'well-booked':clients.filter(c=>c.daysAhead>=14).length,
    };
    filtersEl.innerHTML=[
      {id:'all',label:'All Clients',count:statusCounts.all},
      {id:'active',label:'Active',count:statusCounts.active,color:'#22c55e'},
      {id:'needs-attention',label:'Booked < 7 Days Ahead',count:statusCounts['needs-attention'],color:'#f59e0b'},
      {id:'well-booked',label:'Booked 14+ Days Ahead',count:statusCounts['well-booked'],color:'#06b6d4'},
      {id:'no-upcoming',label:'No Upcoming',count:statusCounts['no-upcoming'],color:'#ef4444'},
    ].filter(f=>f.count>0).map(f=>
      `<div class="filter-pill${clientFilter===f.id?' active':''}" style="cursor:pointer" onclick="clientFilter='${f.id}';renderClients()">
        ${f.color?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:4px"></span>`:''}${f.label} <strong>(${f.count})</strong>
      </div>`
    ).join('');
  }

  if(clientFilter==='needs-attention') list=list.filter(c=>c.status==='active'&&c.daysAhead>0&&c.daysAhead<=7);
  else if(clientFilter==='well-booked') list=list.filter(c=>c.daysAhead>=14);
  else if(clientFilter!=='all') list=list.filter(c=>c.status===clientFilter);

  document.getElementById('clients-grid').innerHTML=list.length?list.map(c=>{
    const statusLabel=c.status==='active'?'● Active':c.status==='no-upcoming'?'⚠️ No Upcoming':'○ Inactive';
    const statusColor=c.status==='active'?'var(--success)':c.status==='no-upcoming'?'var(--danger)':'var(--ink-light)';
    const bookingInfo=c.daysAhead>0?`Booked ${c.daysAhead}d ahead · ${c.futureWalks} walks`:(c.lastWalk?`Last walk: ${fmtDate(c.lastWalk)}`:'No walk history');
    const bookingColor=c.daysAhead>=14?'var(--success)':c.daysAhead>=7?'var(--warning)':'var(--danger)';
    return `<div class="client-card">
      <div class="client-top">
        <div class="client-avatar">🐕</div>
        <div>
          <div class="client-name">${esc(c.name||c.owner||'')}</div>
          <span class="client-badge" style="color:${statusColor}">${statusLabel}</span>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin:8px 0">
        ${c.primaryService?`<span class="tag tag-channel">${esc(c.primaryService)}</span>`:''}
        ${c.suburb?`<span class="tag" style="background:var(--cream-dark);color:var(--ink-light)">📍${esc(c.suburb)}</span>`:''}
        ${c.walker?`<span class="tag" style="background:var(--info-bg);color:var(--info)">${esc(c.walker)}</span>`:''}
      </div>
      <div class="client-stats">
        <div class="cs-stat"><div class="cs-val">${c.walksPerWeek||0}</div><div class="cs-lbl">walks/wk</div></div>
        <div class="cs-stat"><div class="cs-val">${c.totalWalks||0}</div><div class="cs-lbl">total walks</div></div>
        <div class="cs-stat"><div class="cs-val">${c.futureWalks||0}</div><div class="cs-lbl">upcoming</div></div>
      </div>
      <div style="font-size:11px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border-light);color:${bookingColor}">${bookingInfo}</div>
      ${c.nextWalk?`<div style="font-size:11px;color:var(--ink-light);margin-top:4px">Next walk: ${fmtDate(c.nextWalk)}</div>`:''}
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light);display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm" style="flex:1;font-size:11px" onclick="window.open('https://www.timetopet.com/portal','_blank')">📋 Time to Pet</button>
      </div>
    </div>`;
  }).join(''):'<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No clients found</div>';
}

// ── WALKS ──
let walksRange='today';
let walksData=[];
let walksLoading=false;

function setWalksRange(r){
  walksRange=r;
  document.querySelectorAll('#walks-range-filters .filter-pill').forEach(p=>p.classList.remove('active'));
  event?.target?.classList.add('active');
  renderWalks();
}

async function fetchWalks(range){
  try{
    const res=await fetch('/api/walks/today?range='+range);
    if(!res.ok) return [];
    return await res.json();
  }catch(e){return [];}
}

async function renderWalks(){
  const content=document.getElementById('walks-content');
  const summary=document.getElementById('walks-summary');
  if(!content) return;

  // Update filter pills
  document.querySelectorAll('#walks-range-filters .filter-pill').forEach(p=>{
    p.classList.toggle('active',p.textContent.trim().toLowerCase().includes(walksRange==='today'?'today':walksRange==='week'?'week':'month'));
  });

  content.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading walks...</div>';
  walksData=await fetchWalks(walksRange);

  // Summary stats
  const completed=walksData.filter(w=>w.status==='completed').length;
  const inProgress=walksData.filter(w=>w.status==='inprogress').length;
  const upcoming=walksData.filter(w=>w.status==='upcoming').length;
  const uniqueClients=[...new Set(walksData.map(w=>w.client))].length;
  const totalHrs=walksData.reduce((sum,w)=>{
    if(!w.start||!w.end) return sum;
    return sum+(new Date(w.end)-new Date(w.start))/3600000;
  },0);

  summary.innerHTML=`
    <div class="walks-stat"><div class="walks-stat-val">${walksData.length}</div><div class="walks-stat-lbl">Total Walks</div></div>
    <div class="walks-stat"><div class="walks-stat-val">${uniqueClients}</div><div class="walks-stat-lbl">Clients</div></div>
    <div class="walks-stat"><div class="walks-stat-val">${totalHrs.toFixed(1)}h</div><div class="walks-stat-lbl">Walk Hours</div></div>
    <div class="walks-stat"><div class="walks-stat-val" style="color:var(--success)">${completed}</div><div class="walks-stat-lbl">Completed</div></div>
    ${inProgress?`<div class="walks-stat"><div class="walks-stat-val" style="color:var(--warning)">${inProgress}</div><div class="walks-stat-lbl">In Progress</div></div>`:''}
    <div class="walks-stat"><div class="walks-stat-val" style="color:var(--info)">${upcoming}</div><div class="walks-stat-lbl">Upcoming</div></div>
  `;

  if(!walksData.length){
    content.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No walks scheduled for this period</div>';
    return;
  }

  if(walksRange==='today'){
    content.innerHTML=walksData.map(renderWalkRow).join('');
  }else if(walksRange==='week'){
    // Weekly: collapsible day rows
    const groups={};
    walksData.forEach(w=>{if(!groups[w.date])groups[w.date]=[];groups[w.date].push(w);});
    const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    content.innerHTML=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,walks])=>{
      const d=new Date(date+'T00:00:00');
      const dayName=dayNames[d.getDay()];
      const dateLabel=`${dayName} ${d.getDate()}/${d.getMonth()+1}`;
      const hrs=walks.reduce((s,w)=>s+(w.start&&w.end?(new Date(w.end)-new Date(w.start))/3600000:0),0);
      const clients=[...new Set(walks.map(w=>w.client))];
      const clientPreview=clients.slice(0,3).map(c=>esc(c)).join(', ')+(clients.length>3?' +' +(clients.length-3)+' more':'');
      const isToday=date===new Date().toISOString().split('T')[0];
      return `<div class="walk-day-collapse${isToday?' walk-day-today':''}" onclick="this.classList.toggle('expanded')">
        <div class="walk-day-summary">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:700;min-width:70px">${dateLabel}</span>
            <span class="walk-day-pill">${walks.length} walks</span>
            <span class="walk-day-pill">${hrs.toFixed(1)}h</span>
            ${isToday?'<span class="walk-day-pill" style="background:var(--orange-light);color:var(--orange)">Today</span>':''}
          </div>
          <div style="font-size:11px;color:var(--ink-light)">${clientPreview}</div>
          <span style="font-size:10px;color:var(--ink-xlight)">Click to expand</span>
        </div>
        <div class="walk-day-detail">${walks.map(renderWalkRow).join('')}</div>
      </div>`;
    }).join('');
  }else{
    // Monthly: calendar heatmap grid
    const groups={};
    walksData.forEach(w=>{if(!groups[w.date])groups[w.date]=[];groups[w.date].push(w);});
    const now=new Date();
    const year=now.getFullYear(),month=now.getMonth();
    const firstDay=new Date(year,month,1).getDay();
    const daysInMonth=new Date(year,month+1,0).getDate();
    const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const mondayOffset=(firstDay+6)%7; // Days before Monday

    let calHtml=`<div class="walks-cal-grid">`;
    calHtml+=dayNames.map(d=>`<div class="walks-cal-header">${d}</div>`).join('');
    // Empty cells before first day
    for(let i=0;i<mondayOffset;i++) calHtml+=`<div class="walks-cal-cell empty"></div>`;
    for(let day=1;day<=daysInMonth;day++){
      const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const walks=groups[dateStr]||[];
      const count=walks.length;
      const hrs=walks.reduce((s,w)=>s+(w.start&&w.end?(new Date(w.end)-new Date(w.start))/3600000:0),0);
      const isToday=dateStr===now.toISOString().split('T')[0];
      const intensity=count===0?0:count<=3?1:count<=6?2:count<=10?3:4;
      calHtml+=`<div class="walks-cal-cell heat-${intensity}${isToday?' cal-today':''}" onclick="expandCalDay('${dateStr}')">
        <div class="cal-day-num">${day}</div>
        ${count?`<div class="cal-day-count">${count} walks</div><div class="cal-day-hrs">${hrs.toFixed(1)}h</div>`:'<div class="cal-day-count" style="color:var(--ink-xlight)">—</div>'}
      </div>`;
    }
    calHtml+=`</div><div id="walks-cal-expanded"></div>`;
    content.innerHTML=calHtml;
  }
}

function expandCalDay(dateStr){
  const el=document.getElementById('walks-cal-expanded');
  if(!el) return;
  const walks=walksData.filter(w=>w.date===dateStr);
  if(!walks.length){el.innerHTML='';return;}
  const d=new Date(dateStr+'T00:00:00');
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const label=`${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
  el.innerHTML=`<div style="margin-top:16px"><div class="walk-day-header"><span>${label}</span><span style="font-weight:500;font-size:11px;color:var(--ink-light)">${walks.length} walks</span></div>${walks.map(renderWalkRow).join('')}</div>`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function renderWalkRow(w){
  const statusStyle=w.status==='completed'?'background:var(--success-bg);color:var(--success)':w.status==='inprogress'?'background:var(--warning-bg);color:var(--warning)':'background:var(--cream-dark);color:var(--ink-light)';
  const statusLabel=w.status==='completed'?'Done':w.status==='inprogress'?'In Progress':'Upcoming';
  return `<div class="walk-row">
    <div class="walk-time">${w.time} — ${w.endTime}</div>
    <div style="flex:1">
      <div class="walk-client">${esc(w.client)}</div>
      <div class="walk-detail">${esc(w.service)}${w.walker?' · Walker: '+esc(w.walker):''}</div>
      ${w.location?`<div class="walk-detail">📍 ${esc(w.location.split(',').slice(0,2).join(','))}</div>`:''}
    </div>
    <span class="walk-status" style="${statusStyle}">${statusLabel}</span>
  </div>`;
}

// ── CLIENT BOOKING VISIBILITY ──
async function renderClientBookings(){
  const el=document.getElementById('client-bookings');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-xlight)">Loading booking data...</div>';

  // Fetch all walks to check bookings per client
  const allWalks=await fetchWalks('all');
  const now=new Date();
  const futureWalks=allWalks.filter(w=>new Date(w.start)>now);

  // Build booking map per client
  const bookingMap={};
  futureWalks.forEach(w=>{
    if(!bookingMap[w.client]) bookingMap[w.client]={count:0,nextDate:'',lastDate:''};
    bookingMap[w.client].count++;
    if(!bookingMap[w.client].nextDate||w.date<bookingMap[w.client].nextDate) bookingMap[w.client].nextDate=w.date;
    if(!bookingMap[w.client].lastDate||w.date>bookingMap[w.client].lastDate) bookingMap[w.client].lastDate=w.date;
  });

  // Match with active Notion clients
  const activeClients=clients.filter(c=>c.health==='active');
  const rows=activeClients.map(c=>{
    const booking=bookingMap[c.owner]||null;
    const matched=booking?true:false;
    // Try fuzzy match if exact doesn't work
    let b=booking;
    if(!b){
      const key=Object.keys(bookingMap).find(k=>k.toLowerCase().includes((c.owner||'').toLowerCase().split(' ')[0].toLowerCase()));
      if(key) b=bookingMap[key];
    }
    return {client:c,booking:b};
  }).sort((a,b)=>(a.booking?0:1)-(b.booking?0:1));

  if(!rows.length){
    el.innerHTML='<div style="text-align:center;padding:20px;color:var(--ink-xlight)">No active clients</div>';
    return;
  }

  el.innerHTML=rows.map(({client:c,booking:b})=>{
    let statusHtml,statusColor;
    if(b&&b.count>0){
      const daysAhead=Math.ceil((new Date(b.lastDate)-now)/(864e5));
      statusHtml=`${b.count} walks booked · Until ${fmtDate(b.lastDate)} (${daysAhead}d ahead)`;
      statusColor=daysAhead>=14?'var(--success)':daysAhead>=7?'var(--warning)':'var(--danger)';
    }else{
      statusHtml='No upcoming walks booked';
      statusColor='var(--danger)';
    }
    return `<div class="booking-row">
      <div style="flex:1"><strong>${esc(c.owner)}</strong><span style="margin-left:8px;font-size:11px;color:var(--ink-light)">${esc(c.primaryService||'')} · ${esc(c.suburb||'')}</span></div>
      <span class="booking-status" style="background:${statusColor}20;color:${statusColor}">${statusHtml}</span>
    </div>`;
  }).join('');
}

// ── INBOX ──
function renderInbox(){/* static view — no dynamic rendering needed */}

function getEmailContext(m){
  const enq=enquiries.find(e=>e.name===m.from||e.email===m.email);
  if(enq){
    const fit=calcFitScore(enq);
    const na=getEnqNextAction(enq);
    return `<div class="ctx-header">📥 Linked Enquiry</div>
    <div class="ctx-card">
      <div class="ctx-field"><div class="ctx-label">Name</div><div class="ctx-value">${esc(enq.name)}</div></div>
      <div class="ctx-field"><div class="ctx-label">Dog</div><div class="ctx-value">${esc(enq.dogName)} (${esc(enq.dogBreed||'?')})</div></div>
      <div class="ctx-field"><div class="ctx-label">Stage</div><div class="ctx-value" style="color:${STAGES.find(s=>s.id===enq.stage)?.color};font-weight:700">${STAGES.find(s=>s.id===enq.stage)?.label}</div></div>
      <div class="ctx-field"><div class="ctx-label">Channel</div><div class="ctx-value">${esc(enq.channel)}</div></div>
      <div class="ctx-field"><div class="ctx-label">Suburb</div><div class="ctx-value">${esc(enq.suburb||'—')}</div></div>
      <div class="ctx-field"><div class="ctx-label">Fit Score</div><div class="ctx-value"><span class="fit-badge ${fit.cls}">🎯 ${fit.score}/10 ${fit.label}</span></div></div>
      ${na?`<div class="ctx-field"><div class="ctx-label">Next Action</div><div class="next-action" style="margin-top:4px"><span>${na.icon}</span>${na.text}</div></div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
      <button class="btn btn-primary btn-sm" onclick="openAiDraft('${enq.id}')">🤖 AI Draft Reply</button>
      <button class="btn btn-ghost btn-sm" onclick="openEditEnquiry('${enq.id}')">📝 Open Enquiry</button>
    </div>`;
  }
  const client=clients.find(c=>c.owner===m.from);
  if(client){
    const na=getClientNextAction(client);
    return `<div class="ctx-header">🐕 Linked Client</div>
    <div class="ctx-card">
      <div class="ctx-field"><div class="ctx-label">Owner</div><div class="ctx-value">${esc(client.owner)}</div></div>
      <div class="ctx-field"><div class="ctx-label">Dog</div><div class="ctx-value">${esc(client.dog)} (${esc(client.breed)})</div></div>
      <div class="ctx-field"><div class="ctx-label">Health</div><div class="ctx-value"><span class="client-badge health-${client.health}" style="font-size:11px">${{active:'● Active','at-risk':'⚠️ At Risk','win-back':'💔 Win-back'}[client.health]}</span></div></div>
      <div class="ctx-field"><div class="ctx-label">Next Walk</div><div class="ctx-value">${esc(client.nextWalk)}</div></div>
      <div class="ctx-field"><div class="ctx-label">Lifetime Value</div><div class="ctx-value" style="font-weight:700;color:var(--orange)">${esc(client.ltv)}</div></div>
      ${na?`<div class="next-action" style="margin-top:6px"><span>${na.icon}</span>${na.text}</div>`:''}
    </div>
    <div style="margin-top:10px">
      <button class="btn btn-ghost btn-sm" style="width:100%" onclick="composeEmail('${client.email||''}','Re: ','')">✉️ Reply to ${esc(client.owner)}</button>
    </div>`;
  }
  return `<div class="ctx-header">Context</div><div style="font-size:12px;color:var(--ink-xlight);line-height:1.7">No matched enquiry or client for this sender.<br><br>If this is a new lead, <span style="color:var(--orange);cursor:pointer;font-weight:600" onclick="openAddEnquiry()">add to pipeline →</span></div>`;
}

function openEmail(id){
  activeEmail=id;
  const m=EMAILS.find(e=>e.id===id);
  if(!m)return;
  m.read=true;
  const unread=EMAILS.filter(e=>!e.read).length;
  document.getElementById('badge-inbox').textContent=unread;
  document.getElementById('badge-inbox').style.display=unread>0?'inline-block':'none';
  renderInbox();
  document.getElementById('inbox-main').innerHTML=`
    <div class="inbox-email-view">
      <div class="email-view-header">
        <div class="email-view-subject">${esc(m.subject)}</div>
        <div class="email-view-meta">
          <div><strong>${esc(m.from)}</strong> &lt;${esc(m.email)}&gt;</div>
          <div style="display:flex;gap:8px"><span class="ei-tag ${m.tag}">${m.tag}</span><span>${m.time}</span></div>
        </div>
      </div>
      <div class="email-view-body">${esc(m.body)}</div>
      <div style="margin-top:20px;display:flex;gap:8px;border-top:1px solid var(--border);padding-top:16px">
        <button class="btn btn-primary btn-sm" onclick="composeEmail('${m.email}','Re: ${esc(m.subject)}','')">↩️ Reply</button>
        <button class="btn btn-ghost btn-sm" onclick="openAiDraftFromEmail('${m.id}')">🤖 AI Draft Reply</button>
        <button class="btn btn-ghost btn-sm" onclick="openAddEnquiry()">📥 Add to Pipeline</button>
      </div>
    </div>`;
  document.getElementById('inbox-context').innerHTML=getEmailContext(m);
}

// ── TEMPLATES ──
function renderTemplates(){
  document.getElementById('templates-list').innerHTML=TEMPLATES.map(t=>{
    const bodyHtml=t.body.replace(/\{(\w+)\}/g,'<span class="merge-field">{$1}</span>').replace(/\n/g,'<br>');
    return `<div class="tmpl-card">
      <div class="tmpl-head" onclick="toggleTmpl('${t.id}')">
        <span class="tmpl-cat ${t.catClass}">${t.catLabel}</span>
        <span class="tmpl-name">${esc(t.name)}</span>
        <span class="tmpl-toggle" id="tt-${t.id}">▼</span>
      </div>
      <div class="tmpl-body" id="tb-${t.id}">
        <div class="tmpl-text">${bodyHtml}</div>
        <div class="tmpl-actions">
          <button class="btn btn-primary btn-sm" onclick="copyTmpl('${t.id}')">📋 Copy to Clipboard</button>
          <button class="btn btn-ghost btn-sm" onclick="composeEmail('','${esc(t.name)}',\`${t.body.replace(/`/g,"\\`")}\`)">✉️ Send via Outlook</button>
          <button class="btn btn-ghost btn-sm" onclick="window.open('https://wa.me/?text='+encodeURIComponent(\`${t.body.replace(/`/g,"\\`")}\`))">💬 WhatsApp</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleTmpl(id){
  document.getElementById('tb-'+id).classList.toggle('open');
  document.getElementById('tt-'+id).classList.toggle('open');
}

function copyTmpl(id){
  const t=TEMPLATES.find(x=>x.id===id);if(!t)return;
  navigator.clipboard.writeText(t.body).then(()=>{
    logEvent('Template copied',t.name+' — copied to clipboard','info','📋');
    showToast('Template copied!','📋');
  });
}

// ── REPORTS ──
async function renderReports(){
  // Fetch all walks (merged: ICS live + CSV history) and TTP summary data
  const [allWalks,summary]=await Promise.all([
    fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]),
    fetch('/api/data/summary').then(r=>r.ok?r.json():null).catch(()=>null),
  ]);
  const settings=getRouteSettings();
  const now=new Date();
  const nowStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Helper: get real revenue from a walk (uses TTP invoiced amount if available, else estimates)
  function walkRevenue(w){return w.totalRevenue>0?w.totalRevenue:getClientPrice(w.client,w.service)}

  // Current month walks (full month including future scheduled walks)
  const monthStart=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const monthEndDate=new Date(now.getFullYear(),now.getMonth()+1,0);
  const monthEnd=`${monthEndDate.getFullYear()}-${String(monthEndDate.getMonth()+1).padStart(2,'0')}-${String(monthEndDate.getDate()).padStart(2,'0')}`;
  const thisMonthWalks=allWalks.filter(w=>w.date>=monthStart&&w.date<=monthEnd);
  const monthWalkCount=thisMonthWalks.length;

  // MTD vs Scheduled split
  const completedWalks=thisMonthWalks.filter(w=>w.date<=nowStr);
  const scheduledWalks=thisMonthWalks.filter(w=>w.date>nowStr);

  // Use TTP monthly total as source of truth when available
  const currentMonthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const ttpCurrentMonth=summary?.revenueMonthly?.find(m=>m.month===currentMonthKey);
  const monthRevenue=ttpCurrentMonth?ttpCurrentMonth.revenue:thisMonthWalks.reduce((s,w)=>s+walkRevenue(w),0);
  // Estimate MTD/booked split proportionally from walk counts
  const mtdRevenue=monthWalkCount>0?monthRevenue*(completedWalks.length/monthWalkCount):0;
  const scheduledRevenue=monthRevenue-mtdRevenue;
  const avgPerWalk=monthWalkCount>0?monthRevenue/monthWalkCount:0;

  // Previous month revenue for growth %
  const prevMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const prevMonthKey=`${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth()+1).padStart(2,'0')}`;
  const ttpPrev=summary?.revenueMonthly?.find(m=>m.month===prevMonthKey);
  const prevRevenue=ttpPrev?ttpPrev.revenue:allWalks.filter(w=>w.date>=prevMonthKey+'-01'&&w.date<=prevMonthKey+'-31').reduce((s,w)=>s+walkRevenue(w),0);
  const growthPct=prevRevenue>0?Math.round(((monthRevenue-prevRevenue)/prevRevenue)*100):0;
  const growthLabel=prevRevenue>0?(growthPct>=0?`<span style="color:var(--success)">↑ ${growthPct}% vs ${monthNames[prevMonthDate.getMonth()]}</span>`:`<span style="color:var(--danger)">↓ ${Math.abs(growthPct)}% vs ${monthNames[prevMonthDate.getMonth()]}</span>`):'';

  // Conversion rate from enquiries
  const totalEnq=enquiries.length;
  const closedWon=enquiries.filter(e=>e.stage==='closed-won').length;
  const conversionRate=totalEnq>0?Math.round((closedWon/totalEnq)*100):0;

  // ── KPI CARDS (real data with MTD/Booked split) ──
  document.getElementById('report-kpis').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Conversion Rate</div><div class="kpi-value">${conversionRate}%</div><div class="kpi-change">${closedWon} of ${totalEnq} enquiries converted</div></div>
    <div class="kpi-card"><div class="kpi-label">Revenue (${monthNames[now.getMonth()]})</div><div class="kpi-value">$${monthRevenue.toLocaleString()}</div><div class="kpi-change">~$${mtdRevenue.toFixed(0)} earned · ~$${scheduledRevenue.toFixed(0)} booked ${growthLabel?' · '+growthLabel:''}</div></div>
    <div class="kpi-card"><div class="kpi-label">Walks (${monthNames[now.getMonth()]})</div><div class="kpi-value">${monthWalkCount}</div><div class="kpi-change">${completedWalks.length} completed · ${scheduledWalks.length} scheduled</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Revenue / Walk</div><div class="kpi-value">$${avgPerWalk.toFixed(0)}</div><div class="kpi-change">${ttpCurrentMonth?'From TTP revenue report':'Estimated from pricing'}</div></div>
  `;

  // ── REVENUE TREND (use TTP monthly totals where available, else calculate from walks) ──
  const ttpMonthly=summary?.revenueMonthly||[];
  const revenueData=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const mKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const ttpMonth=ttpMonthly.find(m=>m.month===mKey);
    if(ttpMonth&&ttpMonth.revenue>0){
      revenueData.push({month:monthNames[d.getMonth()],val:Math.round(ttpMonth.revenue)});
    }else{
      // Fall back to calculating from walk data
      const mStart=mKey+'-01';
      const mEndD=new Date(d.getFullYear(),d.getMonth()+1,0);
      const mEnd=`${mEndD.getFullYear()}-${String(mEndD.getMonth()+1).padStart(2,'0')}-${String(mEndD.getDate()).padStart(2,'0')}`;
      const mRev=allWalks.filter(w=>w.date>=mStart&&w.date<=mEnd).reduce((s,w)=>s+walkRevenue(w),0);
      revenueData.push({month:monthNames[d.getMonth()],val:Math.round(mRev)});
    }
  }
  const chartLabel=document.getElementById('report-chart-label');
  if(chartLabel) chartLabel.textContent=revenueData.length?`${revenueData[0].month} — ${revenueData[revenueData.length-1].month}`:'6 months';
  buildChart('reports-chart','reports-labels',revenueData,100);

  // ── ENQUIRY SOURCES (real data) ──
  const sourceMap={};
  enquiries.forEach(e=>{const s=e.source||'Unknown';sourceMap[s]=(sourceMap[s]||0)+1});
  const sourceTotal=Math.max(1,enquiries.length);
  const sourceColors=['#3b82f6','#ec4899','#22c55e','#8b5cf6','#f59e0b','#06b6d4','#a0a0a0'];
  const sources=Object.entries(sourceMap).sort((a,b)=>b[1]-a[1]).map(([label,count],i)=>({
    label,pct:Math.round((count/sourceTotal)*100),count,color:sourceColors[i%sourceColors.length]
  }));
  document.getElementById('source-list').innerHTML=sources.length?sources.map(s=>`
    <div class="source-row"><div class="source-label">${s.label}</div><div class="source-bar-bg"><div class="source-bar" style="width:${s.pct}%;background:${s.color}"></div></div><div class="source-pct">${s.count} (${s.pct}%)</div></div>`).join('')
    :'<div style="text-align:center;padding:20px;color:var(--ink-xlight);font-size:13px">No enquiry data yet</div>';

  // ── PIPELINE FUNNEL (real stage counts) ──
  const stageOrder=[
    {id:'new',label:'New Enquiries',color:'#3b82f6'},
    {id:'contacted',label:'Contacted',color:'#f59e0b'},
    {id:'qualified',label:'Qualified',color:'#8b5cf6'},
    {id:'closed-won',label:'Converted to Client',color:'#22c55e'},
  ];
  const stageCounts=stageOrder.map(s=>({...s,val:enquiries.filter(e=>e.stage===s.id).length}));
  // Also count people who passed through each stage (contacted includes qualified + closed-won, etc.)
  const cumulativeCounts=[
    {label:'Total Enquiries',val:totalEnq,color:'#3b82f6'},
    {label:'Contacted',val:enquiries.filter(e=>['contacted','qualified','closed-won'].includes(e.stage)).length,color:'#f59e0b'},
    {label:'Qualified',val:enquiries.filter(e=>['qualified','closed-won'].includes(e.stage)).length,color:'#8b5cf6'},
    {label:'Converted',val:closedWon,color:'#22c55e'},
  ];
  const funnelMax=Math.max(1,cumulativeCounts[0].val);
  document.getElementById('conversion-funnel').innerHTML=cumulativeCounts.map(f=>`
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:12px;color:var(--ink-mid);width:150px;flex-shrink:0">${f.label}</div>
      <div style="flex:1;background:var(--cream-dark);border-radius:4px;height:10px;overflow:hidden"><div style="width:${(f.val/funnelMax)*100}%;height:100%;background:${f.color};border-radius:4px"></div></div>
      <div style="font-size:12px;font-weight:700;color:var(--ink-mid);width:50px;text-align:right">${f.val} (${Math.round((f.val/funnelMax)*100)}%)</div>
    </div>`).join('');

  // ── WALKER UTILISATION (real TTP data, this month) ──
  // Only count known walkers — ICS sometimes puts dog names in the walker field
  const KNOWN_WALKERS=['Jessica Lauritz','Alex Cass'];
  const walkerMap={};
  thisMonthWalks.forEach(w=>{
    const raw=w.walker||'Unknown';
    const name=KNOWN_WALKERS.find(k=>raw.toLowerCase().includes(k.split(' ')[0].toLowerCase()))||null;
    if(!name) return;
    if(!walkerMap[name]) walkerMap[name]={walks:0,hours:0,revenue:0};
    walkerMap[name].walks++;
    if(w.start&&w.end) walkerMap[name].hours+=(new Date(w.end)-new Date(w.start))/3600000;
    walkerMap[name].revenue+=getClientPrice(w.client,w.service);
  });
  const walkerColors=['#F26B21','#3b82f6','#22c55e','#8b5cf6','#ec4899','#f59e0b'];
  const walkerData=Object.entries(walkerMap).sort((a,b)=>b[1].walks-a[1].walks).map(([name,d],i)=>({
    name,walks:d.walks,hours:d.hours,revenue:d.revenue,color:walkerColors[i%walkerColors.length]
  }));
  const maxWalkerWalks=Math.max(1,...walkerData.map(w=>w.walks));
  const utilLabel=document.getElementById('walker-util-label');
  if(utilLabel) utilLabel.textContent=walkerData.length?`${walkerData.length} walker${walkerData.length>1?'s':''} this month`:'This month';
  document.getElementById('walker-util').innerHTML=walkerData.length?walkerData.map(w=>`
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:5px"><span style="font-size:13px;font-weight:600">${esc(w.name)}</span><span style="font-size:12px;color:var(--ink-light)">${w.walks} walks · ${w.hours.toFixed(1)}h · <strong>$${w.revenue.toFixed(0)}</strong></span></div>
      <div style="background:var(--cream-dark);border-radius:4px;height:8px;overflow:hidden"><div style="width:${(w.walks/maxWalkerWalks)*100}%;height:100%;background:${w.color};border-radius:4px"></div></div>
    </div>`).join('')
    :'<div style="text-align:center;padding:20px;color:var(--ink-xlight);font-size:13px">No walk data this month</div>';
}

function reportTab(tab){
  document.querySelectorAll('.report-tab').forEach(t=>t.classList.toggle('active',t.dataset.rtab===tab));
  document.querySelectorAll('.report-panel').forEach(p=>p.classList.toggle('active',p.id==='rp-'+tab));
  if(tab==='overview')renderReports();
  if(tab==='by-source')renderBySource();
  if(tab==='by-service')renderByService();
  if(tab==='by-suburb')renderBySuburb();
  if(tab==='retention')renderRetention();
}

function reportTableWrap(title,subtitle,theadHtml,tbodyHtml){
  return `<div class="card"><div class="card-header"><h3>${title}</h3><span style="font-size:11px;color:var(--ink-xlight)">${subtitle}</span></div><div class="card-body" style="padding:0"><table class="report-table"><thead><tr>${theadHtml}</tr></thead><tbody>${tbodyHtml}</tbody></table></div></div>`;
}

function renderBySource(){
  const map={};
  enquiries.forEach(e=>{
    const s=e.source||'Unknown';
    if(!map[s])map[s]={total:0,converted:0};
    map[s].total++;
    if(e.stage==='closed-won')map[s].converted++;
  });
  const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  const tbody=rows.map(([s,d])=>{
    const rate=Math.round((d.converted/d.total)*100);
    return `<tr><td><strong>${s}</strong></td><td>${d.total}</td><td>${d.converted}</td><td><span style="font-weight:700;color:${rate>=50?'var(--success)':rate>=25?'var(--warning)':'var(--danger)'}">${rate}%</span></td></tr>`;
  }).join('');
  document.getElementById('rp-by-source').innerHTML=reportTableWrap('Leads by Source','All time','<th>Source</th><th>Leads</th><th>Converted</th><th>Rate</th>',tbody);
}

function renderByService(){
  const map={};
  enquiries.forEach(e=>{
    const svc=(e.services||'').toLowerCase();
    const keys=[];
    if(/group/i.test(svc))keys.push('Group Walks');
    if(/solo|private/i.test(svc))keys.push('Solo Walks');
    if(/drop/i.test(svc))keys.push('Drop-ins');
    if(/puppy/i.test(svc))keys.push('Puppy Visits');
    if(!keys.length)keys.push('Other');
    keys.forEach(k=>{
      if(!map[k])map[k]={total:0,converted:0};
      map[k].total++;
      if(e.stage==='closed-won')map[k].converted++;
    });
  });
  const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  const tbody=rows.map(([s,d])=>{
    const rate=Math.round((d.converted/d.total)*100);
    return `<tr><td><strong>${s}</strong></td><td>${d.total}</td><td>${d.converted}</td><td><span style="font-weight:700;color:${rate>=50?'var(--success)':rate>=25?'var(--warning)':'var(--danger)'}">${rate}%</span></td></tr>`;
  }).join('');
  document.getElementById('rp-by-service').innerHTML=reportTableWrap('Leads by Service','All time','<th>Service Type</th><th>Enquiries</th><th>Converted</th><th>Rate</th>',tbody);
}

function renderBySuburb(){
  const map={};
  enquiries.forEach(e=>{
    const s=e.suburb||'Unknown';
    if(!map[s])map[s]={total:0,converted:0};
    map[s].total++;
    if(e.stage==='closed-won')map[s].converted++;
  });
  const rows=Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  const tbody=rows.map(([s,d])=>{
    const rate=Math.round((d.converted/d.total)*100)||0;
    return `<tr><td><strong>${s}</strong></td><td>${d.total}</td><td>${d.converted}</td><td><span style="font-weight:700;color:${d.total>=3?'var(--success)':'var(--ink-xlight)'}">${rate}%</span></td></tr>`;
  }).join('');
  document.getElementById('rp-by-suburb').innerHTML=reportTableWrap('Leads by Suburb','All time — shows best coverage areas','<th>Suburb</th><th>Enquiries</th><th>Converted</th><th>Rate</th>',tbody);
}

// ── RETENTION REPORT ──
async function renderRetention(){
  const panel=document.getElementById('rp-retention');
  if(!panel) return;
  panel.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading retention data...</div>';

  // Fetch client data from TTP
  const ttpClients=await fetch('/api/walks/clients').then(r=>r.ok?r.json():[]).catch(()=>[]);
  // Also fetch all walks for churn timeline
  const allWalks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);

  if(!ttpClients.length){
    panel.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No client data available. Check TTP calendar connection.</div>';
    return;
  }

  const now=new Date();
  const nowStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // Classify clients
  const active=ttpClients.filter(c=>c.status==='active');
  const atRisk=active.filter(c=>c.daysAhead>0&&c.daysAhead<=7);
  const wellBooked=active.filter(c=>c.daysAhead>=14);
  const droppedOff=ttpClients.filter(c=>c.status==='no-upcoming');
  const inactive=ttpClients.filter(c=>c.status==='inactive');

  // Avg tenure for active clients (days since first walk)
  const tenureDays=active.filter(c=>c.firstWalk).map(c=>{
    const first=new Date(c.firstWalk+'T00:00:00');
    return Math.floor((now-first)/864e5);
  });
  const avgTenure=tenureDays.length?Math.round(tenureDays.reduce((s,d)=>s+d,0)/tenureDays.length):0;
  const avgTenureLabel=avgTenure>=60?`${Math.round(avgTenure/30)} months`:`${avgTenure} days`;

  // ── KPI CARDS ──
  let html=`<div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">Active Clients</div><div class="kpi-value" style="color:var(--success)">${active.length}</div><div class="kpi-change">${wellBooked.length} well-booked (14d+)</div></div>
    <div class="kpi-card"><div class="kpi-label">At Risk</div><div class="kpi-value" style="color:var(--warning)">${atRisk.length}</div><div class="kpi-change">Booked &lt;7 days ahead</div></div>
    <div class="kpi-card"><div class="kpi-label">Dropped Off</div><div class="kpi-value" style="color:var(--danger)">${droppedOff.length}</div><div class="kpi-change">Had walks, none booked now</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Tenure</div><div class="kpi-value">${avgTenureLabel}</div><div class="kpi-change">Active clients since first walk</div></div>
  </div>`;

  // ── CHURN TIMELINE (active clients per month, last 6 months) ──
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const churnData=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const mStart=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    const mEndDate=new Date(d.getFullYear(),d.getMonth()+1,0);
    const mEnd=`${mEndDate.getFullYear()}-${String(mEndDate.getMonth()+1).padStart(2,'0')}-${String(mEndDate.getDate()).padStart(2,'0')}`;
    // Count unique clients who had walks in this month
    const monthClients=new Set(allWalks.filter(w=>w.date>=mStart&&w.date<=mEnd).map(w=>w.client));
    churnData.push({month:monthNames[d.getMonth()],val:monthClients.size});
  }

  const maxClients=Math.max(1,...churnData.map(d=>d.val));
  html+=`<div class="reports-grid" style="grid-template-columns:1fr 1fr;margin-bottom:20px">
    <div class="card">
      <div class="card-header"><h3>Active Clients by Month</h3><span style="font-size:11px;color:var(--ink-xlight)">Unique clients with walks</span></div>
      <div class="card-body">
        <div style="display:flex;align-items:flex-end;gap:8px;height:120px">
          ${churnData.map((d,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:11px;font-weight:700;color:var(--ink-mid)">${d.val}</div>
            <div style="width:100%;background:${i===churnData.length-1?'var(--orange)':'var(--info)'};border-radius:4px 4px 0 0;height:${(d.val/maxClients)*90}px;min-height:4px;transition:height .3s"></div>
            <div style="font-size:10px;color:var(--ink-xlight)">${d.month}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Retention Breakdown</h3><span style="font-size:11px;color:var(--ink-xlight)">${ttpClients.length} total clients</span></div>
      <div class="card-body">
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            {label:'Well Booked (14d+)',count:wellBooked.length,color:'var(--success)',pct:Math.round((wellBooked.length/Math.max(1,ttpClients.length))*100)},
            {label:'Active (7-13d)',count:active.length-atRisk.length-wellBooked.length,color:'var(--info)',pct:Math.round(((active.length-atRisk.length-wellBooked.length)/Math.max(1,ttpClients.length))*100)},
            {label:'At Risk (<7d)',count:atRisk.length,color:'var(--warning)',pct:Math.round((atRisk.length/Math.max(1,ttpClients.length))*100)},
            {label:'Dropped Off',count:droppedOff.length,color:'var(--danger)',pct:Math.round((droppedOff.length/Math.max(1,ttpClients.length))*100)},
            {label:'Inactive',count:inactive.length,color:'var(--ink-xlight)',pct:Math.round((inactive.length/Math.max(1,ttpClients.length))*100)},
          ].map(r=>`<div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:12px;color:var(--ink-mid);width:130px;flex-shrink:0">${r.label}</div>
            <div style="flex:1;background:var(--cream-dark);border-radius:4px;height:8px;overflow:hidden"><div style="width:${r.pct}%;height:100%;background:${r.color};border-radius:4px;min-width:${r.count>0?'4px':'0'}"></div></div>
            <div style="font-size:12px;font-weight:700;color:var(--ink-mid);width:50px;text-align:right">${r.count} (${r.pct}%)</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;

  // ── CLIENT TABLE (sorted by risk) ──
  // Sort: dropped off first, then at-risk, then active by daysAhead ascending
  const sortedClients=[...ttpClients].sort((a,b)=>{
    const priority={'no-upcoming':0,'inactive':1,'active':2};
    const pa=priority[a.status]??2;
    const pb=priority[b.status]??2;
    if(pa!==pb) return pa-pb;
    // Within active: sort by daysAhead ascending (least booked first)
    return (a.daysAhead||0)-(b.daysAhead||0);
  });

  const tbody=sortedClients.map(c=>{
    const isAtRisk=c.status==='active'&&c.daysAhead>0&&c.daysAhead<=7;
    const isWellBooked=c.status==='active'&&c.daysAhead>=14;
    const rowBg=c.status==='no-upcoming'?'background:var(--danger-bg)':isAtRisk?'background:var(--warning-bg)':isWellBooked?'background:rgba(22,163,74,.04)':'';
    const statusBadge=c.status==='no-upcoming'?'<span style="background:var(--danger-bg);color:var(--danger);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Dropped Off</span>'
      :isAtRisk?'<span style="background:var(--warning-bg);color:var(--warning);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">At Risk</span>'
      :c.status==='inactive'?'<span style="background:var(--cream-dark);color:var(--ink-xlight);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Inactive</span>'
      :isWellBooked?'<span style="background:var(--success-bg);color:var(--success);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Well Booked</span>'
      :'<span style="background:var(--info-bg);color:var(--info);padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600">Active</span>';

    // Days since last walk
    let daysSinceLastWalk='—';
    if(c.lastWalk){
      const diff=Math.floor((now-new Date(c.lastWalk+'T00:00:00'))/864e5);
      daysSinceLastWalk=diff===0?'Today':diff===1?'Yesterday':`${diff}d ago`;
    }

    // Tenure
    let tenure='—';
    if(c.firstWalk){
      const days=Math.floor((now-new Date(c.firstWalk+'T00:00:00'))/864e5);
      tenure=days>=60?`${Math.round(days/30)}m`:days>=7?`${Math.round(days/7)}w`:`${days}d`;
    }

    return `<tr style="${rowBg}">
      <td><strong>${esc(c.name)}</strong></td>
      <td>${statusBadge}</td>
      <td>${c.lastWalk?fmtDate(c.lastWalk):'—'}</td>
      <td style="color:${c.status==='no-upcoming'?'var(--danger)':'var(--ink-light)'}">${daysSinceLastWalk}</td>
      <td style="font-weight:700;color:${c.daysAhead>=14?'var(--success)':c.daysAhead>=7?'var(--info)':c.daysAhead>0?'var(--warning)':'var(--danger)'}">${c.daysAhead>0?c.daysAhead+'d':'—'}</td>
      <td>${c.walksPerWeek>0?c.walksPerWeek.toFixed(1)+'/wk':'—'}</td>
      <td>${c.totalWalks||0}</td>
      <td>${tenure}</td>
      <td style="font-size:11px;color:var(--ink-light)">${esc(c.services||'—')}</td>
    </tr>`;
  }).join('');

  html+=`<div class="card">
    <div class="card-header"><h3>Client Retention Detail</h3><span style="font-size:11px;color:var(--ink-xlight)">${ttpClients.length} clients · sorted by risk</span></div>
    <div class="card-body" style="padding:0;overflow-x:auto">
      <table class="report-table">
        <thead><tr><th>Client</th><th>Status</th><th>Last Walk</th><th>Since</th><th>Booked Ahead</th><th>Frequency</th><th>Total Walks</th><th>Tenure</th><th>Services</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  </div>`;

  panel.innerHTML=html;
}

// ── SETTINGS ──
// ── SETTINGS PERSISTENCE ──
const SETTINGS_FIELDS={
  business:['s-biz-name','s-your-name','s-email','s-phone','s-website'],
  ai:['s-api-key','s-auto-reply','s-tone'],
  webhooks:['wh-new-enquiry','wh-stage-onboarding','wh-client-converted','wh-followup-overdue','wh-send-email','wh-ai-draft','wh-xero','wh-fetch-leads','wh-fetch-walks'],
  base:['s-base-lat','s-base-lng'],
  routes:['s-cost-km','s-super-rate','s-casual-load','s-target-profit','s-margin-green','s-margin-yellow','s-travel-warn','s-travel-danger','s-founder-weekly','s-founder-days','s-founder-target','s-buffer-mins','s-max-dogs','s-rate-employee','s-rate-contractor','s-price-adventure','s-price-solo']
};
function saveSettings(section){
  const s=load('cw_settings',{});
  const fields=section?SETTINGS_FIELDS[section]:Object.values(SETTINGS_FIELDS).flat();
  fields.forEach(id=>{
    const el=document.getElementById(id);
    if(el) s[id]=el.tagName==='SELECT'?el.selectedIndex:el.value;
  });
  save('cw_settings',s);
  showToast('Settings saved!','✅');
  logEvent('Settings updated',section||'all','info','⚙️');
  // Refresh dashboard revenue when route/pricing settings change
  if(section==='routes'||section==='base') renderDashboard();
}
function loadSettings(){
  const s=load('cw_settings',{});
  Object.entries(s).forEach(([id,val])=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(el.tagName==='SELECT') el.selectedIndex=val;
    else el.value=val;
  });
}
function getSetting(id,fallback){
  const s=load('cw_settings',{});
  return s[id]!==undefined?s[id]:fallback;
}
function getWebhookUrl(id){
  return getSetting(id,'')||'';
}

const INTEGRATION_URLS={
  'Notion':'https://notion.so','Microsoft Outlook':'https://outlook.live.com',
  'Xero':'https://go.xero.com','Time to Pet':'https://www.timetopet.com',
  'Facebook Lead Ads':'https://business.facebook.com','Instagram':'https://business.instagram.com',
  'Calendly':'https://calendly.com','Typeform':'https://typeform.com',
  'Make.com':'https://www.make.com','Dropbox Sign':'https://sign.dropbox.com'
};
function openIntegration(name){
  const url=INTEGRATION_URLS[name];
  if(url) window.open(url,'_blank');
  showToast(`Opening ${name}...`,'🔌');
}

function renderSettings(){
  document.getElementById('integrations-list').innerHTML=INTEGRATIONS.map(i=>`
    <div class="integration-row">
      <div class="int-info">
        <div class="int-icon" style="background:${i.bg}">${i.icon}</div>
        <div><div class="int-name">${i.name}</div><div class="int-desc">${i.desc}</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="int-status ${i.status==='connected'?'int-connected':i.status==='pending'?'int-pending':'int-disconnected'}">
          ${i.status==='connected'?'● Connected':i.status==='pending'?'◌ Setup needed':'○ Not connected'}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="openIntegration('${i.name}')">${i.status==='connected'?'Manage':'Connect'}</button>
      </div>
    </div>`).join('');

  const userLog=load('cw_log',[]);
  const allLog=[...userLog,...AUTOMATION_LOG_BASE].slice(0,12);
  document.getElementById('auto-log').innerHTML=allLog.map(al=>`
    <div class="al-item">
      <div class="al-icon-wrap al-${al.status}">${al.icon}</div>
      <div class="al-content"><div class="al-event">${al.event}</div><div class="al-detail">${al.detail}</div></div>
      <div class="al-time">${al.time}</div>
    </div>`).join('');
  loadSettings();
  renderWalkerConfig();
}

// ── AI DRAFT ──
// ── SMART REPLY GENERATOR ──
const MSG_TYPES=[
  {id:'welcome',label:'Welcome Reply',icon:'👋',desc:'Warm first response to a new enquiry',stages:['new']},
  {id:'followup',label:'Follow Up',icon:'📞',desc:'Check in after no reply',stages:['new','contacted']},
  {id:'info',label:'Service Info',icon:'📋',desc:'Detailed services and pricing',stages:['new','contacted','qualified']},
  {id:'close',label:'Close the Deal',icon:'🎯',desc:'Nudge a qualified lead to commit',stages:['qualified']},
  {id:'reengage',label:'Re-engage',icon:'💬',desc:'Win back a quiet or dropping client',stages:['contacted','qualified']},
  {id:'uncontactable',label:'Can\'t Reach You',icon:'📱',desc:'Tried calling/messaging, no response',stages:['uncontactable']},
  {id:'uncontactable2',label:'Final Attempt',icon:'👋',desc:'Last try before closing out',stages:['uncontactable']},
  {id:'notinterested',label:'Door Open',icon:'🚪',desc:'Respect their decision, leave door open',stages:['not-interested']},
  {id:'winback',label:'Win Back',icon:'🔄',desc:'Re-approach after time has passed',stages:['not-interested','closed-lost','archived']},
  {id:'notsuitable',label:'Not the Right Fit',icon:'🙏',desc:'Polite decline',stages:['not-suitable','closed-lost']},
  {id:'closedwon',label:'Welcome Aboard',icon:'🎉',desc:'Confirm conversion and next steps',stages:['closed-won']},
];

function getSmartContext(e){
  if(!e) return {name:'there',dog:'your dog',breed:'',suburb:'',walker:getSetting('s-your-name','Jess'),biz:getSetting('s-biz-name',"Chilly's Dog Adventures")};
  const name=e.name?.split(' ')[0]||e.name||'there';
  const fullName=e.name||'';
  const dog=e.dogName||'your dog';
  const breed=e.dogBreed||'';
  const suburb=e.suburb||e.postCode||'';
  const source=(e.source||e.channel||'').toLowerCase();
  const stage=e.stage||'new';
  const notes=e.notes||'';
  const services=e.services||e.enquiryType||'';
  const preferredDays=e.preferredDays||'';
  const walker=getSetting('s-your-name','Jess');
  const biz=getSetting('s-biz-name',"Chilly's Dog Adventures");
  const daysSinceEnquiry=e.dateAdded?Math.floor((new Date()-new Date(e.dateAdded+'T00:00:00'))/(864e5)):0;
  const isFromAd=source.includes('meta')||source.includes('facebook')||source.includes('instagram');
  const isReferral=source.includes('referral');
  const isFromWeb=source.includes('website')||source.includes('google');

  // TTP client check
  const ttpClient=clients.find(c=>(c.name||'').toLowerCase().includes(name.toLowerCase()));
  const isExistingClient=!!ttpClient;

  // SOCIAL PROOF — clients in their suburb
  const suburbClients=clients.filter(c=>c.suburb&&suburb&&c.suburb.toLowerCase().includes(suburb.toLowerCase())&&c.status==='active');
  const suburbClientCount=suburbClients.length;

  // TOTAL active clients + walks for credibility
  const totalActiveClients=clients.filter(c=>c.status==='active').length;

  // BREED INTELLIGENCE — what do similar breeds do?
  const breedHooks={
    'cavoodle':['social butterflies of the group','absolutely thrive on our adventures','one of our most popular breeds'],
    'spoodle':['such happy walkers','love the social aspect of group walks','always the life of the party'],
    'labradoodle':['have the best energy for our adventures','love a good long walk','always up for an explore'],
    'golden retriever':['born adventurers','the happiest walkers we have','love every second outdoors'],
    'french bulldog':['do great on our shorter solo walks','love their one-on-one time','such characters'],
    'kelpie':['need the exercise and stimulation our adventures provide','have incredible energy','thrive with regular walks'],
    'border collie':['are incredibly smart and love the mental stimulation of new routes','thrive on our adventures','need the outlet our walks provide'],
    'dachshund':['are surprisingly great walkers','love to explore at their own pace','have more energy than people think'],
    'maltese':['do wonderfully on our gentler group walks','love the social time','are always crowd favourites'],
    'beagle':['are born sniffers — our walks are basically a sniff safari for them','love exploring new routes','have the best noses in the pack'],
    'rottweiler':['do really well with our experienced walkers','are gentle giants on our walks','respond great to our structured walks'],
    'samoyed':['are absolute showstoppers on walks','love the cooler Melbourne weather for adventures','always make friends'],
    'australian shepherd':['need the exercise and mental stimulation our adventures provide','are incredibly smart walkers','thrive on variety'],
  };
  const breedLower=breed.toLowerCase();
  const breedHook=Object.entries(breedHooks).find(([b])=>breedLower.includes(b));
  const breedComment=breedHook?pickRandom(breedHook[1]):'';

  // NOTES INTELLIGENCE — detect concerns
  const notesLower=notes.toLowerCase();
  const isReactive=notesLower.includes('reactive')||notesLower.includes('aggressive')||notesLower.includes('nervous')||notesLower.includes('anxious');
  const isPuppy=notesLower.includes('puppy')||notesLower.includes('pup')||notesLower.includes('young');
  const isBudgetConscious=notesLower.includes('price')||notesLower.includes('cost')||notesLower.includes('budget')||notesLower.includes('expensive');
  const hasMedical=notesLower.includes('medical')||notesLower.includes('medication')||notesLower.includes('surgery')||notesLower.includes('health');

  return {name,fullName,dog,breed,suburb,source,stage,notes,services,preferredDays,walker,biz,
    daysSinceEnquiry,isFromAd,isReferral,isFromWeb,isExistingClient,ttpClient,
    suburbClientCount,totalActiveClients,breedComment,
    isReactive,isPuppy,isBudgetConscious,hasMedical};
}

function pickRandom(arr){return Array.isArray(arr)?arr[Math.floor(Math.random()*arr.length)]:arr;}

function generateSmartDraft(){
  const e=currentAiEnqId?enquiries.find(x=>x.id===currentAiEnqId):null;
  const typeSelect=document.getElementById('smart-msg-type');
  const msgType=typeSelect?.value||'welcome';
  const ctx=getSmartContext(e);
  const preview=document.getElementById('ai-draft-preview');
  const d=ctx.dog,dn=d!=='your dog';// shorthand

  // SOCIAL PROOF
  let socialProof='';
  if(ctx.suburbClientCount>=3) socialProof=`We walk ${ctx.suburbClientCount} other dogs in ${ctx.suburb}, so we know the area well.`;
  else if(ctx.suburbClientCount>=1) socialProof=`We already service ${ctx.suburb} regularly.`;
  else if(ctx.totalActiveClients>=10) socialProof=`We currently look after ${ctx.totalActiveClients}+ dogs across Melbourne's south-east.`;

  // BREED HOOK
  let breedLine='';
  if(ctx.breedComment&&dn) breedLine=`${ctx.breed}s ${ctx.breedComment}. ${d} would do well with us.`;
  else if(ctx.breed&&dn) breedLine=`We walk a number of ${ctx.breed}s and they tend to do really well with our team.`;

  // CONCERN HANDLING
  let concernLine='';
  if(ctx.isReactive) concernLine=`We're well set up for dogs that need a bit more space. Our solo walk option keeps things calm and controlled, and all our walkers are experienced with reactive dogs.`;
  else if(ctx.isPuppy) concernLine=`We love working with young dogs. We adjust the pace and duration, keep introductions gentle, and make sure they're comfortable throughout.`;
  else if(ctx.hasMedical) concernLine=`Happy to accommodate any health needs. Our walkers are experienced with dogs that require a bit of extra attention.`;
  else if(ctx.isBudgetConscious) concernLine=`We have options at different price points. Group walks are the most affordable, and we offer multi-day rates that bring the per-walk cost down.`;

  // NOTES
  let notesRef='';
  if(ctx.notes&&ctx.notes.length>5&&!ctx.isReactive&&!ctx.isPuppy&&!ctx.hasMedical){
    notesRef=`You mentioned "${ctx.notes.substring(0,80).trim()}${ctx.notes.length>80?'...':''}" — happy to discuss this further.`;
  }

  // PREFERRED DAYS
  let daysRef=ctx.preferredDays?`${ctx.preferredDays} works well with our current schedule.`:'';

  let draft='';

  if(msgType==='welcome'){
    draft=`Hey ${ctx.name},

Thanks for getting in touch${ctx.isReferral?' — love getting referrals':''}.${dn?` Would be great to look after ${d}${ctx.breed?' the '+ctx.breed:''}`:''}.${breedLine?` ${breedLine}`:''}${socialProof?`\n\n${socialProof}`:''}${concernLine?`\n\n${concernLine}`:''}

Here's a quick rundown on what we do:

- 2-Hour Dog Adventures — off-lead exploring, sniffing, socialising. ${dn?d+' would':'Dogs'} come home tired and happy. It's our most popular one.
- Private Solo Walks (45-60 min) — one-on-one, great for dogs that like their own space.
- Group Walks (45-60 min) — small group of friendly dogs, good value.

Every walk comes with GPS tracking, photos, and a report card sent straight to your phone.${notesRef?`\n\n${notesRef}`:''}${daysRef?`\n\n${daysRef}`:''}

First step would be a quick meet & greet — I come to you, meet ${dn?d:'your dog'}, and we figure out what works best. About 15 mins, totally free.

Happy to lock in a time if you're keen.

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='followup'){
    draft=`Hey ${ctx.name},

Just checking in${ctx.daysSinceEnquiry>7?' — hope my last message came through okay':''}.  Still thinking about walks for ${dn?d:'your dog'}?${socialProof?`\n\n${socialProof}`:''}${breedLine&&ctx.daysSinceEnquiry>7?`\n\n${breedLine}`:''}

Happy to answer any questions or send through some info. And if the timing isn't right, no worries at all — just let me know.${ctx.suburb?`\n\nCan also send some photos from recent walks in ${ctx.suburb} if you'd like to see what we get up to.`:''}

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='info'){
    draft=`Hey ${ctx.name},

Here's the full rundown on what we offer.${breedLine?` ${breedLine}`:''}${socialProof?` ${socialProof}`:''}

OUR SERVICES

2-Hour Dog Adventure
Off-lead exploring across Melbourne's best parks. Proper enrichment — sniffing, socialising, running around. ${dn?d+' would':'Dogs'} come home settled and happy. It's what we're known for.

Private Solo Walk (45-60 min)
One-on-one with our walker. Good for dogs that prefer their own space${ctx.isReactive?', or need a calmer environment':''}.

Group Walk (45-60 min)
Small group of friendly dogs. Great value and good for socialisation.${concernLine?`\n\n${concernLine}`:''}

EVERY WALK INCLUDES
- GPS tracking
- Photos sent after each walk
- Walk report card
- Full insurance
- Managed through our app

HOW IT WORKS
1. Free meet & greet — we come to you (15 mins, no commitment)
2. Quick online form (5 mins)
3. Sign T&Cs digitally
4. First walk booked${daysRef?`\n\n${daysRef}`:''}

Most people are walking within a week of the meet & greet. Want me to come meet ${dn?d:'your dog'}?

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='close'){
    draft=`Hey ${ctx.name},

Just wanted to check in — keen to get ${dn?d:'your dog'} started?${socialProof?`\n\n${socialProof}`:''}\n\n${ctx.suburb?`We've got availability in ${ctx.suburb}`:'We have spots open'} and could have ${dn?d:'your dog'} out with us as early as next week.${daysRef?` ${daysRef}`:''}

All we need to do is a quick meet & greet — I come to you, takes about 15 mins, no commitment.

Let me know when suits and I'll lock it in.

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='reengage'){
    draft=`Hey ${ctx.name},

Hope you and ${dn?d:'your dog'} are going well. Just wanted to touch base as it's been a bit quiet.${ctx.isExistingClient?`\n\nWe've really enjoyed having ${dn?d:'your dog'} with us. If anything's changed on your end — schedule, needs, whatever it might be — happy to chat about it.`:`\n\nI know the timing might not have been right before. If things have changed and you're thinking about walks again, we'd love to help.`}${socialProof?`\n\n${socialProof}`:''}

No pressure at all — just wanted to check in.

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='uncontactable'){
    draft=`Hey ${ctx.name},

I've tried reaching out a couple of times about walks for ${dn?d:'your dog'} but haven't been able to get through.

If you're still interested, just reply here or give me a call whenever suits — happy to work around your schedule.

No stress if the timing's off. Just didn't want you to think we'd forgotten about you.

${ctx.walker}
0430 921 951`;

  }else if(msgType==='uncontactable2'){
    draft=`Hey ${ctx.name},

Just me one last time. I've tried a few times but no luck getting through.

I'll close this off for now, but if you ever want to revisit walks for ${dn?d:'your dog'}, my number's below — no expiry on the offer.

All the best!

${ctx.walker}
0430 921 951`;

  }else if(msgType==='notinterested'){
    draft=`Hey ${ctx.name},

Totally understand — appreciate you letting me know.

If anything changes down the track or ${dn?d+' needs':'you need'} a hand, we're here. No need to re-explain anything, I've got all your details saved.

Hope ${dn?d+' is':'you\'re'} going well!

${ctx.walker}`;

  }else if(msgType==='winback'){
    draft=`Hey ${ctx.name},

It's been a while — hope you and ${dn?d:'your dog'} are doing well!

Just wanted to reach out as we've had a few spots open up${ctx.suburb?' in '+ctx.suburb:''}. If things have changed and walks are back on the radar, I'd love to help.

No pressure — just thought I'd put it out there.

${ctx.walker}
${ctx.biz}`;

  }else if(msgType==='closedwon'){
    draft=`Hey ${ctx.name},

So great to have ${dn?d:'you'} on board! Welcome to the pack.

Quick next steps:
1. Fill in ${dn?d+"'s":'the'} profile — [LINK]
2. Sign T&Cs — [LINK]
3. First walk: [DATE] at [TIME]

You'll get a login to our app where you can see walk updates, photos and invoices after each session.

Any questions at all, just text me.

${ctx.walker}`;

  }else if(msgType==='notsuitable'){
    draft=`Hey ${ctx.name},

Thanks for chatting with us about ${dn?d:'walks'}.

After giving it some thought, I don't think we're the right fit for this one${ctx.isReactive?` given what you've mentioned about ${d}`:ctx.notes?' — '+ctx.notes.substring(0,60).trim():''}.${ctx.suburb?` Happy to point you towards another good walker in ${ctx.suburb} if that'd help.`:''}

Thanks again, and feel free to reach out if anything changes down the track.

${ctx.walker}
${ctx.biz}`;
  }

  aiDraftText=draft;
  preview.textContent=draft;
  preview.style.fontStyle='normal';
  preview.style.color='var(--ink)';
  showToast('Smart reply generated','✨');
  logEvent('Smart reply generated',`${ctx.fullName||'Unknown'} — ${msgType}`,'success','✨');
}

function openAiDraft(enqId){
  currentAiEnqId=enqId;
  const e=enquiries.find(x=>x.id===enqId);
  const ctx=getSmartContext(e);
  const stage=e?.stage||'new';

  // Auto-recommend message type based on stage
  const recommended=MSG_TYPES.find(t=>t.stages.includes(stage))||MSG_TYPES[0];

  document.getElementById('ai-draft-body').innerHTML=`
    ${e?`<div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px;margin-bottom:14px;border:1px solid var(--border-light)">
      <div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">${esc(e.name)}${ctx.dog!=='your dog'?' · 🐶 '+esc(ctx.dog)+(ctx.breed?' ('+esc(ctx.breed)+')':''):''}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--ink-light)">
        <span>${STAGES.find(s=>s.id===stage)?.label||stage}</span>
        ${ctx.suburb?`<span>· 📍 ${esc(ctx.suburb)}</span>`:''}
        ${ctx.source?`<span>· via ${esc(ctx.source)}</span>`:''}
        ${ctx.services?`<span>· ${esc(ctx.services)}</span>`:''}
        ${ctx.preferredDays?`<span>· ${esc(ctx.preferredDays)}</span>`:''}
        ${ctx.daysSinceEnquiry>0?`<span>· ${ctx.daysSinceEnquiry}d ago</span>`:''}
      </div>
      ${ctx.notes?`<div style="font-size:11px;color:var(--ink-light);margin-top:6px;padding-top:6px;border-top:1px solid var(--border-light)">📝 ${esc(ctx.notes.substring(0,150))}${ctx.notes.length>150?'...':''}</div>`:''}
      ${ctx.isExistingClient?`<div style="font-size:11px;color:var(--success);margin-top:4px">✅ Also a TTP client — ${ctx.ttpClient.futureWalks||0} upcoming walks</div>`:''}
    </div>`:''}
    <div style="margin-bottom:14px">
      <label style="font-size:11px;font-weight:600;color:var(--ink-light)">Message Type</label>
      <select id="smart-msg-type" style="display:block;width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;font-family:Inter,sans-serif">
        ${MSG_TYPES.map(t=>`<option value="${t.id}" ${t.id===recommended.id?'selected':''}>${t.icon} ${t.label} — ${t.desc}</option>`).join('')}
      </select>
    </div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--ink-xlight);margin-bottom:8px">Preview — click Generate to create</div>
    <div class="ai-preview" id="ai-draft-preview" style="white-space:pre-wrap;min-height:120px;color:var(--ink-xlight);font-style:italic">Click "✨ Generate" to create a personalised reply using all available context.</div>`;
  openModal('modal-ai-draft');
}

function openAiDraftNew(){
  const newEnq=enquiries.filter(e=>['new','contacted','qualified'].includes(e.stage));
  if(newEnq.length>0)openAiDraft(newEnq[0].id);
  else{currentAiEnqId=null;openAiDraft(null);}
}

function openAiDraftFromEmail(emailId){
  const m=EMAILS.find(e=>e.id===emailId);
  const enq=enquiries.find(e=>e.name===m?.from||e.email===m?.email);
  if(enq)openAiDraft(enq.id);
  else openAiDraftNew();
}

function copyAiDraft(){
  if(!aiDraftText){showToast('Generate a draft first','⚠️');return;}
  navigator.clipboard.writeText(aiDraftText).then(()=>{
    logEvent('Smart reply copied','Copied to clipboard','info','✨');
    showToast('Copied!','📋');
    closeModal('modal-ai-draft');
  });
}

function sendAiDraftEmail(){
  if(!aiDraftText){showToast('Generate a draft first','⚠️');return;}
  const e=enquiries.find(x=>x.id===currentAiEnqId);
  const to=e?.email||'';
  const dog=e?.dogName||'';
  const subject=dog?`Re: Dog Walking — ${dog}`:'Re: Dog Walking Enquiry';
  composeEmail(to,subject,aiDraftText);
  closeModal('modal-ai-draft');
}

function fillTemplate(body,e){
  return (body||'')
    .replace(/\{name\}/g,e?.name?.split(' ')[0]||e?.name||'there')
    .replace(/\{dog_name\}/g,e?.dogName||'your dog')
    .replace(/\{walker_name\}/g,getSetting('s-your-name','Jess'))
    .replace(/\{business_name\}/g,getSetting('s-biz-name',"Chilly's Dog Adventures"));
}

// ── ENQUIRY CRUD ──
function openAddEnquiry(){
  editingId=null;
  document.getElementById('modal-enq-title').textContent='New Enquiry';
  document.getElementById('btn-del-enq').style.display='none';
  document.getElementById('log-contact-group').style.display='none';
  ['f-name','f-phone','f-email','f-dogname','f-breed','f-services','f-followup','f-notes','f-suburb'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('f-stage').value='new';
  document.getElementById('f-channel').value='WhatsApp';
  document.getElementById('f-source').value='Meta Ads';
  openModal('modal-enq');
}

function openEditEnquiry(id){
  const e=enquiries.find(x=>x.id===id);if(!e)return;
  editingId=id;
  document.getElementById('modal-enq-title').textContent='Edit Enquiry — '+e.name;
  document.getElementById('btn-del-enq').style.display='inline-flex';
  document.getElementById('log-contact-group').style.display='block';
  document.getElementById('f-name').value=e.name||'';
  document.getElementById('f-phone').value=e.phone||'';
  document.getElementById('f-email').value=e.email||'';
  document.getElementById('f-channel').value=e.channel||'WhatsApp';
  document.getElementById('f-dogname').value=e.dogName||'';
  document.getElementById('f-breed').value=e.dogBreed||'';
  document.getElementById('f-services').value=e.services||'';
  document.getElementById('f-stage').value=e.stage||'new';
  document.getElementById('f-followup').value=e.followup||'';
  document.getElementById('f-notes').value=e.notes||'';
  document.getElementById('f-suburb').value=e.suburb||'';
  document.getElementById('f-source').value=e.source||'Meta Ads';
  openModal('modal-enq');
}

function logContact(action){
  const notesEl=document.getElementById('f-notes');
  const dateStr=new Date().toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
  const timeStr=new Date().toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',hour12:true});
  const entry=`[${dateStr} ${timeStr}] ${action}`;
  notesEl.value=entry+(notesEl.value?'\n'+notesEl.value:'');
  notesEl.focus();
  showToast(action+' logged','✅');
}

function saveEnquiry(){
  const name=document.getElementById('f-name').value.trim();
  if(!name){document.getElementById('f-name').style.borderColor='var(--danger)';return;}
  document.getElementById('f-name').style.borderColor='';
  const oldEnq=editingId?enquiries.find(x=>x.id===editingId):null;
  const data={
    id:editingId||('e'+Date.now()),name,
    phone:document.getElementById('f-phone').value.trim(),
    email:document.getElementById('f-email').value.trim(),
    channel:document.getElementById('f-channel').value,
    dogName:document.getElementById('f-dogname').value.trim(),
    dogBreed:document.getElementById('f-breed').value.trim(),
    services:document.getElementById('f-services').value.trim(),
    stage:document.getElementById('f-stage').value,
    followup:document.getElementById('f-followup').value||null,
    notes:document.getElementById('f-notes').value.trim(),
    suburb:document.getElementById('f-suburb').value.trim(),
    source:document.getElementById('f-source').value,
    dateAdded:editingId?oldEnq?.dateAdded:today(),
  };
  if(editingId){
    if(oldEnq&&oldEnq.stage!==data.stage){
      logEvent('Stage changed',`${name}: ${STAGES.find(s=>s.id===oldEnq.stage)?.label} → ${STAGES.find(s=>s.id===data.stage)?.label}`);
      if(data.stage==='qualified') fireWebhook('stage-onboarding',data);
      if(data.stage==='closed-won') fireWebhook('client-converted',data)/*closed-won*/;
    }
    enquiries=enquiries.map(x=>x.id===editingId?data:x);
    showToast('Enquiry updated');
    // Sync to Notion
    authFetch('/api/notion/enquiries/'+editingId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(()=>{});
  }else{
    logEvent('Enquiry added',`${name} → ${STAGES[0].label} (via ${data.channel})`,'success','📥');
    // Create in Notion, use returned ID
    authFetch('/api/notion/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      .then(r=>r.ok?r.json():null).then(saved=>{if(saved){data.id=saved.id;save('cw_enq',enquiries);}}).catch(()=>{});
    enquiries.push(data);
    fireWebhook('new-enquiry',data);
    showToast('Enquiry added to pipeline 🎉');
  }
  save('cw_enq',enquiries);
  closeModal('modal-enq');
  renderPipeline();updateBadges();
}

function deleteEnquiry(){
  if(!editingId||!confirm('Delete this enquiry? This cannot be undone.'))return;
  const delId=editingId;
  enquiries=enquiries.filter(x=>x.id!==delId);
  localStorage.removeItem('cw_ob_'+delId);
  save('cw_enq',enquiries);
  closeModal('modal-enq');renderPipeline();updateBadges();
  showToast('Enquiry deleted','🗑️');
  // Archive in Notion
  authFetch('/api/notion/enquiries/'+delId,{method:'DELETE'}).catch(()=>{});
}

// ── MODAL ──
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('.modal-overlay').forEach(el=>{
  el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id);});
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(el=>closeModal(el.id));
});

// ── DAILY ROUTE PLANNER ──
let rpMap=null;
let rpRouteLayer=null;
let rpAllWalks=null;

function rpNavDay(offset){
  const input=document.getElementById('rp-nav-date');
  const d=new Date(input.value+'T00:00:00');
  d.setDate(d.getDate()+offset);
  input.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  renderRoutePlanner();
}

async function renderRoutePlanner(){
  const dateInput=document.getElementById('rp-nav-date');
  if(!dateInput.value) dateInput.value=new Date().toISOString().split('T')[0];
  const selectedDate=dateInput.value;
  const walkerFilter=document.getElementById('rp-walker-filter')?.value||'';
  const statsEl=document.getElementById('rp-nav-stats');
  const listEl=document.getElementById('rp-route-list');

  // Fetch walks if not cached
  if(!rpAllWalks){
    rpAllWalks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  }

  // Fetch client locations if not loaded
  if(!covClientLocations.length){
    try{
      const summary=await fetch('/api/data/summary').then(r=>r.ok?r.json():null).catch(()=>null);
      covClientLocations=(summary?.clientLocations||[]).filter(c=>c.lat&&c.lng);
    }catch{}
  }

  // Filter walks for selected date
  const KNOWN_WALKERS=['Jessica Lauritz','Alex Cass'];
  const isKnown=name=>KNOWN_WALKERS.some(k=>(name||'').toLowerCase().includes(k.split(' ')[0].toLowerCase()));
  let dayWalks=rpAllWalks.filter(w=>w.date===selectedDate);
  // Assign unknown walkers to known ones (same fix as buildShiftsFromWalks)
  dayWalks=dayWalks.map(w=>{
    if(!isKnown(w.walker)){
      const known=dayWalks.find(x=>x.date===w.date&&isKnown(x.walker));
      return {...w,walker:known?known.walker:KNOWN_WALKERS[0]};
    }
    return w;
  });
  if(walkerFilter) dayWalks=dayWalks.filter(w=>(w.walker||'').toLowerCase().includes(walkerFilter.toLowerCase()));

  // Sort by time
  dayWalks.sort((a,b)=>(a.start||'').localeCompare(b.start||''));

  // Match walks to client locations
  const cleanName=s=>(s||'').replace(/\s*\(.*$/,'').replace(/\+$/g,'').trim().toLowerCase();
  const locMap={};
  covClientLocations.forEach(c=>{locMap[cleanName(c.name)]=c});

  const stops=dayWalks.map(w=>{
    const loc=locMap[cleanName(w.client)];
    return {
      ...w,
      clientClean:(w.client||'').replace(/\s*\(.*$/,'').trim(),
      lat:loc?.lat||null,
      lng:loc?.lng||null,
      suburb:loc?.suburb||'',
      petNames:loc?.petNames||'',
      hasLocation:!!(loc?.lat),
    };
  });

  const locatedStops=stops.filter(s=>s.hasLocation);
  const unlocatedStops=stops.filter(s=>!s.hasLocation);
  const baseLat=getBaseLat(),baseLng=getBaseLng();

  // Calculate distances for current schedule order
  function routeDistance(route){
    let dist=0;
    let prev={lat:baseLat,lng:baseLng};
    route.forEach(s=>{
      dist+=haversine(prev.lat,prev.lng,s.lat,s.lng);
      prev=s;
    });
    return dist;
  }
  const currentDist=routeDistance(locatedStops);
  const currentKm=currentDist/1000;
  const currentMins=Math.round(currentKm/40*60);
  const suburbs=[...new Set(stops.map(s=>s.suburb).filter(Boolean))];

  // Check for backtracking (drive > 5km between consecutive stops)
  const legs=[];
  let prevStop={lat:baseLat,lng:baseLng,clientClean:'Base'};
  locatedStops.forEach(s=>{
    const dist=haversine(prevStop.lat,prevStop.lng,s.lat,s.lng);
    const isLong=dist>5000;
    legs.push({from:prevStop.clientClean,to:s.clientClean,dist,isLong});
    prevStop=s;
  });
  const longLegs=legs.filter(l=>l.isLong);

  // Compare with optimised to show potential savings
  const optimised=optimiseRoute(locatedStops,baseLat,baseLng);
  const optimisedDist=routeDistance(optimised);
  const savingKm=Math.max(0,(currentDist-optimisedDist)/1000);

  // Stats
  if(statsEl){
    statsEl.innerHTML=`
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${dayWalks.length}</div><div class="rp-weekly-lbl">Walks</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${suburbs.length}</div><div class="rp-weekly-lbl">Suburbs</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${currentKm.toFixed(1)}km</div><div class="rp-weekly-lbl">Total Driving</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">~${currentMins}min</div><div class="rp-weekly-lbl">Drive Time</div></div>
      ${longLegs.length?`<div class="rp-weekly-stat" style="border-color:var(--warning)"><div class="rp-weekly-val" style="color:var(--warning)">${longLegs.length}</div><div class="rp-weekly-lbl">Long Drives (5km+)</div></div>`:''}
      ${savingKm>1?`<div class="rp-weekly-stat" style="border-color:var(--info)"><div class="rp-weekly-val" style="color:var(--info)">${savingKm.toFixed(1)}km</div><div class="rp-weekly-lbl">Potential Saving</div></div>`:''}
    `;
  }

  // Route list — ACTUAL SCHEDULE ORDER (not reordered)
  if(!dayWalks.length){
    listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No walks scheduled for this date</div>';
  }else{
    let html='<div style="padding:8px 12px;background:var(--cream);border-radius:var(--radius-sm);margin-bottom:8px;font-size:11px;font-weight:600;color:var(--ink-light)">Today\'s Schedule — Drive Route</div>';

    // Base start
    html+=`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border-light)">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">🏠</div>
      <div><div style="font-size:13px;font-weight:700">Base — Ormond</div><div style="font-size:11px;color:var(--ink-light)">Start point</div></div>
    </div>`;

    let prev={lat:baseLat,lng:baseLng};
    // Show ALL stops (located first in schedule order, then unlocated)
    const scheduleOrder=[...locatedStops];
    scheduleOrder.forEach((s,i)=>{
      const dist=haversine(prev.lat,prev.lng,s.lat,s.lng);
      const distLabel=dist<1000?Math.round(dist)+'m':(dist/1000).toFixed(1)+'km';
      const driveMins=Math.round(dist/1000/40*60);
      const isLong=dist>5000;

      html+=`<div style="padding:2px 12px 2px 24px;font-size:10px;color:${isLong?'var(--warning)':'var(--ink-xlight)'}">↓ ${distLabel} · ~${driveMins}min drive${isLong?' ⚠️':''}</div>`;
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border-light);cursor:pointer${isLong?';background:var(--warning-bg)':''}" onclick="if(rpMap)rpMap.setView([${s.lat},${s.lng}],15)">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--orange);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700">${esc(s.clientClean)}</div>
          <div style="font-size:11px;color:var(--ink-light)">${s.suburb?s.suburb+' · ':''}${s.time||''} · ${esc(s.service||'')}</div>
        </div>
        <div style="font-size:11px;color:var(--ink-muted);text-align:right">${s.walker?esc(s.walker.split(' ')[0]):''}</div>
      </div>`;
      prev=s;
    });

    // Insights
    if(longLegs.length||savingKm>1){
      html+=`<div style="margin-top:10px;padding:10px 12px;background:var(--cream);border-radius:var(--radius-sm);border:1px solid var(--border-light)">
        <div style="font-size:11px;font-weight:700;color:var(--ink-mid);margin-bottom:6px">Route Insights</div>`;
      if(longLegs.length){
        html+=longLegs.map(l=>`<div style="font-size:11px;color:var(--warning);margin-bottom:3px">⚠️ ${(l.dist/1000).toFixed(1)}km drive from ${esc(l.from)} → ${esc(l.to)}</div>`).join('');
      }
      if(savingKm>1){
        html+=`<div style="font-size:11px;color:var(--info);margin-top:4px">💡 Optimised route could save ~${savingKm.toFixed(1)}km (${Math.round(savingKm/40*60)}min) — but may require schedule changes</div>`;
      }
      html+=`</div>`;
    }

    // Unlocated clients
    if(unlocatedStops.length){
      html+=`<div style="padding:10px 12px;margin-top:8px;background:var(--warning-bg);border-radius:var(--radius-sm);border:1px solid var(--warning)">
        <div style="font-size:11px;font-weight:700;color:var(--warning);margin-bottom:6px">⚠ ${unlocatedStops.length} client${unlocatedStops.length>1?'s':''} need addresses</div>
        ${unlocatedStops.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
          <span>${esc(s.clientClean)}</span>
          <input type="text" placeholder="Enter address..." style="flex:1;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:11px" id="rp-addr-${esc(s.clientClean.replace(/\s/g,'_'))}">
          <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px" onclick="addRouteAddress('${esc(s.clientClean)}')">Add</button>
        </div>`).join('')}
      </div>`;
    }

    listEl.innerHTML=html;
  }

  // Map
  setTimeout(()=>{
    if(!rpMap){
      rpMap=L.map('rp-map',{zoomControl:true}).setView([baseLat,baseLng],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'&copy; OSM',maxZoom:19
      }).addTo(rpMap);
    }

    // Clear previous route
    if(rpRouteLayer){rpMap.removeLayer(rpRouteLayer)}
    rpRouteLayer=L.layerGroup().addTo(rpMap);

    if(!locatedStops.length){rpMap.invalidateSize();return}

    // Base pin
    L.circleMarker([baseLat,baseLng],{radius:8,color:'#1A1A1A',fillColor:'#1A1A1A',fillOpacity:1,weight:2})
      .bindPopup('<strong>Base</strong>').addTo(rpRouteLayer);

    // Route line (actual schedule order, not optimised)
    const routeCoords=[[baseLat,baseLng],...locatedStops.map(s=>[s.lat,s.lng])];
    L.polyline(routeCoords,{color:'#F26B21',weight:3,opacity:0.7,dashArray:'8,8'}).addTo(rpRouteLayer);

    // Highlight long legs in red
    let prevCoord=[baseLat,baseLng];
    locatedStops.forEach(s=>{
      const dist=haversine(prevCoord[0],prevCoord[1],s.lat,s.lng);
      if(dist>5000){
        L.polyline([prevCoord,[s.lat,s.lng]],{color:'#dc2626',weight:4,opacity:0.8}).addTo(rpRouteLayer);
      }
      prevCoord=[s.lat,s.lng];
    });

    // Stop pins (schedule order)
    locatedStops.forEach((s,i)=>{
      const marker=L.circleMarker([s.lat,s.lng],{radius:14,color:'#fff',fillColor:'#F26B21',fillOpacity:1,weight:2})
        .bindPopup(`<strong>${i+1}. ${esc(s.clientClean)}</strong><br>${s.suburb||''}<br>${s.time||''} · ${esc(s.service||'')}`)
        .addTo(rpRouteLayer);
      // Number label
      L.marker([s.lat,s.lng],{icon:L.divIcon({className:'',html:`<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;pointer-events:none">${i+1}</div>`,iconSize:[28,28],iconAnchor:[14,14]})}).addTo(rpRouteLayer);
    });

    // Fit bounds
    const bounds=L.latLngBounds(routeCoords);
    rpMap.fitBounds(bounds,{padding:[30,30]});
    rpMap.invalidateSize();
  },100);
}

function optimiseRoute(stops,startLat,startLng){
  if(stops.length<=1) return [...stops];
  const remaining=[...stops];
  const result=[];
  let current={lat:startLat,lng:startLng};

  while(remaining.length){
    let nearestIdx=0,nearestDist=Infinity;
    remaining.forEach((s,i)=>{
      const d=haversine(current.lat,current.lng,s.lat,s.lng);
      if(d<nearestDist){nearestDist=d;nearestIdx=i}
    });
    const next=remaining.splice(nearestIdx,1)[0];
    result.push(next);
    current=next;
  }
  return result;
}

async function addRouteAddress(clientName){
  const inputId='rp-addr-'+clientName.replace(/\s/g,'_');
  const input=document.getElementById(inputId);
  if(!input||!input.value.trim()) return;

  const addr=input.value.trim()+', VIC, Australia';
  input.disabled=true;

  try{
    const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=au`,{headers:{'User-Agent':'ChillysBusinessHub/1.0'}});
    const data=await res.json();
    if(data.length){
      const loc={name:clientName,lat:parseFloat(data[0].lat),lng:parseFloat(data[0].lon),suburb:'',petNames:''};
      covClientLocations.push(loc);
      showToast('Address added for '+clientName,'📍');
      renderRoutePlanner();
    }else{
      showToast('Could not find that address','⚠️');
      input.disabled=false;
    }
  }catch{
    showToast('Geocoding failed','⚠️');
    input.disabled=false;
  }
}

// ── COVERAGE MAP ──
// Pre-geocoded client locations from /api/data/summary (clientLocations)
// Active/inactive status determined by matching against live TTP clients array

let covMap=null;
let covMarkers=null;
let covFilter='all'; // 'all','active','inactive'
let covClientLocations=[]; // Pre-geocoded from client-locations.json
let covDataLoaded=false;
let covActiveTab='clients';

function setCovFilter(f){
  covFilter=f;
  document.querySelectorAll('#cov-filters .filter-pill[data-covf]').forEach(el=>{
    el.classList.toggle('active',el.dataset.covf===f);
  });
  renderCovPins();
  renderCovSidebar();
  updateCovStats();
}

function setCovTab(tab){
  covActiveTab=tab;
  ['clients','parks','suburbs'].forEach(t=>{
    const el=document.getElementById('cov-tab-'+t);
    if(el) el.style.display=t===tab?'flex':'none';
  });
  document.querySelectorAll('[data-covtab]').forEach(el=>{
    el.classList.toggle('active',el.dataset.covtab===tab);
  });
  renderCovSidebar();
}

function getFilteredCovClients(){
  if(covFilter==='active') return covClientLocations.filter(c=>c._active);
  if(covFilter==='inactive') return covClientLocations.filter(c=>!c._active);
  return covClientLocations;
}

function findNearestParks(lat,lng,count){
  if(!offLeashParks.length) return [];
  return offLeashParks.map(p=>({...p,dist:haversine(lat,lng,p.lat,p.lng)}))
    .sort((a,b)=>a.dist-b.dist).slice(0,count);
}

async function renderCoverage(){
  // Fetch client locations if not loaded
  if(!covDataLoaded){
    covDataLoaded=true;
    try{
      const summary=await fetch('/api/data/summary').then(r=>r.ok?r.json():null).catch(()=>null);
      covClientLocations=(summary?.clientLocations||[]).filter(c=>c.lat&&c.lng);
    }catch{covClientLocations=[];}

    // Load parks if not already loaded
    if(!offLeashParks.length){
      try{offLeashParks=await fetch('/api/parks/offleash').then(r=>r.ok?r.json():[]).catch(()=>[]);}catch{offLeashParks=[];}
    }

  }

  // Determine active/inactive by matching against TTP clients array (recalc each render)
  // TTP names often include dog name: "Tony Tran (Teddy" — strip parenthetical part for matching
  const cleanName=s=>(s||'').replace(/\s*\(.*$/, '').replace(/\+$/g,'').trim().toLowerCase();
  const activeNames=new Set(clients.filter(c=>c.status==='active').map(c=>cleanName(c.name)));
  covClientLocations.forEach(loc=>{
    loc._active=activeNames.has(cleanName(loc.name));
  });

  // Init map
  setTimeout(()=>{
    if(!covMap){
      const baseLat=getBaseLat();
      const baseLng=getBaseLng();
      covMap=L.map('coverage-map',{zoomControl:true}).setView([baseLat,baseLng],12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        attribution:'&copy; OpenStreetMap contributors',maxZoom:19
      }).addTo(covMap);
    }
    renderCovPins();
    renderCovSidebar();
    updateCovStats();
    covMap.invalidateSize();
  },100);
}

function renderCovPins(){
  if(!covMap) return;
  const filtered=getFilteredCovClients();

  if(covMarkers) covMap.removeLayer(covMarkers);
  covMarkers=L.markerClusterGroup({
    maxClusterRadius:50,spiderfyOnMaxZoom:true,showCoverageOnHover:false,
    iconCreateFunction:function(cluster){
      const count=cluster.getChildCount();
      let c='#3b82f6';
      if(count>=5)c='#dc2626'; else if(count>=3)c='#F26B21';
      const sz=count>=5?44:count>=3?38:32;
      return L.divIcon({
        html:`<div style="background:${c};color:#fff;border-radius:50%;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;font-weight:800;font-family:Readex Pro,sans-serif;font-size:${count>=5?14:12}px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25)">${count}</div>`,
        className:'',iconSize:[sz,sz]
      });
    }
  });

  filtered.forEach(p=>{
    const color=p._active?'#F26B21':'#9ca3af';
    const icon=L.divIcon({
      html:`<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
      className:'',iconSize:[14,14],iconAnchor:[7,7]
    });
    const marker=L.marker([p.lat,p.lng],{icon});

    // Nearest 3 parks
    const nearest=findNearestParks(p.lat,p.lng,3);
    const nearestHtml=nearest.length?nearest.map(pk=>{
      const d=pk.dist<1000?Math.round(pk.dist)+'m':(pk.dist/1000).toFixed(1)+'km';
      return `<div style="font-size:10px;color:#6b7280;display:flex;justify-content:space-between"><span>${esc(pk.name)}</span><span style="color:var(--success);font-weight:600">${d}</span></div>`;
    }).join(''):'';

    const statusLabel=p._active?'Active':'Inactive';
    const statusColor=p._active?'#16a34a':'#9ca3af';
    const pets=(p.petNames||'').split(',').filter(Boolean).join(', ')||'--';

    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:200px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">${esc(p.name)}</div>
        <div style="font-size:11px;color:#a0a0a0;margin-bottom:2px">📍 ${esc(p.suburb||'')}</div>
        <div style="font-size:11px;margin-bottom:4px">Pets: <strong>${esc(pets)}</strong></div>
        <div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;color:${statusColor};background:${p._active?'#dcfce7':'#f3f4f6'};padding:2px 8px;border-radius:10px">${statusLabel}</span></div>
        ${nearestHtml?`<div style="border-top:1px solid #e5e7eb;padding-top:6px;margin-top:4px"><div style="font-size:10px;font-weight:600;color:var(--ink-mid);margin-bottom:3px">Nearest Parks</div>${nearestHtml}</div>`:''}
        <div style="margin-top:6px"><button onclick="showNearbyParks(${p.lat},${p.lng},'${esc(p.name).replace(/'/g,"\\'")}')" style="background:#dcfce7;border:1px solid #86efac;color:#16a34a;padding:3px 10px;border-radius:14px;font-size:10px;cursor:pointer;font-weight:600">Show all nearby parks</button></div>
      </div>`);
    covMarkers.addLayer(marker);
  });
  covMap.addLayer(covMarkers);
}

function renderCovSidebar(){
  const filtered=getFilteredCovClients();

  // ── Clients tab
  const clientsEl=document.getElementById('cov-tab-clients');
  if(clientsEl){
    const sorted=[...filtered].sort((a,b)=>(a.suburb||'').localeCompare(b.suburb||'')||(a.name||'').localeCompare(b.name||''));
    clientsEl.innerHTML=sorted.length?sorted.map(c=>{
      const color=c._active?'var(--success)':'var(--ink-xlight)';
      const pets=(c.petNames||'').split(',').filter(Boolean).join(', ');
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--cream);border-radius:var(--radius-sm);cursor:pointer;font-size:12px" onclick="covMap.setView([${c.lat},${c.lng}],16,{animate:true})">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div>
          <div style="font-size:10px;color:var(--ink-xlight)">${esc(c.suburb||'')}${pets?' · '+esc(pets):''}</div>
        </div>
      </div>`;
    }).join(''):'<div style="padding:16px;text-align:center;color:var(--ink-xlight);font-size:12px">No clients to show.</div>';
  }

  // ── Parks tab
  const parksEl=document.getElementById('cov-tab-parks');
  if(parksEl){
    const centre=covMap?covMap.getCenter():{lat:getBaseLat(),lng:getBaseLng()};
    const sorted=offLeashParks.map(p=>({...p,dist:haversine(centre.lat,centre.lng,p.lat,p.lng)})).sort((a,b)=>a.dist-b.dist).slice(0,50);
    parksEl.innerHTML=sorted.length?sorted.map(p=>{
      const d=p.dist<1000?Math.round(p.dist)+'m':(p.dist/1000).toFixed(1)+'km';
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--cream);border-radius:var(--radius-sm);cursor:pointer;font-size:12px" onclick="covMap.setView([${p.lat},${p.lng}],16,{animate:true})">
        <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
          <div style="font-size:10px;color:var(--ink-xlight)">${p.suburb?esc(p.suburb)+' · ':''}${d}${p.fenced?' · Fenced':''}</div>
        </div>
      </div>`;
    }).join(''):'<div style="padding:16px;text-align:center;color:var(--ink-xlight);font-size:12px">No parks loaded.</div>';
  }

  // ── Suburbs tab
  const suburbsEl=document.getElementById('cov-tab-suburbs');
  if(suburbsEl){
    const suburbMap={};
    filtered.forEach(c=>{
      const s=c.suburb||'Unknown';
      if(!suburbMap[s]) suburbMap[s]={count:0,lat:c.lat,lng:c.lng};
      suburbMap[s].count++;
      // Average the lat/lng for zoom
      suburbMap[s].lat=(suburbMap[s].lat+c.lat)/2;
      suburbMap[s].lng=(suburbMap[s].lng+c.lng)/2;
    });
    const sorted=Object.entries(suburbMap).sort((a,b)=>b[1].count-a[1].count);
    const maxCount=sorted.length?sorted[0][1].count:0;
    suburbsEl.innerHTML=sorted.length?sorted.map(([name,d])=>{
      const pct=maxCount?(d.count/maxCount)*100:0;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--cream);border-radius:var(--radius-sm);cursor:pointer;font-size:12px" onclick="covMap.setView([${d.lat},${d.lng}],14,{animate:true})">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${esc(name)}</div>
          <div style="height:4px;background:var(--cream-dark);border-radius:2px;margin-top:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--orange);border-radius:2px"></div></div>
        </div>
        <div style="font-weight:700;color:var(--orange);font-size:13px;flex-shrink:0">${d.count}</div>
      </div>`;
    }).join(''):'<div style="padding:16px;text-align:center;color:var(--ink-xlight);font-size:12px">No suburbs to show.</div>';
  }
}

function updateCovStats(){
  const filtered=getFilteredCovClients();
  const suburbs=new Set(filtered.map(c=>c.suburb).filter(Boolean));

  const clientsEl=document.getElementById('cov-clients');
  const suburbsEl=document.getElementById('cov-suburbs');
  const parksEl=document.getElementById('cov-parks-count');
  if(clientsEl) clientsEl.textContent=filtered.length;
  if(suburbsEl) suburbsEl.textContent=suburbs.size;
  if(parksEl) parksEl.textContent=offLeashParks.length;
}

// ── OFF-LEASH PARKS PAGE ──
let parksFilter='all';
function getBaseLat(){return parseFloat(getSetting('s-base-lat',-37.8990))||-37.8990;}
function getBaseLng(){return parseFloat(getSetting('s-base-lng',145.0448))||145.0448;}

async function renderParksPage(){
  const el=document.getElementById('parks-page-content');
  const statsEl=document.getElementById('parks-stats');
  if(!el) return;

  if(!offLeashParks.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading off-leash parks...</div>';
    try{
      offLeashParks=await fetch('/api/parks/offleash').then(r=>r.ok?r.json():[]).catch(()=>[]);
      // Fill missing suburbs via reverse geocode (background, progressive)
      fillParkSuburbs();
    }catch{offLeashParks=[];}
  }

  const search=(document.getElementById('parks-search')?.value||'').toLowerCase().trim();

  // Populate client dropdown
  const clientSelect=document.getElementById('parks-client-filter');
  if(clientSelect&&clientSelect.options.length<=1&&clients.length){
    const activeClients=clients.filter(c=>c.status==='active'&&c.name).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    activeClients.forEach(c=>{
      const opt=document.createElement('option');
      opt.value=c.name;
      opt.textContent=`🐕 ${c.name}${c.suburb?' — '+c.suburb:''}`;
      clientSelect.appendChild(opt);
    });
  }

  // Distance reference point: selected client's location or base
  const selectedClient=clientSelect?.value||'';
  let refLat=getBaseLat(),refLng=getBaseLng(),refLabel='base';
  if(selectedClient){
    // Try to find client in coverage map pins first (most accurate)
    const pin=covClientLocations.find(p=>p.name===selectedClient&&p.lat);
    if(pin){refLat=pin.lat;refLng=pin.lng;refLabel=selectedClient}
    else{
      // Fall back to suburb geocoding from client data
      const cli=clients.find(c=>c.name===selectedClient);
      const suburb=(cli?.suburb||'').toLowerCase();
      // Find a park in the same suburb to approximate location
      const suburbPark=offLeashParks.find(p=>(p.suburb||'').toLowerCase()===suburb);
      if(suburbPark){refLat=suburbPark.lat;refLng=suburbPark.lng;refLabel=selectedClient}
    }
  }

  // Calculate distance from reference point for each park
  let parks=offLeashParks.map(p=>({...p,dist:haversine(refLat,refLng,p.lat,p.lng)})).sort((a,b)=>a.dist-b.dist);

  // Apply filters
  if(parksFilter==='nearby') parks=parks.filter(p=>p.dist<=5000);
  if(parksFilter==='fenced') parks=parks.filter(p=>p.fenced);
  if(search) parks=parks.filter(p=>(p.name||'').toLowerCase().includes(search));

  // Find nearest client to each park
  const clientPins=covClientLocations.filter(p=>p.lat);
  parks.forEach(p=>{
    let nearestClient=null,nearestDist=Infinity;
    clientPins.forEach(c=>{
      const d=haversine(p.lat,p.lng,c.lat,c.lng);
      if(d<nearestDist){nearestDist=d;nearestClient=c.name;}
    });
    p.nearestClient=nearestClient;
    p.nearestClientDist=nearestDist;
  });

  // Stats
  const total=offLeashParks.length;
  const within5km=offLeashParks.filter(p=>haversine(refLat,refLng,p.lat,p.lng)<=5000).length;
  const fenced=offLeashParks.filter(p=>p.fenced).length;
  const nearClients=offLeashParks.filter(p=>{
    return clientPins.some(c=>haversine(p.lat,p.lng,c.lat,c.lng)<=2000);
  }).length;

  if(statsEl){
    statsEl.innerHTML=`
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${total}</div><div class="rp-weekly-lbl">Total Parks Found</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${within5km}</div><div class="rp-weekly-lbl">Within 5km</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${fenced}</div><div class="rp-weekly-lbl">Fenced</div></div>
      <div class="rp-weekly-stat"><div class="rp-weekly-val">${nearClients}</div><div class="rp-weekly-lbl">Near Clients (&lt;2km)</div></div>
    `;
  }

  // Update filter pill active states
  document.querySelectorAll('#parks-filters .filter-pill').forEach(p=>{
    const map={'All Parks':'all','Within 5km':'nearby','Fenced Only':'fenced'};
    p.classList.toggle('active',map[p.textContent.trim()]===parksFilter);
  });

  if(!parks.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No parks found matching your filters.</div>';
    return;
  }

  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">${parks.slice(0,60).map(p=>{
    const distFrom=selectedClient||'base';
    const distLabel=p.dist<1000?Math.round(p.dist)+'m from '+distFrom:(p.dist/1000).toFixed(1)+'km from '+distFrom;
    const clientDistLabel=p.nearestClientDist<1000?Math.round(p.nearestClientDist)+'m':(p.nearestClientDist/1000).toFixed(1)+'km';
    const isClose=p.nearestClientDist<=2000;

    return `<div class="card" style="padding:16px;border-left:3px solid ${p.fenced?'var(--success)':'var(--info)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <strong style="font-size:13px">${esc(p.name)}</strong>
          <div style="font-size:11px;color:var(--ink-light);margin-top:2px">
            ${p.type==='dog_park'?'Dog Park':'Off-Leash Area'}${p.suburb?' · '+esc(p.suburb):''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:600;color:var(--orange)">${distLabel}</div>
          ${p.fenced?'<span style="font-size:9px;background:var(--success-bg);color:var(--success);padding:2px 6px;border-radius:10px;font-weight:600">Fenced</span>':''}
        </div>
      </div>
      ${p.note?`<div style="font-size:11px;color:var(--ink-light);margin-bottom:8px">${esc(p.note.substring(0,120))}</div>`:''}
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border-light);font-size:11px">
        <div style="color:${isClose?'var(--success)':'var(--ink-xlight)'}">
          ${p.nearestClient?`${isClose?'Near':'Closest'} client: ${esc(p.nearestClient)} (${clientDistLabel})`:'No nearby clients'}
        </div>
        <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="navigate('coverage');setTimeout(()=>{if(covMap)covMap.setView([${p.lat},${p.lng}],16)},500)">View on map</button>
      </div>
    </div>`;
  }).join('')}</div>
  ${parks.length>60?`<div style="text-align:center;padding:16px;color:var(--ink-xlight);font-size:12px">Showing first 60 of ${parks.length} parks. Use search or filters to narrow down.</div>`:''}`;
}

function setParksFilter(f){
  parksFilter=f;
  renderParksPage();
}

async function fillParkSuburbs(){
  const cache=load('cw_park_suburbs',{});
  let updated=0;
  for(const p of offLeashParks){
    if(p.suburb) continue;
    const key=`${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if(cache[key]){p.suburb=cache[key];continue;}
    try{
      const res=await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}&zoom=14`,{headers:{'Accept':'application/json'}});
      const data=await res.json();
      const suburb=data.address?.suburb||data.address?.town||data.address?.city_district||data.address?.city||'';
      if(suburb){
        p.suburb=suburb;
        cache[key]=suburb;
        updated++;
        if(updated%10===0){save('cw_park_suburbs',cache);renderParksPage();}
      }
      await new Promise(r=>setTimeout(r,300));// Rate limit
    }catch{}
    if(updated>=40) break;// Limit to 40 lookups per session
  }
  if(updated>0){save('cw_park_suburbs',cache);renderParksPage();}
}

// ── OFF-LEASH PARKS MAP LAYER ──
let offLeashParks=[];
let offLeashLayer=null;
let offLeashVisible=false;
let radiusCircle=null;

async function toggleOffLeashParks(){
  offLeashVisible=!offLeashVisible;
  const btn=document.getElementById('cov-parks-toggle');
  if(btn) btn.classList.toggle('active',offLeashVisible);

  if(offLeashVisible){
    if(!offLeashParks.length){
      showToast('Loading off-leash parks...','🌳');
      try{
        offLeashParks=await fetch('/api/parks/offleash').then(r=>r.ok?r.json():[]).catch(()=>[]);
        showToast(`Found ${offLeashParks.length} off-leash areas`,'🌳');
      }catch{offLeashParks=[];}
    }
    renderParkMarkers();
    updateCovStats();
    // Switch to parks tab in sidebar
    setCovTab('parks');
  }else{
    if(offLeashLayer&&covMap){covMap.removeLayer(offLeashLayer);offLeashLayer=null;}
    if(radiusCircle&&covMap){covMap.removeLayer(radiusCircle);radiusCircle=null;}
    updateCovStats();
  }
}

function renderParkMarkers(){
  if(!covMap||!offLeashParks.length) return;
  if(offLeashLayer) covMap.removeLayer(offLeashLayer);

  offLeashLayer=L.layerGroup();
  offLeashParks.forEach(p=>{
    const icon=L.divIcon({
      html:`<div style="background:#22c55e;width:12px;height:12px;border-radius:50%;border:2.5px solid #16a34a;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>`,
      className:'',iconSize:[12,12],iconAnchor:[6,6]
    });
    const marker=L.marker([p.lat,p.lng],{icon});
    marker.bindPopup(`
      <div style="font-family:Inter,sans-serif;min-width:160px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">🌳 ${p.name}</div>
        <div style="font-size:11px;color:#6b6b6b;margin-bottom:2px">${p.type==='dog_park'?'Designated Dog Park':'Off-Leash Area'}</div>
        ${p.fenced?'<div style="font-size:11px;color:#16a34a">Fenced</div>':''}
        ${p.note?`<div style="font-size:10px;color:#a0a0a0;margin-top:4px">${p.note.substring(0,100)}</div>`:''}
      </div>
    `);
    offLeashLayer.addLayer(marker);
  });
  offLeashLayer.addTo(covMap);
}

function showNearbyParks(lat,lng,clientName){
  if(!offLeashParks.length){
    toggleOffLeashParks().then(()=>showNearbyParks(lat,lng,clientName));
    return;
  }
  // Draw radius circle
  if(radiusCircle&&covMap) covMap.removeLayer(radiusCircle);
  radiusCircle=L.circle([lat,lng],{radius:2000,color:'#22c55e',fillColor:'#22c55e',fillOpacity:0.08,weight:2,dashArray:'6'}).addTo(covMap);

  // Find parks within 2km
  const nearby=offLeashParks.map(p=>{
    const dist=haversine(lat,lng,p.lat,p.lng);
    return {...p,dist};
  }).filter(p=>p.dist<=2000).sort((a,b)=>a.dist-b.dist);

  // Update parks tab in sidebar with nearby results
  setCovTab('parks');
  const el=document.getElementById('cov-tab-parks');
  if(el){
    if(nearby.length){
      el.innerHTML=`<div style="font-size:11px;font-weight:600;color:var(--ink);margin-bottom:4px">${nearby.length} parks within 2km of ${esc(clientName)}</div>`+
        nearby.map(p=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--cream);border-radius:var(--radius-sm);cursor:pointer;font-size:12px" onclick="covMap.setView([${p.lat},${p.lng}],16)">
          <span style="color:var(--success)">🌳</span>
          <div style="flex:1"><strong>${esc(p.name)}</strong>${p.fenced?' <span style="font-size:9px;color:var(--success)">Fenced</span>':''}</div>
          <span style="font-size:11px;color:var(--ink-xlight)">${p.dist<1000?Math.round(p.dist)+'m':(p.dist/1000).toFixed(1)+'km'}</span>
        </div>`).join('');
    }else{
      el.innerHTML=`<div style="font-size:12px;color:var(--warning);padding:8px">No off-leash parks found within 2km of ${esc(clientName)}. Try toggling the full parks layer.</div>`;
    }
  }
  covMap.fitBounds(radiusCircle.getBounds(),{padding:[20,20]});
}

function haversine(lat1,lng1,lat2,lng2){
  const R=6371000;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// ── FILTER PILLS ──
document.querySelectorAll('.filter-pill').forEach(p=>{
  p.addEventListener('click',function(){
    this.closest('.pipeline-header,.view')?.querySelectorAll('.filter-pill').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');
  });
});

// ── WALKER CONFIG ──
const DEFAULT_WALKERS=[
  {name:'Jessica Lauritz',type:'founder',rate:0},
  {name:'Alex',type:'contractor',rate:27},
];
let walkerConfig=load('cw_walkers',DEFAULT_WALKERS);

function getWalkerConfig(walkerName){
  if(!walkerName) return null;
  const clean=walkerName.replace(/\\+$/g,'').trim().toLowerCase();
  return walkerConfig.find(w=>clean.includes(w.name.toLowerCase())||w.name.toLowerCase().includes(clean.split(' ')[0]));
}

function renderWalkerConfig(){
  const el=document.getElementById('walker-config-list');
  if(!el) return;
  el.innerHTML=walkerConfig.map((w,i)=>`
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:6px">
      <div class="form-group"><label>${i===0?'Name':''}</label><input value="${esc(w.name)}" oninput="walkerConfig[${i}].name=this.value" placeholder="Walker name"></div>
      <div class="form-group"><label>${i===0?'Type':''}</label><select onchange="walkerConfig[${i}].type=this.value;walkerConfig[${i}].rate=this.value==='founder'?0:walkerConfig[${i}].rate;renderWalkerConfig()">
        <option value="founder" ${w.type==='founder'?'selected':''}>Founder</option>
        <option value="employee" ${w.type==='employee'?'selected':''}>Employee</option>
        <option value="contractor" ${w.type==='contractor'?'selected':''}>Contractor</option>
      </select></div>
      <div class="form-group">${w.type==='founder'?`<label>${i===0?'Cost':''}</label><input value="Fixed weekly" disabled style="color:var(--ink-light)">`:`<label>${i===0?'$/hr':''}</label><input type="number" value="${w.rate}" oninput="walkerConfig[${i}].rate=parseFloat(this.value)||0">`}</div>
      <button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:16px;padding:6px" onclick="walkerConfig.splice(${i},1);saveWalkerConfig();renderWalkerConfig()">×</button>
    </div>
  `).join('')+`<div style="margin-top:8px;display:flex;justify-content:flex-end"><button class="btn btn-primary btn-sm" onclick="saveWalkerConfig()">Save Walkers</button></div>`;
}

function addWalkerConfig(){
  walkerConfig.push({name:'',type:'employee',rate:30});
  renderWalkerConfig();
}

function saveWalkerConfig(){
  walkerConfig=walkerConfig.filter(w=>w.name.trim());
  save('cw_walkers',walkerConfig);
  showToast('Walker team saved','✅');
  renderWalkerConfig();
}

// ── CLIENT PRICING (from TTP data, synced across devices) ──
let clientPricing=load('cw_client_prices',{});
let ttpPricing={}; // Loaded from /api/data/summary

// Load TTP pricing on startup
async function loadTTPPricing(){
  try{
    const res=await fetch('/api/data/summary');
    if(!res.ok) return;
    const data=await res.json();
    if(data.pricingByClient&&Object.keys(data.pricingByClient).length>0){
      ttpPricing=data.pricingByClient;
    }
  }catch(e){/* silent — fall back to localStorage pricing */}
}

function detectServiceType(service,durationMins){
  const svc=(service||'').toLowerCase();
  if(svc.includes('adventure')||svc.includes('2 hour')||svc.includes('day care')||durationMins>=100) return 'adventure';
  if(svc.includes('60')||durationMins>=55) return '60min';
  return '45min';
}

function getClientPrice(clientName,service,durationMins){
  const clean=(clientName||'').replace(/\\+$/g,'').trim();
  const svc=(service||'').trim();

  // 1. Try TTP pricing (exact service match)
  const ttp=ttpPricing[clean];
  if(ttp&&ttp[svc]){
    return ttp[svc].recentPrice||ttp[svc].avgPrice;
  }
  // Try TTP pricing (fuzzy match by service type)
  if(ttp){
    const type=detectServiceType(service,durationMins);
    for(const[k,v]of Object.entries(ttp)){
      if(k==='_summary') continue;
      if(type==='adventure'&&(k.toLowerCase().includes('adventure')||k.toLowerCase().includes('2 hour')||k.toLowerCase().includes('day care'))) return v.recentPrice||v.avgPrice;
      if(type==='60min'&&k.includes('60')) return v.recentPrice||v.avgPrice;
      if(type==='45min'&&k.includes('45')) return v.recentPrice||v.avgPrice;
    }
    // Last resort: use client's overall average
    if(ttp._summary&&ttp._summary.avgPerWalk>0) return ttp._summary.avgPerWalk;
  }

  // 2. Fall back to localStorage manual pricing
  const entry=clientPricing[clean];
  if(entry){
    const type=detectServiceType(service,durationMins);
    if(type==='adventure'&&entry.priceAdventure) return entry.priceAdventure;
    if(type==='60min'&&entry.price60) return entry.price60;
    if(type==='45min'&&entry.price45) return entry.price45;
    if(entry.price60) return entry.price60;
    if(entry.price45) return entry.price45;
    if(entry.soloPrice) return entry.soloPrice;
    if(entry.priceAdventure) return entry.priceAdventure;
  }

  // 3. Fall back to defaults
  const type=detectServiceType(service,durationMins);
  if(type==='adventure') return parseFloat(getSetting('s-price-adventure',75))||75;
  return parseFloat(getSetting('s-price-solo',55))||55;
}

function isClientPriced(clientName){
  const clean=(clientName||'').replace(/\\+$/g,'').trim();
  // Check TTP pricing first
  if(ttpPricing[clean]) return true;
  const entry=clientPricing[clean];
  return entry&&(entry.price45>0||entry.price60>0||entry.priceAdventure>0||entry.soloPrice>0);
}

function switchClientTab(tab){
  document.getElementById('client-tab-overview').style.display=tab==='overview'?'block':'none';
  document.getElementById('client-tab-pricing').style.display=tab==='pricing'?'block':'none';
  document.querySelectorAll('#client-tabs .filter-pill').forEach(p=>{
    p.classList.toggle('active',p.textContent.trim()===(tab==='overview'?'Overview':'Pricing'));
  });
  if(tab==='pricing') renderPricingTable();
  if(tab==='overview') renderClients();
}

let pricingFilter='all';
let pricingSort='revenue';

function setPricingFilter(f){pricingFilter=f;renderPricingTable()}
function setPricingSort(s){pricingSort=s;renderPricingTable()}

function renderPricingTable(){
  const el=document.getElementById('pricing-table');
  const alertEl=document.getElementById('pricing-alert');
  if(!el) return;

  const search=(document.getElementById('pricing-search')?.value||'').toLowerCase().trim();
  const hasTTP=Object.keys(ttpPricing).length>0;

  if(!hasTTP){
    if(alertEl) alertEl.innerHTML='<div style="padding:10px 14px;background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);font-size:12px;color:var(--warning)">No TTP pricing data loaded. Run the import script to generate pricing from walk history.</div>';
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Pricing data not available. Export walks from TTP and run the import.</div>';
    return;
  }

  // Build client list from TTP pricing
  const allClientNames=Object.keys(ttpPricing).filter(n=>n!=='_summary');

  // Apply status filter
  let filtered=allClientNames;
  if(pricingFilter==='active'){
    filtered=filtered.filter(n=>{const c=clients.find(c=>(c.name||'').replace(/\\+$/g,'').trim()===n);return c?.status==='active'});
  }else if(pricingFilter==='inactive'){
    filtered=filtered.filter(n=>{const c=clients.find(c=>(c.name||'').replace(/\\+$/g,'').trim()===n);return !c||c.status!=='active'});
  }
  if(search) filtered=filtered.filter(n=>n.toLowerCase().includes(search));

  // Sort
  const sorted=filtered.sort((a,b)=>{
    if(pricingSort==='revenue') return (ttpPricing[b]?._summary?.totalRevenue||0)-(ttpPricing[a]?._summary?.totalRevenue||0);
    if(pricingSort==='avg-walk') return (ttpPricing[b]?._summary?.avgPerWalk||0)-(ttpPricing[a]?._summary?.avgPerWalk||0);
    if(pricingSort==='name') return a.localeCompare(b);
    if(pricingSort==='walks') return (ttpPricing[b]?._summary?.totalWalks||0)-(ttpPricing[a]?._summary?.totalWalks||0);
    return 0;
  });

  const totalClients=sorted.length;
  const totalRev=sorted.reduce((s,n)=>s+(ttpPricing[n]?._summary?.totalRevenue||0),0);
  const totalWalks=sorted.reduce((s,n)=>s+(ttpPricing[n]?._summary?.totalWalks||0),0);
  const activeCount=allClientNames.filter(n=>{const c=clients.find(c=>(c.name||'').replace(/\\+$/g,'').trim()===n);return c?.status==='active'}).length;
  const inactiveCount=allClientNames.length-activeCount;

  if(alertEl){
    alertEl.innerHTML=`
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <div class="filter-pill${pricingFilter==='all'?' active':''}" onclick="setPricingFilter('all')">All (${allClientNames.length})</div>
        <div class="filter-pill${pricingFilter==='active'?' active':''}" onclick="setPricingFilter('active')">Active (${activeCount})</div>
        <div class="filter-pill${pricingFilter==='inactive'?' active':''}" onclick="setPricingFilter('inactive')">Inactive (${inactiveCount})</div>
        <span style="color:var(--border);margin:0 4px">|</span>
        <span style="font-size:11px;color:var(--ink-light);font-weight:600">Sort:</span>
        <div class="filter-pill${pricingSort==='revenue'?' active':''}" onclick="setPricingSort('revenue')">Total Revenue</div>
        <div class="filter-pill${pricingSort==='avg-walk'?' active':''}" onclick="setPricingSort('avg-walk')">Avg / Walk</div>
        <div class="filter-pill${pricingSort==='walks'?' active':''}" onclick="setPricingSort('walks')">Total Walks</div>
        <div class="filter-pill${pricingSort==='name'?' active':''}" onclick="setPricingSort('name')">Name</div>
      </div>
      <div style="padding:10px 14px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius-sm);font-size:12px;color:var(--info)">
        Showing ${totalClients} clients · $${totalRev.toLocaleString()} total revenue · ${totalWalks.toLocaleString()} walks · avg $${totalWalks>0?Math.round(totalRev/totalWalks):0}/walk
      </div>`;
  }

  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">${sorted.map(name=>{
    const ttp=ttpPricing[name];
    const summary=ttp?._summary||{};
    const client=clients.find(c=>(c.name||'').replace(/\\+$/g,'').trim()===name);
    const isActive=client?.status==='active';
    const services=Object.entries(ttp).filter(([k])=>k!=='_summary');

    return `<div class="card" style="padding:14px;border-left:3px solid ${isActive?'var(--success)':'var(--ink-xlight)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <strong style="font-size:13px">${esc(name)}</strong>
          <span style="font-size:11px;color:${isActive?'var(--success)':'var(--ink-xlight)'};margin-left:6px">${isActive?'Active':'Inactive'}</span>
        </div>
        <span style="font-size:11px;font-weight:700;color:var(--ink-mid)">$${(summary.totalRevenue||0).toLocaleString()}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${services.map(([svc,data])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--cream);border-radius:6px">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--ink-mid)">${esc(svc)}</div>
            <div style="font-size:10px;color:var(--ink-xlight)">${data.walkCount} walks</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:14px;font-weight:800;color:var(--ink);font-family:'Readex Pro',sans-serif">$${data.recentPrice.toFixed(0)}</div>
            ${data.recentPrice!==data.avgPrice?`<div style="font-size:10px;color:var(--ink-xlight)">avg $${data.avgPrice.toFixed(0)}</div>`:''}
          </div>
        </div>`).join('')}
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--ink-xlight);text-align:right">${summary.totalWalks||0} walks · avg $${(summary.avgPerWalk||0).toFixed(0)}/walk</div>
    </div>`;
  }).join('')}</div>`;
}

function saveClientPricing(){
  document.querySelectorAll('#pricing-table input[data-client]').forEach(input=>{
    const name=input.dataset.client;
    const field=input.dataset.field;
    if(!name||!field) return;
    if(!clientPricing[name]) clientPricing[name]={};
    const val=field==='dogs'?parseInt(input.value)||1:parseFloat(input.value)||0;
    clientPricing[name][field]=val;
  });
  save('cw_client_prices',clientPricing);
  showToast('Pricing saved','');
  // Refresh dashboard revenue to stay in sync
  renderDashboard();
}

// ── ROUTE PLANNER — UI ──
let rpShifts=load('cw_shifts',[]);
let rpActiveTab='dashboard';

function renderRoutes(){
  // Set default date to today
  const dateInput=document.getElementById('rp-date');
  if(dateInput&&!dateInput.value) dateInput.value=new Date().toISOString().split('T')[0];
  rpTab(rpActiveTab);
}

function rpTab(tab){
  rpActiveTab=tab;
  ['dashboard','revenue','ltv','growth'].forEach(t=>{
    const el=document.getElementById('rp-tab-'+t);
    if(el) el.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('#rp-tabs .filter-pill').forEach(p=>{
    const labels={Dashboard:'dashboard',Revenue:'revenue','Client Value':'ltv',Growth:'growth'};
    p.classList.toggle('active',labels[p.textContent.trim()]===tab);
  });
  // Show/hide range pills (only for dashboard)
  const rangePills=document.getElementById('rp-range-pills');
  const dateInput=document.getElementById('rp-date');
  if(rangePills) rangePills.style.display=tab==='dashboard'?'flex':'none';
  if(dateInput) dateInput.style.display=tab==='dashboard'?'':'none';

  if(tab==='dashboard') renderRpDashboard();
  if(tab==='revenue') renderRevenueForecast();
  if(tab==='ltv') renderClientLTV();
  if(tab==='growth') renderGrowthSim();
}

// ── ROUTE DASHBOARD (auto from TTP) ──
let rpDashRange='day';

function setRpRange(range){
  rpDashRange=range;
  // Reset date picker to today when switching ranges
  const dateInput=document.getElementById('rp-date');
  if(dateInput&&range!=='day') dateInput.value='';
  document.querySelectorAll('#rp-range-pills .filter-pill').forEach(p=>{
    const map={Today:'day','This Week':'week','This Month':'month'};
    p.classList.toggle('active',map[p.textContent.trim()]===range);
  });
  renderRpDashboard();
}

async function renderRpDashboard(){
  const dateInput=document.getElementById('rp-date');
  const startDate=dateInput?.value||new Date().toISOString().split('T')[0];
  const cardsEl=document.getElementById('rp-shift-cards');
  const summaryEl=document.getElementById('rp-weekly-summary');
  if(!cardsEl) return;

  cardsEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading route data...</div>';

  // Fetch all walks — filter on frontend for correct timezone handling
  const walks=await fetch('/api/walks/today?range=all').then(r=>{
    if(!r.ok) throw new Error('API error '+r.status);
    return r.json();
  }).catch(e=>{
    console.warn('Route data fetch failed:',e);
    cardsEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Failed to load route data. Try refreshing.</div>';
    return [];
  });
  if(!walks.length&&cardsEl.innerHTML.includes('Failed')) return;

  // Calculate date range using string math (avoids timezone issues)
  function addDays(dateStr,days){
    const [y,m,d]=dateStr.split('-').map(Number);
    const dt=new Date(y,m-1,d+days);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }
  let rangeStart=startDate,rangeEnd=startDate;
  if(rpDashRange==='week'){
    // Full current week (Mon-Sun) around the selected date
    const d=new Date(startDate+'T00:00:00');
    const dow=d.getDay()||7;
    rangeStart=addDays(startDate,-(dow-1));// Monday
    rangeEnd=addDays(rangeStart,6);// Sunday
  }else if(rpDashRange==='month'){
    // Full calendar month of selected date
    const [y,m]=startDate.split('-').map(Number);
    rangeStart=`${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay=new Date(y,m,0).getDate();
    rangeEnd=`${y}-${String(m).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  }

  const rangeWalks=walks.filter(w=>w.date>=rangeStart&&w.date<=rangeEnd);
  const settings=getRouteSettings();

  // Build shifts using shared engine (same as Dashboard)
  const shifts=buildShiftsFromWalks(rangeWalks,settings);

  // Period summary
  const periodRevenue=shifts.reduce((s,sh)=>s+sh.metrics.totalRevenue,0);
  const periodProfit=shifts.reduce((s,sh)=>s+sh.metrics.grossProfit,0);
  const periodMargin=periodRevenue>0?(periodProfit/periodRevenue)*100:0;
  const periodLabel=rpDashRange==='day'?'Today':rpDashRange==='week'?`Week (${rangeStart.substring(5)} — ${rangeEnd.substring(5)})`:`Month (${rangeStart.substring(0,7)})`;
  const uniqueDays=[...new Set(rangeWalks.map(w=>w.date))].length;

  summaryEl.innerHTML=`
    <div class="rp-weekly-stat"><div class="rp-weekly-val">${rangeWalks.length}</div><div class="rp-weekly-lbl">Walks ${periodLabel}</div></div>
    ${rpDashRange!=='day'?`<div class="rp-weekly-stat"><div class="rp-weekly-val">${uniqueDays}</div><div class="rp-weekly-lbl">Active Days</div></div>`:''}
    <div class="rp-weekly-stat"><div class="rp-weekly-val">${shifts.length}</div><div class="rp-weekly-lbl">Routes</div></div>
    <div class="rp-weekly-stat"><div class="rp-weekly-val">$${periodRevenue.toFixed(0)}</div><div class="rp-weekly-lbl">Est. Revenue</div></div>
    <div class="rp-weekly-stat"><div class="rp-weekly-val" style="color:${periodProfit>=0?'var(--success)':'var(--danger)'}">$${periodProfit.toFixed(0)}</div><div class="rp-weekly-lbl">Est. Profit</div></div>
    <div class="rp-weekly-stat"><div class="rp-weekly-val" style="color:${periodMargin>=40?'var(--success)':periodMargin>=20?'var(--warning)':'var(--danger)'}">${periodMargin.toFixed(0)}%</div><div class="rp-weekly-lbl">Avg Margin</div></div>
  `;

  if(!shifts.length){
    cardsEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No walks scheduled for this period</div>';
    return;
  }

  // Group shifts by date for week/month view
  const shiftsByDate={};
  shifts.forEach(s=>{
    if(!shiftsByDate[s.shift.date]) shiftsByDate[s.shift.date]=[];
    shiftsByDate[s.shift.date].push(s);
  });
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const renderShiftCard=({shift,metrics,walkCount,slots,groupSlots,soloSlots,maxGroupSize,actualServiceMins})=>{
    const band=getScoreBand(metrics.score);
    const hi=getHealthInfo(metrics.health);
    const flags=[];
    if(metrics.grossMargin<getRouteSettings().marginThresholdYellow) flags.push('<span class="rp-flag rp-flag-low-margin">Low Margin</span>');
    if(metrics.dogCount<metrics.maxDogs*0.5) flags.push('<span class="rp-flag rp-flag-underfilled">Underfilled</span>');
    if(metrics.travelLoad>getRouteSettings().travelLoadThresholdWarn) flags.push('<span class="rp-flag rp-flag-travel-heavy">Travel Heavy</span>');

    const groupInfo=groupSlots>0?`${groupSlots} group walk${groupSlots>1?'s':''} (up to ${maxGroupSize} dogs)`:'All solo walks';

    return `<div class="rp-shift-card">
      <div class="rp-shift-header">
        <div>
          <strong style="font-size:15px">${esc(shift.walker)}</strong>
          <span style="font-size:12px;color:var(--ink-light);margin-left:8px">${shift.startTime} — ${shift.endTime}</span>
          ${flags.join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="rp-health ${hi.cls}">${hi.icon} ${hi.label}</span>
          <div style="text-align:center" title="Route Score: Profit ${metrics.grossMargin.toFixed(0)}% margin (35%) + ${metrics.utilisation.toFixed(0)}% utilised (25%) + ${(100-metrics.travelLoad).toFixed(0)}% travel efficiency (20%) + ${metrics.dogCount}/${metrics.maxDogs} capacity (20%)"><div class="rp-score-ring ${band.cls}">${metrics.score}</div><div style="font-size:9px;color:var(--ink-xlight);margin-top:2px">Route Score</div></div>
        </div>
      </div>
      <div class="rp-shift-stats">
        <div>🐕 <strong>${walkCount}</strong> dogs</div>
        <div>🔗 <strong>${slots}</strong> service slots</div>
        <div>💰 <strong>$${metrics.totalRevenue.toFixed(0)}</strong> revenue</div>
        <div style="color:${metrics.grossProfit>=0?'var(--success)':'var(--danger)'}">📈 <strong>$${metrics.grossProfit.toFixed(0)}</strong> profit</div>
        <div>📊 <strong>${metrics.grossMargin.toFixed(0)}%</strong> margin</div>
        <div>⏱ <strong>${(metrics.shiftMins/60).toFixed(1)}h</strong> shift</div>
        <div>⏳ <strong>${(actualServiceMins/60).toFixed(1)}h</strong> service time</div>
        <div>📊 <strong>${metrics.utilisation.toFixed(0)}%</strong> utilised</div>
        <div>💵 <strong>$${metrics.profitPerHr.toFixed(0)}/hr</strong> profit rate</div>
      </div>
      <div style="margin-top:8px;font-size:12px">
        <span style="color:var(--info);font-weight:600">${groupInfo}</span>
        ${soloSlots>0?` · <span style="color:var(--ink-light)">${soloSlots} solo walk${soloSlots>1?'s':''}</span>`:''}
      </div>
    </div>`;
  };

  if(rpDashRange==='day'){
    cardsEl.innerHTML=shifts.map(renderShiftCard).join('');
  }else if(rpDashRange==='week'){
    // Week: collapsible day rows
    cardsEl.innerHTML=Object.entries(shiftsByDate).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,dayShifts])=>{
      const d=new Date(date+'T00:00:00');
      const dayLabel=`${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
      const dayRev=dayShifts.reduce((s,sh)=>s+sh.metrics.totalRevenue,0);
      const dayProfit=dayShifts.reduce((s,sh)=>s+sh.metrics.grossProfit,0);
      const dayDogs=dayShifts.reduce((s,sh)=>s+sh.walkCount,0);
      const dayMargin=dayRev>0?(dayProfit/dayRev)*100:0;
      return `<div class="walk-day-collapse" onclick="this.classList.toggle('expanded')">
        <div class="walk-day-summary">
          <div style="display:flex;align-items:center;gap:10px">
            <strong style="min-width:80px">${dayLabel}</strong>
            <span class="walk-day-pill">${dayDogs} dogs</span>
            <span class="walk-day-pill">${dayShifts.length} route${dayShifts.length>1?'s':''}</span>
            <span class="walk-day-pill">$${dayRev.toFixed(0)} rev</span>
            <span class="walk-day-pill" style="background:${dayProfit>=0?'var(--success-bg)':'#fee2e2'};color:${dayProfit>=0?'var(--success)':'var(--danger)'}">$${dayProfit.toFixed(0)} profit</span>
            <span class="walk-day-pill" style="background:${dayMargin>=40?'var(--success-bg)':dayMargin>=20?'#fef3c7':'#fee2e2'};color:${dayMargin>=40?'var(--success)':dayMargin>=20?'var(--warning)':'var(--danger)'}">${dayMargin.toFixed(0)}%</span>
          </div>
          <span style="font-size:10px;color:var(--ink-xlight)">▼</span>
        </div>
        <div class="walk-day-detail">${dayShifts.map(renderShiftCard).join('')}</div>
      </div>`;
    }).join('');
  }else{
    // Month: calendar grid with profitability per day
    const [sy,sm]=startDate.split('-').map(Number);
    const firstOfMonth=new Date(sy,sm-1,1);
    const daysInMonth=new Date(sy,sm,0).getDate();
    const startDow=(firstOfMonth.getDay()+6)%7;// Monday=0
    // Use Melbourne local date for "today" highlight
    const nowLocal=new Date();
    const todayStr=`${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}-${String(nowLocal.getDate()).padStart(2,'0')}`;
    const calDayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    let calHtml=`<div class="walks-cal-grid">`;
    calHtml+=calDayNames.map(d=>`<div class="walks-cal-header">${d}</div>`).join('');
    for(let i=0;i<startDow;i++) calHtml+=`<div class="walks-cal-cell empty"></div>`;

    for(let day=1;day<=daysInMonth;day++){
      const dateStr=`${sy}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dayShifts=shiftsByDate[dateStr]||[];
      const dayRev=dayShifts.reduce((s,sh)=>s+sh.metrics.totalRevenue,0);
      const dayProfit=dayShifts.reduce((s,sh)=>s+sh.metrics.grossProfit,0);
      const dayDogs=dayShifts.reduce((s,sh)=>s+sh.walkCount,0);
      const dayMargin=dayRev>0?(dayProfit/dayRev)*100:0;
      const isToday=dateStr===todayStr;
      const hasWalks=dayShifts.length>0;

      let bgColor='var(--white)';
      if(hasWalks){
        if(dayMargin>=60) bgColor='#dcfce7';
        else if(dayMargin>=40) bgColor='#d1fae5';
        else if(dayMargin>=20) bgColor='#fef3c7';
        else if(dayProfit>0) bgColor='#fee2e2';
        else bgColor='#fca5a5';
      }

      calHtml+=`<div class="walks-cal-cell${isToday?' cal-today':''}" style="background:${bgColor};cursor:${hasWalks?'pointer':'default'}" onclick="${hasWalks?`rpDashRange='day';document.getElementById('rp-date').value='${dateStr}';renderRpDashboard()`:''}" title="${hasWalks?dayDogs+' dogs · $'+dayRev.toFixed(0)+' rev · $'+dayProfit.toFixed(0)+' profit · '+dayMargin.toFixed(0)+'% margin':'No walks'}">
        <div class="cal-day-num">${day}</div>
        ${hasWalks?`
          <div style="font-size:10px;font-weight:600;color:var(--ink)">${dayDogs} 🐕</div>
          <div style="font-size:10px;color:${dayProfit>=0?'var(--success)':'var(--danger)'}">$${dayProfit.toFixed(0)}</div>
          <div style="font-size:9px;color:var(--ink-xlight)">${dayMargin.toFixed(0)}%</div>
        `:`<div style="font-size:10px;color:var(--ink-xlight)">—</div>`}
      </div>`;
    }
    calHtml+=`</div>`;
    cardsEl.innerHTML=calHtml;
  }
}

function parseAmPmTo24(t){
  if(!t) return '08:00';
  const m=t.match(/(\d+):(\d+)\s*(am|pm)?/i);
  if(!m) return '08:00';
  let h=parseInt(m[1]),min=m[2];
  if(m[3]&&m[3].toLowerCase()==='pm'&&h!==12) h+=12;
  if(m[3]&&m[3].toLowerCase()==='am'&&h===12) h=0;
  return `${String(h).padStart(2,'0')}:${min}`;
}

// ── QUICK ASSESS ──
function recalcQuickAssess(){
  const type=document.getElementById('qa-type')?.value||'employee';
  const rate=parseFloat(document.getElementById('qa-rate')?.value)||30;
  const hours=parseFloat(document.getElementById('qa-hours')?.value)||4;
  const dogs=parseInt(document.getElementById('qa-dogs')?.value)||5;
  const price=parseFloat(document.getElementById('qa-price')?.value)||45;
  const km=parseFloat(document.getElementById('qa-km')?.value)||15;
  const settings=getRouteSettings();
  const shiftMins=hours*60;
  const revenue=dogs*price;
  const labour=calcLabourCost(type,rate,shiftMins,settings.superRate,settings.casualLoading);
  const travel=calcTravelCost(km,settings.costPerKm);
  const {totalDirectCost,grossProfit,grossMargin}=calcProfitability(revenue,labour,travel,0);
  const profitPerHr=hours>0?grossProfit/hours:0;
  const health=calcRouteHealth(grossMargin,20,80,settings);
  const hi=getHealthInfo(health);
  const el=document.getElementById('qa-results');
  if(!el) return;
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <span class="rp-health ${hi.cls}" style="font-size:13px;padding:6px 14px">${hi.icon} ${hi.label}</span>
      <span style="font-size:13px;color:var(--ink-light)">Gross Margin: <strong style="color:${grossMargin>=40?'var(--success)':grossMargin>=20?'var(--warning)':'var(--danger)'}">${grossMargin.toFixed(1)}%</strong></span>
    </div>
    <div class="rp-metric-grid">
      <div class="rp-metric"><div class="rp-metric-label">Revenue</div><div class="rp-metric-value">$${revenue.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Labour Cost</div><div class="rp-metric-value">$${labour.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Travel Cost</div><div class="rp-metric-value">$${travel.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Total Cost</div><div class="rp-metric-value">$${totalDirectCost.toFixed(0)}</div></div>
      <div class="rp-metric ${grossProfit>0?'good':'bad'}"><div class="rp-metric-label">Gross Profit</div><div class="rp-metric-value">$${grossProfit.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Profit/Hr</div><div class="rp-metric-value">$${profitPerHr.toFixed(0)}</div></div>
    </div>
  `;
}

// ── REVENUE & TARGETS ──

async function renderRevenueForecast(){
  const el=document.getElementById('revenue-forecast-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading revenue data...</div>';

  const walks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const now=new Date();
  const nowStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  // Load targets
  const targets=load('cw_rev_targets',{});
  const monthlyGoal=parseFloat(targets.monthlyGoal)||8000;
  const momGrowthTarget=parseFloat(targets.momGrowth)||10;

  function walkRevenue(w){return getClientPrice(w.client,w.service);}
  function monthStr(y,m){return `${y}-${String(m+1).padStart(2,'0')}`;}
  function monthName(ms){const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const [y,m]=ms.split('-');return mn[parseInt(m)-1]+' '+y;}

  // Build monthly data for last 5 months + current + next 7 months (13 months)
  const monthlyData=[];
  for(let i=-5;i<=7;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const ms=monthStr(d.getFullYear(),d.getMonth());
    const mWalks=walks.filter(w=>w.date.startsWith(ms));
    const rev=mWalks.reduce((s,w)=>s+walkRevenue(w),0);
    const daysInM=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    const isPast=i<0;
    const isCurrent=i===0;
    const isFuture=i>0;
    const dayOfM=isCurrent?now.getDate():isPast?daysInM:0;
    const completedWalks=isCurrent?mWalks.filter(w=>w.date<=nowStr):mWalks;
    const completedRev=completedWalks.reduce((s,w)=>s+walkRevenue(w),0);
    const bookedRev=isCurrent?rev-completedRev:0;

    // Target: use custom target if set, otherwise use monthly goal + growth
    let target=parseFloat(targets[ms])||0;
    if(!target){
      if(i<=0) target=monthlyGoal;// Current and past: use base monthly goal
      else{
        // Future: apply MoM growth compounding from monthly goal
        target=monthlyGoal*Math.pow(1+momGrowthTarget/100,i);
      }
    }

    monthlyData.push({ms,rev,target,walks:mWalks.length,isPast,isCurrent,isFuture,completedRev,bookedRev,daysInM,dayOfM});
  }

  const currentMonth=monthlyData.find(m=>m.isCurrent);
  const cm=currentMonth;
  const progressPct=cm.target>0?Math.min(100,(cm.rev/cm.target)*100):0;
  const gapToTarget=Math.max(0,cm.target-cm.rev);
  const avgRevPerWalk=cm.walks>0?cm.rev/cm.walks:55;
  const walksNeeded=avgRevPerWalk>0?Math.ceil(gapToTarget/avgRevPerWalk):0;
  const daysLeft=cm.daysInM-cm.dayOfM;

  // Past months for trend
  const pastMonths=monthlyData.filter(m=>m.isPast&&m.walks>0);
  const lastMonth=pastMonths[pastMonths.length-1];
  const momActual=lastMonth&&lastMonth.rev>0?((cm.rev-lastMonth.rev)/lastMonth.rev)*100:0;

  // Year-to-date
  const ytdMonths=monthlyData.filter(m=>(m.isPast||m.isCurrent)&&m.ms.startsWith(String(now.getFullYear())));
  const ytdRev=ytdMonths.reduce((s,m)=>s+m.rev,0);
  const ytdTarget=ytdMonths.reduce((s,m)=>s+m.target,0);
  const annualProjected=monthlyGoal*12;

  // Weekly run rate
  const fourWeeksAgo=new Date(now);fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const fwStr=`${fourWeeksAgo.getFullYear()}-${String(fourWeeksAgo.getMonth()+1).padStart(2,'0')}-${String(fourWeeksAgo.getDate()).padStart(2,'0')}`;
  const recentWalks=walks.filter(w=>w.date>=fwStr&&w.date<=nowStr);
  const weeklyRunRate=recentWalks.reduce((s,w)=>s+walkRevenue(w),0)/4;

  el.innerHTML=`
    <!-- HERO: Monthly Goal + Settings -->
    <div style="display:flex;gap:16px;margin-bottom:20px;align-items:stretch">
      <div class="card" style="flex:2;border-top:4px solid var(--orange)">
        <div class="card-body" style="text-align:center;padding:24px">
          <div style="font-size:12px;font-weight:600;color:var(--ink-light);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Monthly Revenue Goal</div>
          <div style="font-size:42px;font-weight:800;font-family:'Readex Pro',sans-serif;color:var(--ink)">$${monthlyGoal.toLocaleString()}</div>
          <div style="font-size:13px;color:var(--ink-light);margin-top:4px">= $${(annualProjected/1000).toFixed(0)}k/year at this rate</div>
          <div style="margin-top:12px;font-size:12px">
            YTD: <strong style="color:${ytdRev>=ytdTarget?'var(--success)':'var(--warning)'}">$${(ytdRev/1000).toFixed(1)}k</strong> of $${(ytdTarget/1000).toFixed(1)}k target
            · Run rate: <strong>$${weeklyRunRate.toFixed(0)}/wk</strong>
          </div>
        </div>
      </div>
      <div class="card" style="flex:1">
        <div class="card-body">
          <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">Growth Settings</h4>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
            <div class="form-group"><label>Monthly Goal ($)</label><input type="number" value="${monthlyGoal}" onchange="saveRevTargets('monthlyGoal',this.value)" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;width:100%"></div>
            <div class="form-group"><label>MoM Growth Target (%)</label><input type="number" value="${momGrowthTarget}" step="1" onchange="saveRevTargets('momGrowth',this.value)" style="padding:6px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;width:100%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- CURRENT MONTH HERO -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid ${cm.rev>=cm.target?'var(--success)':'var(--orange)'}">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:18px;font-weight:800">${monthName(cm.ms)}</h3>
          <div style="font-size:12px;color:var(--ink-light)">${daysLeft} days left · ${cm.walks} walks booked</div>
        </div>
        <div style="background:var(--cream);border-radius:20px;height:32px;overflow:hidden;margin-bottom:12px;position:relative">
          <div style="background:var(--success);height:100%;width:${Math.min(100,(cm.completedRev/cm.target)*100)}%;border-radius:20px;transition:width .3s"></div>
          <div style="background:var(--orange);height:100%;width:${Math.min(100-(cm.completedRev/cm.target)*100,(cm.bookedRev/cm.target)*100)}%;position:absolute;top:0;left:${(cm.completedRev/cm.target)*100}%;border-radius:0 20px 20px 0;opacity:0.5"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;font-weight:700;color:var(--ink)">${progressPct.toFixed(0)}% — $${cm.rev.toFixed(0)} of $${cm.target.toFixed(0)}</div>
        </div>
        <div style="display:flex;gap:20px;font-size:12px">
          <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--success);margin-right:4px"></span>Delivered: <strong>$${cm.completedRev.toFixed(0)}</strong></div>
          <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--orange);opacity:.5;margin-right:4px"></span>Booked: <strong>$${cm.bookedRev.toFixed(0)}</strong></div>
          <div>Run rate: <strong>$${weeklyRunRate.toFixed(0)}/wk</strong></div>
          ${lastMonth?`<div>vs ${monthName(lastMonth.ms)}: <strong style="color:${momActual>=0?'var(--success)':'var(--danger)'}"> ${momActual>=0?'+':''}${momActual.toFixed(0)}%</strong></div>`:''}
        </div>
        ${gapToTarget>0?`<div style="margin-top:10px;padding:8px 12px;background:var(--warning-bg);border-radius:var(--radius-sm);font-size:12px;color:var(--warning)"><strong>$${gapToTarget.toFixed(0)} to go</strong> — need ~${walksNeeded} more walks in ${daysLeft} days</div>`
        :`<div style="margin-top:10px;padding:8px 12px;background:var(--success-bg);border-radius:var(--radius-sm);font-size:12px;color:var(--success)"><strong>On track!</strong> Exceeding target by $${(cm.rev-cm.target).toFixed(0)}</div>`}
      </div>
    </div>

    <!-- MONTHLY ROADMAP: Past + Current + Future -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-body">
        <h4 style="font-size:14px;font-weight:700;margin-bottom:14px">📅 Monthly Roadmap</h4>
        <div style="overflow-x:auto">
          <table class="enq-list-table">
            <thead><tr><th>Month</th><th>Target</th><th>Actual / Booked</th><th>vs Target</th><th>MoM Growth</th><th>Status</th></tr></thead>
            <tbody>${monthlyData.map((m,i)=>{
              const prev=i>0?monthlyData[i-1]:null;
              const mom=prev&&prev.rev>0?((m.rev-prev.rev)/prev.rev)*100:0;
              const vsTarget=m.target>0?((m.rev-m.target)/m.target)*100:0;
              const status=m.isCurrent?'current':m.isPast?(m.rev>=m.target?'hit':'missed'):(m.rev>0?'booked':'planned');
              const statusLabel={current:'In Progress',hit:'✅ Hit',missed:'❌ Missed',booked:'Booked',planned:'Planned'}[status];
              const statusColor={current:'var(--orange)',hit:'var(--success)',missed:'var(--danger)',booked:'var(--info)',planned:'var(--ink-xlight)'}[status];
              const hasCustom=!!parseFloat(targets[m.ms]);
              return `<tr style="${m.isCurrent?'background:var(--orange-xlight);font-weight:600':''}">
                <td><strong>${monthName(m.ms)}</strong></td>
                <td><input type="number" value="${m.target.toFixed(0)}" onchange="saveRevTargets('${m.ms}',this.value)" style="width:80px;padding:4px 6px;border:1px solid ${hasCustom?'var(--orange)':'var(--border)'};border-radius:4px;font-size:12px;font-weight:600;text-align:right;background:${hasCustom?'var(--orange-xlight)':'var(--white)'}">${hasCustom?'<span style="font-size:9px;color:var(--orange);margin-left:2px" title="Custom target">*</span>':''}</td>
                <td>$${m.rev.toFixed(0)}${m.isCurrent?` <span style="font-size:10px;color:var(--ink-light)">(${m.walks} walks)</span>`:m.walks>0?` <span style="font-size:10px;color:var(--ink-xlight)">(${m.walks})</span>`:''}</td>
                <td style="color:${vsTarget>=0?'var(--success)':'var(--danger)'}; font-weight:700">${m.rev>0||m.isPast?(vsTarget>=0?'+':'')+vsTarget.toFixed(0)+'%':'—'}</td>
                <td style="color:${mom>=0?'var(--success)':'var(--danger)'}">${prev&&(m.rev>0||m.isPast)?(mom>=0?'+':'')+mom.toFixed(0)+'%':'—'}</td>
                <td><span style="color:${statusColor};font-size:11px;font-weight:600">${statusLabel}</span></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--ink-xlight)">Edit any target directly. <span style="color:var(--orange)">*</span> = custom goal. Months without a custom goal use $${monthlyGoal.toLocaleString()} base + ${momGrowthTarget}% MoM growth.</div>
      </div>
    </div>

    <!-- KPI Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      <div class="rp-metric"><div class="rp-metric-label">Weekly Run Rate</div><div class="rp-metric-value">$${weeklyRunRate.toFixed(0)}</div></div>
      <div class="rp-metric ${weeklyRunRate*4.3>=monthlyGoal?'good':'warn'}"><div class="rp-metric-label">Monthly Run Rate</div><div class="rp-metric-value">$${(weeklyRunRate*4.3).toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Avg Rev/Walk</div><div class="rp-metric-value">$${avgRevPerWalk.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">YTD Revenue</div><div class="rp-metric-value">$${(ytdRev/1000).toFixed(1)}k</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Monthly Goal</div><div class="rp-metric-value">$${monthlyGoal.toLocaleString()}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">MoM Growth Target</div><div class="rp-metric-value">${momGrowthTarget}%</div></div>
    </div>
  `;
}

function saveRevTargets(key,value){
  const t=load('cw_rev_targets',{});
  t[key]=parseFloat(value)||0;
  save('cw_rev_targets',t);
  renderRevenueForecast();
}

// ── CLIENT LIFETIME VALUE ──
async function renderClientLTV(){
  const el=document.getElementById('client-ltv-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Calculating client values...</div>';

  const walks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const now=new Date();
  const nowStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  function walkRevenue(w){return getClientPrice(w.client,w.service);}

  // Build client value map
  const clientMap={};
  walks.forEach(w=>{
    const name=(w.client||'').replace(/\\+$/g,'').trim();
    if(!name||name==='Potential Client (general)') return;
    if(!clientMap[name]) clientMap[name]={name,walks:0,revenue:0,firstWalk:null,lastWalk:null,months:new Set(),futureWalks:0};
    const c=clientMap[name];
    const rev=walkRevenue(w);
    c.walks++;
    c.revenue+=rev;
    if(w.date<=nowStr) {
      if(!c.firstWalk||w.date<c.firstWalk) c.firstWalk=w.date;
      if(!c.lastWalk||w.date>c.lastWalk) c.lastWalk=w.date;
    } else {
      c.futureWalks++;
    }
    c.months.add(w.date.substring(0,7));
  });

  const clientList=Object.values(clientMap).map(c=>{
    const monthsActive=c.months.size;
    const firstDate=c.firstWalk?new Date(c.firstWalk+'T00:00:00'):null;
    const tenureMonths=firstDate?Math.max(1,Math.round((now-firstDate)/(30.44*86400000))):0;
    const avgPerMonth=tenureMonths>0?c.revenue/tenureMonths:c.revenue;
    const walksPerWeek=tenureMonths>0?c.walks/(tenureMonths*4.3):0;
    const isActive=c.futureWalks>0||c.lastWalk>=nowStr.substring(0,7);
    return {...c,monthsActive,tenureMonths,avgPerMonth,walksPerWeek,isActive};
  }).sort((a,b)=>b.revenue-a.revenue);

  const activeClients=clientList.filter(c=>c.isActive);
  const totalClients=clientList.length;
  const totalRev=clientList.reduce((s,c)=>s+c.revenue,0);
  const avgLTV=totalClients>0?totalRev/totalClients:0;
  const avgTenure=clientList.reduce((s,c)=>s+c.tenureMonths,0)/Math.max(1,totalClients);
  const avgMonthlyPerClient=clientList.reduce((s,c)=>s+c.avgPerMonth,0)/Math.max(1,totalClients);

  // Revenue concentration
  const top5Rev=clientList.slice(0,5).reduce((s,c)=>s+c.revenue,0);
  const top5Pct=totalRev>0?(top5Rev/totalRev)*100:0;
  const topClient=clientList[0];
  const topClientMonthly=topClient?topClient.avgPerMonth:0;

  // Acquisition value (first 3 months revenue average)
  const first3MonthRev=clientList.filter(c=>c.tenureMonths>=3).map(c=>{
    // Approximate first 3 month revenue
    return Math.min(c.revenue,c.avgPerMonth*3);
  });
  const avgFirst3=first3MonthRev.length>0?first3MonthRev.reduce((s,v)=>s+v,0)/first3MonthRev.length:avgLTV*0.3;

  // Cohort data (by start month)
  const cohorts={};
  clientList.forEach(c=>{
    if(!c.firstWalk) return;
    const cohort=c.firstWalk.substring(0,7);
    if(!cohorts[cohort]) cohorts[cohort]={started:0,active:0,totalRev:0};
    cohorts[cohort].started++;
    if(c.isActive) cohorts[cohort].active++;
    cohorts[cohort].totalRev+=c.revenue;
  });

  el.innerHTML=`
    <!-- Overview -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="rp-metric"><div class="rp-metric-label">Total Clients Ever</div><div class="rp-metric-value">${totalClients}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Currently Active</div><div class="rp-metric-value">${activeClients.length}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Avg Client LTV</div><div class="rp-metric-value">$${avgLTV.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Avg Tenure</div><div class="rp-metric-value">${avgTenure.toFixed(1)}mo</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Avg Rev/Client/Month</div><div class="rp-metric-value">$${avgMonthlyPerClient.toFixed(0)}</div></div>
      <div class="rp-metric"><div class="rp-metric-label">Total Revenue (All Time)</div><div class="rp-metric-value">$${totalRev.toFixed(0)}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- Revenue Concentration -->
      <div class="card" style="border-left:4px solid ${top5Pct>50?'var(--danger)':top5Pct>35?'var(--warning)':'var(--success)'}">
        <div class="card-body">
          <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">⚠️ Revenue Concentration</h4>
          <div style="font-size:24px;font-weight:800;color:${top5Pct>50?'var(--danger)':top5Pct>35?'var(--warning)':'var(--success)'}">${top5Pct.toFixed(0)}%</div>
          <div style="font-size:12px;color:var(--ink-light);margin-bottom:10px">of revenue from your top 5 clients</div>
          ${top5Pct>50?`<div style="font-size:12px;color:var(--danger)">⚠️ High risk — losing 1-2 top clients would significantly impact revenue</div>`
          :top5Pct>35?`<div style="font-size:12px;color:var(--warning)">Moderate concentration — keep diversifying your client base</div>`
          :`<div style="font-size:12px;color:var(--success)">✅ Well diversified — no single client dominates revenue</div>`}
          ${topClient?`<div style="margin-top:8px;font-size:11px;color:var(--ink-light)">Biggest client: <strong>${esc(topClient.name)}</strong> — $${topClient.revenue.toFixed(0)} total ($${topClientMonthly.toFixed(0)}/mo)</div>`:''}
        </div>
      </div>

      <!-- Acquisition Value -->
      <div class="card" style="border-left:4px solid var(--info)">
        <div class="card-body">
          <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">💡 Client Acquisition Value</h4>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
            <div style="display:flex;justify-content:space-between"><span>Avg first 3 months revenue</span><strong>$${avgFirst3.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Avg lifetime revenue</span><strong>$${avgLTV.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Avg monthly value</span><strong>$${avgMonthlyPerClient.toFixed(0)}/mo</strong></div>
            <div style="border-top:1px solid var(--border);padding-top:8px">
              <strong>Max acquisition spend:</strong> You can afford up to <strong style="color:var(--success)">$${(avgFirst3*0.3).toFixed(0)}</strong> to acquire a new client (30% of first 3-month value) and still be profitable.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Client Cohorts -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-body">
        <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">📊 Client Cohorts</h4>
        <div style="overflow-x:auto">
          <table class="enq-list-table">
            <thead><tr><th>Cohort</th><th>Started</th><th>Still Active</th><th>Retention</th><th>Total Revenue</th><th>Avg LTV</th></tr></thead>
            <tbody>${Object.entries(cohorts).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,12).map(([month,d])=>{
              const ret=d.started>0?(d.active/d.started)*100:0;
              return `<tr>
                <td><strong>${month}</strong></td>
                <td>${d.started}</td>
                <td>${d.active}</td>
                <td style="color:${ret>=70?'var(--success)':ret>=40?'var(--warning)':'var(--danger)'}">${ret.toFixed(0)}%</td>
                <td>$${d.totalRev.toFixed(0)}</td>
                <td>$${d.started>0?(d.totalRev/d.started).toFixed(0):0}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Client Rankings -->
    <div class="card">
      <div class="card-body">
        <h4 style="font-size:13px;font-weight:700;margin-bottom:10px">🏆 Client Rankings by Lifetime Value</h4>
        <div style="overflow-x:auto">
          <table class="enq-list-table">
            <thead><tr><th>#</th><th>Client</th><th>Status</th><th>Tenure</th><th>Total Walks</th><th>Walks/Week</th><th>Lifetime Revenue</th><th>Monthly Avg</th></tr></thead>
            <tbody>${clientList.slice(0,20).map((c,i)=>`<tr>
              <td><strong>${i+1}</strong></td>
              <td><strong>${esc(c.name)}</strong></td>
              <td><span style="color:${c.isActive?'var(--success)':'var(--danger)'};font-size:11px">${c.isActive?'● Active':'○ Inactive'}</span></td>
              <td>${c.tenureMonths}mo</td>
              <td>${c.walks}</td>
              <td>${c.walksPerWeek.toFixed(1)}</td>
              <td style="font-weight:700">$${c.revenue.toFixed(0)}</td>
              <td>$${c.avgPerMonth.toFixed(0)}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ── GROWTH SIMULATOR ──
async function renderGrowthSim(){
  const el=document.getElementById('growth-sim-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Analysing your business data...</div>';

  // Fetch real walk data
  const walks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const settings=getRouteSettings();

  // Calculate current week baseline from actual data
  const now=new Date();
  const nowStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  // Get last 4 complete weeks for averages
  const fourWeeksAgo=new Date(now);fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const fourWeeksStr=`${fourWeeksAgo.getFullYear()}-${String(fourWeeksAgo.getMonth()+1).padStart(2,'0')}-${String(fourWeeksAgo.getDate()).padStart(2,'0')}`;
  const recentWalks=walks.filter(w=>w.date>=fourWeeksStr&&w.date<=nowStr);

  // Weekly averages
  const weeklyWalks=Math.round(recentWalks.length/4);
  const uniqueWeekDays=[...new Set(recentWalks.map(w=>w.date))].length;
  const avgDaysPerWeek=Math.round(uniqueWeekDays/4*10)/10;

  // Revenue estimate
  const weeklyRevenue=recentWalks.reduce((s,w)=>s+getClientPrice(w.client,w.service),0)/4;

  // Walk hours
  const totalHrs=recentWalks.reduce((s,w)=>s+(w.start&&w.end?(new Date(w.end)-new Date(w.start))/3600000:0),0)/4;
  const founderWeeklyCost=settings.founderWeeklyCost||850;
  const travelCostWeek=avgDaysPerWeek*5*settings.costPerKm;// ~5km per day
  const weeklyProfit=weeklyRevenue-founderWeeklyCost-travelCostWeek;
  const weeklyMargin=weeklyRevenue>0?(weeklyProfit/weeklyRevenue)*100:0;
  const effectiveHourly=totalHrs>0?weeklyProfit/totalHrs:0;

  // Pipeline data
  const qualifiedLeads=enquiries.filter(e=>e.stage==='qualified'||e.stage==='new'||e.stage==='contacted').length;

  // Average revenue per dog
  const avgRevPerDog=weeklyWalks>0?weeklyRevenue/weeklyWalks:55;

  el.innerHTML=`
    <!-- SECTION 1: Your Business Right Now -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--orange)">
      <div class="card-body">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:4px">📊 Your Business Right Now</h3>
        <p style="font-size:12px;color:var(--ink-light);margin-bottom:14px">Based on the last 4 weeks of actual walk data</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">
          <div class="rp-metric"><div class="rp-metric-label">Walks/Week</div><div class="rp-metric-value">${weeklyWalks}</div></div>
          <div class="rp-metric"><div class="rp-metric-label">Active Days/Week</div><div class="rp-metric-value">${avgDaysPerWeek}</div></div>
          <div class="rp-metric"><div class="rp-metric-label">Walk Hours/Week</div><div class="rp-metric-value">${totalHrs.toFixed(1)}h</div></div>
          <div class="rp-metric"><div class="rp-metric-label">Weekly Revenue</div><div class="rp-metric-value">$${weeklyRevenue.toFixed(0)}</div></div>
          <div class="rp-metric"><div class="rp-metric-label">Your Cost (Weekly)</div><div class="rp-metric-value">$${founderWeeklyCost}</div></div>
          <div class="rp-metric ${weeklyProfit>0?'good':'bad'}"><div class="rp-metric-label">Weekly Profit</div><div class="rp-metric-value">$${weeklyProfit.toFixed(0)}</div></div>
          <div class="rp-metric ${weeklyMargin>=40?'good':weeklyMargin>=20?'warn':'bad'}"><div class="rp-metric-label">Margin</div><div class="rp-metric-value">${weeklyMargin.toFixed(0)}%</div></div>
          <div class="rp-metric"><div class="rp-metric-label">Your Effective $/hr</div><div class="rp-metric-value">$${effectiveHourly.toFixed(0)}</div></div>
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--cream);border-radius:var(--radius-sm);font-size:12px">
          <strong>Pipeline:</strong> You have <strong style="color:var(--info)">${qualifiedLeads} active leads</strong> in your enquiry pipeline right now.
          ${totalHrs>25?`<span style="color:var(--warning)"> You're spending ${totalHrs.toFixed(0)}h/week walking — that's limited time for follow-ups and growth.</span>`:''}
        </div>
      </div>
    </div>

    <!-- SECTION 2: Growth Scenarios -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--info)">
      <div class="card-body">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:4px">🚀 Growth Scenarios</h3>
        <p style="font-size:12px;color:var(--ink-light);margin-bottom:14px">What happens when you hire? Adjust the inputs below.</p>
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group"><label>New Walker Hourly Rate ($)</label><input id="gs-rate" type="number" value="27" oninput="recalcGrowthSim()"></div>
          <div class="form-group"><label>Days Per Week</label><input id="gs-days" type="number" value="3" oninput="recalcGrowthSim()"></div>
          <div class="form-group"><label>Hours Per Day</label><input id="gs-hours" type="number" value="5" step="0.5" oninput="recalcGrowthSim()"></div>
          <div class="form-group"><label>Dogs They'd Walk/Day</label><input id="gs-dogs" type="number" value="6" oninput="recalcGrowthSim()"></div>
        </div>
        <div id="gs-scenarios"></div>
      </div>
    </div>

    <!-- SECTION 3: Break-Even -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--success)">
      <div class="card-body">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:4px">📈 Break-Even & Tipping Point</h3>
        <div id="gs-breakeven"></div>
      </div>
    </div>

    <!-- SECTION 4: Time ROI -->
    <div class="card" style="border-left:4px solid var(--purple)">
      <div class="card-body">
        <h3 style="font-size:16px;font-weight:800;margin-bottom:4px">⏰ The Real ROI — Your Time</h3>
        <div id="gs-time-roi"></div>
      </div>
    </div>
  `;

  // Store baseline for recalc
  window._gsBaseline={weeklyWalks,weeklyRevenue,weeklyProfit,weeklyMargin,totalHrs,founderWeeklyCost,travelCostWeek,avgRevPerDog,qualifiedLeads,effectiveHourly,avgDaysPerWeek};
  recalcGrowthSim();
}

function recalcGrowthSim(){
  const b=window._gsBaseline;
  if(!b) return;
  const settings=getRouteSettings();

  const hireRate=parseFloat(document.getElementById('gs-rate')?.value)||27;
  const hireDays=parseFloat(document.getElementById('gs-days')?.value)||3;
  const hireHrsPerDay=parseFloat(document.getElementById('gs-hours')?.value)||5;
  const hireDogsPerDay=parseFloat(document.getElementById('gs-dogs')?.value)||6;

  // Scenario A: Just you (current)
  const aRev=b.weeklyRevenue;
  const aCost=b.founderWeeklyCost+b.travelCostWeek;
  const aProfit=aRev-aCost;
  const aHrs=b.totalHrs;

  // Scenario B: You + 1 walker
  const hireWeeklyHrs=hireDays*hireHrsPerDay;
  const hireCostLoaded=hireRate*(1+settings.superRate)*hireWeeklyHrs;
  const hireTravel=hireDays*5*settings.costPerKm;
  const hireDogsWeek=hireDays*hireDogsPerDay;
  const hireRevenue=hireDogsWeek*b.avgRevPerDog;
  // Founder still does their walks, but could reduce
  const bRev=aRev+hireRevenue;
  const bCost=b.founderWeeklyCost+b.travelCostWeek+hireCostLoaded+hireTravel;
  const bProfit=bRev-bCost;
  const bMargin=bRev>0?(bProfit/bRev)*100:0;
  const founderFreedHrs=hireWeeklyHrs*0.7;// Not 1:1 — some overlap
  const founderNewHrs=Math.max(0,b.totalHrs-founderFreedHrs);

  // Scenario C: You + 2 walkers
  const cHireCost=hireCostLoaded*2;
  const cHireTravel=hireTravel*2;
  const cHireRev=hireRevenue*2;
  const cRev=aRev+cHireRev;
  const cCost=b.founderWeeklyCost+b.travelCostWeek+cHireCost+cHireTravel;
  const cProfit=cRev-cCost;
  const cMargin=cRev>0?(cProfit/cRev)*100:0;

  // Break-even
  const breakEvenDogsPerDay=hireCostLoaded>0?Math.ceil((hireCostLoaded+hireTravel)/(hireDays*b.avgRevPerDog)):0;
  const breakEvenWeeklyRev=hireCostLoaded+hireTravel;
  const breakEvenClients=Math.ceil(breakEvenDogsPerDay*1.2);// Not every client walks every day

  // Time ROI
  const targetHourly=settings.founderTargetHourly||80;
  const freedTimeValue=founderFreedHrs*targetHourly;
  const leadsPerHr=2;// Assume founder can follow up ~2 leads per hour
  const potentialLeadsContacted=Math.round(founderFreedHrs*leadsPerHr);
  const conversionRate=0.15;// 15% lead→client conversion
  const potentialNewClients=Math.round(potentialLeadsContacted*conversionRate);
  const clientLifetimeWeeklyRev=b.avgRevPerDog*2;// 2 walks/week avg

  document.getElementById('gs-scenarios').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
      <div style="background:var(--cream);border-radius:var(--radius);padding:16px;border:2px solid var(--border)">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">A: Just You (Current)</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
          <div style="display:flex;justify-content:space-between"><span>Weekly Revenue</span><strong>$${aRev.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Weekly Costs</span><strong>$${aCost.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px"><span style="font-weight:700">Weekly Profit</span><strong style="color:${aProfit>=0?'var(--success)':'var(--danger)'}">$${aProfit.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Your Walk Hours</span><strong>${aHrs.toFixed(1)}h</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Dogs/Week</span><strong>${b.weeklyWalks}</strong></div>
        </div>
      </div>
      <div style="background:var(--white);border-radius:var(--radius);padding:16px;border:2px solid var(--info)">
        <div style="font-size:13px;font-weight:700;color:var(--info);margin-bottom:10px">B: You + 1 Walker</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
          <div style="display:flex;justify-content:space-between"><span>Weekly Revenue</span><strong>$${bRev.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Your Cost</span><strong>$${(b.founderWeeklyCost+b.travelCostWeek).toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Staff Cost (${hireDays}d × ${hireHrsPerDay}h × $${hireRate}+super)</span><strong style="color:var(--danger)">$${(hireCostLoaded+hireTravel).toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px"><span style="font-weight:700">Weekly Profit</span><strong style="color:${bProfit>=0?'var(--success)':'var(--danger)'}">$${bProfit.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Dogs/Week</span><strong>${b.weeklyWalks+hireDogsWeek}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Your Walk Hours</span><strong>${founderNewHrs.toFixed(1)}h</strong></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--success)">Hours Freed Up</span><strong style="color:var(--success)">${founderFreedHrs.toFixed(1)}h</strong></div>
        </div>
      </div>
      <div style="background:var(--white);border-radius:var(--radius);padding:16px;border:2px solid var(--purple)">
        <div style="font-size:13px;font-weight:700;color:var(--purple);margin-bottom:10px">C: You + 2 Walkers</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
          <div style="display:flex;justify-content:space-between"><span>Weekly Revenue</span><strong>$${cRev.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Total Costs</span><strong>$${cCost.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border);padding-top:6px"><span style="font-weight:700">Weekly Profit</span><strong style="color:${cProfit>=0?'var(--success)':'var(--danger)'}">$${cProfit.toFixed(0)}</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Margin</span><strong>${cMargin.toFixed(0)}%</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Total Dogs/Week</span><strong>${b.weeklyWalks+hireDogsWeek*2}</strong></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--success)">Your Walk Hours</span><strong style="color:var(--success)">${Math.max(0,b.totalHrs-founderFreedHrs*2).toFixed(1)}h</strong></div>
        </div>
      </div>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--cream);border-radius:var(--radius-sm);font-size:12px;color:var(--ink-light)">
      ${bProfit>aProfit?`<strong style="color:var(--success)">Hiring 1 walker increases weekly profit by $${(bProfit-aProfit).toFixed(0)}</strong> while freeing up ${founderFreedHrs.toFixed(1)} hours of your week.`
      :`<strong style="color:var(--warning)">Hiring 1 walker reduces weekly profit by $${(aProfit-bProfit).toFixed(0)}</strong> — but frees up ${founderFreedHrs.toFixed(1)} hours. Worth it if you use that time for growth.`}
    </div>
  `;

  document.getElementById('gs-breakeven').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:12px">
      <div class="rp-metric" style="text-align:center"><div class="rp-metric-label">Break-Even Dogs/Day</div><div class="rp-metric-value">${breakEvenDogsPerDay}</div><div style="font-size:10px;color:var(--ink-xlight)">for the new walker to cover their cost</div></div>
      <div class="rp-metric" style="text-align:center"><div class="rp-metric-label">Break-Even Weekly Revenue</div><div class="rp-metric-value">$${breakEvenWeeklyRev.toFixed(0)}</div><div style="font-size:10px;color:var(--ink-xlight)">new walker needs to generate this</div></div>
      <div class="rp-metric" style="text-align:center"><div class="rp-metric-label">Clients Needed</div><div class="rp-metric-value">~${breakEvenClients}</div><div style="font-size:10px;color:var(--ink-xlight)">regular clients to sustain the hire</div></div>
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--cream);border-radius:var(--radius-sm);font-size:12px">
      ${hireDogsPerDay>=breakEvenDogsPerDay
        ?`<strong style="color:var(--success)">At ${hireDogsPerDay} dogs/day, the new walker is profitable from day one.</strong> They generate $${hireRevenue.toFixed(0)}/week against a cost of $${(hireCostLoaded+hireTravel).toFixed(0)}/week.`
        :`<strong style="color:var(--warning)">At ${hireDogsPerDay} dogs/day, the new walker isn't covering their cost yet.</strong> You need to get them to ${breakEvenDogsPerDay} dogs/day to break even. Focus on filling their schedule from your ${b.qualifiedLeads} pipeline leads.`}
    </div>
  `;

  document.getElementById('gs-time-roi').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">Hours You Get Back</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
          <div style="display:flex;justify-content:space-between"><span>Walk hours freed/week</span><strong style="color:var(--success)">${founderFreedHrs.toFixed(1)}h</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Your time value at $${targetHourly}/hr</span><strong style="color:var(--success)">$${freedTimeValue.toFixed(0)}/week</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Monthly time value</span><strong style="color:var(--success)">$${(freedTimeValue*4.3).toFixed(0)}/month</strong></div>
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">What You Could Do With That Time</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px">
          <div style="display:flex;justify-content:space-between"><span>Leads you could follow up</span><strong>${potentialLeadsContacted}/week</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Potential new clients (at 15% conversion)</span><strong style="color:var(--success)">${potentialNewClients}/week</strong></div>
          <div style="display:flex;justify-content:space-between"><span>Revenue from new clients</span><strong style="color:var(--success)">$${(potentialNewClients*clientLifetimeWeeklyRev).toFixed(0)}/week</strong></div>
          <div style="display:flex;justify-content:space-between"><span>You have ${b.qualifiedLeads} leads in pipeline</span><strong style="color:var(--info)">Ready to convert</strong></div>
        </div>
      </div>
    </div>
    <div style="margin-top:14px;padding:14px;background:var(--orange-xlight);border:1px solid var(--orange-light);border-radius:var(--radius-sm);font-size:13px">
      <strong>💡 Bottom Line:</strong> Hiring a walker at $${hireRate}/hr for ${hireDays} days/week costs <strong>$${(hireCostLoaded+hireTravel).toFixed(0)}/week</strong>.
      It frees up <strong>${founderFreedHrs.toFixed(1)} hours</strong> worth <strong>$${freedTimeValue.toFixed(0)}</strong> at your target rate.
      ${freedTimeValue>(hireCostLoaded+hireTravel)?`<span style="color:var(--success);font-weight:700"> The time you get back is worth more than the hire costs. This is a growth-positive move.</span>`
      :`<span style="color:var(--warning);font-weight:700"> The hire cost exceeds the time value — make sure you use the freed hours productively on sales and growth.</span>`}
    </div>
  `;
}

// ── FOUNDER VS STAFF COMPARISON ──
async function renderRpCompare(){
  const el=document.getElementById('rp-compare-content');
  if(!el) return;
  el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">Loading route data for the next month...</div>';

  // Fetch upcoming walks (today + 30 days)
  const walks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const futureWalks=walks;// Already filtered by API
  const settings=getRouteSettings();

  // Group by date + walker
  const routeMap={};
  futureWalks.forEach(w=>{
    const key=w.date+'|'+(w.walker||'Unknown');
    if(!routeMap[key]) routeMap[key]={date:w.date,walker:w.walker||'Unknown',walks:[]};
    routeMap[key].walks.push(w);
  });

  const routes=Object.values(routeMap).sort((a,b)=>a.date.localeCompare(b.date));

  if(!routes.length){
    el.innerHTML='<div style="text-align:center;padding:40px;color:var(--ink-xlight)">No upcoming walks found in Time to Pet.</div>';
    return;
  }

  // Build selector from actual routes
  const selectHtml=`<div style="margin-bottom:16px;display:flex;gap:12px;align-items:center">
    <label style="font-size:12px;font-weight:600">Select route:</label>
    <select id="rp-compare-select" onchange="renderCompareShift()" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;font-family:Inter,sans-serif;min-width:300px">`+
    routes.map((r,i)=>{
      const wConfig=getWalkerConfig(r.walker);
      const typeLabel=wConfig?` (${wConfig.type})`:'';
      return `<option value="${i}">${r.date} — ${esc(r.walker.replace(/\\+$/g,''))}${typeLabel} — ${r.walks.length} walks</option>`;
    }).join('')+
    `</select></div><div id="rp-compare-result"></div>`;
  el.innerHTML=selectHtml;

  // Store routes for the compare function to use
  window._compareRoutes=routes;
  renderCompareShift();
}

function renderCompareShift(){
  const sel=document.getElementById('rp-compare-select');
  const resultEl=document.getElementById('rp-compare-result');
  if(!sel||!resultEl) return;

  const routes=window._compareRoutes||[];
  const routeData=routes[parseInt(sel.value)];
  if(!routeData){resultEl.innerHTML='';return;}

  const settings=getRouteSettings();
  const wConfig=getWalkerConfig(routeData.walker);

  // Build a shift object from this route's walks
  const sorted=routeData.walks.sort((a,b)=>(a.start||'').localeCompare(b.start||''));
  const slots=[];
  sorted.forEach(w=>{
    if(!w.start||!w.end) return;
    const ws=new Date(w.start).getTime(),we=new Date(w.end).getTime();
    const existing=slots.find(sl=>ws<sl.end&&we>sl.start);
    if(existing){existing.start=Math.min(existing.start,ws);existing.end=Math.max(existing.end,we);}
    else slots.push({start:ws,end:we});
  });
  const actualServiceMins=slots.reduce((s,sl)=>s+((sl.end-sl.start)/60000),0);
  const travelMins=Math.max(0,(slots.length-1)*10);
  const totalMins=actualServiceMins+travelMins;

  const bookings=routeData.walks.map(w=>{
    const svc=(w.service||'').toLowerCase();
    const isAdventure=svc.includes('adventure')||svc.includes('2 hour');
    return {
      dogName:w.client,client:w.client,
      serviceType:isAdventure?'adventure':'group',
      price:isAdventure?(parseFloat(getSetting('s-price-adventure',75))||75):(parseFloat(getSetting('s-price-solo',55))||55),
      durationMins:w.start&&w.end?Math.round((new Date(w.end)-new Date(w.start))/60000):45,
    };
  });

  const shift={
    walker:routeData.walker.replace(/\\+$/g,''),
    walkerType:wConfig?.type||'founder',
    hourlyRate:wConfig?.rate||0,
    startTime:'08:00',endTime:'12:00',
    breakMins:0,maxDogs:settings.maxDogsPerShift,
    travelDistanceKm:slots.length*5,travelMins,
    variableCost:0,bookings,
    _actualServiceMins:actualServiceMins,
    _overrideShiftMins:totalMins,
  };

  const metrics=calcShiftMetrics(shift,settings);
  const comp=calcFounderComparison(metrics,settings);
  const f=comp.founder,st=comp.staff;
  const rev=metrics.totalRevenue;
  const betterLabel=comp.profitDiff>0?'Hiring staff':'Founder doing it';
  const betterColor=comp.profitDiff>0?'var(--info)':'var(--orange)';

  resultEl.innerHTML=`
    <!-- The Question -->
    <div class="card" style="margin-bottom:16px;border-left:4px solid var(--orange)">
      <div class="card-body">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px">Should you do this route yourself, or hire someone?</div>
        <div style="font-size:12px;color:var(--ink-light)">Route: <strong>${esc(shift.walker)}</strong> · ${shift.date} · ${metrics.dogCount} dogs · $${rev.toFixed(0)} revenue</div>
      </div>
    </div>

    <!-- Side by Side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <!-- Founder -->
      <div class="card" style="border-top:3px solid var(--orange)">
        <div class="card-body">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px">👤 If YOU do this route</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
            <div style="display:flex;justify-content:space-between"><span>Revenue</span><strong>$${rev.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Your cost (fixed daily)</span><strong style="color:var(--danger)">-$${f.labour.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Travel + variable costs</span><strong style="color:var(--danger)">-$${(metrics.travelCost+metrics.variableCost).toFixed(0)}</strong></div>
            <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-size:14px"><span style="font-weight:700">Cash you keep</span><strong style="color:${f.profit>=0?'var(--success)':'var(--danger)'}">$${f.profit.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:var(--ink-light);font-size:11px"><span>Margin</span><span>${f.margin.toFixed(0)}%</span></div>
          </div>
          <div style="margin-top:14px;padding:10px;background:var(--cream);border-radius:var(--radius-sm);font-size:11px;color:var(--ink-light)">
            <strong>But consider:</strong> Your time is worth $${settings.founderTargetHourly}/hr on growth, sales, and strategy. This route uses ${(metrics.shiftMins/60).toFixed(1)} hours of your day = <strong style="color:var(--danger)">$${f.opportunityCost.toFixed(0)} opportunity cost</strong>.
            ${f.netValue<0?`<div style="margin-top:6px;color:var(--danger);font-weight:600">Net value after opportunity cost: -$${Math.abs(f.netValue).toFixed(0)}. You're losing money in the bigger picture.</div>`:`<div style="margin-top:6px;color:var(--success);font-weight:600">Net value after opportunity cost: +$${f.netValue.toFixed(0)}. Still worth your time.</div>`}
          </div>
        </div>
      </div>

      <!-- Staff -->
      <div class="card" style="border-top:3px solid var(--info)">
        <div class="card-body">
          <div style="font-size:14px;font-weight:700;margin-bottom:12px">🧑‍💼 If you HIRE for this route</div>
          <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
            <div style="display:flex;justify-content:space-between"><span>Revenue</span><strong>$${rev.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Staff labour (${(metrics.shiftMins/60).toFixed(1)}h × $${settings.defaultRates.employee}/hr + super)</span><strong style="color:var(--danger)">-$${st.labour.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between"><span>Travel + variable costs</span><strong style="color:var(--danger)">-$${(metrics.travelCost+metrics.variableCost).toFixed(0)}</strong></div>
            <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;justify-content:space-between;font-size:14px"><span style="font-weight:700">Profit to business</span><strong style="color:${st.profit>=0?'var(--success)':'var(--danger)'}">$${st.profit.toFixed(0)}</strong></div>
            <div style="display:flex;justify-content:space-between;color:var(--ink-light);font-size:11px"><span>Margin</span><span>${st.margin.toFixed(0)}%</span></div>
          </div>
          <div style="margin-top:14px;padding:10px;background:var(--cream);border-radius:var(--radius-sm);font-size:11px;color:var(--ink-light)">
            <strong>What you gain:</strong> ${(metrics.shiftMins/60).toFixed(1)} hours freed up for business growth. At your target rate of $${settings.founderTargetHourly}/hr, that time is worth <strong style="color:var(--success)">$${f.opportunityCost.toFixed(0)}</strong> if spent on sales/growth.
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Line -->
    <div class="card" style="border-left:4px solid ${betterColor}">
      <div class="card-body" style="display:flex;align-items:center;gap:16px">
        <div style="font-size:36px">${comp.profitDiff>0?'🧑‍💼':'👤'}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:${betterColor}">${betterLabel} is the better option</div>
          <div style="font-size:13px;color:var(--ink-light);margin-top:4px">${comp.recommendation}</div>
          <div style="font-size:12px;margin-top:6px">
            ${comp.profitDiff>0
              ?`Hiring saves you <strong>$${f.opportunityCost.toFixed(0)}</strong> in opportunity cost while still generating <strong>$${st.profit.toFixed(0)}</strong> profit.`
              :`Doing it yourself nets <strong>$${Math.abs(comp.profitDiff).toFixed(0)}</strong> more profit, and your time value on this route exceeds the opportunity cost.`}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── SHIFT BUILDER ──
let editingShiftId=null;
let shiftBookings=[];

function openShiftBuilder(id){
  editingShiftId=null;
  shiftBookings=[];
  const settings=getRouteSettings();

  // Populate walker preset dropdown from config
  const presetEl=document.getElementById('sh-walker-preset');
  if(presetEl){
    presetEl.innerHTML='<option value="">Select walker...</option>'+
      walkerConfig.map(w=>`<option value="${esc(w.name)}|${w.type}${w.type!=='founder'?'|'+w.rate:''}">${esc(w.name)} (${w.type}${w.type!=='founder'?' - $'+w.rate+'/hr':''})</option>`).join('')+
      '<option value="_custom">+ Custom walker</option>';
  }

  if(id){
    // Edit existing shift
    const shift=rpShifts.find(s=>s.id===id);
    if(!shift){showToast('Shift not found','⚠️');return;}
    editingShiftId=id;
    shiftBookings=[...(shift.bookings||[])];
    document.getElementById('modal-shift-title').textContent='🛣️ Edit Shift — '+shift.walker;
    document.getElementById('sh-date').value=shift.date||'';
    document.getElementById('sh-walker').value=shift.walker||'';
    document.getElementById('sh-type').value=shift.walkerType||'employee';
    document.getElementById('sh-rate').value=shift.hourlyRate||30;
    document.getElementById('sh-start').value=shift.startTime||'08:00';
    document.getElementById('sh-end').value=shift.endTime||'12:00';
    document.getElementById('sh-break').value=shift.breakMins||0;
    document.getElementById('sh-maxdogs').value=shift.maxDogs||6;
    document.getElementById('sh-km').value=shift.travelDistanceKm||15;
    document.getElementById('sh-travel-mins').value=shift.travelMins||30;
    document.getElementById('sh-variable').value=shift.variableCost||0;
    document.getElementById('sh-fee').value=shift.paymentFee||0;
    document.getElementById('sh-btn-delete').style.display='inline-flex';
  }else{
    // New shift
    document.getElementById('modal-shift-title').textContent='🛣️ New Route';
    document.getElementById('sh-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('sh-walker').value='';
    document.getElementById('sh-type').value='founder';
    document.getElementById('sh-rate').value=0;// Founder uses fixed daily cost
    document.getElementById('sh-start').value='08:00';
    document.getElementById('sh-end').value='12:00';
    document.getElementById('sh-break').value=0;
    document.getElementById('sh-maxdogs').value=settings.maxDogsPerShift;
    document.getElementById('sh-km').value=15;
    document.getElementById('sh-travel-mins').value=30;
    document.getElementById('sh-variable').value=0;
    document.getElementById('sh-fee').value=0;
    document.getElementById('sh-btn-delete').style.display='none';
  }
  updateShiftRate();// Show/hide hourly rate based on walker type
  renderBookingRows();
  recalcShiftLive();
  openModal('modal-shift');
}

function updateShiftRate(){
  const type=document.getElementById('sh-type').value;
  const settings=getRouteSettings();
  const rateEl=document.getElementById('sh-rate');
  const rateGroup=rateEl?.closest('.form-group');
  if(type==='founder'){
    rateEl.value=0;
    if(rateGroup) rateGroup.style.display='none';
  }else{
    rateEl.value=settings.defaultRates[type]||30;
    if(rateGroup) rateGroup.style.display='';
  }
}

function applyWalkerPreset(){
  const preset=document.getElementById('sh-walker-preset')?.value||'';
  const customGroup=document.getElementById('sh-walker-custom-group');
  const typeGroup=document.getElementById('sh-type-group');
  if(preset==='_custom'){
    customGroup.style.display='';
    typeGroup.style.display='';
    document.getElementById('sh-walker').value='';
    document.getElementById('sh-type').value='employee';
    updateShiftRate();
    return;
  }
  if(!preset){return;}
  const parts=preset.split('|');
  const name=parts[0];
  const type=parts[1]||'founder';
  const rate=parts[2]?parseFloat(parts[2]):null;
  document.getElementById('sh-walker').value=name;
  document.getElementById('sh-type').value=type;
  customGroup.style.display='none';
  if(type==='founder'){
    typeGroup.style.display='none';
  }else{
    typeGroup.style.display='none';// Hide type too since preset sets it
  }
  if(rate!==null) document.getElementById('sh-rate').value=rate;
  updateShiftRate();
}

function addBookingRow(data){
  shiftBookings.push(data||{id:'bk_'+Date.now(),dogName:'',client:'',suburb:'',serviceType:'group',price:55,durationMins:45,groupSuitable:true,notes:''});
  renderBookingRows();
  recalcShiftLive();
}

function removeBooking(idx){
  shiftBookings.splice(idx,1);
  renderBookingRows();
  recalcShiftLive();
}

function renderBookingRows(){
  const el=document.getElementById('sh-bookings');
  const empty=document.getElementById('sh-bookings-empty');
  if(!shiftBookings.length){
    el.innerHTML='';
    empty.style.display='block';
    return;
  }
  empty.style.display='none';
  el.innerHTML=shiftBookings.map((b,i)=>`
    <div class="sh-booking">
      <div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr auto;gap:6px;align-items:end">
        <div class="form-group"><label>Client / Dog</label><input value="${esc(b.client||b.dogName||'')}" oninput="shiftBookings[${i}].client=this.value;shiftBookings[${i}].dogName=this.value;recalcShiftLive()" placeholder="Name"></div>
        <div class="form-group"><label>Service</label><select onchange="shiftBookings[${i}].serviceType=this.value;autoPrice(${i});recalcShiftLive()">
          <option value="group" ${b.serviceType==='group'?'selected':''}>Solo/Group Walk</option>
          <option value="adventure" ${b.serviceType==='adventure'?'selected':''}>2hr Adventure</option>
          <option value="puppy" ${b.serviceType==='puppy'?'selected':''}>Puppy Visit</option>
          <option value="other" ${b.serviceType==='other'?'selected':''}>Other</option>
        </select></div>
        <div class="form-group"><label>Price ($)</label><input type="number" value="${b.price||0}" oninput="shiftBookings[${i}].price=parseFloat(this.value)||0;recalcShiftLive()"></div>
        <div class="form-group"><label>Mins</label><input type="number" value="${b.durationMins||45}" oninput="shiftBookings[${i}].durationMins=parseInt(this.value)||0;recalcShiftLive()"></div>
        <button class="sh-remove" onclick="removeBooking(${i})" title="Remove">×</button>
      </div>
    </div>
  `).join('');
}

function autoPrice(idx){
  const b=shiftBookings[idx];
  const svc=b.serviceType;
  if(svc==='adventure') b.price=parseFloat(getSetting('s-price-adventure',75))||75;
  else b.price=parseFloat(getSetting('s-price-solo',55))||55;
  renderBookingRows();
}

async function importTTPBookings(){
  const date=document.getElementById('sh-date').value;
  const walker=document.getElementById('sh-walker').value.trim();
  if(!date){showToast('Set a date first','⚠️');return;}

  showToast('Importing walks from TTP...','📥');
  // Fetch upcoming walks
  const walks=await fetch('/api/walks/today?range=all').then(r=>r.ok?r.json():[]).catch(()=>[]);
  const dayWalks=walks.filter(w=>w.date===date);

  // Filter by walker name if provided
  let filtered=dayWalks;
  if(walker) filtered=dayWalks.filter(w=>(w.walker||'').toLowerCase().includes(walker.toLowerCase()));
  if(!filtered.length&&walker) filtered=dayWalks;// Fallback to all if no match

  if(!filtered.length){showToast('No walks found for this date','⚠️');return;}

  // Set walker from first walk if empty
  if(!walker&&filtered[0]?.walker){
    document.getElementById('sh-walker').value=filtered[0].walker.replace(/\\+$/g,'');
  }

  const sorted=filtered.sort((a,b)=>(a.start||'').localeCompare(b.start||''));

  // Detect service slots (group overlapping walks) to get actual service time
  const slots=[];
  sorted.forEach(w=>{
    if(!w.start||!w.end) return;
    const ws=new Date(w.start).getTime();
    const we=new Date(w.end).getTime();
    const existing=slots.find(sl=>ws<sl.end&&we>sl.start);
    if(existing){existing.start=Math.min(existing.start,ws);existing.end=Math.max(existing.end,we);}
    else slots.push({start:ws,end:we});
  });

  // Actual working time = service time + travel between slots
  const actualServiceMins=slots.reduce((s,sl)=>s+((sl.end-sl.start)/60000),0);
  const travelBetween=Math.max(0,(slots.length-1)*10);// ~10 mins between stops
  const totalWorkingMins=actualServiceMins+travelBetween;
  const workingHrs=totalWorkingMins/60;

  // Set shift times as actual working duration (not the full day window)
  // Use first walk start, and calculate end from actual working time
  const firstStartTime=parseAmPmTo24(sorted[0]?.time||'08:00');
  const startMins=timeToMins(firstStartTime);
  const endMins=startMins+Math.round(totalWorkingMins);
  const endH=Math.floor(endMins/60);
  const endM=endMins%60;
  const calcEndTime=`${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;

  document.getElementById('sh-start').value=firstStartTime;
  document.getElementById('sh-end').value=calcEndTime;
  document.getElementById('sh-travel-mins').value=travelBetween;
  document.getElementById('sh-km').value=slots.length*5;// ~5km per stop

  // Add bookings
  filtered.forEach(w=>{
    const svc=(w.service||'').toLowerCase();
    const isAdventure=svc.includes('adventure')||svc.includes('2 hour');
    const price=isAdventure?(parseFloat(getSetting('s-price-adventure',75))||75):(parseFloat(getSetting('s-price-solo',55))||55);
    const dur=w.start&&w.end?Math.round((new Date(w.end)-new Date(w.start))/60000):45;
    shiftBookings.push({
      id:'bk_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      dogName:w.client?.replace(/\\+$/g,'')||'',
      client:w.client?.replace(/\\+$/g,'')||'',
      suburb:'',serviceType:isAdventure?'adventure':'group',
      price,durationMins:dur,groupSuitable:true,notes:w.service||''
    });
  });

  renderBookingRows();
  recalcShiftLive();
  showToast(`Imported ${filtered.length} walks · ${workingHrs.toFixed(1)}h actual working time`,'✅');
}

function recalcShiftLive(){
  const shift=buildShiftFromForm();
  const settings=getRouteSettings();
  const metrics=calcShiftMetrics(shift,settings);
  renderLiveSummary(metrics,settings);
  renderScheduleSummary(metrics);
}

function buildShiftFromForm(){
  const travelMins=parseFloat(document.getElementById('sh-travel-mins')?.value)||0;
  // Calculate total walk time from bookings (detect group walks — overlapping durations count once)
  const totalWalkMins=shiftBookings.reduce((s,b)=>s+(parseFloat(b.durationMins)||0),0);
  // For grouped walks, use a simple heuristic: if multiple bookings share the same duration, they're likely grouped
  // Actual service time = unique walk blocks. For now use total as approximation, dashboard handles grouping from TTP
  const billableMins=totalWalkMins+travelMins;
  // Set hidden fields for calcShiftMetrics compatibility
  const startEl=document.getElementById('sh-start');
  const endEl=document.getElementById('sh-end');
  if(startEl) startEl.value='08:00';
  if(endEl){
    const endMins=480+Math.round(billableMins);
    endEl.value=`${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;
  }

  return {
    id:editingShiftId||('sh_'+Date.now()),
    date:document.getElementById('sh-date')?.value||'',
    walker:document.getElementById('sh-walker')?.value||'',
    walkerType:document.getElementById('sh-type')?.value||'employee',
    startTime:startEl?.value||'08:00',
    endTime:endEl?.value||'12:00',
    breakMins:0,
    maxDogs:parseInt(document.getElementById('sh-maxdogs')?.value)||6,
    hourlyRate:parseFloat(document.getElementById('sh-rate')?.value)||30,
    travelDistanceKm:parseFloat(document.getElementById('sh-km')?.value)||0,
    travelMins,
    variableCost:parseFloat(document.getElementById('sh-variable')?.value)||0,
    paymentFee:0,adminAlloc:0,
    bookings:shiftBookings,
    createdAt:new Date().toISOString(),
    source:'manual',
  };
}

function renderScheduleSummary(m){
  const el=document.getElementById('sh-schedule-summary');
  if(!el||!shiftBookings.length) {if(el)el.innerHTML='';return;}
  const walkHrs=(m.totalServiceMins/60).toFixed(1);
  const travelHrs=(m.travelMins/60).toFixed(1);
  const billableHrs=(m.shiftMins/60).toFixed(1);
  el.innerHTML=`
    <div style="display:flex;gap:12px;padding:10px 14px;background:var(--white);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px">
      <div>🐕 <strong>${m.dogCount}</strong> dogs</div>
      <div>⏱ <strong>${walkHrs}h</strong> walking</div>
      <div>🚗 <strong>${travelHrs}h</strong> travel</div>
      <div>📊 <strong>${billableHrs}h</strong> billable time</div>
      <div>💰 Labour: <strong>$${m.labourCost.toFixed(0)}</strong> ${m.walkerType==='founder'?'(fixed daily)':'('+billableHrs+'h × $'+m.hourlyRate+'/hr)'}</div>
    </div>`;
}

function renderLiveSummary(m,settings){
  const hi=getHealthInfo(m.health);
  const band=getScoreBand(m.score);

  document.getElementById('sh-health-badge').innerHTML=`<span class="rp-health ${hi.cls}">${hi.icon} ${hi.label}</span>`;

  document.getElementById('sh-score-display').innerHTML=`
    <div class="rp-score-ring ${band.cls}" style="margin:0 auto">${m.score}</div>
    <div style="font-size:10px;color:var(--ink-xlight);margin-top:4px">Route Score</div>
  `;

  const mClass=(val,good,bad)=>val>=good?'good':val<=bad?'bad':'warn';
  document.getElementById('sh-metrics').innerHTML=`
    <div class="rp-metric"><div class="rp-metric-label">Revenue</div><div class="rp-metric-value">$${m.totalRevenue.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Labour Cost</div><div class="rp-metric-value">$${m.labourCost.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Travel Cost</div><div class="rp-metric-value">$${m.travelCost.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Variable Cost</div><div class="rp-metric-value">$${m.variableCost.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Total Cost</div><div class="rp-metric-value">$${m.totalDirectCost.toFixed(0)}</div></div>
    <div class="rp-metric ${mClass(m.grossProfit,1,-1)}"><div class="rp-metric-label">Gross Profit</div><div class="rp-metric-value">$${m.grossProfit.toFixed(0)}</div></div>
    <div class="rp-metric ${mClass(m.grossMargin,40,20)}"><div class="rp-metric-label">Gross Margin</div><div class="rp-metric-value">${m.grossMargin.toFixed(1)}%</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Billable Hours</div><div class="rp-metric-value">${(m.shiftMins/60).toFixed(1)}h</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Walk Hours</div><div class="rp-metric-value">${(m.totalServiceMins/60).toFixed(1)}h</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Revenue/Hr</div><div class="rp-metric-value">$${m.revenuePerHr.toFixed(0)}</div></div>
    <div class="rp-metric ${mClass(m.profitPerHr,settings.targetProfitPerHr,10)}"><div class="rp-metric-label">Profit/Hr</div><div class="rp-metric-value">$${m.profitPerHr.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Dogs/Hr</div><div class="rp-metric-value">${m.dogsPerHr.toFixed(1)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Break-Even Rev</div><div class="rp-metric-value">$${m.breakEvenRevenue.toFixed(0)}</div></div>
    <div class="rp-metric"><div class="rp-metric-label">Break-Even Dogs</div><div class="rp-metric-value">${m.breakEvenDogs}</div></div>
  `;

  // Recommendations
  const recs=getRecommendations(m,settings);
  document.getElementById('sh-recs').innerHTML=recs.length?
    '<h4 style="font-size:12px;font-weight:700;margin-bottom:8px">Recommendations</h4>'+
    recs.map(r=>`<div class="rp-rec-item">${r.icon} ${r.text}</div>`).join(''):'';
}

function saveShift(){
  const shift=buildShiftFromForm();
  // Validation
  if(!shift.walker){showToast('Enter a walker name','⚠️');return;}
  if(timeToMins(shift.endTime)<=timeToMins(shift.startTime)){showToast('Shift end must be after start','⚠️');return;}

  if(editingShiftId){
    rpShifts=rpShifts.map(s=>s.id===editingShiftId?shift:s);
    showToast('Shift updated','✅');
  }else{
    rpShifts.push(shift);
    showToast('Shift saved','✅');
  }
  save('cw_shifts',rpShifts);
  closeModal('modal-shift');
  renderSavedShifts();
}

function deleteShift(){
  if(!editingShiftId||!confirm('Delete this route?')) return;
  rpShifts=rpShifts.filter(s=>s.id!==editingShiftId);
  save('cw_shifts',rpShifts);
  closeModal('modal-shift');
  renderSavedShifts();
  showToast('Route deleted','🗑️');
}

function quickDeleteShift(id){
  if(!confirm('Delete this route?')) return;
  rpShifts=rpShifts.filter(s=>s.id!==id);
  save('cw_shifts',rpShifts);
  renderSavedShifts();
  showToast('Route deleted','🗑️');
}

// ── ROUTE PLANNER — CALCULATION ENGINE ──

function getRouteSettings(){
  return {
    costPerKm: parseFloat(getSetting('s-cost-km',0.78))||0.78,
    superRate: (parseFloat(getSetting('s-super-rate',11.5))||11.5)/100,
    casualLoading: (parseFloat(getSetting('s-casual-load',25))||25)/100,
    marginThresholdGreen: parseFloat(getSetting('s-margin-green',40))||40,
    marginThresholdYellow: parseFloat(getSetting('s-margin-yellow',20))||20,
    travelLoadThresholdWarn: parseFloat(getSetting('s-travel-warn',30))||30,
    travelLoadThresholdDanger: parseFloat(getSetting('s-travel-danger',45))||45,
    targetProfitPerHr: parseFloat(getSetting('s-target-profit',30))||30,
    founderWeeklyCost: parseFloat(getSetting('s-founder-weekly',850))||850,
    founderDaysPerWeek: parseFloat(getSetting('s-founder-days',5))||5,
    founderDailyCost: (parseFloat(getSetting('s-founder-weekly',850))||850)/(parseFloat(getSetting('s-founder-days',5))||5),
    founderTargetHourly: parseFloat(getSetting('s-founder-target',80))||80,
    defaultBufferMins: parseFloat(getSetting('s-buffer-mins',15))||15,
    maxDogsPerShift: parseFloat(getSetting('s-max-dogs',6))||6,
    defaultRates:{
      founder: 0,// Founder uses fixed daily cost, not hourly
      employee: parseFloat(getSetting('s-rate-employee',30))||30,
      contractor: parseFloat(getSetting('s-rate-contractor',40))||40,
    }
  };
}

function calcLabourCost(walkerType, hourlyRate, shiftMins, superRate, casualLoading, settings, shiftDate){
  const s=settings||getRouteSettings();
  const hours=shiftMins/60;
  if(walkerType==='founder'){
    // Weekends = $0 labour (already covered by weekly salary)
    if(shiftDate){
      const [y,m,d]=(shiftDate+'').split('-').map(Number);
      const dow=new Date(y,m-1,d).getDay();// 0=Sun, 6=Sat
      if(dow===0||dow===6) return 0;
    }
    return s.founderDailyCost;// Weekday fixed daily cost
  }
  if(walkerType==='contractor') return hours*hourlyRate;// Raw rate, no loadings
  // Employee/casual: base + super + casual loading
  const loaded=hourlyRate*(1+superRate+(walkerType==='casual'?casualLoading:0));
  return hours*loaded;
}

function calcTravelCost(distanceKm, costPerKm){
  return Math.max(0,distanceKm*costPerKm);
}

function calcProfitability(revenue, labourCost, travelCost, variableCost){
  const totalDirectCost=labourCost+travelCost+variableCost;
  const grossProfit=revenue-totalDirectCost;
  const grossMargin=revenue>0?(grossProfit/revenue)*100:0;
  return {totalDirectCost, grossProfit, grossMargin};
}

function calcUtilisation(serviceMins, travelMins, bufferMins, shiftMins){
  if(shiftMins<=0) return 0;
  return ((serviceMins+travelMins+bufferMins)/shiftMins)*100;
}

function calcRouteHealth(margin, travelLoad, utilisation, settings){
  const s=settings||getRouteSettings();
  // Loss-making
  if(margin<=0) return 'loss';
  // Not Viable: very low margin or impossible to deliver
  if(margin<s.marginThresholdYellow||utilisation>120||travelLoad>s.travelLoadThresholdDanger) return 'not-viable';
  // Needs Work: below target but not terrible
  if(margin<s.marginThresholdGreen||travelLoad>s.travelLoadThresholdWarn) return 'needs-work';
  // Strong: great margin and healthy metrics
  if(margin>=60) return 'strong';
  // Viable: meets thresholds
  return 'viable';
}

function calcRouteScore(margin, travelLoad, utilisation, dogCount, maxDogs){
  let score=0;
  // Profitability (35%)
  if(margin>=60) score+=35; else if(margin>=40) score+=28; else if(margin>=20) score+=18; else if(margin>=0) score+=8;
  // Travel efficiency (20%)
  if(travelLoad<=15) score+=20; else if(travelLoad<=30) score+=16; else if(travelLoad<=45) score+=8; else score+=2;
  // Utilisation (25%) — optimal around 80%
  const utilDiff=Math.abs(utilisation-80);
  if(utilDiff<=10) score+=25; else if(utilDiff<=20) score+=18; else if(utilDiff<=35) score+=10; else score+=3;
  // Capacity fill (20%)
  const fill=maxDogs>0?(dogCount/maxDogs):0;
  if(fill>=0.8) score+=20; else if(fill>=0.6) score+=15; else if(fill>=0.4) score+=8; else score+=3;
  return Math.min(100,Math.max(0,Math.round(score)));
}

const HEALTH_MAP={
  'strong':{cls:'rp-health-strong',label:'Strong',icon:'🟢'},
  'viable':{cls:'rp-health-viable',label:'Viable',icon:'✅'},
  'needs-work':{cls:'rp-health-needs-work',label:'Needs Work',icon:'🟡'},
  'not-viable':{cls:'rp-health-not-viable',label:'Not Viable',icon:'🔴'},
  'loss':{cls:'rp-health-loss',label:'Loss Making',icon:'⛔'},
};
function getHealthInfo(h){return HEALTH_MAP[h]||HEALTH_MAP['needs-work'];}

function getScoreBand(score){
  if(score>=80) return {label:'Excellent',cls:'rp-score-excellent'};
  if(score>=60) return {label:'Workable',cls:'rp-score-workable'};
  if(score>=40) return {label:'Weak',cls:'rp-score-weak'};
  return {label:'Poor',cls:'rp-score-poor'};
}

function getRecommendations(m, settings){
  const s=settings||getRouteSettings();
  const recs=[];
  if(m.grossProfit<=0) recs.push({p:1,icon:'🔴',text:'Route is currently unprofitable. Reduce travel or add more bookings.'});
  if(m.grossMargin>0&&m.grossMargin<s.marginThresholdYellow) recs.push({p:2,icon:'⚠️',text:`Margin is below ${s.marginThresholdYellow}% target. Consider adding another dog or raising prices.`});
  if(m.travelLoad>s.travelLoadThresholdDanger) recs.push({p:2,icon:'🚗',text:'Travel time is too high relative to route value. Cluster bookings closer together.'});
  if(m.travelLoad>s.travelLoadThresholdWarn&&m.travelLoad<=s.travelLoadThresholdDanger) recs.push({p:3,icon:'📍',text:'Travel load is elevated. Consider tighter geographic grouping.'});
  if(m.utilisation>100) recs.push({p:1,icon:'❌',text:'Route is not feasible within current shift length. Reduce bookings or extend shift.'});
  if(m.utilisation<60) recs.push({p:3,icon:'📉',text:'Shift appears underfilled. There\'s capacity for more bookings.'});
  if(m.dogCount<m.maxDogs&&m.grossMargin<s.marginThresholdGreen) recs.push({p:3,icon:'🐕',text:`Capacity for ${m.maxDogs-m.dogCount} more dogs. Adding one could significantly improve margin.`});
  if(m.profitPerHr<s.targetProfitPerHr&&m.grossProfit>0) recs.push({p:3,icon:'💰',text:`Profit/hr ($${m.profitPerHr.toFixed(0)}) is below target ($${s.targetProfitPerHr}). Optimise route density.`});
  if(m.walkerType==='founder'&&m.grossMargin>0&&m.grossMargin<50) recs.push({p:2,icon:'👤',text:'This route may be better assigned to a staff walker to free up founder time.'});
  if(m.grossMargin>=60&&m.utilisation>=70) recs.push({p:4,icon:'✅',text:'Route is performing well. Good profitability and utilisation.'});
  return recs.sort((a,b)=>a.p-b.p).slice(0,5);
}

function calcFounderComparison(metrics, settings){
  const s=settings||getRouteSettings();
  const shiftHrs=metrics.shiftMins/60;
  // Founder view — fixed daily cost
  const founderLabour=s.founderDailyCost;
  const founderProfit=metrics.totalRevenue-(founderLabour+metrics.travelCost+metrics.variableCost);
  const founderMargin=metrics.totalRevenue>0?(founderProfit/metrics.totalRevenue)*100:0;
  const founderOpportunityCost=shiftHrs*s.founderTargetHourly;
  const founderNetValue=founderProfit-founderOpportunityCost;
  // Staff view
  const staffRate=s.defaultRates.employee;
  const staffLabour=calcLabourCost('employee',staffRate,metrics.shiftMins,s.superRate,s.casualLoading);
  const staffProfit=metrics.totalRevenue-(staffLabour+metrics.travelCost+metrics.variableCost);
  const staffMargin=metrics.totalRevenue>0?(staffProfit/metrics.totalRevenue)*100:0;
  const staffProfitPerHr=shiftHrs>0?staffProfit/shiftHrs:0;
  // Comparison
  const profitDiff=staffProfit-founderProfit;
  let recommendation='';
  if(founderNetValue<0&&staffProfit>0) recommendation='This route should be assigned to staff. Founder time is more valuable elsewhere.';
  else if(founderMargin>=60) recommendation='Founder should keep this route — strong margin justifies the time.';
  else if(staffProfit>founderProfit) recommendation=`Staff route is $${Math.abs(profitDiff).toFixed(0)} more profitable due to lower notional cost.`;
  else recommendation='Route economics are similar. Consider strategic priorities.';
  return {
    founder:{labour:founderLabour,profit:founderProfit,margin:founderMargin,opportunityCost:founderOpportunityCost,netValue:founderNetValue},
    staff:{labour:staffLabour,profit:staffProfit,margin:staffMargin,profitPerHr:staffProfitPerHr},
    profitDiff,recommendation
  };
}

function calcShiftMetrics(shift, settings){
  const s=settings||getRouteSettings();
  const startMins=timeToMins(shift.startTime);
  const endMins=timeToMins(shift.endTime);
  const shiftMins=shift._overrideShiftMins||(endMins-startMins);
  const breakMins=shift.breakMins||0;
  const availableMins=shiftMins-breakMins;
  const bookings=shift.bookings||[];
  const totalRevenue=bookings.reduce((sum,b)=>sum+(parseFloat(b.price)||0),0);
  // Use actual occupied service time if available (accounts for grouped/overlapping walks)
  const totalServiceMins=shift._actualServiceMins||bookings.reduce((sum,b)=>sum+(parseFloat(b.durationMins)||0),0);
  const dogCount=bookings.length;
  const maxDogs=shift.maxDogs||s.maxDogsPerShift;
  const travelMins=parseFloat(shift.travelMins)||0;
  const travelKm=parseFloat(shift.travelDistanceKm)||0;
  const bufferMins=parseFloat(shift.bufferMins)||s.defaultBufferMins;
  const hourlyRate=parseFloat(shift.hourlyRate)||(s.defaultRates[shift.walkerType]||0);
  const variableCost=(parseFloat(shift.variableCost)||0)+(parseFloat(shift.paymentFee)||0)+(parseFloat(shift.adminAlloc)||0);
  const labourCost=calcLabourCost(shift.walkerType||'employee',hourlyRate,shiftMins,s.superRate,s.casualLoading,s,shift.date);
  const travelCost=calcTravelCost(travelKm,s.costPerKm);
  const {totalDirectCost,grossProfit,grossMargin}=calcProfitability(totalRevenue,labourCost,travelCost,variableCost);
  const shiftHrs=shiftMins/60;
  const revenuePerHr=shiftHrs>0?totalRevenue/shiftHrs:0;
  const profitPerHr=shiftHrs>0?grossProfit/shiftHrs:0;
  const dogsPerHr=shiftHrs>0?dogCount/shiftHrs:0;
  const travelLoad=shiftMins>0?(travelMins/shiftMins)*100:0;
  const utilisation=calcUtilisation(totalServiceMins,travelMins,bufferMins,shiftMins);
  const avgRevenuePerDog=dogCount>0?totalRevenue/dogCount:0;
  const breakEvenRevenue=totalDirectCost;
  const breakEvenDogs=avgRevenuePerDog>0?Math.ceil(totalDirectCost/avgRevenuePerDog):0;
  const health=calcRouteHealth(grossMargin,travelLoad,utilisation,s);
  const score=calcRouteScore(grossMargin,travelLoad,utilisation,dogCount,maxDogs);
  return {
    shiftMins,availableMins,breakMins,totalRevenue,totalServiceMins,dogCount,maxDogs,
    travelMins,travelKm,labourCost,travelCost,variableCost,totalDirectCost,
    grossProfit,grossMargin,revenuePerHr,profitPerHr,dogsPerHr,
    travelLoad,utilisation,breakEvenRevenue,breakEvenDogs,
    health,score,walkerType:shift.walkerType||'employee',hourlyRate
  };
}

function timeToMins(t){
  if(!t) return 0;
  const [h,m]=(t+'').split(':').map(Number);
  return (h||0)*60+(m||0);
}

// ── INIT ──
document.getElementById('topbar-sub').textContent=new Date().toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
renderDashboard();
updateBadges();
