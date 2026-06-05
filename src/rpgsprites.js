// ===========================================================================
// rpgsprites.js — detailed "Tiny RPG" style hero pixel data.
//
// Each hero is a single 24x24 FRONT-FACING pose (mirrored for left at draw
// time), in chibi proportions: a big head sitting squarely centred on a compact,
// narrow body (head ≥ body width — no belly), short legs, a visible class weapon.
// Centre axis is col 11.5: heads span cols 7-16, bodies cols 8-15.
//
// Characters map to a palette (see rpgPalette in textures.js); "." = transparent.
// The team garment is c/C/p (mid/dark/light); armour/weapons are neutral. Every
// row MUST be 24 wide — validateRpgGrids() throws otherwise (called at boot + m38).
// ===========================================================================

export const RPG_HEROES = {
  // Knight — plumed steel helm, team tabard, sword (right) + round shield (left).
  soldier: [
    "........................",
    "..................obbo..",
    "..................obbo..",
    ".......oLLLLLLLLo.obbo..",
    ".......oLLLLLLLLo.obbo..",
    ".......oMLLLLLLMo.obbo..",
    ".......oLssssssLo.obbo..",
    ".......oLsessesLo.obbo..",
    ".......oLssssssLo.obbo..",
    ".......oMksssskMo.oggo..",
    "........oLLLLLLo..ogho..",
    "...oLLLooLccccLo.oLho...",
    "...ocpcooMcppcMo.oho....",
    "...occcooMcCCcMo........",
    "...oCCCooMMccMMo........",
    "....ooo.oLMMMMLo........",
    "........oMo..oMo........",
    "........oMo..oMo........",
    "........oDo..oDo........",
    "........ooo..ooo........",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Rogue — drawn hood, light leather, and a clearer up-angled dagger in the
  // right hand: a gold hilt + crossguard (h/g) tucked at the glove rising into a
  // pointed steel blade (b), so the weapon reads as a dagger rather than a
  // free-floating blob.
  scout: [
    "........................",
    "........oooo............",
    ".......occcco...........",
    "......occcccco..........",
    ".....occccccco..........",
    ".....ocCssssCco.........",
    ".....oCsesesCco.........",
    "......oCsssCo...........",
    "......oCkssCo...obo.....",
    ".......occco...obbo.....",
    "........oLLLo.ohgbo.....",
    "......oLccccLooLhbo.....",
    "......oLcppcLoo.ho......",
    "......oMcCCcMo..........",
    "......oMccccMo..........",
    ".......oLccLo...........",
    ".......oMo.oMo..........",
    ".......oMo.oMo..........",
    ".......oDo.oDo..........",
    ".......ooo.ooo..........",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Heavy knight — a big great-helm with a visor slit over a bulky team tower
  // shield (steel rim + boss). Reads as the chibi frontliner / shield-wall.
  tank: [
    "........................",
    "........................",
    "......oLLLLLLLLLLo......",
    "......oLLLLLLLLLLo......",
    "......oMLLLLLLLLMo......",
    "......oMLLLLLLLLMo......",
    "......oMeeeeeeeeMo......",
    "......oMLLLLLLLLMo......",
    ".......oMLLLLLLMo.......",
    "........oMLLLLMo........",
    ".....ooLLLLLLLLoo.......",
    "....oLLLLLLLLLLLLo......",
    "....oLccccccccccLo......",
    "....oLcCCCCCCCCcLo......",
    "....oLccCpppCcccLo......",
    "....oLcCCCCCCCCcLo......",
    "....oLccccccccccLo......",
    "....oLLLLLLLLLLLLo......",
    ".....oMDDo..oDDMo.......",
    ".....oMDDo..oDDMo.......",
    ".....oMDo....oDMo.......",
    ".....ooo......ooo.......",
    "........................",
    "........................",
  ],
  // Archer — green hood + cloak, holding a clearly CURVED recurve longbow out to
  // the right: wood limbs (W) bowing out with recurved tips, a bright bowstring
  // (b) down the chord, and a nocked arrow (b shaft) running left to the hand, so
  // the weapon reads as a bow-and-arrow at a glance, not a plain vertical bar.
  ranger: [
    "...............oWo......",
    "...............oWWo.....",
    ".......oooooo..obbWo....",
    "......onnnnnno..bWWo....",
    ".....onnnnnnno..bWWo....",
    ".....onGsssGno..boWo....",
    ".....oGseseGo...bWWo....",
    "......oGsssGo...bWWo....",
    ".......oGkssGb..boWo....",
    ".....obbbbbbbbb.bWWo....",
    ".......oGGGGb...bWWo....",
    "......oGcccccG..obWo....",
    "......oGcCpCcG...oWo....",
    "......oGccpccG...oWo....",
    "......oGcCpCcG...oWo....",
    ".......oGcccG....oWo....",
    ".......oGo.oGo..........",
    ".......oWo.oWo..........",
    ".......oWo.oWo..........",
    ".......ooo.ooo..........",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Wizard — tall pointed hat, white beard, flowing robe, gem-tipped staff.
  mage: [
    "..........o.............",
    ".........oco............",
    "........occco...........",
    ".......occccco...oro....",
    "......occccccco..rgr....",
    ".....occcccccco..oro....",
    ".....ooooooooooo.oho....",
    "........oMsssMo..oho....",
    ".......oMseseMo..oho....",
    ".......offfffMo..oho....",
    "......oCffffffCo.oho....",
    "......oCcffffcCo.oho....",
    "......oCccccccCo.oho....",
    ".....oCcccpccccCo.ho....",
    ".....oCccpppcccCo.......",
    ".....oCcccpcccccCo......",
    "....oCcccccccccccCo.....",
    "....oCcccpcccccccCo.....",
    "....oCCcccccccccCCo.....",
    "....ooooooooooooooo.....",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Barbarian — wild hair, bare muscled arms, a team sash, a big two-handed axe.
  brawler: [
    "........................",
    "........................",
    ".......oooooo.oWo.......",
    "......okkkkkko.oWobbbo..",
    "......okkkkkko.oWobbbbo.",
    "......okssskko.oWobbbo..",
    "......oksesko..oWobbo...",
    "......okssssko.oWo......",
    ".......okkkko..oWo......",
    "......osLLLLso.oWo......",
    ".....osLkkkkLs.oWo......",
    ".....oskccccksoWo.......",
    ".....oskcCpCcksoo.......",
    ".....oskccccccks........",
    "......oskccccks.........",
    "......oskkkkkso.........",
    ".......oko.oko..........",
    ".......oWo.oWo..........",
    ".......oWo.oWo..........",
    ".......ooo.ooo..........",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
};

export const RPG_CLASSES = Object.keys(RPG_HEROES);

// Throws if any authored grid isn't exactly 24x24 (a miscount would otherwise
// crash paintGrid obscurely at boot). Returns the class count on success.
export function validateRpgGrids() {
  for (const cls of RPG_CLASSES) {
    const rows = RPG_HEROES[cls];
    if (rows.length !== 24) throw new Error(`RPG hero ${cls} has ${rows.length} rows, expected 24`);
    rows.forEach((r, i) => {
      if (r.length !== 24) throw new Error(`RPG hero ${cls} row ${i} is ${r.length} wide, expected 24`);
    });
  }
  return RPG_CLASSES.length;
}
