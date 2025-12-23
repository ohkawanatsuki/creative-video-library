import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  params: { id: string } | Promise<{ id: string }>;
};

type VideoRow = {
  id: string;
  youtube_id: string | null;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  published_year: number | null;
  video_core_summary?: { hitokoto_summary: string | null }[] | null;
  video_structure_core?: {
    product_value_focus: string | null;
    visual_main_character: string | null;
    emotional_tone: string | null;
  }[] | null;
};

type ObservationNoteRow = {
  id: string;
  video_id: string;
  observation_text: string | null;
  observation_points: any | null; // jsonb
  created_at: string;
};

type StructureDetailRow = {
  id: string;
  video_id: string;
  product_value_focus_detail: string | null;
  visual_main_character_detail: string | null;
  appeal_method: string | null;
  appeal_method_detail: string | null;
  emotional_tone_detail: string | null;
  created_at: string;
};

function logSupabaseError(label: string, error: any, meta?: Record<string, any>) {
  console.error(`[supabase_error] ${label}`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    meta,
  });
}

function normalizePoints(points: any): string[] {
  if (!points) return [];
  if (Array.isArray(points)) return points.map(String);
  if (typeof points === "object") return Object.values(points).map(String);
  return [String(points)];
}

export default async function VideoDetailPage({ params }: Props) {
  // ✅ params が Promise になる環境差を吸収
  const resolvedParams = await Promise.resolve(params as any);
  const videoId = resolvedParams?.id as string | undefined;

  if (!videoId || videoId === "undefined") {
    return (
      <main style={{ padding: 40 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          ← 一覧へ戻る
        </Link>

        <h1 style={{ marginTop: 16 }}>動画詳細（エラー）</h1>
        <p>
          URLのIDが取得できませんでした。
          <br />
          （例：/videos/undefined になっている可能性があります）
        </p>
      </main>
    );
  }

  // ①②③：動画＋心臓＋カード用構造
  const { data, error } = await supabase
    .from("videos")
    .select(
      `
        id,
        youtube_id,
        title,
        channel_name,
        thumbnail_url,
        published_year,
        video_core_summary ( hitokoto_summary ),
        video_structure_core ( product_value_focus, visual_main_character, emotional_tone )
      `
    )
    .eq("id", videoId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logSupabaseError("video_detail:videos_join_core_and_core_tags", error, { videoId });

    return (
      <main style={{ padding: 40 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          ← 一覧へ戻る
        </Link>

        <h1 style={{ marginTop: 16 }}>動画詳細（エラー）</h1>
        <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  if (!data) {
    return (
      <main style={{ padding: 40 }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          ← 一覧へ戻る
        </Link>

        <h1 style={{ marginTop: 16 }}>動画詳細</h1>
        <p>該当の動画が見つかりませんでした。</p>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          id: {videoId}
        </div>
      </main>
    );
  }

  const v = data as VideoRow;

  const hitokotoSummary =
    v.video_core_summary?.[0]?.hitokoto_summary ?? "（ヒトコト要約未入力）";

  const core = v.video_structure_core?.[0];
  const productValueFocus = core?.product_value_focus ?? "（未入力）";
  const visualMainCharacter = core?.visual_main_character ?? "（未入力）";
  const emotionalTone = core?.emotional_tone ?? "（未入力）";

  // ④：構造の補足（基本1件想定だが、まずは最新1件を採用）
  const { data: detailData, error: detailError } = await supabase
    .from("video_structure_detail")
    .select(
      `
        id,
        video_id,
        product_value_focus_detail,
        visual_main_character_detail,
        appeal_method,
        appeal_method_detail,
        emotional_tone_detail,
        created_at
      `
    )
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (detailError) {
    logSupabaseError("video_detail:structure_detail_latest", detailError, { videoId });
  }

  const structureDetail = (detailData?.[0] as StructureDetailRow | undefined) ?? null;

  // ⑤：観察メモ（複数件）
  const { data: notesData, error: notesError } = await supabase
    .from("video_observation_notes")
    .select("id, video_id, observation_text, observation_points, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (notesError) {
    logSupabaseError("video_detail:observation_notes_latest10", notesError, { videoId });
  }

  const notes = ((notesData ?? []) as ObservationNoteRow[]).map((n) => ({
    ...n,
    points: normalizePoints(n.observation_points),
  }));

  return (
    <main style={{ padding: 40 }}>
      <Link href="/" style={{ textDecoration: "none" }}>
        ← 一覧へ戻る
      </Link>

      <h1 style={{ marginTop: 16 }}>{v.title ?? "（タイトル未入力）"}</h1>

      <div style={{ marginTop: 8, opacity: 0.8 }}>
        {v.channel_name ?? "（チャンネル未入力）"}
        {v.published_year ? ` / ${v.published_year}` : ""}
      </div>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>ヒトコト要約</h2>
        <div style={{ lineHeight: 1.7 }}>{hitokotoSummary}</div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>構造タグ（カード用）</h2>
        <div style={{ lineHeight: 1.8 }}>
          <div>
            <strong>商品価値の捉え方：</strong>
            {productValueFocus}
          </div>
          <div>
            <strong>映像の主役：</strong>
            {visualMainCharacter}
          </div>
          <div>
            <strong>感情トーン：</strong>
            {emotionalTone}
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>構造の補足（詳細）</h2>

        {detailError ? (
          <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(detailError, null, 2)}
          </pre>
        ) : !structureDetail ? (
          <div style={{ opacity: 0.8 }}>（構造の補足はまだありません）</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ lineHeight: 1.7 }}>
              <strong>商品価値の捉え方（補足）：</strong>
              <div>{structureDetail.product_value_focus_detail ?? "（未入力）"}</div>
            </div>

            <div style={{ lineHeight: 1.7 }}>
              <strong>映像の主役（補足）：</strong>
              <div>{structureDetail.visual_main_character_detail ?? "（未入力）"}</div>
            </div>

            <div style={{ lineHeight: 1.7 }}>
              <strong>主な訴求手法：</strong>
              <div>{structureDetail.appeal_method ?? "（未入力）"}</div>
            </div>

            <div style={{ lineHeight: 1.7 }}>
              <strong>主な訴求手法（補足）：</strong>
              <div>{structureDetail.appeal_method_detail ?? "（未入力）"}</div>
            </div>

            <div style={{ lineHeight: 1.7 }}>
              <strong>感情トーン（補足）：</strong>
              <div>{structureDetail.emotional_tone_detail ?? "（未入力）"}</div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {new Date(structureDetail.created_at).toLocaleString()}
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>観察メモ（判断の補助線）</h2>

        {notesError ? (
          <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
            {JSON.stringify(notesError, null, 2)}
          </pre>
        ) : notes.length === 0 ? (
          <div style={{ opacity: 0.8 }}>（観察メモはまだありません）</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {notes.map((n) => (
              <article
                key={n.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ lineHeight: 1.7 }}>
                  {n.observation_text ?? "（本文なし）"}
                </div>

                {n.points.length > 0 && (
                  <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                    {n.points.map((p, idx) => (
                      <li key={idx} style={{ marginTop: 4 }}>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>参照情報（事実）</h2>
        <div style={{ lineHeight: 1.8 }}>
          <div>
            <strong>youtube_id：</strong>
            {v.youtube_id ?? "null"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            <strong>video id：</strong> {v.id}
          </div>
        </div>
      </section>
    </main>
  );
}