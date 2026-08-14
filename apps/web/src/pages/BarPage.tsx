import { useEffect, useMemo, useState } from "react";
import { api, ApiError, type IngredientRow } from "../api/client";
import styles from "./BarPage.module.css";

export function BarPage() {
  const [categories, setCategories] = useState<
    { id: string; nameZh: string }[]
  >([]);
  const [catalog, setCatalog] = useState<IngredientRow[]>([]);
  const [allById, setAllById] = useState<Record<string, IngredientRow>>({});
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [shopping, setShopping] = useState<
    { ingredientId: string; nameZh?: string }[]
  >([]);
  const [staples, setStaples] = useState<
    { ingredientId: string; nameZh: string; nameEn: string; enabled: boolean }[]
  >([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refreshCore() {
    const [inv, shop, stap, all] = await Promise.all([
      api.inventory(),
      api.shopping(),
      api.staples(),
      api.ingredients(),
    ]);
    const map: Record<string, IngredientRow> = {};
    for (const row of all.items) map[row.id] = row;
    setAllById(map);
    setCategories(all.categories);
    setInventory(new Set(inv.items.map((i) => i.ingredientId)));
    setShopping(
      shop.items.map((s) => ({
        ingredientId: s.ingredientId,
        nameZh: map[s.ingredientId]?.nameZh,
      })),
    );
    setStaples(stap.items);
  }

  async function refreshCatalog() {
    const ing = await api.ingredients(
      q || undefined,
      categoryId || undefined,
    );
    setCatalog(ing.items);
    setCategories(ing.categories);
  }

  async function refresh() {
    try {
      await Promise.all([refreshCore(), refreshCatalog()]);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能载入酒柜。");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    void refreshCatalog().catch((e) =>
      setError(e instanceof ApiError ? e.message : "没能载入材料列表。"),
    );
  }, [q, categoryId]);

  const ownedItems = useMemo(() => {
    return [...inventory]
      .map((id) => allById[id])
      .filter((row): row is IngredientRow => !!row)
      .sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh"));
  }, [inventory, allById]);

  const unownedCatalog = useMemo(
    () =>
      catalog.filter(
        (ing) => !inventory.has(ing.id) && ing.canBeStaple !== 1,
      ),
    [catalog, inventory],
  );

  const ownedCount = inventory.size;
  const categoryLabel = (id: string) =>
    categories.find((c) => c.id === id)?.nameZh ?? id;

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>酒柜</h1>
        <p className={styles.muted}>
          只记录增删，当前为 {ownedCount} 种。
        </p>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <section className={styles.panel} aria-labelledby="owned-title">
        <h2 id="owned-title">酒柜已有</h2>
        <p className={styles.hint}>点「移出酒柜」即可移除。</p>
        <div className={styles.listTall}>
          {ownedItems.map((ing) => (
            <div key={ing.id} className={styles.item}>
              <div>
                <strong>{ing.nameZh}</strong>
                <div className={styles.muted}>{ing.nameEn}</div>
                <div className={styles.muted}>{categoryLabel(ing.categoryId)}</div>
              </div>
              <button
                type="button"
                className={styles.btn}
                onClick={() =>
                  void api.removeInventory(ing.id).then(refresh)
                }
              >
                移出酒柜
              </button>
            </div>
          ))}
          {ownedItems.length === 0 && (
            <p className={styles.empty}>
              酒柜还是空的。到下面把家里已有的酒和辅料加进来。
            </p>
          )}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel} aria-labelledby="add-title">
          <h2 id="add-title">加入酒柜</h2>
          <p className={styles.hint}>
            点「加入酒柜」即可添加
          </p>
          <div className={styles.row}>
            <label className="visually-hidden" htmlFor="bar-search">
              搜索材料
            </label>
            <input
              id="bar-search"
              className={styles.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="中文名 / 英文名 / 别名"
            />
            <label htmlFor="bar-cat" className="visually-hidden">
              分类
            </label>
            <select
              id="bar-cat"
              className={styles.select}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">全部分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameZh}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.list}>
            {unownedCatalog.map((ing) => (
              <div key={ing.id} className={styles.item}>
                <div>
                  <strong>{ing.nameZh}</strong>
                  <div className={styles.muted}>{ing.nameEn}</div>
                  <div className={styles.muted}>
                    {categoryLabel(ing.categoryId)}
                  </div>
                </div>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() =>
                    void api.addInventory(ing.id).then(refresh)
                  }
                >
                  加入酒柜
                </button>
              </div>
            ))}
            {unownedCatalog.length === 0 && (
              <p className={styles.empty}>
                {catalog.some(
                  (ing) => !inventory.has(ing.id) && ing.canBeStaple === 1,
                )
                  ? "常备辅料请在右侧勾选，不必再加入酒柜。"
                  : catalog.length > 0
                    ? "这一类都已经在酒柜里了。"
                    : "没有搜到。去管理里添加这种材料吧。"}
              </p>
            )}
          </div>
        </section>

        <div className={styles.side}>
          <section className={styles.panel} aria-labelledby="staple-title">
            <h2 id="staple-title">常备辅料</h2>
            <p className={styles.hint}>勾上后，找配方时会当作已经有。</p>
            <div className={styles.list}>
              {staples.map((s) => (
                <label key={s.ingredientId} className={styles.item}>
                  <span>
                    {s.nameZh}
                    <div className={styles.muted}>{s.nameEn}</div>
                  </span>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) =>
                      void api
                        .setStaple(s.ingredientId, e.target.checked)
                        .then(refresh)
                    }
                  />
                </label>
              ))}
              {staples.length === 0 && (
                <p className={styles.empty}>还没有可设为常备的辅料。</p>
              )}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="shop-title">
            <h2 id="shop-title">采购项</h2>
            <div className={styles.list}>
              {shopping.map((s) => (
                <div key={s.ingredientId} className={styles.item}>
                  <span>{s.nameZh ?? s.ingredientId}</span>
                  <span className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() =>
                        void api.purchase(s.ingredientId).then(refresh)
                      }
                    >
                      已购买
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() =>
                        void api.removeShopping(s.ingredientId).then(refresh)
                      }
                    >
                      移除
                    </button>
                  </span>
                </div>
              ))}
              {shopping.length === 0 && (
                <p className={styles.empty}>
                  采购清单是空的。可通过配方页添加。
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
