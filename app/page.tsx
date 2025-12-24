import { supabase } from "@/lib/supabaseClient";
import { VideoCard } from "@/components/VideoCard";
import { FilterPanel } from "@/components/FilterPanel";

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
  return Array.from(
    new Set(values.filter((v): v is string => !!v && v.trim().length > 0))
  );
}

function hasNull(values: (string | null)[]) {
  return values.some((v) => v === null);
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
    q =
      pvf === NULL_SENTINEL
        ? q.is("video_structure_core.product_value_focus", null)
        : q.eq("video_structure_core.product_value_focus", pvf);
  }
  if (vmc) {
    q =
      vmc === NULL_SENTINEL
        ? q.is("video_structure_core.visual_main_character", null)
        : q.eq("video_structure_core.visual_main_character", vmc);
  }
  if (tone) {
    q =
      tone === NULL_SENTINEL
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

      {/* ✅ フィルタUI（Client Component に移管：filter_used を送れる） */}
      {optErr ? (
        <section style={{ marginTop: 16 }}>
          <pre style={{ marginTop: 8, color: "red", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(optErr, null, 2)}
          </pre>
        </section>
      ) : (
        <FilterPanel
          pvf={pvf}
          vmc={vmc}
          tone={tone}
          pvfOptions={pvfOptions}
          vmcOptions={vmcOptions}
          toneOptions={toneOptions}
          pvfHasNull={pvfHasNull}
          vmcHasNull={vmcHasNull}
          toneHasNull={toneHasNull}
          rowsCount={rows.length}
        />
      )}

      {/* 一覧 */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {rows.map((v) => {
          const hitokotoSummary =
            v.video_core_summary?.[0]?.hitokoto_summary ?? null;
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