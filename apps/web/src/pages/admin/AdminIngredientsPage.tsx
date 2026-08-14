import { useEffect, useState } from "react";
import { api, ApiError, type IngredientRow } from "../../api/client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./admin.module.css";

export function AdminIngredientsPage() {
  const [items, setItems] = useState<IngredientRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; nameZh: string }[]>(
    [],
  );
  const [alcoholGroups, setAlcoholGroups] = useState<
    { id: string; nameZh: string }[]
  >([]);
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [categoryId, setCategoryId] = useState("spirits");
  const [alcoholGroupId, setAlcoholGroupId] = useState("");
  const [canBeStaple, setCanBeStaple] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const [ing, browse, groups] = await Promise.all([
      api.adminIngredients(),
      api.ingredients(),
      api.adminAlcoholGroups(),
    ]);
    setItems(ing.items);
    setCategories(browse.categories);
    setAlcoholGroups(groups.items.map((g) => ({ id: g.id, nameZh: g.nameZh })));
    if (!categoryId && browse.categories[0]) {
      setCategoryId(browse.categories[0].id);
    }
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : "没能载入材料。"),
    );
  }, []);

  const groupLabel = (id: string | null) => {
    if (!id) return "—";
    return alcoholGroups.find((g) => g.id === id)?.nameZh ?? id;
  };

  return (
    <div className={styles.stack}>
      <h1>材料</h1>
      <p className={styles.muted}>
        新建基酒时，选好它对应的前台「酒体偏好」。勾上「可设为常备」的材料会出现在酒柜页常备区，不会出现在「加入酒柜」。
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setCreating(true);
          setError(null);
          void api
            .createIngredient({
              nameZh,
              nameEn,
              categoryId,
              alcoholGroupId: alcoholGroupId || null,
              canBeStaple,
            })
            .then(async () => {
              setNameZh("");
              setNameEn("");
              setAlcoholGroupId("");
              setCanBeStaple(false);
              await load();
            })
            .catch((err) =>
              setError(err instanceof ApiError ? err.message : "没能创建这种材料。"),
            )
            .finally(() => setCreating(false));
        }}
      >
        <h2>新建材料</h2>
        <label>
          中文名
          <input
            value={nameZh}
            onChange={(e) => setNameZh(e.target.value)}
            required
          />
        </label>
        <label>
          英文名
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
          />
        </label>
        <label>
          分类
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameZh}
              </option>
            ))}
          </select>
        </label>
        <label>
          对应前台酒类（基酒必选；辅料可空）
          <select
            value={alcoholGroupId}
            onChange={(e) => setAlcoholGroupId(e.target.value)}
          >
            <option value="">不归属前台酒类</option>
            {alcoholGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameZh}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={canBeStaple}
            onChange={(e) => setCanBeStaple(e.target.checked)}
          />{" "}
          可设为常备辅料
        </label>
        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={creating}
        >
          {creating ? "创建中…" : "创建"}
        </button>
      </form>

      <p className={styles.muted}>共 {items.length} 种材料</p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">中文</th>
            <th scope="col">英文</th>
            <th scope="col">分类</th>
            <th scope="col">酒体偏好</th>
            <th scope="col">常备</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.nameZh}</td>
              <td>{i.nameEn}</td>
              <td>
                {categories.find((c) => c.id === i.categoryId)?.nameZh ??
                  i.categoryId}
              </td>
              <td>{groupLabel(i.alcoholGroupId)}</td>
              <td>
                <label style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={i.canBeStaple === 1}
                    onChange={(e) => {
                      const next = e.target.checked;
                      void api
                        .patchIngredient(i.id, { canBeStaple: next })
                        .then(load)
                        .catch((err) =>
                          setError(
                            err instanceof ApiError
                              ? err.message
                              : "没能更新常备标记。",
                          ),
                        );
                    }}
                  />
                </label>
              </td>
              <td>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => setDeleteId(i.id)}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDialog
        open={!!deleteId}
        title="删除材料？"
        body="如果还有配方、酒柜或采购清单在用它，就删不掉。确定要删吗？"
        confirmLabel="确认删除"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void api
            .deleteIngredient(deleteId)
            .then(async () => {
              setError(null);
              await load();
            })
            .catch((e) => {
              const msg =
                e instanceof ApiError ? e.message : "没能删除这种材料。";
              setError(msg);
            })
            .finally(() => setDeleteId(null));
        }}
      />
    </div>
  );
}
