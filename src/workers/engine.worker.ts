import { expose } from 'comlink';
import { runScenario } from '../engine/pipeline';
import { sizingLoop } from '../engine/designLoops';
import { heatmap,monteCarlo,type HeatmapRequest,type MonteCarloRequest } from '../engine/outputs';
import type { ScenarioConfig } from '../engine/config';
const analysisConfig=(cfg:ScenarioConfig)=>({...cfg,sim:{...cfg.sim,nOrbits:2,dt:cfg.sim.analysisDt}});
const api={
  runScenario,
  runSizing:(cfg:ScenarioConfig,progress?:(p:number)=>void)=>sizingLoop(cfg,progress),
  runHeatmap:(req:HeatmapRequest,progress?:(p:number)=>void)=>heatmap({...req,cfg:analysisConfig(req.cfg)},runScenario,progress),
  runMonteCarlo:(req:MonteCarloRequest,progress?:(p:number)=>void)=>monteCarlo({...req,cfg:analysisConfig(req.cfg)},runScenario,progress)
};
expose(api);
export type EngineApi=typeof api;
