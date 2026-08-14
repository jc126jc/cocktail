# IBA / seed 本地语料

本目录为**可审计本地源**。运行时 seed **不访问公网**。

## 约束

- 不抓取第三方成品图或未授权内容
- 不自动灌入未确认的中国白酒现代配方
- 材料只通过 `mappings.json` 或配方内显式 `ingredientId` 映射；禁止名称猜测
- 无法映射的材料写入 `pending/unmapped-ingredients.json`

## 文件

| 路径 | 说明 |
| --- | --- |
| `taxonomy/` | 分类、九酒类、家族、风味 |
| `ingredients/ingredients.json` | 标准材料树与别名 |
| `ingredients/mappings.json` | 源材料名 → `Ingredient.id`（显式） |
| `recipes/iba_recipes.json` | IBA 配方语料（ml、`importKind`） |
| `pending/` | seed 生成的待确认清单 |

## 修订

语料快照日期：2026-08-12。  
2026-08-12 gap-fill：补经典酒谱约 31 款 + 标准材料 6 种（橄榄卤汁、爱尔兰奶油、百香果糖浆、覆盆子利口酒、罗勒、世涛）；`pending` 保持 0。以本仓库文件为准做验收，不在运行时同步外部站点。

当前 `recipes/iba_recipes.json` 含 Unforgettables / Contemporary Classics / New Era 的本地结构化快照（`new_recipe` + 显式 `new_version` 示例）。验收检查对齐「本地语料 100% 入库为 published 主版本」，扩展语料时只需追加 JSON 后重新 `pnpm db:seed`。

`pnpm db:seed` 会重建目录数据（分类/材料/配方），并清空酒柜与采购项以免外键冲突。
