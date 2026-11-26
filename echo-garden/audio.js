/* 原创八小节配乐；音频按 AudioContext 时钟提前调度，不依赖画面帧率。 */
(()=>{
  'use strict';
  const beat=60/78,bar=beat*4,duration=bar*8;
  const chords=[[50,57,65,69],[46,53,62,65],[53,60,64,69],[48,55,62,67],[50,57,65,69],[43,55,62,69],[46,53,62,65],[45,57,62,64]];
  const melody=[[74,77,81,76],[77,74,72,69],[72,76,79,81],[79,76,74,72],[74,77,81,84],[81,79,77,74],[77,74,72,69],[76,74,69,72]];
  const score=[];
  chords.forEach((chord,i)=>{
    chord.forEach(note=>score.push({at:i*bar,note,length:bar*1.15,volume:.025,kind:'pad'}));
    score.push({at:i*bar,note:chord[0]-12,length:beat*2.8,volume:.12,kind:'bass'});
    melody[i].forEach((note,j)=>score.push({at:i*bar+[0,1.25,2,3.25][j]*beat,note,length:beat*(j===3?1.65:1.2),volume:[.13,.085,.11,.075][j],kind:'piano'}));
    score.push({at:i*bar+beat*.5,note:chord[1]+12,length:beat*1.6,volume:.05,kind:'piano'});
  });
  score.sort((a,b)=>a.at-b.at);
  const frequency=note=>440*Math.pow(2,(note-69)/12);
  function voice(context,destination,event,at,voices){
    const osc=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
    osc.type=event.kind==='pad'?'sine':'triangle';osc.frequency.value=frequency(event.note);
    filter.type='lowpass';filter.frequency.value=event.kind==='pad'?900:event.kind==='bass'?450:2200;filter.Q.value=.4;
    const attack=event.kind==='pad'?.35:.012,release=event.kind==='pad'?.7:.22,end=at+event.length+release;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(event.volume,at+attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,event.volume*.12),at+event.length);gain.gain.linearRampToValueAtTime(0,end);
    osc.connect(filter);filter.connect(gain);gain.connect(destination);osc.start(at);osc.stop(end+.02);
    const entry={osc,filter,gain};voices?.add(entry);
    osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();voices?.delete(entry);};
  }
  const effectLengths={move:.16,echo:.13,star:.68,click:.065,record:.32,rewind:.58,win:.9,blocked:.11,wait:.085,undo:.18};
  function effectBuffer(context,kind,variant=0){
    const length=effectLengths[kind];if(!length)return null;
    const rate=context.sampleRate,buffer=context.createBuffer(1,Math.ceil(length*rate),rate),data=buffer.getChannelData(0);
    let seed=7193+variant*7919,low=0;
    const bell=(t,f,decay)=>t<0?0:Math.sin(2*Math.PI*f*t)*Math.exp(-t*decay)*(1-Math.exp(-t*500));
    for(let i=0;i<data.length;i++){
      const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=(noise-low)*.12;
      let v=0;
      if(kind==='move'){
        // 石面脚步：低频落地、细砾摩擦与略迟的鞋底接触，左右脚有变化。
        const f=variant%2?126:108;
        v=.38*Math.sin(2*Math.PI*(f*t-105*t*t))*Math.exp(-t*47)+.27*low*Math.exp(-t*33)+.07*(noise-low)*Math.exp(-Math.pow((t-.035)/.026,2));
      }else if(kind==='echo')v=.09*low*Math.exp(-t*44)+bell(t,730,35)*.045;
      else if(kind==='click')v=bell(t,610,95)*.14+bell(t,1230,125)*.06+.06*low*Math.exp(-t*110);
      else if(kind==='star')v=bell(t,1174.66,8)*.19+bell(t-.055,1760,10)*.12+bell(t-.11,2349.32,11)*.09+bell(t,3230,24)*.022;
      else if(kind==='record')v=bell(t,523.25,20)*.16+bell(t-.105,783.99,18)*.15+.025*low*Math.exp(-t*45);
      else if(kind==='rewind'){
        const e=Math.sin(Math.PI*t/length)**2;
        v=(noise-low)*.11*e+low*.13*e+bell(t,950,7)*.04+bell(t-.22,587.33,10)*.12+bell(t-.31,880,12)*.10;
      }else if(kind==='win')v=[587.33,739.99,880,1174.66].reduce((sum,f,j)=>sum+bell(t-j*.095,f,6)*.13,0);
      else if(kind==='blocked')v=.15*Math.sin(2*Math.PI*96*t)*Math.exp(-t*48)+low*.09*Math.exp(-t*55);
      else if(kind==='wait')v=bell(t,460,55)*.055;
      else if(kind==='undo')v=bell(t,698.46,20)*.1+bell(t-.055,523.25,20)*.1;
      // 全部音效首尾收束，避免硬切爆音。
      data[i]=Math.tanh(v)*Math.min(1,t/.002,(length-t)/.012);
    }return buffer;
  }
  class GardenAudio{
    constructor({music=true,effects=true,onChange=()=>{}}={}){
      this.music=music;this.effects=effects;this.onChange=onChange;this.context=null;this.unlocked=false;this.active=true;this.timer=0;this.suspendTimer=0;this.voices=new Set();this.cursor=0;this.cycle=0;
      this.effectCache=new Map();this.effectSources=new Set();this.step=0;
    }
    get playing(){return Boolean(this.timer&&this.context?.state==='running');}
    async unlock(){
      try{
        if(!this.context){
          const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');
          this.context=new Audio({latencyHint:'interactive'});
          const c=this.context;this.master=c.createGain();this.master.gain.value=.65;
          const compressor=c.createDynamicsCompressor();compressor.threshold.value=-12;compressor.ratio.value=3;this.master.connect(compressor);compressor.connect(c.destination);
          this.musicBus=c.createGain();this.musicBus.gain.value=0;this.musicBus.connect(this.master);
          this.effectBus=c.createGain();this.effectBus.gain.value=.72;this.effectBus.connect(this.master);
          // 两路轻回声；配乐关掉时连同尾音一起淡出。
          const delay=c.createDelay(1),feedback=c.createGain(),wet=c.createGain();delay.delayTime.value=beat*.75;feedback.gain.value=.19;wet.gain.value=.22;
          this.musicInput=c.createGain();this.musicInput.connect(this.musicBus);this.musicInput.connect(delay);delay.connect(wet);wet.connect(this.musicBus);delay.connect(feedback);feedback.connect(delay);
          for(const kind of Object.keys(effectLengths))for(let variant=0;variant<(kind==='move'?2:1);variant++)this.effectCache.set(kind+variant,effectBuffer(c,kind,variant));
        }
        this.unlocked=true;clearTimeout(this.suspendTimer);
        if(this.active)await this.context.resume();this.sync();return this.context.state==='running';
      }catch{this.onChange('unavailable');return false;}
    }
    fade(bus,value,seconds=.3){const at=this.context.currentTime;bus.gain.cancelScheduledValues(at);bus.gain.setValueAtTime(bus.gain.value,at);bus.gain.linearRampToValueAtTime(value,at+seconds);}
    stopScore(){
      clearInterval(this.timer);this.timer=0;
      if(!this.context)return;
      this.fade(this.musicBus,0,.2);
      const stopAt=this.context.currentTime+.22;
      for(const v of this.voices){try{v.gain.gain.cancelScheduledValues(this.context.currentTime);v.gain.gain.setTargetAtTime(0,this.context.currentTime,.045);v.osc.stop(stopAt);}catch{}}
    }
    sync(){
      if(!this.context||!this.unlocked)return;
      if(!this.active||!this.music||this.context.state!=='running'){
        if(this.timer)this.stopScore();this.onChange(this.active?'off':'paused');return;
      }
      if(!this.timer){
        this.cursor=0;this.cycle=0;this.origin=this.context.currentTime+.08;this.fade(this.musicBus,.62,.6);
        this.timer=setInterval(()=>this.schedule(),100);this.schedule();
      }
      this.onChange('playing');
    }
    schedule(){
      const c=this.context;if(!c||c.state!=='running')return;
      const horizon=c.currentTime+.65;
      while(this.origin+this.cycle*duration+score[this.cursor].at<horizon){
        const event=score[this.cursor],at=this.origin+this.cycle*duration+event.at;
        if(at>=c.currentTime)voice(c,this.musicInput,event,at,this.voices);
        this.cursor++;if(this.cursor===score.length){this.cursor=0;this.cycle++;}
      }
    }
    setMusic(value){this.music=Boolean(value);this.sync();}
    stopEffects(){for(const source of this.effectSources){try{source.stop();}catch{}}this.effectSources.clear();}
    setEffects(value){this.effects=Boolean(value);if(!this.effects)this.stopEffects();}
    setActive(value){
      this.active=Boolean(value);clearTimeout(this.suspendTimer);
      if(!this.context)return;
      if(!this.active){this.stopScore();this.stopEffects();this.onChange('paused');this.suspendTimer=setTimeout(()=>{if(!this.active)this.context.suspend().catch(()=>{});},240);}
      else if(this.unlocked)this.context.resume().then(()=>this.sync()).catch(()=>this.onChange('unavailable'));
    }
    play(kind){
      const c=this.context;if(!this.effects||!c||c.state!=='running'||!this.active)return;
      const variant=kind==='move'?this.step++%2:0,buffer=this.effectCache.get(kind+variant);if(!buffer)return;
      // 限制重叠声源；缓冲在首次开启音频时生成，行走时只播放缓存。
      if(this.effectSources.size>=16){const oldest=this.effectSources.values().next().value;try{oldest.stop();}catch{}this.effectSources.delete(oldest);}
      const source=c.createBufferSource();source.buffer=buffer;source.playbackRate.value=kind==='move'?(variant?.97:1.03):1;source.connect(this.effectBus);this.effectSources.add(source);
      source.onended=()=>{source.disconnect();this.effectSources.delete(source);};source.start(c.currentTime+(kind==='move'?.035:0));
    }
    static render(context){
      const gain=context.createGain();gain.gain.value=.4;gain.connect(context.destination);
      for(const event of score)voice(context,gain,event,event.at+.1);
      return duration;
    }
  }
  GardenAudio.renderEffect=effectBuffer;
  GardenAudio.duration=duration;window.EchoGardenAudio=GardenAudio;
})();
