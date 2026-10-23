// Banque de questions du mode The Candidate (entretien façon Pierre Chartier).
// Une ligne par question :  niveau | rubrique | question | bonne réponse | 3 mauvaises réponses | explication
//   niveau 1 = premier tour, 2 = desk, 3 = comité final (brainteasers quant, dérivés, corporate avancée).
// Les mauvaises réponses sont des erreurs plausibles (formule inversée, oubli d'un terme, piège classique)
// et ont le même format que la bonne : on ne doit jamais pouvoir deviner la réponse à sa forme.
// L'ordre des choix est mélangé à chaque partie (voir questions.js).
//
// Le piège : une des mauvaises réponses est l'erreur grossière que l'examinateur attend (elle coûte deux vies).
// On la marque d'un « ! » ; sans marque, c'est la mauvaise réponse citée dans l'explication, sinon la première.

const RAW = `
1 | Marchés | Que signifie « CAC » dans CAC 40 ? | Cotation Assistée en Continu | Cours Agrégé de Clôture | Comité des Actions Cotées | Capitalisation des Actions Courantes | Le nom vient du système électronique de cotation lancé à Paris en 1986 (à l'origine, c'était la Compagnie des Agents de Change).
1 | Marchés | Combien de valeurs compte le DAX allemand depuis 2021 ? | 40 | 30 | 50 | 100 | Le DAX est passé de 30 à 40 valeurs en septembre 2021, comme le CAC 40.
1 | Taux | Les taux d'intérêt montent. Le prix d'une obligation à taux fixe… | baisse | monte | ne bouge pas | double | Son coupon fixe devient moins attractif que celui des nouvelles émissions : son prix baisse pour que son rendement rejoigne le marché.
1 | Marchés | Quel animal symbolise un marché haussier ? | Le taureau | L'ours | Le loup | L'aigle | Le taureau frappe de bas en haut avec ses cornes ; l'ours frappe de haut en bas avec ses pattes.
1 | Marchés | Quel animal symbolise un marché baissier ? | L'ours | Le taureau | Le requin | Le renard | Bear market : l'ours rabat ses pattes vers le bas.
1 | Marchés | Quelle est la devise du Japon ? | Le yen | Le yuan | Le won | Le baht | Yuan : Chine. Won : Corée du Sud. Baht : Thaïlande.
1 | Marchés | Quel est le code ISO du franc suisse ? | CHF | SFR | FCH | SWF | CHF pour Confoederatio Helvetica Franc.
1 | Corporate | Comment s'appelle la part du bénéfice versée aux actionnaires ? | Le dividende | Le coupon | La plus-value | La prime d'émission | Le coupon, c'est l'intérêt versé aux porteurs d'obligations.
1 | Taux | 1 point de base vaut… | 0,01 % | 0,1 % | 1 % | 0,001 % | 100 points de base = 1 %. Un mouvement de 25 bp = 0,25 %.
1 | Calcul | Une action passe de 100 € à 120 €. Quelle est sa hausse ? | +20 % | +12 % | +16,7 % | +2 % | (120 − 100) / 100 = 20 %. Le 16,7 % est la baisse qu'il faudrait pour revenir de 120 à 100.
1 | Calcul | Une action chute de 100 € à 50 €. Quelle hausse faut-il pour revenir à 100 € ? | +100 % | +50 % | +75 % | +200 % | De 50 à 100, il faut doubler : +100 %. Une perte se rattrape toujours plus lentement qu'elle ne se creuse.
1 | Marchés | Que signifie IPO ? | Initial Public Offering | Internal Price Order | International Portfolio Option | Initial Private Offer | L'introduction en bourse : la société vend ses actions au public pour la première fois.
1 | Marchés | Quel indice regroupe les 500 plus grandes capitalisations américaines ? | Le S&P 500 | Le Dow Jones | Le Russell 2000 | Le Nasdaq 100 | Le Dow Jones ne compte que 30 valeurs, le Russell 2000 suit les petites capitalisations.
1 | Macro | Comment s'appelle la banque centrale des États-Unis ? | La Fed | La SEC | Le Trésor américain | Le FMI | La Réserve fédérale fixe les taux directeurs ; la SEC est le gendarme de la bourse.
1 | Macro | Dans quelle ville siège la Banque centrale européenne ? | Francfort | Bruxelles | Strasbourg | Luxembourg | La BCE est installée à Francfort-sur-le-Main, en Allemagne.
1 | Dérivés | Quel contrat donne le droit, sans obligation, d'acheter un actif à prix fixé ? | Un call | Un put | Un future | Un swap | Le future engage les deux parties ferme ; le put donne le droit de vendre.
1 | Dérivés | Quel contrat donne le droit, sans obligation, de vendre un actif à prix fixé ? | Un put | Un call | Un forward | Un CDS | Le put protège contre la baisse : on peut vendre au strike même si le cours s'effondre.
1 | Dérivés | Comment s'appelle le prix auquel une option peut être exercée ? | Le strike | La prime | Le spot | Le nominal | Le strike (prix d'exercice) ; la prime est le prix payé pour acheter l'option.
1 | Corporate | 10 millions d'actions à 25 € : quelle capitalisation boursière ? | 250 M€ | 25 M€ | 2,5 Md€ | 400 M€ | 10 millions × 25 € = 250 millions d'euros.
1 | Corporate | Dans un bilan, ce que l'entreprise possède figure… | à l'actif | au passif | en capitaux propres | en hors-bilan | L'actif = ce qu'elle possède ; le passif = comment c'est financé (dettes et capitaux propres).
1 | Corporate | Que signifie M&A ? | Mergers & Acquisitions | Markets & Assets | Management & Audit | Money & Allocation | Fusions et acquisitions : le métier des banquiers conseil en rapprochement d'entreprises.
1 | Marchés | Vendre un titre que l'on ne possède pas, c'est… | la vente à découvert | le rachat d'actions | le portage | l'arbitrage | On emprunte le titre pour le vendre, en espérant le racheter moins cher plus tard (short).
1 | Calcul | 1 000 € placés à 5 % d'intérêts simples pendant 2 ans donnent… | 1 100 € | 1 102,50 € | 1 050 € | 1 010 € | Intérêts simples : 2 × 50 € = 100 €. Le 1 102,50 € serait le résultat en intérêts composés.
1 | Taux | Obligation de nominal 1 000 € au taux facial de 4 % : coupon annuel ? | 40 € | 4 € | 400 € | 104 € | 4 % × 1 000 € = 40 € par an.
1 | Marchés | Quel actif est la valeur refuge historique en cas de crise ? | L'or | Le pétrole | Le cuivre | Le blé | L'or n'a pas de risque de défaut et ne dépend d'aucune banque centrale.
1 | Marchés | Quel est l'indice phare de la Bourse de Londres ? | Le FTSE 100 | L'AEX | Le SMI | L'IBEX 35 | AEX : Amsterdam. SMI : Zurich. IBEX 35 : Madrid.
1 | Marchés | Quel est l'indice phare de la Bourse de Tokyo ? | Le Nikkei 225 | Le Hang Seng | Le KOSPI | Le Sensex | Hang Seng : Hong Kong. KOSPI : Séoul. Sensex : Bombay.
1 | Marchés | L'écart entre le prix acheteur et le prix vendeur s'appelle… | le spread | le slippage | la marge | le gap | Le slippage, c'est l'écart entre le prix visé et le prix réellement obtenu.
1 | Calcul | Bid à 99,50 €, ask à 100,00 €. Quel est le spread ? | 0,50 € | 0,05 € | 5 € | 0,25 € | 100,00 − 99,50 = 0,50 €. Le milieu de fourchette (mid) est à 99,75 €.
1 | Marchés | Sur un desk, que signifie P&L ? | Profit and Loss | Price and Liquidity | Position and Leverage | Portfolio and Ledger | Le résultat du trader, recalculé chaque soir.
1 | Marchés | Avec Moody's et Fitch, quelle est la troisième grande agence de notation ? | S&P Global | Morningstar | Bloomberg | BlackRock | Les « Big Three » notent l'essentiel de la dette mondiale.
1 | Taux | Comment s'appelle l'obligation à long terme de l'État français ? | L'OAT | Le Bund | Le BTP | Le Gilt | Bund : Allemagne. BTP : Italie. Gilt : Royaume-Uni.
1 | Macro | Une baisse générale et durable des prix, c'est… | la déflation | la désinflation | la stagflation | la récession | La désinflation est un simple ralentissement : les prix montent encore, mais moins vite.
1 | Corporate | Une action à 40 € verse 2 € de dividende. Rendement ? | 5 % | 2 % | 20 % | 8 % | 2 / 40 = 5 %. Le 20 % est le ratio inverse (40 / 2).
1 | Marchés | Que signifie ETF ? | Exchange Traded Fund | Equity Trading Facility | Electronic Transfer Fund | European Treasury Fund | Un fonds coté qui réplique un indice, qu'on achète comme une action.
1 | Marchés | Quel est le marché le plus liquide du monde ? | Le marché des changes | Le marché actions | Le marché de l'or | Le marché des cryptos | Le Forex brasse plus de 7 000 milliards de dollars par jour.
1 | Marchés | Brent et WTI sont deux références du… | pétrole | gaz naturel | blé | cuivre | Brent : mer du Nord. WTI : West Texas Intermediate.
1 | Calcul | EUR/USD = 1,10. Combien valent 100 € ? | 110 $ | 90,91 $ | 100 $ | 11 $ | 1 € = 1,10 $ donc 100 € = 110 $. Le 90,91 $ vient de la cotation inversée.
1 | Marchés | Quel ordre s'exécute tout de suite au meilleur prix disponible ? | L'ordre au marché | L'ordre à cours limité | L'ordre stop | L'ordre iceberg | Rapide mais sans garantie de prix ; l'ordre limité garantit le prix mais pas l'exécution.
1 | Corporate | Une start-up non cotée valorisée plus d'un milliard de dollars est… | une licorne | un dragon | une gazelle | un centaure | Au-delà de 10 milliards, on parle de décacorne.
1 | Macro | Une récession technique, c'est combien de trimestres de baisse du PIB d'affilée ? | 2 | 1 | 3 | 4 | Deux trimestres consécutifs de croissance négative.
1 | Macro | Inflation à 4 %, salaire +4 %. Votre pouvoir d'achat… | est stable | gagne 4 % | perd 4 % | gagne 8 % | Le salaire réel ne bouge pas : la hausse compense exactement celle des prix.
1 | Macro | Un livret rapporte 3 %, l'inflation est à 2 %. Rendement réel environ ? | 1 % | 5 % | 3 % | 1,5 % | Rendement réel ≈ rendement nominal − inflation = 3 − 2 = 1 %.
1 | Calcul | Combien d'onces troy dans un lingot d'or de 1 kg ? | Environ 32 | Environ 16 | Environ 35 | Environ 28 | Une once troy pèse 31,1 g : 1 000 / 31,1 ≈ 32. Le 35 vient de l'once ordinaire (28,35 g).
1 | Marchés | Par convention, un « bear market » commence après une baisse de… | 20 % | 10 % | 5 % | 50 % | −10 % depuis le plus haut, c'est une correction ; −20 %, un marché baissier.
1 | Macro | Qui fixe les taux directeurs de la zone euro ? | La BCE | La Banque de France | La Commission européenne | Le FMI | Les banques centrales nationales appliquent la politique décidée par la BCE.
1 | Macro | Une banque centrale relève ses taux. Effet attendu sur l'inflation ? | Elle ralentit | Elle accélère | Aucun effet | Elle double | Le crédit coûte plus cher, la demande ralentit, les prix montent moins vite.
1 | Corporate | Chiffre d'affaires 120 M€, marge nette 10 %. Résultat net ? | 12 M€ | 1,2 M€ | 10 M€ | 108 M€ | 10 % de 120 M€ = 12 M€. Le 108 M€ correspond aux charges.
1 | Marchés | Combien de valeurs compte le Dow Jones ? | 30 | 40 | 100 | 500 | Le plus ancien indice américain, pondéré par les prix et non par la capitalisation.
1 | Marchés | Le Nasdaq est surtout connu pour ses valeurs… | technologiques | bancaires | pétrolières | du luxe | Apple, Microsoft, Nvidia, Amazon… y sont cotées.
1 | Calcul | 15 % de 200 ? | 30 | 15 | 35 | 20 | 10 % = 20, 5 % = 10 : total 30.
1 | Calcul | 25 % de 80 ? | 20 | 25 | 16 | 32 | 25 %, c'est un quart : 80 / 4 = 20.
1 | Calcul | 12² ? | 144 | 124 | 132 | 154 | 12 × 12 = 144.
1 | Calcul | √144 ? | 12 | 14 | 11 | 72 | 12 × 12 = 144. Le 72 vient d'une division par 2, pas d'une racine.
1 | Calcul | 9 × 12 ? | 108 | 98 | 112 | 118 | 9 × 12 = 10 × 12 − 12 = 108.
1 | Calcul | 11 × 11 ? | 121 | 111 | 122 | 131 | Astuce ×11 : 1, (1+1), 1 → 121.
1 | Calcul | 5 + 5 × 5 ? | 30 | 50 | 35 | 25 | La multiplication passe avant : 5 + 25 = 30.
1 | Calcul | 2 h 30 en minutes ? | 150 | 130 | 230 | 120 | 2 × 60 + 30 = 150 minutes.
1 | Calcul | 4 cafés coûtent 8 €. Combien coûtent 7 cafés ? | 14 € | 12 € | 16 € | 15 € | 2 € le café : 7 × 2 = 14 €.
1 | Calcul | Moyenne de 10, 20 et 60 ? | 30 | 20 | 45 | 35 | (10 + 20 + 60) / 3 = 90 / 3 = 30. Le 20 est la médiane.
1 | Calcul | 1 000 − 37 ? | 963 | 973 | 937 | 967 | 1 000 − 40 = 960, puis +3 = 963.
1 | Calcul | 125 × 8 ? | 1 000 | 800 | 1 025 | 960 | 125 = 1 000 / 8, donc 125 × 8 = 1 000.
1 | Calcul | 3/4 en pourcentage ? | 75 % | 34 % | 70 % | 80 % | 3 / 4 = 0,75 = 75 %.
1 | Calcul | 1/8 en écriture décimale ? | 0,125 | 0,8 | 0,18 | 0,25 | 1/4 = 0,25, donc 1/8 = 0,125.
1 | Calcul | 20 % de 45 ? | 9 | 4,5 | 25 | 11 | 10 % = 4,5, donc 20 % = 9.
1 | Calcul | 18 × 5 ? | 90 | 85 | 95 | 80 | ×5, c'est ×10 puis ÷2 : 180 / 2 = 90.
1 | Calcul | 640 ÷ 8 ? | 80 | 8 | 70 | 64 | 8 × 80 = 640.
1 | Calcul | 2⁵ ? | 32 | 10 | 25 | 64 | 2 × 2 × 2 × 2 × 2 = 32. Le 10 vient de 2 × 5.
1 | Calcul | 0,5 × 0,5 ? | 0,25 | 2,5 | 1 | 0,1 | La moitié d'une moitié : un quart.
1 | Calcul | 99 + 99 + 99 ? | 297 | 287 | 299 | 307 | 3 × 100 − 3 = 297.
1 | Calcul | 3 % de frais sur 1 000 €. Combien de frais ? | 30 € | 3 € | 300 € | 33 € | 1 % de 1 000 = 10 €, donc 3 % = 30 €.
1 | Calcul | Un article à 80 € est soldé −25 %. Nouveau prix ? | 60 € | 55 € | 65 € | 20 € | La remise vaut 20 € : 80 − 20 = 60 €.
1 | Logique | Suite : 5 – 10 – 20 – 40 – ? | 80 | 60 | 50 | 70 | Chaque terme double.
1 | Logique | Suite : 100 – 90 – 81 – 73 – ? | 66 | 65 | 63 | 64 | On retire 10, 9, 8, puis 7.
1 | Logique | Suite : A – C – E – G – ? | I | H | J | K | Une lettre sur deux.
1 | Logique | Suite : L – M – M – J – V – S – ? | D | L | M | S | Les initiales des jours de la semaine : dimanche.
1 | Logique | Vous doublez le 2e d'une course. Quelle est votre place ? | 2e | 1er | 3e | Dernier | Vous prenez sa place : 2e. Le 1er est toujours devant.
1 | Logique | Le père de Clara a 4 filles : Lala, Lélé, Lili et… | Clara | Lolo | Lulu | Lyly | Tout est dans l'énoncé : c'est le père de Clara.
1 | Logique | Combien de mois de l'année ont 28 jours ? | 12 | 1 | 2 | 6 | Tous les mois ont au moins 28 jours.
1 | Logique | Sur un dé, quelle face est opposée au 1 ? | 6 | 2 | 5 | 4 | Les faces opposées d'un dé font toujours 7.
1 | Logique | Un fermier a 15 vaches. Toutes meurent sauf 8. Combien en reste-t-il ? | 8 | 7 | 0 | 15 | « Toutes sauf 8 » : il en reste 8.
1 | Logique | Qui pèse le plus : 1 kg de plumes ou 1 kg de plomb ? | Le même poids | Le plomb | Les plumes | Ça dépend de l'altitude | Un kilo reste un kilo.
1 | Logique | Si hier était mardi, demain sera… | jeudi | mercredi | vendredi | lundi | Hier mardi, aujourd'hui mercredi, demain jeudi.
1 | Logique | Face au sud, vous faites un demi-tour. Vous regardez vers… | le nord | l'est | l'ouest | le sud | Un demi-tour = 180° : le sud devient le nord.
1 | Attention | Combien de fois le chiffre 3 apparaît-il dans 39 230 313 ? | 4 | 3 | 5 | 2 | 3·9·2·3·0·3·1·3 : quatre 3.
1 | Attention | Écrivez « RISQUE » à l'envers. | EUQSIR | EUQISR | EUSQIR | EQUSIR | R-I-S-Q-U-E à l'envers : E-U-Q-S-I-R.
1 | Attention | Combien de lettres dans « VOLATILITÉ » ? | 10 | 9 | 11 | 8 | V-O-L-A-T-I-L-I-T-É : 10 lettres.
1 | Probas | Probabilité de faire 6 avec un dé ? | 1/6 | 1/5 | 1/3 | 1/36 | Une face favorable sur six. 1/36, c'est un double 6 avec deux dés.
1 | Probas | Probabilité de tirer un cœur dans un jeu de 52 cartes ? | 1/4 | 1/13 | 1/52 | 1/2 | 13 cœurs sur 52 cartes : 1/4. Le 1/13 serait un as.
1 | Probas | Probabilité d'un nombre pair avec un dé ? | 1/2 | 1/3 | 1/6 | 2/3 | 2, 4 ou 6 : trois faces sur six.
1 | Logique | Intrus : euro – dollar – yen – bitcoin | Bitcoin | Euro | Dollar | Yen | Le seul qui n'est émis par aucune banque centrale.
1 | Calcul | x + 12 = 20. Combien vaut x ? | 8 | 32 | 12 | 6 | x = 20 − 12 = 8.
1 | Calcul | Un trader gagne 500 € par jour pendant 20 jours. Total ? | 10 000 € | 5 000 € | 1 000 € | 12 000 € | 500 × 20 = 10 000 €.
1 | Calcul | Combien de minutes entre 8 h 50 et 9 h 25 ? | 35 | 25 | 75 | 45 | 10 minutes jusqu'à 9 h, puis 25 : 35 minutes.
1 | Calcul | Combien de secondes dans une heure ? | 3 600 | 360 | 6 000 | 600 | 60 × 60 = 3 600.
1 | Calcul | 10³ ? | 1 000 | 30 | 100 | 10 000 | 10 × 10 × 10 = 1 000.
1 | Corporate | Le chiffre d'affaires, en anglais, c'est… | le revenue | l'income | le profit | l'equity | Revenue (ou sales) ; net income désigne le résultat net.
1 | Marchés | Le cours d'une action monte quand… | les acheteurs dominent | l'entreprise émet des actions | le dividende est détaché | la bourse ferme | Plus d'acheteurs que de vendeurs au prix actuel : le prix s'ajuste vers le haut.
1 | Marchés | Que désigne un « blue chip » ? | Une grande valeur solide | Une action à moins de 1 € | Une start-up tech | Une obligation d'État | L'expression vient des jetons bleus, les plus chers au poker.
1 | Calcul | 6 % de 50 ? | 3 | 30 | 0,3 | 6 | 1 % de 50 = 0,5, donc 6 % = 3.
1 | Calcul | 72 ÷ 12 ? | 6 | 8 | 7 | 5 | 12 × 6 = 72.
1 | Calcul | Un portefeuille de 2 000 € gagne 7 %. Gain ? | 140 € | 14 € | 70 € | 1 400 € | 1 % = 20 €, donc 7 % = 140 €.
2 | Corporate | Cours 75 €, bénéfice par action 5 €. Quel est le PER ? | 15 | 12 | 20 | 70 | PER = cours / BPA = 75 / 5 = 15. L'action vaut 15 années de bénéfices.
2 | Taux | Coupon de 40 €, l'obligation cote 800 €. Rendement courant ? | 5 % | 4 % | 8 % | 6 % | 40 / 800 = 5 %. Le 4 % est le taux facial, calculé sur le nominal de 1 000 €.
2 | Corporate | Capitalisation 400 M€, dette 120 M€, trésorerie 40 M€. Valeur d'entreprise ? | 480 M€ | 560 M€ | 520 M€ | 360 M€ | VE = capitalisation + dette − trésorerie = 400 + 120 − 40 = 480 M€.
2 | Marchés | Que mesure le bêta d'une action ? | Sa sensibilité au marché | Sa volatilité totale | Son endettement | Son rendement du dividende | Un bêta de 1,2 : l'action bouge en moyenne de 1,2 % quand le marché bouge de 1 %.
2 | Marchés | Bêta de 1,5, le marché monte de 2 %. L'action monte en théorie de… | 3 % | 2 % | 3,5 % | 1,5 % | 1,5 × 2 % = 3 %.
2 | Corporate | MEDAF : taux sans risque 2 %, prime de marché 6 %, bêta 1,5. Coût des fonds propres ? | 11 % | 9 % | 12 % | 8 % | 2 % + 1,5 × 6 % = 11 %. Le 12 % applique le bêta au taux sans risque aussi.
2 | Marchés | Rendement 12 %, volatilité 10 %, taux sans risque 2 %. Ratio de Sharpe ? | 1,0 | 1,2 | 0,8 | 0,1 | (12 − 2) / 10 = 1,0. Le 1,2 oublie de retirer le taux sans risque.
2 | Corporate | Dette à 8 % avant impôt, taux d'IS de 25 %. Coût après impôt ? | 6 % | 2 % | 7,75 % | 10 % | Les intérêts sont déductibles : 8 % × (1 − 0,25) = 6 %.
2 | Corporate | Que signifie WACC ? | Weighted Average Cost of Capital | Working Asset Capital Cost | Weighted Asset Credit Charge | World Average Capital Cost | Coût moyen pondéré du capital (CMPC) : le taux d'actualisation d'un DCF.
2 | Corporate | Qu'est-ce qui sépare l'EBITDA de l'EBIT ? | Les amortissements | Les intérêts | L'impôt | La variation du BFR | EBIT = EBITDA − dotations aux amortissements et provisions (D&A).
2 | Dérivés | Call de strike 50 € payé 4 €. À l'échéance, l'action vaut 60 €. Profit net ? | 6 € | 10 € | 14 € | 4 € | Gain d'exercice 60 − 50 = 10 €, moins la prime de 4 € : 6 €.
2 | Dérivés | Put de strike 100 € payé 6 €. À l'échéance, l'action vaut 110 €. Résultat ? | −6 € | −10 € | +4 € | −16 € | Le put finit hors de la monnaie : on ne l'exerce pas et on perd la prime.
2 | Dérivés | Call de strike 80 € payé 5 €. À quel cours atteint-on le point mort ? | 85 € | 75 € | 80 € | 90 € | Il faut récupérer la prime : 80 + 5 = 85 €. Le 75 € serait le point mort d'un put.
2 | Dérivés | Quelle grecque mesure la sensibilité d'une option au prix du sous-jacent ? | Delta | Gamma | Vega | Thêta | Delta = ∂Prix / ∂S. Le gamma mesure la variation du delta.
2 | Dérivés | Quelle grecque mesure l'érosion d'une option avec le temps ? | Thêta | Rhô | Vega | Delta | Le thêta : la valeur temps fond chaque jour, plus vite à l'approche de l'échéance.
2 | Dérivés | Quelle grecque mesure la sensibilité à la volatilité implicite ? | Vega | Gamma | Thêta | Rhô | Le vega (qui n'est pas une vraie lettre grecque).
2 | Dérivés | Delta d'un call à la monnaie, environ ? | 0,5 | 0 | 1 | 0,25 | Une chance sur deux environ de finir dans la monnaie : delta proche de 0,5.
2 | Dérivés | Une option américaine, par rapport à une européenne… | s'exerce à tout moment | cote en dollars | n'a pas de prime | n'a pas de strike | L'américaine s'exerce jusqu'à l'échéance ; l'européenne seulement à l'échéance. Rien à voir avec la géographie.
2 | Dérivés | Achat d'un call et d'un put de même strike et même échéance ? | Un straddle | Un strangle | Un butterfly | Un collar | Strangle : strikes différents. Le straddle gagne si le marché bouge fort, dans un sens ou l'autre.
2 | Calcul | Règle de 72 : à 6 % par an, un capital double en environ… | 12 ans | 6 ans | 16,7 ans | 7,2 ans | 72 / 6 = 12 ans.
2 | Calcul | Une action passe de 80 € à +25 %, puis −20 %. Cours final ? | 80 € | 84 € | 76 € | 100 € | 80 × 1,25 = 100, puis 100 × 0,8 = 80 €.
2 | Marchés | Une action à 100 € détache un dividende de 4 €. Elle ouvre en théorie à… | 96 € | 100 € | 104 € | 99,96 € | Le dividende sort de la société : le cours baisse d'autant.
2 | Dérivés | Perte maximale du vendeur d'un call nu (non couvert) ? | Illimitée | La prime | Le strike | 100 % du cours | Le cours peut monter sans limite, et le vendeur doit livrer au strike.
2 | Corporate | Le BFR d'exploitation, c'est… | stocks + clients − fournisseurs | actif − passif | trésorerie − dettes | capitaux propres − immobilisations | Le cash immobilisé par le cycle d'exploitation.
2 | Corporate | Le BFR augmente de 10 M€ dans l'année. Effet sur le free cash flow ? | −10 M€ | +10 M€ | Aucun | −2,5 M€ | Du cash est bloqué en stocks et en créances : il sort de la trésorerie.
2 | Corporate | Un projet coûte 200 € et rapporte 220 € dans un an. Taux de 10 %. VAN ? | 0 € | 20 € | −20 € | 2 € | −200 + 220 / 1,10 = −200 + 200 = 0. Le projet rapporte exactement 10 %.
2 | Corporate | Le taux d'actualisation qui annule la VAN s'appelle… | le TRI | le WACC | le taux sans risque | le payback | Taux de rentabilité interne (IRR) : on investit s'il dépasse le coût du capital.
2 | Corporate | Le ROE, c'est… | résultat net / capitaux propres | EBIT / actif total | résultat net / chiffre d'affaires | dette nette / EBITDA | Return on Equity : la rentabilité de l'argent des actionnaires.
2 | Corporate | Résultat net 15 M€, capitaux propres 100 M€. ROE ? | 15 % | 1,5 % | 6,7 % | 85 % | 15 / 100 = 15 %.
2 | Corporate | Un rachat d'entreprise financé surtout par la dette, c'est… | un LBO | une OPA | une IPO | un spin-off | Leveraged Buy-Out : la dette est remboursée par les cash flows de la cible.
2 | Macro | Une courbe des taux inversée (courts > longs) annonce souvent… | une récession | une forte croissance | de l'hyperinflation | une hausse des actions | Le marché anticipe des baisses de taux à venir, donc un ralentissement.
2 | Dérivés | Quel produit assure contre le défaut d'un émetteur ? | Le CDS | L'IRS | Le FRA | Le repo | Credit Default Swap : on paie une prime, on est indemnisé en cas de défaut.
2 | Marchés | Quel indice surnomme-t-on « l'indice de la peur » ? | Le VIX | Le MOVE | Le DXY | Le TED | Le VIX : volatilité implicite du S&P 500. Le MOVE fait la même chose pour les taux.
2 | Macro | Taux nominal 6 %, inflation 2,5 %. Taux réel environ ? | 3,5 % | 8,5 % | 2,4 % | 4 % | Relation de Fisher : 6 − 2,5 ≈ 3,5 %.
2 | Taux | Duration modifiée de 5, les taux montent de 1 %. Prix de l'obligation ? | −5 % | +5 % | −1 % | −0,2 % | ΔP/P ≈ −duration × Δtaux = −5 × 1 % = −5 %.
2 | Taux | Plus basse note « Investment Grade » chez S&P ? | BBB− | BB+ | A− | BBB+ | En dessous de BBB−, on passe en High Yield (spéculatif).
2 | Corporate | Rachat d'actions ensuite annulées : le bénéfice par action… | augmente | baisse | ne change pas | est divisé par deux | Même bénéfice, moins d'actions : le BPA monte (effet relutif).
2 | Marchés | USD/JPY passe de 140 à 150. Le yen… | s'est déprécié | s'est apprécié | est resté stable | a été dévalué par la Fed | Il faut plus de yens pour un dollar : le yen vaut moins.
2 | Dérivés | Échanger un taux fixe contre un taux variable, c'est… | un swap de taux | un CDS | un future | un repo | Interest Rate Swap (IRS) : on n'échange que les intérêts, pas le nominal.
2 | Taux | Quel taux au jour le jour a remplacé l'EONIA ? | L'€STR | L'Euribor | Le SOFR | Le SONIA | SOFR : États-Unis. SONIA : Royaume-Uni. L'Euribor existe toujours.
2 | Calcul | Regroupement d'actions de 5 en 1 sur un titre à 2 €. Nouveau cours ? | 10 € | 0,40 € | 2 € | 7 € | 5 anciennes actions pour 1 nouvelle : 5 × 2 € = 10 €.
2 | Marchés | Deux actifs ont une corrélation de −1. Ils évoluent… | en sens parfaitement opposé | de façon indépendante | exactement pareil | l'un deux fois plus vite | −1 : quand l'un monte, l'autre baisse, toujours, dans des proportions fixes.
2 | Marchés | Qui a théorisé la frontière efficiente en 1952 ? | Harry Markowitz | William Sharpe | Eugene Fama | Fischer Black | La théorie moderne du portefeuille, Nobel 1990 avec Sharpe et Miller.
2 | Corporate | PER de 20. Rendement bénéficiaire (BPA / cours) ? | 5 % | 20 % | 2 % | 0,5 % | C'est l'inverse du PER : 1 / 20 = 5 %.
2 | Taux | Zéro-coupon remboursé 110 € dans un an, taux à 10 %. Prix ? | 100 € | 99 € | 110 € | 121 € | 110 / 1,10 = 100 €. Le 99 € retire 10 % au lieu d'actualiser.
2 | Marchés | Le risque qu'un partenaire de gré à gré ne paie pas, c'est… | le risque de contrepartie | le risque de liquidité | le risque opérationnel | le risque de marché | Il a explosé en 2008 avec Lehman ; d'où les chambres de compensation.
2 | Taux | Une obligation cote au-dessus du pair quand… | son coupon dépasse les taux du marché | les taux montent | l'émetteur va faire défaut | c'est un zéro-coupon | Un coupon plus généreux que le marché se paie plus cher que le nominal.
2 | Calcul | Achat à 50 €, revente à 60 € après 2 € de dividende. Rendement total ? | 24 % | 20 % | 4 % | 22 % | (10 + 2) / 50 = 24 %.
2 | Corporate | 100 k€ d'actifs dont 20 k€ de fonds propres. Les actifs gagnent 5 %. Rendement des fonds propres ? | 25 % | 5 % | 20 % | 10 % | Gain de 5 k€ sur 20 k€ de fonds propres : 25 % (hors coût de la dette). C'est l'effet de levier.
2 | Calcul | 10 % d'inflation par an pendant 2 ans. Hausse cumulée des prix ? | 21 % | 20 % | 10 % | 22 % | 1,1 × 1,1 = 1,21.
2 | Calcul | 16 × 15 ? | 240 | 225 | 256 | 230 | 16 × 15 = 8 × 30 = 240.
2 | Calcul | 17 × 13 ? | 221 | 211 | 231 | 225 | (15 + 2)(15 − 2) = 225 − 4 = 221.
2 | Calcul | 16² ? | 256 | 196 | 236 | 266 | 16 × 16 = 256 (et 2⁸).
2 | Calcul | 12,5 % de 400 ? | 50 | 40 | 48 | 125 | 12,5 % = 1/8 : 400 / 8 = 50.
2 | Calcul | Un prix passe de 80 € à 60 €. Baisse en % ? | 25 % | 20 % | 33 % | 30 % | 20 / 80 = 25 %. Le 33 % serait la hausse pour remonter de 60 à 80.
2 | Calcul | Un portefeuille perd 20 % puis gagne 25 %. Bilan ? | 0 % | +5 % | −5 % | +4 % | 0,8 × 1,25 = 1 : retour au point de départ.
2 | Calcul | 3/4 + 5/8 ? | 11/8 | 8/12 | 15/32 | 9/8 | 3/4 = 6/8, et 6/8 + 5/8 = 11/8.
2 | Calcul | 4x − 7 = 21. Combien vaut x ? | 7 | 3,5 | 6 | 8 | 4x = 28, donc x = 7.
2 | Calcul | 25 × 48 ? | 1 200 | 1 000 | 1 250 | 1 150 | ×25, c'est ×100 / 4 : 4 800 / 4 = 1 200.
2 | Calcul | 1,5 × 1,5 ? | 2,25 | 2,5 | 1,75 | 3 | 1,5² = 2,25.
2 | Calcul | 37 × 3 ? | 111 | 101 | 117 | 121 | 37 × 3 = 111 (d'où 37 × 6 = 222, 37 × 9 = 333…).
2 | Calcul | 2¹⁰ ? | 1 024 | 1 000 | 512 | 2 048 | 2¹⁰ = 1 024 : un kilo-octet.
2 | Calcul | 15 % de 360 ? | 54 | 36 | 45 | 60 | 10 % = 36, 5 % = 18 : 54.
2 | Calcul | 7,5 % de 200 ? | 15 | 7,5 | 13,5 | 75 | 1 % = 2, donc 7,5 % = 15.
2 | Calcul | 1/3 + 1/6 ? | 1/2 | 2/9 | 1/9 | 2/3 | 2/6 + 1/6 = 3/6 = 1/2.
2 | Calcul | Somme des entiers de 1 à 50 ? | 1 275 | 1 250 | 2 550 | 1 225 | n(n+1)/2 = 50 × 51 / 2 = 1 275.
2 | Calcul | 80 km/h pendant 45 minutes : distance ? | 60 km | 36 km | 45 km | 64 km | 45 min = 3/4 d'heure : 80 × 0,75 = 60 km.
2 | Calcul | Reste de la division de 85 par 9 ? | 4 | 5 | 9 | 1 | 9 × 9 = 81, reste 4.
2 | Calcul | PGCD de 36 et 48 ? | 12 | 6 | 24 | 4 | 36 = 12 × 3, 48 = 12 × 4.
2 | Calcul | PPCM de 6 et 8 ? | 24 | 48 | 12 | 14 | Le plus petit multiple commun : 24. Le 48 est un multiple commun, mais pas le plus petit.
2 | Calcul | Une pompe remplit un bassin en 3 h, une autre en 6 h. Ensemble ? | 2 h | 4 h 30 | 1 h 30 | 9 h | 1/3 + 1/6 = 1/2 bassin par heure : 2 h. La moyenne (4 h 30) est le piège.
2 | Calcul | 0,2 × 0,05 ? | 0,01 | 0,1 | 0,001 | 0,25 | 2 × 5 = 10, avec trois décimales : 0,010.
2 | Calcul | 96 ÷ 1,2 ? | 80 | 8 | 115,2 | 85 | 960 / 12 = 80.
2 | Calcul | 4 % de 2 500 ? | 100 | 10 | 1 000 | 40 | 1 % = 25, donc 4 % = 100.
2 | Calcul | 999 × 7 ? | 6 993 | 6 999 | 7 993 | 6 973 | 1 000 × 7 − 7 = 6 993.
2 | Probas | Deux dés : probabilité que la somme fasse 7 ? | 1/6 | 1/12 | 7/36 | 1/36 | 6 combinaisons sur 36 : (1,6), (2,5), (3,4) et leurs inverses.
2 | Probas | Deux dés : probabilité de faire un double ? | 1/6 | 1/36 | 1/12 | 1/3 | 6 doubles sur 36 combinaisons.
2 | Probas | Trois lancers de pièce : probabilité de 3 piles ? | 1/8 | 1/6 | 1/3 | 3/8 | (1/2)³ = 1/8.
2 | Probas | Trois lancers de pièce : probabilité d'exactement 2 piles ? | 3/8 | 1/4 | 2/3 | 1/2 | PPF, PFP, FPP : 3 issues sur 8.
2 | Probas | Espérance d'un lancer de dé à 6 faces ? | 3,5 | 3 | 4 | 2,5 | (1 + 2 + … + 6) / 6 = 21 / 6 = 3,5.
2 | Probas | Probabilité de tirer un as dans un jeu de 52 cartes ? | 1/13 | 1/52 | 1/4 | 4/13 | 4 as sur 52 cartes = 1/13.
2 | Logique | Une batte et une balle coûtent 1,10 €. La batte coûte 1 € de plus que la balle. La balle ? | 0,05 € | 0,10 € | 0,01 € | 0,55 € | Balle x, batte x + 1 : 2x + 1 = 1,10, donc x = 0,05 €. Le réflexe « 10 centimes » est faux.
2 | Logique | 5 machines font 5 pièces en 5 min. 100 machines, 100 pièces ? | 5 min | 100 min | 20 min | 1 min | Chaque machine fait une pièce en 5 minutes, quel que soit leur nombre.
2 | Logique | Un nénuphar double chaque jour et couvre le lac en 40 jours. La moitié du lac ? | 39 jours | 20 jours | 30 jours | 38 jours | Il double la dernière nuit : la veille, il couvrait la moitié.
2 | Logique | À 15 h 15, quel angle entre les deux aiguilles ? | 7,5° | 0° | 15° | 2,5° | En 15 min, l'aiguille des heures avance d'un quart de 30°, soit 7,5°.
2 | Logique | Combien de fois écrit-on le chiffre 9 de 1 à 100 ? | 20 | 10 | 19 | 11 | 10 fois aux unités (9, 19… 99) et 10 fois aux dizaines (90 à 99).
2 | Logique | Suite : 1 – 1 – 2 – 3 – 5 – 8 – 13 – ? | 21 | 18 | 20 | 26 | Fibonacci : 8 + 13 = 21.
2 | Logique | Suite : 2 – 6 – 12 – 20 – 30 – ? | 42 | 40 | 36 | 44 | Écarts +4, +6, +8, +10, puis +12. C'est n × (n + 1).
2 | Logique | Suite : 2 – 3 – 5 – 7 – 11 – 13 – ? | 17 | 15 | 19 | 16 | Les nombres premiers.
2 | Logique | Suite : U – D – T – Q – C – S – S – ? | H | N | O | D | Un, Deux, Trois, Quatre, Cinq, Six, Sept… Huit.
2 | Logique | Suite : AZ – BY – CX – DW – ? | EV | EU | FV | DV | Première lettre en avant, seconde en arrière dans l'alphabet.
2 | Logique | Un cube 3×3×3 est peint. Combien de petits cubes sans aucune face peinte ? | 1 | 0 | 8 | 27 | Seul le cube central est caché.
2 | Logique | Un cube 3×3×3 est peint. Combien de petits cubes ont 3 faces peintes ? | 8 | 6 | 12 | 4 | Ce sont les coins : un cube en a 8.
2 | Logique | Une feuille pliée 4 fois en deux est percée d'un trou. Dépliée, combien de trous ? | 16 | 8 | 4 | 32 | Chaque pliage double le nombre d'épaisseurs : 2⁴ = 16.
2 | Logique | Combien de carrés de toutes tailles dans une grille 3×3 ? | 14 | 9 | 13 | 10 | 9 petits + 4 moyens + 1 grand.
2 | Logique | 8 personnes se serrent toutes la main une fois. Combien de poignées ? | 28 | 56 | 64 | 16 | 8 × 7 / 2 = 28 : chaque poignée relie deux personnes.
2 | Logique | 10 chaussettes rouges et 10 bleues dans le noir. Combien en tirer pour une paire assortie ? | 3 | 2 | 11 | 4 | Avec 2 couleurs, la 3e chaussette forme forcément une paire.
2 | Logique | Un escargot dans un puits de 10 m monte de 3 m le jour, glisse de 2 m la nuit. Il sort le… | 8e jour | 10e jour | 7e jour | 5e jour | Après 7 nuits il est à 7 m ; le 8e jour il grimpe à 10 m et sort.
2 | Logique | 9 billes, une plus lourde. Combien de pesées au minimum à la balance ? | 2 | 3 | 1 | 4 | Groupes de 3 contre 3 : on isole le bon groupe, puis la bonne bille.
2 | Logique | Trois médecins disent que Paul est leur frère. Paul n'a pas de frère. Comment ? | Les médecins sont ses sœurs | Paul ment | Les médecins mentent | Ce sont ses demi-frères | Rien n'oblige des médecins à être des hommes.
2 | Marchés | Un ordre stop à 90 € sur une action à 100 € sert à… | limiter une perte | acheter moins cher | encaisser un dividende | bloquer la cotation | Si le cours touche 90 €, l'ordre part au marché : c'est un stop-loss.
2 | Taux | Quelle obligation ne verse aucun coupon ? | Le zéro-coupon | L'obligation perpétuelle | L'OAT indexée | L'obligation convertible | Il s'achète sous le pair et se rembourse au pair : l'intérêt est dans l'écart.
3 | Dérivés | Parité call-put : call 8 €, put 5 €, strike actualisé 97 €. Cours de l'action ? | 100 € | 94 € | 110 € | 92 € | S = C − P + K actualisé = 8 − 5 + 97 = 100 €.
3 | Marchés | Volatilité quotidienne de 1 %, 256 jours de bourse. Volatilité annuelle ? | 16 % | 256 % | 2,56 % | 25,6 % | La volatilité croît en racine du temps : 1 % × √256 = 16 %.
3 | Marchés | Volatilité annuelle de 32 % (256 jours). Volatilité quotidienne ? | 2 % | 0,125 % | 1,6 % | 8 % | 32 % / √256 = 32 / 16 = 2 %.
3 | Corporate | Bêta endetté 1,5, dette/fonds propres = 1, IS 20 %. Bêta désendetté ? | 0,83 | 0,75 | 0,94 | 1,20 | Hamada : 1,5 / (1 + 0,8 × 1) = 1,5 / 1,8 ≈ 0,83. Le 0,75 oublie l'impôt.
3 | Taux | Rente perpétuelle de 60 € par an, taux de 5 %. Valeur ? | 1 200 € | 3 000 € | 1 260 € | 300 € | Perpétuité : flux / taux = 60 / 0,05 = 1 200 €.
3 | Corporate | Gordon-Shapiro : dividende 4 € l'an prochain, croissance 2 %, coût du capital 10 %. Valeur ? | 50 € | 40 € | 33,33 € | 51 € | 4 / (0,10 − 0,02) = 50 €. Le 33,33 € additionne g au lieu de le soustraire.
3 | Corporate | 40 % de dette à 5 % après impôt, 60 % de fonds propres à 10 %. WACC ? | 8 % | 7,5 % | 7 % | 9 % | 0,4 × 5 % + 0,6 × 10 % = 2 % + 6 % = 8 %.
3 | Dérivés | Quelle grecque mesure la sensibilité du delta au sous-jacent ? | Gamma | Vanna | Vomma | Charm | Gamma = dérivée seconde du prix par rapport au sous-jacent.
3 | Dérivés | Où le gamma d'une option vanille est-il maximal ? | À la monnaie, près de l'échéance | Très dans la monnaie | Très hors de la monnaie | À la monnaie, échéance lointaine | Près de l'échéance, le delta bascule brutalement de 0 à 1 autour du strike.
3 | Dérivés | Un trader delta neutre et long gamma espère… | de grands mouvements | un marché plat | une baisse lente | une hausse régulière | Long gamma : il gagne sur les mouvements forts, dans les deux sens, et paie du thêta en attendant.
3 | Dérivés | Dans Black-Scholes, N(d₂) pour un call représente… | la probabilité risque-neutre d'exercice | le delta du call | la volatilité implicite | le facteur d'actualisation | Le delta, c'est N(d₁). N(d₂) est la probabilité (risque-neutre) de finir dans la monnaie.
3 | Taux | Duration modifiée 6, convexité 50, taux +200 bp. Variation du prix ? | −11 % | −12 % | −13 % | −10 % | −6 × 2 % + ½ × 50 × (2 %)² = −12 % + 1 % = −11 %.
3 | Taux | Taux à 1 an 4 %, taux à 2 ans 5 %. Taux forward 1 an dans 1 an, environ ? | 6 % | 4,5 % | 5 % | 9 % | (1,05)² / 1,04 − 1 ≈ 6 % : 2 × 5 % − 4 %.
3 | Corporate | Les amortissements augmentent de 20 M€, IS à 25 %. Effet sur le free cash flow ? | +5 M€ | +20 M€ | −15 M€ | Aucun | L'amortissement ne sort pas de cash mais réduit l'impôt : 20 × 25 % = 5 M€ d'économie.
3 | Corporate | Un acquéreur au PER 15 rachète en actions une cible au PER 20. Pour ses actionnaires, c'est… | dilutif | relutif | neutre | impossible à dire | Il paie avec un titre qui rapporte 1/15 ≈ 6,7 % pour acheter un bénéfice qui rapporte 1/20 = 5 %.
3 | Corporate | Rachat d'une cible au PER 20, financé par dette à 5 %, IS 20 %. L'opération est… | relutive | dilutive | neutre | impossible à dire | Dette après impôt : 4 %. Rendement de la cible : 1/20 = 5 % > 4 %.
3 | Dérivés | La volatilité implicite qui varie selon le strike forme… | le smile de volatilité | la structure par terme | le cône de volatilité | la courbe des taux | Smile (ou skew) : les puts hors de la monnaie cotent souvent une vol plus élevée.
3 | Dérivés | Quelle équation de physique se cache derrière Black-Scholes ? | L'équation de la chaleur | Navier-Stokes | Schrödinger | L'équation des ondes | Par changement de variables, l'EDP de Black-Scholes devient l'équation de diffusion de la chaleur.
3 | Dérivés | Quel résultat permet de différencier une fonction d'un mouvement brownien ? | Le lemme d'Itô | Le lemme de Fatou | Le théorème de Girsanov | Le lemme de Borel-Cantelli | Itô ajoute un terme en ½ f'' σ² absent du calcul classique. Girsanov sert à changer de probabilité.
3 | Marchés | Deux actifs de volatilité 20 %, corrélation 0, portefeuille 50/50. Volatilité ? | 14,1 % | 10 % | 20 % | 7,1 % | √(0,5² × 20² + 0,5² × 20²) = 20 / √2 ≈ 14,1 %. La diversification n'est pas linéaire.
3 | Marchés | Une VaR 1 jour à 99 % de 5 M€ signifie… | 1 % de chances de perdre plus de 5 M€ en un jour | une perte maximale de 5 M€ | 99 % de chances de perdre 5 M€ | une perte moyenne de 5 M€ | La VaR ne dit rien de l'ampleur des pertes au-delà du seuil.
3 | Marchés | Quelle mesure donne la perte moyenne au-delà de la VaR ? | L'expected shortfall | Le max drawdown | La VaR stressée | La tracking error | Aussi appelée CVaR ; Bâle l'a substituée à la VaR pour le portefeuille de négociation.
3 | Dérivés | Achat call K1, vente de 2 calls K2, achat call K3 (écarts égaux) ? | Un butterfly | Un condor | Un strangle | Un ratio spread | Gain maximal si le sous-jacent finit pile sur K2. Le condor utilise 4 strikes.
3 | Dérivés | Achat call 100 à 6 €, vente call 110 à 2 €. Gain maximal à l'échéance ? | 6 € | 10 € | 4 € | 14 € | Écart de strikes 10 € moins le coût net de 4 € = 6 €.
3 | Dérivés | Une barrière qui active l'option si le cours passe sous un seuil ? | Down-and-in | Down-and-out | Up-and-in | Up-and-out | « Down » : seuil sous le cours. « In » : l'option naît en touchant la barrière.
3 | Dérivés | Option dont le paiement dépend du prix moyen du sous-jacent ? | Asiatique | Bermudienne | Lookback | Barrière | La lookback dépend du plus haut ou du plus bas ; la bermudienne s'exerce à quelques dates.
3 | Corporate | Quel théorème (1958) dit que la structure de financement n'influe pas sur la valeur, sans impôts ? | Modigliani-Miller | Black-Scholes | Coase | Arrow-Debreu | Dans un marché parfait, dette ou fonds propres : la valeur de l'entreprise ne change pas.
3 | Corporate | DuPont : ROE = marge nette × rotation des actifs × … ? | Levier financier | Coût de la dette | Rotation des stocks | Taux d'IS | Levier = actif total / capitaux propres.
3 | Corporate | Une banque a un levier de 20 (actifs / fonds propres). Quelle baisse des actifs efface ses fonds propres ? | 5 % | 20 % | 2 % | 10 % | Fonds propres = 1/20 des actifs : −5 % suffit.
3 | Dérivés | Forward 1 an sur une action à 100 €, sans dividende, taux 5 % annuel ? | 105 € | 100 € | 95,24 € | 110,25 € | Par absence d'arbitrage : 100 × 1,05 = 105 €. Le 95,24 € actualise au lieu de capitaliser.
3 | Marchés | Spot du pétrole au-dessus des contrats futures lointains : la courbe est en… | backwardation | contango | courbe plate | roll-down | Déport : on paie plus cher le baril tout de suite, signe de tension sur l'offre.
3 | Taux | CDS à 200 bp, taux de recouvrement 60 %. Probabilité annuelle de défaut implicite ? | 5 % | 2 % | 3,33 % | 1,2 % | Spread ≈ PD × (1 − R) : 2 % / 0,4 = 5 %. Le 3,33 % divise par R au lieu de 1 − R.
3 | Corporate | En LBO, la dette subordonnée entre la dette senior et les fonds propres s'appelle… | la mezzanine | le revolving | le term loan B | l'unitranche | Mieux payée que la senior, souvent avec des BSA pour toucher une part de la plus-value.
3 | Corporate | EBIT 50, D&A 10, capex 15, hausse du BFR 5, IS 20 % (M€). FCFF ? | 30 M€ | 40 M€ | 35 M€ | 20 M€ | EBIT × (1 − t) + D&A − capex − ΔBFR = 40 + 10 − 15 − 5 = 30 M€.
3 | Probas | Une martingale est un processus dont… | l'espérance future égale la valeur présente | la variance est constante | les trajectoires sont dérivables | la limite est nulle | E[X(t+1) sachant le présent] = X(t) : un jeu équitable. Sous la probabilité risque-neutre, les prix actualisés en sont.
3 | Marchés | EUR/USD 1,1000, taux à 1 an US 5 %, euro 3 %. Forward EUR/USD à 1 an ? | 1,1214 | 1,0790 | 1,1000 | 1,1550 | Parité des taux : 1,10 × 1,05 / 1,03 ≈ 1,1214. La devise au taux le plus bas cote en report.
3 | Corporate | Prix payé moins juste valeur des actifs nets acquis ? | Le goodwill | Le badwill | La prime de contrôle | L'écart de conversion | Le badwill est l'inverse : prix payé inférieur à l'actif net.
3 | Taux | Obligation perpétuelle de 50 €/an. Les taux passent de 5 % à 4 %. Gain en capital ? | +250 € | +200 € | +50 € | +125 € | 50 / 0,05 = 1 000 € → 50 / 0,04 = 1 250 €.
3 | Dérivés | Le rhô d'une option mesure sa sensibilité… | aux taux d'intérêt | aux dividendes | à la volatilité | au temps | Le rhô est souvent la grecque la plus petite sur des options courtes.
3 | Dérivés | Payoff d'un call digital cash-or-nothing si le cours finit au-dessus du strike ? | Un montant fixe | Cours − strike | Le cours | Le strike | Tout ou rien : on touche un montant fixé d'avance, peu importe l'écart.
3 | Dérivés | Gamma d'un portefeuille composé uniquement d'actions et de futures ? | Nul | Positif | Négatif | Égal à 1 | Produits linéaires : delta constant, donc gamma nul.
3 | Marchés | Fonds « 2 and 20 » : +22 % brut sur l'année. Rendement net pour le client ? | 16 % | 20 % | 17,6 % | 18 % | 22 − 2 de frais fixes = 20 %, puis 20 % de commission sur 20 % = 4 % : reste 16 %.
3 | Marchés | Clause qui interdit la commission de performance tant que les pertes passées ne sont pas effacées ? | Le high-water mark | Le hurdle rate | Le clawback | Le lock-up | Le hurdle rate est un rendement minimal ; le lock-up bloque les retraits.
3 | Macro | Taux de réserves obligatoires de 5 %. Multiplicateur monétaire théorique ? | 20 | 5 | 95 | 1,05 | 1 / 0,05 = 20 (sans fuite en billets).
3 | Corporate | Dans Bâle III, CET1 signifie… | Common Equity Tier 1 | Core Exposure Tier 1 | Capital Equity Total 1 | Credit Exposure Tier 1 | Les fonds propres durs : capital et réserves, le cœur de la solvabilité bancaire.
3 | Marchés | Covariance titre-marché 0,06, variance du marché 0,04. Bêta ? | 1,5 | 0,67 | 0,024 | 2,4 | Bêta = cov / var = 0,06 / 0,04 = 1,5.
3 | Taux | Duration de Macaulay d'un zéro-coupon à 8 ans ? | 8 ans | 4 ans | 7,4 ans | 8,5 ans | Un seul flux à 8 ans. Le 7,4 ans est sa duration modifiée à 8 % (8 / 1,08).
3 | Marchés | Vente à découvert de 100 actions à 50 €, marge exigée 50 %. Collatéral ? | 2 500 € | 5 000 € | 7 500 € | 50 € | 50 % de 5 000 € = 2 500 €.
3 | Probas | Monty Hall : 3 portes, l'animateur ouvre une porte perdante. En changeant, vous gagnez avec probabilité… | 2/3 | 1/2 | 1/3 | 3/4 | Votre premier choix a 1/3 ; les 2/3 restants se concentrent sur l'autre porte fermée.
3 | Probas | Deux dés. Sachant qu'au moins un dé montre 6, probabilité du double 6 ? | 1/11 | 1/6 | 1/36 | 1/12 | 11 combinaisons contiennent un 6, une seule est 6-6.
3 | Probas | À partir de combien de personnes a-t-on plus d'une chance sur deux d'avoir deux anniversaires communs ? | 23 | 183 | 366 | 57 | Paradoxe des anniversaires. À 57 personnes, on dépasse 99 %.
3 | Probas | Deux enfants, au moins un garçon. Probabilité qu'il y ait deux garçons ? | 1/3 | 1/2 | 1/4 | 2/3 | Restent GG, GF, FG, équiprobables : 1 cas sur 3.
3 | Probas | En moyenne, combien de lancers de pièce pour obtenir le premier pile ? | 2 | 1 | 1,5 | 4 | Loi géométrique : espérance 1 / p = 2.
3 | Probas | En moyenne, combien de lancers pour obtenir deux piles d'affilée ? | 6 | 4 | 3 | 8 | E = 1/p + 1/p² = 2 + 4 = 6.
3 | Probas | Urne : 4 rouges, 3 bleues. Deux tirages sans remise. Même couleur ? | 3/7 | 4/7 | 25/49 | 1/2 | (4×3 + 3×2) / (7×6) = 18/42 = 3/7. Le 25/49 serait avec remise.
3 | Probas | On casse un bâton au hasard en deux endroits. Probabilité de former un triangle ? | 1/4 | 1/2 | 1/3 | 1/8 | Aucun morceau ne doit dépasser la moitié : un quart de l'espace des cassures.
3 | Probas | Trois fourmis aux sommets d'un triangle partent chacune sur une arête au hasard. Aucune collision ? | 1/4 | 1/8 | 1/2 | 3/4 | Il faut qu'elles tournent toutes dans le même sens : 2 cas sur 8.
3 | Probas | A et B lancent une pièce à tour de rôle, A commence. Le premier pile gagne. Chances de A ? | 2/3 | 1/2 | 3/4 | 3/5 | p = 1/2 + 1/4 × p, donc p = 2/3.
3 | Probas | X et Y uniformes indépendants sur [0, 1]. Probabilité que X + Y ≤ 1 ? | 1/2 | 1/4 | 1/3 | 2/3 | La moitié du carré unité, sous la diagonale.
3 | Probas | Un dé, avec droit à une seule relance. Espérance en jouant au mieux ? | 4,25 | 3,5 | 4,5 | 4 | On relance sur 1, 2, 3 : ½ × 5 + ½ × 3,5 = 4,25.
3 | Probas | Probabilité que la dernière carte d'un jeu de 52 bien mélangé soit un as ? | 1/13 | 1/52 | 4/13 | 1/4 | Par symétrie, chaque position a 4/52 = 1/13 de chances d'être un as.
3 | Probas | Maladie touchant 1 % des gens, test fiable à 99 %. Positif : probabilité d'être malade ? | 50 % | 99 % | 1 % | 90 % | Sur 10 000 : 99 vrais positifs et 99 faux positifs. Bayes donne 50 %.
3 | Probas | Une pièce équilibrée tombe 10 fois sur face. Probabilité de face au 11e lancer ? | 1/2 | 1/1 024 | 1/2 048 | 10/11 | La pièce n'a pas de mémoire : sophisme du joueur.
3 | Probas | Espérance du plus grand de deux dés ? | ≈ 4,47 | 3,5 | 5 | ≈ 4,17 | P(max = k) = (2k − 1)/36 : espérance 161/36 ≈ 4,47.
3 | Probas | Probabilité d'au moins un 6 en 4 lancers de dé ? | ≈ 52 % | ≈ 67 % | ≈ 48 % | ≈ 40 % | 1 − (5/6)⁴ ≈ 0,52. Le 67 % (4 × 1/6) est l'erreur du chevalier de Méré.
3 | Calcul | Aller à 60 km/h, retour à 40 km/h. Vitesse moyenne ? | 48 km/h | 50 km/h | 45 km/h | 52 km/h | Moyenne harmonique : 2 × 60 × 40 / 100 = 48. Le retour, plus lent, dure plus longtemps.
3 | Calcul | Combien de zéros à la fin de 100 ! (factorielle) ? | 24 | 20 | 11 | 25 | On compte les facteurs 5 : 100/5 + 100/25 = 20 + 4.
3 | Calcul | 99² ? | 9 801 | 9 891 | 9 701 | 9 999 | (100 − 1)² = 10 000 − 200 + 1.
3 | Calcul | 48 × 52 ? | 2 496 | 2 500 | 2 504 | 2 484 | (50 − 2)(50 + 2) = 2 500 − 4.
3 | Calcul | 1 + 1/2 + 1/4 + 1/8 + … ? | 2 | 1,5 | 3 | L'infini | Série géométrique : 1 / (1 − ½) = 2.
3 | Calcul | Chiffre des unités de 7¹⁰⁰ ? | 1 | 7 | 9 | 3 | Cycle 7, 9, 3, 1 de période 4 ; 100 est multiple de 4.
3 | Logique | Un cube 4×4×4 est peint. Combien de petits cubes sans face peinte ? | 8 | 4 | 16 | 27 | Le cœur 2×2×2.
3 | Logique | Un cube 10×10×10 est peint. Combien de petits cubes ont au moins une face peinte ? | 488 | 600 | 512 | 384 | 1 000 − 8³ = 1 000 − 512 = 488.
3 | Logique | Combien de carrés de toutes tailles sur un échiquier 8×8 ? | 204 | 64 | 196 | 120 | 1² + 2² + … + 8² = 204.
3 | Calcul | log₁₀(2) ≈ 0,301. Combien de chiffres a 2¹⁰⁰ ? | 31 | 30 | 100 | 32 | 100 × 0,301 = 30,1 : partie entière + 1 = 31 chiffres.
3 | Calcul | Combien de diagonales a un décagone ? | 35 | 45 | 70 | 20 | n(n − 3)/2 = 10 × 7 / 2 = 35. Le 45 compte aussi les côtés.
3 | Logique | 100 ampoules éteintes. Au passage n, on bascule les multiples de n (n = 1 à 100). Combien restent allumées ? | 10 | 50 | 0 | 25 | Seuls les carrés parfaits ont un nombre impair de diviseurs : 1, 4, 9… 100.
3 | Calcul | Dérivée de f(x) = x·ln(x) − x ? | ln(x) | ln(x) − 1 | 1/x | x·ln(x) | (x ln x)' = ln x + 1, moins 1 : ln x.
3 | Calcul | Intégrale de 2x entre 0 et 5 ? | 25 | 10 | 50 | 5 | [x²] de 0 à 5 = 25.
3 | Calcul | 2^(2x) = 64. Combien vaut x ? | 3 | 6 | 8 | 4 | 64 = 2⁶ donc 2x = 6.
3 | Logique | Combien de fois par jour les aiguilles des heures et des minutes se superposent-elles ? | 22 | 24 | 23 | 12 | 11 fois toutes les 12 heures : entre 11 h et 13 h, elles ne se croisent qu'à midi.
3 | Calcul | Trois robinets remplissent une piscine en 2 h, 3 h et 6 h. Ensemble ? | 1 h | 3 h 40 | 30 min | 11 h | 1/2 + 1/3 + 1/6 = 1 piscine par heure.
3 | Calcul | Achat 70 €, vente 80 €, rachat 90 €, revente 100 €. Bénéfice ? | 20 € | 10 € | 0 € | 30 € | −70 + 80 − 90 + 100 = +20 €.
3 | Logique | Un train de 1 km roule à 60 km/h dans un tunnel de 1 km. De l'entrée de la loco à la sortie du dernier wagon ? | 2 min | 1 min | 30 s | 3 min | Il parcourt 2 km à 1 km par minute.
3 | Logique | Un nénuphar triple chaque jour et couvre un lac en 27 jours. Avec 3 nénuphars ? | 26 jours | 9 jours | 24 jours | 25 jours | Trois nénuphars, c'est un nénuphar avec un jour d'avance.
3 | Attention | 50e chiffre de la suite 123456789101112131415… ? | 3 | 0 | 2 | 9 | 9 chiffres pour 1 à 9, puis 40 pour 10 à 29 : le 50e est le premier chiffre de 30.
3 | Calcul | 1,07¹⁰, environ ? | 1,97 | 1,70 | 2,14 | 1,61 | Règle de 72 : à 7 %, on double en un peu plus de 10 ans. Le 1,70 oublie la capitalisation.
3 | Calcul | +5 % par an pendant 3 ans. Hausse cumulée ? | 15,76 % | 15 % | 16,25 % | 15,25 % | 1,05³ = 1,157625.
3 | Calcul | 625 × 16 ? | 10 000 | 9 600 | 10 250 | 1 000 | 625 × 16 = 625 × 2⁴ = 1 250 × 8 = 10 000.
3 | Calcul | 100e chiffre après la virgule de 1/7 = 0,142857142857… ? | 8 | 5 | 2 | 7 | Période de 6 chiffres ; 100 = 6 × 16 + 4 : 4e chiffre du cycle 142857.
3 | Calcul | Somme des angles intérieurs d'un hexagone ? | 720° | 360° | 1 080° | 540° | (n − 2) × 180° = 4 × 180° = 720°.
3 | Calcul | 1 + 2 + … + 100 ? | 5 050 | 5 000 | 10 100 | 4 950 | Gauss : 100 × 101 / 2 = 5 050.
3 | Calcul | log₂(1 024) ? | 10 | 9 | 512 | 12 | 2¹⁰ = 1 024.
3 | Calcul | 1 000 € à 10 % composés pendant 3 ans ? | 1 331 € | 1 300 € | 1 310 € | 1 333 € | 1 000 × 1,1³ = 1 331 €. Le 1 300 € serait en intérêts simples.
3 | Logique | Deux mèches brûlent en 1 h chacune, irrégulièrement. Comment mesurer 45 min ? | A par les 2 bouts et B par 1 ; quand A s'éteint, B par l'autre bout | A par 1 bout ; quand A s'éteint, B par les 2 bouts | A et B par les 2 bouts ; on attend la fin des deux | A et B par 1 bout ; quand A s'éteint, on souffle B | A brûle en 30 min ; il reste 30 min à B, qui brûle alors par les deux bouts : 15 min.
3 | Logique | 25 chevaux, courses de 5, pas de chrono. Minimum de courses pour le top 3 ? | 7 | 6 | 8 | 11 | 5 séries, la course des 5 vainqueurs, puis une course finale entre les 5 candidats restants aux places 2 et 3.
3 | Logique | Suite : 1 – 11 – 21 – 1211 – 111221 – ? | 312211 | 1112221 | 311221 | 13112221 | On lit le terme précédent : trois 1, deux 2, un 1.
3 | Logique | Suite : 2 – 12 – 36 – 80 – 150 – ? | 252 | 210 | 240 | 225 | n² + n³ : pour n = 6, 36 + 216 = 252.
3 | Logique | Suite : O – T – T – F – F – S – S – E – ? | N | T | E | D | One, Two, Three… Eight, Nine.
3 | Logique | 10 sacs de pièces de 10 g, un sac de fausses de 9 g. Balance précise : combien de pesées ? | 1 | 2 | 3 | 4 | On pèse 1 pièce du sac 1, 2 du sac 2… 10 du sac 10 : il manque autant de grammes que le numéro du faux sac.
3 | Logique | 5 pirates logiques partagent 100 pièces ; le chef doit obtenir au moins la moitié des voix. Il garde… | 98 | 50 | 97 | 20 | Il achète les deux voix les moins chères avec 1 pièce chacune : 98-0-1-0-1.
3 | Logique | Du pôle Sud, on marche 1 km au nord, 1 km à l'est, 1 km au sud. Distance au départ ? | 0 km | 1 km | 2 km | 1,4 km | Le km vers l'est suit un cercle autour du pôle ; le km au sud ramène au pôle.
3 | Logique | Deux pères et deux fils pêchent chacun un poisson, mais il n'y a que 3 poissons. Pourquoi ? | Ils ne sont que trois | Un poisson s'est échappé | Un père n'a rien pêché | Ils ont partagé un poisson | Le grand-père, le père et le fils : deux pères, deux fils.
3 | Logique | 13 caméléons rouges, 15 verts, 17 bleus. Deux de couleurs différentes qui se croisent prennent la 3e. Tous de la même couleur un jour ? | Non, jamais | Oui, tous bleus | Oui, tous verts | Oui, tous rouges | Les écarts entre couleurs restent constants modulo 3 (2, 2 et 1) : jamais deux populations à égalité, donc jamais de fusion.
3 | Logique | 3 chats attrapent 3 souris en 3 minutes. Combien de chats pour 100 souris en 100 minutes ? | 3 | 100 | 33 | 9 | Chaque chat attrape une souris toutes les 3 minutes : 3 chats en prennent 100 en 100 minutes.
3 | Marchés | Un market maker cote 99/101 et achète au bid. Le prix juste est 100. Gain attendu par titre ? | 1 € | 2 € | 0,50 € | 0 € | Il achète 1 € sous le prix juste : c'est la moitié du spread.
3 | Probas | Jeu : on lance un dé et vous touchez le carré du résultat en euros. Prix juste ? | 15,17 € | 12,25 € | 18 € | 21 € | E[X²] = (1 + 4 + 9 + 16 + 25 + 36) / 6 = 91/6 ≈ 15,17 €. Le 12,25 € est (E[X])².
3 | Probas | Variance d'un lancer de dé à 6 faces ? | ≈ 2,92 | 3,5 | ≈ 1,71 | 6 | E[X²] − E[X]² = 91/6 − 12,25 ≈ 2,92. L'écart-type vaut ≈ 1,71.
`;

// Questions posées aux candidats de l'émission (les relances « et pourquoi ? » sont fusionnées dans la question
// ou dans le décryptage ; l'actualité, vite périmée, est écartée), et des variantes du même esprit.
const RAW_ENTRETIENS = `
# ---- Premier tour
1 | Taux | Qu'est-ce qu'une obligation zéro coupon ? | Une obligation sans coupon, émise sous le pair et remboursée au nominal | !Une obligation dont le taux d'intérêt est nul | Une obligation remboursée en plusieurs fois | Une obligation dont les coupons sont réinvestis | Elle ne verse rien avant l'échéance : tout le rendement vient de l'écart entre le prix payé et le nominal remboursé.
1 | Taux | Qu'est-ce qu'un CDS (credit default swap) ? | Une assurance contre le défaut d'un émetteur | !Un swap qui échange deux devises | Un dépôt bancaire garanti par l'État | Une obligation convertible en actions | L'acheteur paie une prime régulière ; en cas de défaut de l'émetteur, le vendeur lui rembourse la perte.
1 | Marchés | Que mesure la NAV (net asset value) d'un fonds ? | La valeur de ses actifs moins ses dettes, par part | !Le volume échangé chaque jour sur le fonds | La performance depuis son lancement | Ses frais de gestion annuels | NAV = (actifs − passifs) / nombre de parts : c'est le prix auquel on souscrit ou rachète une part.
1 | Dérivés | Payoff d'un call de strike K à l'échéance ? | max(S − K, 0) | !S − K | max(K − S, 0) | min(S − K, 0) | Le call ne s'exerce que si S > K, sinon il expire sans valeur, d'où le max avec 0. S − K, c'est le payoff d'un forward.
1 | Dérivés | Qu'est-ce qu'un straddle ? | L'achat d'un call et d'un put de même strike et même échéance | !L'achat d'un call et la vente d'un put de même strike | L'achat de deux calls de strikes différents | Un call dont le strike se réajuste chaque mois | On parie sur l'ampleur du mouvement, pas sur sa direction. Call acheté + put vendu, c'est un forward synthétique.
1 | Dérivés | Qu'est-ce qu'un bear spread en puts ? | Acheter un put et vendre un put de strike plus bas | !Acheter un put et acheter un call | Vendre un put et acheter un put de strike plus bas | Vendre deux puts de même strike | On parie sur une baisse modérée : le put vendu finance une partie du put acheté, mais plafonne le gain.
1 | Dérivés | Delta d'un call à la monnaie ? | Environ 0,5 | !1 | 0 | Environ 0,25 | À la monnaie, il y a à peu près une chance sur deux de finir dans la monnaie : le delta vaut environ 0,5 (un peu plus avec les taux).
1 | Dérivés | Qu'est-ce qu'un contrat forward ? | Un engagement ferme d'acheter ou de vendre à une date et un prix fixés | !Le droit, sans obligation, d'acheter à un prix fixé | Un contrat coté en bourse avec appels de marge quotidiens | Un prêt de titres contre espèces | Contrairement à une option, les deux parties sont engagées. Le future en est la version standardisée et cotée.
1 | Taux | Différence entre une obligation high yield et investment grade ? | La note : le high yield est noté sous BBB− | !La maturité : le high yield dure plus de 10 ans | La devise : le high yield est en dollars | Le coupon : le high yield est à taux variable | Investment grade : de AAA à BBB−. En dessous, c'est le haut rendement, plus risqué donc mieux rémunéré.
1 | Risque | Que mesure la Value at Risk (VaR) ? | La perte qu'on ne dépassera pas avec une probabilité donnée, sur un horizon donné | !La perte maximale possible du portefeuille | La perte moyenne observée sur un an | Le capital minimum exigé par le régulateur | VaR 99 % à 1 jour de 10 M€ : 99 jours sur 100, on perd moins de 10 M€. Elle ne dit rien de l'ampleur des pertes au-delà.
1 | Probas | Différence entre variance et volatilité ? | La volatilité est la racine carrée de la variance | !La variance est la racine carrée de la volatilité | C'est la même chose | La volatilité est la variance divisée par la moyenne | La volatilité est l'écart-type des rendements, dans la même unité qu'eux ; la variance est son carré.
1 | Dérivés | À quoi sert l'équation de Black-Scholes ? | À donner le prix théorique d'une option européenne | !À prévoir le cours futur d'une action | À calculer le rendement d'une obligation | À mesurer le risque de défaut d'une entreprise | Elle valorise l'option par réplication (couverture en delta), avec volatilité constante, marché sans friction et rendements log-normaux.
1 | Marchés | Différence entre une stratégie momentum et mean reversion ? | Momentum suit la tendance ; mean reversion parie sur le retour à la moyenne | !Momentum achète ce qui baisse ; mean reversion achète ce qui monte | Les deux suivent la tendance, sur des horizons différents | Momentum pour les obligations, mean reversion pour les actions | Momentum : ce qui monte continue de monter. Mean reversion : un écart extrême finit par se résorber.
1 | Taux | Qu'est-ce qu'un taux forward ? | Le taux, fixé aujourd'hui, d'un prêt qui démarrera dans le futur | !Le taux d'intérêt actuel à très court terme | Le taux prévu par les économistes | Le taux d'un prêt remboursable par anticipation | Il se déduit des taux comptant : prêter 2 ans doit rapporter autant que prêter 1 an, puis 1 an au taux forward.
1 | Calcul | Développement limité de 1/(1 + x) à l'ordre 1 ? | 1 − x | !1 + x | 1 − x² | x − 1 | 1/(1 + x) = 1 − x + x² − … Très utile pour actualiser de tête : 1/1,03 ≈ 0,97.
1 | Dérivés | Qu'est-ce qu'une option asiatique ? | Une option dont le payoff dépend de la moyenne du sous-jacent | !Une option qui ne s'exerce qu'à Tokyo ou Hong Kong | Une option exerçable à tout moment | Une option sur une devise asiatique | La moyenne lisse les mouvements : moins de volatilité effective, donc une prime plus faible qu'une option classique.
1 | Dérivés | Qu'est-ce qu'un call up-and-out ? | Un call qui disparaît si le sous-jacent touche une barrière au-dessus | !Un call qui s'active si le sous-jacent monte jusqu'à une barrière | Un call dont le strike monte avec le marché | Un call qu'on peut revendre avant l'échéance | « Out » : l'option meurt à la barrière. Elle coûte moins cher qu'un call classique puisque les plus gros gains sont coupés.
1 | Dérivés | Qu'est-ce qu'un butterfly en calls ? | Acheter un call K1, vendre deux calls K2, acheter un call K3 | !Acheter deux calls K2, vendre un call K1 et un call K3 | Acheter un call et un put de même strike | Acheter un call K1 et vendre un call K2 | Le gain est maximal si le sous-jacent finit pile au strike central : on parie sur le calme.
1 | Corporate | Au dîner de famille, ton oncle dit que les traders « détruisent l'économie ». Ta meilleure réponse ? | Les marchés apportent la liquidité et transfèrent les risques vers ceux qui peuvent les porter | !Les traders ne servent à rien, mais ça paie bien | Les marchés fixent les salaires de l'économie réelle | Les traders décident des taux d'intérêt | Une entreprise peut se financer, couvrir son risque de change ou de matières premières parce que quelqu'un accepte de prendre l'autre côté.
1 | Corporate | Une OPA est annoncée demain et tu as l'information avant tout le monde. Que fais-tu ? | Rien : trader dessus est un délit d'initié | !J'achète des calls courts pour maximiser le levier | J'achète l'action discrètement | Je vends des puts | Utiliser une information privilégiée est un abus de marché, sanctionné par l'AMF et au pénal. La seule bonne stratégie : ne rien faire.
1 | Macro | Trois indicateurs que regarde en priorité un banquier central ? | Inflation, emploi, croissance | !Cours de bourse, prix de l'or, Bitcoin | Déficit public, dette, notation | Balance commerciale, tourisme, immobilier | La Fed a un double mandat : stabilité des prix et plein emploi. La croissance (PIB) éclaire les deux.
1 | Macro | L'indice d'inflation préféré de la Fed ? | Le PCE (dépenses de consommation des ménages) | !Le PIB | Le taux de chômage | L'indice des prix à la production chinois | La Fed cible 2 % d'inflation PCE ; le CPI, plus connu du grand public, est très suivi aussi.
1 | Macro | Les trois plus gros PIB de l'Union européenne ? | Allemagne, France, Italie | !Allemagne, France, Royaume-Uni | France, Espagne, Italie | Allemagne, Pays-Bas, France | Le Royaume-Uni a quitté l'UE en 2020. Derrière le trio : l'Espagne, puis les Pays-Bas.
1 | Calcul | Formule de la somme 1 + 2 + … + n ? | n(n + 1)/2 | !n²/2 | n(n − 1)/2 | (n + 1)²/2 | Gauss : on associe 1 et n, 2 et n − 1… soit n/2 paires qui valent chacune n + 1.
1 | Dérivés | Même strike : une option longue est-elle plus chère qu'une option courte ? | Oui : plus de temps, plus de valeur temps | !Non, elle est moins chère car plus lointaine | C'est le même prix | Ça ne dépend que des taux | Plus d'échéance, c'est plus de chances que le sous-jacent aille loin : la valeur temps augmente avec la maturité.
1 | Marchés | Que signifie « être long » sur un actif ? | Le détenir : on gagne s'il monte | !L'avoir vendu à découvert | L'avoir gardé longtemps | L'avoir acheté à crédit | Long : exposé à la hausse. Short : exposé à la baisse.
1 | Corporate | Une entreprise rachète ses propres actions. Son bénéfice par action… | augmente | !baisse | ne change pas | devient nul | Même bénéfice, moins d'actions : le BPA monte mécaniquement.
1 | Probas | Une pièce équilibrée vient de sortir 10 fois face. Probabilité que le 11e lancer soit face ? | 1/2 | !Presque nulle | 1/2¹¹ | 10/11 | Les lancers sont indépendants : la pièce n'a pas de mémoire (c'est l'erreur du joueur).
# ---- Desk
2 | Dérivés | Pour un call de maturité courte, où le gamma est-il le plus fort ? | À la monnaie | !Très dans la monnaie | Très en dehors de la monnaie | Il est le même partout | Près du strike, le delta bascule le plus vite de 0 à 1 : c'est là que la convexité (gamma) est maximale, et d'autant plus que l'échéance approche.
2 | Dérivés | Forme du vega d'un call en fonction du spot ? | Une cloche, maximale autour de la monnaie | !Croissante : plus le call est dans la monnaie, plus le vega est fort | Décroissante avec le spot | Constante | Loin du strike, l'option est presque certaine ou presque nulle : la volatilité n'y change rien. Le vega culmine autour de la monnaie.
2 | Dérivés | Même strike, même échéance : qui a le plus de vega, le call ou le put ? | Aucun : ils sont égaux | !Le put | Le call | Ça dépend du spot | Parité : C − P = S − K·e^(−rT). La différence ne dépend pas de la volatilité, donc les deux vegas sont égaux.
2 | Marchés | À quelle altitude orbite un satellite géostationnaire ? | Environ 36 000 km | !Environ 400 km | Environ 3 600 km | Environ 384 000 km | ≈ 35 786 km au-dessus de l'équateur : il fait le tour de la Terre en 24 h. 400 km, c'est l'ISS ; 384 000 km, la Lune.
2 | Dérivés | En equity, quelles options cotent la volatilité implicite la plus chère ? | Les puts en dehors de la monnaie (strike sous le spot) | !Les calls en dehors de la monnaie | Les options à la monnaie | Aucune : la vol est la même partout | C'est le skew : la protection contre les krachs se paie cher, et les marchés baissent plus brutalement qu'ils ne montent.
2 | Dérivés | Pourquoi les puts en dehors de la monnaie sont-ils plus chers en vol, en equity ? | Demande de protection, et des krachs plus brutaux à la baisse | !Les puts ont plus de vega que les calls | Les taux d'intérêt sont positifs | Les dividendes rendent les puts plus risqués | Les gérants achètent des puts pour se couvrir, et quand le marché baisse, la volatilité monte : le skew reflète ce risque.
2 | Dérivés | Que signifie « un put 25 delta » ? | Un put dont le delta vaut −0,25 | !Un put 25 % sous le spot | Un put de 25 jours | Un put qui coûte 25 % du strike | On repère les strikes par leur delta plutôt qu'en prix : le put 25 delta est en dehors de la monnaie, sous le spot.
2 | Dérivés | Qu'est-ce qu'un put down-and-in, et combien coûte-t-il face à un put classique de même strike ? | Il ne naît que si une barrière basse est touchée ; il coûte moins cher (ou autant) | !Il ne naît que si une barrière basse est touchée ; il coûte plus cher | Il meurt à une barrière basse ; il coûte plus cher | Il s'exerce en continu ; il coûte le même prix | C'est un put classique avec une condition en plus : il ne peut jamais valoir plus que lui.
2 | Dérivés | Pourquoi une option asiatique coûte-t-elle moins cher qu'un call classique ? | La moyenne réduit la volatilité du payoff | !Son échéance est plus courte | Elle n'est pas cotée en bourse | Elle ne verse pas de dividende | La moyenne d'un chemin varie moins que sa valeur finale : moins de volatilité effective, moins de valeur temps.
2 | Dérivés | Comment estime-t-on la volatilité pour pricer une option ? | Avec la vol implicite des options cotées, ou la vol historique du sous-jacent | !Avec le taux sans risque | Avec le rendement du dividende | Elle est fixée par la bourse chaque matin | Le marché l'impose via les prix des options liquides (vol implicite) ; à défaut, on part de l'historique et on ajuste.
2 | Dérivés | Delta d'un call très en dehors de la monnaie, tout près de l'échéance ? | Proche de 0 : il ne réagit presque plus au sous-jacent | !Proche de 0,5 | Proche de 1 | Négatif | Il n'a presque aucune chance de finir dans la monnaie : son prix ne bouge presque pas avec le sous-jacent.
2 | Probas | Pourquoi critique-t-on l'hypothèse de rendements gaussiens ? | Les vrais rendements ont des queues épaisses : les krachs sont bien plus fréquents | !Les rendements sont toujours positifs | La loi normale est trop dure à calculer | Les rendements ne sont pas des nombres réels | Un mouvement de 5 écarts-types devrait arriver une fois en plusieurs milliers d'années ; sur les marchés, on en voit plusieurs par décennie.
2 | Dérivés | Call américain ou call européen, mêmes caractéristiques : lequel vaut le plus ? | L'américain, au moins autant | !L'européen | Toujours le même prix | Ça dépend uniquement de la volatilité | Le droit d'exercer à tout moment ne peut que valoir quelque chose. Sans dividende, exercer un call en avance n'est jamais optimal : les deux valent alors pareil.
2 | Marchés | Tu es long d'un future sur matière première. Tu préfères une courbe… | en backwardation | !en contango | plate | qui change de forme chaque mois | En backwardation, le future cote sous le spot et remonte vers lui jusqu'à l'échéance : en roulant, on gagne. En contango, on perd à chaque roll.
2 | Risque | VaR 99 % à 1 jour = −10 M€. Que signifie-t-elle ? | Un jour sur cent, on perd plus de 10 M€ | !On ne peut pas perdre plus de 10 M€ | On perd 10 M€ en moyenne chaque jour | 99 jours sur 100, on perd exactement 10 M€ | La VaR est un quantile : elle ne dit rien de la taille des pertes les mauvais jours (c'est l'expected shortfall qui la mesure).
2 | Probas | Variance de X + Y, avec une corrélation ρ ? | σx² + σy² + 2ρσxσy | !σx² + σy² | (σx + σy)² | σx² + σy² − 2ρσxσy | La covariance compte deux fois ; sans corrélation, les variances s'additionnent (mais pas les écarts-types).
2 | Taux | Qu'est-ce que le taux repo ? | Le taux d'un prêt d'argent garanti par des titres | !Le taux de rémunération des dépôts à vue | Le taux d'une obligation remboursée par anticipation | Le taux de change à terme | Repurchase agreement : on vend un titre en s'engageant à le racheter un peu plus cher ; l'écart est l'intérêt du prêt.
2 | Dérivés | Comment structure-t-on une reverse convertible ? | Une obligation + la vente d'un put | !Une obligation + l'achat d'un call | Une action + l'achat d'un put | Deux obligations de maturités différentes | Le put vendu finance un gros coupon ; si l'action chute, l'investisseur est remboursé en actions dépréciées.
2 | Dérivés | Delta d'un forward d'un an, au bout de 6 mois, si la volatilité du sous-jacent explose ? | Toujours 1 (hors dividendes) | !Plus que 1 | 0,5 | Il devient négatif | Un forward est linéaire : sa valeur S − K·e^(−rT) suit le spot un pour un, quelle que soit la volatilité.
2 | Dérivés | Vega d'un forward ? | 0 | !1 | Maximal à la monnaie | Négatif | Pas d'optionalité, pas de convexité : la volatilité n'entre pas dans sa valeur, qu'il soit européen ou non.
2 | Dérivés | Que garantit la convergence d'un future ? | À l'échéance, son prix rejoint celui du sous-jacent | !Il rapporte toujours le taux sans risque | Il ne peut pas baisser | Les appels de marge sont nuls | Sinon, il y aurait un arbitrage sans risque à l'échéance : acheter le moins cher, vendre le plus cher.
2 | Dérivés | Ton future cote au-dessus de sa valeur théorique. Que fais-tu ? | Je vends le future et j'achète le sous-jacent (cash and carry) | !J'achète le future et je vends le sous-jacent | Rien, c'est normal | J'achète les deux | On porte le sous-jacent jusqu'à l'échéance, financé au taux sans risque, et on le livre au prix du future, trop cher : gain sans risque.
2 | Dérivés | Qu'est-ce qu'un variance swap ? | L'échange de la variance réalisée contre un niveau fixé à l'avance | !Un swap de taux dont le taux varie | Une option sur la moyenne du sous-jacent | Un échange de deux devises | À l'échéance, on reçoit (variance réalisée − strike) × nominal : une exposition pure à la volatilité, sans delta à gérer.
2 | Taux | Taux 1 an à 2 %, taux 2 ans à 3 % : le taux forward 1 an dans 1 an est… | au-dessus de 3 % | !en dessous de 3 % | égal à 3 % | égal à 2,5 % | (1,03)² = 1,02 × (1 + f), donc f ≈ 4 % : pour que la moyenne fasse 3 %, la seconde année compense la première à 2 %.
2 | Dérivés | Theta d'un call acheté ? | Négatif : il perd de la valeur temps chaque jour | !Positif | Nul | Égal au delta | La valeur temps fond jusqu'à l'échéance, d'autant plus vite que l'option est à la monnaie.
2 | Dérivés | Long gamma et delta-neutre, le marché monte. Que fais-tu ? | Je vends du sous-jacent | !J'en achète | Rien | J'achète d'autres options | Le delta augmente avec le marché : on revend à la hausse, on rachète à la baisse. C'est ainsi qu'un long gamma gagne sur les mouvements.
2 | Taux | Duration modifiée de 5, les taux montent de 1 point. L'obligation… | perd environ 5 % | !gagne environ 5 % | perd environ 1 % | perd environ 0,2 % | ΔP/P ≈ −D_mod × Δy = −5 × 1 % = −5 %.
2 | Probas | Probabilité qu'un tirage gaussien sorte de l'intervalle [−σ ; +σ] ? | ≈ 32 % | !≈ 5 % | ≈ 68 % | ≈ 16 % | 68 % des tirages tombent à moins d'un écart-type de la moyenne ; il en reste 32 % en dehors, 16 % de chaque côté.
2 | Probas | Probabilité d'obtenir une somme de 18 avec trois dés ? | 1/216 | !1/18 | 1/36 | 3/216 | Il faut trois 6 : (1/6)³ = 1/216.
2 | Calcul | 1 milliard d'euros tout de suite, ou 0,10 € qui rapportent 10 % par jour pendant un an ? | Les 0,10 € : environ 10¹⁴ € | !Le milliard, sans hésiter | C'est à peu près pareil | Les 0,10 € : environ 10 millions d'euros | 1,1³⁶⁵ = e^(365 × 0,0953) ≈ e^34,8 ≈ 1,3 × 10¹⁵. Fois 0,10 € : environ 130 000 milliards d'euros.
2 | Probas | Deux enfants, dont au moins un garçon. Probabilité que les deux soient des garçons ? | 1/3 | !1/2 | 1/4 | 2/3 | Cas possibles : GG, GF, FG (FF exclu). Un seul sur trois est GG.
# ---- Comité final
3 | Dérivés | Call de strike 100, le jour de l'échéance, action à 100 : son gamma ? | Infini en théorie : le delta saute de 0 à 1 au strike | !0, l'option est arrivée à échéance | 1 | 0,5 | À l'échéance, le payoff fait un angle au strike : sa dérivée seconde est un pic. Le gamma explose vers l'échéance à la monnaie, en 1/(σ√T).
3 | Dérivés | Pourquoi le gamma d'un call court est-il maximal à la monnaie ? | Γ ≈ φ(d₁)/(Sσ√T) : φ culmine quand d₁ ≈ 0, et √T petit le fait exploser | !Parce que la valeur temps y est nulle | Parce que le vega y est nul | Parce que le delta y vaut 1 | φ(d₁) est la densité normale, maximale quand le spot est au strike. Le facteur 1/√T explique que le pic se resserre et monte vers l'échéance.
3 | Dérivés | À la monnaie, même volatilité : straddle 3 mois ou call 1 an, lequel est le plus cher ? | À peu près le même prix | !Le call 1 an, quatre fois plus long | Le straddle, il contient deux options | Le straddle, quatre fois plus cher | À la monnaie, une option vaut ≈ 0,4·σ·S·√T. Straddle 3 mois : 2 × 0,4σS × 0,5 = 0,4σS. Call 1 an : 0,4σS × 1. Égalité !
3 | Dérivés | En equity, vol implicite du put 25 delta ou du call 25 delta ? | Le put, plus haut | !Le call, plus haut | Identiques par parité | Ça ne dépend que de la maturité | Le risk reversal est négatif sur les actions : la protection contre la baisse se paie plus cher que l'exposition à la hausse.
3 | Dérivés | Hypothèses de la parité call-put ? | Options européennes, même strike, même échéance, absence d'arbitrage | !Volatilité constante et rendements gaussiens | Options américaines sans dividende | Un marché haussier | Aucune hypothèse de modèle : la parité vient d'un simple arbitrage statique. Elle ne tient plus telle quelle pour des options américaines.
3 | Dérivés | Spot à 100 : vega d'un call spread 100-120 (call 100 acheté, call 120 vendu) ? | Positif | !Nul, c'est un spread | Négatif | Infini | Le call 100, à la monnaie, a plus de vega que le call 120 en dehors : la position est longue vega. Spot près de 120, ce serait l'inverse.
3 | Dérivés | Un call spread « à la monnaie » est-il neutre en vega ? | Non : son vega dépend du spot par rapport aux deux strikes | !Oui, toujours | Oui, dès qu'il est à la monnaie | Non, il est toujours très long vega | Spot près du strike acheté : long vega. Près du strike vendu : short vega. Il n'est neutre qu'à peu près entre les deux.
3 | Dérivés | Quelle stratégie est long gamma et short vega ? | Acheter une option courte et vendre une option longue | !Acheter une option longue et vendre une option courte | Acheter un straddle long | Vendre un straddle court | L'option courte porte beaucoup de gamma et peu de vega ; l'option longue l'inverse. On achète la courte, on vend la longue.
3 | Dérivés | Acheter un call or 1 mois et vendre le call 3 mois de même strike, pour zéro prime : tu le fais ? | Non : le 3 mois vaut plus, je devrais encaisser une prime | !Oui, c'est gratuit | Oui, je suis long gamma sans rien payer | Ça ne dépend que du prix de l'or | Une option plus longue vaut plus cher. Entrer pour zéro, c'est offrir la différence de valeur temps à sa contrepartie.
3 | Probas | Amazon et Renault ont une corrélation de −1. Amazon fait +1 %. Renault fait… | Une baisse dont la taille dépend du rapport de leurs volatilités | !−1 % exactement | +1 % | 0 % | Corrélation −1 : les rendements sont sur une droite de pente négative, Renault ≈ −(σR/σA) × 1 %. Le −1 % suppose des volatilités égales.
3 | Dérivés | Dans quel cas exerces-tu un call américain avant l'échéance ? | Juste avant le détachement d'un gros dividende | !Dès qu'il est dans la monnaie | Quand la volatilité monte | Jamais, dans aucun cas | Sans dividende, on garde toujours la valeur temps. Un gros dividende fait chuter l'action : exercer juste avant permet de le toucher.
3 | Dérivés | De quel côté penche le skew de l'or ? | Côté calls : la vol des calls est plus chère | !Côté puts, comme sur les actions | Il est parfaitement plat | Côté puts, encore plus fort que les actions | L'or flambe dans les crises : la demande se porte sur la hausse, ce qui renchérit les calls.
3 | Dérivés | Lot A : un call 95 et un call 105. Lot B : deux calls 100 (même sous-jacent, même échéance). Lequel prends-tu ? | Le lot A | !Le lot B | Indifférent, même valeur | Ça ne dépend que du spot | Le prix d'un call est convexe en strike : C(95) + C(105) ≥ 2 × C(100). La différence, c'est un butterfly 95-100-105, toujours positif.
3 | Probas | Qu'est-ce qu'une mesure de probabilité risque-neutre ? | Celle sous laquelle les prix actualisés des actifs sont des martingales | !La probabilité réelle observée sur le marché | La probabilité que le marché ne bouge pas | La probabilité de défaut d'un État sans risque | Sous cette mesure, tous les actifs rapportent en moyenne le taux sans risque : le prix d'un dérivé est l'espérance actualisée de son payoff.
3 | Dérivés | Signe du vega d'un call binaire acheté, dans la monnaie ? | Négatif : on veut que le spot reste où il est | !Positif | Nul | Ça ne dépend pas de la position du spot | Dans la monnaie, plus de volatilité, c'est plus de risque de repasser sous le strike et de tout perdre.
3 | Dérivés | Variance swap standard ou capé : lequel est le moins cher ? | Le capé | !Le standard | Ils valent pareil | Ça dépend du signe de la corrélation | Le cap plafonne la variance payée dans les scénarios extrêmes : l'acheteur renonce à une partie du gain, donc paie moins.
3 | Dérivés | Tu es short d'un forward et un dividende attendu est annulé : tu gagnes ou tu perds ? | Je perds : le prix forward monte | !Je gagne : le prix forward baisse | Ni l'un ni l'autre | Je gagne le dividende | F = S·e^((r − q)T) : sans le dividende, le prix forward monte, et le vendeur du forward perd.
3 | Dérivés | Signe du delta d'un call up-and-out tout près de la barrière ? | Négatif | !Toujours positif, comme un call | Nul | Égal à 1 | Près de la barrière, une hausse risque de tuer l'option : sa valeur baisse quand le spot monte.
3 | Dérivés | Spot à 100, call strike 100 up-and-out barrière 80 : combien vaut-il ? | 0 : la barrière est déjà franchie | !Le prix d'un call 100 classique | La moitié d'un call 100 | Plus qu'un call classique | Une barrière « up » à 80 alors que le spot est à 100 : l'option est déjà désactivée. Piège classique d'entretien.
3 | Dérivés | Put classique = put down-and-in + … ? | put down-and-out (même strike, même barrière) | !call down-and-in | put up-and-in | option binaire down | Que la barrière soit touchée ou non, exactement l'un des deux est actif : leur somme est le put classique.
3 | Dérivés | Un trader long gamma gagne de l'argent si… | la volatilité réalisée dépasse la volatilité implicite payée | !le marché ne bouge pas | les taux montent | la volatilité implicite baisse | Le rebalancement rapporte ≈ ½·Γ·(ΔS)² : il doit compenser le theta payé, qui correspond à la volatilité implicite.
3 | Dérivés | Delta d'un call acheté + un put vendu, même strike, même échéance ? | 1 : c'est un forward synthétique | !0 | 2 | −1 | Parité : Δcall − Δput = 1. La position reproduit exactement un forward.
3 | Probas | Pile ou face jusqu'au premier pile ; tu gagnes 2ⁿ € au n-ième lancer. Prix juste en théorie ? | Infini | !2 € | 4 € | 1 € | Paradoxe de Saint-Pétersbourg : chaque lancer apporte 1 € d'espérance, la somme diverge. En pratique, personne ne paierait plus de quelques euros.
# ---- Couverture, échéance et taux variables (questions d'examen de dérivés)
3 | Dérivés | À l'échéance d'une option cash delivery, que fais-tu pour rester delta neutre ? | Je déboucle toute ma couverture en sous-jacent, au prix de fixing | !Je livre les titres de ma couverture à la contrepartie | Rien : la couverture se dénoue toute seule | Je double la couverture pour la période suivante | En cash delivery, on ne règle que la différence en argent : l'option disparaît (delta 0) mais le stock de couverture reste. Il faut le revendre ou le racheter au fixing, sinon le delta reste ouvert. En livraison physique, c'est la livraison qui solde la couverture.
2 | Dérivés | Option exercée en livraison physique, tu étais couvert en actions. À l'échéance… | la livraison solde la couverture : il n'y a plus rien à faire | !il faut revendre la couverture sur le marché au fixing | la couverture devient une position vendeuse | il faut doubler la couverture | Vendeur d'un call couvert avec les actions : on livre les titres, on encaisse le strike, et il ne reste plus de risque.
3 | Dérivés | Avec des options vanilles, comment être à la fois gamma négatif et thêta négatif ? | Vendre un put européen très dans la monnaie | !Vendre un straddle à la monnaie | Acheter un straddle à la monnaie | Acheter un calendar spread | En général Θ ≈ −½σ²S²Γ : gamma et thêta vont en sens opposé (vendre un straddle rapporte du thêta). L'exception vient des taux : un put européen très dans la monnaie a un thêta positif, il vaut moins que K − S à cause de l'actualisation. Le vendre donne gamma et thêta négatifs.
3 | Dérivés | Pourquoi un put européen très dans la monnaie peut-il avoir un thêta positif ? | Il vaut à peu près K·e^(−rT) − S, qui remonte vers K − S avec le temps | !Parce que sa volatilité implicite baisse | Parce qu'il n'a plus aucune valeur | C'est impossible pour une option achetée | Sans valeur temps, il ne reste que la valeur intrinsèque actualisée : le temps qui passe réduit l'actualisation, donc le prix monte. Un put américain, lui, serait exercé tout de suite.
2 | Dérivés | Vendre un straddle à la monnaie : signes du gamma et du thêta ? | Gamma négatif, thêta positif | !Gamma négatif, thêta négatif | Gamma positif, thêta positif | Gamma positif, thêta négatif | On encaisse la valeur temps chaque jour (thêta +), mais on perd sur les grands mouvements (gamma −). Gamma et thêta ont presque toujours des signes opposés.
2 | Taux | Paiement à taux flottant : qu'est-ce que la date de constatation (fixing) ? | Le jour où l'on observe le taux de référence qui fixe le prochain coupon | !Le jour où le coupon est versé | Le jour de signature du contrat | Le jour où la banque centrale change ses taux | Ex. : l'Euribor 3 mois est constaté deux jours ouvrés avant le début de la période ; le coupon calculé avec ce taux est payé à la fin de la période.
2 | Taux | Taux variable standard (Euribor) : quand est-il fixé, quand est-il payé ? | Fixé au début de la période, payé à la fin | !Fixé et payé à la fin de la période | Fixé et payé au début | Fixé à la signature, pour toute la durée | C'est le « fixed in advance, paid in arrears » : on connaît le coupon dès le début. Un taux fixé en fin de période (« in arrears ») demande un ajustement de convexité.
3 | Dérivés | Qu'est-ce que le pin risk ? | Ne pas savoir si l'option sera exercée quand le spot finit pile au strike | !Le risque de défaut de la chambre de compensation | Le risque qu'une option expire sans valeur | Le risque de taux sur la prime payée | Au strike, l'exercice est incertain : on ignore quelle quantité de sous-jacent on va recevoir ou livrer, donc quelle couverture garder après l'échéance.
3 | Dérivés | Calendar spread acheté à la monnaie (option longue achetée, courte vendue) : gamma et thêta ? | Gamma négatif, thêta positif | !Gamma positif, thêta négatif | Les deux nuls | Les deux positifs | L'option courte a plus de gamma et perd plus vite sa valeur temps : on est short gamma et on encaisse du thêta.
2 | Dérivés | Calendar spread acheté (option 3 mois achetée, option 1 mois vendue) : vega ? | Positif | !Négatif | Nul | Égal au gamma | Le vega croît avec la maturité : l'option longue en a plus que la courte.
2 | Dérivés | Delta d'un put à la monnaie, maturité courte ? | Environ −0,5 | !Environ +0,5 | 0 | −1 | Δput = Δcall − 1 ≈ 0,5 − 1 : un put gagne quand le sous-jacent baisse.
3 | Dérivés | Short gamma et delta neutre, le marché baisse fortement. Pour te recouvrir, tu… | vends du sous-jacent, en pleine baisse | !en achètes, pour profiter des prix bas | ne fais rien | achètes des puts gratuitement | Short gamma, ton delta devient positif quand le marché baisse : pour revenir à zéro, tu vends au plus bas. Vendre bas, racheter haut : c'est le coût du short gamma.
3 | Dérivés | Couvrir un call vendu au jour le jour revient à… | acheter quand ça monte, vendre quand ça baisse | !vendre quand ça monte, acheter quand ça baisse | ne rien faire si le spot oscille | gagner à coup sûr | Short call = short gamma : le delta à couvrir monte avec le spot. Chaque aller-retour coûte ; la prime encaissée compense si la volatilité réalisée reste sous l'implicite.
3 | Dérivés | Butterfly acheté, spot au strike central, juste avant l'échéance : gamma ? | Négatif | !Positif | Nul | Infini | Les deux calls vendus au centre dominent : autour du strike central, la position est short gamma et long thêta. Elle gagne si le spot ne bouge plus.
2 | Dérivés | Qu'est-ce qu'un risk reversal, en equity ? | Acheter un call en dehors de la monnaie et vendre un put en dehors (ou l'inverse) | !Acheter un call et un put de même strike | Racheter une option qu'on avait vendue | Exercer une option avant l'échéance | Il est long delta, et sa valeur dépend surtout du skew : l'écart de volatilité entre le put et le call.
2 | Dérivés | Pour neutraliser le gamma d'un portefeuille d'options, on utilise… | d'autres options | !des futures | le sous-jacent | un prêt | Le sous-jacent et les futures ont un gamma nul : ils corrigent le delta, pas le gamma.
2 | Dérivés | En vendant un call couvert (covered call), on renonce à… | la hausse au-dessus du strike | !la protection contre la baisse | la prime | aux dividendes | On encaisse la prime, mais au-dessus du strike, les titres partent au strike. Contre la baisse, on n'a jamais été protégé.
3 | Dérivés | Pourquoi une option knock-out est-elle moins chère que la vanille ? | Elle disparaît si la barrière est touchée | !Elle a moins de vega | Elle est toujours dans la monnaie | Elle n'a pas de prime | Vanille = knock-out + knock-in de même barrière : chacune vaut moins que la vanille.
2 | Taux | Qu'est-ce qu'un cap de taux ? | Une série de calls sur le taux variable (caplets), qui plafonne ce qu'on paie | !Un plancher qui garantit un taux minimum | Un swap qui fige le taux | Une obligation à taux plafonné | L'emprunteur à taux variable achète un cap : au-dessus du strike, chaque caplet lui rembourse l'écart. Le floor, c'est l'inverse, pour le prêteur.
2 | Taux | Prêteur à taux variable, tu crains une baisse des taux. Tu achètes… | un floor | !un cap | un swap emprunteur de taux fixe | un CDS | Le floor paie quand le taux passe sous le strike : il garantit un revenu minimum.
2 | Taux | Swap payeur de fixe (tu paies le fixe, reçois le variable). Les taux montent : | il prend de la valeur | !il perd de la valeur | rien ne change | il est annulé | Tu reçois un variable qui monte contre un fixe figé : la position ressemble à une vente d'obligation.
3 | Taux | Duration d'une obligation à taux variable, juste après une constatation de son taux 3 mois ? | Environ 3 mois : le temps jusqu'au prochain fixing | !Sa maturité finale | Zéro | Celle d'une obligation fixe de même maturité | Au prochain fixing, le coupon se recale sur le marché et le prix revient près du pair : le risque de taux ne porte que jusque-là.
3 | Taux | Un FRA 3×6, ça fixe… | un taux 3 mois qui démarre dans 3 mois | !un taux 6 mois qui démarre aujourd'hui | un taux 3 mois pendant 6 ans | un change à 3 et 6 mois | Forward Rate Agreement : on fige aujourd'hui le taux de la période qui va de 3 à 6 mois. Il est réglé en cash à la date de constatation, actualisé.
3 | Taux | Un caplet sur l'Euribor 3 mois équivaut à… | un put sur une obligation zéro coupon | !un call sur une obligation zéro coupon | un swap de taux | un floor | Quand le taux monte, le prix du zéro coupon baisse : un call sur le taux, c'est un put sur l'obligation.
`;

// Questions à saisir au clavier : niveau | rubrique | question | réponse | marge | unité | pièges (séparés par « ; ») | explication
// La marge : « ±2% » (écart relatif), « ×3 » (ordre de grandeur, entre la valeur / 3 et × 3) ou « 0 » (exacte).
const RAW_NUM = `
1 | Calcul | Action à 100 € : +10 % le premier jour, −10 % le deuxième. Prix final ? | 99 | 0 | € | 100 | 100 × 1,1 × 0,9 = 99 : la baisse porte sur une base plus haute. On perd 1 %, on n'est pas à l'équilibre.
1 | Taux | Combien vaut un point de base sur 1 million d'euros ? | 100 | 0 | € | 10;1000 | 1 bp = 0,01 % : 0,0001 × 1 000 000 = 100 €.
1 | Taux | Duration d'un zéro coupon de maturité 3 ans ? | 3 | 0 | ans | 1,5 | Un seul flux, à l'échéance : la duration (moyenne pondérée des dates de flux) vaut sa maturité.
1 | Logique | Tournoi de tennis à 100 joueurs, élimination directe. Combien de matchs pour désigner le vainqueur ? | 99 | 0 | matchs | 50;100 | Chaque match élimine exactement un joueur : il faut en éliminer 99.
1 | Calcul | Somme de tous les entiers de 1 à 10 ? | 55 | 0 | - | 50;45 | 10 × 11 / 2 = 55.
1 | Estimation | Superficie de la France métropolitaine ? | 551000 | ±10% | km² | - | ≈ 550 000 km² (543 940 km² selon l'IGN, hors lacs et glaciers). Avec l'outre-mer, environ 640 000 km².
1 | Estimation | Combien de secondes dans une année (365 jours) ? | 31536000 | ±2% | s | 8760 | 365 × 86 400 ≈ 31,5 millions de secondes, à peu près π × 10⁷.
2 | Taux | Prix d'un zéro coupon 2 ans, nominal 100, taux 4 % par an (composé annuellement) ? | 92,46 | ±0,15% | € | 92;96 | 100 / 1,04² = 100 / 1,0816 ≈ 92,46. Le 92 viendrait d'intérêts simples (100 − 2 × 4).
2 | Taux | Taux 1 an à 2 %, taux 2 ans à 3 %. Taux forward 1 an dans 1 an ? | 4,01 | ±1,5% | % | 3,5;5 | (1,03)² / 1,02 − 1 = 1,0609 / 1,02 − 1 ≈ 4,01 %. De tête : 2 × 3 − 2 = 4 %.
2 | Probas | Un actif bouge d'environ 1 % par jour. Sa volatilité annualisée ? | 16 | ±6% | % | 252;256;365 | ≈ 256 jours de bourse : σ_an = 1 % × √256 = 16 %. La volatilité croît comme la racine du temps, pas linéairement.
2 | Estimation | Combien y a-t-il de fenêtres à Paris (ordre de grandeur) ? | 10000000 | ×3 | fenêtres | - | ≈ 2,1 millions d'habitants, ≈ 1,4 million de logements à 4 ou 5 fenêtres, plus bureaux, commerces et écoles : une dizaine de millions. Compté juste entre 3 et 30 millions.
2 | Estimation | Combien de litres d'eau dans un bassin olympique (50 × 25 m, 2 m de fond) ? | 2500000 | ±5% | L | 2500 | 50 × 25 × 2 = 2 500 m³, et 1 m³ = 1 000 L : 2,5 millions de litres.
2 | Calcul | Placement à 6 % par an : en combien d'années double-t-il (règle de 72) ? | 12 | ±5% | ans | 16,7 | 72 / 6 = 12 ans (exactement 11,9). Le 16,7 vient de 100 / 6, en intérêts simples.
2 | Estimation | Combien de battements de cœur dans une vie de 80 ans (ordre de grandeur) ? | 3000000000 | ×2 | battements | - | ≈ 70 par minute × 60 × 24 × 365 × 80 ≈ 3 milliards.
3 | Probas | Nombre moyen de lancers d'un dé pour obtenir un 6 ? | 6 | 0 | lancers | 3,5 | Loi géométrique de paramètre 1/6 : l'espérance vaut 1/p = 6.
3 | Logique | Combien de fois par jour (24 h) les aiguilles des heures et des minutes se superposent-elles ? | 22 | 0 | fois | 24;23 | Elles se rejoignent toutes les 12/11 h ≈ 1 h 05 min 27 s : 11 fois en 12 h, donc 22 fois en 24 h.
3 | Probas | 23 personnes dans une salle : probabilité (en %) qu'au moins deux aient le même anniversaire ? | 50,7 | ±4% | % | 6,3 | 1 − (365 × 364 × … × 343)/365²³ ≈ 50,7 %. Il y a 253 paires possibles : bien plus de chances qu'on ne croit.
3 | Taux | Action à 100, dividende continu 10 % par an, taux nuls : prix forward à 5 ans ? | 60,65 | ±1% | € | 50;59,05 | 100 × e^(−0,5) ≈ 60,65. Le 59,05 correspond à des dividendes discrets (0,9⁵) ; le 50, à une baisse linéaire de 10 % par an.
2 | Dérivés | Tu vends 10 calls (100 actions chacun) de delta 0,6. Combien d'actions achètes-tu pour être delta neutre ? | 600 | 0 | actions | 6;1000;400 | 10 × 100 × 0,6 = 600 actions : un delta par action sous-jacente, multiplié par la taille du contrat.
3 | Dérivés | Long 200 calls (100 actions chacun, delta 0,5) et short 5 000 actions. Delta net, en actions ? | 5000 | 0 | actions | 15000;-5000;0 | 200 × 100 × 0,5 = 10 000 actions de delta long, moins 5 000 vendues : 5 000. Il reste encore 5 000 actions à vendre pour être neutre.
2 | Taux | Euribor constaté à 3 %, période de 90 jours (base 360), nominal 1 M€. Coupon flottant ? | 7500 | 0 | € | 30000;7397 | 1 000 000 × 3 % × 90/360 = 7 500 €. Avec une base 365, on trouverait 7 397 € : la convention de calcul compte.
`;

const LEVEL_NAME = { 1: 'facile', 2: 'normal', 3: 'expert' };
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function parseChoice(line, k) {
  const [lvl, cat, text, good, w1, w2, w3, tip] = line.split(' | ').map((x) => x.trim());
  let wrong = [w1, w2, w3];
  let trap = wrong.findIndex((w) => w.startsWith('!'));
  wrong = wrong.map((w) => w.replace(/^!/, ''));
  if (trap < 0) { trap = wrong.findIndex((w) => norm(tip).includes(norm(w))); if (trap < 0) trap = 0; }
  return { id: k + 1, type: 'choice', level: LEVEL_NAME[lvl], tier: Number(lvl), cat, text, good, wrong, trap: wrong[trap], tip };
}

// Réponse à saisir : « ±2% » (écart relatif), « ×3 » (ordre de grandeur : entre la valeur / 3 et × 3) ou « 0 » (exacte)
const num = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));
function parseNum(line, k) {
  const [lvl, cat, text, ans, margin, unit, traps, tip] = line.split(' | ').map((x) => x.trim());
  const m = margin.match(/^([±×])\s*([\d,.]+)\s*(%?)$/);
  const tolMode = m && m[1] === '×' ? 'factor' : 'rel';
  const tol = !m ? 0 : tolMode === 'factor' ? num(m[2]) : num(m[2]) / (m[3] ? 100 : 1);
  return {
    id: 1000 + k, type: 'num', level: LEVEL_NAME[lvl], tier: Number(lvl), cat, text, answer: num(ans), tol, tolMode, unit: unit === '-' ? '' : unit,
    traps: traps === '-' ? [] : traps.split(';').map(num), tip,
  };
}

const lines = (raw) => raw.trim().split('\n').filter((l) => l.trim() && !l.startsWith('#'));
export const CHARTIER_QUESTIONS = [
  ...lines(RAW + '\n' + RAW_ENTRETIENS).map(parseChoice),
  ...lines(RAW_NUM).map(parseNum),
];

export function getQuestionsByLevel(level) {
  return CHARTIER_QUESTIONS.filter((q) => q.level === level);
}
