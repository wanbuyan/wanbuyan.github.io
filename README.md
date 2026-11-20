# 万不言的博客

纯静态个人博客，采用原生 HTML、CSS 和 JavaScript。直接双击 `index.html` 即可打开，无需安装依赖、运行命令或启动服务。

当前水浒人物版本的设计规范与素材来源见 [.design/SHUIHU.md](.design/SHUIHU.md)。

## 打开与部署

双击 `index.html`。也可将 `index.html`、`assets/`、`资料/`、`chess/` 和 `gameGPT/` 一起上传到静态托管平台。站内文件采用相对路径，支持部署在子目录中。

## 页面

- 首页：博客介绍、资料入口与游戏预览。
- 资料仓库：静态文件目录，支持按名称、题字描述和子目录搜索、类型筛选、分页、预览和下载。
- 自制游戏：象棋与贪吃蛇，均在新标签页打开现有游戏。
- 随笔、关于：保留待开发状态。
- 首页“原神攻略”：搞怪入口，点击后跳转到指定 B 站视频。

资料目录已登记桌面“水浒插图”中的全部 **181 张**图片，存于 `资料/水浒人物/`，按人物或群像题名命名；同一人物的不同造型使用 `林冲-01.jpeg`、`林冲-02.jpeg` 等序号区分。图片保持原始内容。作者和来源在页面图注与页脚标明。

首页从全部 181 张本地图片中随机选取两张，打开或刷新时重新选择，同次不重复；同一人物不同造型按独立图片抽取。点击图注旁的“换一组”，会更换当前两张图片，并同步名称和题字摘录，新组合不包含刚才的两张。切换栏目保持当前组合。资料页每页 20 条，共 10 页。

描述按图片左右侧题字补充，包含可辨认的人物说明、造型点评、诗句、日期和署款，已做繁简转换和标点整理。`〔未辨〕` 表示尚未确认的原字或句段；目前 66 张仍有此类缺字，不能视为全部题跋均已完整识别。长描述在主页和资料列表中完整显示。部分原图本来只有题名、回目与署款，按其原有文字录入。

原编号、新文件名和描述见 [.design/bulk-import/命名与描述对照.csv](.design/bulk-import/命名与描述对照.csv)，该表也保存在桌面源文件夹。逐图题字及具体待核位置见 [.design/bulk-import/题字整理.md](.design/bulk-import/题字整理.md)；前后对照见 [.design/bulk-import/描述补充对照.csv](.design/bulk-import/描述补充对照.csv)。

## 添加资料

把文件放入 **资料** 文件夹，再在 `assets/resources.js` 中添加相应条目并刷新页面。例如文件位于 `资料/课程/学习笔记.pdf`，填写：

```js
window.BLOG_RESOURCES = [
  ...(window.BLOG_ARTWORKS || []).map(artwork => ({
    name: artwork.fileName, path: artwork.path, type: "image",
    size: artwork.size, description: artwork.description
  })),
  { name: "学习笔记.pdf", path: "课程/学习笔记.pdf", description: "课程笔记" }
];
```

`path` 相对于 `资料/`，路径分隔使用 `/`，支持中文、空格和子文件夹。`name` 可省略，默认使用文件名。类型按后缀自动识别；可选 `size` 字段为字节数，未填写时不显示大小；`description` 为说明文字，也参与搜索。

修改水浒图片描述时，编辑 `assets/artworks.js` 中对应图片的 `description`，首页和资料列表会同时更新。新增可供首页抽取的图片，也需在该文件中填写唯一 `id`、`character`、`fileName`、`path`、`src`、`size`、`width`、`height` 和 `description`。`src` 包含 `资料/` 前缀，`path` 不包含。已有记录可作为格式示例。

纯静态页面不能自动扫描本地文件夹，因此新增文件时需要同步维护目录。浏览器支持的文件可直接预览，其他文件下载后打开。

## 目录

```text
index.html            博客入口
assets/resources.js   资料静态目录
assets/artworks.js    水浒图集名称、路径和题字描述
assets/               博客样式、脚本和游戏真实预览图
资料/                 存放自己的学习资料
资料/水浒人物/        181 张按题名整理的图片
chess/                现有象棋游戏
gameGPT/neon-serpent/dist/  现有贪吃蛇游戏
```

网站没有 API、后端、启动脚本或数据库。
