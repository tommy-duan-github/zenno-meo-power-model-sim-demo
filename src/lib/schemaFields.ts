import { z } from 'zod';
import { ScenarioConfigSchema } from '../engine/config';
export interface FieldDescriptor { path:string;label:string;unit:string;kind:'slider'|'toggle'|'select';min:number;max:number;softMin:number;softMax:number;step:number;group:string;help?:string;advanced?:boolean;showIf?:string;options?:string[];placeholder?:boolean; }
export function schemaFields():FieldDescriptor[]{
  const out:FieldDescriptor[]=[];
  function walk(shape:Record<string,z.ZodType>,prefix=''){
    for(const [key,schema] of Object.entries(shape)){
      const path=prefix?`${prefix}.${key}`:key;
      if(schema instanceof z.ZodObject){walk(schema.shape,path);continue;}
      const meta=schema.meta() as Record<string,unknown>|undefined;
      if(!meta?.label)continue;
      out.push({path,label:String(meta.label),unit:String(meta.unit??''),kind:meta.control as FieldDescriptor['kind'],min:Number(meta.min??0),max:Number(meta.max??1),softMin:Number(meta.softMin??meta.min??0),softMax:Number(meta.softMax??meta.max??1),step:Number(meta.step??0.01),group:String(meta.group),help:meta.help as string|undefined,advanced:meta.advanced as boolean|undefined,showIf:meta.showIf as string|undefined,options:meta.options as string[]|undefined,placeholder:meta.placeholder as boolean|undefined});
    }
  }
  walk(ScenarioConfigSchema.shape);return out;
}
export const FIELDS=schemaFields();
export function getPath(obj:unknown,path:string):unknown{return path.split('.').reduce((a,k)=>(a as Record<string,unknown>)?.[k],obj);}
export function setPath<T>(obj:T,path:string,value:unknown):T{const copy=structuredClone(obj);const parts=path.split('.');let node:Record<string,unknown>=copy as Record<string,unknown>;for(const p of parts.slice(0,-1))node=node[p] as Record<string,unknown>;node[parts.at(-1)!]=value;return copy;}
