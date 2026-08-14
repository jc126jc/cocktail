import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, type RecipeDetail } from "../api/client";
import { MissingStatus, OwnStatus } from "../components/StatusText";
import { ingredientRoleLabel } from "../labels";
import styles from "./RecipeDetailPage.module.css";

export function RecipeDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setDetail(await api.recipe(id));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能打开这杯配方。");
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function addToShopping(ingredientId: string) {
    setBusy(ingredientId);
    try {
      await api.addShopping(ingredientId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能加入采购清单。");
    } finally {
      setBusy(null);
    }
  }

  const backQs = params.toString();

  if (error && !detail) {
    return <p className={styles.error}>{error}</p>;
  }
  if (!detail) return <p>正在打开配方…</p>;

  return (
    <div className={styles.page}>
      <Link
        className={styles.back}
        to={backQs ? `/?${backQs}` : "/"}
      >
        ← 返回配方列表
      </Link>
      <div className={styles.layout}>
        <div className={styles.media}>
          <img
            src="/placeholder-cocktail.svg"
            alt={detail.nameZh}
          />
        </div>
        <div className={styles.body}>
          <header className={styles.header}>
            <h1>
              {detail.nameZh}
              <span className={styles.nameEn}>{detail.nameEn}</span>
            </h1>
            <div className={styles.meta}>
              <MissingStatus count={detail.missingCount} />
              {detail.family && <span>Family：{detail.family.nameZh}</span>}
              {detail.ibaCategory && <span>分类：{detail.ibaCategory}</span>}
              {detail.flavors.filter(Boolean).map((f) => (
                <span key={f!.id}>{f!.nameZh}</span>
              ))}
            </div>
            <ul className={styles.facts}>
              <li>
                杯具：{detail.version.glassware || "—"}
                <span className={styles.factSep}>·</span>
                装饰：{detail.version.garnish || "—"}
              </li>
              <li>来源：{detail.version.sourceName}</li>
            </ul>
          </header>

          <section className={styles.section} aria-labelledby="ings-title">
            <h2 id="ings-title">材料</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">材料</th>
                  <th scope="col">用量</th>
                  <th scope="col">角色</th>
                  <th scope="col">状态</th>
                  <th scope="col">采购</th>
                </tr>
              </thead>
              <tbody>
                {detail.version.ingredients.map((line) => (
                  <tr key={`${line.ingredientId}-${line.role}`}>
                    <td>
                      {line.nameZh || line.displayNote || line.ingredientId}
                    </td>
                    <td>
                      {line.amountMl == null ? "—" : `${line.amountMl} ml`}
                    </td>
                    <td>{ingredientRoleLabel(line.role)}</td>
                    <td>
                      <OwnStatus owned={line.owned} />
                    </td>
                    <td>
                      {line.owned ? (
                        "—"
                      ) : line.inShopping ? (
                        "已加入采购"
                      ) : (
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy === line.ingredientId}
                          onClick={() => void addToShopping(line.ingredientId)}
                        >
                          加入采购
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.section} aria-labelledby="steps-title">
            <h2 id="steps-title">步骤</h2>
            <ol className={styles.steps}>
              {detail.version.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    </div>
  );
}
