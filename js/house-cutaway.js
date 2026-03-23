/* ============================================================
   "Where Problems Hide in Your Home" — 3D Isometric House Cutaway
   Canvas-rendered isometric cross-section with depth, lighting,
   material textures, ambient occlusion, and clickable hotspot zones.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('houseCutCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var wrap = canvas.parentElement;
  var infoEl = document.getElementById('houseInfo');

  var W, H, dpr;
  var activeZone = null;
  var hoverZone = null;
  var tick = 0;

  // Isometric depth offset (pixels the "back wall" is shifted up-right)
  var D = 0; // computed on resize
  var ANGLE = 0.46; // ~26° iso tilt

  /* ===================== ZONE DATA ===================== */
  var ZONE_DATA = {
    attic: {
      title: 'Attic & Roof Line',
      desc: 'Roof leaks, poor ventilation, and temperature differentials create condensation that feeds hidden mold on sheathing and insulation. Most homeowners never look up here — until it\'s too late.',
      link: 'pages/hidden-mold.html',
      linkText: 'Learn About Hidden Mold \u2192',
      color: [255, 180, 60]
    },
    bathroom: {
      title: 'Bathroom',
      desc: 'The #1 mold hotspot. Shower steam, poor exhaust fans, and deteriorating caulk allow moisture behind walls. Surface mold you can see often indicates deeper problems you can\'t.',
      link: 'pages/mold-in-bathroom.html',
      linkText: 'Bathroom Mold Guide \u2192',
      color: [60, 200, 180]
    },
    hvac: {
      title: 'HVAC System',
      desc: 'Your air handler and ductwork push air to every room. If mold colonizes the coil, drain pan, or ducts, it spreads spores throughout the entire house with every cycle.',
      link: 'pages/mold-in-hvac.html',
      linkText: 'HVAC Mold Guide \u2192',
      color: [100, 160, 255]
    },
    kitchen: {
      title: 'Kitchen & Plumbing',
      desc: 'Under-sink leaks, dishwasher connections, and refrigerator lines are silent water sources. Mold thrives in dark, enclosed cabinet spaces where leaks go unnoticed for months.',
      link: 'pages/hidden-mold.html',
      linkText: 'Hidden Mold Signs \u2192',
      color: [200, 120, 255]
    },
    walls: {
      title: 'Inside the Walls',
      desc: 'Plumbing leaks, condensation on cold surfaces, and wind-driven rain can saturate wall cavities. Mold grows on the back side of drywall — invisible until significant damage occurs.',
      link: 'pages/hidden-mold.html',
      linkText: 'Detecting Hidden Mold \u2192',
      color: [255, 100, 100]
    },
    crawlspace: {
      title: 'Crawlspace & Foundation',
      desc: 'Ground moisture, poor vapor barriers, and standing water make crawlspaces the most consistently humid area. Mold here sends spores up through the floor system into living spaces via the stack effect.',
      link: 'pages/mold-in-crawlspace.html',
      linkText: 'Crawlspace Mold Guide \u2192',
      color: [120, 200, 80]
    }
  };

  // ---- Geometry cache ----
  var G = {};          // house geometry
  var zones = [];      // hit-test rects (screen-space)
  var particles = [];  // ambient floating particles

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
    D = Math.min(W, H) * 0.09;
    computeGeometry();
    initParticles();
  }

  /* ===================== COMPUTE GEOMETRY ===================== */
  function computeGeometry() {
    var pad = Math.max(20, W * 0.05);
    // leave room for depth offset top-right
    var usableW = W - pad * 2 - D;
    var usableH = H - pad * 2 - D * 0.6;
    var left = pad;
    var top = pad + D * 0.55;

    // Vertical proportions
    var roofH   = usableH * 0.16;
    var atticH  = usableH * 0.09;
    var upperH  = usableH * 0.30;
    var lowerH  = usableH * 0.28;
    var crawlH  = usableH * 0.11;
    var floorTH = usableH * 0.015;
    var chimneyH = roofH * 0.6;

    var roofTop   = top;
    var atticTop  = top + roofH;
    var upperTop  = atticTop + atticH;
    var lowerTop  = upperTop + upperH;
    var crawlTop  = lowerTop + lowerH;
    var bot       = crawlTop + crawlH;

    // Exterior walls
    var wallL = left;
    var wallR = left + usableW;
    var wallInW = wallR - wallL;

    // Dividers
    var upperDivX = wallL + wallInW * 0.40;
    var lowerDivX = wallL + wallInW * 0.48;

    // Roof peak
    var peakX = wallL + wallInW * 0.50;
    var peakY = roofTop;
    var roofOverhang = wallInW * 0.04;

    G = {
      pad: pad, left: left, top: top,
      wallL: wallL, wallR: wallR, wallInW: wallInW,
      roofH: roofH, atticH: atticH, upperH: upperH, lowerH: lowerH, crawlH: crawlH,
      floorTH: floorTH, chimneyH: chimneyH,
      roofTop: roofTop, atticTop: atticTop, upperTop: upperTop,
      lowerTop: lowerTop, crawlTop: crawlTop, bot: bot,
      peakX: peakX, peakY: peakY, roofOverhang: roofOverhang,
      upperDivX: upperDivX, lowerDivX: lowerDivX,
      usableW: usableW, usableH: bot - top
    };

    // Hit-test zones (front face rects)
    zones = [
      { id: 'attic',      x: wallL, y: atticTop,  w: wallInW,                h: atticH },
      { id: 'bathroom',   x: wallL, y: upperTop,  w: upperDivX - wallL,      h: upperH },
      { id: 'walls',      x: upperDivX, y: upperTop, w: wallR - upperDivX,   h: upperH },
      { id: 'kitchen',    x: wallL, y: lowerTop,  w: lowerDivX - wallL,      h: lowerH },
      { id: 'hvac',       x: lowerDivX, y: lowerTop, w: wallR - lowerDivX,   h: lowerH },
      { id: 'crawlspace', x: wallL, y: crawlTop,  w: wallInW,                h: crawlH }
    ];
  }

  /* ===================== PARTICLES ===================== */
  function initParticles() {
    particles = [];
    var count = Math.floor(W * H / 6000);
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.4 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.05 - Math.random() * 0.12,
        a: 0.03 + Math.random() * 0.06,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function updateParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx + Math.sin(tick * 0.008 + p.phase) * 0.1;
      p.y += p.vy;
      if (p.y < -10) { p.y = H + 5; p.x = Math.random() * W; }
      if (p.x < -10) p.x = W + 5;
      if (p.x > W + 10) p.x = -5;
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var a = p.a * (0.7 + Math.sin(tick * 0.015 + p.phase) * 0.3);
      ctx.fillStyle = 'rgba(137,207,240,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===================== ISOMETRIC HELPERS ===================== */
  // Offset a point to its "back" position (depth)
  function bk(x, y) { return [x + D, y - D * ANGLE]; }

  // Draw a 3D box front-face, top-face, right-face
  function box3d(x, y, w, h, frontColor, topColor, sideColor) {
    var br = bk(x + w, y);
    var brt = bk(x + w, y);
    // Front face
    ctx.fillStyle = frontColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();

    // Top face
    var btl = bk(x, y);
    var btr = bk(x + w, y);
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(btl[0], btl[1]);
    ctx.lineTo(btr[0], btr[1]);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();

    // Right face
    var brb = bk(x + w, y + h);
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(btr[0], btr[1]);
    ctx.lineTo(brb[0], brb[1]);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  // Draw edges on a 3D box
  function boxEdges(x, y, w, h, color, lineW) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW || 1;
    var btl = bk(x, y);
    var btr = bk(x + w, y);
    var brb = bk(x + w, y + h);
    // Front
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.stroke();
    // Top
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(btl[0], btl[1]);
    ctx.lineTo(btr[0], btr[1]); ctx.lineTo(x + w, y); ctx.closePath();
    ctx.stroke();
    // Right side
    ctx.beginPath();
    ctx.moveTo(x + w, y); ctx.lineTo(btr[0], btr[1]);
    ctx.lineTo(brb[0], brb[1]); ctx.lineTo(x + w, y + h); ctx.closePath();
    ctx.stroke();
  }

  // AO (ambient occlusion shadow) at inside corners
  function aoCorner(x, y, w, dir, strength) {
    var g;
    if (dir === 'down') {
      g = ctx.createLinearGradient(x, y, x, y + w);
      g.addColorStop(0, 'rgba(0,0,0,' + (strength || 0.25) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 9999, w);
    } else if (dir === 'right') {
      g = ctx.createLinearGradient(x, y, x + w, y);
      g.addColorStop(0, 'rgba(0,0,0,' + (strength || 0.2) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, 9999);
    }
  }

  /* ===================== MATERIAL TEXTURES ===================== */
  function drawWoodFloor(x, y, w, h, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    var plankW = 18;
    var a = alpha || 0.07;
    for (var px = x; px < x + w; px += plankW) {
      ctx.strokeStyle = 'rgba(160,130,90,' + a + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px, y + h);
      ctx.stroke();
      // grain lines
      for (var gy = y + 3; gy < y + h; gy += 6 + Math.random() * 8) {
        ctx.strokeStyle = 'rgba(140,110,70,' + (a * 0.5) + ')';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(px + 2, gy);
        ctx.quadraticCurveTo(px + plankW * 0.5, gy + (Math.random() - 0.5) * 3, px + plankW - 2, gy);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBrickPattern(x, y, w, h, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    var bw = 14, bh = 7;
    var a = alpha || 0.08;
    var row = 0;
    for (var by = y; by < y + h; by += bh) {
      var offset = (row % 2 === 0) ? 0 : bw * 0.5;
      for (var bx = x - bw + offset; bx < x + w; bx += bw) {
        ctx.strokeStyle = 'rgba(140,100,80,' + a + ')';
        ctx.lineWidth = 0.4;
        ctx.strokeRect(bx, by, bw - 1, bh - 1);
      }
      row++;
    }
    ctx.restore();
  }

  function drawTilePattern(x, y, w, h, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    var tw = 12;
    var a = alpha || 0.06;
    for (var tx = x; tx < x + w; tx += tw) {
      for (var ty = y; ty < y + h; ty += tw) {
        ctx.strokeStyle = 'rgba(120,180,190,' + a + ')';
        ctx.lineWidth = 0.4;
        ctx.strokeRect(tx, ty, tw - 1, tw - 1);
      }
    }
    ctx.restore();
  }

  function drawConcreteTexture(x, y, w, h, alpha) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    var a = alpha || 0.04;
    // Random speckle
    var seed = 42;
    for (var i = 0; i < w * h * 0.02; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var sx = x + (seed % w);
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      var sy = y + (seed % h);
      ctx.fillStyle = 'rgba(180,175,170,' + a + ')';
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.restore();
  }

  /* ===================== DRAW 3D HOUSE ===================== */
  function drawHouse() {
    var g = G;
    var wallT = Math.max(8, g.wallInW * 0.025); // wall thickness

    // ============ GROUND PLANE (isometric) ============
    var groundY = g.bot + 4;
    ctx.save();
    var gp1 = [g.wallL - 20, groundY];
    var gp2 = bk(g.wallL - 20, groundY);
    var gp3 = bk(g.wallR + 20, groundY);
    var gp4 = [g.wallR + 20, groundY];
    var gg = ctx.createLinearGradient(0, groundY - 10, 0, groundY + 40);
    gg.addColorStop(0, 'rgba(45,60,35,0.35)');
    gg.addColorStop(1, 'rgba(30,42,25,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(gp1[0], gp1[1]);
    ctx.lineTo(gp2[0], gp2[1]);
    ctx.lineTo(gp3[0], gp3[1]);
    ctx.lineTo(gp4[0], gp4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ============ FOUNDATION / CRAWLSPACE (3D) ============
    box3d(g.wallL, g.crawlTop, g.wallInW, g.crawlH,
      'rgba(55,50,48,0.92)',    // front
      'rgba(72,66,62,0.7)',     // top
      'rgba(40,36,34,0.95)');   // right side
    drawConcreteTexture(g.wallL, g.crawlTop, g.wallInW, g.crawlH, 0.06);
    drawBrickPattern(g.wallL, g.crawlTop, g.wallInW, g.crawlH, 0.04);
    boxEdges(g.wallL, g.crawlTop, g.wallInW, g.crawlH, 'rgba(90,82,75,0.4)', 1);

    // Inner crawl void
    var ci = 6;
    ctx.fillStyle = 'rgba(15,12,10,0.9)';
    ctx.fillRect(g.wallL + ci, g.crawlTop + ci, g.wallInW - ci * 2, g.crawlH - ci);
    // Dirt / moisture at bottom
    var dirtG = ctx.createLinearGradient(0, g.bot - 15, 0, g.bot - ci);
    dirtG.addColorStop(0, 'rgba(60,50,40,0)');
    dirtG.addColorStop(1, 'rgba(60,50,40,0.35)');
    ctx.fillStyle = dirtG;
    ctx.fillRect(g.wallL + ci, g.bot - 20, g.wallInW - ci * 2, 20);
    // Moisture droplets
    for (var md = 0; md < 10; md++) {
      var mdx = g.wallL + ci + 15 + md * ((g.wallInW - ci * 2 - 30) / 9);
      var mdy = g.bot - 10 + Math.sin(tick * 0.018 + md * 0.8) * 3;
      var mda = 0.10 + Math.sin(tick * 0.025 + md * 1.3) * 0.06;
      ctx.fillStyle = 'rgba(80,160,220,' + mda.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(mdx, mdy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Vapor barrier
    ctx.save();
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = 'rgba(120,200,80,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.wallL + ci + 8, g.bot - ci - 3);
    ctx.lineTo(g.wallR - ci - 8, g.bot - ci - 3);
    ctx.stroke();
    ctx.restore();
    // Foundation support piers
    var pierCount = 4;
    for (var pi = 0; pi < pierCount; pi++) {
      var piX = g.wallL + ci + 20 + pi * ((g.wallInW - ci * 2 - 40) / (pierCount - 1));
      ctx.fillStyle = 'rgba(75,68,62,0.6)';
      ctx.fillRect(piX - 3, g.crawlTop + ci + 5, 6, g.crawlH - ci - 5);
    }

    // ============ LOWER FLOOR SLAB (3D) ============
    var slabH = g.floorTH + 4;
    box3d(g.wallL - 2, g.crawlTop - slabH, g.wallInW + 4, slabH,
      'rgba(85,78,72,0.9)',
      'rgba(110,100,92,0.6)',
      'rgba(65,58,52,0.95)');
    boxEdges(g.wallL - 2, g.crawlTop - slabH, g.wallInW + 4, slabH, 'rgba(120,110,100,0.25)', 0.8);

    // ============ LOWER FLOOR ROOMS (3D boxes) ============
    // Kitchen (left)
    var kitW = g.lowerDivX - g.wallL;
    box3d(g.wallL, g.lowerTop, kitW, g.lowerH,
      'rgba(42,38,52,0.92)',
      'rgba(55,50,65,0.5)',
      'rgba(32,28,40,0.92)');
    drawWoodFloor(g.wallL, g.lowerTop + g.lowerH * 0.85, kitW, g.lowerH * 0.15, 0.08);
    // AO at top and left
    ctx.save();
    ctx.beginPath(); ctx.rect(g.wallL, g.lowerTop, kitW, g.lowerH); ctx.clip();
    aoCorner(g.wallL, g.lowerTop, 12, 'down', 0.15);
    aoCorner(g.wallL, g.lowerTop, 10, 'right', 0.12);
    ctx.restore();

    // HVAC room (right)
    var hvacW = g.wallR - g.lowerDivX;
    box3d(g.lowerDivX, g.lowerTop, hvacW, g.lowerH,
      'rgba(36,40,55,0.92)',
      'rgba(48,52,68,0.5)',
      'rgba(28,32,45,0.92)');
    // AO
    ctx.save();
    ctx.beginPath(); ctx.rect(g.lowerDivX, g.lowerTop, hvacW, g.lowerH); ctx.clip();
    aoCorner(g.lowerDivX, g.lowerTop, 12, 'down', 0.15);
    aoCorner(g.lowerDivX, g.lowerTop, 10, 'right', 0.12);
    ctx.restore();

    // Divider wall (3D)
    var divWallW = wallT * 0.7;
    box3d(g.lowerDivX - divWallW / 2, g.lowerTop, divWallW, g.lowerH,
      'rgba(95,88,80,0.8)',
      'rgba(115,108,98,0.5)',
      'rgba(75,68,60,0.85)');

    // ---- Kitchen furniture ----
    drawKitchen3d(g.wallL, g.lowerTop, kitW, g.lowerH);

    // ---- HVAC unit ----
    drawHVAC3d(g.lowerDivX, g.lowerTop, hvacW, g.lowerH);

    // ============ UPPER FLOOR SLAB (3D) ============
    box3d(g.wallL - 2, g.lowerTop - slabH, g.wallInW + 4, slabH,
      'rgba(85,78,72,0.9)',
      'rgba(110,100,92,0.6)',
      'rgba(65,58,52,0.95)');
    boxEdges(g.wallL - 2, g.lowerTop - slabH, g.wallInW + 4, slabH, 'rgba(120,110,100,0.25)', 0.8);

    // ============ UPPER FLOOR ROOMS (3D) ============
    // Bathroom (left)
    var bathW = g.upperDivX - g.wallL;
    box3d(g.wallL, g.upperTop, bathW, g.upperH,
      'rgba(40,45,58,0.92)',
      'rgba(52,58,72,0.5)',
      'rgba(30,34,46,0.92)');
    drawTilePattern(g.wallL, g.upperTop, bathW, g.upperH, 0.05);
    // AO
    ctx.save();
    ctx.beginPath(); ctx.rect(g.wallL, g.upperTop, bathW, g.upperH); ctx.clip();
    aoCorner(g.wallL, g.upperTop, 14, 'down', 0.18);
    aoCorner(g.wallL, g.upperTop, 10, 'right', 0.12);
    ctx.restore();

    // Bedroom / Walls (right)
    var bedrW = g.wallR - g.upperDivX;
    box3d(g.upperDivX, g.upperTop, bedrW, g.upperH,
      'rgba(38,35,50,0.92)',
      'rgba(50,46,64,0.5)',
      'rgba(28,25,38,0.92)');
    drawWoodFloor(g.upperDivX, g.upperTop + g.upperH * 0.82, bedrW, g.upperH * 0.18, 0.07);
    // AO
    ctx.save();
    ctx.beginPath(); ctx.rect(g.upperDivX, g.upperTop, bedrW, g.upperH); ctx.clip();
    aoCorner(g.upperDivX, g.upperTop, 14, 'down', 0.18);
    aoCorner(g.upperDivX, g.upperTop, 10, 'right', 0.12);
    ctx.restore();

    // Upper divider (3D)
    box3d(g.upperDivX - divWallW / 2, g.upperTop, divWallW, g.upperH,
      'rgba(95,88,80,0.8)',
      'rgba(115,108,98,0.5)',
      'rgba(75,68,60,0.85)');

    // ---- Bathroom fixtures ----
    drawBathroom3d(g.wallL, g.upperTop, bathW, g.upperH);

    // ---- Bedroom fixtures ----
    drawBedroom3d(g.upperDivX, g.upperTop, bedrW, g.upperH);

    // ---- Wall moisture inside cavity (right exterior wall) ----
    drawWallMoisture(g.wallR - wallT, g.upperTop, wallT, g.upperH);

    // ---- Ductwork (between floors) ----
    drawDucts(g);

    // ============ EXTERIOR WALLS (3D thick) ============
    // Left wall
    box3d(g.wallL - wallT, g.atticTop, wallT, g.bot - g.atticTop,
      'rgba(110,100,88,0.85)',
      'rgba(135,125,112,0.5)',
      'rgba(90,80,68,0.9)');
    drawBrickPattern(g.wallL - wallT, g.atticTop, wallT, g.bot - g.atticTop, 0.06);

    // Right wall
    box3d(g.wallR, g.atticTop, wallT, g.bot - g.atticTop,
      'rgba(110,100,88,0.85)',
      'rgba(135,125,112,0.5)',
      'rgba(90,80,68,0.9)');
    drawBrickPattern(g.wallR, g.atticTop, wallT, g.bot - g.atticTop, 0.06);

    // ============ WINDOWS (3D recessed) ============
    drawWindow3d(g.upperDivX + bedrW * 0.60, g.upperTop + g.upperH * 0.15, 30, 40);
    drawWindow3d(g.wallL + kitW * 0.65, g.lowerTop + g.lowerH * 0.12, 28, 36);

    // ============ ATTIC (3D) ============
    box3d(g.wallL, g.atticTop, g.wallInW, g.atticH,
      'rgba(50,45,42,0.88)',
      'rgba(65,58,54,0.5)',
      'rgba(38,34,32,0.92)');
    boxEdges(g.wallL, g.atticTop, g.wallInW, g.atticH, 'rgba(80,72,65,0.3)', 0.6);

    // Insulation (fluffy zigzag with thickness)
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.wallL + 3, g.atticTop + g.atticH - 16, g.wallInW - 6, 14);
    ctx.clip();
    for (var il = 0; il < 2; il++) {
      var insY = g.atticTop + g.atticH - 6 - il * 5;
      ctx.strokeStyle = 'rgba(255,210,120,' + (0.14 - il * 0.04) + ')';
      ctx.lineWidth = 2.5 - il * 0.8;
      ctx.beginPath();
      for (var iz = 0; iz < 25; iz++) {
        var izx = g.wallL + 5 + iz * ((g.wallInW - 10) / 24);
        ctx.lineTo(izx, insY + (iz % 2 === 0 ? -4 : 4) + il * 2);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Rafters
    ctx.strokeStyle = 'rgba(120,100,75,0.12)';
    ctx.lineWidth = 2;
    var rafterCount = 6;
    for (var ri = 0; ri < rafterCount; ri++) {
      var rx = g.wallL + 10 + ri * ((g.wallInW - 20) / (rafterCount - 1));
      ctx.beginPath();
      ctx.moveTo(rx, g.atticTop + 3);
      ctx.lineTo(rx, g.atticTop + g.atticH - 3);
      ctx.stroke();
    }

    // ============ ROOF (3D with depth) ============
    drawRoof3d(g);

    // ============ CHIMNEY (3D) ============
    var chimX = g.wallR - g.wallInW * 0.22;
    var chimW = 16;
    box3d(chimX, g.peakY - g.chimneyH * 0.4, chimW, g.chimneyH,
      'rgba(100,80,70,0.85)',
      'rgba(130,108,95,0.6)',
      'rgba(75,58,50,0.9)');
    drawBrickPattern(chimX, g.peakY - g.chimneyH * 0.4, chimW, g.chimneyH, 0.10);
    boxEdges(chimX, g.peakY - g.chimneyH * 0.4, chimW, g.chimneyH, 'rgba(130,110,95,0.35)', 0.8);

    // ============ GLOBAL LIGHTING OVERLAY ============
    // Top-left light source gradient
    var lightG = ctx.createRadialGradient(
      g.wallL, g.peakY, 0,
      g.wallL + g.wallInW * 0.5, g.bot, g.wallInW * 0.8
    );
    lightG.addColorStop(0, 'rgba(255,240,220,0.04)');
    lightG.addColorStop(0.5, 'rgba(0,0,0,0)');
    lightG.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = lightG;
    ctx.fillRect(g.wallL - wallT, g.peakY - g.chimneyH, g.wallInW + wallT * 2 + D, g.bot - g.peakY + g.chimneyH + 20);

    // ============ ZONE HIGHLIGHTS ============
    drawZoneHighlights();
  }

  /* ===================== 3D ROOF ===================== */
  function drawRoof3d(g) {
    var oh = g.roofOverhang;
    var peakX = g.peakX;
    var peakY = g.peakY;
    var baseY = g.atticTop;
    var leftX = g.wallL - oh;
    var rightX = g.wallR + oh;

    // Back peak and base
    var bPeak = bk(peakX, peakY);
    var bLeft = bk(leftX, baseY);
    var bRight = bk(rightX, baseY);

    // Right roof slope — back face (visible)
    ctx.fillStyle = 'rgba(82,70,62,0.7)';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(bPeak[0], bPeak[1]);
    ctx.lineTo(bRight[0], bRight[1]);
    ctx.lineTo(rightX, baseY);
    ctx.closePath();
    ctx.fill();

    // Left roof slope — back face (partially visible)
    ctx.fillStyle = 'rgba(75,64,56,0.5)';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(bPeak[0], bPeak[1]);
    ctx.lineTo(bLeft[0], bLeft[1]);
    ctx.lineTo(leftX, baseY);
    ctx.closePath();
    ctx.fill();

    // Right roof top surface
    ctx.fillStyle = 'rgba(95,82,72,0.85)';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(bPeak[0], bPeak[1]);
    ctx.lineTo(bRight[0], bRight[1]);
    ctx.lineTo(rightX, baseY);
    ctx.closePath();
    ctx.fill();

    // Front face — left slope
    var roofFrontG = ctx.createLinearGradient(leftX, baseY, peakX, peakY);
    roofFrontG.addColorStop(0, 'rgba(85,72,64,0.92)');
    roofFrontG.addColorStop(1, 'rgba(100,85,75,0.92)');
    ctx.fillStyle = roofFrontG;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(leftX, baseY);
    ctx.lineTo(peakX, baseY); // mid bottom
    ctx.closePath();
    ctx.fill();

    // Front face — right slope
    var roofFrontG2 = ctx.createLinearGradient(rightX, baseY, peakX, peakY);
    roofFrontG2.addColorStop(0, 'rgba(75,64,56,0.92)');
    roofFrontG2.addColorStop(1, 'rgba(90,78,68,0.92)');
    ctx.fillStyle = roofFrontG2;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(rightX, baseY);
    ctx.lineTo(peakX, baseY);
    ctx.closePath();
    ctx.fill();

    // Shingle lines on front face
    ctx.save();
    var shingleRows = 7;
    for (var sr = 1; sr <= shingleRows; sr++) {
      var t = sr / (shingleRows + 1);
      var sy = peakY + (baseY - peakY) * t;
      var sxL = peakX + (leftX - peakX) * t;
      var sxR = peakX + (rightX - peakX) * t;
      ctx.strokeStyle = 'rgba(120,105,90,' + (0.12 + t * 0.08) + ')';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(sxL, sy);
      ctx.lineTo(sxR, sy);
      ctx.stroke();
      // Vertical shingle offsets
      var segW = (sxR - sxL) / 8;
      var offsetRow = sr % 2 === 0 ? segW * 0.5 : 0;
      for (var sv = 0; sv < 8; sv++) {
        var svx = sxL + sv * segW + offsetRow;
        if (svx > sxL && svx < sxR) {
          var prevSy = peakY + (baseY - peakY) * ((sr - 1) / (shingleRows + 1));
          ctx.beginPath();
          ctx.moveTo(svx, sy);
          ctx.lineTo(svx, prevSy);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Ridge cap
    ctx.strokeStyle = 'rgba(140,125,110,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(bPeak[0], bPeak[1]);
    ctx.stroke();

    // Roof outline edges
    ctx.strokeStyle = 'rgba(150,135,118,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.lineTo(peakX, peakY);
    ctx.lineTo(rightX, baseY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bLeft[0], bLeft[1]);
    ctx.lineTo(bPeak[0], bPeak[1]);
    ctx.lineTo(bRight[0], bRight[1]);
    ctx.stroke();
    // Eave lines
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.lineTo(bLeft[0], bLeft[1]);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightX, baseY);
    ctx.lineTo(bRight[0], bRight[1]);
    ctx.stroke();

    // Fascia shadow (under eave, front)
    var fasciaG = ctx.createLinearGradient(0, baseY, 0, baseY + 6);
    fasciaG.addColorStop(0, 'rgba(0,0,0,0.15)');
    fasciaG.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fasciaG;
    ctx.fillRect(leftX, baseY, rightX - leftX, 6);
  }

  /* ===================== 3D WINDOW ===================== */
  function drawWindow3d(cx, y, w, h) {
    var recess = 4;
    // Outer frame (3D inset)
    ctx.fillStyle = 'rgba(70,65,60,0.7)';
    ctx.fillRect(cx - w / 2 - 3, y - 3, w + 6, h + 6);
    // Dark recess
    ctx.fillStyle = 'rgba(20,18,16,0.5)';
    ctx.fillRect(cx - w / 2, y, w, h);
    // Glass
    var glassG = ctx.createLinearGradient(cx - w / 2, y, cx + w / 2, y + h);
    glassG.addColorStop(0, 'rgba(100,150,200,0.18)');
    glassG.addColorStop(0.4, 'rgba(80,130,180,0.10)');
    glassG.addColorStop(1, 'rgba(120,170,220,0.15)');
    ctx.fillStyle = glassG;
    ctx.fillRect(cx - w / 2 + 2, y + 2, w - 4, h - 4);
    // Reflection streak
    ctx.fillStyle = 'rgba(200,220,240,0.08)';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 4, y + 3);
    ctx.lineTo(cx - w / 2 + w * 0.3, y + 3);
    ctx.lineTo(cx - w / 2 + 4, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    // Mullions
    ctx.strokeStyle = 'rgba(140,130,120,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx, y + h - 2);
    ctx.moveTo(cx - w / 2 + 2, y + h / 2);
    ctx.lineTo(cx + w / 2 - 2, y + h / 2);
    ctx.stroke();
    // Frame bevels (light on top/left, dark on bottom/right)
    ctx.strokeStyle = 'rgba(160,150,138,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 3, y - 3);
    ctx.lineTo(cx + w / 2 + 3, y - 3);
    ctx.moveTo(cx - w / 2 - 3, y - 3);
    ctx.lineTo(cx - w / 2 - 3, y + h + 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,35,30,0.3)';
    ctx.beginPath();
    ctx.moveTo(cx + w / 2 + 3, y - 3);
    ctx.lineTo(cx + w / 2 + 3, y + h + 3);
    ctx.lineTo(cx - w / 2 - 3, y + h + 3);
    ctx.stroke();
    // Sill
    box3d(cx - w / 2 - 4, y + h + 3, w + 8, 4,
      'rgba(130,120,108,0.6)',
      'rgba(155,145,132,0.4)',
      'rgba(100,90,78,0.6)');
    // Light spill inside room
    var spillG = ctx.createRadialGradient(cx, y + h * 0.4, 0, cx, y + h * 0.4, w * 0.8);
    spillG.addColorStop(0, 'rgba(140,180,220,0.04)');
    spillG.addColorStop(1, 'rgba(140,180,220,0)');
    ctx.fillStyle = spillG;
    ctx.fillRect(cx - w, y - 5, w * 2, h + 10);
  }

  /* ===================== KITCHEN 3D ===================== */
  function drawKitchen3d(rx, ry, rw, rh) {
    // Cabinets (back wall — upper)
    var cabY = ry + rh * 0.12;
    var cabH = rh * 0.20;
    var cabW = rw * 0.55;
    box3d(rx + 8, cabY, cabW, cabH,
      'rgba(80,68,55,0.7)',
      'rgba(100,88,72,0.4)',
      'rgba(62,52,42,0.75)');
    // Cabinet doors
    var doorW = cabW / 3;
    for (var cd = 0; cd < 3; cd++) {
      ctx.strokeStyle = 'rgba(120,105,88,0.3)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(rx + 10 + cd * doorW, cabY + 2, doorW - 4, cabH - 4);
      // knob
      ctx.fillStyle = 'rgba(180,170,155,0.3)';
      ctx.beginPath();
      ctx.arc(rx + 10 + cd * doorW + doorW - 8, cabY + cabH / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Counter top
    var ctrY = cabY + cabH + rh * 0.04;
    box3d(rx + 6, ctrY, cabW + 4, 5,
      'rgba(140,130,120,0.6)',
      'rgba(170,160,148,0.35)',
      'rgba(110,100,90,0.65)');

    // Lower cabinets
    box3d(rx + 8, ctrY + 5, cabW, rh * 0.30,
      'rgba(72,62,50,0.7)',
      'rgba(88,78,65,0.3)',
      'rgba(55,46,38,0.75)');
    for (var lc = 0; lc < 3; lc++) {
      ctx.strokeStyle = 'rgba(100,88,72,0.25)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(rx + 10 + lc * doorW, ctrY + 7, doorW - 4, rh * 0.28 - 4);
    }

    // Sink (in counter)
    var sinkX = rx + 8 + cabW * 0.35;
    var sinkY = ctrY - 1;
    ctx.fillStyle = 'rgba(160,170,180,0.25)';
    ctx.beginPath();
    ctx.ellipse(sinkX, sinkY, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,200,210,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Faucet
    ctx.strokeStyle = 'rgba(190,200,210,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sinkX + 3, sinkY);
    ctx.quadraticCurveTo(sinkX + 10, sinkY - 16, sinkX + 6, sinkY - 4);
    ctx.stroke();

    // Drip
    var dripPhase = (tick * 0.5) % 20;
    var dripA = Math.max(0, 0.35 - dripPhase / 25);
    ctx.fillStyle = 'rgba(100,180,220,' + dripA.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(sinkX + 5, sinkY - 3 + dripPhase * 0.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Under-sink leak glow (hidden problem indicator)
    var leakA = 0.04 + Math.sin(tick * 0.02) * 0.03;
    var leakG = ctx.createRadialGradient(sinkX, ctrY + 5 + rh * 0.18, 0, sinkX, ctrY + 5 + rh * 0.18, 25);
    leakG.addColorStop(0, 'rgba(200,120,255,' + leakA.toFixed(3) + ')');
    leakG.addColorStop(1, 'rgba(200,120,255,0)');
    ctx.fillStyle = leakG;
    ctx.fillRect(sinkX - 30, ctrY + 5, 60, rh * 0.30);

    // Tile backsplash
    drawTilePattern(rx + 8, cabY + cabH, cabW, rh * 0.04, 0.04);

    // Floor tile
    drawTilePattern(rx, ry + rh * 0.88, rw, rh * 0.12, 0.03);
  }

  /* ===================== HVAC 3D ===================== */
  function drawHVAC3d(rx, ry, rw, rh) {
    var unitW = Math.min(50, rw * 0.40);
    var unitH = Math.min(70, rh * 0.65);
    var cx = rx + rw * 0.5;
    var cy = ry + rh * 0.5;
    var ux = cx - unitW / 2;
    var uy = cy - unitH / 2;

    // HVAC unit body (3D box)
    box3d(ux, uy, unitW, unitH,
      'rgba(75,85,100,0.8)',
      'rgba(95,105,120,0.5)',
      'rgba(55,65,80,0.85)');
    boxEdges(ux, uy, unitW, unitH, 'rgba(110,165,255,0.2)', 1);

    // Panel lines
    ctx.strokeStyle = 'rgba(100,160,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ux + 3, uy + unitH * 0.4);
    ctx.lineTo(ux + unitW - 3, uy + unitH * 0.4);
    ctx.stroke();

    // Fan (upper section)
    var fanCx = cx;
    var fanCy = uy + unitH * 0.22;
    var fanR = Math.min(14, unitW * 0.28);
    // Fan housing circle
    ctx.strokeStyle = 'rgba(100,160,255,0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fanCx, fanCy, fanR, 0, Math.PI * 2);
    ctx.stroke();
    // Spinning blades
    for (var b = 0; b < 4; b++) {
      var ba = tick * 0.04 + b * (Math.PI / 2);
      var bx = Math.cos(ba) * (fanR - 2);
      var by = Math.sin(ba) * (fanR - 2);
      ctx.fillStyle = 'rgba(100,160,255,0.15)';
      ctx.beginPath();
      ctx.ellipse(fanCx + bx * 0.5, fanCy + by * 0.5, fanR * 0.6, 3, ba, 0, Math.PI * 2);
      ctx.fill();
    }
    // Center hub
    ctx.fillStyle = 'rgba(100,160,255,0.25)';
    ctx.beginPath();
    ctx.arc(fanCx, fanCy, 3, 0, Math.PI * 2);
    ctx.fill();

    // Control panel (lower section)
    ctx.fillStyle = 'rgba(40,50,65,0.6)';
    ctx.fillRect(ux + 5, uy + unitH * 0.55, unitW - 10, unitH * 0.12);
    // LED indicator
    var ledA = 0.4 + Math.sin(tick * 0.05) * 0.3;
    ctx.fillStyle = 'rgba(0,230,120,' + ledA.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(ux + 10, uy + unitH * 0.61, 2, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.save();
    ctx.font = '600 ' + Math.max(8, Math.min(10, unitW * 0.18)) + 'px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(100,160,255,0.30)';
    ctx.textAlign = 'center';
    ctx.fillText('AIR HANDLER', cx, uy + unitH - 8);
    ctx.restore();

    // Air flow particles from unit
    for (var af = 0; af < 6; af++) {
      var afx = cx + (Math.random() - 0.5) * unitW * 0.6;
      var afy = uy - 5 - ((tick * 0.5 + af * 12) % 30);
      var afa = Math.max(0, 0.15 - ((tick * 0.5 + af * 12) % 30) / 50);
      ctx.fillStyle = 'rgba(100,160,255,' + afa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(afx, afy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===================== BATHROOM 3D ===================== */
  function drawBathroom3d(rx, ry, rw, rh) {
    // Shower/tub enclosure
    var shX = rx + rw * 0.08;
    var shY = ry + rh * 0.22;
    var shW = rw * 0.38;
    var shH = rh * 0.62;

    // Tub base
    box3d(shX, shY + shH - 8, shW, 8,
      'rgba(200,210,220,0.25)',
      'rgba(220,230,240,0.15)',
      'rgba(170,180,190,0.28)');

    // Glass enclosure walls
    ctx.save();
    ctx.strokeStyle = 'rgba(160,210,230,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(shX, shY, shW, shH);
    // Glass fill
    ctx.fillStyle = 'rgba(140,200,220,0.04)';
    ctx.fillRect(shX, shY, shW, shH);
    ctx.restore();

    // Shower head (3D nub)
    ctx.fillStyle = 'rgba(190,200,210,0.5)';
    ctx.beginPath();
    ctx.arc(shX + shW * 0.75, shY + 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(210,220,230,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shX + shW * 0.75, shY + 15);
    ctx.lineTo(shX + shW * 0.75, shY + 3);
    ctx.lineTo(shX + shW - 3, shY + 3);
    ctx.stroke();

    // Water drops (animated)
    for (var wd = 0; wd < 8; wd++) {
      var wdx = shX + shW * 0.35 + wd * (shW * 0.07);
      var wdy = shY + 18 + ((tick * 0.6 + wd * 10) % (shH - 30));
      var wda = 0.10 + Math.sin(tick * 0.03 + wd * 0.7) * 0.06;
      ctx.fillStyle = 'rgba(100,180,230,' + wda.toFixed(3) + ')';
      ctx.beginPath();
      // Teardrop shape
      ctx.arc(wdx, wdy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Steam rising (volumetric wisps)
    for (var st = 0; st < 5; st++) {
      var stx = shX + shW * 0.15 + st * (shW * 0.17);
      var sty = shY - 8 - Math.sin(tick * 0.012 + st * 1.5) * 12;
      var sta = 0.03 + Math.sin(tick * 0.015 + st * 1.1) * 0.02;
      var stR = 6 + Math.sin(tick * 0.008 + st) * 3;
      var steamG = ctx.createRadialGradient(stx, sty, 0, stx, sty, stR);
      steamG.addColorStop(0, 'rgba(200,220,240,' + (sta * 1.5).toFixed(3) + ')');
      steamG.addColorStop(1, 'rgba(200,220,240,0)');
      ctx.fillStyle = steamG;
      ctx.beginPath();
      ctx.arc(stx, sty, stR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Toilet (simple 3D)
    var tlX = rx + rw * 0.62;
    var tlY = ry + rh * 0.55;
    // Bowl
    ctx.fillStyle = 'rgba(210,215,220,0.20)';
    ctx.beginPath();
    ctx.ellipse(tlX, tlY + 8, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,205,210,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Tank
    box3d(tlX - 7, tlY - 8, 14, 12,
      'rgba(210,215,220,0.22)',
      'rgba(230,235,240,0.12)',
      'rgba(190,195,200,0.25)');

    // Vanity sink
    var vanX = rx + rw * 0.60;
    var vanY = ry + rh * 0.20;
    ctx.fillStyle = 'rgba(210,215,220,0.18)';
    ctx.beginPath();
    ctx.ellipse(vanX, vanY + 5, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,205,210,0.20)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Mirror
    ctx.fillStyle = 'rgba(120,160,200,0.06)';
    ctx.fillRect(vanX - 10, vanY - 20, 20, 18);
    ctx.strokeStyle = 'rgba(180,190,200,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vanX - 10, vanY - 20, 20, 18);

    // Mold spots on grout (subtle)
    for (var ms = 0; ms < 4; ms++) {
      var msx = shX + 5 + ms * (shW * 0.22);
      var msy = shY + shH - 20 + Math.sin(ms * 2.1) * 8;
      var msa = 0.05 + Math.sin(tick * 0.01 + ms) * 0.03;
      ctx.fillStyle = 'rgba(60,200,180,' + msa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(msx, msy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===================== BEDROOM 3D ===================== */
  function drawBedroom3d(rx, ry, rw, rh) {
    // Bed (3D box)
    var bedX = rx + rw * 0.15;
    var bedY = ry + rh * 0.52;
    var bedW = Math.min(70, rw * 0.55);
    var bedH = 18;
    var bedDepth = 6;

    // Mattress
    box3d(bedX, bedY, bedW, bedH,
      'rgba(85,80,110,0.5)',
      'rgba(105,100,130,0.3)',
      'rgba(65,60,88,0.55)');

    // Bedding/comforter
    ctx.fillStyle = 'rgba(75,72,100,0.4)';
    ctx.beginPath();
    ctx.roundRect(bedX + 2, bedY + 2, bedW - 4, bedH - 4, 2);
    ctx.fill();

    // Pillow
    box3d(bedX + 3, bedY + 3, 18, bedH - 6,
      'rgba(180,175,200,0.30)',
      'rgba(200,195,220,0.15)',
      'rgba(150,145,170,0.32)');

    // Headboard
    box3d(bedX - 3, bedY - 14, 4, 14 + bedH,
      'rgba(95,78,60,0.5)',
      'rgba(120,100,78,0.3)',
      'rgba(72,58,44,0.55)');

    // Nightstand
    var nsX = bedX + bedW + 6;
    var nsY = bedY + 4;
    box3d(nsX, nsY, 16, 14,
      'rgba(85,72,58,0.45)',
      'rgba(108,92,75,0.25)',
      'rgba(65,52,40,0.50)');
    // Lamp on nightstand
    ctx.fillStyle = 'rgba(200,185,120,0.20)';
    ctx.beginPath();
    ctx.arc(nsX + 8, nsY - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Lamp glow
    var lampG = ctx.createRadialGradient(nsX + 8, nsY - 4, 0, nsX + 8, nsY - 4, 20);
    lampG.addColorStop(0, 'rgba(255,230,160,0.04)');
    lampG.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = lampG;
    ctx.fillRect(nsX - 15, nsY - 25, 50, 50);

    // Baseboard
    ctx.fillStyle = 'rgba(110,100,88,0.15)';
    ctx.fillRect(rx, ry + rh - 5, rw, 5);
  }

  /* ===================== WALL MOISTURE ===================== */
  function drawWallMoisture(x, y, w, h) {
    // Inside-the-wall cavity visualization
    for (var wm = 0; wm < 6; wm++) {
      var wmy = y + 15 + wm * ((h - 30) / 5);
      var wmx = x + w / 2;
      var pAlpha = 0.06 + Math.sin(tick * 0.015 + wm * 1.2) * 0.05;
      // Water stain spreading
      var stainG = ctx.createRadialGradient(wmx, wmy, 0, wmx, wmy, 8 + Math.sin(tick * 0.01 + wm) * 2);
      stainG.addColorStop(0, 'rgba(255,100,100,' + pAlpha.toFixed(3) + ')');
      stainG.addColorStop(1, 'rgba(255,100,100,0)');
      ctx.fillStyle = stainG;
      ctx.beginPath();
      ctx.arc(wmx, wmy, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===================== DUCTWORK ===================== */
  function drawDucts(g) {
    var hvacCx = g.lowerDivX + (g.wallR - g.lowerDivX) * 0.5;
    var hvacTop = g.lowerTop + g.lowerH * 0.18;
    var ductW = 6;

    ctx.save();
    // Main trunk (vertical)
    ctx.fillStyle = 'rgba(80,90,110,0.3)';
    ctx.fillRect(hvacCx - ductW / 2, g.upperTop + 5, ductW, hvacTop - g.upperTop - 5);
    // Metallic shine
    var shineG = ctx.createLinearGradient(hvacCx - ductW / 2, 0, hvacCx + ductW / 2, 0);
    shineG.addColorStop(0, 'rgba(140,160,190,0.08)');
    shineG.addColorStop(0.5, 'rgba(180,200,230,0.12)');
    shineG.addColorStop(1, 'rgba(140,160,190,0.08)');
    ctx.fillStyle = shineG;
    ctx.fillRect(hvacCx - ductW / 2, g.upperTop + 5, ductW, hvacTop - g.upperTop - 5);

    // Branches (horizontal) — draw with rounded joints
    var branchY = g.upperTop + g.upperH * 0.35;
    // Left branch
    ctx.fillStyle = 'rgba(80,90,110,0.25)';
    ctx.fillRect(g.wallL + 10, branchY - ductW / 2, hvacCx - g.wallL - 10, ductW);
    // Right branch
    ctx.fillRect(hvacCx, branchY - ductW / 2, g.wallR - hvacCx - 10, ductW);

    // Joint circles
    ctx.fillStyle = 'rgba(100,120,150,0.2)';
    ctx.beginPath();
    ctx.arc(hvacCx, branchY, ductW / 2 + 1, 0, Math.PI * 2);
    ctx.fill();

    // Duct seam lines
    ctx.strokeStyle = 'rgba(120,140,170,0.10)';
    ctx.lineWidth = 0.5;
    for (var ds = 0; ds < 6; ds++) {
      var dsy = g.upperTop + 10 + ds * ((hvacTop - g.upperTop - 15) / 5);
      ctx.beginPath();
      ctx.moveTo(hvacCx - ductW / 2, dsy);
      ctx.lineTo(hvacCx + ductW / 2, dsy);
      ctx.stroke();
    }

    // Air flow particles in ducts
    for (var dp = 0; dp < 4; dp++) {
      var dpx = g.wallL + 15 + ((tick * 0.8 + dp * 40) % (hvacCx - g.wallL - 25));
      var dpa = 0.08 + Math.sin(tick * 0.03 + dp) * 0.04;
      ctx.fillStyle = 'rgba(100,160,255,' + dpa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(dpx, branchY, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ===================== ZONE HIGHLIGHTS ===================== */
  function drawZoneHighlights() {
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var data = ZONE_DATA[zone.id];
      var isActive = activeZone === zone.id;
      var isHover = hoverZone === zone.id;
      var c = data.color;
      var rgb = c[0] + ',' + c[1] + ',' + c[2];

      if (isActive || isHover) {
        var pulseA = isActive ? 0.10 + Math.sin(tick * 0.04) * 0.04 : 0.05;

        // Front face highlight
        ctx.fillStyle = 'rgba(' + rgb + ',' + pulseA.toFixed(3) + ')';
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

        // Glowing border
        ctx.save();
        ctx.shadowColor = 'rgba(' + rgb + ',' + (isActive ? 0.5 : 0.25) + ')';
        ctx.shadowBlur = isActive ? 12 : 6;
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (isActive ? 0.5 : 0.25) + ')';
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.w - 1, zone.h - 1);
        ctx.restore();

        // Depth face highlight (right side)
        var dAlpha = pulseA * 0.6;
        var btr = bk(zone.x + zone.w, zone.y);
        var brb = bk(zone.x + zone.w, zone.y + zone.h);
        ctx.fillStyle = 'rgba(' + rgb + ',' + dAlpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(zone.x + zone.w, zone.y);
        ctx.lineTo(btr[0], btr[1]);
        ctx.lineTo(brb[0], brb[1]);
        ctx.lineTo(zone.x + zone.w, zone.y + zone.h);
        ctx.closePath();
        ctx.fill();

        // Top face highlight
        var btl = bk(zone.x, zone.y);
        ctx.fillStyle = 'rgba(' + rgb + ',' + (dAlpha * 0.8).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(zone.x, zone.y);
        ctx.lineTo(btl[0], btl[1]);
        ctx.lineTo(btr[0], btr[1]);
        ctx.lineTo(zone.x + zone.w, zone.y);
        ctx.closePath();
        ctx.fill();
      }

      // Zone label
      var labelX = zone.x + zone.w / 2;
      var labelY = zone.y + zone.h / 2;
      var fontSize = Math.max(9, Math.min(13, W * 0.016));
      ctx.save();
      ctx.font = (isActive ? '700 ' : '500 ') + fontSize + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isActive) {
        ctx.shadowColor = 'rgba(' + rgb + ',0.6)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(' + rgb + ',0.95)';
      } else if (isHover) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
      }

      // Text outline for readability
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(data.title, labelX, labelY);
      ctx.fillText(data.title, labelX, labelY);
      ctx.restore();
    }
  }

  /* ===================== MAIN LOOP ===================== */
  function loop() {
    tick++;
    ctx.clearRect(0, 0, W, H);
    updateParticles();
    drawParticles();
    drawHouse();
    requestAnimationFrame(loop);
  }

  /* ===================== HIT TESTING ===================== */
  function getZoneAt(px, py) {
    for (var i = zones.length - 1; i >= 0; i--) {
      var z = zones[i];
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
        return z.id;
      }
    }
    return null;
  }

  function canvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var cx, cy;
    if (e.touches && e.touches.length) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function showZoneInfo(zoneId) {
    if (!infoEl) return;
    if (!zoneId) {
      infoEl.innerHTML = '<div class="house-vis__info-default"><p>Tap any highlighted zone to learn what hides there.</p></div>';
      return;
    }
    var d = ZONE_DATA[zoneId];
    infoEl.innerHTML =
      '<div class="house-vis__info-detail">' +
        '<h3>' + d.title + '</h3>' +
        '<p>' + d.desc + '</p>' +
        '<a href="' + d.link + '">' + d.linkText + '</a>' +
      '</div>';
  }

  canvas.addEventListener('click', function (e) {
    var pos = canvasCoords(e);
    var hit = getZoneAt(pos.x, pos.y);
    if (hit === activeZone) { activeZone = null; showZoneInfo(null); }
    else { activeZone = hit; showZoneInfo(hit); }
  });

  canvas.addEventListener('mousemove', function (e) {
    var pos = canvasCoords(e);
    hoverZone = getZoneAt(pos.x, pos.y);
    canvas.style.cursor = hoverZone ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', function () { hoverZone = null; });

  /* ===================== INIT ===================== */
  function init() {
    resize();
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
