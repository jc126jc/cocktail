import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  ApiError,
  type AiParsedRecipe,
  type IngredientRow,
} from "../../api/client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ingredientRoleLabel, mappingMethodLabel } from "../../labels";
import styles from "./admin.module.css";

type LineMap = {
  ingredientId: string;
  amountMl: number | null;
  useEstimate: boolean;
};

export function AdminRecipeImportPage() {
  const navigate = useNavigate();
  const [aiOk, setAiOk] = useState<boolean | null>(null);
  const [aiHint, setAiHint] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<AiParsedRecipe | null>(null);
  const [pending, setPending] = useState<{
    draft: AiParsedRecipe;
    diff: string[];
    taxonomyReason?: string | null;
  } | null>(null);
  const [families, setFamilies] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [flavors, setFlavors] = useState<
    { id: string; nameZh: string; active: number }[]
  >([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [familyId, setFamilyId] = useState("other");
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [lineMaps, setLineMaps] = useState<LineMap[]>([]);
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [glassware, setGlassware] = useState("");
  const [garnish, setGarnish] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxonomyReason, setTaxonomyReason] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [status, fam, fla, ings] = await Promise.all([
          api.aiStatus(),
          api.families(),
          api.flavors(),
          api.adminIngredients(),
        ]);
        setAiOk(status.available);
        setAiHint(
          status.available
            ? "AI 已接通，可以解析酒谱。"
            : "助手暂时用不了。配方和材料仍可手工维护。",
        );
        setFamilies(fam.items.filter((f) => f.active === 1));
        setFlavors(fla.items.filter((f) => f.active === 1));
        setIngredients(ings.items.filter((i) => i.active === 1));
      } catch (e) {
        setAiOk(false);
        setError(e instanceof ApiError ? e.message : "没能载入导入页。");
      }
    })();
  }, []);

  function applyDraft(next: AiParsedRecipe, reason?: string | null) {
    setDraft(next);
    setTaxonomyReason(reason ?? null);
    setNameZh(next.name_zh);
    setNameEn(next.name_en);
    setFamilyId(next.suggested_family_id || "other");
    setFlavorIds(next.suggested_flavor_ids ?? []);
    setGlassware(
      next.glassware.mapped_id
        ? next.glassware.raw_text
        : next.glassware.raw_text || "",
    );
    setGarnish(
      next.garnish
        .map((g) =>
          g.mapped_id
            ? g.raw_text
            : g.uncertain
              ? `${g.raw_text}（待确认）`
              : g.raw_text,
        )
        .filter(Boolean)
        .join("；"),
    );
    setStepsText(next.steps.join("\n"));
    setLineMaps(
      next.ingredients.map((ing) => ({
        ingredientId: ing.mapping?.ingredientId ?? "",
        amountMl: ing.amount_ml,
        useEstimate: false,
      })),
    );
  }

  async function onParse() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.aiImportParse({
        sourceName: sourceName.trim() || "未命名来源",
        sourceUrl: sourceUrl.trim() || null,
        sourceText,
      });
      applyDraft(res.draft, res.taxonomyReason);
      setPending(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能解析这段酒谱。");
    } finally {
      setBusy(false);
    }
  }

  async function onReparse() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.aiImportReparse({
        sourceName: sourceName.trim() || "未命名来源",
        sourceUrl: sourceUrl.trim() || null,
        sourceText,
        previous: draft,
        instruction: instruction.trim() || undefined,
      });
      setPending({
        draft: res.draft,
        diff: res.diff.changedPaths,
        taxonomyReason: res.taxonomyReason,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能按说明再解析。");
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!draft) return;
    if (lineMaps.some((m) => !m.ingredientId)) {
      setError("请先为每种材料选好对应的标准材料，再保存草稿。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const steps = stepsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.aiImportCommit({
        draft,
        nameZh,
        nameEn,
        familyId,
        flavorTagIds: flavorIds,
        sourceName: sourceName.trim() || draft.source.name || "未命名来源",
        sourceUrl: sourceUrl.trim() || draft.source.url,
        glassware: glassware || null,
        garnish: garnish || null,
        steps,
        ingredients: draft.ingredients.map((ing, i) => {
          const map = lineMaps[i]!;
          const amountMl = map.useEstimate
            ? ing.estimated_amount_ml
            : map.amountMl;
          return {
            ingredientId: map.ingredientId,
            amountMl: amountMl ?? null,
            role: ing.role,
            eitherGroupId: ing.either_group,
            displayNote:
              ing.raw_amount || ing.raw_unit
                ? `${ing.raw_amount} ${ing.raw_unit}`.trim()
                : null,
          };
        }),
      });
      navigate(`/admin/recipes/${res.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "没能保存草稿。");
    } finally {
      setBusy(false);
    }
  }

  const ingredientOptions = useMemo(
    () =>
      [...ingredients].sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh")),
    [ingredients],
  );

  return (
    <div className={styles.stack}>
      <div className={`${styles.row} ${styles.toolbar}`}>
        <div>
          <h1>从原文导入</h1>
          <p className={styles.muted}>
            粘贴现成酒谱，AI 帮你整理成草稿，你确认后再保存。不会直接发布。
          </p>
          <p className={styles.muted}>{aiHint}</p>
        </div>
        <Link className={styles.btn} to="/admin/recipes">
          返回列表
        </Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.card}>
        <h2>1. 来源与原文</h2>
        <div className={styles.formGrid}>
          <label>
            来源名称
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="例如 IBA / 某书"
            />
          </label>
          <label>
            来源 URL（可选）
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
        </div>
        <label className={styles.blockLabel} htmlFor="ai-import-source">
          酒谱原文（最多 10000 字）
        </label>
        <div className={styles.sourceShell}>
          <textarea
            id="ai-import-source"
            className={styles.sourceInput}
            rows={12}
            maxLength={10000}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="粘贴中文或英文酒谱…"
          />
          <button
            type="button"
            className={styles.sourceParse}
            disabled={!aiOk || busy || sourceText.trim().length < 1}
            onClick={() => void onParse()}
          >
            {busy ? "…" : "解析"}
          </button>
        </div>
        {!aiOk && (
          <p className={styles.muted}>
            解析需要联网并配好 AI 密钥。
          </p>
        )}
      </section>

      {draft && (
        <>
          <section className={styles.card}>
            <h2>2. 再解析（可选）</h2>
            <label className={styles.blockLabel}>
              修正说明
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="例如：Bourbon 和 Rye 算二选一"
              />
            </label>
            <button
              type="button"
              className={styles.btn}
              disabled={!aiOk || busy}
              onClick={() => void onReparse()}
            >
              按说明再解析一次
            </button>
          </section>

          <section className={styles.card}>
            <h2>3. 核对草稿</h2>
            {draft.uncertain_fields.length > 0 && (
              <p className={styles.warn}>
                待确认：{draft.uncertain_fields.join("、")}
              </p>
            )}
            <p className={styles.muted}>
              先自动对上标准材料，对不上的再给建议，最后由你确认。不会新建材料，也不会改别名。
            </p>
            {taxonomyReason && (
              <p className={styles.muted}>分类依据：{taxonomyReason}</p>
            )}
            <div className={styles.formGrid}>
              <label>
                中文名
                <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
              </label>
              <label>
                英文名
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              </label>
              <label>
                家族（可后改；发布前必填有效家族）
                <select
                  value={familyId}
                  onChange={(e) => setFamilyId(e.target.value)}
                >
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nameZh}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className={styles.fieldset}>
              <legend>风味建议（可空，发布前再补）</legend>
              <div className={styles.checkGrid}>
                {flavors.map((f) => (
                  <label key={f.id}>
                    <input
                      type="checkbox"
                      checked={flavorIds.includes(f.id)}
                      onChange={() =>
                        setFlavorIds((cur) =>
                          cur.includes(f.id)
                            ? cur.filter((x) => x !== f.id)
                            : [...cur, f.id],
                        )
                      }
                    />
                    {f.nameZh}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.formGrid}>
              <label>
                杯具
                {draft.glassware.pending ? (
                  <span className={styles.warn}>（没有对上常用杯具，请手改）</span>
                ) : draft.glassware.mapped_id ? (
                  <span className={styles.muted}>
                    （已对上标准杯具）
                  </span>
                ) : null}
                <input
                  value={glassware}
                  onChange={(e) => setGlassware(e.target.value)}
                />
              </label>
              <label>
                装饰
                <input
                  value={garnish}
                  onChange={(e) => setGarnish(e.target.value)}
                />
              </label>
            </div>
            {draft.garnish.some((g) => g.uncertain) && (
              <p className={styles.warn}>
                有些装饰没对上标准材料，已留下原文，可手改。
              </p>
            )}
            <label className={styles.blockLabel}>
              步骤（每行一步）
              <textarea
                className={styles.textarea}
                rows={6}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
              />
            </label>

            <h3>核对材料</h3>
            <p className={styles.muted}>
              对得上的会先填好；没把握的请你再选。可点建议一键填入。
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>原文</th>
                  <th>角色</th>
                  <th>原始量</th>
                  <th>ml</th>
                  <th>怎么对上的 / 建议</th>
                  <th>标准材料</th>
                </tr>
              </thead>
              <tbody>
                {draft.ingredients.map((ing, i) => {
                  const map = lineMaps[i];
                  const method = ing.mapping?.method ?? null;
                  const autoId = ing.mapping?.ingredientId ?? null;
                  const candidates = ing.mapping?.candidates ?? [];
                  return (
                    <tr key={`${ing.raw_name}-${i}`}>
                      <td>
                        {ing.raw_name}
                        {ing.uncertain || !map?.ingredientId ? (
                          <span className={styles.warn}> 待确认</span>
                        ) : null}
                        {ing.mapping?.preselected ? (
                          <span className={styles.muted}>（AI 预选）</span>
                        ) : null}
                      </td>
                      <td>{ingredientRoleLabel(ing.role)}</td>
                      <td>
                        {ing.raw_amount} {ing.raw_unit}
                        {ing.estimated_amount_ml != null && (
                          <div className={styles.muted}>
                            AI 估算 {ing.estimated_amount_ml} ml
                            <label>
                              <input
                                type="checkbox"
                                checked={map?.useEstimate ?? false}
                                onChange={(e) =>
                                  setLineMaps((rows) =>
                                    rows.map((r, idx) =>
                                      idx === i
                                        ? {
                                            ...r,
                                            useEstimate: e.target.checked,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              />
                              确认估算
                            </label>
                          </div>
                        )}
                      </td>
                      <td>
                        {map?.useEstimate
                          ? (ing.estimated_amount_ml ?? "—")
                          : (map?.amountMl ?? "—")}
                      </td>
                      <td>
                        <div className={styles.muted}>
                          {mappingMethodLabel(method)}
                        </div>
                        {candidates.length > 0 && (
                          <div className={styles.row}>
                            {candidates.map((c) => (
                              <button
                                key={c.ingredientId}
                                type="button"
                                className={styles.btn}
                                title={c.reason ?? ""}
                                onClick={() =>
                                  setLineMaps((rows) =>
                                    rows.map((r, idx) =>
                                      idx === i
                                        ? {
                                            ...r,
                                            ingredientId: c.ingredientId,
                                          }
                                        : r,
                                    ),
                                  )
                                }
                              >
                                {(c.nameZh ?? c.ingredientId) +
                                  (c.confidence != null
                                    ? ` ${Math.round(c.confidence * 100)}%`
                                    : "")}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <select
                          value={map?.ingredientId ?? ""}
                          onChange={(e) =>
                            setLineMaps((rows) =>
                              rows.map((r, idx) =>
                                idx === i
                                  ? { ...r, ingredientId: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        >
                          <option value="">选择…</option>
                          {ingredientOptions.map((ingOpt) => (
                            <option key={ingOpt.id} value={ingOpt.id}>
                              {ingOpt.nameZh} / {ingOpt.nameEn}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className={styles.row}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={busy}
                onClick={() => void onCommit()}
              >
                确认保存为草稿
              </button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!pending}
        title="用这次再解析的结果？"
        body={
          pending
            ? `会改动：${pending.diff.length ? pending.diff.join("、") : "（看起来没差，仍可替换）"}`
            : ""
        }
        confirmLabel="替换当前草稿"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) applyDraft(pending.draft, pending.taxonomyReason);
          setPending(null);
        }}
      />
    </div>
  );
}
