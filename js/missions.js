/* ---------------- Toast ---------------- */
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('show'); void el.offsetWidth;
  el.classList.add('show');
}

/* ---------------- Daily streak ---------------- */
const Daily = (() => {
  const iso = d => d.toISOString().slice(0,10);
  function today(){ return iso(new Date()); }
  function touch(){                       // call when a run finishes
    const d = today();
    if(P.day.last === d) return false;
    const y = new Date(); y.setDate(y.getDate()-1);
    P.day.streak = (P.day.last === iso(y)) ? P.day.streak + 1 : 1;
    P.day.last = d; persist();
    return true;
  }
  function mult(){ const s = streak(); return s > 0 ? 1 + Math.min(s-1, 5) * .1 : 1; }
  function streak(){ return P.day.last === today() ? P.day.streak
    : (() => { const y = new Date(); y.setDate(y.getDate()-1);
               return P.day.last === iso(y) ? P.day.streak : 0; })(); }
  return { touch, mult, streak };
})();

/* ---------------- Missions du jour ---------------- */
const Missions = (() => {
  const POOL = [
    {id:'land12',  txt:'Réussis 12 sauts',            n:12, reward:30, ev:'land'},
    {id:'back4',   txt:'Fais 4 backflips 720',        n:4,  reward:40, ev:'backflip'},
    {id:'combo5',  txt:'Atteins un combo de 5',       n:5,  reward:40, ev:'combo', mode:'max'},
    {id:'perfect', txt:'Fais une descente parfaite',  n:1,  reward:60, ev:'perfect'},
    {id:'runs3',   txt:'Termine 3 descentes',         n:3,  reward:25, ev:'run'},
    {id:'gold2',   txt:'Réussis 2 verbes dorés',      n:2,  reward:35, ev:'golden'},
  ];
  function today(){ return new Date().toISOString().slice(0,10); }
  function active(){
    const d = today();
    if(P.missions.date !== d){ P.missions = { date:d, prog:{}, done:{} }; persist(); }
    let seed = 0; for(const ch of d) seed = (seed*31 + ch.charCodeAt(0)) >>> 0;
    const idx = [];
    while(idx.length < 3){
      seed = (seed * 1103515245 + 12345) >>> 0;
      const k = seed % POOL.length;
      if(!idx.includes(k)) idx.push(k);
    }
    return idx.map(i => POOL[i]);
  }
  function event(ev, amt){
    amt = amt || 1;
    const done = [];
    active().forEach(m => {
      if(m.ev !== ev || P.missions.done[m.id]) return;
      const prev = P.missions.prog[m.id] || 0;
      P.missions.prog[m.id] = m.mode === 'max' ? Math.max(prev, amt) : prev + amt;
      if(P.missions.prog[m.id] >= m.n){
        P.missions.done[m.id] = true;
        P.coins += m.reward;
        done.push(m);
      }
    });
    persist();
    done.forEach((m,i) => setTimeout(() => { toast(`🎯 Mission réussie : +${m.reward} 🪙`); Sfx.fanfare(); }, i*1200));
  }
  function render(){
    const box = document.getElementById('missionList');
    box.innerHTML = active().map(m => {
      const p = Math.min(P.missions.prog[m.id] || 0, m.n);
      const done = !!P.missions.done[m.id];
      return `<div class="mission${done?' done':''}">
        <div class="m-row"><span>${done?'✅ ':''}${m.txt}</span><span class="rw">+${m.reward} 🪙</span></div>
        <div class="m-bar"><div class="m-fill" style="width:${p/m.n*100}%"></div></div>
      </div>`;
    }).join('');
  }
  return { event, render };
})();

/* ---------------- count-up number animation ---------------- */
function countUp(el, target, suffix, ms){
  suffix = suffix || ''; ms = ms || 900;
  const t0 = performance.now();
  (function step(){
    const p = Math.min(1, (performance.now()-t0)/ms);
    const ease = 1 - Math.pow(1-p, 3);
    el.textContent = Math.round(target*ease) + suffix;
    if(p < 1) requestAnimationFrame(step);
  })();
}
