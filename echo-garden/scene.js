/* 场景与规则分离：缓存静态地面/光晕，统一 RAF，按时间插值。 */
(()=>{
  'use strict';
  const E=window.EchoGardenEngine,clamp=t=>Math.max(0,Math.min(1,t)),ease=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
  class GardenScene{
    constructor(canvas,colors,font,reduced){
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.C=colors;this.font=font;this.reduced=reduced;this.frameId=0;this.motion=null;this.effects=[];this.gates=new Map();this.glows=new Map();this.level=null;this.state=null;this.previous=null;this.entered=performance.now();
      this.art=new window.EchoGardenArt(colors,font);
      const scene=this;
      this.frame=function frame(time){scene.frameId=0;scene.draw(time);if(!document.hidden&&!scene.reduced.matches)scene.frameId=requestAnimationFrame(scene.frame);};
      this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);
      document.addEventListener('visibilitychange',()=>this.setActive(!document.hidden));
      reduced.addEventListener('change',()=>{this.motion=null;this.previous=null;this.effects=[];this.setActive(!document.hidden);});
      window.addEventListener('pagehide',()=>this.setActive(false));window.addEventListener('pageshow',()=>this.setActive(!document.hidden));
    }
    point(pos){return {x:(pos%this.level.width+.5)*84,y:(Math.floor(pos/this.level.width)+.5)*84};}
    rect(x,y,w,h,r,fill,stroke=null,width=1,ctx=this.ctx){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
    halo(x,y,r,color,alpha=.2){
      if(!this.glows.has(color)){
        const image=document.createElement('canvas');image.width=image.height=128;const c=image.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);this.glows.set(color,image);
      }
      const c=this.ctx;c.save();c.globalAlpha*=alpha;c.drawImage(this.glows.get(color),x-r,y-r,r*2,r*2);c.restore();
    }
    star(x,y,size,color){const c=this.ctx;c.beginPath();c.moveTo(x,y-size);c.quadraticCurveTo(x+size*.2,y-size*.2,x+size,y);c.quadraticCurveTo(x+size*.2,y+size*.2,x,y+size);c.quadraticCurveTo(x-size*.2,y+size*.2,x-size,y);c.quadraticCurveTo(x-size*.2,y-size*.2,x,y-size);c.fillStyle=color;c.fill();}
    resize(){
      if(!this.level)return;
      const box=this.canvas.parentElement.getBoundingClientRect(),ratio=Math.min(2,devicePixelRatio||1),width=Math.max(1,Math.min(box.width-12,(box.height-12)*this.level.width/this.level.height)),height=width*this.level.height/this.level.width,w=Math.round(width*ratio),h=Math.round(height*ratio);
      if(w<=0||h<=0)return;
      this.canvas.style.width=width+'px';this.canvas.style.height=height+'px';
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.background=null;}
      if(!this.background)this.cacheGround();this.paint();
    }
    cacheGround(){
      const image=document.createElement('canvas');image.width=this.canvas.width;image.height=this.canvas.height;const c=image.getContext('2d'),C=this.C;
      c.setTransform(image.width/(this.level.width*84),0,0,image.height/(this.level.height*84),0,0);
      this.level.cells.forEach((tile,i)=>{
        const {x,y}=this.point(i),col=i%this.level.width,row=Math.floor(i/this.level.width);
        if(tile==='#'){
          const seed=row*917+col*337,choice=this.art.scatter(seed),jitter=this.art.scatter(seed+5);
          const px=x+(jitter-.5)*22,py=y+(this.art.scatter(seed+9)-.5)*18;
          if(choice<.34)this.art.grass(c,px,py+7,seed,.65+jitter*.3);
          else if(choice<.57)this.art.rock(c,px,py+8,seed,.62+jitter*.3);
          else if(choice<.68){this.art.grass(c,px-14,py+8,seed,.43);this.art.rock(c,px+10,py+10,seed+1,.48);}
          return;
        }
        this.art.floor(c,x,y,row*13+col*41);
      });this.background=image;
      this.special=this.level.cells.map((tile,pos)=>({tile,pos})).filter(({tile})=>/^[ABabE*]$/.test(tile));
    }
    setLevel(level,state){
      if(this.level&&!this.reduced.matches){const image=document.createElement('canvas');image.width=this.canvas.width;image.height=this.canvas.height;image.getContext('2d').drawImage(this.canvas,0,0);this.previous=image;}
      this.level=level;this.state=state;this.motion=null;this.effects=[];this.gates.clear();this.background=null;this.entered=performance.now();this.resize();this.show(state);
    }
    gateValue(gate,time){return gate?mix(gate.from,gate.to,ease(clamp((time-gate.start)/240))):0;}
    show(state){
      this.state=state;const now=performance.now(),active=E.gates(this.level,state),echo=E.echoPosition(state);
      for(const {tile,pos} of this.special||[]){if(!/^[AB]$/.test(tile))continue;
        const target=active.has(tile)||state.player===pos||echo===pos?1:0,old=this.gates.get(pos);
        if(!old||old.to!==target)this.gates.set(pos,{from:old?this.gateValue(old,now):target,to:target,start:now});
      }this.paint();
    }
    pose(time){
      let player=this.point(this.state.player),echo=E.echoPosition(this.state),stride=0,alpha=1;
      echo=echo===null?null:this.point(echo);
      const m=this.motion;if(!m||this.reduced.matches)return {player,echo,stride,alpha};
      const t=clamp((time-m.start)/m.duration),e=ease(t);
      if(m.route&&m.route.length>1&&t<1){
        const step=e*(m.route.length-1),index=Math.min(m.route.length-2,Math.floor(step)),part=step-index,a=m.route[index],b=m.route[index+1];player={x:mix(a.x,b.x,part),y:mix(a.y,b.y,part)};
      }else player={x:mix(m.from.x,m.to.x,e),y:mix(m.from.y,m.to.y,e)};
      if(echo){const from=m.fromEcho||echo;echo={x:mix(from.x,echo.x,e),y:mix(from.y,echo.y,e)};}
      if(t<1)stride=Math.sin(t*Math.PI);if(t===1)this.motion=null;
      return {player,echo,stride,alpha};
    }
    transition(previous,next,kind,events=[]){
      const now=performance.now(),current=this.pose(now);this.state=next;
      const to=this.point(next.player),distance=Math.hypot(to.x-current.player.x,to.y-current.player.y),rewind=kind==='rewind';
      let route=null;
      if(rewind&&previous.recording){route=previous.recording.path.slice().reverse().map(pos=>this.point(pos));route[0]=current.player;}
      this.motion=this.reduced.matches?null:{from:current.player,to,fromEcho:current.echo,start:now,duration:rewind?Math.min(850,420+(route?.length||0)*17):Math.min(240,Math.max(155,distance*1.8)),route};
      if(!this.reduced.matches){
        if(kind==='record')this.effects.push({pos:next.player,start:now,kind:'record'});
        if(rewind)this.effects.push({pos:next.player,start:now,kind:'rewind'});
        for(const event of events)if(event==='star'||event==='win')this.effects.push({pos:next.player,start:now+110,kind:event});
      }this.show(next);
    }
    traveller(pos,color,echo,alpha,time,stride=0){
      if(!pos)return;const c=this.ctx,C=this.C,bob=this.reduced.matches?0:Math.sin(time/780)*1.2;
      c.save();c.globalAlpha*=alpha;this.halo(pos.x,pos.y,43,color,echo?.15:.22);
      c.fillStyle=C.shadow;c.beginPath();c.ellipse(pos.x,pos.y+23,17-stride*3,5-stride,0,0,Math.PI*2);c.fill();
      c.translate(pos.x,pos.y+bob-stride*5);c.rotate(stride*.07);c.scale(1-stride*.04,1+stride*.04);
      c.strokeStyle=color;c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(-7,18);c.lineTo(-7-stride*4,26);c.moveTo(7,18);c.lineTo(7+stride*4,26);c.stroke();
      if(echo){this.rect(-12,-3,24,26,10,null,color,2);c.beginPath();c.arc(0,-13,12,0,Math.PI*2);c.stroke();}
      else{this.rect(-13,-2,26,26,10,color);c.beginPath();c.arc(0,-13,13,0,Math.PI*2);c.fillStyle=color;c.fill();}
      c.fillStyle=echo?color:C.bg;c.beginPath();c.arc(-4,-14,1.7,0,Math.PI*2);c.arc(4,-14,1.7,0,Math.PI*2);c.fill();c.restore();
    }
    draw(time){
      if(!this.level||!this.background)return;
      const c=this.ctx,C=this.C,w=this.level.width*84,h=this.level.height*84,quiet=this.reduced.matches,age=quiet?1:clamp((time-this.entered)/480);
      c.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);c.clearRect(0,0,w,h);
      if(this.previous&&age<1){c.globalAlpha=1-ease(age);c.drawImage(this.previous,0,0,w,h);c.globalAlpha=1;}else this.previous=null;
      c.save();c.globalAlpha=ease(age);c.translate(0,(1-ease(age))*12);c.drawImage(this.background,0,0,w,h);
      const active=E.gates(this.level,this.state),echoPos=E.echoPosition(this.state),collected=this.state.collected;
      if(!quiet)for(let i=0;i<12;i++){
        const x=(i*197+Math.sin(time/4600+i)*20)%w,y=((i*137+Math.sin(time/3700+i*2)*14)%h+h)%h,a=.12+(1+Math.sin(time/1100+i))* .14;
        c.save();c.globalAlpha*=a;c.fillStyle=i%3?C.cyan:C.gold;c.beginPath();c.arc(x,y,1.2+(i%3)*.3,0,Math.PI*2);c.fill();c.restore();
      }
      for(const {tile,pos} of this.special){const {x,y}=this.point(pos);
        if(/^[AB]$/.test(tile)){
          const open=quiet?this.gates.get(pos).to:this.gateValue(this.gates.get(pos),time),color=tile==='A'?C.gold:C.cyan;
          if(open>0)this.halo(x,y,48,color,open*.14);
          this.art.gate(c,x,y,open,tile);
        }else if(/^[ab]$/.test(tile)){
          const on=active.has(tile.toUpperCase()),color=tile==='a'?C.gold:C.cyan;
          c.strokeStyle=color;c.lineWidth=on?3:1.5;c.beginPath();c.ellipse(x,y+3,22,on?13:15,0,0,Math.PI*2);c.stroke();
          if(on){this.halo(x,y,42,color,.22);if(!quiet){c.save();c.globalAlpha*=.15+(1+Math.sin(time/450))*.15;c.beginPath();c.ellipse(x,y+3,27,18,0,0,Math.PI*2);c.stroke();c.restore();}}
          c.font='500 18px '+this.font;c.textAlign='center';c.fillStyle=color;c.fillText(tile.toUpperCase(),x,y+8);
        }else if(tile==='E'){
          const open=collected.length===this.level.stars.length;
          if(open)this.halo(x,y-5,60,C.gold,quiet?.25:.24+Math.sin(time/700)*.05);
          this.art.exit(c,x,y,open);
        }else if(!collected.includes(pos)){
          const bob=quiet?0:Math.sin(time/650+pos)*3;this.halo(x,y,36,C.gold,.19);c.save();c.translate(x,y-3+bob);c.rotate(quiet?0:Math.sin(time/1700+pos)*.12);this.star(0,0,12,C.gold);this.star(0,0,5,C.white);c.restore();
        }
      }
      const trail=this.state.recording?.path||this.state.echo?.path;
      if(trail?.length>1){
        c.save();c.strokeStyle=this.state.recording?C.gold:C.cyan;c.globalAlpha*=.34;c.lineWidth=3;c.setLineDash(this.state.recording?[2,8]:[4,9]);c.lineDashOffset=quiet?0:-time/85;c.lineCap='round';c.beginPath();trail.forEach((pos,i)=>{const p=this.point(pos);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.stroke();c.setLineDash([]);
        c.fillStyle=c.strokeStyle;for(const pos of new Set(trail)){const p=this.point(pos);c.beginPath();c.arc(p.x,p.y,2.5,0,Math.PI*2);c.fill();}c.restore();
      }
      const pose=this.pose(time),overlap=echoPos===this.state.player&&pose.echo&&Math.hypot(pose.player.x-pose.echo.x,pose.player.y-pose.echo.y)<22;
      if(overlap){pose.player.x-=7;pose.echo.x+=7;}
      if(pose.echo){if(!quiet&&pose.stride>.1){this.traveller({x:pose.echo.x-5,y:pose.echo.y+3},C.cyan,true,.12,time,0);}this.traveller(pose.echo,C.cyan,true,.88,time+900,pose.stride);}
      this.traveller(pose.player,C.gold,false,1,time,pose.stride);
      this.effects=this.effects.filter(effect=>time-effect.start<1100);
      if(!quiet)for(const effect of this.effects){
        const t=(time-effect.start)/1100;if(t<0)continue;const p=this.point(effect.pos),color=effect.kind==='rewind'?C.cyan:C.gold;c.save();c.globalAlpha*=1-t;c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y+8,10+t*58,6+t*32,0,0,Math.PI*2);c.stroke();
        const count=effect.kind==='win'?24:effect.kind==='star'?10:0;
        for(let i=0;i<count;i++){const angle=i*2.39996,speed=28+(i%5)*13,dist=(1-Math.pow(1-t,2))*speed;this.star(p.x+Math.cos(angle)*dist,p.y+Math.sin(angle)*dist-t*40+t*t*42,(3+i%3)*(1-t),i%3?color:C.white);}c.restore();
      }c.restore();
    }
    paint(){if(!this.frameId&&!document.hidden)this.frameId=requestAnimationFrame(this.frame);}
    setActive(active){cancelAnimationFrame(this.frameId);this.frameId=0;if(active)this.paint();}
  }
  window.EchoGardenScene=GardenScene;
})();
