/* 资料静态目录。path 相对于“资料”文件夹，支持子文件夹。
 * 水浒图片共用 artworks.js 的目录，首页与资料仓库保持同步。
 * 示例（仅说明格式，不会显示在页面中）：
 * { name: "学习笔记.pdf", path: "学习笔记.pdf", size: 102400, description: "课程笔记" }
 * size 单位为字节，可以省略；type 可选 document、code、image、other，默认按后缀分类。
 */
window.BLOG_RESOURCES = [
  {
    "name": "靶场与常见口令字典——万不言.zip",
    "path": "密码字典/靶场与常见口令字典——万不言.zip",
    "type": "other",
    "size": 4951093,
    "description": "精简版，1,102,934 条去重口令候选，保留原字典、公开靶场默认口令与高频常用口令。TXT 小于 10 MB，附来源与授权。不保证覆盖所有靶场。"
  },
  {
    name: "DC5——万不言  文件包含  脚本提权.docx",
    path: "DC5——万不言  文件包含  脚本提权.docx",
    type: "document",
    size: 2171803,
    description: "DC-5 靶场实验记录，包含文件包含、错误日志利用、交互式 Shell 与脚本提权，附原始截图。对应帖子可在“帖子”栏目阅读。"
  },
  {
    name: "DC4——万不言.docx",
    path: "DC4——万不言.docx",
    type: "document",
    size: 1259841,
    description: "DC-4 靶场实验记录，包含端口扫描、后台登录、命令执行与交互式 Shell，附原始截图。对应帖子可在“帖子”栏目阅读。"
  },
  {
    name: "DC-3全流程——万不言.docx",
    path: "DC-3全流程——万不言.docx",
    type: "document",
    size: 9453018,
    description: "DC-3 靶场全流程，包含 Joomla 扫描、SQL 注入、账号获取、终端连接与本地提权。对应帖子可在“帖子”栏目阅读。"
  },
  {
    name: "DC-2流程——万不言.docx",
    path: "DC-2流程——万不言.docx",
    type: "document",
    size: 3858572,
    description: "DC-2 靶场流程文档，包含端口扫描、WordPress 账号获取、SSH 登录与 Git 提权。对应帖子可在“帖子”栏目阅读。"
  },
  ...(window.BLOG_ARTWORKS || []).map(artwork => ({
    name: artwork.fileName,
    path: artwork.path,
    type: "image",
    size: artwork.size,
    description: artwork.description
  }))
  // 其他资料可添加在此数组中，条目之间用逗号分隔。
];
