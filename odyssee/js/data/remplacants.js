// odyssee/js/data/remplacants.js — en attendant que les créatures originales soient redessinées, chacune est jouée par
// un Pokémon de rôle proche (même type, même rang dans sa famille). Les données et les images des créatures restent
// dans le dépôt (creatures.js, img/crea/) : passer ORIGINALES à true les fait revenir partout.
export const ORIGINALES = false;

export const REMPLACANTS = {
  1001: 152, 1002: 153, 1003: 154, // Germignon, Macronium, Méganium
  1004: 155, 1005: 156, 1006: 157, // Héricendre, Feurisson, Typhlosion
  1007: 158, 1008: 159, 1009: 160, // Kaiminus, Crocrodil, Aligatueur
  1010: 16, 1011: 17, 1012: 18, // Roucool, Roucoups, Roucarnage
  1013: 161, 1014: 162, // Fouinette, Fouinar
  1015: 163, 1016: 164, // Hoothoot, Noarfang
  1017: 10, 1018: 11, 1019: 12, // Chenipan, Chrysacier, Papilusion
  1020: 193, // Yanma
  1021: 43, 1022: 44, // Mystherbe, Ortide
  1023: 200, // Feuforêve
  1024: 41, 1025: 42, // Nosferapti, Nosferalto
  1026: 74, 1027: 75, // Racaillou, Gravalanch
  1028: 95, // Onix
  1029: 79, 1030: 80, // Ramoloss, Flagadoss
  1031: 194, 1032: 195, // Axoloto, Maraiste
  1033: 61, // Têtarte
  1034: 179, 1035: 180, // Wattouat, Lainergie
  1036: 81, // Magnéti
  1037: 206, // Insolourdo
  1038: 187, // Granivol
  1039: 96, 1040: 97, // Soporifik, Hypnomade
  1041: 322, 1042: 323, // Chamallot, Camérupt
  1043: 228, 1044: 229, // Malosse, Démolosse
  1045: 86, 1046: 87, // Otaria, Lamantine
  1047: 599, 1048: 600, // Tic, Clic
  1049: 147, 1050: 148, 1051: 149, // Minidraco, Draco, Dracolosse
  1052: 382, // Kyogre
};

/** espèce réellement jouée pour un numéro d'espèce (une créature originale → son remplaçant) */
export const R = (sp) => (!ORIGINALES && REMPLACANTS[sp]) || sp;
