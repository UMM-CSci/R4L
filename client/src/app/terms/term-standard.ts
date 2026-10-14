import { ItemPackageMode, Terms } from './terms';

/**
 * This file defines the canonical terms, term aliases, and brand-item hints
 * used throughout the application for standardizing supply list items.
 */
export const CANONICAL_TERMS: Terms = {
  item: [
    'Composition Notebook', 'Construction Paper', 'Facial Tissue', 'Index Card', 'Loose-Leaf Paper', 'Notebook',
    'Page Protector', 'Paper Plate', 'Single-Subject Notebook', 'Single-Subject Spiral Notebook', 'Spiral Notebook', 'Sticky Note',
    'Colored Pencil', 'Crayon', 'Dry Erase Marker', 'Eraser', 'Glue Stick', 'Highlighter', 'Liquid Glue',
    'Marker', 'Washable Marker', 'Pencil', 'Pen', 'Permanent Marker', 'Watercolor Paint', '3-Hole Folder', '3-Prong Folder',
    '3-Ring Binder', 'Backpack', 'Bag', 'Folder', 'Pencil Box', 'Pencil Pouch', 'Tab Divider', 'Calculator',
    'Headphones', 'Pencil Sharpener', 'Ruler', 'Scientific Calculator', 'Scissors', 'Whiteboard Eraser',
    'Blanket', 'Bowl', 'Compass', 'Computer Mouse', 'Cup', 'Disinfectant Wipes', 'Earbuds', 'Fork',
    'Paper Towel Roll', 'Planner', 'Protractor', 'Rug', 'Sketchbook', 'Snack', 'Spoon',
    'Storage Bag', 'Tennis Shoes', 'Toothbrush Holder', 'Towel', 'Water Bottle'
  ],

  brand: [
    'BIC', 'Clorox', 'Crayola', 'Deal Worthy', 'Dixie', "Elmer's", 'Expo', 'Fiskars', 'Just Basics',
    'Kleenex', 'Lysol', 'Office Depot', 'Paper Mate', 'Pen+Gear', 'Pentel', 'Quill', 'Sharpie', 'Solo',
    'Texas Instruments', 'Ticonderoga', 'Up & Up', 'Westcott', 'Ziploc'
  ],

  color: ['Assorted', 'Black', 'Blue', 'Gray', 'Green', 'Orange', 'Pink', 'Purple', 'Red', 'White', 'Yellow'],

  size: ['1 in', '1.5 in', '4 oz', '5 in', '7 in', '8 in x 5 in', '10 oz', 'Small', 'Medium', 'Large', 'Regular', 'Jumbo', 'Quart', 'Gallon'],

  type: [
    '#2', '#2 Sharpened', '#2 Unsharpened', '2-Pocket', 'Ballpoint', 'Broad Tip', 'Wide Tip', 'Chisel Tip', 'Coated', 'Hard', 'Sharpened',
    'College Ruled', 'Fine Tip', 'Front Pocket', 'Grid Ruled', 'Mechanical', 'Pink Pearl', 'Single Subject',
    'Wide Ruled'
  ],

  material: ['Fabric', 'Paper', 'Plastic', 'Polymer', 'Polypropylene']
};

export const TERM_ALIASES: Record<string, string> = {
  '3 prong, 2 pocket folder': '3-Prong Folder, 2-Pocket',
  '3-prong, 2-pocket folder': '3-Prong Folder, 2-Pocket',
  '3 hole, 2 pocket folder': '3-Hole Folder, 2-Pocket',
  '3-hole, 2-pocket folder': '3-Hole Folder, 2-Pocket',
  '3 ring binder': '3-Ring Binder',
  '3-ring binder': '3-Ring Binder',
  '3 prong folder': '3-Prong Folder',
  '3-prong folder': '3-Prong Folder',
  '3 hole folder': '3-Hole Folder',
  '3-hole folder': '3-Hole Folder',
  'folders': 'Folder',
  'glue sticks': 'Glue Stick',
  'washable markers': 'Washable Marker',
  'washable marker': 'Washable Marker',
  'paper towels': 'Paper Towel Roll',
  'paper towel': 'Paper Towel Roll',
  'paper towel rolls': 'Paper Towel Roll',
  'disinfectant wipe': 'Disinfectant Wipes',
  'index cards': 'Index Card',
  'loose leaf paper': 'Loose-Leaf Paper',
  'tissue': 'Facial Tissue',
  'tissues': 'Facial Tissue',
  'dry erase board eraser': 'Whiteboard Eraser',
  'white board eraser': 'Whiteboard Eraser',
  'dry board eraser': 'Whiteboard Eraser',
  'school box': 'Pencil Box',
  'pencil box': 'Pencil Box',
  'pencil/crayon box': 'Pencil Box',
  'binder pencil bag': 'Pencil Pouch',
  'binder pencil pouch': 'Pencil Pouch',
  '3-ring binder pencil pouch': 'Pencil Pouch',
  'pencil zipper pouch': 'Pencil Pouch',
  'single subject notebook': 'Single-Subject Notebook',
  'single subject notebooks': 'Single-Subject Notebook',
  'spiral tablet': 'Spiral Notebook',
  'tablets': 'Notebook',
  'tablet': 'Notebook',
  'school glue': 'Liquid Glue',
  'bottle of glue': 'Liquid Glue',
  'filler paper': 'Loose-Leaf Paper',
  'notecards': 'Index Card',
  'notecard': 'Index Card',
  'pocket': '2-Pocket',
  'double pocket': '2-Pocket',
  'thick': 'Large',
  'thicker': 'Large',
  'fiskar': 'Fiskars',
  'no. 2': '#2',
  'elmers': "Elmer's",
  'wide rule': 'Wide Ruled',
  'front pocket': 'Front Pocket',
  'fine': 'Fine Tip',
  'chisel': 'Chisel Tip',
  'misc': 'Assorted',
  'six color': 'Assorted',
  '5in': '5 in',
  '7in': '7 in',
  '1 inch': '1 in',
  '1.5 inch': '1.5 in'
};

/** Items requested as packages. All unlisted items are individual units. */
export const PACKAGED_ITEMS = new Set<string>([
  'Construction Paper', 'Crayon', 'Disinfectant Wipes', 'Facial Tissue',
  'Index Card', 'Loose-Leaf Paper', 'Marker', 'Washable Marker',
  'Page Protector', 'Paper Plate', 'Snack', 'Sticky Note', 'Storage Bag',
  'Tab Divider', 'Watercolor Paint'
]);

export const ITEM_PACKAGE_MODES: Record<string, ItemPackageMode> = Object.fromEntries(
  CANONICAL_TERMS.item.map(item => [item, PACKAGED_ITEMS.has(item) ? 'PACKAGED' : 'INDIVIDUAL'])
);

export function itemPackageMode(item: string | null | undefined, terms?: Terms): ItemPackageMode {
  const normalized = item?.trim().toLowerCase();
  if (!normalized) return 'INDIVIDUAL';
  const apiMode = Object.entries(terms?.itemPackageModes ?? {})
    .find(([name]) => name.toLowerCase() === normalized)?.[1];
  if (apiMode) return apiMode;
  return Object.entries(ITEM_PACKAGE_MODES)
    .find(([name]) => name.toLowerCase() === normalized)?.[1] ?? 'INDIVIDUAL';
}

// TODO: Wouldn't it be better to generate these hints dynamically based on the canonical terms and known aliases?
// Maybe not Canonical, but the normalized brand term to avoid duplication (like elmer and elmer's) and ensure consistency.
export const BRAND_ITEM_HINTS: Record<string, string[]> = {
  puffs: ['facial tissue'],
  kleenex: ['facial tissue'],
  clorox: ['disinfectant wipes'],
  lysol: ['disinfectant wipes'],
  fiskars: ['scissors'],
  sharpie: ['permanent marker'],
  expo: ['dry erase marker'],
  elmer: ['liquid glue', 'glue stick'],
  "elmer's": ['liquid glue', 'glue stick'],
  ziploc: ['storage bag'],
  'texas instruments': ['scientific calculator', 'calculator']
};
