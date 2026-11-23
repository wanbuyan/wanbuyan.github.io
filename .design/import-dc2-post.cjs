/* 先用 import-dc2.ps1 提取原始段落与截图，再生成静态帖子。 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const extracted = JSON.parse(fs.readFileSync(path.join(__dirname,'qa/dc2-extracted.json'),'utf8'));
const postFile = path.join(root,'posts/posts.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(postFile,'utf8'),context);
const headings = {
  0: '确认靶机与开放端口', 10: 'Flag 1 与 WordPress 账号',
  33: '登录后台获取 Flag 2', 38: 'SSH 登录',
  43: '绕过受限 Shell', 48: 'Flag 3 与 Flag 4', 55: 'Git 提权与最终 Flag'
};
const code = text => '```sh\n' + text + '\n```';
// 仅整理分段、命令格式，以及可由原截图直接核对的笔误。
const formatted = {
  0: '使用 Nmap 确认靶机 IP。',
  2: '确定靶机 IP 为 `192.168.139.134`。',
  3: '对靶机进行全端口扫描：\n\n' + code('nmap -A -p- 192.168.139.134'),
  4: '确定开放端口为 `80` 和 `7744`。',
  5: '浏览器访问 `192.168.139.134:80`，发现需要进行本地域名解析。',
  7: '绑定域名后进入 WordPress 页面。',
  10: '在页面中发现 Flag 1。',
  11: '根据提示，使用 CeWL 抓取网页内容生成密码字典：',
  12: code('cewl http://dc-2 -w pass.txt'),
  14: '使用 WPScan 枚举用户名，再配合密码字典进行爆破。',
  17: '开始爆破：\n\n' + code('wpscan --url http://dc-2 -U users.txt -P pass.txt'),
  20: '获得两组用户名和密码：',
  21: '- 用户名 `tom`，密码 `parturient`。\n- 用户名 `jerry`，密码 `adipiscing`。',
  33: '使用获得的账号登录 WordPress 后台。',
  34: '后台地址为 `http://dc-2/wp-admin`。',
  35: '使用 `jerry:adipiscing` 登录，发现 Flag 2。',
  37: 'Flag 2 提示使用另一个端口。',
  38: '尝试通过 SSH 连接 `7744` 端口。',
  39: code('ssh tom@dc-2 -p 7744') + '\n\n密码为 `parturient`。',
  41: '登录后发现命令受限，只能使用 `ls` 等已允许的命令。',
  42: '能够看到 `flag3.txt`，但直接执行 `cat` 失败。',
  43: '执行以下命令绕过限制，并补充命令搜索路径：',
  44: code('BASH_CMDS[a]=/bin/sh;a') + '\n\n将 `/bin/sh` 绑定到命令 `a` 后执行。',
  45: code('export PATH=$PATH:/bin/'),
  46: code('export PATH=$PATH:/usr/bin'),
  48: '读取 `flag3.txt`。',
  49: '根据 Flag 3 的提示切换到 `jerry` 用户。',
  52: '切换用户后仍处于 `/home/tom` 目录。进入 Jerry 的家目录 `/home/jerry`，读取 `flag4.txt`。',
  55: '执行 `sudo -l`，发现可以无密码以 root 权限运行 Git。',
  56: '打开 Git 帮助页面：\n\n' + code('sudo git help status') + '\n\n在帮助页中输入 `!/bin/sh`，获得 root Shell。',
  57: '切换到 `/root` 目录。',
  58: '使用 `ls` 发现最终 Flag 文件。',
  59: '使用 `cat` 读取文件，完成靶场流程。'
};
const blocks = ['记录 DC-2 靶场从主机发现、WordPress 账号获取、SSH 登录到 Git 提权的完整过程。实验中的靶机 IP 为 `192.168.139.134`，域名为 `dc-2`。'];
let imageOccurrences = 0;
for (const paragraph of extracted.paragraphs) {
  if (headings[paragraph.index]) blocks.push('## ' + headings[paragraph.index]);
  for (const part of paragraph.parts) {
    if (part.type === 'text') blocks.push(formatted[paragraph.index] ?? part.text);
    else if (part.type === 'image') {
      imageOccurrences++;
      const nearestHeading = Object.keys(headings).map(Number).filter(i=>i<=paragraph.index).at(-1);
      blocks.push('![' + headings[nearestHeading] + '，原文截图 ' + imageOccurrences + '](' + part.src + ')');
    }
  }
}
blocks.push('## 原始文档', '[下载 DC-2 靶场全流程 Word 原件](posts/files/DC-2靶场全流程——万不言.docx)');
const post = {
  id: 'dc2-walkthrough', title: 'DC-2靶场全流程——万不言', date: '2026-11-23', category: '靶场记录',
  excerpt: 'DC-2 靶场完整记录：Nmap 扫描、WordPress 账号获取、SSH 登录、受限 Shell 绕过与 Git 提权，附原始截图。',
  content: blocks.join('\n\n')
};
const posts = [post,...context.window.BLOG_POSTS.filter(item=>item.id!==post.id)];
fs.writeFileSync(postFile,'// 帖子按日期倒序显示。可使用 posts/editor.html 编辑并导出此文件。\nwindow.BLOG_POSTS = ' + JSON.stringify(posts,null,2) + ';\n');
console.log('Created DC-2 post with ' + extracted.imageCount + ' unique images and ' + imageOccurrences + ' image occurrences.');
