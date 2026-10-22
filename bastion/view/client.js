// Interface de Bastion Clash (navigateur uniquement).
// Canevas, caméra et état propre à ce joueur (sélection, effets).
'use strict';

/* ============================================================================
   MOTEUR 3D VUE DU DESSUS (TOP-DOWN 3D PERSPECTIVE & EXTRUSION VOLUMÉTRIQUE)
   ============================================================================ */
// Les noms viennent des autres joueurs : on les échappe avant de les insérer dans la page
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const webglCvs = $('#webgl3d');
const cvs = $('#world'), ctx = cvs.getContext('2d');
const miniCvs = $('#minimap'), miniCtx = miniCvs.getContext('2d');
let W = 0, H = 0, DPR = 1;
var threeReady = false, threeRenderer = null, threeScene = null, threeCam = null, sunLight3D = null;
var threeRaycaster = null, threeGroundPlane = null, threeNdc = null, threeHitPt = null, threeProjVec = null;
var fogTexture3D = null;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  cvs.width = Math.round(W * DPR);
  cvs.height = Math.round(H * DPR);
  if (threeRenderer && threeCam) {
    threeRenderer.setPixelRatio(Math.min(1.75, DPR));
    threeRenderer.setSize(W, H, false);
    threeCam.aspect = W / Math.max(1, H);
    threeCam.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);
resize();

const cam = { x: HALF_W, y: HALF_W, z: 0.88, pitch: 70, shake: 0 };
const keys = {};
const mouse = { x: W / 2, y: H / 2, clientX: -999, clientY: -999, inside: false, wx: HALF_W, wy: HALF_W, down: false, dragStart: null, panning: false, panStart: null };

let myId = 0;
let role = 'solo';
let state = null;
let buildMode = null;
let buildKeysArmed = false; // menu de construction ouvert au clavier (B)
let orderCursor = null; // 'amove' | 'scan' | null
let selectedUnits = new Set();
let selectedBlds = new Set();
const controlGroups = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
let lastGroupTap = { g: 0, t: 0 };
let lastClickUnit = { id: 0, kind: '', t: 0 };

let particles = [];
let shockwaves = [];
let projectiles = [];
let beams = [];
let craters = [];
let orderMarkers = [];
let reportedResult = false;
