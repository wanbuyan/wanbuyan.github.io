/* 项目记忆同步：默认仅在项目内准备；--apply 才写入固定的独立 Obsidian 库。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { mergeNote,mergeCanvas,assertVaultLocation } = require('./obsidian-core.cjs');
const root = path.resolve(__dirname,'..');
const vault = path.resolve('D:/Notes/万不言博客项目库');
const installation = path.resolve('D:/Obsidian');
assertVaultLocation(vault,installation);
if(fs.existsSync(vault)) assertVaultLocation(fs.realpathSync(vault),fs.realpathSync(installation));
const stage = path.join(__dirname,'obsidian-build');
const identity = 'wanbuyan-blog-memory-v1';
const start = '<!-- PROJECT-MEMORY:START -->', end = '<!-- PROJECT-MEMORY:END -->';
const now = new Date();
const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const stamp = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
const text = file => fs.readFileSync(path.join(root,file),'utf8');
const context = {window:{}};
for(const file of ['assets/artworks.js','assets/resources.js','posts/posts.js']) vm.runInNewContext(text(file),context,{timeout:3000});
const {BLOG_ARTWORKS:artworks,BLOG_RESOURCES:resources,BLOG_POSTS:allPosts} = context.window;
const posts = allPosts.filter(post=>!post.draft);
const documents = resources.filter(item=>item.type==='document');
let head='未读取', changed=[];
try {
  head=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  changed=execFileSync('git',['-c','core.quotepath=false','status','--porcelain=v1'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split('\n').filter(Boolean);
} catch {}
const entries = [];
const link = file => '[['+file.replace(/\.md$/,'')+']]';
const source = files => '\n\n## 核对来源\n\n'+files.map(file=>'- `'+path.join(root,file)+'`').join('\n');
function note(file,title,body,links=[],sources=[],mode='managed') {
  for(const file of sources) if(!fs.existsSync(path.join(root,file))) throw Error('源文件不存在：'+file);
  const related=links.length?'\n\n## 关联\n\n'+links.map(file=>'- '+link(file)).join('\n'):'';
  const content='# '+title+'\n\n'+body+related+(sources.length?source(sources):'');
  entries.push({file,mode,content});
}
const p = {
  home:'项目入口.md', overview:'00 项目/项目概览.md', state:'00 项目/当前状态.md', decisions:'00 项目/决策与偏好.md',
  pending:'00 项目/待办与核实.md', sync:'00 项目/记忆维护.md', release:'00 项目/发布与验证.md',
  front:'01 网站/首页与导航.md', library:'01 网站/资料仓库.md', posts:'01 网站/帖子发布.md',
  art:'01 网站/水浒图集.md', quotes:'01 网站/金句摘选.md', chess:'02 游戏/象棋.md',
  blind:'02 游戏/盲棋规则.md', training:'02 游戏/练习指导与沙盘.md', snake:'02 游戏/贪吃蛇.md',
  dc2:'03 内容/DC-2.md', dc3:'03 内容/DC-3.md', dc4:'03 内容/DC4.md'
};
note(p.home,'万不言博客项目记忆',
  '本库专用于万不言的博客，独立于测试库。项目目录：`'+root+'`。\n\n'+
  '先读 '+link(p.state)+' 和 '+link(p.decisions)+'，再按模块查阅代码来源。可打开 [[关系图谱.canvas]] 查看可点击的模块关系，或使用 Obsidian 原生关系图查看双链。\n\n'+
  '源码事实与内容目录可由脚本同步，新的用户决定和任务结果需由执行任务的助手补充；不会在没有任务运行时自行监听。',
  [p.overview,p.state,p.decisions,p.pending,p.sync,p.release,p.front,p.library,p.posts,p.chess,p.snake]);
note(p.overview,'项目概览',
  '纯静态个人博客，主题为万不言的博客。使用原生 HTML、CSS 和 JavaScript，站点入口为 `index.html`，可直接双击预览。\n\n'+
  '主要栏目包括资料仓库、自制游戏与帖子；随笔、关于保留待开发。主页展示有关联的水浒双图、金句、最新帖子和紧凑游戏入口。',
  [p.front,p.library,p.posts,p.art,p.quotes,p.chess,p.snake,p.release],['README.md','index.html']);
note(p.state,'当前状态',
  '源码核对时间：'+stamp+'（北京时间）。\n\n'+
  '- 本地帖子：'+posts.length+' 篇。\n- 已登记资料：'+resources.length+' 份，其中文档 '+documents.length+' 份。\n- 水浒图片目录：'+artworks.length+' 张。\n'+
  '- 本地 Git HEAD：`'+head+'`。\n- 工作区状态：'+(changed.length?'有 '+changed.length+' 项未提交变更。':'干净。')+'\n'+
  '- 发布状态：本脚本不提交、不推送，也不检查 GitHub Pages；线上是否与本地一致尚未核对。\n\n'+
  '当前文档：\n'+documents.map(item=>'- '+item.name+'（'+item.size+' 字节）').join('\n')+'\n\n'+
  '当前帖子：\n'+posts.map(post=>'- '+post.date+' · '+post.title+' · `'+post.id+'`').join('\n'),
  [p.decisions,p.release,p.library,p.posts],['assets/resources.js','assets/artworks.js','posts/posts.js']);
note(p.decisions,'决策与偏好',
  '本页人工维护；同步脚本只在首次创建时写入，之后保留用户与助手的修改。较新的用户纠正优先。\n\n'+
  '## 网站与文案\n\n- 保持纯静态，不添加供访客启动网站的 CMD、服务器或后台流程。\n- 避免夸张标题、口语化填充与自行杜撰的内容。沿用现有水浒插图与暖白布局。\n- 用户比较过多组楷体、瘦金体后决定“不变了”，金句保留现有字体；预览样式未应用。\n'+
  '- 首页“原神攻略”按钮已按要求移除。游戏使用紧凑入口。\n\n'+
  '## 展示节奏\n\n- 水浒双图按北京时间每小时整点切换；两图要有人物、亲属、搭档或情节关联，轮内不重复。\n- 金句每天零点切换，从 Excel 读取。\n\n'+
  '## 象棋纠正\n\n- 盲棋将帅每步只能在己方九宫内横向或纵向走一格；“任意跳走”已废止。\n- 暗子走后自动翻开，按真实颜色归属；被吃的暗子开启动画时先显示真实棋名与颜色，再淡出。\n- 棋面不显示“车位、兵位”等标签。\n\n'+
  '## 资料与记忆\n\n- DC-2 最初改为仅帖子，后来用户再次要求把资料文件夹的 DC-2 文档登记到网页；当前帖子和资料下载均保留。\n- DC-3 同时提供帖子与资料，DC4 按原文记录到交互式 Shell，不补写后续提权。\n- `D:\\Obsidian\\1` 是测试库，不使用、不修改。本项目新建独立笔记库。',
  [p.front,p.art,p.quotes,p.blind,p.dc2,p.dc3,p.dc4,p.sync],[],'init');
note(p.pending,'待办与核实',
  '本页人工维护，不由脚本覆盖。\n\n- GitHub Pages 当前是否已包含本地最新修改：尚未核对。\n- 一部分水浒题字仍标有“〔未辨〕”，以原图核对为准。\n- 随笔、关于栏目仍待开发。\n- Obsidian 首次使用需选择“打开文件夹为仓库”，打开本库文件夹。\n\n新增待办需记录来源、状态和完成证据，处理后更新，不把历史假设当成现状。',
  [p.release,p.art,p.sync],[],'init');
note(p.sync,'记忆维护',
  '## 开始与结束任务\n\n1. 开始时读取项目入口、当前状态、决策与偏好，再查看实际源码。\n2. 完成后更新人工维护的决策和待办页。\n3. 在项目内 `.design/obsidian-entry.json` 记录 summary、validation、pending。\n4. 执行 `node .design/sync-obsidian.cjs --prepare` 校验。\n5. 执行 `node .design/sync-obsidian.cjs --apply` 写入本库；目录写入权限由当前会话控制。\n\n'+
  '## 更新范围\n\n模块事实页只更新 `PROJECT-MEMORY` 标记之间的管理区，区外笔记保留；决策、待办页只首次初始化，后续手动维护。每次有意义的任务更新写入日期日志。覆盖前在隐藏目录 `.project-memory/backups/` 备份旧内容。\n\n'+
  '本库不上传到博客仓库。脚本只读取博客源码与明确提供的任务摘要，不保存完整聊天记录，也不读测试库。\n\n'+
  '项目根目录和工作区的 `AGENTS.md` 提醒后续任务继续读取与同步。未启动后台监听、定时任务或跨设备同步；Obsidian 自己的跨设备同步属于另一个配置范围。',
  [p.home,p.state,p.decisions,p.pending,p.release],['AGENTS.md','.design/sync-obsidian.cjs']);
note(p.release,'发布与验证',
  '本地改动、Git 提交、推送、线上部署是不同状态。更新记忆不能视为发布成功。\n\n'+
  '既有检查入口：\n\n- 排期：`node --test .design/daily-core.test.cjs`。\n- 象棋规则与练习：`node --test chess/blind.test.cjs chess/training.test.cjs`。\n- 博客内容与移动端：`node .design/browser-qa.cjs --daily-only`。\n- 盲棋界面：`node .design/browser-qa.cjs --blind-only`。\n\n'+
  '按具体改动运行必要检查，并在日志中记清真实结果。本次同步只校验笔记和源文件关联，历史浏览器检查不可写成每次都重新执行。',
  [p.state,p.sync,p.library,p.posts,p.chess],['.design/browser-qa.cjs','.design/daily-core.test.cjs','chess/blind.test.cjs','chess/training.test.cjs']);
note(p.front,'首页与导航',
  '入口 `index.html`。`assets/app.js` 管理栏目路由、游戏入口与资料界面；帖子路由由 `assets/posts-ui.js` 配合处理。主页采用水浒双图、居中金句、资料入口，以及最新帖子与紧凑游戏入口。\n\n'+
  '游戏跳转沿用暖白、宋体标题与朱红三点加载动画；已有防闪烁与等待机制。',
  [p.art,p.quotes,p.library,p.posts,p.chess,p.snake,p.decisions],['index.html','assets/app.js','assets/style.css','assets/daily.css','assets/page-transition.js']);
note(p.library,'资料仓库',
  '静态文件目录由 `assets/resources.js` 登记，`path` 相对于 `资料/`。仅将文件放进文件夹不会自动出现在网页上。\n\n'+
  '支持搜索、类型筛选、分页、预览与下载。水浒图片条目来自共用的 `assets/artworks.js`。当前登记 '+resources.length+' 份资料。新增文档应同步核对实际文件大小和下载路径，更新入口缓存版本。',
  [p.art,p.posts,p.dc2,p.dc3,p.dc4,p.release],['assets/resources.js','assets/app.js','README.md']);
note(p.posts,'帖子发布',
  '静态帖子源为 `posts/posts.js`，写帖工具为 `posts/editor.html`。支持正文、分类、摘要、搜索、分享路由和本地图片；不执行正文 HTML。\n\n'+
  '可用写帖工具导出完整 posts.js 再替换，配图另存并随站点上传。导入 Word 时保留正文、截图和原件，不虚构未提供的实验步骤。现有公开帖子 '+posts.length+' 篇。',
  [p.library,p.dc2,p.dc3,p.dc4,p.release],['posts/README.md','posts/posts.js','posts/editor.html','assets/posts-core.js','assets/posts-ui.js']);
note(p.art,'水浒图集',
  '当前目录 '+artworks.length+' 张，源文件位于 `资料/水浒人物/`；题字描述保存在 `assets/artworks.js`，用于首页与资料列表。\n\n'+
  '按北京时间每小时整点选择有关联的双图，同一小时刷新不改变内容。关联表维护人物别称、亲属搭档和情节组；同人物多幅画像自动配对。一轮内同图不重复，落单图优先留到下轮，无关联图不强行凑对。原图题字未识别部分保留“〔未辨〕”。',
  [p.front,p.library,p.quotes,p.decisions],['assets/artworks.js','assets/artwork-relations.js','assets/daily-core.js','assets/daily-ui.js']);
note(p.quotes,'金句摘选',
  '使用 `金句/金句.xlsx`，三列表头为出处、作者、内容。线上自动读取表格，本地双击网页时通过页脚选择 Excel 预览。\n\n'+
  '按北京时间每天零点更换一条，独立于水浒图片的小时排期。具体记录以 Excel 为准。用户最终决定保持现有字体，之前的字体对比稿不应用到正式页面。',
  [p.front,p.art,p.decisions],['金句/README.md','assets/quotes-xlsx.js','assets/daily-core.js','assets/daily-ui.js','assets/daily.css']);
note(p.chess,'象棋',
  '网页入口为 `chess/index.html`。基础规则位于 engine.js，界面、交互和对局调度在 game.js，技能在 skills.js。盲棋规则独立于标准象棋。\n\n'+
  '提供挑战、娱乐、练习与盲棋模式。修改模式规则时要同步核对电脑 Worker、悔棋、界面提示和规则说明，保留游戏加载转场。',
  [p.blind,p.training,p.front,p.release],['chess/index.html','chess/engine.js','chess/game.js','chess/skills.js']);
note(p.blind,'盲棋规则',text('chess/盲棋规则.md').replace(/^# .+\r?\n/,''),
  [p.chess,p.decisions,p.release],['chess/盲棋规则.md','chess/blind.js','chess/blind.test.cjs']);
note(p.training,'练习指导与沙盘',
  '练习模式在己方回合提供有限搜索的参考走法、原因、应手和受攻击棋子提示。立即回吃分析不代表完整多回合交换得失。\n\n'+
  '练习和娱乐模式可进入独立沙盘，支持双方手动走棋、电脑一步、前进后退与多个分支；退出恢复实战局面。盲棋不使用普通象棋沙盘，登岛后的娱乐局面也不适用。',
  [p.chess,p.blind,p.release],['chess/training.js','chess/training.test.cjs','chess/game.js']);
note(p.snake,'贪吃蛇',
  '游戏位于 `gameGPT/neon-serpent/dist/`，主要浏览器文件为 index.html、style.css 和 game.js。博客使用本地 SVG 封面与同页跳转加载转场。\n\n修改博客入口不等于修改游戏内部规则；需要变更游戏时以该目录当前代码为准。',
  [p.front,p.release],['gameGPT/neon-serpent/dist/index.html','gameGPT/neon-serpent/dist/style.css','gameGPT/neon-serpent/dist/game.js']);
for(const [id,key,document] of [
  ['dc2-walkthrough','dc2','DC-2流程——万不言.docx'],
  ['dc3-walkthrough','dc3','DC-3全流程——万不言.docx'],
  ['dc4-walkthrough','dc4','DC4——万不言.docx']
]) {
  const post=posts.find(post=>post.id===id);
  if(!post) continue;
  const imageCount=(post.content.match(/!\[/g)||[]).length;
  note(p[key],post.title,'日期：'+post.date+'。分类：'+post.category+'。\n\n'+post.excerpt+
    '\n\n帖子 ID：`'+post.id+'`。正文引用图片 '+imageCount+' 次。资料原件：`资料/'+document+'`。\n\n'+
    (key==='dc2'?'用户后来要求恢复资料仓库中的 DC-2 文档，帖子与资料均保留，原帖子附件下载路径也保留。':key==='dc4'?'原文记录到交互式 Shell 阶段，不声称已完成后续提权。':'帖子与资料共用原始文档下载。'),
    [p.posts,p.library,p.release],['posts/posts.js','资料/'+document]);
}
const canvasNodes=[
  ['home',p.home,0,0,5],['front',p.front,-550,350,4],['library',p.library,0,350,4],['posts',p.posts,550,350,4],
  ['art',p.art,-800,730,3],['quotes',p.quotes,-350,730,3],['chess',p.chess,1000,0,2],['blind',p.blind,1000,400,2],
  ['training',p.training,1450,400,2],['snake',p.snake,1450,0,2],['dc2',p.dc2,150,830,6],['dc3',p.dc3,600,830,6],
  ['dc4',p.dc4,1050,830,6],['state',p.state,-550,-400,1],['decisions',p.decisions,0,-400,1],['release',p.release,550,-400,1]
].map(([id,file,x,y,color])=>({id,type:'file',file,x,y,width:360,height:230,color:String(color)}));
const relations=[
  ['home','front','页面'],['home','library','资料'],['home','posts','文章'],['home','chess','游戏'],['home','snake','游戏'],
  ['home','state','当前事实'],['home','decisions','用户决定'],['home','release','验证与发布'],
  ['front','art','每小时双图'],['front','quotes','每日金句'],['library','art','共用图片目录'],
  ['posts','dc2','收录'],['posts','dc3','收录'],['posts','dc4','收录'],
  ['library','dc2','原件下载'],['library','dc3','原件下载'],['library','dc4','原件下载'],
  ['chess','blind','独立规则'],['chess','training','练习与推演'],['decisions','blind','一格直行'],['decisions','quotes','保留字体']
];
entries.push({file:'关系图谱.canvas',mode:'canvas',content:JSON.stringify({nodes:canvasNodes.map(node=>({...node,id:'blog-'+node.id})),edges:relations.map(([fromNode,toNode,label],i)=>({id:'blog-edge-'+i,fromNode:'blog-'+fromNode,toNode:'blog-'+toNode,toEnd:'arrow',label}))},null,2)});
const names=new Set(entries.map(entry=>entry.file));
let links=0;
for(const entry of entries) if(entry.file.endsWith('.md')) for(const match of entry.content.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]/g)) {
  const target=match[1];
  if(!names.has(target)&&!names.has(target+'.md')) throw Error('缺失笔记链接：'+target);
  links++;
}
const nodeIds=new Set(canvasNodes.map(node=>node.id));
for(const node of canvasNodes) if(!names.has(node.file)) throw Error('Canvas 引用了不存在的笔记');
for(const [from,to] of relations) if(!nodeIds.has(from)||!nodeIds.has(to)) throw Error('Canvas 边指向不存在的节点');
fs.mkdirSync(stage,{recursive:true});
function contained(base,file) {
  const result=path.resolve(base,file);
  if(!result.startsWith(path.resolve(base)+path.sep)) throw Error('目标路径超出项目目录');
  let cursor=path.dirname(result);
  while(cursor!==path.dirname(base)&&cursor.startsWith(path.resolve(base))) {
    if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink()) throw Error('拒绝写入符号链接目录');
    if(cursor===path.resolve(base)) break;
    cursor=path.dirname(cursor);
  }
  if(fs.existsSync(result)&&fs.lstatSync(result).isSymbolicLink()) throw Error('拒绝覆盖符号链接文件');
  return result;
}
for(const entry of entries) {
  const output=contained(stage,entry.file);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,entry.content+'\n');
}
fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({identity,vault,generatedAt:stamp,notes:entries.filter(e=>e.file.endsWith('.md')).length,links,canvasNodes:canvasNodes.length,canvasEdges:relations.length,files:entries.map(({file,mode})=>({file,mode}))},null,2));
if(!process.argv.includes('--apply')) {
  console.log(JSON.stringify({prepared:stage,target:vault,notes:entries.length-1,links,canvasNodes:canvasNodes.length,canvasEdges:relations.length,applied:false}));
  process.exit(0);
}
const marker=path.join(vault,'.project-memory','identity.json');
if(path.basename(vault)!=='万不言博客项目库') throw Error('目标笔记库不匹配');
if(fs.existsSync(vault)) {
  if(fs.lstatSync(vault).isSymbolicLink()) throw Error('目标笔记库是符号链接');
  if(fs.existsSync(marker)) { if(JSON.parse(fs.readFileSync(marker,'utf8')).identity!==identity) throw Error('笔记库标识不匹配'); }
  else if(fs.readdirSync(vault).length) throw Error('目标已有其他内容，不覆盖现有笔记库');
}
const backup=[];
const backupFile=path.join(vault,'.project-memory','backups',Date.now()+'-'+crypto.randomBytes(3).toString('hex')+'.json');
const taskFile=path.join(__dirname,'obsidian-entry.json');
const task=fs.existsSync(taskFile)?JSON.parse(fs.readFileSync(taskFile,'utf8')):null;
if(task&&(typeof task.summary!=='string'||typeof task.validation!=='string')) throw Error('任务日志需要 summary 和 validation');
// 先核对已有文件，再开始修改，避免遇到用户笔记冲突后只同步一半。
for(const entry of entries) {
  const target=contained(vault,entry.file);
  if(!fs.existsSync(target)||entry.mode==='init') continue;
  const old=fs.readFileSync(target,'utf8');
  if(entry.mode==='managed') mergeNote(old,entry.content);
  if(entry.mode==='canvas') mergeCanvas(old,entry.content);
}
function write(file,content,mode='managed') {
  const target=contained(vault,file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const old=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
  if(mode==='init'&&old!==null) return;
  let next=content+'\n';
  if(mode==='managed') next=mergeNote(old,content);
  if(mode==='canvas') next=mergeCanvas(old,content);
  if(next===old) return;
  if(old!==null) {
    backup.push({file,content:old});
    fs.mkdirSync(path.dirname(backupFile),{recursive:true});
    fs.writeFileSync(backupFile,JSON.stringify({savedAt:stamp,files:backup},null,2));
  }
  const temporary=target+'.project-memory.tmp';
  fs.writeFileSync(temporary,next);
  fs.renameSync(temporary,target);
}
fs.mkdirSync(path.join(vault,'.obsidian'),{recursive:true});
fs.mkdirSync(path.dirname(marker),{recursive:true});
for(const entry of entries) write(entry.file,entry.content,entry.mode);
if(task) {
  const id=crypto.createHash('sha256').update(date+JSON.stringify(task)).digest('hex').slice(0,16);
  const logFile='04 日志/'+date+'.md', logPath=contained(vault,logFile);
  const old=fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'# '+date+'\n\n'+link(p.home)+' · '+link(p.state)+'\n';
  if(!old.includes('entry:'+id)) {
    const pending=Array.isArray(task.pending)?task.pending:[];
    const entry='\n\n## '+stamp+'\n\n<!-- entry:'+id+' -->\n\n'+task.summary+'\n\n验证：'+task.validation+
      (pending.length?'\n\n未完成：\n'+pending.map(item=>'- '+item).join('\n'):'')+'\n';
    write(logFile,old+entry,'log');
  }
}
fs.writeFileSync(marker,JSON.stringify({identity,projectRoot:root,vault,lastSync:stamp,head,notes:entries.length-1,links,canvasNodes:canvasNodes.length,canvasEdges:relations.length},null,2));
console.log(JSON.stringify({applied:true,vault,notes:entries.length-1,links,canvasNodes:canvasNodes.length,canvasEdges:relations.length,backedUpFiles:backup.length}));
