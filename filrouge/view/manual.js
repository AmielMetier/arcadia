// Le manuel de l'expert : un livret papier à onglets, généré à partir de l'édition de la partie.
// Il couvre les six modules, même ceux qui ne sont pas sur la bombe : à l'expert de trouver la bonne page.
import { CONDS, WIRE_COLORS, KEY_COLORS, GAUGE_COLORS, LED_COLORS, OUTLETS, MODULE_INFO } from '../engine/manual.js';
import { RUNES, runeSvg } from '../engine/runes.js';
import { manualOf } from '../engine/rules.js';

const chip = (c, label = c.id) => `<span class="chip" style="--c:${c.hex}">${label}</span>`;
const circled = (i) => '①②③④⑤⑥'[i];
const condText = (i) => CONDS[i].text;

function cover(man) {
  return `<h2>Manuel de désamorçage</h2>
  <p class="ed">Édition n° <b>${man.edition}</b></p>
  <p>Vérifie d'abord avec le démineur que le numéro imprimé sous le chrono est bien <b>${man.edition}</b>. Un autre numéro, c'est un autre manuel.</p>
  <h3>Le chrono et les fautes</h3>
  <ul><li>Chaque faute allume un voyant rouge sous le chrono et le fait défiler plus vite (+25 % par faute).</li>
  <li>Au bout du nombre de fautes autorisé, ou à 00:00, la bombe explose.</li>
  <li>Un module désamorcé allume son voyant vert, en haut à droite.</li></ul>
  <h3>L'extérieur de la bombe</h3>
  <p>Certaines règles dépendent de l'extérieur du boîtier. Le démineur doit le faire tourner pour le lire :</p>
  <ul><li><b>N° de lot</b> : étiquette blanche sur un flanc (ex. <code>K7R-42F</code>).</li>
  <li><b>Tampons</b> : cachets ronds au nom d'une ville, à l'encre rouge ou bleue (flanc, dessus, dessous).</li>
  <li><b>Vis</b> : quatre vis aux coins de la face avant (celle du chrono). Des trous vides = vis manquantes.</li></ul>
  <h3>Conditions utilisées dans ce manuel</h3>
  <ol class="conds">${CONDS.map((c, i) => `<li><b>${circled(i)}</b> ${c.text}</li>`).join('')}</ol>`;
}

function wires(man) {
  const cell = (c) => c.k === 'cut' ? '<span class="cut">✂</span>'
    : c.k === 'keep' ? '<span class="keep">—</span>'
      : c.k === 'col' ? `<span class="cond">✂ si ${chip(WIRE_COLORS[c.c[0]])} ou ${chip(WIRE_COLORS[c.c[1]])}</span>`
        : `<span class="cond">✂ si <b>${circled(c.q)}</b></span>`;
  return `<h2>${MODULE_INFO.wires.icon} Raccordements</h2>
  <p>Des fils relient des bornes lettrées (à gauche, <b>A</b> à <b>F</b>) à des bornes numérotées (à droite, <b>1</b> à <b>6</b>).
  Pour chaque fil, demande au démineur sa <b>lettre</b>, son <b>chiffre</b> et sa <b>couleur</b>, puis lis la case.</p>
  <p>✂ = couper · — = ne pas toucher · <b>①…⑥</b> = condition de la page de garde. Le module est désamorcé quand tous les fils à couper sont coupés. Couper un mauvais fil est une faute.</p>
  <table class="grid"><thead><tr><th></th>${[1, 2, 3, 4, 5, 6].map((n) => `<th>${n}</th>`).join('')}</tr></thead>
  <tbody>${man.wires.map((row, r) => `<tr><th>${'ABCDEF'[r]}</th>${row.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function safe(man) {
  const rules = [];
  if (man.safe.addStamps) rules.push('Ajoute le <b>nombre de tampons</b> sur la bombe au chiffre du <b>premier symbole</b> (à gauche). Au-delà de 9, retire 10.');
  rules.push(`Si <b>${condText(man.safe.reverseIf)}</b>, entre les trois chiffres <b>de droite à gauche</b>. Sinon, de gauche à droite.`);
  return `<h2>${MODULE_INFO.safe.icon} Coffre</h2>
  <p>L'écran montre trois symboles. Chacun vaut un chiffre :</p>
  <div class="runes">${RUNES.map((_, i) => `<div class="rune">${runeSvg(i, 46)}<b>${man.safe.digits[i]}</b></div>`).join('')}</div>
  <ol>${rules.map((r) => `<li>${r}</li>`).join('')}
  <li>Pour chaque chiffre : tourner la molette jusqu'à ce que le chiffre soit sous le repère rouge, puis appuyer sur <b>ENTRER</b>.</li></ol>
  <p class="note">Un mauvais chiffre est une faute et remet le coffre à zéro.</p>`;
}

function switches(man) {
  const arrow = (u) => (u ? '<span class="up">▲</span>' : '<span class="down">▼</span>');
  const inv = LED_COLORS[man.switches.invertLed];
  return `<h2>${MODULE_INFO.switches.icon} Leviers</h2>
  <p>Un petit écran affiche un code. Cinq leviers, numérotés de 1 à 5 de gauche à droite, ont chacun une LED au-dessus.</p>
  <ol><li>Trouve le code dans la table : elle donne la position de chaque levier (▲ haut, ▼ bas).</li>
  <li>Si la LED au-dessus d'un levier est ${chip(inv, inv.id)}, inverse la position de <b>ce</b> levier.</li>
  <li>Le démineur appuie sur <b>VALIDER</b>. Une mauvaise combinaison est une faute.</li></ol>
  <table class="codes"><thead><tr><th>Code</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead>
  <tbody>${man.switches.table.map((r) => `<tr><th>${r.code}</th>${r.up.map((u) => `<td>${arrow(u)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function staff(notes) {
  // cinq hauteurs : 0 = la plus grave (en bas)
  const lines = [0, 1, 2, 3, 4].map((k) => `<line x1="4" x2="156" y1="${10 + k * 12}" y2="${10 + k * 12}"/>`).join('');
  const dots = notes.map((n, k) => `<circle cx="${28 + k * 36}" cy="${58 - n * 12}" r="6.5"/>`).join('');
  const path = notes.map((n, k) => `${k ? 'L' : 'M'}${28 + k * 36} ${58 - n * 12}`).join(' ');
  return `<svg viewBox="0 0 160 68" class="staff" aria-hidden="true"><g stroke="#cbbfa6" stroke-width="1.5">${lines}</g><path d="${path}" fill="none" stroke="#16181d" stroke-width="2" stroke-dasharray="3 3"/><g fill="#16181d">${dots}</g></svg>`;
}
function chime(man) {
  return `<h2>${MODULE_INFO.chime.icon} Carillon</h2>
  <p>Le démineur appuie sur le bouton rouge <b>ÉCOUTER</b> : quatre notes jouent. Il doit te décrire la mélodie
  (ça monte ? ça descend ? quelle note est la plus aiguë ?). Trouve-la ci-dessous : les points vont du grave (en bas) à l'aigu (en haut).</p>
  <p>Il presse ensuite les touches de couleur dans l'ordre indiqué. Si <b>${condText(man.chime.reverseIf)}</b>, l'ordre est <b>inversé</b>.
  Une fausse touche est une faute et la séquence repart du début.</p>
  <div class="melodies">${man.chime.melodies.map((m, k) => `<div class="mel"><small>N° ${k + 1}</small>${staff(m.notes)}<div class="keys">${m.keys.map((i) => chip(KEY_COLORS[i])).join('<i>›</i>')}</div></div>`).join('')}</div>`;
}

function pipes(man) {
  return `<h2>${MODULE_INFO.pipes.icon} Tuyauterie</h2>
  <p>L'eau arrive par une vanne colorée, à gauche. Les sorties sont numérotées <b>I</b> à <b>IV</b>, à droite (de haut en bas).
  Le démineur fait pivoter les tuyaux (un clic = un quart de tour) pour relier l'arrivée à la bonne sortie, puis tourne la vanne pour l'ouvrir.</p>
  <p>Colonne de droite si <b>${condText(man.pipes.cond)}</b>, sinon colonne de gauche.</p>
  <table class="codes"><thead><tr><th>Vanne</th><th>Sinon</th><th>Si ${circled(man.pipes.cond)}</th></tr></thead>
  <tbody>${man.pipes.table.map((row, i) => `<tr><th>${chip(KEY_COLORS[i])}</th><td><b>${OUTLETS[row[0]]}</b></td><td><b>${OUTLETS[row[1]]}</b></td></tr>`).join('')}</tbody></table>
  <p class="note">Ouvrir la vanne sur une fuite ou sur la mauvaise sortie est une faute.</p>`;
}

function gauges(man) {
  return `<h2>${MODULE_INFO.gauges.icon} Manomètres</h2>
  <p>Trois cadrans, chacun cerclé d'une couleur, indiquent une pression de 0 à 9. Sous chaque cadran, une molette réglable.
  Pour chaque cadran : couleur + pression → réglage de sa molette. Puis <b>PURGER</b>.</p>
  <table class="grid gauges"><thead><tr><th></th>${[...Array(10).keys()].map((n) => `<th>${n}</th>`).join('')}</tr></thead>
  <tbody>${man.gauges.table.map((row, c) => `<tr><th>${chip(GAUGE_COLORS[c])}</th>${row.map((v) => `<td><b>${v}</b></td>`).join('')}</tr>`).join('')}</tbody></table>
  <p class="note">Un seul mauvais réglage au moment de purger est une faute.</p>`;
}

const PAGES = [
  { id: 'cover', title: 'Bombe', icon: '📘', html: cover },
  { id: 'wires', title: MODULE_INFO.wires.name, icon: MODULE_INFO.wires.icon, html: wires },
  { id: 'safe', title: MODULE_INFO.safe.name, icon: MODULE_INFO.safe.icon, html: safe },
  { id: 'switches', title: MODULE_INFO.switches.name, icon: MODULE_INFO.switches.icon, html: switches },
  { id: 'chime', title: MODULE_INFO.chime.name, icon: MODULE_INFO.chime.icon, html: chime },
  { id: 'pipes', title: MODULE_INFO.pipes.name, icon: MODULE_INFO.pipes.icon, html: pipes },
  { id: 'gauges', title: MODULE_INFO.gauges.name, icon: MODULE_INFO.gauges.icon, html: gauges },
];

export function mountManual(el, edition) {
  const man = manualOf(edition);
  let page = 'cover';
  el.innerHTML = `<div class="manual"><nav class="tabs" role="tablist">${PAGES.map((p) => `<button role="tab" data-p="${p.id}"><span>${p.icon}</span>${p.title}</button>`).join('')}</nav>
    <article class="page" tabindex="0"></article><div class="ink" hidden></div></div>`;
  const art = el.querySelector('.page');
  const show = (id) => {
    page = id;
    art.innerHTML = PAGES.find((p) => p.id === id).html(man);
    art.scrollTop = 0;
    for (const b of el.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.p === id));
  };
  for (const b of el.querySelectorAll('.tabs button')) b.onclick = () => show(b.dataset.p);
  show(page);
  const ink = el.querySelector('.ink');
  return {
    show,
    // sabotage « encre renversée » : des taches couvrent la page quelques secondes
    ink(sec = 6) {
      ink.innerHTML = Array.from({ length: 7 }, () => `<i style="left:${Math.random() * 80}%;top:${Math.random() * 80}%;width:${120 + Math.random() * 220}px;height:${100 + Math.random() * 200}px"></i>`).join('');
      ink.hidden = false;
      setTimeout(() => { ink.hidden = true; }, sec * 1000);
    },
  };
}
