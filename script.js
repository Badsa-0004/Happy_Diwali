const rand = (a,b) => a + Math.random()*(b-a);
const randInt = (a,b) => Math.floor(rand(a,b+1));
const TAU = Math.PI * 2;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let cw = 0, ch = 0, DPR = Math.max(1, window.devicePixelRatio || 1);

function resize(){
  DPR = Math.max(1, window.devicePixelRatio || 1);
  cw = window.innerWidth;
  ch = window.innerHeight;
  canvas.width = Math.floor(cw * DPR);
  canvas.height = Math.floor(ch * DPR);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// Firework sound
const fireworkSound = new Audio('624414__milankovanda__firework-single-shot-2.wav');
fireworkSound.volume = 0.3;

const gravity = 0.05;
const airFriction = 0.995;
const sparkFriction = 0.985;
const particleCount = 180;
const backgroundDensity = 0.006;
const maxBackgroundParticles = 5;

class Rocket {
  constructor(x,y,tx,ty,color, isCentral=false){
    this.x = x; this.y = y;
    const angle = Math.atan2(ty - y, tx - x);
    const speed = rand(5.5, 8.5);
    this.vx = Math.cos(angle) * speed + rand(-0.5, 0.5);
    this.vy = Math.sin(angle) * speed + rand(-1, 1);
    this.tx = tx; this.ty = ty;
    this.color = color;
    this.trail = [];
    this.isCentral = isCentral;
    this.exploded = false;
    this.life = 0;
  }
  update(){
    this.life++;
    this.trail.push({x:this.x, y:this.y, life: 8});
    if (this.trail.length > 12) this.trail.shift();
    this.vy += gravity * 0.05;
    this.vx *= 0.999; this.vy *= 0.999;
    this.x += this.vx; this.y += this.vy;
    const dx = this.tx - this.x, dy = this.ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 18 || this.life > 120 || this.vy > 3.5) {
      this.exploded = true;
      explode(this.x, this.y, this.color, this.isCentral ? 'big': 'normal');
      if (this.isCentral) {
        setTimeout(() => revealTitle(this.color), 40);
      }
    }
  }
  draw(ctx){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
    grad.addColorStop(0, `rgba(255,255,255,0.9)`);
    grad.addColorStop(0.2, this.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    for (let i = this.trail.length-1; i >= 0; i--){
      const t = this.trail[i];
      ctx.lineTo(t.x, t.y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.stroke();
  }
}

class Spark {
  constructor(x,y,color, speed, angle, life, size=2, flicker=true){
    this.x = x; this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size; this.alpha = 1;
    this.flicker = flicker; this.trail = [];
  }
  update(){
    this.trail.push({x:this.x, y:this.y, life: Math.max(4, Math.floor(this.maxLife/10))});
    if (this.trail.length > 10) this.trail.shift();
    this.vx *= sparkFriction; this.vy *= sparkFriction;
    this.vy += gravity; this.x += this.vx; this.y += this.vy;
    this.life--; this.alpha = Math.max(0, this.life / this.maxLife);
    if (this.flicker && Math.random() < 0.06) this.alpha *= rand(0.6,1.0);
  }
  draw(ctx){
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trail.length; i++){
      const t = this.trail[i];
      const f = i / this.trail.length;
      ctx.fillStyle = hexToRgba(this.color, (this.alpha * (1-f) * 0.5));
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(0.6, this.size * (1-f) * 0.8), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = hexToRgba(this.color, this.alpha);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function hexToRgba(hex, alpha=1){
  if (hex.startsWith('rgba') || hex.startsWith('rgb'))
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

let rockets = [], sparks = [];

function explode(x,y, baseColor, sizeMode='normal'){
  const color = baseColor || randomColor();

  // 🔊 Play sound
  fireworkSound.currentTime = 0;
  fireworkSound.play().catch(e => {});

  const count = (sizeMode === 'big') ? particleCount : randInt(30, 80);
  const spread = (sizeMode === 'big') ? rand(0.9, 1.2) : rand(0.6,1.0);
  const speedBase = (sizeMode === 'big') ? rand(3.4, 6.2) : rand(2.0, 4.6);
  for (let i = 0; i < count; i++){
    const angle = rand(0, TAU);
    const speed = Math.abs(randGaussian()*0.6 + 1) * speedBase * (0.6 + Math.random()*spread);
    const life = randInt(40, 110) * (sizeMode === 'big' ? 1.2 : 1.0);
    const size = (sizeMode === 'big') ? rand(1.6, 3.2) : rand(0.9, 2.2);
    const col = shadeColor(color, rand(-40, 40));
    sparks.push(new Spark(x, y, col, speed, angle, life, size, true));
  }
  if (sizeMode === 'big') {
    setTimeout(() => {
      const secCount = randInt(10, 22);
      for (let j = 0; j < secCount; j++){
        const ang = rand(0, TAU);
        const sp = rand(1.2,3.0);
        sparks.push(new Spark(x + rand(-10,10), y + rand(-10,10), randomColor(), sp, ang, randInt(30,70), rand(0.8,1.8), true));
      }
    }, randInt(150, 350));
  }
}

function spawnBackgroundFirework(){
  const margin = 60;
  const tx = rand(margin, cw - margin);
  const ty = rand(60, ch * 0.5);
  const sx = rand(40, cw - 40);
  const sy = ch + 10;
  rockets.push(new Rocket(sx, sy, tx, ty, randomColor(), false));
}

function randomColor(){
  const palettes = ['#ffd166','#ef476f','#06d6a0','#118ab2','#ffd43b','#f72585','#ffa69e','#9b5de5','#00b4d8'];
  return palettes[randInt(0, palettes.length - 1)];
}

function randGaussian(){
  let u=0,v=0;
  while(u===0)u=Math.random(); while(v===0)v=Math.random();
  return Math.sqrt(-2.0*Math.log(u))*Math.cos(2.0*Math.PI*v);
}

function shadeColor(hex, percent) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(h=>h+h).join('');
  const r = parseInt(hex.substring(0,2),16);
  const g = parseInt(hex.substring(2,4),16);
  const b = parseInt(hex.substring(4,6),16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = Math.round((t - r) * p) + r;
  const G = Math.round((t - g) * p) + g;
  const B = Math.round((t - b) * p) + b;
  return `#${(R<<16 | G<<8 | B).toString(16).padStart(6,'0')}`;
}

let lastTime = 0;
function loop(t){
  requestAnimationFrame(loop);
  const dt = t - lastTime; lastTime = t;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0,0,cw,ch);
  drawStars();
  for (let i = rockets.length - 1; i >= 0; i--){
    const r = rockets[i]; r.update(); r.draw(ctx);
    if (r.exploded) rockets.splice(i,1);
  }
  for (let i = sparks.length - 1; i >= 0; i--){
    const p = sparks[i]; p.update(); p.draw(ctx);
    if (p.life <= 0 || p.alpha <= 0.02 || p.y > ch + 50) sparks.splice(i,1);
  }
  if (Math.random() < backgroundDensity) {
    const spawnCount = randInt(1, Math.min(maxBackgroundParticles, 3));
    for (let i = 0; i < spawnCount; i++) spawnBackgroundFirework();
  }
}

let starPositions = [];
function buildStars(){
  starPositions = [];
  const count = Math.floor((cw*ch) / 90000);
  for (let i=0;i<count;i++){
    starPositions.push({
      x: rand(0, cw),
      y: rand(0, ch * 0.6),
      r: rand(0.3, 1.6),
      alpha: rand(0.02, 0.14),
      flick: rand(0.001, 0.007),
      phase: Math.random()*1000
    });
  }
}
function drawStars(){
  if (!starPositions.length) buildStars();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let s of starPositions){
    s.phase += s.flick;
    const a = s.alpha + Math.sin(s.phase) * (s.alpha*0.6);
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0.01, Math.min(0.9, a))})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function launchCentral(){
  const centerX = cw / 2;
  const centerY = ch / 2 - 40;
  const startX = cw / 2 + rand(-120, 120);
  const startY = ch + 20;
  const color = randomColor();
  rockets.push(new Rocket(startX, startY, centerX, centerY, color, true));
}

function revealTitle(color) {
  const title = document.getElementById('title');
  const sub = document.getElementById('subtitle');
  
  title.style.setProperty('--glow-color', color);
  sub.style.setProperty('--glow-color', color);

  title.classList.add('reveal');
  setTimeout(() => sub.classList.add('reveal'), 3000);
}

canvas.addEventListener('pointerdown', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  rockets.push(new Rocket(rand(40, cw-40), ch + 10, x, y, randomColor(), false));
});

requestAnimationFrame(loop);
window.addEventListener('resize', () => { resize(); buildStars(); });
launchCentral();
setInterval(() => { if (Math.random() < 0.8) spawnBackgroundFirework(); }, 900 + Math.random()*800);
for (let i=0;i<3;i++) spawnBackgroundFirework();
