// 帖子按日期倒序显示。可使用 posts/editor.html 编辑并导出此文件。
window.BLOG_POSTS = [
  {
    "id": "dc2-walkthrough",
    "title": "DC-2靶场全流程——万不言",
    "date": "2026-11-23",
    "category": "靶场记录",
    "excerpt": "DC-2 靶场完整记录：Nmap 扫描、WordPress 账号获取、SSH 登录、受限 Shell 绕过与 Git 提权，附原始截图。",
    "content": "记录 DC-2 靶场从主机发现、WordPress 账号获取、SSH 登录到 Git 提权的完整过程。实验中的靶机 IP 为 `192.168.139.134`，域名为 `dc-2`。\n\n## 确认靶机与开放端口\n\n使用 Nmap 确认靶机 IP。\n\n![确认靶机与开放端口，原文截图 1](posts/images/dc2/screenshot-01.png)\n\n确定靶机 IP 为 `192.168.139.134`。\n\n对靶机进行全端口扫描：\n\n```sh\nnmap -A -p- 192.168.139.134\n```\n\n![确认靶机与开放端口，原文截图 2](posts/images/dc2/screenshot-02.png)\n\n确定开放端口为 `80` 和 `7744`。\n\n浏览器访问 `192.168.139.134:80`，发现需要进行本地域名解析。\n\n![确认靶机与开放端口，原文截图 3](posts/images/dc2/screenshot-03.png)\n\n绑定域名后进入 WordPress 页面。\n\n![确认靶机与开放端口，原文截图 4](posts/images/dc2/screenshot-04.png)\n\n## Flag 1 与 WordPress 账号\n\n在页面中发现 Flag 1。\n\n![Flag 1 与 WordPress 账号，原文截图 5](posts/images/dc2/screenshot-05.png)\n\n根据提示，使用 CeWL 抓取网页内容生成密码字典：\n\n```sh\ncewl http://dc-2 -w pass.txt\n```\n\n![Flag 1 与 WordPress 账号，原文截图 6](posts/images/dc2/screenshot-06.png)\n\n使用 WPScan 枚举用户名，再配合密码字典进行爆破。\n\n![Flag 1 与 WordPress 账号，原文截图 7](posts/images/dc2/screenshot-07.png)\n\n![Flag 1 与 WordPress 账号，原文截图 8](posts/images/dc2/screenshot-08.png)\n\n开始爆破：\n\n```sh\nwpscan --url http://dc-2 -U users.txt -P pass.txt\n```\n\n![Flag 1 与 WordPress 账号，原文截图 9](posts/images/dc2/screenshot-09.png)\n\n获得两组用户名和密码：\n\n- 用户名 `tom`，密码 `parturient`。\n- 用户名 `jerry`，密码 `adipiscing`。\n\n## 登录后台获取 Flag 2\n\n使用获得的账号登录 WordPress 后台。\n\n后台地址为 `http://dc-2/wp-admin`。\n\n使用 `jerry:adipiscing` 登录，发现 Flag 2。\n\n![登录后台获取 Flag 2，原文截图 10](posts/images/dc2/screenshot-10.png)\n\nFlag 2 提示使用另一个端口。\n\n## SSH 登录\n\n尝试通过 SSH 连接 `7744` 端口。\n\n```sh\nssh tom@dc-2 -p 7744\n```\n\n密码为 `parturient`。\n\n![SSH 登录，原文截图 11](posts/images/dc2/screenshot-11.png)\n\n登录后发现命令受限，只能使用 `ls` 等已允许的命令。\n\n能够看到 `flag3.txt`，但直接执行 `cat` 失败。\n\n## 绕过受限 Shell\n\n执行以下命令绕过限制，并补充命令搜索路径：\n\n```sh\nBASH_CMDS[a]=/bin/sh;a\n```\n\n将 `/bin/sh` 绑定到命令 `a` 后执行。\n\n```sh\nexport PATH=$PATH:/bin/\n```\n\n```sh\nexport PATH=$PATH:/usr/bin\n```\n\n![绕过受限 Shell，原文截图 12](posts/images/dc2/screenshot-12.png)\n\n## Flag 3 与 Flag 4\n\n读取 `flag3.txt`。\n\n根据 Flag 3 的提示切换到 `jerry` 用户。\n\n切换用户后仍处于 `/home/tom` 目录。进入 Jerry 的家目录 `/home/jerry`，读取 `flag4.txt`。\n\n![Flag 3 与 Flag 4，原文截图 13](posts/images/dc2/screenshot-11.png)\n\n## Git 提权与最终 Flag\n\n执行 `sudo -l`，发现可以无密码以 root 权限运行 Git。\n\n打开 Git 帮助页面：\n\n```sh\nsudo git help status\n```\n\n在帮助页中输入 `!/bin/sh`，获得 root Shell。\n\n![Git 提权与最终 Flag，原文截图 14](posts/images/dc2/screenshot-13.png)\n\n切换到 `/root` 目录。\n\n使用 `ls` 发现最终 Flag 文件。\n\n使用 `cat` 读取文件，完成靶场流程。\n\n![Git 提权与最终 Flag，原文截图 15](posts/images/dc2/screenshot-14.png)\n\n## 原始文档\n\n[下载 DC-2 靶场全流程 Word 原件](posts/files/DC-2靶场全流程——万不言.docx)"
  },
  {
    "id": "chess-practice-and-sandbox",
    "title": "象棋：练习指导与沙盘推演",
    "date": "2026-11-23",
    "category": "更新记录",
    "excerpt": "新增参考走法、受攻击棋子提示，以及练习模式和娱乐对局中的沙盘推演。",
    "content": "## 练习指导\n\n练习模式会在己方回合分析局面，给出一手参考走法和原因。点击“显示参考走法”，可以在棋盘上查看走子路线与对方可能的应手。\n\n受攻击的棋子会列在指导面板中。橙框表示存在直接丢子或不利交换风险，虚线表示可以立即回吃。点击列表中的棋子，可以查看攻击路线。选子后，带感叹号的落点表示走到那里可能被直接吃取。\n\n提示采用有限搜索；交换判断只检查立即回吃，不代表完整的多回合得失。\n\n## 沙盘推演\n\n练习模式和娱乐对局都可以进入沙盘。\n\n- 从当前棋局复制一份独立局面，原对局暂停。\n- 可手动操作红黑双方，也可以点击“电脑走一步”。\n- 支持后退、前进、回到起点。\n- 后退后改走会保留原分支，可在分支列表中切换。\n- 点击“退出沙盘，返回对局”，恢复原棋局与走棋记录。\n\n登岛后的娱乐局面不适用普通象棋推演，请在登岛前使用沙盘。"
  }
];
