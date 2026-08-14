import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import styles from "./admin.module.css";

type RecipeRow = {
  id: string;
  nameZh: string;
  nameEn: string;
  status: string;
  familyId: string;
  primaryVersionId: string | null;
  editorRecommended: number;
  recommendationOrder: number | null;
};

export function AdminRecipesPage() {
  const [items, setItems] = useState<RecipeRow[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [publishId, setPublishId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.adminRecipes();
      setItems(res.items);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能载入配方列表。");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        r.nameZh.toLowerCase().includes(needle) ||
        r.nameEn.toLowerCase().includes(needle) ||
        r.id.toLowerCase().includes(needle)
      );
    });
  }, [items, q, statusFilter]);

  return (
    <div className={styles.stack}>
      <div className={`${styles.row} ${styles.toolbar}`}>
        <div>
          <h1>配方</h1>
          <p className={styles.muted}>
            首页推荐在编辑页勾选「放在首页推荐」并设顺序；首页最多 2 条。
          </p>
        </div>
        <div className={styles.row}>
          <Link className={styles.btn} to="/admin/recipes/import">
            从原文导入
          </Link>
          <Link className={`${styles.btn} ${styles.btnPrimary}`} to="/admin/recipes/new">
            新建配方
          </Link>
        </div>
      </div>

      <div className={styles.filterBar}>
        <label className={styles.filterField}>
          <span className="visually-hidden">搜索配方</span>
          <input
            className={styles.filterInput}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索中文名或英文名"
            type="search"
          />
        </label>
        <label className={styles.filterField}>
          <span className={styles.filterLabel}>状态</span>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "draft" | "published")
            }
          >
            <option value="all">全部</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <p className={styles.muted}>
          找到 {filtered.length} / 共 {items.length}
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.colName}>
              中文名
            </th>
            <th scope="col" className={styles.colName}>
              英文名
            </th>
            <th scope="col" className={styles.colStatus}>
              状态
            </th>
            <th scope="col" className={styles.colRec}>
              推荐
            </th>
            <th scope="col" className={styles.colActions}>
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id}>
              <td className={styles.cellTruncate} title={r.nameZh}>
                {r.nameZh}
              </td>
              <td className={styles.cellTruncate} title={r.nameEn}>
                {r.nameEn}
              </td>
              <td>{r.status === "published" ? "已发布" : "草稿"}</td>
              <td>
                {r.editorRecommended
                  ? r.recommendationOrder != null
                    ? `首页 · ${r.recommendationOrder}`
                    : "首页"
                  : "—"}
              </td>
              <td className={styles.colActions}>
                <div className={styles.actions}>
                  <Link
                    className={styles.linkBtn}
                    to={`/admin/recipes/${r.id}`}
                  >
                    编辑
                  </Link>
                  {r.status !== "published" && (
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => setPublishId(r.id)}
                    >
                      发布
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => setDeleteId(r.id)}
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <p className={styles.empty}>
          {items.length === 0
            ? "还没有配方。"
            : "没有符合条件的配方。试试清空搜索，或换个状态。"}
        </p>
      )}

      <ConfirmDialog
        open={!!publishId}
        title="发布配方？"
        body="发布后前台就能看到。请确认名称、材料、步骤、家族和风味都已填好。"
        confirmLabel="确认发布"
        onCancel={() => setPublishId(null)}
        onConfirm={() => {
          if (!publishId) return;
          void api
            .publish(publishId, "published")
            .then(load)
            .catch((e) =>
              setError(e instanceof ApiError ? e.message : "没能发布。"),
            )
            .finally(() => setPublishId(null));
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="删除配方？"
        body="会删掉这杯配方和它的全部版本，删了就回不来。"
        confirmLabel="确认删除"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          void api
            .deleteRecipe(deleteId)
            .then(load)
            .catch((e) =>
              setError(e instanceof ApiError ? e.message : "没能删除这杯配方。"),
            )
            .finally(() => setDeleteId(null));
        }}
      />
    </div>
  );
}
