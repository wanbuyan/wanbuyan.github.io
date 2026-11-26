/* 本地矢量素材：草簇、木门、石框与月洞门。静态部分预先绘制。 */
(()=>{
  'use strict';
  const box=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
  function sprite(draw){const image=document.createElement('canvas');image.width=image.height=184;const c=image.getContext('2d');c.scale(2,2);c.translate(46,46);draw(c);return image;}
  const random=seed=>{let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
  const polygon=(c,points)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();};
  function moss(c,x,y,seed,size=1){
    const r=random(seed+311);c.save();c.translate(x,y);c.scale(size,size);
    for(let i=0;i<44;i++){const a=r()*Math.PI*2,d=Math.sqrt(r()),px=Math.cos(a)*d*17,py=Math.sin(a)*d*6;c.fillStyle=['#314d3b','#3e5b42','#58714d','#71805a'][Math.floor(r()*4)];c.globalAlpha=.35+r()*.5;c.beginPath();c.ellipse(px,py,.6+r()*2,.3+r()*.9,r()-.5,0,Math.PI*2);c.fill();}c.restore();
  }
  function grass(c,x,y,seed,scale=1){
    const r=random(seed*71+19);c.save();c.translate(x,y);c.scale(scale,scale);moss(c,0,12,seed,.85);
    // 根部集中，叶片向四周弯曲；分出前后层，而非一排锯齿。
    const blades=Array.from({length:23},()=>({root:(r()-.5)*13,height:9+r()*26,lean:(r()-.5)*48,width:.6+r()*1.8,hue:Math.floor(r()*5)})).sort((a,b)=>b.height-a.height);
    for(const v of blades){
      const y=12,tipX=v.root+v.lean,tipY=y-v.height;
      c.beginPath();c.moveTo(v.root,y);c.bezierCurveTo(v.root-v.lean*.1,y-v.height*.35,v.root+v.lean*.3,tipY-4,tipX,tipY);c.bezierCurveTo(v.root+v.lean*.28,tipY,v.root+v.width,y-v.height*.27,v.root+v.width,y);c.closePath();
      const g=c.createLinearGradient(v.root,y,tipX,tipY);g.addColorStop(0,'#253f32');g.addColorStop(.55,['#47664b','#567456','#63825d','#3a5b46','#798665'][v.hue]);g.addColorStop(1,'#7d9570');c.fillStyle=g;c.fill();
      if(v.width>1.8){c.strokeStyle='#a1ac7a40';c.lineWidth=.45;c.beginPath();c.moveTo(v.root+.5,y-3);c.quadraticCurveTo(v.root+v.lean*.15,tipY-2,tipX,tipY);c.stroke();}
    }
    if(seed%3===1){
      for(let j=0;j<2;j++){const side=j?1:-1;c.strokeStyle='#5e7b52';c.lineWidth=.7;c.beginPath();c.moveTo(side*3,11);c.quadraticCurveTo(side*8,-1,side*19,-8);c.stroke();
        for(let k=0;k<5;k++){const px=side*(5+k*2.5),py=6-k*2.8;c.fillStyle=k%2?'#698260':'#506e51';c.beginPath();c.moveTo(px,py);c.quadraticCurveTo(px+side*8,py-8,px+side*6,py-2);c.quadraticCurveTo(px+side*4,py+1,px,py);c.fill();}}
    }
    if(seed%4===0){c.strokeStyle='#819071';c.lineWidth=.65;c.beginPath();c.moveTo(-2,10);c.quadraticCurveTo(1,-8,6,-23);c.stroke();for(let j=0;j<4;j++){c.fillStyle=j%2?'#9eab81':'#728868';c.beginPath();c.ellipse(6-j*.5,-22+j*2.3,1.1,2.2,.6,0,Math.PI*2);c.fill();}}
    c.restore();
  }
  function mineral(c,points,seed,base,shade=1){
    const r=random(seed),g=c.createLinearGradient(-25,-35,30,30);g.addColorStop(0,base);g.addColorStop(1,'#354341');polygon(c,points);c.fillStyle=g;c.fill();c.save();polygon(c,points);c.clip();
    // 颗粒与矿物斑：静态烘焙，细节不进入逐帧循环。
    for(let i=0;i<1250;i++){const x=r()*76-38,y=r()*74-38;c.globalAlpha=(.035+r()*.10)*shade;c.fillStyle=r()>.53?'#bec0a8':'#101f20';c.fillRect(x,y,.25+r()*1.3,.25+r()*.8);}
    for(let i=0;i<18;i++){c.globalAlpha=.035+r()*.045;c.fillStyle=r()>.5?'#a1ac94':'#233b36';c.beginPath();c.ellipse(r()*65-32,r()*60-30,2+r()*8,1+r()*4,r()*Math.PI,0,Math.PI*2);c.fill();}
    c.globalAlpha=.28;c.strokeStyle='#1c3031';c.lineWidth=.7;
    for(let j=0;j<2;j++){const x=r()*40-20,y=r()*40-20;c.beginPath();c.moveTo(x,y);c.lineTo(x+3,y+6);c.lineTo(x-1,y+10);c.lineTo(x+4,y+16);c.stroke();}
    c.restore();polygon(c,points);c.strokeStyle='#bec7ac33';c.lineWidth=.7;c.stroke();
  }
  function flagstone(c,seed){
    const r=random(seed+118),points=[[-32,-32],[-17,-35],[6,-34],[29,-31],[34,-23],[35,-3],[33,17],[29,29],[8,31],[-14,30],[-32,26],[-35,12],[-34,-8],[-35,-24]].map(([x,y])=>[x+(r()-.5)*2.8,y+(r()-.5)*2.5]);
    c.save();c.translate(0,4);polygon(c,points);c.fillStyle='#152a2e';c.shadowColor='#07141866';c.shadowBlur=5;c.shadowOffsetY=2;c.fill();c.restore();
    mineral(c,points,seed+731,['#69776b','#62736a','#717e71','#64736c'][seed%4]);
    c.strokeStyle='#bdc6ab44';c.lineWidth=1;c.beginPath();c.moveTo(-30,-31);c.lineTo(-16,-33);c.lineTo(6,-32);c.lineTo(28,-30);c.stroke();
    if(seed%3!==0)moss(c,seed%2?-24:24,seed%2?26:-26,seed,.48);
  }
  function rock(c,x,y,seed,scale=1){
    const r=random(seed+27);c.save();c.translate(x,y);c.scale(scale,scale);moss(c,0,13,seed,1.1);
    const count=seed%3===0?3:1;
    for(let j=0;j<count;j++){
      c.save();c.translate(count>1?(j-1)*13:0,count>1?(j%2)*5:0);c.scale(count>1?.58:1,count>1?.63:1);
      const points=[[-23,8],[-20,-5],[-10,-16],[8,-19],[23,-8],[25,7],[12,16],[-9,17]].map(([a,b])=>[a+(r()-.5)*6,b+(r()-.5)*5]);
      c.save();c.translate(0,3);polygon(c,points);c.fillStyle='#14292a';c.shadowColor='#07141688';c.shadowBlur=6;c.fill();c.restore();
      mineral(c,points,seed+j*213,'#7e897a');
      polygon(c,[[-20,-5],[-10,-16],[8,-19],[0,-3],[-12,3]]);c.fillStyle='#a1aa9333';c.fill();
      polygon(c,[[0,-3],[8,-19],[23,-8],[25,7],[12,16],[6,7]]);c.fillStyle='#1e393c35';c.fill();
      c.strokeStyle='#233b3799';c.lineWidth=.8;c.beginPath();c.moveTo(8,-17);c.lineTo(0,-3);c.lineTo(6,7);c.stroke();moss(c,-12,10,seed+j,.6);c.restore();
    }
    if(seed%2===0)grass(c,20,8,seed+3,.42);c.restore();
  }
  function frame(c,C,font,label){
    // 石座、分块立柱与微微上翘的檐口。
    box(c,-36,25,72,8,3,'#1a3033');box(c,-35,23,70,5,2,'#819282');
    for(const side of [-1,1]){
      const x=side<0?-34:26;
      box(c,x,-29,8,54,2,'#6b8073','#94a18a');
      c.strokeStyle='#3f5b52';c.lineWidth=1;for(let j=0;j<3;j++){c.beginPath();c.moveTo(x, -14+j*15);c.lineTo(x+8,-14+j*15);c.stroke();}
      box(c,x-2,19,12,8,2,'#788b7c');
    }
    box(c,-37,-33,74,8,3,'#899887');
    c.beginPath();c.moveTo(-41,-38);c.quadraticCurveTo(-28,-32,-19,-38);c.lineTo(19,-38);c.quadraticCurveTo(28,-32,41,-38);c.lineTo(37,-30);c.lineTo(-37,-30);c.closePath();c.fillStyle='#344f49';c.fill();
    c.strokeStyle='#82917b';c.lineWidth=1.5;c.beginPath();c.moveTo(-40,-38);c.quadraticCurveTo(-28,-32,-19,-38);c.lineTo(19,-38);c.quadraticCurveTo(28,-32,40,-38);c.stroke();
    const color=label==='A'?C.gold:C.cyan;box(c,-10,-40,20,15,3,'#263f3c',color);c.font='600 12px '+font;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(label,0,-32.5);
    c.fillStyle='#5d7857';for(const x of [-32,-27,28,33]){c.beginPath();c.ellipse(x,23,3.5,1.6,-.2,0,Math.PI*2);c.fill();}
  }
  function panel(c,side){
    const g=c.createLinearGradient(-12,0,12,0);g.addColorStop(0,'#536456');g.addColorStop(.5,'#45594d');g.addColorStop(1,'#364c43');
    box(c,-12,-25,24,51,2,g,'#7f8e73');
    c.strokeStyle='#223e34';c.lineWidth=1;for(const x of [-5,3]){c.beginPath();c.moveTo(x,-23);c.lineTo(x,23);c.stroke();}
    c.strokeStyle='#91a17a33';c.beginPath();c.moveTo(-8,-19);c.quadraticCurveTo(-3,-11,-7,-2);c.moveTo(7,6);c.quadraticCurveTo(4,14,8,21);c.stroke();
    for(const y of [-16,17]){box(c,-12,y,24,3,1,'#233b34');c.fillStyle='#8c9672';for(const x of [-9,9]){c.beginPath();c.arc(x,y+1.5,1,0,Math.PI*2);c.fill();}}
    c.fillStyle='#bea46c';c.beginPath();c.arc(side*6,0,2,0,Math.PI*2);c.fill();c.strokeStyle='#ddc289';c.lineWidth=1.6;c.beginPath();c.ellipse(side*6,5,3.6,4.2,0,0,Math.PI*2);c.stroke();
  }
  function moonGate(c,open,C){
    c.fillStyle='#0c2328';c.beginPath();c.ellipse(0,-3,29,33,0,0,Math.PI*2);c.fill();
    const g=c.createLinearGradient(-30,-40,28,28);g.addColorStop(0,'#a0ac93');g.addColorStop(.5,'#788d7d');g.addColorStop(1,'#425e56');
    c.strokeStyle=g;c.lineWidth=8;c.beginPath();c.ellipse(0,-3,29,33,0,0,Math.PI*2);c.stroke();
    c.strokeStyle='#354f48';c.lineWidth=1.4;for(let i=0;i<7;i++){const a=-Math.PI+i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*25,-3+Math.sin(a)*29);c.lineTo(Math.cos(a)*33,-3+Math.sin(a)*37);c.stroke();}
    c.strokeStyle='#c1c9a373';c.lineWidth=1;c.beginPath();c.ellipse(0,-3,24,28,0,0,Math.PI*2);c.stroke();
    const inner=c.createLinearGradient(0,-28,0,25);inner.addColorStop(0,open?'#766942':'#162c30');inner.addColorStop(1,open?'#b09a5e':'#263e3c');
    c.fillStyle=inner;c.beginPath();c.ellipse(0,-3,23,27,0,0,Math.PI*2);c.fill();
    box(c,-37,24,74,7,3,'#738879');box(c,-29,30,58,5,2,'#405d54');box(c,-20,35,40,4,2,'#304e46');
    grass(c,-34,24,7,.35);grass(c,33,24,3,.4);
    c.fillStyle=open?C.white:'#789681';c.beginPath();c.moveTo(0,-14);c.quadraticCurveTo(2,-4,10,-3);c.quadraticCurveTo(2,-1,0,8);c.quadraticCurveTo(-2,-1,-10,-3);c.quadraticCurveTo(-2,-4,0,-14);c.fill();
  }
  class GardenArt{
    constructor(C,font){
      this.frames={A:sprite(c=>frame(c,C,font,'A')),B:sprite(c=>frame(c,C,font,'B'))};
      this.panels=[sprite(c=>panel(c,-1)),sprite(c=>panel(c,1))];this.exits=[sprite(c=>moonGate(c,false,C)),sprite(c=>moonGate(c,true,C))];
      this.grasses=Array.from({length:9},(_,i)=>sprite(c=>grass(c,0,0,i*37+11)));
      this.rocks=Array.from({length:7},(_,i)=>sprite(c=>rock(c,0,0,i*29+7)));
      this.floors=Array.from({length:9},(_,i)=>sprite(c=>flagstone(c,i*19+5)));
    }
    grass(c,x,y,seed,scale=1){c.drawImage(this.grasses[Math.abs(seed)%this.grasses.length],x-46*scale,y-46*scale,92*scale,92*scale);}
    rock(c,x,y,seed,scale=1){c.drawImage(this.rocks[Math.abs(seed)%this.rocks.length],x-46*scale,y-46*scale,92*scale,92*scale);}
    floor(c,x,y,seed){c.drawImage(this.floors[Math.abs(seed)%this.floors.length],x-46,y-46,92,92);}
    scatter(seed){return random(seed*377+29)();}
    gate(c,x,y,open,label){
      c.save();c.translate(x,y);c.fillStyle='#13292d';c.beginPath();c.roundRect(-26,-26,52,53,3);c.fill();
      for(let i=0;i<2;i++){const side=i?1:-1;c.save();c.translate(side*26,0);c.scale(1-open*.91,1);c.translate(-side*13,0);c.drawImage(this.panels[i],-46,-46,92,92);c.restore();}
      c.drawImage(this.frames[label],-46,-46,92,92);c.restore();
    }
    exit(c,x,y,open){c.drawImage(this.exits[open?1:0],x-46,y-46,92,92);}
  }
  window.EchoGardenArt=GardenArt;
})();
