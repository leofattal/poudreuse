/* ---------------- UI helpers ---------------- */
const UI = {
  show(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'menu') UI.refreshMenu();
    if(id === 'mountains') UI.buildMountains();
    if(id === 'shop') UI.buildShop();
    Sfx.click(); Sfx.unlock();
  },
  refreshMenu(){
    document.getElementById('menuXP').textContent = P.xp;
    document.getElementById('menuCoins').textContent = P.coins;
    const chip = document.getElementById('dayChip');
    const ds = Daily.streak();
    if(ds > 0){
      chip.style.display = '';
      chip.textContent = `🔥 Jour ${ds}` + (ds > 1 ? ` · +${Math.round((Daily.mult()-1)*100)}% 🪙` : '');
    } else chip.style.display = 'none';
    Missions.render();
  },
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
  },
  buildShop(){
    document.getElementById('shopCoins').textContent = P.coins;
    const grid = document.getElementById('shopGrid'); grid.innerHTML = '';
    Object.entries(BOARDS).forEach(([id, b]) => {
      const owned = P.ownedBoards.includes(id);
      const active = P.activeBoard === id;
      const card = document.createElement('div');
      card.className = 'board-card' + (active ? ' owned-active' : '');
      card.innerHTML = `
        <h4>${b.name}</h4>
        <div class="board-swatch" style="background:linear-gradient(90deg,${b.c1},${b.c2})"></div>
        ${owned
          ? `<button class="use" ${active?'disabled':''}>${active?'Équipée ✓':'Équiper'}</button>`
          : `<button ${P.coins < b.price ? 'disabled':''}>🪙 ${b.price}</button>`}`;
      card.querySelector('button').onclick = () => {
        if(owned){ P.activeBoard = id; }
        else if(P.coins >= b.price){ P.coins -= b.price; P.ownedBoards.push(id); P.activeBoard = id; Sfx.fanfare(); }
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
  },
  toggle(k){ P.settings[k] = !P.settings[k]; persist(); Settings.sync(); Sfx.click(); },
};

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
