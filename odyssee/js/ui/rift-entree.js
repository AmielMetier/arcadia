// odyssee/js/ui/rift-entree.js — l'intérieur des failles, de l'entrée à la sortie : l'écran se brise, le monde est aspiré, on
// traverse le tunnel propre à la faille (inversée, chaotique, Alpha), une silhouette approche et se révèle ; le tunnel sert ensuite
// de décor au combat, puis de carrefour entre deux portails ; à la sortie, la faille implose et recrache le joueur sur la route.
// Tout tient dans un nuanceur : l'image du jeu est une texture, aucune géométrie.
import { loadImg, ASSETS } from '../assets.js';
import { warnDev } from '../core/safe.js';
import { TUNNEL_GLSL } from '../render/tunnel-glsl.js';

/** moments de la scène, en secondes */
export const ENTREE = { fissure: 0.05, trou: 0.55, tunnel: 1.3, silhouette: 1.75, revele: 2.75, fin: 3.45 };

const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision highp float;
varying vec2 v;
uniform float uT, uTun, uH, uKind, uSpr, uGrand, uMode, uCasse, uSombre;   // uMode : 0 on tombe dans la faille, 2 elle recrache le joueur
uniform vec2 uRes, uC;
uniform vec3 uCore, uRim;
uniform sampler2D uMonde, uMon;
uniform vec4 uBoite;          // place du Pokémon dans son image : u0, v0, u1, v1
uniform float uFormat;        // largeur / hauteur de cette place

${'${TUNNEL}'}

vec4 monstre(vec2 q){                                // q : 0..1 dans sa place
  if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.);
  return texture2D(uMon, vec2(mix(uBoite.x,uBoite.z,q.x), mix(uBoite.w,uBoite.y,q.y)));
}

// les fêlures autour de la faille (refermées à la sortie)
float trait0(vec2 uv, float asp){
  vec2 p = (uv-uC)*vec2(asp,1.); float r = length(p), a = atan(p.y,p.x), cr = r*5.5, zig = mix(h1(floor(cr)+2.),h1(floor(cr)+3.),fract(cr))-.5;
  float sa = (a/(2.*PI)+.5)*13. + zig*.95, fs = fract(sa), fe = min(fs,1.-fs)*r*2.*PI/13.;
  return (1.-seuil(.0012,.0040,fe))*step(r,.9*(.5+.5*h1(floor(sa))))*step(.03,r);
}
float roulis(){ return uH*.35; }

void main(){
  float asp = uRes.x/uRes.y, t = uT;
  // les pixels grossissent pendant la chute (aspect d'un jeu DS), l'image du monde reste nette au départ
  float gros = uMode > 1.5 ? 4.-3.*seuil(.3,1.1,t) : 1. + 3.*seuil(.45,1.1,t);
  float pas = max(1., floor(uRes.y/720.*gros + .5));
  vec2 uv = (floor(v*uRes/pas)+.5)*pas/uRes;

  float ouv = uMode > 1.5 ? 1.-seuil(.0,1.05,t) : seuil(${'${trou}'}, ${'${tunnel}'}, t);
  // la bouche de la faille glisse vers le milieu de l'écran à mesure qu'on y tombe
  vec2 c = uMode > 1.5 ? mix(vec2(.5,.54), uC, seuil(.0,.8,t)) : mix(uC, vec2(.5,.54), seuil(.6,1.5,t));
  float coup = uCasse*(exp(-max(0.,t-.05)*14.)*step(.05,t) + exp(-max(0.,t-.22)*14.)*step(.22,t) + exp(-max(0.,t-.39)*14.)*step(.39,t));   // l'écran se brise en trois coups
  float tremble = coup*.012 + (seuil(.5,.8,t)-seuil(1.1,1.5,t))*.006 + uSpr*exp(-max(0.,t-${'${revele}'})*9.)*step(${'${revele}'},t)*.02;
  if(uMode > .5) tremble = uMode > 1.5 ? exp(-abs(t-1.05)*9.)*.02 : 0.;
  vec2 sec = vec2(h1(floor(t*40.))-.5, h1(floor(t*40.)+7.)-.5)*tremble;
  vec2 p = (uv - c + sec)*vec2(asp,1.);
  float r = length(p), a = atan(p.y,p.x);

  // ---------- le monde : brisé, tordu, aspiré ----------
  float casse = uCasse*(.34*seuil(.05,.10,t) + .30*seuil(.22,.27,t) + .36*seuil(.39,.44,t));
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
  vec2 pt = p; float roule = roulis(); pt = mat2(cos(roule),-sin(roule),sin(roule),cos(roule))*pt;
  pt += vec2(sin(uH*1.7),cos(uH*1.3))*.05*(uMode > .5 ? 1. : seuil(1.,1.6,t));
  vec3 col = tunnel(pt, uTun, uKind, uCore, uRim);
  // lumière au bout
  float bout = uMode > 1.5 ? 1. : seuil(1.45,${'${revele}'},t)*mix(.45,1.,uSpr);
  float halo = exp(-r*(7.-4.6*bout))*bout;
  col += mix(uCore,vec3(1.),.55)*halo*1.15;
  vec3 img = mix(monde, col, dedans*step(.001,R));
  float lueur = exp(-abs(bord)*(26.-10.*ouv))*step(.001,R)*(uMode > 1.5 ? 1. : 1.-seuil(1.2,1.6,t));
  img += mix(uCore,vec3(1.),.35)*lueur*1.25;
  img += uRim*exp(-abs(bord)*7.)*.55*step(.001,R)*(uMode > 1.5 ? 1. : 1.-seuil(1.2,1.6,t));
  img *= 1.-uSombre*.5;

  // ---------- ce qui t'attend ----------
  if(uSpr > .5 && uMode < .5 && t > ${'${silhouette}'}){
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
  if(f > 0. && uMode < .5 && uSpr > .5){
    img += mix(uCore,vec3(1.),.5)*exp(-f*9.)*.9;
    float on = abs(length((uv-vec2(.5,.56))*vec2(asp,1.)) - f*1.9);
    img += mix(uCore,vec3(1.),.4)*(1.-seuil(0.,.05,on))*exp(-f*3.2);
  }
  // sortie : la faille implose, l'onde part de là où le joueur retombe, les fêlures se referment
  if(uMode > 1.5){
    float g = t-1.05, l = length((uv-uC)*vec2(asp,1.));
    if(g > 0.){ img += mix(uCore,vec3(1.),.5)*exp(-g*7.)*exp(-l*1.6)*1.5; img += mix(uCore,vec3(1.),.4)*(1.-seuil(0.,.045,abs(l-g*1.7)))*exp(-g*3.4); }
    float fer = (1.-seuil(1.05,1.6,t))*step(1.,t); img += uCore*trait0(uv,asp)*fer;
  }
  float vg = length((v-.5)*vec2(1.05,1.15)); img *= 1.-seuil(.42,.85,vg)*.62*(uMode > 1.5 ? 1.-seuil(.9,1.5,t) : seuil(.2,1.,t));
  gl_FragColor = vec4(clamp(img,0.,1.), 1.);
}`;

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
const GENRE = { inverse: 0, chaos: 1, alpha: 2 };
const UNIFORMES = ['uT', 'uTun', 'uH', 'uKind', 'uSpr', 'uGrand', 'uMode', 'uCasse', 'uSombre', 'uRes', 'uC', 'uCore', 'uRim', 'uMonde', 'uMon', 'uBoite', 'uFormat'];

/** la scène : un canevas ; on règle (`genre`, `monde`, `monstre`), on dessine ; `libere()` rend le contexte graphique */
export class SceneFaille {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL indisponible');
    const src = FRAG.replace(/\$\{(\w+)\}/g, (_, k) => (k === 'TUNNEL' ? TUNNEL_GLSL : ENTREE[k].toFixed(3)));
    const sh = (type, code) => { const o = gl.createShader(type); gl.shaderSource(o, code); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'nuanceur'); return o; };
    const P = gl.createProgram();
    gl.attachShader(P, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(P, sh(gl.FRAGMENT_SHADER, src)); gl.linkProgram(P);
    if (!gl.getProgramParameter(P, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P) || 'programme');
    gl.useProgram(P);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const l = gl.getAttribLocation(P, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const k of UNIFORMES) this.u[k] = gl.getUniformLocation(P, k);
    this.tex = [0, 1].map((n) => {
      const t = gl.createTexture(), filtre = n ? gl.NEAREST : gl.LINEAR; gl.activeTexture(gl.TEXTURE0 + n); gl.bindTexture(gl.TEXTURE_2D, t);
      for (const [k, w] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, filtre], [gl.TEXTURE_MAG_FILTER, filtre]]) gl.texParameteri(gl.TEXTURE_2D, k, w);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([8, 4, 16, n ? 0 : 255]));
      return t;
    });
    gl.uniform1i(this.u.uMonde, 0); gl.uniform1i(this.u.uMon, 1);
    this.f({ uCasse: 1, uMode: 0, uSpr: 0, uSombre: 0, uGrand: 0.46, uFormat: 1 });
    gl.uniform2f(this.u.uC, 0.5, 0.5);
  }
  f(o) { for (const k in o) this.gl.uniform1f(this.u[k], o[k]); }
  genre(kind, info) { this.f({ uKind: GENRE[kind] ?? 0 }); this.gl.uniform3fv(this.u.uCore, hex(info.core)); this.gl.uniform3fv(this.u.uRim, hex(info.rim)); }
  centre(x, y) { this.gl.uniform2f(this.u.uC, x, y); }
  image(n, img, retourne) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + n); gl.bindTexture(gl.TEXTURE_2D, this.tex[n]); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, retourne); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); }
  monde(canvas) { this.image(0, canvas, true); }
  monstre(m, grand) { this.f({ uSpr: m ? 1 : 0, uGrand: grand }); if (m) { this.image(1, m.img, false); this.gl.uniform4fv(this.u.uBoite, m.boite); this.f({ uFormat: m.format }); } }
  taille(w, h) { if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; } this.gl.viewport(0, 0, w, h); this.gl.uniform2f(this.u.uRes, w, h); }
  dessine(t, tunnel, horloge) { const gl = this.gl; if (!gl) return; this.f({ uT: t, uTun: tunnel, uH: horloge }); gl.drawArrays(gl.TRIANGLES, 0, 3); }
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

const SOUS = { inverse: 'Tout ce qui protège te trahit', chaos: 'Le ciel ne sait plus quel temps il fait', alpha: 'Il t\'attendait' };

/** l'intérieur d'une faille, gardé ouvert pendant toute l'expédition */
export class Faille {
  constructor(game) {
    this.game = game; this.vivant = true; this.t = 0; this.tunnel = 0; this.horloge = 0; this.avant = 0; this.boucle = 0;
    this.calme = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.wrap = document.createElement('div');
    this.wrap.className = 'rift-scr';
    this.wrap.innerHTML = '<canvas></canvas><div class="rift-barre haut"></div><div class="rift-barre bas"></div><div class="rift-titre"><b></b><span></span></div>';
    this.scene = new SceneFaille(this.wrap.querySelector('canvas'));
  }
  /** referme tout et rend le contexte graphique */
  fin() { if (!this.vivant) return; this.vivant = false; cancelAnimationFrame(this.boucle); this.pop?.(); this.pop = null; this.scene?.libere(); this.wrap.remove(); }
  taille() { const k = Math.min(1, 1080 / innerHeight); this.scene.taille(Math.round(innerWidth * k), Math.round(innerHeight * k)); }
  /** l'image du jeu, telle qu'elle est à cet instant, et la place de la case (x, y) à l'écran */
  prendMonde(x, y) {
    const v = this.game.view, dom = v.renderer.domElement, rect = dom.getBoundingClientRect(), s = v.screenPos(x, y, 16);
    this.lieu = s ? [(s.left - rect.left) / rect.width, 1 - (s.top - rect.top) / rect.height] : [0.5, 0.5];
    this.scene.centre(...this.lieu);
    v.render(); this.scene.monde(dom);   // dans le même instant : l'image du jeu n'est pas gardée d'une image à l'autre
  }
  /** joue de t0 à t1 ; `sons` : [instant, fonction] ; une touche saute à `saut` ; vitesse du tunnel selon t */
  joue(t0, t1, { sons = [], saut = null, vitesse = 1, tunnel = () => 0.28 } = {}) {
    const reste = [...sons]; let saute = this.calme && saut != null;
    this.t = t0; this.avant = performance.now();
    this.pop?.(); this.pop = saut != null ? this.game.input?.push?.((k) => { if (k === 'a' || k === 'b' || k === 'start') saute = true; }) : null;
    cancelAnimationFrame(this.boucle);
    return new Promise((resolve) => {
      let rendu = false;
      const pas = (maintenant) => {
        if (!this.vivant) { resolve(); return; }
        const dt = Math.min(0.05, Math.max(0, (maintenant - this.avant) / 1000)); this.avant = maintenant;
        this.t += dt * vitesse; this.horloge += dt; this.tunnel += dt * tunnel(this.t);
        if (saute && this.t < saut) { this.t = saut; for (const q of reste) if (q[0] < saut) q[1] = null; }
        while (reste.length && reste[0][0] <= this.t) { const q = reste.shift(); q[1]?.(); }
        if (this.visible && !this.game.bv?.alive) { try { this.taille(); this.scene.dessine(this.t, this.tunnel, this.horloge); } catch (e) { warnDev('faille', e); this.fin(); } }   // en combat, c'est l'écran de combat qui la dessine
        if (!rendu && (this.t >= t1 || (saute && this.t >= saut + 0.35) || !this.vivant)) { rendu = true; this.pop?.(); this.pop = null; resolve(); }
        if (this.vivant) this.boucle = requestAnimationFrame(pas);
      };
      this.boucle = requestAnimationFrame(pas);
    });
  }
  titre(kind, b, s) {
    for (const k of Object.keys(GENRE)) this.wrap.classList.toggle(k, k === kind);
    this.wrap.querySelector('.rift-titre b').textContent = b; this.wrap.querySelector('.rift-titre span').textContent = s;
  }
  async montre(mon) {
    const front = await loadImg(ASSETS.front(mon.sp, mon.shiny, mon.shadow));
    this.pret = !!front; this.scene.monstre(front ? cadre(front) : null, mon.alpha ? 0.6 : 0.46);
  }
  chute(mon, kind, depuis) {
    const son = this.game.sound, r = ENTREE.revele;
    return this.joue(depuis, ENTREE.fin, {
      saut: r, vitesse: depuis > 0 ? 1.25 : 1, tunnel: (t) => (t < r ? 1.35 : 0.28),
      sons: [
        ...(depuis > 0 ? [] : [[ENTREE.fissure, () => son?.sfx?.('rift_open')], [0.22, () => son?.sfx?.('hit')], [0.39, () => son?.sfx?.('hit')]]),
        [Math.max(depuis, ENTREE.trou - 0.1), () => son?.sfx?.('rift_enter')],
        ...(mon.alpha ? [[2.2, () => son?.sfx?.('alpha_roar')]] : []),
        [r, () => { this.wrap.classList.add('revele'); son?.sfx?.('rift_impact'); son?.cry?.(ASSETS.cry(mon.sp)); }],
      ],
    });
  }
  montrer() { this.visible = true; this.wrap.style.display = ''; if (!this.wrap.isConnected) this.game.ui.root.appendChild(this.wrap); }
  /** la scène n'est plus à l'écran (elle continue de servir de décor) */
  cacher() { this.visible = false; this.wrap.style.display = 'none'; this.wrap.classList.remove('revele', 'sort'); cancelAnimationFrame(this.boucle); }
  /**
   * Plonge dans la faille depuis l'image du jeu, par la case (x, y) ; `casse` : l'écran se brise d'abord (entrée). Avec `mon`, une
   * silhouette approche et se révèle (avant un combat) ; sinon la chute s'arrête dans le tunnel. La scène reste à l'écran.
   */
  async plonger({ kind, info, x, y, casse, mon = null, titre = '', sous = '' }) {
    const son = this.game.sound;
    if (mon) await this.montre(mon); else this.scene.monstre(null, 0.46);
    this.prendMonde(x, y); this.scene.genre(kind, info);
    this.scene.f({ uCasse: casse ? 1 : 0, uMode: 0, uSombre: 0, uSpr: mon && this.pret ? 1 : 0 });   // (le décor des îles vient de les changer)
    this.wrap.classList.remove('revele', 'sort'); this.wrap.classList.toggle('neuf', true); this.titre(kind, titre, sous || SOUS[kind] || '');
    this.taille(); this.scene.dessine(casse ? 0 : ENTREE.trou - 0.05, this.tunnel, this.horloge); this.montrer();
    if (casse) { son?.stopMusic?.(0.5); if (son) son.current = null; }
    const depuis = casse ? 0 : ENTREE.trou - 0.05;
    if (mon) { await this.chute(mon, kind, depuis); return; }
    await this.joue(depuis, 2.05, {
      saut: 1.75, vitesse: casse ? 1 : 1.2, tunnel: () => 1.35,
      sons: [...(casse ? [[ENTREE.fissure, () => son?.sfx?.('rift_open')], [0.22, () => son?.sfx?.('hit')], [0.39, () => son?.sfx?.('hit')]] : []), [ENTREE.trou - 0.04, () => son?.sfx?.('rift_enter')], [1.3, () => { if (titre) this.wrap.classList.add('revele'); }]],
    });
  }
  /** la faille s'ouvre sur ce que montre le jeu, autour de la case (x, y) ; `dehors` : c'est la route, elle implose */
  async emerger(x, y, dehors = false) {
    if (!this.vivant) return;
    const son = this.game.sound;
    if (this.game.mapObj?.faille) this.game.view.majFond?.(true);   // le vide de l'île est déjà derrière elle
    this.prendMonde(x, y);
    this.wrap.classList.remove('revele'); this.wrap.classList.add('sort');
    this.scene.f({ uMode: 2, uSpr: 0, uSombre: 0, uCasse: 0 }); this.montrer();
    if (!this.calme) await this.joue(0, 1.6, { saut: 1.05, vitesse: dehors ? 1 : 1.25, tunnel: (t) => (t < 1 ? (dehors ? -1.8 : 1.2) : 0), sons: [[0, () => son?.sfx?.('rift_exit')], [1.05, () => son?.sfx?.('rift_impact')]] });
    this.cacher(); this.scene?.f({ uMode: 0 });
  }
  /** décor vivant : le vide des îles et l'écran de combat */
  decor(info, kind) {
    let avant = performance.now(), dernier = null;
    this.fond = {
      info,
      dessine: (maintenant, force = false) => {
        if (!this.vivant || (this.visible && !force && !this.game.bv?.alive)) return null;   // la scène occupe l'écran
        if (maintenant === dernier) return this.scene.canvas;
        const dt = Math.min(0.05, Math.max(0, (maintenant - avant) / 1000)); avant = maintenant; dernier = maintenant;
        this.horloge += dt * 0.6; this.tunnel += dt * 0.2;
        this.scene.genre(kind, info); this.scene.f({ uMode: 0, uSpr: 0, uSombre: 1, uCasse: 0 }); this.scene.taille(640, Math.round(640 * innerHeight / innerWidth)); this.scene.dessine(9, this.tunnel, this.horloge);
        return this.scene.canvas;
      },
    };
    return this.fond;
  }
}
