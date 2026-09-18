# Woodland · Critter Quest

A complete phone-friendly creature-collecting adventure featuring woodland animals and the supplied PartyPoss references.

## Play

[Play Critter Quest](https://alastordev.github.io/partyposs-maui-wali/)

Choose Beaver, Bobwhite, or Fox as your starter. Explore Lakeside Lodge, Whispering Pines, and Sunrise Ridge to collect all eight woodland critters: Beaver, Bobwhite, Eagle, Fox, Owl, Bear, Buffalo, and Antelope.

- Swipe or tap to catch wild critters. Regular balls are unlimited; berries, Ultra Balls, and winning a wild battle improve the odds. A third successful hit guarantees a catch.
- Build a patrol of up to three critters. Battle with basic moves, energy-powered specials, Guard, tonics, and teammate swaps. Each species has its own moves and elemental type.
- Train with coins, duplicate catches, and battle experience. Rest the entire patrol at camp for free. Supply purchases and ticket rewards support longer adventures.
- Beat the Fellowship, Wisdom, and Courage trials to unlock the next trails and earn badges.
- Collect all eight patrol critters and all three badges to open the Great Oak. Catch PartyPoss to complete the campaign, then bring **Maui Wali** into battle. The original attack animation remains available in his encounter.

Encounter keyboard controls: **Space** throw, **B** berry, **U** switch ball, **M** Maui Wali. Other controls are standard keyboard-accessible buttons. Sound starts muted. AR uses the rear camera as a background after permission; it does not perform spatial tracking. The camera button saves or shares the current critter's photo. Add the page to your phone's home screen for standalone play. After the first complete load, the campaign and assets work offline.

Existing PartyPoss progress automatically migrates into the new adventure. Original catch totals, XP, inventory, and a captured PartyPoss are preserved. Legacy players can revisit PartyPoss at the Great Oak immediately. The original save is retained; new progress is stored under `woodbadge-quest-v2`. Battles in progress restart at the map after a reload, with earned progress and current patrol health preserved.

## Local development

Requires Node.js 20 or later. No packages or build step are needed.

```sh
npm start
npm test
npm run check
```

The game is served at `http://127.0.0.1:4173`. All publishable files are in `dist/`. GitHub Actions runs logic/syntax checks and publishes that directory to GitHub Pages on pushes to `main`. Domain tests include a complete simulated campaign, save migration, progression gates, rewards, and battle recovery. Browser tests live in `tests/adventure-browser.mjs` and `tests/adventure-offline.mjs`; pass a Node modules directory containing Playwright and use an installed Chrome browser.

## Art and attribution

Based on two PartyPoss images supplied by the user, with eight original patrol critter illustrations and a new woodland map. Assets were prepared with the built-in image-generation tool. Final asset paths, prompts, and provenance are documented in [ARTWORK.md](ARTWORK.md). This is an independent fan game with no affiliation with Scouting America, Pokémon, Nintendo, Game Freak, Creatures, or Niantic. Pokémon and Poké Ball imagery belong to their respective owners.

No login, location collection, analytics, server, or paid API is required. Camera access stays on the device and stops when the page is hidden. Local progress is device-specific.
