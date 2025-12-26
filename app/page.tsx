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

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function uniqNonEmpty(values: (string | null)[]) {
  return Array.from(new Set(values.filter((v): v is string => !!v && v.trim().length > 0)));
}

function hasNull(values: (string | null)[]) {
  return values.some((v) => v === null);
}

type VideoRow = {
  id: string;
  title: string | null;
  video_core_summary?: { hitokoto_summary: string | null }[] | { hitokoto_summary: string | null } | null;
  video_structure_core?:
    | {
        product_value_focus: string | null;
        visual_main_character: string | null;
        emotional_tone: string | null;
      }[]
    | {
        product_value_focus: string | null;
        visual_main_character: string | null;
        emotional_tone: string | null;
      }
    | null;
};

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams);

  const pvf = getParam(sp, "pvf");
  const vmc = getParam(sp, "vmc");
  const tone = getParam(sp, "tone");

  const hasFilter = !!(pvf || vmc || tone);

  type StructureCoreRow = {
    product_value_focus: string | null;
    visual_main_character: string | null;
    emotional_tone: string | null;
  };

  const { data: coreOptions, error: optErr } = await supabase
    .from("video_structure_core")
    .select("product_value_focus, visual_main_character, emotional_tone")
    .limit(500);

  const list = (coreOptions ?? []) as StructureCoreRow[];

  const pvfValues = list.map((r) => r.product_value_focus);
  const vmcValues = list.map((r) => r.visual_main_character);
  const toneValues = list.map((r) => r.emotional_tone);

  const pvfOptions = uniqNonEmpty(pvfValues);
  const vmcOptions = uniqNonEmpty(vmcValues);
  const toneOptions = uniqNonEmpty(toneValues);

  const pvfHasNull = hasNull(pvfValues);
  const vmcHasNull = hasNull(vmcValues);
  const toneHasNull = hasNull(toneValues);

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
    <main className="container">
      <h1>Creative Library（仮）</h1>

      <div className="callout">
        <div className="calloutTitle">まずは試してみてください</div>

        <div className="calloutText">
          企画・提案の参考になる動画クリエイティブを、
          <strong>「見どころ一言」</strong>と
          <strong>「切り口（価値・主役・トーン）」</strong>
          で探せるライブラリです。
        </div>

        <div className="calloutSteps">
          <div>
            <b>①</b> 「条件で探す」で、気になる切り口（価値／主役／トーン）を1つ選んで
            <b>「絞り込む」</b>
          </div>
          <div>
            <b>②</b> 気になる動画を選んで、詳細をチェックしましょう
          </div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>※まずは1つだけ選べばOKです。</div>
        </div>
      </div>

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

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {rows.map((v) => {
          const hitokotoSummary = asArray(v.video_core_summary)[0]?.hitokoto_summary ?? null;
          const core = asArray(v.video_structure_core)[0];

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