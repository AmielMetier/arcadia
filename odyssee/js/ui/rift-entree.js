// odyssee/js/ui/rift-entree.js — l'entrée dans une faille : l'écran se brise, le monde est aspiré, on traverse le tunnel
// propre à la faille (inversée, chaotique, Alpha) et une silhouette approche avant de se révéler.
// Tout tient dans un nuanceur : l'image du jeu est une texture, aucune géométrie. La scène reste en fond jusqu'au rideau du combat.
import { loadImg, ASSETS } from '../assets.js';
import { warnDev } from '../core/safe.js';

/** moments de la scène, en secondes */
export const ENTREE = { fissure: 0.05, trou: 0.55, tunnel: 1.3, silhouette: 1.75, revele: 2.75, fin: 3.45 };

const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision highp float;
varying vec2 v;
uniform float uT, uKind, uSpr, uGrand, uVie;
uniform vec2 uRes, uC;
uniform vec3 uCore, uRim;
uniform sampler2D uMonde, uMon;
uniform vec4 uBoite;          // place du Pokémon dans son image : u0, v0, u1, v1
uniform float uFormat;        // largeur / hauteur de cette place
const float PI = 3.14159265;

float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float bruit(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
// hachage exact de cases entières (celui en sinus n'arrondit pas pareil d'une case à l'autre : des cercles se voyaient)
float m289(float x){ return x - floor((x+.5)/289.)*289.; }
float hc(float i, float j){ float p=m289((m289(i)*34.+1.)*m289(i)); p=m289(p+m289(j)); return m289((p*34.+1.)*p)/289.; }
// bruit qui se referme sur lui-même autour du tunnel (n cases par tour)
float bruitTour(float a, float z, float n){ float x=(a/(2.*PI)+.5)*n; float i=floor(x), f=fract(x), j=floor(z), g=fract(z); f=f*f*(3.-2.*f); g=g*g*(3.-2.*g);
  float i0=i-floor((i+.5)/n)*n, ib=i+1., i1=ib-floor((ib+.5)/n)*n, jb=j+1.;
  return mix(mix(hc(i0,j),hc(i1,j),f), mix(hc(i0,jb),hc(i1,jb),f), g); }
float seuil(float a, float b, float x){ return smoothstep(a,b,x); }

// le tunnel, vu depuis son axe
vec3 tunnel(vec2 p, float t){
  float r = length(p)+1e-4, a = atan(p.y,p.x);
  float z = .42/r + t*2.6;
  float prof = seuil(.02,.62,r);                    // sombre au loin, clair près des bords
  vec3 col;
  if(uKind < .5){                                   // INVERSÉE : deux spirales opposées, damier qui s'échange
    float s1 = sin(a*5. + z*2.2 + t*.6), s2 = sin(a*5. - z*2.2 + t*.6), s = s1*s2;
    float n = bruitTour(a, z*1.3, 20.);
    float q = step(0., s);
    if(sin(z*.55 - t*1.2) > .35) q = 1.-q;          // par vagues, les deux couleurs s'échangent
    float bord = 1.-seuil(0.,.10,min(abs(s1),abs(s2)));
    float coeur = seuil(.55,.95,abs(s));
    col = mix(vec3(.04,.01,.10), mix(uRim,uCore,q)*.55, .25+.75*coeur) * (.55+.6*n);
    col += mix(uRim,uCore,q) * coeur*coeur*.45;
    col += mix(uCore,vec3(1.),.3) * bord * .75;
    col += vec3(1.) * step(.985, h2(vec2(floor((a/(2.*PI)+.5)*90.), floor(z*3.)))) * .8;
  } else if(uKind < 1.5){                           // CHAOTIQUE : quatre climats qui défilent, vents et éclairs
    float bande = mod(floor(z*.42 + bruitTour(a,z*.4,6.)*.55), 4.);
    vec3 c = bande<.5 ? vec3(.13,.36,.92) : bande<1.5 ? vec3(1.,.58,.12) : bande<2.5 ? vec3(.78,.60,.30) : vec3(.72,.92,1.);
    float n = bruitTour(a + z*.55, z*2.2, 14.);
    float vent = seuil(.62,.82, bruitTour(a + z*.9, z*.7, 44.));
    col = c*(.16+.62*n*n) + c*vent*.75;
    float ec = floor(t*7.), ea = (h1(ec)-.5)*2.*PI;
    float er = log(r)*5., ei = floor(er), ez = mix(h1(ei+ec*3.),h1(ei+1.+ec*3.),fract(er))-.5;
    float d = abs(mod(a-ea + ez*.75 + PI, 2.*PI)-PI)*r;
    col += vec3(.9,.95,1.) * step(.62,h1(ec+3.)) * (1.-seuil(.004,.02,d));
  } else {                                          // ALPHA : gueule de braise, flammes qui battent comme un cœur
    float coeur = pow(max(0.,sin(t*5.2)),6.)*.5 + pow(max(0.,sin(t*5.2-.9)),6.)*.3;
    float n = bruitTour(a + z*.12, z*1.7 - t*2., 12.)*.6 + bruitTour(a - z*.2, z*3.6 - t*3., 28.)*.4;
    float f = seuil(.38,.86,n + r*.16 + coeur*.2);
    col = mix(vec3(.10,.0,.02), vec3(.78,.06,.06), f);
    col = mix(col, uRim, seuil(.62,.92,n+coeur*.16));
    col = mix(col, vec3(1.,.92,.62), seuil(.86,1.04,n+coeur*.16+r*.1));
    col += vec3(1.,.5,.2) * step(.988, h2(vec2(floor((a/(2.*PI)+.5)*110.), floor(z*4.)))) ;
  }
  col *= .12 + .95*prof;
  // traits de vitesse
  float ta = floor((a/(2.*PI)+.5)*70.);
  float tr = step(.84,h1(ta)) * step(.80, fract(z*(.35+.4*h1(ta+9.)) + h1(ta+5.)));
  float tq = abs(fract((a/(2.*PI)+.5)*70.)-.5); tr *= step(tq,.22);
  col += mix(uCore,vec3(1.),.6) * tr * prof * .5;
  return col;
}

vec4 monstre(vec2 q){                                // q : 0..1 dans sa place
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.);
  return texture2D(uMon, vec2(mix(uBoite.x,uBoite.z,q.x), mix(uBoite.w,uBoite.y,q.y)));
}

void main(){
  float asp = uRes.x/uRes.y, t = uT;
  // les pixels grossissent pendant la chute (aspect d'un jeu DS), l'image du monde reste nette au départ
  float gros = 1. + 3.*seuil(.45,1.1,t);
  float pas = max(1., floor(uRes.y/720.*gros + .5));
  vec2 uv = (floor(v*uRes/pas)+.5)*pas/uRes;

  float ouv = seuil(${'${trou}'}, ${'${tunnel}'}, t);
  // la bouche de la faille glisse vers le milieu de l'écran à mesure qu'on y tombe
  vec2 c = mix(uC, vec2(.5,.54), seuil(.6,1.5,t));
  float coup = exp(-max(0.,t-.05)*14.)*step(.05,t) + exp(-max(0.,t-.22)*14.)*step(.22,t) + exp(-max(0.,t-.39)*14.)*step(.39,t);   // l'écran se brise en trois coups
  float tremble = coup*.012 + (seuil(.5,.8,t)-seuil(1.1,1.5,t))*.006 + exp(-max(0.,t-${'${revele}'})*9.)*step(${'${revele}'},t)*.02;
  vec2 sec = vec2(h1(floor(t*40.))-.5, h1(floor(t*40.)+7.)-.5)*tremble;
  vec2 p = (uv - c + sec)*vec2(asp,1.);
  float r = length(p), a = atan(p.y,p.x);

  // ---------- le monde : brisé, tordu, aspiré ----------
  float casse = .34*seuil(.05,.10,t) + .30*seuil(.22,.27,t) + .36*seuil(.39,.44,t);
  float nb = 13., cr = r*5.5, ci = floor(cr), cf = fract(cr);
  float zig = mix(h1(ci+2.), h1(ci+3.), cf)-.5;
  float sa = (a/(2.*PI)+.5)*nb + zig*.95;
  float eclat = floor(sa), anneau = floor(r*3.2 + h1(eclat)*2.);
  vec2 dec = (vec2(h2(vec2(eclat,anneau)),h2(vec2(anneau,eclat+5.)))-.5) * casse * .09 * (1.-ouv*.5);
  float tw = ouv*ouv*9.*exp(-r*1.5) + ouv*ouv*1.6;
  float rs = r*(1. + ouv*ouv*3.2) ;
  float as = a + tw;
  vec2 m = c + vec2(cos(as),sin(as))*rs/vec2(asp,1.) + dec;
  float sep = (casse*.004 + ouv*.03) * (1.+r);
  m = 1.-abs(mod(m,2.)-1.);
  vec2 dr = normalize(p+1e-4)*sep/vec2(asp,1.);
  vec3 monde = vec3(texture2D(uMonde,m+dr).r, texture2D(uMonde,m).g, texture2D(uMonde,m-dr).b);
  monde = mix(monde, monde*mix(uRim,vec3(1.),.45), casse*.35+ouv*.4);
  if(uKind < .5) monde = mix(monde, 1.-monde, ouv*.85);          // inversée : les couleurs se retournent
  // arêtes des éclats, lumière de la faille dans les fentes
  float fs = fract(sa), fente = min(fs,1.-fs)*r*2.*PI/nb;
  // fêlures en travers, qui relient les grandes
  float trv = abs(fract(r*3.2 + h1(eclat)*2. + (fs-.5)*.5)-.5)/3.2; trv = step(.35,h2(vec2(eclat,anneau+2.))) > .5 ? trv : 1.;
  float long_ = casse*1.5*(.55+.45*h1(eclat));
  float trait = max((1.-seuil(.0012,.0040,fente)) * step(r,long_), (1.-seuil(.0010,.0030,trv))*step(r,long_*.8)*.8) * step(.03,r);
  monde += uCore * trait * (1.1-.5*ouv) * casse;
  monde += uCore * exp(-r*7.) * casse*.8*(1.-ouv);
  monde *= 1.-.55*ouv;

  // ---------- la bouche de la faille ----------
  float dent = (bruitTour(a+t*.7, t*1.5, 9.)-.5)*.22 + (bruitTour(a-t*.4, t*2.2, 31.)-.5)*.09;
  float R = mix(.0, 1.9, pow(ouv,1.7)) + casse*.035*(1.-ouv);
  float bord = r - R*(1.+dent);
  float dedans = 1.-step(0.,bord);
  // tunnel : vite pendant la chute, puis il flotte
  float tt = t<${'${revele}'} ? t*1.35 : ${'${revele}'}*1.35 + (t-${'${revele}'})*.28;
  vec2 pt = p; float roule = t*.35; pt = mat2(cos(roule),-sin(roule),sin(roule),cos(roule))*pt;
  pt += vec2(sin(t*1.7),cos(t*1.3))*.05*seuil(1.,1.6,t);
  vec3 col = tunnel(pt, tt);
  // lumière au bout
  float bout = seuil(1.45,${'${revele}'},t);
  float halo = exp(-r*(7.-4.6*bout))*bout;
  col += mix(uCore,vec3(1.),.55)*halo*1.15;
  vec3 img = mix(monde, col, dedans*step(.001,R));
  float lueur = exp(-abs(bord)*(26.-10.*ouv))*step(.001,R)*(1.-seuil(1.2,1.6,t));
  img += mix(uCore,vec3(1.),.35)*lueur*1.25;
  img += uRim*exp(-abs(bord)*7.)*.55*step(.001,R)*(1.-seuil(1.2,1.6,t));

  // ---------- ce qui t'attend ----------
  if(uSpr > .5 && t > ${'${silhouette}'}){
    float k = seuil(${'${silhouette}'}, ${'${revele}'}, t);
    float haut = uGrand * mix(.04, 1., k*k);
    vec2 o = vec2(.5,.56) + vec2(0., sin(t*2.1)*.012*step(${'${revele}'},t));
    vec2 q = (uv-o)*vec2(asp,1.)/vec2(haut*uFormat,haut) + .5;
    vec4 s = monstre(q);
    // contour de lumière : huit voisins
    float e = .0062/haut; float cont = 0.;
    for(int i=0;i<8;i++){ float an=float(i)*PI/4.; cont=max(cont, monstre(q+vec2(cos(an)/uFormat,sin(an))*e*2.6).a); }
    float la = step(.5,s.a), lc = step(.5,cont)*(1.-la);
    float rev = seuil(${'${revele}'}, ${'${revele}'}+.12, t);
    vec3 nuit = mix(vec3(.02,.0,.06), uRim*.16, .5+.5*sin(t*9.+q.y*14.));
    img = mix(img, mix(uCore,vec3(1.),.35+.3*sin(t*8.)), lc*k);
    img = mix(img, mix(nuit, s.rgb, rev), la);
    // la silhouette d'un Alpha rougeoie au rythme de son cœur
    if(uKind > 1.5) img = mix(img, uRim*.75, la*(1.-rev)*pow(max(0.,sin(t*10.)),4.)*.55*seuil(.9,.2,q.y));
  }

  // éclair de la révélation et onde de choc
  float f = t-${'${revele}'};
  if(f > 0.){
    img += mix(uCore,vec3(1.),.5)*exp(-f*9.)*.9;
    float on = abs(length((uv-vec2(.5,.56))*vec2(asp,1.)) - f*1.9);
    img += mix(uCore,vec3(1.),.4)*(1.-seuil(0.,.05,on))*exp(-f*3.2);
  }
  // bords assombris, fondu de départ
  float vg = length((v-.5)*vec2(1.05,1.15)); img *= 1.-seuil(.42,.85,vg)*.62*seuil(.2,1.,t);
  gl_FragColor = vec4(clamp(img,0.,1.)*uVie, 1.);
}`;

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

/** la scène : un canevas, dessinée à l'instant t (secondes) ; `libere()` rend le contexte graphique */
export class SceneFaille {
  constructor(canvas, { kind = 'inverse', core = '#38e8ff', rim = '#a848ff', monde = null, centre = [0.5, 0.5], mon = null }) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL indisponible');
    const src = FRAG.replace(/\$\{(\w+)\}/g, (_, k) => ENTREE[k].toFixed(3));
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'nuanceur'); return o; };
    const P = this.prog = gl.createProgram();
    gl.attachShader(P, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, src)); gl.linkProgram(P);
    if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P) || 'programme');
    gl.useProgram(P);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(P, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const k of ['uT', 'uKind', 'uSpr', 'uGrand', 'uVie', 'uRes', 'uC', 'uCore', 'uRim', 'uMonde', 'uMon', 'uBoite', 'uFormat']) this.u[k] = gl.getUniformLocation(P, k);
    const tex = (i, img, retourne, filtre) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, retourne);
      for (const [k, w] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, filtre], [gl.TEXTURE_MAG_FILTER, filtre]]) gl.texParameteri(gl.TEXTURE_2D, k, w);
      if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 4, 16, 255]));
    };
    tex(0, monde, true, gl.LINEAR); tex(1, mon?.img || null, false, gl.NEAREST);
    gl.uniform1i(this.u.uMonde, 0); gl.uniform1i(this.u.uMon, 1);
    gl.uniform1f(this.u.uKind, { inverse: 0, chaos: 1, alpha: 2 }[kind] ?? 0);
    gl.uniform3fv(this.u.uCore, hex(core)); gl.uniform3fv(this.u.uRim, hex(rim));
    gl.uniform2fv(this.u.uC, centre);
    gl.uniform1f(this.u.uSpr, mon ? 1 : 0);
    gl.uniform4fv(this.u.uBoite, mon?.boite || [0, 0, 1, 1]); gl.uniform1f(this.u.uFormat, mon?.format || 1);
    gl.uniform1f(this.u.uGrand, kind === 'alpha' ? 0.6 : 0.46); gl.uniform1f(this.u.uVie, 1);
  }
  taille(w, h) { if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; } this.gl.viewport(0, 0, w, h); this.gl.uniform2f(this.u.uRes, w, h); }
  dessine(t) { const gl = this.gl; gl.uniform1f(this.u.uT, t); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  libere() { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); this.gl = null; }
}

/** place du dessin dans un sprite (marges transparentes ôtées) */
function cadre(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let j = 0; j < c.height; j++) for (let i = 0; i < c.width; i++) if (d[(j * c.width + i) * 4 + 3] > 32) { x0 = Math.min(x0, i); x1 = Math.max(x1, i + 1); y0 = Math.min(y0, j); y1 = Math.max(y1, j + 1); }
  if (x1 <= x0) return { img: c, boite: [0, 0, 1, 1], format: c.width / c.height };
  return { img: c, boite: [x0 / c.width, y0 / c.height, x1 / c.width, y1 / c.height], format: (x1 - x0) / (y1 - y0) };
}

/**
 * Joue l'entrée dans la faille et laisse la scène en fond (le dialogue s'affiche par-dessus).
 * Renvoie { fin() } à appeler quand le rideau du combat couvre l'écran, ou null si la scène n'a pas pu se jouer.
 */
export async function entrerFaille(game, { kind, info, x, y, mon }) {
  if (typeof document === 'undefined' || !game.ui?.root || !game.view?.renderer) return null;
  const wrap = document.createElement('div');
  wrap.className = `rift-scr ${kind}`;
  wrap.innerHTML = '<canvas></canvas><div class="rift-barre haut"></div><div class="rift-barre bas"></div><div class="rift-titre"><b></b><span></span></div>';
  let scene = null, pop = null, boucle = 0, vivant = true;
  const fin = () => { if (!vivant) return; vivant = false; cancelAnimationFrame(boucle); pop?.(); scene?.libere(); wrap.remove(); };
  try {
    const front = await loadImg(ASSETS.front(mon.sp, mon.shiny, mon.shadow));
    const monde = game.view.renderer.domElement, rect = monde.getBoundingClientRect(), s = game.view.screenPos(x, y, 16);
    const centre = s ? [(s.left - rect.left) / rect.width, 1 - (s.top - rect.top) / rect.height] : [0.5, 0.5];
    game.view.render();   // l'image du jeu doit être dessinée dans le même instant que sa copie
    scene = new SceneFaille(wrap.querySelector('canvas'), { kind, core: info.core, rim: info.rim, monde, centre, mon: front ? cadre(front) : null });
    const b = wrap.querySelector('.rift-titre');
    b.querySelector('b').textContent = info.label; b.querySelector('span').textContent = { inverse: 'Tout ce qui protège te trahit', chaos: 'Le ciel ne sait plus quel temps il fait', alpha: 'Il t\'attendait' }[kind] || '';
    const taille = () => { const k = Math.min(1, 1080 / innerHeight); scene.taille(Math.round(innerWidth * k), Math.round(innerHeight * k)); };
    taille(); scene.dessine(0);
    game.ui.root.appendChild(wrap);
  } catch (e) { warnDev('faille', e); fin(); return null; }

  const calme = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const son = game.sound, joues = new Set();
  const bruit = (nom, quand, t, f) => { if (t >= quand && !joues.has(nom)) { joues.add(nom); f(); } };
  son?.stopMusic?.(0.5); if (son) son.current = null;
  let saute = calme;
  pop = game.input?.push?.((k) => { if (k === 'a' || k === 'b' || k === 'start') saute = true; });
  return new Promise((resolve) => {
    let t = calme ? ENTREE.revele : 0, avant = performance.now(), rendu = false;
    const pas = (maintenant) => {
      if (!vivant) return;
      t += Math.min(0.05, (maintenant - avant) / 1000); avant = maintenant;
      if (saute && t < ENTREE.revele) t = ENTREE.revele;
      if (!saute) {
        bruit('brise', ENTREE.fissure, t, () => son?.sfx?.('rift_open'));
        bruit('coup2', 0.22, t, () => son?.sfx?.('hit')); bruit('coup3', 0.39, t, () => son?.sfx?.('hit'));
        bruit('chute', ENTREE.trou - 0.1, t, () => son?.sfx?.('rift_enter'));
        if (kind === 'alpha') bruit('cri', 2.2, t, () => son?.sfx?.('alpha_roar'));
      }
      bruit('choc', ENTREE.revele, t, () => { wrap.classList.add('revele'); son?.sfx?.('rift_impact'); son?.cry?.(ASSETS.cry(mon.sp)); });
      try { const k = Math.min(1, 1080 / innerHeight); scene.taille(Math.round(innerWidth * k), Math.round(innerHeight * k)); scene.dessine(t); } catch (e) { warnDev('faille', e); fin(); }
      if (!rendu && (t >= ENTREE.fin || (saute && t >= ENTREE.revele + 0.35) || !vivant)) { rendu = true; pop?.(); pop = null; resolve({ fin }); }
      if (vivant) boucle = requestAnimationFrame(pas);
    };
    boucle = requestAnimationFrame(pas);
  });
}
