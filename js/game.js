/* =====================================================================
   GAME LOOP
===================================================================== */
const Game = (() => {
  const TIERS = [                                    // combo escalation
    { at:3, mult:2, name:'EN FEU ×2 !',      cls:'t1', speed:6.5 },
    { at:5, mult:3, name:'SUPERNOVA ×3 !!',  cls:'t2', speed:8.5 },
    { at:8, mult:4, name:'LÉGENDAIRE ×4 !!!', cls:'t3', speed:10.5 },
  ];
  const TRICKS = [                                   // one name picked per landing, by speed tier
    ['OLLIE !','NOSE GRAB !','TAIL SLIDE !'],
    ['MÉTHOD 360 !','INDY 360 !','ROCKET AIR !'],
    ['BACKFLIP 720 !','RODÉO 900 !','MISTY FLIP !'],
  ];
  let mtn = null, jumps = 10, jumpN = 0, score = 0, streak = 0, correct = 0;
  let current = null, deadline = 0, timerId = null, clockMs = 0;
  let bestTrick = null, misses = [], answered = false;
  let runCoins = 0, backflips = 0, goldensHit = 0, lastTier = 0;
  let chest = null, boost = null;

  const $ = id => document.getElementById(id);

  function tierFor(s){
    let t = 0;
    TIERS.forEach((T,i) => { if(s >= T.at) t = i+1; });
    return t;
  }
  function multFor(s){ const t = tierFor(s); return t ? TIERS[t-1].mult : 1; }

  function weightKey(v, tense, i){ return `${v}|${tense}|${i}`; }

  function pickQuestion(){
    const pool = [];
    // practice drills what you miss: base weight shrinks, miss weight dominates
    const base = mtn.practice ? .25 : 1, boostW = mtn.practice ? 4 : 2;
    mtn.verbs.forEach(v => {
      mtn.tenses.forEach(tense => {
        for(let i=0;i<6;i++){
          const w = base + (P.weights[weightKey(v,tense,i)] || 0) * boostW;
          pool.push({v, tense, i, w});
        }
      });
    });
    let total = pool.reduce((s,q)=>s+q.w, 0);
    let r = Math.random()*total;
    for(const q of pool){ r -= q.w; if(r <= 0) return q; }
    return pool[pool.length-1];
  }

  /* practice = pseudo-piste over everything already unlocked, relaxed clock */
  function practiceMtn(){
    const open = MOUNTAINS.filter(m => m.xpReq <= P.xp);
    return {
      id:'practice', practice:true, icon:'🎯', color:'#8B5CF6',
      name:'Entraînement', desc:'Révision en douceur',
      verbs: Array.from(new Set(open.flatMap(m => m.verbs))),
      tenses: Array.from(new Set(open.flatMap(m => m.tenses))),
      clock: 25,
    };
  }

  function start(mtnId){
    mtn = mtnId === 'practice' ? practiceMtn() : MTN(mtnId);
    jumps = mtn.practice ? 8 : 10;
    jumpN = 0; score = 0; streak = 0; correct = 0; bestTrick = null; misses = [];
    runCoins = 0; backflips = 0; goldensHit = 0; lastTier = 0; chest = null;
    // consume the boost picked on the piste screen
    boost = null;
    if(!mtn.practice && UI.selBoost && (P.boosts[UI.selBoost] || 0) > 0){
      boost = UI.selBoost;
      P.boosts[boost]--; persist();
    }
    UI.selBoost = null;
    const bp = $('boostPill');
    bp.style.display = boost ? '' : 'none';
    if(boost) bp.textContent = BOOSTS[boost].icon + ' ' + BOOSTS[boost].name;
    UI.show('game');
    World.setTheme(mtn.theme || null);
    World.setFire(0); World.setSpeed(3.5);
    $('recordPill').classList.remove('beaten');
    updateHUD();
    countdown(3);
  }
  function practice(){ start('practice'); }

  function countdown(n){
    const cd = $('countdown');
    cd.classList.add('show');
    const pop = txt => {                             // re-trigger the pop animation per digit
      cd.textContent = txt;
      cd.classList.remove('pop'); void cd.offsetWidth;
      cd.classList.add('pop');
    };
    const step = k => {
      if(k === 0){ pop('GO !'); Sfx.fire(); setTimeout(()=>{ cd.classList.remove('show'); nextJump(); }, 550); return; }
      pop(k); Sfx.tick();
      setTimeout(()=>step(k-1), 700);
    };
    step(n);
  }

  function nextJump(){
    if(jumpN >= jumps) return finish();
    jumpN++;
    updateHUD();
    current = pickQuestion();
    answered = false;
    current.golden = Math.random() < .12;            // ✨ 1-in-8ish golden verb, ×3 points
    current.pr = pickPronoun(current.i);
    if(current.tense === 'passé composé'){
      const pc = passeCompose(current.v, current.i, current.pr);
      current.form = pc.form; current.accept = pc.accept;
    } else {
      current.form = conjugate(current.v, current.tense, current.i);
      current.accept = [current.form];
    }
    const form = current.form;

    $('pTense').textContent = current.tense.toUpperCase();
    $('pVerb').textContent = current.v;
    $('pEng').textContent = P.settings.hint ? (VERBS[current.v].eng || '') : '';
    $('pEng').style.display = P.settings.hint ? '' : 'none';
    $('pPerson').textContent = displayPronoun(current.pr, form) === "j'" ? "j'" : current.pr;
    $('promptCard').classList.toggle('golden', current.golden);
    $('goldenTag').style.display = current.golden ? '' : 'none';
    if(current.golden) Sfx.golden();

    const zone = $('prompt-zone');
    zone.classList.add('active');
    const inp = $('answer'); inp.value = ''; inp.focus();

    clockMs = mtn.clock * 1000;
    if(current.tense === 'passé composé') clockMs += 4000;  // two words to type
    if(boost === 'chrono') clockMs += 3000;
    deadline = performance.now() + clockMs;
    clearInterval(timerId);
    timerId = setInterval(() => {
      const left = deadline - performance.now();
      const fill = $('timerfill');
      fill.style.width = Math.max(0, left/clockMs*100) + '%';
      fill.classList.toggle('low', left < clockMs*.3);
      if(left < clockMs*.3 && Math.floor(left/500) !== Math.floor((left+50)/500)) Sfx.tick();
      if(left <= 0) submit(true);
    }, 50);
  }

  function submit(timedOut){
    if(!current || answered) return;
    answered = true;
    clearInterval(timerId);
    const inp = $('answer');
    const ok = !timedOut && current.accept.some(f => isCorrect(inp.value, f));
    const key = weightKey(current.v, current.tense, current.i);
    $('prompt-zone').classList.remove('active');

    if(ok){
      correct++;
      const elapsed = clockMs - (deadline - performance.now());
      const frac = elapsed / clockMs;
      let pts, spins;
      if(frac < .35){ pts = 120; spins = 2; backflips++; Missions.event('backflip'); }
      else if(frac < .7){ pts = 70; spins = 1; }
      else { pts = 40; spins = 0; }
      const trick = TRICKS[spins][Math.floor(Math.random()*TRICKS[spins].length)];
      streak++;
      Missions.event('land');
      Missions.event('combo', streak);

      const mult = multFor(streak);
      pts *= mult;
      let tag = mult > 1 ? ` ×${mult}` : '';
      if(current.golden){ pts *= 3; goldensHit++; Missions.event('golden'); tag += ' ✨×3'; }
      score += pts;
      if(!bestTrick || pts > bestTrick.pts) bestTrick = {name:trick, pts};

      // combo tier escalation
      const tier = tierFor(streak);
      if(tier > lastTier){
        lastTier = tier;
        const T = TIERS[tier-1];
        World.setFire(tier); World.setSpeed(T.speed);
        World.confetti(20 + tier*15, .5, .25);
        World.shake(8 + tier*4);
        showCombo(T.name, T.cls);
        Sfx.tierUp(tier);
      }

      World.jump(spins);
      if(spins === 2) World.shake(10);
      if(current.golden){ World.confetti(24, .3, .5); }
      Sfx.land(spins, streak);
      showBurst(trick + tag, '+' + pts + ' pts');

      // coins fly to the pill 🪙
      let earn = (3 + tierFor(streak)) + (current.golden ? 10 : 0) + (spins === 2 ? 2 : 0);
      if(boost === 'aimant') earn *= 2;
      runCoins += earn;               // credit up front — the flight is pure decoration
      let flown = 0;
      World.coinBurst(Math.min(earn, 9), () => {
        flown++;
        Sfx.coin(flown);
        const pill = $('coinPill');
        pill.classList.add('bump'); setTimeout(()=>pill.classList.remove('bump'), 90);
      });

      if(P.weights[key]) P.weights[key] = Math.max(0, P.weights[key] - 1);
    } else {
      const shielded = boost === 'bouclier';
      if(shielded){                                  // 🛡️ combo survives, boost is spent
        boost = null; $('boostPill').style.display = 'none';
        World.confetti(16, .3, .5);
        showBurst('BOUCLIER ! 🛡️', 'combo sauvé');
        Sfx.golden();
        // still land a clean (pointless) trick — the shield absorbed the fall
        const elapsed = clockMs - Math.max(0, deadline - performance.now());
        const frac = Math.min(1, elapsed / clockMs);
        World.jump(timedOut ? 0 : (frac < .35 ? 2 : frac < .7 ? 1 : 0));
      } else {
        streak = 0; lastTier = 0;
        World.setFire(0); World.setSpeed(3.5);
        World.tumble();                              // 💥 wipeout
        Sfx.wipe(); Sfx.miss();
        showBurst('RATÉ…', '+0 pts');
      }
      P.weights[key] = (P.weights[key] || 0) + 1.5;
      misses.push(current);
      const rc = $('reveal-card');
      rc.querySelector('.answer').textContent =
        displayPronoun(current.pr, current.form) === "j'"
          ? "j'" + current.form : current.pr + ' ' + current.form;
      rc.classList.add('show');
      setTimeout(()=>rc.classList.remove('show'), 2100);
    }
    persist();
    updateHUD();
    setTimeout(nextJump, ok ? 1300 : 2300);
  }

  function showBurst(name, pts){
    const b = $('trick-burst');
    b.querySelector('.trick-name').textContent = name;
    b.querySelector('.trick-pts').textContent = pts;
    b.classList.remove('show'); void b.offsetWidth;
    b.classList.add('show');
  }

  function showCombo(name, cls){
    const c = $('combo-banner');
    c.textContent = name;
    c.className = '';
    void c.offsetWidth;
    c.className = 'show ' + cls;
  }

  function updateHUD(){
    $('scorePill').textContent = score + ' pts';
    $('streakPill').textContent = '🔥 ' + streak;
    $('streakPill').classList.toggle('fire', streak >= 3);
    $('coinPill').textContent = '🪙 ' + runCoins;
    $('jumpPill').textContent = 'Saut ' + Math.min(Math.max(jumpN,1), jumps) + '/' + jumps;
    if(mtn.practice){ $('recordPill').textContent = '🎯 révision'; return; }
    const rec = P.best[mtn.id] || 0;
    $('recordPill').textContent = '🏆 ' + (score > rec && rec > 0 ? score : rec);
    if(rec > 0 && score > rec){ $('recordPill').classList.add('beaten'); }
  }

  function finish(){
    clearInterval(timerId);
    World.setFire(0); World.setSpeed(3);

    const acc = Math.round(correct / jumps * 100);
    const isNewDay = Daily.touch();
    const dayMult = Daily.mult();
    const coinsEarned = Math.round((runCoins + (acc === 100 ? 40 : 0)) * dayMult);
    const xpBefore = P.xp;
    const xpEarned = Math.round(score / (mtn.practice ? 16 : 8));  // practice: half XP
    const prevBest = mtn.practice ? 0 : (P.best[mtn.id] || 0);
    const newRecord = !mtn.practice && score > prevBest;
    if(newRecord) P.best[mtn.id] = score;
    P.coins += coinsEarned;
    P.xp += xpEarned;
    persist();

    Missions.event('run');
    if(acc === 100) Missions.event('perfect');

    $('resTitle').textContent =
      mtn.practice ? (acc === 100 ? 'Révision parfaite ! 🎯' : 'Entraînement terminé 🎯')
      : newRecord && prevBest > 0 ? '🏆 NOUVEAU RECORD ! 🏆'
      : acc === 100 ? 'DESCENTE PARFAITE ! 🏆'
      : acc >= 70 ? 'Belle descente ! 🏁' : 'Descente terminée 🏁';
    $('resSub').textContent = mtn.name + ' · ' + mtn.desc +
      (newRecord && prevBest > 0 ? ` — ancien record : ${prevBest}` : '');

    countUp($('resScore'), score);
    countUp($('resAcc'), acc, '%');
    $('resBest').textContent = bestTrick ? bestTrick.name.replace(' !','') : '—';
    $('resCoins').textContent = '+' + coinsEarned + ' 🪙' + (dayMult > 1 ? ` (×${dayMult.toFixed(1)} 🔥)` : '');

    if(newRecord || acc === 100){ Sfx.record(); World.confetti(70, .5, .3); World.confetti(50, .25, .4); World.confetti(50, .75, .4); }
    else Sfx.fanfare();
    if(isNewDay && Daily.streak() > 1) setTimeout(()=>toast(`🔥 Série de ${Daily.streak()} jours ! Bonus pièces +${Math.round((Daily.mult()-1)*100)}%`), 800);

    // XP progress toward next mountain
    const next = MOUNTAINS.find(m => m.xpReq > xpBefore);
    const noteEl = $('resXPnote'), fillEl = $('resXPfill');
    if(next){
      const prevReq = MOUNTAINS.filter(m=>m.xpReq <= xpBefore).reduce((a,m)=>Math.max(a,m.xpReq),0);
      const pct = Math.min(100, (P.xp - prevReq) / (next.xpReq - prevReq) * 100);
      noteEl.textContent = `+${xpEarned} XP — ${next.name} à ${next.xpReq} XP (${P.xp}/${next.xpReq})`;
      fillEl.style.width = '0%'; setTimeout(()=>fillEl.style.width = pct + '%', 60);
    } else {
      noteEl.textContent = `+${xpEarned} XP — toutes les pistes sont débloquées ! (${P.xp} XP)`;
      fillEl.style.width = '100%';
    }

    // unlock flash
    const unlocked = MOUNTAINS.filter(m => m.xpReq > xpBefore && m.xpReq <= P.xp);
    $('unlockFlash').innerHTML = unlocked.map(m =>
      `<div class="unlock-flash">🎉 Nouvelle piste débloquée : ${m.icon} ${m.name} !</div>`).join('');

    // mystery chest for a solid run
    chest = acc >= 70 ? rollChest() : null;
    $('chestZone').style.display = chest ? '' : 'none';
    $('chestBtn').disabled = false;
    $('chestBtn').textContent = '🎁';
    $('chestReveal').innerHTML = '';

    // review list
    const rl = $('reviewList');
    if(misses.length){
      const seen = new Set();
      rl.innerHTML = '<h3>À réviser 📝</h3>' + misses.filter(m=>{
        const k = m.v + m.tense + m.i; if(seen.has(k)) return false; seen.add(k); return true;
      }).map(m => {
        const full = displayPronoun(m.pr, m.form) === "j'" ? "j'" + m.form : m.pr + ' ' + m.form;
        return `<div class="review-item"><span>${m.v} · ${m.tense}</span><b>${full}</b></div>`;
      }).join('');
    } else {
      rl.innerHTML = '<h3 style="color:#4EC9A0">Aucune erreur — chapeau ! 🎩</h3>';
    }

    buildSubmit(mtn.id, score, acc);

    UI.show('results');
  }

  /* leaderboard submission UI on the results screen */
  function buildSubmit(mtnId, sc, acc){
    const box = $('lbSubmit');
    if(!box) return;
    if(mtnId === 'practice'){ box.innerHTML = ''; return; }  // practice stays off the leaderboard
    if(!window.Cloud){ box.innerHTML = ''; return; }   // offline → nothing to publish to
    if(Cloud.isSignedIn()){
      box.innerHTML = `<div class="lb-status">📡 Publication de ton score…</div>`;
      Cloud.submitScore({ mountainId: mtnId, score: sc, accuracy: acc, board: P.activeBoard })
        .then(res => {
          box.innerHTML = res && res.skipped
            ? `<div class="lb-status">🏆 Ton record du classement (${res.best}) tient bon !</div>`
            : `<div class="lb-status ok">🏆 Score publié au classement !</div>`;
        })
        .catch(e => { console.warn(e); box.innerHTML = `<div class="lb-status">Publication impossible pour l'instant.</div>`; });
      return;
    }
    // anonymous → confirm a display name, then publish
    const nm = P.riderName || 'Leila';
    box.innerHTML = `
      <div class="lb-status">Publie ton score au classement :</div>
      <div class="lb-submit-row">
        <input id="lbName" maxlength="20" autocomplete="off" spellcheck="false" value="${escapeHTML(nm)}" placeholder="ton nom">
        <button id="lbPublish" class="chip-btn go">Publier 🏆</button>
      </div>`;
    const btn = $('lbPublish'), inp = $('lbName');
    btn.onclick = () => {
      const name = (inp.value || '').trim().slice(0, 20) || 'Rider';
      P.riderName = name; persist();
      btn.disabled = inp.disabled = true; btn.textContent = 'Publication…';
      Cloud.submitScore({ mountainId: mtnId, score: sc, accuracy: acc, board: P.activeBoard, displayName: name })
        .then(() => { box.innerHTML = `<div class="lb-status ok">🏆 Publié sous « ${escapeHTML(name)} » !</div>`; Sfx.click(); })
        .catch(e => { console.warn(e); btn.disabled = inp.disabled = false; btn.textContent = 'Publier 🏆'; toast('Publication impossible.'); });
    };
  }

  function rollChest(){
    const r = Math.random();
    if(r < .03)  return { rar:'legendaire', label:'LÉGENDAIRE', coins: 200 };
    if(r < .15)  return { rar:'epique',     label:'ÉPIQUE',     coins: 70 + Math.floor(Math.random()*51) };
    if(r < .40)  return { rar:'rare',       label:'RARE',       coins: 30 + Math.floor(Math.random()*31) };
    return          { rar:'commun',     label:'Commun',     coins: 10 + Math.floor(Math.random()*16) };
  }

  function openChest(){
    if(!chest) return;
    const btn = $('chestBtn');
    if(btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('shaking');
    Sfx.chestShake();
    setTimeout(()=>Sfx.chestShake(), 180);
    setTimeout(()=>Sfx.chestShake(), 360);
    setTimeout(() => {
      btn.classList.remove('shaking');
      btn.textContent = '🎉';
      P.coins += chest.coins; persist();
      $('chestReveal').innerHTML =
        `<div class="chest-reveal rar-${chest.rar}">${chest.label} · +${chest.coins} 🪙</div>`;
      Sfx.chestOpen(chest.rar);
      const n = { commun:8, rare:12, epique:18, legendaire:26 }[chest.rar] || 8;
      domBurst(btn, '🪙', n);
      if(chest.rar === 'legendaire') domBurst(btn, '✨', 10);
    }, 600);
  }

  function replay(){ start(mtn.id); }
  function quit(){
    clearInterval(timerId);
    $('prompt-zone').classList.remove('active');
    $('boostPill').style.display = 'none';
    UI.show('menu');
  }

  document.getElementById('answer').addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault(); submit(false); }
  });

  return { start, practice, submit: () => submit(false), replay, quit, openChest };
})();

/* ---------------- boot ---------------- */
Settings.sync();
UI.refreshMenu();

/* ---------------- cloud glue ----------------
   cloud.js is an ES module and can't see P/UI/Game, so it dispatches
   window events; this classic-scope code reacts and mutates game state. */
window.addEventListener('cloud-ready', () => { UI.refreshMenu(); Settings.syncAuth(); });
window.addEventListener('cloud-auth',  () => { UI.refreshMenu(); Settings.syncAuth(); });
window.addEventListener('cloud-signin', () => {
  if(window.Cloud && Cloud.isSignedIn()) toast(`Connectée — salut ${Cloud.nameOf()} ! 👋`);
});
window.addEventListener('cloud-save', e => {          // merge cloud snapshot into local P
  if(mergeCloudSave(e.detail)){
    persist();                                        // writes merged state locally + re-queues cloud push
    if(window.Cloud) Cloud.pushSave(P);               // write merged state back immediately
    UI.refreshMenu();
    if(document.getElementById('mountains').classList.contains('active')) UI.buildMountains();
  } else if(window.Cloud && Cloud.isSignedIn()){
    Cloud.pushSave(P);                                // no cloud save yet → seed it from local progress
  }
});
