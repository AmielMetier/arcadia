// odyssee/js/render/portails.js — les portails des failles sur la carte : une déchirure ouverte sur le vrai tunnel de la faille,
// son arête qui crépite, des arcs, des éclats d'espace en orbite, et la lueur runique qu'elle pose sur le sol.
import * as THREE from 'three';
import { TUNNEL_GLSL } from './tunnel-glsl.js';

const GENRE = { inverse: 0, chaos: 1, alpha: 2, sortie: 3, or: 4 };
/** taille du cadre, en cases (l'ouverture en occupe le milieu) */
const L = 3.2, H = 4.2, PENTE = Math.tan(55 * Math.PI / 180);

const VERT = 'varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `
precision highp float;
varying vec2 v;
uniform float uT, uKind, uOuv;
uniform vec3 uCore, uRim;
${TUNNEL_GLSL}
float losange(vec2 p, vec2 c, vec2 t){ vec2 d = abs(p-c)/t; return 1.-step(1., d.x+d.y); }
void main(){
  // pixels d'un seizième de case, comme les sprites
  vec2 p = (floor((v-.5)*vec2(${L.toFixed(2)},${H.toFixed(2)})*16.)+.5)/16.;
  p.y += .12;
  float rond = step(2.5, uKind);                                   // sortie et portail d'or : une porte ronde, pas une déchirure
  vec2 demi = mix(vec2(.70,1.42), vec2(.82,1.22), rond) * max(uOuv,.001);
  vec2 e = p/demi;
  float a = atan(e.y, e.x);
  // amande aux pointes vives pour une déchirure, ovale pour une porte
  float r = mix(pow(pow(abs(e.x),1.25)+pow(abs(e.y),1.15), .82), length(e), rond);
  float n1 = bruitTour(a + uT*.5, uT*1.6, 10.)-.5, n2 = bruitTour(a - uT*.7, uT*3., 34.)-.5;
  float sd = r - 1. - (n1*.17 + n2*.11)*(1.-.75*rond);             // < 0 : dedans
  vec3 col = vec3(0.); float alpha = 0.;
  if(sd < 0.){
    // la vue sur l'autre côté
    vec2 q = p*vec2(1.0,.74); float rl = uT*.45; q = mat2(cos(rl),-sin(rl),sin(rl),cos(rl))*q;
    if(uKind > 2.5){                                               // porte : anneaux de lumière qui s'enfoncent
      float l = length(p/vec2(1.,1.35)); float an = sin(l*15. + uT*5.)*.5+.5; float br = bruitTour(a+uT*.3, l*4.+uT, 12.);
      col = mix(uRim*.30, uCore, pow(an,3.)*.75*br + .25*exp(-l*3.2)); col += uCore*exp(-l*4.5)*.75;
    } else {
      col = tunnel(q, uT*.55, uKind, uCore, uRim)*1.45;
      col += mix(uCore,vec3(1.),.5)*exp(-length(q)*7.)*.75;
    }
    col *= 1. - .55*exp(sd*7.);                                    // le bord intérieur s'assombrit : on voit l'épaisseur
    col += uRim*exp(sd*16.)*.5;
    alpha = 1.;
  }
  // arête : blanche, puis la couleur de la faille
  float ar = abs(sd);
  float trait = 1.-smoothstep(.035,.075,ar), trait2 = 1.-smoothstep(.09,.17,ar);
  col = mix(col, mix(uRim,uCore,.35), trait2); alpha = max(alpha, trait2);
  col = mix(col, mix(uCore,vec3(1.),.65+.35*step(.2,n2)), trait);
  // halo
  if(sd > 0.){
    float hal = exp(-sd*4.2)*(.55+.12*sin(uT*3.));
    col = mix(mix(uRim,uCore,.25), col, trait2); alpha = max(alpha, hal);
    // flammèches qui s'échappent vers le haut
    float fl = bruitTour(a + sin(uT)*.2, r*3.2 - uT*2.4, 26.);
    float bout = smoothstep(.60,.78,fl)*(1.-smoothstep(.0,.42,sd))*step(sd,.42);
    col = mix(col, mix(uCore,uRim,smoothstep(0.,.35,sd)), bout*(1.-trait)); alpha = max(alpha, bout*.95);
    // arcs : deux éclairs qui courent autour
    if(rond < .5){
      for(int i=0;i<2;i++){
        float fi = float(i), ph = floor(uT*9.+fi*4.), ce = (h1(ph+fi*17.)-.5)*6.2831, la = .5+.5*h1(ph+3.);
        float da = abs(mod(a-ce+3.14159,6.28318)-3.14159);
        float z = .13 + .10*(bruitTour(a*1., ph, 40.)-.5) + .05*sin(a*9.+ph);
        float arc = (1.-smoothstep(.012,.035,abs(sd-z)))*step(da,la)*step(.35,h1(ph+9.+fi));
        col = mix(col, vec3(1.), arc); alpha = max(alpha, arc);
      }
    }
  }
  // éclats d'espace en orbite
  for(int i=0;i<7;i++){
    float fi = float(i), an = fi*.8976 + uT*(.35+.06*fi)*(mod(fi,2.)<.5?1.:-1.), ry = 1.16+.10*sin(uT*1.3+fi*2.);
    vec2 c = vec2(cos(an)*demi.x*1.28, sin(an)*demi.y*ry); float t = (.065+.045*h1(fi))*uOuv;
    vec2 tl = vec2(t, t*1.6);
    if(losange(p,c,tl*1.55) > .5){ col = vec3(.05,.02,.10); alpha = 1.; }
    if(losange(p,c,tl) > .5){ col = p.x < c.x ? mix(uCore,vec3(1.),.5) : uRim; alpha = 1.; }
  }
  // étincelles qui montent
  for(int i=0;i<9;i++){
    float fi = float(i), k = fract(uT*(.35+.25*h1(fi))+h1(fi+7.)); vec2 c = vec2((h1(fi+2.)-.5)*1.9 + sin(uT*2.+fi)*.08, -1.5+k*3.2);
    vec2 d = abs(p-c); if(max(d.x,d.y) < .045*(1.-k*.4)*uOuv){ col = mix(vec3(1.),uCore,k); alpha = max(alpha, 1.-k*k); }
  }
  if(alpha < .03) discard;
  gl_FragColor = vec4(min(col,vec3(1.)), alpha*min(1.,uOuv*2.));
}`;
// le sol : lueur, anneau de runes qui tourne, fêlures
const FRAG_SOL = `
precision highp float;
varying vec2 v;
uniform float uT, uKind, uOuv;
uniform vec3 uCore, uRim;
${TUNNEL_GLSL}
void main(){
  vec2 p = (floor((v-.5)*vec2(64.,64.))+.5)/32.;                    // -1..1
  float r = length(p), a = atan(p.y,p.x);
  float lueur = exp(-r*r*3.4)*(.62+.12*sin(uT*3.));
  float ta = a + uT*.35, an = 1.-smoothstep(.02,.045,abs(r-.62));
  float runes = step(.35, fract(ta*5.0929)) * (1.-smoothstep(.0,.05,abs(r-.74)-.04)) * step(.4, hc(floor(ta*5.0929), floor((r-.70)*24.)));
  float z = r*6., zi = mix(h1(floor(z)+1.),h1(floor(z)+2.),fract(z))-.5, sa = (a/6.28318+.5)*9.+zi*.9, fs = fract(sa);
  float fel = (1.-smoothstep(.010,.028,min(fs,1.-fs)*r*.7))*step(.12,r)*step(r,.45+.5*h1(floor(sa)));
  float k = clamp(lueur + an*.75 + runes*.8 + fel*.7, 0., 1.)*(1.-smoothstep(.8,1.,r))*uOuv;
  if(k < .02) discard;
  gl_FragColor = vec4(mix(uRim,uCore,clamp(lueur*.6+an+runes+fel,0.,1.)), k*.9);
}`;

/** un portail posé sur la carte ; se range dans `view.actors` et se défait avec elle */
export class Portail {
  constructor(view, { kind = 'inverse', core, rim, taille = 1 }) {
    this.view = view; this.kind = 'portail'; this.t = Math.random() * 20; this.taille = taille;
    const uni = this.uni = { uT: { value: this.t }, uKind: { value: GENRE[kind] ?? 0 }, uOuv: { value: 1 }, uCore: { value: couleur(core) }, uRim: { value: couleur(rim) } };
    const mat = (fragmentShader) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const g = new THREE.PlaneGeometry(L, H * PENTE); g.translate(0, H * PENTE / 2, 0);
    this.mesh = new THREE.Mesh(g, mat(FRAG)); this.mesh.renderOrder = 4; this.mesh.scale.setScalar(taille);
    const s = new THREE.PlaneGeometry(3.4, 2.5); s.rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(s, mat(FRAG_SOL)); this.shadow.renderOrder = 1; this.shadow.scale.setScalar(taille);
    view.root.add(this.shadow); view.root.add(this.mesh);
  }
  /** à chaque image : place sur la case, animation, ouverture (0 à 1) */
  maj(dt, x, y, ouv = 1) {
    this.t += dt; this.uni.uT.value = this.t; this.uni.uOuv.value = ouv;
    const h = this.view.hAt?.(x + 0.5, y + 0.55) || 0, bas = -(H / 2 - 1.36) * PENTE * this.taille;   // le bas de l'ouverture frôle le sol
    this.mesh.position.set(x + 0.5, h + bas - 0.02 + 0.05 * Math.sin(this.t * 2), y + 0.56);
    this.shadow.position.set(x + 0.5, h + 0.015, y + 0.62);
  }
  dispose() { for (const m of [this.mesh, this.shadow]) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); } }
}
function couleur(c) { const v = new THREE.Vector3(); [v.x, v.y, v.z] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255); return v; }
