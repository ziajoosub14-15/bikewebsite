# Velolab: bike configurator and performance simulator

React + TypeScript + Vite + Tailwind. All physics is pure TypeScript in `src/physics` with Vitest tests.
Currency AED; units metric.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # typecheck + production build
```

## Folder structure

```
src/
  physics/            Pure physics (no React/DOM): config, atmosphere, wind, rolling, aero,
                      power, cornering, route geometry, time-step simulate + tests
  data/components/    Parts as JSON (add a part by copying an entry); catalog.ts reads them
  domain/             App logic between data and physics, all unit-tested:
                      bikeModel, compatibility, rider, fit, comfort, setup (build + rider → physics),
                      summary, ride, race (+ pro ghosts, winner reasons), upgrades, autobuild,
                      weightVsAero, presets
  routes/             Preset routes, route sections (for splits), GPX parser
  state/store.tsx     App state (rider, builds, conditions, route, uploaded GPX), saved in localStorage
  storage/            Persistence helper: the one place to swap localStorage for a backend
  workers/            Web Worker for heavy jobs (auto-build, upgrade search)
  ui/                 React pages: builder, rider (fit + comfort), ride (sim), race, budget, charts
```

## App sections

- **Build**: parts by brand, compatibility checker, live summary, comfort ranking, fit. Several saved builds.
- **Rider & fit**: weight, height, inseam, arm length, FTP and % of FTP, position; frame size, saddle height
  and stem from the fit calculator; comfort per factor; tyre pressure.
- **Ride sim**: preset routes or GPX upload; wind (direction dial), temperature, altitude, surface; results,
  elevation chart coloured by gradient with speed below, side-view animation, energy breakdown,
  section times and braking points.
- **Race**: 2–4 of your builds and/or generic pro-level ghosts on the same course; animated race with
  live speed, power and gaps; split times; plain-English reasons for the result.
- **Budget**: auto-build for a budget and priority on a route; upgrades ranked by seconds saved per
  100 AED, plus free changes (position, tyre pressure); weight-vs-aero crossover gradient.

## How bikes look

Each frame in `frames.json` has `colourways`: base and accent colours, a paint layout (`solid`, `headBlock`,
`rear`, `topTube`, `front`, `fade`), finish (gloss, matte, pearl, metallic), logo colour and optional stripes.
`official: true` marks colourways confirmed from the maker or dealer listings; the rest are typical schemes.
Each frame also has a `shape` (seat-tube curve, top-tube slope, how low the stays join, tube depths, fork
style, and features such as nose cones, lugs, Trek IsoFlow, Future Shock, top-tube storage or the Y1Rs
off-axis seatpost); `ui/bike/frameShape.ts` turns it into curved, tapered tubes for 2D, 3D and the
simulator. Brand cockpits (Colnago CC.Y1 / CC.01, Cervélo V-stem, Canyon CP0018, Pinarello Talon, Trek RSL)
have their own drawing style and only fit their frames.
Wheels have a `look` (rim finish, decal text and model, front/rear depth, spoke counts, lacing) and tyres a
`sidewall` (black or tan).
The same paint rules drive the 2D drawing (`ui/builder/BikeIllustration.tsx`) and the 3D model
(`ui/bike/Bike3D.tsx`, three.js, loaded only when you open the 3D view). These are illustrations built
from the parts' data, not brand photos or logos.

## Brands and data accuracy

Frames cover the top models of Colnago, Specialized, Trek, Cervélo, Pinarello and Canyon (aero, climbing,
endurance, gravel, time trial) and entry + top models for Java, Sunpeed and Kross. Parts use real brands
(Shimano, SRAM, Campagnolo, Zipp, ENVE, Roval, DT Swiss, Continental, Vittoria and more). Weights are based on
published claims and prices are approximate retail figures converted to AED. Check them before relying on
them. Brand names are trademarks of their owners.

## Adding a part

Copy an entry in the right `src/data/components/*.json` file, give it a new `id`, change the numbers and run
`npm test`. The data tests check ranges, unique ids and required compatibility tags. The schema with
units is documented in `src/types/components.ts`.

## Physics model

Rider power × drivetrain efficiency = gravity `m·g·sin θ·v` + rolling `m·g·cos θ·Crr·v` + drag
`½·ρ·CdA·v_air²·v`. The simulator steps through time (0.5 s, or 0.05 s in braking zones), so momentum,
accelerations and descents behave realistically. Before riding, it builds a max-safe-speed curve backwards
from every corner using the available braking. Where the rider's speed meets that curve, they brake.

Benchmark (tested): a 70 kg rider at 250 W on a flat road with no wind, in the drops on a road bike, does about 38 km/h.

## Phases

1. ✅ Setup, parts JSON, physics module with tests
2. ✅ Bike builder, compatibility checker, live summary panel
3. ✅ Rider inputs, fit calculator, comfort ranking
4. ✅ Simulator: preset routes, wind/weather/surface, descents, charts, side-view animation
5. ✅ Multiple builds, race mode, splits, ghost racing
6. ✅ Budget mode, auto-build, upgrade suggestions, weight vs aero chart
7. ✅ GPX upload (leaderboards and share cards dropped)
