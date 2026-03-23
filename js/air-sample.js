/* ============================================================
   "What You're Actually Breathing" — Air Sample Jar
   Three-scene swipeable visual: Dust → Mold Binding → VOCs
   Realistic glass jar with Tyndall beam, carousel navigation
   ============================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('airSampleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const wrap = canvas.parentElement;

  /* ---- State ---- */
  let scene = 0;
  const SCENES = 3;
  let W, H, dpr;
  let jar = {};
  let particles = [];
  let spores = [];
  let wisps = [];
  let moldTimer = 0;
  let animId;

  /* ===================== RESIZE ===================== */
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var rect = wrap.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    computeJar();
    initScene(scene);
  }

  function computeJar() {
    var maxW = 300;
    var jw = Math.min(W * 0.48, maxW);
    var jh = H * 0.78;
    var cx = W / 2;
    var cy = H / 2 + 8;

    var bodyW = jw;
    var bodyH = jh * 0.80;
    var neckW = bodyW * 0.42;
    var neckH = jh * 0.10;
    var shoulderH = bodyW * 0.22;
    var capH = jh * 0.06;

    var totalH = bodyH + neckH + capH;
    var top = cy - totalH / 2;

    jar = {
      cx: cx,
      capTop: top,
      capH: capH,
      capW: neckW + 14,
      neckTop: top + capH,
      neckH: neckH,
      neckW: neckW,
      bodyTop: top + capH + neckH,
      bodyH: bodyH,
      bodyW: bodyW,
      shoulderH: shoulderH,
      left: cx - bodyW / 2,
      right: cx + bodyW / 2,
      bot: top + capH + neckH + bodyH,
      innerLeft: cx - bodyW / 2 + 6,
      innerRight: cx + bodyW / 2 - 6,
      innerTop: top + capH + 4,
      innerBot: top + capH + neckH + bodyH - 6
    };
  }

  /* ===================== JAR PATH ===================== */
  function traceJar(inset) {
    var j = jar;
    var i = inset || 0;

    var bL = j.left + i;
    var bR = j.right - i;
    var bT = j.bodyTop + i;
    var bB = j.bot - i;
    var bW = bR - bL;

    var nL = j.cx - j.neckW / 2 + i;
    var nR = j.cx + j.neckW / 2 - i;
    var nT = j.neckTop + i;

    var sH = j.shoulderH;
    var cR = Math.max(bW * 0.06, 4);

    ctx.beginPath();
    // Bottom-left corner
    ctx.moveTo(bL, bB - cR);
    ctx.quadraticCurveTo(bL, bB, bL + cR, bB);
    // Bottom edge
    ctx.lineTo(bR - cR, bB);
    // Bottom-right corner
    ctx.quadraticCurveTo(bR, bB, bR, bB - cR);
    // Right side up to shoulder
    ctx.lineTo(bR, bT + sH);
    // Right shoulder → neck
    ctx.bezierCurveTo(
      bR, bT + sH * 0.25,
      nR + (bR - nR) * 0.35, bT,
      nR, bT
    );
    // Right neck up
    ctx.lineTo(nR, nT);
    // Across neck top
    ctx.lineTo(nL, nT);
    // Left neck down
    ctx.lineTo(nL, bT);
    // Left shoulder
    ctx.bezierCurveTo(
      nL - (nL - bL) * 0.35, bT,
      bL, bT + sH * 0.25,
      bL, bT + sH
    );
    // Left side down (closePath handles this)
    ctx.closePath();
  }

  /* ===================== DRAW JAR ===================== */
  function drawJar() {
    var j = jar;

    // 1. Interior fill
    ctx.save();
    traceJar(3);
    ctx.fillStyle = 'rgba(180,225,245,0.035)';
    ctx.fill();
    ctx.restore();

    // 2. Tyndall beam (dust/mold scenes)
    if (scene !== 2) {
      ctx.save();
      traceJar(5);
      ctx.clip();

      var beamCX = j.cx + j.bodyW * 0.08;
      var beamAngle = -0.25;
      var beamW = j.bodyW * 0.42;

      ctx.translate(beamCX, j.neckTop);
      ctx.rotate(beamAngle);

      var bGrad = ctx.createLinearGradient(-beamW / 2, 0, beamW / 2, 0);
      bGrad.addColorStop(0, 'rgba(220,240,255,0)');
      bGrad.addColorStop(0.2, 'rgba(220,240,255,0.02)');
      bGrad.addColorStop(0.5, 'rgba(220,240,255,0.05)');
      bGrad.addColorStop(0.8, 'rgba(220,240,255,0.02)');
      bGrad.addColorStop(1, 'rgba(220,240,255,0)');
      ctx.fillStyle = bGrad;
      ctx.fillRect(-beamW / 2, -10, beamW, j.bodyH + j.neckH + 40);
      ctx.restore();
    }

    // 3. Outer glass border
    ctx.save();
    traceJar(0);
    ctx.strokeStyle = 'rgba(200,225,245,0.40)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 4. Inner glass border (thickness)
    ctx.save();
    traceJar(3.5);
    ctx.strokeStyle = 'rgba(200,225,245,0.12)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // 5. Left specular highlight
    var hlX = j.left + j.bodyW * 0.20;
    var hlTop = j.bodyTop + j.shoulderH * 0.5;
    var hlBot = j.bot - 22;
    var hlG = ctx.createLinearGradient(hlX - 7, 0, hlX + 7, 0);
    hlG.addColorStop(0, 'rgba(255,255,255,0)');
    hlG.addColorStop(0.3, 'rgba(255,255,255,0.22)');
    hlG.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    hlG.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hlG;
    ctx.fillRect(hlX - 7, hlTop, 14, hlBot - hlTop);

    // 6. Right highlight (thinner)
    var hl2X = j.right - j.bodyW * 0.16;
    var hl2G = ctx.createLinearGradient(hl2X - 3, 0, hl2X + 3, 0);
    hl2G.addColorStop(0, 'rgba(255,255,255,0)');
    hl2G.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    hl2G.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl2G;
    ctx.fillRect(hl2X - 4, hlTop + 25, 8, hlBot - hlTop - 55);

    // 7. Bottom glass thickness glow
    var btmG = ctx.createLinearGradient(0, j.bot - 10, 0, j.bot + 2);
    btmG.addColorStop(0, 'rgba(200,225,245,0)');
    btmG.addColorStop(0.5, 'rgba(200,225,245,0.10)');
    btmG.addColorStop(1, 'rgba(200,225,245,0.03)');
    ctx.fillStyle = btmG;
    var cr = j.bodyW * 0.06;
    ctx.beginPath();
    ctx.roundRect(j.left + cr, j.bot - 7, j.bodyW - cr * 2, 9, [0, 0, cr, cr]);
    ctx.fill();

    // 8. Neck
    ctx.save();
    var nL = j.cx - j.neckW / 2;
    var nR = j.cx + j.neckW / 2;

    // Neck side lines
    ctx.beginPath();
    ctx.moveTo(nL + 0.5, j.neckTop);
    ctx.lineTo(nL + 0.5, j.neckTop + j.neckH);
    ctx.moveTo(nR - 0.5, j.neckTop);
    ctx.lineTo(nR - 0.5, j.neckTop + j.neckH);
    ctx.strokeStyle = 'rgba(200,225,245,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rim / lip
    var rimW = j.neckW + 6;
    ctx.beginPath();
    ctx.roundRect(j.cx - rimW / 2, j.neckTop - 2, rimW, 5, 2);
    ctx.fillStyle = 'rgba(210,230,245,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(225,240,250,0.28)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();

    // 9. Cap / Lid
    ctx.save();
    var capW = j.capW;
    var capL = j.cx - capW / 2;
    var capT = j.capTop;
    var capH = j.capH;

    ctx.beginPath();
    ctx.roundRect(capL, capT, capW, capH, [4, 4, 1, 1]);
    ctx.fillStyle = 'rgba(130,150,175,0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,220,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Knurling lines
    var lines = Math.floor(capH / 3.5);
    for (var k = 0; k < lines; k++) {
      var ly = capT + 3 + k * 3.5;
      ctx.beginPath();
      ctx.moveTo(capL + 5, ly);
      ctx.lineTo(capL + capW - 5, ly);
      ctx.strokeStyle = 'rgba(200,215,230,0.12)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ===================== TYNDALL BRIGHTNESS ===================== */
  function tyndallFactor(x, y) {
    if (scene === 2) return 1;
    var beamCX = jar.cx + jar.bodyW * 0.08;
    var cos = Math.cos(0.25);
    var sin = Math.sin(0.25);
    var dx = x - beamCX;
    var dy = y - jar.neckTop;
    var rotX = dx * cos - dy * sin;
    var halfW = jar.bodyW * 0.21;
    var t = Math.abs(rotX) / halfW;
    if (t > 1) return 1;
    return 1 + (1 - t) * 0.7;
  }

  /* ===================== DUST PARTICLE ===================== */
  function Particle(type) {
    this.type = type || 'dust';
    this.x = jar.innerLeft + Math.random() * (jar.innerRight - jar.innerLeft);
    this.y = jar.innerTop + Math.random() * (jar.innerBot - jar.innerTop);

    if (type === 'fiber') {
      this.size = 2 + Math.random() * 3.5;
      this.aspect = 3 + Math.random() * 2.5;
    } else if (type === 'flake') {
      this.size = 1.5 + Math.random() * 2.5;
    } else {
      this.size = 0.6 + Math.random() * 2;
    }

    this.vx = (Math.random() - 0.5) * 0.12;
    this.vy = (Math.random() - 0.5) * 0.06;
    this.angle = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.006;
    this.drift = Math.random() * Math.PI * 2;
    this.driftSpd = 0.002 + Math.random() * 0.004;

    var r = 145 + Math.floor(Math.random() * 45);
    var g = 125 + Math.floor(Math.random() * 35);
    var b = 105 + Math.floor(Math.random() * 30);
    this.baseAlpha = 0.25 + Math.random() * 0.35;
    this.rgb = r + ',' + g + ',' + b;

    this.moldBound = false;
    this.moldGlow = 0;
    this.moldRGB = Math.floor(Math.random() * 25) + ',' +
      (185 + Math.floor(Math.random() * 55)) + ',' +
      (135 + Math.floor(Math.random() * 45));
  }

  Particle.prototype.update = function () {
    this.drift += this.driftSpd;
    this.angle += this.rotSpeed;
    this.vx += (Math.random() - 0.5) * 0.008;
    this.vy += (Math.random() - 0.5) * 0.006;
    this.vx *= 0.997;
    this.vy *= 0.997;
    this.x += this.vx + Math.sin(this.drift) * 0.06;
    this.y += this.vy + Math.cos(this.drift * 0.7) * 0.04;
    this.vy += 0.0008;

    var range = jar.innerBot - jar.innerTop;
    if (this.y > jar.innerBot - range * 0.25) this.vy -= 0.0025;

    var m = this.size + 2;
    if (this.x < jar.innerLeft + m) { this.x = jar.innerLeft + m; this.vx *= -0.3; }
    if (this.x > jar.innerRight - m) { this.x = jar.innerRight - m; this.vx *= -0.3; }
    if (this.y < jar.innerTop + m) { this.y = jar.innerTop + m; this.vy *= -0.3; }
    if (this.y > jar.innerBot - m) { this.y = jar.innerBot - m; this.vy *= -0.3; }

    if (this.moldBound && this.moldGlow < 1) {
      this.moldGlow = Math.min(1, this.moldGlow + 0.004);
    }
  };

  Particle.prototype.draw = function (ctx) {
    var tb = tyndallFactor(this.x, this.y);
    var alpha = Math.min(this.baseAlpha * tb, 0.85);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.moldBound && this.moldGlow > 0.05) {
      var ga = this.moldGlow * 0.35;
      ctx.shadowColor = 'rgba(' + this.moldRGB + ',' + ga.toFixed(3) + ')';
      ctx.shadowBlur = 6 + this.moldGlow * 10;
      ctx.fillStyle = 'rgba(' + this.moldRGB + ',' + (this.moldGlow * 0.65).toFixed(3) + ')';
    } else {
      ctx.fillStyle = 'rgba(' + this.rgb + ',' + alpha.toFixed(3) + ')';
    }

    if (this.type === 'fiber') {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size * this.aspect * 0.5, this.size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'flake') {
      var s = this.size;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(-s * 0.5, -s * 0.7);
      ctx.lineTo(s * 0.5, -s * 0.7);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.5, s * 0.7);
      ctx.lineTo(-s * 0.5, s * 0.7);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  /* ===================== MOLD SPORE ===================== */
  function MoldSpore() {
    var side = Math.floor(Math.random() * 4);
    var iW = jar.innerRight - jar.innerLeft;
    var iH = jar.innerBot - jar.innerTop;
    if (side === 0) { this.x = jar.innerLeft + 5; this.y = jar.innerTop + Math.random() * iH; }
    else if (side === 1) { this.x = jar.innerRight - 5; this.y = jar.innerTop + Math.random() * iH; }
    else if (side === 2) { this.x = jar.innerLeft + Math.random() * iW; this.y = jar.innerTop + 5; }
    else { this.x = jar.innerLeft + Math.random() * iW; this.y = jar.innerBot - 5; }

    this.size = 1 + Math.random() * 1.2;
    this.vx = (Math.random() - 0.5) * 0.25;
    this.vy = (Math.random() - 0.5) * 0.25;
    this.bound = false;
    this.target = null;
  }

  MoldSpore.prototype.update = function (dust) {
    if (this.bound) return;

    if (!this.target || this.target.moldBound) {
      var best = Infinity;
      this.target = null;
      for (var k = 0; k < dust.length; k++) {
        if (dust[k].moldBound) continue;
        var ddx = dust[k].x - this.x;
        var ddy = dust[k].y - this.y;
        var d = ddx * ddx + ddy * ddy;
        if (d < best) { best = d; this.target = dust[k]; }
      }
    }

    if (this.target) {
      var dx = this.target.x - this.x;
      var dy = this.target.y - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.size + this.target.size + 3) {
        this.target.moldBound = true;
        this.bound = true;
        return;
      }
      this.vx += (dx / dist) * 0.008;
      this.vy += (dy / dist) * 0.008;
    }

    this.vx += (Math.random() - 0.5) * 0.015;
    this.vy += (Math.random() - 0.5) * 0.015;
    this.vx *= 0.985;
    this.vy *= 0.985;
    this.x += this.vx;
    this.y += this.vy;
  };

  MoldSpore.prototype.draw = function (ctx) {
    if (this.bound) return;
    ctx.save();
    ctx.shadowColor = 'rgba(0,210,140,0.5)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(0,210,140,0.6)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /* ===================== VOC GAS WISP ===================== */
  var VOC_CFG = {
    candle:  { rgb: '255,180,60',  xOff: -0.25, label: 'Candles' },
    cleaner: { rgb: '60,200,180',  xOff: -0.08, label: 'Cleaners' },
    carpet:  { rgb: '160,120,200', xOff: 0.08,  label: 'Carpet' },
    paint:   { rgb: '180,200,50',  xOff: 0.25,  label: 'Paint' }
  };
  var VOC_KEYS = Object.keys(VOC_CFG);

  function GasWisp(key) {
    var cfg = VOC_CFG[key];
    this.rgb = cfg.rgb;
    this.x = jar.cx + jar.bodyW * cfg.xOff + (Math.random() - 0.5) * 15;
    this.y = jar.innerBot - 25;
    this.size = 18 + Math.random() * 28;
    this.vx = (Math.random() - 0.5) * 0.2;
    this.vy = -0.15 - Math.random() * 0.45;
    this.life = 1;
    this.decay = 0.001 + Math.random() * 0.002;
    this.wobble = Math.random() * Math.PI * 2;
  }

  GasWisp.prototype.update = function () {
    this.wobble += 0.012;
    this.x += this.vx + Math.sin(this.wobble) * 0.25;
    this.y += this.vy;
    this.size += 0.15;
    this.life -= this.decay;
  };

  GasWisp.prototype.draw = function (ctx) {
    if (this.life <= 0) return;
    var a = this.life * 0.15;
    var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    g.addColorStop(0, 'rgba(' + this.rgb + ',' + a.toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(' + this.rgb + ',' + (a * 0.35).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + this.rgb + ',0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  };

  /* ---- VOC source labels at jar bottom ---- */
  function drawVOCLabels() {
    var y = jar.innerBot - 14;
    for (var i = 0; i < VOC_KEYS.length; i++) {
      var cfg = VOC_CFG[VOC_KEYS[i]];
      var x = jar.cx + jar.bodyW * cfg.xOff;
      ctx.save();
      ctx.fillStyle = 'rgba(' + cfg.rgb + ',0.8)';
      ctx.shadowColor = 'rgba(' + cfg.rgb + ',0.5)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label, x, y + 13);
      ctx.restore();
    }
  }

  /* ===================== SCENE INIT ===================== */
  function initScene(idx) {
    scene = idx;
    particles = [];
    spores = [];
    wisps = [];
    moldTimer = 0;

    var iW = jar.innerRight - jar.innerLeft;
    var iH = jar.innerBot - jar.innerTop;
    var area = iW * iH;
    var types = ['dust', 'dust', 'dust', 'fiber', 'flake', 'dust', 'fiber'];

    if (idx === 0 || idx === 1) {
      var count = Math.max(45, Math.floor(area / (idx === 0 ? 300 : 360)));
      for (var i = 0; i < count; i++) {
        particles.push(new Particle(types[Math.floor(Math.random() * types.length)]));
      }
    }

    // Update dots
    var dots = document.querySelectorAll('.air-vis__dot');
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle('air-vis__dot--active', d === idx);
    }
    // Update captions
    var caps = document.querySelectorAll('.air-vis__caption');
    for (var c = 0; c < caps.length; c++) {
      caps[c].classList.toggle('air-vis__caption--active', c === idx);
    }
  }

  /* ===================== MAIN LOOP ===================== */
  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawJar();

    // Clip to jar interior
    ctx.save();
    traceJar(5);
    ctx.clip();

    var i;

    if (scene === 0) {
      for (i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw(ctx);
      }
    }

    if (scene === 1) {
      for (i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw(ctx);
      }
      moldTimer++;
      if (moldTimer % 45 === 0 && spores.length < 35) {
        spores.push(new MoldSpore());
      }
      for (i = 0; i < spores.length; i++) {
        spores[i].update(particles);
        spores[i].draw(ctx);
      }
      spores = spores.filter(function (s) { return !s.bound; });
    }

    if (scene === 2) {
      for (i = 0; i < VOC_KEYS.length; i++) {
        if (Math.random() < 0.05) wisps.push(new GasWisp(VOC_KEYS[i]));
      }
      for (i = 0; i < wisps.length; i++) {
        wisps[i].update();
        wisps[i].draw(ctx);
      }
      wisps = wisps.filter(function (w) { return w.life > 0 && w.y > jar.innerTop - 15; });
      drawVOCLabels();
    }

    ctx.restore();
    animId = requestAnimationFrame(loop);
  }

  /* ===================== NAVIGATION ===================== */
  function setupNav() {
    var prevBtn = document.getElementById('airVisPrev');
    var nextBtn = document.getElementById('airVisNext');

    if (prevBtn) prevBtn.addEventListener('click', function () {
      initScene((scene - 1 + SCENES) % SCENES);
    });
    if (nextBtn) nextBtn.addEventListener('click', function () {
      initScene((scene + 1) % SCENES);
    });

    var dots = document.querySelectorAll('.air-vis__dot');
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { initScene(i); });
    });

    // Touch swipe
    var tx = 0;
    canvas.addEventListener('touchstart', function (e) {
      tx = e.touches[0].clientX;
    }, { passive: true });
    canvas.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) {
        initScene((scene + (dx < 0 ? 1 : -1) + SCENES) % SCENES);
      }
    }, { passive: true });
  }

  /* ===================== INIT ===================== */
  function init() {
    resize();
    setupNav();
    loop();
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(resize, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
