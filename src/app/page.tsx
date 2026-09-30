'use client';
import { useEffect,useState } from 'react';
import dynamic from 'next/dynamic';
import Controls from '../components/controls/Controls';
import Outputs from '../components/outputs/Outputs';
import { useSimStore } from '../lib/store';
import { calculate } from '../lib/engineClient';
import { ScenarioConfigSchema } from '../engine/config';
const Scene=dynamic(()=>import('../components/view3d/Scene'),{ssr:false,loading:()=><aside className="view-panel panel loading-view">Loading orbit view…</aside>});
export default function Simulator(){
  const cfg=useSimStore(s=>s.cfg),result=useSimStore(s=>s.result),status=useSimStore(s=>s.status),error=useSimStore(s=>s.error),setCfg=useSimStore(s=>s.setCfg),setResult=useSimStore(s=>s.setResult),setStatus=useSimStore(s=>s.setStatus),selected=useSimStore(s=>s.selected);
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{try{const saved=localStorage.getItem('meo-config');if(saved){const parsed=ScenarioConfigSchema.safeParse(JSON.parse(saved));if(parsed.success)setCfg(parsed.data);}const pick=localStorage.getItem('meo-outputs');if(pick){const list=JSON.parse(pick) as string[];for(const key of useSimStore.getState().selected)if(!list.includes(key))useSimStore.getState().toggleOutput(key as never);for(const key of list)if(!useSimStore.getState().selected.includes(key as never))useSimStore.getState().toggleOutput(key as never);}}catch{}setHydrated(true);},[setCfg]);
  useEffect(()=>{if(!hydrated)return;const parsed=ScenarioConfigSchema.safeParse(cfg);if(!parsed.success){setStatus('error',parsed.error.issues[0]?.message??'Invalid config');return;}setStatus('updating');const timer=setTimeout(()=>{calculate(parsed.data).then(r=>{if(r)setResult(r)}).catch(e=>setStatus('error',String(e)));},100);try{localStorage.setItem('meo-config',JSON.stringify(cfg));}catch{}return()=>clearTimeout(timer);},[cfg,hydrated,setResult,setStatus]);
  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem('meo-outputs',JSON.stringify(selected));}catch{}},[selected,hydrated]);
  return <div className="sim-shell"><div className="sim-status"><span className={`status-dot ${status}`}/>{status==='ready'?`Up to date · ${result?.meta.runtimeMs.toFixed(1)} ms`:status==='updating'?'Updating…':`Engine error · ${error}`}</div><div className="sim-grid"><Controls/>{result?<><Outputs result={result}/><Scene result={result}/></>:<div className="outputs loading-output">Calculating scenario…</div>}</div></div>;
}
