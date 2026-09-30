'use client';
import { create } from 'zustand';
import { defaultConfig, type ScenarioConfig, type Preset } from '../engine/config';
import type { SimResult } from '../engine/types';
import { setPath } from './schemaFields';
export const OUTPUT_CHOICES=['kpis','soc','power','loads','field','states','contact','budget','warnings','sizing','heatmap','monteCarlo'] as const;
export type OutputChoice=typeof OUTPUT_CHOICES[number];
interface State { cfg:ScenarioConfig;preset:Preset;result:SimResult|null;status:'updating'|'ready'|'error';error:string;selected:OutputChoice[];cursor:number;setCfg:(cfg:ScenarioConfig)=>void;setField:(path:string,value:unknown)=>void;setPreset:(p:Preset)=>void;setResult:(r:SimResult)=>void;setStatus:(s:State['status'],e?:string)=>void;toggleOutput:(o:OutputChoice)=>void;setCursor:(v:number)=>void; }
export const useSimStore=create<State>((set,get)=>({cfg:defaultConfig(),preset:'smallMeo',result:null,status:'updating',error:'',selected:['kpis','soc','power','budget'],cursor:0,
  setCfg:cfg=>set({cfg,status:'updating'}),setField:(path,value)=>set({cfg:setPath(get().cfg,path,value),status:'updating'}),setPreset:p=>set({cfg:defaultConfig(p),preset:p,status:'updating'}),setResult:result=>set({result,status:'ready',error:''}),setStatus:(status,error='')=>set({status,error}),toggleOutput:o=>set({selected:get().selected.includes(o)?get().selected.filter(v=>v!==o):[...get().selected,o]}),setCursor:cursor=>set({cursor})}));
