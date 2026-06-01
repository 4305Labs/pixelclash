// ===========================================================================
// gbsprites.js — Game Boy / Pokemon-Zelda style top-down hero pixel data.
//
// Heroes are 16x16. Each is a per-class HEAD (8 rows, sprite rows 0-7) stacked
// on a SHARED BODY (8 rows, rows 8-15). The body is team-tinted tunic + boots
// and animates with a 2-frame walk (idle / walkA / walkB); the head never
// changes between frames. We only author DOWN / UP / SIDE — the LEFT facing is
// the SIDE sprite flipped horizontally at draw time.
//
// Characters map to a palette (see gbPalette in textures.js). "." = transparent.
// Every row MUST be 16 wide; validateGbGrids() throws if not (called at boot).
// ===========================================================================

export const GB_DIRS = ["down", "up", "side"];
export const GB_FRAMES = ["idle", "walkA", "walkB"];

// --- Per-class HEADS (8 rows each) -----------------------------------------
// Palette keys used here: o outline · h/H helmet steel light/shadow · s/S skin
// light/shadow · e eye · k dark (hood/hair) · v/V emblem accent · w shine.
export const GB_HEADS = {
  // Soldier — steel domed helmet, brim shadow, visor eyes.
  soldier: {
    down: [
      "................",
      "....oooooo......",
      "...ohhhhhho.....",
      "..ohhhhhhhho....",
      "..oHHHHHHHHo....",
      "..oseesseeso....",
      "..ossssssso.....",
      "...oSsssSo......",
    ],
    up: [
      "................",
      "....oooooo......",
      "...ohhhhhho.....",
      "..ohhhhhhhho....",
      "..oHHHHHHHHo....",
      "..oHHHHHHHHo....",
      "..oHHHHHHHo.....",
      "...oHHHHo.......",
    ],
    side: [
      "................",
      "...oooooo.......",
      "..ohhhhhho......",
      ".ohhhhhhho......",
      ".oHHHHHHho......",
      ".osssseeo.......",
      ".osssssso.......",
      "..oSsssSo.......",
    ],
  },
  // Scout — light cap + emblem goggle band, smaller head.
  scout: {
    down: [
      "................",
      ".....oooo.......",
      "....ohhhho......",
      "...ohhhhhho.....",
      "...okeekeeko....",
      "..osseesseso....",
      "..ossssssso.....",
      "...oSsssSo......",
    ],
    up: [
      "................",
      ".....oooo.......",
      "....ohhhho......",
      "...ohhhhhho.....",
      "...okkkkkko.....",
      "...ohhhhhho.....",
      "...ohhhhho......",
      "....ohho........",
    ],
    side: [
      "................",
      "....oooo........",
      "...ohhhho.......",
      "..ohhhhho.......",
      "..okeeko........",
      ".osssseeo.......",
      ".osssssso.......",
      "..oSsssSo.......",
    ],
  },
  // Tank — heavy wide steel helm with twin visor slits.
  tank: {
    down: [
      "................",
      "...oooooooo.....",
      "..ohhhhhhhho....",
      ".ohhhhhhhhhho...",
      ".oHHHHHHHHHHo...",
      ".oseesseeseo....",
      ".osssssssso.....",
      "..oSsssssSo.....",
    ],
    up: [
      "................",
      "...oooooooo.....",
      "..ohhhhhhhho....",
      ".ohhhhhhhhhho...",
      ".oHHHHHHHHHHo...",
      ".oHHHHHHHHHHo...",
      ".oHHHHHHHHo.....",
      "..oHHHHHHo......",
    ],
    side: [
      "................",
      "..oooooooo......",
      ".ohhhhhhhho.....",
      "ohhhhhhhhho.....",
      "oHHHHHHHHho.....",
      "osssseeeo.......",
      "ossssssso.......",
      ".oSsssssSo......",
    ],
  },
  // Ranger — dark hood, face in shadow under the cowl.
  ranger: {
    down: [
      "................",
      "....okkkko......",
      "...okkkkkko.....",
      "..okkkkkkkko....",
      "..okkkkkkkko....",
      "..okseessko.....",
      "..okssssko......",
      "...okSSko.......",
    ],
    up: [
      "................",
      "....okkkko......",
      "...okkkkkko.....",
      "..okkkkkkkko....",
      "..okkkkkkkko....",
      "..okkkkkkkko....",
      "..okkkkkko......",
      "...okkkko.......",
    ],
    side: [
      "................",
      "...okkkko.......",
      "..okkkkko.......",
      ".okkkkkko.......",
      ".okkkkkko.......",
      ".okkseeko.......",
      ".okssssko.......",
      "..okSSko........",
    ],
  },
  // Mage — tall pointed emblem hat over a lit face.
  mage: {
    down: [
      ".......o........",
      "......ovo.......",
      ".....ovvvo......",
      "....ovvvvvo.....",
      "..oovvvvvvoo....",
      "..oseesseeso....",
      "..ossssssso.....",
      "...oSsssSo......",
    ],
    up: [
      ".......o........",
      "......ovo.......",
      ".....ovvvo......",
      "....ovvvvvo.....",
      "..oovvvvvvoo....",
      "..okkkkkkko.....",
      "..okkkkkko......",
      "...okkkko.......",
    ],
    side: [
      ".....o..........",
      "....ovo.........",
      "...ovvvo........",
      "..ovvvvo........",
      ".oovvvvoo.......",
      ".osssseeo.......",
      ".osssssso.......",
      "..oSsssSo.......",
    ],
  },
  // Brawler — emblem headband over dark hair, broad face.
  brawler: {
    down: [
      "................",
      "....okkkko......",
      "...okkkkkko.....",
      "..okkkkkkkko....",
      "..ovvvvvvvvo....",
      "..oseesseeso....",
      "..ossssssso.....",
      "...oSsssSo......",
    ],
    up: [
      "................",
      "....okkkko......",
      "...okkkkkko.....",
      "..okkkkkkkko....",
      "..ovvvvvvvvo....",
      "..okkkkkkkko....",
      "..okkkkkko......",
      "...okkkko.......",
    ],
    side: [
      "................",
      "...okkkko.......",
      "..okkkkko.......",
      ".okkkkkko.......",
      ".ovvvvvvo.......",
      ".osssseeo.......",
      ".osssssso.......",
      "..oSsssSo.......",
    ],
  },
};

// --- SHARED BODY (8 rows), 3 frames per facing -----------------------------
// Palette keys: o outline · b/B tunic light/shadow (team) · f boots.
export const GB_BODY = {
  down: {
    idle: [
      "...ollllllo.....",
      "..olbbbbbblo....",
      "..obBbbbbBbo....",
      "..obbbbbbbbo....",
      "..oBBbbbbBBo....",
      "...obo..obo.....",
      "...ofo..ofo.....",
      "...ooo..ooo.....",
    ],
    walkA: [
      "...ollllllo.....",
      "..olbbbbbblo....",
      "..obBbbbbBbo....",
      "..obbbbbbbbo....",
      "..oBBbbbbBBo....",
      "...obo..obo.....",
      "...obo..ofo.....",
      "...ofo..........",
    ],
    walkB: [
      "...ollllllo.....",
      "..olbbbbbblo....",
      "..obBbbbbBbo....",
      "..obbbbbbbbo....",
      "..oBBbbbbBBo....",
      "...obo..obo.....",
      "...ofo..obo.....",
      "........ofo.....",
    ],
  },
  side: {
    idle: [
      "...ollllo.......",
      "..olbbbblo......",
      "..obBbbbo.......",
      "..obbbbbo.......",
      "..oBBbbo........",
      "...obbo.........",
      "...ofof.........",
      "...oo.oo........",
    ],
    walkA: [
      "...ollllo.......",
      "..olbbbblo......",
      "..obBbbbo.......",
      "..obbbbbo.......",
      "..oBBbbo........",
      "...obbo.........",
      "...ofof.........",
      "......oo........",
    ],
    walkB: [
      "...ollllo.......",
      "..olbbbblo......",
      "..obBbbbo.......",
      "..obbbbbo.......",
      "..oBBbbo........",
      "...obbo.........",
      "...ofof.........",
      "...oo...........",
    ],
  },
};
GB_BODY.up = GB_BODY.down; // back view reuses the same torso + legs

// Full 16-row grid for a class facing a direction on a walk frame.
export function gbHeroRows(cls, dir, frame) {
  const head = (GB_HEADS[cls] || GB_HEADS.soldier)[dir];
  const body = GB_BODY[dir][frame];
  return [...head, ...body];
}

// Throws if any authored row isn't exactly 16 wide (a miscount would otherwise
// only surface as a paintGrid crash at boot). Returns the grid count on success.
export function validateGbGrids() {
  let n = 0;
  for (const cls of Object.keys(GB_HEADS)) {
    for (const dir of GB_DIRS) {
      const rows = GB_HEADS[cls][dir];
      if (rows.length !== 8) throw new Error(`GB head ${cls}/${dir} has ${rows.length} rows, expected 8`);
      rows.forEach((r, i) => {
        if (r.length !== 16) throw new Error(`GB head ${cls}/${dir} row ${i} is ${r.length} wide, expected 16`);
      });
      n++;
    }
  }
  for (const dir of ["down", "side"]) {
    for (const frame of GB_FRAMES) {
      const rows = GB_BODY[dir][frame];
      if (rows.length !== 8) throw new Error(`GB body ${dir}/${frame} has ${rows.length} rows, expected 8`);
      rows.forEach((r, i) => {
        if (r.length !== 16) throw new Error(`GB body ${dir}/${frame} row ${i} is ${r.length} wide, expected 16`);
      });
      n++;
    }
  }
  return n;
}
