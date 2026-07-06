/* ---------------- Storage (works when deployed; silently falls back
   to in-memory when localStorage is unavailable, e.g. sandboxed) --- */
const Store = (() => {
  let mem = {};
  const KEY = 'poudreuse_save_v1';
  function load(){
    try{ const raw = localStorage.getItem(KEY); if(raw) mem = JSON.parse(raw); }catch(e){}
    return mem;
  }
  function save(data){
    mem = data;
    try{ localStorage.setItem(KEY, JSON.stringify(data)); }catch(e){}
  }
  return { load, save };
})();

/* ---------------- Player state ---------------- */
const P = Object.assign({
  xp: 0, coins: 0,
  ownedBoards: ['flamant'], activeBoard: 'flamant',
  weights: {},           // "verb|tense|person" -> miss weight
  best: {},              // mountainId -> best score
  day: { last: '', streak: 0 },
  missions: { date: '', prog: {}, done: {} },
  settings: { strict:false, hint:true, sound:true },
}, Store.load());
function persist(){ Store.save(P); }

/* ---------------- Verb engine ---------------- */
const PRESENT_ER = ['e','es','e','ons','ez','ent'];
const PRESENT_IR = ['is','is','it','issons','issez','issent'];
const PRESENT_RE = ['s','s','','ons','ez','ent'];
const FUTUR_END  = ['ai','as','a','ons','ez','ont'];
const IMP_END    = ['ais','ais','ait','ions','iez','aient'];

const VERBS = {
  // regular -er
  parler:{g:'er',eng:'to speak'}, jouer:{g:'er',eng:'to play'}, aimer:{g:'er',eng:'to like / love'},
  regarder:{g:'er',eng:'to watch'}, écouter:{g:'er',eng:'to listen'}, manger:{g:'er',eng:'to eat'},
  skier:{g:'er',eng:'to ski'}, danser:{g:'er',eng:'to dance'}, chanter:{g:'er',eng:'to sing'},
  tomber:{g:'er',eng:'to fall'}, glisser:{g:'er',eng:'to slide'}, sauter:{g:'er',eng:'to jump'},
  // regular -ir
  finir:{g:'ir',eng:'to finish'}, choisir:{g:'ir',eng:'to choose'},
  grandir:{g:'ir',eng:'to grow up'}, réussir:{g:'ir',eng:'to succeed'},
  // regular -re
  vendre:{g:'re',eng:'to sell'}, attendre:{g:'re',eng:'to wait'},
  perdre:{g:'re',eng:'to lose'}, entendre:{g:'re',eng:'to hear'},
  // irregulars
  'être':{g:'irr',eng:'to be',
    présent:['suis','es','est','sommes','êtes','sont'], futurStem:'ser', impStem:'ét'},
  avoir:{g:'irr',eng:'to have',
    présent:['ai','as','a','avons','avez','ont'], futurStem:'aur', impStem:'av'},
  aller:{g:'irr',eng:'to go',
    présent:['vais','vas','va','allons','allez','vont'], futurStem:'ir', impStem:'all'},
  faire:{g:'irr',eng:'to do / make',
    présent:['fais','fais','fait','faisons','faites','font'], futurStem:'fer', impStem:'fais'},
};

function conjugate(inf, tense, i){
  const v = VERBS[inf];
  if(tense === 'présent'){
    if(v.g === 'irr') return v['présent'][i];
    const stem = inf.slice(0,-2);
    if(v.g === 'er'){
      // -ger spelling change: nous mangeons
      if(i === 3 && stem.endsWith('g')) return stem + 'eons';
      return stem + PRESENT_ER[i];
    }
    if(v.g === 'ir') return stem + PRESENT_IR[i];
    return stem + PRESENT_RE[i];
  }
  if(tense === 'futur'){
    const stem = v.g === 'irr' ? v.futurStem
               : v.g === 're'  ? inf.slice(0,-1)   // vendre -> vendr
               : inf;                              // parler -> parler, finir -> finir
    return stem + FUTUR_END[i];
  }
  if(tense === 'imparfait'){
    let stem;
    if(v.g === 'irr') stem = v.impStem;
    else if(v.g === 'er'){
      stem = inf.slice(0,-2);
      // -ger: mange+ais / mange+aient, but mang+ions / mang+iez
      if(stem.endsWith('g') && (i < 3 || i === 5)) stem += 'e';
    }
    else if(v.g === 'ir') stem = inf.slice(0,-2) + 'iss';
    else stem = inf.slice(0,-2);
    return stem + IMP_END[i];
  }
}

const PRONOUNS = [
  ['je'], ['tu'], ['il','elle','on'], ['nous'], ['vous'], ['ils','elles']
];
function pickPronoun(i){ const opts = PRONOUNS[i]; return opts[Math.floor(Math.random()*opts.length)]; }
function displayPronoun(pr, form){
  if(pr === 'je' && /^[aeiouéèêh]/i.test(form)) return "j'";
  return pr;
}

/* ---------------- Mountains (levels) ---------------- */
const TIER = {
  er: ['parler','jouer','aimer','regarder','écouter','manger','skier','danser','chanter','tomber','glisser','sauter'],
  irre: ['finir','choisir','grandir','réussir','vendre','attendre','perdre','entendre'],
  irr: ['être','avoir','aller','faire'],
};
TIER.all = TIER.er.concat(TIER.irre, TIER.irr);

const MOUNTAINS = [
  {id:0, icon:'🟢', color:'#4EC9A0', name:'Piste Lapin',   desc:'Verbes en -er · présent',            verbs:TIER.er,  tenses:['présent'], clock:11, xpReq:0},
  {id:1, icon:'🔵', color:'#4D8DE8', name:'Piste Bleue',   desc:'Verbes en -ir et -re · présent',      verbs:TIER.irre, tenses:['présent'], clock:10, xpReq:80},
  {id:2, icon:'🔴', color:'#E8564D', name:'Piste Rouge',   desc:'être · avoir · aller · faire',        verbs:TIER.irr, tenses:['présent'], clock:9,  xpReq:200},
  {id:3, icon:'⚫', color:'#2B3050', name:'Piste Noire',   desc:'Tous les verbes · présent · rapide !', verbs:TIER.all, tenses:['présent'], clock:6,  xpReq:380},
  {id:4, icon:'🌲', color:'#1F4A3D', name:'Hors-Piste',    desc:'Tous les verbes · FUTUR',             verbs:TIER.all, tenses:['futur'],   clock:9,  xpReq:600},
  {id:5, icon:'🏅', color:'#E8A02E', name:'JO 2030',       desc:'Tout mélangé · présent + futur + imparfait', verbs:TIER.all, tenses:['présent','futur','imparfait'], clock:6, xpReq:900},
];

/* ---------------- Boards (shop) ---------------- */
const BOARDS = {
  flamant:{name:'Flamant', price:0,   c1:'#FF5D8F', c2:'#FFB3CC'},
  glacier:{name:'Glacier', price:50,  c1:'#6FD8F2', c2:'#CFF4FD'},
  menthe: {name:'Menthe',  price:75,  c1:'#7FE3C3', c2:'#D2F8EA'},
  nuit:   {name:'Nuit Étoilée', price:120, c1:'#2B3050', c2:'#7B84C4', stars:true},
  or:     {name:'Or Olympique', price:200, c1:'#FFC63D', c2:'#FFE7A8'},
};
