import type { ScenarioConfig } from './config';
import { runScenario } from './pipeline';
export interface SizingResult { aMin:number;cMin:number;check:ReturnType<typeof runScenario>['kpis'];log:{stage:string;iteration:number;area:number;capacity:number;dod:number;margin:number;pass:boolean}[];feasible:boolean; }
export function sizingLoop(input:ScenarioConfig,onProgress?:(p:number)=>void):SizingResult {
  const cfg=structuredClone(input);cfg.sim.worstCase=true;cfg.sim.dt=cfg.sim.analysisDt;cfg.sim.nOrbits=3;cfg.rules.loadShedding=false;
  const log:SizingResult['log']=[];let low=cfg.design.arrayMin,high=cfg.design.arrayMax;
  cfg.battery.capacityWh=Math.max(input.battery.capacityWh,10000);
  let top=runScenario({...cfg,gain:{...cfg.gain,area:high}});
  if(top.kpis.energyMarginPct<cfg.design.marginTarget*100){return {aMin:high,cMin:cfg.battery.capacityWh,check:top.kpis,log,feasible:false};}
  for(let i=0;i<16;i++){
    const area=(low+high)/2,r=runScenario({...cfg,gain:{...cfg.gain,area}}),pass=r.kpis.energyMarginPct>=cfg.design.marginTarget*100;
    log.push({stage:'array',iteration:i+1,area,capacity:cfg.battery.capacityWh,dod:r.kpis.dod,margin:r.kpis.energyMarginPct,pass});
    if(pass)high=area;else low=area;onProgress?.(0.55*(i+1)/16);
  }
  // Add a small margin for the finite time-step boundary in the bisection result.
  const aMin=Math.min(cfg.design.arrayMax,high*1.002);cfg.gain.area=aMin;
  let cLow=10,cHigh=50000;
  for(let i=0;i<16;i++){
    const capacity=(cLow+cHigh)/2,r=runScenario({...cfg,battery:{...cfg.battery,capacityWh:capacity}});
    const pass=r.kpis.dod<=cfg.battery.dodLimit&&!r.warnings.some(w=>w.includes('depleted'));
    log.push({stage:'battery',iteration:i+1,area:aMin,capacity,dod:r.kpis.dod,margin:r.kpis.energyMarginPct,pass});
    if(pass)cHigh=capacity;else cLow=capacity;onProgress?.(0.55+0.45*(i+1)/16);
  }
  const cMin=Math.ceil(cHigh*1.02),check=runScenario({...cfg,battery:{...cfg.battery,capacityWh:cMin}}).kpis;
  return {aMin,cMin,check,log,feasible:check.dodPass&&check.energyMarginPct>=cfg.design.marginTarget*100};
}
