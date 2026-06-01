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
    "...occo.oLccccLo.oLho...",
    "...occo.oMcppcMo.oho....",
    "...occo.oMcCCcMo........",
    "...oCCo.oMMccMMo........",
    "....oo..oLMMMMLo........",
    "........oMo..oMo........",
    "........oMo..oMo........",
    "........oDo..oDo........",
    "........ooo..ooo........",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Rogue — drawn hood, light leather, a short dagger in the right hand.
  scout: [
    "........................",
    "........oooo............",
    ".......occcco...........",
    "......occcccco..........",
    ".....occccccco..........",
    ".....ocCssssCco.........",
    ".....oCsesesCco.........",
    "......oCsssCo...o.......",
    "......oCkssCo..obo......",
    ".......occco..obo.......",
    "........oLLLo.obo.......",
    "......oLccccLobo........",
    "......oLcppcLoo.........",
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
  // Heavy knight — full visored helm, broad armour, a big shield on the left arm
  // and a mace in the right hand. Reads as the bulky frontliner.
  tank: [
    "........................",
    ".................oMo....",
    ".......oLLLLLLLLooMMo...",
    ".......oLLLLLLLLooMMo...",
    ".......oMLLLLLLMo.WW....",
    ".......oMeeeeeeMo.WW....",
    ".......oMLLLLLLMo.WW....",
    ".......oMMMMMMMMo.WW....",
    "......ooLLLLLLLLooWo....",
    ".oooo.oLLMMMMMMLLooo....",
    "oLLLLooMcccccccMLoo.....",
    "oLccLooMcCpppCcMo.......",
    "oLcpLooMccpppccMo.......",
    "oLccLooMcCpppCcMo.......",
    "oLLLLooMcccccccMo.......",
    ".oooo.oLLMMMMMMLLo......",
    "......oMDDo..oDDMo......",
    "......oMDDo..oDDMo......",
    "......oMDo....oDMo......",
    "......ooo......ooo......",
    "........................",
    "........................",
    "........................",
    "........................",
  ],
  // Archer — green hood + cloak, a longbow held in the right hand, nocked arrow.
  ranger: [
    "........................",
    ".................o......",
    ".......oooooo...ono.....",
    "......onnnnnno..ono.....",
    ".....onnnnnnno..ono.....",
    ".....onGsssGno.oono.....",
    ".....oGseseGo..ono......",
    "......oGsssGo..ono.h....",
    "......oGkssGo..ono......",
    ".......onnno...ono......",
    "........oGGGo..ono......",
    "......oGcccccGoono......",
    "......oGcCpCcGoono......",
    "......oGccpccGoono......",
    "......oGcCpCcGo.ono.....",
    ".......oGcccGo..ono.....",
    ".......oGo.oGo..o.......",
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
    "...............oooo.....",
    ".......oooooo..obbbbo...",
    "......okkkkkko.obbbbo...",
    "......okkkkkko.obbbbo...",
    "......okssskko..obbo....",
    "......oksesko...oWo.....",
    "......okssssko..oWo.....",
    ".......okkkko...oWo.....",
    "......osLLLLso..oWo.....",
    ".....osLkkkkLso.oWo.....",
    ".....oskccccksooWo......",
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
