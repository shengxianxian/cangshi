(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: document.getElementById('score'), combo: document.getElementById('combo'), time: document.getElementById('time'),
    overdriveBar: document.getElementById('overdriveBar'), overdriveText: document.getElementById('overdriveText'),
    comboFlare: document.getElementById('comboFlare'), toast: document.getElementById('toast'), round: document.getElementById('round'),
    startOverlay: document.getElementById('startOverlay'), gameOverOverlay: document.getElementById('gameOverOverlay'),
    finalScore: document.getElementById('finalScore'), bestCombo: document.getElementById('bestCombo'), peakWave: document.getElementById('peakWave'),
    timeBlock: document.querySelector('.time-block'), soundState: document.getElementById('soundState')
  };
  const colors = { cyan: '#5df4ff', pink: '#ff4f9a', lime: '#c8ff54', orange: '#ffad4d', white: '#f6f7ff' };
  let W = 0, H = 0, dpr = 1, last = 0, audioOn = true, audioCtx = null;
  let running = false, elapsed = 0, score = 0, combo = 1, bestCombo = 1, wave = 1, lives = 3, overdrive = 0, overdriveActive = 0;
  let spawnClock = 0, glitchClock = 0, shake = 0, pointer = { x: 0, y: 0, active: false };
  const keys = new Set(), sparks = [], glitches = [], particles = [], stars = [];
  const player = { x: 0, y: 0, vx: 0, vy: 0, r: 14, dash: 0, hit: 0 };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a, b) => Math.random() * (b - a) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!running) { player.x = W / 2; player.y = H * .57; } }
  window.addEventListener('resize', resize); resize();
  for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), r: rand(.3, 1.6), a: rand(.15, .7), phase: rand(0, 7) });

  function beep(freq = 440, duration = .07, type = 'sine', volume = .03) {
    if (!audioOn) return;
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(volume, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); } catch (_) {}
  }
  function burst(x, y, color, count = 12, power = 1) { for (let i = 0; i < count; i++) { const a = Math.random() * Math.PI * 2, s = rand(30, 170) * power; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.4, .85), max: .8, color, r: rand(1, 3.5) }); } }
  function showToast(text, color = colors.lime) { ui.toast.textContent = text; ui.toast.style.color = color; ui.toast.classList.remove('show'); void ui.toast.offsetWidth; ui.toast.classList.add('show'); }
  function resetGame() {
    running = true; elapsed = 0; score = 0; combo = 1; bestCombo = 1; wave = 1; lives = 3; overdrive = 0; overdriveActive = 0; spawnClock = .2; glitchClock = 1.4; sparks.length = 0; glitches.length = 0; particles.length = 0; player.x = W / 2; player.y = H * .57; player.vx = 0; player.vy = 0; player.dash = 0; player.hit = 0; ui.round.textContent = '01'; ui.startOverlay.classList.remove('active'); ui.gameOverOverlay.classList.remove('active'); updateUI(); beep(220, .1, 'square', .04); setTimeout(() => beep(440, .15, 'sine', .04), 100); last = performance.now(); requestAnimationFrame(loop);
  }
  function endGame() { running = false; ui.finalScore.textContent = String(score).padStart(6, '0'); ui.bestCombo.textContent = `x${bestCombo}`; ui.peakWave.textContent = String(wave).padStart(2, '0'); ui.gameOverOverlay.classList.add('active'); beep(130, .35, 'sawtooth', .05); }
  function updateUI() { ui.score.textContent = String(Math.max(0, score)).padStart(6, '0'); ui.combo.textContent = `x${combo}`; ui.time.textContent = Math.max(0, 45 - elapsed).toFixed(1); ui.overdriveBar.style.width = `${overdrive}%`; ui.overdriveText.textContent = overdriveActive > 0 ? `ACTIVE ${overdriveActive.toFixed(1)}` : overdrive >= 100 ? 'PRESS E TO TRIGGER' : `READY IN ${Math.ceil(100 - overdrive)}`; ui.timeBlock.classList.toggle('urgent', elapsed > 36); }
  function spawnSpark() { const type = Math.random() < .12 ? 'gold' : Math.random() < .28 ? 'pink' : 'cyan'; const margin = 55; sparks.push({ x: rand(margin, W - margin), y: rand(130, H - 105), r: type === 'gold' ? 11 : 8, type, life: 7, phase: rand(0, 6) }); }
  function spawnGlitch() { const edge = Math.floor(rand(0, 4)); const p = { x: edge < 2 ? rand(20, W - 20) : edge === 2 ? -20 : W + 20, y: edge < 2 ? edge === 0 ? -20 : H + 20 : rand(120, H - 90), r: rand(10, 16), speed: rand(36, 65) + wave * 3, phase: rand(0, 4) }; glitches.push(p); }
  function collect(s, i) { const value = s.type === 'gold' ? 80 : s.type === 'pink' ? 30 : 10; const gain = value * combo * (overdriveActive > 0 ? 2 : 1); score += gain; combo = clamp(combo + (s.type === 'gold' ? 2 : 1), 1, 99); bestCombo = Math.max(bestCombo, combo); overdrive = clamp(overdrive + (s.type === 'gold' ? 22 : 8), 0, 100); burst(s.x, s.y, s.type === 'gold' ? colors.orange : s.type === 'pink' ? colors.pink : colors.cyan, s.type === 'gold' ? 25 : 12, 1); sparks.splice(i, 1); ui.comboFlare.classList.remove('flash'); void ui.comboFlare.offsetWidth; ui.comboFlare.classList.add('flash'); showToast(s.type === 'gold' ? 'GOLD PULSE +' + gain : '+' + gain, s.type === 'pink' ? colors.pink : s.type === 'gold' ? colors.orange : colors.lime); beep(s.type === 'gold' ? 780 : 440 + combo * 8, .08, 'triangle', .025); }
  function damage(g) { if (player.hit > 0 || player.dash > 0 || overdriveActive > 0) return; lives--; combo = 1; overdrive = Math.max(0, overdrive - 24); player.hit = 1.25; shake = 12; burst(player.x, player.y, colors.pink, 22, 1.3); showToast(lives > 0 ? `${lives} CORE${lives === 1 ? '' : 'S'} LEFT` : 'SYSTEM CRITICAL', colors.pink); beep(100, .2, 'sawtooth', .05); if (lives <= 0) endGame(); }
  function activateOverdrive() { if (overdrive < 100 || overdriveActive > 0) return; overdriveActive = 6; overdrive = 0; showToast('OVERDRIVE', colors.lime); beep(880, .2, 'square', .05); for (let i = glitches.length - 1; i >= 0; i--) { burst(glitches[i].x, glitches[i].y, colors.lime, 15, 1); score += 25; glitches.splice(i, 1); } }
  function update(dt) {
    elapsed += dt; wave = 1 + Math.floor(elapsed / 9); if (elapsed >= 45) { endGame(); return; } overdriveActive = Math.max(0, overdriveActive - dt); player.hit = Math.max(0, player.hit - dt); player.dash = Math.max(0, player.dash - dt); shake = Math.max(0, shake - dt * 28);
    const ax = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0), ay = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    const speed = player.dash > 0 ? 740 : overdriveActive > 0 ? 420 : 310; if (ax || ay) { const len = Math.hypot(ax, ay) || 1; player.vx += ax / len * speed * dt * 5; player.vy += ay / len * speed * dt * 5; } else if (pointer.active && innerWidth > 700) { player.vx += (pointer.x - player.x) * dt * 5; player.vy += (pointer.y - player.y) * dt * 5; }
    player.vx *= Math.pow(.0008, dt); player.vy *= Math.pow(.0008, dt); const max = speed; const m = Math.hypot(player.vx, player.vy); if (m > max) { player.vx = player.vx / m * max; player.vy = player.vy / m * max; } player.x = clamp(player.x + player.vx * dt, 25, W - 25); player.y = clamp(player.y + player.vy * dt, 115, H - 65);
    spawnClock -= dt; glitchClock -= dt; if (spawnClock <= 0) { spawnSpark(); spawnClock = Math.max(.28, .78 - wave * .055); } if (glitchClock <= 0) { spawnGlitch(); glitchClock = Math.max(.42, 1.9 - wave * .16); }
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; s.phase += dt * 3; if (s.life <= 0) { sparks.splice(i, 1); continue; } if (Math.hypot(s.x - player.x, s.y - player.y) < s.r + player.r + 5) collect(s, i); }
    for (let i = glitches.length - 1; i >= 0; i--) { const g = glitches[i]; g.phase += dt * 3; const dx = player.x - g.x, dy = player.y - g.y, d = Math.hypot(dx, dy) || 1; g.x += dx / d * g.speed * dt; g.y += dy / d * g.speed * dt; if (d < g.r + player.r + 4) { damage(g); glitches.splice(i, 1); } }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; if (p.life <= 0) particles.splice(i, 1); }
    updateUI();
  }
  function draw() { ctx.clearRect(0, 0, W, H); ctx.save(); if (shake) ctx.translate(rand(-shake, shake), rand(-shake, shake)); const t = performance.now() / 1000;
    const grd = ctx.createRadialGradient(W * .5, H * .55, 0, W * .5, H * .55, Math.max(W, H) * .7); grd.addColorStop(0, '#11172d'); grd.addColorStop(1, '#070a14'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(133, 158, 235, .07)'; ctx.lineWidth = 1; const gap = 54; for (let x = (W % gap) / 2; x < W; x += gap) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += gap) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const s of stars) { ctx.globalAlpha = s.a * (.65 + Math.sin(t * 1.5 + s.phase) * .35); ctx.fillStyle = colors.white; ctx.fillRect(s.x * W, s.y * H, s.r, s.r); } ctx.globalAlpha = 1;
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); } ctx.shadowBlur = 0;
    for (const s of sparks) { const c = s.type === 'gold' ? colors.orange : s.type === 'pink' ? colors.pink : colors.cyan; const pulse = 1 + Math.sin(s.phase) * .14; ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * .8 + s.phase); ctx.scale(pulse, pulse); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.shadowColor = c; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(0, -s.r); ctx.lineTo(s.r, 0); ctx.lineTo(0, s.r); ctx.lineTo(-s.r, 0); ctx.closePath(); ctx.stroke(); ctx.fillStyle = c; ctx.globalAlpha = .32; ctx.fill(); ctx.restore(); }
    for (const g of glitches) { const c = colors.pink; ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.phase); ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 18; ctx.lineWidth = 2; ctx.globalAlpha = .82; ctx.beginPath(); ctx.moveTo(-g.r, -g.r * .65); ctx.lineTo(g.r, -g.r * .65); ctx.lineTo(g.r * .65, g.r); ctx.lineTo(-g.r * .65, g.r); ctx.closePath(); ctx.stroke(); ctx.globalAlpha = .16; ctx.fillStyle = c; ctx.fill(); ctx.restore(); }
    if (running) { const c = overdriveActive > 0 ? colors.lime : colors.cyan; ctx.save(); ctx.translate(player.x, player.y); if (player.hit > 0 && Math.floor(player.hit * 12) % 2 === 0) ctx.globalAlpha = .25; ctx.rotate(t * 1.8); ctx.strokeStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 25; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -player.r - 4); ctx.lineTo(player.r + 4, 0); ctx.lineTo(0, player.r + 4); ctx.lineTo(-player.r - 4, 0); ctx.closePath(); ctx.stroke(); ctx.fillStyle = c; ctx.globalAlpha = .14; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, player.r * .42, 0, Math.PI * 2); ctx.fillStyle = colors.white; ctx.globalAlpha = .86; ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  function loop(now) { if (!running) { draw(); return; } const dt = Math.min(.034, (now - last) / 1000 || .016); last = now; update(dt); draw(); if (running) requestAnimationFrame(loop); }
  function dash() { if (!running || player.dash > 0) return; const dx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0), dy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0); const angle = dx || dy ? Math.atan2(dy, dx) : Math.atan2(player.vy, player.vx || 1); player.vx = Math.cos(angle) * 680; player.vy = Math.sin(angle) * 680; player.dash = .28; burst(player.x, player.y, colors.cyan, 16, .7); beep(640, .07, 'square', .03); }
  function keyDown(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','e','r','Enter'].includes(k)) e.preventDefault(); keys.add(k); if (k === ' ') dash(); if (k === 'e') activateOverdrive(); if (k === 'Enter' && !running) resetGame(); if (k === 'r') resetGame(); }
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }); canvas.addEventListener('pointerdown', () => { if (running && innerWidth <= 700) dash(); });
  document.querySelectorAll('[data-key]').forEach(btn => { const key = btn.dataset.key; const on = e => { e.preventDefault(); keys.add(key); }; const off = e => { e.preventDefault(); keys.delete(key); }; btn.addEventListener('pointerdown', on); btn.addEventListener('pointerup', off); btn.addEventListener('pointercancel', off); btn.addEventListener('pointerleave', off); });
  document.getElementById('dashButton').addEventListener('pointerdown', e => { e.preventDefault(); dash(); }); document.getElementById('startButton').addEventListener('click', resetGame); document.getElementById('restartButton').addEventListener('click', resetGame);
  document.getElementById('soundToggle').addEventListener('click', () => { audioOn = !audioOn; ui.soundState.textContent = audioOn ? 'ON' : 'OFF'; });
  draw();
})();
