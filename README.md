# PartyPoss · Maui Wali

A phone-friendly catching game made from the supplied PartyPoss references. Swipe a Poké Ball toward PartyPoss, give him berries, use Ultra Balls, and trigger **Maui Wali** with green and purple magic, leaves, plumeria flowers, sparkles, and confetti.

## Play

Open the GitHub Pages link in this repository's About panel. Tap or swipe the ball to throw. Use **Maui Wali** to trigger the move. Regular Poké Balls never run out; each catch rewards two berries and an Ultra Ball. Catches and item counts are saved in this browser. A third successful hit always catches PartyPoss.

Keyboard controls: **Space** throw, **B** berry, **U** switch ball, **M** Maui Wali. Sound starts muted. The AR switch uses the rear camera as a background after permission; it does not perform spatial tracking. The camera button saves or shares a photo. Add the page to your phone's home screen for standalone play; after the first complete load, assets are available offline.

## Local development

Requires Node.js 20 or later. No packages or build step are needed.

```sh
npm start
npm test
npm run check
```

The game is served at `http://127.0.0.1:4173`. All publishable files are in `dist/`. GitHub Actions publishes that directory to GitHub Pages on pushes to `main`.

## Art and attribution

Based on two images supplied by the user. Character, ball, background, and effect assets were prepared with the built-in image-generation tool. Asset prompts and provenance are documented in `ARTWORK.md`. Pokémon and Poké Ball imagery are used in an unofficial fan game and belong to their respective owners. No affiliation with Pokémon, Nintendo, Game Freak, Creatures, or Niantic is implied.

No login, location collection, analytics, server, or paid API is required. Camera access stays on the device and stops when the page is hidden. Local progress is device-specific.
