// Questions de code du mode The Candidate : on écrit une fonction Python, l'hôte la passe sur des tests cachés.
// Chaque question : niveau (2 = desk, 3 = comité final), énoncé, fonction attendue, code de départ,
// tests [arguments, résultat attendu] (les deux premiers sont montrés en exemple), solution de référence, explication.
// La solution de référence est vérifiée par tools/test-calcul.mjs avec le même harnais que dans le navigateur.

export const CODE_QUESTIONS = [
  {
    id: 'factorielle', level: 2, title: 'Factorielle',
    prompt: 'Écris factorielle(n) qui renvoie n! = 1 × 2 × … × n (avec 0! = 1).',
    fn: 'factorielle', starter: 'def factorielle(n):\n    ',
    tests: [[[5], 120], [[0], 1], [[1], 1], [[10], 3628800], [[15], 1307674368000]],
    ref: 'def factorielle(n):\n    r = 1\n    for k in range(2, n + 1):\n        r *= k\n    return r\n',
    tip: 'Une boucle qui multiplie, ou la récursion n × factorielle(n − 1) avec le cas de base 0! = 1.',
  },
  {
    id: 'somme', level: 2, title: 'Somme jusqu\'à n',
    prompt: 'Écris somme_jusqua(n) qui renvoie 1 + 2 + … + n (0 si n = 0).',
    fn: 'somme_jusqua', starter: 'def somme_jusqua(n):\n    ',
    tests: [[[10], 55], [[100], 5050], [[0], 0], [[1], 1], [[1000000], 500000500000]],
    ref: 'def somme_jusqua(n):\n    return n * (n + 1) // 2\n',
    tip: 'Gauss : n(n + 1)/2. Avec // pour rester en entier ; une boucle marche aussi, mais plus lentement.',
  },
  {
    id: 'fibonacci', level: 2, title: 'Fibonacci',
    prompt: 'Écris fibonacci(n) qui renvoie le n-ième terme de la suite 0, 1, 1, 2, 3, 5, 8… (fibonacci(0) = 0, fibonacci(1) = 1).',
    fn: 'fibonacci', starter: 'def fibonacci(n):\n    ',
    tests: [[[10], 55], [[1], 1], [[0], 0], [[2], 1], [[30], 832040], [[50], 12586269025]],
    ref: 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
    tip: 'En itératif avec deux variables : la récursion naïve recalcule tout et devient trop lente vers n = 35.',
  },
  {
    id: 'palindrome', level: 2, title: 'Palindrome',
    prompt: 'Écris est_palindrome(texte) qui renvoie True si le texte se lit pareil dans les deux sens, sans tenir compte des majuscules ni des espaces.',
    fn: 'est_palindrome', starter: 'def est_palindrome(texte):\n    ',
    tests: [[['Kayak'], true], [['trader'], false], [['Engage le jeu que je le gagne'], true], [[''], true], [['ab'], false], [['Esope reste ici et se repose'], true]],
    ref: 'def est_palindrome(texte):\n    t = texte.replace(" ", "").lower()\n    return t == t[::-1]\n',
    tip: 'On normalise (minuscules, sans espaces) puis on compare à l\'envers : t == t[::-1].',
  },
  {
    id: 'premier', level: 2, title: 'Nombre premier',
    prompt: 'Écris est_premier(n) qui renvoie True si n est un nombre premier, False sinon.',
    fn: 'est_premier', starter: 'def est_premier(n):\n    ',
    tests: [[[7], true], [[1], false], [[2], true], [[0], false], [[91], false], [[97], true], [[7919], true], [[1000000], false]],
    ref: 'def est_premier(n):\n    if n < 2:\n        return False\n    k = 2\n    while k * k <= n:\n        if n % k == 0:\n            return False\n        k += 1\n    return True\n',
    tip: 'Inutile de tester au-delà de √n. Attention aux cas 0 et 1, qui ne sont pas premiers. 91 = 7 × 13.',
  },
  {
    id: 'inverser_mots', level: 2, title: 'Inverser les mots',
    prompt: 'Écris inverser_mots(phrase) qui renvoie la phrase avec les mots dans l\'ordre inverse (séparés par un espace).',
    fn: 'inverser_mots', starter: 'def inverser_mots(phrase):\n    ',
    tests: [[['le marché monte'], 'monte marché le'], [['bonjour'], 'bonjour'], [['a b c d'], 'd c b a'], [['buy low sell high'], 'high sell low buy']],
    ref: 'def inverser_mots(phrase):\n    return " ".join(reversed(phrase.split()))\n',
    tip: '" ".join(phrase.split()[::-1]) : on découpe, on retourne la liste, on recolle.',
  },
  {
    id: 'interets', level: 2, title: 'Intérêts composés',
    prompt: 'Écris valeur_future(capital, taux, annees) qui renvoie la valeur d\'un placement à intérêts composés annuels (taux 0.05 pour 5 %).',
    fn: 'valeur_future', starter: 'def valeur_future(capital, taux, annees):\n    ',
    tests: [[[1000, 0.1, 3], 1331.0], [[100, 0.05, 0], 100.0], [[1000, 0.05, 10], 1628.894626777442], [[250, 0.02, 5], 276.0202008]],
    ref: 'def valeur_future(capital, taux, annees):\n    return capital * (1 + taux) ** annees\n',
    tip: 'Capital × (1 + taux)^années. Le résultat est comparé à 10⁻⁶ près.',
  },
  {
    id: 'pgcd', level: 3, title: 'PGCD',
    prompt: 'Écris pgcd(a, b) qui renvoie le plus grand diviseur commun de deux entiers positifs, sans utiliser math.gcd.',
    fn: 'pgcd', starter: 'def pgcd(a, b):\n    ',
    tests: [[[12, 18], 6], [[17, 5], 1], [[100, 75], 25], [[0, 9], 9], [[1071, 462], 21], [[2 ** 20, 2 ** 12 * 3], 4096]],
    ref: 'def pgcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n',
    tip: 'Algorithme d\'Euclide : pgcd(a, b) = pgcd(b, a mod b), jusqu\'à ce que le reste soit nul.',
  },
  {
    id: 'parentheses', level: 3, title: 'Parenthèses équilibrées',
    prompt: 'Écris equilibre(s) qui renvoie True si les parenthèses ( ) de la chaîne sont bien équilibrées (chaque ouvrante fermée dans l\'ordre).',
    fn: 'equilibre', starter: 'def equilibre(s):\n    ',
    tests: [[['(()())'], true], [[')('], false], [[''], true], [['(()'], false], [['(a + b) * (c - (d / e))'], true], [['())('], false]],
    ref: 'def equilibre(s):\n    n = 0\n    for c in s:\n        if c == "(":\n            n += 1\n        elif c == ")":\n            n -= 1\n            if n < 0:\n                return False\n    return n == 0\n',
    tip: 'Un compteur suffit : +1 à l\'ouvrante, −1 à la fermante. Il ne doit jamais passer sous 0, et finir à 0.',
  },
  {
    id: 'drawdown', level: 3, title: 'Max drawdown',
    prompt: 'Écris max_drawdown(prix) qui renvoie la pire baisse relative depuis un plus haut, en positif (0.5 pour −50 %). Liste vide ou toujours en hausse : 0.',
    fn: 'max_drawdown', starter: 'def max_drawdown(prix):\n    ',
    tests: [[[[100, 120, 90, 130, 65]], 0.5], [[[100, 110, 120]], 0.0], [[[]], 0.0], [[[50, 40, 30, 20]], 0.6], [[[10, 20, 15, 30, 21, 40]], 0.3]],
    ref: 'def max_drawdown(prix):\n    plus_haut, pire = None, 0.0\n    for p in prix:\n        if plus_haut is None or p > plus_haut:\n            plus_haut = p\n        pire = max(pire, (plus_haut - p) / plus_haut)\n    return pire\n',
    tip: 'Une seule passe : on retient le plus haut atteint, et la pire chute (plus haut − prix) / plus haut. Ici, de 130 à 65 : −50 %.',
  },
  {
    id: 'deux_sommes', level: 3, title: 'Deux sommes',
    prompt: 'Écris deux_sommes(nombres, cible) qui renvoie les indices [i, j] (i < j) des deux nombres dont la somme vaut cible. Il y a toujours exactement une solution.',
    fn: 'deux_sommes', starter: 'def deux_sommes(nombres, cible):\n    ',
    tests: [[[[2, 7, 11, 15], 9], [0, 1]], [[[3, 2, 4], 6], [1, 2]], [[[1, 5, 3, 8], 11], [2, 3]], [[[0, -1, 2, -3, 1], -2], [3, 4]]],
    ref: 'def deux_sommes(nombres, cible):\n    vus = {}\n    for j, x in enumerate(nombres):\n        if cible - x in vus:\n            return [vus[cible - x], j]\n        vus[x] = j\n    return []\n',
    tip: 'Avec un dictionnaire des nombres déjà vus : une seule passe, au lieu de tester toutes les paires.',
  },
  {
    id: 'moyenne_mobile', level: 3, title: 'Moyenne mobile',
    prompt: 'Écris moyenne_mobile(prix, k) qui renvoie la liste des moyennes de k prix consécutifs (fenêtre glissante).',
    fn: 'moyenne_mobile', starter: 'def moyenne_mobile(prix, k):\n    ',
    tests: [[[[1, 2, 3, 4, 5], 2], [1.5, 2.5, 3.5, 4.5]], [[[10, 20, 30], 3], [20.0]], [[[5, 5, 5, 5], 1], [5.0, 5.0, 5.0, 5.0]], [[[1, 2], 3], []]],
    ref: 'def moyenne_mobile(prix, k):\n    return [sum(prix[i:i + k]) / k for i in range(len(prix) - k + 1)]\n',
    tip: 'Il y a len(prix) − k + 1 fenêtres. Plus rapide : ajouter le prix qui entre et retirer celui qui sort.',
  },
  {
    id: 'zero_coupon', level: 3, title: 'Prix d\'un zéro coupon',
    prompt: 'Écris prix_zero_coupon(nominal, taux, annees) qui renvoie le prix d\'un zéro coupon (actualisation composée annuelle).',
    fn: 'prix_zero_coupon', starter: 'def prix_zero_coupon(nominal, taux, annees):\n    ',
    tests: [[[100, 0.04, 2], 92.45562130177515], [[100, 0.0, 5], 100.0], [[1000, 0.05, 10], 613.9132535407591], [[100, 0.1, 1], 90.9090909090909]],
    ref: 'def prix_zero_coupon(nominal, taux, annees):\n    return nominal / (1 + taux) ** annees\n',
    tip: 'Prix = nominal / (1 + taux)^années : à 4 % sur 2 ans, 100 / 1,0816 ≈ 92,46.',
  },
];

// Programme Python complet : le code du joueur, puis les tests. Le résultat (JSON) est dans __RESULT.
// Les chaînes JSON sont aussi des chaînes Python valides.
export function buildProgram(code, fn, tests, { print = false } = {}) {
  return `
import json as __json, math as __math, copy as __copy, sys as __sys
__sys.modules['js'] = None
__sys.modules['pyodide_js'] = None
__sys.setrecursionlimit(3000)
__src = ${JSON.stringify(String(code))}
__tests = __json.loads(${JSON.stringify(JSON.stringify(tests))})
# types exacts : un objet qui se dirait « égal à tout » ne passe pas les tests
def __same(a, b, __t=type):
    if __t(b) is float or (__t(a) is float and __t(b) is int):
        if __t(a) not in (int, float):
            return False
        return __math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-9)
    if __t(b) in (list, tuple):
        return __t(a) in (list, tuple) and len(a) == len(b) and all(__same(x, y) for x, y in zip(a, b))
    return __t(a) is __t(b) and a == b
__dumps = __json.dumps
__out = {'error': None, 'tests': []}
__ns = {}
try:
    exec(compile(__src, 'ta_reponse.py', 'exec'), __ns)
except Exception as __e:
    __out['error'] = type(__e).__name__ + ' : ' + str(__e)
else:
    __f = __ns.get(${JSON.stringify(fn)})
    if not callable(__f):
        __out['error'] = "La fonction ${fn} n'est pas définie"
    else:
        for __args, __exp in __tests:
            try:
                __got = __f(*__copy.deepcopy(__args))
                __out['tests'].append({'ok': bool(__same(__got, __exp)), 'got': repr(__got)[:120]})
            except Exception as __e:
                __out['tests'].append({'ok': False, 'err': (type(__e).__name__ + ' : ' + str(__e))[:160]})
__RESULT = __dumps(__out)
${print ? 'print("@@RESULT@@" + __RESULT)' : ''}
`;
}

// Résultat d'exécution → nombre de tests réussis (une erreur de compilation n'en passe aucun)
export function scoreRun(out, total) {
  if (!out || out.error) return 0;
  return Math.min(total, (out.tests || []).filter((t) => t.ok).length);
}
