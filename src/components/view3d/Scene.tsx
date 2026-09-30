'use client';
import { useEffect,useMemo,useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls,Line,Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SimResult,Vec3 } from '../../engine/types';
import { useSimStore } from '../../lib/store';
const toThree=([x,y,z]:Vec3):[number,number,number]=>[x,z,-y];
function Body({result,index,showShadow,showStations,showField}:{result:SimResult;index:number;showShadow:boolean;showStations:boolean;showField:boolean}){
  const g=result.geometry,s=result.series,trackIndex=Math.min(g.orbitRing.length-1,Math.round((s.tH[index]/result.kpis.periodH%1)*240)),sat=g.orbitRing[trackIndex],position=toThree(sat),sun=toThree(g.sunHat);
  const orbitParts=useMemo(()=>{const parts:{pts:[number,number,number][];eclipse:boolean}[]=[];let current:[number,number,number][]=[];let last=g.ringEclipse[0];g.orbitRing.forEach((p,i)=>{if(g.ringEclipse[i]!==last&&current.length){current.push(toThree(p));parts.push({pts:current,eclipse:last});current=[toThree(p)];last=g.ringEclipse[i];}else current.push(toThree(p));});if(current.length)parts.push({pts:current,eclipse:last});return parts;},[g]);
  const shadowQuat=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...sun).negate()),[sun]);
  const shadowPos:[number,number,number]=[-sun[0]*(g.rOrbitRe+1)/2,-sun[1]*(g.rOrbitRe+1)/2,-sun[2]*(g.rOrbitRe+1)/2];
  return <><ambientLight intensity={1.5}/><directionalLight position={sun.map(v=>v*12) as Vec3} intensity={2}/><mesh><sphereGeometry args={[1,32,24]}/><meshStandardMaterial color="#aebbc5" roughness={1} wireframe={false}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.006,0.003,3,96]}/><meshBasicMaterial color="#e6edf2"/></mesh>
    {orbitParts.map((part,i)=><Line key={i} points={part.pts} color={part.eclipse?'#e08c36':'#536c7e'} lineWidth={part.eclipse?3:1.5}/>)}
    {showShadow&&<mesh position={shadowPos} quaternion={shadowQuat}><cylinderGeometry args={[1,1,g.rOrbitRe+1,32,1,true]}/><meshBasicMaterial color="#1d6baf" transparent opacity={0.09} side={THREE.DoubleSide} depthWrite={false}/></mesh>}
    <Line points={[[0,0,0],sun.map(v=>v*2.1) as Vec3]} color="#dd9b36" lineWidth={2}/><Html position={sun.map(v=>v*2.25) as Vec3} center><span className="scene-label">SUN</span></Html>
    <mesh position={position}><sphereGeometry args={[0.075,12,12]}/><meshBasicMaterial color={s.eclipse[index]?'#e08c36':s.contact[index]?'#3d9d7a':'#196fbb'}/></mesh>
    {showStations&&g.stations.map((station,j)=>{const angle=s.tH[index]*3600*7.2921159e-5,base=station.ecefRe;const rot:[number,number,number]=[Math.cos(angle)*base[0]-Math.sin(angle)*base[1],Math.sin(angle)*base[0]+Math.cos(angle)*base[1],base[2]];return <group key={j}><mesh position={toThree(rot)}><sphereGeometry args={[0.04,8,8]}/><meshBasicMaterial color={station.visible[Math.min(station.visible.length-1,Math.floor(s.tH[index]*3600/result.meta.dtS))]?'#40a17a':'#ffffff'}/></mesh></group>;})}
    {showField&&<Line points={[position,[position[0],position[1]+0.7,position[2]]]} color="#9273bc" lineWidth={2}/>}
    <OrbitControls enablePan={false} minDistance={2} maxDistance={g.rOrbitRe*6}/>
  </>;
}
export default function Scene({result}:{result:SimResult}){
  const cursor=useSimStore(s=>s.cursor),setCursor=useSimStore(s=>s.setCursor),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(200),[shadow,setShadow]=useState(true),[stations,setStations]=useState(true),[field,setField]=useState(false);
  const s=result.series,limit=s.tH.at(-1)??1,index=Math.max(0,Math.min(s.tH.length-1,s.tH.findIndex(t=>t>=cursor)<0?s.tH.length-1:s.tH.findIndex(t=>t>=cursor)));
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>setCursor((cursor+0.016*speed/3600)%limit),50);return()=>clearInterval(timer);},[playing,cursor,setCursor,speed,limit]);
  return <aside className="view-panel panel"><div className="panel-head"><div><div className="eyebrow">03 / GEOMETRY</div><h2>Orbit view</h2></div><span className="view-beta">β {result.geometry.betaDeg.toFixed(0)}°</span></div><div className="canvas-wrap"><Canvas camera={{position:[0,result.geometry.rOrbitRe*2.2,result.geometry.rOrbitRe*2.8],fov:42}}><Body result={result} index={index} showShadow={shadow} showStations={stations} showField={field}/></Canvas></div><div className="timeline"><button className="play-button" onClick={()=>setPlaying(!playing)} aria-label={playing?'Pause':'Play'}>{playing?'Ⅱ':'▶'}</button><input type="range" min={0} max={limit} step={limit/1000} value={cursor} onChange={e=>setCursor(Number(e.target.value))}/><span>{cursor.toFixed(1)} h</span></div><div className="scene-controls"><label><input type="checkbox" checked={shadow} onChange={e=>setShadow(e.target.checked)}/> Shadow</label><label><input type="checkbox" checked={stations} onChange={e=>setStations(e.target.checked)}/> Stations</label><label><input type="checkbox" checked={field} onChange={e=>setField(e.target.checked)}/> B vector</label><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={100}>×100</option><option value={200}>×200</option><option value={1000}>×1000</option></select></div><div className="view-foot">Drag to rotate · scroll to zoom<br/>Blue: sunlight · amber: eclipse · green: contact</div></aside>;
}
