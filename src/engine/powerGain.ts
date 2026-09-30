import type { ScenarioConfig } from './config';
import type { Environment } from './types';
import { SOLAR_FLUX } from './constants';
export function solarArrayPower(env:Environment,cfg:ScenarioConfig):Float64Array {
  const p=new Float64Array(env.t.length),coefficient=cfg.gain.area*cfg.gain.etaCell*(cfg.sim.case==='EOL'?cfg.gain.eolFactor:1)*cfg.gain.etaPath*SOLAR_FLUX[cfg.environment.fluxCase as keyof typeof SOLAR_FLUX];
  for(let k=0;k<p.length;k++)p[k]=coefficient*env.cosSun[k];
  return p;
}
