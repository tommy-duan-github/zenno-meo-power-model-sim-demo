import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
const root=resolve('out'),port=Number(process.env.PORT || process.argv.at(-1)?.match(/^\d+$/)?.[0] || 4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  try{const url=new URL(req.url||'/',`http://localhost:${port}`);let path=decodeURIComponent(url.pathname);if(path.includes('..'))throw Error('Bad path');if(path.length>1)path=path.replace(/\/+$/,'');
    path=join(root,path==='/'?'index.html':path.slice(1));let info=await stat(path).catch(()=>null);if(info?.isDirectory()){path=join(path,'index.html');info=await stat(path).catch(()=>null);}if(!info&& !extname(path)){path+='.html';info=await stat(path).catch(()=>null);}if(!info)throw Error('Not found');
    res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,()=>process.stdout.write(`Static site at http://localhost:${port}\n`));
