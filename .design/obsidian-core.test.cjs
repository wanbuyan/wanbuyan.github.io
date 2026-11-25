const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mergeNote,mergeCanvas,assertVaultLocation}=require('./obsidian-core.cjs');
test('vault cannot be the installation folder or one of its descendants, regardless of letter case',()=>{
  for(const candidate of ['D:/Obsidian','d:/OBSIDIAN/万不言博客项目库','D:/Obsidian/child/nested']) assert.throws(()=>assertVaultLocation(candidate,'D:/Obsidian'),/安装目录/);
  for(const candidate of ['D:/Notes/万不言博客项目库','C:/Notes/博客','D:/Obsidian-Notes/博客']) assert.doesNotThrow(()=>assertVaultLocation(candidate,'D:/Obsidian'));
});
test('sync replaces generated facts while preserving user notes before and after the block',()=>{
  const first=mergeNote(null,'# 旧状态');
  const old='个人序言\n'+first+'手写备注\n';
  const next=mergeNote(old,'# 新状态');
  assert.ok(next.startsWith('个人序言\n'));
  assert.ok(next.endsWith('手写备注\n'));
  assert.ok(next.includes('# 新状态'));assert.ok(!next.includes('# 旧状态'));
  assert.equal(mergeNote(next,'# 新状态'),next);
});
test('unmarked, incomplete or duplicate managed blocks are rejected',()=>{
  assert.throws(()=>mergeNote('# 手写原文','new'));
  assert.throws(()=>mergeNote('<!-- PROJECT-MEMORY:START -->旧','new'));
  const old=mergeNote(null,'old');assert.throws(()=>mergeNote(old+old,'new'));
});
test('canvas updates its relationships while preserving hand-placed nodes and custom notes',()=>{
  const old={nodes:[{id:'blog-a',type:'file',file:'旧.md',x:900,y:800,width:400,height:250,color:'6'},{id:'user',type:'text',text:'手写',x:0,y:0,width:200,height:100}],edges:[{id:'blog-edge-0',fromNode:'blog-a',toNode:'user',label:'旧自动关系'},{id:'user-edge',fromNode:'user',toNode:'blog-a',label:'我的关系'}]};
  const next={nodes:[{id:'blog-a',type:'file',file:'新.md',x:1,y:2,width:300,height:200},{id:'blog-b',type:'file',file:'另.md',x:1,y:2,width:300,height:200}],edges:[{id:'blog-edge-1',fromNode:'blog-a',toNode:'blog-b',label:'新关系'}]};
  const result=JSON.parse(mergeCanvas(JSON.stringify(old),JSON.stringify(next)));
  assert.equal(result.nodes.length,3);assert.equal(result.nodes[0].file,'新.md');
  assert.equal(result.nodes[0].x,900);assert.equal(result.nodes[0].color,'6');
  assert.equal(result.nodes[2].text,'手写');assert.equal(result.edges.length,2);
  assert.ok(result.edges.some(edge=>edge.id==='user-edge'));
  assert.ok(!result.edges.some(edge=>edge.label==='旧自动关系'));
  assert.equal(mergeCanvas(JSON.stringify(result),JSON.stringify(next)),JSON.stringify(result,null,2)+'\n');
});
