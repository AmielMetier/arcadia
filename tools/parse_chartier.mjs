// tools/parse_chartier.mjs
// Parse les 300 questions et génère calcul/engine/chartier-data.js avec choix et alias propres.
import fs from 'fs';

const rawLines = fs.readFileSync('calcul/engine/raw_questions.txt', 'utf8').trim().split('\n');

function normalizeStr(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPrimary(raw) {
  // Enlever les notes entre parenthèses sauf si la parenthèse est le cœur de la réponse
  let c = raw.trim();
  // Ex: "15 M€" -> "15 M€"
  // Ex: "Le Taureau (Bull)" -> "Le Taureau"
  // Ex: "Cotation Assistée en Continu" -> "Cotation Assistée en Continu"
  // Ex: "11 % (2 % + 1,5 x 6 %)" -> "11 %"
  // Ex: "0,50 € (50 centimes)" -> "0,50 €"
  // Ex: "100 € ($S = C - P + K ...$)" -> "100 €"
  const matchParen = c.match(/^(.*?)\s*\((.*?)\)$/);
  if (matchParen) {
    const before = matchParen[1].trim();
    const inside = matchParen[2].trim();
    // Si before est substantiel (ex "11 %", "Le Taureau", "Un Call"), garder before
    if (before.length >= 2 && !before.includes('$')) {
      return before;
    }
  }
  return c.split('(')[0].trim() || c;
}

const parsed = [];

for (const line of rawLines) {
  const parts = line.split('|').map(s => s.trim());
  if (parts.length < 5) continue;
  const id = parseInt(parts[0], 10);
  const cat = parts[1];
  const time = parseInt(parts[2].replace('s', ''), 10) || 20;
  const text = parts[3];
  const rawAns = parts.slice(4).join('|').trim();

  const level = id <= 100 ? 'facile' : (id <= 200 ? 'normal' : 'expert');
  const cleanAns = cleanPrimary(rawAns);

  // Construire des alias intelligents
  const aliases = new Set();
  aliases.add(normalizeStr(rawAns));
  aliases.add(normalizeStr(cleanAns));

  // Extraire les nombres éventuels
  const numMatches = cleanAns.match(/[-+]?\d+([,\.]\d+)?/g);
  if (numMatches) {
    numMatches.forEach(n => {
      aliases.add(n.replace(',', '.'));
      aliases.add(n.replace('.', ','));
    });
  }

  // Mots clés finance utiles
  if (rawAns.includes('Bull')) aliases.add('bull');
  if (rawAns.includes('Bear')) aliases.add('bear');
  if (rawAns.includes('Taureau')) aliases.add('taureau');
  if (rawAns.includes('Ours')) aliases.add('ours');
  if (rawAns.includes('Yen')) aliases.add('yen');
  if (rawAns.includes('JPY')) aliases.add('jpy');
  if (rawAns.includes('CHF')) aliases.add('chf');
  if (rawAns.includes('Baisse') || rawAns.includes('baisse')) {
    aliases.add('baisse');
    aliases.add('il baisse');
    aliases.add('diminue');
  }
  if (rawAns.includes('Call') || rawAns.includes('call')) {
    aliases.add('call');
    aliases.add('un call');
  }
  if (rawAns.includes('Put') || rawAns.includes('put')) {
    aliases.add('put');
    aliases.add('un put');
  }
  if (rawAns.includes('S&P') || rawAns.includes('Standard')) {
    aliases.add('s&p');
    aliases.add('sp');
    aliases.add('standard and poor');
  }
  if (rawAns.includes('Cotation')) {
    aliases.add('cotation assistee en continu');
    aliases.add('cotation');
  }
  if (rawAns.includes('100 %')) {
    aliases.add('100');
    aliases.add('100%');
  }

  parsed.push({
    id,
    cat,
    level,
    time,
    text,
    rawAns,
    cleanAns,
    aliases: Array.from(aliases).filter(Boolean)
  });
}

console.log('Processed', parsed.length, 'questions.');
fs.writeFileSync('calcul/engine/chartier-parsed-temp.json', JSON.stringify(parsed, null, 2), 'utf8');
