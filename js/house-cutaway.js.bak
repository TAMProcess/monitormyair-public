/* ============================================================
   "Where Problems Hide in Your Home" — Interactive House Cutaway
   Canvas-rendered cross-section with clickable hotspot zones.
   Shows attic, HVAC, bathroom, kitchen, crawlspace, walls, basement.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('houseCutCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var wrap = canvas.parentElement;
  var infoEl = document.getElementById('houseInfo');

  var W, H, dpr;
  var house = {};    // computed dimensions
  var zones = [];    // clickable hotspot regions
  var activeZone = null;
  var hoverZone = null;
  var animId;
  var tick = 0;

  /* ===================== ZONE DATA ===================== */
  var ZONE_DATA = {
    attic: {
      title: 'Attic & Roof Line',
      desc: 'Roof leaks, poor ventilation, and temperature differentials create condensation that feeds hidden mold on sheathing and insulation. Most homeowners never look up here — until it\'s too late.',
      link: 'pages/hidden-mold.html',
      linkText: 'Learn About Hidden Mold →',
      color: '255,180,60'
    },
    bathroom: {
      title: 'Bathroom',
      desc: 'The #1 mold hotspot. Shower steam, poor exhaust fans, and deteriorating caulk allow moisture behind walls. Surface mold you can see often indicates deeper problems you can\'t.',
      link: 'pages/mold-in-bathroom.html',
      linkText: 'Bathroom Mold Guide →',
      color: '60,200,180'
    },
    hvac: {
      title: 'HVAC System',
      desc: 'Your air handler and ductwork push air to every room. If mold colonizes the coil, drain pan, or ducts, it spreads spores throughout the entire house with every cycle.',
      link: 'pages/mold-in-hvac.html',
      linkText: 'HVAC Mold Guide →',
      color: '100,160,255'
    },
    kitchen: {
      title: 'Kitchen & Plumbing',
      desc: 'Under-sink leaks, dishwasher connections, and refrigerator lines are silent water sources. Mold thrives in dark, enclosed cabinet spaces where leaks go unnoticed for months.',
      link: 'pages/hidden-mold.html',
      linkText: 'Hidden Mold Signs →',
      color: '200,120,255'
    },
    walls: {
      title: 'Inside the Walls',
      desc: 'Plumbing leaks, condensation on cold surfaces, and wind-driven rain can saturate wall cavities. Mold grows on the back side of drywall — invisible until significant damage occurs.',
      link: 'pages/hidden-mold.html',
      linkText: 'Detecting Hidden Mold →',
      color: '255,100,100'
    },
    crawlspace: {
      title: 'Crawlspace & Foundation',
      desc: 'Ground moisture, poor vapor barriers, and standing water make crawlspaces the most consistently humid area. Mold here sends spores up through the floor system into living spaces via the stack effect.',
      link: 'pages/mold-in-crawlspace.html',
      linkText: 'Crawlspace Mold Guide →',
      color: '120,200,80'
    }
  };

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
    computeHouse();
  }

  /* ===================== COMPUTE HOUSE GEOMETRY ===================== */
  function computeHouse() {
    var pad = Math.min(40, W * 0.06);
    var houseW = W - pad * 2;
    var houseH = H - pad * 2;
    var left = pad;
    var top = pad;

    // Proportions (top to bottom):
    // Roof peak: 18% | Attic: 10% | Upper floor: 30% | Lower floor: 28% | Crawlspace: 14%
    var roofH = houseH * 0.18;
    var atticH = houseH * 0.10;
    var upperH = houseH * 0.30;
    var lowerH = houseH * 0.28;
    var crawlH = houseH * 0.14;

    var roofTop = top;
    var atticTop = top + roofH;
    var upperTop = atticTop + atticH;
    var lowerTop = upperTop + upperH;
    var crawlTop = lowerTop + lowerH;

    // Roof peak center
    var peakX = left + houseW * 0.5;
    var peakY = roofTop;
    var roofLeftX = left;
    var roofRightX = left + houseW;
    var roofBaseY = atticTop;

    // Walls
    var wallL = left + houseW * 0.04;
    var wallR = left + houseW * 0.96;
    var wallInnerW = wallR - wallL;

    // Room dividers (upper floor: bathroom left ~35%, bedroom right ~65%)
    var upperDivX = wallL + wallInnerW * 0.38;
    // Lower floor: kitchen left ~45%, HVAC closet right ~55%
    var lowerDivX = wallL + wallInnerW * 0.48;

    house = {
      left: left, top: top, w: houseW, h: houseH,
      wallL: wallL, wallR: wallR,
      peakX: peakX, peakY: peakY,
      roofLeftX: roofLeftX, roofRightX: roofRightX,
      roofBaseY: roofBaseY,
      atticTop: atticTop, atticH: atticH,
      upperTop: upperTop, upperH: upperH, upperDivX: upperDivX,
      lowerTop: lowerTop, lowerH: lowerH, lowerDivX: lowerDivX,
      crawlTop: crawlTop, crawlH: crawlH,
      bot: crawlTop + crawlH
    };

    // Build clickable zones
    zones = [
      { id: 'attic',      x: wallL, y: atticTop,    w: wallInnerW,                h: atticH },
      { id: 'bathroom',   x: wallL, y: upperTop,    w: upperDivX - wallL,         h: upperH },
      { id: 'walls',      x: upperDivX, y: upperTop, w: wallR - upperDivX,        h: upperH },
      { id: 'kitchen',    x: wallL, y: lowerTop,    w: lowerDivX - wallL,         h: lowerH },
      { id: 'hvac',       x: lowerDivX, y: lowerTop, w: wallR - lowerDivX,        h: lowerH },
      { id: 'crawlspace', x: wallL, y: crawlTop,    w: wallInnerW,                h: crawlH }
    ];
  }

  /* ===================== DRAWING HELPERS ===================== */
  function setAlpha(rgb, a) {
    return 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
  }

  /* ===================== DRAW HOUSE ===================== */
  function drawHouse() {
    var h = house;

    // ---- Sky / background gradient ----
    var skyG = ctx.createLinearGradient(0, 0, 0, H);
    skyG.addColorStop(0, 'rgba(12,18,40,0.3)');
    skyG.addColorStop(1, 'rgba(8,14,30,0.1)');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, H);

    // ---- Ground line ----
    var gndG = ctx.createLinearGradient(0, h.bot - 8, 0, h.bot + 20);
    gndG.addColorStop(0, 'rgba(60,80,50,0.3)');
    gndG.addColorStop(1, 'rgba(40,55,35,0)');
    ctx.fillStyle = gndG;
    ctx.fillRect(0, h.bot - 4, W, 30);

    // ---- Foundation / crawlspace ----
    ctx.fillStyle = 'rgba(50,45,42,0.7)';
    ctx.fillRect(h.wallL - 4, h.crawlTop, h.wallR - h.wallL + 8, h.crawlH + 4);
    // Crawl interior
    ctx.fillStyle = 'rgba(30,28,26,0.9)';
    ctx.fillRect(h.wallL + 4, h.crawlTop + 4, h.wallR - h.wallL - 8, h.crawlH - 4);
    // Vapor barrier suggestion (dashed line at bottom)
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(120,200,80,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h.wallL + 10, h.bot - 8);
    ctx.lineTo(h.wallR - 10, h.bot - 8);
    ctx.stroke();
    ctx.restore();
    // Ground moisture dots
    for (var gd = 0; gd < 8; gd++) {
      var gdx = h.wallL + 20 + gd * ((h.wallR - h.wallL - 40) / 7);
      ctx.fillStyle = 'rgba(80,140,200,0.15)';
      ctx.beginPath();
      ctx.arc(gdx, h.bot - 14 + Math.sin(tick * 0.02 + gd) * 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Lower floor (kitchen left, HVAC right) ----
    // Floor slab
    ctx.fillStyle = 'rgba(65,60,55,0.6)';
    ctx.fillRect(h.wallL - 4, h.lowerTop - 3, h.wallR - h.wallL + 8, 6);
    // Rooms
    ctx.fillStyle = 'rgba(35,32,45,0.85)';
    ctx.fillRect(h.wallL, h.lowerTop, h.lowerDivX - h.wallL, h.lowerH);
    ctx.fillStyle = 'rgba(30,35,48,0.85)';
    ctx.fillRect(h.lowerDivX, h.lowerTop, h.wallR - h.lowerDivX, h.lowerH);
    // Divider wall
    ctx.fillStyle = 'rgba(80,75,70,0.6)';
    ctx.fillRect(h.lowerDivX - 3, h.lowerTop, 6, h.lowerH);

    // Kitchen sink icon
    var ksX = h.wallL + (h.lowerDivX - h.wallL) * 0.3;
    var ksY = h.lowerTop + h.lowerH * 0.65;
    drawSink(ksX, ksY);

    // Kitchen counter
    ctx.fillStyle = 'rgba(90,80,70,0.5)';
    ctx.fillRect(h.wallL + 8, h.lowerTop + h.lowerH * 0.52, (h.lowerDivX - h.wallL) * 0.6, 4);

    // HVAC unit
    var hvacCX = h.lowerDivX + (h.wallR - h.lowerDivX) * 0.5;
    var hvacCY = h.lowerTop + h.lowerH * 0.5;
    drawHVAC(hvacCX, hvacCY);

    // ---- Upper floor (bathroom left, bedroom/walls right) ----
    // Floor
    ctx.fillStyle = 'rgba(65,60,55,0.6)';
    ctx.fillRect(h.wallL - 4, h.upperTop - 3, h.wallR - h.wallL + 8, 6);
    // Rooms
    ctx.fillStyle = 'rgba(38,35,50,0.85)';
    ctx.fillRect(h.wallL, h.upperTop, h.upperDivX - h.wallL, h.upperH);
    ctx.fillStyle = 'rgba(32,30,42,0.85)';
    ctx.fillRect(h.upperDivX, h.upperTop, h.wallR - h.upperDivX, h.upperH);
    // Divider wall
    ctx.fillStyle = 'rgba(80,75,70,0.6)';
    ctx.fillRect(h.upperDivX - 3, h.upperTop, 6, h.upperH);

    // Bathroom: shower/tub
    var bathL = h.wallL + 10;
    var bathT = h.upperTop + h.upperH * 0.3;
    var bathW = (h.upperDivX - h.wallL) * 0.35;
    var bathH = h.upperH * 0.55;
    drawShower(bathL, bathT, bathW, bathH);

    // Bedroom: bed outline
    var bedX = h.upperDivX + (h.wallR - h.upperDivX) * 0.25;
    var bedY = h.upperTop + h.upperH * 0.55;
    drawBed(bedX, bedY);

    // Wall moisture indicator (inside wall cavity)
    var wallMidX = h.wallR - 12;
    for (var wm = 0; wm < 4; wm++) {
      var wmy = h.upperTop + 20 + wm * (h.upperH - 40) / 3;
      var wmAlpha = 0.08 + Math.sin(tick * 0.015 + wm * 1.2) * 0.06;
      ctx.fillStyle = 'rgba(255,100,100,' + wmAlpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(wallMidX, wmy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Attic ----
    ctx.fillStyle = 'rgba(45,40,38,0.8)';
    ctx.beginPath();
    ctx.moveTo(h.wallL, h.atticTop + h.atticH);
    ctx.lineTo(h.wallL, h.atticTop);
    ctx.lineTo(h.wallR, h.atticTop);
    ctx.lineTo(h.wallR, h.atticTop + h.atticH);
    ctx.closePath();
    ctx.fill();

    // Insulation zigzag at attic floor
    ctx.save();
    ctx.strokeStyle = 'rgba(255,200,120,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    var insY = h.atticTop + h.atticH - 6;
    for (var iz = 0; iz < 20; iz++) {
      var izx = h.wallL + 6 + iz * ((h.wallR - h.wallL - 12) / 19);
      ctx.lineTo(izx, insY + (iz % 2 === 0 ? -4 : 4));
    }
    ctx.stroke();
    ctx.restore();

    // ---- Roof ----
    ctx.save();
    // Roof fill
    ctx.beginPath();
    ctx.moveTo(h.peakX, h.peakY);
    ctx.lineTo(h.roofLeftX - 12, h.roofBaseY);
    ctx.lineTo(h.roofRightX + 12, h.roofBaseY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(70,60,55,0.85)';
    ctx.fill();

    // Roof outline
    ctx.strokeStyle = 'rgba(160,140,120,0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Shingle lines
    ctx.strokeStyle = 'rgba(120,105,90,0.25)';
    ctx.lineWidth = 0.8;
    var shingleRows = 5;
    for (var sr = 1; sr <= shingleRows; sr++) {
      var t = sr / (shingleRows + 1);
      var sy = h.peakY + (h.roofBaseY - h.peakY) * t;
      var sxL = h.peakX + (h.roofLeftX - 12 - h.peakX) * t;
      var sxR = h.peakX + (h.roofRightX + 12 - h.peakX) * t;
      ctx.beginPath();
      ctx.moveTo(sxL, sy);
      ctx.lineTo(sxR, sy);
      ctx.stroke();
    }
    ctx.restore();

    // ---- Exterior walls ----
    ctx.strokeStyle = 'rgba(140,130,120,0.45)';
    ctx.lineWidth = 3;
    // Left wall
    ctx.beginPath();
    ctx.moveTo(h.wallL, h.atticTop);
    ctx.lineTo(h.wallL, h.bot);
    ctx.stroke();
    // Right wall
    ctx.beginPath();
    ctx.moveTo(h.wallR, h.atticTop);
    ctx.lineTo(h.wallR, h.bot);
    ctx.stroke();

    // ---- Duct lines from HVAC to rooms ----
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(100,160,255,0.18)';
    ctx.lineWidth = 2;
    // Duct up from HVAC
    ctx.beginPath();
    ctx.moveTo(hvacCX, hvacCY - 20);
    ctx.lineTo(hvacCX, h.upperTop + 5);
    // Branch left into bathroom
    ctx.moveTo(hvacCX, h.upperTop + h.upperH * 0.4);
    ctx.lineTo(h.wallL + 30, h.upperTop + h.upperH * 0.4);
    // Branch right into bedroom
    ctx.moveTo(hvacCX, h.upperTop + h.upperH * 0.4);
    ctx.lineTo(h.wallR - 20, h.upperTop + h.upperH * 0.4);
    ctx.stroke();
    ctx.restore();

    // ---- Windows ----
    // Upper right window
    var winX = h.upperDivX + (h.wallR - h.upperDivX) * 0.65;
    var winY = h.upperTop + h.upperH * 0.18;
    drawWindow(winX, winY, 28, 36);

    // Lower left window
    var winX2 = h.wallL + (h.lowerDivX - h.wallL) * 0.7;
    var winY2 = h.lowerTop + h.lowerH * 0.15;
    drawWindow(winX2, winY2, 26, 32);

    // ---- Zone highlight overlays ----
    for (var z = 0; z < zones.length; z++) {
      var zone = zones[z];
      var data = ZONE_DATA[zone.id];
      var isActive = activeZone === zone.id;
      var isHover = hoverZone === zone.id;

      if (isActive || isHover) {
        var pulseA = isActive
          ? 0.12 + Math.sin(tick * 0.04) * 0.04
          : 0.06;
        ctx.fillStyle = setAlpha(data.color, pulseA);
        ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

        // Border
        ctx.strokeStyle = setAlpha(data.color, isActive ? 0.55 : 0.30);
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.w - 1, zone.h - 1);
      }

      // Zone label (small)
      var labelX = zone.x + zone.w / 2;
      var labelY = zone.y + zone.h / 2;
      ctx.save();
      ctx.font = (isActive ? '600 ' : '500 ') + Math.max(10, Math.min(13, W * 0.018)) + 'px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive
        ? setAlpha(data.color, 0.9)
        : 'rgba(255,255,255,' + (isHover ? '0.55' : '0.30') + ')';
      if (isActive) {
        ctx.shadowColor = setAlpha(data.color, 0.4);
        ctx.shadowBlur = 8;
      }
      ctx.fillText(data.title, labelX, labelY);
      ctx.restore();
    }
  }

  /* ---- Furniture / fixture helpers ---- */
  function drawShower(x, y, w, h) {
    // Shower enclosure
    ctx.strokeStyle = 'rgba(150,200,220,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // Shower head
    ctx.fillStyle = 'rgba(180,200,210,0.4)';
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    // Water droplets (animated)
    for (var d = 0; d < 5; d++) {
      var dx = x + w * 0.4 + d * (w * 0.12);
      var dy = y + 18 + ((tick * 0.8 + d * 15) % (h - 30));
      var da = 0.12 + Math.sin(tick * 0.03 + d) * 0.08;
      ctx.fillStyle = 'rgba(100,180,220,' + da.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Steam wisps
    for (var s = 0; s < 3; s++) {
      var sx = x + w * 0.3 + s * (w * 0.2);
      var sy = y - 5 - Math.sin(tick * 0.018 + s * 2) * 8;
      var sa = 0.06 + Math.sin(tick * 0.02 + s) * 0.03;
      ctx.fillStyle = 'rgba(200,220,240,' + sa.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(sx, sy, 5 + Math.sin(tick * 0.01 + s) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBed(x, y) {
    // Simple bed outline
    var bw = 50, bh = 22;
    ctx.fillStyle = 'rgba(80,75,100,0.4)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 3);
    ctx.fill();
    // Pillow
    ctx.fillStyle = 'rgba(160,155,180,0.3)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, 14, bh - 6, 2);
    ctx.fill();
  }

  function drawSink(x, y) {
    // Simple sink basin
    ctx.strokeStyle = 'rgba(180,190,200,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI);
    ctx.stroke();
    // Faucet
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.quadraticCurveTo(x + 8, y - 14, x + 6, y - 4);
    ctx.strokeStyle = 'rgba(180,190,200,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Drip (animated)
    var dripY = y - 2 + ((tick * 0.5) % 14);
    var dripA = Math.max(0, 0.3 - ((tick * 0.5) % 14) / 20);
    ctx.fillStyle = 'rgba(100,180,220,' + dripA.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x + 5, dripY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHVAC(cx, cy) {
    var bw = 40, bh = 50;
    // Unit box
    ctx.fillStyle = 'rgba(65,75,90,0.6)';
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,160,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Fan circle
    ctx.strokeStyle = 'rgba(100,160,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy - 6, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Spinning blades
    for (var b = 0; b < 3; b++) {
      var ba = tick * 0.03 + b * (Math.PI * 2 / 3);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx + Math.cos(ba) * 10, cy - 6 + Math.sin(ba) * 10);
      ctx.strokeStyle = 'rgba(100,160,255,0.20)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Label
    ctx.font = '500 8px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(100,160,255,0.35)';
    ctx.textAlign = 'center';
    ctx.fillText('AHU', cx, cy + bh / 2 - 6);
  }

  function drawWindow(x, y, w, h) {
    ctx.fillStyle = 'rgba(80,120,160,0.12)';
    ctx.fillRect(x - w / 2, y, w, h);
    ctx.strokeStyle = 'rgba(160,185,210,0.30)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - w / 2, y, w, h);
    // Cross
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.strokeStyle = 'rgba(160,185,210,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ===================== MAIN LOOP ===================== */
  function loop() {
    tick++;
    ctx.clearRect(0, 0, W, H);
    drawHouse();
    animId = requestAnimationFrame(loop);
  }

  /* ===================== HIT TESTING ===================== */
  function getZoneAt(px, py) {
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i];
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) {
        return z.id;
      }
    }
    return null;
  }

  function canvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left),
      y: (clientY - rect.top)
    };
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

  // Click / tap
  canvas.addEventListener('click', function (e) {
    var pos = canvasCoords(e);
    var hit = getZoneAt(pos.x, pos.y);
    if (hit === activeZone) {
      activeZone = null;
      showZoneInfo(null);
    } else {
      activeZone = hit;
      showZoneInfo(hit);
    }
  });

  // Hover (desktop)
  canvas.addEventListener('mousemove', function (e) {
    var pos = canvasCoords(e);
    var hit = getZoneAt(pos.x, pos.y);
    hoverZone = hit;
    canvas.style.cursor = hit ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', function () {
    hoverZone = null;
  });

  /* ===================== INIT ===================== */
  function init() {
    resize();
    loop();
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); }, 200);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
