# 首版验收记录（PRD §15）

日期：2026-08-12  
环境：Windows · Node 22 · 本地 SQLite `data/app.sqlite`  
自动化依据：`pnpm db:accept`、`pnpm --filter @cocktail/domain test`、`pnpm --filter @cocktail/server test`、`pnpm --filter @cocktail/web build`

## 1. 数据验收

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 现行 IBA 配方全部录入 | ✅（相对本地语料） | `data/iba/recipes/iba_recipes.json` 中全部 `new_recipe` 已 published；语料为可审计本地快照（69+），非运行时同步官网 |
| 已发布主版本材料引用有效 Ingredient.id | ✅ | `db:accept`；未映射名进入 `data/iba/pending/unmapped-ingredients.json`，不静默猜测 |
| 每配方有且仅一个主版本 | ✅ | `primary_version_id` 指向唯一主版本 |
| 家族 + ≥1 风味 | ✅ | |
| 用量以毫升存储 | ✅ | `amount_ml`；装饰/糖块等允许 null |

相关：九酒类齐全；无自动灌中国白酒现代配方；Cointreau→Triple Sec 为显式层级。

## 2. 功能验收

| 项 | 状态 | 验证方式 |
| --- | --- | --- |
| 单酒类命中 / 双酒类 AND | ✅ | domain `filters` + API search 冒烟 |
| 齐全 / 缺 1–2 / 排除 ≥3 | ✅ | domain `owned-closure-missing` + `fill-sort` |
| 补足不突破酒类与筛选 | ✅ | domain FR-06 边界（15 / 7 / 混补） |
| 子级满足上级 | ✅ | London Dry Gin→Gin；Gin 不满足 Old Tom |
| 缺料→采购→入柜 | ✅ | server 集成测试 purchase 事务 |
| 推荐 ≤2 且不改排序 | ✅ | domain recommend + search `recommendedIds` |
| 重启后数据保留 | ✅ | SQLite 文件持久化；`pnpm start` 复用 `data/app.sqlite` |

## 3. 用户验收 7 步（可复现）

前置：

```powershell
$env:PATH = "$PWD\.tools\node;$env:PATH"   # 若系统 Node 非 22
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

打开 `http://localhost:5173`（API 在 `8787`，Vite 代理 `/api`）。

| # | 步骤 | 操作 | 期望 |
| --- | --- | --- | --- |
| 1 | 建立/修改酒柜 | 进入「酒柜」→ 主区见「酒柜已有」；在「加入酒柜」中搜索/分类 →「加入酒柜」；可勾选常备辅料 | 主区列出已入柜材料；常备辅料不出现在「加入酒柜」；首页对应酒类可标「已有」 |
| 2 | 一种酒类找配方 | 主页「酒体偏好」只选「金酒」 | 结果均为材料表命中金酒的配方；状态含齐全/缺 n |
| 3 | 两种酒类 AND | 再选第二种（如葡萄酒） | 仅同时命中两类的配方 |
| 4 | 家族与风味 | 勾选家族（符合其中一种即可）与风味（需同时符合） | 结果收窄；URL query 保留条件 |
| 5 | 查看齐全/缺料 | 打开一张卡片进入详情 | 文案「齐全/缺 n 种」「已有/缺少」，非仅颜色 |
| 6 | 采购闭环 | 详情对缺料「加入采购」→ 酒柜「已购买」 | 采购项消失，材料入柜；返回主页后状态更新 |
| 7 | 后台新增可见 | 页脚进后台 → 登录 → 新建配方 → 保存草稿/主版本 → 确认发布 → 回前台搜索或打开 | 前台可见该配方 |

最终成功标准（主观）：至少一条配方对你真正有用——不在产品内埋点，由你自行确认。

## 3a. FR-21 / FR-22 AI 验收（可复现）

权威：`docs/AI_ASSISTANT.md`、PRD FR-21 / FR-22。自动化：`pnpm --filter @cocktail/server test`（含 `ai-import` / `ai-enrich` / `ai-chat`）、`pnpm --filter @cocktail/domain test`（单位换算、确定性映射、候选清洗）。

### 前置（AI）

```powershell
# .env（仅服务端，已 gitignore；勿提交）
# AI_BASE_URL=https://api.siliconflow.cn/v1
# AI_API_KEY=...
# AI_MODEL=deepseek-ai/DeepSeek-V4-Flash
pnpm dev
```

打开 `http://localhost:5173`。后台默认口令见 `.env` / `ADMIN_PASSWORD`（开发默认 `cocktail-admin`）。

### 1）后台导入（FR-21）：解析 → 映射 → 审核 → 草稿 → 发布

| # | 步骤 | 期望 |
| --- | --- | --- |
| 1 | 页脚「管理」→ 登录 → **配方** → **从原文导入** | 向导页；无 Key 时入口禁用并提示，普通 CRUD 仍可用 |
| 2 | 填写来源名称，粘贴一段既有酒谱原文（中/英）→ **解析** | 得到结构化草稿；oz/cl 已转 ml；非体积可有「AI 估算」 |
| 3 | 查看材料映射：确定性命中预填；未命中可有 ≤3 AI 候选（≥0.8 可预选仍须审核） | 不自动建材料/父子；不写正式别名表 |
| 4 | 审核家族/风味建议（可空）、杯具/装饰待确认项 → 手改齐材料映射 → **确认保存为草稿** | 跳转编辑页；`status=draft`；前台搜索不可见 |
| 5 | （可选）再解析：填修正说明 → 再解析 → 确认差异后才覆盖临时草稿 | 无静默覆盖 |
| 6 | 补齐发布必填（主版本、家族、≥1 风味等）→ **发布**（二次确认） | 前台可搜到；未经确认的 AI 中间态未落 SQLite |

### 2）前台聊天（FR-22）

| 场景 | 操作 | 期望 |
| --- | --- | --- |
| 非检索 | 「你好」/「1」/无关玩笑（如「尽可能难喝的酒」） | 仅短回复；**无**配方卡片；**无**临时生成块；不得刷出空条件约 12 条 |
| 有库结果 | 顶栏 **AI 助手** → 如「来一杯金酒的」或已知配方名 | 仅展示库内配方（名称、原因、齐全状态、详情链接），**最多 6 条**；**不**出现临时生成块 |
| 零结果 | 刻意问库中不可能命中的需求（如「火星仙人掌雾气酒 xyz999」） | 临时文本 +「这是临时写的，还没核对过」；**无**保存入口；不伪造权威来源 |
| 无 Key / 断网 | 清空 `AI_API_KEY` 或断网后重启 API → 打开 `/ai` | 入口禁用并提示；首页搜索与酒柜仍可用 |

会话仅浏览器标签页（`sessionStorage`）：站内跳转配方再回来保留；关闭标签页后清空；不落 SQLite。

### 3）安全抽查（Key）

| 检查 | 期望 |
| --- | --- |
| 前端 JS / Network 响应 | `/api/ai/status` 仅 `configured/available/model`，**无** Key；聊天/导入响应体无 Key |
| SQLite | 无存储 `AI_API_KEY` 或完整原文解析过程表 |
| 服务端日志 | 错误文案不回显 Bearer / Key（失败为 HTTP 状态类提示） |
| 配置位置 | 仅根目录 `.env` / 环境变量（见 `.env.example`） |

### 4）已知限制与非目标（AI 相关）

- **不做**：PDF/图片 OCR、空语境凭空生成并入库、临时 AI 配方一键写入正式库、向量 RAG、审计日志与应用层频控（公网前须重评）。
- **中间态**：导入会话与前台聊天不落 SQLite；commit 后只保留最终标准化配方 + 正常来源字段。
- **分类**：草稿可缺家族/风味；**发布**仍走现有校验。

| 项 | 自动化 | 手工 |
| --- | --- | --- |
| FR-21 导入链路 | ✅ mock Provider 集成测 | ✅ 上表 §3a.1 |
| FR-22 聊天分支 | ✅ `ai-chat`（non_search→reply / 有库不生成 / 零结果生成 / canSave=false） | ✅ 上表 §3a.2 |
| Key 不泄露 | 约定 + 代码审查 | ✅ 上表 §3a.3 |

## 4. UI audit / critique（摘要）

**Audit（技术）**

- ✅ 桌面 `min-width: 1024px`；`:focus-visible`；表单 label / `visually-hidden`
- ✅ 状态文字组件；占位图 `alt` 含配方名
- ✅ 后台独立壳；发布/删除 `alertdialog` 二次确认
- ⚠️ 家族/风味选项目前列出全部启用项，未严格裁成「当前酒类过滤后结果集中实际出现的项」（PRD FR-03/04 的 UI 细化，行为上筛选仍正确）
- ⚠️ 后台配方编辑为简易两材料表单，非完整多行版本编辑器

**Critique（Operate）**

- 工具站密度与前台/后台隔离符合 brief；非营销落地页
- 推荐区克制（≤2）；筛选进 URL，返回列表可恢复

行为问题归属：domain Vitest / API 集成测试（均绿）。

## 5. 非目标重申（PRD §3.3 / §14）

首版**不包含**：多用户/公网产品、手机端验收、用户前台登录、在线部署与同步、余量库存、替代建议、收藏/历史/评分/制作记录、埋点、前台自创投稿、社区、识图/条码/OCR、空语境 AI 入库生成、临时 AI 配方一键入库、外链购买、备份导入导出、真实成品图抓取、多版本前台展开。内容后台本机口令登录已纳入首版（FR-20）。已确认增量：后台 AI 导入（FR-21）与前台 AI 聊天（FR-22），细节见 `docs/AI_ASSISTANT.md`。
