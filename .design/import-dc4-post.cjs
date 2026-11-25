/* 先用 import-dc2.ps1 的通用参数提取 DC4，再导入静态帖子。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const extracted = JSON.parse(fs.readFileSync(path.join(__dirname,'qa/dc4-extracted.json'),'utf8'));
const file = path.join(root,'posts/posts.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const headings = {
  1:'靶机与开放端口', 6:'HTTP 后台与登录验证',
  17:'命令执行', 30:'交互式 Shell'
};
// 保留正文与全部截图；账号直接转录自原图，不补写原文未提供的连接命令或后续提权步骤。
const formatted = {
  2:'靶机 IP 为 `192.168.139.136`。',
  4:'端口 `22`：SSH。',
  5:'端口 `80`：HTTP。',
  7:'访问 80 端口的页面，进入 Admin Information Systems 登录界面。',
  8:'进行账号密码爆破。原图中标出的用户名为 `admin`，密码为 `happy`。',
  17:'登录后台后发现命令执行漏洞。原文记录通过抓包修改命令内容来执行其他命令。',
  30:'原文记录已取得交互式 Shell，下图为对应的连接记录。'
};
const blocks=['DC-4 靶场实验记录，包含端口扫描、HTTP 后台登录、命令执行和交互式 Shell。'];
let imageCount=0, textCount=0;
for(const paragraph of extracted.paragraphs) {
  if(headings[paragraph.index]) blocks.push('## '+headings[paragraph.index]);
  for(const part of paragraph.parts) {
    if(part.type==='text') {
      const text=part.text.trim(); if(!text) continue;
      blocks.push(formatted[paragraph.index]??text);
      textCount++;
    } else if(part.type==='image') {
      imageCount++;
      const index=Object.keys(headings).map(Number).filter(i=>i<=paragraph.index).at(-1);
      blocks.push('!['+headings[index]+'，原文截图 '+imageCount+']('+part.src+')');
    }
  }
}
blocks.push('## 原始文档','[下载 DC4 Word 原件](资料/DC4——万不言.docx)');
const post={id:'dc4-walkthrough',title:'DC4——万不言',date:'2026-11-25',category:'靶场记录',
  excerpt:'DC-4 实验记录：端口扫描、后台登录验证、命令执行与交互式 Shell，附 5 张原始截图和 Word 文档。',
  content:blocks.join('\n\n')};
const posts=[post,...context.window.BLOG_POSTS.filter(item=>item.id!==post.id)];
fs.writeFileSync(file,'// 帖子按日期倒序显示。可使用 posts/editor.html 编辑并导出此文件。\nwindow.BLOG_POSTS = '+JSON.stringify(posts,null,2)+';\n');
console.log('Imported DC4: '+textCount+' text blocks, '+imageCount+' screenshots.');
