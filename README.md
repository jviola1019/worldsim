# EPOCH: Civilizations Unbound

A pixel-art civilization god simulator for phone and desktop browsers. You shape a
procedurally generated world, and peoples grow from foraging bands into
nations. Each nation follows its own path through agriculture, kingdoms,
industry and, if it gets there, spaceflight. History is emergent: wars,
faiths, revolutions and collapses come from simulated causes that are recorded
and can be inspected. No script decides the outcome.

The genre reference is WorldBox. All code, art, names and layouts are
original; see [docs/FEATURES.md](docs/FEATURES.md) for the comparison and
[docs/ASSETS.md](docs/ASSETS.md) for the asset manifest.

## Quick start

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173 (also on your LAN, for testing on a phone)
```

Open the address on an iPhone (Safari) or a desktop browser. Choose **New world**,
then **Create world**. Press the fastest playback button to watch history unfold.

| Command | What it does |
|---|---|
| `npm run build` | Type-check, then build a static bundle into `dist/` (relative paths; host it anywhere). |
| `npm run preview` | Serve `dist/` locally on port 4173. |
| `npm test` | Unit, property, integration and round-trip tests (Vitest, ~40 s). |
| `npm run e2e` | Browser smoke test in emulated iPhone 13 and desktop. Needs `npm run preview` running. |
| `npm run sim -- <seed> <years> <size>` | Headless run that prints history. |
| `npm run stats -- <seeds> <years> <size>` | Runs several seeds and summarizes outcomes as min/median/max. |
| `npm run bench -- <size> <years>` | Headless throughput (ms per simulated year) at checkpoints. |
| `npm run bench:browser -- phone\|desktop` | Frame rate and simulation speed in headless Chromium. Needs `npm run preview` running. |
| `npm run sprites` | Renders the procedural sprite sheets to PNG contact sheets in `tools/output/`. |

### Deploying

`npm run build` produces a fully static site in `dist/` with relative asset paths.
Upload it to any static host, such as GitHub Pages, Netlify or S3. It needs no server: saves stay
in the browser's IndexedDB, and you can export them as `.epoch` files from the menu.

## Documentation

| Document | Contents |
|---|---|
| [docs/STATUS.md](docs/STATUS.md) | What is complete, partial, experimental or missing, per requirement, plus known issues. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, tick model, data model, determinism rules, rendering, persistence. |
| [docs/MODEL.md](docs/MODEL.md) | Simulation assumptions, each labeled evidence-informed, stylized or speculative. |
| [docs/FEATURES.md](docs/FEATURES.md) | Feature-parity matrix against the genre reference. |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Measured throughput, frame rate and memory, and how to reproduce them. |
| [docs/ASSETS.md](docs/ASSETS.md) | Asset manifest: every sprite family, its source, license, resolution and use. |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Numbered requirements (R0–R17) that the tests and status report refer to. |
| [docs/research/](docs/research/README.md) | Background research: the feature inventory and the grounding for the simulation. |

## License

MIT for code. All art is generated procedurally by code in this repository and
covered by the same license.
