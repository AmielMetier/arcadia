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

// « Que va afficher ce programme ? » : la bonne réponse est la sortie réelle (vérifiée par tools/test-calcul.mjs) ;
// la première mauvaise réponse est le piège.
export const READ_QUESTIONS = [
  { id: 'lire1', level: 1, code: 'x = [1, 2, 3]\ny = x\ny.append(4)\nprint(len(x))', good: '4', wrong: ["3", "1", "7"], tip: 'y n\'est pas une copie : x et y désignent la même liste. Pour copier, il faut x.copy() ou x[:].' },
  { id: 'lire2', level: 1, code: 'print(7 // 2, 7 % 2)', good: '3 1', wrong: ["3.5 0", "3 0.5", "4 1"], tip: '// est la division entière (3) et % le reste (1).' },
  { id: 'lire3', level: 1, code: 'print(\'5\' + \'3\', 5 + 3)', good: '53 8', wrong: ["8 8", "53 53", "8 53"], tip: 'Entre deux chaînes, + les colle : \'53\'. Entre deux nombres, il additionne : 8.' },
  { id: 'lire4', level: 2, code: 'print(0.1 + 0.2 == 0.3)', good: 'False', wrong: ["True", "0.3", "None"], tip: 'Les décimaux sont stockés en binaire : 0.1 + 0.2 vaut 0.30000000000000004. On compare avec math.isclose.' },
  { id: 'lire5', level: 2, code: 'def f(a, l=[]):\n    l.append(a)\n    return l\nf(1)\nprint(f(2))', good: '[1, 2]', wrong: ["[2]", "[1]", "[2, 1]"], tip: 'La liste par défaut est créée une seule fois, à la définition : elle garde le 1 du premier appel. On écrit l=None, puis l = [] dans la fonction.' },
  { id: 'lire6', level: 2, code: 'print([i * i for i in range(4)])', good: '[0, 1, 4, 9]', wrong: ["[1, 4, 9, 16]", "[0, 1, 2, 3]", "[0, 2, 4, 6]"], tip: 'range(4) va de 0 à 3 inclus : 0, 1, 4, 9.' },
  { id: 'lire7', level: 2, code: 's = \'trader\'\nprint(s[1:4])', good: 'rad', wrong: ["trad", "rade", "tra"], tip: 'On commence à l\'indice 1 (le r) et on s\'arrête avant l\'indice 4 : \'rad\'.' },
  { id: 'lire8', level: 2, code: 'print(sorted([3, 1, 2], reverse=True))', good: '[3, 2, 1]', wrong: ["[1, 2, 3]", "None", "[2, 1, 3]"], tip: 'sorted renvoie une nouvelle liste triée ; reverse=True la met dans l\'ordre décroissant.' },
  { id: 'lire9', level: 2, code: 'a = [3, 1, 2]\nprint(a.sort())', good: 'None', wrong: ["[1, 2, 3]", "[3, 1, 2]", "[3, 2, 1]"], tip: 'a.sort() trie la liste sur place et renvoie None. C\'est sorted(a) qui renvoie la liste triée.' },
  { id: 'lire10', level: 2, code: 'print(2 ** 3 ** 2)', good: '512', wrong: ["64", "36", "18"], tip: 'La puissance se lit de droite à gauche : 3 ** 2 = 9 d\'abord, puis 2 ** 9 = 512.' },
  { id: 'lire11', level: 2, code: 'n = 0\nfor i in range(1, 10, 3):\n    n += i\nprint(n)', good: '12', wrong: ["22", "45", "15"], tip: 'range(1, 10, 3) donne 1, 4, 7 : le 10 est exclu. 1 + 4 + 7 = 12.' },
  { id: 'lire12', level: 2, code: 'print(len({1, 2, 2, 3, 3, 3}))', good: '3', wrong: ["6", "1", "4"], tip: 'Un ensemble ne garde chaque valeur qu\'une fois : {1, 2, 3}.' },
  { id: 'lire13', level: 3, code: 'x = 10\ndef f():\n    x = 5\nf()\nprint(x)', good: '10', wrong: ["5", "None", "15"], tip: 'Dans f, x = 5 crée une variable locale : le x global ne change pas. Il faudrait global x.' },
  { id: 'lire14', level: 3, code: 'print(list(zip([1, 2, 3], \'ab\')))', good: '[(1, \'a\'), (2, \'b\')]', wrong: ["[(1, 'a'), (2, 'b'), (3, None)]", "[1, 2, 3, 'a', 'b']", "[(1, 2, 3), ('a', 'b')]"], tip: 'zip s\'arrête à la plus courte des deux séquences : le 3 n\'a pas de partenaire.' },
  { id: 'lire15', level: 3, code: 'd = {\'a\': 1}\nd[\'b\'] = d.get(\'b\', 0) + 1\nprint(d)', good: '{\'a\': 1, \'b\': 1}', wrong: ["KeyError", "{'a': 1}", "{'a': 1, 'b': 0}"], tip: 'd.get(\'b\', 0) renvoie 0 si la clé manque, sans erreur : \'b\' vaut ensuite 1.' },
  { id: 'lire16', level: 3, code: 'print(bool([]), bool([0]))', good: 'False True', wrong: ["False False", "True True", "True False"], tip: 'Une liste vide est fausse ; une liste qui contient quelque chose (même 0) est vraie.' },
  { id: 'lire17', level: 3, code: 'funcs = [lambda: i for i in range(3)]\nprint([f() for f in funcs])', good: '[2, 2, 2]', wrong: ["[0, 1, 2]", "[0, 0, 0]", "[3, 3, 3]"], tip: 'Les lambdas lisent i au moment de l\'appel, quand la boucle est finie : i vaut 2 pour toutes. On fige la valeur avec lambda i=i: i.' },
  { id: 'lire18', level: 3, code: 'print(round(2.5), round(3.5))', good: '2 4', wrong: ["3 4", "2 3", "3 3"], tip: 'Python arrondit les .5 au pair le plus proche (arrondi bancaire) : 2 et 4.' },
  { id: 'lire19', level: 3, code: 'a = [[0] * 2] * 2\na[0][0] = 1\nprint(a)', good: '[[1, 0], [1, 0]]', wrong: ["[[1, 0], [0, 0]]", "[[1, 1], [0, 0]]", "[[1, 1], [1, 1]]"], tip: '[[0] * 2] * 2 répète deux fois la même liste intérieure : la modifier change les deux lignes. On écrit [[0] * 2 for _ in range(2)].' },
  { id: 'lire20', level: 3, code: 'print(sum(range(101)) - sum(range(100)))', good: '100', wrong: ["101", "1", "0"], tip: 'La seule différence est le dernier terme de range(101), qui va jusqu\'à 100 inclus.' },
];

// « Corrige le bug » : le code de départ est faux sur au moins un test (vérifié ici et par les tests).
export const FIX_QUESTIONS = [
  {
    id: 'bug_moyenne', level: 1, bug: true, title: 'Moyenne qui déraille',
    prompt: 'Ce code devrait renvoyer la moyenne d\'une liste non vide, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'moyenne_liste', starter: 'def moyenne_liste(l):\n    total = 0\n    for x in l:\n        total += x\n    return total / (len(l) - 1)\n',
    tests: [[[[10, 20]], 15.0], [[[5]], 5.0], [[[1, 2, 3, 4]], 2.5], [[[0, 0, 9]], 3.0]],
    ref: 'def moyenne_liste(l):\n    total = 0\n    for x in l:\n        total += x\n    return total / len(l)\n',
    tip: 'On divise par le nombre d\'éléments, len(l), pas par len(l) − 1 (qui plante en plus pour une liste d\'un seul élément).',
  },
  {
    id: 'bug_max', level: 1, bug: true, title: 'Le maximum des négatifs',
    prompt: 'Ce code devrait renvoyer le plus grand nombre d\'une liste non vide, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'maximum', starter: 'def maximum(l):\n    m = 0\n    for x in l:\n        if x > m:\n            m = x\n    return m\n',
    tests: [[[[3, 9, 2]], 9], [[[-5, -2, -9]], -2], [[[7]], 7], [[[-1]], -1]],
    ref: 'def maximum(l):\n    m = l[0]\n    for x in l:\n        if x > m:\n            m = x\n    return m\n',
    tip: 'Partir de 0 donne 0 pour une liste de négatifs : on part du premier élément.',
  },
  {
    id: 'bug_fact', level: 2, bug: true, title: 'Factorielle trop courte',
    prompt: 'Ce code devrait renvoyer n! (avec 0! = 1), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'fact', starter: 'def fact(n):\n    r = 1\n    for k in range(1, n):\n        r *= k\n    return r\n',
    tests: [[[5], 120], [[0], 1], [[1], 1], [[6], 720], [[10], 3628800]],
    ref: 'def fact(n):\n    r = 1\n    for k in range(1, n + 1):\n        r *= k\n    return r\n',
    tip: 'range(1, n) s\'arrête à n − 1 : il manque le dernier facteur. Il faut range(1, n + 1).',
  },
  {
    id: 'bug_palindrome', level: 2, bug: true, title: 'Palindrome et majuscules',
    prompt: 'Ce code devrait dire si un mot se lit pareil dans les deux sens, sans tenir compte des majuscules, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'palindrome', starter: 'def palindrome(mot):\n    return mot == mot[::-1]\n',
    tests: [[["kayak"], true], [["Kayak"], true], [["Radar"], true], [["trader"], false], [["A"], true]],
    ref: 'def palindrome(mot):\n    m = mot.lower()\n    return m == m[::-1]\n',
    tip: '« Kayak » à l\'envers donne « kayaK » : on met tout en minuscules avant de comparer.',
  },
  {
    id: 'bug_compte', level: 2, bug: true, title: 'Compteur remis à zéro',
    prompt: 'Ce code devrait compter combien de fois une lettre apparaît dans un mot, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'compte_lettre', starter: 'def compte_lettre(mot, lettre):\n    for c in mot:\n        n = 0\n        if c == lettre:\n            n += 1\n    return n\n',
    tests: [[["banane", "a"], 2], [["trader", "r"], 2], [["abc", "z"], 0], [["aaa", "a"], 3]],
    ref: 'def compte_lettre(mot, lettre):\n    n = 0\n    for c in mot:\n        if c == lettre:\n            n += 1\n    return n\n',
    tip: 'Le compteur est remis à zéro à chaque tour de boucle : il faut l\'initialiser avant la boucle.',
  },
  {
    id: 'bug_interets', level: 3, bug: true, title: 'Intérêts pas si composés',
    prompt: 'Ce code devrait renvoyer la valeur d\'un capital placé à intérêts composés annuels (taux 0.05 pour 5 %), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'valeur_future', starter: 'def valeur_future(capital, taux, annees):\n    return capital * (1 + taux * annees)\n',
    tests: [[[1000, 0.1, 3], 1331.0000000000005], [[100, 0.05, 1], 105.0], [[1000, 0.05, 10], 1628.894626777442], [[500, 0, 4], 500]],
    ref: 'def valeur_future(capital, taux, annees):\n    return capital * (1 + taux) ** annees\n',
    tip: '(1 + taux × années), ce sont des intérêts simples. Composés : (1 + taux) puissance années.',
  },
  {
    id: 'bug_recherche', level: 3, bug: true, title: 'Recherche qui rate la fin',
    prompt: 'Ce code devrait renvoyer l\'indice de x dans une liste triée, ou -1 (recherche dichotomique), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'cherche', starter: 'def cherche(l, x):\n    g, d = 0, len(l) - 1\n    while g < d:\n        m = (g + d) // 2\n        if l[m] == x:\n            return m\n        if l[m] < x:\n            g = m + 1\n        else:\n            d = m - 1\n    return -1\n',
    tests: [[[[1, 3, 5, 7], 7], 3], [[[1, 3, 5, 7], 4], -1], [[[2], 2], 0], [[[1, 2, 3, 4, 5], 5], 4], [[[], 1], -1]],
    ref: 'def cherche(l, x):\n    g, d = 0, len(l) - 1\n    while g <= d:\n        m = (g + d) // 2\n        if l[m] == x:\n            return m\n        if l[m] < x:\n            g = m + 1\n        else:\n            d = m - 1\n    return -1\n',
    tip: 'Avec g < d, on s\'arrête quand il reste une seule case sans la regarder : il faut g <= d.',
  },
  {
    id: 'bug_drawdown', level: 3, bug: true, title: 'Drawdown à l\'envers',
    prompt: 'Ce code devrait renvoyer la pire baisse relative depuis un plus haut (0.5 pour −50 %), 0 si les prix ne baissent jamais, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'drawdown', starter: 'def drawdown(prix):\n    if not prix:\n        return 0.0\n    return (max(prix) - min(prix)) / max(prix)\n',
    tests: [[[[100, 120, 90, 130, 65]], 0.5], [[[100, 110, 120]], 0.0], [[[]], 0.0], [[[50, 100, 80]], 0.2], [[[100, 50, 200]], 0.5]],
    ref: 'def drawdown(prix):\n    plus_haut, pire = None, 0.0\n    for p in prix:\n        if plus_haut is None or p > plus_haut:\n            plus_haut = p\n        pire = max(pire, (plus_haut - p) / plus_haut)\n    return pire\n',
    tip: 'Le plus bas doit venir après le plus haut : de 50 à 200, il n\'y a aucune baisse. On suit le plus haut atteint jusqu\'ici.',
  },
  // lot 2 : seize bugs de plus (résultats attendus calculés avec la version corrigée)
  {
    id: 'bug_pairs', level: 1, bug: true, title: 'La somme des pairs',
    prompt: 'Ce code devrait renvoyer la somme des nombres pairs d\'une liste, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'somme_pairs', starter: 'def somme_pairs(l):\n    s = 0\n    for x in l:\n        if x % 2 == 1:\n            s += x\n    return s\n',
    tests: [[[[1,2,3,4]],6],[[[5,7]],0],[[[]],0],[[[10,-2,3]],8]],
    ref: 'def somme_pairs(l):\n    s = 0\n    for x in l:\n        if x % 2 == 0:\n            s += x\n    return s\n',
    tip: 'x % 2 == 1 teste les impairs. Un nombre est pair quand x % 2 == 0.',
  },
  {
    id: 'bug_reverse', level: 1, bug: true, title: 'La liste qui disparaît',
    prompt: 'Ce code devrait renvoyer la liste à l\'envers, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'a_l_envers', starter: 'def a_l_envers(l):\n    return l.reverse()\n',
    tests: [[[[1,2,3]],[3,2,1]],[[["a","b"]],["b","a"]],[[[]],[]],[[[7]],[7]]],
    ref: 'def a_l_envers(l):\n    return l[::-1]\n',
    tip: 'list.reverse() retourne la liste sur place et renvoie None. l[::-1] renvoie une nouvelle liste.',
  },
  {
    id: 'bug_variation', level: 1, bug: true, title: 'Variation à l\'envers',
    prompt: 'Ce code devrait renvoyer la variation en % d\'un prix (de 100 à 120 : 20.0), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'variation', starter: 'def variation(avant, apres):\n    return (apres - avant) / apres * 100\n',
    tests: [[[100,120],20],[[50,25],-50],[[80,100],25],[[200,200],0]],
    ref: 'def variation(avant, apres):\n    return (apres - avant) / avant * 100\n',
    tip: 'Une variation se rapporte au point de départ : on divise par avant, pas par après.',
  },
  {
    id: 'bug_positifs', level: 1, bug: true, title: 'Les zéros comptés',
    prompt: 'Ce code devrait compter les nombres strictement positifs d\'une liste, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'nb_positifs', starter: 'def nb_positifs(l):\n    return sum(1 for x in l if x >= 0)\n',
    tests: [[[[1,-2,3]],2],[[[0,0,5]],1],[[[]],0],[[[-1,0]],0]],
    ref: 'def nb_positifs(l):\n    return sum(1 for x in l if x > 0)\n',
    tip: 'Strictement positif : x > 0. Avec x >= 0, les zéros sont comptés.',
  },
  {
    id: 'bug_moyenne_vide', level: 1, bug: true, title: 'Moyenne d\'une liste vide',
    prompt: 'Ce code devrait renvoyer la moyenne d\'une liste, et 0 pour une liste vide, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'moyenne', starter: 'def moyenne(l):\n    return sum(l) / len(l)\n',
    tests: [[[[2,4]],3],[[[]],0],[[[5]],5],[[[1,2,3,4]],2.5]],
    ref: 'def moyenne(l):\n    if not l:\n        return 0\n    return sum(l) / len(l)\n',
    tip: 'Pour une liste vide, len(l) vaut 0 : division par zéro. On traite ce cas d\'abord.',
  },
  {
    id: 'bug_doublons', level: 2, bug: true, title: 'Doublons et ordre',
    prompt: 'Ce code devrait retirer les doublons d\'une liste en gardant l\'ordre de première apparition, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'sans_doublons', starter: 'def sans_doublons(l):\n    return list(set(l))\n',
    tests: [[[[3,1,3,2,1]],[3,1,2]],[[[5,5,5]],[5]],[[[]],[]],[[[9,8,7,8]],[9,8,7]]],
    ref: 'def sans_doublons(l):\n    vus, res = set(), []\n    for x in l:\n        if x not in vus:\n            vus.add(x)\n            res.append(x)\n    return res\n',
    tip: 'Un set n\'a pas d\'ordre garanti. On garde un set des valeurs vues et on remplit une liste dans l\'ordre.',
  },
  {
    id: 'bug_fibo', level: 2, bug: true, title: 'Fibonacci décalé',
    prompt: 'Ce code devrait renvoyer le n-ième terme de Fibonacci (fib(0) = 0, fib(1) = 1), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'fib', starter: 'def fib(n):\n    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
    tests: [[[0],0],[[1],1],[[2],1],[[10],55],[[20],6765]],
    ref: 'def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
    tip: 'La suite commence à 0, 1 : avec a, b = 1, 1, tout est décalé d\'un cran.',
  },
  {
    id: 'bug_mediane', level: 2, bug: true, title: 'Médiane en désordre',
    prompt: 'Ce code devrait renvoyer la médiane d\'une liste non vide, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'mediane', starter: 'def mediane(l):\n    n = len(l)\n    if n % 2:\n        return l[n // 2]\n    return (l[n // 2 - 1] + l[n // 2]) / 2\n',
    tests: [[[[3,1,2]],2],[[[4,1,3,2]],2.5],[[[7]],7],[[[1,2,3]],2]],
    ref: 'def mediane(l):\n    l = sorted(l)\n    n = len(l)\n    if n % 2:\n        return l[n // 2]\n    return (l[n // 2 - 1] + l[n // 2]) / 2\n',
    tip: 'La médiane se lit sur la liste triée : il manque sorted(l).',
  },
  {
    id: 'bug_rendement', level: 2, bug: true, title: 'Rendements additionnés',
    prompt: 'Ce code devrait renvoyer le rendement cumulé d\'une suite de rendements ([0.1, -0.1] donne -0.01), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'rendement_cumule', starter: 'def rendement_cumule(r):\n    return sum(r)\n',
    tests: [[[[0.1,-0.1]],-0.009999999999999898],[[[0.5,0.5]],1.25],[[[]],0],[[[0.2]],0.19999999999999996]],
    ref: 'def rendement_cumule(r):\n    v = 1.0\n    for x in r:\n        v *= 1 + x\n    return v - 1\n',
    tip: 'Les rendements se composent : on multiplie les (1 + r), on ne les additionne pas. +10 % puis −10 % fait −1 %.',
  },
  {
    id: 'bug_mots', level: 2, bug: true, title: 'Les espaces en trop',
    prompt: 'Ce code devrait compter les mots d\'une phrase, même avec plusieurs espaces entre eux, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'nb_mots', starter: 'def nb_mots(phrase):\n    return len(phrase.split(\' \'))\n',
    tests: [[["achat de 100 titres"],4],[["vente  rapide"],2],[[""],0],[["  bonjour  "],1]],
    ref: 'def nb_mots(phrase):\n    return len(phrase.split())\n',
    tip: 'split(\' \') coupe à chaque espace et crée des mots vides ; split() sans argument ignore les espaces multiples.',
  },
  {
    id: 'bug_defaut', level: 2, bug: true, title: 'La liste qui se souvient',
    prompt: 'Ce code devrait renvoyer une nouvelle liste [x] à chaque appel quand on ne donne pas de liste, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'ajoute', starter: 'def ajoute(x, l=[]):\n    l.append(x)\n    return l\n',
    tests: [[[1],[1]],[[2],[2]],[[3],[3]],[[4],[4]]],
    ref: 'def ajoute(x, l=None):\n    if l is None:\n        l = []\n    l.append(x)\n    return l\n',
    tip: 'La valeur par défaut [] est créée une seule fois et partagée entre les appels. On utilise None, puis une liste neuve.',
  },
  {
    id: 'bug_vwap', level: 3, bug: true, title: 'VWAP sans les volumes',
    prompt: 'Ce code devrait renvoyer le prix moyen pondéré par les volumes (VWAP) d\'une liste de (prix, quantité), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'vwap', starter: 'def vwap(ordres):\n    return sum(p for p, q in ordres) / len(ordres)\n',
    tests: [[[[[100,10],[110,30]]],107.5],[[[[50,1]]],50],[[[[10,1],[20,3]]],17.5],[[[[99,5],[101,5]]],100]],
    ref: 'def vwap(ordres):\n    return sum(p * q for p, q in ordres) / sum(q for p, q in ordres)\n',
    tip: 'VWAP = Σ prix × quantité / Σ quantité. La moyenne simple des prix ignore les volumes.',
  },
  {
    id: 'bug_moyenne_mobile', level: 3, bug: true, title: 'La dernière moyenne manquante',
    prompt: 'Ce code devrait renvoyer les moyennes mobiles sur k valeurs ([1, 2, 3, 4], k = 2 → [1.5, 2.5, 3.5]), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'moyennes_mobiles', starter: 'def moyennes_mobiles(l, k):\n    return [sum(l[i:i + k]) / k for i in range(len(l) - k)]\n',
    tests: [[[[1,2,3,4],2],[1.5,2.5,3.5]],[[[5,5,5],3],[5]],[[[1,2],3],[]],[[[2,4,6,8,10],2],[3,5,7,9]]],
    ref: 'def moyennes_mobiles(l, k):\n    return [sum(l[i:i + k]) / k for i in range(len(l) - k + 1)]\n',
    tip: 'Il y a len(l) − k + 1 fenêtres : range(len(l) - k) oublie la dernière.',
  },
  {
    id: 'bug_vol_annuelle', level: 3, bug: true, title: 'Volatilité annualisée',
    prompt: 'Ce code devrait annualiser une volatilité quotidienne (252 jours de bourse), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'vol_annuelle', starter: 'def vol_annuelle(vol_jour):\n    return vol_jour * 252\n',
    tests: [[[0.01],0.15874507866387544],[[0.02],0.3174901573277509],[[0],0],[[0.015],0.23811761799581316]],
    ref: 'def vol_annuelle(vol_jour):\n    return vol_jour * 252 ** 0.5\n',
    tip: 'Les variances s\'additionnent d\'un jour à l\'autre : la volatilité s\'annualise avec √252 ≈ 15,9, pas 252.',
  },
  {
    id: 'bug_binaire', level: 3, bug: true, title: 'Zéro en binaire',
    prompt: 'Ce code devrait écrire un entier positif ou nul en binaire (5 → \'101\', 0 → \'0\'), mais il a un bug. Trouve-le et corrige-le.',
    fn: 'binaire', starter: 'def binaire(n):\n    s = \'\'\n    while n > 0:\n        s = str(n % 2) + s\n        n //= 2\n    return s\n',
    tests: [[[5],"101"],[[0],"0"],[[8],"1000"],[[1],"1"],[[255],"11111111"]],
    ref: 'def binaire(n):\n    if n == 0:\n        return \'0\'\n    s = \'\'\n    while n > 0:\n        s = str(n % 2) + s\n        n //= 2\n    return s\n',
    tip: 'Pour 0, la boucle ne tourne jamais et renvoie une chaîne vide : on traite 0 à part.',
  },
  {
    id: 'bug_anagramme', level: 3, bug: true, title: 'Anagrammes et majuscules',
    prompt: 'Ce code devrait dire si deux mots sont des anagrammes, sans tenir compte des majuscules, mais il a un bug. Trouve-le et corrige-le.',
    fn: 'anagrammes', starter: 'def anagrammes(a, b):\n    return sorted(a) == sorted(b)\n',
    tests: [[["chien","niche"],true],[["Chien","Niche"],true],[["abc","abd"],false],[["Marie","aimer"],true]],
    ref: 'def anagrammes(a, b):\n    return sorted(a.lower()) == sorted(b.lower())\n',
    tip: '« C » et « c » ne sont pas la même lettre pour sorted : on passe tout en minuscules avant de comparer.',
  },
];

// SQL : la requête du joueur tourne dans SQLite, sur la base d'exemple puis sur deux bases cachées ; les résultats attendus
// viennent de la requête de référence (générés une fois, revérifiés par les tests).
export const SQL_QUESTIONS = [
  {
    id: 'sql_distinct', level: 1, lang: 'sql', ordered: true, title: 'Les titres traités',
    prompt: 'Liste les tickers distincts de la table trades, par ordre alphabétique.',
    starter: '-- Liste les tickers distincts de la table trades, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "MC", 20, 118.4, "SELL"], [2, "David", "DSY", 160, 156.1, "BUY"], [3, "Emma", "BNP", 100, 73.1, "BUY"], [4, "Emma", "DSY", 180, 393.5, "BUY"], [5, "Chloé", "AIR", 30, 361.6, "SELL"], [6, "David", "OR", 40, 154.4, "SELL"], [7, "Emma", "TTE", 70, 387.3, "SELL"], [8, "David", "OR", 90, 43.7, "BUY"], [9, "Alice", "TTE", 130, 289.9, "BUY"]]}]], [["AIR"], ["BNP"], ["DSY"], ["MC"], ["OR"], ["TTE"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Emma", "AIR", 200, 272.9, "BUY"], [2, "Chloé", "MC", 170, 319.9, "SELL"], [3, "Emma", "DSY", 130, 389.8, "SELL"], [4, "David", "BNP", 20, 54.6, "BUY"], [5, "Emma", "DSY", 120, 266.3, "SELL"], [6, "Emma", "OR", 120, 262.9, "BUY"], [7, "Emma", "OR", 70, 212.0, "BUY"], [8, "Alice", "AIR", 170, 365.9, "BUY"], [9, "Emma", "BNP", 10, 143.1, "BUY"], [10, "Alice", "TTE", 10, 360.7, "BUY"], [11, "Chloé", "TTE", 80, 214.1, "SELL"], [12, "Emma", "AIR", 100, 123.6, "BUY"]]}]], [["AIR"], ["BNP"], ["DSY"], ["MC"], ["OR"], ["TTE"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Emma", "OR", 40, 141.3, "SELL"], [2, "Bruno", "BNP", 120, 65.6, "SELL"], [3, "Emma", "DSY", 150, 84.9, "SELL"], [4, "Emma", "OR", 10, 282.0, "BUY"], [5, "Bruno", "BNP", 150, 79.1, "SELL"], [6, "Bruno", "DSY", 90, 398.1, "SELL"], [7, "Alice", "OR", 70, 346.8, "BUY"], [8, "Emma", "AIR", 70, 292.0, "SELL"], [9, "Alice", "AIR", 10, 282.3, "BUY"], [10, "David", "TTE", 190, 207.8, "SELL"], [11, "Bruno", "TTE", 60, 247.5, "SELL"], [12, "David", "MC", 130, 257.0, "BUY"], [13, "Bruno", "AIR", 150, 338.4, "BUY"], [14, "David", "BNP", 70, 399.9, "BUY"], [15, "Chloé", "TTE", 180, 136.6, "SELL"]]}]], [["AIR"], ["BNP"], ["DSY"], ["MC"], ["OR"], ["TTE"]]]],
    ref: 'SELECT DISTINCT ticker FROM trades ORDER BY ticker',
    tip: 'DISTINCT retire les doublons, ORDER BY trie. Sans DISTINCT, chaque ticker sortirait autant de fois qu\'il a été traité.',
  },
  {
    id: 'sql_count', level: 1, lang: 'sql', ordered: false, title: 'Combien d\'achats ?',
    prompt: 'Combien de trades d\'achat (side = \'BUY\') ? Une seule valeur.',
    starter: '-- Combien de trades d\'achat (side = \'BUY\') ? Une seule valeur\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "TTE", 40, 169.6, "BUY"], [2, "David", "BNP", 180, 391.9, "SELL"], [3, "Bruno", "BNP", 80, 158.4, "SELL"], [4, "Bruno", "TTE", 120, 106.5, "SELL"], [5, "Bruno", "AIR", 160, 74.2, "SELL"], [6, "Bruno", "AIR", 180, 198.0, "BUY"], [7, "Emma", "BNP", 40, 115.8, "SELL"], [8, "Alice", "AIR", 110, 329.4, "SELL"], [9, "Chloé", "OR", 180, 65.3, "SELL"]]}]], [[2]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Alice", "MC", 160, 271.7, "BUY"], [2, "Alice", "DSY", 100, 240.3, "BUY"], [3, "Emma", "AIR", 170, 78.1, "SELL"], [4, "Alice", "OR", 30, 147.8, "SELL"], [5, "Alice", "DSY", 100, 386.7, "SELL"], [6, "David", "TTE", 80, 79.6, "SELL"], [7, "Chloé", "BNP", 180, 146.3, "BUY"], [8, "Bruno", "OR", 140, 175.2, "SELL"], [9, "David", "MC", 50, 56.0, "SELL"], [10, "David", "DSY", 200, 321.8, "BUY"], [11, "Emma", "BNP", 60, 247.8, "SELL"], [12, "Bruno", "MC", 120, 248.1, "SELL"]]}]], [[4]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "DSY", 60, 384.4, "BUY"], [2, "Alice", "MC", 200, 60.0, "SELL"], [3, "Bruno", "MC", 130, 265.6, "SELL"], [4, "David", "DSY", 160, 139.6, "BUY"], [5, "David", "OR", 200, 35.3, "SELL"], [6, "David", "OR", 80, 66.5, "BUY"], [7, "Emma", "MC", 200, 316.3, "SELL"], [8, "David", "AIR", 60, 139.6, "SELL"], [9, "Bruno", "AIR", 100, 73.2, "SELL"], [10, "Chloé", "AIR", 130, 294.9, "BUY"], [11, "Emma", "DSY", 160, 64.4, "BUY"], [12, "Alice", "OR", 60, 125.8, "SELL"], [13, "Chloé", "AIR", 100, 22.5, "SELL"], [14, "Alice", "TTE", 180, 370.8, "SELL"], [15, "Bruno", "OR", 150, 168.6, "SELL"]]}]], [[5]]]],
    ref: 'SELECT COUNT(*) FROM trades WHERE side = \'BUY\'',
    tip: 'WHERE filtre les lignes avant le comptage : COUNT(*) ne compte que les achats.',
  },
  {
    id: 'sql_volume', level: 2, lang: 'sql', ordered: true, title: 'Volume par trader',
    prompt: 'Volume total (qty × price) par trader, du plus grand au plus petit. Colonnes : trader, volume.',
    starter: '-- Volume total (qty × price) par trader, du plus grand au plus petit\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "AIR", 160, 380.1, "SELL"], [2, "Bruno", "OR", 50, 316.3, "SELL"], [3, "Bruno", "TTE", 50, 223.1, "SELL"], [4, "Chloé", "OR", 140, 337.0, "BUY"], [5, "Bruno", "TTE", 10, 249.6, "SELL"], [6, "Bruno", "AIR", 20, 380.3, "SELL"], [7, "Alice", "OR", 80, 221.6, "SELL"], [8, "David", "MC", 20, 148.9, "BUY"], [9, "Bruno", "MC", 150, 254.3, "BUY"]]}]], [["Bruno", 75217.0], ["David", 63794.0], ["Chloé", 47180.0], ["Alice", 17728.0]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "OR", 20, 137.4, "BUY"], [2, "Alice", "MC", 40, 360.7, "SELL"], [3, "David", "DSY", 60, 328.6, "SELL"], [4, "David", "OR", 180, 44.7, "SELL"], [5, "Bruno", "MC", 110, 166.0, "SELL"], [6, "Bruno", "BNP", 170, 47.7, "SELL"], [7, "Emma", "TTE", 130, 332.1, "BUY"], [8, "Chloé", "AIR", 110, 160.3, "SELL"], [9, "Emma", "OR", 40, 326.7, "BUY"], [10, "Bruno", "OR", 60, 389.6, "SELL"], [11, "David", "OR", 30, 128.0, "BUY"], [12, "Emma", "BNP", 40, 99.2, "BUY"]]}]], [["Emma", 60209.0], ["Bruno", 49745.0], ["David", 31602.0], ["Chloé", 20381.0], ["Alice", 14428.0]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "BNP", 170, 103.9, "SELL"], [2, "Alice", "BNP", 70, 252.4, "SELL"], [3, "Emma", "AIR", 100, 226.0, "SELL"], [4, "Alice", "OR", 180, 102.1, "BUY"], [5, "Alice", "DSY", 40, 370.7, "SELL"], [6, "Alice", "DSY", 170, 218.7, "SELL"], [7, "Emma", "BNP", 110, 93.9, "BUY"], [8, "Chloé", "DSY", 190, 215.2, "SELL"], [9, "Bruno", "TTE", 200, 50.6, "BUY"], [10, "David", "DSY", 180, 112.7, "BUY"], [11, "David", "TTE", 170, 351.7, "BUY"], [12, "David", "OR", 150, 351.9, "BUY"], [13, "David", "DSY", 160, 102.7, "SELL"], [14, "Alice", "OR", 90, 278.5, "BUY"], [15, "David", "MC", 200, 53.8, "BUY"]]}]], [["David", 160052.0], ["Alice", 113118.0], ["Chloé", 58551.0], ["Emma", 32929.0], ["Bruno", 10120.0]]]],
    ref: 'SELECT trader, SUM(qty * price) AS volume FROM trades GROUP BY trader ORDER BY volume DESC',
    tip: 'GROUP BY trader fait une ligne par trader ; SUM additionne qty × price dans chaque groupe ; ORDER BY volume DESC trie.',
  },
  {
    id: 'sql_having', level: 2, lang: 'sql', ordered: true, title: 'Les titres les plus traités',
    prompt: 'Les tickers qui ont au moins 3 trades, par ordre alphabétique.',
    starter: '-- Les tickers qui ont au moins 3 trades, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "TTE", 150, 75.4, "BUY"], [2, "Chloé", "DSY", 110, 200.8, "SELL"], [3, "Emma", "TTE", 120, 100.4, "BUY"], [4, "Emma", "TTE", 10, 319.2, "BUY"], [5, "David", "MC", 60, 119.0, "SELL"], [6, "David", "AIR", 110, 362.0, "SELL"], [7, "Bruno", "DSY", 90, 301.1, "BUY"], [8, "Chloé", "MC", 200, 58.1, "BUY"], [9, "Emma", "DSY", 140, 297.9, "BUY"]]}]], [["DSY"], ["TTE"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "AIR", 40, 96.9, "SELL"], [2, "Bruno", "BNP", 20, 20.1, "SELL"], [3, "Bruno", "DSY", 130, 96.3, "BUY"], [4, "David", "MC", 80, 279.3, "SELL"], [5, "Alice", "DSY", 130, 349.7, "SELL"], [6, "Bruno", "MC", 70, 123.7, "BUY"], [7, "David", "DSY", 110, 251.0, "BUY"], [8, "Chloé", "TTE", 10, 247.1, "BUY"], [9, "Bruno", "AIR", 50, 340.2, "BUY"], [10, "Chloé", "MC", 160, 181.8, "SELL"], [11, "Chloé", "AIR", 20, 319.2, "BUY"], [12, "Alice", "OR", 140, 95.0, "SELL"]]}]], [["AIR"], ["DSY"], ["MC"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "BNP", 30, 324.3, "SELL"], [2, "Alice", "TTE", 130, 369.5, "BUY"], [3, "Emma", "AIR", 130, 358.3, "BUY"], [4, "Chloé", "TTE", 30, 23.3, "BUY"], [5, "Emma", "DSY", 40, 139.5, "BUY"], [6, "Bruno", "BNP", 190, 374.9, "BUY"], [7, "Alice", "MC", 180, 34.2, "BUY"], [8, "Emma", "DSY", 190, 291.4, "BUY"], [9, "Alice", "MC", 90, 311.7, "SELL"], [10, "Chloé", "OR", 180, 141.2, "SELL"], [11, "Bruno", "BNP", 50, 31.8, "BUY"], [12, "Chloé", "MC", 30, 260.1, "SELL"], [13, "Chloé", "TTE", 190, 253.6, "BUY"], [14, "Alice", "DSY", 80, 34.9, "SELL"], [15, "David", "MC", 180, 321.5, "BUY"]]}]], [["BNP"], ["DSY"], ["MC"], ["TTE"]]]],
    ref: 'SELECT ticker FROM trades GROUP BY ticker HAVING COUNT(*) >= 3 ORDER BY ticker',
    tip: 'HAVING filtre après le regroupement (sur COUNT), là où WHERE filtre les lignes avant.',
  },
  {
    id: 'sql_avg', level: 2, lang: 'sql', ordered: true, title: 'Prix moyen d\'achat',
    prompt: 'Prix moyen des achats (side = \'BUY\') par ticker, arrondi à 2 décimales, par ordre alphabétique. Colonnes : ticker, prix_moyen.',
    starter: '-- Prix moyen des achats (side = \'BUY\') par ticker, arrondi à 2 décimales, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "MC", 150, 289.5, "BUY"], [2, "Emma", "TTE", 150, 139.9, "BUY"], [3, "Chloé", "DSY", 110, 33.2, "BUY"], [4, "Alice", "MC", 200, 346.5, "SELL"], [5, "Bruno", "AIR", 70, 339.7, "SELL"], [6, "David", "DSY", 180, 277.2, "SELL"], [7, "Alice", "DSY", 90, 229.4, "SELL"], [8, "Bruno", "OR", 80, 341.1, "SELL"], [9, "Emma", "DSY", 120, 125.2, "SELL"]]}]], [["DSY", 33.2], ["MC", 289.5], ["TTE", 139.9]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Emma", "MC", 150, 247.6, "BUY"], [2, "Emma", "MC", 200, 39.9, "SELL"], [3, "David", "OR", 40, 291.5, "BUY"], [4, "Emma", "DSY", 10, 99.1, "BUY"], [5, "Chloé", "DSY", 30, 177.1, "BUY"], [6, "David", "AIR", 20, 246.2, "BUY"], [7, "Emma", "DSY", 170, 271.8, "SELL"], [8, "Chloé", "DSY", 200, 280.7, "BUY"], [9, "David", "DSY", 170, 191.3, "BUY"], [10, "Chloé", "BNP", 10, 200.1, "BUY"], [11, "Bruno", "AIR", 150, 135.2, "BUY"], [12, "Emma", "BNP", 140, 320.1, "BUY"]]}]], [["AIR", 190.7], ["BNP", 260.1], ["DSY", 187.05], ["MC", 247.6], ["OR", 291.5]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Alice", "MC", 90, 300.0, "SELL"], [2, "Alice", "MC", 180, 55.5, "BUY"], [3, "Alice", "DSY", 100, 224.5, "SELL"], [4, "Alice", "AIR", 110, 292.3, "SELL"], [5, "David", "BNP", 180, 367.1, "BUY"], [6, "Bruno", "AIR", 90, 260.0, "SELL"], [7, "Bruno", "AIR", 30, 395.2, "BUY"], [8, "David", "TTE", 50, 320.4, "SELL"], [9, "Bruno", "BNP", 110, 178.6, "BUY"], [10, "Bruno", "OR", 80, 135.1, "BUY"], [11, "Alice", "OR", 130, 321.4, "SELL"], [12, "Alice", "TTE", 10, 78.8, "BUY"], [13, "David", "OR", 20, 249.8, "BUY"], [14, "David", "AIR", 70, 48.5, "BUY"], [15, "Bruno", "AIR", 160, 29.9, "SELL"]]}]], [["AIR", 221.85], ["BNP", 272.85], ["MC", 55.5], ["OR", 192.45], ["TTE", 78.8]]]],
    ref: 'SELECT ticker, ROUND(AVG(price), 2) AS prix_moyen FROM trades WHERE side = \'BUY\' GROUP BY ticker ORDER BY ticker',
    tip: 'On filtre les achats (WHERE), on regroupe par ticker, puis AVG et ROUND(…, 2).',
  },
  {
    id: 'sql_join', level: 3, lang: 'sql', ordered: true, title: 'Montant par pays',
    prompt: 'Montant total des ordres par pays du client, par ordre alphabétique des pays. Colonnes : pays, total. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Montant total des ordres par pays du client, par ordre alphabétique des pays\nSELECT ',
    tests: [[[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Béatrice", "France"], [2, "Camille", "Belgique"], [3, "Dorian", "Canada"], [4, "Élise", "Belgique"], [5, "Arnaud", "France"], [6, "Gaëlle", "France"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 4, 4900], [2, 4, 3800], [3, 1, 4000], [4, 2, 4500], [5, 3, 2300], [6, 4, 4100], [7, 2, 3300], [8, 1, 4400], [9, 1, 1600]]}]], [["Belgique", 20600], ["Canada", 2300], ["France", 10000]]], [[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Farid", "Canada"], [2, "Béatrice", "Canada"], [3, "Dorian", "Canada"], [4, "Gaëlle", "France"], [5, "Camille", "Suisse"], [6, "Élise", "France"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 3, 2400], [2, 1, 1500], [3, 2, 1600], [4, 2, 1000], [5, 4, 4300], [6, 4, 1400], [7, 4, 4500], [8, 3, 3500], [9, 2, 1300]]}]], [["Canada", 11300], ["France", 10200]]], [[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Gaëlle", "Suisse"], [2, "Dorian", "France"], [3, "Farid", "Suisse"], [4, "Arnaud", "France"], [5, "Béatrice", "France"], [6, "Élise", "Canada"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 3, 3500], [2, 4, 1800], [3, 4, 2300], [4, 2, 4900], [5, 1, 700], [6, 2, 3200], [7, 2, 4800], [8, 1, 5000], [9, 2, 1300]]}]], [["France", 18300], ["Suisse", 9200]]]],
    ref: 'SELECT c.pays, SUM(o.montant) AS total FROM ordres o JOIN clients c ON c.id = o.client_id GROUP BY c.pays ORDER BY c.pays',
    tip: 'La jointure relie chaque ordre à son client (ordres.client_id = clients.id), puis on regroupe par pays.',
  },
  {
    id: 'sql_left', level: 3, lang: 'sql', ordered: true, title: 'Clients sans ordre',
    prompt: 'Les noms des clients qui n\'ont passé aucun ordre, par ordre alphabétique. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Les noms des clients qui n\'ont passé aucun ordre, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Béatrice", "France"], [2, "Camille", "Canada"], [3, "Gaëlle", "Belgique"], [4, "Élise", "Belgique"], [5, "Dorian", "Canada"], [6, "Arnaud", "Canada"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 4, 4800], [2, 3, 2400], [3, 1, 4500], [4, 3, 300], [5, 3, 4900], [6, 4, 3800], [7, 4, 1800], [8, 1, 2200], [9, 2, 4100]]}]], [["Arnaud"], ["Dorian"]]], [[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Farid", "Suisse"], [2, "Dorian", "Belgique"], [3, "Camille", "France"], [4, "Arnaud", "Canada"], [5, "Élise", "France"], [6, "Béatrice", "Canada"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 2, 4500], [2, 4, 2900], [3, 1, 500], [4, 1, 1800], [5, 1, 2200], [6, 4, 1100], [7, 4, 1300], [8, 3, 4200], [9, 1, 2500]]}]], [["Béatrice"], ["Élise"]]], [[[{"name": "clients", "cols": ["id INTEGER", "nom TEXT", "pays TEXT"], "rows": [[1, "Farid", "Suisse"], [2, "Élise", "Belgique"], [3, "Béatrice", "Canada"], [4, "Dorian", "Suisse"], [5, "Gaëlle", "Suisse"], [6, "Arnaud", "Canada"]]}, {"name": "ordres", "cols": ["id INTEGER", "client_id INTEGER", "montant INTEGER"], "rows": [[1, 4, 1200], [2, 1, 2700], [3, 1, 800], [4, 3, 3600], [5, 4, 600], [6, 2, 2800], [7, 2, 1500], [8, 3, 3900], [9, 3, 2300]]}]], [["Arnaud"], ["Gaëlle"]]]],
    ref: 'SELECT c.nom FROM clients c LEFT JOIN ordres o ON o.client_id = c.id WHERE o.id IS NULL ORDER BY c.nom',
    tip: 'LEFT JOIN garde tous les clients, même sans ordre (les colonnes d\'ordres valent alors NULL) : on garde ceux-là.',
  },
  {
    id: 'sql_top', level: 3, lang: 'sql', ordered: true, title: 'Le plus gros trader',
    prompt: 'Le trader au plus gros volume total (qty × price). Une seule ligne, une colonne : trader.',
    starter: '-- Le trader au plus gros volume total (qty × price)\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "AIR", 110, 239.6, "SELL"], [2, "Emma", "AIR", 180, 69.7, "SELL"], [3, "David", "AIR", 30, 47.2, "SELL"], [4, "Alice", "BNP", 150, 236.5, "BUY"], [5, "Chloé", "TTE", 70, 384.9, "BUY"], [6, "Bruno", "AIR", 60, 67.6, "BUY"], [7, "Alice", "OR", 180, 103.9, "SELL"], [8, "Chloé", "BNP", 110, 327.2, "SELL"], [9, "Alice", "AIR", 130, 348.0, "BUY"]]}]], [["Alice"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Alice", "OR", 170, 353.1, "SELL"], [2, "Alice", "MC", 140, 274.6, "BUY"], [3, "Chloé", "BNP", 50, 317.0, "SELL"], [4, "Alice", "BNP", 180, 383.0, "SELL"], [5, "David", "DSY", 10, 328.7, "SELL"], [6, "Bruno", "DSY", 160, 81.8, "SELL"], [7, "Chloé", "BNP", 50, 222.7, "BUY"], [8, "Chloé", "BNP", 40, 202.1, "SELL"], [9, "Chloé", "OR", 100, 326.8, "BUY"], [10, "Emma", "MC", 120, 62.2, "SELL"], [11, "David", "BNP", 90, 199.2, "SELL"], [12, "Alice", "OR", 70, 34.2, "BUY"]]}]], [["Alice"]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "AIR", 50, 222.3, "SELL"], [2, "Emma", "MC", 170, 343.0, "SELL"], [3, "David", "AIR", 170, 378.6, "SELL"], [4, "Chloé", "AIR", 90, 326.2, "SELL"], [5, "Alice", "AIR", 170, 91.5, "SELL"], [6, "David", "BNP", 90, 77.2, "SELL"], [7, "Emma", "AIR", 170, 131.0, "SELL"], [8, "Emma", "AIR", 70, 364.7, "BUY"], [9, "David", "BNP", 140, 370.0, "BUY"], [10, "Bruno", "DSY", 20, 336.7, "BUY"], [11, "Alice", "MC", 70, 284.2, "BUY"], [12, "Chloé", "TTE", 130, 50.1, "SELL"], [13, "David", "BNP", 190, 206.4, "BUY"], [14, "Chloé", "OR", 150, 271.3, "BUY"], [15, "Chloé", "OR", 160, 350.6, "SELL"]]}]], [["David"]]]],
    ref: 'SELECT trader FROM trades GROUP BY trader ORDER BY SUM(qty * price) DESC LIMIT 1',
    tip: 'On trie les groupes par volume décroissant et on garde la première ligne avec LIMIT 1.',
  },
  {
    id: 'sql_net', level: 3, lang: 'sql', ordered: true, title: 'Position nette',
    prompt: 'Position nette par ticker : quantités achetées moins quantités vendues, par ordre alphabétique. Colonnes : ticker, net.',
    starter: '-- Position nette par ticker : quantités achetées moins quantités vendues, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Emma", "DSY", 20, 314.9, "SELL"], [2, "Alice", "DSY", 180, 392.5, "BUY"], [3, "Bruno", "BNP", 20, 374.5, "BUY"], [4, "Alice", "BNP", 170, 306.2, "SELL"], [5, "David", "TTE", 190, 362.3, "BUY"], [6, "Bruno", "DSY", 120, 231.9, "BUY"], [7, "David", "AIR", 80, 285.0, "SELL"], [8, "Emma", "AIR", 160, 266.8, "BUY"], [9, "Chloé", "TTE", 190, 379.4, "BUY"]]}]], [["AIR", 80], ["BNP", -150], ["DSY", 280], ["TTE", 380]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "David", "OR", 70, 311.0, "BUY"], [2, "Emma", "AIR", 20, 31.2, "SELL"], [3, "Emma", "OR", 120, 218.2, "BUY"], [4, "David", "DSY", 70, 85.0, "SELL"], [5, "Chloé", "TTE", 100, 58.1, "SELL"], [6, "Alice", "BNP", 50, 298.1, "BUY"], [7, "Chloé", "OR", 120, 208.9, "SELL"], [8, "Chloé", "DSY", 160, 95.4, "SELL"], [9, "David", "BNP", 30, 387.5, "SELL"], [10, "Bruno", "OR", 40, 376.3, "SELL"], [11, "Bruno", "BNP", 30, 380.4, "SELL"], [12, "David", "TTE", 180, 241.9, "BUY"]]}]], [["AIR", -20], ["BNP", -10], ["DSY", -230], ["OR", 30], ["TTE", 80]]], [[[{"name": "trades", "cols": ["id INTEGER", "trader TEXT", "ticker TEXT", "qty INTEGER", "price REAL", "side TEXT"], "rows": [[1, "Chloé", "TTE", 80, 112.1, "SELL"], [2, "Bruno", "DSY", 70, 23.3, "BUY"], [3, "Alice", "BNP", 130, 201.1, "BUY"], [4, "Bruno", "AIR", 100, 390.9, "SELL"], [5, "Alice", "AIR", 170, 174.1, "SELL"], [6, "Chloé", "AIR", 100, 185.7, "SELL"], [7, "Emma", "AIR", 80, 307.1, "SELL"], [8, "Bruno", "DSY", 190, 110.8, "BUY"], [9, "David", "MC", 80, 224.0, "BUY"], [10, "Chloé", "MC", 90, 22.0, "BUY"], [11, "Alice", "OR", 130, 90.1, "SELL"], [12, "Chloé", "TTE", 60, 122.9, "SELL"], [13, "Chloé", "DSY", 10, 145.2, "SELL"], [14, "Alice", "TTE", 190, 165.8, "BUY"], [15, "David", "AIR", 10, 215.4, "BUY"]]}]], [["AIR", -440], ["BNP", 130], ["DSY", 250], ["MC", 170], ["OR", -130], ["TTE", 50]]]],
    ref: 'SELECT ticker, SUM(CASE WHEN side = \'BUY\' THEN qty ELSE -qty END) AS net FROM trades GROUP BY ticker ORDER BY ticker',
    tip: 'CASE WHEN met un signe selon le sens : + pour un achat, − pour une vente, puis SUM par ticker.',
  },
  // lot 2 : dix-huit requêtes de plus (bases et résultats générés avec SQLite, voir la note plus haut)
  {
    id: 'sql_where', level: 1, lang: 'sql', ordered: true, title: 'Les gros ordres',
    prompt: 'Les trades de plus de 100 titres (qty > 100), par id croissant. Colonnes : id, ticker, qty.',
    starter: '-- Les trades de plus de 100 titres (qty > 100), par id croissant. Colonnes : id, ticker, qty\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","OR",130,395.2,"SELL"],[2,"Chloé","OR",90,48.6,"BUY"],[3,"David","DSY",60,27.2,"SELL"],[4,"Emma","AIR",20,89.7,"BUY"],[5,"David","TTE",50,241.9,"SELL"],[6,"Chloé","BNP",100,53.2,"BUY"],[7,"David","TTE",150,200.5,"BUY"],[8,"Bruno","MC",180,57.5,"BUY"],[9,"Bruno","BNP",130,184.8,"BUY"]]}]],[[1,"OR",130],[7,"TTE",150],[8,"MC",180],[9,"BNP",130]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","OR",140,369.6,"BUY"],[2,"Bruno","TTE",60,199.1,"BUY"],[3,"Bruno","MC",150,119.3,"SELL"],[4,"David","BNP",60,366.9,"BUY"],[5,"Alice","BNP",190,193.8,"SELL"],[6,"Alice","OR",150,141.6,"BUY"],[7,"Emma","OR",160,192.3,"SELL"],[8,"David","TTE",70,193.6,"SELL"],[9,"Emma","TTE",110,387.3,"SELL"],[10,"Chloé","DSY",120,48.1,"BUY"],[11,"Chloé","MC",150,318.8,"BUY"],[12,"Bruno","BNP",130,322.7,"SELL"]]}]],[[1,"OR",140],[3,"MC",150],[5,"BNP",190],[6,"OR",150],[7,"OR",160],[9,"TTE",110],[10,"DSY",120],[11,"MC",150],[12,"BNP",130]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","AIR",70,65.2,"BUY"],[2,"Emma","TTE",160,328,"SELL"],[3,"Bruno","MC",10,371.9,"BUY"],[4,"Chloé","OR",70,356.1,"SELL"],[5,"Emma","MC",10,249.6,"BUY"],[6,"Bruno","DSY",150,388,"BUY"],[7,"Emma","OR",10,238.5,"BUY"],[8,"David","BNP",150,155.7,"BUY"],[9,"Bruno","DSY",140,259.8,"BUY"],[10,"Emma","BNP",10,65.9,"SELL"],[11,"Bruno","OR",150,222.3,"BUY"],[12,"David","BNP",180,196.1,"BUY"],[13,"Chloé","MC",120,314,"SELL"],[14,"Alice","BNP",140,147.2,"BUY"],[15,"Alice","BNP",140,152.1,"SELL"]]}]],[[2,"TTE",160],[6,"DSY",150],[8,"BNP",150],[9,"DSY",140],[11,"OR",150],[12,"BNP",180],[13,"MC",120],[14,"BNP",140],[15,"BNP",140]]]],
    ref: 'SELECT id, ticker, qty FROM trades WHERE qty > 100 ORDER BY id',
    tip: 'WHERE garde les lignes qui vérifient la condition ; ORDER BY id les remet dans l\'ordre.',
  },
  {
    id: 'sql_sum_air', level: 1, lang: 'sql', ordered: false, title: 'Quantité sur Airbus',
    prompt: 'Quantité totale traitée sur le ticker \'AIR\'. Une seule valeur.',
    starter: '-- Quantité totale traitée sur le ticker \'AIR\'. Une seule valeur\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","AIR",80,358.1,"BUY"],[2,"Bruno","TTE",130,123.4,"BUY"],[3,"Chloé","AIR",190,96.4,"SELL"],[4,"Alice","DSY",140,65.1,"SELL"],[5,"Bruno","DSY",30,152.5,"SELL"],[6,"Chloé","BNP",90,396,"SELL"],[7,"Chloé","TTE",60,209.1,"SELL"],[8,"Emma","OR",30,245.8,"SELL"],[9,"Chloé","MC",110,327.7,"SELL"]]}]],[[270]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","BNP",30,280.8,"BUY"],[2,"Bruno","AIR",30,127,"SELL"],[3,"Chloé","MC",40,51.4,"BUY"],[4,"Chloé","DSY",110,74.3,"BUY"],[5,"Alice","MC",50,76.8,"BUY"],[6,"Chloé","MC",120,383.3,"BUY"],[7,"Alice","DSY",190,385.7,"SELL"],[8,"Alice","TTE",60,229.5,"BUY"],[9,"Chloé","BNP",120,208.4,"BUY"],[10,"David","BNP",100,34.5,"SELL"],[11,"Chloé","BNP",50,194.4,"SELL"],[12,"Chloé","OR",160,268.4,"SELL"]]}]],[[30]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","TTE",160,105.3,"BUY"],[2,"Alice","BNP",200,30.1,"BUY"],[3,"David","OR",130,244,"BUY"],[4,"Chloé","AIR",140,141.5,"SELL"],[5,"Alice","TTE",90,174.6,"BUY"],[6,"Emma","TTE",180,71.6,"BUY"],[7,"Emma","TTE",100,48.6,"SELL"],[8,"Chloé","OR",30,25.5,"BUY"],[9,"Emma","TTE",140,247.1,"BUY"],[10,"Emma","TTE",80,149.2,"SELL"],[11,"Bruno","MC",110,33.2,"BUY"],[12,"Chloé","BNP",110,59.1,"SELL"],[13,"Emma","MC",150,331.1,"BUY"],[14,"Bruno","DSY",40,290,"SELL"],[15,"Chloé","TTE",30,104.9,"BUY"]]}]],[[140]]]],
    ref: 'SELECT SUM(qty) FROM trades WHERE ticker = \'AIR\'',
    tip: 'SUM additionne la colonne, WHERE limite aux lignes du ticker AIR.',
  },
  {
    id: 'sql_max', level: 1, lang: 'sql', ordered: false, title: 'Le prix le plus haut',
    prompt: 'Le prix le plus élevé de la table trades. Une seule valeur.',
    starter: '-- Le prix le plus élevé de la table trades. Une seule valeur\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","TTE",100,140.6,"BUY"],[2,"David","MC",120,209.2,"BUY"],[3,"Emma","MC",90,28.5,"BUY"],[4,"Bruno","BNP",170,326.5,"SELL"],[5,"Emma","DSY",60,140.6,"SELL"],[6,"Chloé","DSY",130,342,"SELL"],[7,"Alice","TTE",170,53.8,"SELL"],[8,"Bruno","AIR",50,345.6,"BUY"],[9,"David","TTE",90,84.2,"BUY"]]}]],[[345.6]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","BNP",170,66.3,"SELL"],[2,"Emma","TTE",120,336.2,"SELL"],[3,"Emma","OR",140,20.1,"BUY"],[4,"Chloé","BNP",20,354.8,"BUY"],[5,"David","DSY",50,121.5,"BUY"],[6,"Alice","AIR",170,122.4,"BUY"],[7,"Alice","TTE",30,82.6,"BUY"],[8,"David","MC",190,139.3,"BUY"],[9,"David","DSY",40,212.9,"BUY"],[10,"David","TTE",30,315.9,"SELL"],[11,"David","TTE",80,352.4,"SELL"],[12,"Chloé","TTE",40,77.3,"BUY"]]}]],[[354.8]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","BNP",50,386.8,"BUY"],[2,"Chloé","BNP",200,228.3,"BUY"],[3,"Alice","BNP",50,172.4,"BUY"],[4,"Bruno","MC",120,49.5,"BUY"],[5,"Emma","BNP",40,108.9,"BUY"],[6,"Bruno","DSY",160,149.4,"SELL"],[7,"Chloé","TTE",170,332.6,"SELL"],[8,"Bruno","OR",200,212.4,"SELL"],[9,"Alice","OR",40,209.8,"BUY"],[10,"Bruno","DSY",30,28.3,"BUY"],[11,"Alice","TTE",20,264.8,"SELL"],[12,"Bruno","BNP",140,110.5,"SELL"],[13,"David","TTE",190,234.3,"SELL"],[14,"David","TTE",80,395.2,"BUY"],[15,"David","AIR",170,319.6,"BUY"]]}]],[[395.2]]]],
    ref: 'SELECT MAX(price) FROM trades',
    tip: 'MAX(price) renvoie la plus grande valeur de la colonne, sans avoir besoin de trier.',
  },
  {
    id: 'sql_distinct_count', level: 1, lang: 'sql', ordered: false, title: 'Combien de traders ?',
    prompt: 'Le nombre de traders différents dans la table trades. Une seule valeur.',
    starter: '-- Le nombre de traders différents dans la table trades. Une seule valeur\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","OR",150,390.6,"BUY"],[2,"Emma","MC",70,342.2,"SELL"],[3,"David","MC",60,280.4,"SELL"],[4,"Emma","AIR",130,365.4,"BUY"],[5,"Bruno","DSY",180,181.1,"SELL"],[6,"Chloé","AIR",50,76.7,"SELL"],[7,"Emma","TTE",80,279.8,"BUY"],[8,"Bruno","OR",10,103.7,"BUY"],[9,"Bruno","AIR",130,130.9,"SELL"]]}]],[[4]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","DSY",180,80.3,"BUY"],[2,"David","DSY",160,246.7,"BUY"],[3,"Chloé","TTE",20,196.5,"BUY"],[4,"Emma","TTE",160,213.5,"SELL"],[5,"Alice","AIR",190,233.8,"SELL"],[6,"Emma","TTE",20,324.3,"BUY"],[7,"Alice","BNP",100,284.6,"SELL"],[8,"Chloé","AIR",120,326.4,"SELL"],[9,"Emma","OR",100,230,"BUY"],[10,"Chloé","BNP",170,203.6,"BUY"],[11,"Bruno","MC",90,46.8,"BUY"],[12,"David","OR",10,276.1,"BUY"]]}]],[[5]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","BNP",190,88.4,"BUY"],[2,"David","MC",40,49.5,"BUY"],[3,"Chloé","DSY",60,96,"SELL"],[4,"Chloé","AIR",200,58.9,"SELL"],[5,"Chloé","TTE",80,364.3,"SELL"],[6,"David","BNP",90,348.9,"BUY"],[7,"Bruno","MC",190,38,"SELL"],[8,"Alice","DSY",190,139.3,"SELL"],[9,"Bruno","BNP",150,376,"SELL"],[10,"David","TTE",20,315,"SELL"],[11,"David","OR",140,101.9,"BUY"],[12,"David","DSY",170,90.4,"SELL"],[13,"Emma","BNP",60,309.8,"SELL"],[14,"Bruno","BNP",180,101.6,"SELL"],[15,"Alice","MC",190,368.7,"SELL"]]}]],[[5]]]],
    ref: 'SELECT COUNT(DISTINCT trader) FROM trades',
    tip: 'COUNT(DISTINCT trader) compte chaque nom une seule fois ; COUNT(trader) compterait les lignes.',
  },
  {
    id: 'sql_top3', level: 1, lang: 'sql', ordered: true, title: 'Les trois plus chers',
    prompt: 'Les 3 trades au prix le plus élevé, du plus cher au moins cher. Colonnes : id, price.',
    starter: '-- Les 3 trades au prix le plus élevé, du plus cher au moins cher. Colonnes : id, price\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","DSY",120,246.9,"BUY"],[2,"Alice","DSY",60,328.8,"BUY"],[3,"Alice","MC",150,76.1,"BUY"],[4,"Alice","BNP",60,106,"BUY"],[5,"Bruno","BNP",80,166.3,"SELL"],[6,"Emma","TTE",90,341.8,"BUY"],[7,"Emma","AIR",110,281.5,"SELL"],[8,"Alice","AIR",100,377.1,"BUY"],[9,"Alice","OR",10,150.9,"BUY"]]}]],[[8,377.1],[6,341.8],[2,328.8]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","MC",200,107.8,"SELL"],[2,"Alice","OR",80,359.1,"SELL"],[3,"David","BNP",190,146,"BUY"],[4,"Chloé","BNP",190,343.8,"BUY"],[5,"Emma","TTE",180,282.1,"SELL"],[6,"Chloé","AIR",200,353.3,"BUY"],[7,"Alice","AIR",50,32,"SELL"],[8,"Bruno","BNP",150,147.6,"SELL"],[9,"Bruno","TTE",150,76.4,"BUY"],[10,"Chloé","AIR",190,318.2,"BUY"],[11,"Emma","BNP",180,235.3,"BUY"],[12,"David","AIR",150,105.4,"SELL"]]}]],[[2,359.1],[6,353.3],[4,343.8]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","TTE",10,124.5,"BUY"],[2,"Chloé","TTE",140,359.4,"SELL"],[3,"Chloé","TTE",50,267.2,"BUY"],[4,"David","DSY",140,383.7,"SELL"],[5,"Emma","MC",130,396.2,"SELL"],[6,"Alice","DSY",190,26.3,"SELL"],[7,"Alice","AIR",130,335.3,"BUY"],[8,"Emma","MC",200,87.2,"SELL"],[9,"Emma","DSY",70,334.5,"SELL"],[10,"David","TTE",200,173.4,"BUY"],[11,"Bruno","DSY",110,326,"SELL"],[12,"Chloé","OR",160,150.5,"BUY"],[13,"Emma","AIR",50,266.5,"SELL"],[14,"Alice","BNP",170,349.8,"SELL"],[15,"Bruno","AIR",190,56.5,"BUY"]]}]],[[5,396.2],[4,383.7],[2,359.4]]]],
    ref: 'SELECT id, price FROM trades ORDER BY price DESC LIMIT 3',
    tip: 'ORDER BY price DESC trie du plus cher au moins cher, LIMIT 3 garde les trois premiers.',
  },
  {
    id: 'sql_like', level: 1, lang: 'sql', ordered: true, title: 'Les clients en A',
    prompt: 'Les noms des clients qui commencent par la lettre A, par ordre alphabétique. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Les noms des clients qui commencent par la lettre A, par ordre alphabétique\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Denis","Allemagne"],[2,"Inès","Espagne"],[3,"Camille","Allemagne"],[4,"Béatrice","Italie"],[5,"Élodie","Allemagne"],[6,"Antoine","France"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,6,5000],[2,4,4200],[3,4,100],[4,6,5600],[5,4,4300],[6,1,4600],[7,4,1600],[8,3,700],[9,2,1900]]}]],[["Antoine"]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Hugo","Allemagne"],[2,"Camille","Italie"],[3,"Inès","Italie"],[4,"Agnès","Allemagne"],[5,"Farid","Espagne"],[6,"Denis","Allemagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,1,1300],[2,4,800],[3,5,3300],[4,2,2300],[5,4,300],[6,2,1900],[7,4,3800],[8,4,4900],[9,6,5900],[10,6,2300],[11,2,3700],[12,2,4700]]}]],[["Agnès"]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Antoine","Espagne"],[2,"Denis","Allemagne"],[3,"Agnès","Allemagne"],[4,"Farid","France"],[5,"Béatrice","France"],[6,"Élodie","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,4400],[2,6,4700],[3,5,2700],[4,2,6000],[5,2,2700],[6,6,2300],[7,1,1700],[8,4,5500],[9,5,5900],[10,6,4800],[11,6,1800],[12,1,2000],[13,4,600],[14,1,3600],[15,5,1000]]}]],[["Agnès"],["Antoine"]]]],
    ref: 'SELECT nom FROM clients WHERE nom LIKE \'A%\' ORDER BY nom',
    tip: 'LIKE \'A%\' : un A puis n\'importe quoi. Le % remplace un nombre quelconque de caractères.',
  },
  {
    id: 'sql_by_side', level: 2, lang: 'sql', ordered: true, title: 'Achats et ventes',
    prompt: 'Le nombre de trades par sens (side), par ordre alphabétique du sens. Colonnes : side, n.',
    starter: '-- Le nombre de trades par sens (side), par ordre alphabétique du sens. Colonnes : side, n\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","OR",20,394,"BUY"],[2,"Bruno","MC",120,160.6,"SELL"],[3,"Emma","OR",130,247.6,"BUY"],[4,"Chloé","TTE",50,29,"BUY"],[5,"Bruno","MC",100,225.9,"BUY"],[6,"Chloé","DSY",130,147.5,"SELL"],[7,"David","MC",150,165,"SELL"],[8,"Alice","AIR",30,261.7,"BUY"],[9,"Emma","AIR",140,290,"BUY"]]}]],[["BUY",6],["SELL",3]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Alice","TTE",160,156.8,"SELL"],[2,"Emma","DSY",100,188.7,"BUY"],[3,"Alice","AIR",40,185.5,"BUY"],[4,"Bruno","MC",10,371.2,"SELL"],[5,"David","BNP",50,346.3,"BUY"],[6,"Chloé","BNP",120,98.1,"SELL"],[7,"David","DSY",150,52,"SELL"],[8,"Bruno","OR",120,110,"BUY"],[9,"Chloé","BNP",170,126.1,"BUY"],[10,"Alice","OR",20,56.6,"BUY"],[11,"David","MC",50,96.3,"SELL"],[12,"Bruno","TTE",90,124.9,"SELL"]]}]],[["BUY",6],["SELL",6]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","OR",30,214.8,"BUY"],[2,"Emma","TTE",150,398.7,"BUY"],[3,"David","AIR",170,100.7,"SELL"],[4,"Emma","MC",10,342.2,"SELL"],[5,"Alice","MC",170,313.9,"BUY"],[6,"Alice","OR",140,330.2,"BUY"],[7,"Emma","MC",40,162.3,"SELL"],[8,"David","TTE",60,155.1,"BUY"],[9,"Emma","MC",140,334.8,"BUY"],[10,"David","MC",130,20.4,"BUY"],[11,"David","OR",90,325.6,"SELL"],[12,"David","BNP",60,60.4,"SELL"],[13,"Emma","BNP",90,210.8,"BUY"],[14,"David","BNP",200,144.1,"BUY"],[15,"David","DSY",130,336.3,"BUY"]]}]],[["BUY",10],["SELL",5]]]],
    ref: 'SELECT side, COUNT(*) AS n FROM trades GROUP BY side ORDER BY side',
    tip: 'GROUP BY side fait un groupe par sens ; COUNT(*) compte les lignes de chaque groupe.',
  },
  {
    id: 'sql_avg_qty', level: 2, lang: 'sql', ordered: true, title: 'Taille moyenne par trader',
    prompt: 'La quantité moyenne par trader, arrondie à 1 décimale, par ordre alphabétique. Colonnes : trader, qty_moyenne.',
    starter: '-- La quantité moyenne par trader, arrondie à 1 décimale, par ordre alphabétique. Colonnes : trader, qty_moyenne\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","MC",20,82.2,"BUY"],[2,"Emma","BNP",150,107.8,"BUY"],[3,"Chloé","TTE",160,326.8,"BUY"],[4,"Emma","OR",170,74.5,"BUY"],[5,"David","DSY",160,272.4,"SELL"],[6,"Emma","MC",120,373.9,"BUY"],[7,"Bruno","BNP",170,292.6,"BUY"],[8,"Chloé","OR",80,176.5,"BUY"],[9,"Chloé","OR",120,147,"BUY"]]}]],[["Bruno",170],["Chloé",95],["David",160],["Emma",146.7]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","MC",50,84.5,"BUY"],[2,"Emma","DSY",100,135.9,"BUY"],[3,"Bruno","BNP",80,329.8,"BUY"],[4,"Emma","BNP",10,240.1,"SELL"],[5,"Bruno","MC",140,115.2,"SELL"],[6,"Bruno","TTE",190,305.3,"BUY"],[7,"David","AIR",140,116.4,"BUY"],[8,"Chloé","AIR",130,116.2,"SELL"],[9,"Chloé","MC",200,327.4,"SELL"],[10,"Chloé","OR",100,279.4,"SELL"],[11,"Bruno","TTE",80,51.1,"SELL"],[12,"Bruno","DSY",140,349.7,"BUY"]]}]],[["Bruno",126],["Chloé",143.3],["David",140],["Emma",53.3]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","TTE",180,127.9,"SELL"],[2,"David","BNP",80,230.6,"SELL"],[3,"Chloé","BNP",150,363.5,"BUY"],[4,"Alice","MC",70,285.5,"SELL"],[5,"Emma","OR",90,369.1,"BUY"],[6,"Emma","OR",200,118.3,"BUY"],[7,"David","BNP",90,343.2,"BUY"],[8,"Alice","OR",200,328.5,"BUY"],[9,"Emma","DSY",120,360.2,"SELL"],[10,"David","AIR",140,208,"BUY"],[11,"Chloé","MC",100,227.5,"BUY"],[12,"Alice","BNP",80,38.7,"SELL"],[13,"Chloé","OR",140,136.5,"SELL"],[14,"Emma","MC",190,120.8,"BUY"],[15,"David","BNP",60,40.7,"BUY"]]}]],[["Alice",116.7],["Chloé",142.5],["David",92.5],["Emma",150]]]],
    ref: 'SELECT trader, ROUND(AVG(qty), 1) AS qty_moyenne FROM trades GROUP BY trader ORDER BY trader',
    tip: 'AVG dans chaque groupe GROUP BY trader, puis ROUND(…, 1).',
  },
  {
    id: 'sql_minmax', level: 2, lang: 'sql', ordered: true, title: 'Plus bas, plus haut',
    prompt: 'Pour chaque ticker, le prix le plus bas et le plus haut, par ordre alphabétique. Colonnes : ticker, mini, maxi.',
    starter: '-- Pour chaque ticker, le prix le plus bas et le plus haut, par ordre alphabétique. Colonnes : ticker, mini, maxi\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","OR",60,253.8,"SELL"],[2,"David","OR",140,191.8,"BUY"],[3,"Alice","AIR",100,295.2,"SELL"],[4,"Alice","MC",110,270.8,"BUY"],[5,"Emma","MC",190,195.1,"BUY"],[6,"Alice","MC",200,341.4,"BUY"],[7,"David","TTE",10,291.6,"SELL"],[8,"Chloé","OR",70,362,"SELL"],[9,"David","DSY",200,311.3,"BUY"]]}]],[["AIR",295.2,295.2],["DSY",311.3,311.3],["MC",195.1,341.4],["OR",191.8,362],["TTE",291.6,291.6]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","OR",30,33.9,"BUY"],[2,"Alice","BNP",100,344.6,"BUY"],[3,"David","OR",140,137.2,"SELL"],[4,"Alice","MC",200,205.6,"BUY"],[5,"Chloé","DSY",130,368.2,"SELL"],[6,"Chloé","AIR",120,217.5,"BUY"],[7,"Emma","TTE",30,90.2,"SELL"],[8,"Chloé","MC",60,191.2,"BUY"],[9,"Emma","DSY",160,304.4,"SELL"],[10,"David","AIR",120,97.6,"SELL"],[11,"Chloé","DSY",160,383.2,"BUY"],[12,"Alice","TTE",170,178.3,"BUY"]]}]],[["AIR",97.6,217.5],["BNP",344.6,344.6],["DSY",304.4,383.2],["MC",191.2,205.6],["OR",33.9,137.2],["TTE",90.2,178.3]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","AIR",150,281.3,"SELL"],[2,"Alice","BNP",200,195.4,"BUY"],[3,"Alice","TTE",120,103.6,"SELL"],[4,"Emma","OR",50,182.3,"BUY"],[5,"Emma","OR",200,167.6,"SELL"],[6,"Alice","TTE",30,169.6,"SELL"],[7,"Chloé","MC",60,168.5,"BUY"],[8,"Bruno","MC",10,317.2,"BUY"],[9,"Bruno","AIR",120,149,"SELL"],[10,"Bruno","TTE",10,254.5,"SELL"],[11,"Bruno","DSY",140,215.4,"SELL"],[12,"Alice","OR",70,386.6,"SELL"],[13,"Bruno","MC",60,150.8,"BUY"],[14,"Alice","BNP",10,135.5,"BUY"],[15,"Alice","AIR",90,278.8,"BUY"]]}]],[["AIR",149,281.3],["BNP",135.5,195.4],["DSY",215.4,215.4],["MC",150.8,317.2],["OR",167.6,386.6],["TTE",103.6,254.5]]]],
    ref: 'SELECT ticker, MIN(price) AS mini, MAX(price) AS maxi FROM trades GROUP BY ticker ORDER BY ticker',
    tip: 'Plusieurs agrégats peuvent cohabiter dans le même SELECT : MIN et MAX pour chaque groupe.',
  },
  {
    id: 'sql_side_volume', level: 2, lang: 'sql', ordered: true, title: 'Volume par sens',
    prompt: 'Le volume total (qty × price) des achats et des ventes, par ordre alphabétique du sens. Colonnes : side, volume.',
    starter: '-- Le volume total (qty × price) des achats et des ventes, par ordre alphabétique du sens. Colonnes : side, volume\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","BNP",20,253.7,"SELL"],[2,"Chloé","MC",80,248.5,"BUY"],[3,"Chloé","TTE",170,385,"SELL"],[4,"Chloé","OR",200,50.1,"SELL"],[5,"Emma","TTE",150,398.8,"SELL"],[6,"David","OR",190,241.9,"SELL"],[7,"Emma","AIR",190,326.4,"BUY"],[8,"David","DSY",70,135.2,"SELL"],[9,"Bruno","AIR",110,333,"SELL"]]}]],[["BUY",81896],["SELL",232419]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Bruno","BNP",190,145.3,"BUY"],[2,"Bruno","BNP",140,381.2,"SELL"],[3,"Emma","AIR",50,353.7,"SELL"],[4,"Alice","BNP",140,315.6,"BUY"],[5,"Emma","MC",190,78.5,"SELL"],[6,"Chloé","OR",60,118.4,"BUY"],[7,"Emma","AIR",40,138,"SELL"],[8,"Alice","DSY",90,295.4,"BUY"],[9,"Bruno","MC",110,60.7,"BUY"],[10,"Bruno","AIR",30,133.1,"BUY"],[11,"David","AIR",140,33.2,"BUY"],[12,"Alice","MC",160,350.5,"BUY"]]}]],[["BUY",176879],["SELL",91488]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","DSY",100,333,"BUY"],[2,"Emma","OR",170,140.9,"BUY"],[3,"Emma","BNP",160,48,"SELL"],[4,"Emma","MC",80,349.5,"SELL"],[5,"Emma","MC",60,152.4,"BUY"],[6,"Alice","DSY",130,126.8,"BUY"],[7,"David","BNP",20,321.8,"BUY"],[8,"Alice","OR",40,378.3,"SELL"],[9,"David","DSY",160,258.1,"SELL"],[10,"Emma","BNP",40,57.2,"SELL"],[11,"Bruno","OR",200,181.2,"SELL"],[12,"Bruno","TTE",90,160,"SELL"],[13,"Alice","DSY",90,216.4,"BUY"],[14,"Chloé","BNP",20,103,"SELL"],[15,"David","TTE",20,338.8,"BUY"]]}]],[["BUY",115569],["SELL",147056]]]],
    ref: 'SELECT side, ROUND(SUM(qty * price), 2) AS volume FROM trades GROUP BY side ORDER BY side',
    tip: 'SUM(qty * price) par groupe de sens ; ROUND évite les décimales flottantes parasites.',
  },
  {
    id: 'sql_tickers_per_trader', level: 2, lang: 'sql', ordered: true, title: 'Les traders les plus diversifiés',
    prompt: 'Le nombre de tickers différents traités par chaque trader, du plus grand au plus petit, puis par nom. Colonnes : trader, n.',
    starter: '-- Le nombre de tickers différents traités par chaque trader, du plus grand au plus petit, puis par nom. Colonnes : trader, n\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","DSY",160,335.1,"SELL"],[2,"Emma","AIR",180,173.5,"SELL"],[3,"Chloé","DSY",80,246.7,"BUY"],[4,"Emma","AIR",150,66.1,"SELL"],[5,"Emma","OR",120,243.9,"BUY"],[6,"Alice","OR",150,363.1,"BUY"],[7,"David","OR",120,279.3,"SELL"],[8,"Emma","MC",190,116.7,"SELL"],[9,"Alice","DSY",10,313.1,"BUY"]]}]],[["Emma",4],["Alice",2],["Chloé",1],["David",1]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Alice","DSY",200,367.7,"SELL"],[2,"Chloé","TTE",170,312.4,"BUY"],[3,"Chloé","BNP",90,286.4,"BUY"],[4,"Bruno","OR",70,284.7,"BUY"],[5,"David","AIR",120,272.3,"SELL"],[6,"David","DSY",30,210.1,"BUY"],[7,"David","TTE",190,44,"BUY"],[8,"David","TTE",170,306,"BUY"],[9,"Bruno","OR",80,127.1,"SELL"],[10,"Chloé","TTE",140,251.7,"BUY"],[11,"Alice","BNP",120,54.4,"BUY"],[12,"David","AIR",180,351.3,"SELL"]]}]],[["David",3],["Alice",2],["Chloé",2],["Bruno",1]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Chloé","DSY",40,338,"SELL"],[2,"David","DSY",30,26.4,"SELL"],[3,"Alice","DSY",140,335.2,"BUY"],[4,"David","DSY",40,273.3,"BUY"],[5,"Emma","TTE",200,128,"SELL"],[6,"David","BNP",130,102.2,"SELL"],[7,"Chloé","DSY",30,381.7,"BUY"],[8,"Chloé","AIR",130,372.3,"SELL"],[9,"Alice","BNP",40,328.6,"BUY"],[10,"Emma","AIR",140,310.1,"SELL"],[11,"Emma","DSY",80,106.9,"BUY"],[12,"Alice","AIR",200,239.6,"BUY"],[13,"Chloé","MC",200,311.8,"SELL"],[14,"Emma","OR",90,148.4,"SELL"],[15,"David","MC",120,109.6,"SELL"]]}]],[["Emma",4],["Alice",3],["Chloé",3],["David",3]]]],
    ref: 'SELECT trader, COUNT(DISTINCT ticker) AS n FROM trades GROUP BY trader ORDER BY n DESC, trader',
    tip: 'COUNT(DISTINCT ticker) dans chaque groupe ; le second critère de tri départage les égalités.',
  },
  {
    id: 'sql_country_count', level: 2, lang: 'sql', ordered: true, title: 'Clients par pays',
    prompt: 'Le nombre de clients par pays, du plus grand au plus petit, puis par pays. Colonnes : pays, n. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Le nombre de clients par pays, du plus grand au plus petit, puis par pays. Colonnes : pays, n\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Antoine","Italie"],[2,"Inès","Espagne"],[3,"Hugo","France"],[4,"Camille","France"],[5,"Élodie","France"],[6,"Alice","France"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,4300],[2,6,2600],[3,3,4200],[4,4,5300],[5,1,1300],[6,2,5900],[7,1,4400],[8,3,1000],[9,4,3600]]}]],[["France",4],["Espagne",1],["Italie",1]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Denis","Allemagne"],[2,"Inès","Italie"],[3,"Hugo","Espagne"],[4,"Élodie","Espagne"],[5,"Agnès","Italie"],[6,"Camille","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,6,800],[2,6,3000],[3,3,4300],[4,5,5300],[5,6,2000],[6,3,5700],[7,6,1000],[8,3,5200],[9,1,5800],[10,2,3400],[11,1,3300],[12,1,100]]}]],[["Espagne",3],["Italie",2],["Allemagne",1]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Antoine","France"],[2,"Denis","Allemagne"],[3,"Alice","Espagne"],[4,"Inès","Allemagne"],[5,"Farid","France"],[6,"Hugo","Allemagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,1,5600],[2,5,1800],[3,3,1800],[4,6,900],[5,2,5800],[6,2,5400],[7,2,800],[8,6,2200],[9,5,4400],[10,6,5400],[11,5,300],[12,2,1600],[13,3,4700],[14,5,4600],[15,1,5600]]}]],[["Allemagne",3],["France",2],["Espagne",1]]]],
    ref: 'SELECT pays, COUNT(*) AS n FROM clients GROUP BY pays ORDER BY n DESC, pays',
    tip: 'Un GROUP BY sur la table clients seule suffit ; on trie sur le compte, puis sur le pays.',
  },
  {
    id: 'sql_orders_per_client', level: 3, lang: 'sql', ordered: true, title: 'Ordres par client',
    prompt: 'Le nombre d\'ordres de chaque client, clients sans ordre compris (0), par ordre alphabétique des noms. Colonnes : nom, n. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Le nombre d\'ordres de chaque client, clients sans ordre compris (0), par ordre alphabétique des noms. Colonnes : nom, n\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Béatrice","Italie"],[2,"Antoine","Allemagne"],[3,"Camille","Espagne"],[4,"Farid","Italie"],[5,"Élodie","Italie"],[6,"Hugo","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,2,800],[2,6,2500],[3,2,200],[4,6,3200],[5,4,1200],[6,6,3300],[7,3,4500],[8,2,1400],[9,6,300]]}]],[["Antoine",3],["Béatrice",0],["Camille",1],["Farid",1],["Hugo",4],["Élodie",0]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Camille","France"],[2,"Élodie","France"],[3,"Béatrice","France"],[4,"Hugo","Italie"],[5,"Inès","France"],[6,"Antoine","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,6,3200],[2,1,3500],[3,3,2800],[4,4,3400],[5,4,5900],[6,4,6000],[7,5,3400],[8,1,4500],[9,1,3300],[10,5,5400],[11,5,800],[12,5,5900]]}]],[["Antoine",1],["Béatrice",1],["Camille",3],["Hugo",3],["Inès",4],["Élodie",0]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Inès","Allemagne"],[2,"Farid","Espagne"],[3,"Agnès","Italie"],[4,"Denis","France"],[5,"Hugo","France"],[6,"Antoine","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,2200],[2,3,400],[3,6,300],[4,4,4700],[5,4,5000],[6,4,1800],[7,2,2200],[8,2,5900],[9,3,5200],[10,4,4000],[11,3,800],[12,4,600],[13,2,3600],[14,3,5000],[15,3,2600]]}]],[["Agnès",5],["Antoine",1],["Denis",6],["Farid",3],["Hugo",0],["Inès",0]]]],
    ref: 'SELECT c.nom, COUNT(o.id) AS n FROM clients c LEFT JOIN ordres o ON o.client_id = c.id GROUP BY c.id ORDER BY c.nom',
    tip: 'LEFT JOIN garde les clients sans ordre ; COUNT(o.id) ne compte pas les NULL, d\'où 0 (COUNT(*) donnerait 1).',
  },
  {
    id: 'sql_best_client', level: 3, lang: 'sql', ordered: true, title: 'Le meilleur client',
    prompt: 'Le client au plus gros montant total d\'ordres. Une seule ligne. Colonnes : nom, total. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- Le client au plus gros montant total d\'ordres. Une seule ligne. Colonnes : nom, total\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Agnès","France"],[2,"Béatrice","Allemagne"],[3,"Denis","Italie"],[4,"Antoine","France"],[5,"Farid","Espagne"],[6,"Inès","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,3000],[2,3,5200],[3,6,3100],[4,4,3500],[5,3,2100],[6,1,5400],[7,6,5700],[8,1,1100],[9,4,5900]]}]],[["Antoine",12400]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Farid","Allemagne"],[2,"Élodie","France"],[3,"Alice","Espagne"],[4,"Hugo","France"],[5,"Camille","France"],[6,"Agnès","France"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,1,3000],[2,1,5400],[3,3,2200],[4,6,200],[5,6,3900],[6,1,4700],[7,5,3400],[8,4,2700],[9,5,3000],[10,2,6000],[11,5,5900],[12,4,5400]]}]],[["Farid",13100]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Alice","Italie"],[2,"Denis","Italie"],[3,"Inès","Espagne"],[4,"Béatrice","Italie"],[5,"Camille","France"],[6,"Hugo","Italie"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,3300],[2,1,1600],[3,1,200],[4,5,4100],[5,1,1600],[6,1,5200],[7,1,1400],[8,1,2500],[9,2,4900],[10,2,1300],[11,2,5400],[12,3,2900],[13,5,4400],[14,2,3700],[15,4,1500]]}]],[["Denis",15300]]]],
    ref: 'SELECT c.nom, SUM(o.montant) AS total FROM ordres o JOIN clients c ON c.id = o.client_id GROUP BY c.id ORDER BY total DESC LIMIT 1',
    tip: 'JOIN pour avoir le nom, GROUP BY par client, tri décroissant sur la somme, LIMIT 1.',
  },
  {
    id: 'sql_above_avg', level: 3, lang: 'sql', ordered: true, title: 'Au-dessus de la moyenne',
    prompt: 'Les trades dont le prix dépasse le prix moyen de toute la table, par id croissant. Colonnes : id, price.',
    starter: '-- Les trades dont le prix dépasse le prix moyen de toute la table, par id croissant. Colonnes : id, price\nSELECT ',
    tests: [[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","AIR",120,31.4,"SELL"],[2,"David","BNP",140,153,"BUY"],[3,"Bruno","DSY",110,395.4,"SELL"],[4,"David","MC",170,279.3,"BUY"],[5,"Alice","BNP",150,163.6,"SELL"],[6,"Alice","OR",110,195.1,"SELL"],[7,"Alice","AIR",30,175.3,"BUY"],[8,"David","MC",10,348.6,"SELL"],[9,"David","OR",150,163.7,"BUY"]]}]],[[3,395.4],[4,279.3],[8,348.6]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"David","MC",140,267.7,"SELL"],[2,"Chloé","TTE",160,331.3,"BUY"],[3,"Emma","AIR",70,83.7,"BUY"],[4,"Alice","BNP",200,219.1,"SELL"],[5,"Bruno","TTE",150,245.9,"BUY"],[6,"Chloé","MC",120,329,"BUY"],[7,"Chloé","AIR",20,131.8,"BUY"],[8,"Alice","OR",90,299.7,"BUY"],[9,"Alice","MC",70,49.9,"BUY"],[10,"Emma","OR",40,147.5,"BUY"],[11,"Bruno","OR",130,334,"SELL"],[12,"Emma","DSY",10,263.3,"BUY"]]}]],[[1,267.7],[2,331.3],[5,245.9],[6,329],[8,299.7],[11,334],[12,263.3]]],[[[{"name":"trades","cols":["id INTEGER","trader TEXT","ticker TEXT","qty INTEGER","price REAL","side TEXT"],"rows":[[1,"Emma","AIR",170,243.8,"SELL"],[2,"Emma","DSY",160,129.6,"BUY"],[3,"Chloé","OR",100,145.1,"SELL"],[4,"Chloé","OR",150,194.1,"SELL"],[5,"Chloé","AIR",200,83.7,"BUY"],[6,"Alice","BNP",80,209.3,"SELL"],[7,"Bruno","DSY",40,78.5,"SELL"],[8,"Alice","DSY",30,64.8,"SELL"],[9,"David","MC",200,52.5,"BUY"],[10,"Alice","DSY",110,163,"BUY"],[11,"David","AIR",200,43.3,"BUY"],[12,"Chloé","DSY",190,222.5,"SELL"],[13,"Alice","BNP",160,239.5,"BUY"],[14,"Chloé","MC",190,153.3,"SELL"],[15,"Bruno","OR",180,357.5,"BUY"]]}]],[[1,243.8],[4,194.1],[6,209.3],[10,163],[12,222.5],[13,239.5],[15,357.5]]]],
    ref: 'SELECT id, price FROM trades WHERE price > (SELECT AVG(price) FROM trades) ORDER BY id',
    tip: 'Une sous-requête calcule la moyenne une fois ; WHERE price > (SELECT AVG…) compare chaque ligne à elle.',
  },
  {
    id: 'sql_share', level: 3, lang: 'sql', ordered: true, title: 'La part de chaque pays',
    prompt: 'La part de chaque pays dans le montant total des ordres, en %, arrondie à 1 décimale, par ordre alphabétique. Colonnes : pays, part. Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).',
    starter: '-- La part de chaque pays dans le montant total des ordres, en %, arrondie à 1 décimale, par ordre alphabétique. Colonnes : pays, part\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Hugo","Italie"],[2,"Antoine","Allemagne"],[3,"Alice","Italie"],[4,"Agnès","Italie"],[5,"Farid","Espagne"],[6,"Camille","Italie"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,5,2000],[2,2,3100],[3,2,1700],[4,5,2600],[5,4,1600],[6,6,3300],[7,2,5300],[8,5,1500],[9,2,900]]}]],[["Allemagne",50],["Espagne",27.7],["Italie",22.3]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Farid","Espagne"],[2,"Camille","France"],[3,"Hugo","France"],[4,"Béatrice","Espagne"],[5,"Denis","Italie"],[6,"Agnès","France"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,2,1200],[2,5,2900],[3,6,4700],[4,1,3300],[5,2,1900],[6,6,700],[7,1,1100],[8,6,5700],[9,6,4400],[10,3,1100],[11,2,2300],[12,3,1300]]}]],[["Espagne",14.4],["France",76.1],["Italie",9.5]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Béatrice","France"],[2,"Inès","Italie"],[3,"Alice","France"],[4,"Camille","Allemagne"],[5,"Antoine","Espagne"],[6,"Denis","Italie"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,3,4100],[2,4,1400],[3,3,2100],[4,3,1800],[5,6,5500],[6,2,3800],[7,1,5700],[8,6,1700],[9,1,2800],[10,1,5100],[11,5,3100],[12,3,4800],[13,3,2600],[14,2,5000],[15,6,5400]]}]],[["Allemagne",2.6],["Espagne",5.6],["France",52.8],["Italie",39]]]],
    ref: 'SELECT c.pays, ROUND(100.0 * SUM(o.montant) / (SELECT SUM(montant) FROM ordres), 1) AS part FROM ordres o JOIN clients c ON c.id = o.client_id GROUP BY c.pays ORDER BY c.pays',
    tip: 'Le total général vient d\'une sous-requête. Attention à 100.0 : avec 100, SQLite ferait une division entière.',
  },
  {
    id: 'sql_running', level: 3, lang: 'sql', ordered: true, title: 'Cumul des ordres',
    prompt: 'Le montant cumulé des ordres, par id croissant. Colonnes : id, cumul. La table : ordres(id, client_id, montant).',
    starter: '-- Le montant cumulé des ordres, par id croissant. Colonnes : id, cumul\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Denis","Allemagne"],[2,"Farid","France"],[3,"Inès","Allemagne"],[4,"Antoine","France"],[5,"Agnès","Espagne"],[6,"Hugo","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,1,1800],[2,1,900],[3,3,5800],[4,6,1600],[5,2,5100],[6,5,2200],[7,3,900],[8,1,1800],[9,2,600]]}]],[[1,1800],[2,2700],[3,8500],[4,10100],[5,15200],[6,17400],[7,18300],[8,20100],[9,20700]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Béatrice","France"],[2,"Élodie","Allemagne"],[3,"Camille","Italie"],[4,"Antoine","Italie"],[5,"Hugo","Allemagne"],[6,"Inès","Italie"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,3,4300],[2,4,1100],[3,2,1600],[4,3,3300],[5,1,2000],[6,5,1100],[7,3,200],[8,2,6000],[9,1,5700],[10,1,4000],[11,1,5300],[12,2,900]]}]],[[1,4300],[2,5400],[3,7000],[4,10300],[5,12300],[6,13400],[7,13600],[8,19600],[9,25300],[10,29300],[11,34600],[12,35500]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Farid","Italie"],[2,"Hugo","Espagne"],[3,"Alice","Espagne"],[4,"Denis","Allemagne"],[5,"Agnès","Italie"],[6,"Inès","Espagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,2,5300],[2,5,3600],[3,3,2600],[4,3,3300],[5,2,5700],[6,3,5700],[7,1,4800],[8,3,5000],[9,6,3700],[10,3,1000],[11,5,5300],[12,6,1800],[13,1,800],[14,5,3900],[15,5,3300]]}]],[[1,5300],[2,8900],[3,11500],[4,14800],[5,20500],[6,26200],[7,31000],[8,36000],[9,39700],[10,40700],[11,46000],[12,47800],[13,48600],[14,52500],[15,55800]]]],
    ref: 'SELECT id, SUM(montant) OVER (ORDER BY id) AS cumul FROM ordres ORDER BY id',
    tip: 'Une fonction de fenêtre : SUM(montant) OVER (ORDER BY id) additionne toutes les lignes jusqu\'à la ligne courante.',
  },
  {
    id: 'sql_second', level: 3, lang: 'sql', ordered: false, title: 'Le deuxième plus gros ordre',
    prompt: 'Le montant du deuxième plus gros ordre (les montants sont tous différents). Une seule valeur. La table : ordres(id, client_id, montant).',
    starter: '-- Le montant du deuxième plus gros ordre (les montants sont tous différents). Une seule valeur\nSELECT ',
    tests: [[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Farid","Allemagne"],[2,"Alice","France"],[3,"Hugo","Espagne"],[4,"Denis","Espagne"],[5,"Inès","Allemagne"],[6,"Élodie","Italie"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,2,4000],[2,1,1400],[3,4,1700],[4,3,2400],[5,4,800],[6,6,5500],[7,5,3100],[8,2,2700],[9,2,3800]]}]],[[4000]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Agnès","Allemagne"],[2,"Farid","France"],[3,"Hugo","Espagne"],[4,"Béatrice","Espagne"],[5,"Alice","Italie"],[6,"Élodie","Allemagne"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,3,2900],[2,4,3400],[3,3,3200],[4,3,4300],[5,6,1000],[6,3,1300],[7,1,5000],[8,1,3800],[9,3,1800],[10,5,500],[11,4,3500],[12,2,3100]]}]],[[4300]]],[[[{"name":"clients","cols":["id INTEGER","nom TEXT","pays TEXT"],"rows":[[1,"Hugo","France"],[2,"Farid","France"],[3,"Inès","Allemagne"],[4,"Alice","Allemagne"],[5,"Camille","France"],[6,"Antoine","France"]]},{"name":"ordres","cols":["id INTEGER","client_id INTEGER","montant INTEGER"],"rows":[[1,4,2900],[2,3,1000],[3,1,4700],[4,6,1500],[5,1,5900],[6,3,3100],[7,4,3900],[8,6,2700],[9,1,1600],[10,1,2400],[11,6,600],[12,2,3200],[13,1,2100],[14,2,4900],[15,3,1200]]}]],[[4900]]]],
    ref: 'SELECT montant FROM ordres ORDER BY montant DESC LIMIT 1 OFFSET 1',
    tip: 'On trie du plus gros au plus petit, on saute le premier (OFFSET 1) et on en garde un (LIMIT 1).',
  },
];


// « Que va afficher ce programme Java ? » : la bonne réponse est la sortie réelle (programme exécuté avec java à la génération).
export const JAVA_READ = [
  { id: 'java1', level: 1, lang: 'java', code: 'class Compte {\n    private int solde;\n    Compte(int s) { solde = s; }\n    int getSolde() { return solde; }\n}\n// dans main :\nCompte c = new Compte(100);\nSystem.out.println(c.getSolde());', good: '100', wrong: ["0", "null", "Erreur de compilation"], tip: 'Le constructeur range 100 dans l\'attribut privé ; le getter le renvoie.' },
  { id: 'java2', level: 1, lang: 'java', code: 'class Point {\n    int x;\n    Point(int x) { x = x; }\n}\n// dans main :\nPoint p = new Point(5);\nSystem.out.println(p.x);', good: '0', wrong: ["5", "null", "Erreur de compilation"], tip: 'x = x affecte le paramètre à lui-même : l\'attribut reste à 0. Il fallait écrire this.x = x.' },
  { id: 'java3', level: 1, lang: 'java', code: 'class Chat {\n    String nom;\n    Chat(String nom) { this.nom = nom; }\n    public String toString() { return "Chat " + nom; }\n}\n// dans main :\nSystem.out.println(new Chat("Tom"));', good: 'Chat Tom', wrong: ["Chat@1b6d3586", "Tom", "null"], tip: 'println appelle toString() ; comme il est redéfini, on obtient « Chat Tom » au lieu de l\'adresse.' },
  { id: 'java4', level: 2, lang: 'java', code: 'class Chien {\n    String nom;\n    Chien(String nom) { this.nom = nom; }\n}\n// dans main :\nSystem.out.println(new Chien("Rex").toString().contains("@"));', good: 'true', wrong: ["false", "Rex", "Erreur de compilation"], tip: 'Sans toString() redéfini, Java affiche le nom de la classe, @, puis un code : on ne voit pas « Rex ». D\'où l\'intérêt de redéfinir toString().' },
  { id: 'java5', level: 2, lang: 'java', code: 'String a = new String("abc");\nString b = new String("abc");\nSystem.out.println((a == b) + " " + a.equals(b));', good: 'false true', wrong: ["true true", "true false", "false false"], tip: '== compare les références (deux objets distincts) ; equals compare le contenu.' },
  { id: 'java6', level: 2, lang: 'java', code: 'class Compteur {\n    static int n = 0;\n    Compteur() { n++; }\n}\n// dans main :\nnew Compteur(); new Compteur(); new Compteur();\nSystem.out.println(Compteur.n);', good: '3', wrong: ["1", "0", "Erreur de compilation"], tip: 'Un attribut static est partagé par tous les objets : chaque constructeur incrémente le même n.' },
  { id: 'java7', level: 2, lang: 'java', code: 'class Animal {\n    String cri() { return "..."; }\n}\nclass Vache extends Animal {\n    String cri() { return "Meuh"; }\n}\n// dans main :\nAnimal a = new Vache();\nSystem.out.println(a.cri());', good: 'Meuh', wrong: ["...", "Erreur de compilation", "null"], tip: 'Polymorphisme : c\'est la méthode de l\'objet réel (Vache) qui est appelée, même via une variable de type Animal.' },
  { id: 'java8', level: 2, lang: 'java', code: 'class A {\n    A() { System.out.print("A"); }\n}\nclass B extends A {\n    B() { System.out.print("B"); }\n}\n// dans main :\nnew B();', good: 'AB', wrong: ["B", "BA", "A"], tip: 'Le constructeur du parent s\'exécute d\'abord (super() implicite), puis celui de l\'enfant : AB.' },
  { id: 'java9', level: 2, lang: 'java', code: 'static void plusUn(int x) { x = x + 1; }\n// dans main :\nint n = 5;\nplusUn(n);\nSystem.out.println(n);', good: '5', wrong: ["6", "0", "Erreur de compilation"], tip: 'Java passe les types primitifs par valeur : la méthode modifie une copie.' },
  { id: 'java10', level: 3, lang: 'java', code: 'class Boite { int v; }\nstatic void change(Boite b) { b.v = 9; }\n// dans main :\nBoite b = new Boite();\nchange(b);\nSystem.out.println(b.v);', good: '9', wrong: ["0", "null", "Erreur de compilation"], tip: 'On passe une copie de la référence : elle désigne le même objet, donc la modification se voit.' },
  { id: 'java11', level: 3, lang: 'java', code: 'class Boite { int v; }\nstatic void remplace(Boite b) { b = new Boite(); b.v = 9; }\n// dans main :\nBoite b = new Boite();\nremplace(b);\nSystem.out.println(b.v);', good: '0', wrong: ["9", "null", "Erreur de compilation"], tip: 'Réaffecter le paramètre ne change pas la variable de l\'appelant : son objet garde v = 0.' },
  { id: 'java12', level: 2, lang: 'java', code: 'class Prix {\n    private double montant;\n    void setMontant(double m) { if (m >= 0) montant = m; }\n    double getMontant() { return montant; }\n}\n// dans main :\nPrix p = new Prix();\np.setMontant(50); p.setMontant(-10);\nSystem.out.println(p.getMontant());', good: '50.0', wrong: ["-10.0", "40.0", "0.0"], tip: 'Le setter refuse les valeurs négatives : c\'est l\'intérêt de l\'encapsulation, il garde l\'objet cohérent.' },
  { id: 'java13', level: 1, lang: 'java', code: 'int a = 7, b = 2;\nSystem.out.println(a / b + " " + a % b);', good: '3 1', wrong: ["3.5 1", "3 0", "4 1"], tip: 'Entre deux int, / est une division entière (3) ; % donne le reste (1).' },
  { id: 'java14', level: 2, lang: 'java', code: 'System.out.println(1 + 2 + "3" + 4 + 5);', good: '3345', wrong: ["15", "12345", "6 9"], tip: 'De gauche à droite : 1 + 2 = 3, puis « 3 » + "3" = "33", puis on concatène 4 et 5 : 3345.' },
  { id: 'java15', level: 3, lang: 'java', code: 'class Mere {\n    static String qui() { return "mère"; }\n}\nclass Fille extends Mere {\n    static String qui() { return "fille"; }\n}\n// dans main :\nMere m = new Fille();\nSystem.out.println(m.qui());', good: 'mère', wrong: ["fille", "Erreur de compilation", "null"], tip: 'Les méthodes static ne sont pas redéfinies mais masquées : c\'est le type déclaré (Mere) qui décide.' },
  { id: 'java16', level: 2, lang: 'java', code: 'class Calc {\n    int f(int x) { return 1; }\n    int f(double x) { return 2; }\n}\n// dans main :\nSystem.out.println(new Calc().f(3));', good: '1', wrong: ["2", "3", "Erreur de compilation"], tip: 'Surcharge : 3 est un int, la version f(int) est la plus précise.' },
  { id: 'java17', level: 3, lang: 'java', code: 'Integer a = 127, b = 127;\nInteger c = 1000, d = 1000;\nSystem.out.println((a == b) + " " + (c == d));', good: 'true false', wrong: ["true true", "false false", "false true"], tip: 'Java met en cache les Integer de −128 à 127 : même objet pour 127, objets distincts pour 1000. Il faut equals().' },
  { id: 'java18', level: 2, lang: 'java', code: 'StringBuilder sb = new StringBuilder("ab");\nsb.append("cd").reverse();\nSystem.out.println(sb);', good: 'dcba', wrong: ["abcd", "cdab", "ba"], tip: 'append ajoute à la fin (abcd), reverse retourne tout : dcba. StringBuilder est modifiable, contrairement à String.' },
  { id: 'java19', level: 1, lang: 'java', code: 'String s = "trader";\ns.toUpperCase();\nSystem.out.println(s);', good: 'trader', wrong: ["TRADER", "Trader", "Erreur de compilation"], tip: 'Une String est immuable : toUpperCase() renvoie une nouvelle chaîne, qu\'on n\'a pas récupérée.' },
  { id: 'java20', level: 3, lang: 'java', code: 'class Personne {\n    private final String nom;\n    Personne(String nom) { this.nom = nom; }\n    public boolean equals(Object o) {\n        return o instanceof Personne p && p.nom.equals(nom);\n    }\n}\n// dans main :\nSystem.out.println(new Personne("Ana").equals(new Personne("Ana")));', good: 'true', wrong: ["false", "Erreur de compilation", "null"], tip: 'equals est redéfini pour comparer les noms. Pense aussi à redéfinir hashCode, sinon les HashMap se comportent mal.' },
];

// Programme Python complet : le code du joueur, puis les tests. Le résultat (JSON) est dans __RESULT.
// Les chaînes JSON sont aussi des chaînes Python valides.
export function buildProgram(code, fn, tests, { print = false, lang = 'python', ordered = true } = {}) {
  if (lang === 'sql') return buildSqlProgram(code, tests, { print, ordered });
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

// Même harnais pour SQL : chaque test est une base (tables et lignes) et le résultat attendu de la requête de référence.
// Une seule instruction est exécutée ; l'ordre des lignes ne compte que si l'énoncé le demande.
function buildSqlProgram(query, tests, { print, ordered }) {
  return `
import json as __json, math as __math, sqlite3 as __sql
__q = ${JSON.stringify(String(query))}
__tests = __json.loads(${JSON.stringify(JSON.stringify(tests))})
def __same(a, b, __t=type):
    if __t(b) is float or (__t(a) is float and __t(b) is int):
        return __t(a) in (int, float) and __math.isclose(float(a), float(b), rel_tol=1e-6, abs_tol=1e-9)
    if __t(b) in (list, tuple):
        return __t(a) in (list, tuple) and len(a) == len(b) and all(__same(x, y) for x, y in zip(a, b))
    return __t(a) is __t(b) and a == b
__dumps = __json.dumps
__out = {'error': None, 'tests': []}
for __args, __exp in __tests:
    try:
        __c = __sql.connect(':memory:')
        for __t in __args[0]:
            __c.execute('CREATE TABLE %s (%s)' % (__t['name'], ', '.join(__t['cols'])))
            __c.executemany('INSERT INTO %s VALUES (%s)' % (__t['name'], ', '.join('?' * len(__t['cols']))), __t['rows'])
        __got = [list(__r) for __r in __c.execute(__q).fetchall()]
        __c.close()
        __a, __b = (__got, __exp) if ${ordered ? 'True' : 'False'} else (sorted(__got, key=repr), sorted(__exp, key=repr))
        __out['tests'].append({'ok': bool(__same(__a, __b)), 'got': repr(__got)[:200]})
    except Exception as __e:
        __out['tests'].append({'ok': False, 'err': (type(__e).__name__ + ' : ' + str(__e))[:160]})
if __out['tests'] and all('err' in __x for __x in __out['tests']):
    __out['error'] = __out['tests'][0]['err']
__RESULT = __dumps(__out)
${print ? 'print("@@RESULT@@" + __RESULT)' : ''}
`;
}

// Résultat d'exécution → nombre de tests réussis (une erreur de compilation n'en passe aucun)
export function scoreRun(out, total) {
  if (!out || out.error) return 0;
  return Math.min(total, (out.tests || []).filter((t) => t.ok).length);
}
