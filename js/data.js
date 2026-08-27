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
  riderName: 'Leila',    // display name used for anonymous leaderboard entries
  ownedBoards: ['flamant'], activeBoard: 'flamant',
  ownedOutfits: ['givre'], activeOutfit: 'givre',
  boosts: {},            // boostId -> count owned
  weights: {},           // "verb|tense|person" -> miss weight
  best: {},              // mountainId -> best score
  day: { last: '', streak: 0 },
  missions: { date: '', prog: {}, done: {} },
  settings: { strict:false, hint:true, sound:true },
}, Store.load());
P.ownedOutfits = P.ownedOutfits || ['givre'];
P.activeOutfit = P.activeOutfit || 'givre';
P.boosts = P.boosts || {};
function persist(){
  P.savedAt = Date.now();
  Store.save(P);
  // sync to the cloud when signed in (cloud.js loads later; guarded)
  if(window.Cloud && window.Cloud.isSignedIn && window.Cloud.isSignedIn()) window.Cloud.queueSave(P);
}

/* Merge a cloud save snapshot into P without losing local progress:
   max() on numeric progress, union on owned boards, newer-wins on config. */
function mergeCloudSave(cloud){
  if(!cloud || !cloud.data) return false;
  const c = cloud.data;
  const cloudNewer = (cloud.updated_at ? Date.parse(cloud.updated_at) : 0) > (P.savedAt || 0);
  P.xp    = Math.max(P.xp    || 0, c.xp    || 0);
  P.coins = Math.max(P.coins || 0, c.coins || 0);
  P.best = P.best || {};
  Object.entries(c.best || {}).forEach(([k, v]) => { P.best[k] = Math.max(P.best[k] || 0, v || 0); });
  P.weights = P.weights || {};
  Object.entries(c.weights || {}).forEach(([k, v]) => { P.weights[k] = Math.max(P.weights[k] || 0, v || 0); });
  P.ownedBoards = Array.from(new Set([...(P.ownedBoards || []), ...(c.ownedBoards || [])]));
  P.ownedOutfits = Array.from(new Set([...(P.ownedOutfits || []), ...(c.ownedOutfits || [])]));
  P.boosts = P.boosts || {};
  Object.entries(c.boosts || {}).forEach(([k, v]) => { P.boosts[k] = Math.max(P.boosts[k] || 0, v || 0); });
  if(cloudNewer){
    if(c.activeBoard) P.activeBoard = c.activeBoard;
    if(c.activeOutfit) P.activeOutfit = c.activeOutfit;
    if(c.settings) P.settings = Object.assign({}, P.settings, c.settings);
    if(c.riderName) P.riderName = c.riderName;
    if(c.day) P.day = c.day;
    if(c.missions) P.missions = c.missions;
  }
  return true;
}

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
  tomber:{g:'er',eng:'to fall',aux:'être'}, glisser:{g:'er',eng:'to slide'}, sauter:{g:'er',eng:'to jump'},
  // regular -ir
  finir:{g:'ir',eng:'to finish'}, choisir:{g:'ir',eng:'to choose'},
  grandir:{g:'ir',eng:'to grow up'}, réussir:{g:'ir',eng:'to succeed'},
  // regular -re
  vendre:{g:'re',eng:'to sell'}, attendre:{g:'re',eng:'to wait'},
  perdre:{g:'re',eng:'to lose'}, entendre:{g:'re',eng:'to hear'},
  // irregulars
  'être':{g:'irr',eng:'to be',
    présent:['suis','es','est','sommes','êtes','sont'], futurStem:'ser', impStem:'ét', pp:'été'},
  avoir:{g:'irr',eng:'to have',
    présent:['ai','as','a','avons','avez','ont'], futurStem:'aur', impStem:'av', pp:'eu'},
  aller:{g:'irr',eng:'to go',
    présent:['vais','vas','va','allons','allez','vont'], futurStem:'ir', impStem:'all', pp:'allé', aux:'être'},
  faire:{g:'irr',eng:'to do / make',
    présent:['fais','fais','fait','faisons','faites','font'], futurStem:'fer', impStem:'fais', pp:'fait'},
  // the big irregulars (Piste Violette)
  venir:{g:'irr',eng:'to come',
    présent:['viens','viens','vient','venons','venez','viennent'], futurStem:'viendr', impStem:'ven', pp:'venu', aux:'être'},
  partir:{g:'irr',eng:'to leave',
    présent:['pars','pars','part','partons','partez','partent'], futurStem:'partir', impStem:'part', pp:'parti', aux:'être'},
  sortir:{g:'irr',eng:'to go out',
    présent:['sors','sors','sort','sortons','sortez','sortent'], futurStem:'sortir', impStem:'sort', pp:'sorti', aux:'être'},
  prendre:{g:'irr',eng:'to take',
    présent:['prends','prends','prend','prenons','prenez','prennent'], futurStem:'prendr', impStem:'pren', pp:'pris'},
  voir:{g:'irr',eng:'to see',
    présent:['vois','vois','voit','voyons','voyez','voient'], futurStem:'verr', impStem:'voy', pp:'vu'},
  savoir:{g:'irr',eng:'to know',
    présent:['sais','sais','sait','savons','savez','savent'], futurStem:'saur', impStem:'sav', pp:'su'},
  pouvoir:{g:'irr',eng:'to be able to',
    présent:['peux','peux','peut','pouvons','pouvez','peuvent'], futurStem:'pourr', impStem:'pouv', pp:'pu'},
  vouloir:{g:'irr',eng:'to want',
    présent:['veux','veux','veut','voulons','voulez','veulent'], futurStem:'voudr', impStem:'voul', pp:'voulu'},
  devoir:{g:'irr',eng:'to have to',
    présent:['dois','dois','doit','devons','devez','doivent'], futurStem:'devr', impStem:'dev', pp:'dû'},
  dire:{g:'irr',eng:'to say',
    présent:['dis','dis','dit','disons','dites','disent'], futurStem:'dir', impStem:'dis', pp:'dit'},
  lire:{g:'irr',eng:'to read',
    présent:['lis','lis','lit','lisons','lisez','lisent'], futurStem:'lir', impStem:'lis', pp:'lu'},
  'écrire':{g:'irr',eng:'to write',
    présent:['écris','écris','écrit','écrivons','écrivez','écrivent'], futurStem:'écrir', impStem:'écriv', pp:'écrit'},
  mettre:{g:'irr',eng:'to put',
    présent:['mets','mets','met','mettons','mettez','mettent'], futurStem:'mettr', impStem:'mett', pp:'mis'},
  boire:{g:'irr',eng:'to drink',
    présent:['bois','bois','boit','buvons','buvez','boivent'], futurStem:'boir', impStem:'buv', pp:'bu'},
  dormir:{g:'irr',eng:'to sleep',
    présent:['dors','dors','dort','dormons','dormez','dorment'], futurStem:'dormir', impStem:'dorm', pp:'dormi'},
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

/* ---- passé composé (needs the pronoun for être-verb agreement) ---- */
function participle(inf){
  const v = VERBS[inf];
  if(v.pp) return v.pp;
  if(v.g === 'er') return inf.slice(0,-2) + 'é';
  if(v.g === 'ir') return inf.slice(0,-2) + 'i';
  return inf.slice(0,-2) + 'u';
}
/* acceptable agreement endings per pronoun (lenient where gender is unknown) */
const PC_AGREE = { je:['','e'], tu:['','e'], il:[''], elle:['e'], on:['','e','s','es'],
                   nous:['s','es'], vous:['','e','s','es'], ils:['s'], elles:['es'] };
function passeCompose(inf, i, pr){
  const v = VERBS[inf], pp = participle(inf);
  if(v.aux !== 'être'){
    const f = ['ai','as','a','avons','avez','ont'][i] + ' ' + pp;
    return { form: f, accept: [f] };
  }
  const aux = ['suis','es','est','sommes','êtes','sont'][i];
  const ends = PC_AGREE[pr] || [''];
  const accept = ends.map(e => aux + ' ' + pp + e);
  const disp = ends.length === 1 ? accept[0]
    : aux + ' ' + pp + (pr === 'nous' ? '(e)s' : pr === 'vous' ? '(e)(s)' : '(e)');
  return { form: disp, accept };
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
  irr2: ['venir','partir','sortir','prendre','voir','savoir','pouvoir','vouloir','devoir','dire','lire','écrire','mettre','boire','dormir'],
};
TIER.all = TIER.er.concat(TIER.irre, TIER.irr, TIER.irr2);

/* Array order = display + unlock order (xpReq ascending); ids are stable
   because they key the leaderboard + P.best — look up with MTN(id). */
const MOUNTAINS = [
  {id:0, icon:'🟢', color:'#4EC9A0', name:'Piste Lapin',   desc:'Verbes en -er · présent',            verbs:TIER.er,  tenses:['présent'], clock:11, xpReq:0,
    theme:{sky:['#6FB9F0','#A8D8F8','#FFF3D9'], peaks:['#B9D4F2','#8FB4E4'], sun:true}},
  {id:1, icon:'🔵', color:'#4D8DE8', name:'Piste Bleue',   desc:'Verbes en -ir et -re · présent',      verbs:TIER.irre, tenses:['présent'], clock:10, xpReq:80,
    theme:{sky:['#3E6FC4','#7FA8E8','#FFD9C4'], peaks:['#9FB6E8','#7690D4'], sun:true}},
  {id:2, icon:'🔴', color:'#E8564D', name:'Piste Rouge',   desc:'être · avoir · aller · faire',        verbs:TIER.irr, tenses:['présent'], clock:9,  xpReq:200,
    theme:{sky:['#4A2A6E','#C4506E','#FFB36B'], peaks:['#B87BA0','#8E5584']}},
  {id:6, icon:'🟣', color:'#8B5CF6', name:'Piste Violette', desc:'Les grands irréguliers · présent',   verbs:TIER.irr2, tenses:['présent'], clock:9, xpReq:300,
    theme:{sky:['#2A1E5C','#7B5CC4','#F2A8E0'], peaks:['#9C8AD8','#7A66BC'], stars:true}},
  {id:3, icon:'⚫', color:'#2B3050', name:'Piste Noire',   desc:'Tous les verbes · présent · rapide !', verbs:TIER.all, tenses:['présent'], clock:6,  xpReq:380,
    theme:{sky:['#0E1230','#28316E','#5C6BB4'], peaks:['#4A578F','#333E73'], stars:true}},
  {id:7, icon:'🌸', color:'#D08AB8', name:'Vallée Rétro',  desc:'Tous les verbes · IMPARFAIT',         verbs:TIER.all, tenses:['imparfait'], clock:9, xpReq:500,
    theme:{sky:['#3E3A70','#C48AB8','#FFE0C4'], peaks:['#C4A0C8','#9A7BAC']}},
  {id:4, icon:'🌲', color:'#1F4A3D', name:'Hors-Piste',    desc:'Tous les verbes · FUTUR',             verbs:TIER.all, tenses:['futur'],   clock:9,  xpReq:600,
    theme:{sky:['#0F3A38','#2E7D6E','#B8E8D0'], peaks:['#5FA890','#3E7D68'], stars:true, aurora:true}},
  {id:8, icon:'🧊', color:'#4D8DC4', name:'Couloir Glacé', desc:'Tous les verbes · PASSÉ COMPOSÉ',     verbs:TIER.all, tenses:['passé composé'], clock:13, xpReq:750,
    theme:{sky:['#1E3A5C','#4D8DC4','#CFF0FA'], peaks:['#8FC4E4','#639FD0']}},
  {id:5, icon:'🏅', color:'#E8A02E', name:'JO 2030',       desc:'Tout mélangé · les 4 temps !', verbs:TIER.all, tenses:['présent','futur','imparfait','passé composé'], clock:6, xpReq:900,
    theme:{sky:['#070B24','#1E2A5C','#4A3A7E'], peaks:['#3E4A8F','#2A3266'], stars:true, aurora:true}},
];
function MTN(id){ return MOUNTAINS.find(m => m.id === id); }

/* ---------------- Boards (shop) ---------------- */
const BOARDS = {
  flamant:{name:'Flamant', price:0,   c1:'#FF5D8F', c2:'#FFB3CC'},
  glacier:{name:'Glacier', price:50,  c1:'#6FD8F2', c2:'#CFF4FD'},
  menthe: {name:'Menthe',  price:75,  c1:'#7FE3C3', c2:'#D2F8EA'},
  nuit:   {name:'Nuit Étoilée', price:120, c1:'#2B3050', c2:'#7B84C4', stars:true},
  or:     {name:'Or Olympique', price:200, c1:'#FFC63D', c2:'#FFE7A8'},
};

/* ---------------- Outfits (shop) — jacket + beanie colors ---------------- */
const OUTFITS = {
  givre:  {name:'Givre',  price:0,   jacket:'#6FD8F2', beanie:'#FF5D8F'},
  fraise: {name:'Fraise', price:60,  jacket:'#FF5D8F', beanie:'#FFC63D'},
  foret:  {name:'Forêt',  price:80,  jacket:'#2E9E77', beanie:'#F4F8FF'},
  soleil: {name:'Soleil', price:100, jacket:'#FFC63D', beanie:'#E8564D'},
  cosmos: {name:'Cosmos', price:130, jacket:'#2B3050', beanie:'#8B5CF6'},
};

/* ---------------- Boosts (shop consumables, pick one before a run) ---------------- */
const BOOSTS = {
  chrono:  {name:'Chrono+',  icon:'⏱️', price:40, desc:'+3 s par question pendant une descente'},
  bouclier:{name:'Bouclier', icon:'🛡️', price:50, desc:'Une erreur ne casse pas ton combo'},
  aimant:  {name:'Aimant',   icon:'🧲', price:60, desc:'Pièces ×2 pendant une descente'},
};
