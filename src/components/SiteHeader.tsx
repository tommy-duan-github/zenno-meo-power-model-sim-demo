'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function SiteHeader(){
  const pathname=usePathname(),[dark,setDark]=useState(false);
  useEffect(()=>setDark(document.documentElement.dataset.theme==='dark'),[]);
  function toggleTheme(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('meo-theme',next?'dark':'light');}catch{}}
  return <header className="site-header"><div className="brand"><span className="brand-mark" aria-hidden="true">◉</span><strong>Simplified MEO Power Model</strong><span className="brand-sub">Parametric simulator demo</span></div><div className="header-actions"><nav className="page-tabs" aria-label="Pages"><Link href="/" className={pathname==='/'?'active':''} aria-current={pathname==='/'?'page':undefined}>Simulator</Link><Link href="/model" className={pathname==='/model'?'active':''} aria-current={pathname==='/model'?'page':undefined}>Model & assumptions</Link></nav><button type="button" className="theme-button" onClick={toggleTheme} aria-label={dark?'Switch to light mode':'Switch to dark mode'} aria-pressed={dark}><span aria-hidden="true">{dark?'☀':'☾'}</span><span>{dark?'Light mode':'Dark mode'}</span></button></div></header>;
}
