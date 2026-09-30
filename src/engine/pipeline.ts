import { applyCase, ScenarioConfigSchema, type ScenarioConfig } from './config';
import { orbitAndSunGeometry, magneticField, groundContact } from './environment';
import { solarArrayPower } from './powerGain';
import { payloadPower, adcsPower, commsPower, thermalPower, torquerPower, cryocoolerPower } from './powerUsed';
import { simulateBattery } from './battery';
import { plots,powerBudgetTable,worstCaseDod,margins } from './outputs';
import { OMEGA_EARTH, R_EARTH, STATIONS } from './constants';
import type { Geometry, LoadSet, SimResult, Vec3 } from './types';
export function runScenario(input:ScenarioConfig):SimResult{
  const begin=performance.now(),cfg=applyCase(ScenarioConfigSchema.parse(input));
  const env=orbitAndSunGeometry(cfg);Object.assign(env,magneticField(env,cfg),groundContact(env,cfg));
  const pGen=solarArrayPower(env,cfg),torq=torquerPower(env,cfg),cooler=cryocoolerPower(env,torq.on,cfg);
  const load:LoadSet={requested:{payload:payloadPower(env,cfg),adcs:adcsPower(env,cfg),comms:commsPower(env,cfg),thermal:thermalPower(env,cfg),torquer:torq.power,cryocooler:cooler.power},torquerOn:torq.on,coolerOn:cooler.on,info:{tOn:torq.tOn,duty:torq.duty,feasible:torq.feasible,conventionalTOn:torq.conventionalTOn,coolerWhAlwaysOn:cooler.whAlways,coolerWhOnDemand:cooler.whDemand,coolerModeUsed:cooler.modeUsed,dH:torq.dH,peakTorque:torq.peakTorque,disturbanceTorque:torq.disturbanceTorque}};
  const batt=simulateBattery(pGen,load,env,cfg),series=plots(env,pGen,load,batt),budget=powerBudgetTable(env,load,batt);
  const ring:Vec3[]=[],ringEclipse:boolean[]=[],r=R_EARTH+cfg.orbit.altitudeKm,inc=cfg.orbit.inclinationDeg*Math.PI/180;
  for(let j=0;j<=240;j++){const u=2*Math.PI*j/240,x=Math.cos(u),y=Math.sin(u)*Math.cos(inc),z=Math.sin(u)*Math.sin(inc),dot=x*env.sunHat[0]+y*env.sunHat[1]+z*env.sunHat[2];ring.push([r/R_EARTH*x,r/R_EARTH*y,r/R_EARTH*z]);ringEclipse.push(dot<0&&r*r*(1-dot*dot)<R_EARTH*R_EARTH);}
  const stations=STATIONS.map((s,j)=>{const lat=s.latDeg*Math.PI/180,lon=s.lonDeg*Math.PI/180;return {name:s.name,ecefRe:[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)] as Vec3,visible:Array.from(env.stationVisible[j],Boolean)};});
  const geometry:Geometry={rOrbitRe:r/R_EARTH,incDeg:cfg.orbit.inclinationDeg,betaDeg:cfg.orbit.betaDeg,sunHat:env.sunHat,orbitRing:ring,ringEclipse,satTrack:ring,stations};
  const warnings:string[]=[];if(!torq.feasible)warnings.push('Insufficient magnetic authority: momentum is not fully dumped in the allowed window.');
  if(batt.depleted)warnings.push('Battery depleted during the run.');
  if(!cfg.sim.worstCase&&Math.abs(cfg.orbit.betaDeg)>cfg.orbit.inclinationDeg+23.44)warnings.push('This beta angle may not be physically reachable at the chosen inclination.');
  const kpis={...margins(env,pGen,load,batt,cfg),...worstCaseDod(env,batt,cfg)};
  if(!kpis.sustainable)warnings.push('State of charge is still falling between the last two orbits.');
  if(cfg.sim.worstCase)warnings.push('Worst case applies beta = 0°, aphelion flux, EOL array and storm field scale.');
  return {kpis,series,budget,geometry,warnings,meta:{nSteps:env.t.length,dtS:env.dt,runtimeMs:performance.now()-begin,engineVersion:'0.1.0'}};
}
