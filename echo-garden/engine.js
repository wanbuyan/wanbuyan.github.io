/* 纯规则层：只有成功的一步会推进回声；所有状态可完整撤销。 */
(function(root){
  'use strict';
  const clone=value=>structuredClone(value);
  function parse(definition){
    const rows=definition.map,width=rows[0].length;
    if(rows.some(row=>row.length!==width||/[^#.*SEabAB]/.test(row)))throw Error('庭院地图格式错误');
    const cells=rows.join('').split(''),starts=[],exits=[],stars=[];
    cells.forEach((cell,i)=>{if(cell==='S')starts.push(i);if(cell==='E')exits.push(i);if(cell==='*')stars.push(i);});
    if(starts.length!==1||exits.length!==1||!stars.length)throw Error('庭院必须有一个起点、一个出口和光点');
    return {...definition,cells,width,height:rows.length,start:starts[0],exit:exits[0],stars};
  }
  function initial(level){return {player:level.start,collected:[],echo:null,recording:null,turns:0,echoes:0,won:false};}
  function echoPosition(state){return state.echo?state.echo.path[state.echo.index]:null;}
  function gates(level,state){
    const active=new Set();
    for(const pos of [state.player,echoPosition(state)])if(pos!==null&&/^[ab]$/.test(level.cells[pos]))active.add(level.cells[pos].toUpperCase());
    return active;
  }
  function act(level,previous,command){
    const reject=message=>({ok:false,state:previous,message,events:[]});
    if(previous.won)return reject('本关已完成。');
    const state=clone(previous),events=[];
    if(command==='record'){
      if(!state.recording){
        state.echo=null;
        state.recording={anchor:{player:state.player,collected:state.collected.slice()},path:[state.player]};
        return {ok:true,state,kind:'record',message:'录制中，再按 R 回放。',events};
      }
      if(state.recording.path.length<2)return reject('先走一步，或等待一步，再开始回放。');
      const recording=state.recording;
      state.player=recording.anchor.player;state.collected=recording.anchor.collected.slice();
      state.echo={path:recording.path.slice(),index:0};state.recording=null;state.echoes++;
      return {ok:true,state,kind:'rewind',message:'已回到起点。每行动一步，影子也走一步。',events};
    }
    const direction={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0],wait:[0,0]}[command];
    if(!direction)return reject('未知操作。');
    if(state.recording&&state.recording.path.length-1>=level.capacity)return reject('记录已满，请先开始回放。');
    const x=state.player%level.width+direction[0],y=Math.floor(state.player/level.width)+direction[1];
    const target=y*level.width+x;
    if(x<0||y<0||x>=level.width||y>=level.height||level.cells[target]==='#')return reject('无法通过。');
    if(state.echo)state.echo.index=Math.min(state.echo.index+1,state.echo.path.length-1);
    const tile=level.cells[target];
    // 同一步中先预演回声的位置，再判断门；撞墙或闭门时整步撤销。
    const positions=[target,echoPosition(state)];
    const open=positions.some(pos=>pos!==null&&level.cells[pos]===tile.toLowerCase());
    if(/^[AB]$/.test(tile)&&!open)return reject(tile+' 门关闭，需踩住机关 '+tile+'。');
    state.player=target;state.turns++;
    if(tile==='*'&&!state.collected.includes(target)){state.collected.push(target);events.push('star');}
    if(state.recording)state.recording.path.push(target);
    if(target===level.exit&&state.collected.length===level.stars.length&&!state.recording){state.won=true;events.push('win');}
    let message=state.won?'本关完成。':command==='wait'?'等待一步。':'';
    if(target===level.exit&&!state.won)message=state.recording?'录制中不会完成关卡，先开始回放。':'还差 '+(level.stars.length-state.collected.length)+' 枚光点。';
    return {ok:true,state,kind:command==='wait'?'wait':'move',message,events};
  }
  const api={parse,initial,act,gates,echoPosition,clone};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.EchoGardenEngine=api;
})(typeof window==='object'?window:globalThis);
