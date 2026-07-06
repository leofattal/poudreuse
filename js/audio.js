/* ---------------- Sound (procedural Web Audio) ---------------- */
const Sfx = (() => {
  let ctx = null;
  function ac(){ if(!ctx){ try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return ctx; }
  function tone(freq, dur, type, vol, when){
    const a = ac(); if(!a || !P.settings.sound) return;
    const t = a.currentTime + (when||0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type||'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol||.15, t);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol){
    const a = ac(); if(!a || !P.settings.sound) return;
    const b = a.createBuffer(1, a.sampleRate*dur, a.sampleRate);
    const d = b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const s = a.createBufferSource(); s.buffer = b;
    const g = a.createGain(); g.gain.value = vol||.2;
    const f = a.createBiquadFilter(); f.type='lowpass'; f.frequency.value = 900;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  return {
    land(spins, streak){
      const p = Math.pow(2, Math.min(streak||0, 10)/12);   // rising pitch per combo
      tone(523*p,.12,'triangle',.18); tone(659*p,.12,'triangle',.16,.09); tone(784*p,.2,'triangle',.16,.18);
      if(spins === 2) tone(1047*p,.3,'triangle',.18,.27);
    },
    coin(n){ tone(1319*Math.pow(2,(n%5)/12),.08,'square',.07); },
    wipe(){ noise(.45,.3); tone(140,.35,'sawtooth',.12); },
    miss(){ tone(330,.18,'triangle',.14); tone(262,.22,'triangle',.13,.14); tone(196,.35,'triangle',.12,.3); },
    tick(){ tone(880,.05,'square',.05); },
    fire(){ [523,659,784,1047,1319].forEach((f,i)=>tone(f,.1,'square',.09,i*.06)); },
    tierUp(t){
      const base = [1,1.25,1.5][t-1] || 1;
      [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f*base,.12,'square',.1,i*.05));
      tone(2093*base,.4,'triangle',.14,.32);
    },
    golden(){ [1568,1976,2349].forEach((f,i)=>tone(f,.14,'sine',.12,i*.07)); },
    chestShake(){ noise(.08,.15); tone(220,.08,'square',.08); },
    chestOpen(rar){
      const runs = {commun:[523,659], rare:[523,659,784,1047],
                    epique:[523,659,784,1047,1319,1568], legendaire:[523,659,784,1047,1319,1568,2093,2637]};
      (runs[rar]||runs.commun).forEach((f,i)=>tone(f,.15,'triangle',.15,i*.09));
    },
    record(){ [784,988,1175,1568].forEach((f,i)=>tone(f,.2,'triangle',.16,i*.11)); tone(2093,.6,'triangle',.16,.5); },
    click(){ tone(660,.06,'sine',.1); },
    fanfare(){ [392,523,659,784].forEach((f,i)=>tone(f,.22,'triangle',.16,i*.13)); tone(1047,.5,'triangle',.18,.55); },
    unlock(){ ac() && P.settings.sound && ctx.resume && ctx.resume(); },
  };
})();
