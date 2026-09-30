'use client';
import { wrap,proxy,type Remote } from 'comlink';
import type { ScenarioConfig } from '../engine/config';
import type { SimResult } from '../engine/types';
import type { EngineApi } from '../workers/engine.worker';
import type { HeatmapRequest, MonteCarloRequest } from '../engine/outputs';
import { runScenario } from '../engine/pipeline';
import { sizingLoop } from '../engine/designLoops';
import { heatmap,monteCarlo } from '../engine/outputs';
let worker:Worker|null=null,remote:Remote<EngineApi>|null=null,scenarioId=0;
function api(){if(remote)return remote;try{worker=new Worker(new URL('../workers/engine.worker.ts',import.meta.url),{type:'module'});remote=wrap<EngineApi>(worker);return remote;}catch{return null;}}
export function restartAnalysisWorker(){worker?.terminate();worker=null;remote=null;scenarioId++;}
export async function calculate(cfg:ScenarioConfig):Promise<SimResult|null>{const id=++scenarioId;let result:SimResult;try{result=api()?await api()!.runScenario(cfg):runScenario(cfg);}catch{restartAnalysisWorker();result=runScenario(cfg);}return id===scenarioId?result:null;}
export async function runSizing(cfg:ScenarioConfig,progress:(v:number)=>void){const a=api();return a?await a.runSizing(cfg,proxy(progress)):sizingLoop(cfg,progress);}
export async function runHeatmap(req:HeatmapRequest,progress:(v:number)=>void){const a=api();return a?await a.runHeatmap(req,proxy(progress)):heatmap(req,runScenario,progress);}
export async function runMonteCarlo(req:MonteCarloRequest,progress:(v:number)=>void){const a=api();return a?await a.runMonteCarlo(req,proxy(progress)):monteCarlo(req,runScenario,progress);}
