# MEO Parametric Power Model: Web Demo Simulator Build Plan (TypeScript)

**Location:** `simulator_demo/`
**Source diagrams:** [docs/system_flow_diagram.png](docs/system_flow_diagram.png) (system flow) and [docs/assumption_notes.png](docs/assumption_notes.png) (assumption notes)
**Related docs:** [../Model_Diagrams_Explained.md](../Model_Diagrams_Explained.md), [../Model_Verification_and_Validation.md](../Model_Verification_and_Validation.md)

---

## 0. Summary

Build a small web app that runs the MEO parametric power model live, **entirely in the browser** (TypeScript, no backend):

- **Page 1: Simulator**
  - **Left:** parameter controls (sliders plus number inputs, toggles, selects)
  - **Centre:** an output section where the user picks which results to show
  - **Right:** a small 3D view (Earth, orbit, sun, eclipse shadow, satellite) that updates with the parameters
- **Page 2: Model & assumptions**
  - The key calculation functions, shown as **simplified Python-style example code** (what each block's Python file would look like)
  - The full list of model assumptions

**Code structure follows the diagram exactly.** Each **big block → one TypeScript module file** in `src/engine/`. Each **small block → one exported function** in that file. Helper functions are allowed but not exported from the block's public surface (or live in `src/engine/lib/`).

### Goals
1. The pipeline in the diagram runs end-to-end in the browser, and results update in well under 100 ms when a parameter changes.
2. Every number on screen can be traced to a function, a formula and an assumption.
3. The UI is minimal: clear controls, no decoration, readable in a screen-share.
4. It deploys as a **static site** (a shareable link, works offline once loaded).

### Non-goals (for the demo)
- Elliptical orbits, orbit perturbations (J2, drift), manoeuvres
- High-fidelity field models (IGRF is a stretch goal) or thermal models
- A backend, user accounts, or persistence beyond the browser

---

## 1. Key architecture decision

**TypeScript engine running in the browser, inside a Web Worker. Next.js as the UI. Static export.**

| Aspect | Decision | Why |
|---|---|---|
| Language | TypeScript engine in `src/engine/`, one file per diagram block | One codebase, one language, strong typing across engine ↔ UI |
| Where it runs | In a **Web Worker** (via `comlink`) | Keeps sliders and 3D smooth while heatmaps and Monte Carlo run |
| Hosting | `next build` with `output: "export"` → static files | Deploy anywhere (Vercel, Netlify, GitHub Pages). A link to send after the interview. |
| Config and validation | **zod** schema with `.meta()` per field | One source for types, defaults, ranges and UI labels |
| Page 2 code | Hand-written **Python-style example snippets** (one per key function), stored as content | Easier to read in an interview than production TS. Each snippet names the TS function it mirrors, and a test checks that the function exists. |

**Trade-offs accepted:**
- No numpy. A tiny vector-helper module (`lib/vec.ts`) and plain loops over `Float64Array` replace it. At ~4,000 steps per run this takes ~1–5 ms in JS.
- The block-to-file mapping is the same as the Python version would have been: "Python file" becomes "TS module".

---

## 2. Folder structure

```
simulator_demo/
├── BUILD_PLAN.md                     ← this file
├── README.md                         ← quick start (written in Phase 0)
├── package.json                      ← dev / build / test / lint scripts
├── next.config.ts                    ← output: "export"
├── vitest.config.ts
├── playwright.config.ts
├── docs/
│   ├── system_flow_diagram.png
│   └── assumption_notes.png
│
├── src/
│   ├── engine/                       ← ONE FILE PER DIAGRAM BLOCK (pure TS, no React, no DOM)
│   │   ├── config.ts                 ← [Block] Inputs and scenario config
│   │   ├── environment.ts            ← [Block] Orbit and environment
│   │   ├── powerGain.ts              ← [Block] Power gain · P_gen(t)
│   │   ├── powerUsed.ts              ← [Block] Power used · P_load(t)
│   │   ├── battery.ts                ← [Block] Energy balance and battery
│   │   ├── designLoops.ts            ← [Block] Design loops (change inputs and rerun)
│   │   ├── outputs.ts                ← [Block] Outputs
│   │   ├── pipeline.ts               ← glue: runScenario(cfg) calls blocks in order
│   │   ├── types.ts                  ← shared data contracts (Environment, LoadSet, BatteryResult…)
│   │   ├── constants.ts              ← physical constants + sources
│   │   ├── assumptions.ts            ← single source of truth for the assumptions list
│   │   ├── lib/                      ← helpers: vec.ts, grid.ts, rng.ts (seeded), downsample.ts
│   │   └── __tests__/                ← vitest unit tests, one per block (see §9)
│   │
│   ├── workers/
│   │   └── engine.worker.ts          ← exposes runScenario / runSizing / runHeatmap / runMonteCarlo via comlink
│   │
│   ├── app/
│   │   ├── layout.tsx                ← header + nav (Simulator | Model & assumptions)
│   │   ├── page.tsx                  ← Page 1: simulator (client component)
│   │   └── model/page.tsx            ← Page 2: example functions + assumptions (static)
│   │
│   ├── components/
│   │   ├── controls/                 ← ParamSlider, ParamToggle, ParamSelect, ControlGroup, PresetBar
│   │   ├── outputs/                  ← OutputPicker, KpiGrid, TimeSeriesChart, BudgetTable, Heatmap, Histogram, Warnings
│   │   ├── view3d/                   ← Scene, Earth, OrbitRing, ShadowCylinder, SunArrow, Satellite, Stations, Timeline
│   │   └── model/                    ← FunctionCard, AssumptionList, Toc
│   │
│   ├── content/
│   │   └── modelSnippets.ts          ← Page 2: Python-style example code per key function (+ formula, explanation)
│   │
│   └── lib/
│       ├── store.ts                  ← zustand: config, results, selected outputs, time cursor, analysis state
│       ├── engineClient.ts           ← comlink wrapper, latest-request-wins, progress callbacks
│       └── schemaFields.ts           ← walks the zod schema → list of control descriptors
│
└── e2e/
    └── smoke.spec.ts                 ← Playwright smoke test
```

---

## 3. Diagram → code mapping

| Diagram block | TS file | Exported functions (small blocks) | Returns |
|---|---|---|---|
| Inputs and scenario config | `config.ts` | `ScenarioConfigSchema` (zod), `defaultConfig(preset)`, `applyCase(cfg)` | Validated config with BOL/EOL and worst-case overrides applied |
| Orbit and environment | `environment.ts` | `orbitAndSunGeometry()` · `magneticField()` · `groundContact()` | `Environment` of time series |
| Power gain · P_gen(t) | `powerGain.ts` | `solarArrayPower()` | `pGen: Float64Array` (W) |
| Power used · P_load(t) | `powerUsed.ts` | `payloadPower()` · `adcsPower()` · `commsPower()` · `thermalPower()` · `torquerPower()` · `cryocoolerPower()` (+ `totalLoad()` helper) | `LoadSet`: per-subsystem requested load + torquer/cooler info |
| Energy balance and battery | `battery.ts` | `simulateBattery()` · `depthOfDischarge()` (+ internal `applyLoadShedding()`) | `BatteryResult`: SoC(t), actual loads, shed flags, DoD |
| Design loops | `designLoops.ts` | `sizingLoop()` | Smallest array area + battery capacity that still works |
| Outputs | `outputs.ts` | `heatmap()` · `monteCarlo()` · `plots()` · `powerBudgetTable()` · `worstCaseDod()` · `margins()` | Plain JSON-serialisable results for the UI |

### Pipeline order (`pipeline.ts → runScenario`)
```ts
export function runScenario(input: ScenarioConfig): SimResult {
  const cfg  = applyCase(input);                                        // config.ts
  const geo  = orbitAndSunGeometry(cfg);                                 // environment.ts
  const env  = { ...geo, ...magneticField(geo, cfg), contact: groundContact(geo, cfg) };
  const pGen = solarArrayPower(env, cfg);                                // powerGain.ts
  const torq = torquerPower(env, cfg);                                   // powerUsed.ts
  const load = {
    payload: payloadPower(env, cfg), adcs: adcsPower(env, cfg),
    comms: commsPower(env, cfg),     thermal: thermalPower(env, cfg),
    torquer: torq.power,             cryocooler: cryocoolerPower(env, torq.on, cfg).power,
  };                                                                     // cooler needs the torquer schedule
  const batt = simulateBattery(pGen, load, env, cfg);                    // battery.ts (shedding inside the loop)
  return {                                                               // outputs.ts
    kpis: { ...margins(env, pGen, load, batt, cfg), ...worstCaseDod(env, batt, cfg) },
    series: plots(env, pGen, load, batt), budget: powerBudgetTable(env, load, batt),
    geometry: /* orbit ring, sat track, sun vector, stations */, warnings: [...],
  };
}
```
`designLoops.sizingLoop`, `outputs.heatmap` and `outputs.monteCarlo` call `runScenario` repeatedly with modified configs. That is the "change inputs and rerun" loop in the diagram.

**Rule:** `src/engine/` is **pure**: no React, no DOM, no `window`. It runs the same in the worker, in vitest (Node) and at build time.

---

## 4. Engine design (per file)

### 4.0 Shared data contracts (`types.ts`)

```ts
export type Vec3 = [number, number, number];

export interface Environment {        // output of environment.ts (all arrays length N)
  t: Float64Array;                    // s, uniform grid 0 … nOrbits·T
  dt: number;                         // s
  period: number;                     // s, T = 2π√(r³/μ)
  rEci: Float64Array;                 // N×3 flattened, km
  sunHat: Vec3;                       // constant over the run (β fixed)
  inEclipse: Uint8Array;              // 0/1
  cosSun: Float64Array;               // cos θ between sun and array normal (0 in eclipse)
  bVec: Float64Array;                 // N×3 flattened, T
  bMag: Float64Array;                 // T
  contact: Uint8Array;                // any ground station visible
  stationVisible: Uint8Array[];       // per station (3D view)
  beta: number; betaStar: number;     // rad; eclipse exists only if |β| < β*
  eclipseDuration: number;            // s per orbit
}

export type Subsystem = "payload" | "adcs" | "comms" | "thermal" | "torquer" | "cryocooler";

export interface LoadSet {
  requested: Record<Subsystem, Float64Array>;   // W
  torquerOn: Uint8Array; coolerOn: Uint8Array;
  info: { tOn: number; duty: number; feasible: boolean; conventionalTOn: number;
          coolerWhAlwaysOn: number; coolerWhOnDemand: number; coolerModeUsed: CoolerMode };
}

export interface BatteryResult {
  soc: Float64Array;                             // 0–1
  actual: Record<Subsystem, Float64Array>;       // loads after shedding
  shed: Uint8Array; shuntedW: Float64Array; depleted: boolean;
}
```

### 4.1 `config.ts`: Inputs and scenario config

- `ScenarioConfigSchema`: nested **zod v4** object with groups `sim`, `orbit`, `environment`, `gain`, `used`, `battery`, `rules`, `design`.
  - Each field: `z.number().min(hardMin).max(hardMax).default(v).meta({ label, unit, step, softMin, softMax, group, control, help, advanced, showIf })`.
  - `export type ScenarioConfig = z.infer<typeof ScenarioConfigSchema>`.
  - **This metadata drives the UI** (see §7.3), so controls, ranges and defaults live in one place.
- `defaultConfig(preset: "smallMeo" | "gnssClass"): ScenarioConfig`
- `applyCase(cfg): ScenarioConfig` (pure, returns a copy):
  - `case: "BOL"` → degradation factor 1.0. `"EOL"` → use `gain.eolFactor`.
  - `worstCase: true` → β = 0°, flux = aphelion (1322 W/m²), EOL, `fieldScale = environment.stormScale`.

### 4.2 `environment.ts`: Orbit and environment

**`orbitAndSunGeometry(cfg)`** (circular orbits only)
```
r      = R_E + h
T      = 2π·√(r³/μ)
u(t)   = 2π·t / T                                   // argument of latitude
n̂      = [1, 0, 0]                                  // ascending node (Ω = 0)
ŷ_o    = [0, cos i, sin i]                          // in-plane, 90° ahead of the node
ĥ      = [0, −sin i, cos i]                         // orbit normal
r_eci  = r·(cos u · n̂ + sin u · ŷ_o)
ŝ      = cos β · n̂ + sin β · ĥ                      // sun set directly by β (demo simplification)
eclipse: (r·ŝ < 0) && |r − (r·ŝ)ŝ| < R_E            // cylindrical shadow
β*     = asin(R_E / r)
cos θ  : 2-axis tracking → 1 ; 1-axis → cos β ; fixed → cos θ_fixed ; 0 in eclipse
```

**`magneticField(env, cfg) → { bVec, bMag }`**: centred, **aligned** dipole (tilt ignored):
```
B(r) = −B0·(R_E/|r|)³ · [3(ẑ·r̂)r̂ − ẑ] · fieldScale        |B| = B0 (R_E/r)³ √(1 + 3 sin²λ)
```
- `fieldScale` (default 1.0) covers storm/uncertainty cases (e.g. 0.7–1.3).
- Stretch goal: IGRF (a TS port of the spherical-harmonic sum with the published coefficients).

**`groundContact(env, cfg) → Uint8Array`**
- Station ECEF → ECI with `θ_g(t) = θ_g0 + ω_E·t` (θ_g0 = 0, arbitrary phase).
- `ρ = r_sat − R_station`, `el = asin(ρ̂ · R̂_station)`, visible if `el ≥ mask`.
- `contact[k] = any station visible`. Per-station masks are stored in `env.stationVisible`.

### 4.3 `powerGain.ts`: Power gain · P_gen(t)

**`solarArrayPower(env, cfg) → Float64Array`**
```ts
const etaTotal = cfg.gain.etaCell * degradation(cfg) * cfg.gain.etaPath; // η includes degradation BOL→EOL and path losses (user note)
for (let k = 0; k < N; k++) pGen[k] = cfg.gain.area * etaTotal * S * env.cosSun[k]; // 0 in eclipse
// S = 1361 W/m² (mean) | 1322 (aphelion) | 1414 (perihelion)
```

### 4.4 `powerUsed.ts`: Power used · P_load(t)

Every subsystem has an `enabled` toggle. Disabled → zeros.

| Function | Model | Default parameters |
|---|---|---|
| `payloadPower(env, cfg)` | `P_on` during duty window(s), `P_standby` otherwise. Schedule `continuous` / `sunlitOnly` / `evenlySpread` with duty fraction. **Presets per satellite type** (navigation, comms relay, science), since it's "highly dependent on the type of satellite". | See §5 |
| `adcsPower(env, cfg)` | `P_adcs × duty` (duty ≈ 1, "mostly on") | 35 W, duty 1.0 |
| `commsPower(env, cfg)` | `P_tx` when `env.contact`, else `P_standby`. **Satellite-to-ground only, no crosslinks.** | 60 W / 8 W |
| `thermalPower(env, cfg)` | `P_eclipse` in eclipse, `P_sun` in sunlight ("on mostly during eclipse") | 40 W / 5 W |
| `torquerPower(env, cfg)` | See below | 5 W driver, m = 3500 A·m² |
| `cryocoolerPower(env, torquerOn, cfg)` | See below (needs the torquer schedule) | 20 W steady / 42 W cool-down / 30 min pre-cool |

**`torquerPower`: momentum dump schedule**
```
τ_d      = P_srp · A_srp · (1 + q) · d_cp              // SRP disturbance torque, sunlit only; P_srp = S / c
ΔH       = Σ τ_d · dt over one orbit (sunlit steps)    // momentum to dump per orbit  (override: dHManual)
τ_avail  = k_eff · m · |B(t)|                          // k_eff ≈ 0.6 accounts for m ⟂ B geometry
window   = sunlit steps if rules.dumpInSunlightOnly else all steps (starting at eclipse exit)
on       = first steps in window until Σ τ_avail·dt ≥ ΔH   (repeat every orbit)
t_on     = Σ on · dt                                    // ≈ ΔH / |m × B|   (matches diagram)
duty     = t_on / T_orbit
feasible = impulse reached within the window          // else warning: "insufficient magnetic authority"
P_torq   = P_driver · on
```
Also reports the **equivalent conventional torquer** (m = 20 A·m²) `t_on` for comparison. This is a strong talking point.

**`cryocoolerPower`: strategy (per assumption note)**

| Mode | Behaviour |
|---|---|
| `alwaysOn` (default) | `P_steady` at all times |
| `onDemand` | Off (`P_idle`, default 0 W) → `P_cooldown` for `t_precool` before each torquer window → `P_steady` during the window |
| `auto` | Compute both, choose the lower energy per orbit, report both energies |
| toggle `offInEclipse` (with `alwaysOn`) | Off during eclipse, then `P_cooldown` for `t_precool` after eclipse exit |

It returns `coolerWhAlwaysOn`, `coolerWhOnDemand` (Wh/orbit) and the mode used, so the UI can show which strategy is more efficient.

### 4.5 `battery.ts`: Energy balance and battery

**`simulateBattery(pGen, loads, env, cfg) → BatteryResult`**: the only sequential loop (charge carries over):
```ts
let E = cfg.battery.soc0 * C_Wh;
for (let k = 0; k < N; k++) {
  shedOn = applyLoadShedding(soc, shedOn, cfg.rules);           // togglable; threshold + hysteresis
  const pLoad = sumLoads(loads, k, shedOn, cfg.rules.shedOrder);
  const pNet  = pGen[k] - pLoad;
  if (pNet >= 0) {
    const pIn = Math.min(pNet, cfg.battery.maxChargeC * C_Wh);  // e.g. 0.5 C; excess → shunt
    E += pIn * etaCharge * dtH;
  } else {
    E += (pNet / etaDischarge) * dtH;
  }
  E = clamp(E, 0, C_Wh); soc[k] = E / C_Wh;                     // depleted flag if E hits 0
}
```
- Matches the diagram formula `SoC(t+Δt) = SoC(t) + (P_gen − P_load)·η·Δt / C`, with separate charge and discharge η.
- **Load shedding** (toggle `rules.loadShedding`): when SoC < threshold (default 30%), shed in order payload → standby, then comms Tx → off. Restore when SoC > threshold + hysteresis (10%). ADCS, thermal, torquer and cryocooler are never shed in the demo.

**`depthOfDischarge(soc, env) → { dod, sustainable }`**: `DoD = 1 − min(SoC)` over the **last simulated orbit** (the sim runs `nOrbits`, default 3, to approach steady state). `sustainable = false` if end-of-orbit SoC is still falling between the last two orbits.

### 4.6 `designLoops.ts`: Design loops

**`sizingLoop(cfg, onProgress?) → SizingResult`**: "smallest solar array + battery that still works". Always run on the **worst-case** config.
1. **Array:** bisection on `A ∈ [0.1, 50] m²` for the smallest A where `E_gen,used ≥ E_load·(1 + marginTarget)` and the SoC trend is not negative (≈ 12 iterations).
2. **Battery:** `C_min = E_eclipseDischarge / DoD_limit` from a run with a large battery, then check with a real run and step up 2% until `DoD ≤ limit`.
3. Return `aMin`, `cMin`, the check run's KPIs, and the iteration log for display.

### 4.7 `outputs.ts`: Outputs

| Function | Output |
|---|---|
| `plots(env, pGen, load, batt)` | Downsampled time series (≤ 1000 pts, eclipse/contact edges kept) for charts + 3D satellite track |
| `powerBudgetTable(env, load, batt)` | Per subsystem: average, peak, sun-average, eclipse-average (W), Wh/orbit, % share |
| `worstCaseDod(env, batt, cfg)` | DoD (last orbit) vs limit, pass/fail |
| `margins(env, pGen, load, batt, cfg)` | Energy margin % per orbit, DoD margin, sunlit power margin, sustainability flag |
| `heatmap(cfg, x, y, metric, onProgress?)` | Grid of `metric` over two swept parameters (≤ 25×25, coarse dt) |
| `monteCarlo(cfg, uncertainties, n, seed, onProgress?)` | Seeded sampling of uncertain inputs (± %, uniform/normal) → distributions of worst DoD and energy margin, P5/P50/P95, P(DoD > limit) |

Heatmap and Monte Carlo run with `sim.analysisDt` (default 120 s) and 2 orbits, in the worker, with progress updates.

---

## 5. Default constants & parameters

Confidence: **[std]** standard or physical value · **[typ]** typical, datasheet-level value · **[ph]** placeholder, labelled in the UI as "placeholder".

### Physical constants (`constants.ts`)
| Name | Value | Source / confidence |
|---|---|---|
| μ (Earth) | 398,600.4418 km³/s² | WGS-84 / EGM96 [std] |
| R_E | 6,378.137 km | WGS-84 equatorial radius [std] |
| ω_E | 7.2921159 × 10⁻⁵ rad/s | Earth rotation rate [std] |
| c | 299,792,458 m/s | [std] |
| S₀ (mean solar flux) | 1361 W/m² | Kopp & Lean (2011) total solar irradiance [std] |
| S aphelion / perihelion | 1322 / 1414 W/m² | ±3.3% from Earth's orbit eccentricity [std] |
| P_srp | S / c ≈ 4.54 × 10⁻⁶ N/m² | derived [std] |
| B₀ (dipole, equator surface) | ≈ 29,400 nT | IGRF g₁⁰ magnitude, recent epochs [std] |

### Orbit presets (UI buttons)
| Preset | Altitude | Inclination |
|---|---|---|
| O3b / mPOWER | 8,062 km | 0° |
| GLONASS | 19,130 km | 64.8° |
| GPS | 20,180 km | 55° |
| BeiDou MEO | 21,528 km | 55° |
| Galileo | 23,222 km | 56° |

Values are [std] from public constellation descriptions. Check them again before the demo.

### Spacecraft presets
| Parameter | `smallMeo` (demo default) | `gnssClass` | Notes |
|---|---|---|---|
| Altitude / incl. / β | 20,200 km / 55° / 0° | 23,222 km / 56° / 0° | β = 0 is the worst eclipse |
| Array area A | 1.4 m² | 7.0 m² | [ph] sized for ~30% margin |
| η_cell | 0.30 | 0.30 | triple-junction GaAs BOL [typ] |
| EOL degradation factor | 0.85 | 0.80 | MEO radiation, 10–12 yr [ph] |
| η_path | 0.90 | 0.90 | regulator + harness [typ] |
| Array tracking | 2-axis | 2-axis | |
| Payload P_on / standby / duty | 200 W / 20 W / 1.0 | 1,200 W / 100 W / 1.0 | navigation-type continuous [ph] |
| ADCS | 35 W, duty 1.0 | 80 W, duty 1.0 | [ph] |
| Comms Tx / standby | 60 W / 8 W | 80 W / 15 W | [ph] |
| Thermal eclipse / sun | 40 W / 5 W | 150 W / 20 W | [ph] |
| Torquer dipole m | 3,500 A·m² | 3,500 A·m² | Zenno Z01 press figure |
| Torquer driver power | 5 W | 5 W | [ph] |
| k_eff (m ⟂ B factor) | 0.6 | 0.6 | [ph] assumption |
| SRP area / q / d_cp | 6 m² / 0.6 / 0.15 m | 25 m² / 0.6 / 0.3 m | [ph] |
| Cryocooler steady / cool-down / pre-cool | 20 W / 42 W / 30 min | same | [ph] chosen so peak ≈ 47 W and average ≈ half, matching Z01 press figures |
| Battery capacity | 600 Wh | 3,000 Wh | [ph] |
| η_charge / η_discharge | 0.95 / 0.95 | same | Li-ion [typ] |
| Max charge rate | 0.5 C | 0.5 C | [typ] |
| DoD limit | 60% | 60% | few-cycle MEO Li-ion [typ] |
| Initial SoC | 100% | 100% | |
| Load shedding | off, 30% threshold, 10% hysteresis | same | per assumption note (togglable) |
| Ground stations | Awarua NZ (−46.53°, 168.38°), Svalbard (78.23°, 15.39°) | same | elevation mask 10° |
| Sim | 3 orbits, dt = 30 s (analysis dt = 120 s) | same | |

Sanity check on `smallMeo` at GNSS altitude:
- Sunlit generation ≈ 1361 × 1.4 × 0.30 × 0.85 × 0.90 ≈ **437 W EOL**
- Eclipse load ≈ 303 W for ~55 min → **DoD ≈ 49%** on a 600 Wh battery
- Torquer t_on is only **a few minutes per orbit**, so the **cryocooler dominates the Z01 energy** (always-on ≈ 240 Wh/orbit vs on-demand ≈ 22 Wh/orbit). That makes the toggle a good demo moment.

---

## 6. Engine ↔ UI interface (no backend)

The worker exposes a typed API through `comlink`:

```ts
// src/workers/engine.worker.ts
const api = {
  runScenario:   (cfg: ScenarioConfig) => SimResult,
  runSizing:     (cfg: ScenarioConfig, onProgress?: (p: number) => void) => SizingResult,
  runHeatmap:    (req: HeatmapRequest,  onProgress?: (p: number) => void) => HeatmapResult,
  runMonteCarlo: (req: MonteCarloRequest, onProgress?: (p: number) => void) => MonteCarloResult,
};
expose(api);
```

**`SimResult`** (plain JSON-serialisable; typed arrays transferred, not copied):
```jsonc
{
  "kpis":   { "periodH": 11.97, "eclipseMin": 55.1, "eclipseFrac": 0.077, "betaStarDeg": 13.9,
              "pGenSunlitW": 437, "avgGenW": 0, "avgLoadW": 0, "peakLoadW": 0,
              "energyMarginPct": 0, "dod": 0.49, "dodLimit": 0.6, "dodPass": true, "sustainable": true,
              "torquerTOnS": 0, "torquerDuty": 0, "torquerFeasible": true, "conventionalTOnS": 0,
              "coolerWhAlwaysOn": 0, "coolerWhOnDemand": 0, "coolerModeUsed": "alwaysOn",
              "z01SharePct": 0, "contactHPerOrbit": 0, "shedMin": 0 },
  "series": { "tH": [], "soc": [], "pGen": [], "pLoad": [],
              "loads": {"payload": [], "adcs": [], "comms": [], "thermal": [], "torquer": [], "cryocooler": []},
              "eclipse": [], "contact": [], "bNT": [], "tauAvail": [], "torquerOn": [], "coolerOn": [], "shed": [] },
  "budget":   [ { "subsystem": "payload", "avgW": 0, "peakW": 0, "sunW": 0, "eclipseW": 0, "whOrbit": 0, "sharePct": 0 } ],
  "geometry": { "rOrbitRe": 4.17, "incDeg": 55, "betaDeg": 0, "sunHat": [1,0,0],
                "orbitRing": [[0,0,0]], "ringEclipse": [false], "satTrack": [[0,0,0]],
                "stations": [ { "name": "", "ecefRe": [0,0,0], "visible": [false] } ] },
  "warnings": [ "…insufficient magnetic authority…", "…β outside physically reachable range…" ],
  "meta":     { "nSteps": 4308, "dtS": 30, "runtimeMs": 3, "engineVersion": "0.1.0" }
}
```

- **Latest request wins:** `engineClient.ts` tags each `runScenario` call with an id and drops stale results. Analyses can be cancelled (the worker checks a cancel flag between runs; a hard cancel terminates and restarts the worker).
- **Validation:** `ScenarioConfigSchema.safeParse` runs in the UI before sending. Invalid fields show inline errors and nothing is sent.
- **Fallback:** if Workers are unavailable (e.g. some test environments), `engineClient` calls the engine directly on the main thread.

---

## 7. Front end

### 7.1 Stack
- **Next.js (latest stable, App Router) + TypeScript + React 19**, `output: "export"` (static)
- **Tailwind CSS v4** + **shadcn/ui** primitives (Slider, Switch, Input, Select, Checkbox, Accordion, Tabs, Tooltip)
- **Charts:** Recharts (line/area/step + reference lines). Heatmap and histogram as small custom SVG/canvas components.
- **3D:** `three` + `@react-three/fiber` + `@react-three/drei`
- **State:** `zustand` · **Worker bridge:** `comlink` · **Validation:** `zod` v4
- **Code highlighting (Page 2):** `shiki`, rendered at build time

### 7.2 Page 1 layout: Simulator

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ MEO Power Model      Simulator · Model & assumptions               ● Up to date 3 ms │
├──────────────────┬──────────────────────────────────────────┬──────────────────────┤
│ CONTROLS (340px) │ OUTPUTS (flex)                           │ 3D VIEW (380px)      │
│ Preset [Small ▾] │ [ Select outputs ▾ ]  chip chip chip  ⟲  │ ┌──────────────────┐ │
│ Case  (BOL|EOL)  │ ┌ KPI grid ─────────────────────────────┐│ │  Earth · orbit   │ │
│ Worst case  [●]  │ │ Period  Eclipse  DoD  Margin  Z01 %    ││ │  sun · shadow    │ │
│ ▸ Orbit          │ └───────────────────────────────────────┘│ │  satellite ●     │ │
│ ▸ Environment    │ ┌ SoC(t) ─────────────── eclipse shaded ┐│ └──────────────────┘ │
│ ▸ Power gain  ●  │ └───────────────────────────────────────┘│ ▶ ⏸  ━━━●━━━━  ×200 │
│ ▸ Power used  ●  │ ┌ P_gen vs P_load ──────────────────────┐│ Layers: ☑ shadow     │
│ ▸ Battery     ●  │ └───────────────────────────────────────┘│   ☑ stations ☐ B-vec │
│ ▸ Rules          │ ┌ Power budget table ───────────────────┐│ ─────────────────── │
│ ▸ Design loops   │ └───────────────────────────────────────┘│ Warnings (if any)    │
│ [Reset all]      │                                          │                      │
└──────────────────┴──────────────────────────────────────────┴──────────────────────┘
```
- Controls and 3D columns are **sticky**, and only the outputs column scrolls.
- Below 1200 px: the 3D view moves above the outputs. Below 768 px: everything stacks.
- The small coloured dot next to Power gain / Power used / Battery matches the diagram colours (yellow / blue / orange). That is the only decoration.

### 7.3 Controls (generated from the zod schema)
- `lib/schemaFields.ts` walks `ScenarioConfigSchema` and reads each field's `.meta()`, producing a list of control descriptors `{ path, label, unit, kind, min, max, softMin, softMax, step, options, group, showIf, help }`. `ControlGroup` renders a group from these, so there are **no hand-written ranges in the UI**.
- **Numeric field** = label + unit + **slider** (soft range) + **number box** (hard range), kept in sync.
  - Typing out of range shows an inline error in red and the value isn't sent.
  - Enter or blur commits the value. Arrow keys step it.
- **Toggle** = Switch (e.g. subsystem enabled, load shedding, worst case, dump in sunlight only, cooler off in eclipse).
- **Select / segmented** = case BOL/EOL, cryocooler mode, array tracking, payload preset, flux case.
- `showIf` hides dependent fields (e.g. shedding threshold only when shedding is on).
- Per-group "reset" and a global "Reset all". Changed-from-default values get a subtle dot.
- The config is saved in `localStorage` (wrapped in try/catch; defaults used if unavailable). "Copy link" encoding the config in the URL hash is a stretch goal.

**Control groups and fields**

| Group | Fields |
|---|---|
| Scenario | preset, case (BOL/EOL), worst case, nOrbits (1–10), dt (10–120 s) |
| Orbit | altitude (2,000–35,786 km), inclination (0–90°), β (−90…90°, hint shows the physically reachable range ≈ ±(i + 23.44°)), preset buttons |
| Environment | flux case, field scale (0.5–1.5), field model (dipole; IGRF greyed out as stretch), ground stations (checkbox list), elevation mask |
| Power gain | array area, η_cell, EOL factor, η_path, tracking mode (+ fixed θ) |
| Power used | per subsystem: enabled + powers + duty. Payload preset/schedule. Torquer: dipole, driver W, k_eff, SRP area/q/offset or ΔH override. Cryocooler: mode, steady/cool-down W, pre-cool min, off in eclipse |
| Battery | capacity, initial SoC, η_charge, η_discharge, max charge rate, DoD limit |
| Rules | load shedding (toggle, threshold, hysteresis, shed order), dump in sunlight only |
| Design loops | margin target (default 20%), sizing bounds |

### 7.4 Output section
**Output picker:** a grouped checklist dropdown. Selected items appear as removable chips and render as cards in the chosen order. The selection is saved in `localStorage`.

| Group | Selectable outputs |
|---|---|
| **Key numbers (KPI cards)** | Orbital period · eclipse duration & fraction · β* · sunlit generation · orbit-average gen vs load · peak load · energy margin % · worst-case DoD vs limit (pass/fail) · sustainable? · torquer t_on & duty (+ conventional comparison) · magnetic authority (τ_avail vs τ_d) · cryocooler Wh/orbit (always-on vs on-demand, chosen) · Z01 share of load % · contact time per orbit · time in load shedding |
| **Time-series charts** | SoC(t) with DoD-limit line · P_gen vs P_load · stacked load by subsystem · \|B\|(t) and torque available · torquer / cryocooler state timeline · contact windows |
| **Tables** | Power budget table · warnings |
| **Analyses (run on click, in the worker)** | Sizing loop (A_min, C_min + iteration log) · heatmap (choose X, Y, metric, resolution) · Monte Carlo (choose uncertainties ± %, N, seed → histogram + P5/P50/P95 + P(DoD > limit)) |

- **Default selection:** KPI grid (period, eclipse, DoD, margin, Z01 share), SoC chart, P_gen vs P_load, power budget table.
- All time-series charts share **eclipse shading** and a **time cursor**. Hovering a chart moves the satellite in the 3D view, and scrubbing the 3D timeline moves the chart cursor.
- Analyses show a progress bar and a Cancel button. They show "stale" when parameters change after a run, with a "Re-run" button.

### 7.5 3D view (`components/view3d/`)
| Element | Details |
|---|---|
| Scene units | 1 unit = R_E. Camera auto-fits to `2.6 × r_orbit`. OrbitControls (drag to rotate, scroll to zoom). |
| Earth | Plain light-grey sphere with thin lat/long lines, spin axis and equator. No textures (minimal). |
| Orbit ring | From `geometry.orbitRing`. Sunlit part dark grey, **eclipse part in the accent colour**. |
| Sun | Directional light along `sunHat` + small arrow with "Sun" label + β readout |
| Shadow | Translucent cylinder (radius 1) along −ŝ, length r_orbit + 1 |
| Satellite | Small dot following `satTrack`, coloured by state (sunlit / eclipse / torquer on / contact). Play/pause, speed, scrubber. |
| Optional layers | Ground stations (rotating with Earth) + line of sight when in contact · B-vector arrow at the satellite · (stretch) dipole field lines |
| Updates | Rebuilds geometry when a new `SimResult` arrives (memoised by result id). Keeps the previous frame while a run is pending. The canvas is loaded with `dynamic(..., { ssr: false })`. |

### 7.6 State & data flow
```
control change → zod safeParse → zustand config → debounce 100 ms → worker.runScenario (latest wins)
               → store.results → KPI / charts / table / 3D re-render
analysis click → worker.run{Sizing|Heatmap|MonteCarlo}(req, progress) → store.analysis[...] (stale on later config change)
```
- Header status: `● Up to date · 3 ms` / `○ Updating…` / `⚠ Engine error` (with message).

### 7.7 Visual style (minimal)
- White background, `neutral-900` text, `neutral-500` secondary text, **one accent colour** (e.g. blue-600) for active controls and eclipse highlights. Diagram colours only as small group dots.
- Inter (or the system UI font) at 14 px for controls. `tabular-nums` for all numbers. Units in muted text after each value.
- No shadows or gradients: 1 px `neutral-200` borders, 8 px radius. Generous spacing, one column of controls.
- Dark mode is optional (Tailwind `dark:` classes). Charts and 3D use theme tokens.

---

## 8. Page 2: Model & assumptions (`/model`)

### 8.1 What the code blocks are
Page 2 shows **simplified Python-style example code**, one snippet per key function. It is written to read like the Python file each diagram block would be (`environment.py`, `power_used.py`, …), using numpy-style pseudocode. It is **explanatory content, not the running code**. The live simulator runs the TypeScript engine, which implements the same logic.

**Storage:** `src/content/modelSnippets.ts`
```ts
export interface ModelSnippet {
  order: number;
  block: "Inputs" | "Orbit & environment" | "Power gain" | "Power used"
       | "Energy balance & battery" | "Design loops" | "Outputs";
  file: string;          // the notional Python file, e.g. "power_used.py"
  name: string;          // e.g. "torquer_power"
  mirrors: string;       // TS engine function it corresponds to, e.g. "powerUsed.torquerPower"
  summary: string;       // one line
  formula?: string;      // e.g. "t_on = ΔH ÷ |m × B| ; duty = t_on ÷ T_orbit"
  code: string;          // Python-style example (≤ ~25 lines)
}
```

**Example snippet** (what the card for #10 shows):
```python
# power_used.py
def torquer_power(env, cfg):
    """Torquer on-time from momentum demand and the local magnetic field."""
    # 1. Momentum build-up from solar radiation pressure (sunlit only)
    tau_d = P_SRP * cfg.srp_area * (1 + cfg.reflectivity) * cfg.cp_offset
    dH = tau_d * env.sunlit_time_per_orbit                    # N·m·s per orbit

    # 2. Torque the torquer can produce at each time step
    tau_avail = cfg.k_eff * cfg.dipole * env.b_mag            # N·m

    # 3. Switch on at the start of the allowed window until dH is dumped
    window = env.sunlit if cfg.dump_in_sunlight_only else all_steps
    on = first_steps_until(cumsum(tau_avail[window] * env.dt) >= dH)

    t_on = on.sum() * env.dt                                  # ≈ dH / |m × B|
    duty = t_on / env.period
    return cfg.driver_power * on, {"t_on": t_on, "duty": duty,
                                   "feasible": on.any_reached}
```

**Rendering:** `src/app/model/page.tsx` imports the snippets and highlights them as Python with **shiki** at build time (static, no highlighting JS shipped). Assumptions are imported from `src/engine/assumptions.ts`.

**Keeping snippets honest:**
- Each snippet's `mirrors` field names the real TS function. A vitest test checks that every `mirrors` target exists in `src/engine/`.
- Snippet formulas use the **same symbols** as the UI labels and assumptions list.
- When a formula changes in the engine, update the snippet in the same commit (add this to the README checklist).

### 8.2 Example functions (in diagram order)
| # | Block | Python-style snippet | Mirrors (TS) | What it shows |
|---|---|---|---|---|
| 1 | Inputs | `config.py → apply_case` | `applyCase` | BOL/EOL and worst-case overrides |
| 2 | Orbit & environment | `environment.py → orbit_and_sun_geometry` | `orbitAndSunGeometry` | T = 2π√(r³/μ), position, β-driven sun vector, cylindrical eclipse |
| 3 | Orbit & environment | `environment.py → magnetic_field` | `magneticField` | Dipole field falling off as 1/r³ |
| 4 | Orbit & environment | `environment.py → ground_contact` | `groundContact` | Elevation-mask visibility |
| 5 | Power gain | `power_gain.py → solar_array_power` | `solarArrayPower` | A·η·S·cos θ with η = cell × degradation × path |
| 6 | Power used | `power_used.py → payload_power` | `payloadPower` | Duty-cycle scheduling by satellite type |
| 7 | Power used | `power_used.py → adcs_power` | `adcsPower` | Constant duty ~1 |
| 8 | Power used | `power_used.py → comms_power` | `commsPower` | Tx only in ground-contact windows |
| 9 | Power used | `power_used.py → thermal_power` | `thermalPower` | Heater power in eclipse |
| 10 | Power used | `power_used.py → torquer_power` | `torquerPower` | ΔH from SRP, t_on = ΔH ÷ \|m×B\|, duty = t_on ÷ T |
| 11 | Power used | `power_used.py → cryocooler_power` | `cryocoolerPower` | Always-on vs on-demand pre-cool, auto choose |
| 12 | Energy balance & battery | `battery.py → simulate_battery` | `simulateBattery` | SoC update loop, charge/discharge η, load shedding |
| 13 | Energy balance & battery | `battery.py → depth_of_discharge` | `depthOfDischarge` | DoD = 1 − SoC_min, sustainability check |
| 14 | Design loops | `design_loops.py → sizing_loop` | `sizingLoop` | Bisection for smallest array + battery |
| 15 | Outputs | `outputs.py → margins`, `monte_carlo` | `margins`, `monteCarlo` | Margins and uncertainty |

A short **pipeline snippet** (`pipeline.py → run_scenario`) sits at the top of the page, showing the order in which the blocks are called. It mirrors the diagram.

**Page layout:** left table of contents (Pipeline · Functions · Assumptions). Each function card has: title, diagram-block tag, notional Python file name, a one-line explanation, the formula, then the code block. A small note at the top of the page says: *"Simplified Python-style examples of each block. The live simulator runs an equivalent TypeScript engine."*

### 8.3 Assumptions list (`src/engine/assumptions.ts`)
```ts
export interface Assumption {
  id: string; group: "Orbit" | "Eclipse & sun" | "Magnetic field & ground" | "Power gain"
                   | "Power used" | "Battery & rules" | "Design loops & numerics";
  text: string; origin: "user-note" | "simplification" | "placeholder" | "standard";
  params?: string[];            // config paths it relates to (links to controls)
}
```
The page groups the entries, with a small origin tag. Each can link to the related control.

**Orbit**
- Circular orbits only. Period `T = 2π·√(r³/μ)` *(user note)*
- Two-body motion: no J2, drift or manoeuvres. RAAN fixed at 0.
- β angle is **set directly** and held constant for the run (in reality it changes slowly, over days). The sun direction isn't tied to a calendar date, so some β/inclination combinations aren't physically reachable (UI hint).

**Eclipse & sun**
- β decides whether there is an eclipse and how long it lasts (`|β| < β* = asin(R_E/r)`) *(user note)*
- Cylindrical Earth shadow: no penumbra, no lunar eclipses.
- `S = 1361 W/m²`, ±3.3% per year via the flux case *(user note)*. No other solar variability, no Earth albedo or IR on the arrays.

**Magnetic field & ground**
- Centred, aligned dipole with quiet-time field. Storms and external currents are only represented by the field scale factor.
- Ground stations fixed. Earth rotation phase at t = 0 is arbitrary. Visible above the elevation mask.

**Power gain**
- η lumps cell efficiency, BOL→EOL degradation and path losses (regulator, harness) *(user note)*.
- Array output is zero in eclipse. No self-shadowing or temperature effect beyond η.

**Power used**
- Payload power depends heavily on satellite type. Presets are placeholders.
- ADCS mostly on (duty ≈ 1). Thermal heaters mostly on in eclipse.
- **Comms is satellite-to-ground only, no satellite-to-satellite links** *(user note)*. Tx only in contact windows.
- Torquer is used only for momentum dumping. Disturbance is SRP only (constant in sunlight). `t_on = ΔH ÷ |m×B|`, `duty = t_on ÷ T_orbit`. k_eff lumps the m ⟂ B geometry.
- **Cryocooler always-on vs off-and-pre-cooled is a design choice, depending on which is more efficient.** Both are modelled and can be compared *(user note)*. Cooler power is constant per mode (no radiator-temperature effect in the demo).
- Z01 figures (3,500 A·m², ~47 W peak, ~half average) come from press coverage. Cooler split is a placeholder.

**Battery & rules**
- One lumped battery, constant η, charge-rate limit, excess shunted. No temperature or ageing effect on capacity.
- DoD = 1 − SoC_min over the last simulated orbit (runs start at SoC₀ and cover N orbits).
- **Load shedding may apply when power is too low, and is togglable in the config** *(user note)*. Threshold + hysteresis, shed order payload → comms.

**Design loops & numerics**
- Sizing uses the worst-case config (β = 0, aphelion, EOL) and bisection.
- Fixed time step. Analyses use a coarser step (checked against the fine step in tests).
- Double-precision floats (JS `number`). No numerical integrator beyond the fixed-step SoC update.

---

## 9. Testing & verification

Follows [../Model_Verification_and_Validation.md](../Model_Verification_and_Validation.md).

| Test (vitest unless noted) | Check |
|---|---|
| Period | GPS altitude 20,180 km → T ≈ 11 h 58 min (±1 min) |
| Eclipse benchmarks | 500 km, β = 0 → ≈ 35.7 min. 20,200 km, β = 0 → ≈ 55 min. \|β\| > β* → 0 |
| Eclipse vs analytic | Simulated eclipse fraction matches `(1/π)·acos(√(h²+2R_E·h)/((R_E+h)·cos β))` within one time step |
| Magnetic field | \|B\| at the equator = B₀(R_E/r)³. At the pole = 2× that |
| Power gain | Hand calculation for default preset (437 W EOL) |
| Torquer | Doubling m halves t_on. Conventional 20 A·m² gives 175× longer t_on |
| Energy conservation | Every step: `ΔE = (P_in·η_c − P_out/η_d − shunt)·dt` to 1e-9 |
| Bounds | 0 ≤ SoC ≤ 1. Zero loads → never discharges. No eclipse → DoD ≈ 0 |
| Convergence | Halving dt changes DoD by < 0.5 percentage points |
| Cross-check | Orbit-average SMAD energy vs time-step sim within 3% |
| Sizing | Result satisfies its own constraints. A 5% smaller array fails them |
| Schema | Every schema field has label/unit/range metadata. Defaults pass `safeParse` |
| Model snippets | Every snippet's `mirrors` target exists in `src/engine/`. Orders are unique and cover all 7 blocks. |
| Performance | `runScenario(default)` < 20 ms in Node |
| E2E (Playwright) | Page loads. Moving the altitude slider changes the period KPI. Output picker adds/removes a chart. Model page lists ≥ 10 functions and the assumptions. |

Run with `npm test` (vitest) and `npm run test:e2e` (Playwright against the static build).

---

## 10. Build phases & milestones

| Phase | Work | Done when | Est. |
|---|---|---|---|
| **P0 Scaffold** | Next.js + TS + Tailwind + shadcn, `output: "export"`, vitest + Playwright config, folder structure, lint/format, README | `npm run dev` shows the empty layout. `npm test` runs. | 0.5 d |
| **P1 Engine core** | `constants`, `types`, `lib/vec`, `config` (zod + presets + `applyCase`), `environment`, `powerGain`, `powerUsed`, `battery`, `outputs` (plots/budget/dod/margins), `pipeline` | `runScenario(defaultConfig())` works in Node. P1 tests in §9 pass. | 2 d |
| **P2 Worker bridge** | `engine.worker.ts` + comlink, `engineClient` (latest-wins, fallback), `schemaFields` | UI can call the engine without blocking. Descriptors generated for every field. | 0.5 d |
| **P3 Controls** | ControlGroup from descriptors, slider + number sync, toggles/selects, validation, reset, presets, localStorage, debounce | Every config field editable. Invalid input blocked with a message. | 1.5 d |
| **P4 Outputs** | Output picker, KPI grid, time-series charts with eclipse shading + cursor, budget table, warnings | Default output selection renders and updates live. | 1.5 d |
| **P5 3D view** | Earth, orbit ring with eclipse arc, sun, shadow, satellite animation, stations, cursor sync | Changing altitude/inclination/β updates the 3D view correctly. | 1.5 d |
| **P6 Analyses** | `sizingLoop`, `heatmap`, `monteCarlo` + progress/cancel + UI cards | Each analysis runs in < 5 s, shows progress, marks stale. | 1.5 d |
| **P7 Model page** | Write `modelSnippets.ts` (pipeline + 15 Python-style examples), `assumptions.ts`, `/model` page with shiki | All example functions + assumptions listed. Snippet `mirrors` test passes. | 0.5–1 d |
| **P8 Polish & V&V** | Full test suite, performance check, responsive layout, empty/error states, static build + deploy, demo script | `npm test` and e2e green. Static build deployed. Demo rehearsed. | 1 d |

**Total ≈ 10.5 days.** **If time is short**, build P0–P5 with P7's assumptions list, and do sizing and Monte Carlo last.

---

## 11. Dev setup & commands

```bash
cd simulator_demo
npm install
npm run dev
npm test
npm run build
```

`package.json` scripts:
```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "npx serve out",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "npm run build && playwright test",
    "lint": "next lint && tsc --noEmit"
  }
}
```

- `npm run build` writes a static site to `out/`, which any static host can serve (Vercel, Netlify, GitHub Pages).
- **Node:** v24 is installed. **Python is not needed**: the Python on Page 2 is example code only.
- Main dependencies: `next`, `react`, `react-dom`, `zod`, `zustand`, `comlink`, `recharts`, `three`, `@react-three/fiber`, `@react-three/drei`, `shiki`, `typescript`, `tailwindcss`. Dev: `vitest`, `@playwright/test`.

---

## 12. Risks & open questions

| Risk / question | Mitigation / decision needed |
|---|---|
| Some β values aren't physically reachable for an inclination | Show the reachable range as a hint. Allow anyway, with a warning. |
| Cryocooler and coil thermal numbers are placeholders | Labelled "placeholder" in UI and assumptions. Flight data from Zenno would replace them. |
| Heatmap / Monte Carlo slow on large grids | Run in the worker. Cap resolution (25×25) and N (500). Coarse dt. Progress + cancel. |
| Next.js / Turbopack worker bundling quirks | Use the standard `new Worker(new URL("../workers/engine.worker.ts", import.meta.url), { type: "module" })` pattern. Fall back to main-thread calls if it fails. |
| Page 2 examples drifting from the engine | Snippets are illustrative. The `mirrors` test catches renamed or deleted functions, and formula changes are updated in the same commit. |
| No numpy: vector maths written by hand | Small, tested `lib/vec.ts`. Unit tests cover every formula. |
| Scope creep | Stretch goals below are explicitly out of the core plan. |

---

## 13. Stretch goals
1. **Zenno-internal mode** (diagram 2): toggle "Lumped host load" to replace payload/ADCS/comms/thermal with `P_sun` / `P_eclipse`, and add a "with vs without Z01" DoD comparison.
2. IGRF field model (TS port of the spherical-harmonic sum). Date-driven sun geometry (β varies over a year → eclipse seasons chart).
3. Radiator-temperature-dependent cryocooler power and a coil thermal state (warm-up/cool-down).
4. Propellant trade card: Z01 energy vs thruster propellant saved over the mission.
5. Shareable URL (config encoded in the URL hash). Export results as CSV/JSON.
6. Offline PWA (the static build already works without a server).

---

## 14. Interview demo script (≈ 2 min)
1. **Default GNSS-altitude case, worst case on:** point out the 55 min eclipse, the ~49% DoD, and the orbit ring's eclipse arc in 3D.
2. **Drag altitude down to O3b (8,062 km):** period, eclipse and |B| change, and the torquer t_on drops a lot. Mention the "conventional torquer" comparison KPI.
3. **Toggle the cryocooler always-on ↔ on-demand:** show the Wh/orbit comparison (~240 vs ~22 Wh). This is the Zenno design trade.
4. **Turn on load shedding and shrink the battery:** SoC hits the threshold, the payload is shed, the chart shows it.
5. **Run the sizing loop** for the smallest array and battery, then a **Monte Carlo** for the P95 DoD.
6. **Open the Model page:** "every number traces to one of these functions and one of these assumptions."
