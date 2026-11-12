// The Backrooms - Où est rangé chaque modèle : un dossier par niveau dans models/ (level0, level1, poolrooms, tuyauteries,
// hotel), et models/commun/ pour ceux de plusieurs niveaux (ou chargés partout, comme la tenue des joueurs). Un modèle
// absent de cette table est dans commun/. En ajouter un : le poser dans le bon dossier, et l'inscrire ici s'il n'est pas commun
const FOLDER = {
  // hotel
  antique_ceramic_vase_01: 'hotel', ArmChair_01: 'hotel', CashRegister_01: 'hotel', Chandelier_01: 'hotel',
  ClassicConsole_01: 'hotel', fancy_picture_frame_01: 'hotel', gothic_coffee_table: 'hotel', GothicCommode_01: 'hotel',
  GreenChair_01: 'hotel', hotel_entite: 'hotel', mantel_clock_01: 'hotel', marble_bust_01: 'hotel', ornate_mirror_01: 'hotel',
  Ottoman_01: 'hotel', potted_plant_02: 'hotel', sofa_02: 'hotel', sofa_03: 'hotel', vintage_cabinet_01: 'hotel',
  vintage_grandfather_clock_01: 'hotel', vintage_oil_lamp: 'hotel', vintage_suitcase: 'hotel',
  // level0
  projector_screen: 'level0', SchoolChair_01: 'level0', SchoolDesk_01: 'level0', Sofa_01: 'level0',
  standing_chalkboard_01: 'level0', tool_cart: 'level0', wooden_ladder: 'level0',
  // level1
  barrel_03: 'level1', cement_bag: 'level1', industrial_pastic_container: 'level1', old_tyre: 'level1',
  plastic_crate_02: 'level1', small_lpg_tank: 'level1',
  // poolrooms
  lifebuoy: 'poolrooms', rubber_duck_toy: 'poolrooms',
  // tuyauteries
  can_rusted: 'tuyauteries', chevre: 'tuyauteries', industrial_wall_lamp: 'tuyauteries', metal_trash_can: 'tuyauteries',
  modular_industrial_pipes_01: 'tuyauteries', mounted_fluorescent_lights: 'tuyauteries', multi_cleaner_5_litre: 'tuyauteries',
  oil_tin: 'tuyauteries', pipe_wrench: 'tuyauteries', plunger: 'tuyauteries', steel_frame_shelves_01: 'tuyauteries',
  steel_frame_shelves_03: 'tuyauteries', utility_box_02: 'tuyauteries', water_manhole_cover: 'tuyauteries',
};

// l'adresse du modèle `name` (sans « .glb »)
export const modelUrl = (name) => new URL(`../models/${FOLDER[name] || 'commun'}/${name}.glb`, import.meta.url).href;
