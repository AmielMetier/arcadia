// Questions de code du mode The Candidate : on écrit une fonction Python, l'hôte la passe sur des tests cachés.
// Chaque question : niveau (1 = premier tour, 2 = desk, 3 = comité final), énoncé, fonction attendue, code de départ,
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
  {
    id: 'maximum', level: 1, title: 'Le plus grand',
    prompt: 'Écris plus_grand(nombres) qui renvoie le plus grand nombre d\'une liste non vide, sans utiliser max.',
    fn: 'plus_grand', starter: 'def plus_grand(nombres):\n    ',
    tests: [[[[3, 9, 2]], 9], [[[-5, -2, -9]], -2], [[[7]], 7], [[[1, 2, 3, 4, 5, 6]], 6], [[[10, 10, 3]], 10], [[[0, -1, 100, 99]], 100]],
    ref: 'def plus_grand(nombres):\n    m = nombres[0]\n    for x in nombres:\n        if x > m:\n            m = x\n    return m\n',
    tip: 'On part du premier élément et on le remplace dès qu\'on trouve plus grand. Attention aux listes de négatifs : partir de 0 serait faux.',
  },
  {
    id: 'voyelles', level: 1, title: 'Compter les voyelles',
    prompt: 'Écris compter_voyelles(mot) qui renvoie le nombre de voyelles (a e i o u y), majuscules comprises.',
    fn: 'compter_voyelles', starter: 'def compter_voyelles(mot):\n    ',
    tests: [[["bonjour"], 3], [["TRADER"], 2], [[""], 0], [["rythme"], 2], [["Aeiouy"], 6], [["xyz"], 1]],
    ref: 'def compter_voyelles(mot):\n    return sum(1 for c in mot.lower() if c in \'aeiouy\')\n',
    tip: 'On passe le mot en minuscules et on compte les lettres présentes dans \'aeiouy\'.',
  },
  {
    id: 'pair', level: 1, title: 'Pair ou impair',
    prompt: 'Écris est_pair(n) qui renvoie True si l\'entier n est pair, False sinon.',
    fn: 'est_pair', starter: 'def est_pair(n):\n    ',
    tests: [[[4], true], [[7], false], [[0], true], [[-3], false], [[-8], true], [[1000001], false]],
    ref: 'def est_pair(n):\n    return n % 2 == 0\n',
    tip: 'Le reste de la division par 2 : n % 2 == 0. En Python, ça marche aussi pour les négatifs.',
  },
  {
    id: 'moyenne', level: 1, title: 'Moyenne',
    prompt: 'Écris moyenne(notes) qui renvoie la moyenne d\'une liste de nombres (0 si la liste est vide).',
    fn: 'moyenne', starter: 'def moyenne(notes):\n    ',
    tests: [[[[10, 12, 14]], 12.0], [[[]], 0], [[[5]], 5.0], [[[1, 2]], 1.5], [[[0, 0, 0, 20]], 5.0], [[[3, 4, 5, 6]], 4.5]],
    ref: 'def moyenne(notes):\n    if not notes:\n        return 0\n    return sum(notes) / len(notes)\n',
    tip: 'sum(notes) / len(notes), en gérant la liste vide à part pour ne pas diviser par zéro.',
  },
  {
    id: 'inverse_texte', level: 1, title: 'À l\'envers',
    prompt: 'Écris a_l_envers(texte) qui renvoie le texte écrit de droite à gauche.',
    fn: 'a_l_envers', starter: 'def a_l_envers(texte):\n    ',
    tests: [[["marché"], "éhcram"], [[""], ""], [["a"], "a"], [["abc"], "cba"], [["Bourse 2026"], "6202 esruoB"]],
    ref: 'def a_l_envers(texte):\n    return texte[::-1]\n',
    tip: 'Le découpage avec un pas négatif : texte[::-1].',
  },
  {
    id: 'fizzbuzz', level: 1, title: 'FizzBuzz',
    prompt: 'Écris fizzbuzz(n) qui renvoie \'FizzBuzz\' si n est divisible par 3 et 5, \'Fizz\' par 3 seulement, \'Buzz\' par 5 seulement, sinon le nombre en texte.',
    fn: 'fizzbuzz', starter: 'def fizzbuzz(n):\n    ',
    tests: [[[3], "Fizz"], [[5], "Buzz"], [[15], "FizzBuzz"], [[7], "7"], [[30], "FizzBuzz"], [[1], "1"], [[9], "Fizz"], [[10], "Buzz"]],
    ref: 'def fizzbuzz(n):\n    if n % 15 == 0:\n        return \'FizzBuzz\'\n    if n % 3 == 0:\n        return \'Fizz\'\n    if n % 5 == 0:\n        return \'Buzz\'\n    return str(n)\n',
    tip: 'Le piège classique : tester 15 (3 et 5) en premier, sinon 15 répond \'Fizz\'. Et str(n) pour renvoyer du texte.',
  },
  {
    id: 'conversion', level: 1, title: 'Celsius vers Fahrenheit',
    prompt: 'Écris en_fahrenheit(celsius) qui convertit une température : F = C × 9/5 + 32.',
    fn: 'en_fahrenheit', starter: 'def en_fahrenheit(celsius):\n    ',
    tests: [[[0], 32.0], [[100], 212.0], [[-40], -40.0], [[37], 98.6], [[21.5], 70.7]],
    ref: 'def en_fahrenheit(celsius):\n    return celsius * 9 / 5 + 32\n',
    tip: 'Une seule ligne : celsius * 9 / 5 + 32. À −40, les deux échelles se croisent.',
  },
  {
    id: 'somme_pairs', level: 1, title: 'Somme des pairs',
    prompt: 'Écris somme_pairs(nombres) qui renvoie la somme des nombres pairs de la liste.',
    fn: 'somme_pairs', starter: 'def somme_pairs(nombres):\n    ',
    tests: [[[[1, 2, 3, 4]], 6], [[[]], 0], [[[1, 3, 5]], 0], [[[10, -2, 7]], 8], [[[0, 0, 8]], 8]],
    ref: 'def somme_pairs(nombres):\n    return sum(x for x in nombres if x % 2 == 0)\n',
    tip: 'Une somme filtrée : sum(x for x in nombres if x % 2 == 0).',
  },
  {
    id: 'compter', level: 1, title: 'Compter un élément',
    prompt: 'Écris compter(liste, x) qui renvoie le nombre de fois où x apparaît dans la liste, sans utiliser .count.',
    fn: 'compter', starter: 'def compter(liste, x):\n    ',
    tests: [[[[1, 2, 1, 3, 1], 1], 3], [[[], 5], 0], [[["a", "b", "a"], "a"], 2], [[[2, 2, 2], 3], 0], [[[0, 1, 0], 0], 2]],
    ref: 'def compter(liste, x):\n    n = 0\n    for y in liste:\n        if y == x:\n            n += 1\n    return n\n',
    tip: 'Un compteur qu\'on incrémente à chaque élément égal à x.',
  },
  {
    id: 'doublons', level: 2, title: 'Sans doublons',
    prompt: 'Écris sans_doublons(liste) qui renvoie la liste sans les doublons, en gardant l\'ordre de première apparition.',
    fn: 'sans_doublons', starter: 'def sans_doublons(liste):\n    ',
    tests: [[[[3, 1, 3, 2, 1]], [3, 1, 2]], [[[]], []], [[["a", "b", "a"]], ["a", "b"]], [[[5, 5, 5]], [5]], [[[1, 2, 3]], [1, 2, 3]]],
    ref: 'def sans_doublons(liste):\n    vus, res = set(), []\n    for x in liste:\n        if x not in vus:\n            vus.add(x)\n            res.append(x)\n    return res\n',
    tip: 'list(set(...)) perd l\'ordre : il faut un ensemble des éléments déjà vus et une nouvelle liste.',
  },
  {
    id: 'anagramme', level: 2, title: 'Anagrammes',
    prompt: 'Écris sont_anagrammes(a, b) qui renvoie True si les deux mots ont exactement les mêmes lettres (sans tenir compte des majuscules).',
    fn: 'sont_anagrammes', starter: 'def sont_anagrammes(a, b):\n    ',
    tests: [[["chien", "niche"], true], [["Marie", "aimer"], true], [["trade", "tread"], true], [["abc", "abd"], false], [["aab", "abb"], false], [["", ""], true]],
    ref: 'def sont_anagrammes(a, b):\n    return sorted(a.lower()) == sorted(b.lower())\n',
    tip: 'On trie les lettres des deux mots et on compare : sorted(a.lower()) == sorted(b.lower()).',
  },
  {
    id: 'chiffres', level: 2, title: 'Somme des chiffres',
    prompt: 'Écris somme_chiffres(n) qui renvoie la somme des chiffres d\'un entier positif (1234 → 10).',
    fn: 'somme_chiffres', starter: 'def somme_chiffres(n):\n    ',
    tests: [[[1234], 10], [[0], 0], [[9], 9], [[99999], 45], [[1000001], 2], [[2026], 10]],
    ref: 'def somme_chiffres(n):\n    s = 0\n    while n:\n        s += n % 10\n        n //= 10\n    return s\n',
    tip: 'n % 10 donne le dernier chiffre, n // 10 l\'enlève. Ou plus court : sum(int(c) for c in str(n)).',
  },
  {
    id: 'binaire', level: 2, title: 'En binaire',
    prompt: 'Écris en_binaire(n) qui renvoie l\'écriture binaire d\'un entier positif, en texte, sans utiliser bin (5 → \'101\', 0 → \'0\').',
    fn: 'en_binaire', starter: 'def en_binaire(n):\n    ',
    tests: [[[5], "101"], [[0], "0"], [[1], "1"], [[8], "1000"], [[255], "11111111"], [[1024], "10000000000"]],
    ref: 'def en_binaire(n):\n    if n == 0:\n        return \'0\'\n    s = \'\'\n    while n:\n        s = str(n % 2) + s\n        n //= 2\n    return s\n',
    tip: 'Divisions successives par 2 : les restes, lus à l\'envers, donnent l\'écriture binaire. Ne pas oublier le cas 0.',
  },
  {
    id: 'rendements', level: 2, title: 'Rendements',
    prompt: 'Écris rendements(prix) qui renvoie la liste des rendements d\'un jour à l\'autre : (p[i] − p[i−1]) / p[i−1].',
    fn: 'rendements', starter: 'def rendements(prix):\n    ',
    tests: [[[[100, 110, 99]], [0.1, -0.1]], [[[50]], []], [[[]], []], [[[10, 20, 10, 10]], [1.0, -0.5, 0.0]], [[[200, 150]], [-0.25]]],
    ref: 'def rendements(prix):\n    return [(prix[i] - prix[i - 1]) / prix[i - 1] for i in range(1, len(prix))]\n',
    tip: 'Il y a un rendement de moins que de prix. De 110 à 99, c\'est −10 %, pas −11 %.',
  },
  {
    id: 'mots', level: 2, title: 'Compter les mots',
    prompt: 'Écris compter_mots(phrase) qui renvoie un dictionnaire {mot: nombre d\'apparitions}, en minuscules.',
    fn: 'compter_mots', starter: 'def compter_mots(phrase):\n    ',
    tests: [[["Le marché et le desk"], {"le": 2, "marché": 1, "et": 1, "desk": 1}], [[""], {}], [["buy buy SELL"], {"buy": 2, "sell": 1}], [["a b a b a"], {"a": 3, "b": 2}]],
    ref: 'def compter_mots(phrase):\n    d = {}\n    for m in phrase.lower().split():\n        d[m] = d.get(m, 0) + 1\n    return d\n',
    tip: 'Un dictionnaire et d.get(m, 0) + 1 ; collections.Counter fait la même chose.',
  },
  {
    id: 'rotation', level: 2, title: 'Rotation',
    prompt: 'Écris rotation(liste, k) qui décale la liste de k crans vers la droite ([1, 2, 3, 4], 1 → [4, 1, 2, 3]). k peut dépasser la longueur.',
    fn: 'rotation', starter: 'def rotation(liste, k):\n    ',
    tests: [[[[1, 2, 3, 4], 1], [4, 1, 2, 3]], [[[1, 2, 3, 4], 0], [1, 2, 3, 4]], [[[1, 2, 3], 3], [1, 2, 3]], [[[1, 2, 3], 5], [2, 3, 1]], [[[], 2], []], [[["a", "b"], 1], ["b", "a"]]],
    ref: 'def rotation(liste, k):\n    if not liste:\n        return []\n    k %= len(liste)\n    return liste[-k:] + liste[:-k] if k else liste[:]\n',
    tip: 'k % len(liste) gère les grands k, puis on recolle la fin et le début : liste[-k:] + liste[:-k]. Attention à k = 0.',
  },
  {
    id: 'mediane', level: 2, title: 'Médiane',
    prompt: 'Écris mediane(nombres) qui renvoie la médiane d\'une liste non vide (moyenne des deux du milieu si la taille est paire).',
    fn: 'mediane', starter: 'def mediane(nombres):\n    ',
    tests: [[[[3, 1, 2]], 2], [[[4, 1, 3, 2]], 2.5], [[[7]], 7], [[[10, 2, 38, 23, 38, 23, 21]], 23], [[[1, 1, 100, 100]], 50.5]],
    ref: 'def mediane(nombres):\n    t = sorted(nombres)\n    n = len(t)\n    return t[n // 2] if n % 2 else (t[n // 2 - 1] + t[n // 2]) / 2\n',
    tip: 'On trie d\'abord. Taille impaire : l\'élément du milieu ; paire : la moyenne des deux centraux.',
  },
  {
    id: 'meilleur_trade', level: 3, title: 'Le meilleur trade',
    prompt: 'Écris meilleur_trade(prix) qui renvoie le plus gros gain possible en achetant un jour et en revendant un jour suivant (0 si impossible de gagner).',
    fn: 'meilleur_trade', starter: 'def meilleur_trade(prix):\n    ',
    tests: [[[[7, 1, 5, 3, 6, 4]], 5], [[[7, 6, 4, 3, 1]], 0], [[[]], 0], [[[2, 4, 1, 10]], 9], [[[3, 3, 3]], 0], [[[1, 2]], 1]],
    ref: 'def meilleur_trade(prix):\n    bas, gain = None, 0\n    for p in prix:\n        if bas is None or p < bas:\n            bas = p\n        gain = max(gain, p - bas)\n    return gain\n',
    tip: 'Une passe : on garde le plus bas vu jusqu\'ici et le meilleur écart prix − plus bas. Tester toutes les paires est trop lent.',
  },
  {
    id: 'dichotomie', level: 3, title: 'Recherche dichotomique',
    prompt: 'Écris recherche(liste_triee, x) qui renvoie l\'indice de x dans la liste triée, ou −1 s\'il n\'y est pas, en coupant l\'intervalle en deux à chaque étape.',
    fn: 'recherche', starter: 'def recherche(liste_triee, x):\n    ',
    tests: [[[[1, 3, 5, 7, 9], 7], 3], [[[1, 3, 5, 7, 9], 4], -1], [[[], 1], -1], [[[2], 2], 0], [[[1, 2, 3, 4, 5, 6, 7, 8], 1], 0], [[[1, 2, 3, 4, 5, 6, 7, 8], 8], 7]],
    ref: 'def recherche(liste_triee, x):\n    g, d = 0, len(liste_triee) - 1\n    while g <= d:\n        m = (g + d) // 2\n        if liste_triee[m] == x:\n            return m\n        if liste_triee[m] < x:\n            g = m + 1\n        else:\n            d = m - 1\n    return -1\n',
    tip: 'Deux bornes g et d, on regarde le milieu et on garde la bonne moitié : log₂(n) étapes au lieu de n.',
  },
  {
    id: 'mensualite', level: 3, title: 'Mensualité d\'un prêt',
    prompt: 'Écris mensualite(capital, taux_annuel, mois) qui renvoie la mensualité d\'un prêt à taux fixe : C × t / (1 − (1 + t)^−n), avec t le taux mensuel (taux_annuel / 12). Taux nul : C / n.',
    fn: 'mensualite', starter: 'def mensualite(capital, taux_annuel, mois):\n    ',
    tests: [[[100000, 0.036, 240], 585.1114668470295], [[12000, 0.0, 12], 1000.0], [[10000, 0.12, 12], 888.4878867834161], [[200000, 0.04, 300], 1055.6736805955404]],
    ref: 'def mensualite(capital, taux_annuel, mois):\n    t = taux_annuel / 12\n    if t == 0:\n        return capital / mois\n    return capital * t / (1 - (1 + t) ** -mois)\n',
    tip: 'La formule de l\'annuité constante avec le taux mensuel. Sans le cas taux nul, on divise par zéro.',
  },
  {
    id: 'crible', level: 3, title: 'Combien de premiers',
    prompt: 'Écris nb_premiers(n) qui renvoie combien de nombres premiers sont inférieurs ou égaux à n. Il faut que n = 100 000 passe en moins de 4 secondes.',
    fn: 'nb_premiers', starter: 'def nb_premiers(n):\n    ',
    tests: [[[10], 4], [[1], 0], [[2], 1], [[100], 25], [[100000], 9592]],
    ref: 'def nb_premiers(n):\n    if n < 2:\n        return 0\n    est = bytearray([1]) * (n + 1)\n    est[0] = est[1] = 0\n    k = 2\n    while k * k <= n:\n        if est[k]:\n            est[k * k::k] = bytearray(len(range(k * k, n + 1, k)))\n        k += 1\n    return sum(est)\n',
    tip: 'Le crible d\'Ératosthène : on raye les multiples de chaque premier à partir de k². Tester chaque nombre un par un est trop lent.',
  },
  {
    id: 'kadane', level: 3, title: 'Meilleure période',
    prompt: 'Écris meilleure_periode(pnl) qui renvoie la plus grande somme de jours consécutifs d\'un P&L (au moins un jour).',
    fn: 'meilleure_periode', starter: 'def meilleure_periode(pnl):\n    ',
    tests: [[[[-2, 1, -3, 4, -1, 2, 1, -5, 4]], 6], [[[5]], 5], [[[-3, -1, -2]], -1], [[[1, 2, 3]], 6], [[[2, -1, 2, -1, 2]], 4]],
    ref: 'def meilleure_periode(pnl):\n    best = cur = pnl[0]\n    for x in pnl[1:]:\n        cur = max(x, cur + x)\n        best = max(best, cur)\n    return best\n',
    tip: 'L\'algorithme de Kadane : à chaque jour, soit on prolonge la période, soit on repart de zéro. Une passe suffit.',
  },
  {
    id: 'fusion', level: 3, title: 'Fusionner deux listes triées',
    prompt: 'Écris fusion(a, b) qui fusionne deux listes triées en une seule liste triée, sans utiliser sort ni sorted.',
    fn: 'fusion', starter: 'def fusion(a, b):\n    ',
    tests: [[[[1, 4, 9], [2, 3, 10]], [1, 2, 3, 4, 9, 10]], [[[], [1, 2]], [1, 2]], [[[5], []], [5]], [[[1, 1], [1]], [1, 1, 1]], [[[1, 2, 3], [4, 5, 6]], [1, 2, 3, 4, 5, 6]]],
    ref: 'def fusion(a, b):\n    i = j = 0\n    res = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            res.append(a[i]); i += 1\n        else:\n            res.append(b[j]); j += 1\n    return res + a[i:] + b[j:]\n',
    tip: 'Deux curseurs : on prend le plus petit des deux têtes, puis on ajoute ce qui reste. C\'est le cœur du tri fusion.',
  },
  {
    id: 'volatilite', level: 3, title: 'Volatilité',
    prompt: 'Écris volatilite(rendements) qui renvoie l\'écart-type des rendements (population : on divise par n, pas n − 1).',
    fn: 'volatilite', starter: 'def volatilite(rendements):\n    ',
    tests: [[[[0.01, -0.01, 0.01, -0.01]], 0.01], [[[0.05]], 0.0], [[[0.0, 0.0, 0.0]], 0.0], [[[0.02, 0.04, 0.06]], 0.01632993161855452], [[[-0.1, 0.1]], 0.1]],
    ref: 'def volatilite(rendements):\n    n = len(rendements)\n    m = sum(rendements) / n\n    return (sum((r - m) ** 2 for r in rendements) / n) ** 0.5\n',
    tip: 'Moyenne, puis racine de la moyenne des écarts au carré. Le résultat est comparé à 10⁻⁶ près.',
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
