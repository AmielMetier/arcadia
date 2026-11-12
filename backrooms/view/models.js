// The Backrooms - Où est rangé chaque modèle : un dossier par niveau dans models/ (level0, level1, poolrooms, tuyauteries,
// hotel, mall), et models/commun/ pour ceux de plusieurs niveaux (ou chargés partout, comme la tenue des joueurs). Un modèle
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
  // mall (Level 17)
  alarm_clock_01: 'mall', all_purpose_cleaner: 'mall', american_football: 'mall', anthurium_botany_01: 'mall',
  BarberShopChair_01: 'mall', baseball_01: 'mall', baseball_bat: 'mall',
  binder_notebook: 'mall', binoculars: 'mall', bleach_bottle: 'mall', book_encyclopedia_set_01: 'mall', boombox: 'mall',
  brass_pan_01: 'mall', brass_vase_03: 'mall',
  calathea_orbifolia_01: 'mall', carrot_cake: 'mall', cassette_player: 'mall', ceramic_vase_01: 'mall',
  ceramic_vase_02: 'mall', ceramic_vase_03: 'mall', ceramic_vase_04: 'mall', clipboard: 'mall',
  coffee_table_round_01: 'mall', CoffeeCart_01: 'mall', concrete_cat_statue: 'mall', concrete_road_barrier_02: 'mall',
  covered_car: 'mall', croissant: 'mall', dartboard: 'mall', dead_quiver_trunk: 'mall', desk_lamp_arm_01: 'mall',
  digital_wrist_watch: 'mall', dining_table: 'mall', drawer_cabinet: 'mall', dustpan: 'mall',
  exterior_aircon_unit: 'mall', fern_02: 'mall', fishermans_hat: 'mall', food_apple_01: 'mall', football: 'mall',
  gamepad: 'mall', garden_gnome: 'mall', garden_hose_wall_mounted_01: 'mall',
  hanging_picture_frame_01: 'mall', hanging_picture_frame_02: 'mall', industrial_storage_cart: 'mall', jug_01: 'mall',
  korean_public_payphone_01: 'mall', ladder_sectioned_01: 'mall', medical_box: 'mall', metal_stool_02: 'mall',
  mid_century_lounge_chair: 'mall', modern_coffee_table_01: 'mall', modular_street_seating: 'mall', mousetrap: 'mall',
  multi_cleaner_bottle: 'mall', office_notepads: 'mall', old_gas_mask: 'mall', painted_wooden_shelves: 'mall',
  painted_wooden_table: 'mall', plastic_bottle_gallon: 'mall', plastic_broom: 'mall', plastic_crate_03: 'mall',
  portable_cassette_player: 'mall', postcard_set_01: 'mall', pot_enamel_01: 'mall', potted_plant_04: 'mall',
  rollershutter_window_01: 'mall', round_spectacles: 'mall', round_wooden_table_01: 'mall', security_camera_02: 'mall',
  security_light: 'mall', Shelf_01: 'mall', side_table_01: 'mall', spray_paint_bottles_02: 'mall',
  stationery_supplies: 'mall', steel_frame_shelves_02: 'mall', television_02: 'mall',
  Ukulele_01: 'mall', vintage_crutches_01: 'mall',
  vintage_pocket_watch: 'mall', vintage_stapler: 'mall', vintage_telephone_wall_clock: 'mall',
  vintage_video_camera: 'mall', wheelchair_01: 'mall', wooden_bookshelf_worn: 'mall', wooden_broom: 'mall',
  wooden_cutting_board: 'mall', wooden_display_shelves_01: 'mall', WoodenTable_01: 'mall',
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
