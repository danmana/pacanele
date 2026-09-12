# Păcănele — Ultima gheară

A tongue-in-cheek Romanian slot-machine experience inspired by Cluj's goodbye to gambling halls. All credits are fictional; there are no deposits, accounts, purchases, or real payouts.

## Run

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Source changes rebuild automatically; refresh the browser to see them.

```sh
npm run build
```

The output is **`dist/index.html`**, a single self-contained HTML page. Three.js, all scene code, styles, canvas textures, and procedural audio are embedded. It also works directly from disk and offline. The news article in the information dialog is an optional source link, not a runtime dependency.

## Play

- Press **Mai dă o gheară**, the cabinet's yellow button, or **Space** to spin.
- Change the stake with **Miză** or the white stake buttons: 10, 20, or 50 fictional lei.
- Drag the room to inspect the full cabinet from different angles.
- **M** toggles sound; **F** toggles fullscreen. Browsers without the Fullscreen API use an expanded viewport.
- **Îmi scot banii și plec** prints a satirical receipt. **Mai bag o fisă** starts a fresh session with 200 credits.
- After two minutes, the next completed spin offers the receipt. It is possible to leave at any time.

Three horizontal lines pay for matching symbols consecutively from the left. The information dialog contains the exact multipliers. At least three stars anywhere add a 5× stake bonus. Results are independently sampled with Web Crypto; there is no rigged first win or adaptive outcome selection. Balances last only for the current page session.

## Rendering and sound

The cabinet is modeled as full 3D geometry, including sculpted side panels, upper and lower glass screens, chrome trim, a sloping button deck, animated plastic buttons, bill acceptor, service lock, and coin tray. A leather stool and other cabinets furnish the room.

The scene uses a locally generated half-float HDR room environment and PMREM image-based lighting, physically based materials, shadows, planar floor reflections, depth of field, bloom, antialiasing, and subtle grain. Canvas-generated screen artwork and material textures need no asset downloads. Static geometry is batched by material and rendering resolution adapts to slower devices.

Web Audio synthesizes plastic clacks, motor noise, staggered reel-stop thumps, arcade win tones, coins, and receipt sounds. Sound starts after user interaction; background tabs suspend audio and rendering. Reduced-motion preferences shorten spins and remove flashing trim and animated grain.

## Verify

```sh
npm test
npm run test:browser
```

Browser tests use locally installed Google Chrome. They verify accounting in the UI, interaction locks, physical button raycasting, camera dragging, touch controls, mobile/tablet/landscape layouts, receipt/restart, modal keyboard behavior, audio activation, fullscreen, and completely offline operation. Unit tests cover payouts, invalid input, exhausted balances, settlement idempotence, and 10,000 rounds of accounting invariants.

## Publish

The repository is ready for GitHub and Vercel. In Vercel, import the GitHub repository using **Other** as the framework. `vercel.json` already selects `npm run build` and the `dist` output directory. No environment variables or backend services are required.

Source modules live in `src/`; `scripts/build.mjs` bundles them into the one-page deliverable. The supplied reference photos remain in `examples/` and are not shipped in the build. Third-party notices are in `THIRD_PARTY_NOTICES.md`.
