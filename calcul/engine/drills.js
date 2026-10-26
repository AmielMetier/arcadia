// Exercices « fat finger » et numéros de téléphone de The Candidate, tirés à la volée (jamais deux fois le même).
// Fat finger : recopier exactement, sans erreur, ce qui est affiché (espaces et majuscules compris).
// Les IBAN et les ISIN sont fictifs mais ont une clé de contrôle valide ; les numéros de téléphone aussi sont inventés.
const between = (r, a, b) => a + r.int(b - a + 1);
const pick = (r, l) => l[r.int(l.length)];
// sans O ni I : on ne les confond pas avec 0 et 1
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789', LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const chars = (r, n, set = ALNUM) => Array.from({ length: n }, () => set[r.int(set.length)]).join('');
const digits = (r, n) => Array.from({ length: n }, () => r.int(10)).join('');
// 1234567 → « 1 234 567 » (espace simple : c'est ce qu'on tape au clavier)
const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const money = (r, lo, hi) => `${group(between(r, lo, hi))},${String(r.int(100)).padStart(2, '0')}`;

// Clé ISIN (Luhn sur les chiffres, les lettres valant 10 à 35)
function isinKey(body) {
  const ds = [...body].map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55))).join('');
  let sum = 0;
  [...ds].reverse().forEach((c, k) => { let v = Number(c) * (k % 2 === 0 ? 2 : 1); if (v > 9) v -= 9; sum += v; });
  return String((10 - (sum % 10)) % 10);
}
// Clé IBAN (ISO 13616 : modulo 97 du BBAN suivi du code pays et de 00)
function ibanKey(country, bban) {
  const s = (bban + country + '00').replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const c of s) m = (m * 10 + Number(c)) % 97;
  return String(98 - m).padStart(2, '0');
}

const TICKERS = ['AIR', 'BNP', 'CAP', 'DSY', 'MC', 'OR', 'SAN', 'TTE', 'GLE', 'ACA', 'KER', 'RMS', 'SU', 'EL', 'VIE', 'ENGI', 'ORA', 'STLA', 'HO', 'SGO', 'DG', 'RI', 'BN', 'CS'];
// paire, cours plancher et plafond (en 1/10 000, ou en 1/100 pour le yen)
const FX = [['EUR/USD', 10000, 12000, 4], ['EUR/GBP', 8000, 9000, 4], ['EUR/CHF', 9000, 10000, 4], ['GBP/USD', 12000, 14000, 4], ['AUD/USD', 6000, 7000, 4], ['USD/JPY', 13000, 16000, 2], ['EUR/JPY', 15000, 17500, 2]];
const COUNTRIES = ['FR', 'US', 'DE', 'NL', 'IT', 'GB', 'ES', 'CH', 'LU', 'BE'];
const MONTHS = ['JAN', 'FEV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOU', 'SEP', 'OCT', 'NOV', 'DEC'];
const side = (r) => pick(r, ['ACHAT', 'VENTE']);
const two = (n) => String(n).padStart(2, '0');
const fx = (n, dec) => (n / 10 ** dec).toFixed(dec).replace('.', ',');
const price = (r, lo, hi, dec = 2) => (between(r, lo * 10 ** dec, hi * 10 ** dec) / 10 ** dec).toFixed(dec).replace('.', ',');

// Les formats, par tour : du code court au premier tour, jusqu'aux IBAN et aux ordres complets au comité
const FORMATS = {
  1: [
    ['Code de confirmation', (r) => `${chars(r, 3)}-${chars(r, 4)}`],
    ['Montant en euros', (r) => money(r, 1000, 99999)],
    ['Liste de nombres', (r) => Array.from({ length: 4 }, () => between(r, 10, 999)).join(' - ')],
    ['Référence d\'ordre', (r) => `ORD-${digits(r, 6)}`],
    ['Date et heure d\'exécution', (r) => `${two(between(r, 1, 28))}/${two(between(r, 1, 12))}/${between(r, 2026, 2031)} ${two(between(r, 9, 17))}:${two(r.int(60))}`],
    ['Ticker et quantité', (r) => `${pick(r, TICKERS)} x ${group(between(r, 1, 999) * 10)}`],
  ],
  2: [
    ['Code ISIN (fictif)', (r) => { const b = pick(r, COUNTRIES) + chars(r, 9, '0123456789' + LETTERS.slice(0, 6)); return b + isinKey(b); }],
    ['Ordre à saisir', (r) => `${side(r)} ${group(between(r, 1, 99) * 100)} ${pick(r, TICKERS)} @ ${price(r, 5, 900)}`],
    ['Montant en euros', (r) => money(r, 1e6, 99e6)],
    ['Liste de nombres', (r) => Array.from({ length: 6 }, () => between(r, 100, 9999)).join(' - ')],
    ['Code BIC (fictif)', (r) => `${chars(r, 4, LETTERS)}${pick(r, COUNTRIES)}${chars(r, 2, LETTERS)}${r.next() < 0.5 ? chars(r, 3) : ''}`],
    ['Cours de change', (r) => { const [pair, lo, hi, dec] = pick(r, FX), b = between(r, lo, hi); return `${pair} ${fx(b, dec)} / ${fx(b + between(r, 1, 6), dec)}`; }],
  ],
  3: [
    ['IBAN (fictif)', (r) => { const bban = digits(r, 23), k = ibanKey('FR', bban); return `FR${k}${bban}`.replace(/(.{4})/g, '$1 ').trim(); }],
    ['Code de transfert', (r) => Array.from({ length: 4 }, () => chars(r, 4)).join('-')],
    ['Liste de prix', (r) => Array.from({ length: 6 }, () => price(r, 10, 999)).join(' - ')],
    ['Ordre à cours limité', (r) => `${side(r)} ${group(between(r, 1, 250) * 50)} ${pick(r, TICKERS)} LIM ${price(r, 5, 900, 3)} VAL ${String(between(r, 1, 28)).padStart(2, '0')}/${String(between(r, 1, 12)).padStart(2, '0')}`],
    ['Option à saisir', (r) => `${side(r)} ${between(r, 1, 50) * 10} ${pick(r, ['CALL', 'PUT'])} ${pick(r, TICKERS)} ${pick(r, MONTHS)}${between(r, 27, 30)} K${between(r, 10, 300) * 5} @ ${price(r, 0, 40)}`],
    ['Ordre de change', (r) => { const [pair, lo, hi, dec] = pick(r, FX); return `${side(r)} ${group(between(r, 1, 50) * 100000)} ${pair} @ ${fx(between(r, lo * 10, hi * 10), dec + 1)}`; }],
  ],
};

// Un exercice de fat finger tiré pour le tour : { label, text }
export function fatFinger(r, tier) {
  const [label, make] = pick(r, FORMATS[tier] || FORMATS[1]);
  return { label, text: make(r) };
}
export const FAT_FINGER_FORMATS = Object.fromEntries(Object.entries(FORMATS).map(([t, l]) => [t, l.map(([label]) => label)]));
export { isinKey, ibanKey };

// Un numéro de portable inventé : 06 ou 07, puis quatre paires
export function phoneNumber(r) {
  return [pick(r, ['06', '07']), ...Array.from({ length: 4 }, () => String(r.int(100)).padStart(2, '0'))].join(' ');
}
