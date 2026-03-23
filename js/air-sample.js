/* ============================================================
   "What You're Actually Breathing" — Air Sample Jar
   Three-mode particle / gas visualizer
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('airSampleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ---- State ---- */
  let mode = 'dust';           // dust | mold | voc
  let particles = [];
  let vocWisps = [];
  let width, height;
  let animId;
  let moldSlider = 0.3;       // 0-1, default 30% mold-bound
  let vocSources = { candle: true, carpet: true, cleaning: false, paint: false };

  /* ---- Jar geometry (computed on resize) ---- */
  let jar = {};

  function computeJar() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Jar shape: centered, tall oval/rectangle with rounded ends
    const jw = Math.min(width * 0.60, 320);
    const jh = height * 0.78;
    jar = {
      cx: width / 2,
      cy: height / 2 + 10,
      w: jw,
      h: jh,
      top: height / 2 + 10 - jh / 2,
      bot: height / 2 + 10 + jh / 2,
      left: width / 2 - jw / 2,
      right: width / 2 + jw / 2,
      r: jw / 2   // corner radius for clipping
    };
  }

  /* ---- Particle class ---- */
  class Particle {
    constructor(opts) {
      this.x = opts.x || jar.left + Math.random() * jar.w;
      this.y = opts.y || jar.top + Math.random() * jar.h;
      this.size = opts.size || 1.5 + Math.random() * 2.5;
      this.vx = opts.vx || (Math.random() - 0.5) * 0.4;
      this.vy = opts.vy || (Math.random() - 0.5) * 0.25 - 0.1; // slight upward drift
      this.color = opts.color || 'rgba(160,140,120,0.6)';
      this.glowing = opts.glowing || false;
      this.glowColor = opts.glowColor || 'rgba(0,230,180,0.8)';
      this.shape = opts.shape || 'circle'; // circle | fiber | flake
      this.angle = Math.random() * Math.PI * 2;
      this.rotSpeed = (Math.random() - 0.5) * 0.02;
      this.life = 1;
      this.drift = Math.random() * Math.PI * 2; // for sine wave drift
    }

    update(dt) {
      this.drift += 0.008;
      this.x += this.vx + Math.sin(this.drift) * 0.15;
      this.y += this.vy + Math.cos(this.drift * 0.7) * 0.08;
      this.angle += this.rotSpeed;

      // Bounce inside jar
      const margin = this.size + 4;
      if (this.x < jar.left + margin) { this.x = jar.left + margin; this.vx *= -0.5; }
      if (this.x > jar.right - margin) { this.x = jar.right - margin; this.vx *= -0.5; }
      if (this.y < jar.top + margin) { this.y = jar.top + margin; this.vy *= -0.5; }
      if (this.y > jar.bot - margin) { this.y = jar.bot - margin; this.vy *= -0.5; }

      // Gentle settling for dust (gravity)
      this.vy += 0.003;
      // Air current pushes back up occasionally
      if (this.y > jar.bot - jar.h * 0.3) {
        this.vy -= 0.006;
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      if (this.glowing) {
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 12;
      }

      ctx.fillStyle = this.glowing ? this.glowColor : this.color;

      if (this.shape === 'fiber') {
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size * 2.5, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.shape === 'flake') {
        ctx.beginPath();
        const s = this.size;
        ctx.moveTo(-s, -s * 0.5);
        ctx.lineTo(0, -s);
        ctx.lineTo(s, -s * 0.5);
        ctx.lineTo(s, s * 0.5);
        ctx.lineTo(0, s);
        ctx.lineTo(-s, s * 0.5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  /* ---- VOC Wisp class ---- */
  class Wisp {
    constructor(opts) {
      this.x = opts.x;
      this.y = opts.y;
      this.color = opts.color;
      this.size = 20 + Math.random() * 40;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -0.3 - Math.random() * 0.6;
      this.life = 1.0;
      this.decay = 0.002 + Math.random() * 0.003;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.02 + Math.random() * 0.02;
    }

    update() {
      this.wobble += this.wobbleSpeed;
      this.x += this.vx + Math.sin(this.wobble) * 0.5;
      this.y += this.vy;
      this.size += 0.3;
      this.life -= this.decay;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
      const alpha = this.life * 0.25;
      gradient.addColorStop(0, this.color.replace('ALPHA', (alpha).toFixed(3)));
      gradient.addColorStop(0.5, this.color.replace('ALPHA', (alpha * 0.5).toFixed(3)));
      gradient.addColorStop(1, this.color.replace('ALPHA', '0'));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---- Initialization per mode ---- */
  function initDust() {
    particles = [];
    const count = Math.floor((jar.w * jar.h) / 600);
    const shapes = ['circle', 'fiber', 'flake'];
    for (let i = 0; i < count; i++) {
      particles.push(new Particle({
        shape: shapes[Math.floor(Math.random() * 3)],
        color: `rgba(${140 + Math.floor(Math.random()*40)},${120 + Math.floor(Math.random()*30)},${100 + Math.floor(Math.random()*30)},${0.4 + Math.random()*0.3})`,
        size: 1 + Math.random() * 3
      }));
    }
  }

  function initMold() {
    particles = [];
    const count = Math.floor((jar.w * jar.h) / 500);
    const shapes = ['circle', 'fiber', 'flake'];
    for (let i = 0; i < count; i++) {
      const isMoldy = Math.random() < moldSlider;
      particles.push(new Particle({
        shape: shapes[Math.floor(Math.random() * 3)],
        color: `rgba(${140 + Math.floor(Math.random()*40)},${120 + Math.floor(Math.random()*30)},${100 + Math.floor(Math.random()*30)},${0.4 + Math.random()*0.3})`,
        size: 1 + Math.random() * 3,
        glowing: isMoldy,
        glowColor: `rgba(${Math.floor(Math.random()*40)},${200 + Math.floor(Math.random()*55)},${140 + Math.floor(Math.random()*60)},${0.65 + Math.random()*0.2})`
      }));
    }
  }

  function initVOC() {
    particles = [];
    vocWisps = [];
  }

  /* ---- VOC source configs ---- */
  const vocConfig = {
    candle: {
      color: 'rgba(255,180,60,ALPHA)',
      xRange: [0.35, 0.45],
      yStart: 0.85
    },
    carpet: {
      color: 'rgba(160,120,200,ALPHA)',
      xRange: [0.15, 0.85],
      yStart: 0.95
    },
    cleaning: {
      color: 'rgba(60,200,180,ALPHA)',
      xRange: [0.60, 0.75],
      yStart: 0.80
    },
    paint: {
      color: 'rgba(180,200,50,ALPHA)',
      xRange: [0.20, 0.35],
      yStart: 0.70
    }
  };

  function spawnVOCWisps() {
    for (const [key, cfg] of Object.entries(vocConfig)) {
      if (!vocSources[key]) continue;
      if (Math.random() > 0.12) continue; // throttle spawn rate
      const xMin = jar.left + jar.w * cfg.xRange[0];
      const xMax = jar.left + jar.w * cfg.xRange[1];
      vocWisps.push(new Wisp({
        x: xMin + Math.random() * (xMax - xMin),
        y: jar.top + jar.h * cfg.yStart,
        color: cfg.color
      }));
    }
    // Cull dead wisps
    vocWisps = vocWisps.filter(w => w.life > 0 && w.y > jar.top - 20);
  }

  /* ---- Draw jar container ---- */
  function drawJar() {
    const { left, top, w, h, r } = jar;

    // Jar body clipping path (rounded rect)
    ctx.save();

    // Glass body fill
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, r * 0.3);
    ctx.fillStyle = 'rgba(220,240,255,0.06)';
    ctx.fill();

    // Glass border
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, r * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left highlight edge (light catch)
    ctx.beginPath();
    ctx.moveTo(left + 1, top + r * 0.3);
    ctx.lineTo(left + 1, top + h - r * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Top highlight
    ctx.beginPath();
    ctx.moveTo(left + r * 0.3, top + 1);
    ctx.lineTo(left + w - r * 0.3, top + 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specular shine streak
    ctx.beginPath();
    const shineX = left + w * 0.28;
    const grad = ctx.createLinearGradient(shineX, top, shineX, top + h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
    grad.addColorStop(0.8, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(shineX - 8, top + 10, 16, h - 20);

    // Neck / lid
    const neckW = w * 0.35;
    const neckH = 14;
    const neckL = left + (w - neckW) / 2;
    const neckT = top - neckH;
    ctx.beginPath();
    ctx.roundRect(neckL, neckT, neckW, neckH + 4, [6, 6, 0, 0]);
    ctx.fillStyle = 'rgba(200,215,230,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Lid cap
    const capW = neckW + 12;
    const capH = 8;
    const capL = left + (w - capW) / 2;
    ctx.beginPath();
    ctx.roundRect(capL, neckT - capH + 2, capW, capH, [4, 4, 0, 0]);
    ctx.fillStyle = 'rgba(180,200,220,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bottom glass thickness (subtle)
    ctx.beginPath();
    ctx.roundRect(left + 2, top + h - 6, w - 4, 8, [0, 0, r * 0.3, r * 0.3]);
    ctx.fillStyle = 'rgba(180,210,235,0.15)';
    ctx.fill();

    ctx.restore();
  }

  /* ---- Clip to jar interior ---- */
  function clipToJar() {
    ctx.beginPath();
    ctx.roundRect(jar.left + 3, jar.top + 3, jar.w - 6, jar.h - 6, jar.r * 0.3 - 2);
    ctx.clip();
  }

  /* ---- VOC source icons at bottom of jar ---- */
  function drawVOCSources() {
    const iconY = jar.bot - 20;
    const sources = [
      { key: 'candle', label: 'Candles', color: '#FFB43C', x: 0.25 },
      { key: 'carpet', label: 'Carpet', color: '#A078C8', x: 0.42 },
      { key: 'cleaning', label: 'Cleaners', color: '#3CC8B4', x: 0.58 },
      { key: 'paint', label: 'Paint', color: '#B4C832', x: 0.75 }
    ];

    sources.forEach(s => {
      const x = jar.left + jar.w * s.x;
      const active = vocSources[s.key];
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.3;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, iconY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, x, iconY + 18);
      ctx.restore();
    });
  }

  /* ---- Main draw loop ---- */
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw jar behind particles
    drawJar();

    // Clip particles to jar interior
    ctx.save();
    clipToJar();

    if (mode === 'dust' || mode === 'mold') {
      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });
    }

    if (mode === 'voc') {
      spawnVOCWisps();
      vocWisps.forEach(w => {
        w.update();
        w.draw(ctx);
      });
      drawVOCSources();
    }

    ctx.restore(); // un-clip

    animId = requestAnimationFrame(draw);
  }

  /* ---- Mode switching ---- */
  function setMode(newMode) {
    mode = newMode;
    switch (mode) {
      case 'dust': initDust(); break;
      case 'mold': initMold(); break;
      case 'voc': initVOC(); break;
    }

    // Update tabs
    document.querySelectorAll('.air-sample__tab').forEach(t => {
      t.classList.toggle('air-sample__tab--active', t.dataset.mode === mode);
    });

    // Update info panels
    document.querySelectorAll('.air-sample__info').forEach(p => {
      p.classList.toggle('air-sample__info--active', p.dataset.mode === mode);
    });

    // Show/hide slider
    const sliderWrap = document.getElementById('moldSliderWrap');
    if (sliderWrap) sliderWrap.style.display = mode === 'mold' ? 'flex' : 'none';

    // Show/hide VOC toggles
    const vocToggles = document.getElementById('vocToggles');
    if (vocToggles) vocToggles.style.display = mode === 'voc' ? 'flex' : 'none';
  }

  /* ---- Mold slider ---- */
  function setupMoldSlider() {
    const slider = document.getElementById('moldSlider');
    const label = document.getElementById('moldSliderLabel');
    if (!slider) return;
    slider.addEventListener('input', () => {
      moldSlider = parseFloat(slider.value);
      const pct = Math.round(moldSlider * 100);
      if (label) {
        if (pct < 20) label.textContent = 'Clean Home';
        else if (pct < 50) label.textContent = 'Moderate Mold';
        else if (pct < 75) label.textContent = 'High Mold';
        else label.textContent = 'Severely Affected';
      }
      initMold();
    });
  }

  /* ---- VOC toggles ---- */
  function setupVOCToggles() {
    document.querySelectorAll('.voc-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.source;
        vocSources[key] = !vocSources[key];
        btn.classList.toggle('voc-toggle--active', vocSources[key]);
      });
    });
  }

  /* ---- Init ---- */
  function init() {
    computeJar();
    initDust();

    // Tab clicks
    document.querySelectorAll('.air-sample__tab').forEach(tab => {
      tab.addEventListener('click', () => setMode(tab.dataset.mode));
    });

    setupMoldSlider();
    setupVOCToggles();

    draw();
  }

  /* ---- Resize handling ---- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      computeJar();
      // Re-init particles for new size
      setMode(mode);
    }, 200);
  });

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
