# MEO Power Model demo

A browser-only spacecraft power simulator for circular MEO orbits. The TypeScript engine runs in a Web Worker; Next.js exports a static site.

## Run

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. `npm run build` writes the static site to `out/`. Run `npm test` for engine checks and `npm run test:e2e` for browser smoke tests.

## Model map

`src/engine/` follows the diagram blocks: configuration, orbit and environment, power gain, power used, battery, design loops, and outputs. The simulator page is interactive. `/model` has explanatory Python-style snippets and the assumptions inventory.

The satellite and cooler figures are illustrative placeholders. The aligned dipole omits external magnetic currents; the shadow is cylindrical; beta is fixed directly. Do not use the demo for flight design without validation against spacecraft data and a higher fidelity environment.

When changing an engine formula, update the matching snippet in `src/content/modelSnippets.ts` and the assumptions if necessary.
