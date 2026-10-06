# Cave Workshop

A small level-planning editor for a Godot 2D cave platformer. Place objects on a grid, configure their properties, sketch the intended traversal route, and export the layout as JSON.

This review package matches Cave Workshop version 2, including the Enemy and Trap tools. The four files in `public/` are the source used by that version of the hosted editor. Hosting account metadata, credentials, and Git history are excluded.

## Run locally

Install Node.js 22 or newer. Extract the archive, open a terminal in this folder, and run:

```sh
npm start
```

Open `http://localhost:4173` in your browser. No `npm install` or build step is needed: the project has no external dependencies. Use a local HTTP server rather than opening `index.html` directly, because the editor uses JavaScript modules. Stop the server with Ctrl+C.

## Features

- A 48 × 22 grid with 32 px cells.
- Platforms, moving platforms, keys, exits, killzones, a player start, enemies, and traps.
- Grid-snapped placement, dragging, position/size editing, undo, keyboard controls, and zoom.
- Moving-platform direction, distance, and speed.
- Enemy health, contact damage, detection radius, patrol direction, distance, and speed.
- Spike traps and timed hazards with configurable damage and timing.
- Ordered route points and an animated traversal preview.
- JSON export/import with grid bounds, Godot center positions and sizes, and object settings.

The preview illustrates an intended route. It does not simulate Godot physics, collisions, enemy AI, or trap activation. The exported file is a reference, not a `.tscn` scene.

## Start the code review here

| File | Responsibility |
| --- | --- |
| `public/model.js` | Object types and defaults, bounds, JSON export/import validation, route interpolation. |
| `public/app.js` | Editor state, undo, pointer/keyboard events, SVG drawing, inspector, previews, file downloads. |
| `public/index.html` | Tool palette, grid layers, inspector, preview controls, help, and dialogs. |
| `public/style.css` | Theme, layout, control styling, and responsive behavior. |
| `scripts/serve.mjs` | A dependency-free local HTTP server bound to your computer only. |
| `tests/validate.mjs` | Model checks and a lightweight DOM event-handler harness. |
| `examples/sample-level.json` | An importable sample layout with an enemy and a timed trap. |

In `model.js`, review `createObject`, `constrain`, `exportLevel`, and `importLevel` together. In `app.js`, follow `addObject`, `setProperty`, `renderInspector`, and `renderCanvas` to see how an object travels from input to display and export. The final section registers optional browser tools when `document.modelContext` is available.

## Validate changes

```sh
npm test
```

The included 22 checks cover placement, bounds, movement settings, enemy/trap settings, route animation logic, undo, keyboard controls, and JSON round-trips. The event harness does not replace browser rendering tests or tests in a native WebMCP context. Node may display an experimental VM-modules warning; the flag enables the harness.

For a manual browser check, place and drag each object, edit enemy patrol/detection settings, switch a trap to a timed hazard, preview a route, export it, and import it again. Also check a narrow viewport and keyboard navigation.

## Data and privacy

Layouts stay in memory while the page is open. Export JSON before closing or refreshing, and import it to resume. There is no cloud layout database, browser-storage autosave, or analytics.

The hosted site's owner-only access is supplied by its hosting service. This standalone code has no authentication backend. The included local server listens on `127.0.0.1`; hosting the static files elsewhere requires that host's access controls if you want a private deployment. The existing hosted Cave Workshop remains private.

## Prepare a Git repository

After reviewing the files, initialize a repository in this folder:

```sh
git init
git add .
git commit -m "Initial Cave Workshop source"
```

Create your chosen remote repository and connect it when ready. No repository has been created or published as part of preparing this package.

## License

No license has been selected for this review package. Choose and add a `LICENSE` file before releasing it as an open-source project. `package.json` is marked `private` to prevent accidental npm package publication; this does not prevent you from creating a Git repository.

## Source snapshot

- Snapshot date: 6 October 2026.
- Hosted source commit: `9865b5ef232083a72eb5a578eecb4858397a6dbe`.
- Application stack: HTML, CSS, JavaScript modules, and SVG.
- Runtime dependencies: none.
