/* 回声庭院：Canvas 场景、输入、本地进度与音效。无需服务或第三方脚本。 */
(()=>{
  'use strict';
  const E=window.EchoGardenEngine,levels=window.EchoGardenLevels.map(E.parse);
  const $=id=>document.getElementById(id),app=$('app'),canvas=$('garden'),ctx=canvas.getContext('2d');
  if(!ctx)throw Error('此浏览器无法创建游戏画布');
  canvas.tabIndex=0;
  const style=getComputedStyle(document.documentElement),C={};
  for(const name of ['bg','surface','floor','floor-alt','floor-side','plant','plant-light','ink','muted','line','gold','gold-soft','cyan','cyan-soft','rose','shadow','halo','white'])C[name]=style.getPropertyValue('--'+name).trim();
  const uiFont=style.getPropertyValue('--ui').trim(),storageKey='wanbuyan-echo-garden-v1';
  const reduced=new EventTarget();
  let storageAvailable=true;
  const progress={unlocked:1,bests:Array(levels.length).fill(null),last:0,sound:true,effectsVersion:2,music:true,motion:'full'};
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved&&typeof saved==='object'){
      if(Number.isInteger(saved.unlocked))progress.unlocked=Math.max(1,Math.min(levels.length,saved.unlocked));
      if(Number.isInteger(saved.last))progress.last=Math.max(0,Math.min(progress.unlocked-1,saved.last));
      progress.sound=saved.effectsVersion===2?saved.sound!==false:true;
      progress.music=saved.music!==false;
      progress.motion=saved.motion==='reduced'?'reduced':'full';
      if(Array.isArray(saved.bests))saved.bests.slice(0,levels.length).forEach((item,i)=>{
        if(item&&Number.isInteger(item.turns)&&item.turns>=0&&item.turns<100000&&Number.isInteger(item.echoes)&&item.echoes>=0&&item.echoes<10000)progress.bests[i]={turns:item.turns,echoes:item.echoes};
      });
    }
  }catch{storageAvailable=false;}
  reduced.matches=progress.motion==='reduced';
  document.documentElement.dataset.motion=progress.motion;
  let levelIndex=progress.last,level=levels[levelIndex],state=E.initial(level),history=[],started=false;
  const scene=new window.EchoGardenScene(canvas,C,uiFont,reduced);
  const audio=new window.EchoGardenAudio({music:progress.music,effects:progress.sound,onChange:mode=>{app.dataset.music=mode;}});
  let lastRepeat=0,bump=null;
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify(progress));}catch{storageAvailable=false;}
    $('save-note').textContent=storageAvailable?'关卡与最好成绩保存在此浏览器':'无法保存进度，当前页面内仍可继续游玩';
  }
  function ensureAudio(){audio.unlock();}
  function sound(kind){audio.play(kind);}
  function complete(){
    const best=progress.bests[levelIndex];
    if(!best||state.turns<best.turns||state.turns===best.turns&&state.echoes<best.echoes)progress.bests[levelIndex]={turns:state.turns,echoes:state.echoes};
    progress.unlocked=Math.max(progress.unlocked,Math.min(levels.length,levelIndex+2));save();
  }
  function controls(){
    const blocked=!started||state.won;
    $('record-button').disabled=blocked;
    $('mobile-record').disabled=blocked;
    $('undo-button').disabled=!started||!history.length;
    $('mobile-undo').disabled=!started||!history.length;
    $('reset-button').disabled=!started;
    $('wait-button').disabled=blocked;
    document.querySelectorAll('[data-command]').forEach(button=>button.disabled=blocked);
  }
  function update(message=''){
    const recording=Boolean(state.recording),echo=state.echo,steps=recording?state.recording.path.length-1:echo?echo.path.length-1:0;
    app.dataset.phase=!started?'ready':state.won?'won':recording?'recording':'playing';
    app.classList.toggle('is-recording',recording);
    $('start-panel').hidden=started;
    $('chapter').textContent='第 '+(levelIndex+1)+' 关'+' / '+levels.length;
    $('level-title').textContent=level.name;$('level-subtitle').textContent=level.subtitle;
    $('mode-label').textContent=!started?'准备就绪':state.won?'已完成':recording?'录制中':echo?'回放中':'移动中';
    $('star-count').textContent=state.collected.length+' / '+level.stars.length;
    $('turn-count').textContent=state.turns;
    $('best-count').textContent=progress.bests[levelIndex]?progress.bests[levelIndex].turns:'—';
    $('record-label').textContent=recording?'开始回放':echo?'重新录制':'开始录制';
    $('mobile-record').textContent=$('record-label').textContent;
    $('record-description').textContent=recording?'已记录 '+steps+' 步。按 R 回到起点并回放。':echo?'重新录制会替换当前影子。':'按 R 录制，再按 R 回放。';
    $('timeline-title').textContent=recording?'已录制':echo?'回放进度':'录制步数';
    $('timeline-count').textContent=echo&&!recording?echo.index+' / '+steps+' 步':steps+' / '+level.capacity+' 步';
    const length=echo&&!recording?Math.max(1,steps):level.capacity,fragments=[];
    for(let i=0;i<length;i++){const item=document.createElement('li');item.classList.toggle('is-filled',i<steps);item.classList.toggle('is-passed',Boolean(echo&&!recording&&i<echo.index));item.setAttribute('aria-hidden','true');fragments.push(item);}
    $('timeline').replaceChildren(...fragments);$('timeline').setAttribute('aria-label',recording?'已录制 '+steps+' 步':echo?'已回放 '+echo.index+' 步，共 '+steps+' 步':'尚未录制');
    let echoText='尚未录制';
    if(recording)echoText=steps>=level.capacity?'录制已满，按 R 回放':'空格可录下等待步骤';
    else if(echo){const tile=level.cells[E.echoPosition(state)];echoText=echo.index===steps?(/^[ab]$/.test(tile)?'影子停在 '+tile.toUpperCase()+' 机关':'回放结束，影子保持不动'):'回放中';}
    $('echo-state').textContent=echoText;
    $('win-panel').hidden=!state.won;
    $('win-title').textContent=levelIndex===levels.length-1?'全部通关':'本关完成';
    $('win-detail').textContent=state.turns+' 步，'+state.echoes+' 次回放。最少 '+(progress.bests[levelIndex]?.turns??state.turns)+' 步。';
    $('next-button').textContent=levelIndex===levels.length-1?'返回第一关':'下一关';
    $('hint-text').textContent=level.hint;
    $('progress-count').textContent='已完成 '+progress.bests.filter(Boolean).length+' / '+levels.length;
    $('level-buttons').replaceChildren(...levels.map((item,i)=>{
      const button=document.createElement('button');button.type='button';button.className='level-button';button.textContent=String(i+1);button.disabled=i>=progress.unlocked;
      button.title=item.name;button.setAttribute('aria-label','第 '+(i+1)+' 关：'+item.name+(progress.bests[i]?'，已完成':''));
      if(i===levelIndex)button.setAttribute('aria-current','step');if(progress.bests[i])button.setAttribute('data-complete','');
      button.addEventListener('click',()=>{started=true;ensureAudio();setLevel(i);});return button;
    }));
    $('sound-toggle').setAttribute('aria-pressed',String(progress.sound));$('sound-toggle').setAttribute('aria-label',progress.sound?'关闭音效':'开启音效');
    $('sound-toggle').title=progress.sound?'关闭音效':'开启音效';
    $('music-toggle').setAttribute('aria-pressed',String(progress.music));$('music-toggle').setAttribute('aria-label',progress.music?'关闭音乐':'开启音乐');
    $('music-toggle').title=progress.music?'关闭背景音乐':'开启背景音乐';
    $('motion-toggle').textContent=reduced.matches?'动画：精简':'动画：流畅';
    $('motion-toggle').setAttribute('aria-pressed',String(!reduced.matches));
    if(message)$('status').textContent=message;
    else if(state.won)$('status').textContent=levelIndex===levels.length-1?'六关已全部完成。':'下一关已解锁。';
    else $('status').textContent=recording?'移动和等待都会计入录制步数。':echo?'空格等待，Z 撤销，R 重新录制。':'集齐光点后进入出口。';
    const row=Math.floor(state.player/level.width)+1,col=state.player%level.width+1;
    canvas.setAttribute('aria-label',level.name+'。角色在第 '+row+' 行、第 '+col+' 列；已收集 '+state.collected.length+' 枚光点，共 '+level.stars.length+' 枚。'+echoText);
    $('board-caption').textContent=state.won?'本关完成。':recording?'按 R 回放刚录制的路线。':echo?'影子按录制路线移动，走完后停留。':'集齐光点后进入出口。';
    controls();paint();
  }
  function setLevel(index){
    levelIndex=index;level=levels[index];state=E.initial(level);history=[];
    canvas.style.aspectRatio=level.width+' / '+level.height;scene.setLevel(level,state);
    progress.last=index;save();$('hint').open=false;
    if(!reduced.matches)$('level-title').animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'ease-out'});
    update('收集 '+level.stars.length+' 个光点，进入出口。');
    resize();if(started)canvas.focus({preventScroll:true});
  }
  function begin(){
    if(started)return;
    started=true;ensureAudio();update('按 R 开始录制。');canvas.focus({preventScroll:true});
    if(!reduced.matches){const panel=$('start-panel');panel.hidden=false;panel.style.pointerEvents='none';panel.animate([{opacity:1},{opacity:0}],{duration:260,easing:'ease-out'}).finished.then(()=>{panel.hidden=true;}).catch(()=>{panel.hidden=true;});}
  }
  function action(command){
    if(!started||$('help-dialog').open)return;
    const previous=state,result=E.act(level,state,command);
    if(!result.ok){$('status').textContent=result.message;sound('blocked');if(!reduced.matches){bump?.cancel();bump=$('board-stage').animate([{transform:'translateX(0)'},{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}],{duration:150});}return;}
    history.push(E.clone(previous));if(history.length>500)history.shift();state=result.state;
    scene.transition(previous,state,result.kind,result.events);
    if(result.events.includes('win'))complete();
    if(result.events.includes('star')&&!reduced.matches)$('star-count').animate([{transform:'scale(1)',color:C.gold},{transform:'scale(1.15)',color:C.gold},{transform:'scale(1)'}],{duration:360,easing:'ease-out'});
    sound(result.kind);
    if(result.events.includes('star'))sound('star');
    if(result.events.includes('win'))sound('win');
    if(state.echo&&previous.echo&&state.echo.index!==previous.echo.index)sound('echo');
    update(result.message);canvas.focus({preventScroll:true});
  }
  function undo(){
    if(!history.length||!started)return;
    const previous=state;state=history.pop();scene.transition(previous,state,'undo');
    sound('undo');
    update('已撤销。');canvas.focus({preventScroll:true});
  }
  function resize(){scene.resize();}
  function paint(){scene.show(state);}
  $('start-button').addEventListener('click',begin);
  $('record-button').addEventListener('click',()=>action('record'));
  $('mobile-record').addEventListener('click',()=>action('record'));
  $('wait-button').addEventListener('click',()=>action('wait'));
  $('undo-button').addEventListener('click',undo);
  $('mobile-undo').addEventListener('click',undo);
  $('reset-button').addEventListener('click',()=>{sound('rewind');setLevel(levelIndex);});
  $('next-button').addEventListener('click',()=>setLevel((levelIndex+1)%levels.length));
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.command)));
  $('sound-toggle').addEventListener('click',()=>{progress.sound=!progress.sound;audio.setEffects(progress.sound);ensureAudio();save();update();});
  $('music-toggle').addEventListener('click',()=>{progress.music=!progress.music;audio.setMusic(progress.music);ensureAudio();save();update();});
  $('motion-toggle').addEventListener('click',()=>{progress.motion=reduced.matches?'full':'reduced';reduced.matches=progress.motion==='reduced';document.documentElement.dataset.motion=progress.motion;reduced.dispatchEvent(new Event('change'));save();update();});
  $('help-open').addEventListener('click',()=>$('help-dialog').showModal());
  $('help-dialog').addEventListener('close',()=>{if(started)canvas.focus({preventScroll:true});});
  document.addEventListener('click',event=>{
    const target=event.target.closest?.('button,summary,a');
    if(!target||target.disabled||target.closest('.touch-controls')||!progress.sound)return;
    audio.unlock().then(ok=>{if(ok)audio.play('click');});
  });
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||$('help-dialog').open||document.querySelector('#blog-page-transition')||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
    if(!started){if(event.key==='Enter'){event.preventDefault();begin();}return;}
    if(event.repeat){if(!/^Arrow|^[wasd]$/i.test(event.key)||performance.now()-lastRepeat<155)return;lastRepeat=performance.now();}
    const key=event.key.toLowerCase(),map={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right',r:'record',' ':'wait'};
    if(key===' '&&event.target.closest('button,summary,a'))return;
    if(key==='z'){event.preventDefault();undo();}else if(key==='u'){event.preventDefault();setLevel(levelIndex);}else if(map[key]){event.preventDefault();action(map[key]);}
  });
  document.addEventListener('visibilitychange',()=>audio.setActive(!document.hidden));
  window.addEventListener('pagehide',()=>audio.setActive(false));
  window.addEventListener('pageshow',()=>audio.setActive(!document.hidden));
  setLevel(levelIndex);
  $('start-button').textContent=progress.unlocked>1?'继续游戏':'开始游戏';
  window.BlogPageTransition?.ready();
})();
