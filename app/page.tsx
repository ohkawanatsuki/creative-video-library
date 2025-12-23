import { supabase } from "@/lib/supabaseClient";
import { VideoCard } from "@/components/VideoCard";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const NULL_SENTINEL = "__NULL__"; // 「未入力」をクエリで表す内部値（表示は（未入力））

function getParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (!v) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const trimmed = String(s).trim();
  return trimmed.length ? trimmed : undefined;
}

function uniqNonEmpty(values: (string | null)[]) {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0)));
}

function hasNull(values: (string | null)[]) {
  return values.some((v) => v === null);
}

function buildHref(base: URLSearchParams, removeKey?: string) {
  const p = new URLSearchParams(base);
  if (removeKey) p.delete(removeKey);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

function valueLabel(v?: string) {
  if (!v) return "";
  if (v === NULL_SENTINEL) return "（未入力）";
  return v;
}

type VideoRow = {
  id: string;
  title: string | null;
  video_core_summary?: { hitokoto_summary: string | null }[] | null;
  video_structure_core?: {
    product_value_focus: string | null;
    visual_main_character: string | null;
    emotional_tone: string | null;
  }[] | null;
};

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  // ✅ Next.js 16系の環境差で searchParams が Promise になるケースを吸収
  const sp = await Promise.resolve(searchParams as any);

  const pvf = getParam(sp, "pvf"); // product_value_focus
  const vmc = getParam(sp, "vmc"); // visual_main_character
  const tone = getParam(sp, "tone"); // emotional_tone

  const hasFilter = !!(pvf || vmc || tone);

  // 現在のクエリをURLSearchParamsに（チップの解除リンク生成用）
  const currentQuery = new URLSearchParams();
  if (pvf) currentQuery.set("pvf", pvf);
  if (vmc) currentQuery.set("vmc", vmc);
  if (tone) currentQuery.set("tone", tone);

  // フィルタ候補（structure_coreから集める）
  const { data: coreOptions, error: optErr } = await supabase
    .from("video_structure_core")
    .select("product_value_focus, visual_main_character, emotional_tone")
    .limit(500);

  const list = coreOptions ?? [];
  const pvfValues = list.map((r: any) => r.product_value_focus as string | null);
  const vmcValues = list.map((r: any) => r.visual_main_character as string | null);
  const toneValues = list.map((r: any) => r.emotional_tone as string | null);

  const pvfOptions = uniqNonEmpty(pvfValues);
  const vmcOptions = uniqNonEmpty(vmcValues);
  const toneOptions = uniqNonEmpty(toneValues);

  const pvfHasNull = hasNull(pvfValues);
  const vmcHasNull = hasNull(vmcValues);
  const toneHasNull = hasNull(toneValues);

  // 一覧取得（①②③）
  // フィルタ時は inner join にして、条件が確実に効くようにする
  const structureSelect = hasFilter
    ? `video_structure_core!inner ( product_value_focus, visual_main_character, emotional_tone )`
    : `video_structure_core ( product_value_focus, visual_main_character, emotional_tone )`;

  let q = supabase
    .from("videos")
    .select(
      `
        id,
        title,
        video_core_summary ( hitokoto_summary ),
        ${structureSelect}
      `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  // ✅ 未入力（null）も絞り込めるようにする
  if (pvf) {
    q = pvf === NULL_SENTINEL
      ? q.is("video_structure_core.product_value_focus", null)
      : q.eq("video_structure_core.product_value_focus", pvf);
  }
  if (vmc) {
    q = vmc === NULL_SENTINEL
      ? q.is("video_structure_core.visual_main_character", null)
      : q.eq("video_structure_core.visual_main_character", vmc);
  }
  if (tone) {
    q = tone === NULL_SENTINEL
      ? q.is("video_structure_core.emotional_tone", null)
      : q.eq("video_structure_core.emotional_tone", tone);
  }

  const { data, error } = await q;

  if (error) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Creative Library（仮）</h1>
        <p>一覧取得でエラーが発生しました。</p>
        <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  const rows = (data ?? []) as VideoRow[];

  return (
    <main style={{ padding: 40 }}>
      <h1>Creative Library（仮）</h1>
      <p>企画・提案のためのクリエイティブ参照ライブラリ。</p>

      {/* フィルタUI（最小 + 未入力対応 + 適用中表示） */}
      <section
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700 }}>フィルタ（最小）</div>

        {optErr && (
          <pre style={{ marginTop: 8, color: "red", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(optErr, null, 2)}
          </pre>
        )}

        {/* ✅ 適用中フィルタ（チップ） */}
        {hasFilter && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>適用中：</div>

            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {pvf && (
                <a href={buildHref(currentQuery, "pvf")} style={chipStyle}>
                  商品価値の捉え方：{valueLabel(pvf)} <span style={{ opacity: 0.7 }}>×</span>
                </a>
              )}
              {vmc && (
                <a href={buildHref(currentQuery, "vmc")} style={chipStyle}>
                  映像の主役：{valueLabel(vmc)} <span style={{ opacity: 0.7 }}>×</span>
                </a>
              )}
              {tone && (
                <a href={buildHref(currentQuery, "tone")} style={chipStyle}>
                  感情トーン：{valueLabel(tone)} <span style={{ opacity: 0.7 }}>×</span>
                </a>
              )}
            </div>
          </div>
        )}

        <form method="GET" style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 700 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14 }}>
              <strong>商品価値の捉え方</strong>
            </span>
            <select name="pvf" defaultValue={pvf ?? ""} style={selectStyle}>
              <option value="">（指定しない）</option>
              {pvfHasNull && <option value={NULL_SENTINEL}>（未入力）</option>}
              {pvfOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14 }}>
              <strong>映像の主役</strong>
            </span>
            <select name="vmc" defaultValue={vmc ?? ""} style={selectStyle}>
              <option value="">（指定しない）</option>
              {vmcHasNull && <option value={NULL_SENTINEL}>（未入力）</option>}
              {vmcOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 14 }}>
              <strong>感情トーン</strong>
            </span>
            <select name="tone" defaultValue={tone ?? ""} style={selectStyle}>
              <option value="">（指定しない）</option>
              {toneHasNull && <option value={NULL_SENTINEL}>（未入力）</option>}
              {toneOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" style={buttonStyle}>
              絞り込む
            </button>
            <a href="/" style={{ fontSize: 14, textDecoration: "none" }}>
              リセット
            </a>
            <span style={{ fontSize: 12, opacity: 0.8 }}>件数：{rows.length}</span>
          </div>
        </form>
      </section>

      {/* 一覧 */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {rows.map((v) => {
          const hitokotoSummary = v.video_core_summary?.[0]?.hitokoto_summary ?? null;
          const core = v.video_structure_core?.[0];

          return (
            <VideoCard
              key={v.id}
              id={v.id}
              title={v.title}
              hitokotoSummary={hitokotoSummary}
              productValueFocus={core?.product_value_focus ?? null}
              visualMainCharacter={core?.visual_main_character ?? null}
              emotionalTone={core?.emotional_tone ?? null}
            />
          );
        })}
      </div>
    </main>
  );
}

const selectStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  border: "1px solid #ddd",
  borderRadius: 999,
  padding: "6px 10px",
  textDecoration: "none",
  fontSize: 13,
};