/* AVA MINA SPORT — pure front-end mobile tournament manager; no external dependencies */
(() => {
  'use strict';
  const KEY = 'ava-mina-league-v1'; // Same key: keep stored tournaments
  const FEE = 5, LIMIT = 50;
  const GAMES = [
    { id:'jenga', name:'جينجا', mode:'jenga', desc:'إقصاء فردي' },
    { id:'connect4', name:'كونكت 4', mode:'groups', desc:'مجموعات ثم نهائيات' },
    { id:'pingpong', name:'تنس طاولة', mode:'groups', desc:'مجموعات ثم نهائيات' },
    { id:'billiards', name:'بلياردو', mode:'knockout', desc:'خروج المغلوب' },
    { id:'domino', name:'دومينو', mode:'knockout', desc:'خروج المغلوب' },
    { id:'chess', name:'شطرنج', mode:'knockout', desc:'خروج المغلوب' },
    { id:'playstation', name:'بلاستيشن', mode:'knockout', desc:'خروج المغلوب' },
  ];
  const gameById = id => GAMES.find(g => g.id === id) || GAMES[0];
  const $ = sel => document.querySelector(sel);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const digits = n => Number(n || 0).toLocaleString('ar-EG');
  const localDate = d => { const v = d || new Date();return [v.getFullYear(),String(v.getMonth()+1).padStart(2,'0'),String(v.getDate()).padStart(2,'0')].join('-') };
  const formatDate = s => { const d=new Date(s+'T12:00:00');return new Intl.DateTimeFormat('ar-EG',{day:'numeric',month:'long',year:'numeric'}).format(d) };
  const newId = () => { try { return crypto.randomUUID(); } catch (_) {return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;} };
  const randIndex = len => { if(globalThis.crypto && crypto.getRandomValues) { const arr = new Uint32Array(1); const upper = 0x100000000, limit = upper - (upper % len); let num; do{crypto.getRandomValues(arr);num=arr[0];}while(num>=limit);return num%len;} return Math.floor(Math.random()*len);};
  function shuffle(input){ const a=[...input];for(let i=a.length-1;i>0;i--){const j=randIndex(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; }
  function restore(){ try { const o=JSON.parse(localStorage.getItem(KEY));return o&&Array.isArray(o.sessions)?{sessions:o.sessions,currentId:o.currentId||null}:{sessions:[],currentId:null} } catch(_){return {sessions:[],currentId:null}} }
  let db=restore(), page='home', selected=null, groupSelections={}, searchText='', toastTimer=null, shouldFocusInput=false, shouldFocusLate=false, latePanelOpen=false;
  function persist(){try {localStorage.setItem(KEY,JSON.stringify(db))}catch(_){notify('تعذر الحفظ على الجهاز. تأكد من مساحة المتصفح.')}}
  const active = () => db.sessions.find(t=>t.id===db.currentId)||null;
  const playerName = (t,id) => t.players.find(p=>p.id===id)?.name||'غير معروف';
  function notify(message){ const e=$('#toast'); e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),2600); }
  function switchPage(to,scroll=true){page=to;selected=null;latePanelOpen=false;render();if(scroll)window.scrollTo(0,0)}
  function createGame(id){const t={id:newId(),gameId:id,date:localDate(),players:[],phase:'registration',bracket:null,groups:null,jenga:null,pendingLate:null,lateMatches:[],directQualifiers:[]};db.sessions.push(t);db.currentId=t.id;persist();switchPage('registration')}
  function startNew(){switchPage('games')}
  function baseChampion(t){
    if(!t)return null;
    if(t.jenga){const alive=t.jenga.order.filter(id=>!t.jenga.eliminated.includes(id));return alive.length===1?alive[0]:null;}
    if(t.bracket?.rounds?.length){const last=t.bracket.rounds.at(-1);return last.length===1?last[0].winner:null;}
    return null;
  }
  function currentChampion(t){
    if(!t || t.pendingLate)return null;
    let champ=baseChampion(t);
    if(!champ)return null;
    for(const match of (t.lateMatches||[])){
      if(!match.winner||![champ,match.winner].includes(match.challengeWinner))return null;
      champ=match.challengeWinner;
    }
    return champ;
  }
  const hasDraw=t=>!!t && t.phase!=='registration';
  // الدوريات القديمة التي كانت بنظام خروج المغلوب تظل كما هي.
  const isGroupTournament=t=>gameById(t.gameId).mode==='groups'&&Array.isArray(t.groups);
  function leagueTotal(t){return (t?.players?.length||0)*FEE}
  function dailyTotal(date){return db.sessions.reduce((acc,s)=>acc+s.players.filter(p=>(p.registeredOn||s.date)===date).length*FEE,0)}
  function pageHead(label,back='home'){return `<header class="header"><button class="icon-btn" data-action="back" data-to="${back}" title="رجوع" aria-label="رجوع">→</button><div class="brand"><span>AVA MINA SPORT</span><img src="assets/ava-mina-logo.png" alt="شعار AVA MINA"></div></header><div class="eyebrow">${label}</div>`}
  function dock(content){return `<div class="sticky-actions">${content}</div>`}
  function home(){return `<main class="home"><img class="home-logo" src="assets/ava-mina-logo.png" alt="شعار AVA MINA SPORT"><div class="home-actions"><button class="cta" data-action="new"><span>إنشاء الدوري</span><span class="plus" aria-hidden="true">＋</span></button><div class="home-spacer"></div></div></main>`}
  function gamesPage(){const last=active()||db.sessions.at(-1);return `<main class="shell">${pageHead('01 / البداية')}<h1 class="section-heading">اختار اللعبة</h1><p class="subtitle">اختار اللعبة اللي هتعمل لها الدوري.</p><div class="games-grid">${GAMES.map((g,i)=>`<button class="game-card" data-action="choose-game" data-game="${g.id}"><span class="num">${String(i+1).padStart(2,'0')}</span><span class="game-title">${esc(g.name)}</span><span class="game-type">${esc(g.desc)}</span></button>`).join('')}</div>${last&&last.players.length?`<div class="section-bar" style="margin-top:20px"><button class="muted-button" data-action="resume" data-id="${esc(last.id)}">↩ استكمال آخر دوري</button><button class="muted-button" data-action="history">الدوريات السابقة</button></div>`:''}</main>`}
  function registrationPage(t){const g=gameById(t.gameId), n=t.players.length;return `<main class="shell">${pageHead('02 / تسجيل اللاعبين','games')}<div class="details-top"><span class="game-badge">${esc(g.name)}</span><span class="date-pill">${esc(formatDate(t.date))}</span></div><h1 class="section-heading" style="margin-top:14px">تسجيل اللاعبين</h1><p class="subtitle">سجّل الأسماء وبعدها اعمل القرعة.</p><div class="stats"><div class="stat"><span class="label">اللاعبون</span><strong>${digits(n)} <small>/ ${digits(LIMIT)}</small></strong></div><div class="stat"><span class="label">رسوم التسجيل</span><strong>${digits(n*FEE)} <small>جنيه</small></strong></div></div><form class="entry-form" id="player-form"><input class="text-input" id="player-input" maxlength="70" enterkeyhint="done" autocomplete="off" placeholder="اسم اللاعب" aria-label="اسم اللاعب" ${n>=LIMIT?'disabled':''}><button class="add-btn" title="إضافة اللاعب" aria-label="إضافة اللاعب" ${n>=LIMIT?'disabled':''}>＋</button></form><p class="hint">${digits(FEE)} جنيه للفرد · بحد أقصى ${digits(LIMIT)} لاعبًا · التاريخ تلقائي</p><div class="section-bar"><h2>قائمة المسجلين</h2><span class="tiny">${digits(n)} اسم</span></div>${n?`<div class="names-list">${t.players.map((p,i)=>`<div class="name-row"><span class="player-index">${String(i+1).padStart(2,'0')}</span><span class="player-name">${esc(p.name)}</span><button class="remove" data-action="remove-player" data-id="${p.id}" title="حذف ${esc(p.name)}" aria-label="حذف ${esc(p.name)}">×</button></div>`).join('')}</div>`:'<div class="empty">الأسماء اللي هتسجلها هتظهر هنا.</div>'}<div style="margin-top:20px"><button class="muted-button" data-action="delete-tournament">حذف تسجيل الدوري ده</button></div></main>${dock(`<button class="cta" data-action="draw" ${n<(g.mode==='groups'?3:2)?'disabled':''}><span>إنشاء القرعة</span><span class="plus" aria-hidden="true">↗</span></button>`)}`}
  // كل دور = مباريات ثنائية حقيقية + تأهل تلقائي واحد فقط إن كان العدد فرديًا.
  // preserveOrder=true يحافظ على مواجهات أوائل المجموعات مع ثواني مجموعات مختلفة.
  function pairRound(ids,preserveOrder=false){
    const arr=preserveOrder?[...ids]:shuffle(ids), pairs=[];
    for(let i=0;i+1<arr.length;i+=2)pairs.push({a:arr[i],b:arr[i+1],winner:null});
    if(arr.length%2)pairs.push({a:arr[arr.length-1],b:null,winner:arr[arr.length-1]});
    return pairs;
  }
  function makeBracket(ids,options={}){
    return {rounds:[pairRound(ids,!!options.preserveOrder)]};
  }
  function extendBracket(t){
    const rounds=t.bracket.rounds;
    while(rounds.length<8){
      const prev=rounds.at(-1);
      if(!prev.every(m=>m.winner)||prev.length===1)break;
      const winners=prev.map(m=>m.winner);
      rounds.push(pairRound(winners));
    }
  }
  function needsBracketRepair(t){
    return !!(t.bracket?.rounds?.[0]?.filter(m=>!m.b).length>1);
  }
  function repairBracket(t){
    if(!t.bracket||!needsBracketRepair(t))return;
    const grouped=gameById(t.gameId).mode==='groups'&&Array.isArray(t.groups);
    if(grouped&&!t.groups.every(g=>getQualifiers(g)))return notify('كمّل نتائج المجموعات الأول');
    const existingResults=t.bracket.rounds.some(round=>round.some(m=>m.b&&m.winner));
    const message=existingResults
      ? 'هتتظبط مواجهات النهائيات، لكن نتائج خروج المغلوب المسجلة هتتمسح. نتائج المجموعات والأسماء هتفضل زي ما هي. تكمل؟'
      : 'نصلح ترتيب المواجهات من غير ما نمسح الأسماء أو نتائج المجموعات؟';
    if(!confirm(message))return;
    if(grouped){
      // احتفظ بمواجهات اللاعبين الجدد ولا تحذفها أثناء تصحيح جدول النهائيات.
      const additions=(t.bracket.rounds[0]||[]).filter(m=>m.lateEntry).map(m=>({...m}));
      t.bracket=makeGroupFinals(t.groups);
      t.bracket.rounds[0].push(...additions);
      t.phase='final';
      extendBracket(t);
    } else t.bracket=makeBracket(t.players.map(p=>p.id));
    t.lateMatches=(t.lateMatches||[]).map(m=>({...m,challengeWinner:null}));
    selected=null;persist();render();notify('اتصلحت القرعة بدون تغيير بيانات التسجيل');
  }
  // A1 ضد B2، B1 ضد A2. ولأكثر من مجموعتين يتم الربط مع المجموعة التالية.
  function makeGroupFinals(groups){
    const qualifiers=groups.map(g=>getQualifiers(g));
    if(qualifiers.some(q=>!q||q.length!==2))throw new Error('Incomplete group qualifiers');
    const ids=[];
    for(let i=0;i<qualifiers.length;i++){
      ids.push(qualifiers[i][0],qualifiers[(i+1)%qualifiers.length][1]);
    }
    return makeBracket(ids,{preserveOrder:true});
  }
  // Avoid two-person groups: distribute the remainder to existing groups of 3.
  // With exactly five people a single group of five is necessary (3+2 is forbidden).
  function groupSizes(n){
    if(n<3)return [];
    if(n===5)return [5];
    const num=Math.floor(n/3),extra=n-3*num;
    return Array.from({length:num},(_,i)=>3+(i<extra?1:0));
  }
  // Round robin: every player faces every other once, with two simultaneous matches
  // per round for a four-player group (and one rest for an odd-sized group).
  function groupRoundRobin(members){
    let ring=[...members];if(ring.length%2)ring.push(null);
    const size=ring.length,matches=[];
    for(let round=0;round<size-1;round++){
      for(let i=0;i<size/2;i++){
        const a=ring[i],b=ring[size-1-i];
        if(a!=null&&b!=null)matches.push({a,b,round,winner:null});
      }
      ring=[ring[0],ring[size-1],...ring.slice(1,size-1)];
    }
    return matches;
  }
  function makeGroups(ids){
    const shuffled=shuffle(ids),sizes=groupSizes(ids.length);let i=0;
    return sizes.map((sz,index)=>{
      const members=shuffled.slice(i,i+sz);i+=sz;
      return{id:index,members,matches:groupRoundRobin(members),manualQualifiers:null};
    });
  }
  function hasSmallGroups(t){return !!(t.groups?.some(g=>g.members.length<3)&&t.phase==='draw');}
  function redistributeSmallGroups(t,ask=true){
    if(!hasSmallGroups(t))return;
    const n=t.groups.reduce((sum,g)=>sum+g.members.length,0);
    if(n<3)return notify('محتاج 3 لاعبين على الأقل عشان توزع مجموعات');
    const before=t.groups;
    const large=before.filter(g=>g.members.length>=3).map(g=>[...g.members]);
    const leftovers=before.filter(g=>g.members.length<3).flatMap(g=>g.members);
    const desiredGroups=groupSizes(n).length;
    const additionalGroups=Math.max(0,desiredGroups-large.length);
    let eligible=Math.max(0,leftovers.length-3*additionalGroups);
    const limit=n===5?5:4;
    for(const grp of large){
      while(grp.length<limit&&eligible>0&&leftovers.length){grp.push(leftovers.shift());eligible--;}
    }
    const chunks=leftovers.length?[...groupSizes(leftovers.length)]:[];
    // 5 players may be represented by one group of 5 rather than 3+2.
    const rebuilt=[...large];
    let cursor=0;
    for(const sz of chunks){rebuilt.push(leftovers.slice(cursor,cursor+sz));cursor+=sz;}
    // Fallback for arbitrary legacy layouts: collect all and repack without shuffling.
    const normalized=rebuilt.some(g=>g.length<3)||(rebuilt.reduce((sum,g)=>sum+g.length,0)!==n)
      ? (()=>{const ids=before.flatMap(g=>g.members),sizes=groupSizes(n);let i=0;return sizes.map(sz=>{const g=ids.slice(i,i+sz);i+=sz;return g;});})()
      : rebuilt;
    const oldOutcomes=new Map();
    for(const g of before)for(const m of g.matches){
      if(m.winner)oldOutcomes.set([m.a,m.b].sort().join('|'),m.winner);
    }
    const result=normalized.map((members,id)=>({id,members,matches:groupRoundRobin(members),manualQualifiers:null}));
    let kept=0;
    for(const g of result)for(const m of g.matches){
      const winner=oldOutcomes.get([m.a,m.b].sort().join('|'));
      if(winner){m.winner=winner;kept++;}
    }
    const discarded=oldOutcomes.size-kept;
    if(ask&&!confirm(discarded
      ?`هنوزّع لاعبي المجموعات اللي فيها اتنين على باقي المجموعات. هتفضل ${kept} نتيجة محفوظة، و${discarded} نتيجة هتتلغي لأن اللاعبين مش هيبقوا في نفس المجموعة. تكمل؟`
      :'هنوزّع اللاعبين على مجموعات 3 أو 4 من غير إعادة القرعة العشوائية. تكمل؟'))return;
    t.groups=result;
    groupSelections={};
    persist();if(ask){render();notify('اتظبطت المجموعات من غير مجموعات فردين');}
  }
  function makeDraw(t){const ids=t.players.map(p=>p.id); if(ids.length<2) return notify('لازم تسجل لاعبين على الأقل');if(gameById(t.gameId).mode==='groups' && ids.length<3)return notify('نظام المجموعات محتاج 3 لاعبين على الأقل');if(!confirm(`تنشئ القرعة لـ ${t.players.length} لاعب؟ تقدر تضيف لاعبين بعدين من غير إعادة القرعة.`))return;t.phase='draw';if(gameById(t.gameId).mode==='jenga')t.jenga={order:shuffle(ids),eliminated:[]};else if(gameById(t.gameId).mode==='groups')t.groups=makeGroups(ids);else t.bracket=makeBracket(ids);persist();switchPage('tournament');notify('اتعملت القرعة بنجاح')}
  function lateRegistration(t){
    const n=t.players.length,grouped=isGroupTournament(t),pending=grouped?null:t.pendingLate;
    const direct=(t.directQualifiers||[]).length;
    const toggle=`<button class="secondary-action late-toggle" data-action="toggle-late" aria-expanded="${latePanelOpen}" aria-controls="late-panel">＋ إضافة لاعبين <span class="late-counter">${digits(n)} / ${digits(LIMIT)}</span></button>`;
    const pendingNote=pending?`<div class="notice waiting"><strong>${esc(playerName(t,pending))}</strong> في انتظار الاسم اللي بعده علشان يلعبوا ضد بعض.${n===LIMIT?' تقدر تأهله تلقائيًا الآن.':''}</div>`:'';
    const directNote=grouped&&t.phase==='draw'&&direct?`<div class="notice"><strong>${digits(direct)} لاعب جديد</strong> اتأهلوا مباشرة لأول دور خروج مغلوب بعد المجموعات، من غير انتظار لاعب جديد.</div>`:'';
    const desc=grouped?'كل لاعب بتضيفه <strong>بيتأهل فورًا لأول دور بعد المجموعات</strong> من غير ما يدخل مجموعة ومن غير ما يستنى اسم تاني. المجموعات والنتائج القديمة مش هتتغيّر.':'كل لاعبين جدد هيلعبوا ضد بعض، والقرعة والنتائج القديمة مش هتتغير.';
    return `<section class="late-area">${toggle}${latePanelOpen?`<div class="late-panel" id="late-panel"><h2>إضافة لاعبين للقرعة الحالية</h2><p class="hint">${desc} ${digits(FEE)} جنيه للفرد.</p><div class="late-stats"><span>${digits(n)} / ${digits(LIMIT)} لاعب</span><strong>الإجمالي: ${digits(n*FEE)} جنيه</strong></div><form id="late-player-form" class="entry-form"><input class="text-input" id="late-player-input" maxlength="70" autocomplete="off" placeholder="اسم اللاعب الجديد" aria-label="اسم اللاعب الجديد" ${n>=LIMIT?'disabled':''}><button class="add-btn" aria-label="إضافة اللاعب الجديد" ${n>=LIMIT?'disabled':''}>＋</button></form>${pendingNote}${directNote}${pending&&n===LIMIT?`<button class="outline-mini single-promote" data-action="promote-single">تأهيل آخر لاعب تلقائيًا (Bye)</button>`:''}</div>`:pendingNote}${!latePanelOpen?directNote:''}</section>`;
  }
  function tournamentPage(t){
    const g=gameById(t.gameId),champ=currentChampion(t),groupsStage=g.mode==='groups'&&t.phase==='draw'&&Array.isArray(t.groups);
    return `<main class="shell">${pageHead('03 / القرعة','home')}<div class="details-top"><span class="game-badge">${esc(g.name)}</span><span class="date-pill">${esc(formatDate(t.date))}</span></div><h1 class="section-heading" style="margin-top:17px">${g.mode==='jenga'?'قائمة الإقصاء':groupsStage?'دور المجموعات':'جدول المباريات'}</h1><p class="subtitle">${g.mode==='jenga'?'الترتيب عشوائي. استبعد كل لاعب يخرج من اللعبة.':groupsStage?'مباريات كل جولة مرتّبة، والأول والثاني من كل مجموعة يتأهلان.':'اضغط على اسم اللاعب، وبعدها أكّد تأهله.'}</p>${lateRegistration(t)}${t.gameId==='connect4'&&t.bracket&&!t.groups?'<div class="notice">الدوري ده اتعمل قبل التحديث بنظام خروج المغلوب، وهنحتفظ بنظامه ونتائجه. أي دوري كونكت 4 جديد هيكون مجموعات.</div>':''}${champ?champion(t,champ):''}${needsBracketRepair(t)?`<div class="notice waiting"><strong>قرعة قديمة محتاجة تصحيح:</strong> فيها أكتر من تأهل تلقائي في دور واحد. <button class="confirm-btn" data-action="repair-bracket">تصحيح قرعة ${g.mode==='groups'?'النهائيات':'خروج المغلوب'}</button><span class="tiny">التصحيح يحتفظ بالأسماء ونتائج المجموعات. لو فيه نتائج لخروج المغلوب هيسألك قبل مسحها.</span></div>`:''}${g.mode==='jenga'?renderJenga(t):groupsStage?renderGroups(t):renderBracket(t)}${renderLateMatches(t)}</main>${dock(`<button class="cta" data-action="report">عرض التقرير <span aria-hidden="true">↗</span></button>`)}`;
  }
  function champion(t,id){return `<div class="champion"><div class="trophy" aria-hidden="true">♛</div><div class="title">بطل الدوري</div><div class="name">${esc(playerName(t,id))}</div></div>`}
  function renderJenga(t){const j=t.jenga,alive=j.order.filter(id=>!j.eliminated.includes(id));return `<div class="stats"><div class="stat"><span class="label">داخل اللعبة</span><strong>${digits(alive.length)}</strong></div><div class="stat"><span class="label">تم إقصاؤهم</span><strong>${digits(j.eliminated.length)}</strong></div></div>${alive.length>1?`<input class="text-input" type="search" id="jenga-search" value="${esc(searchText)}" placeholder="ابحث عن اسم لاعب..." aria-label="بحث عن لاعب" style="width:100%;margin:0 0 15px">`:''}<div class="section-bar"><h2>ترتيب اللاعبين</h2><span class="tiny">عشوائي</span></div><div class="jenga-list">${alive.filter(id=>playerName(t,id).toLowerCase().includes(searchText.toLowerCase())).map(id=>`<div class="jenga-row"><span class="player-index">${digits(j.order.indexOf(id)+1)}</span><span class="player-name">${esc(playerName(t,id))}</span>${alive.length>1?`<button class="eliminate-btn" data-action="eliminate" data-id="${id}">إقصاء</button>`:'<span class="tag green">البطل</span>'}</div>`).join('')||'<div class="empty">مفيش لاعب بالاسم ده.</div>'}</div>${j.eliminated.length?`<div class="section-bar"><h2>خرجوا من اللعبة</h2><button class="outline-mini" data-action="undo-eliminate">تراجع عن آخر إقصاء</button></div><div class="names-list">${j.eliminated.slice().reverse().map(id=>`<div class="name-row"><span class="player-name" style="color:var(--soft);text-decoration:line-through">${esc(playerName(t,id))}</span><span class="tag red">خرج</span></div>`).join('')}</div>`:''}`}
  function roundName(i,matchCount){if(matchCount===1)return 'النهائي';if(matchCount===2)return 'نصف النهائي';if(matchCount===4)return 'ربع النهائي';return `الدور ${digits(i+1)}`} 
  function renderBracket(t){if(!t.bracket)return '<div class="empty">لسه مفيش مباريات.</div>';const rounds=t.bracket.rounds;let championId=currentChampion(t);return `<div class="notice">${championId?'<strong>تم تحديد البطل.</strong>':'المواجهة الفائزة بتصعد تلقائيًا للدور اللي بعده.'} تقدر تغيّر نتيجة سابقة، لكن الأدوار اللي بعدها هتتصفر.</div>${rounds.map((round,ri)=>`<div class="round-title"><span>${roundName(ri,round.length)}</span><span class="tag">${digits(round.length)} ${round.length===1?'مباراة':'مباريات'}</span></div>${round.map((m,mi)=>renderMatch(t,m,ri,mi,rounds.length)).join('')}`).join('')}`}
  function renderMatch(t,m,ri,mi,total){if(!m.b)return `<div class="match-card"><div class="match-head"><span>${m.directEntry?'متأهل مباشر للدور التالي':m.lateEntry?'اللاعب المضاف بعد المجموعات':'المواجهة '+digits(mi+1)}</span><span class="tag green">تأهل تلقائي</span></div><div class="bye">${esc(playerName(t,m.a))} — ${m.directEntry?'دخل دور خروج المغلوب مباشرة':'تأهّل بدون مباراة (Bye)'}</div></div>`;
    const s=selected&&selected.ri===ri&&selected.mi===mi?selected.id:null;const playerBtn=id=>`<button class="player-choice ${m.winner===id?'winner':m.winner&&m.winner!==id?'loser':''} ${s===id?'selected':''}" data-action="select-winner" data-ri="${ri}" data-mi="${mi}" data-id="${id}">${esc(playerName(t,id))}</button>`;
    return `<div class="match-card"><div class="match-head"><span>${m.lateEntry?'مواجهة المضافين بعد المجموعات':'المواجهة '+digits(mi+1)}</span>${m.winner?'<span class="tag green">النتيجة مسجلة</span>':'<span class="tag">اختار الفائز</span>'}</div><div class="duel-row">${playerBtn(m.a)}${m.winner===m.a?'<span class="tag green">متأهل</span>':''}</div><div class="duel-row">${playerBtn(m.b)}${m.winner===m.b?'<span class="tag green">متأهل</span>':''}</div>${s?`<button class="confirm-btn" data-action="confirm-winner" data-ri="${ri}" data-mi="${mi}" data-id="${s}">تأكيد تأهل ${esc(playerName(t,s))}</button>`:''}</div>`}
  function renderLateMatch(t,m,i,type,incumbent){
    const a=type==='challenge'?incumbent:m.a,b=type==='challenge'?m.winner:m.b,win=type==='challenge'?m.challengeWinner:m.winner;
    if(!a||!b)return '';
    const selection=selected&&selected.type===type&&selected.index===i?selected.id:null;
    return `<div class="match-card"><div class="match-head"><span>${type==='challenge'?'تحدي البطل':'المواجهة الإضافية '+digits(i+1)}</span>${win?'<span class="tag green">النتيجة مسجلة</span>':'<span class="tag">اختار الفائز</span>'}</div>${[a,b].map(id=>`<div class="duel-row"><button class="player-choice ${win===id?'winner':win&&win!==id?'loser':''} ${selection===id?'selected':''}" data-action="select-late-winner" data-kind="${type}" data-index="${i}" data-id="${id}">${esc(playerName(t,id))}</button>${win===id?'<span class="tag green">متأهل</span>':''}</div>`).join('')}${selection?`<button class="confirm-btn" data-action="confirm-late-winner" data-kind="${type}" data-index="${i}" data-id="${selection}">تأكيد فوز ${esc(playerName(t,selection))}</button>`:''}</div>`;
  }
  function renderLateMatches(t){
    if(isGroupTournament(t)&&t.phase==='draw'){
      const direct=t.directQualifiers||[];
      if(!direct.length)return '';
      return `<section class="extra-bracket"><div class="round-title"><span>متأهلون مباشرة للدور بعد المجموعات</span><span class="tag green">${digits(direct.length)} لاعب</span></div><p class="hint">كل اسم هنا دخل دور خروج المغلوب بالفعل؛ مفيش لاعب مستني إضافة اسم تاني، ومفيش تغيير في المجموعات.</p>${direct.map(id=>`<div class="match-card"><div class="match-head"><span>اللاعب المضاف</span><span class="tag green">متأهل مباشرة</span></div><div class="bye">${esc(playerName(t,id))} — يلعب في الأدوار الإقصائية بعد المجموعات</div></div>`).join('')}</section>`;
    }
    const late=t.lateMatches||[];
    if(!late.length)return '';
    let champ=baseChampion(t);
    const challenges=late.map((m,i)=>{
      if(!champ||!m.winner){champ=null;return '';}
      const html=renderLateMatch(t,m,i,'challenge',champ);
      if(m.challengeWinner && [champ,m.winner].includes(m.challengeWinner))champ=m.challengeWinner;
      else champ=null;
      return html;
    }).join('');
    const grouped=isGroupTournament(t);
    return `<section class="extra-bracket"><div class="round-title"><span>${grouped?'مواجهات إضافية من النسخة القديمة':'مواجهات اللاعبين الجدد'}</span><span class="tag">${digits(late.length)} مواجهة</span></div><p class="hint">${grouped?'المواجهات دي اتحفظت من إصدار سابق. أي اسم جديد من دلوقتي بيتأهل مباشرة للجدول الأساسي.':'من غير إعادة القرعة: كل اسمين جدد ضد بعض، والفائز يواجه المتأهل النهائي من القرعة الأصلية أو الفائز من التحدي السابق.'}</p>${late.map((m,i)=>m.b?renderLateMatch(t,m,i,'match'):`<div class="notice"><strong>${esc(playerName(t,m.a))}</strong> — تأهل تلقائي (Bye)</div>`).join('')}${challenges?`<div class="round-title"><span>${grouped?'المباراة الحاسمة':'تحدي البطل'}</span><span class="tag">استكمال الدوري</span></div>${challenges}`:''}</section>`;
  }
  const groupStats=g=>g.members.map(id=>({id,wins:g.matches.filter(m=>m.winner===id).length,played:g.matches.filter(m=>m.winner&&(m.a===id||m.b===id)).length}));
  const groupCompleted=g=>g.matches.every(m=>m.winner);
  function groupStandings(g){const ranked=groupStats(g).sort((a,b)=>b.wins-a.wins);if(groupCompleted(g)&&ranked.length===3&&ranked.every(x=>x.wins===1))return ranked;return ranked;}
  function getQualifiers(g){
    if(!groupCompleted(g))return null;
    const ranked=groupStandings(g);
    if(ranked.length===2)return ranked.map(x=>x.id); // Only for legacy saved groups.
    if(ranked.length<2)return null;
    // Captain breaks any points tie across the second/third-place cutoff.
    if(ranked[1].wins===ranked[2].wins){
      return g.manualQualifiers?.length===2&&g.manualQualifiers.every(id=>g.members.includes(id))?g.manualQualifiers:null;
    }
    return ranked.slice(0,2).map(x=>x.id);
  }
  function renderGroups(t){
    const groups=t.groups,finished=groups.every(groupCompleted),ready=groups.every(g=>!!getQualifiers(g));
    const totalRounds=Math.max(...groups.map(g=>Math.max(...g.matches.map(m=>m.round))+1));
    return `${hasSmallGroups(t)?`<div class="notice waiting"><strong>دوري من النسخة القديمة:</strong> فيه مجموعة من لاعبين. <button class="confirm-btn" data-action="repair-small-groups">إعادة توزيع المجموعة الصغيرة</button><span class="tiny">هتحتفظ بالمباريات اللي فضل طرفاها في نفس المجموعة، والباقي هيتوضح قبل التأكيد.</span></div>`:''}<div class="notice"><strong>نظام المجموعات:</strong> مجموعات 3 أو 4 لاعبين، وأول اتنين بيتأهلوا. كل لاعب بيلعب مع باقي مجموعته مرة واحدة. عند 5 لاعبين فقط بتكون مجموعة واحدة من 5 بدل مجموعة من 2. لو فيه تعادل على المركز الثاني، الكابتن بيحدد المتأهلين. <strong>أي لاعب يتضاف بعد القرعة بيتأهل مباشرة لخروج المغلوب، من غير انتظار.</strong></div>${groups.map((g,i)=>`<div class="group-panel"><div class="group-name"><span>المجموعة ${String.fromCharCode(65+i)}</span><span class="tag ${getQualifiers(g)?'green':''}">${getQualifiers(g)?'اكتملت':'الجولات '+digits(Math.max(...g.matches.map(m=>m.round))+1)}</span></div><table class="standings"><thead><tr><th>اللاعب</th><th>لعب</th><th>فوز</th><th>نقاط</th></tr></thead><tbody>${groupStandings(g).map(s=>`<tr><td class="${getQualifiers(g)?.includes(s.id)?'qualified':''}">${esc(playerName(t,s.id))}</td><td>${digits(s.played)}</td><td>${digits(s.wins)}</td><td>${digits(s.wins*3)}</td></tr>`).join('')}</tbody></table>${groupCompleted(g)&&!getQualifiers(g)?`<div class="notice">فيه تعادل على المركز الثاني. اختار أول وتاني المجموعة:</div><div class="qualify-options">${g.members.map(id=>`<label class="qualify-check"><input type="checkbox" data-action="qualify-select" data-group="${i}" data-id="${id}" ${groupSelections[i]?.includes(id)?'checked':''}>${esc(playerName(t,id))}</label>`).join('')}</div><button class="confirm-btn" data-action="save-qualifiers" data-group="${i}">تأكيد المتأهلين</button>`:''}</div>`).join('')}<div class="round-title"><span>مواعيد الجولات</span><span class="tag">كل المجموعات</span></div>${Array.from({length:totalRounds},(_,r)=>{const matches=groups.flatMap(g=>g.matches.map((m,mi)=>({...m,matchIndex:mi,group:g})).filter(m=>m.round===r));if(!matches.length)return '';return `<div class="subheading">الجولة ${digits(r+1)}</div>${matches.map(m=>`<div class="match-card"><div class="match-head"><span>المجموعة ${String.fromCharCode(65+m.group.id)}</span>${m.winner?'<span class="tag green">انتهت</span>':'<span class="tag">لم تبدأ</span>'}</div>${[m.a,m.b].map(id=>`<div class="duel-row"><button class="player-choice ${m.winner===id?'winner':''}" data-action="group-winner" data-group="${m.group.id}" data-match="${m.matchIndex}" data-id="${id}">${esc(playerName(t,id))}</button>${m.winner===id?'<span class="tag green">فائز</span>':''}</div>`).join('')}</div>`).join('')}`}).join('')}${finished&&!ready?'<div class="notice">كمّل تحديد المتأهلين من المجموعات المتعادلة علشان تبدأ النهائيات.</div>':''}${ready?`<div class="notice"><strong>المجموعات اكتملت!</strong> ${digits(groups.reduce((sum,g)=>sum+getQualifiers(g).length,0))} لاعبين من المجموعات جاهزين للنهائيات.${(t.directQualifiers||[]).length?' واللاعبون الجدد متأهلون بالفعل لأول دور خروج مغلوب.':''}</div><button class="cta" data-action="start-finals">بدء خروج المغلوب <span aria-hidden="true">↗</span></button>`:''}`;
  }
  function reportPage(t){
    const champ=currentChampion(t),g=gameById(t.gameId), league=leagueTotal(t), day=dailyTotal(t.date);
    return `<main class="shell">${pageHead('04 / التقرير','tournament')}<div class="report-hero"><img src="assets/ava-mina-logo.png" alt="شعار الفريق"><h1>تقرير الدوري</h1><p class="subtitle" style="margin:8px 0 0">${esc(g.name)} · ${esc(formatDate(t.date))}</p></div><div class="report-grid"><div class="report-card"><div class="card-label">تحصيل الدوري ده</div><div class="card-value">${digits(league)} <span style="font-size:19px">جنيه</span></div><div class="report-note">${digits(t.players.length)} لاعب × ${digits(FEE)} جنيه، كل تسجيل يتحسب مرة واحدة، بما فيهم اللاعبين المضافين بعد القرعة.</div></div><div class="report-card"><div class="card-label">إجمالي تحصيل اليوم — كل الدوريات</div><div class="card-value">${digits(day)} <span style="font-size:19px">جنيه</span></div><div class="report-note">الإجمالي في يوم ${esc(formatDate(t.date))} لكل الألعاب المسجلة في نفس الجهاز. مش بيتضاف على تحصيل الدوري؛ هو إجمالي منفصل.</div></div><div class="report-card"><div class="card-label">بطل ${esc(g.name)}</div><div class="card-value small">${champ?esc(playerName(t,champ)):'لم يُحدَّد بعد'}</div></div><div class="report-card"><div class="card-label">التاريخ</div><div class="card-value small">${esc(formatDate(t.date))}</div></div></div><div class="notice">دي قيمة رسوم التسجيل المحسوبة، مش تأكيد إن المبلغ اتدفع نقدًا.</div><div style="margin-top:18px"><button class="cta" data-action="copy-report" style="min-height:58px;font-size:15px">نسخ التقرير</button></div></main>${dock(`<button class="secondary-action" data-action="go-tournament" style="width:100%">العودة للدوري</button>`)}`;
  }
  function historyPage(){const sessions=[...db.sessions].filter(t=>t.players.length).reverse();return `<main class="shell">${pageHead('الدوريات السابقة')}<h1 class="section-heading">دورياتك</h1><p class="subtitle">متسجلة على المتصفح ده فقط.</p>${sessions.length?`<div class="session-list">${sessions.map(t=>{const c=currentChampion(t);return `<button class="session-row" data-action="open-session" data-id="${t.id}"><div><div class="name">${esc(gameById(t.gameId).name)}</div><div class="meta">${esc(formatDate(t.date))} · ${digits(t.players.length)} لاعب · ${c?`البطل: ${esc(playerName(t,c))}`:hasDraw(t)?'الدوري جارٍ':'تسجيل أسماء'}</div></div><span class="arrow">←</span></button>`}).join('')}</div>`:'<div class="empty">لسه مفيش دوريات مسجلة.</div>'}</main>`}
  function render(){let t=active(); if(!t && ['registration','tournament','report'].includes(page))page='home';document.body.dataset.page=page;const html=page==='home'?home():page==='games'?gamesPage():page==='registration'?registrationPage(t):page==='tournament'?tournamentPage(t):page==='report'?reportPage(t):historyPage();$('#app').innerHTML=html;if(shouldFocusInput&&page==='registration'){$('#player-input')?.focus();shouldFocusInput=false}if(shouldFocusLate&&page==='tournament'){$('#late-player-input')?.focus({preventScroll:true});shouldFocusLate=false}}
  function deleteTournament(t){if(!confirm('متأكد إنك عايز تحذف الدوري والأسماء المسجلة؟'))return;db.sessions=db.sessions.filter(s=>s.id!==t.id);db.currentId=db.sessions.at(-1)?.id||null;persist();switchPage('home');notify('اتحذف الدوري')}
  function enterPlayer(t){const e=$('#player-input');if(!e)return;const name=e.value.trim().replace(/\s+/g,' ');if(!name)return notify('اكتب اسم اللاعب');if(t.players.length>=LIMIT)return notify('الحد الأقصى 50 لاعب');if(t.players.some(p=>p.name.toLocaleLowerCase('ar-EG')===name.toLocaleLowerCase('ar-EG')))return notify('الاسم ده متسجل بالفعل');t.players.push({id:newId(),name,registeredOn:localDate()});persist();shouldFocusInput=true;render();notify('اتضاف اللاعب')}
  function insertLatePair(t,a,b){
    const grouped=isGroupTournament(t),m={a,b:b||null,winner:b?null:a,lateEntry:grouped};
    if(grouped && t.phase==='draw'){
      // بعد سحب قرعة المجموعات ممنوع إضافة أي أسماء لها؛ نحجز المواجهة لأوّل دور خروج مغلوب.
      t.lateMatches ||= [];
      t.lateMatches.push({...m,challengeWinner:null});
      return 'اتضافت مواجهة لدور خروج المغلوب بعد المجموعات، من غير مجموعة جديدة';
    }
    if(t.bracket && t.bracket.rounds.length===1 && !(t.lateMatches||[]).length){
      // أول دور خروج مغلوب ما زال قائمًا؛ أضف المواجهة لنفس الدور مع إبقاء نتائجه.
      t.bracket.rounds[0].push(m);
      extendBracket(t);
      return grouped?'اتضافت مواجهة لأول دور بعد المجموعات':'اتضافت مواجهة للقرعة القديمة';
    }
    t.lateMatches ||= [];
    t.lateMatches.push({...m,challengeWinner:null});
    return grouped?'اتضاف اللاعبان لمسار خروج المغلوب، ونتائج الأدوار اللي بدأت هتفضل محفوظة':'اتضافت مواجهة بدون تغيير أي نتيجة قديمة';
  }
  function addDirectToFinals(t,id){
    if(!t.bracket?.rounds?.length)return;
    const all=t.bracket.rounds.flat();
    if(all.some(m=>m.a===id||m.b===id))return;
    t.bracket.rounds.at(-1).push({a:id,b:null,winner:id,lateEntry:true,directEntry:true});
    // May immediately create an additional actual matchup once prior winners exist.
    extendBracket(t);
  }
  function enterLatePlayer(t){
    const field=$('#late-player-input');if(!field)return;
    const name=field.value.trim().replace(/\s+/g,' ');
    if(!name)return notify('اكتب اسم اللاعب');
    if(t.players.length>=LIMIT)return notify('الحد الأقصى 50 لاعب');
    if(t.players.some(p=>p.name.toLocaleLowerCase('ar-EG')===name.toLocaleLowerCase('ar-EG')))return notify('الاسم ده متسجل بالفعل');
    const player={id:newId(),name,registeredOn:localDate()};t.players.push(player);
    let message='اتضاف اللاعب، مستني اللاعب اللي بعده';
    if(t.jenga){t.jenga.order.push(player.id);message='اتضاف اللاعب لقائمة جينجا من غير ما نغيّر الترتيب القديم';}
    else if(isGroupTournament(t)){
      if(t.phase==='draw'){
        t.directQualifiers ||= [];
        t.directQualifiers.push(player.id);
      } else addDirectToFinals(t,player.id);
      message='اتضاف اللاعب وتأهل مباشرة لخروج المغلوب — مش مستني لاعب تاني';
    }
    else if(t.pendingLate){const prev=t.pendingLate;t.pendingLate=null;message=insertLatePair(t,prev,player.id);}
    else t.pendingLate=player.id;
    persist();shouldFocusLate=t.players.length<LIMIT;render();notify(message);
  }
  function promoteSingle(t){
    if(!t.pendingLate||t.players.length!==LIMIT)return;
    const id=t.pendingLate;t.pendingLate=null;
    // اللاعب الأخير يتأهل بـ Bye عند امتلاء الحد دون وصول منافس.
    if(t.jenga)t.jenga.order.push(id);
    else insertLatePair(t,id,null);
    persist();render();notify('اتضاف آخر لاعب بتأهل تلقائي');
  }
  function saveLateWinner(t,index,id,kind){
    const matches=t.lateMatches||[],m=matches[index];
    if(!m)return;
    if(kind==='match'){
      if(![m.a,m.b].includes(id))return;
      if(m.winner===id)return;
      if(m.challengeWinner&&!confirm('تغيير النتيجة هيلغي تحديات البطل التالية. تكمل؟'))return;
      m.winner=id;for(let i=index;i<matches.length;i++)matches[i].challengeWinner=null;
    } else if(kind==='challenge'){
      let champ=baseChampion(t);
      for(let i=0;i<index;i++){
        const prior=matches[i];
        if(!prior?.winner||![champ,prior.winner].includes(prior.challengeWinner))return;
        champ=prior.challengeWinner;
      }
      if(!m.winner||![champ,m.winner].includes(id))return;
      if(m.challengeWinner===id)return;
      if(matches.slice(index+1).some(x=>x.challengeWinner)&&!confirm('ده هيلغي نتائج تحديات البطل اللي بعدها. تكمل؟'))return;
      m.challengeWinner=id;for(let i=index+1;i<matches.length;i++)matches[i].challengeWinner=null;
    }
    selected=null;persist();render();notify('تم تسجيل الفائز');
  }
  function saveWinner(t,ri,mi,id){const bracket=t.bracket,m=bracket?.rounds?.[ri]?.[mi];if(!m||![m.a,m.b].includes(id))return;const hasMore=bracket.rounds.length>ri+1;if(m.winner===id){selected=null;return render()}if(hasMore&&!confirm('تغيير النتيجة هيحذف نتائج الأدوار اللي بعدها. تكمل؟'))return;m.winner=id;bracket.rounds=bracket.rounds.slice(0,ri+1);(t.lateMatches||[]).forEach(m=>m.challengeWinner=null);extendBracket(t);selected=null;persist();render();notify('تم تسجيل المتأهل')}
  function saveGroupWinner(t,gid,matchIndex,id){const g=t.groups[gid],m=g?.matches[matchIndex];if(!m||![m.a,m.b].includes(id))return;if(m.winner===id)return; if(g.manualQualifiers)g.manualQualifiers=null;m.winner=id;groupSelections[gid]=[];persist();render();notify('تم تسجيل الفائز')}
  function startFinals(t){
    if(!t.groups?.every(g=>getQualifiers(g)))return notify('كمّل كل المجموعات الأول');
    t.bracket=makeGroupFinals(t.groups);
    // All late registrations are automatically qualified; none needs a new rival.
    for(const id of new Set(t.directQualifiers||[])){
      t.bracket.rounds[0].push({a:id,b:null,winner:id,lateEntry:true,directEntry:true});
    }
    t.directQualifiers=[];
    // Compatibility with any pre-V5 grouped records that were never migrated.
    for(const m of (t.lateMatches||[])){
      if(m.winner){t.bracket.rounds[0].push({a:m.winner,b:null,winner:m.winner,lateEntry:true,directEntry:true});}
      else for(const id of [m.a,m.b].filter(Boolean)) t.bracket.rounds[0].push({a:id,b:null,winner:id,lateEntry:true,directEntry:true});
    }
    t.lateMatches=[];
    if(t.pendingLate){t.bracket.rounds[0].push({a:t.pendingLate,b:null,winner:t.pendingLate,lateEntry:true,directEntry:true});t.pendingLate=null;}
    t.phase='final';
    extendBracket(t);
    persist();switchPage('tournament');notify('بدأ خروج المغلوب: المتأهلون من المجموعات ومعاهم الإضافات المباشرة');
  }
  function reportText(t){const champion=currentChampion(t);return ['AVA MINA SPORT — تقرير الدوري',`اللعبة: ${gameById(t.gameId).name}`,`التاريخ: ${formatDate(t.date)}`,`تحصيل الدوري: ${leagueTotal(t)} جنيه (${t.players.length} لاعب × ${FEE})`,`تحصيل اليوم لكل الدوريات: ${dailyTotal(t.date)} جنيه`,`البطل: ${champion?playerName(t,champion):'لم يُحدَّد بعد'}`].join('\n')}
  async function copyReport(t){const output=reportText(t);try{await navigator.clipboard.writeText(output);notify('اتنسخ التقرير')}catch(_){const field=document.createElement('textarea');field.value=output;document.body.append(field);field.select();try{document.execCommand('copy');notify('اتنسخ التقرير')}catch(e){notify('نسخ التقرير مش متاح في المتصفح ده')}field.remove();}}
  document.addEventListener('submit',ev=>{if(!['player-form','late-player-form'].includes(ev.target.id))return;ev.preventDefault();const t=active();if(!t)return;if(ev.target.id==='player-form'&&t.phase==='registration')enterPlayer(t);if(ev.target.id==='late-player-form'&&hasDraw(t))enterLatePlayer(t)});
  document.addEventListener('input',ev=>{if(ev.target.id==='jenga-search'){searchText=ev.target.value;const t=active();const filtered=t.jenga.order.filter(id=>!t.jenga.eliminated.includes(id)&&playerName(t,id).toLowerCase().includes(searchText.toLowerCase()));const list=$('.jenga-list');if(list)list.innerHTML=filtered.map(id=>`<div class="jenga-row"><span class="player-index">${digits(t.jenga.order.indexOf(id)+1)}</span><span class="player-name">${esc(playerName(t,id))}</span><button class="eliminate-btn" data-action="eliminate" data-id="${id}">إقصاء</button></div>`).join('')||'<div class="empty">مفيش لاعب بالاسم ده.</div>'}});
  document.addEventListener('change',ev=>{const el=ev.target;if(el.dataset.action!=='qualify-select')return;const group=+el.dataset.group,id=el.dataset.id;groupSelections[group] ||= [];groupSelections[group]=el.checked? [...new Set([...groupSelections[group],id])]:groupSelections[group].filter(x=>x!==id);if(groupSelections[group].length>2){el.checked=false;groupSelections[group]=groupSelections[group].filter(x=>x!==id);notify('اختار لاعبين بس')}});
  document.addEventListener('click',ev=>{
    const btn=ev.target.closest('button[data-action]');if(!btn)return;const act=btn.dataset.action,t=active();
    if(act==='new')return startNew();
    if(act==='history')return switchPage('history');
    if(act==='back')return switchPage(btn.dataset.to||'home');
    if(act==='resume'||act==='open-session'){db.currentId=btn.dataset.id;persist();const x=active();return switchPage(x?.phase==='registration'?'registration':'tournament')}
    if(act==='choose-game')return createGame(btn.dataset.game);
    if(!t)return;
    if(act==='remove-player'){t.players=t.players.filter(p=>p.id!==btn.dataset.id);persist();return render()}
    if(act==='draw')return makeDraw(t);
    if(act==='toggle-late'){latePanelOpen=!latePanelOpen;return render()}
    if(act==='promote-single')return promoteSingle(t);
    if(act==='delete-tournament')return deleteTournament(t);
    if(act==='go-tournament')return switchPage('tournament');
    if(act==='report')return switchPage('report');
    if(act==='copy-report')return copyReport(t);
    if(act==='eliminate'){const alive=t.jenga.order.filter(id=>!t.jenga.eliminated.includes(id));if(alive.length<=1)return;if(!alive.includes(btn.dataset.id))return;t.jenga.eliminated.push(btn.dataset.id);searchText='';persist();render();return notify(`${playerName(t,btn.dataset.id)} خرج من اللعبة`)}
    if(act==='undo-eliminate'){t.jenga.eliminated.pop();persist();render();return notify('اتلغى آخر إقصاء')}
    if(act==='select-winner'){selected={ri:+btn.dataset.ri,mi:+btn.dataset.mi,id:btn.dataset.id};return render()}
    if(act==='confirm-winner')return saveWinner(t,+btn.dataset.ri,+btn.dataset.mi,btn.dataset.id);
    if(act==='select-late-winner'){selected={type:btn.dataset.kind,index:+btn.dataset.index,id:btn.dataset.id};return render()}
    if(act==='confirm-late-winner')return saveLateWinner(t,+btn.dataset.index,btn.dataset.id,btn.dataset.kind);
    if(act==='group-winner')return saveGroupWinner(t,+btn.dataset.group,+btn.dataset.match,btn.dataset.id);
    if(act==='save-qualifiers'){const gi=+btn.dataset.group,arr=groupSelections[gi]||[];if(arr.length!==2)return notify('لازم تختار لاعبين بالضبط');t.groups[gi].manualQualifiers=[...arr];persist();return render()}
    if(act==='start-finals')return startFinals(t);
    if(act==='repair-small-groups')return redistributeSmallGroups(t);
    if(act==='repair-bracket')return repairBracket(t);
  });
  function migrateGroupEntries(){
    let changed=false;
    for(const t of db.sessions){
      if(!isGroupTournament(t))continue;
      if(hasSmallGroups(t)&&t.groups.every(g=>g.matches.every(m=>!m.winner))){
        redistributeSmallGroups(t,false);changed=true;
      }
      if(t.phase==='draw'){
        const direct=new Set(t.directQualifiers||[]);
        if(t.pendingLate){direct.add(t.pendingLate);t.pendingLate=null;changed=true;}
        if((t.lateMatches||[]).length){
          for(const m of t.lateMatches){
            if(m.winner)direct.add(m.winner);
            else {if(m.a)direct.add(m.a);if(m.b)direct.add(m.b);}
          }
          t.lateMatches=[];changed=true;
        }
        t.directQualifiers=[...direct];
      } else if(t.phase==='final'&&t.pendingLate){
        addDirectToFinals(t,t.pendingLate);
        t.pendingLate=null;changed=true;
      }
    }
    if(changed)persist();
  }
  migrateGroupEntries();
  render();
  // A small testing hook; not used by the site interface.
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') window.__AVA_DEBUG={getDB:()=>db,getActive:active,groupSizes,groupRoundRobin,makeGroups,redistributeSmallGroups,makeBracket,makeGroupFinals,pairRound,needsBracketRepair,extendBracket,addDirectToFinals,dailyTotal,leagueTotal};
})();
