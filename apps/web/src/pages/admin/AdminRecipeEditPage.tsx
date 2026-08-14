import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { INGREDIENT_ROLE_LABELS } from "../../labels";
import styles from "./admin.module.css";

type Line = {
  ingredientId: string;
  amountMl: string;
  role: string;
  eitherGroupId: string;
};

const emptyLine = (): Line => ({
  ingredientId: "",
  amountMl: "30",
  role: "required",
  eitherGroupId: "",
});

export function AdminRecipeEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [families, setFamilies] = useState<{ id: string; nameZh: string }[]>(
    [],
  );
  const [flavors, setFlavors] = useState<{ id: string; nameZh: string }[]>([]);
  const [ingredients, setIngredients] = useState<
    { id: string; nameZh: string }[]
  >([]);
  const [nameZh, setNameZh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [flavorIds, setFlavorIds] = useState<string[]>([]);
  const [editorRecommended, setEditorRecommended] = useState(false);
  const [recommendationOrder, setRecommendationOrder] = useState("");
  const [sourceName, setSourceName] = useState("Manual");
  const [versionName, setVersionName] = useState("v1");
  const [glassware, setGlassware] = useState("");
  const [garnish, setGarnish] = useState("");
  const [stepsText, setStepsText] = useState("搅拌均匀");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [recipeId, setRecipeId] = useState<string | null>(isNew ? null : id!);
  const [status, setStatus] = useState<string>("draft");
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [fam, fla, ing] = await Promise.all([
          api.families(),
          api.flavors(),
          api.adminIngredients(),
        ]);
        setFamilies(fam.items);
        setFlavors(fla.items);
        const ingredientOptions = ing.items.map((i) => ({
          id: i.id,
          nameZh: i.nameZh,
        }));
        setIngredients(ingredientOptions);

        if (isNew) {
          if (fam.items[0]) setFamilyId(fam.items[0].id);
          if (ingredientOptions[0]) {
            setLines([
              {
                ingredientId: ingredientOptions[0].id,
                amountMl: "45",
                role: "required",
                eitherGroupId: "",
              },
              {
                ingredientId:
                  ingredientOptions[1]?.id ?? ingredientOptions[0].id,
                amountMl: "20",
                role: "required",
                eitherGroupId: "",
              },
            ]);
          }
          setLoading(false);
          return;
        }

        const recipe = await api.adminRecipe(id!);
        setRecipeId(recipe.id);
        setNameZh(recipe.nameZh);
        setNameEn(recipe.nameEn);
        setFamilyId(recipe.familyId);
        setFlavorIds(recipe.flavorTagIds);
        setEditorRecommended(recipe.editorRecommended);
        setRecommendationOrder(
          recipe.recommendationOrder != null
            ? String(recipe.recommendationOrder)
            : "",
        );
        setStatus(recipe.status);
        if (recipe.version) {
          setSourceName(recipe.version.sourceName);
          setVersionName(recipe.version.versionName);
          setGlassware(recipe.version.glassware ?? "");
          setGarnish(recipe.version.garnish ?? "");
          setStepsText(recipe.version.steps.join("\n"));
          setLines(
            recipe.version.ingredients.length
              ? recipe.version.ingredients.map((l) => ({
                  ingredientId: l.ingredientId,
                  amountMl:
                    l.amountMl != null && Number.isFinite(l.amountMl)
                      ? String(l.amountMl)
                      : "",
                  role: l.role,
                  eitherGroupId: l.eitherGroupId ?? "",
                }))
              : [emptyLine()],
          );
        }
        setLoading(false);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "没能打开这杯配方。");
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  async function save() {
    try {
      setSaving(true);
      setError(null);
      const orderValue =
        recommendationOrder.trim() === ""
          ? null
          : Number.parseInt(recommendationOrder, 10);
      if (
        recommendationOrder.trim() !== "" &&
        (orderValue == null || Number.isNaN(orderValue))
      ) {
        throw new Error("推荐顺序请填整数。");
      }

      const steps = stepsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const ingredientLines = lines
        .filter((l) => l.ingredientId)
        .map((l, index) => ({
          ingredientId: l.ingredientId,
          amountMl:
            l.amountMl.trim() === "" ? null : Number.parseFloat(l.amountMl),
          role: l.role,
          eitherGroupId: l.eitherGroupId.trim() ? l.eitherGroupId.trim() : null,
          sortOrder: index,
        }));
      if (ingredientLines.length < 1) {
        throw new Error("至少保留一行材料");
      }
      if (steps.length < 1) {
        throw new Error("至少保留一步步骤");
      }

      let rid = recipeId;
      if (!rid) {
        const created = await api.createRecipe({
          nameZh,
          nameEn,
          familyId,
          flavorTagIds: flavorIds,
          editorRecommended,
          recommendationOrder: orderValue,
          status: "draft",
        });
        rid = created.id;
        setRecipeId(rid);
      } else {
        await api.updateRecipe(rid, {
          nameZh,
          nameEn,
          familyId,
          flavorTagIds: flavorIds,
          editorRecommended,
          recommendationOrder: orderValue,
        });
      }

      const nextVersionName = isNew
        ? versionName
        : `${versionName.replace(/-edit-\d+$/, "")}-edit-${Date.now()}`;
      const version = await api.createVersion(rid, {
        versionName: nextVersionName,
        sourceName,
        glassware: glassware.trim() || null,
        garnish: garnish.trim() || null,
        steps,
        ingredients: ingredientLines,
      });
      await api.setPrimary(rid, version.id);
      setVersionName(nextVersionName);
      if (isNew) {
        navigate(`/admin/recipes/${rid}`, { replace: true });
        return;
      }
      const refreshed = await api.adminRecipe(rid);
      setStatus(refreshed.status);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "没能保存。",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.stack}>
        <p className={styles.muted}>正在打开配方…</p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <Link to="/admin/recipes">← 配方列表</Link>
      <h1>{isNew ? "新建配方" : `编辑：${nameZh || recipeId}`}</h1>
      <p className={styles.muted}>
        状态：{status}
        {recipeId ? ` · ID ${recipeId}` : ""}。保存会更新元数据并写入新主版本。
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
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
          家族
          <select
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
            required
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nameZh}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>风味（发布前至少选一个）</legend>
          <div className={styles.row}>
            {flavors.map((f) => (
              <label key={f.id} style={{ fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={flavorIds.includes(f.id)}
                  onChange={(e) =>
                    setFlavorIds((prev) =>
                      e.target.checked
                        ? [...prev, f.id]
                        : prev.filter((x) => x !== f.id),
                    )
                  }
                />{" "}
                {f.nameZh}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>首页推荐</legend>
          <label style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={editorRecommended}
              onChange={(e) => setEditorRecommended(e.target.checked)}
            />{" "}
            放在首页推荐（首页最多 2 条）
          </label>
          <label>
            推荐顺序（数字越小越靠前，可空）
            <input
              type="number"
              value={recommendationOrder}
              onChange={(e) => setRecommendationOrder(e.target.value)}
              disabled={!editorRecommended}
            />
          </label>
        </fieldset>

        <label>
          来源
          <input
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            required
          />
        </label>
        <label>
          杯具
          <input
            value={glassware}
            onChange={(e) => setGlassware(e.target.value)}
            placeholder="例如 Old Fashioned / Coupe"
          />
        </label>
        <label>
          装饰
          <input
            value={garnish}
            onChange={(e) => setGarnish(e.target.value)}
            placeholder="例如 Orange twist"
          />
        </label>
        <label>
          版本名
          <input
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            required
          />
        </label>
        <label>
          步骤（每行一步）
          <textarea
            rows={4}
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            required
          />
        </label>

        <fieldset>
          <legend>材料</legend>
          {lines.map((line, index) => (
            <div key={index} className={styles.row} style={{ alignItems: "end" }}>
              <label>
                材料
                <select
                  value={line.ingredientId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index
                          ? { ...l, ingredientId: e.target.value }
                          : l,
                      ),
                    )
                  }
                  required
                >
                  <option value="">选择…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nameZh}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ml
                <input
                  value={line.amountMl}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index ? { ...l, amountMl: e.target.value } : l,
                      ),
                    )
                  }
                />
              </label>
              <label>
                角色
                <select
                  value={line.role}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index ? { ...l, role: e.target.value } : l,
                      ),
                    )
                  }
                >
                  {Object.entries(INGREDIENT_ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                二选一组
                <input
                  value={line.eitherGroupId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index
                          ? { ...l, eitherGroupId: e.target.value }
                          : l,
                      ),
                    )
                  }
                  placeholder="同一组用同一个标记，例如 A"
                  disabled={line.role !== "either"}
                />
              </label>
              <button
                type="button"
                className={styles.btn}
                onClick={() =>
                  setLines((prev) => prev.filter((_, i) => i !== index))
                }
                disabled={lines.length <= 1}
              >
                移除
              </button>
            </div>
          ))}
          <button
            type="button"
            className={styles.btn}
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  ingredientId: ingredients[0]?.id ?? "",
                  amountMl: "15",
                  role: "required",
                  eitherGroupId: "",
                },
              ])
            }
          >
            添加一种材料
          </button>
        </fieldset>

        <div className={styles.row}>
          <button
            type="submit"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={saving}
          >
            {saving ? "保存中…" : isNew ? "创建并保存" : "保存修改"}
          </button>
          {recipeId && (
            <>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setConfirmPublish(true)}
                disabled={status === "published"}
              >
                发布
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={() => setConfirmDelete(true)}
              >
                删除配方
              </button>
            </>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmPublish}
        title="发布此配方？"
        body="请确认名称、材料、步骤、家族和风味都已填好，发布后前台就能看到。"
        confirmLabel="确认发布"
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => {
          if (!recipeId) return;
          void api
            .publish(recipeId, "published")
            .then(() => navigate("/admin/recipes"))
            .catch((e) =>
              setError(e instanceof ApiError ? e.message : "没能发布。"),
            )
            .finally(() => setConfirmPublish(false));
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="删除此配方？"
        body="会删掉这杯配方和它的全部版本，删了就回不来。"
        confirmLabel="确认删除"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!recipeId) return;
          void api
            .deleteRecipe(recipeId)
            .then(() => navigate("/admin/recipes"))
            .catch((e) =>
              setError(e instanceof ApiError ? e.message : "没能删除这杯配方。"),
            )
            .finally(() => setConfirmDelete(false));
        }}
      />
    </div>
  );
}
