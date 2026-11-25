// odyssee/js/render/tunnel-glsl.js — le tunnel des failles en GLSL (bruits compris), partagé par les scènes de faille
// (ui/rift-entree.js) et par les portails posés sur la carte (render/portails.js). K : 0 inversée, 1 chaotique, 2 Alpha
export const TUNNEL_GLSL = `
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
vec3 tunnel(vec2 p, float t, float K, vec3 core, vec3 rim){
  float r = length(p)+1e-4, a = atan(p.y,p.x);
  float z = .42/r + t*2.6;
  float prof = seuil(.02,.62,r);                    // sombre au loin, clair près des bords
  vec3 col;
  if(K < .5){                                   // INVERSÉE : deux spirales opposées, damier qui s'échange
    float s1 = sin(a*5. + z*2.2 + t*.6), s2 = sin(a*5. - z*2.2 + t*.6), s = s1*s2;
    float n = bruitTour(a, z*1.3, 20.);
    float q = step(0., s);
    if(sin(z*.55 - t*1.2) > .35) q = 1.-q;          // par vagues, les deux couleurs s'échangent
    float bord = 1.-seuil(0.,.10,min(abs(s1),abs(s2)));
    float coeur = seuil(.55,.95,abs(s));
    col = mix(vec3(.04,.01,.10), mix(rim,core,q)*.55, .25+.75*coeur) * (.55+.6*n);
    col += mix(rim,core,q) * coeur*coeur*.45;
    col += mix(core,vec3(1.),.3) * bord * .75;
    col += vec3(1.) * step(.985, h2(vec2(floor((a/(2.*PI)+.5)*90.), floor(z*3.)))) * .8;
  } else if(K < 1.5){                           // CHAOTIQUE : quatre climats qui défilent, vents et éclairs
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
    col = mix(col, rim, seuil(.62,.92,n+coeur*.16));
    col = mix(col, vec3(1.,.92,.62), seuil(.86,1.04,n+coeur*.16+r*.1));
    col += vec3(1.,.5,.2) * step(.988, h2(vec2(floor((a/(2.*PI)+.5)*110.), floor(z*4.)))) ;
  }
  col *= .12 + .95*prof;
  // traits de vitesse
  float ta = floor((a/(2.*PI)+.5)*70.);
  float tr = step(.84,h1(ta)) * step(.80, fract(z*(.35+.4*h1(ta+9.)) + h1(ta+5.)));
  float tq = abs(fract((a/(2.*PI)+.5)*70.)-.5); tr *= step(tq,.22);
  col += mix(core,vec3(1.),.6) * tr * prof * .5;
  return col;
}
`;
