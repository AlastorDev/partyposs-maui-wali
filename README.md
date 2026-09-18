# Woodland · Critter Quest

A phone-friendly walking and creature-collecting adventure featuring woodland animals and PartyPoss. Open the map, allow location, and explore your neighborhood, or play in the practice grove without GPS.

## Play

[Play Critter Quest](https://alastordev.github.io/partyposs-maui-wali/)

Choose Beaver, Bobwhite, or Fox as your starter. Meet all eight woodland critters: Beaver, Bobwhite, Eagle, Fox, Owl, Bear, Buffalo, and Antelope.

- **Walking map:** your avatar follows your GPS position. Tap roaming critters, supply stops, and Patrol Lodges. You must be within 80 meters, with a recent GPS fix accurate to 100 meters or better, and moving at walking speed. Locations have distance indicators and optional walking directions.
- **Camp items:** offer unlimited Trail Woggles to invite critters into your patrol. Golden Woggles improve the odds; Campfire Story cards build trust for the next successful invitation. Swipe upward or tap to offer a woggle. Three successful offers guarantee a new friend. Existing item counts carry over automatically.
- **Supply stops:** swipe or tap the wooden disc for 3 story cards, 1 Golden Woggle, 1 tonic, 25 coins, and 50 XP. Each stop restocks after five minutes.
- **Personal Patrol Lodges:** defeat a team of guardians to earn a Lodge medal, 120 coins, and 180 XP. Challenges become stronger as you collect medals. Victories and medals belong to your phone; there are no shared teams, accounts, or multiplayer ownership.
- **Places near you:** suitable OpenStreetMap landmarks become supply stops and Lodges. A personal Field Camp is placed at the starting point of each GPS session and offers supplies and a Lodge challenge even when no landmarks are available. It is clearly labeled as a virtual personal camp, not a verified public place. Check local access and use public paths. Stop walking before interacting.
- **Walking rewards:** each 250 meters of eligible GPS movement earns 30 coins and 2 story cards. Implausible jumps, poor fixes, and GPS jitter do not earn distance. Location pauses when leaving the map or hiding the page.
- **Practice grove:** use the on-screen steps or “Walk here in practice” to explore a clearly labeled fictional grove. It works without GPS and does not add to real walking distance.
- Build a patrol of up to three critters. Battle with basic moves, energy-powered specials, Guard, tonics, and teammate swaps. Each species has its own moves and elemental type.
- Train with coins, duplicate catches, and battle experience. Rest the entire patrol at camp for free. Supply purchases and ticket rewards support longer adventures.
- Open the map’s **book icon** for the original campaign. Explore Lakeside Lodge, Whispering Pines, and Sunrise Ridge; beat their Fellowship, Wisdom, and Courage trials to unlock trails and earn badges.
- Collect all eight patrol critters and all three badges to open the Great Oak. Catch PartyPoss to complete the campaign, then bring **Maui Wali** into battle. The original attack animation remains available in his encounter.

Encounter keyboard controls: **Space** offer a woggle, **B** use a story card, **U** switch woggle, **M** Maui Wali. Sound starts muted. AR uses the rear camera as a background after permission; it does not perform spatial tracking. The camera button saves or shares the current critter's photo. Add the page to your phone's home screen for standalone play. The practice grove, trail book, battles, and assets work offline after the first complete load. Live map tiles and landmark discovery need an internet connection; they are not downloaded for offline use.

Existing progress, XP, inventory, and captured critters are preserved. Legacy players can revisit PartyPoss at the Great Oak immediately. The historical save key `woodbadge-quest-v2` stays in use for compatibility. Stop cooldowns, Lodge medals, and walking totals use `woodland-walk-v1`. Exact GPS fixes and routes are not saved. Battles in progress restart at the map after a reload, with earned progress and patrol health preserved.

## Location and map services

Location is requested only after pressing **Use my location**. GPS fixes stay in browser memory. The walking map requests the visible map tiles from OpenStreetMap, and a rounded nearby area from the public Overpass API to find landmarks. These services receive the browser’s IP address and requested area. There is no application server, account, analytics, or uploaded location history. The map settings explain this and include an **End location session** control.

The map uses vendored [Leaflet 1.9.4](https://leafletjs.com/) under its BSD-2-Clause license, included in `dist/vendor/leaflet/LICENSE`, and visibly credits [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Tile requests use standard browser caching and only the visible viewport, per the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Landmark lookups are rate-limited and cached in memory by rounded area, with a Field Camp fallback if the public service is unavailable. No third-party map data is bundled into the offline cache. Public map services are best-effort; a larger deployment should use a dedicated map/landmark provider.

## Local development

Requires Node.js 20 or later. No packages or build step are needed.

```sh
npm start
npm test
npm run check
```

The game is served at `http://127.0.0.1:4173`. All publishable files are in `dist/`. GitHub Actions runs logic/syntax checks and publishes that directory to GitHub Pages on pushes to `main`. Domain tests cover the full campaign, migration, battle rewards, GPS distance and freshness, cooldowns, walking rewards, spawns, and landmark filtering. Browser suites are `tests/walking-browser.mjs`, `tests/adventure-browser.mjs`, and `tests/adventure-offline.mjs`; pass a Node modules directory containing Playwright and use an installed Chrome browser. Automated GPS tests use simulated positions and fixture tiles/landmarks rather than panning community map servers. Real GPS behavior and battery use also depend on the phone and browser.

## Art and attribution

Based on two PartyPoss images supplied by the user, with original patrol critter illustrations, a woodland map, and camp item artwork. Final asset paths, image-generation prompts, and provenance are documented in [ARTWORK.md](ARTWORK.md). Map markers and the scout avatar use code-native SVG/CSS. This is an independent fan game with no affiliation with Scouting America, Pokémon, Nintendo, Game Freak, Creatures, or Niantic.

Camera access stays on the device and stops when the page is hidden. Progress is specific to the browser and device. The live link uses HTTPS, as required for phone geolocation and camera permissions.
