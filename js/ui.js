/* ---------------- UI helpers ---------------- */
const UI = {
  lbMtn: 0,                                    // currently viewed leaderboard piste
  show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'menu') UI.refreshMenu();
    if(id === 'mountains') UI.buildMountains();
    if(id === 'shop') UI.buildShop();
    if(id === 'settings') Settings.sync();
    if(id === 'leaderboard') UI.buildLeaderboard(UI.lbMtn);
    Sfx.click(); Sfx.unlock();
  },
  refreshMenu(){
    document.getElementById('menuXP').textContent = P.xp;
    document.getElementById('menuCoins').textContent = P.coins;
    const rn = document.getElementById('riderName');
    if(rn) rn.textContent = (window.Cloud && Cloud.isSignedIn() && Cloud.nameOf()) || P.riderName || 'Leila';
    const chip = document.getElementById('dayChip');
    const ds = Daily.streak();
    if(ds > 0){
      chip.style.display = '';
      chip.textContent = `🔥 Jour ${ds}` + (ds > 1 ? ` · +${Math.round((Daily.mult()-1)*100)}% 🪙` : '');
    } else chip.style.display = 'none';
    Missions.render();
  },
  buildLeaderboard(mtnId){
    UI.lbMtn = mtnId = (mtnId == null ? UI.lbMtn : mtnId);
    const tabs = document.getElementById('lbTabs');
    tabs.innerHTML = '';
    MOUNTAINS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'lb-tab' + (m.id === mtnId ? ' active' : '');
      b.style.setProperty('--tabc', m.color);
      b.innerHTML = `${m.icon}`;
      b.title = m.name;
      b.onclick = () => UI.buildLeaderboard(m.id);
      tabs.appendChild(b);
    });
    const list = document.getElementById('lbList');
    const mtn = MTN(mtnId);
    if(!window.Cloud){
      list.innerHTML = `<div class="lb-empty">⛄ Classement indisponible hors ligne.</div>`;
      return;
    }
    list.innerHTML = `<div class="lb-empty">Chargement du classement — ${mtn.name}…</div>`;
    const myBest = P.best[mtnId] || 0;
    Cloud.fetchLeaderboard(mtnId).then(rows => {
      if(UI.lbMtn !== mtnId) return;             // user switched tab meanwhile
      if(!rows.length){
        list.innerHTML = `<div class="lb-empty">Personne n'a encore ridé <b>${mtn.name}</b>. Sois la première ! 🏂</div>`;
        return;
      }
      const medal = ['🥇','🥈','🥉'];
      list.innerHTML = rows.map((r, i) => {
        const rank = medal[i] || `${i+1}`;
        const av = r.avatar_url
          ? `<img class="lb-av" src="${r.avatar_url}" alt="" referrerpolicy="no-referrer">`
          : `<span class="lb-av lb-av-blank">🏂</span>`;
        return `<div class="lb-row${r.score===myBest && myBest>0 ? ' me':''}">
          <span class="lb-rank">${rank}</span>${av}
          <span class="lb-name">${escapeHTML(r.display_name)}</span>
          <span class="lb-acc">${r.accuracy}%</span>
          <span class="lb-score">${r.score}</span>
        </div>`;
      }).join('');
    }).catch(err => {
      console.warn('[lb]', err);
      list.innerHTML = `<div class="lb-empty">Impossible de charger le classement. Réessaie plus tard.</div>`;
    });
  },
  auth(){                                        // sign in / out toggle (settings button)
    if(!window.Cloud){ toast('Connexion indisponible pour le moment.'); return; }
    Sfx.click();
    if(Cloud.isSignedIn()) Cloud.signOut();
    else Cloud.signInWithGoogle().catch(e => { console.warn(e); toast('Connexion Google impossible.'); });
  },
  selBoost: null,                                // boost picked for the next run
  buildMountains(){
    const box = document.getElementById('mtnList'); box.innerHTML = '';
    MOUNTAINS.forEach(m => {
      const locked = P.xp < m.xpReq;
      const card = document.createElement('button');
      card.className = 'mtn-card' + (locked ? ' locked' : '');
      card.innerHTML = `
        <div class="mtn-dot" style="background:${m.color}">${m.icon}</div>
        <div class="mtn-info">
          <h3>${m.name}</h3>
          <p>${m.desc}</p>
          ${locked ? `<p class="lock-note">🔒 Débloque à ${m.xpReq} XP (il te manque ${m.xpReq - P.xp})</p>` : ''}
        </div>`;
      if(!locked) card.onclick = () => Game.start(m.id);
      box.appendChild(card);
    });
    UI.buildBoostBar();
  },
  buildBoostBar(){
    const bar = document.getElementById('boostBar');
    const owned = Object.entries(BOOSTS).filter(([id]) => (P.boosts[id] || 0) > 0);
    if(!owned.length){ bar.innerHTML = ''; UI.selBoost = null; return; }
    if(UI.selBoost && !(P.boosts[UI.selBoost] > 0)) UI.selBoost = null;
    bar.innerHTML = `<div class="boost-title">⚡ Ton atout pour la descente :</div>
      <div class="boost-chips">` +
      owned.map(([id, b]) =>
        `<button class="boost-chip${UI.selBoost === id ? ' sel' : ''}" data-b="${id}">
          ${b.icon} ${b.name} <span class="ct">×${P.boosts[id]}</span></button>`).join('') +
      `</div>`;
    bar.querySelectorAll('.boost-chip').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.b;
        UI.selBoost = UI.selBoost === id ? null : id;
        Sfx.click();
        UI.buildBoostBar();
      };
    });
  },
  buildShop(){
    document.getElementById('shopCoins').textContent = P.coins;
    const grid = document.getElementById('shopGrid'); grid.innerHTML = '';
    const section = txt => {
      const h = document.createElement('h3');
      h.className = 'shop-sec'; h.textContent = txt;
      grid.appendChild(h);
    };
    // gear (boards + outfits) share the buy/equip pattern
    const gearCard = (id, item, ownedList, activeKey, swatch) => {
      const owned = P[ownedList].includes(id);
      const active = P[activeKey] === id;
      const card = document.createElement('div');
      card.className = 'board-card' + (active ? ' owned-active' : '');
      card.innerHTML = `
        <h4>${item.name}</h4>
        ${swatch}
        ${owned
          ? `<button class="use" ${active?'disabled':''}>${active?'Équipée ✓':'Équiper'}</button>`
          : `<button ${P.coins < item.price ? 'disabled':''}>🪙 ${item.price}</button>`}`;
      card.querySelector('button').onclick = () => {
        if(owned){ P[activeKey] = id; }
        else if(P.coins >= item.price){ P.coins -= item.price; P[ownedList].push(id); P[activeKey] = id; Sfx.fanfare(); }
        persist(); UI.buildShop();
      };
      grid.appendChild(card);
    };
    section('Planches 🛹');
    Object.entries(BOARDS).forEach(([id, b]) => gearCard(id, b, 'ownedBoards', 'activeBoard',
      `<div class="board-swatch" style="background:linear-gradient(90deg,${b.c1},${b.c2})"></div>`));
    section('Tenues 🧥');
    Object.entries(OUTFITS).forEach(([id, o]) => gearCard(id, o, 'ownedOutfits', 'activeOutfit',
      `<div class="board-swatch" style="background:linear-gradient(90deg,${o.jacket} 60%,${o.beanie} 60%)"></div>`));
    section('Atouts ⚡ (à usage unique)');
    Object.entries(BOOSTS).forEach(([id, b]) => {
      const n = P.boosts[id] || 0;
      const card = document.createElement('div');
      card.className = 'board-card';
      card.innerHTML = `
        <div class="boost-big">${b.icon}${n ? `<span class="boost-count">×${n}</span>` : ''}</div>
        <h4>${b.name}</h4>
        <p class="boost-desc">${b.desc}</p>
        <button ${P.coins < b.price || n >= 9 ? 'disabled':''}>${n >= 9 ? 'Max ×9' : '🪙 ' + b.price}</button>`;
      card.querySelector('button').onclick = () => {
        if(P.coins < b.price || (P.boosts[id] || 0) >= 9) return;
        P.coins -= b.price;
        P.boosts[id] = (P.boosts[id] || 0) + 1;
        Sfx.coin(1);
        persist(); UI.buildShop();
      };
      grid.appendChild(card);
    });
  },
};

const Settings = {
  sync(){
    document.getElementById('tglStrict').classList.toggle('on', P.settings.strict);
    document.getElementById('tglHint').classList.toggle('on', P.settings.hint);
    document.getElementById('tglSound').classList.toggle('on', P.settings.sound);
    Settings.syncAuth();
  },
  syncAuth(){
    const btn = document.getElementById('authBtn');
    const title = document.getElementById('authTitle');
    const sub = document.getElementById('authSub');
    const av = document.getElementById('authAvatar');
    if(!btn) return;
    const on = window.Cloud && Cloud.isSignedIn();
    if(on){
      btn.textContent = 'Déconnexion';
      title.textContent = Cloud.nameOf() || 'Connectée';
      sub.textContent = 'Progression sauvegardée dans le cloud ✓';
      const url = Cloud.avatarOf();
      if(url){ av.src = url; av.style.display = ''; av.referrerPolicy = 'no-referrer'; }
      else av.style.display = 'none';
    } else {
      btn.textContent = 'Se connecter';
      title.textContent = 'Compte Google';
      sub.textContent = 'Sauvegarde ta progression et publie ton nom au classement.';
      av.style.display = 'none';
    }
  },
  toggle(k){ P.settings[k] = !P.settings[k]; persist(); Settings.sync(); Sfx.click(); },
};

/* small HTML escaper for user-supplied names shown in the leaderboard */
function escapeHTML(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ---------------- Accent strip ---------------- */
(() => {
  const strip = document.getElementById('accentStrip');
  ['é','è','ê','à','ç','î','û'].forEach(ch => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = ch;
    b.onmousedown = e => e.preventDefault(); // keep input focus
    b.onclick = () => {
      const inp = document.getElementById('answer');
      const s = inp.selectionStart ?? inp.value.length;
      inp.value = inp.value.slice(0,s) + ch + inp.value.slice(inp.selectionEnd ?? s);
      inp.focus(); inp.setSelectionRange(s+1, s+1);
    };
    strip.appendChild(b);
  });
})();

/* ---------------- Answer normalization ---------------- */
function norm(s, stripAccents){
  s = s.trim().toLowerCase().replace(/\s+/g,' ');
  if(stripAccents) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return s;
}
function isCorrect(input, target){
  const strip = !P.settings.strict;
  return norm(input, strip) === norm(target, strip);
}
