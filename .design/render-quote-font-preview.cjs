const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
let chrome, ws;
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function main() {
  const previewFile=process.argv[2] || 'quote-font-preview.html';
  const outputName=process.argv[3] || 'quote-font-preview';
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'wanbuyan-font-preview-'));
  const output=path.join(__dirname,'qa');
  await fs.mkdir(output,{recursive:true});
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let stderr=''; chrome.stderr.on('data',chunk=>stderr+=chunk);
  chrome.on('error',error=>stderr+=error.message);
  const deadline=Date.now()+15000;
  while(!/DevTools listening on (ws:\/\/\S+)/.test(stderr)) { if(Date.now()>deadline)throw new Error(stderr); await sleep(100); }
  const origin='http://'+new URL(/DevTools listening on (ws:\/\/\S+)/.exec(stderr)[1]).host;
  const target=await (await fetch(origin+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const item=pending.get(message.id);pending.delete(message.id);message.error?item.reject(new Error(JSON.stringify(message.error))):item.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value;};
  await send('Page.enable');await send('DOM.enable');await send('CSS.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1060,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:pathToFileURL(path.join(__dirname,previewFile)).href});
  const readyDeadline=Date.now()+10000;
  while(!await evaluate('document.readyState==="complete" && document.querySelectorAll(".quote").length>0')) { if(Date.now()>readyDeadline)throw new Error('Preview did not load');await sleep(100); }
  await evaluate('document.fonts.ready');
  const document=await send('DOM.getDocument');
  const fonts=[];
  const selectors=await evaluate('[...document.querySelectorAll("section")].map(el=>"."+el.classList[0]+" .quote")');
  for(const selector of selectors) {
    const node=await send('DOM.querySelector',{nodeId:document.root.nodeId,selector});
    const result=await send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});
    fonts.push({selector,fonts:result.fonts});
  }
  console.log(JSON.stringify(fonts));
  const height=await evaluate('Math.ceil(document.querySelector("main").getBoundingClientRect().height)');
  await send('Emulation.setDeviceMetricsOverride',{width:1200,height,deviceScaleFactor:1,mobile:false});
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await fs.writeFile(path.join(output,outputName+'.png'),Buffer.from(screenshot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:true});
  if(!await evaluate('document.documentElement.scrollWidth<=innerWidth'))throw new Error('Mobile preview overflows');
  const mobileHeight=await evaluate('Math.ceil(document.querySelector("main").getBoundingClientRect().height)');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:mobileHeight,deviceScaleFactor:1,mobile:true});
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  await fs.writeFile(path.join(output,outputName+'-mobile.png'),Buffer.from(mobile.data,'base64'));
  await fs.writeFile(path.join(output,outputName+'-rendering.json'),JSON.stringify(fonts,null,2));
  console.log('Rendered desktop and mobile font previews.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();chrome?.kill();});
