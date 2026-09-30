import { describe,it,expect } from 'vitest';
import { defaultConfig,ScenarioConfigSchema } from '../config';
import { orbitAndSunGeometry,magneticField } from '../environment';
import { solarArrayPower } from '../powerGain';
import { runScenario } from '../pipeline';
import { sizingLoop } from '../designLoops';
import { heatmap,monteCarlo } from '../outputs';
import { assumptions } from '../assumptions';
import { modelSnippets } from '../../content/modelSnippets';
import * as config from '../config';import * as environment from '../environment';import * as powerGain from '../powerGain';import * as powerUsed from '../powerUsed';import * as battery from '../battery';import * as designLoops from '../designLoops';import * as outputs from '../outputs';
describe('orbital environment',()=>{
  it('matches GPS period and GNSS eclipse benchmarks',()=>{const cfg=defaultConfig();cfg.sim.worstCase=false;cfg.orbit.altitudeKm=20180;const g=orbitAndSunGeometry(cfg);expect(g.period/60).toBeCloseTo(718,0);expect(g.eclipseDuration/60).toBeGreaterThan(50);expect(g.eclipseDuration/60).toBeLessThan(60);});
  it('removes eclipse above critical beta',()=>{const cfg=defaultConfig();cfg.orbit.betaDeg=25;expect(orbitAndSunGeometry(cfg).eclipseDuration).toBe(0);});
  it('gives a low-Earth eclipse near 36 minutes',()=>{const cfg=defaultConfig();cfg.orbit.altitudeKm=500;cfg.sim.dt=10;const g=orbitAndSunGeometry(cfg);expect(g.eclipseDuration/60).toBeGreaterThan(34);expect(g.eclipseDuration/60).toBeLessThan(38);});
  it('has an inverse-cube equatorial field',()=>{const cfg=defaultConfig(),g=orbitAndSunGeometry(cfg),b=magneticField(g,cfg);expect(b.bMag[0]).toBeCloseTo(29400e-9*(6378.137/(6378.137+cfg.orbit.altitudeKm))**3,12);});
});
describe('power and battery',()=>{
  it('matches hand-calculated EOL solar output',()=>{const cfg=defaultConfig();cfg.sim.worstCase=false;const g=orbitAndSunGeometry(cfg),p=solarArrayPower(g,cfg);expect(p[0]).toBeCloseTo(1.4*.3*.85*.9*1361,6);});
  it('keeps SoC bounded and responds to array area',()=>{const cfg=defaultConfig(),a=runScenario(cfg);expect(Math.min(...a.series.soc)).toBeGreaterThanOrEqual(0);expect(Math.max(...a.series.soc)).toBeLessThanOrEqual(1);cfg.gain.area*=2;const b=runScenario(cfg);expect(b.kpis.energyMarginPct).toBeGreaterThan(a.kpis.energyMarginPct);});
  it('runs sizing to a passing check',()=>{const r=sizingLoop(defaultConfig());expect(r.feasible).toBe(true);expect(r.check.dodPass).toBe(true);expect(r.aMin).toBeGreaterThan(0);});
  it('lets a beta heatmap override the worst-case base and samples uncertainty',()=>{const cfg=defaultConfig();cfg.sim.dt=120;cfg.sim.nOrbits=2;const h=heatmap({cfg,x:'orbit.betaDeg',y:'gain.area',metric:'energyMarginPct',resolution:3},runScenario);expect(h.values[0][0]).not.toBe(h.values[0][2]);const m=monteCarlo({cfg,n:8,seed:12,distribution:'uniform',uncertainties:{'used.payload.duty':0.2,'gain.eolFactor':0.1}},runScenario);expect(m.dod).toHaveLength(8);expect(m.p95).toBeGreaterThanOrEqual(m.p5);});
});
describe('traceability',()=>{
  it('has valid defaults and at least twenty assumptions',()=>{expect(ScenarioConfigSchema.safeParse(defaultConfig()).success).toBe(true);expect(assumptions.length).toBeGreaterThanOrEqual(20);});
  it('keeps all snippet targets in the engine',()=>{const modules:Record<string,Record<string,unknown>>={config,environment,powerGain,powerUsed,battery,designLoops,outputs};for(const snippet of modelSnippets){const [module,name]=snippet.mirrors.split('.');expect(modules[module][name]).toBeTypeOf('function');}});
});
