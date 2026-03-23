/* ================================================================
   3D Interactive House Explorer — Three.js WebGL
   Floating 3D home with orbit controls, per-room air-flow
   particle systems, detailed room interiors, and smooth
   camera focus transitions.
   ================================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Palette ────────────────────────────────────────────
const P = {
  wall:       0xf0e8dc, wallInner: 0xe8ddd0,
  floor:      0xc49a6c, floorDark: 0xa87d52,
  ceiling:    0xf5f0e8,
  roof:       0x8b5e3c, roofDark: 0x6b4423,
  foundation: 0x9a9a9a, ground: 0x6b6b5a,
  trim:       0xffffff,
  glass:      0x88ccee,
  sofa:       0x6b8e7b, bed: 0x4a7ab5,
  pillow:     0xf0f0f0, wood: 0xb07840,
  cabinet:    0xe0d0b8, counter: 0xddd5c8,
  appliance:  0xd0d0d0, tile: 0xd4e5f0,
  porcelain:  0xf5f5f5, rug: 0x8b4e6a,
  supply:     0x00ddff, ret: 0xffaa44,
  exhaust:    0xff6644, moisture: 0xccddff,
  contam:     0xff4488, fresh: 0x44ff88,
  radon:      0xaa66ff, dust: 0xddcc99,
  cyan:       0x00e5ff,
};

// ── Room definitions ───────────────────────────────────
const ROOMS = {
  living: {
    name: 'Living Room',
    desc: 'Supply vents push conditioned air in while return ducts pull it back. Dust, pet dander, and VOCs collect behind furniture and inside ductwork — feeding hidden mold colonies you never see.',
    link: 'pages/hidden-mold.html',
    color: 0x4488ff,
    camOffset: new THREE.Vector3(6, 3, 12),
    lookAt: new THREE.Vector3(-4, 2, 0),
    flows: [
      { label: 'Supply Air',    hex: '#00ddff' },
      { label: 'Return Flow',   hex: '#ffaa44' },
      { label: 'Dust Particles',hex: '#ddcc99' },
    ],
  },
  kitchen: {
    name: 'Kitchen',
    desc: 'Cooking generates VOCs, CO, and particulate matter. Moisture under the sink breeds mold. Grease in exhaust ducts traps spores. Without proper ventilation, contamination spreads to every room.',
    link: 'pages/how-to-clean-mold.html',
    color: 0xff8844,
    camOffset: new THREE.Vector3(-4, 3, 14),
    lookAt: new THREE.Vector3(4, 2, 0),
    flows: [
      { label: 'Cooking Fumes', hex: '#ff6644' },
      { label: 'Range Hood Draw',hex:'#ffaa44' },
      { label: 'Supply Air',    hex: '#00ddff' },
    ],
  },
  bedroom: {
    name: 'Bedroom',
    desc: 'You spend 8 hours breathing here. Poor filtration means dust mites, allergens, and VOCs from furniture off-gassing circulate all night — triggering headaches, congestion, and fatigue.',
    link: 'pages/is-mold-making-me-sick.html',
    color: 0x5588ff,
    camOffset: new THREE.Vector3(6, 7, 12),
    lookAt: new THREE.Vector3(-4, 6, 0),
    flows: [
      { label: 'Supply Air',   hex: '#00ddff' },
      { label: 'Circulation',  hex: '#aaddff' },
      { label: 'Dust / VOCs',  hex: '#ddcc99' },
    ],
  },
  bathroom: {
    name: 'Bathroom',
    desc: 'Daily showers create ideal mold conditions behind walls, on grout, and in exhaust ducts. A weak exhaust fan lets moisture seep into wall cavities where mold thrives unseen.',
    link: 'pages/mold-in-bathroom.html',
    color: 0x44ddaa,
    camOffset: new THREE.Vector3(-4, 7, 14),
    lookAt: new THREE.Vector3(4, 6, 0),
    flows: [
      { label: 'Steam / Moisture', hex: '#ccddff' },
      { label: 'Exhaust Fan Draw', hex: '#ffaa44' },
      { label: 'Air Under Door',   hex: '#00ddff' },
    ],
  },
  attic: {
    name: 'Attic / HVAC',
    desc: 'Ducts in unconditioned attic space lose energy and pull contaminated air through leaks at joints. Mold inside HVAC coils and drain pans gets blown into every room.',
    link: 'pages/mold-in-hvac.html',
    color: 0xffcc44,
    camOffset: new THREE.Vector3(0, 14, 16),
    lookAt: new THREE.Vector3(0, 9.5, 0),
    flows: [
      { label: 'Duct Air Flow', hex: '#00ddff' },
      { label: 'Duct Leaks',    hex: '#ff4488' },
      { label: 'Hot Attic Air',  hex: '#ff6644' },
    ],
  },
  crawlspace: {
    name: 'Crawlspace',
    desc: 'Ground moisture, radon gas, and mold spores rise through the floor. Without a sealed vapor barrier, contaminated air enters every room via the stack effect.',
    link: 'pages/mold-in-crawlspace.html',
    color: 0xaa88ff,
    camOffset: new THREE.Vector3(0, 0, 18),
    lookAt: new THREE.Vector3(0, -1, 0),
    flows: [
      { label: 'Ground Moisture', hex: '#ccddff' },
      { label: 'Radon Gas',       hex: '#aa66ff' },
      { label: 'Stack Effect',    hex: '#ffaa44' },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.r ?? 0.75, metalness: opts.m ?? 0.0,
    transparent: opts.t ?? false, opacity: opts.o ?? 1,
    side: opts.side ?? THREE.FrontSide, ...opts.extra,
  });
}

function box(w, h, d, material) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rT, rB, h, seg, material) {
  const g = new THREE.CylinderGeometry(rT, rB, h, seg);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ── Edge glow helper ───────────────────────────────────
function addEdges(mesh, color = P.cyan, opacity = 0.18) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20);
  const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color, transparent: true, opacity,
  }));
  mesh.add(line);
}

// ════════════════════════════════════════════════════════
//  HouseExplorer
// ════════════════════════════════════════════════════════
class HouseExplorer {
  constructor() {
    this.canvas = document.getElementById('houseCutCanvas');
    this.infoPanel = document.getElementById('houseInfo');
    this.overlay = document.getElementById('houseOverlay');
    this.hintEl = document.getElementById('houseHint');
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    this.roomHitBoxes = [];
    this.activeRoom = null;
    this.roofVisible = true;
    this.roofGroup = null;
    this.clock = new THREE.Clock();
    this.particleSystems = [];

    // Camera targets for smooth transitions
    this.camTarget = null;
    this.lookTarget = null;
    this.defaultCam = new THREE.Vector3(16, 13, 22);
    this.defaultLook = new THREE.Vector3(0, 3.5, 0);

    this._pointerDown = new THREE.Vector2();
    this._didDrag = false;

    this.init();
  }

  // ── Initialisation ─────────────────────────────────
  init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Camera
    const ar = (this.canvas.clientWidth || 1) / (this.canvas.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(40, ar, 0.1, 500);
    this.camera.position.copy(this.defaultCam);
    this.camera.lookAt(this.defaultLook);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.target.copy(this.defaultLook);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 55;
    this.controls.maxPolarAngle = Math.PI * 0.88;
    this.controls.update();

    // Background
    this.scene.background = new THREE.Color(0x040810);

    this.setupLighting();
    this.addStarfield();
    this.addGridPlane();
    this.buildHouse();
    this.buildRoomHitBoxes();
    this.initAirParticles();

    // Events
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
    this.canvas.addEventListener('pointermove', (e) => this.onHover(e));
    window.addEventListener('resize', () => this.resize());

    const resetBtn = document.getElementById('houseResetBtn');
    const roofBtn = document.getElementById('houseRoofBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetView());
    if (roofBtn) roofBtn.addEventListener('click', () => this.toggleRoof());

    this.resize();
    this.setupScrollEntrance();
    this.animate();
  }

  // ── Scroll entrance animation ──────────────────────
  setupScrollEntrance() {
    if (!this.houseGroup) return;
    this.houseGroup.scale.set(0.01, 0.01, 0.01);
    this._entranceDone = false;
    this._entranceProgress = 0;

    const section = this.canvas.closest('.house-vis') || this.canvas.parentElement;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this._entranceDone) {
        this._entranceStarted = true;
      }
    }, { threshold: 0.15 });
    observer.observe(section);
  }

  // ── Lighting ───────────────────────────────────────
  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.65));
    this.scene.add(new THREE.HemisphereLight(0x99bbdd, 0x886644, 0.35));

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.3);
    sun.position.set(14, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -6;
    sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xaabbee, 0.35);
    fill.position.set(-12, 10, -8);
    this.scene.add(fill);

    // Interior warm glow per room
    [[-4,2.8,1],[4,2.8,1],[-4,6.8,1],[4,6.8,1]].forEach(([x,y,z]) => {
      const p = new THREE.PointLight(0xfff4e0, 0.45, 10);
      p.position.set(x, y, z);
      this.scene.add(p);
    });
  }

  // ── Starfield ──────────────────────────────────────
  addStarfield() {
    const n = 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 250;
      pos[i*3+1] = (Math.random() - 0.5) * 250;
      pos[i*3+2] = (Math.random() - 0.5) * 250;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(bg, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.18, transparent: true, opacity: 0.55,
      sizeAttenuation: true,
    })));
  }

  // ── Ground grid ────────────────────────────────────
  addGridPlane() {
    const grid = new THREE.GridHelper(60, 60, 0x112233, 0x0a1525);
    grid.position.y = -2.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.25;
    this.scene.add(grid);
  }

  // ════════════════════════════════════════════════════
  //  BUILD HOUSE
  // ════════════════════════════════════════════════════
  buildHouse() {
    const house = new THREE.Group();
    this.houseGroup = house;

    const wM = mat(P.wall);
    const wI = mat(P.wallInner);
    const flM = mat(P.floor, { r: 0.65 });
    const cM = mat(P.ceiling, { r: 0.85 });
    const fndM = mat(P.foundation, { r: 0.95 });
    const T = 0.25; // wall thickness

    // ── Exterior walls ──
    // Back wall
    const back = box(16 + T, 8, T, wM);
    back.position.set(0, 4, -5);
    house.add(back);
    addEdges(back);

    // Left wall
    const left = box(T, 8, 10, wM);
    left.position.set(-8, 4, 0);
    house.add(left);
    addEdges(left);

    // Right wall
    const right = box(T, 8, 10, wM);
    right.position.set(8, 4, 0);
    house.add(right);
    addEdges(right);

    // Front wall (transparent cutaway so you can see inside)
    const frontWall = box(16 + T, 8, T, mat(P.wall, { t: true, o: 0.08 }));
    frontWall.position.set(0, 4, 5);
    house.add(frontWall);

    // Centre dividing wall (vertical)
    const divV = box(T, 8, 10, wI);
    divV.position.set(0, 4, 0);
    house.add(divV);

    // ── Floors ──
    // Ground slab
    const slab = box(16, T, 10, flM);
    slab.position.set(0, 0, 0);
    slab.receiveShadow = true;
    house.add(slab);

    // Second floor / ceiling of ground floor
    const floor2 = box(16, T, 10, flM);
    floor2.position.set(0, 4, 0);
    floor2.receiveShadow = true;
    house.add(floor2);

    // Attic floor
    const atticFloor = box(16, T, 10, cM);
    atticFloor.position.set(0, 8, 0);
    house.add(atticFloor);

    // ── Foundation / Crawlspace ──
    const fndL = box(T, 2, 10, fndM);
    fndL.position.set(-8, -1, 0);
    house.add(fndL);
    const fndR = box(T, 2, 10, fndM);
    fndR.position.set(8, -1, 0);
    house.add(fndR);
    const fndB = box(16, 2, T, fndM);
    fndB.position.set(0, -1, -5);
    house.add(fndB);

    // Ground plane (crawl)
    const crawlGnd = box(16, 0.1, 10, mat(P.ground, { r: 1 }));
    crawlGnd.position.set(0, -2, 0);
    crawlGnd.receiveShadow = true;
    house.add(crawlGnd);

    // Foundation piers
    const pierM = mat(P.foundation, { r: 0.9 });
    [[-4,-1,0],[0,-1,0],[4,-1,0],[-4,-1,-3],[4,-1,-3],[0,-1,3]].forEach(([x,y,z]) => {
      const p = cyl(0.3, 0.35, 2, 8, pierM);
      p.position.set(x, y, z);
      house.add(p);
    });

    // Vapor barrier
    const vapor = box(14, 0.02, 8, mat(0x556677, { t: true, o: 0.3, r: 0.4 }));
    vapor.position.set(0, -1.9, 0);
    house.add(vapor);

    // ── Roof ──
    this.roofGroup = new THREE.Group();
    const roofM = mat(P.roof, { r: 0.85 });
    const roofDM = mat(P.roofDark, { r: 0.85 });

    // Left slope
    const slopeL = box(8.5, 0.2, 10.6, roofM);
    slopeL.position.set(-4, 9.5, 0);
    slopeL.rotation.z = Math.PI * 0.17;
    this.roofGroup.add(slopeL);
    addEdges(slopeL, P.cyan, 0.12);

    // Right slope
    const slopeR = box(8.5, 0.2, 10.6, roofDM);
    slopeR.position.set(4, 9.5, 0);
    slopeR.rotation.z = -Math.PI * 0.17;
    this.roofGroup.add(slopeR);
    addEdges(slopeR, P.cyan, 0.12);

    // Ridge cap
    const ridge = box(0.4, 0.15, 10.8, mat(P.roofDark, { r: 0.7 }));
    ridge.position.set(0, 10.8, 0);
    this.roofGroup.add(ridge);

    // Gable walls (triangular — approximated with box)
    const gableM = mat(P.wall);
    const gF = box(16, 3, 0.15, gableM);
    gF.position.set(0, 9.5, 5);
    // Clip with a more interesting look — leave as box for simplicity
    this.roofGroup.add(gF);
    const gB = box(16, 3, 0.15, gableM);
    gB.position.set(0, 9.5, -5);
    this.roofGroup.add(gB);

    house.add(this.roofGroup);

    // ── Windows in back wall ──
    this.addWindow(house, -5, 2, -4.8, 1.6, 1.6);
    this.addWindow(house, -3, 2, -4.8, 1.6, 1.6);
    this.addWindow(house, 3, 2, -4.8, 1.6, 1.6);
    this.addWindow(house, 5, 2, -4.8, 1.6, 1.6);
    this.addWindow(house, -5, 6, -4.8, 1.6, 1.6);
    this.addWindow(house, -3, 6, -4.8, 1.6, 1.6);
    this.addWindow(house, 3, 6.3, -4.8, 1.0, 1.0);
    this.addWindow(house, 5, 6, -4.8, 1.6, 1.6);

    // ── Room interiors ──
    this.buildLivingRoom(house);
    this.buildKitchen(house);
    this.buildBedroom(house);
    this.buildBathroom(house);
    this.buildAttic(house);
    this.buildCrawlspaceDetails(house);
    this.buildProblemIndicators(house);

    this.scene.add(house);
  }

  // ── Window ─────────────────────────────────────────
  addWindow(parent, x, y, z, w, h) {
    const frameM = mat(P.trim, { r: 0.4 });
    const glassM = mat(P.glass, { t: true, o: 0.25, r: 0.1, m: 0.1 });

    // Frame
    const fT = 0.08;
    const top = box(w + 0.16, fT, 0.12, frameM);
    top.position.set(x, y + h / 2, z + 0.1);
    parent.add(top);
    const bot = box(w + 0.16, fT, 0.12, frameM);
    bot.position.set(x, y - h / 2, z + 0.1);
    parent.add(bot);
    const lf = box(fT, h, 0.12, frameM);
    lf.position.set(x - w / 2, y, z + 0.1);
    parent.add(lf);
    const rf = box(fT, h, 0.12, frameM);
    rf.position.set(x + w / 2, y, z + 0.1);
    parent.add(rf);

    // Mullion (cross)
    const mH = box(w, 0.04, 0.06, frameM);
    mH.position.set(x, y, z + 0.12);
    parent.add(mH);
    const mV = box(0.04, h, 0.06, frameM);
    mV.position.set(x, y, z + 0.12);
    parent.add(mV);

    // Glass pane
    const pane = box(w, h, 0.03, glassM);
    pane.position.set(x, y, z + 0.06);
    parent.add(pane);

    // Sill
    const sill = box(w + 0.3, 0.06, 0.25, frameM);
    sill.position.set(x, y - h / 2 - 0.03, z + 0.15);
    parent.add(sill);
  }

  // ═══════════════════════════════════════════════════
  //  ROOM INTERIORS
  // ═══════════════════════════════════════════════════

  // ── Living Room (left, ground) ─────────────────────
  buildLivingRoom(parent) {
    const g = new THREE.Group();
    const wdM = mat(P.wood, { r: 0.6 });
    const sofaM = mat(P.sofa);
    const rugM = mat(P.rug, { r: 0.9 });
    const applM = mat(P.appliance, { r: 0.3, m: 0.4 });

    // Rug
    const rug = box(4, 0.04, 3, rugM);
    rug.position.set(-4, 0.15, 1);
    g.add(rug);

    // Sofa (against back wall)
    const sofaBase = box(3, 0.55, 1, sofaM);
    sofaBase.position.set(-4.5, 0.4, -3.5);
    g.add(sofaBase);
    const sofaBack = box(3, 0.6, 0.25, sofaM);
    sofaBack.position.set(-4.5, 0.9, -4.1);
    g.add(sofaBack);
    const armL = box(0.25, 0.4, 1, sofaM);
    armL.position.set(-5.9, 0.55, -3.5);
    g.add(armL);
    const armR = box(0.25, 0.4, 1, sofaM);
    armR.position.set(-3.1, 0.55, -3.5);
    g.add(armR);
    // Cushions
    [[-5,-4,-3.5],[-4,-4,-3.5]].forEach(([x,y,z]) => {
      const c = box(0.85, 0.12, 0.85, mat(0x5a7e6b));
      c.position.set(x, 0.73, z);
      g.add(c);
    });

    // Coffee table
    const ctTop = box(1.4, 0.08, 0.7, wdM);
    ctTop.position.set(-4.5, 0.5, -1.8);
    g.add(ctTop);
    [[-5.1,0.24,-2.05],[-3.9,0.24,-2.05],[-5.1,0.24,-1.55],[-3.9,0.24,-1.55]].forEach(([x,y,z]) => {
      const leg = box(0.06, 0.48, 0.06, wdM);
      leg.position.set(x, y, z);
      g.add(leg);
    });

    // TV stand + TV
    const tvStand = box(2, 0.6, 0.5, wdM);
    tvStand.position.set(-4, 0.3, 3.5);
    g.add(tvStand);
    const tv = box(2.2, 1.4, 0.08, mat(0x111111, { r: 0.2, m: 0.3 }));
    tv.position.set(-4, 1.5, 3.5);
    g.add(tv);
    // Screen glow
    const screen = box(2.0, 1.2, 0.01, mat(0x334466, { r: 0.1 }));
    screen.position.set(-4, 1.5, 3.46);
    g.add(screen);

    // Bookshelf (right side)
    const shelf = box(0.8, 2.5, 0.4, wdM);
    shelf.position.set(-1, 1.25, -3.8);
    g.add(shelf);
    // Shelf dividers
    for (let i = 0; i < 4; i++) {
      const sd = box(0.75, 0.04, 0.38, wdM);
      sd.position.set(-1, 0.15 + i * 0.7, -3.8);
      g.add(sd);
    }
    // Books (colored blocks on shelves)
    const bookColors = [0xcc4444, 0x4466cc, 0x44aa66, 0xcc8844, 0x8844aa];
    for (let s = 0; s < 3; s++) {
      for (let b = 0; b < 3; b++) {
        const bk = box(0.15, 0.45, 0.25, mat(bookColors[(s*3+b) % bookColors.length]));
        bk.position.set(-1.2 + b * 0.22, 0.4 + s * 0.7, -3.8);
        g.add(bk);
      }
    }

    // Floor lamp (far left)
    const pole = cyl(0.04, 0.04, 2.2, 8, mat(0x888888, { m: 0.5, r: 0.3 }));
    pole.position.set(-7, 1.1, 3);
    g.add(pole);
    const shade = cyl(0.3, 0.45, 0.35, 12, mat(0xfff8e0, { t: true, o: 0.8 }));
    shade.position.set(-7, 2.4, 3);
    g.add(shade);
    // Lamp glow
    const glow = new THREE.PointLight(0xffe8c0, 0.3, 4);
    glow.position.set(-7, 2.4, 3);
    g.add(glow);

    // Supply vent (floor, on inner wall)
    this.addVent(g, -0.3, 0.2, 2, 0.6, 0.3, false);
    // Return vent (high on wall)
    this.addVent(g, -4, 3.5, 4.8, 0.8, 0.3, true);

    parent.add(g);
  }

  // ── Kitchen (right, ground) ────────────────────────
  buildKitchen(parent) {
    const g = new THREE.Group();
    const cabM = mat(P.cabinet);
    const cntM = mat(P.counter, { r: 0.4 });
    const appM = mat(P.appliance, { r: 0.25, m: 0.5 });
    const wdM = mat(P.wood, { r: 0.6 });

    // Lower cabinets (along back wall)
    const lowerCab = box(6, 1.1, 0.8, cabM);
    lowerCab.position.set(5, 0.55, -4.2);
    g.add(lowerCab);
    // Cabinet doors
    for (let i = 0; i < 4; i++) {
      const door = box(1.3, 0.95, 0.04, mat(P.cabinet));
      door.position.set(2.8 + i * 1.45, 0.55, -3.78);
      g.add(door);
      // Knobs
      const knob = cyl(0.03, 0.03, 0.06, 8, mat(0xaaaaaa, { m: 0.6 }));
      knob.position.set(2.8 + i * 1.45 + 0.35, 0.55, -3.75);
      knob.rotation.x = Math.PI / 2;
      g.add(knob);
    }

    // Countertop
    const counter = box(6.2, 0.1, 0.9, cntM);
    counter.position.set(5, 1.15, -4.15);
    g.add(counter);

    // Upper cabinets
    const upperCab = box(4, 0.9, 0.5, cabM);
    upperCab.position.set(4.5, 3.0, -4.4);
    g.add(upperCab);

    // Stove
    const stove = box(0.8, 1.1, 0.7, appM);
    stove.position.set(4, 0.55, -4.25);
    g.add(stove);
    // Burners
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const burner = cyl(0.12, 0.12, 0.02, 16, mat(0x333333, { r: 0.4 }));
        burner.position.set(3.8 + i * 0.35, 1.13, -4.1 + j * 0.3 - 0.15);
        g.add(burner);
      }
    }

    // Range hood
    const hood = box(1.2, 0.35, 0.6, appM);
    hood.position.set(4, 2.3, -4.3);
    g.add(hood);
    const hoodTrap = box(0.9, 0.08, 0.5, mat(0xbbbbbb, { m: 0.4 }));
    hoodTrap.position.set(4, 2.1, -4.3);
    g.add(hoodTrap);

    // Refrigerator
    const fridge = box(1, 2.2, 0.9, appM);
    fridge.position.set(7.2, 1.1, -4.1);
    g.add(fridge);
    // Fridge handle
    const handle = box(0.04, 0.8, 0.06, mat(0x999999, { m: 0.6 }));
    handle.position.set(6.8, 1.3, -3.6);
    g.add(handle);

    // Sink (in counter)
    const sink = box(0.6, 0.15, 0.4, mat(0xcccccc, { m: 0.5, r: 0.2 }));
    sink.position.set(5.5, 1.1, -4.15);
    g.add(sink);
    // Faucet
    const faucetBase = cyl(0.03, 0.04, 0.35, 8, mat(0xcccccc, { m: 0.7 }));
    faucetBase.position.set(5.5, 1.35, -4.4);
    g.add(faucetBase);
    const faucetArm = box(0.03, 0.03, 0.25, mat(0xcccccc, { m: 0.7 }));
    faucetArm.position.set(5.5, 1.52, -4.25);
    g.add(faucetArm);

    // Kitchen island
    const island = box(2, 1.2, 1.2, cabM);
    island.position.set(4, 0.6, 0);
    g.add(island);
    const islandTop = box(2.2, 0.08, 1.3, cntM);
    islandTop.position.set(4, 1.22, 0);
    g.add(islandTop);

    // Bar stools
    for (let i = 0; i < 2; i++) {
      const seat = cyl(0.25, 0.22, 0.08, 12, wdM);
      seat.position.set(3.5 + i * 1, 0.9, 1);
      g.add(seat);
      const stoolLeg = cyl(0.04, 0.04, 0.85, 6, mat(0x888888, { m: 0.4 }));
      stoolLeg.position.set(3.5 + i * 1, 0.45, 1);
      g.add(stoolLeg);
    }

    // Tile backsplash
    const splash = box(6, 1.5, 0.06, mat(P.tile, { r: 0.3 }));
    splash.position.set(5, 1.9, -4.72);
    g.add(splash);

    // Supply vent
    this.addVent(g, 0.3, 0.2, 0, 0.6, 0.3, false);

    parent.add(g);
  }

  // ── Bedroom (left, upper) ──────────────────────────
  buildBedroom(parent) {
    const g = new THREE.Group();
    const wdM = mat(P.wood, { r: 0.6 });
    const bedM = mat(P.bed);

    // Bed
    const bedBase = box(2.4, 0.45, 3.2, wdM);
    bedBase.position.set(-5, 4.35, -1.5);
    g.add(bedBase);
    // Mattress
    const mattress = box(2.2, 0.25, 3, mat(0xf0f0f0, { r: 0.9 }));
    mattress.position.set(-5, 4.7, -1.5);
    g.add(mattress);
    // Blanket
    const blanket = box(2.2, 0.1, 2.2, bedM);
    blanket.position.set(-5, 4.88, -1.1);
    g.add(blanket);
    // Pillows
    const pillowM = mat(P.pillow, { r: 0.9 });
    const p1 = box(0.9, 0.15, 0.5, pillowM);
    p1.position.set(-5.4, 4.88, -2.7);
    g.add(p1);
    const p2 = box(0.9, 0.15, 0.5, pillowM);
    p2.position.set(-4.6, 4.88, -2.7);
    g.add(p2);
    // Headboard
    const headboard = box(2.6, 1.2, 0.15, wdM);
    headboard.position.set(-5, 5, -3.1);
    g.add(headboard);

    // Nightstands
    for (const x of [-6.5, -3.5]) {
      const ns = box(0.6, 0.6, 0.5, wdM);
      ns.position.set(x, 4.3, -2.8);
      g.add(ns);
      // Drawer
      const dr = box(0.5, 0.2, 0.04, mat(P.cabinet));
      dr.position.set(x, 4.35, -2.52);
      g.add(dr);
    }

    // Desk lamp
    const lampBase = cyl(0.12, 0.15, 0.08, 12, mat(0x888888, { m: 0.5 }));
    lampBase.position.set(-6.5, 4.65, -2.8);
    g.add(lampBase);
    const lampStem = cyl(0.02, 0.02, 0.5, 8, mat(0x888888, { m: 0.5 }));
    lampStem.position.set(-6.5, 4.95, -2.8);
    g.add(lampStem);
    const lampShade = cyl(0.12, 0.2, 0.18, 12, mat(0xffeedd, { t: true, o: 0.85 }));
    lampShade.position.set(-6.5, 5.3, -2.8);
    g.add(lampShade);

    // Dresser
    const dresser = box(1.6, 1.1, 0.6, wdM);
    dresser.position.set(-2, 4.55, 3.5);
    g.add(dresser);
    for (let i = 0; i < 3; i++) {
      const dd = box(1.4, 0.28, 0.04, mat(P.cabinet));
      dd.position.set(-2, 4.2 + i * 0.33, 3.82);
      g.add(dd);
      const dh = box(0.2, 0.04, 0.04, mat(0xaaaaaa, { m: 0.5 }));
      dh.position.set(-2, 4.2 + i * 0.33, 3.86);
      g.add(dh);
    }

    // Closet (recessed box in side wall)
    const closet = box(2, 3, 0.1, mat(P.wallInner));
    closet.position.set(-7.85, 5.5, 2);
    g.add(closet);
    // Closet door
    const cDoor = box(0.9, 2.6, 0.06, mat(P.wall));
    cDoor.position.set(-7.82, 5.4, 1.5);
    g.add(cDoor);
    const cDoor2 = box(0.9, 2.6, 0.06, mat(P.wall));
    cDoor2.position.set(-7.82, 5.4, 2.5);
    g.add(cDoor2);

    // Rug
    const rug = box(2, 0.03, 1.5, mat(0x6b6e99, { r: 0.9 }));
    rug.position.set(-5, 4.14, 1);
    g.add(rug);

    // Supply vent
    this.addVent(g, -0.3, 4.2, 2, 0.6, 0.3, false);

    parent.add(g);
  }

  // ── Bathroom (right, upper) ────────────────────────
  buildBathroom(parent) {
    const g = new THREE.Group();
    const tileM = mat(P.tile, { r: 0.3 });
    const porcM = mat(P.porcelain, { r: 0.3 });

    // Tile floor section
    const tf = box(7.5, 0.06, 9.5, tileM);
    tf.position.set(4, 4.16, 0);
    g.add(tf);

    // Bathtub / shower (back left of bathroom)
    const tub = box(2.5, 0.8, 1.2, porcM);
    tub.position.set(2.5, 4.5, -3.5);
    g.add(tub);
    // Tub inside (darker)
    const tubIn = box(2.2, 0.6, 1, mat(0xe8e8e8));
    tubIn.position.set(2.5, 4.55, -3.5);
    g.add(tubIn);

    // Shower glass panel
    const glassM = mat(P.glass, { t: true, o: 0.18, r: 0.05 });
    const showerGlass = box(0.04, 2.5, 1.2, glassM);
    showerGlass.position.set(3.8, 5.35, -3.5);
    g.add(showerGlass);
    // Shower head
    const shHead = cyl(0.12, 0.1, 0.04, 12, mat(0xcccccc, { m: 0.7 }));
    shHead.position.set(2.5, 7.2, -4.3);
    g.add(shHead);
    const shArm = box(0.04, 0.04, 0.4, mat(0xcccccc, { m: 0.7 }));
    shArm.position.set(2.5, 7.2, -4.5);
    g.add(shArm);
    // Tile wall behind shower
    const shTile = box(2.5, 3, 0.06, mat(0xc8dce8, { r: 0.25 }));
    shTile.position.set(2.5, 5.6, -4.72);
    g.add(shTile);

    // Toilet
    const toiletBase = box(0.5, 0.5, 0.6, porcM);
    toiletBase.position.set(6, 4.38, -3.5);
    g.add(toiletBase);
    const toiletBowl = cyl(0.22, 0.25, 0.2, 12, porcM);
    toiletBowl.position.set(6, 4.7, -3.3);
    g.add(toiletBowl);
    const toiletTank = box(0.45, 0.6, 0.25, porcM);
    toiletTank.position.set(6, 4.8, -3.8);
    g.add(toiletTank);
    const toiletLid = box(0.42, 0.04, 0.35, porcM);
    toiletLid.position.set(6, 4.85, -3.35);
    g.add(toiletLid);

    // Vanity
    const vanity = box(1.6, 1.0, 0.6, mat(P.cabinet));
    vanity.position.set(6, 4.5, 2);
    g.add(vanity);
    // Vanity top
    const vTop = box(1.7, 0.06, 0.7, mat(P.counter, { r: 0.35 }));
    vTop.position.set(6, 5.03, 2);
    g.add(vTop);
    // Sink bowl
    const sinkB = cyl(0.2, 0.25, 0.1, 12, porcM);
    sinkB.position.set(6, 5, 2);
    g.add(sinkB);
    // Mirror
    const mirror = box(1.4, 1.2, 0.04, mat(0xddeeff, { r: 0.05, m: 0.6 }));
    mirror.position.set(6, 6, 2);
    g.add(mirror);

    // Exhaust fan (ceiling disc)
    const fanHousing = cyl(0.35, 0.35, 0.08, 16, mat(P.porcelain, { r: 0.4 }));
    fanHousing.position.set(4, 7.92, -1);
    g.add(fanHousing);
    const fanGrill = cyl(0.3, 0.3, 0.02, 16, mat(0xdddddd, { r: 0.3 }));
    fanGrill.position.set(4, 7.88, -1);
    g.add(fanGrill);

    // Towel rack
    const rack = box(0.04, 0.04, 0.8, mat(0xcccccc, { m: 0.6 }));
    rack.position.set(7.85, 5.5, 0);
    g.add(rack);
    // Towel (draped box)
    const towel = box(0.02, 0.6, 0.5, mat(0x5588aa, { r: 0.9 }));
    towel.position.set(7.82, 5.2, 0);
    g.add(towel);

    parent.add(g);
  }

  // ── Attic / HVAC ──────────────────────────────────
  buildAttic(parent) {
    const g = new THREE.Group();
    const ductM = mat(0xaabbcc, { r: 0.35, m: 0.5 });

    // HVAC air handler
    const hvac = box(2, 1.5, 1.5, mat(P.appliance, { r: 0.3, m: 0.4 }));
    hvac.position.set(-3, 8.85, 0);
    g.add(hvac);
    addEdges(hvac, 0x00e5ff, 0.25);
    // Label
    const labelGeo = new THREE.PlaneGeometry(1.5, 0.3);
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256; labelCanvas.height = 48;
    const lCtx = labelCanvas.getContext('2d');
    lCtx.fillStyle = '#1a2a3a';
    lCtx.fillRect(0, 0, 256, 48);
    lCtx.fillStyle = '#00e5ff';
    lCtx.font = 'bold 22px sans-serif';
    lCtx.textAlign = 'center';
    lCtx.fillText('AIR HANDLER', 128, 32);
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(-3, 9.2, 0.76);
    g.add(labelMesh);

    // Fan representation
    const fan = cyl(0.4, 0.4, 0.05, 16, mat(0x445566, { m: 0.5 }));
    fan.position.set(-3, 9.6, 0);
    fan.rotation.x = Math.PI / 2;
    this.hvacFan = fan;
    g.add(fan);
    // Fan blades
    const bladeG = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = box(0.08, 0.35, 0.02, mat(0x667788, { m: 0.4 }));
      blade.position.set(0, 0.17, 0);
      const wrapper = new THREE.Group();
      wrapper.add(blade);
      wrapper.rotation.z = (Math.PI / 2) * i;
      bladeG.add(wrapper);
    }
    bladeG.position.copy(fan.position);
    bladeG.position.z += 0.05;
    this.fanBlades = bladeG;
    g.add(bladeG);

    // Main duct trunk
    const trunk = box(10, 0.6, 0.6, ductM);
    trunk.position.set(1, 8.5, 0);
    g.add(trunk);
    addEdges(trunk, 0x00aacc, 0.15);
    // Duct seams
    for (let i = 0; i < 5; i++) {
      const seam = box(0.03, 0.62, 0.62, mat(0x8899aa, { m: 0.4 }));
      seam.position.set(-2 + i * 2.5, 8.5, 0);
      g.add(seam);
    }

    // Branch ducts going down to rooms
    const branchPositions = [[-4, 8.2, 0], [4, 8.2, 0], [-4, 8.2, 2], [4, 8.2, -2]];
    branchPositions.forEach(([x, y, z]) => {
      const branch = cyl(0.2, 0.2, 0.5, 8, ductM);
      branch.position.set(x, y, z);
      g.add(branch);
      // Joint ring
      const joint = cyl(0.25, 0.25, 0.06, 12, mat(0x99aabb, { m: 0.5 }));
      joint.position.set(x, y + 0.25, z);
      g.add(joint);
    });

    // Insulation (wavy blocks on attic floor)
    const insM = mat(0xeedd99, { r: 1.0 });
    for (let i = 0; i < 6; i++) {
      const ins = box(2.2, 0.3, 9, insM);
      ins.position.set(-6.5 + i * 2.6, 8.25, 0);
      ins.scale.y = 0.8 + Math.random() * 0.4;
      g.add(ins);
    }

    parent.add(g);
  }

  // ── Crawlspace details ─────────────────────────────
  buildCrawlspaceDetails(parent) {
    const g = new THREE.Group();
    const pipeM = mat(0x88aacc, { r: 0.3, m: 0.5 });

    // Pipes running horizontally
    const pipe1 = cyl(0.08, 0.08, 14, 8, pipeM);
    pipe1.rotation.z = Math.PI / 2;
    pipe1.position.set(0, -0.6, -2);
    g.add(pipe1);
    const pipe2 = cyl(0.06, 0.06, 14, 8, mat(0x99bb99, { r: 0.3, m: 0.4 }));
    pipe2.rotation.z = Math.PI / 2;
    pipe2.position.set(0, -0.8, 2);
    g.add(pipe2);

    // Electrical conduit
    const conduit = cyl(0.03, 0.03, 10, 6, mat(0xdddddd, { m: 0.4 }));
    conduit.rotation.z = Math.PI / 2;
    conduit.position.set(0, -0.3, -3.5);
    g.add(conduit);

    parent.add(g);
  }

  // ── Problem Indicators (mold, moisture, stains) ────
  buildProblemIndicators(parent) {
    const moldM = mat(0x2a4a2a, { r: 1.0 });
    const stainM = mat(0x8b7355, { r: 0.9, t: true, o: 0.7 });
    const moistM = mat(0x6688aa, { r: 0.4, t: true, o: 0.5 });
    const pulseMeshes = [];

    // — Bathroom: mold on grout behind tub, water stain on ceiling —
    const bathMold1 = box(1.8, 0.8, 0.03, moldM);
    bathMold1.position.set(2.5, 5.2, -4.68);
    parent.add(bathMold1);
    pulseMeshes.push(bathMold1);

    const bathMold2 = box(0.6, 0.4, 0.03, moldM);
    bathMold2.position.set(3.6, 4.6, -4.68);
    parent.add(bathMold2);

    // Ceiling water stain (above tub area)
    const bathStain = cyl(0.6, 0.5, 0.02, 12, stainM);
    bathStain.position.set(3, 7.9, -2);
    parent.add(bathStain);

    // — Kitchen: moisture under sink, stain on wall —
    const kitchenMoist = box(0.5, 0.04, 0.35, moistM);
    kitchenMoist.position.set(5.5, 0.16, -4.15);
    parent.add(kitchenMoist);

    const kitchenStain = box(0.4, 0.6, 0.03, stainM);
    kitchenStain.position.set(5.5, 0.6, -4.68);
    parent.add(kitchenStain);
    pulseMeshes.push(kitchenStain);

    // — Living room: mold behind bookshelf area —
    const livingMold = box(0.7, 0.5, 0.03, moldM);
    livingMold.position.set(-1, 0.4, -4.68);
    parent.add(livingMold);

    // — Bedroom: VOC haze near dresser (off-gassing indicator) —
    const vocHaze = box(1.8, 0.8, 0.8, mat(0xddcc66, { t: true, o: 0.06 }));
    vocHaze.position.set(-2, 5.2, 3.5);
    parent.add(vocHaze);

    // — Attic: duct leak stain, mold on sheathing —
    const atticMold = box(2, 0.03, 1.5, moldM);
    atticMold.position.set(2, 8.15, -3);
    parent.add(atticMold);
    pulseMeshes.push(atticMold);

    const ductStain = box(0.4, 0.03, 0.4, stainM);
    ductStain.position.set(-1, 8.15, 0.5);
    parent.add(ductStain);

    // — Crawlspace: moisture on foundation, mold on joists —
    const crawlMold = box(3, 0.03, 0.3, moldM);
    crawlMold.position.set(-2, -0.05, -2);
    parent.add(crawlMold);

    const crawlMoist = box(4, 0.03, 3, moistM);
    crawlMoist.position.set(1, -1.85, 1);
    parent.add(crawlMoist);
    pulseMeshes.push(crawlMoist);

    // Dripping pipe indicator (small spheres under pipe joint)
    const dropM = mat(0x6699cc, { t: true, o: 0.6 });
    for (let i = 0; i < 3; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), dropM);
      drop.position.set(2 + i * 0.12, -0.9 - i * 0.15, -2);
      parent.add(drop);
    }

    this._problemPulseMeshes = pulseMeshes;
  }

  // ── Vent helper ────────────────────────────────────
  addVent(parent, x, y, z, w, h, isReturn) {
    const ventM = mat(isReturn ? 0xcccccc : 0xdddddd, { r: 0.3, m: 0.3 });
    const vent = box(w, h, 0.04, ventM);
    vent.position.set(x, y, z);
    parent.add(vent);
    // Slats
    const slats = 4;
    for (let i = 0; i < slats; i++) {
      const slat = box(w * 0.85, 0.02, 0.02, ventM);
      slat.position.set(x, y - h * 0.35 + i * (h * 0.7 / (slats - 1)), z + 0.02);
      parent.add(slat);
    }
  }

  // ════════════════════════════════════════════════════
  //  ROOM HIT BOXES (for raycasting)
  // ════════════════════════════════════════════════════
  buildRoomHitBoxes() {
    const hitM = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false,
    });
    const rooms = [
      { id: 'living',     pos: [-4, 2, 0],     size: [7.5, 3.8, 9.5] },
      { id: 'kitchen',    pos: [4, 2, 0],      size: [7.5, 3.8, 9.5] },
      { id: 'bedroom',    pos: [-4, 6, 0],     size: [7.5, 3.8, 9.5] },
      { id: 'bathroom',   pos: [4, 6, 0],      size: [7.5, 3.8, 9.5] },
      { id: 'attic',      pos: [0, 9, 0],      size: [15, 2.5, 9.5] },
      { id: 'crawlspace', pos: [0, -1, 0],     size: [15, 1.8, 9.5] },
    ];
    rooms.forEach(({ id, pos, size }) => {
      const g = new THREE.BoxGeometry(...size);
      const m = new THREE.Mesh(g, hitM);
      m.position.set(...pos);
      m.userData.roomId = id;
      this.roomHitBoxes.push(m);
      this.scene.add(m);
    });
  }

  // ════════════════════════════════════════════════════
  //  AIR FLOW PARTICLES
  // ════════════════════════════════════════════════════
  initAirParticles() {
    // We create flow paths for each room + ambient
    this.flowDefs = this.defineAllFlows();
    this.activeFlowIds = ['ambient'];
    this.particles = [];

    const MAX = 900;
    this.pPositions = new Float32Array(MAX * 3);
    this.pColors = new Float32Array(MAX * 3);
    this.pSizes = new Float32Array(MAX);

    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(this.pPositions, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(this.pColors, 3));
    bg.setAttribute('size', new THREE.BufferAttribute(this.pSizes, 1));

    this.pMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.pMesh = new THREE.Points(bg, this.pMat);
    this.scene.add(this.pMesh);

    // Spawn initial particles
    for (let i = 0; i < MAX; i++) {
      this.particles.push({
        active: false, flowId: null, t: 0, speed: 0,
        jx: 0, jy: 0, jz: 0, life: 0, maxLife: 0,
      });
    }

    this.spawnForFlows(this.activeFlowIds);
  }

  defineAllFlows() {
    const defs = {};

    // Ambient — gentle particles throughout the house
    defs.ambient = {
      count: 120,
      paths: [
        { from: [-4,1,0], to: [-4,3.5,0], color: [0,0.87,1], spread: 3 },
        { from: [4,1,0], to: [4,3.5,0], color: [1,0.67,0.27], spread: 3 },
        { from: [-4,5,0], to: [-4,7.5,0], color: [0,0.87,1], spread: 3 },
        { from: [4,5,0], to: [4,7.5,0], color: [0.8,0.87,1], spread: 3 },
        { from: [0,8.3,0], to: [0,9.5,0], color: [1,0.8,0.27], spread: 5 },
      ],
    };

    // Living room flows
    defs.living = {
      count: 200,
      paths: [
        // Supply: vent → rises → spreads across room
        { from: [-0.3,0.3,2], to: [-4,2.5,0], color: [0,0.87,1], spread: 1.5 },
        { from: [-4,2.5,0], to: [-4,3.5,0], color: [0,0.87,1], spread: 2 },
        // Return: room → return vent
        { from: [-6,2,0], to: [-4,3.5,4.8], color: [1,0.67,0.27], spread: 1.5 },
        { from: [-2,2,0], to: [-4,3.5,4.8], color: [1,0.67,0.27], spread: 1.5 },
        // Dust floating
        { from: [-6,0.5,-2], to: [-2,1.5,3], color: [0.87,0.8,0.6], spread: 2 },
      ],
    };

    // Kitchen flows
    defs.kitchen = {
      count: 200,
      paths: [
        // Cooking exhaust rises from stove
        { from: [4,1.2,-4], to: [4,2.3,-4.3], color: [1,0.4,0.27], spread: 0.4 },
        { from: [4,2.3,-4.3], to: [4,3.5,-3], color: [1,0.4,0.27], spread: 1.5 },
        // Range hood capture
        { from: [3,2,-3.5], to: [4,2.3,-4.3], color: [1,0.67,0.27], spread: 0.8 },
        { from: [5,2,-3.5], to: [4,2.3,-4.3], color: [1,0.67,0.27], spread: 0.8 },
        // Supply
        { from: [0.3,0.3,0], to: [4,1.5,0], color: [0,0.87,1], spread: 1.5 },
      ],
    };

    // Bedroom flows
    defs.bedroom = {
      count: 180,
      paths: [
        // Supply from vent
        { from: [-0.3,4.3,2], to: [-4,5.5,0], color: [0,0.87,1], spread: 2 },
        // Circulation loop
        { from: [-6,5,0], to: [-4,7.2,0], color: [0.67,0.87,1], spread: 2.5 },
        { from: [-4,7.2,0], to: [-2,5,0], color: [0.67,0.87,1], spread: 2 },
        // Dust/VOC near bed height
        { from: [-6,4.8,-1.5], to: [-3,5.5,2], color: [0.87,0.8,0.6], spread: 1.5 },
      ],
    };

    // Bathroom flows
    defs.bathroom = {
      count: 200,
      paths: [
        // Steam from shower
        { from: [2.5,5.5,-3.5], to: [3,7.5,-2], color: [0.8,0.87,1], spread: 1 },
        { from: [3,7.5,-2], to: [4,7.8,0], color: [0.8,0.87,1], spread: 1.5 },
        // Exhaust fan draw
        { from: [3,6,0], to: [4,7.9,-1], color: [1,0.67,0.27], spread: 1.5 },
        { from: [6,6,0], to: [4,7.9,-1], color: [1,0.67,0.27], spread: 1.5 },
        // Under-door air
        { from: [0.2,4.2,3], to: [4,4.5,0], color: [0,0.87,1], spread: 1 },
      ],
    };

    // Attic
    defs.attic = {
      count: 180,
      paths: [
        // Air through duct trunk
        { from: [-3,8.5,0], to: [6,8.5,0], color: [0,0.87,1], spread: 0.3 },
        // Duct leaks
        { from: [-1,8.5,0], to: [-1,9.5,1], color: [1,0.27,0.53], spread: 0.5 },
        { from: [3,8.5,0], to: [3,9.5,-1], color: [1,0.27,0.53], spread: 0.5 },
        // Hot attic air
        { from: [-6,8.5,-3], to: [6,10,3], color: [1,0.4,0.27], spread: 3 },
      ],
    };

    // Crawlspace
    defs.crawlspace = {
      count: 180,
      paths: [
        // Ground moisture rising
        { from: [-5,-1.9,0], to: [-5,-0.3,0], color: [0.8,0.87,1], spread: 2 },
        { from: [5,-1.9,0], to: [5,-0.3,0], color: [0.8,0.87,1], spread: 2 },
        // Radon seeping
        { from: [0,-1.9,0], to: [0,-0.3,0], color: [0.67,0.4,1], spread: 3 },
        // Stack effect rising into house
        { from: [-3,-0.5,0], to: [-3,0.5,0], color: [1,0.67,0.27], spread: 2 },
        { from: [3,-0.5,0], to: [3,0.5,0], color: [1,0.67,0.27], spread: 2 },
      ],
    };

    return defs;
  }

  spawnForFlows(flowIds) {
    // Deactivate all
    this.particles.forEach(p => { p.active = false; });

    let idx = 0;
    flowIds.forEach(fid => {
      const def = this.flowDefs[fid];
      if (!def) return;
      const perPath = Math.floor(def.count / def.paths.length);
      def.paths.forEach(path => {
        for (let i = 0; i < perPath && idx < this.particles.length; i++, idx++) {
          const p = this.particles[idx];
          p.active = true;
          p.flowId = fid;
          p.pathDef = path;
          p.t = Math.random();
          p.speed = 0.15 + Math.random() * 0.25;
          p.jx = (Math.random() - 0.5) * path.spread;
          p.jy = (Math.random() - 0.5) * path.spread * 0.5;
          p.jz = (Math.random() - 0.5) * path.spread;
          p.life = 0;
          p.maxLife = 2 + Math.random() * 4;
        }
      });
    });
  }

  updateParticles(dt) {
    const pos = this.pPositions;
    const col = this.pColors;
    const sizes = this.pSizes;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        pos[i*3] = pos[i*3+1] = pos[i*3+2] = 0;
        sizes[i] = 0;
        continue;
      }

      p.t += p.speed * dt;
      p.life += dt;

      if (p.t > 1) {
        p.t -= 1;
        p.jx = (Math.random() - 0.5) * p.pathDef.spread;
        p.jy = (Math.random() - 0.5) * p.pathDef.spread * 0.5;
        p.jz = (Math.random() - 0.5) * p.pathDef.spread;
        p.life = 0;
        p.maxLife = 2 + Math.random() * 4;
      }

      const { from, to, color } = p.pathDef;
      const t = p.t;
      // Cubic ease for organic motion
      const et = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
      pos[i*3]   = from[0] + (to[0] - from[0]) * et + p.jx * Math.sin(p.life * 1.5);
      pos[i*3+1] = from[1] + (to[1] - from[1]) * et + p.jy * Math.sin(p.life * 1.2 + 1);
      pos[i*3+2] = from[2] + (to[2] - from[2]) * et + p.jz * Math.cos(p.life * 1.3);

      // Fade in/out
      const fade = Math.min(t * 4, 1) * Math.min((1 - t) * 4, 1);
      col[i*3]   = color[0] * fade;
      col[i*3+1] = color[1] * fade;
      col[i*3+2] = color[2] * fade;

      sizes[i] = (0.08 + fade * 0.12);
    }

    this.pMesh.geometry.attributes.position.needsUpdate = true;
    this.pMesh.geometry.attributes.color.needsUpdate = true;
    this.pMesh.geometry.attributes.size.needsUpdate = true;
  }

  // ════════════════════════════════════════════════════
  //  INTERACTION
  // ════════════════════════════════════════════════════
  onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    this._pointerDown.set(e.clientX, e.clientY);
    this._didDrag = false;
  }

  onUp(e) {
    const dx = e.clientX - this._pointerDown.x;
    const dy = e.clientY - this._pointerDown.y;
    if (Math.sqrt(dx*dx + dy*dy) > 6) return; // was a drag

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.roomHitBoxes);

    if (hits.length > 0) {
      const roomId = hits[0].object.userData.roomId;
      if (roomId === this.activeRoom) {
        this.resetView();
      } else {
        this.focusRoom(roomId);
      }
    } else {
      this.resetView();
    }
  }

  onHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.roomHitBoxes);

    if (hits.length > 0) {
      const roomId = hits[0].object.userData.roomId;
      this.canvas.style.cursor = 'pointer';
      if (this.hintEl && !this.activeRoom) {
        this.hintEl.textContent = `Click to explore: ${ROOMS[roomId].name}`;
      }
    } else {
      this.canvas.style.cursor = 'grab';
      if (this.hintEl && !this.activeRoom) {
        this.hintEl.textContent = 'Click a room to explore \u2022 Drag to orbit \u2022 Scroll to zoom';
      }
    }
  }

  focusRoom(roomId) {
    const room = ROOMS[roomId];
    if (!room) return;
    this.activeRoom = roomId;

    // Camera transition targets
    this.camTarget = room.camOffset.clone();
    this.lookTarget = room.lookAt.clone();

    // Update overlay
    if (this.overlay) {
      let legendHTML = '<div class="house-vis__overlay-legend">';
      room.flows.forEach(f => {
        legendHTML += `<span style="--fc:${f.hex}">${f.label}</span>`;
      });
      legendHTML += '</div>';

      this.overlay.innerHTML =
        `<h3>${room.name}</h3>` +
        `<p>${room.desc}</p>` +
        legendHTML +
        `<a href="${room.link}">Learn More \u2192</a>`;
      this.overlay.classList.add('active');
    }

    // Update info panel
    if (this.infoPanel) {
      this.infoPanel.innerHTML =
        `<div class="house-vis__info-detail">` +
        `<h3>${room.name}</h3>` +
        `<p>${room.desc}</p>` +
        `<a href="${room.link}">Learn More \u2192</a>` +
        `</div>`;
    }

    // Switch air flow
    this.activeFlowIds = [roomId];
    this.spawnForFlows(this.activeFlowIds);

    // Hide hint
    if (this.hintEl) this.hintEl.style.opacity = '0';

    // Highlight room edges
    this.highlightRoom(roomId);
  }

  resetView() {
    this.activeRoom = null;
    this.camTarget = this.defaultCam.clone();
    this.lookTarget = this.defaultLook.clone();

    if (this.overlay) this.overlay.classList.remove('active');
    if (this.infoPanel) {
      this.infoPanel.innerHTML =
        `<div class="house-vis__info-default"><p>Tap any room to explore its air quality concerns.</p></div>`;
    }

    this.activeFlowIds = ['ambient'];
    this.spawnForFlows(this.activeFlowIds);

    if (this.hintEl) this.hintEl.style.opacity = '1';
    this.clearHighlight();
  }

  // ── Room highlight ─────────────────────────────────
  highlightRoom(roomId) {
    this.clearHighlight();
    const room = ROOMS[roomId];
    if (!room) return;

    const hitBox = this.roomHitBoxes.find(h => h.userData.roomId === roomId);
    if (!hitBox) return;

    const edges = new THREE.EdgesGeometry(hitBox.geometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: room.color, transparent: true, opacity: 0.6,
    }));
    line.position.copy(hitBox.position);
    line.userData._highlight = true;
    this.scene.add(line);
    this._highlightLine = line;
  }

  clearHighlight() {
    if (this._highlightLine) {
      this.scene.remove(this._highlightLine);
      this._highlightLine.geometry.dispose();
      this._highlightLine.material.dispose();
      this._highlightLine = null;
    }
  }

  // ── Toggle roof ────────────────────────────────────
  toggleRoof() {
    this.roofVisible = !this.roofVisible;
    if (this.roofGroup) this.roofGroup.visible = this.roofVisible;
  }

  // ════════════════════════════════════════════════════
  //  ANIMATION LOOP
  // ════════════════════════════════════════════════════
  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Smooth camera transition
    if (this.camTarget) {
      this.camera.position.lerp(this.camTarget, 0.045);
      this.controls.target.lerp(this.lookTarget, 0.045);
      if (this.camera.position.distanceTo(this.camTarget) < 0.08) {
        this.camTarget = null;
      }
    }

    this.controls.update();

    // Scroll entrance scale-up
    if (this._entranceStarted && !this._entranceDone) {
      this._entranceProgress = Math.min(this._entranceProgress + dt * 0.8, 1);
      // Elastic ease-out
      const t = this._entranceProgress;
      const s = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * (2 * Math.PI / 3));
      this.houseGroup.scale.set(s, s, s);
      if (this._entranceProgress >= 1) this._entranceDone = true;
    }

    // Rotate fan blades
    if (this.fanBlades) {
      this.fanBlades.rotation.y += dt * 6;
    }

    // Pulse highlight
    if (this._highlightLine) {
      this._highlightLine.material.opacity = 0.35 + Math.sin(Date.now() * 0.004) * 0.25;
    }

    // Pulse problem indicators (subtle glow)
    if (this._problemPulseMeshes) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
      this._problemPulseMeshes.forEach(m => {
        if (m.material.opacity !== undefined) {
          m.material.opacity = pulse;
        }
      });
    }

    // Air particles
    this.updateParticles(dt);

    this.renderer.render(this.scene, this.camera);
  }

  // ── Resize ─────────────────────────────────────────
  resize() {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    if (W === 0 || H === 0) return;
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }
}

// ── Boot ──────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new HouseExplorer());
} else {
  new HouseExplorer();
}
