import { applyCase,type ScenarioConfig } from './config';
import type { BatteryResult, BudgetRow, Environment, Kpis, LoadSet, Series, SimResult, Subsystem } from './types';
import { SUBSYSTEMS } from './types';
const last=(env:Environment)=>Math.max(0,env.t.length-Math.round(env.period/env.dt));
export function plots(env:Environment,pGen:Float64Array,load:LoadSet,batt:BatteryResult):Series{
  const s:Series={tH:[],soc:[],pGen:[],pLoad:[],loads:{} as Record<Subsystem,number[]>,eclipse:[],contact:[],bNT:[],tauAvail:[],torquerOn:[],coolerOn:[],shed:[]};
  for(const key of SUBSYSTEMS)s.loads[key]=[];
  const every=Math.max(1,Math.ceil(env.t.length/900));
  let maxB=0;for(const b of env.bMag)if(b>maxB)maxB=b;
  for(let k=0;k<env.t.length;k++){
    if(k%every!==0&&k!==env.t.length-1&&env.inEclipse[k]===env.inEclipse[k-1]&&env.contact[k]===env.contact[k-1]&&load.torquerOn[k]===load.torquerOn[k-1])continue;
    s.tH.push(env.t[k]/3600);s.soc.push(batt.soc[k]);s.pGen.push(pGen[k]);
    let total=0;for(const key of SUBSYSTEMS){const p=batt.actual[key][k];s.loads[key].push(p);total+=p;}s.pLoad.push(total);
    s.eclipse.push(env.inEclipse[k]);s.contact.push(env.contact[k]);s.bNT.push(env.bMag[k]*1e9);s.tauAvail.push(env.bMag[k]*load.info.peakTorque/(maxB||1));s.torquerOn.push(load.torquerOn[k]);s.coolerOn.push(load.coolerOn[k]);s.shed.push(batt.shed[k]);
  }
  return s;
}
export function powerBudgetTable(env:Environment,load:LoadSet,batt:BatteryResult):BudgetRow[]{
  const start=last(env),n=env.t.length-start;let totalWh=0;const partial=SUBSYSTEMS.map(subsystem=>{
    const a=batt.actual[subsystem];let sum=0,peakW=0,sunSum=0,eclSum=0,sunN=0,eclN=0;
    for(let k=start;k<a.length;k++){const v=a[k];sum+=v;peakW=Math.max(peakW,v);if(env.inEclipse[k]){eclSum+=v;eclN++;}else{sunSum+=v;sunN++;}}
    const whOrbit=sum*env.dt/3600;totalWh+=whOrbit;
    return {subsystem,avgW:sum/n,peakW,sunW:sunSum/(sunN||1),eclipseW:eclSum/(eclN||1),whOrbit,sharePct:0};
  });
  return partial.map(row=>({...row,sharePct:totalWh?100*row.whOrbit/totalWh:0}));
}
export function worstCaseDod(env:Environment,batt:BatteryResult,cfg:ScenarioConfig){
  const start=last(env);let min=1;for(let k=start;k<batt.soc.length;k++)min=Math.min(min,batt.soc[k]);
  const dod=1-min;return {dod,dodLimit:cfg.battery.dodLimit,dodPass:dod<=cfg.battery.dodLimit&&!batt.depleted};
}
export function margins(env:Environment,pGen:Float64Array,load:LoadSet,batt:BatteryResult,cfg:ScenarioConfig):Omit<Kpis,'dod'|'dodLimit'|'dodPass'>{
  const start=last(env),n=env.t.length-start;let gen=0,used=0,peakLoadW=0,contact=0,shed=0,sunGen=0,sunN=0;
  for(let k=start;k<env.t.length;k++){
    gen+=pGen[k];let p=0;for(const key of SUBSYSTEMS)p+=batt.actual[key][k];used+=p;peakLoadW=Math.max(peakLoadW,p);
    contact+=env.contact[k];shed+=batt.shed[k];if(!env.inEclipse[k]){sunGen+=pGen[k];sunN++;}
  }
  const z01=load.requested.torquer.reduce((a,b)=>a+b,0)+load.requested.cryocooler.reduce((a,b)=>a+b,0);
  const lastSoc=batt.soc[batt.soc.length-1],prevSoc=batt.soc[Math.max(0,start-1)];
  return {periodH:env.period/3600,eclipseMin:env.eclipseDuration/60,eclipseFrac:env.eclipseDuration/env.period,betaStarDeg:env.betaStar*180/Math.PI,pGenSunlitW:sunGen/(sunN||1),avgGenW:gen/n,avgLoadW:used/n,peakLoadW,energyMarginPct:used?100*(gen-used)/used:0,sustainable:start===0||lastSoc>=prevSoc-0.002,torquerTOnS:load.info.tOn,torquerDuty:load.info.duty,torquerFeasible:load.info.feasible,conventionalTOnS:load.info.conventionalTOn,coolerWhAlwaysOn:load.info.coolerWhAlwaysOn,coolerWhOnDemand:load.info.coolerWhOnDemand,coolerModeUsed:load.info.coolerModeUsed,z01SharePct:used?100*z01/(env.t.length*used/n):0,contactHPerOrbit:contact*env.dt/3600,shedMin:shed*env.dt/60,peakTorqueNm:load.info.peakTorque,disturbanceTorqueNm:load.info.disturbanceTorque};
}
export interface HeatmapRequest { cfg:ScenarioConfig;x:string;y:string;metric:'dod'|'energyMarginPct'|'torquerTOnS';resolution:number; }
export interface HeatmapResult { xValues:number[];yValues:number[];values:number[][];metric:HeatmapRequest['metric'];x:string;y:string; }
export interface MonteCarloRequest { cfg:ScenarioConfig;n:number;seed:number;uncertainties:Record<string,number>;distribution:'uniform'|'normal'; }
export interface MonteCarloResult { dod:number[];margin:number[];p5:number;p50:number;p95:number;failureProbability:number;seed:number; }
export const SWEEP_FIELDS:Record<string,{min:number;max:number;label:string}>={
  'orbit.altitudeKm':{min:8000,max:30000,label:'Altitude (km)'},'orbit.betaDeg':{min:0,max:20,label:'Beta angle (°)'},'gain.area':{min:0.5,max:10,label:'Array area (m²)'},'battery.capacityWh':{min:200,max:5000,label:'Battery (Wh)'},'used.payload.duty':{min:0.1,max:1,label:'Payload duty'},'used.torquer.dipoleAm2':{min:500,max:5000,label:'Dipole (A·m²)'},'environment.fieldScale':{min:0.5,max:1.5,label:'Field scale'}
};
function setPath<T>(obj:T,path:string,value:number):T { const copy=structuredClone(obj);const parts=path.split('.');let node:Record<string,unknown>=copy as Record<string,unknown>;for(const p of parts.slice(0,-1))node=node[p] as Record<string,unknown>;node[parts.at(-1)!]=value;return copy; }
export function heatmap(req:HeatmapRequest,run:(c:ScenarioConfig)=>SimResult,onProgress?:(v:number)=>void):HeatmapResult {
  const resolution=Math.max(3,Math.min(25,Math.round(req.resolution))),ax=SWEEP_FIELDS[req.x],ay=SWEEP_FIELDS[req.y];if(!ax||!ay||req.x===req.y)throw Error('Choose two different sweep parameters.');
  const base=applyCase(req.cfg);base.sim.worstCase=false;
  const xValues=Array.from({length:resolution},(_,i)=>ax.min+(ax.max-ax.min)*i/(resolution-1)),yValues=Array.from({length:resolution},(_,i)=>ay.min+(ay.max-ay.min)*i/(resolution-1));
  const values=yValues.map((y,j)=>{const row=xValues.map(x=>run(setPath(setPath(base,req.x,x),req.y,y)).kpis[req.metric]);onProgress?.((j+1)/resolution);return row;});
  return {xValues,yValues,values,metric:req.metric,x:req.x,y:req.y};
}
function rng(seed:number){let s=seed>>>0;return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}
function quantile(sorted:number[],p:number){const i=(sorted.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]*(1-(i-lo))+sorted[hi]*(i-lo);}
export function monteCarlo(req:MonteCarloRequest,run:(c:ScenarioConfig)=>SimResult,onProgress?:(v:number)=>void):MonteCarloResult {
  const random=rng(req.seed),n=Math.max(1,Math.min(500,Math.round(req.n))),dod:number[]=[],margin:number[]=[];
  const base=applyCase(req.cfg);base.sim.worstCase=false;
  for(let i=0;i<n;i++){
    let cfg=structuredClone(base);
    for(const [path,fraction] of Object.entries(req.uncertainties)){
      if(!SWEEP_FIELDS[path]&&path!=='gain.eolFactor'&&path!=='used.cooler.steadyW')continue;
      const value=path.split('.').reduce((a,k)=>(a as Record<string,unknown>)[k],cfg as unknown) as number;
      const u=req.distribution==='normal'?Math.max(-1,Math.min(1,Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random())/2)):(2*random()-1);
      let sample=value*(1+fraction*u);if(path==='used.payload.duty')sample=Math.max(0,Math.min(1,sample));if(path==='gain.eolFactor')sample=Math.max(0.5,Math.min(1,sample));
      cfg=setPath(cfg,path,sample);
    }
    const k=run(cfg).kpis;dod.push(k.dod);margin.push(k.energyMarginPct);if(i%5===0||i===n-1)onProgress?.((i+1)/n);
  }
  dod.sort((a,b)=>a-b);return {dod,margin,p5:quantile(dod,0.05),p50:quantile(dod,0.5),p95:quantile(dod,0.95),failureProbability:dod.filter(v=>v>req.cfg.battery.dodLimit).length/n,seed:req.seed};
}
