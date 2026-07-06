/* =====================================================================
   CANVAS WORLD
===================================================================== */
const World = (() => {
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, t = 0, scroll = 0;
  let speed = 3, shakeI = 0;     // world scroll speed, screen shake intensity
  const flakes = [], sprays = [], confs = [], fcoins = [];
  let farPeaks = [], midPeaks = [], trees = [];
  const FIRE_COLORS = [null, '255,198,61', '255,93,143', '139,92,246'];

  // rider state
  const rider = {
    x: 0.3, baseY: 0,           // x as fraction of W
    airY: 0, vy: 0, rot: 0, rotV: 0,
    mode: 'ride',               // ride | air | tumble | recover
    tumbleT: 0, fireTier: 0,
  };

  function resize(){
    W = cv.width = window.innerWidth * devicePixelRatio;
    H = cv.height = window.innerHeight * devicePixelRatio;
    cv.style.width = '100%'; cv.style.height = '100%';
    genScenery();
  }
  window.addEventListener('resize', resize);

  function rnd(a,b){ return a + Math.random()*(b-a); }

  function genScenery(){
    farPeaks = []; midPeaks = []; trees = [];
    for(let x = -200; x < W + 600; x += rnd(180,320)*devicePixelRatio)
      farPeaks.push({x, h: rnd(.18,.32)*H, w: rnd(160,300)*devicePixelRatio});
    for(let x = -200; x < W + 600; x += rnd(240,420)*devicePixelRatio)
      midPeaks.push({x, h: rnd(.10,.2)*H, w: rnd(200,360)*devicePixelRatio});
    for(let x = -100; x < W + 400; x += rnd(90,240)*devicePixelRatio)
      trees.push({x, s: rnd(.5,1.1), layer: Math.random() < .5 ? 0 : 1});
    flakes.length = 0;
    for(let i=0;i<90;i++) flakes.push({x:Math.random()*W, y:Math.random()*H, r:rnd(1,3.4)*devicePixelRatio, v:rnd(.4,1.4)});
  }

  function terrainY(x){
    // gentle rolling snow surface near bottom
    const base = H * .78;
    return base + Math.sin((x + scroll*2)*.0016) * H*.02 + Math.sin((x + scroll*2)*.0005) * H*.03;
  }

  /* ---- rider drawing (cute vector snowboarder) ---- */
  function drawRider(px, py){
    const s = Math.min(W,H) * .00034;   // scale unit
    const board = BOARDS[P.activeBoard] || BOARDS.flamant;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rider.rot);
    const k = Math.max(.7, Math.min(1.4, W/1400)) * devicePixelRatio;
    ctx.scale(k, k);

    // fire trail glow when on streak — color escalates with combo tier
    if(rider.fireTier > 0 && rider.mode !== 'tumble'){
      const c = rider.fireTier === 3
        ? `${Math.floor(128+127*Math.sin(t*.15))},${Math.floor(128+127*Math.sin(t*.15+2))},${Math.floor(128+127*Math.sin(t*.15+4))}`
        : FIRE_COLORS[rider.fireTier];
      const rad = 60 + rider.fireTier*12;
      const g = ctx.createRadialGradient(0,10,4, 0,10,rad);
      g.addColorStop(0,`rgba(${c},.6)`); g.addColorStop(1,`rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,10,rad,0,7); ctx.fill();
    }

    // board
    ctx.save();
    ctx.rotate(-.12);
    const bg = ctx.createLinearGradient(-46,0,46,0);
    bg.addColorStop(0, board.c1); bg.addColorStop(1, board.c2);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-48, 22, 96, 12, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,71,.35)'; ctx.lineWidth = 2; ctx.stroke();
    if(board.stars){
      ctx.fillStyle = '#fff';
      [-30,-8,16,34].forEach((sx,i)=>{ ctx.beginPath(); ctx.arc(sx, 28, i%2?1.6:2.4, 0, 7); ctx.fill(); });
    }
    ctx.restore();

    // legs
    ctx.strokeStyle = '#2B3050'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-12, 20); ctx.lineTo(-14, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(12, -2); ctx.stroke();

    // body (jacket)
    ctx.fillStyle = '#6FD8F2';
    ctx.beginPath(); ctx.roundRect(-16, -26, 32, 30, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(30,36,71,.25)'; ctx.lineWidth = 2; ctx.stroke();

    // arms
    ctx.strokeStyle = '#6FD8F2'; ctx.lineWidth = 8;
    const wob = rider.mode === 'air' ? -14 : Math.sin(t*.1)*3;
    ctx.beginPath(); ctx.moveTo(-14,-18); ctx.lineTo(-30, -6 + wob); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14,-18); ctx.lineTo(30, -10 + wob); ctx.stroke();

    // head
    ctx.fillStyle = '#F5C9A8';
    ctx.beginPath(); ctx.arc(0, -38, 12, 0, 7); ctx.fill();
    // beanie
    ctx.fillStyle = '#FF5D8F';
    ctx.beginPath(); ctx.arc(0, -42, 12.5, Math.PI, 0); ctx.fill();
    ctx.fillRect(-12.5, -44, 25, 5);
    ctx.beginPath(); ctx.arc(0, -54, 4.5, 0, 7); ctx.fill(); // pompom
    // hair peeking (Leila!)
    ctx.strokeStyle = '#5A3825'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10,-38); ctx.quadraticCurveTo(16,-30, 13,-20); ctx.stroke();
    // face
    ctx.fillStyle = '#2B3050';
    ctx.beginPath(); ctx.arc(4,-38, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(9,-38, 1.8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2B3050'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(6.5,-34.5, 2.6, .15*Math.PI, .85*Math.PI); ctx.stroke(); // smile
    ctx.restore();
  }

  function drawTree(x, groundY, s){
    ctx.save(); ctx.translate(x, groundY); const u = s*devicePixelRatio;
    ctx.fillStyle = '#3B2B22'; ctx.fillRect(-4*u, -8*u, 8*u, 10*u);
    ctx.fillStyle = '#1F4A3D';
    for(let i=0;i<3;i++){
      const w = (34 - i*8)*u, y = -6*u - i*20*u;
      ctx.beginPath(); ctx.moveTo(-w/2, y); ctx.lineTo(w/2, y); ctx.lineTo(0, y - 26*u); ctx.closePath(); ctx.fill();
    }
    // snow caps
    ctx.fillStyle = 'rgba(244,248,255,.9)';
    ctx.beginPath(); ctx.moveTo(-8*u, -52*u); ctx.lineTo(8*u, -52*u); ctx.lineTo(0, -66*u); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function frame(){
    t++;
    scroll += speed * devicePixelRatio;
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shakeI > .5){
      ctx.translate((Math.random()-.5)*shakeI*devicePixelRatio, (Math.random()-.5)*shakeI*devicePixelRatio);
      shakeI *= .88;
    } else shakeI = 0;

    // sky handled by CSS body gradient behind transparent canvas? Canvas covers it,
    // so paint the dusk gradient here.
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#232A5C'); sky.addColorStop(.55,'#5D7BC4'); sky.addColorStop(1,'#F2C4CE');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);

    // moon
    ctx.fillStyle = 'rgba(255,246,220,.9)';
    ctx.beginPath(); ctx.arc(W*.82, H*.16, Math.min(W,H)*.045, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(93,123,196,.5)';
    ctx.beginPath(); ctx.arc(W*.82 + Math.min(W,H)*.018, H*.155, Math.min(W,H)*.038, 0, 7); ctx.fill();

    // far peaks (slow parallax)
    ctx.fillStyle = '#8FA6DC';
    farPeaks.forEach(p => {
      const x = ((p.x - scroll*.15) % (W + 600) + W + 600) % (W + 600) - 300;
      ctx.beginPath(); ctx.moveTo(x - p.w/2, H*.66); ctx.lineTo(x, H*.66 - p.h); ctx.lineTo(x + p.w/2, H*.66); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(244,248,255,.85)';
      ctx.beginPath(); ctx.moveTo(x - p.w*.14, H*.66 - p.h*.72); ctx.lineTo(x, H*.66 - p.h); ctx.lineTo(x + p.w*.14, H*.66 - p.h*.72); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8FA6DC';
    });

    // mid peaks
    ctx.fillStyle = '#6E86C8';
    midPeaks.forEach(p => {
      const x = ((p.x - scroll*.35) % (W + 600) + W + 600) % (W + 600) - 300;
      ctx.beginPath(); ctx.moveTo(x - p.w/2, H*.74); ctx.lineTo(x, H*.74 - p.h); ctx.lineTo(x + p.w/2, H*.74); ctx.closePath(); ctx.fill();
    });

    // snow ground
    ctx.fillStyle = '#F4F8FF';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for(let x = 0; x <= W; x += 24*devicePixelRatio) ctx.lineTo(x, terrainY(x));
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    // ground shading
    ctx.strokeStyle = 'rgba(201,216,240,.9)'; ctx.lineWidth = 5*devicePixelRatio;
    ctx.beginPath();
    for(let x = 0; x <= W; x += 24*devicePixelRatio){ const y = terrainY(x)+8*devicePixelRatio; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();

    // back trees (behind rider), front trees drawn after rider
    trees.forEach(tr => {
      if(tr.layer !== 0) return;
      const x = ((tr.x - scroll*.7) % (W + 400) + W + 400) % (W + 400) - 200;
      drawTree(x, terrainY(x)+4, tr.s*.8);
    });

    /* ---- rider physics ---- */
    const px = rider.x * W;
    const gy = terrainY(px) - 26*devicePixelRatio;

    if(rider.mode === 'ride'){
      rider.airY = 0; rider.rot = Math.sin((px + scroll*2)*.0016)*.12 + .06;
      rider.rotV = 0;
    } else if(rider.mode === 'air'){
      rider.vy += .5 * devicePixelRatio;
      rider.airY += rider.vy;
      rider.rot += rider.rotV;
      if(rider.airY >= 0){ rider.airY = 0; rider.mode = 'ride'; rider.rot = 0; spray(px, gy+20, 14); }
    } else if(rider.mode === 'tumble'){
      rider.tumbleT++;
      rider.rot += .3;
      rider.airY = Math.min(0, rider.airY + rider.vy); rider.vy += .6*devicePixelRatio;
      if(rider.tumbleT === 2) spray(px, gy+20, 26);
      if(rider.tumbleT > 46){ rider.mode = 'ride'; rider.rot = 0; rider.tumbleT = 0; }
    }

    drawRider(px, gy + rider.airY);

    // speed lines when fast / on fire
    if(speed > 5){
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2*devicePixelRatio;
      for(let i=0;i<5;i++){
        const y = gy - 40*devicePixelRatio + i*18*devicePixelRatio;
        const x = px - 60*devicePixelRatio - (t*13 + i*47) % (140*devicePixelRatio);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 30*devicePixelRatio, y); ctx.stroke();
      }
    }

    // front trees
    trees.forEach(tr => {
      if(tr.layer !== 1) return;
      const x = ((tr.x - scroll*1.15) % (W + 400) + W + 400) % (W + 400) - 200;
      drawTree(x, terrainY(x) + 26*devicePixelRatio, tr.s);
    });

    // snow spray particles
    for(let i = sprays.length-1; i >= 0; i--){
      const s = sprays[i];
      s.x += s.vx; s.y += s.vy; s.vy += .3*devicePixelRatio; s.life--;
      ctx.fillStyle = `rgba(255,255,255,${s.life/30})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      if(s.life <= 0) sprays.splice(i,1);
    }

    // confetti
    for(let i = confs.length-1; i >= 0; i--){
      const c = confs[i];
      c.x += c.vx; c.y += c.vy; c.vy += .18*devicePixelRatio; c.r += c.vr; c.life--;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
      ctx.fillStyle = c.col; ctx.globalAlpha = Math.min(1, c.life/25);
      ctx.fillRect(-c.s/2, -c.s/4, c.s, c.s/2);
      ctx.restore();
      if(c.life <= 0) confs.splice(i,1);
    }
    ctx.globalAlpha = 1;

    // flying coins (arc from rider to the coin pill)
    for(let i = fcoins.length-1; i >= 0; i--){
      const c = fcoins[i];
      c.p += c.v;
      const p = Math.min(1, c.p);
      const ease = p*p*(3-2*p);
      const x = c.x0 + (c.tx - c.x0)*ease + Math.sin(p*Math.PI)*c.arc;
      const y = c.y0 + (c.ty - c.y0)*ease - Math.sin(p*Math.PI)*80*devicePixelRatio;
      ctx.fillStyle = '#FFC63D';
      ctx.beginPath(); ctx.arc(x, y, 8*devicePixelRatio, 0, 7); ctx.fill();
      ctx.fillStyle = '#E8A02E';
      ctx.beginPath(); ctx.arc(x, y, 8*devicePixelRatio, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle='#B87A18'; ctx.stroke();
      ctx.fillStyle = '#B87A18'; ctx.font = `${9*devicePixelRatio}px Fredoka,sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★', x, y);
      if(p >= 1){ fcoins.splice(i,1); if(c.cb) c.cb(); }
    }

    // falling snow
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    flakes.forEach(f => {
      f.y += f.v*devicePixelRatio; f.x += Math.sin((t + f.y)*.01)*.6 - speed*.4;
      if(f.y > H) { f.y = -6; f.x = Math.random()*W; }
      if(f.x < 0) f.x += W;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
    });

    ctx.restore();
    requestAnimationFrame(frame);
  }

  function spray(x, y, n){
    for(let i=0;i<n;i++) sprays.push({
      x, y, vx: rnd(-4,4)*devicePixelRatio, vy: rnd(-6,-1)*devicePixelRatio,
      r: rnd(2,5)*devicePixelRatio, life: rnd(16,30),
    });
  }

  const CONF_COLS = ['#FF5D8F','#FFC63D','#7FE3C3','#6FD8F2','#8B5CF6','#FFFFFF'];
  function confetti(n, cx, cy){
    const x = (cx ?? .5) * W, y = (cy ?? .3) * H;
    for(let i=0;i<n;i++) confs.push({
      x, y, vx: rnd(-7,7)*devicePixelRatio, vy: rnd(-9,-2)*devicePixelRatio,
      r: rnd(0,6.28), vr: rnd(-.25,.25), s: rnd(6,13)*devicePixelRatio,
      col: CONF_COLS[Math.floor(Math.random()*CONF_COLS.length)], life: rnd(45,85),
    });
  }

  function coinBurst(n, cb){
    const px = rider.x * W, py = terrainY(px) - 60*devicePixelRatio;
    for(let i=0;i<n;i++) fcoins.push({
      x0: px + rnd(-30,30)*devicePixelRatio, y0: py + rnd(-20,20)*devicePixelRatio,
      tx: 210*devicePixelRatio, ty: 30*devicePixelRatio,
      arc: rnd(-60,60)*devicePixelRatio, p: -i*.09, v: .028 + Math.random()*.008, cb,
    });
  }

  function jump(spins){        // spins: 0 = ollie, 1 = 360, 2 = backflip 720
    rider.mode = 'air';
    rider.vy = -(11 + spins*2.5) * devicePixelRatio;
    rider.rotV = spins === 0 ? 0 : (spins === 1 ? .17 : .3) * (Math.random()<.5?-1:1);
    spray(rider.x*W, terrainY(rider.x*W), 10);
  }
  function tumble(){ rider.mode = 'tumble'; rider.vy = -4*devicePixelRatio; rider.tumbleT = 0; shakeI = 22; }
  function setFire(tier){ rider.fireTier = tier; }
  function setSpeed(v){ speed = v; }
  function shake(v){ shakeI = Math.max(shakeI, v); }

  resize(); requestAnimationFrame(frame);
  return { jump, tumble, setFire, setSpeed, shake, confetti, coinBurst };
})();
