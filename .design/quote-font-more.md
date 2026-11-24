# 楷书与瘦金字体候选

延续上一组的暖白 #f8f7f3、正文 #292a26、说明 #717368 与朱红编号 #a93627。桌面正文统一 32px、400 字重、1.85 行高、.025em 字距；手机 25px，自然换行。出处和说明统一 13px。无动效，不修改正式主页。

楷书方向：

1. 楷体 KaiTi：上一组中用户关注的楷体，保留为参照。
2. 华文楷体 STKaiti：与楷体相比，笔画和结体更圆润。
3. [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)：作者官方 v1.530 Regular 原字库，OFL；预览文件保存在忽略提交的 qa/font-options 中。
4. [马善政毛笔楷书](https://github.com/google/fonts/tree/main/ofl/mashanzheng)：Google Fonts 提供的正文样字子集，字体文件实际为 TrueType。

瘦金方向：

5. [三极瘦金体简](https://www.sjtype.com/free.php?id=65)：使用官网公开试排加载的真实字体制作本地样图。
6. [方正瘦金书](https://www.foundertype.com/index.php/FontInfo/index/id/150.html)：官网静态示例字库仅包含部分字形，不能完整覆盖晏殊这句诗。使用官方示例“三更灯火五更鸡，正是男儿读书时。”，图片中明确标示，不用其他字体补出缺字。

比较页面分别为 quote-font-kai.html、quote-font-shoujin.html；由 Chrome 实际渲染，并通过 CSS.getPlatformFontsForNode 核对字体名称与字形数量。预览字体与原始网页均在已被 .gitignore 排除的 .design/qa 中，未纳入正式网站字体资产；选择后再按相应来源提供的许可接入。

## 新增楷体 7—12

保持前一组的文案、字号、间距和配色，拆成每页三款的两张图，手机自然换行。所有正文均通过浏览器字体检查，无缺字回退：

7. [三极楷书](https://www.sjtype.com/new_product_show.php?id=436)，实际字体 SJkaishu-Regular。
8. [三极古拙楷书](https://www.sjtype.com/new_product_show.php?id=658)，实际字体 SJgzks-Regular。
9. [三极古拙楷书简](https://www.sjtype.com/new_product_show.php?id=32)，实际字体 SJgzks，与第 8 款为不同字库。
10. [三极榜楷体](https://www.sjtype.com/new_product_show.php?id=657)，实际字体 SJbangkaiti。
11. [霞鹜臻楷 GB](https://github.com/lxgw/LxgwZhenKai)，通过作者认可的 ZeoSeven Fonts 网页字体服务取得，实际字体 LXGWZhenKaiGB，服务提供版本 0.825；仅载入覆盖样句的 13 个字形分包。
12. [三极思诺行楷](https://www.sjtype.com/new_product_show.php?id=742)，实际字体 SJsinuoxingkai，明确标为偏行楷的候选。

三极字库的预览文件均来自各自官方产品页面公开加载的试排资源。对应网页为 quote-font-kai-7-9.html 和 quote-font-kai-10-12.html；本次仍仅制作字体预览，不改主页。
