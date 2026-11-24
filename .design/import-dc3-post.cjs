/* 先用 import-dc2.ps1 的通用参数提取 DC-3，再导入静态帖子。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname,'..');
const extracted = JSON.parse(fs.readFileSync(path.join(__dirname,'qa/dc3-extracted.json'),'utf8'));
const file = path.join(root,'posts/posts.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);
const headings = {
  0:'确认靶机与开放端口', 15:'Joomla 扫描与后台入口',
  31:'SQL 注入与数据库信息', 51:'枚举数据表与账号字段',
  71:'密码破解与后台登录', 77:'连接终端与交互式 Shell',
  96:'本地提权', 129:'获取 Flag 与完成实验'
};
const commandParagraphs = new Set([18,19,23,33,40,45,52,65,68,81,93,112,119,122,124]);
const code = value => '```sh\n'+value+'\n```';
// 仅整理文章结构、标点和命令排版；原文中的实验地址、命令参数与截图保持原样。
const formatted = {
  0:'确认靶机 IP。', 3:'扫描开放端口。',
  5:'发现 80 端口开放，尝试在浏览器中打开。',
  8:'页面提示只有一个 Flag。', 9:'目标是提权获得 root 权限。',
  10:'也可以使用 Nikto 进行扫描。',
  15:'从端口扫描中识别出 CMS 为 Joomla，使用 JoomScan 进一步扫描。',
  16:'先安装 JoomScan。', 17:'更新软件源并检查软件包：',
  20:'安装：\n\n'+code('apt install joomscan -y'),
  22:'开始扫描：', 25:'获得 Joomla 版本和后台地址后，访问后台。',
  28:'进入登录页面。', 31:'使用 SearchSploit 检查对应版本的漏洞。',
  34:'选择 SQL 注入漏洞。', 36:'将对应文件复制到桌面。', 39:'运行以下命令：',
  43:'枚举出五个数据库。', 44:'查找与 Joomla 有关的数据库。',
  46:'获得当前数据库 `joomladb`。', 48:'选择 `joomladb`。',
  51:'继续枚举数据表。', 54:'找到与用户信息有关的数据表。',
  64:'继续获取字段名。', 67:'获取目标字段 `username` 和 `password`。',
  70:'获得用户名和加密后的密码。', 71:'使用 John 破解密码。',
  73:'用户名为 `admin`，密码为 `snoopy`。', 74:'登录后台。',
  77:'使用蚁剑连接并打开终端。', 78:'将 Shell 连接回 Kali。',
  79:'Kali 打开监听：\n\n'+code('nc -lvnp 1234'),
  80:'在蚁剑终端中输入原文的连接命令：',
  82:'命令中的 `192.168.203.133` 为原文填写的 Kali IP。',
  84:'连接成功。', 91:'当前为普通 Shell，输入缺少回显。',
  92:'切换到交互式 Shell：', 95:'进入靶机 Shell。',
  96:'接下来进行本地提权。',
  98:'使用辅助脚本探测可能适用的提权漏洞。',
  99:'辅助脚本为 `Linux-Exploit-Suggester.sh`。',
  101:'原文给出的项目名称：',
  107:'从检测结果中选择一个漏洞脚本下载。',
  108:'下载后通过蚁剑上传到靶机执行。',
  110:'无法直接上传已解压的内容。',111:'在命令行中解压上传的压缩包：',
  118:'继续解压 tar 文件：',121:'运行编译脚本和程序：',
  127:'提权成功，获得 root 权限。',129:'获得 Flag。',
  130:'修改密码后，也可以登录 DC-3。',133:'完成。',142:'——万不言'
};
const blocks=['DC-3 靶场实验记录，包含主机发现、Joomla 扫描、SQL 注入、后台登录、终端连接和本地提权。'];
let imageCount=0, textCount=0;
for(const paragraph of extracted.paragraphs) {
  if(headings[paragraph.index]) blocks.push('## '+headings[paragraph.index]);
  for(const part of paragraph.parts) {
    if(part.type==='text') {
      const text=part.text.trim(); if(!text) continue;
      blocks.push(commandParagraphs.has(paragraph.index)?code(text):formatted[paragraph.index]??text);
      textCount++;
    } else if(part.type==='image') {
      imageCount++;
      const index=Object.keys(headings).map(Number).filter(i=>i<=paragraph.index).at(-1);
      blocks.push('!['+headings[index]+'，原文截图 '+imageCount+']('+part.src+')');
    }
  }
}
blocks.push('## 原始文档','[下载 DC-3 全流程 Word 原件](资料/DC-3全流程——万不言.docx)');
const post={id:'dc3-walkthrough',title:'DC-3全流程——万不言',date:'2026-11-24',category:'靶场记录',
  excerpt:'DC-3 靶场完整记录：Joomla 扫描、SQL 注入、账号获取、终端连接与本地提权，附原始截图和 Word 文档。',
  content:blocks.join('\n\n')};
const posts=[post,...context.window.BLOG_POSTS.filter(item=>item.id!==post.id)];
fs.writeFileSync(file,'// 帖子按日期倒序显示。可使用 posts/editor.html 编辑并导出此文件。\nwindow.BLOG_POSTS = '+JSON.stringify(posts,null,2)+';\n');
console.log('Imported DC-3: '+textCount+' text blocks, '+imageCount+' screenshots.');
