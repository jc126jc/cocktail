# 本地鸡尾酒配方工具技术方案

版本：1.0  
状态：待实现确认  
日期：2026-08-12  
依据：[INTERVIEW_FINDINGS.md](./INTERVIEW_FINDINGS.md)、[PRD.md](./PRD.md)

## 1. 文档目的

本文把已确认的 PRD 落成可实施的技术选型、系统结构、数据设计、核心算法、接口边界与实现分期。  
不替代 PRD；功能对错以 PRD 为准。本文只决定“怎么做”。

**原型约束**：开始任何页面原型、线框图或交互原型前，必须停止并先告知用户；未获后续指示不得制作原型。

## 2. 技术目标与约束

### 2.1 必须满足

| 约束 | 技术含义 |
| --- | --- |
| 本地电脑端网站 | 本机启动 Web 服务，浏览器访问 `localhost` |
| Windows + Chrome / Edge | 首版只验收桌面浏览器，目标宽度 ≥ 1024px |
| 本地数据库 | 全部业务数据落本地文件型数据库，应用重启后保留 |
| 后台本机口令 | 仅 `/admin` 与 `/api/admin/*` 需会话；前台无登录；口令来自环境变量 |
| 不对外部署（核心） | 业务数据与匹配不依赖公网；**可选** AI 功能须联网调用外部 LLM，失败时核心离线可用 |
| 单人使用 | 不做多租户、云端权限、同步 |
| 材料层级匹配 | 必须在服务端用可测试的规则引擎计算，不以前端猜测 |
| 首批 IBA 全量 | 需要可重复执行的数据导入流程 |
| AI 助手（可选） | Provider Adapter + 环境变量；详见 [AI_ASSISTANT.md](./AI_ASSISTANT.md) |

### 2.2 明确不做

与 PRD §3.3 / §14 一致：手机端验收、用户前台登录/多账号、在线部署、备份导入导出、替代建议、收藏历史、埋点、真实成品图抓取、多版本前台展开、OCR/识图、空语境 AI 入库生成、临时 AI 配方一键入库等。内容后台本机口令除外（FR-20）。已确认的 AI 导入/聊天见 FR-21 / FR-22。

### 2.3 AI 运行约束

- 环境变量：`AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`（默认硅基流动 + `deepseek-ai/DeepSeek-V4-Flash`）。
- Key 仅服务端；响应/日志不得回显。
- 无 Key 或网络失败：`GET /api/ai/status`（或等价）标记不可用；UI 禁用入口。
- 不用 LlamaIndex / Chroma / 向量 RAG。

## 3. 总体架构

### 3.1 形态

采用 **本机 Node.js 单体应用**：

```text
浏览器 (Chrome / Edge)
        │  HTTP
        ▼
┌──────────────────────────────────────┐
│  本地 Web 服务 (localhost:PORT)       │
│  ┌──────────────┐  ┌───────────────┐ │
│  │ 静态前端 SPA  │  │ REST API      │ │
│  └──────────────┘  └───────┬───────┘ │
│                            │         │
│                    ┌───────▼───────┐ │
│                    │ SQLite 文件库  │ │
│                    └───────────────┘ │
└──────────────────────────────────────┘
```

选择原因：

- 符合“本地访问的网站”，无需 Electron / Tauri 打包。
- 一套进程即可同时提供页面与 API，安装与启动成本低。
- SQLite 满足单人、事务、本地持久化，无需单独装数据库服务。
- 后续若要适配手机端，仍可复用同一 API 与数据模型。

### 3.2 分层

| 层 | 职责 |
| --- | --- |
| 表现层 | 主页、配方详情、酒柜管理、内容后台、AI 导入向导、前台 AI 聊天 |
| API 层 | REST；后台管理需会话；AI 管理接口同属 admin；前台 `/api/ai/*` 无用户登录但密钥仅服务端 |
| 领域层 | 酒类过滤、材料满足、缺料计数、结果补足、推荐标记；单位换算与确定性材料匹配 |
| AI 适配层 | Provider 调用、结构化输出校验、导入 parse/reparse、聊天工具编排 |
| 持久层 | SQLite + ORM；事务写酒柜 / 采购 / 版本切换；**不**存 AI 原文/调用过程 |

领域匹配逻辑集中在服务端，前端只负责展示与触发查询，避免两套规则漂移。

## 4. 技术选型

| 类别 | 选型 | 说明 |
| --- | --- | --- |
| 运行时 | Node.js 22 LTS | Windows 本地长期支持版本 |
| 语言 | TypeScript（前后端统一） | 材料角色、缺料状态等枚举可静态约束 |
| 前端 | React 19 + Vite + React Router | SPA，路由保留筛选状态；后续可响应式改造 |
| 样式 | CSS Modules + CSS 变量 | 首版不做设计系统扩张；避免引入重型 UI 库绑定原型风格 |
| 后端 | Hono（或 Express，二选一以 Hono 为默认） | 轻量、TypeScript 友好，适合本地 API |
| ORM | Drizzle ORM | SQL 可见、迁移清晰、适合层级查询 |
| 数据库 | SQLite（`better-sqlite3`） | 同步事务简单，适合本地工具 |
| 校验 | Zod | API 入参与发布校验共用 schema |
| AI | 可替换 LLM Provider Adapter | OpenAI 兼容 HTTP（硅基流动）；结构化 JSON Schema 输出 |
| 测试 | Vitest | 重点覆盖匹配与补足规则；AI 层对 Provider mock |
| 包管理 | pnpm | 本地可重复安装 |
| 启动 | `pnpm dev` / `pnpm start` | 开发热更新；生产模式同机静态托管 + API |

### 4.1 选型边界

- **不用** Electron：用户要的是本地网站，不是桌面壳。
- **不用** 云数据库 / Postgres 服务：部署与运维超出首版。
- **不用** Next.js SSR：本地单用户无 SEO / 服务端渲染收益；Vite SPA + 独立 API 更直接。
- **不用** IndexedDB 作为主库：后台内容、IBA 全量、事务与引用完整性更适合 SQLite。
- **图片**：统一本地占位静态资源，不抓取外部成品图。

## 5. 仓库结构（建议）

```text
cocktail/
├── docs/
│   ├── INTERVIEW_FINDINGS.md
│   ├── PRD.md
│   └── TECH_SPEC.md
├── apps/
│   ├── web/                 # Vite React 前端
│   └── server/              # Hono API + 领域逻辑
├── packages/
│   ├── db/                  # Drizzle schema、迁移、seed
│   ├── domain/              # 匹配 / 补足 / 推荐纯函数
│   └── shared/              # 共享类型与 Zod schema
├── data/
│   ├── iba/                 # IBA 源数据与导入脚本产物
│   └── app.sqlite           # 运行时数据库（gitignore）
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

原则：

- `packages/domain` 不依赖 HTTP / React，便于单测。
- `packages/db` 单独管理 schema 与 seed，避免前后端各写一份表结构。
- 运行时 SQLite 路径可配置，默认 `data/app.sqlite`。

## 6. 数据设计

### 6.1 原则

1. 配方材料只引用标准 `Ingredient.id`，禁止自由文本参与匹配。
2. 家族、风味、酒类大类为独立实体，不塞进单一“分类”字段。
3. 酒柜与采购只存 `ingredient_id`，不存余量、价格、商家。
4. 前台只读已发布且为主版本的配方内容。
5. 删除受引用内容改为“阻止删除 + 可停用”。

### 6.2 表结构（相对 PRD §10 的落地）

#### `ingredient_categories`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | UUID |
| name_zh / name_en | TEXT | |
| parent_id | TEXT NULL FK | 分类树 |
| sort_order | INTEGER | |
| active | INTEGER | 0/1 |

#### `alcohol_groups`

预置九种首页酒类（金酒…中国白酒）。

| 字段 | 类型 |
| --- | --- |
| id, name_zh, name_en, sort_order, active | |

#### `ingredients`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| name_zh / name_en | TEXT | 标准名 |
| category_id | TEXT FK | |
| parent_ingredient_id | TEXT NULL FK | 材料父子层级 |
| alcohol_group_id | TEXT NULL FK | 映射到首页酒类；葡萄酒子类统一映射葡萄酒 |
| can_be_staple | INTEGER | 是否可设常备 |
| active | INTEGER | |
| created_at / updated_at | TEXT | ISO |

#### `ingredient_aliases`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| ingredient_id | TEXT FK | |
| alias | TEXT | 中英文别名；搜索用 |
| UNIQUE(alias) 软约束 | | 冲突时后台警告，不强行唯一阻塞导入时可人工处理 |

#### `inventory_items`

| 字段 | 类型 |
| --- | --- |
| id | TEXT PK |
| ingredient_id | TEXT UNIQUE FK |
| created_at | TEXT |

#### `staple_settings`

| 字段 | 类型 |
| --- | --- |
| ingredient_id | TEXT PK FK |
| enabled | INTEGER |

仅 `can_be_staple = 1` 的材料可出现在常备区，且不出现在「加入酒柜」列表。后台可通过 `PATCH /api/admin/ingredients/:id` 更新该标记。

#### `cocktail_families` / `flavor_tags`

预置 PRD 家族与风味；含 `sort_order`、`active`。  
首版禁止删除已被引用的项，只允许停用。

#### `recipes`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| name_zh / name_en | TEXT | |
| primary_version_id | TEXT NULL | 指向版本；发布校验时必填 |
| family_id | TEXT FK | 一个主家族 |
| editor_recommended | INTEGER | 是否推荐候选 |
| recommendation_order | INTEGER NULL | 同级排序 |
| status | TEXT | `draft` \| `published` |
| iba_category | TEXT NULL | IBA 分类信息（如有） |
| created_at / updated_at | TEXT | |

#### `recipe_flavor_tags`

`recipe_id` + `flavor_tag_id` 多对多。

#### `recipe_versions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| recipe_id | TEXT FK | |
| version_name | TEXT | |
| source_name / source_url / source_revision | TEXT | IBA 来源与版本日期 |
| glassware | TEXT | |
| garnish | TEXT | 展示用装饰说明 |
| steps_json | TEXT | 有序纯文字步骤数组 JSON |
| created_at / updated_at | TEXT | |

#### `recipe_ingredients`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TEXT PK | |
| recipe_version_id | TEXT FK | |
| ingredient_id | TEXT FK | |
| amount_ml | REAL NULL | 毫升；装饰可空 |
| role | TEXT | `required` \| `optional` \| `garnish` \| `either` |
| either_group_id | TEXT NULL | 任选组：同组计为一个需求 |
| display_note | TEXT NULL | 展示备注 |
| sort_order | INTEGER | |

#### `shopping_items`

| 字段 | 类型 |
| --- | --- |
| id | TEXT PK |
| ingredient_id | TEXT UNIQUE FK |
| created_at | TEXT |

### 6.3 索引建议

- `ingredients(parent_ingredient_id)`
- `ingredients(alcohol_group_id)`
- `ingredients(category_id)`
- `ingredient_aliases(alias)`
- `recipe_ingredients(recipe_version_id)`
- `recipes(status, editor_recommended)`
- `inventory_items(ingredient_id)` UNIQUE
- `shopping_items(ingredient_id)` UNIQUE

### 6.4 完整性规则（写路径事务）

| 操作 | 事务行为 |
| --- | --- |
| 标记采购项已购买 | 插入酒柜（若无）→ 删除采购项 |
| 切换主版本 | 校验版本属同一配方 → 更新 `primary_version_id` |
| 发布配方 | 校验中英文名、来源、主版本、家族、≥1 风味、≥1 材料、≥1 步骤 |
| 删除材料 | 若被配方 / 酒柜 / 采购引用则拒绝，返回引用计数 |
| 材料改父级 | 检测环；失败则整单回滚 |

## 7. 核心领域算法

实现位置：`packages/domain`。所有规则以纯函数表达，输入输出可序列化，便于 Vitest 固定用例。

### 7.1 拥有集合

```text
owned = inventory_ingredient_ids ∪ { staple_ingredient_id | enabled }
```

### 7.2 材料祖先闭包

对每个酒柜材料，沿 `parent_ingredient_id` 向上展开，得到可满足的需求集合 `satisfied_ids`。

规则（PRD FR-13 / §9.3）：

- 子级可满足上级；上级不可满足更具体子级。
- 利口酒 / 苦精默认精确匹配（层级上无父子则不可互通）。
- 无替代关系。

### 7.3 单条配方材料状态

对主版本中每个**需求单元**：

1. `role = garnish | optional`：展示，不计入缺料。
2. `role = required`：单个 `ingredient_id` 为一个需求。
3. `role = either`：同一 `either_group_id` 合并为一个需求；组内任一材料被满足即满足。
4. 同一 `ingredient_id` 重复出现合并为一个需求。

每个需求结果：`satisfied` | `missing`。  
`missing_count` = missing 需求数。

档位：

- 0 → 齐全  
- 1–2 → 可进入结果  
- ≥3 → 排除

### 7.4 酒类过滤

材料通过 `alcohol_group_id`（或祖先材料的 `alcohol_group_id`）映射到首页酒类。

- 选 0 个：不过滤  
- 选 1 个：至少一个配方材料映射到该组  
- 选 2 个：两组均至少命中一次（AND）  
- 不判断是否为基底 / 主体，不看用量比例

首页“已有”标记：若酒柜任一材料（含其祖先）映射到该 `alcohol_group`，则标记已有；已有组排前。

### 7.5 家族 / 风味筛选

- 家族：多选 OR  
- 风味：多选 AND（配方须包含全部选中风味）  
- 与酒类条件 AND  
- 前台选项仅展示**当前酒类过滤后结果集**中实际出现的家族 / 风味

### 7.5a 配方名称搜索（FR-05a）

- 可选查询参数 `q`：对 `name_zh` / `name_en` 做不区分大小写的子串匹配  
- 空或省略 `q`：不过滤名称  
- 与酒类、家族、风味条件 AND；在结果补足之前应用  
- 不匹配步骤、材料名、别名或草稿

### 7.6 结果补足（FR-06）

```text
candidates = 已发布主版本
  ∩ 名称条件(q) ∩ 酒类条件 ∩ 家族条件 ∩ 风味条件
  ∩ missing_count ≤ 2

complete = missing_count == 0
partial  = missing_count in {1,2} 按缺料升序，同级稳定排序

if |complete| >= 12:
  result = complete   # 全部保留，不插入缺料
else:
  result = complete + take(partial, 12 - |complete|)
  # 候选耗尽则少于 12，不强行凑数
```

稳定排序键默认：`name_zh`，再 `name_en`，再 `id`。

### 7.7 排序（FR-05）

- 默认：齐全程度（0 → 1 → 2），同级稳定键  
- 名称：中文名，相同则英文名  
- 随机：仅在用户点击时重新洗牌；服务端可用种子或前端洗牌，但刷新策略需固定为“主动点击才变”

### 7.8 推荐标记（FR-01 / FR-07）

输入：后台 `editor_recommended = 1` 的已发布主版本。

首页初始推荐（无酒类或未进入结果列表时）：

1. 优先齐全候选  
2. 再缺 1、缺 2  
3. 同级按 `recommendation_order`，否则中文名  
4. 最多 2 条；可不凑满  
5. 酒柜为空：仍可出候选，但前台标明酒柜空着、齐全程度未知，并提示去填酒柜

结果内推荐标记：

- 必须已在当前 `result` 中  
- 同样优先级，最多 2 条  
- **不改变排序**

## 8. API 设计

前缀：`/api`。无鉴权。写操作对高风险动作由前端二次确认，后端仍做校验。

### 8.1 查询

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/alcohol-groups` | 九类入口 + 是否酒柜已有 |
| GET | `/api/recipes/search` | 名称 / 酒类 / 家族 / 风味 / 排序 → 补足后的卡片列表 + 推荐 ids |
| GET | `/api/recipes/:id` | 主版本详情 + 逐项拥有状态 + 采购状态 |
| GET | `/api/recommendations/home` | 首页初始 0–2 条 |
| GET | `/api/inventory` | 酒柜列表 |
| GET | `/api/staples` | 可设常备及启用状态 |
| GET | `/api/shopping-items` | 采购项 |
| GET | `/api/ingredients` | 分类树浏览 / 搜索（名、英文、别名） |
| GET | `/api/admin/...` | 配方、版本、材料、家族、风味 CRUD |

`GET /api/recipes/search` 查询参数示例：

```text
q=                           # 可选；中英文名子串
alcoholGroupIds=gin,whiskey   # 0–2
familyIds=
flavorIds=
sort=completeness|name|random
randomSeed=                   # 仅 sort=random
```

响应卡片字段对齐 FR-08：中英文名、占位图 URL、家族、主要风味、材料状态、是否推荐。

### 8.2 变更

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/inventory` | 加入酒柜（幂等） |
| DELETE | `/api/inventory/:ingredientId` | 移出酒柜 |
| PUT | `/api/staples/:ingredientId` | 启用 / 关闭常备 |
| POST | `/api/shopping-items` | 缺料加入采购（幂等） |
| POST | `/api/shopping-items/:ingredientId/purchase` | 已购买：入柜并删采购 |
| DELETE | `/api/shopping-items/:ingredientId` | 仅移除采购 |
| 后台 CRUD | `/api/admin/*` | 见下 |

### 8.3 后台关键

鉴权（FR-20）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/admin/login` | body `{ password }`；成功设置 httpOnly 会话 Cookie |
| POST | `/api/admin/logout` | 清除会话 |
| GET | `/api/admin/session` | `{ authenticated: boolean }` |

其余 `/api/admin/*` 均需有效会话，否则 `401`。

口令：环境变量 `ADMIN_PASSWORD`；未设置时开发默认 `cocktail-admin`（仅本机；应在 `.env` 覆盖）。会话：服务端内存 Map + 随机 token，Cookie 名 `cocktail_admin_session`，进程重启后需重新登录。

覆盖 FR-16～FR-19（均需登录）：

- 配方 CRUD、发布 / 草稿、主版本指定、推荐候选与顺序  
- 版本 CRUD（材料、步骤、杯具、装饰、来源）  
- 材料 CRUD、父级、酒类映射、别名、常备标记（`PATCH /api/admin/ingredients/:id`）、停用
- 家族 / 风味启用停用与排序  

错误约定：

- 未登录 / 口令错误：`401`  
- 引用冲突：`409` + 引用明细  
- 校验失败：`400` + 字段错误  
- 数据库错误：`500` + 明确文案；前端保留表单，不伪装成功（PRD §12.5）

### 8.4 AI 接口（FR-21 / FR-22）

细节与 Schema 见 [AI_ASSISTANT.md](./AI_ASSISTANT.md)。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ai/status` | `{ configured, available }`；不泄露 Key |
| POST | `/api/ai/chat` | 前台 NL；先意图分流；`search` 才工具检索；零结果才临时生成；`non_search` → `kind: reply` |
| POST | `/api/admin/ai-import/parse` | 原文 → Schema 校验 + 单位换算后的临时结果（需 admin） |
| POST | `/api/admin/ai-import/reparse` | 再解析 + 可比较差异（需 admin） |
| POST | `/api/admin/ai-import/commit` | 确认后事务创建草稿；失败整单回滚（需 admin） |

中间态不落 SQLite；commit 后丢弃原文与 AI 过程。

## 9. 前端信息架构落地

四个路由域（SPA）：

| 路由 | 页面 | 对应 PRD |
| --- | --- | --- |
| `/` | 主页面：初始推荐、酒体偏好、家族/风味、排序、结果、入口 | §6.1 |
| `/recipes/:id` | 配方详情 | §6.2 |
| `/bar` | 酒柜管理：我的酒柜（主）+ 加入酒柜模块 + 常备 + 采购 | §6.3 |
| `/ai` | 前台 AI 文本助手（会话级） | §6.5 / FR-22 |
| `/admin/login` | 后台登录 | §6.4 / FR-20 |
| `/admin/recipes/import` | AI 从原文导入向导 | §6.4 / FR-21 |
| `/admin/*` | 内容管理后台（需登录） | §6.4 |
| （主壳入口） | 前台 AI 文本助手（会话级 UI） | §6.5 / FR-22 |

实现要点：

- 从详情返回列表时，用 URL query 或 session 级状态恢复酒类 / 筛选 / 排序。  
- 用户页与后台页视觉与导航明确区分，降低误操作（PRD §13.5）；用户壳顶栏不放「内容后台」主链，改为页脚低调入口。  
- 未登录访问 `/admin` 内页时重定向至 `/admin/login`。  
- 删除 / 覆盖主版本等操作二次确认。  
- 材料状态不只用颜色：配合文字“齐全 / 缺 n 种 / 已有 / 缺少”。  
- 键盘可访问；表单有标签；占位图有 alt。

**本阶段不产出视觉原型或线框**；页面实现须在用户明确允许原型/UI 实施后再开始。

## 10. 内容与 IBA 导入

### 10.1 流程

1. 手工整理或半自动抽取现行 IBA 配方为结构化 JSON（名称、来源、版本日期、材料、用量、步骤等）。  
2. 映射脚本将材料解析到标准 `ingredients`；无法自动映射的进入待确认清单。  
3. `pnpm seed` 写入 SQLite：分类、酒类、家族、风味、材料树、IBA 配方主版本（`published`）。  
4. 中文名由管理员在后台确认或在 seed 审核表中确认。  
5. 用量统一毫升；无法换算的人工处理。

### 10.2 约束

- 不自动抓取第三方酒谱网站成品图或未授权内容。  
- 不引入未经确认的中国白酒现代配方填充空结果。  
- 同名配方导入时区分“新配方”与“新版本”，由导入清单显式标注。

## 11. 本地运行与运维

### 11.1 开发

```text
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev          # 同时起 API + Vite
```

浏览器打开 `http://localhost:<port>`。

### 11.2 日常使用

```text
pnpm start        # 构建前端并由同一服务托管
```

数据文件：`data/app.sqlite`。  
首版不做备份 / 导入导出；用户自行复制该文件即等价备份（产品功能仍按 PRD 不做）。

### 11.3 环境

- `.env` 仅本地：`PORT`、`DATABASE_URL`（文件路径）、`ADMIN_PASSWORD`（后台口令，可选；默认见 §8.3）。

## 12. 测试策略

| 层级 | 范围 |
| --- | --- |
| 单元 | 材料祖先闭包、either 组、缺料计数、酒类 AND/OR、补足 12 条规则、推荐优先级 |
| 集成 | API：购买闭环、发布校验、删除引用阻止、主版本切换 |
| 手工验收 | PRD §15 用户验收 7 步 |

固定用例至少覆盖访谈示例：

- London Dry Gin → 满足 Gin；Gin 不满足 Old Tom Gin  
- Bourbon → 首页“威士忌”已有；选威士忌可见其他威士忌风格配方但按缺料处理  
- Cointreau 与 Triple Sec 仅当层级明确父子时才互通  
- 结果不足 12、仅 7 条、齐全 15 条三类补足边界

## 13. 非功能落地

| 需求 | 方案 |
| --- | --- |
| 性能 | IBA 规模下全量加载主版本材料到内存计算匹配即可；材料搜索走 SQL LIKE / 别名索引；不做过早缓存层 |
| 完整性 | 写路径事务；外键开启（SQLite `PRAGMA foreign_keys = ON`） |
| 可访问性 | 语义 HTML、可见焦点、状态文本 |
| 安全 | 后台本机口令 + 会话 Cookie；用户前台开放；危险写操作确认；不暴露任意文件路径 |

## 14. 实现分期

在**未获原型/UI 指示前**，只推进文档、数据与领域逻辑；不开始页面视觉实施。

| 阶段 | 交付 | 依赖用户指示 |
| --- | --- | --- |
| P0 工程骨架 | monorepo、SQLite schema、迁移、空 API 健康检查 | 否 |
| P1 领域引擎 | `packages/domain` + 全量匹配/补足/推荐单测 | 否 |
| P2 数据 | 材料层级 seed、IBA 导入管线、发布数据验收脚本 | 否 |
| P3 API | 查询与酒柜/采购写接口、后台 CRUD | 否 |
| P4 UI | 四页面域按 PRD 实现 | **是：需先告知并获准开始原型/页面** |
| P5 验收 | PRD §15 数据/功能/用户验收 | 是 |
| P-AI1 | Provider + 解析 Schema + 单位/角色 + 再解析差异 + commit 草稿 | **是：AI 开工指示** |
| P-AI2 | 确定性材料/杯具装饰映射 + 审核 UI | 依赖 P-AI1 |
| P-AI3 | AI 候选映射 + 家族/风味建议 + 完整审核 | 依赖 P-AI2 |
| P-AI4 | 前台 NL 助手 + 零结果临时生成 | 依赖 P-AI1～3 稳定 |

建议：核心 P0–P5 与现网能力优先；AI 按 P-AI1→4 单独推进，每阶段需明确开工指示（含对应 UI）。

## 15. 风险与对策

| 风险 | 对策 |
| --- | --- |
| IBA 材料名与标准层级不一致 | 导入待确认清单 + 后台可改父级；禁止名称猜测匹配 |
| “酒体偏好”术语易误解 | 产品文案按用户确认保留该名称；技术字段用 `alcohol_group` |
| 后台误改 | 本机口令会话 + 导航低调入口 + 危险操作确认 |
| 中国白酒结果为空 | 允许空状态；不自动灌配方 |
| 过早做 UI 偏离约束 | 严格遵守原型门禁 |
| LLM 幻觉写入正式库 | Schema 校验 + 确定性匹配优先 + 仅 commit 草稿 + 发布再校验 |
| API Key 泄露 | 仅服务端 env；禁止日志/响应回显；前端只读 status |
| 硅基流动不可用 | AI 入口禁用；核心匹配/酒柜/后台离线可用 |
| 公网滥用费用 | 首版单人本机无频控；公网前必须加审计与限流 |

## 16. 待用户确认的技术决策

以下不影响需求正确性，但影响开工细节；若无异议按本文默认执行：

1. **默认栈**：Vite React + Hono + Drizzle + SQLite + pnpm monorepo。  
2. **UI 开工门禁**：P0–P3 可先做；P4 须另行指示。  
3. **随机排序**：由服务端根据 `randomSeed` 洗牌，保证同 seed 可复现，便于测试。  
4. **IBA 源数据**：以可审计的本地 JSON / CSV 为导入源，不在运行时访问公网。  
5. **AI**：按 [AI_ASSISTANT.md](./AI_ASSISTANT.md) 与 P-AI1→4；默认硅基流动 + DeepSeek-V4-Flash；**须另行指示才开工各 AI 阶段**。

## 17. 成功对应关系

| PRD 成功标准 | 技术对应 |
| --- | --- |
| 至少一条真正有用的配方 | 不埋点；保证匹配闭环与 IBA 数据可用，由用户主观判断 |
| 本地重启数据仍在 | SQLite 文件持久化验收 |
| 缺料→采购→入柜 | `purchase` 事务 API + 详情/酒柜双端状态 |

---

修订记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-08-12 | 依据访谈结论与 PRD 首版技术方案 |
| 1.1 | 2026-08-12 | 前台配方名称搜索：`q` 查询参数 + FR-05a |
| 1.2 | 2026-08-12 | AI 助手：FR-21/22、Provider、P-AI1–4；见 AI_ASSISTANT.md |
| 1.3 | 2026-08-12 | P-AI2：确定性材料/杯具装饰映射 + 导入审核 UI |
| 1.4 | 2026-08-12 | P-AI3：AI 候选映射（≤3、0.8 预选）+ 家族/风味建议清洗 |
| 1.5 | 2026-08-12 | P-AI4：前台 AI 聊天 + 工具检索 + 零结果临时生成 |
| 1.6 | 2026-08-12 | FR-22：非检索意图分流；`kind: reply` 不落库检索 |
