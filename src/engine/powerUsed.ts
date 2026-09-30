import type { ScenarioConfig } from './config';
import type { Environment } from './types';
import { C_LIGHT, SOLAR_FLUX } from './constants';
const zeros=(n:number)=>new Float64Array(n);
export function payloadPower(env:Environment,cfg:ScenarioConfig):Float64Array {
  const p=zeros(env.t.length),c=cfg.used.payload;if(!c.enabled)return p;
  const duty=c.duty;
  for(let k=0;k<p.length;k++){
    const phase=(env.t[k]%env.period)/env.period;
    const active=c.schedule==='continuous'?phase<duty:c.schedule==='sunlitOnly'?!env.inEclipse[k] && phase<duty:c.schedule==='evenlySpread'?(phase*8%1)<duty:false;
    p[k]=active?c.onW:c.standbyW;
  }
  return p;
}
export function adcsPower(env:Environment,cfg:ScenarioConfig):Float64Array { const c=cfg.used.adcs,p=zeros(env.t.length);if(c.enabled)p.fill(c.powerW*c.duty);return p; }
export function commsPower(env:Environment,cfg:ScenarioConfig):Float64Array { const c=cfg.used.comms,p=zeros(env.t.length);if(c.enabled)for(let k=0;k<p.length;k++)p[k]=env.contact[k]?c.txW:c.standbyW;return p; }
export function thermalPower(env:Environment,cfg:ScenarioConfig):Float64Array { const c=cfg.used.thermal,p=zeros(env.t.length);if(c.enabled)for(let k=0;k<p.length;k++)p[k]=env.inEclipse[k]?c.eclipseW:c.sunW;return p; }
function dumpSchedule(env:Environment,cfg:ScenarioConfig,dipole:number,dH:number):{on:Uint8Array;tOn:number;feasible:boolean}{
  const n=env.t.length,steps=Math.floor(n/cfg.sim.nOrbits),on=new Uint8Array(n);let firstOn=0,feasible=true;
  for(let orbit=0;orbit<cfg.sim.nOrbits;orbit++){
    const start=orbit*steps,end=orbit===cfg.sim.nOrbits-1?n:Math.min(n,start+steps);
    let exit=start;for(let k=start+1;k<end;k++)if(env.inEclipse[k-1]&&!env.inEclipse[k]){exit=k;break;}
    let delivered=0;
    for(let j=0;j<end-start && delivered<dH;j++){
      const k=start+(exit-start+j)%(end-start);
      if(cfg.rules.dumpInSunlightOnly&&env.inEclipse[k])continue;
      const impulse=cfg.used.torquer.kEff*dipole*env.bMag[k]*env.dt;
      if(impulse>0){on[k]=1;delivered+=impulse;}
    }
    if(delivered+1e-12<dH)feasible=false;
    if(orbit===cfg.sim.nOrbits-1)for(let k=start;k<end;k++)firstOn+=on[k];
  }
  return {on,tOn:firstOn*env.dt,feasible};
}
export function torquerPower(env:Environment,cfg:ScenarioConfig){
  const p=zeros(env.t.length),c=cfg.used.torquer,empty=new Uint8Array(env.t.length);
  if(!c.enabled)return {power:p,on:empty,tOn:0,duty:0,feasible:true,conventionalTOn:0,dH:0,peakTorque:0,disturbanceTorque:0};
  const disturbanceTorque=SOLAR_FLUX[cfg.environment.fluxCase as keyof typeof SOLAR_FLUX]/C_LIGHT*c.srpAreaM2*(1+c.reflectivity)*c.cpOffsetM;
  let sunlit=0;for(let k=0;k<env.t.length;k++)if(!env.inEclipse[k])sunlit++;
  const dH=c.dHManual>0?c.dHManual:disturbanceTorque*sunlit*env.dt/cfg.sim.nOrbits;
  const schedule=dumpSchedule(env,cfg,c.dipoleAm2,dH),conventional=dumpSchedule(env,cfg,20,dH);
  for(let k=0;k<p.length;k++)if(schedule.on[k])p[k]=c.driverW;
  let peakTorque=0;for(const b of env.bMag)peakTorque=Math.max(peakTorque,c.kEff*c.dipoleAm2*b);
  return {power:p,on:schedule.on,tOn:schedule.tOn,duty:schedule.tOn/env.period,feasible:schedule.feasible,conventionalTOn:conventional.tOn,dH,peakTorque,disturbanceTorque};
}
export function cryocoolerPower(env:Environment,torquerOn:Uint8Array,cfg:ScenarioConfig){
  const c=cfg.used.cooler,n=env.t.length,always=zeros(n),demand=zeros(n),coolerOn=new Uint8Array(n);
  if(!c.enabled)return {power:always,on:coolerOn,whAlways:0,whDemand:0,modeUsed:c.mode};
  always.fill(c.steadyW);demand.fill(c.idleW);
  const preSteps=Math.ceil(c.precoolMin*60/env.dt),steps=Math.floor(n/cfg.sim.nOrbits);
  for(let orbit=0;orbit<cfg.sim.nOrbits;orbit++){
    const start=orbit*steps,end=orbit===cfg.sim.nOrbits-1?n:Math.min(n,start+steps);
    let previous=false;
    for(let k=start;k<end;k++){
      if(torquerOn[k]&&!previous)for(let j=1;j<=preSteps;j++){const index=start+(k-start-j+end-start)%(end-start);demand[index]=Math.max(demand[index],c.cooldownW);}
      previous=!!torquerOn[k];
      if(torquerOn[k])demand[k]=c.steadyW;
    }
    if(c.offInEclipse){
      let exit=-1;for(let k=start;k<end;k++){if(env.inEclipse[k])always[k]=c.idleW;if(k>start&&env.inEclipse[k-1]&&!env.inEclipse[k])exit=k;}
      if(exit>=0)for(let k=exit;k<Math.min(end,exit+preSteps);k++)always[k]=c.cooldownW;
    }
  }
  const lastStart=Math.floor((cfg.sim.nOrbits-1)*n/cfg.sim.nOrbits);
  let whAlways=0,whDemand=0;for(let k=lastStart;k<n;k++){whAlways+=always[k]*env.dt/3600;whDemand+=demand[k]*env.dt/3600;}
  const modeUsed=c.mode==='auto'?(whDemand<whAlways?'onDemand':'alwaysOn'):c.mode;
  const power=modeUsed==='onDemand'?demand:always;
  for(let k=0;k<n;k++)coolerOn[k]=power[k]>c.idleW?1:0;
  return {power,on:coolerOn,whAlways,whDemand,modeUsed};
}
