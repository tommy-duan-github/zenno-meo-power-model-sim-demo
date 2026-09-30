'use client';
import { useState } from 'react';
import { defaultConfig, ScenarioConfigSchema, type Preset } from '../../engine/config';
import { FIELDS,getPath,type FieldDescriptor } from '../../lib/schemaFields';
import { useSimStore } from '../../lib/store';
const ORBITS:[string,number,number][]=[['O3b',8062,0],['GLONASS',19130,64.8],['GPS',20180,55],['BeiDou',21528,55],['Galileo',23222,56]];
function Field({field}: {field:FieldDescriptor}){
  const cfg=useSimStore(s=>s.cfg),setField=useSimStore(s=>s.setField),value=getPath(cfg,field.path),baseline=getPath(defaultConfig(),field.path);
  const [draft,setDraft]=useState<string|null>(null),[error,setError]=useState('');
  if(field.showIf){const [path,expected]=field.showIf.split('=');if(String(getPath(cfg,path))!==expected)return null;}
  const changed=value!==baseline;
  const commit=(raw:string)=>{const number=Number(raw);if(!Number.isFinite(number)||number<field.min||number>field.max){setError(`Enter ${field.min}–${field.max}`);return;}setField(field.path,number);setDraft(null);setError('');};
  return <div className="control-field"><label htmlFor={field.path}><span>{field.label}{changed&&<i className="changed-dot" aria-label="Changed"/>}{field.placeholder&&<small className="placeholder">estimate</small>}</span>{field.unit&&<small>{field.unit}</small>}</label>
    {field.kind==='toggle'?<input id={field.path} type="checkbox" className="switch" checked={Boolean(value)} onChange={e=>setField(field.path,e.target.checked)}/>:
    field.kind==='select'?<select id={field.path} value={String(value)} onChange={e=>setField(field.path,e.target.value)}>{field.options?.map(o=><option key={o} value={o}>{o.replace(/([A-Z])/g,' $1')}</option>)}</select>:
    <div className="number-control"><input aria-label={`${field.label} slider`} type="range" min={field.softMin} max={field.softMax} step={field.step} value={Math.min(field.softMax,Math.max(field.softMin,Number(value)))} onChange={e=>{setField(field.path,Number(e.target.value));setDraft(null);setError('')}}/><input id={field.path} type="number" min={field.min} max={field.max} step={field.step} value={draft??String(value)} onChange={e=>{setDraft(e.target.value);setError('')}} onBlur={e=>commit(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')commit(e.currentTarget.value)}}/></div>}
    {field.help&&<small className="help">{field.help}</small>}{field.path==='orbit.betaDeg'&&<small className="help">Approximate reachable range: ±{Math.min(90,cfg.orbit.inclinationDeg+23.44).toFixed(1)}°.</small>}{error&&<small className="field-error">{error}</small>}
  </div>;
}
export default function Controls(){
  const cfg=useSimStore(s=>s.cfg),preset=useSimStore(s=>s.preset),setPreset=useSimStore(s=>s.setPreset),setCfg=useSimStore(s=>s.setCfg);const [advanced,setAdvanced]=useState(false);
  const groups=['Scenario','Orbit','Environment','Power gain','Power used','Battery','Rules','Design loops'];
  return <aside id="input-panel" className="controls panel"><div className="panel-head"><div><div className="eyebrow">01 / INPUTS</div><h2>Scenario controls</h2></div><button className="text-button" onClick={()=>setCfg(defaultConfig(preset))}>Reset all</button></div>
    <div className="preset-row"><label htmlFor="preset">Spacecraft preset</label><select id="preset" value={preset} onChange={e=>setPreset(e.target.value as Preset)}><option value="smallMeo">Small MEO</option><option value="gnssClass">GNSS class</option></select></div>
    {groups.map((group,i)=><details className="control-group" key={group} open={i<2?true:undefined}><summary><span className={`group-dot dot-${i}`}/>{group}<span className="chevron">⌄</span></summary><div className="group-body">{group==='Orbit'&&<div className="orbit-presets">{ORBITS.map(([name,alt,inc])=><button key={name} onClick={()=>setCfg({...cfg,orbit:{...cfg.orbit,altitudeKm:alt,inclinationDeg:inc},sim:{...cfg.sim,worstCase:false}})}>{name}</button>)}</div>}
    {FIELDS.filter(f=>f.group===group&&(!f.advanced||advanced)).map(field=><Field key={field.path} field={field}/>)}
    {group==='Scenario'&&cfg.sim.worstCase&&<p className="case-note">Worst case uses β = 0°, aphelion flux, EOL and the storm field scale. Nominal control values are retained for when you switch it off.</p>}
    <button className="text-button reset-group" onClick={()=>{const d=defaultConfig(preset),groupKey={Scenario:'sim',Orbit:'orbit',Environment:'environment','Power gain':'gain','Power used':'used',Battery:'battery',Rules:'rules','Design loops':'design'}[group] as keyof typeof cfg;setCfg({...cfg,[groupKey]:d[groupKey]});}}>Reset group</button></div></details>)}
    <label className="advanced-toggle"><input type="checkbox" checked={advanced} onChange={e=>setAdvanced(e.target.checked)}/> Show advanced controls</label>
  </aside>;
}
