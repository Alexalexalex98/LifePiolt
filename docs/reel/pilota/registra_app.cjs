const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('/opt/node-tools/node_modules/playwright');
const root=process.argv[2], out=process.argv[3];
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
 for(const c of [f,f+'.html',path.join(f,'index.html'),path.join(root,'index.html')]){if(fs.existsSync(c)&&fs.statSync(c).isFile()){r.writeHead(200,{'content-type':mime[path.extname(c)]||'application/octet-stream'});return fs.createReadStream(c).pipe(r);}}
 r.writeHead(404);r.end();});
srv.listen(0,async()=>{const B='http://localhost:'+srv.address().port;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const ctx=await b.newContext({locale:'it-IT',viewport:{width:540,height:960},deviceScaleFactor:2});
 const pg=await ctx.newPage(); const w=ms=>pg.waitForTimeout(ms);
 await pg.addLocatorHandler(pg.getByText('Salta tutti i tutorial',{exact:true}),async l=>{await l.click();});
 const skip=async()=>{for(const t of ['Salta il tour','Salta tutti i tutorial']){const l=pg.getByText(t,{exact:true});if(await l.count()){await l.last().click({timeout:2000}).catch(()=>{});await w(300);}}};
 await pg.goto(B+'/',{waitUntil:'networkidle'});await w(900);
 await pg.getByText('Modalità demo (serve il codice)').click();await w(400);await pg.getByPlaceholder('Codice').fill('1');await pg.getByText('Apri la demo',{exact:true}).click();await w(3000);
 await skip();await pg.keyboard.press('Escape');await w(300);await skip();
 const meta={};
 const open=async(u)=>{await pg.goto(B+'/',{waitUntil:'networkidle'});await w(1200);await skip();await pg.goto(B+u,{waitUntil:'networkidle'});await w(2200);await skip();
  if(await pg.getByText('Si sblocca presto').count()){await pg.getByText('Sblocca tutte le funzioni',{exact:true}).click().catch(()=>{});await w(1500);await pg.goto(B+u,{waitUntil:'networkidle'});await w(2200);await skip();}};
 const run=async(name,u,steps,total,mark)=>{
  await open(u); await pg.mouse.move(270,500);
  await pg.screenshot({path:`${out}/${name}_000.png`});
  let done=0;
  for(let i=1;i<=steps;i++){
    const k=i/steps, e=k*k*(3-2*k); const target=total*e; const dy=target-done; done=target;
    await pg.mouse.wheel(0,dy); await w(40);
    await pg.screenshot({path:`${out}/${name}_${String(i).padStart(3,'0')}.png`});
  }
  meta[name]={steps};
  for(const [key,txt] of Object.entries(mark||{})){const bb=await pg.getByText(txt,{exact:true}).first().boundingBox().catch(()=>null);meta[name][key]=bb?{x:bb.x*2,y:bb.y*2,w:bb.width*2,h:bb.height*2}:null;}
  console.log(name,JSON.stringify(meta[name]));
 };
 await run('a','/lifehealth',60,520,{rel:'Relazioni'});
 await run('b','/lifefinance',60,560,{bill:'Mobilnet Telefonia SA'});
 fs.writeFileSync(out+'/meta.json',JSON.stringify(meta));
 await b.close();srv.close();});
