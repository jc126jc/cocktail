import { useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import styles from "./admin.module.css";

export function AdminTaxonomyPage() {
  const [families, setFamilies] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [flavors, setFlavors] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [fam, fla] = await Promise.all([api.families(), api.flavors()]);
    setFamilies(fam.items);
    setFlavors(fla.items);
  }

  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof ApiError ? e.message : "没能载入家族与风味。"),
    );
  }, []);

  return (
    <div className={styles.stack}>
      <h1>家族与风味</h1>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.card}>
        <h2>家族</h2>
        <table className={styles.table}>
          <tbody>
            {families.map((f) => (
              <tr key={f.id}>
                <td>{f.nameZh}</td>
                <td>{f.active === 1 ? "启用" : "停用"}</td>
                <td>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      void api
                        .patchFamily(f.id, { active: f.active !== 1 })
                        .then(load)
                    }
                  >
                    {f.active === 1 ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.card}>
        <h2>风味</h2>
        <table className={styles.table}>
          <tbody>
            {flavors.map((f) => (
              <tr key={f.id}>
                <td>{f.nameZh}</td>
                <td>{f.active === 1 ? "启用" : "停用"}</td>
                <td>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() =>
                      void api
                        .patchFlavor(f.id, { active: f.active !== 1 })
                        .then(load)
                    }
                  >
                    {f.active === 1 ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
