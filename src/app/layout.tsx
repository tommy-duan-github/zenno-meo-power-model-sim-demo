import type { Metadata } from 'next';
import SiteHeader from '../components/SiteHeader';
import './globals.css';
import './theme.css';
import './resize.css';
export const metadata:Metadata={title:'Simplified MEO Power Model | Parametric simulator demo',description:'Interactive browser-based MEO spacecraft power simulator'};
const themeBoot="try{document.documentElement.dataset.theme=localStorage.getItem('meo-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}";
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBoot}}/></head><body><SiteHeader/>{children}</body></html>;}
