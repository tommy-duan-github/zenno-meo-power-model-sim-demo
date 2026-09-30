import type { ScenarioConfig } from './config';
import type { BatteryResult, Environment, LoadSet, Subsystem } from './types';
import { SUBSYSTEMS } from './types';
function applyLoadShedding(soc:number,shed:boolean,cfg:ScenarioConfig){if(!cfg.rules.loadShedding)return false;if(!shed&&soc<cfg.rules.shedThreshold)return true;if(shed&&soc>cfg.rules.shedThreshold+cfg.rules.shedHysteresis)return false;return shed;}
export function simulateBattery(pGen:Float64Array,loads:LoadSet,env:Environment,cfg:ScenarioConfig):BatteryResult{
  const n=env.t.length,c=cfg.battery,C=c.capacityWh,soc=new Float64Array(n),shed=new Uint8Array(n),shuntedW=new Float64Array(n),actual={} as Record<Subsystem,Float64Array>;
  for(const key of SUBSYSTEMS)actual[key]=new Float64Array(n);
  let energy=c.soc0*C,depleted=false,shedOn=false;
  for(let k=0;k<n;k++){
    shedOn=applyLoadShedding(energy/C,shedOn,cfg);shed[k]=shedOn?1:0;
    let pLoad=0;
    for(const key of SUBSYSTEMS){let p=loads.requested[key][k];if(shedOn){if(key==='payload')p=Math.min(p,cfg.used.payload.standbyW);if(key==='comms')p=0;}actual[key][k]=p;pLoad+=p;}
    const pNet=pGen[k]-pLoad;
    if(pNet>=0){const accepted=Math.min(pNet,c.maxChargeC*C);energy+=accepted*c.etaCharge*env.dt/3600;shuntedW[k]=pNet-accepted;if(energy>C){shuntedW[k]+=(energy-C)*3600/(c.etaCharge*env.dt);energy=C;}}
    else energy+=pNet/c.etaDischarge*env.dt/3600;
    if(energy<=0){energy=0;depleted=true;}soc[k]=energy/C;
  }
  return {soc,actual,shed,shuntedW,depleted};
}
export function depthOfDischarge(soc:Float64Array,env:Environment):{dod:number;sustainable:boolean}{
  const steps=Math.round(env.period/env.dt),start=Math.max(0,soc.length-steps);let min=1;
  for(let k=start;k<soc.length;k++)min=Math.min(min,soc[k]);
  const previous=soc[Math.max(0,start-1)],last=soc[soc.length-1];
  return {dod:1-min,sustainable:start===0||last>=previous-0.002};
}
