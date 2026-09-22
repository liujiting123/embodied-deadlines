# Embodied Deadlines

具身智能会议的精简投稿日历。默认关注 CoRL、RSS、ICRA、IROS、NeurIPS、ICLR、ICML、CVPR、ICCV、ECCV 和 RLC；AAAI、IJCAI 可通过备选开关显示。

[打开网站](https://liujiting123.github.io/embodied-deadlines/)

支持按方向、会议年份和投稿状态筛选，切换北京时间 / UTC / 官方时区，并查看全年往届投稿节奏。精确倒计时只用于官方已公布并核实了时区的截止时间。

## 数据

唯一数据入口是 [`data/conferences.json`](data/conferences.json)。日期当前核对至 **2026-09-23**，后续需人工更新该文件；页面倒计时自动计算，不会自动抓取新一届 CFP。

- `editions[].year` 是会议年份，可能与投稿年份不同。
- `paperDeadline` / `abstractDeadline` 必须使用包含明确 UTC 偏移的 ISO 8601 时间；未知填 `null`。
- 只公布日期、未核实时区时使用 `paperDeadlineDate`（`YYYY-MM-DD`），不显示精确倒计时。
- CVPR、ICCV、ECCV 的 `abstractDeadline` 表示论文注册截止。
- `cycleMonths` 是往届全文截稿节奏，不是下一届确定日期。ICCV 和 ECCV 隔年举行。
- 每个轮次保留 `sourceUrl`、`verifiedAt` 和来源说明 `sourceNote`。`note` 仅存需要在页面展示的简短信息。
- 日期发生变动时，更新对应条目、`verifiedAt` 和顶层 `updatedAt`，再推送到 `main`。

CCF 分级采用 **2026 年正式第七版（4 月 9 日勘误版）**，以[正式 PDF](https://www.ccf.org.cn/ccf/contentcore/resource/download?ID=112CF3BF7E1140ACEB271ADAED12A67ADFABB8FF099E40C2759502A85C8A281F)的人工智能会议表（第 57–59 页）为准。[CCF 发布入口](https://www.ccf.org.cn/Academic_Evaluation/By_category/)。未收录用 `null` 表示，不等于 C 类。部分分领域 HTML 页面仍可能显示旧目录。

## 运行与部署

纯静态 HTML / CSS / JavaScript，无第三方依赖和构建步骤。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
node --test tests/deadlines.test.mjs
```

GitHub Pages 使用 `main` 分支根目录发布，`.nojekyll` 禁用 Jekyll。所有页面资源使用相对路径，支持 GitHub Pages 项目子路径。推送 `main` 后 GitHub 自动发布。

页面支持链接参数，例如 `?sub=RO`、`?year=2027`、`?status=open`、`?backup=1`，可组合使用。

设计参考 [AI Conference Deadlines](https://mlciv.com/ai-deadlines/?sub=CV,RO)，页面独立实现；会议事实取自各会议官方来源。
