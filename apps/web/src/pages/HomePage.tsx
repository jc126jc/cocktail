import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  type AlcoholGroup,
  type RecipeCard,
  ApiError,
} from "../api/client";
import { MissingStatus } from "../components/StatusText";
import styles from "./HomePage.module.css";

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const alcoholIds = parseList(params.get("alcohol"));
  const familyIds = parseList(params.get("family"));
  const flavorIds = parseList(params.get("flavor"));
  const sort = params.get("sort") ?? "completeness";
  const randomSeed = params.get("seed") ?? "";

  const [groups, setGroups] = useState<AlcoholGroup[]>([]);
  const [families, setFamilies] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [flavors, setFlavors] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [items, setItems] = useState<RecipeCard[]>([]);
  const [homeRecs, setHomeRecs] = useState<
    {
      id: string;
      nameZh: string;
      nameEn: string;
      completenessKnown: boolean;
      statusLabel?: string;
    }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState(q);

  const updateParam = useCallback(
    (key: string, values: string[] | string) => {
      const next = new URLSearchParams(params);
      if (Array.isArray(values)) {
        if (values.length) next.set(key, values.join(","));
        else next.delete(key);
      } else if (values) next.set(key, values);
      else next.delete(key);
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if (trimmed === q.trim()) return;
      updateParam("q", trimmed);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, q, updateParam]);

  useEffect(() => {
    void (async () => {
      try {
        const [g, fam, fla, home] = await Promise.all([
          api.alcoholGroups(),
          api.families(),
          api.flavors(),
          api.homeRecommendations(),
        ]);
        setGroups(g.items);
        setFamilies(fam.items.filter((f) => f.active === 1));
        setFlavors(fla.items.filter((f) => f.active === 1));
        setHomeRecs(home.items);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "没能载入筛选条件。");
      }
    })();
  }, []);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (alcoholIds.length) qs.set("alcoholGroupIds", alcoholIds.join(","));
    if (familyIds.length) qs.set("familyIds", familyIds.join(","));
    if (flavorIds.length) qs.set("flavorIds", flavorIds.join(","));
    qs.set("sort", sort);
    if (sort === "random") {
      qs.set("randomSeed", randomSeed || "home");
    }
    return qs.toString();
  }, [q, alcoholIds, familyIds, flavorIds, sort, randomSeed]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await api.searchRecipes(queryString);
        if (!cancelled) {
          setItems(res.items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "没能搜到配方，请稍后再试。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  function toggleAlcohol(id: string) {
    if (alcoholIds.includes(id)) {
      updateParam(
        "alcohol",
        alcoholIds.filter((x) => x !== id),
      );
      return;
    }
    if (alcoholIds.length >= 2) {
      setError("酒类最多选两种。");
      return;
    }
    updateParam("alcohol", [...alcoholIds, id]);
  }

  function toggleMulti(key: "family" | "flavor", id: string, current: string[]) {
    updateParam(
      key,
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  const showHomeRecs = alcoholIds.length === 0 && !q.trim();

  return (
    <div className={styles.page}>
      {showHomeRecs && homeRecs.length > 0 && (
        <section className={styles.reco} aria-labelledby="home-rec-title">
          <h2 id="home-rec-title" className={styles.sectionTitle}>
            后台推荐
          </h2>
          <p className={styles.hint}>
            {homeRecs.some((r) => !r.completenessKnown) ? (
              <>
                酒柜还是空的，暂时看不出缺不缺料。先去{" "}
                <Link to="/bar">酒柜</Link> 勾上已有的酒。
              </>
            ) : (
              "后台推荐"
            )}
          </p>
          <div className={styles.recoList}>
            {homeRecs.map((r) => (
              <Link key={r.id} to={`/recipes/${r.id}`} className={styles.recoItem}>
                <strong>{r.nameZh}</strong>
                <div className={styles.meta}>
                  <span>{r.nameEn}</span>
                  {!r.completenessKnown && <span>酒柜空着，齐全程度未知</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="recipe-search-title">
        <h2 id="recipe-search-title" className={styles.sectionTitle}>
          配方搜索
        </h2>
        <p className={styles.hint}>
          支持中/英文，可与筛选/排序并用
        </p>
        <label className="visually-hidden" htmlFor="recipe-search">
          配方搜索
        </label>
        <input
          id="recipe-search"
          className={styles.searchInput}
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="例如：长岛、Negroni"
          autoComplete="off"
        />
      </section>

      <section aria-labelledby="alcohol-title">
        <h2 id="alcohol-title" className={styles.sectionTitle}>
          酒体偏好
        </h2>
        <p className={styles.hint}>
          {groups.some((g) => g.owned)
            ? "上限2种"
            : "上限2种，当前酒柜待补充"}
        </p>
        <div className={styles.chips} role="group" aria-label="酒类选择">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={styles.chip}
              aria-pressed={alcoholIds.includes(g.id)}
              onClick={() => toggleAlcohol(g.id)}
            >
              {g.nameZh}
              {g.owned && <span className={styles.ownedMark}>已有</span>}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.filters} aria-label="筛选与排序">
        <div className={styles.field}>
          <label>Family</label>
          <p className={styles.fieldHint}>可选多种，符合其中一种即可。</p>
          <div className={styles.checkGrid}>
            {families.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={familyIds.includes(f.id)}
                  onChange={() => toggleMulti("family", f.id, familyIds)}
                />
                {f.nameZh}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label>Flavor</label>
          <p className={styles.fieldHint}>可选多种，需要同时符合。</p>
          <div className={styles.checkGrid}>
            {flavors.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={flavorIds.includes(f.id)}
                  onChange={() => toggleMulti("flavor", f.id, flavorIds)}
                />
                {f.nameZh}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="sort">排序</label>
          <div className={styles.sortControls}>
            <select
              id="sort"
              className={styles.select}
              value={sort}
              onChange={(e) => {
                const value = e.target.value;
                const next = new URLSearchParams(params);
                next.set("sort", value);
                if (value === "random") {
                  next.set("seed", String(Date.now()));
                } else {
                  next.delete("seed");
                }
                setParams(next, { replace: true });
              }}
            >
              <option value="completeness">按材料</option>
              <option value="name">按名称</option>
              <option value="random">随机</option>
            </select>
            {sort === "random" && (
              <button
                type="button"
                className={styles.shuffleBtn}
                onClick={() => updateParam("seed", String(Date.now()))}
              >
                换一批
              </button>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="results-title" aria-busy={loading}>
        <h2 id="results-title" className={styles.sectionTitle}>
          配方
        </h2>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {loading && <p className={styles.hint}>正在找配方…</p>}
        {!loading && items.length === 0 && (
          <div className={styles.empty}>
            {q.trim()
              ? "没找到这杯。试试改个名字，或少选一点酒类和筛选。"
              : (
                <>
                  这个组合暂时没有配方。试试少选一点，或到{" "}
                  <Link to="/admin">管理</Link> 里补一杯。
                </>
              )}
          </div>
        )}
        <div className={styles.results}>
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/recipes/${item.id}?${params.toString()}`}
              className={styles.card}
            >
              <img
                className={styles.cardImg}
                src="/placeholder-cocktail.svg"
                    alt={item.nameZh}
              />
              <div>
                <h3>
                  {item.nameZh}{" "}
                  <span className={styles.meta}>{item.nameEn}</span>
                </h3>
                <div className={styles.meta}>
                  <MissingStatus count={item.missingCount} />
                  {item.recommended && (
                    <span className={styles.recBadge}>推荐</span>
                  )}
                  {item.family && <span>{item.family.nameZh}</span>}
                  {item.flavors.slice(0, 3).map((f) => (
                    <span key={f.id}>{f.nameZh}</span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
