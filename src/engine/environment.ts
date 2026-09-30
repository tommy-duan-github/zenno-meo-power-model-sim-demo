import type { ScenarioConfig } from './config';
import type { Environment, Vec3 } from './types';
import { B_EQUATOR, MU_EARTH, OMEGA_EARTH, R_EARTH, STATIONS } from './constants';
const rad=(d:number)=>d*Math.PI/180;
export function orbitAndSunGeometry(cfg:ScenarioConfig):Environment {
  const r=R_EARTH+cfg.orbit.altitudeKm, period=2*Math.PI*Math.sqrt(r**3/MU_EARTH);
  const n=Math.ceil(cfg.sim.nOrbits*period/cfg.sim.dt), dt=cfg.sim.nOrbits*period/n;
  const t=new Float64Array(n),rEci=new Float64Array(n*3),inEclipse=new Uint8Array(n),cosSun=new Float64Array(n);
  const i=rad(cfg.orbit.inclinationDeg), beta=rad(cfg.orbit.betaDeg), sunHat:Vec3=[Math.cos(beta),-Math.sin(beta)*Math.sin(i),Math.sin(beta)*Math.cos(i)];
  const betaStar=Math.asin(R_EARTH/r); let eclipseCount=0;
  for(let k=0;k<n;k++){
    t[k]=k*dt; const u=2*Math.PI*(t[k]%period)/period; const x=r*Math.cos(u),y=r*Math.sin(u)*Math.cos(i),z=r*Math.sin(u)*Math.sin(i);
    rEci[3*k]=x;rEci[3*k+1]=y;rEci[3*k+2]=z;
    const dot=x*sunHat[0]+y*sunHat[1]+z*sunHat[2];
    const eclipse=dot<0 && r*r-dot*dot<R_EARTH*R_EARTH;
    inEclipse[k]=eclipse?1:0;if(eclipse)eclipseCount++;
    cosSun[k]=eclipse?0:cfg.gain.tracking==='twoAxis'?1:cfg.gain.tracking==='oneAxis'?Math.max(0,Math.cos(beta)):Math.max(0,Math.cos(rad(cfg.gain.fixedAngleDeg)));
  }
  return {t,dt,period,rEci,sunHat,inEclipse,cosSun,bVec:new Float64Array(n*3),bMag:new Float64Array(n),contact:new Uint8Array(n),stationVisible:[],beta,betaStar,eclipseDuration:eclipseCount*dt/cfg.sim.nOrbits};
}
export function magneticField(env:Environment,cfg:ScenarioConfig):Pick<Environment,'bVec'|'bMag'>{
  const bVec=new Float64Array(env.t.length*3),bMag=new Float64Array(env.t.length),r=R_EARTH+cfg.orbit.altitudeKm,scale=-B_EQUATOR*(R_EARTH/r)**3*cfg.environment.fieldScale;
  for(let k=0;k<env.t.length;k++){
    const x=env.rEci[3*k]/r,y=env.rEci[3*k+1]/r,z=env.rEci[3*k+2]/r;
    const bx=scale*3*z*x,by=scale*3*z*y,bz=scale*(3*z*z-1);
    bVec[3*k]=bx;bVec[3*k+1]=by;bVec[3*k+2]=bz;bMag[k]=Math.hypot(bx,by,bz);
  }
  return {bVec,bMag};
}
export function groundContact(env:Environment,cfg:ScenarioConfig):Pick<Environment,'contact'|'stationVisible'>{
  const contact=new Uint8Array(env.t.length),stationVisible=STATIONS.map(()=>new Uint8Array(env.t.length));
  const enabled=[cfg.environment.awaruEnabled,cfg.environment.svalbardEnabled];
  for(let s=0;s<STATIONS.length;s++){
    if(!enabled[s])continue;
    const lat=rad(STATIONS[s].latDeg),lon=rad(STATIONS[s].lonDeg);
    for(let k=0;k<env.t.length;k++){
      const theta=lon+OMEGA_EARTH*env.t[k],nx=Math.cos(lat)*Math.cos(theta),ny=Math.cos(lat)*Math.sin(theta),nz=Math.sin(lat);
      const dx=env.rEci[3*k]-R_EARTH*nx,dy=env.rEci[3*k+1]-R_EARTH*ny,dz=env.rEci[3*k+2]-R_EARTH*nz;
      const elevation=Math.asin(Math.max(-1,Math.min(1,(dx*nx+dy*ny+dz*nz)/Math.hypot(dx,dy,dz))));
      if(elevation>=rad(cfg.environment.elevationMaskDeg)){stationVisible[s][k]=1;contact[k]=1;}
    }
  }
  return {contact,stationVisible};
}
