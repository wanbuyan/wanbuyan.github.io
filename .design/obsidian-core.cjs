const START='<!-- PROJECT-MEMORY:START -->', END='<!-- PROJECT-MEMORY:END -->';
function assertVaultLocation(vault,installation) {
  const paths=require('node:path').win32;
  const relative=paths.relative(paths.resolve(installation).toLowerCase(),paths.resolve(vault).toLowerCase());
  if(!relative||relative!=='..'&&!relative.startsWith('..\\')&&!paths.isAbsolute(relative)) throw Error('笔记库不能放在 Obsidian 软件安装目录内');
}
function mergeNote(old,content) {
  const block=START+'\n'+content+'\n'+END;
  if(old===null) return block+'\n\n## 补充笔记\n\n';
  const a=old.indexOf(START),b=old.indexOf(END);
  if(a<0||b<a||old.indexOf(START,a+START.length)>=0||old.indexOf(END,b+END.length)>=0) throw Error('笔记缺少唯一完整管理区，拒绝覆盖');
  return old.slice(0,a)+block+old.slice(b+END.length);
}
function mergeCanvas(old,content) {
  const next=JSON.parse(content);
  if(old===null) return JSON.stringify(next,null,2)+'\n';
  const prior=JSON.parse(old);
  if(!Array.isArray(prior.nodes)||!Array.isArray(prior.edges)) throw Error('Canvas 格式异常，拒绝覆盖');
  const managed=id=>String(id).startsWith('blog-');
  const saved=new Map(prior.nodes.map(node=>[node.id,node]));
  const nodes=next.nodes.map(node=>{
    const oldNode=saved.get(node.id);
    if(!oldNode) return node;
    const result={...oldNode,...node};
    for(const field of ['x','y','width','height','color']) if(oldNode[field]!==undefined) result[field]=oldNode[field];
    return result;
  }).concat(prior.nodes.filter(node=>!managed(node.id)));
  const ids=new Set(nodes.map(node=>node.id));
  const edges=next.edges.concat(prior.edges.filter(edge=>!managed(edge.id)&&ids.has(edge.fromNode)&&ids.has(edge.toNode)));
  return JSON.stringify({...prior,...next,nodes,edges},null,2)+'\n';
}
module.exports={mergeNote,mergeCanvas,assertVaultLocation};
