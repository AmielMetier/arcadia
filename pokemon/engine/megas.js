// pokemon/engine/megas.js
// Méga-Évolutions du tournoi (données PokeAPI, stats ramenées au niveau 50 comme le reste du roster).
// Un Pokémon méga-évolue s'il tient sa Méga-Gemme ; une seule Méga-Évolution par dresseur et par combat.
// Les PV ne changent pas ; types et autres stats deviennent ceux de la forme Méga. pid = forme PokeAPI (sprites).

export const MEGAS = {
 "3": [
  {
   "pid": 10033,
   "name": "Méga-Florizarre",
   "stone": "mega_10033",
   "stoneName": "Florizarrite",
   "icon": "assets/items/venusaurite.png",
   "types": [
    "grass",
    "poison"
   ],
   "stats": {
    "hp": 155,
    "atk": 120,
    "def": 143,
    "spa": 142,
    "spd": 140,
    "spe": 100
   }
  }
 ],
 "6": [
  {
   "pid": 10034,
   "name": "Méga-Dracaufeu X",
   "stone": "mega_10034",
   "stoneName": "Dracaufite X",
   "icon": "assets/items/charizardite-x.png",
   "types": [
    "fire",
    "dragon"
   ],
   "stats": {
    "hp": 153,
    "atk": 150,
    "def": 131,
    "spa": 150,
    "spd": 105,
    "spe": 120
   }
  },
  {
   "pid": 10035,
   "name": "Méga-Dracaufeu Y",
   "stone": "mega_10035",
   "stoneName": "Dracaufite Y",
   "icon": "assets/items/charizardite-y.png",
   "types": [
    "fire",
    "flying"
   ],
   "stats": {
    "hp": 153,
    "atk": 124,
    "def": 98,
    "spa": 179,
    "spd": 135,
    "spe": 120
   }
  }
 ],
 "9": [
  {
   "pid": 10036,
   "name": "Méga-Tortank",
   "stone": "mega_10036",
   "stoneName": "Tortankite",
   "icon": "assets/items/blastoisinite.png",
   "types": [
    "water"
   ],
   "stats": {
    "hp": 154,
    "atk": 123,
    "def": 140,
    "spa": 155,
    "spd": 135,
    "spe": 98
   }
  }
 ],
 "65": [
  {
   "pid": 10037,
   "name": "Méga-Alakazam",
   "stone": "mega_10037",
   "stoneName": "Alakazamite",
   "icon": "assets/items/alakazite.png",
   "types": [
    "psychic"
   ],
   "stats": {
    "hp": 130,
    "atk": 70,
    "def": 85,
    "spa": 195,
    "spd": 125,
    "spe": 170
   }
  }
 ],
 "94": [
  {
   "pid": 10038,
   "name": "Méga-Ectoplasma",
   "stone": "mega_10038",
   "stoneName": "Ectoplasmite",
   "icon": "assets/items/gengarite.png",
   "types": [
    "ghost",
    "poison"
   ],
   "stats": {
    "hp": 135,
    "atk": 85,
    "def": 100,
    "spa": 190,
    "spd": 115,
    "spe": 150
   }
  }
 ],
 "130": [
  {
   "pid": 10041,
   "name": "Méga-Léviator",
   "stone": "mega_10041",
   "stoneName": "Léviatorite",
   "icon": "assets/items/gyaradosite.png",
   "types": [
    "water",
    "dark"
   ],
   "stats": {
    "hp": 170,
    "atk": 175,
    "def": 129,
    "spa": 90,
    "spd": 150,
    "spe": 101
   }
  }
 ],
 "149": [
  {
   "pid": 10281,
   "name": "Méga-Dracolosse",
   "stone": "mega_10281",
   "stoneName": "Dracolossite",
   "icon": "assets/items/dragoninite.png",
   "types": [
    "dragon",
    "flying"
   ],
   "stats": {
    "hp": 166,
    "atk": 144,
    "def": 135,
    "spa": 165,
    "spd": 145,
    "spe": 120
   }
  }
 ],
 "150": [
  {
   "pid": 10043,
   "name": "Méga-Mewtwo X",
   "stone": "mega_10043",
   "stoneName": "Mewtwoïte X",
   "icon": "assets/items/mewtwonite-x.png",
   "types": [
    "psychic",
    "fighting"
   ],
   "stats": {
    "hp": 181,
    "atk": 210,
    "def": 120,
    "spa": 174,
    "spd": 120,
    "spe": 150
   }
  },
  {
   "pid": 10044,
   "name": "Méga-Mewtwo Y",
   "stone": "mega_10044",
   "stoneName": "Mewtwoïte Y",
   "icon": "assets/items/mewtwonite-y.png",
   "types": [
    "psychic"
   ],
   "stats": {
    "hp": 181,
    "atk": 170,
    "def": 90,
    "spa": 214,
    "spd": 140,
    "spe": 160
   }
  }
 ],
 "154": [
  {
   "pid": 10282,
   "name": "Méga-Méganium",
   "stone": "mega_10282",
   "stoneName": "Méganiumite",
   "icon": "assets/items/meganiumite.png",
   "types": [
    "grass",
    "fairy"
   ],
   "stats": {
    "hp": 155,
    "atk": 112,
    "def": 135,
    "spa": 163,
    "spd": 135,
    "spe": 100
   }
  }
 ],
 "160": [
  {
   "pid": 10283,
   "name": "Méga-Aligatueur",
   "stone": "mega_10283",
   "stoneName": "Aligatueurite",
   "icon": "assets/items/feraligite.png",
   "types": [
    "water",
    "dragon"
   ],
   "stats": {
    "hp": 160,
    "atk": 180,
    "def": 145,
    "spa": 109,
    "spd": 113,
    "spe": 98
   }
  }
 ],
 "181": [
  {
   "pid": 10045,
   "name": "Méga-Pharamp",
   "stone": "mega_10045",
   "stoneName": "Pharampite",
   "icon": "assets/items/ampharosite.png",
   "types": [
    "electric",
    "dragon"
   ],
   "stats": {
    "hp": 165,
    "atk": 115,
    "def": 125,
    "spa": 185,
    "spd": 130,
    "spe": 65
   }
  }
 ],
 "212": [
  {
   "pid": 10046,
   "name": "Méga-Cizayox",
   "stone": "mega_10046",
   "stoneName": "Cizayoxite",
   "icon": "assets/items/scizorite.png",
   "types": [
    "bug",
    "steel"
   ],
   "stats": {
    "hp": 145,
    "atk": 170,
    "def": 160,
    "spa": 85,
    "spd": 120,
    "spe": 95
   }
  }
 ],
 "214": [
  {
   "pid": 10047,
   "name": "Méga-Scarhino",
   "stone": "mega_10047",
   "stoneName": "Scarhinoïte",
   "icon": "assets/items/heracronite.png",
   "types": [
    "bug",
    "fighting"
   ],
   "stats": {
    "hp": 155,
    "atk": 205,
    "def": 135,
    "spa": 60,
    "spd": 125,
    "spe": 95
   }
  }
 ],
 "227": [
  {
   "pid": 10284,
   "name": "Méga-Airmure",
   "stone": "mega_10284",
   "stoneName": "Airmurite",
   "icon": "assets/items/skarmorite.png",
   "types": [
    "steel",
    "flying"
   ],
   "stats": {
    "hp": 140,
    "atk": 160,
    "def": 130,
    "spa": 60,
    "spd": 120,
    "spe": 130
   }
  }
 ],
 "229": [
  {
   "pid": 10048,
   "name": "Méga-Démolosse",
   "stone": "mega_10048",
   "stoneName": "Démolossite",
   "icon": "assets/items/houndoominite.png",
   "types": [
    "dark",
    "fire"
   ],
   "stats": {
    "hp": 150,
    "atk": 110,
    "def": 110,
    "spa": 160,
    "spd": 110,
    "spe": 135
   }
  }
 ],
 "248": [
  {
   "pid": 10049,
   "name": "Méga-Tyranocif",
   "stone": "mega_10049",
   "stoneName": "Tyranocivite",
   "icon": "assets/items/tyranitarite.png",
   "types": [
    "rock",
    "dark"
   ],
   "stats": {
    "hp": 175,
    "atk": 184,
    "def": 170,
    "spa": 115,
    "spd": 140,
    "spe": 91
   }
  }
 ],
 "254": [
  {
   "pid": 10065,
   "name": "Méga-Jungko",
   "stone": "mega_10065",
   "stoneName": "Jungkite",
   "icon": "assets/items/sceptilite.png",
   "types": [
    "grass",
    "dragon"
   ],
   "stats": {
    "hp": 145,
    "atk": 130,
    "def": 95,
    "spa": 165,
    "spd": 105,
    "spe": 165
   }
  }
 ],
 "257": [
  {
   "pid": 10050,
   "name": "Méga-Braségali",
   "stone": "mega_10050",
   "stoneName": "Braségalite",
   "icon": "assets/items/blazikenite.png",
   "types": [
    "fire",
    "fighting"
   ],
   "stats": {
    "hp": 155,
    "atk": 180,
    "def": 100,
    "spa": 150,
    "spd": 100,
    "spe": 120
   }
  }
 ],
 "260": [
  {
   "pid": 10064,
   "name": "Méga-Laggron",
   "stone": "mega_10064",
   "stoneName": "Laggronite",
   "icon": "assets/items/swampertite.png",
   "types": [
    "water",
    "ground"
   ],
   "stats": {
    "hp": 175,
    "atk": 170,
    "def": 130,
    "spa": 115,
    "spd": 130,
    "spe": 90
   }
  }
 ],
 "282": [
  {
   "pid": 10051,
   "name": "Méga-Gardevoir",
   "stone": "mega_10051",
   "stoneName": "Gardevoirite",
   "icon": "assets/items/gardevoirite.png",
   "types": [
    "psychic",
    "fairy"
   ],
   "stats": {
    "hp": 143,
    "atk": 105,
    "def": 85,
    "spa": 185,
    "spd": 155,
    "spe": 120
   }
  }
 ],
 "306": [
  {
   "pid": 10053,
   "name": "Méga-Galeking",
   "stone": "mega_10053",
   "stoneName": "Galekingite",
   "icon": "assets/items/aggronite.png",
   "types": [
    "steel"
   ],
   "stats": {
    "hp": 145,
    "atk": 160,
    "def": 250,
    "spa": 80,
    "spd": 100,
    "spe": 70
   }
  }
 ],
 "310": [
  {
   "pid": 10055,
   "name": "Méga-Élecsprint",
   "stone": "mega_10055",
   "stoneName": "Élecsprintite",
   "icon": "assets/items/manectite.png",
   "types": [
    "electric"
   ],
   "stats": {
    "hp": 145,
    "atk": 95,
    "def": 100,
    "spa": 155,
    "spd": 100,
    "spe": 155
   }
  }
 ],
 "319": [
  {
   "pid": 10070,
   "name": "Méga-Sharpedo",
   "stone": "mega_10070",
   "stoneName": "Sharpedite",
   "icon": "assets/items/sharpedonite.png",
   "types": [
    "water",
    "dark"
   ],
   "stats": {
    "hp": 145,
    "atk": 160,
    "def": 90,
    "spa": 130,
    "spd": 85,
    "spe": 125
   }
  }
 ],
 "359": [
  {
   "pid": 10057,
   "name": "Méga-Absol",
   "stone": "mega_10057",
   "stoneName": "Absolite",
   "icon": "assets/items/absolite.png",
   "types": [
    "dark"
   ],
   "stats": {
    "hp": 140,
    "atk": 170,
    "def": 80,
    "spa": 135,
    "spd": 80,
    "spe": 135
   }
  }
 ],
 "373": [
  {
   "pid": 10089,
   "name": "Méga-Drattak",
   "stone": "mega_10089",
   "stoneName": "Drattakite",
   "icon": "assets/items/salamencite.png",
   "types": [
    "dragon",
    "flying"
   ],
   "stats": {
    "hp": 170,
    "atk": 165,
    "def": 150,
    "spa": 140,
    "spd": 110,
    "spe": 140
   }
  }
 ],
 "376": [
  {
   "pid": 10076,
   "name": "Méga-Métalosse",
   "stone": "mega_10076",
   "stoneName": "Métalossite",
   "icon": "assets/items/metagrossite.png",
   "types": [
    "steel",
    "psychic"
   ],
   "stats": {
    "hp": 155,
    "atk": 165,
    "def": 170,
    "spa": 125,
    "spd": 130,
    "spe": 130
   }
  }
 ],
 "384": [
  {
   "pid": 10079,
   "name": "Méga-Rayquaza",
   "stone": "mega_10079",
   "stoneName": "Gemme Draco",
   "icon": "assets/items/key-stone.png",
   "types": [
    "dragon",
    "flying"
   ],
   "stats": {
    "hp": 180,
    "atk": 200,
    "def": 120,
    "spa": 200,
    "spd": 120,
    "spe": 135
   }
  }
 ],
 "445": [
  {
   "pid": 10058,
   "name": "Méga-Carchacrok",
   "stone": "mega_10058",
   "stoneName": "Carchacrokite",
   "icon": "assets/items/garchompite.png",
   "types": [
    "dragon",
    "ground"
   ],
   "stats": {
    "hp": 183,
    "atk": 190,
    "def": 135,
    "spa": 140,
    "spd": 115,
    "spe": 112
   }
  }
 ],
 "448": [
  {
   "pid": 10059,
   "name": "Méga-Lucario",
   "stone": "mega_10059",
   "stoneName": "Lucarite",
   "icon": "assets/items/lucarionite.png",
   "types": [
    "fighting",
    "steel"
   ],
   "stats": {
    "hp": 145,
    "atk": 165,
    "def": 108,
    "spa": 160,
    "spd": 90,
    "spe": 132
   }
  }
 ]
};

/** Formes Méga d'un Pokémon (tableau vide s'il n'en a pas) */
export const megasOf = (dex) => MEGAS[dex] || [];
/** Forme Méga associée à une Méga-Gemme (clé d'objet « mega_<pid> »), ou null */
export function megaByStone(key) {
  if (typeof key !== 'string' || !key.startsWith('mega_')) return null;
  for (const [dex, list] of Object.entries(MEGAS)) for (const m of list) if (m.stone === key) return { dex: Number(dex), ...m };
  return null;
}
