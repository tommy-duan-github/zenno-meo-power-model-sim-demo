'use client';
import { ResponsiveContainer,ComposedChart,Line,Area,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine,ReferenceArea } from 'recharts';
import type { SimResult } from '../../engine/types';
import { useSimStore } from '../../lib/store';
const PALETTE=['#176ab7','#e19a32','#50a782','#9273bc','#c15d61','#626e78'];
type Metric='soc'|'power'|'loads'|'field'|'states'|'contact';
export default function TimeSeriesChart({result,metric}:{result:SimResult;metric:Metric}){
  const setCursor=useSimStore(s=>s.setCursor),cursor=useSimStore(s=>s.cursor),s=result.series;
  const data=s.tH.map((tH,i)=>({tH,soc:s.soc[i]*100,pGen:s.pGen[i],pLoad:s.pLoad[i],bNT:s.bNT[i],tau:s.tauAvail[i]*1e3,torquer:s.torquerOn[i],cooler:s.coolerOn[i],contact:s.contact[i],...Object.fromEntries(Object.entries(s.loads).map(([key,v])=>[key,v[i]]))}));
  const titles:Record<Metric,string>={soc:'Battery state of charge',power:'Generation vs load',loads:'Subsystem loads',field:'Magnetic field',states:'Torquer & cooler state',contact:'Ground contact'};
  const yUnit=metric==='soc'?'%':metric==='power'||metric==='loads'?'W':metric==='field'?'nT':'';
  const spans:{start:number;end:number}[]=[];let start=-1;for(let i=0;i<s.eclipse.length;i++){if(s.eclipse[i]&&start<0)start=i;if(start>=0&&(!s.eclipse[i]||i===s.eclipse.length-1)){spans.push({start:s.tH[start],end:s.tH[i]});start=-1;}}
  return <section className="output-card chart-card"><div className="card-head"><div><div className="eyebrow">TIME SERIES</div><h3>{titles[metric]}</h3></div><span className="chart-unit">{yUnit} · eclipse shaded</span></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} onMouseMove={state=>{if(state?.activeTooltipIndex!=null){const idx=Number(state.activeTooltipIndex);if(Number.isFinite(idx))setCursor(s.tH[idx]??0);}}} margin={{top:8,right:16,bottom:4,left:0}}><CartesianGrid stroke="#edf0f2" vertical={false}/><XAxis dataKey="tH" type="number" domain={['dataMin','dataMax']} tickFormatter={v=>`${Number(v).toFixed(0)}h`} fontSize={11} tickLine={false}/><YAxis fontSize={11} tickLine={false} axisLine={false} width={40}/><Tooltip labelFormatter={v=>`${Number(v).toFixed(2)} h`} formatter={v=>typeof v==='number'?Number(v).toFixed(2):v}/>{spans.map((b,i)=><ReferenceArea key={i} x1={b.start} x2={b.end} fill="#e6f1ff" fillOpacity={0.8} strokeOpacity={0}/>)}<ReferenceLine x={cursor} stroke="#777" strokeDasharray="3 3"/>
    {metric==='soc'&&<><Line dataKey="soc" stroke={PALETTE[0]} dot={false} strokeWidth={2} isAnimationActive={false}/><ReferenceLine y={(1-result.kpis.dodLimit)*100} stroke="#c15d61" strokeDasharray="4 4"/></>}
    {metric==='power'&&<><Line dataKey="pGen" name="Generation" stroke={PALETTE[0]} dot={false} strokeWidth={2} isAnimationActive={false}/><Line dataKey="pLoad" name="Load" stroke={PALETTE[1]} dot={false} strokeWidth={2} isAnimationActive={false}/></>}
    {metric==='loads'&&Object.keys(s.loads).map((key,i)=><Area key={key} dataKey={key} stackId="loads" fill={PALETTE[i]} stroke={PALETTE[i]} fillOpacity={0.7} isAnimationActive={false}/>)}
    {metric==='field'&&<Line dataKey="bNT" name="Field strength" stroke={PALETTE[0]} dot={false} strokeWidth={2} isAnimationActive={false}/>}
    {metric==='states'&&<><Area dataKey="cooler" name="Cooler" fill={PALETTE[0]} stroke={PALETTE[0]} fillOpacity={0.35} isAnimationActive={false}/><Line dataKey="torquer" name="Torquer" stroke={PALETTE[1]} dot={false} strokeWidth={2} isAnimationActive={false}/></>}
    {metric==='contact'&&<Area dataKey="contact" name="Contact" fill={PALETTE[0]} stroke={PALETTE[0]} fillOpacity={0.6} isAnimationActive={false}/>}
  </ComposedChart></ResponsiveContainer></div></section>;
}
