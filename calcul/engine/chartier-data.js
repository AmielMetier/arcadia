// calcul/engine/chartier-data.js
// Base de données des 300 questions The Candidate (Pierre Chartier)
// 3 Niveaux (Facile: 1-100, Normal: 101-200, Expert: 201-300)

export const CHARTIER_QUESTIONS = [
  {
    "id": 1,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie l'acronyme CAC dans CAC 40 ?",
    "rawAns": "Cotation Assistée en Continu",
    "cleanAns": "Cotation Assistée en Continu",
    "show": "Cotation Assistée en Continu",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "cotation assistee en continu",
      "cotation"
    ],
    "choices": [
      "Compagnie d'Actions Cotées",
      "Capitalisation Actions Courantes",
      "Cotation Assistée en Continu",
      "Comité d'Arbitrage du Crédit"
    ],
    "correctChoice": "Cotation Assistée en Continu"
  },
  {
    "id": 2,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Combien d'entreprises composent l'indice CAC 40 ?",
    "rawAns": "40",
    "cleanAns": "40",
    "show": "40",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "40"
    ],
    "choices": [
      "20",
      "32",
      "40",
      "50"
    ],
    "correctChoice": "40"
  },
  {
    "id": 3,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Si les taux d'intérêt augmentent, que fait le prix d'une obligation à taux fixe ?",
    "rawAns": "Il baisse",
    "cleanAns": "Il baisse",
    "show": "Il baisse",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "il baisse",
      "baisse",
      "diminue"
    ],
    "choices": [
      "Il monte",
      "Il baisse",
      "Il double",
      "Il reste stable"
    ],
    "correctChoice": "Il baisse"
  },
  {
    "id": 4,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel animal symbolise un marché boursier en hausse ?",
    "rawAns": "Le Taureau (Bull)",
    "cleanAns": "Le Taureau",
    "show": "Le Taureau (Bull)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "le taureau bull",
      "le taureau",
      "bull",
      "taureau"
    ],
    "choices": [
      "Le Loup",
      "L'Aigle",
      "L'Ours (Bear)",
      "Le Taureau"
    ],
    "correctChoice": "Le Taureau"
  },
  {
    "id": 5,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel animal symbolise un marché boursier en baisse ?",
    "rawAns": "L'Ours (Bear)",
    "cleanAns": "L'Ours",
    "show": "L'Ours (Bear)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "l ours bear",
      "l ours",
      "bear",
      "ours"
    ],
    "choices": [
      "Le Taureau (Bull)",
      "L'Ours",
      "Le Renard",
      "Le Faucon"
    ],
    "correctChoice": "L'Ours"
  },
  {
    "id": 6,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la devise officielle du Japon ?",
    "rawAns": "Le Yen (JPY)",
    "cleanAns": "Le Yen",
    "show": "Le Yen (JPY)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "le yen jpy",
      "le yen",
      "yen",
      "jpy"
    ],
    "choices": [
      "Le Dollar de Singapour (SGD)",
      "Le Yen",
      "Le Won (KRW)",
      "Le Yuan (CNY)"
    ],
    "correctChoice": "Le Yen"
  },
  {
    "id": 7,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la devise officielle de la Suisse ?",
    "rawAns": "Le Franc suisse (CHF)",
    "cleanAns": "Le Franc suisse",
    "show": "Le Franc suisse (CHF)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le franc suisse chf",
      "le franc suisse",
      "chf"
    ],
    "choices": [
      "L'Euro (EUR)",
      "La Couronne suisse (SEK)",
      "Le Florin",
      "Le Franc suisse"
    ],
    "correctChoice": "Le Franc suisse"
  },
  {
    "id": 8,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on la part du bénéfice distribuée aux actionnaires ?",
    "rawAns": "Le dividende",
    "cleanAns": "Le dividende",
    "show": "Le dividende",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le dividende"
    ],
    "choices": [
      "Le dividende",
      "La plus-value",
      "La soulte",
      "L'intérêt obligataire"
    ],
    "correctChoice": "Le dividende"
  },
  {
    "id": 9,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Combien vaut 1 point de base (bps) en pourcentage ?",
    "rawAns": "0,01 %",
    "cleanAns": "0,01 %",
    "show": "0,01 %",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "0 01",
      "0.01",
      "0,01"
    ],
    "choices": [
      "0,01 %",
      "2,01 %",
      "3,01 %",
      "Option alternative 4"
    ],
    "correctChoice": "0,01 %"
  },
  {
    "id": 10,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Combien de points de base y a-t-il dans 1 % ?",
    "rawAns": "100 bps",
    "cleanAns": "100 bps",
    "show": "100 bps",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "100 bps",
      "100"
    ],
    "choices": [
      "50 bps",
      "80 bps",
      "100 bps",
      "125 bps"
    ],
    "correctChoice": "100 bps"
  },
  {
    "id": 11,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Une action passe de 100 € à 120 €. Quel est son pourcentage de hausse ?",
    "rawAns": "20 %",
    "cleanAns": "20 %",
    "show": "20 %",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "20"
    ],
    "choices": [
      "16 %",
      "10 %",
      "20 %",
      "25 %"
    ],
    "correctChoice": "20 %"
  },
  {
    "id": 12,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Une action passe de 100 € à 50 €. De quel pourcentage doit-elle remonter pour revenir à 100 € ?",
    "rawAns": "100 %",
    "cleanAns": "100 %",
    "show": "100 %",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "100",
      "100%"
    ],
    "choices": [
      "50 %",
      "80 %",
      "100 %",
      "125 %"
    ],
    "correctChoice": "100 %"
  },
  {
    "id": 13,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie l'acronyme IPO ?",
    "rawAns": "Initial Public Offering (Introduction en bourse)",
    "cleanAns": "Initial Public Offering",
    "show": "Initial Public Offering (Introduction en bourse)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "initial public offering introduction en bourse",
      "initial public offering"
    ],
    "choices": [
      "Initial Public Offering",
      "International Portfolio Order",
      "Internal Private Offering",
      "Indexed Pricing Operation"
    ],
    "correctChoice": "Initial Public Offering"
  },
  {
    "id": 14,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel est le principal indice boursier allemand contenant 40 valeurs ?",
    "rawAns": "Le DAX",
    "cleanAns": "Le DAX",
    "show": "Le DAX",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le dax"
    ],
    "choices": [
      "Le DAX",
      "Le MDAX",
      "Le TecDAX",
      "L'Euro Stoxx 50"
    ],
    "correctChoice": "Le DAX"
  },
  {
    "id": 15,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel indice américain regroupe les 500 plus grandes entreprises cotées aux USA ?",
    "rawAns": "Le S&P 500",
    "cleanAns": "Le S&P 500",
    "show": "Le S&P 500",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le s p 500",
      "500",
      "s&p",
      "sp",
      "standard and poor"
    ],
    "choices": [
      "Le Russell 2000",
      "Le S&P 500",
      "Le Dow Jones",
      "Le Nasdaq 100"
    ],
    "correctChoice": "Le S&P 500"
  },
  {
    "id": 16,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment s'appelle la banque centrale des États-Unis ?",
    "rawAns": "La Réserve Fédérale (Fed)",
    "cleanAns": "La Réserve Fédérale",
    "show": "La Réserve Fédérale (Fed)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "la reserve federale fed",
      "la reserve federale"
    ],
    "choices": [
      "La Réserve Fédérale",
      "Le Trésor Américain (US Treasury)",
      "Le Conseil Monétaire National",
      "La Bank of America"
    ],
    "correctChoice": "La Réserve Fédérale"
  },
  {
    "id": 17,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Dans quelle ville se trouve le siège de la Banque Centrale Européenne (BCE) ?",
    "rawAns": "Francfort",
    "cleanAns": "Francfort",
    "show": "Francfort",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "francfort"
    ],
    "choices": [
      "Bruxelles",
      "Strasbourg",
      "Luxembourg",
      "Francfort"
    ],
    "correctChoice": "Francfort"
  },
  {
    "id": 18,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel produit dérivé donne le droit (sans obligation) d'acheter un actif ?",
    "rawAns": "Un Call (Option d'achat)",
    "cleanAns": "Un Call",
    "show": "Un Call (Option d'achat)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "un call option d achat",
      "un call",
      "call"
    ],
    "choices": [
      "Un Swap de taux",
      "Un contrat Future",
      "Un Put (Option de vente)",
      "Un Call"
    ],
    "correctChoice": "Un Call"
  },
  {
    "id": 19,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel produit dérivé donne le droit (sans obligation) de vendre un actif ?",
    "rawAns": "Un Put (Option de vente)",
    "cleanAns": "Un Put",
    "show": "Un Put (Option de vente)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "un put option de vente",
      "un put",
      "put"
    ],
    "choices": [
      "Un Warrant d'achat",
      "Un Call (Option d'achat)",
      "Un Forward de change",
      "Un Put"
    ],
    "correctChoice": "Un Put"
  },
  {
    "id": 20,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on le prix auquel une option peut être exercée ?",
    "rawAns": "Le Strike (ou Prix d'exercice)",
    "cleanAns": "Le Strike",
    "show": "Le Strike (ou Prix d'exercice)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le strike ou prix d exercice",
      "le strike"
    ],
    "choices": [
      "La Prime (Premium)",
      "Le Spot",
      "Le Strike",
      "Le Forward"
    ],
    "correctChoice": "Le Strike"
  },
  {
    "id": 21,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Une entreprise a 10 millions d'actions à 25 € chacune. Quelle est sa capitalisation boursière ?",
    "rawAns": "250 millions d'euros",
    "cleanAns": "250 millions d'euros",
    "show": "250 millions d'euros",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "250 millions d euros",
      "250"
    ],
    "choices": [
      "125 millions d'euros",
      "250 millions d'euros",
      "200 millions d'euros",
      "312,5 millions d'euros"
    ],
    "correctChoice": "250 millions d'euros"
  },
  {
    "id": 22,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Si le Chiffre d'Affaires est de 100 M€ et les charges de 85 M€, quel est le résultat ?",
    "rawAns": "15 M€",
    "cleanAns": "15 M€",
    "show": "15 M€",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "15 m",
      "15"
    ],
    "choices": [
      "15 M€",
      "12 M€",
      "18,8 M€",
      "7,5 M€"
    ],
    "correctChoice": "15 M€"
  },
  {
    "id": 23,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Dans un bilan comptable, comment s'appelle la colonne de gauche (ce que possède l'entreprise) ?",
    "rawAns": "L'Actif",
    "cleanAns": "L'Actif",
    "show": "L'Actif",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "l actif"
    ],
    "choices": [
      "L'Actif",
      "Le Hors-Bilan",
      "Les Capitaux Propres",
      "Le Passif"
    ],
    "correctChoice": "L'Actif"
  },
  {
    "id": 24,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Dans un bilan comptable, comment s'appelle la colonne de droite (les ressources/dettes) ?",
    "rawAns": "Le Passif",
    "cleanAns": "Le Passif",
    "show": "Le Passif",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "le passif"
    ],
    "choices": [
      "L'Actif",
      "L'Annexe",
      "Le Passif",
      "Le Compte de Résultat"
    ],
    "correctChoice": "Le Passif"
  },
  {
    "id": 25,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie l'acronyme M&A ?",
    "rawAns": "Mergers and Acquisitions (Fusions et Acquisitions)",
    "cleanAns": "Mergers and Acquisitions",
    "show": "Mergers and Acquisitions (Fusions et Acquisitions)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "mergers and acquisitions fusions et acquisitions",
      "mergers and acquisitions"
    ],
    "choices": [
      "Management and Audit",
      "Money and Assets",
      "Market Allocation",
      "Mergers and Acquisitions"
    ],
    "correctChoice": "Mergers and Acquisitions"
  },
  {
    "id": 26,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel terme désigne la vente d'un titre que l'on ne possède pas encore ?",
    "rawAns": "La vente à découvert (Short selling)",
    "cleanAns": "La vente à découvert",
    "show": "La vente à découvert (Short selling)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "la vente a decouvert short selling",
      "la vente a decouvert"
    ],
    "choices": [
      "Le Rachat d'actions",
      "La vente à découvert",
      "L'arbitrage de spread",
      "Le portage obligataire"
    ],
    "correctChoice": "La vente à découvert"
  },
  {
    "id": 27,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Vous placez 1 000 € à 5 % d'intérêt simple par an. Combien avez-vous après 1 an ?",
    "rawAns": "1 050 €",
    "cleanAns": "1 050 €",
    "show": "1 050 €",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 050",
      "1",
      "050"
    ],
    "choices": [
      "2 050 €",
      "3 050 €",
      "0 050 €",
      "1 050 €"
    ],
    "correctChoice": "1 050 €"
  },
  {
    "id": 28,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Quel est le coupon annuel en euros d'une obligation de nominal 1 000 € à taux facial de 4 % ?",
    "rawAns": "40 €",
    "cleanAns": "40 €",
    "show": "40 €",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "40"
    ],
    "choices": [
      "40 €",
      "50 €",
      "20 €",
      "32 €"
    ],
    "correctChoice": "40 €"
  },
  {
    "id": 29,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel est l'actif considéré comme la valeur refuge historique par excellence en cas de crise ?",
    "rawAns": "L'Or",
    "cleanAns": "L'Or",
    "show": "L'Or",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "l or"
    ],
    "choices": [
      "Le Cuivre",
      "Le Pétrole brut",
      "L'Immobilier parisien",
      "L'Or"
    ],
    "correctChoice": "L'Or"
  },
  {
    "id": 30,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel indice boursier américain est fortement concentré sur les valeurs technologiques ?",
    "rawAns": "Le Nasdaq",
    "cleanAns": "Le Nasdaq",
    "show": "Le Nasdaq",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "le nasdaq"
    ],
    "choices": [
      "Le Dow Jones Industrial",
      "Le Nasdaq",
      "Le Russell 2000",
      "Le S&P 500"
    ],
    "correctChoice": "Le Nasdaq"
  },
  {
    "id": 31,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel est l'indice boursier phare de la Bourse de Londres ?",
    "rawAns": "Le FTSE 100 (Footsie)",
    "cleanAns": "Le FTSE 100",
    "show": "Le FTSE 100 (Footsie)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le ftse 100 footsie",
      "le ftse 100",
      "100"
    ],
    "choices": [
      "Le DAX 40",
      "L'AEX",
      "Le FTSE 100",
      "Le SMI"
    ],
    "correctChoice": "Le FTSE 100"
  },
  {
    "id": 32,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel est l'indice boursier phare de la Bourse de Tokyo ?",
    "rawAns": "Le Nikkei 225",
    "cleanAns": "Le Nikkei 225",
    "show": "Le Nikkei 225",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le nikkei 225",
      "225"
    ],
    "choices": [
      "Le Nikkei 225",
      "Le TOPIX",
      "Le KOSPI",
      "Le Hang Seng"
    ],
    "correctChoice": "Le Nikkei 225"
  },
  {
    "id": 33,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on l'écart entre le prix d'achat (Bid) et le prix de vente (Ask) ?",
    "rawAns": "Le Spread",
    "cleanAns": "Le Spread",
    "show": "Le Spread",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le spread"
    ],
    "choices": [
      "Le Spread",
      "Le Ratio Sharpe",
      "La Prime de liquidité",
      "Le Slippage"
    ],
    "correctChoice": "Le Spread"
  },
  {
    "id": 34,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Si le Bid est à 99,50 € et l'Ask à 100,00 €, quel est le spread ?",
    "rawAns": "0,50 € (50 centimes)",
    "cleanAns": "0,50 €",
    "show": "0,50 € (50 centimes)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "0 50 50 centimes",
      "0 50",
      "0.50",
      "0,50"
    ],
    "choices": [
      "0,50 €",
      "0,40 €",
      "0,63 €",
      "0,25 €"
    ],
    "correctChoice": "0,50 €"
  },
  {
    "id": 35,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie P&L en salle des marchés ?",
    "rawAns": "Profit and Loss (Pertes et Profits)",
    "cleanAns": "Profit and Loss",
    "show": "Profit and Loss (Pertes et Profits)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "profit and loss pertes et profits",
      "profit and loss"
    ],
    "choices": [
      "Payment and Loans",
      "Price and Leverage",
      "Profit and Loss",
      "Position and Liquidity"
    ],
    "correctChoice": "Profit and Loss"
  },
  {
    "id": 36,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quelle agence de notation fait partie du \"Big Three\" avec Moody's et Fitch ?",
    "rawAns": "Standard & Poor's (S&P)",
    "cleanAns": "Standard & Poor's",
    "show": "Standard & Poor's (S&P)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "standard poor s s p",
      "standard poor s",
      "s&p",
      "sp",
      "standard and poor"
    ],
    "choices": [
      "Morningstar",
      "Goldman Sachs",
      "Bloomberg Ratings",
      "Standard & Poor's"
    ],
    "correctChoice": "Standard & Poor's"
  },
  {
    "id": 37,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on une obligation émise par l'État français à long terme ?",
    "rawAns": "Une OAT (Obligation Assimilable du Trésor)",
    "cleanAns": "Une OAT",
    "show": "Une OAT (Obligation Assimilable du Trésor)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "une oat obligation assimilable du tresor",
      "une oat"
    ],
    "choices": [
      "Un T-Bond",
      "Un Bon du Trésor (BTF)",
      "Une OAT",
      "Une Obligation Verte"
    ],
    "correctChoice": "Une OAT"
  },
  {
    "id": 38,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on une obligation à haut rendement mais à risque élevé de défaut ?",
    "rawAns": "High Yield (ou Junk Bond / Obligation spéculative)",
    "cleanAns": "High Yield",
    "show": "High Yield (ou Junk Bond / Obligation spéculative)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "high yield ou junk bond obligation speculative",
      "high yield"
    ],
    "choices": [
      "Covered Bond",
      "High Yield",
      "Sovereign Debt",
      "Investment Grade"
    ],
    "correctChoice": "High Yield"
  },
  {
    "id": 39,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Si l'inflation est de 4 % et que votre salaire augmente de 4 %, comment évolue votre pouvoir d'achat ?",
    "rawAns": "Il reste stable (0 %)",
    "cleanAns": "Il reste stable",
    "show": "Il reste stable (0 %)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "il reste stable 0",
      "il reste stable"
    ],
    "choices": [
      "Il reste stable",
      "Donnée insuffisante",
      "Non concerné",
      "Aucune des réponses"
    ],
    "correctChoice": "Il reste stable"
  },
  {
    "id": 40,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel terme désigne une baisse générale et durable des prix dans une économie ?",
    "rawAns": "La déflation",
    "cleanAns": "La déflation",
    "show": "La déflation",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "la deflation"
    ],
    "choices": [
      "L'hyperinflation",
      "La déflation",
      "La stagflation",
      "La désinflation"
    ],
    "correctChoice": "La déflation"
  },
  {
    "id": 41,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie l'acronyme PIB ?",
    "rawAns": "Produit Intérieur Brut",
    "cleanAns": "Produit Intérieur Brut",
    "show": "Produit Intérieur Brut",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "produit interieur brut"
    ],
    "choices": [
      "Patrimoine Interbancaire Brut",
      "Partage Interne des Bénéfices",
      "Production Industrielle de Base",
      "Produit Intérieur Brut"
    ],
    "correctChoice": "Produit Intérieur Brut"
  },
  {
    "id": 42,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Combien de trimestres consécutifs de baisse du PIB définissent techniquement une récession ?",
    "rawAns": "2 trimestres",
    "cleanAns": "2 trimestres",
    "show": "2 trimestres",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "2 trimestres",
      "2"
    ],
    "choices": [
      "1 trimestres",
      "2 trimestres",
      "1,6 trimestres",
      "2,5 trimestres"
    ],
    "correctChoice": "2 trimestres"
  },
  {
    "id": 43,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Une action cote 40 € et verse un dividende de 2 €. Quel est son rendement du dividende (Dividend Yield) ?",
    "rawAns": "5 % (2 / 40)",
    "cleanAns": "5 %",
    "show": "5 % (2 / 40)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "5 2 40",
      "5"
    ],
    "choices": [
      "6,3 %",
      "4 %",
      "2,5 %",
      "5 %"
    ],
    "correctChoice": "5 %"
  },
  {
    "id": 44,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Que signifie l'acronyme ETF ?",
    "rawAns": "Exchange Traded Fund (Fonds indiciel coté / Tracker)",
    "cleanAns": "Exchange Traded Fund",
    "show": "Exchange Traded Fund (Fonds indiciel coté / Tracker)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "exchange traded fund fonds indiciel cote tracker",
      "exchange traded fund"
    ],
    "choices": [
      "Exchange Traded Fund",
      "Equity Trading Floor",
      "Eurobond Target File",
      "Electronic Transfer Fund"
    ],
    "correctChoice": "Exchange Traded Fund"
  },
  {
    "id": 45,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quel marché financier est le plus liquide au monde avec des milliers de milliards échangés par jour ?",
    "rawAns": "Le Forex (Marché des changes)",
    "cleanAns": "Le Forex",
    "show": "Le Forex (Marché des changes)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le forex marche des changes",
      "le forex"
    ],
    "choices": [
      "Le Forex",
      "Le marché des actions (Equities)",
      "Le marché des matières premières",
      "Le marché obligataire"
    ],
    "correctChoice": "Le Forex"
  },
  {
    "id": 46,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Quelle matière première est cotée sous les références \"Brent\" et \"WTI\" ?",
    "rawAns": "Le pétrole brut",
    "cleanAns": "Le pétrole brut",
    "show": "Le pétrole brut",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "le petrole brut"
    ],
    "choices": [
      "Le blé et le maïs",
      "Le gaz naturel",
      "Le pétrole brut",
      "L'or et l'argent"
    ],
    "correctChoice": "Le pétrole brut"
  },
  {
    "id": 47,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Combien y a-t-il d'onces troy environ dans un lingot d'or de 1 kg (à l'unité près) ?",
    "rawAns": "32 onces (32,15)",
    "cleanAns": "32 onces",
    "show": "32 onces (32,15)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "32 onces 32 15",
      "32 onces",
      "32"
    ],
    "choices": [
      "16 onces",
      "32 onces",
      "40 onces",
      "25,6 onces"
    ],
    "correctChoice": "32 onces"
  },
  {
    "id": 48,
    "cat": "Finance",
    "level": "facile",
    "time": 20,
    "text": "Si EUR/USD = 1,10, combien de dollars obtenez-vous avec 100 euros ?",
    "rawAns": "110 dollars",
    "cleanAns": "110 dollars",
    "show": "110 dollars",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "110 dollars",
      "110"
    ],
    "choices": [
      "110 dollars",
      "137,5 dollars",
      "55 dollars",
      "88 dollars"
    ],
    "correctChoice": "110 dollars"
  },
  {
    "id": 49,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on un ordre de bourse qui s'exécute immédiatement au meilleur prix disponible ?",
    "rawAns": "Un ordre au marché (Market order)",
    "cleanAns": "Un ordre au marché",
    "show": "Un ordre au marché (Market order)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "un ordre au marche market order",
      "un ordre au marche"
    ],
    "choices": [
      "Un ordre à cours limité",
      "Un ordre au marché",
      "Un ordre stop (seuil)",
      "Un ordre iceberg"
    ],
    "correctChoice": "Un ordre au marché"
  },
  {
    "id": 50,
    "cat": "Finance",
    "level": "facile",
    "time": 15,
    "text": "Comment appelle-t-on une entreprise non cotée valorisée à plus d'un milliard de dollars ?",
    "rawAns": "Une Licorne",
    "cleanAns": "Une Licorne",
    "show": "Une Licorne",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "une licorne"
    ],
    "choices": [
      "Une Licorne",
      "Un Centaure",
      "Un Décacorne",
      "Un Minotaure"
    ],
    "correctChoice": "Une Licorne"
  },
  {
    "id": 51,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 7 x 8 ?",
    "rawAns": "56",
    "cleanAns": "56",
    "show": "56",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "56"
    ],
    "choices": [
      "56",
      "44,8",
      "70",
      "28"
    ],
    "correctChoice": "56"
  },
  {
    "id": 52,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 15 % de 200 ?",
    "rawAns": "30",
    "cleanAns": "30",
    "show": "30",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "30"
    ],
    "choices": [
      "30",
      "37,5",
      "15",
      "24"
    ],
    "correctChoice": "30"
  },
  {
    "id": 53,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quel est le quart de 120 ?",
    "rawAns": "30",
    "cleanAns": "30",
    "show": "30",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "30"
    ],
    "choices": [
      "15",
      "24",
      "30",
      "37,5"
    ],
    "correctChoice": "30"
  },
  {
    "id": 54,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 140 + 270 ?",
    "rawAns": "410",
    "cleanAns": "410",
    "show": "410",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "410"
    ],
    "choices": [
      "410",
      "512,5",
      "205",
      "328"
    ],
    "correctChoice": "410"
  },
  {
    "id": 55,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Résolvez : 100 - 37",
    "rawAns": "63",
    "cleanAns": "63",
    "show": "63",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "63"
    ],
    "choices": [
      "31,5",
      "63",
      "50,4",
      "78,8"
    ],
    "correctChoice": "63"
  },
  {
    "id": 56,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quel est le carré de 12 ?",
    "rawAns": "144",
    "cleanAns": "144",
    "show": "144",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "144"
    ],
    "choices": [
      "144",
      "180",
      "115,2",
      "72"
    ],
    "correctChoice": "144"
  },
  {
    "id": 57,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la racine carrée de 81 ?",
    "rawAns": "9",
    "cleanAns": "9",
    "show": "9",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "9"
    ],
    "choices": [
      "9",
      "7,2",
      "11,3",
      "4,5"
    ],
    "correctChoice": "9"
  },
  {
    "id": 58,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien de minutes y a-t-il dans 2 heures et demie ?",
    "rawAns": "150 minutes",
    "cleanAns": "150 minutes",
    "show": "150 minutes",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "150 minutes",
      "150"
    ],
    "choices": [
      "150 minutes",
      "120 minutes",
      "187,5 minutes",
      "75 minutes"
    ],
    "correctChoice": "150 minutes"
  },
  {
    "id": 59,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Si 4 cafés coûtent 8 €, combien coûtent 7 cafés ?",
    "rawAns": "14 €",
    "cleanAns": "14 €",
    "show": "14 €",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "14"
    ],
    "choices": [
      "14 €",
      "11,2 €",
      "17,5 €",
      "7 €"
    ],
    "correctChoice": "14 €"
  },
  {
    "id": 60,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Résolvez : 5 + 5 x 5",
    "rawAns": "30 (Priorité à la multiplication)",
    "cleanAns": "30",
    "show": "30 (Priorité à la multiplication)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "30 priorite a la multiplication",
      "30"
    ],
    "choices": [
      "15",
      "24",
      "30",
      "37,5"
    ],
    "correctChoice": "30"
  },
  {
    "id": 61,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quel nombre divisé par 6 donne 7 ?",
    "rawAns": "42",
    "cleanAns": "42",
    "show": "42",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "42"
    ],
    "choices": [
      "42",
      "33,6",
      "52,5",
      "21"
    ],
    "correctChoice": "42"
  },
  {
    "id": 62,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 25 % de 80 ?",
    "rawAns": "20",
    "cleanAns": "20",
    "show": "20",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "20"
    ],
    "choices": [
      "20",
      "25",
      "16",
      "10"
    ],
    "correctChoice": "20"
  },
  {
    "id": 63,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la moitié de 350 ?",
    "rawAns": "175",
    "cleanAns": "175",
    "show": "175",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "175"
    ],
    "choices": [
      "175",
      "140",
      "87,5",
      "218,8"
    ],
    "correctChoice": "175"
  },
  {
    "id": 64,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 9 x 12 ?",
    "rawAns": "108",
    "cleanAns": "108",
    "show": "108",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "108"
    ],
    "choices": [
      "54",
      "108",
      "135",
      "86,4"
    ],
    "correctChoice": "108"
  },
  {
    "id": 65,
    "cat": "Calcul",
    "level": "facile",
    "time": 20,
    "text": "Quelle est la moyenne de 10, 20 et 30 ?",
    "rawAns": "20",
    "cleanAns": "20",
    "show": "20",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "20"
    ],
    "choices": [
      "16",
      "10",
      "20",
      "25"
    ],
    "correctChoice": "20"
  },
  {
    "id": 66,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Complétez la suite : 2 - 4 - 6 - 8 - ?",
    "rawAns": "10",
    "cleanAns": "10",
    "show": "10",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "10"
    ],
    "choices": [
      "10",
      "12,5",
      "5",
      "8"
    ],
    "correctChoice": "10"
  },
  {
    "id": 67,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Complétez la suite : 5 - 10 - 20 - 40 - ?",
    "rawAns": "80",
    "cleanAns": "80",
    "show": "80",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "80"
    ],
    "choices": [
      "64",
      "80",
      "100",
      "40"
    ],
    "correctChoice": "80"
  },
  {
    "id": 68,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Complétez la suite : 100 - 90 - 80 - 70 - ?",
    "rawAns": "60",
    "cleanAns": "60",
    "show": "60",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "60"
    ],
    "choices": [
      "30",
      "48",
      "60",
      "75"
    ],
    "correctChoice": "60"
  },
  {
    "id": 69,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Complétez la suite : A - C - E - G - ?",
    "rawAns": "I",
    "cleanAns": "I",
    "show": "I",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "i"
    ],
    "choices": [
      "I",
      "Aucune des réponses",
      "Donnée insuffisante",
      "Non concerné"
    ],
    "correctChoice": "I"
  },
  {
    "id": 70,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Complétez la suite : L - M - M - J - V - S - ?",
    "rawAns": "D (Dimanche)",
    "cleanAns": "D",
    "show": "D (Dimanche)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "d dimanche",
      "d"
    ],
    "choices": [
      "V",
      "D",
      "L",
      "M"
    ],
    "correctChoice": "D"
  },
  {
    "id": 71,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Si vous dépassez le deuxième dans une course, à quelle place êtes-vous ?",
    "rawAns": "Deuxième",
    "cleanAns": "Deuxième",
    "show": "Deuxième",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "deuxieme"
    ],
    "choices": [
      "Quatrième",
      "Deuxième",
      "Troisième",
      "Premier"
    ],
    "correctChoice": "Deuxième"
  },
  {
    "id": 72,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Le père de Clara a 4 filles : Lala, Lélé, Lili. Comment s'appelle la quatrième ?",
    "rawAns": "Clara",
    "cleanAns": "Clara",
    "show": "Clara",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "clara"
    ],
    "choices": [
      "Loulou",
      "Clémence",
      "Clara",
      "Chloé"
    ],
    "correctChoice": "Clara"
  },
  {
    "id": 73,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Combien de mois dans l'année ont 28 jours ?",
    "rawAns": "12 (Tous les mois en ont au moins 28)",
    "cleanAns": "12",
    "show": "12 (Tous les mois en ont au moins 28)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "12 tous les mois en ont au moins 28",
      "12"
    ],
    "choices": [
      "12",
      "15",
      "9,6",
      "6"
    ],
    "correctChoice": "12"
  },
  {
    "id": 74,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Chassez l'intrus : Rouge - Bleu - Carré - Vert",
    "rawAns": "Carré (C'est une forme, pas une couleur)",
    "cleanAns": "Carré",
    "show": "Carré (C'est une forme, pas une couleur)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "carre c est une forme pas une couleur",
      "carre"
    ],
    "choices": [
      "Bleu",
      "Rouge",
      "Carré",
      "Vert"
    ],
    "correctChoice": "Carré"
  },
  {
    "id": 75,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Chassez l'intrus : 2 - 4 - 8 - 9 - 10",
    "rawAns": "9 (C'est le seul nombre impair)",
    "cleanAns": "9",
    "show": "9 (C'est le seul nombre impair)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "9 c est le seul nombre impair",
      "9"
    ],
    "choices": [
      "4",
      "8",
      "9",
      "2"
    ],
    "correctChoice": "9"
  },
  {
    "id": 76,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Sur un dé standard à 6 faces, quel chiffre est sur la face opposée au 1 ?",
    "rawAns": "6 (La somme des faces opposées vaut 7)",
    "cleanAns": "6",
    "show": "6 (La somme des faces opposées vaut 7)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "6 la somme des faces opposees vaut 7",
      "6"
    ],
    "choices": [
      "2",
      "3",
      "5",
      "6"
    ],
    "correctChoice": "6"
  },
  {
    "id": 77,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Combien de côtés possède un octogone ?",
    "rawAns": "8",
    "cleanAns": "8",
    "show": "8",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "8"
    ],
    "choices": [
      "8",
      "6,4",
      "10",
      "4"
    ],
    "correctChoice": "8"
  },
  {
    "id": 78,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Un fermier a 15 vaches. Toutes meurent sauf 8. Combien lui en reste-t-il ?",
    "rawAns": "8",
    "cleanAns": "8",
    "show": "8",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "8"
    ],
    "choices": [
      "4",
      "8",
      "6,4",
      "10"
    ],
    "correctChoice": "8"
  },
  {
    "id": 79,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Les deux nombres suivants sont-ils identiques : 49281 et 49218 ?",
    "rawAns": "Non",
    "cleanAns": "Non",
    "show": "Non",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "non"
    ],
    "choices": [
      "Non",
      "Oui",
      "Seulement le premier",
      "Impossible à dire"
    ],
    "correctChoice": "Non"
  },
  {
    "id": 80,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Combien y a-t-il de lettres dans le mot « BANQUE » ?",
    "rawAns": "6",
    "cleanAns": "6",
    "show": "6",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "6"
    ],
    "choices": [
      "4,8",
      "7,5",
      "3",
      "6"
    ],
    "correctChoice": "6"
  },
  {
    "id": 81,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Épelez le mot « EURO » à l'envers.",
    "rawAns": "ORUE",
    "cleanAns": "ORUE",
    "show": "ORUE",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "orue"
    ],
    "choices": [
      "ORUE",
      "OREU",
      "ROUE",
      "EORU"
    ],
    "correctChoice": "ORUE"
  },
  {
    "id": 82,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la troisième voyelle de l'alphabet ?",
    "rawAns": "I (A, E, I)",
    "cleanAns": "I",
    "show": "I (A, E, I)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "i a e i",
      "i"
    ],
    "choices": [
      "A",
      "I",
      "E",
      "O"
    ],
    "correctChoice": "I"
  },
  {
    "id": 83,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Combien de fois apparaît le chiffre 3 dans : 39230313 ?",
    "rawAns": "4 fois",
    "cleanAns": "4 fois",
    "show": "4 fois",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "4 fois",
      "4"
    ],
    "choices": [
      "2 fois",
      "4 fois",
      "5 fois",
      "3,2 fois"
    ],
    "correctChoice": "4 fois"
  },
  {
    "id": 84,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quel est le triple de 15 ?",
    "rawAns": "45",
    "cleanAns": "45",
    "show": "45",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "45"
    ],
    "choices": [
      "36",
      "45",
      "22,5",
      "56,3"
    ],
    "correctChoice": "45"
  },
  {
    "id": 85,
    "cat": "Calcul",
    "level": "facile",
    "time": 20,
    "text": "Un train part à 08h50 et arrive à 09h25. Combien de minutes a duré le trajet ?",
    "rawAns": "35 minutes",
    "cleanAns": "35 minutes",
    "show": "35 minutes",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "35 minutes",
      "35"
    ],
    "choices": [
      "43,8 minutes",
      "28 minutes",
      "35 minutes",
      "17,5 minutes"
    ],
    "correctChoice": "35 minutes"
  },
  {
    "id": 86,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien de centimes y a-t-il dans 4,50 € ?",
    "rawAns": "450 centimes",
    "cleanAns": "450 centimes",
    "show": "450 centimes",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "450 centimes",
      "450"
    ],
    "choices": [
      "225 centimes",
      "360 centimes",
      "450 centimes",
      "562,5 centimes"
    ],
    "correctChoice": "450 centimes"
  },
  {
    "id": 87,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Qui est le plus lourd : 1 kg de plumes ou 1 kg de plomb ?",
    "rawAns": "Ils ont le même poids (1 kg)",
    "cleanAns": "Ils ont le même poids",
    "show": "Ils ont le même poids (1 kg)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "ils ont le meme poids 1 kg",
      "ils ont le meme poids"
    ],
    "choices": [
      "Ils ont le même poids",
      "Le plomb",
      "Impossible sans balance",
      "Les plumes"
    ],
    "correctChoice": "Ils ont le même poids"
  },
  {
    "id": 88,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Vous regardez vers le Sud et faites un demi-tour (180°). Vers où regardez-vous ?",
    "rawAns": "Vers le Nord",
    "cleanAns": "Vers le Nord",
    "show": "Vers le Nord",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "vers le nord"
    ],
    "choices": [
      "Vers l'Est",
      "Vers le Sud-Ouest",
      "Vers le Nord",
      "Vers l'Ouest"
    ],
    "correctChoice": "Vers le Nord"
  },
  {
    "id": 89,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Si hier était mardi, quel jour serons-nous demain ?",
    "rawAns": "Jeudi",
    "cleanAns": "Jeudi",
    "show": "Jeudi",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "jeudi"
    ],
    "choices": [
      "Jeudi",
      "Vendredi",
      "Samedi",
      "Mercredi"
    ],
    "correctChoice": "Jeudi"
  },
  {
    "id": 90,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la probabilité de tirer « Pile » sur un lancer de pièce équilibrée ?",
    "rawAns": "1/2 (ou 50 %)",
    "cleanAns": "1/2",
    "show": "1/2 (ou 50 %)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "1 2 ou 50",
      "1 2",
      "1",
      "2"
    ],
    "choices": [
      "2 /2",
      "3 /2",
      "1/2",
      "0 /2"
    ],
    "correctChoice": "1/2"
  },
  {
    "id": 91,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Quelle est la probabilité de faire un 6 avec un dé équilibré à 6 faces ?",
    "rawAns": "1/6",
    "cleanAns": "1/6",
    "show": "1/6",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "1 6",
      "1",
      "6"
    ],
    "choices": [
      "1/6",
      "0 /6",
      "2 /6",
      "3 /6"
    ],
    "correctChoice": "1/6"
  },
  {
    "id": 92,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Chassez l'intrus : Euro - Dollar - Yen - Bitcoin - Livre Sterling",
    "rawAns": "Bitcoin (Cryptomonnaie, pas une devise étatique)",
    "cleanAns": "Bitcoin",
    "show": "Bitcoin (Cryptomonnaie, pas une devise étatique)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "bitcoin cryptomonnaie pas une devise etatique",
      "bitcoin"
    ],
    "choices": [
      "Euro",
      "Bitcoin",
      "Dollar",
      "Livre Sterling"
    ],
    "correctChoice": "Bitcoin"
  },
  {
    "id": 93,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Si le mot « VERT » est écrit en rouge, quelle est la couleur de l'encre ?",
    "rawAns": "Rouge",
    "cleanAns": "Rouge",
    "show": "Rouge",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "rouge"
    ],
    "choices": [
      "Rouge",
      "Noir",
      "Incolore",
      "Vert"
    ],
    "correctChoice": "Rouge"
  },
  {
    "id": 94,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 11 x 11 ?",
    "rawAns": "121",
    "cleanAns": "121",
    "show": "121",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "121"
    ],
    "choices": [
      "121",
      "96,8",
      "151,3",
      "60,5"
    ],
    "correctChoice": "121"
  },
  {
    "id": 95,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Résolvez : 48 divisé par 6",
    "rawAns": "8",
    "cleanAns": "8",
    "show": "8",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "8"
    ],
    "choices": [
      "10",
      "4",
      "8",
      "6,4"
    ],
    "correctChoice": "8"
  },
  {
    "id": 96,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Combien d'angles droits possède un rectangle ?",
    "rawAns": "4",
    "cleanAns": "4",
    "show": "4",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "4"
    ],
    "choices": [
      "2",
      "4",
      "5",
      "3,2"
    ],
    "correctChoice": "4"
  },
  {
    "id": 97,
    "cat": "Attention",
    "level": "facile",
    "time": 15,
    "text": "Quel chiffre manque dans cette suite de 1 à 6 : 4 - 2 - 6 - 1 - 3 ?",
    "rawAns": "5",
    "cleanAns": "5",
    "show": "5",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "5"
    ],
    "choices": [
      "4",
      "2,5",
      "5",
      "6,3"
    ],
    "correctChoice": "5"
  },
  {
    "id": 98,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Si x + 12 = 20, combien vaut x ?",
    "rawAns": "8",
    "cleanAns": "8",
    "show": "8",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "8"
    ],
    "choices": [
      "10",
      "4",
      "8",
      "6,4"
    ],
    "correctChoice": "8"
  },
  {
    "id": 99,
    "cat": "Logique",
    "level": "facile",
    "time": 15,
    "text": "Dans quel sens tourne l'aiguille d'une montre si on la regarde dans un miroir ?",
    "rawAns": "Sens inverse des aiguilles d'une montre (Sens anti-horaire)",
    "cleanAns": "Sens inverse des aiguilles d'une montre",
    "show": "Sens inverse des aiguilles d'une montre (Sens anti-horaire)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "sens inverse des aiguilles d une montre sens anti horaire",
      "sens inverse des aiguilles d une montre"
    ],
    "choices": [
      "Sens inverse des aiguilles d'une montre",
      "Aléatoire",
      "Sens des aiguilles d'une montre",
      "Aucun sens"
    ],
    "correctChoice": "Sens inverse des aiguilles d'une montre"
  },
  {
    "id": 100,
    "cat": "Calcul",
    "level": "facile",
    "time": 15,
    "text": "Combien font 10 puissance 3 ($10^3$) ?",
    "rawAns": "1 000",
    "cleanAns": "1 000",
    "show": "1 000",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "1 000",
      "1",
      "000"
    ],
    "choices": [
      "0 000",
      "1 000",
      "2 000",
      "3 000"
    ],
    "correctChoice": "1 000"
  },
  {
    "id": 101,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une action a un cours de 75 € et un Bénéfice Par Action (BPA) de 5 €. Quel est son PER ?",
    "rawAns": "15",
    "cleanAns": "15",
    "show": "15",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "15"
    ],
    "choices": [
      "15",
      "12",
      "18,8",
      "7,5"
    ],
    "correctChoice": "15"
  },
  {
    "id": 102,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une obligation de nominal 1 000 € verse un coupon de 40 € et cote 800 €. Quel est son Current Yield (rendement courant) ?",
    "rawAns": "5 % (40 / 800)",
    "cleanAns": "5 %",
    "show": "5 % (40 / 800)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "5 40 800",
      "5"
    ],
    "choices": [
      "5 %",
      "6,3 %",
      "4 %",
      "2,5 %"
    ],
    "correctChoice": "5 %"
  },
  {
    "id": 103,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "La capitalisation boursière d'une société est de 400 M€, sa dette de 120 M€ et sa trésorerie de 40 M€. Quelle est sa Valeur d'Entreprise (EV) ?",
    "rawAns": "480 M€ (400 + 120 - 40)",
    "cleanAns": "480 M€",
    "show": "480 M€ (400 + 120 - 40)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "480 m 400 120 40",
      "480 m",
      "480"
    ],
    "choices": [
      "240 M€",
      "384 M€",
      "480 M€",
      "600 M€"
    ],
    "correctChoice": "480 M€"
  },
  {
    "id": 104,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Que mesure le coefficient Bêta ($\\beta$) d'une action ?",
    "rawAns": "Sa sensibilité (ou volatilité relative) aux variations du marché",
    "cleanAns": "Sa sensibilité",
    "show": "Sa sensibilité (ou volatilité relative) aux variations du marché",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "sa sensibilite ou volatilite relative aux variations du marche",
      "sa sensibilite"
    ],
    "choices": [
      "Son niveau d'endettement",
      "Son dividende moyen",
      "Son rendement obligataire",
      "Sa sensibilité"
    ],
    "correctChoice": "Sa sensibilité"
  },
  {
    "id": 105,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Si une action a un Bêta de 1,5 et que le marché monte de 2 %, de combien monte théoriquement l'action ?",
    "rawAns": "+3 %",
    "cleanAns": "+3 %",
    "show": "+3 %",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "3",
      "+3"
    ],
    "choices": [
      "3,8 %",
      "1,5 %",
      "+3 %",
      "2,4 %"
    ],
    "correctChoice": "+3 %"
  },
  {
    "id": 106,
    "cat": "Finance",
    "level": "normal",
    "time": 30,
    "text": "Taux sans risque = 2 %, Prime de risque du marché = 6 %, Bêta = 1,5. Quel est le coût des capitaux propres selon le MEDAF (CAPM) ?",
    "rawAns": "11 % (2 % + 1,5 x 6 %)",
    "cleanAns": "11 %",
    "show": "11 % (2 % + 1,5 x 6 %)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "11 2 1 5 x 6",
      "11"
    ],
    "choices": [
      "13,8 %",
      "5,5 %",
      "11 %",
      "8,8 %"
    ],
    "correctChoice": "11 %"
  },
  {
    "id": 107,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Un fonds a un rendement de 12 %, une volatilité de 10 % et le taux sans risque est de 2 %. Quel est son ratio de Sharpe ?",
    "rawAns": "1,0 ((12 - 2) / 10)",
    "cleanAns": "1,0",
    "show": "1,0 ((12 - 2) / 10)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "1 0 12 2 10",
      "1 0",
      "1.0",
      "1,0"
    ],
    "choices": [
      "1,0",
      "0",
      "2",
      "3"
    ],
    "correctChoice": "1,0"
  },
  {
    "id": 108,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Le coût de la dette avant impôt est de 8 % et le taux d'IS est de 25 %. Quel est le coût de la dette après impôt ?",
    "rawAns": "6 % (8 % x (1 - 0,25))",
    "cleanAns": "6 %",
    "show": "6 % (8 % x (1 - 0,25))",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "6 8 x 1 0 25",
      "6"
    ],
    "choices": [
      "6 %",
      "4,8 %",
      "7,5 %",
      "3 %"
    ],
    "correctChoice": "6 %"
  },
  {
    "id": 109,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Que signifie l'acronyme WACC en Corporate Finance ?",
    "rawAns": "Weighted Average Cost of Capital (CMPC)",
    "cleanAns": "Weighted Average Cost of Capital",
    "show": "Weighted Average Cost of Capital (CMPC)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "weighted average cost of capital cmpc",
      "weighted average cost of capital"
    ],
    "choices": [
      "Weighted Absolute Credit Charge",
      "Working Asset Capital Core",
      "Weighted Average Cost of Capital",
      "World Asset Cost Calculation"
    ],
    "correctChoice": "Weighted Average Cost of Capital"
  },
  {
    "id": 110,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Que signifie l'acronyme EBITDA ?",
    "rawAns": "Earnings Before Interest, Taxes, Depreciation, and Amortization",
    "cleanAns": "Earnings Before Interest, Taxes, Depreciation, and Amortization",
    "show": "Earnings Before Interest, Taxes, Depreciation, and Amortization",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "earnings before interest taxes depreciation and amortization"
    ],
    "choices": [
      "Equity Before Interest, Tax and Debt",
      "Enterprise Benefit In Trade Accounts",
      "Earnings Balanced In Total Deals",
      "Earnings Before Interest, Taxes, Depreciation, and Amortization"
    ],
    "correctChoice": "Earnings Before Interest, Taxes, Depreciation, and Amortization"
  },
  {
    "id": 111,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Quelle est la différence comptable entre l'EBITDA et l'EBIT ?",
    "rawAns": "Les dotations aux amortissements et provisions (D&A)",
    "cleanAns": "Les dotations aux amortissements et provisions",
    "show": "Les dotations aux amortissements et provisions (D&A)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "les dotations aux amortissements et provisions d a",
      "les dotations aux amortissements et provisions"
    ],
    "choices": [
      "Les charges financières d'intérêts",
      "Les dotations aux amortissements et provisions",
      "Le chiffre d'affaires",
      "Les impôts sur les sociétés"
    ],
    "correctChoice": "Les dotations aux amortissements et provisions"
  },
  {
    "id": 112,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Vous achetez un Call Strike 50 € pour une prime de 4 €. À l'échéance, l'action vaut 60 €. Quel est votre profit net ?",
    "rawAns": "6 € ((60 - 50) - 4)",
    "cleanAns": "6 €",
    "show": "6 € ((60 - 50) - 4)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "6 60 50 4",
      "6"
    ],
    "choices": [
      "6 €",
      "4,8 €",
      "7,5 €",
      "3 €"
    ],
    "correctChoice": "6 €"
  },
  {
    "id": 113,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Vous achetez un Put Strike 100 € pour une prime de 6 €. À l'échéance, l'action vaut 110 €. Quel est votre résultat net ?",
    "rawAns": "-6 € (Perte de la prime, option non exercée)",
    "cleanAns": "-6 €",
    "show": "-6 € (Perte de la prime, option non exercée)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "6 perte de la prime option non exercee",
      "6",
      "-6"
    ],
    "choices": [
      "-6 €",
      "-5 €",
      "-4 €",
      "-3 €"
    ],
    "correctChoice": "-6 €"
  },
  {
    "id": 114,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "À quel prix de l'action atteint-on le point mort (Break-even) sur l'achat d'un Call de Strike 80 € payé 5 € ?",
    "rawAns": "85 €",
    "cleanAns": "85 €",
    "show": "85 €",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "85"
    ],
    "choices": [
      "68 €",
      "42,5 €",
      "85 €",
      "106,3 €"
    ],
    "correctChoice": "85 €"
  },
  {
    "id": 115,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quelle lettre grecque mesure la sensibilité du prix d'une option à une variation de 1 € du sous-jacent ?",
    "rawAns": "Le Delta ($\\Delta$)",
    "cleanAns": "Le Delta",
    "show": "Le Delta ($\\Delta$)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le delta delta",
      "le delta"
    ],
    "choices": [
      "Le Véga",
      "Le Delta",
      "Le Gamma",
      "Le Thêta"
    ],
    "correctChoice": "Le Delta"
  },
  {
    "id": 116,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quelle lettre grecque mesure la perte de valeur d'une option liée à l'écoulement du temps (Time Decay) ?",
    "rawAns": "Le Thêta ($\\Theta$)",
    "cleanAns": "Le Thêta",
    "show": "Le Thêta ($\\Theta$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le theta theta",
      "le theta"
    ],
    "choices": [
      "Le Véga",
      "Le Thêta",
      "Le Delta",
      "Le Rhô"
    ],
    "correctChoice": "Le Thêta"
  },
  {
    "id": 117,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quelle lettre grecque mesure la sensibilité d'une option à la volatilité implicite ?",
    "rawAns": "Le Véga ($\\nu$)",
    "cleanAns": "Le Véga",
    "show": "Le Véga ($\\nu$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le vega nu",
      "le vega"
    ],
    "choices": [
      "Le Véga",
      "Le Gamma",
      "Le Delta",
      "Le Thêta"
    ],
    "correctChoice": "Le Véga"
  },
  {
    "id": 118,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quelle est la valeur approximative du Delta d'un Call à la monnaie (At-The-Money) ?",
    "rawAns": "0,5 (ou 50 %)",
    "cleanAns": "0,5",
    "show": "0,5 (ou 50 %)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "0 5 ou 50",
      "0 5",
      "0.5",
      "0,5"
    ],
    "choices": [
      "0,5",
      "0,40",
      "0,63",
      "0,25"
    ],
    "correctChoice": "0,5"
  },
  {
    "id": 119,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Quelle est la différence entre une option européenne et une option américaine ?",
    "rawAns": "L'américaine est exerçable à tout moment, l'européenne uniquement à maturité",
    "cleanAns": "L'américaine est exerçable à tout moment, l'européenne uniquement à maturité",
    "show": "L'américaine est exerçable à tout moment, l'européenne uniquement à maturité",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "l americaine est exercable a tout moment l europeenne uniquement a maturite"
    ],
    "choices": [
      "Aucune différence",
      "L'européenne cote en euros, l'américaine en dollars",
      "L'américaine est exerçable à tout moment, l'européenne uniquement à maturité",
      "L'américaine n'a pas de strike fixe"
    ],
    "correctChoice": "L'américaine est exerçable à tout moment, l'européenne uniquement à maturité"
  },
  {
    "id": 120,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Comment appelle-t-on l'achat simultané d'un Call et d'un Put de même Strike et même maturité ?",
    "rawAns": "Un Straddle (Long Straddle)",
    "cleanAns": "Un Straddle",
    "show": "Un Straddle (Long Straddle)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "un straddle long straddle",
      "un straddle"
    ],
    "choices": [
      "Un Straddle",
      "Un Strangle",
      "Un Butterfly",
      "Un Iron Condor"
    ],
    "correctChoice": "Un Straddle"
  },
  {
    "id": 121,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Selon la règle des 72, en combien d'années environ un capital placé à 6 % par an double-t-il ?",
    "rawAns": "12 ans (72 / 6)",
    "cleanAns": "12 ans",
    "show": "12 ans (72 / 6)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "12 ans 72 6",
      "12 ans",
      "12"
    ],
    "choices": [
      "9,6 ans",
      "6 ans",
      "12 ans",
      "15 ans"
    ],
    "correctChoice": "12 ans"
  },
  {
    "id": 122,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une action passe de 80 € à 100 €, puis baisse de 20 %. Quel est son cours final ?",
    "rawAns": "80 €",
    "cleanAns": "80 €",
    "show": "80 €",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "80"
    ],
    "choices": [
      "100 €",
      "40 €",
      "64 €",
      "80 €"
    ],
    "correctChoice": "80 €"
  },
  {
    "id": 123,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Lorsqu'une action de 100 € détache un dividende de 4 €, à quel cours théorique ouvre-t-elle ?",
    "rawAns": "96 €",
    "cleanAns": "96 €",
    "show": "96 €",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "96"
    ],
    "choices": [
      "96 €",
      "76,8 €",
      "120 €",
      "48 €"
    ],
    "correctChoice": "96 €"
  },
  {
    "id": 124,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel est le risque maximal pour un vendeur d'option Call nue (non couverte) ?",
    "rawAns": "Illimité",
    "cleanAns": "Illimité",
    "show": "Illimité",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "illimite"
    ],
    "choices": [
      "Limité au Strike",
      "Égal à 100 % du cours",
      "Limité au montant de la prime",
      "Illimité"
    ],
    "correctChoice": "Illimité"
  },
  {
    "id": 125,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Quelle est la formule du Besoin en Fonds de Roulement (BFR) opérationnel ?",
    "rawAns": "Stocks + Créances Clients - Dettes Fournisseurs",
    "cleanAns": "Stocks + Créances Clients - Dettes Fournisseurs",
    "show": "Stocks + Créances Clients - Dettes Fournisseurs",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "stocks creances clients dettes fournisseurs"
    ],
    "choices": [
      "Trésorerie Active - Trésorerie Passive",
      "EBITDA - Impôts",
      "Stocks + Créances Clients - Dettes Fournisseurs",
      "Capitaux Propres - Dettes Financières"
    ],
    "correctChoice": "Stocks + Créances Clients - Dettes Fournisseurs"
  },
  {
    "id": 126,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Si le BFR d'une entreprise augmente de 10 M€ sur l'année, quel est l'impact sur son Free Cash Flow ?",
    "rawAns": "Une baisse de 10 M€ (Consommation de cash)",
    "cleanAns": "Une baisse de 10 M€",
    "show": "Une baisse de 10 M€ (Consommation de cash)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "une baisse de 10 m consommation de cash",
      "une baisse de 10 m",
      "10",
      "baisse",
      "il baisse",
      "diminue"
    ],
    "choices": [
      "Donnée insuffisante",
      "Non concerné",
      "Une baisse de 10 M€",
      "Aucune des réponses"
    ],
    "correctChoice": "Une baisse de 10 M€"
  },
  {
    "id": 127,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Un projet coûte 200 € et rapporte 220 € dans un an. Si le taux d'actualisation est de 10 %, quelle est sa VAN (NPV) ?",
    "rawAns": "0 € (-200 + 220 / 1,10)",
    "cleanAns": "0 €",
    "show": "0 € (-200 + 220 / 1,10)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "0 200 220 1 10",
      "0"
    ],
    "choices": [
      "-10 €",
      "0 €",
      "10 €",
      "5 €"
    ],
    "correctChoice": "0 €"
  },
  {
    "id": 128,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Comment s'appelle le taux d'actualisation pour lequel la VAN est égale à zéro ?",
    "rawAns": "Le TRI (Taux de Rentabilité Interne / IRR)",
    "cleanAns": "Le TRI",
    "show": "Le TRI (Taux de Rentabilité Interne / IRR)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le tri taux de rentabilite interne irr",
      "le tri"
    ],
    "choices": [
      "Le Payback",
      "Le TRI",
      "Le WACC",
      "Le Multiple d'EBITDA"
    ],
    "correctChoice": "Le TRI"
  },
  {
    "id": 129,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Que mesure le ratio ROE (Return On Equity) ?",
    "rawAns": "Résultat Net / Capitaux Propres (Rentabilité financière)",
    "cleanAns": "Résultat Net / Capitaux Propres",
    "show": "Résultat Net / Capitaux Propres (Rentabilité financière)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "resultat net capitaux propres rentabilite financiere",
      "resultat net capitaux propres"
    ],
    "choices": [
      "EBIT / Actif Total",
      "Free Cash Flow / Dette",
      "Résultat Net / Capitaux Propres",
      "Chiffre d'Affaires / Capitaux Propres"
    ],
    "correctChoice": "Résultat Net / Capitaux Propres"
  },
  {
    "id": 130,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une entreprise a un Résultat Net de 15 M€ et des Capitaux Propres de 100 M€. Quel est son ROE ?",
    "rawAns": "15 %",
    "cleanAns": "15 %",
    "show": "15 %",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "15"
    ],
    "choices": [
      "7,5 %",
      "15 %",
      "12 %",
      "18,8 %"
    ],
    "correctChoice": "15 %"
  },
  {
    "id": 131,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Comment appelle-t-on une opération de rachat d'entreprise financée majoritairement par de la dette ?",
    "rawAns": "Un LBO (Leveraged Buy-Out)",
    "cleanAns": "Un LBO",
    "show": "Un LBO (Leveraged Buy-Out)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "un lbo leveraged buy out",
      "un lbo"
    ],
    "choices": [
      "Une OPA hostile",
      "Un Spin-off",
      "Un LBO",
      "Un Carve-out"
    ],
    "correctChoice": "Un LBO"
  },
  {
    "id": 132,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Que signifie une courbe des taux inversée (taux courts > taux longs) pour les économistes ?",
    "rawAns": "Un signal avancé de récession économique",
    "cleanAns": "Un signal avancé de récession économique",
    "show": "Un signal avancé de récession économique",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "un signal avance de recession economique"
    ],
    "choices": [
      "Une hyperinflation",
      "Une hausse généralisée du dollar",
      "Un boom économique imminent",
      "Un signal avancé de récession économique"
    ],
    "correctChoice": "Un signal avancé de récession économique"
  },
  {
    "id": 133,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel produit dérivé de crédit permet de s'assurer contre le défaut de paiement d'un émetteur obligataire ?",
    "rawAns": "Un CDS (Credit Default Swap)",
    "cleanAns": "Un CDS",
    "show": "Un CDS (Credit Default Swap)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "un cds credit default swap",
      "un cds"
    ],
    "choices": [
      "Un CDS",
      "Un Forward de crédit",
      "Un Interest Rate Swap (IRS)",
      "Un Collateralized Debt Obligation (CDO)"
    ],
    "correctChoice": "Un CDS"
  },
  {
    "id": 134,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel est le nom de l'indice surnommé « l'indice de la peur » qui mesure la volatilité implicite du S&P 500 ?",
    "rawAns": "Le VIX",
    "cleanAns": "Le VIX",
    "show": "Le VIX",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "le vix"
    ],
    "choices": [
      "Le VIX",
      "Le MOVE Index",
      "Le TED Spread",
      "Le Fear & Greed Index"
    ],
    "correctChoice": "Le VIX"
  },
  {
    "id": 135,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Sur un contrat Future, comment appelle-t-on le dépôt de garantie initial exigé par la chambre de compensation ?",
    "rawAns": "Le dépôt de garantie (Initial Margin)",
    "cleanAns": "Le dépôt de garantie",
    "show": "Le dépôt de garantie (Initial Margin)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le depot de garantie initial margin",
      "le depot de garantie"
    ],
    "choices": [
      "Le dépôt de garantie",
      "Le Collateral Haircut",
      "La Prime de risque",
      "La Variation Margin"
    ],
    "correctChoice": "Le dépôt de garantie"
  },
  {
    "id": 136,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Si le taux d'intérêt nominal est de 6 % et l'inflation de 2,5 %, quel est le taux d'intérêt réel approximatif ?",
    "rawAns": "3,5 %",
    "cleanAns": "3,5 %",
    "show": "3,5 %",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "3 5",
      "3.5",
      "3,5"
    ],
    "choices": [
      "1,8 %",
      "2,8 %",
      "3,5 %",
      "4,4 %"
    ],
    "correctChoice": "3,5 %"
  },
  {
    "id": 137,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une obligation a une sensibilité (Duration modifiée) de 5. Si les taux montent de 1 %, de combien varie son prix ?",
    "rawAns": "Il baisse d'environ 5 %",
    "cleanAns": "Il baisse d'environ 5 %",
    "show": "Il baisse d'environ 5 %",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "il baisse d environ 5",
      "5",
      "baisse",
      "il baisse",
      "diminue"
    ],
    "choices": [
      "Aucune des réponses",
      "Donnée insuffisante",
      "Non concerné",
      "Il baisse d'environ 5 %"
    ],
    "correctChoice": "Il baisse d'environ 5 %"
  },
  {
    "id": 138,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quelle est la plus petite note de crédit appartenant encore à la catégorie « Investment Grade » chez S&P ?",
    "rawAns": "BBB-",
    "cleanAns": "BBB-",
    "show": "BBB-",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "bbb"
    ],
    "choices": [
      "BBB-",
      "A-",
      "A+",
      "BB+"
    ],
    "correctChoice": "BBB-"
  },
  {
    "id": 139,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Comment appelle-t-on le rachat par une entreprise de ses propres actions en bourse ?",
    "rawAns": "Le Share Buyback (Rachat d'actions)",
    "cleanAns": "Le Share Buyback",
    "show": "Le Share Buyback (Rachat d'actions)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le share buyback rachat d actions",
      "le share buyback"
    ],
    "choices": [
      "L'Augmentation de capital",
      "Le Share Buyback",
      "La dilution de capital",
      "Le Spin-off"
    ],
    "correctChoice": "Le Share Buyback"
  },
  {
    "id": 140,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Quel est l'effet mécanique d'un rachat d'actions (annulées ensuite) sur le Bénéfice Par Action (BPA) ?",
    "rawAns": "Il augmente le BPA (Effet relutif)",
    "cleanAns": "Il augmente le BPA",
    "show": "Il augmente le BPA (Effet relutif)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "il augmente le bpa effet relutif",
      "il augmente le bpa"
    ],
    "choices": [
      "Il n'a aucun impact",
      "Il diminue le BPA (effet dilutif)",
      "Il divise le BPA par 2",
      "Il augmente le BPA"
    ],
    "correctChoice": "Il augmente le BPA"
  },
  {
    "id": 141,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Si USD/JPY passe de 140 à 150, le Yen s'est-il apprécié ou déprécié face au Dollar ?",
    "rawAns": "Il s'est déprécié (Il faut plus de Yens pour 1 Dollar)",
    "cleanAns": "Il s'est déprécié",
    "show": "Il s'est déprécié (Il faut plus de Yens pour 1 Dollar)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "il s est deprecie il faut plus de yens pour 1 dollar",
      "il s est deprecie",
      "yen"
    ],
    "choices": [
      "Il s'est déprécié",
      "Il s'est apprécié",
      "Le dollar a chuté",
      "Il est resté parfaitement stable"
    ],
    "correctChoice": "Il s'est déprécié"
  },
  {
    "id": 142,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Dans quel type de contrat deux parties échangent-elles un flux d'intérêt à taux fixe contre un taux variable ?",
    "rawAns": "Un Swap de taux (IRS - Interest Rate Swap)",
    "cleanAns": "Un Swap de taux",
    "show": "Un Swap de taux (IRS - Interest Rate Swap)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "un swap de taux irs interest rate swap",
      "un swap de taux"
    ],
    "choices": [
      "Un CDS",
      "Un Forward Rate Agreement (FRA)",
      "Un Swap de taux",
      "Un Cross-Currency Swap"
    ],
    "correctChoice": "Un Swap de taux"
  },
  {
    "id": 143,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel était le taux interbancaire de référence historique à Londres remplacé récemment par le SONIA / SOFR ?",
    "rawAns": "Le LIBOR",
    "cleanAns": "Le LIBOR",
    "show": "Le LIBOR",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "le libor"
    ],
    "choices": [
      "Le TONA",
      "Le LIBOR",
      "Le SARON",
      "L'EURIBOR"
    ],
    "correctChoice": "Le LIBOR"
  },
  {
    "id": 144,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel est le taux interbancaire de référence au jour le jour dans la zone euro (qui a remplacé l'EONIA) ?",
    "rawAns": "L'€STR (Ester)",
    "cleanAns": "L'€STR",
    "show": "L'€STR (Ester)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "l str ester",
      "l str"
    ],
    "choices": [
      "L'Euribor 3 mois",
      "L'€STR",
      "Le T4M",
      "Le LIBOR Euro"
    ],
    "correctChoice": "L'€STR"
  },
  {
    "id": 145,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Une action subit un regroupement d'actions (Reverse Split) de 1 pour 5 alors qu'elle cotait 2 €. Quel est son nouveau prix ?",
    "rawAns": "10 €",
    "cleanAns": "10 €",
    "show": "10 €",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "10"
    ],
    "choices": [
      "10 €",
      "12,5 €",
      "5 €",
      "8 €"
    ],
    "correctChoice": "10 €"
  },
  {
    "id": 146,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Si la corrélation entre deux actifs est de -1, comment évoluent-ils l'un par rapport à l'autre ?",
    "rawAns": "De manière parfaitement opposée",
    "cleanAns": "De manière parfaitement opposée",
    "show": "De manière parfaitement opposée",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "de maniere parfaitement opposee"
    ],
    "choices": [
      "Ils évoluent de façon identique",
      "De manière parfaitement opposée",
      "Ils sont décorrélés (indépendants)",
      "L'un double quand l'autre stagne"
    ],
    "correctChoice": "De manière parfaitement opposée"
  },
  {
    "id": 147,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Quel économiste a théorisé la sélection de portefeuille moderne (Frontière efficiente) en 1952 ?",
    "rawAns": "Harry Markowitz",
    "cleanAns": "Harry Markowitz",
    "show": "Harry Markowitz",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "harry markowitz"
    ],
    "choices": [
      "Milton Friedman",
      "Eugene Fama",
      "John Maynard Keynes",
      "Harry Markowitz"
    ],
    "correctChoice": "Harry Markowitz"
  },
  {
    "id": 148,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Si le PER d'une action est de 20, quel est son Earnings Yield (rendement bénéficiaire : BPA / Cours) ?",
    "rawAns": "5 % (1 / 20)",
    "cleanAns": "5 %",
    "show": "5 % (1 / 20)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "5 1 20",
      "5"
    ],
    "choices": [
      "4 %",
      "2,5 %",
      "5 %",
      "6,3 %"
    ],
    "correctChoice": "5 %"
  },
  {
    "id": 149,
    "cat": "Finance",
    "level": "normal",
    "time": 25,
    "text": "Un zéro-coupon de nominal 110 € échoit dans 1 an. Les taux sont à 10 %. Quel est son prix ?",
    "rawAns": "100 € (110 / 1,10)",
    "cleanAns": "100 €",
    "show": "100 € (110 / 1,10)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "100 110 1 10",
      "100"
    ],
    "choices": [
      "80 €",
      "100 €",
      "125 €",
      "50 €"
    ],
    "correctChoice": "100 €"
  },
  {
    "id": 150,
    "cat": "Finance",
    "level": "normal",
    "time": 20,
    "text": "Comment appelle-t-on le risque qu'une contrepartie ne puisse pas honorer ses engagements sur un contrat de gré à gré (OTC) ?",
    "rawAns": "Le risque de contrepartie (ou risque de crédit)",
    "cleanAns": "Le risque de contrepartie",
    "show": "Le risque de contrepartie (ou risque de crédit)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "le risque de contrepartie ou risque de credit",
      "le risque de contrepartie"
    ],
    "choices": [
      "Le risque de liquidité",
      "Le risque opérationnel",
      "Le risque de change",
      "Le risque de contrepartie"
    ],
    "correctChoice": "Le risque de contrepartie"
  },
  {
    "id": 151,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Combien font 16 x 15 ?",
    "rawAns": "240",
    "cleanAns": "240",
    "show": "240",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "240"
    ],
    "choices": [
      "192",
      "120",
      "240",
      "300"
    ],
    "correctChoice": "240"
  },
  {
    "id": 152,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Combien font 17 x 13 ?",
    "rawAns": "221 ((15+2)(15-2) = 225 - 4)",
    "cleanAns": "221",
    "show": "221 ((15+2)(15-2) = 225 - 4)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "221 15 2 15 2 225 4",
      "221"
    ],
    "choices": [
      "221",
      "176,8",
      "110,5",
      "276,3"
    ],
    "correctChoice": "221"
  },
  {
    "id": 153,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Quel est le carré de 16 ?",
    "rawAns": "256",
    "cleanAns": "256",
    "show": "256",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "256"
    ],
    "choices": [
      "128",
      "256",
      "320",
      "204,8"
    ],
    "correctChoice": "256"
  },
  {
    "id": 154,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Quel est le cube de 4 ($4^3$) ?",
    "rawAns": "64",
    "cleanAns": "64",
    "show": "64",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "64"
    ],
    "choices": [
      "64",
      "51,2",
      "80",
      "32"
    ],
    "correctChoice": "64"
  },
  {
    "id": 155,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Combien font 12,5 % de 400 ?",
    "rawAns": "50 (1/8 de 400)",
    "cleanAns": "50",
    "show": "50 (1/8 de 400)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "50 1 8 de 400",
      "50"
    ],
    "choices": [
      "40",
      "50",
      "62,5",
      "25"
    ],
    "correctChoice": "50"
  },
  {
    "id": 156,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Un article passe de 80 € à 60 €. Quel est le pourcentage de réduction ?",
    "rawAns": "25 %",
    "cleanAns": "25 %",
    "show": "25 %",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "25"
    ],
    "choices": [
      "31,3 %",
      "25 %",
      "20 %",
      "12,5 %"
    ],
    "correctChoice": "25 %"
  },
  {
    "id": 157,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Un portefeuille perd 20 % puis gagne 25 %. Quel est son rendement total ?",
    "rawAns": "0 % (Il revient à sa valeur initiale : 0,8 x 1,25 = 1)",
    "cleanAns": "0 %",
    "show": "0 % (Il revient à sa valeur initiale : 0,8 x 1,25 = 1)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "0 il revient a sa valeur initiale 0 8 x 1 25 1",
      "0"
    ],
    "choices": [
      "5 %",
      "-10 %",
      "0 %",
      "10 %"
    ],
    "correctChoice": "0 %"
  },
  {
    "id": 158,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Résolvez : 3/4 + 5/8",
    "rawAns": "11/8 (ou 1,375)",
    "cleanAns": "11/8",
    "show": "11/8 (ou 1,375)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "11 8 ou 1 375",
      "11 8",
      "11",
      "8"
    ],
    "choices": [
      "11/8",
      "8,8 /8",
      "13,8 /8",
      "5,5 /8"
    ],
    "correctChoice": "11/8"
  },
  {
    "id": 159,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Si 4x - 7 = 21, combien vaut x ?",
    "rawAns": "7",
    "cleanAns": "7",
    "show": "7",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "7"
    ],
    "choices": [
      "8,8",
      "3,5",
      "7",
      "5,6"
    ],
    "correctChoice": "7"
  },
  {
    "id": 160,
    "cat": "Probabilités",
    "level": "normal",
    "time": 25,
    "text": "Vous lancez deux dés à 6 faces. Quelle est la probabilité que la somme fasse 7 ?",
    "rawAns": "1/6 (6 combinaisons sur 36)",
    "cleanAns": "1/6",
    "show": "1/6 (6 combinaisons sur 36)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "1 6 6 combinaisons sur 36",
      "1 6",
      "1",
      "6"
    ],
    "choices": [
      "1/6",
      "0 /6",
      "2 /6",
      "3 /6"
    ],
    "correctChoice": "1/6"
  },
  {
    "id": 161,
    "cat": "Probabilités",
    "level": "normal",
    "time": 25,
    "text": "Vous lancez deux dés à 6 faces. Quelle est la probabilité de faire un double (ex: 1-1, 2-2...) ?",
    "rawAns": "1/6 (6 sur 36)",
    "cleanAns": "1/6",
    "show": "1/6 (6 sur 36)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "1 6 6 sur 36",
      "1 6",
      "1",
      "6"
    ],
    "choices": [
      "2 /6",
      "3 /6",
      "1/6",
      "0 /6"
    ],
    "correctChoice": "1/6"
  },
  {
    "id": 162,
    "cat": "Probabilités",
    "level": "normal",
    "time": 25,
    "text": "Vous lancez une pièce 3 fois. Quelle est la probabilité d'avoir 3 fois « Pile » ?",
    "rawAns": "1/8 (12,5 %)",
    "cleanAns": "1/8",
    "show": "1/8 (12,5 %)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "1 8 12 5",
      "1 8",
      "1",
      "8"
    ],
    "choices": [
      "1/8",
      "0 /8",
      "2 /8",
      "3 /8"
    ],
    "correctChoice": "1/8"
  },
  {
    "id": 163,
    "cat": "Probabilités",
    "level": "normal",
    "time": 30,
    "text": "Vous lancez une pièce 3 fois. Quelle est la probabilité d'avoir exactement 2 fois « Pile » ?",
    "rawAns": "3/8 (37,5 %)",
    "cleanAns": "3/8",
    "show": "3/8 (37,5 %)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "3 8 37 5",
      "3 8",
      "3",
      "8"
    ],
    "choices": [
      "2,4 /8",
      "3,8 /8",
      "3/8",
      "1,5 /8"
    ],
    "correctChoice": "3/8"
  },
  {
    "id": 164,
    "cat": "Probabilités",
    "level": "normal",
    "time": 25,
    "text": "Quelle est l'espérance mathématique d'un lancer de dé équilibré à 6 faces ?",
    "rawAns": "3,5",
    "cleanAns": "3,5",
    "show": "3,5",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "3 5",
      "3.5",
      "3,5"
    ],
    "choices": [
      "4,4",
      "1,8",
      "2,8",
      "3,5"
    ],
    "correctChoice": "3,5"
  },
  {
    "id": 165,
    "cat": "Probabilités",
    "level": "normal",
    "time": 25,
    "text": "Dans un jeu de 52 cartes, quelle est la probabilité de tirer un As ?",
    "rawAns": "1/13 (4/52)",
    "cleanAns": "1/13",
    "show": "1/13 (4/52)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 13 4 52",
      "1 13",
      "1",
      "13"
    ],
    "choices": [
      "1/13",
      "0 /13",
      "2 /13",
      "3 /13"
    ],
    "correctChoice": "1/13"
  },
  {
    "id": 166,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "Une batte et une balle coûtent 1,10 €. La batte coûte 1,00 € de plus que la balle. Combien coûte la balle ?",
    "rawAns": "0,05 € (5 centimes)",
    "cleanAns": "0,05 €",
    "show": "0,05 € (5 centimes)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "0 05 5 centimes",
      "0 05",
      "0.05",
      "0,05"
    ],
    "choices": [
      "0,05 €",
      "0,04 €",
      "0,06 €",
      "0,03 €"
    ],
    "correctChoice": "0,05 €"
  },
  {
    "id": 167,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "5 machines produisent 5 pièces en 5 minutes. En combien de temps 100 machines produisent-elles 100 pièces ?",
    "rawAns": "5 minutes",
    "cleanAns": "5 minutes",
    "show": "5 minutes",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "5 minutes",
      "5"
    ],
    "choices": [
      "4 minutes",
      "2,5 minutes",
      "5 minutes",
      "6,3 minutes"
    ],
    "correctChoice": "5 minutes"
  },
  {
    "id": 168,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Un nénuphar double chaque jour et couvre un lac en 40 jours. En combien de jours couvre-t-il la moitié du lac ?",
    "rawAns": "39 jours",
    "cleanAns": "39 jours",
    "show": "39 jours",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "39 jours",
      "39"
    ],
    "choices": [
      "39 jours",
      "19,5 jours",
      "31,2 jours",
      "48,8 jours"
    ],
    "correctChoice": "39 jours"
  },
  {
    "id": 169,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "Il est 15h15. Quel est l'angle en degrés entre l'aiguille des heures et celle des minutes ?",
    "rawAns": "7,5°",
    "cleanAns": "7,5°",
    "show": "7,5°",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "7 5",
      "7.5",
      "7,5"
    ],
    "choices": [
      "7,5°",
      "9,4 °",
      "3,8 °",
      "6 °"
    ],
    "correctChoice": "7,5°"
  },
  {
    "id": 170,
    "cat": "Logique",
    "level": "normal",
    "time": 35,
    "text": "Combien de fois utilise-t-on le chiffre 9 en écrivant tous les nombres de 1 à 100 ?",
    "rawAns": "20 fois",
    "cleanAns": "20 fois",
    "show": "20 fois",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "20 fois",
      "20"
    ],
    "choices": [
      "16 fois",
      "10 fois",
      "20 fois",
      "25 fois"
    ],
    "correctChoice": "20 fois"
  },
  {
    "id": 171,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : 1 - 1 - 2 - 3 - 5 - 8 - 13 - ?",
    "rawAns": "21 (Fibonacci)",
    "cleanAns": "21",
    "show": "21 (Fibonacci)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "21 fibonacci",
      "21"
    ],
    "choices": [
      "16,8",
      "10,5",
      "26,3",
      "21"
    ],
    "correctChoice": "21"
  },
  {
    "id": 172,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : 2 - 6 - 12 - 20 - 30 - ?",
    "rawAns": "42 (+4, +6, +8, +10, +12)",
    "cleanAns": "42",
    "show": "42 (+4, +6, +8, +10, +12)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "42 4 6 8 10 12",
      "42"
    ],
    "choices": [
      "21",
      "42",
      "33,6",
      "52,5"
    ],
    "correctChoice": "42"
  },
  {
    "id": 173,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : 1 - 4 - 9 - 16 - 25 - 36 - ?",
    "rawAns": "49 (Carrés parfaits)",
    "cleanAns": "49",
    "show": "49 (Carrés parfaits)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "49 carres parfaits",
      "49"
    ],
    "choices": [
      "61,3",
      "49",
      "24,5",
      "39,2"
    ],
    "correctChoice": "49"
  },
  {
    "id": 174,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "Complétez la suite : 2 - 3 - 5 - 7 - 11 - 13 - 17 - ?",
    "rawAns": "19 (Nombres premiers)",
    "cleanAns": "19",
    "show": "19 (Nombres premiers)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "19 nombres premiers",
      "19"
    ],
    "choices": [
      "23,8",
      "19",
      "9,5",
      "15,2"
    ],
    "correctChoice": "19"
  },
  {
    "id": 175,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : U - D - T - Q - C - S - S - ?",
    "rawAns": "H (Huit)",
    "cleanAns": "H",
    "show": "H (Huit)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "h huit",
      "h"
    ],
    "choices": [
      "S",
      "D",
      "N",
      "H"
    ],
    "correctChoice": "H"
  },
  {
    "id": 176,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : AZ - BY - CX - DW - ?",
    "rawAns": "EV",
    "cleanAns": "EV",
    "show": "EV",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "ev"
    ],
    "choices": [
      "FU",
      "FV",
      "EV",
      "EU"
    ],
    "correctChoice": "EV"
  },
  {
    "id": 177,
    "cat": "Spatial",
    "level": "normal",
    "time": 25,
    "text": "On peint un cube de 3x3x3. Combien de petits cubes n'ont AUCUNE face peinte ?",
    "rawAns": "1 (Celui au centre)",
    "cleanAns": "1",
    "show": "1 (Celui au centre)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 celui au centre",
      "1"
    ],
    "choices": [
      "0",
      "1",
      "2",
      "3"
    ],
    "correctChoice": "1"
  },
  {
    "id": 178,
    "cat": "Spatial",
    "level": "normal",
    "time": 30,
    "text": "On peint un cube de 3x3x3. Combien de petits cubes ont exactement 3 faces peintes ?",
    "rawAns": "8 (Les sommets)",
    "cleanAns": "8",
    "show": "8 (Les sommets)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "8 les sommets",
      "8"
    ],
    "choices": [
      "4",
      "8",
      "6,4",
      "10"
    ],
    "correctChoice": "8"
  },
  {
    "id": 179,
    "cat": "Spatial",
    "level": "normal",
    "time": 30,
    "text": "Vous pliez une feuille en deux 4 fois, puis vous percez un trou au milieu. Combien de trous en la dépliant ?",
    "rawAns": "16 ($2^4$)",
    "cleanAns": "16",
    "show": "16 ($2^4$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "16 2 4",
      "16"
    ],
    "choices": [
      "16",
      "20",
      "12,8",
      "8"
    ],
    "correctChoice": "16"
  },
  {
    "id": 180,
    "cat": "Spatial",
    "level": "normal",
    "time": 35,
    "text": "Combien de carrés au total (toutes tailles) y a-t-il dans une grille de 3x3 ?",
    "rawAns": "14 (9 petits + 4 moyens + 1 grand)",
    "cleanAns": "14",
    "show": "14 (9 petits + 4 moyens + 1 grand)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "14 9 petits 4 moyens 1 grand",
      "14"
    ],
    "choices": [
      "7",
      "14",
      "11,2",
      "17,5"
    ],
    "correctChoice": "14"
  },
  {
    "id": 181,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "8 personnes se serrent toutes la main une fois. Combien de poignées de main sont échangées ?",
    "rawAns": "28 ((8 x 7) / 2)",
    "cleanAns": "28",
    "show": "28 ((8 x 7) / 2)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "28 8 x 7 2",
      "28"
    ],
    "choices": [
      "35",
      "22,4",
      "14",
      "28"
    ],
    "correctChoice": "28"
  },
  {
    "id": 182,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Dans un tiroir sombre, il y a 10 chaussettes rouges et 10 bleues. Combien en tirer au minimum pour avoir une paire identique ?",
    "rawAns": "3",
    "cleanAns": "3",
    "show": "3",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "3"
    ],
    "choices": [
      "3",
      "1,5",
      "2,4",
      "3,8"
    ],
    "correctChoice": "3"
  },
  {
    "id": 183,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Quelle est la somme des entiers de 1 à 50 ?",
    "rawAns": "1 275 ((50 x 51) / 2)",
    "cleanAns": "1 275",
    "show": "1 275 ((50 x 51) / 2)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 275 50 x 51 2",
      "1 275",
      "1",
      "275"
    ],
    "choices": [
      "2 275",
      "3 275",
      "0 275",
      "1 275"
    ],
    "correctChoice": "1 275"
  },
  {
    "id": 184,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Vous roulez à 80 km/h pendant 45 minutes. Quelle distance avez-vous parcourue ?",
    "rawAns": "60 km",
    "cleanAns": "60 km",
    "show": "60 km",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "60 km",
      "60"
    ],
    "choices": [
      "75 km",
      "30 km",
      "48 km",
      "60 km"
    ],
    "correctChoice": "60 km"
  },
  {
    "id": 185,
    "cat": "Attention",
    "level": "normal",
    "time": 25,
    "text": "Combien y a-t-il de consonnes dans le mot « INVESTISSEMENT » ?",
    "rawAns": "9",
    "cleanAns": "9",
    "show": "9",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "9"
    ],
    "choices": [
      "7,2",
      "11,3",
      "4,5",
      "9"
    ],
    "correctChoice": "9"
  },
  {
    "id": 186,
    "cat": "Attention",
    "level": "normal",
    "time": 25,
    "text": "Quelle est la somme des chiffres impairs dans : 4 - 7 - 2 - 9 - 6 - 3 - 8 - 5 ?",
    "rawAns": "24 (7 + 9 + 3 + 5)",
    "cleanAns": "24",
    "show": "24 (7 + 9 + 3 + 5)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "24 7 9 3 5",
      "24"
    ],
    "choices": [
      "12",
      "24",
      "30",
      "19,2"
    ],
    "correctChoice": "24"
  },
  {
    "id": 187,
    "cat": "Attention",
    "level": "normal",
    "time": 25,
    "text": "Si A=1, B=2, C=3... que vaut la somme des lettres du mot « CASH » ?",
    "rawAns": "31 (3 + 1 + 19 + 8)",
    "cleanAns": "31",
    "show": "31 (3 + 1 + 19 + 8)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "31 3 1 19 8",
      "31"
    ],
    "choices": [
      "15,5",
      "24,8",
      "38,8",
      "31"
    ],
    "correctChoice": "31"
  },
  {
    "id": 188,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "Un escargot dans un puits de 10m monte de 3m le jour et glisse de 2m la nuit. En combien de jours sort-il ?",
    "rawAns": "8 jours",
    "cleanAns": "8 jours",
    "show": "8 jours",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "8 jours",
      "8"
    ],
    "choices": [
      "10 jours",
      "4 jours",
      "8 jours",
      "6,4 jours"
    ],
    "correctChoice": "8 jours"
  },
  {
    "id": 189,
    "cat": "Logique",
    "level": "normal",
    "time": 30,
    "text": "Vous avez 9 billes dont 1 plus lourde. Combien de pesées minimum sur une balance à plateaux pour la trouver ?",
    "rawAns": "2 pesées",
    "cleanAns": "2 pesées",
    "show": "2 pesées",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "2 pesees",
      "2"
    ],
    "choices": [
      "1 pesées",
      "2 pesées",
      "1,6 pesées",
      "2,5 pesées"
    ],
    "correctChoice": "2 pesées"
  },
  {
    "id": 190,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Si tous les A sont des B, et que certains B sont des C, tous les A sont-ils forcément des C ?",
    "rawAns": "Non",
    "cleanAns": "Non",
    "show": "Non",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "non"
    ],
    "choices": [
      "Non",
      "Oui, obligatoirement",
      "Seulement si C est vide",
      "Seulement si A = B"
    ],
    "correctChoice": "Non"
  },
  {
    "id": 191,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Quel est le reste de la division de 85 par 9 ?",
    "rawAns": "4 (9 x 9 = 81)",
    "cleanAns": "4",
    "show": "4 (9 x 9 = 81)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "4 9 x 9 81",
      "4"
    ],
    "choices": [
      "4",
      "5",
      "3,2",
      "2"
    ],
    "correctChoice": "4"
  },
  {
    "id": 192,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Quel est le plus grand commun diviseur (PGCD) de 36 et 48 ?",
    "rawAns": "12",
    "cleanAns": "12",
    "show": "12",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "12"
    ],
    "choices": [
      "12",
      "15",
      "9,6",
      "6"
    ],
    "correctChoice": "12"
  },
  {
    "id": 193,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Quel est le plus petit commun multiple (PPCM) de 6 et 8 ?",
    "rawAns": "24",
    "cleanAns": "24",
    "show": "24",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "24"
    ],
    "choices": [
      "12",
      "24",
      "30",
      "19,2"
    ],
    "correctChoice": "24"
  },
  {
    "id": 194,
    "cat": "Spatial",
    "level": "normal",
    "time": 25,
    "text": "Combien d'arêtes possède un cube ?",
    "rawAns": "12",
    "cleanAns": "12",
    "show": "12",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "12"
    ],
    "choices": [
      "9,6",
      "6",
      "12",
      "15"
    ],
    "correctChoice": "12"
  },
  {
    "id": 195,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Trois médecins disent que Paul est leur frère. Paul dit qu'il n'a pas de frères. Qui ment ?",
    "rawAns": "Personne (Les trois médecins sont ses sœurs)",
    "cleanAns": "Personne",
    "show": "Personne (Les trois médecins sont ses sœurs)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "personne les trois medecins sont ses s urs",
      "personne"
    ],
    "choices": [
      "Personne",
      "Paul ment",
      "Les trois médecins mentent",
      "C'est une énigme impossible"
    ],
    "correctChoice": "Personne"
  },
  {
    "id": 196,
    "cat": "Calcul",
    "level": "normal",
    "time": 25,
    "text": "Si une pompe remplit un bassin en 3h et une autre en 6h, combien de temps mettent-elles ensemble ?",
    "rawAns": "2 heures (1/3 + 1/6 = 1/2 bassin par heure)",
    "cleanAns": "2 heures",
    "show": "2 heures (1/3 + 1/6 = 1/2 bassin par heure)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "2 heures 1 3 1 6 1 2 bassin par heure",
      "2 heures",
      "2"
    ],
    "choices": [
      "1 heures",
      "2 heures",
      "1,6 heures",
      "2,5 heures"
    ],
    "correctChoice": "2 heures"
  },
  {
    "id": 197,
    "cat": "Attention",
    "level": "normal",
    "time": 20,
    "text": "Inversez le deuxième et le quatrième chiffre de 83915. Quel nombre obtenez-vous ?",
    "rawAns": "81935",
    "cleanAns": "81935",
    "show": "81935",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "81935"
    ],
    "choices": [
      "40967,5",
      "81935",
      "102418,8",
      "65548"
    ],
    "correctChoice": "81935"
  },
  {
    "id": 198,
    "cat": "Logique",
    "level": "normal",
    "time": 25,
    "text": "Complétez la suite : 3 - 6 - 18 - 72 - ?",
    "rawAns": "360 (x2, x3, x4, x5)",
    "cleanAns": "360",
    "show": "360 (x2, x3, x4, x5)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "360 x2 x3 x4 x5",
      "360"
    ],
    "choices": [
      "180",
      "288",
      "360",
      "450"
    ],
    "correctChoice": "360"
  },
  {
    "id": 199,
    "cat": "Calcul",
    "level": "normal",
    "time": 20,
    "text": "Combien font 0,2 x 0,05 ?",
    "rawAns": "0,01",
    "cleanAns": "0,01",
    "show": "0,01",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "0 01",
      "0.01",
      "0,01"
    ],
    "choices": [
      "3,01",
      "Option alternative 4",
      "0,01",
      "2,01"
    ],
    "correctChoice": "0,01"
  },
  {
    "id": 200,
    "cat": "Spatial",
    "level": "normal",
    "time": 30,
    "text": "En combien de coups de couteau droits au minimum peut-on couper un gâteau cylindrique en 8 parts égales ?",
    "rawAns": "3 coups",
    "cleanAns": "3 coups",
    "show": "3 coups",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "3 coups",
      "3"
    ],
    "choices": [
      "2,4 coups",
      "3,8 coups",
      "3 coups",
      "1,5 coups"
    ],
    "correctChoice": "3 coups"
  },
  {
    "id": 201,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Un Call Strike 100 vaut 8 €, le Put de même Strike et maturité vaut 5 €. Le Strike actualisé vaut 97 €. Sans dividende, combien vaut l'action (Parité Call-Put) ?",
    "rawAns": "100 € ($S = C - P + K \\cdot e^{-rT} = 8 - 5 + 97$)",
    "cleanAns": "100 €",
    "show": "100 € ($S = C - P + K \\cdot e^{-rT} = 8 - 5 + 97$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "100 s c p k cdot e rt 8 5 97",
      "100"
    ],
    "choices": [
      "80 €",
      "100 €",
      "125 €",
      "50 €"
    ],
    "correctChoice": "100 €"
  },
  {
    "id": 202,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "La volatilité quotidienne d'une action est de 1 %. En supposant 256 jours de bourse par an, quelle est sa volatilité annualisée ?",
    "rawAns": "16 % ($1\\% \\times \\sqrt{256}$)",
    "cleanAns": "16 %",
    "show": "16 % ($1\\% \\times \\sqrt{256}$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "16 1 times sqrt 256",
      "16"
    ],
    "choices": [
      "12,8 %",
      "8 %",
      "16 %",
      "20 %"
    ],
    "correctChoice": "16 %"
  },
  {
    "id": 203,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "La volatilité annuelle d'un indice est de 32 %. Quelle est sa volatilité journalière approximative (base 256 jours) ?",
    "rawAns": "2 % ($32\\% / \\sqrt{256}$)",
    "cleanAns": "2 %",
    "show": "2 % ($32\\% / \\sqrt{256}$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "2 32 sqrt 256",
      "2"
    ],
    "choices": [
      "1,6 %",
      "2,5 %",
      "1 %",
      "2 %"
    ],
    "correctChoice": "2 %"
  },
  {
    "id": 204,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une entreprise a un Bêta des capitaux propres (Levered Beta) de 1,5, un ratio Dette/Fonds Propres (D/E) de 1, et un taux d'IS de 20 %. Quel est son Bêta désendetté (Unlevered Beta) ?",
    "rawAns": "0,83 (ou 5/6 : $\\beta_U = 1,5 / (1 + (1 - 0,2) \\times 1) = 1,5 / 1,8$)",
    "cleanAns": "0,83",
    "show": "0,83 (ou 5/6 : $\\beta_U = 1,5 / (1 + (1 - 0,2) \\times 1) = 1,5 / 1,8$)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "0 83 ou 5 6 beta u 1 5 1 1 0 2 times 1 1 5 1 8",
      "0 83",
      "0.83",
      "0,83"
    ],
    "choices": [
      "0,83",
      "0,66",
      "0,42",
      "1,04"
    ],
    "correctChoice": "0,83"
  },
  {
    "id": 205,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quel est le prix d'une rente perpétuelle versant 60 € par an si le taux d'actualisation est de 5 % ?",
    "rawAns": "1 200 € (60 / 0,05)",
    "cleanAns": "1 200 €",
    "show": "1 200 € (60 / 0,05)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "1 200 60 0 05",
      "1 200",
      "1",
      "200"
    ],
    "choices": [
      "1 200 €",
      "2 200 €",
      "3 200 €",
      "0 200 €"
    ],
    "correctChoice": "1 200 €"
  },
  {
    "id": 206,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Selon la formule de Gordon-Shapiro, combien vaut une action qui versera un dividende de 4 € l'an prochain, croissant de 2 % par an à l'infini, avec un coût du capital de 10 % ?",
    "rawAns": "50 € ($4 / (0,10 - 0,02)$)",
    "cleanAns": "50 €",
    "show": "50 € ($4 / (0,10 - 0,02)$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "50 4 0 10 0 02",
      "50"
    ],
    "choices": [
      "25 €",
      "40 €",
      "50 €",
      "62,5 €"
    ],
    "correctChoice": "50 €"
  },
  {
    "id": 207,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une entreprise a 40 % de dette (coût après impôt de 5 %) et 60 % de fonds propres (coût de 10 %). Quel est son WACC ?",
    "rawAns": "8 % ($0,4 \\times 5\\% + 0,6 \\times 10\\%$)",
    "cleanAns": "8 %",
    "show": "8 % ($0,4 \\times 5\\% + 0,6 \\times 10\\%$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "8 0 4 times 5 0 6 times 10",
      "8"
    ],
    "choices": [
      "6,4 %",
      "10 %",
      "4 %",
      "8 %"
    ],
    "correctChoice": "8 %"
  },
  {
    "id": 208,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quelle lettre grecque représente la dérivée seconde du prix de l'option par rapport au sous-jacent (sensibilité du Delta) ?",
    "rawAns": "Le Gamma ($\\Gamma$)",
    "cleanAns": "Le Gamma",
    "show": "Le Gamma ($\\Gamma$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "le gamma gamma",
      "le gamma"
    ],
    "choices": [
      "Le Véga",
      "Le Gamma",
      "Le Delta",
      "Le Vanna"
    ],
    "correctChoice": "Le Gamma"
  },
  {
    "id": 209,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Pour quelle position le Gamma d'une option vanille est-il maximal (en valeur absolue) ?",
    "rawAns": "À la monnaie (At-The-Money) et proche de l'échéance",
    "cleanAns": "À la monnaie",
    "show": "À la monnaie (At-The-Money) et proche de l'échéance",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "a la monnaie at the money et proche de l echeance",
      "a la monnaie"
    ],
    "choices": [
      "Loin hors de la monnaie (Deep OTM)",
      "À maturité 10 ans",
      "À la monnaie",
      "Profondément dans la monnaie (Deep ITM)"
    ],
    "correctChoice": "À la monnaie"
  },
  {
    "id": 210,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Si un trader est « Delta Neutre » et « Long Gamma », que souhaite-t-il qu'il arrive au marché ?",
    "rawAns": "Une forte volatilité (de grands mouvements du sous-jacent dans n'importe quel sens)",
    "cleanAns": "Une forte volatilité",
    "show": "Une forte volatilité (de grands mouvements du sous-jacent dans n'importe quel sens)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "une forte volatilite de grands mouvements du sous jacent dans n importe quel sens",
      "une forte volatilite"
    ],
    "choices": [
      "Un marché parfaitement stable (plat)",
      "Une baisse lente des taux",
      "Une forte volatilité",
      "Une hausse constante sans à-coups"
    ],
    "correctChoice": "Une forte volatilité"
  },
  {
    "id": 211,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Dans la formule de Black-Scholes, que représente le terme $N(d_2)$ pour une option Call ?",
    "rawAns": "La probabilité (sous la mesure risque-neutre) que le Call finisse dans la monnaie (exercé)",
    "cleanAns": "La probabilité",
    "show": "La probabilité (sous la mesure risque-neutre) que le Call finisse dans la monnaie (exercé)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "la probabilite sous la mesure risque neutre que le call finisse dans la monnaie exerce",
      "la probabilite",
      "call",
      "un call"
    ],
    "choices": [
      "Le taux d'actualisation continu",
      "La probabilité",
      "Le Delta de l'option",
      "Le cours moyen futur"
    ],
    "correctChoice": "La probabilité"
  },
  {
    "id": 212,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une obligation de Duration modifiée 6 et de Convexité 50 subit une hausse des taux de 2 % (+200 bps). Quelle est la variation de son prix au second ordre ?",
    "rawAns": "-11 % ($-6 \\times 2\\% + 0,5 \\times 50 \\times (0,02)^2 = -12\\% + 1\\%$)",
    "cleanAns": "-11 %",
    "show": "-11 % ($-6 \\times 2\\% + 0,5 \\times 50 \\times (0,02)^2 = -12\\% + 1\\%$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "11 6 times 2 0 5 times 50 times 0 02 2 12 1",
      "11",
      "-11"
    ],
    "choices": [
      "-9 %",
      "-8 %",
      "-11 %",
      "-10 %"
    ],
    "correctChoice": "-11 %"
  },
  {
    "id": 213,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Si le taux spot à 1 an est de 4 % et le taux spot à 2 ans est de 5 %, quel est approximativement le taux Forward à 1 an dans 1 an ($f_{1,1}$) ?",
    "rawAns": "6 % ($2 \\times 5\\% - 4\\%$)",
    "cleanAns": "6 %",
    "show": "6 % ($2 \\times 5\\% - 4\\%$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "6 2 times 5 4",
      "6"
    ],
    "choices": [
      "7,5 %",
      "3 %",
      "6 %",
      "4,8 %"
    ],
    "correctChoice": "6 %"
  },
  {
    "id": 214,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une société augmente ses dotations aux amortissements de 20 M€. Le taux d'impôt est de 25 %. Quel est l'impact sur son Free Cash Flow ?",
    "rawAns": "+5 M€ (Bouclier fiscal : économie d'impôt de $20 \\times 25\\%$)",
    "cleanAns": "+5 M€",
    "show": "+5 M€ (Bouclier fiscal : économie d'impôt de $20 \\times 25\\%$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "5 m bouclier fiscal economie d impot de 20 times 25",
      "5 m",
      "+5"
    ],
    "choices": [
      "6,3 M€",
      "+5 M€",
      "4 M€",
      "2,5 M€"
    ],
    "correctChoice": "+5 M€"
  },
  {
    "id": 215,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Un acquéreur au PER de 15 rachète 100 % en actions une cible au PER de 20. L'opération est-elle relutive ou dilutive pour les actionnaires de l'acquéreur ?",
    "rawAns": "Dilutive (le rendement bénéficiaire de la cible est inférieur à celui de l'acquéreur)",
    "cleanAns": "Dilutive",
    "show": "Dilutive (le rendement bénéficiaire de la cible est inférieur à celui de l'acquéreur)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "dilutive le rendement beneficiaire de la cible est inferieur a celui de l acquereur",
      "dilutive"
    ],
    "choices": [
      "Neutre (impact nul)",
      "Relutive",
      "Dilutive",
      "Impossible sans connaître la dette"
    ],
    "correctChoice": "Dilutive"
  },
  {
    "id": 216,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Un acquéreur rachète une cible au PER de 20 entièrement par endettement à un coût de la dette avant impôt de 5 % et un taux d'IS de 20 %. Est-ce relutif ou dilutif ?",
    "rawAns": "Relutif (Coût de la dette après impôt = 4 % < Earnings yield de la cible = 1/20 = 5 %)",
    "cleanAns": "Relutif",
    "show": "Relutif (Coût de la dette après impôt = 4 % < Earnings yield de la cible = 1/20 = 5 %)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "relutif cout de la dette apres impot 4 earnings yield de la cible 1 20 5",
      "relutif"
    ],
    "choices": [
      "Neutre",
      "Relutif",
      "Catastrophique pour l'acquéreur",
      "Dilutif"
    ],
    "correctChoice": "Relutif"
  },
  {
    "id": 217,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Comment s'appelle la courbe qui montre que la volatilité implicite des options varie en fonction du Strike pour une même échéance ?",
    "rawAns": "Le Smile de volatilité (ou Skew de volatilité)",
    "cleanAns": "Le Smile de volatilité",
    "show": "Le Smile de volatilité (ou Skew de volatilité)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le smile de volatilite ou skew de volatilite",
      "le smile de volatilite"
    ],
    "choices": [
      "Le cône de Markov",
      "La parabole d'arbitrage",
      "La courbe de Philips",
      "Le Smile de volatilité"
    ],
    "correctChoice": "Le Smile de volatilité"
  },
  {
    "id": 218,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quelle équation différentielle aux dérivées partielles de la physique a inspiré la résolution de l'équation de Black-Scholes ?",
    "rawAns": "L'équation de la chaleur (Diffusion thermique)",
    "cleanAns": "L'équation de la chaleur",
    "show": "L'équation de la chaleur (Diffusion thermique)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "l equation de la chaleur diffusion thermique",
      "l equation de la chaleur"
    ],
    "choices": [
      "L'équation de Navier-Stokes",
      "L'équation d'onde acoustique",
      "L'équation de la chaleur",
      "L'équation de Schrödinger"
    ],
    "correctChoice": "L'équation de la chaleur"
  },
  {
    "id": 219,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quel lemme fondamental du calcul stochastique permet de différencier une fonction d'un mouvement brownien géométrique ?",
    "rawAns": "Le lemme d'Itô",
    "cleanAns": "Le lemme d'Itô",
    "show": "Le lemme d'Itô",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "le lemme d ito"
    ],
    "choices": [
      "Le lemme d'Itô",
      "Le lemme de Borel-Cantelli",
      "Le lemme de Fatou",
      "Le théorème de Girsanov"
    ],
    "correctChoice": "Le lemme d'Itô"
  },
  {
    "id": 220,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Deux actifs A et B ont chacun une volatilité de 20 % et une corrélation de 0. Quelle est la volatilité d'un portefeuille équipondéré (50 % A, 50 % B) ?",
    "rawAns": "$10\\sqrt{2}$ % soit environ 14,14 % ($\\sqrt{0,5^2 \\cdot 20^2 + 0,5^2 \\cdot 20^2}$)",
    "cleanAns": "$10\\sqrt{2}$ % soit environ 14,14 %",
    "show": "$10\\sqrt{2}$ % soit environ 14,14 % ($\\sqrt{0,5^2 \\cdot 20^2 + 0,5^2 \\cdot 20^2}$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "10 sqrt 2 soit environ 14 14 sqrt 0 5 2 cdot 20 2 0 5 2 cdot 20 2",
      "10 sqrt 2 soit environ 14 14",
      "10",
      "2",
      "14.14",
      "14,14"
    ],
    "choices": [
      "Donnée insuffisante",
      "Non concerné",
      "$10\\sqrt{2}$ % soit environ 14,14 %",
      "Aucune des réponses"
    ],
    "correctChoice": "$10\\sqrt{2}$ % soit environ 14,14 %"
  },
  {
    "id": 221,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Que signifie une VaR (Value at Risk) 1 jour à 99 % de 5 millions d'euros ?",
    "rawAns": "Il y a 1 % de chance de perdre plus de 5 M€ en une journée (dans des conditions normales de marché)",
    "cleanAns": "Il y a 1 % de chance de perdre plus de 5 M€ en une journée",
    "show": "Il y a 1 % de chance de perdre plus de 5 M€ en une journée (dans des conditions normales de marché)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "il y a 1 de chance de perdre plus de 5 m en une journee dans des conditions normales de marche",
      "il y a 1 de chance de perdre plus de 5 m en une journee",
      "1",
      "5"
    ],
    "choices": [
      "Aucune des réponses",
      "Donnée insuffisante",
      "Non concerné",
      "Il y a 1 % de chance de perdre plus de 5 M€ en une journée"
    ],
    "correctChoice": "Il y a 1 % de chance de perdre plus de 5 M€ en une journée"
  },
  {
    "id": 222,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quelle mesure de risque corrige le défaut de la VaR en calculant la perte moyenne au-delà du seuil de la VaR ?",
    "rawAns": "L'Expected Shortfall (ou CVaR - Conditional VaR)",
    "cleanAns": "L'Expected Shortfall",
    "show": "L'Expected Shortfall (ou CVaR - Conditional VaR)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "l expected shortfall ou cvar conditional var",
      "l expected shortfall"
    ],
    "choices": [
      "L'Expected Shortfall",
      "Le Max Drawdown",
      "La VaR historique",
      "L'Ulcer Index"
    ],
    "correctChoice": "L'Expected Shortfall"
  },
  {
    "id": 223,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Comment appelle-t-on la stratégie d'options consistant à acheter un Call Strike K1, vendre 2 Calls Strike K2 et acheter un Call Strike K3 (avec K1 < K2 < K3 équidistants) ?",
    "rawAns": "Un Butterfly (Papillon)",
    "cleanAns": "Un Butterfly",
    "show": "Un Butterfly (Papillon)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "un butterfly papillon",
      "un butterfly"
    ],
    "choices": [
      "Un Strangle",
      "Un Butterfly",
      "Un Box Spread",
      "Un Condor"
    ],
    "correctChoice": "Un Butterfly"
  },
  {
    "id": 224,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Vous achetez un Call Strike 100 à 6 € et vendez un Call Strike 110 à 2 € (Bull Call Spread). Quel est votre gain net maximal à l'échéance ?",
    "rawAns": "6 € (Écart de strikes de 10 € - coût net de 4 €)",
    "cleanAns": "6 €",
    "show": "6 € (Écart de strikes de 10 € - coût net de 4 €)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "6 ecart de strikes de 10 cout net de 4",
      "6"
    ],
    "choices": [
      "4,8 €",
      "7,5 €",
      "3 €",
      "6 €"
    ],
    "correctChoice": "6 €"
  },
  {
    "id": 225,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Sur une option barrière, comment qualifie-t-on une option qui s'active uniquement si le sous-jacent franchit un certain seuil à la baisse ?",
    "rawAns": "Down-and-In",
    "cleanAns": "Down-and-In",
    "show": "Down-and-In",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "down and in"
    ],
    "choices": [
      "Up-and-In",
      "Down-and-In",
      "Up-and-Out",
      "Down-and-Out"
    ],
    "correctChoice": "Down-and-In"
  },
  {
    "id": 226,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Comment appelle-t-on une option dont le payoff dépend du prix moyen du sous-jacent sur toute la durée de vie du contrat ?",
    "rawAns": "Une option Asiatique",
    "cleanAns": "Une option Asiatique",
    "show": "Une option Asiatique",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "une option asiatique"
    ],
    "choices": [
      "Une option Barrière",
      "Une option Asiatique",
      "Une option Européenne",
      "Une option Bermudienne"
    ],
    "correctChoice": "Une option Asiatique"
  },
  {
    "id": 227,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quel théorème de 1958 stipule que, dans un marché parfait sans impôts ni coûts de faillite, la valeur d'une entreprise est indépendante de sa structure de financement ?",
    "rawAns": "Le théorème de Modigliani-Miller",
    "cleanAns": "Le théorème de Modigliani-Miller",
    "show": "Le théorème de Modigliani-Miller",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "le theoreme de modigliani miller"
    ],
    "choices": [
      "Le théorème de Black-Scholes",
      "Le modèle CAPM de Sharpe",
      "Le théorème de Coase",
      "Le théorème de Modigliani-Miller"
    ],
    "correctChoice": "Le théorème de Modigliani-Miller"
  },
  {
    "id": 228,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Dans la décomposition de DuPont, le ROE est le produit de trois ratios : Marge nette x Rotation des actifs x ... Quel est le troisième terme ?",
    "rawAns": "Le levier financier (Actif total / Capitaux propres)",
    "cleanAns": "Le levier financier",
    "show": "Le levier financier (Actif total / Capitaux propres)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "le levier financier actif total capitaux propres",
      "le levier financier"
    ],
    "choices": [
      "Le BFR d'exploitation",
      "La rotation des stocks",
      "Le levier financier",
      "Le coût de la dette"
    ],
    "correctChoice": "Le levier financier"
  },
  {
    "id": 229,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une banque affiche un ratio de levier de 20 (Actif / Fonds propres). Quelle baisse en pourcentage de la valeur de ses actifs suffit à anéantir 100 % de ses fonds propres ?",
    "rawAns": "5 % (1 / 20)",
    "cleanAns": "5 %",
    "show": "5 % (1 / 20)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "5 1 20",
      "5"
    ],
    "choices": [
      "4 %",
      "2,5 %",
      "5 %",
      "6,3 %"
    ],
    "correctChoice": "5 %"
  },
  {
    "id": 230,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quel est le prix Forward à 1 an d'une action cotant 100 €, ne versant pas de dividende, si le taux sans risque continu est de 5 % par an ?",
    "rawAns": "Environ 105,13 € (ou 105 € en taux composé annuel : $100 \\times 1,05$)",
    "cleanAns": "Environ 105,13 €",
    "show": "Environ 105,13 € (ou 105 € en taux composé annuel : $100 \\times 1,05$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "environ 105 13 ou 105 en taux compose annuel 100 times 1 05",
      "environ 105 13",
      "105.13",
      "105,13"
    ],
    "choices": [
      "Donnée insuffisante",
      "Non concerné",
      "Aucune des réponses",
      "Environ 105,13 €"
    ],
    "correctChoice": "Environ 105,13 €"
  },
  {
    "id": 231,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Si le prix du pétrole au comptant (Spot) est supérieur aux prix des contrats Futures à échéances lointaines, dans quelle configuration est la courbe ?",
    "rawAns": "En Backwardation (Déport)",
    "cleanAns": "En Backwardation",
    "show": "En Backwardation (Déport)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "en backwardation deport",
      "en backwardation"
    ],
    "choices": [
      "En courbe plate",
      "En Backwardation",
      "En Contango",
      "En inversion de convexité"
    ],
    "correctChoice": "En Backwardation"
  },
  {
    "id": 232,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "À l'inverse, comment s'appelle la situation où les prix Futures sont plus élevés que le prix Spot ?",
    "rawAns": "Le Contango (Report)",
    "cleanAns": "Le Contango",
    "show": "Le Contango (Report)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "le contango report",
      "le contango"
    ],
    "choices": [
      "Le Roll Yield",
      "La Déportation",
      "La Backwardation",
      "Le Contango"
    ],
    "correctChoice": "Le Contango"
  },
  {
    "id": 233,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Un CDS à 5 ans se négocie à un spread de 200 bps. Si le taux de recouvrement (Recovery Rate) est estimé à 60 %, quelle est la probabilité annuelle implicite de défaut ?",
    "rawAns": "5 % ($\\text{Spread} / (1 - R) = 2\\% / (1 - 0,60) = 0,02 / 0,40 = 5\\%$)",
    "cleanAns": "5 %",
    "show": "5 % ($\\text{Spread} / (1 - R) = 2\\% / (1 - 0,60) = 0,02 / 0,40 = 5\\%$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "5 text spread 1 r 2 1 0 60 0 02 0 40 5",
      "5"
    ],
    "choices": [
      "6,3 %",
      "4 %",
      "2,5 %",
      "5 %"
    ],
    "correctChoice": "5 %"
  },
  {
    "id": 234,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Dans un LBO, comment appelle-t-on la dette subordonnée hybride située entre la dette senior et les capitaux propres (souvent assortie de BSA/Warrants) ?",
    "rawAns": "La dette Mezzanine",
    "cleanAns": "La dette Mezzanine",
    "show": "La dette Mezzanine",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "la dette mezzanine"
    ],
    "choices": [
      "Le prêt revolving",
      "La dette Mezzanine",
      "La dette Senior sécurisée",
      "Les actions de préférence"
    ],
    "correctChoice": "La dette Mezzanine"
  },
  {
    "id": 235,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quel ratio mesure la capacité de remboursement d'une entreprise en divisant la Dette Nette par l'EBITDA ?",
    "rawAns": "Le ratio de Levier (Net Debt / EBITDA)",
    "cleanAns": "Le ratio de Levier",
    "show": "Le ratio de Levier (Net Debt / EBITDA)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le ratio de levier net debt ebitda",
      "le ratio de levier"
    ],
    "choices": [
      "Le Debt Service Coverage Ratio (DSCR)",
      "Le ratio de Quick Ratio",
      "Le ratio de Solvabilité",
      "Le ratio de Levier"
    ],
    "correctChoice": "Le ratio de Levier"
  },
  {
    "id": 236,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une entreprise a un EBIT de 50 M€, des D&A de 10 M€, des Capex de 15 M€, une hausse du BFR de 5 M€ et un taux d'IS de 20 %. Quel est son Free Cash Flow to Firm (FCFF) ?",
    "rawAns": "30 M€ ($\\text{EBIT}(1-t) + \\text{D\\&A} - \\text{Capex} - \\Delta\\text{BFR} = 40 + 10 - 15 - 5$)",
    "cleanAns": "30 M€",
    "show": "30 M€ ($\\text{EBIT}(1-t) + \\text{D\\&A} - \\text{Capex} - \\Delta\\text{BFR} = 40 + 10 - 15 - 5$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "30 m text ebit 1 t text d a text capex delta text bfr 40 10 15 5",
      "30 m",
      "30"
    ],
    "choices": [
      "15 M€",
      "24 M€",
      "30 M€",
      "37,5 M€"
    ],
    "correctChoice": "30 M€"
  },
  {
    "id": 237,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quelle propriété possède un processus stochastique dit « Martingale » ?",
    "rawAns": "Son espérance conditionnelle future est égale à sa valeur présente ($E[X_{t+1}|\\mathcal{F}_t] = X_t$)",
    "cleanAns": "Son espérance conditionnelle future est égale à sa valeur présente",
    "show": "Son espérance conditionnelle future est égale à sa valeur présente ($E[X_{t+1}|\\mathcal{F}_t] = X_t$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "son esperance conditionnelle future est egale a sa valeur presente e x t 1 mathcal f t x t",
      "son esperance conditionnelle future est egale a sa valeur presente"
    ],
    "choices": [
      "Elle converge vers zéro à l'infini",
      "Ses trajectoires sont toujours dérivables",
      "Son espérance conditionnelle future est égale à sa valeur présente",
      "Sa variance augmente de façon exponentielle"
    ],
    "correctChoice": "Son espérance conditionnelle future est égale à sa valeur présente"
  },
  {
    "id": 238,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Si le cours EUR/USD est à 1,1000, le taux d'intérêt US à 1 an est de 5 % et le taux Euro à 1 an est de 3 %, le Forward EUR/USD à 1 an cote-t-il au-dessus ou en dessous de 1,1000 ?",
    "rawAns": "Au-dessus (Environ 1,1213 : la devise à taux faible cote en report)",
    "cleanAns": "Au-dessus",
    "show": "Au-dessus (Environ 1,1213 : la devise à taux faible cote en report)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "au dessus environ 1 1213 la devise a taux faible cote en report",
      "au dessus"
    ],
    "choices": [
      "En dessous",
      "Au-dessus",
      "Exactement égal à 1,1000",
      "Impossible à calculer sans la Fed"
    ],
    "correctChoice": "Au-dessus"
  },
  {
    "id": 239,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Comment appelle-t-on l'écart de valeur constaté lors d'une acquisition entre le prix payé et la juste valeur des actifs nets identifiables ?",
    "rawAns": "Le Goodwill (Écart d'acquisition / Survaleur)",
    "cleanAns": "Le Goodwill",
    "show": "Le Goodwill (Écart d'acquisition / Survaleur)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "le goodwill ecart d acquisition survaleur",
      "le goodwill"
    ],
    "choices": [
      "Le Capex non alloué",
      "La Prime de contrôle",
      "L'actif incorporel net",
      "Le Goodwill"
    ],
    "correctChoice": "Le Goodwill"
  },
  {
    "id": 240,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Une obligation perpétuelle verse 50 € par an. Si les taux passent de 5 % à 4 %, quel est le gain en capital en euros ?",
    "rawAns": "+250 € (Le prix passe de $50/0,05 = 1000$ € à $50/0,04 = 1250$ €)",
    "cleanAns": "+250 €",
    "show": "+250 € (Le prix passe de $50/0,05 = 1000$ € à $50/0,04 = 1250$ €)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "250 le prix passe de 50 0 05 1000 a 50 0 04 1250",
      "250",
      "+250"
    ],
    "choices": [
      "+250 €",
      "312,5 €",
      "125 €",
      "200 €"
    ],
    "correctChoice": "+250 €"
  },
  {
    "id": 241,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Quelle lettre grecque mesure la sensibilité du prix d'une option au taux d'intérêt sans risque ?",
    "rawAns": "Le Rhô ($\\rho$)",
    "cleanAns": "Le Rhô",
    "show": "Le Rhô ($\\rho$)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "le rho rho",
      "le rho"
    ],
    "choices": [
      "Le Rhô",
      "Le Véga",
      "Le Charm",
      "Le Vomma"
    ],
    "correctChoice": "Le Rhô"
  },
  {
    "id": 242,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quel est le payoff d'une option « Digitale » (ou Binaire) Cash-or-Nothing Call à l'échéance si $S_T > K$ ?",
    "rawAns": "Un montant fixe prédéterminé (ex: 1 € ou 100 €), peu importe de combien $S_T$ dépasse $K$",
    "cleanAns": "Un montant fixe prédéterminé",
    "show": "Un montant fixe prédéterminé (ex: 1 € ou 100 €), peu importe de combien $S_T$ dépasse $K$",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "un montant fixe predetermine ex 1 ou 100 peu importe de combien s t depasse k",
      "un montant fixe predetermine"
    ],
    "choices": [
      "Zéro dans tous les cas",
      "La différence $S_T - K$",
      "Un montant fixe prédéterminé",
      "Le cours du sous-jacent multiplié par le Strike"
    ],
    "correctChoice": "Un montant fixe prédéterminé"
  },
  {
    "id": 243,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quel est le signe du Gamma d'un portefeuille constitué uniquement d'actions et de contrats Futures ?",
    "rawAns": "Nul (Gamma = 0, produits linéaires)",
    "cleanAns": "Nul",
    "show": "Nul (Gamma = 0, produits linéaires)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "nul gamma 0 produits lineaires",
      "nul"
    ],
    "choices": [
      "Négatif (Gamma < 0)",
      "Égal à 1",
      "Positif (Gamma > 0)",
      "Nul"
    ],
    "correctChoice": "Nul"
  },
  {
    "id": 244,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Si un fonds spéculatif (Hedge Fund) facture « 2 and 20 » (2 % de frais de gestion, 20 % de commission de performance) et réalise +22 % brut sur 100 M€, combien gagne le client en net ?",
    "rawAns": "+16 % soit 16 M€ (22 % - 2 % frais fixes = 20 % ; moins 20 % de perf sur 20 % = 16 %)",
    "cleanAns": "+16 % soit 16 M€",
    "show": "+16 % soit 16 M€ (22 % - 2 % frais fixes = 20 % ; moins 20 % de perf sur 20 % = 16 %)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "16 soit 16 m 22 2 frais fixes 20 moins 20 de perf sur 20 16",
      "16 soit 16 m",
      "+16",
      "16"
    ],
    "choices": [
      "8 % soit 16 M€",
      "20 % soit 16 M€",
      "12,8 % soit 16 M€",
      "+16 % soit 16 M€"
    ],
    "correctChoice": "+16 % soit 16 M€"
  },
  {
    "id": 245,
    "cat": "Finance",
    "level": "expert",
    "time": 30,
    "text": "Comment s'appelle la clause qui empêche un gérant de Hedge Fund de toucher des commissions de performance tant qu'il n'a pas effacé ses pertes passées ?",
    "rawAns": "Le High-Water Mark",
    "cleanAns": "Le High-Water Mark",
    "show": "Le High-Water Mark",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "le high water mark"
    ],
    "choices": [
      "La Watermark Clause",
      "La Hurdle Rate",
      "Le Clawback",
      "Le High-Water Mark"
    ],
    "correctChoice": "Le High-Water Mark"
  },
  {
    "id": 246,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quel est le Multiplicateur Monétaire théorique si le taux de réserves obligatoires des banques commerciales est de 5 % (et sans fuite en billets) ?",
    "rawAns": "20 (1 / 0,05)",
    "cleanAns": "20",
    "show": "20 (1 / 0,05)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "20 1 0 05",
      "20"
    ],
    "choices": [
      "20",
      "25",
      "16",
      "10"
    ],
    "correctChoice": "20"
  },
  {
    "id": 247,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Dans les accords bancaires de Bâle III, que signifie l'acronyme CET1 ?",
    "rawAns": "Common Equity Tier 1 (Fonds propres de base de catégorie 1)",
    "cleanAns": "Common Equity Tier 1",
    "show": "Common Equity Tier 1 (Fonds propres de base de catégorie 1)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "common equity tier 1 fonds propres de base de categorie 1",
      "common equity tier 1",
      "1"
    ],
    "choices": [
      "Central Euro Tier 1",
      "Core Equity Total Reserve",
      "Common Equity Tier 1",
      "Credit Exposure Total"
    ],
    "correctChoice": "Common Equity Tier 1"
  },
  {
    "id": 248,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Si la covariance entre un titre A et le marché est de 0,06 et que la variance du marché est de 0,04, quel est le Bêta du titre A ?",
    "rawAns": "1,5 ($\\text{Cov}(A, M) / \\text{Var}(M) = 0,06 / 0,04$)",
    "cleanAns": "1,5",
    "show": "1,5 ($\\text{Cov}(A, M) / \\text{Var}(M) = 0,06 / 0,04$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "1 5 text cov a m text var m 0 06 0 04",
      "1 5",
      "1.5",
      "1,5"
    ],
    "choices": [
      "0,8",
      "1,5",
      "1,2",
      "1,9"
    ],
    "correctChoice": "1,5"
  },
  {
    "id": 249,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Quelle est la Duration de Macaulay d'une obligation Zéro-Coupon de maturité 8 ans ?",
    "rawAns": "8 ans (Égale à sa maturité)",
    "cleanAns": "8 ans",
    "show": "8 ans (Égale à sa maturité)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "8 ans egale a sa maturite",
      "8 ans",
      "8"
    ],
    "choices": [
      "8 ans",
      "6,4 ans",
      "10 ans",
      "4 ans"
    ],
    "correctChoice": "8 ans"
  },
  {
    "id": 250,
    "cat": "Finance",
    "level": "expert",
    "time": 35,
    "text": "Vous vendez à découvert 100 actions à 50 €. Le courtier exige une marge de 50 %. Combien devez-vous immobiliser en collatéral ?",
    "rawAns": "2 500 € (50 % de 5 000 €)",
    "cleanAns": "2 500 €",
    "show": "2 500 € (50 % de 5 000 €)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "2 500 50 de 5 000",
      "2 500",
      "2",
      "500"
    ],
    "choices": [
      "1 500 €",
      "2 500 €",
      "1,6 500 €",
      "2,5 500 €"
    ],
    "correctChoice": "2 500 €"
  },
  {
    "id": 251,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Dans le paradoxe de Monty Hall (3 portes, 1 voiture, 2 chèvres), l'animateur ouvre une porte avec une chèvre. Quelle est votre probabilité de gagner si vous changez de porte ?",
    "rawAns": "2/3 (66,7 %)",
    "cleanAns": "2/3",
    "show": "2/3 (66,7 %)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "2 3 66 7",
      "2 3",
      "2",
      "3"
    ],
    "choices": [
      "1,6 /3",
      "2,5 /3",
      "2/3",
      "1 /3"
    ],
    "correctChoice": "2/3"
  },
  {
    "id": 252,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Vous lancez deux dés. Sachant qu'au moins l'un des deux dés montre un 6, quelle est la probabilité que la somme fasse 12 (double 6) ?",
    "rawAns": "1/11 (Il y a 11 combinaisons contenant au moins un 6, et 1 seule est 6-6)",
    "cleanAns": "1/11",
    "show": "1/11 (Il y a 11 combinaisons contenant au moins un 6, et 1 seule est 6-6)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "1 11 il y a 11 combinaisons contenant au moins un 6 et 1 seule est 6 6",
      "1 11",
      "1",
      "11"
    ],
    "choices": [
      "1/11",
      "0 /11",
      "2 /11",
      "3 /11"
    ],
    "correctChoice": "1/11"
  },
  {
    "id": 253,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Combien de personnes faut-il réunir au minimum dans une pièce pour que la probabilité que deux d'entre elles aient la même date d'anniversaire dépasse 50 % ?",
    "rawAns": "23 personnes (Paradoxe des anniversaires)",
    "cleanAns": "23 personnes",
    "show": "23 personnes (Paradoxe des anniversaires)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "23 personnes paradoxe des anniversaires",
      "23 personnes",
      "23"
    ],
    "choices": [
      "18,4 personnes",
      "11,5 personnes",
      "28,8 personnes",
      "23 personnes"
    ],
    "correctChoice": "23 personnes"
  },
  {
    "id": 254,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Une famille a deux enfants. Sachant qu'au moins l'un des deux est un garçon, quelle est la probabilité que les deux soient des garçons ?",
    "rawAns": "1/3 (Les cas équiprobables restants sont GG, GF, FG)",
    "cleanAns": "1/3",
    "show": "1/3 (Les cas équiprobables restants sont GG, GF, FG)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "1 3 les cas equiprobables restants sont gg gf fg",
      "1 3",
      "1",
      "3"
    ],
    "choices": [
      "3 /3",
      "1/3",
      "0 /3",
      "2 /3"
    ],
    "correctChoice": "1/3"
  },
  {
    "id": 255,
    "cat": "Probabilités",
    "level": "expert",
    "time": 45,
    "text": "Vous jouez à la roulette russe avec un barillet à 6 chambres contenant 2 balles placées côte à côte. Votre adversaire tire à vide. Devez-vous tirer directement ou refaire tourner le barillet ?",
    "rawAns": "Tirer directement (4 chances sur 4 emplacements vides que le suivant soit vide dans 3 cas sur 4 = 75 % de survie, contre 4/6 = 66,7 % en refaisant tourner)",
    "cleanAns": "Tirer directement",
    "show": "Tirer directement (4 chances sur 4 emplacements vides que le suivant soit vide dans 3 cas sur 4 = 75 % de survie, contre 4/6 = 66,7 % en refaisant tourner)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "tirer directement 4 chances sur 4 emplacements vides que le suivant soit vide dans 3 cas sur 4 75 de survie contre 4 6 66 7 en refaisant tourner",
      "tirer directement"
    ],
    "choices": [
      "Refaire tourner le barillet",
      "Laisser l'adversaire rejouer",
      "Les deux options sont équivalentes",
      "Tirer directement"
    ],
    "correctChoice": "Tirer directement"
  },
  {
    "id": 256,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "En moyenne, combien de lancers d'une pièce équilibrée faut-il effectuer pour obtenir un « Pile » pour la première fois ?",
    "rawAns": "2 lancers (Loi géométrique de paramètre $p = 0,5 \\Rightarrow E = 1/p = 2$)",
    "cleanAns": "2 lancers",
    "show": "2 lancers (Loi géométrique de paramètre $p = 0,5 \\Rightarrow E = 1/p = 2$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "2 lancers loi geometrique de parametre p 0 5 rightarrow e 1 p 2",
      "2 lancers",
      "2"
    ],
    "choices": [
      "1 lancers",
      "2 lancers",
      "1,6 lancers",
      "2,5 lancers"
    ],
    "correctChoice": "2 lancers"
  },
  {
    "id": 257,
    "cat": "Probabilités",
    "level": "expert",
    "time": 45,
    "text": "En moyenne, combien de lancers d'une pièce équilibrée faut-il pour obtenir deux « Pile » consécutifs (PP) ?",
    "rawAns": "6 lancers ($E = 2 + 4 = 6$)",
    "cleanAns": "6 lancers",
    "show": "6 lancers ($E = 2 + 4 = 6$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "6 lancers e 2 4 6",
      "6 lancers",
      "6"
    ],
    "choices": [
      "6 lancers",
      "4,8 lancers",
      "7,5 lancers",
      "3 lancers"
    ],
    "correctChoice": "6 lancers"
  },
  {
    "id": 258,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Une urne contient 4 boules rouges et 3 boules bleues. On en tire 2 sans remise. Quelle est la probabilité qu'elles soient de la même couleur ?",
    "rawAns": "3/7 (Rouge-Rouge = 12/42, Bleu-Bleu = 6/42 ; Total = 18/42 = 3/7)",
    "cleanAns": "3/7",
    "show": "3/7 (Rouge-Rouge = 12/42, Bleu-Bleu = 6/42 ; Total = 18/42 = 3/7)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "3 7 rouge rouge 12 42 bleu bleu 6 42 total 18 42 3 7",
      "3 7",
      "3",
      "7"
    ],
    "choices": [
      "3/7",
      "1,5 /7",
      "2,4 /7",
      "3,8 /7"
    ],
    "correctChoice": "3/7"
  },
  {
    "id": 259,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "On casse un bâton de 1 mètre au hasard en deux endroits. Quelle est la probabilité de pouvoir former un triangle avec les 3 morceaux ?",
    "rawAns": "1/4 (25 %)",
    "cleanAns": "1/4",
    "show": "1/4 (25 %)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "1 4 25",
      "1 4",
      "1",
      "4"
    ],
    "choices": [
      "1/4",
      "0 /4",
      "2 /4",
      "3 /4"
    ],
    "correctChoice": "1/4"
  },
  {
    "id": 260,
    "cat": "Probabilités",
    "level": "expert",
    "time": 45,
    "text": "Trois fourmis sont placées aux 3 sommets d'un triangle équilatéral. Chacune choisit au hasard une arête et avance. Quelle est la probabilité qu'aucune fourmi ne se croise ?",
    "rawAns": "1/4 (2 issues favorables : toutes sens horaire ou toutes anti-horaire sur $2^3 = 8$ issues, soit 2/8)",
    "cleanAns": "1/4",
    "show": "1/4 (2 issues favorables : toutes sens horaire ou toutes anti-horaire sur $2^3 = 8$ issues, soit 2/8)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "1 4 2 issues favorables toutes sens horaire ou toutes anti horaire sur 2 3 8 issues soit 2 8",
      "1 4",
      "1",
      "4"
    ],
    "choices": [
      "1/4",
      "0 /4",
      "2 /4",
      "3 /4"
    ],
    "correctChoice": "1/4"
  },
  {
    "id": 261,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Vous faites l'aller de A à B à 60 km/h et le retour de B à A à 40 km/h. Quelle est votre vitesse moyenne sur l'ensemble du trajet ?",
    "rawAns": "48 km/h (Moyenne harmonique : $\\frac{2 \\times 60 \\times 40}{60 + 40}$)",
    "cleanAns": "48 km/h",
    "show": "48 km/h (Moyenne harmonique : $\\frac{2 \\times 60 \\times 40}{60 + 40}$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "48 km h moyenne harmonique frac 2 times 60 times 40 60 40",
      "48 km h",
      "48"
    ],
    "choices": [
      "38,4 km/h",
      "60 km/h",
      "24 km/h",
      "48 km/h"
    ],
    "correctChoice": "48 km/h"
  },
  {
    "id": 262,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Combien y a-t-il de zéros à la fin de $100!$ (factorielle de 100) ?",
    "rawAns": "24 zéros ($100/5 + 100/25 = 20 + 4$)",
    "cleanAns": "24 zéros",
    "show": "24 zéros ($100/5 + 100/25 = 20 + 4$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "24 zeros 100 5 100 25 20 4",
      "24 zeros",
      "24"
    ],
    "choices": [
      "24 zéros",
      "30 zéros",
      "19,2 zéros",
      "12 zéros"
    ],
    "correctChoice": "24 zéros"
  },
  {
    "id": 263,
    "cat": "Calcul",
    "level": "expert",
    "time": 30,
    "text": "Combien font $99^2$ de tête ?",
    "rawAns": "9 801 ($(100 - 1)^2 = 10000 - 200 + 1$)",
    "cleanAns": "9 801",
    "show": "9 801 ($(100 - 1)^2 = 10000 - 200 + 1$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "9 801 100 1 2 10000 200 1",
      "9 801",
      "9",
      "801"
    ],
    "choices": [
      "11,3 801",
      "4,5 801",
      "9 801",
      "7,2 801"
    ],
    "correctChoice": "9 801"
  },
  {
    "id": 264,
    "cat": "Calcul",
    "level": "expert",
    "time": 30,
    "text": "Combien font $48 \\times 52$ de tête ?",
    "rawAns": "2 496 ($(50 - 2)(50 + 2) = 2500 - 4$)",
    "cleanAns": "2 496",
    "show": "2 496 ($(50 - 2)(50 + 2) = 2500 - 4$)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "2 496 50 2 50 2 2500 4",
      "2 496",
      "2",
      "496"
    ],
    "choices": [
      "1 496",
      "2 496",
      "1,6 496",
      "2,5 496"
    ],
    "correctChoice": "2 496"
  },
  {
    "id": 265,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Quelle est la somme de la série géométrique infinie : $1 + 1/2 + 1/4 + 1/8 + 1/16 + \\dots$ ?",
    "rawAns": "2 ($1 / (1 - 0,5)$)",
    "cleanAns": "2",
    "show": "2 ($1 / (1 - 0,5)$)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "2 1 1 0 5",
      "2"
    ],
    "choices": [
      "1,6",
      "2,5",
      "1",
      "2"
    ],
    "correctChoice": "2"
  },
  {
    "id": 266,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Quel est le chiffre des unités de $7^{100}$ ?",
    "rawAns": "1 (Le cycle des unités des puissances de 7 est 7, 9, 3, 1 : 100 est un multiple de 4)",
    "cleanAns": "1",
    "show": "1 (Le cycle des unités des puissances de 7 est 7, 9, 3, 1 : 100 est un multiple de 4)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "1 le cycle des unites des puissances de 7 est 7 9 3 1 100 est un multiple de 4",
      "1"
    ],
    "choices": [
      "1",
      "2",
      "3",
      "0"
    ],
    "correctChoice": "1"
  },
  {
    "id": 267,
    "cat": "Spatial",
    "level": "expert",
    "time": 35,
    "text": "On peint un grand cube de $4 \\times 4 \\times 4$. Combien de petits cubes n'ont AUCUNE face peinte ?",
    "rawAns": "8 (Le cube intérieur de $2 \\times 2 \\times 2$)",
    "cleanAns": "8",
    "show": "8 (Le cube intérieur de $2 \\times 2 \\times 2$)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "8 le cube interieur de 2 times 2 times 2",
      "8"
    ],
    "choices": [
      "8",
      "6,4",
      "10",
      "4"
    ],
    "correctChoice": "8"
  },
  {
    "id": 268,
    "cat": "Spatial",
    "level": "expert",
    "time": 40,
    "text": "On peint un grand cube de $10 \\times 10 \\times 10$. Combien de petits cubes ont au moins une face peinte (la coque extérieure) ?",
    "rawAns": "488 ($1000 - 8^3 = 1000 - 512$)",
    "cleanAns": "488",
    "show": "488 ($1000 - 8^3 = 1000 - 512$)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "488 1000 8 3 1000 512",
      "488"
    ],
    "choices": [
      "244",
      "488",
      "390,4",
      "610"
    ],
    "correctChoice": "488"
  },
  {
    "id": 269,
    "cat": "Spatial",
    "level": "expert",
    "time": 40,
    "text": "Combien de carrés de toutes tailles y a-t-il sur un échiquier standard de $8 \\times 8$ ?",
    "rawAns": "204 ($1^2 + 2^2 + 3^2 + \\dots + 8^2 = \\frac{8 \\times 9 \\times 17}{6}$)",
    "cleanAns": "204",
    "show": "204 ($1^2 + 2^2 + 3^2 + \\dots + 8^2 = \\frac{8 \\times 9 \\times 17}{6}$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "204 1 2 2 2 3 2 dots 8 2 frac 8 times 9 times 17 6",
      "204"
    ],
    "choices": [
      "102",
      "204",
      "255",
      "163,2"
    ],
    "correctChoice": "204"
  },
  {
    "id": 270,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Vous avez deux cordes qui mettent chacune exactement 1 heure à brûler (mais de façon irrégulière). Comment mesurer 45 minutes ?",
    "rawAns": "Allumer la corde 1 aux deux bouts et la corde 2 à un bout ; quand la 1 finit (30 min), allumer le 2ème bout de la corde 2 (15 min restantes)",
    "cleanAns": "Allumer la corde 1 aux deux bouts et la corde 2 à un bout ; quand la 1 finit",
    "show": "Allumer la corde 1 aux deux bouts et la corde 2 à un bout ; quand la 1 finit (30 min), allumer le 2ème bout de la corde 2 (15 min restantes)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "allumer la corde 1 aux deux bouts et la corde 2 a un bout quand la 1 finit 30 min allumer le 2eme bout de la corde 2 15 min restantes",
      "allumer la corde 1 aux deux bouts et la corde 2 a un bout quand la 1 finit",
      "1",
      "2"
    ],
    "choices": [
      "Allumer la corde 1 aux deux bouts et la corde 2 à un bout ; quand la 1 finit",
      "Allumer la corde 1 au milieu et la 2 aux extrémités",
      "Ce n'est pas possible",
      "Allumer les deux cordes en même temps d'un seul bout"
    ],
    "correctChoice": "Allumer la corde 1 aux deux bouts et la corde 2 à un bout ; quand la 1 finit"
  },
  {
    "id": 271,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Vous avez un bidon de 5L et un de 3L. Comment obtenir exactement 4L ? (Indiquez le nombre d'étapes ou la logique)",
    "rawAns": "Remplir le 5L, verser dans le 3L (reste 2L dans le 5L), vider le 3L, mettre les 2L dans le 3L, remplir le 5L et compléter le 3L (il reste 4L dans le 5L)",
    "cleanAns": "Remplir le 5L, verser dans le 3L",
    "show": "Remplir le 5L, verser dans le 3L (reste 2L dans le 5L), vider le 3L, mettre les 2L dans le 3L, remplir le 5L et compléter le 3L (il reste 4L dans le 5L)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "remplir le 5l verser dans le 3l reste 2l dans le 5l vider le 3l mettre les 2l dans le 3l remplir le 5l et completer le 3l il reste 4l dans le 5l",
      "remplir le 5l verser dans le 3l",
      "5",
      "3"
    ],
    "choices": [
      "Donnée insuffisante",
      "Remplir le 5L, verser dans le 3L",
      "Non concerné",
      "Aucune des réponses"
    ],
    "correctChoice": "Remplir le 5L, verser dans le 3L"
  },
  {
    "id": 272,
    "cat": "Logique",
    "level": "expert",
    "time": 45,
    "text": "25 chevaux courent sur des pistes de 5 couloirs (sans chronomètre). Quel est le nombre minimum de courses pour trouver les 3 chevaux les plus rapides ?",
    "rawAns": "7 courses (5 séries qualificatives + 1 course des 5 gagnants + 1 course finale des 5 prétendants aux places 2 et 3)",
    "cleanAns": "7 courses",
    "show": "7 courses (5 séries qualificatives + 1 course des 5 gagnants + 1 course finale des 5 prétendants aux places 2 et 3)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "7 courses 5 series qualificatives 1 course des 5 gagnants 1 course finale des 5 pretendants aux places 2 et 3",
      "7 courses",
      "7"
    ],
    "choices": [
      "7 courses",
      "5,6 courses",
      "8,8 courses",
      "3,5 courses"
    ],
    "correctChoice": "7 courses"
  },
  {
    "id": 273,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Une maladie touche 1 % de la population. Un test est fiable à 99 % (vrais positifs et vrais négatifs). Si vous êtes testé positif, quelle est la probabilité que vous soyez réellement malade ?",
    "rawAns": "50 % (Théorème de Bayes : sur 10 000 personnes, 99 vrais positifs et 99 faux positifs)",
    "cleanAns": "50 %",
    "show": "50 % (Théorème de Bayes : sur 10 000 personnes, 99 vrais positifs et 99 faux positifs)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "50 theoreme de bayes sur 10 000 personnes 99 vrais positifs et 99 faux positifs",
      "50"
    ],
    "choices": [
      "40 %",
      "50 %",
      "62,5 %",
      "25 %"
    ],
    "correctChoice": "50 %"
  },
  {
    "id": 274,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Complétez la suite de Conway : 1 - 11 - 21 - 1211 - 111221 - ?",
    "rawAns": "312211",
    "cleanAns": "312211",
    "show": "312211",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "312211"
    ],
    "choices": [
      "312211",
      "156105,5",
      "249768,8",
      "390263,8"
    ],
    "correctChoice": "312211"
  },
  {
    "id": 275,
    "cat": "Logique",
    "level": "expert",
    "time": 35,
    "text": "Complétez la suite : 2 - 12 - 36 - 80 - 150 - ?",
    "rawAns": "252 ($n^2 + n^3$ : pour $n=6 \\Rightarrow 36 + 216 = 252$)",
    "cleanAns": "252",
    "show": "252 ($n^2 + n^3$ : pour $n=6 \\Rightarrow 36 + 216 = 252$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "252 n 2 n 3 pour n 6 rightarrow 36 216 252",
      "252"
    ],
    "choices": [
      "126",
      "252",
      "315",
      "201,6"
    ],
    "correctChoice": "252"
  },
  {
    "id": 276,
    "cat": "Logique",
    "level": "expert",
    "time": 35,
    "text": "Complétez la suite : O - T - T - F - F - S - S - E - ?",
    "rawAns": "N (Nine : initiales des nombres en anglais)",
    "cleanAns": "N",
    "show": "N (Nine : initiales des nombres en anglais)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "n nine initiales des nombres en anglais",
      "n"
    ],
    "choices": [
      "S",
      "T",
      "E",
      "N"
    ],
    "correctChoice": "N"
  },
  {
    "id": 277,
    "cat": "Logique",
    "level": "expert",
    "time": 35,
    "text": "Complétez la suite : U - D - T - C - S - ? (Indice : nombres premiers en français)",
    "rawAns": "O (Onze : Deux, Trois, Cinq, Sept, Onze - avec Un en tête)",
    "cleanAns": "O",
    "show": "O (Onze : Deux, Trois, Cinq, Sept, Onze - avec Un en tête)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "o onze deux trois cinq sept onze avec un en tete",
      "o"
    ],
    "choices": [
      "O",
      "Q",
      "C",
      "T"
    ],
    "correctChoice": "O"
  },
  {
    "id": 278,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "À quelle heure exacte entre 12h00 et 13h00 les aiguilles d'une montre se superposent-elles ?",
    "rawAns": "Aucune (Elles se superposent à 12h00 puis à 13h05 et 5/11 min, soit 12/11 d'heure)",
    "cleanAns": "Aucune",
    "show": "Aucune (Elles se superposent à 12h00 puis à 13h05 et 5/11 min, soit 12/11 d'heure)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "aucune elles se superposent a 12h00 puis a 13h05 et 5 11 min soit 12 11 d heure",
      "aucune"
    ],
    "choices": [
      "Donnée insuffisante",
      "Non concerné",
      "Aucune",
      "Aucune des réponses"
    ],
    "correctChoice": "Aucune"
  },
  {
    "id": 279,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Combien de fois par jour (24h) les aiguilles des heures et des minutes d'une horloge se superposent-elles ?",
    "rawAns": "22 fois",
    "cleanAns": "22 fois",
    "show": "22 fois",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "22 fois",
      "22"
    ],
    "choices": [
      "11 fois",
      "22 fois",
      "17,6 fois",
      "27,5 fois"
    ],
    "correctChoice": "22 fois"
  },
  {
    "id": 280,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Vous avez 10 sacs de pièces d'or (10g la pièce), mais un sac ne contient que des fausses pièces de 9g. Avec une balance électronique précise au gramme, combien de pesées minimum pour trouver le faux sac ?",
    "rawAns": "1 seule pesée (Prendre 1 pièce du sac 1, 2 du sac 2... 10 du sac 10 ; l'écart avec 550g donne le numéro du sac)",
    "cleanAns": "1 seule pesée",
    "show": "1 seule pesée (Prendre 1 pièce du sac 1, 2 du sac 2... 10 du sac 10 ; l'écart avec 550g donne le numéro du sac)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "1 seule pesee prendre 1 piece du sac 1 2 du sac 2 10 du sac 10 l ecart avec 550g donne le numero du sac",
      "1 seule pesee",
      "1"
    ],
    "choices": [
      "0 seule pesée",
      "1 seule pesée",
      "2 seule pesée",
      "3 seule pesée"
    ],
    "correctChoice": "1 seule pesée"
  },
  {
    "id": 281,
    "cat": "Logique",
    "level": "expert",
    "time": 45,
    "text": "5 pirates rationnels doivent partager 100 pièces d'or. Le plus âgé propose un partage ; si au moins 50 % votent oui, il est adopté, sinon il est jeté à l'eau. Combien le plus âgé garde-t-il pour lui ?",
    "rawAns": "98 pièces (Distribution : 98 - 0 - 1 - 0 - 1)",
    "cleanAns": "98 pièces",
    "show": "98 pièces (Distribution : 98 - 0 - 1 - 0 - 1)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "98 pieces distribution 98 0 1 0 1",
      "98 pieces",
      "98"
    ],
    "choices": [
      "98 pièces",
      "78,4 pièces",
      "49 pièces",
      "122,5 pièces"
    ],
    "correctChoice": "98 pièces"
  },
  {
    "id": 282,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Deux joueurs A et B lancent chacun une pièce à tour de rôle. Le premier qui fait « Pile » gagne. A commence. Quelle est la probabilité que A gagne ?",
    "rawAns": "2/3 ($1/2 + 1/8 + 1/32 + \\dots = \\frac{1/2}{1 - 1/4} = 2/3$)",
    "cleanAns": "2/3",
    "show": "2/3 ($1/2 + 1/8 + 1/32 + \\dots = \\frac{1/2}{1 - 1/4} = 2/3$)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "2 3 1 2 1 8 1 32 dots frac 1 2 1 1 4 2 3",
      "2 3",
      "2",
      "3"
    ],
    "choices": [
      "2/3",
      "1 /3",
      "1,6 /3",
      "2,5 /3"
    ],
    "correctChoice": "2/3"
  },
  {
    "id": 283,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Si $\\log_{10}(2) \\approx 0,301$, combien de chiffres comporte le nombre $2^{100}$ en base 10 ?",
    "rawAns": "31 chiffres ($\\lfloor 100 \\times 0,301 \\rfloor + 1 = 30 + 1$)",
    "cleanAns": "31 chiffres",
    "show": "31 chiffres ($\\lfloor 100 \\times 0,301 \\rfloor + 1 = 30 + 1$)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "31 chiffres lfloor 100 times 0 301 rfloor 1 30 1",
      "31 chiffres",
      "31"
    ],
    "choices": [
      "31 chiffres",
      "15,5 chiffres",
      "24,8 chiffres",
      "38,8 chiffres"
    ],
    "correctChoice": "31 chiffres"
  },
  {
    "id": 284,
    "cat": "Logique",
    "level": "expert",
    "time": 35,
    "text": "Si hier était demain, aujourd'hui serait vendredi. Quel jour sommes-nous réellement ?",
    "rawAns": "Mercredi (ou Dimanche selon l'interprétation grammaticale du subjonctif)",
    "cleanAns": "Mercredi",
    "show": "Mercredi (ou Dimanche selon l'interprétation grammaticale du subjonctif)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "mercredi ou dimanche selon l interpretation grammaticale du subjonctif",
      "mercredi"
    ],
    "choices": [
      "Mercredi",
      "Jeudi",
      "Samedi",
      "Mardi"
    ],
    "correctChoice": "Mercredi"
  },
  {
    "id": 285,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Trois robinets A, B et C remplissent une piscine respectivement en 2h, 3h et 6h. En combien de temps la remplissent-ils ensemble ?",
    "rawAns": "1 heure ($1/2 + 1/3 + 1/6 = 1$ piscine par heure)",
    "cleanAns": "1 heure",
    "show": "1 heure ($1/2 + 1/3 + 1/6 = 1$ piscine par heure)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 heure 1 2 1 3 1 6 1 piscine par heure",
      "1 heure",
      "1"
    ],
    "choices": [
      "2 heure",
      "3 heure",
      "0 heure",
      "1 heure"
    ],
    "correctChoice": "1 heure"
  },
  {
    "id": 286,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Vous tirez une variable aléatoire uniforme $X$ entre 0 et 1, puis $Y$ entre 0 et 1. Quelle est la probabilité que $X + Y \\le 1$ ?",
    "rawAns": "1/2 (50 % : la moitié de l'aire du carré unité)",
    "cleanAns": "1/2",
    "show": "1/2 (50 % : la moitié de l'aire du carré unité)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "1 2 50 la moitie de l aire du carre unite",
      "1 2",
      "1",
      "2"
    ],
    "choices": [
      "1/2",
      "0 /2",
      "2 /2",
      "3 /2"
    ],
    "correctChoice": "1/2"
  },
  {
    "id": 287,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Combien de diagonales possède un décagone (polygone à 10 côtés) ?",
    "rawAns": "35 ($\\frac{n(n-3)}{2} = \\frac{10 \\times 7}{2}$)",
    "cleanAns": "35",
    "show": "35 ($\\frac{n(n-3)}{2} = \\frac{10 \\times 7}{2}$)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "35 frac n n 3 2 frac 10 times 7 2",
      "35"
    ],
    "choices": [
      "17,5",
      "43,8",
      "28",
      "35"
    ],
    "correctChoice": "35"
  },
  {
    "id": 288,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "100 ampoules numérotées de 1 à 100 sont éteintes. Aux passages 1 à 100, on inverse l'état des multiples du numéro de passage. Combien d'ampoules restent allumées à la fin ?",
    "rawAns": "10 (Seuls les carrés parfaits ont un nombre impair de diviseurs : 1, 4, 9... 100)",
    "cleanAns": "10",
    "show": "10 (Seuls les carrés parfaits ont un nombre impair de diviseurs : 1, 4, 9... 100)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "10 seuls les carres parfaits ont un nombre impair de diviseurs 1 4 9 100",
      "10"
    ],
    "choices": [
      "12,5",
      "5",
      "8",
      "10"
    ],
    "correctChoice": "10"
  },
  {
    "id": 289,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Quelle est la dérivée de la fonction $f(x) = x \\cdot \\ln(x) - x$ ?",
    "rawAns": "$\\ln(x)$",
    "cleanAns": "$\\ln",
    "show": "$\\ln(x)$",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "ln x",
      "ln"
    ],
    "choices": [
      "Aucune des réponses",
      "Donnée insuffisante",
      "Non concerné",
      "$\\ln"
    ],
    "correctChoice": "$\\ln"
  },
  {
    "id": 290,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Quelle est la valeur de l'intégrale de $2x$ entre $x = 0$ et $x = 5$ ?",
    "rawAns": "25 ($[x^2]_0^5 = 25$)",
    "cleanAns": "25",
    "show": "25 ($[x^2]_0^5 = 25$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "25 x 2 0 5 25",
      "25"
    ],
    "choices": [
      "31,3",
      "25",
      "20",
      "12,5"
    ],
    "correctChoice": "25"
  },
  {
    "id": 291,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Vous avez un jeu de 52 cartes. Vous retournez les cartes deux par deux. Quelle est la probabilité que la toute dernière carte du paquet soit un As ?",
    "rawAns": "1/13 (4/52, par symétrie : chaque position a la même probabilité)",
    "cleanAns": "1/13",
    "show": "1/13 (4/52, par symétrie : chaque position a la même probabilité)",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "1 13 4 52 par symetrie chaque position a la meme probabilite",
      "1 13",
      "1",
      "13"
    ],
    "choices": [
      "1/13",
      "0 /13",
      "2 /13",
      "3 /13"
    ],
    "correctChoice": "1/13"
  },
  {
    "id": 292,
    "cat": "Logique",
    "level": "expert",
    "time": 35,
    "text": "Un train de 1 km de long roule à 60 km/h. Il entre dans un tunnel de 1 km de long. Combien de temps s'écoule entre l'entrée de la locomotive et la sortie du dernier wagon ?",
    "rawAns": "2 minutes (Il doit parcourir 2 km au total à 1 km/min)",
    "cleanAns": "2 minutes",
    "show": "2 minutes (Il doit parcourir 2 km au total à 1 km/min)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "2 minutes il doit parcourir 2 km au total a 1 km min",
      "2 minutes",
      "2"
    ],
    "choices": [
      "1 minutes",
      "2 minutes",
      "1,6 minutes",
      "2,5 minutes"
    ],
    "correctChoice": "2 minutes"
  },
  {
    "id": 293,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Si un nénuphar triple de taille chaque jour et met 27 jours à couvrir un lac, combien de jours mettront 3 nénuphars identiques pour couvrir ce même lac ?",
    "rawAns": "26 jours (3 nénuphars équivalent au jour 2 d'un seul nénuphar)",
    "cleanAns": "26 jours",
    "show": "26 jours (3 nénuphars équivalent au jour 2 d'un seul nénuphar)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "26 jours 3 nenuphars equivalent au jour 2 d un seul nenuphar",
      "26 jours",
      "26"
    ],
    "choices": [
      "20,8 jours",
      "32,5 jours",
      "13 jours",
      "26 jours"
    ],
    "correctChoice": "26 jours"
  },
  {
    "id": 294,
    "cat": "Attention",
    "level": "expert",
    "time": 30,
    "text": "Quel est le 50ème chiffre de la suite : 1234567891011121314... ?",
    "rawAns": "3 (Les 9 premiers chiffres = 1 à 9 ; il reste 41 chiffres soit 20 nombres à 2 chiffres + le 1er chiffre du 21ème nombre à 2 chiffres qui est 30, donc '3')",
    "cleanAns": "3",
    "show": "3 (Les 9 premiers chiffres = 1 à 9 ; il reste 41 chiffres soit 20 nombres à 2 chiffres + le 1er chiffre du 21ème nombre à 2 chiffres qui est 30, donc '3')",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "3 les 9 premiers chiffres 1 a 9 il reste 41 chiffres soit 20 nombres a 2 chiffres le 1er chiffre du 21eme nombre a 2 chiffres qui est 30 donc 3",
      "3"
    ],
    "choices": [
      "1,5",
      "2,4",
      "3,8",
      "3"
    ],
    "correctChoice": "3"
  },
  {
    "id": 295,
    "cat": "Calcul",
    "level": "expert",
    "time": 30,
    "text": "Résolvez dans les réels : $2^{2x} = 64$. Combien vaut $x$ ?",
    "rawAns": "3 ($64 = 2^6 \\Rightarrow 2x = 6 \\Rightarrow x = 3$)",
    "cleanAns": "3",
    "show": "3 ($64 = 2^6 \\Rightarrow 2x = 6 \\Rightarrow x = 3$)",
    "tip": "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "aliases": [
      "3 64 2 6 rightarrow 2x 6 rightarrow x 3",
      "3"
    ],
    "choices": [
      "3",
      "1,5",
      "2,4",
      "3,8"
    ],
    "correctChoice": "3"
  },
  {
    "id": 296,
    "cat": "Probabilités",
    "level": "expert",
    "time": 40,
    "text": "Vous lancez un dé équilibré. Vous pouvez garder votre score ou relancer une seule fois. Quelle est votre espérance de gain optimale si vous jouez parfaitement ?",
    "rawAns": "4,25 (On relance si on fait 1, 2 ou 3 : $\\frac{1}{2} \\times 3,5 + \\frac{1}{6}(4 + 5 + 6) = 1,75 + 2,5 = 4,25$)",
    "cleanAns": "4,25",
    "show": "4,25 (On relance si on fait 1, 2 ou 3 : $\\frac{1}{2} \\times 3,5 + \\frac{1}{6}(4 + 5 + 6) = 1,75 + 2,5 = 4,25$)",
    "tip": "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "aliases": [
      "4 25 on relance si on fait 1 2 ou 3 frac 1 2 times 3 5 frac 1 6 4 5 6 1 75 2 5 4 25",
      "4 25",
      "4.25",
      "4,25"
    ],
    "choices": [
      "5,3",
      "4,25",
      "2,1",
      "3,4"
    ],
    "correctChoice": "4,25"
  },
  {
    "id": 297,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Deux pères et deux fils vont à la pêche. Chacun attrape un poisson. Au total, seulement 3 poissons ont été pêchés. Comment est-ce possible ?",
    "rawAns": "Ils ne sont que 3 : le grand-père, le père et le petit-fils",
    "cleanAns": "Ils ne sont que 3 : le grand-père, le père et le petit-fils",
    "show": "Ils ne sont que 3 : le grand-père, le père et le petit-fils",
    "tip": "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "aliases": [
      "ils ne sont que 3 le grand pere le pere et le petit fils",
      "3"
    ],
    "choices": [
      "L'un des poissons a sauté",
      "Ils ont volé un poisson",
      "Ils ne sont que 3 : le grand-père, le père et le petit-fils",
      "Un père n'a pas pêché"
    ],
    "correctChoice": "Ils ne sont que 3 : le grand-père, le père et le petit-fils"
  },
  {
    "id": 298,
    "cat": "Spatial",
    "level": "expert",
    "time": 35,
    "text": "Vous êtes au Pôle Sud. Vous marchez 1 km au Nord, 1 km à l'Est, puis 1 km au Sud. À quelle distance êtes-vous de votre point de départ ?",
    "rawAns": "0 km (Vous êtes revenu exactement au Pôle Sud)",
    "cleanAns": "0 km",
    "show": "0 km (Vous êtes revenu exactement au Pôle Sud)",
    "tip": "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "aliases": [
      "0 km vous etes revenu exactement au pole sud",
      "0 km",
      "0"
    ],
    "choices": [
      "0 km",
      "1 km",
      "2 km",
      "3 km"
    ],
    "correctChoice": "0 km"
  },
  {
    "id": 299,
    "cat": "Calcul",
    "level": "expert",
    "time": 35,
    "text": "Un marchand achète un objet 70 €, le vend 80 €, le rachète 90 € et le revend 100 €. Quel est son bénéfice total ?",
    "rawAns": "20 € (-70 + 80 - 90 + 100)",
    "cleanAns": "20 €",
    "show": "20 € (-70 + 80 - 90 + 100)",
    "tip": "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien.",
    "aliases": [
      "20 70 80 90 100",
      "20"
    ],
    "choices": [
      "16 €",
      "10 €",
      "20 €",
      "25 €"
    ],
    "correctChoice": "20 €"
  },
  {
    "id": 300,
    "cat": "Logique",
    "level": "expert",
    "time": 40,
    "text": "Sur une île, il y a 13 caméléons rouges, 15 verts et 17 bleus. Quand deux caméléons de couleurs différentes se rencontrent, ils prennent tous deux la 3ème couleur. Peuvent-ils tous devenir de la même couleur ?",
    "rawAns": "Non (Les restes modulo 3 des populations sont 1, 0 et 2 ; cet invariant ne permet jamais d'égaliser deux populations pour les fusionner)",
    "cleanAns": "Non",
    "show": "Non (Les restes modulo 3 des populations sont 1, 0 et 2 ; cet invariant ne permet jamais d'égaliser deux populations pour les fusionner)",
    "tip": "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "aliases": [
      "non les restes modulo 3 des populations sont 1 0 et 2 cet invariant ne permet jamais d egaliser deux populations pour les fusionner",
      "non"
    ],
    "choices": [
      "Non",
      "Oui, tous bleus",
      "Oui, tous verts",
      "Oui, tous rouges"
    ],
    "correctChoice": "Non"
  }
];

export function getChartierQuestion(id) {
  return CHARTIER_QUESTIONS.find(q => q.id === id);
}

export function getQuestionsByLevel(level) {
  return CHARTIER_QUESTIONS.filter(q => q.level === level);
}
