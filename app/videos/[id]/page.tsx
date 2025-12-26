import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Script from "next/script";

export const dynamic = "force-dynamic";

type Params = { id: string };

type MaybeArray<T> = T | T[] | null | undefined;

type StructureCoreRow = {
  product_value_focus: string | null;
  visual_main_character: string | null;
  emotional_tone: string | null;
};

type StructureDetailRow = {
  product_value_focus_detail: string | null;
  visual_main_character_detail: string | null;
  emotional_tone_detail: string | null;
  appeal_method: string | null;
  appeal_method_detail: string | null;
};

type CoreSummaryRow = {
  hitokoto_summary: string | null;
};

type ObservationNoteRow = {
  created_at: string | null;
  observation_text: string | null;
  observation_points: unknown; // jsonb
};

type VideoDetailRow = {
  id: string;
  title: string | null;
  youtube_id: string | null;
  channel_name: string | null;
  published_year: number | null;
  created_at: string | null;

  video_core_summary: MaybeArray<CoreSummaryRow>;
  video_structure_core: MaybeArray<StructureCoreRow>;
  video_structure_detail: MaybeArray<StructureDetailRow>;
  video_observation_notes: MaybeArray<ObservationNoteRow>;
};

function normalizeText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeBullets(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);

  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed.length) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((s) => s.trim()).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function pickFirst(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    return v;
  }
  return null;
}

function pickFirstArray(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().length) return v;
  }
  return [];
}

function formatDateYMD(dateStr?: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${dd}`;
}

function asArray<T>(v: MaybeArray<T>): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function VideoDetailPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const p: Params = await Promise.resolve(params);
  const id = p.id;

  const { data: row, error } = await supabase
    .from("videos")
    .select(
      `
        id,
        title,
        youtube_id,
        channel_name,
        published_year,
        created_at,
        video_core_summary ( hitokoto_summary ),
        video_structure_core (
          product_value_focus,
          visual_main_character,
          emotional_tone
        ),
        video_structure_detail (
          product_value_focus_detail,
          visual_main_character_detail,
          emotional_tone_detail,
          appeal_method,
          appeal_method_detail
        ),
        video_observation_notes (
          created_at,
          observation_text,
          observation_points
        )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return (
      <main className="container">
        <div className="topBar">
          <Link href="/" className="backLink">
            ← 一覧へ戻る
          </Link>
        </div>

        <section className="card cardStatic detailBlock">
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>
            詳細の取得でエラーが発生しました
          </h1>
          <pre
            className="errorBox"
            style={{ marginTop: 10, fontSize: 12, lineHeight: 1.6 }}
          >
            {JSON.stringify(error ?? { message: "not found" }, null, 2)}
          </pre>
        </section>
      </main>
    );
  }

  const v = row as unknown as VideoDetailRow;

  // --- Core（カード用タグ） ---
  const core = asArray(v.video_structure_core)[0] ?? null;

  const pvf = normalizeText(
    pickFirst(core, ["product_value_focus", "pvf", "productValueFocus"])
  );
  const vmc = normalizeText(
    pickFirst(core, ["visual_main_character", "vmc", "visualMainCharacter"])
  );
  const tone = normalizeText(
    pickFirst(core, ["emotional_tone", "tone", "emotionalTone"])
  );

  // --- Detail（切り口の解説） ---
  const detail = asArray(v.video_structure_detail)[0] ?? null;

  const pvfNote = normalizeText(
    pickFirst(detail, [
      "product_value_focus_detail",
      "product_value_focus_note",
      "pvf_note",
      "pvfNote",
    ])
  );
  const vmcNote = normalizeText(
    pickFirst(detail, [
      "visual_main_character_detail",
      "visual_main_character_note",
      "vmc_note",
      "vmcNote",
    ])
  );
  const toneNote = normalizeText(
    pickFirst(detail, [
      "emotional_tone_detail",
      "emotional_tone_note",
      "tone_note",
      "toneNote",
    ])
  );

  const appealMethod = normalizeText(
    pickFirst(detail, ["appeal_method", "appealMethod", "main_appeal_method"])
  );
  const appealMethodNote = normalizeText(
    pickFirst(detail, [
      "appeal_method_detail",
      "appeal_method_note",
      "appealMethodNote",
    ])
  );

  // --- Summary（ヒトコト） ---
  const hitokoto = normalizeText(asArray(v.video_core_summary)[0]?.hitokoto_summary);

  // --- Observation Notes（さらに詳しく） ---
  const rawNotes = asArray(v.video_observation_notes);
  rawNotes.sort((a, b) => {
    const ta = new Date(a?.created_at ?? 0).getTime();
    const tb = new Date(b?.created_at ?? 0).getTime();
    return ta - tb;
  });

  const notes = rawNotes
    .map((n, i) => {
      const text = normalizeText(
        pickFirst(n, [
          "observation_text",
          "observationText",
          "note",
          "memo",
          "body",
          "text",
          "content",
        ])
      );
      const bullets = normalizeBullets(
        pickFirstArray(n, [
          "observation_points",
          "observationPoints",
          "points",
          "bullets",
          "items",
          "list",
        ])
      );

      return {
        key: `${n?.created_at ?? "n"}-${i}`,
        text,
        bullets,
      };
    })
    .filter((n) => (n.text && n.text.length) || n.bullets.length > 0);

  const channelName = normalizeText(v.channel_name) ?? "—";
  const publishedYear = v.published_year ? String(v.published_year) : "—";
  const createdAt = formatDateYMD(v.created_at);

  const youtubeId = v.youtube_id ? String(v.youtube_id) : "";
  const videoId = v.id ? String(v.id) : "";

  return (
    <main className="container">
      <div className="topBar">
        <Link href="/" className="backLink">
          ← 一覧へ戻る
        </Link>
      </div>

      <div className="detailStack">
        {/* Hero */}
        <section className="card cardStatic detailHero">
          {/* 2カラム（サムネ＋情報） */}
          <div className="detailHeroTop">
            <div className="detailThumb" aria-hidden="true" />

            <div className="detailHeroMain">
              <h1 className="detailTitle">{v.title ?? "（タイトル未入力）"}</h1>

              <div className="detailMetaRow">
                <span className="metaPill">
                  <span className="metaLabel">チャンネル</span>
                  <span className="metaValue">{channelName}</span>
                </span>

                <span className="metaPill">
                  <span className="metaLabel">公開年</span>
                  <span className="metaValue">{publishedYear}</span>
                </span>

                <span className="metaPill">
                  <span className="metaLabel">登録日</span>
                  <span className="metaValue">{createdAt}</span>
                </span>
              </div>

              <div className="detailTags">
                <div className="tags">
                  <span className="tag">
                    <span className="tagValue">{pvf ?? "未入力"}</span>
                    <span className="tagKey">価値</span>
                  </span>
                  <span className="tag">
                    <span className="tagValue">{vmc ?? "未入力"}</span>
                    <span className="tagKey">主役</span>
                  </span>
                  <span className="tag">
                    <span className="tagValue">{tone ?? "未入力"}</span>
                    <span className="tagKey">トーン</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 動画のポイント（区切り線） */}
          <div className="detailHeroPoint">
            <div className="kicker">動画のポイント</div>
            <div className="detailPointText">
              {hitokoto ?? "（ヒトコト要約未入力）"}
            </div>
          </div>

          {/* 上のYouTubeボタン */}
          <div className="detailHeroAction">
            {youtubeId ? (
              <a
                className="btn btnSecondary btnSmall"
                href={`https://www.youtube.com/watch?v=${v.youtube_id ?? ""}`}
                target="_blank"
                rel="noreferrer"
                data-gtm="youtube_click"
                data-yt-pos="top"
                data-video-id={v.id}
                data-pvf={pvf ?? ""}
                data-vmc={vmc ?? ""}
                data-tone={tone ?? ""}
              >
                YouTubeで動画を見る →
              </a>
            ) : (
              <span className="muted">（youtube_id が未設定です）</span>
            )}
          </div>
        </section>

        {/* 切り口の解説 */}
        <section className="card cardStatic detailBlock">
          <h2 className="sectionTitle">切り口の解説</h2>

          <div className="detailExplainGrid">
            <div className="explainItem">
              <div className="explainMiniTitle">商品価値の捉え方</div>
              <div className="explainTag">
                <span className="tag">
                  <span className="tagValue">{pvf ?? "未入力"}</span>
                </span>
              </div>
              <div className="explainText">{pvfNote ?? "（未入力）"}</div>
            </div>

            <div className="explainItem">
              <div className="explainMiniTitle">映像の主役</div>
              <div className="explainTag">
                <span className="tag">
                  <span className="tagValue">{vmc ?? "未入力"}</span>
                </span>
              </div>
              <div className="explainText">{vmcNote ?? "（未入力）"}</div>
            </div>

            <div className="explainItem">
              <div className="explainMiniTitle">感情トーン</div>
              <div className="explainTag">
                <span className="tag">
                  <span className="tagValue">{tone ?? "未入力"}</span>
                </span>
              </div>
              <div className="explainText">{toneNote ?? "（未入力）"}</div>
            </div>

            <div className="explainItem">
              <div className="explainMiniTitle">主な訴求方法</div>
              <div className="explainTag">
                <span className="tag">
                  <span className="tagValue">{appealMethod ?? "未入力"}</span>
                </span>
              </div>
              <div className="explainText">{appealMethodNote ?? "（未入力）"}</div>
            </div>
          </div>
        </section>

        {/* さらに詳しく */}
        <section className="card cardStatic detailBlock">
          <h2 className="sectionTitle">さらに詳しく（提案のヒント）</h2>

          {notes.length === 0 ? (
            <p className="muted">（メモはまだありません）</p>
          ) : (
            <div className="notesList">
              {notes.map((n) => (
                <div key={n.key} className="noteRowPlain">
                  {n.bullets.length > 0 && (
                    <ul className="noteBullets">
                      {n.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}

                  {(n.text || "").length > 0 && (
                    <>
                      <div className="noteDivider" />
                      <div className="noteConclusionLabel">演出メモ</div>
                      <div className="noteConclusionText">{n.text}</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 下部CV */}
        {youtubeId ? (
          <div className="detailBottomCta">
            <a
              className="btn btnPrimary btnWide"
              href={`https://www.youtube.com/watch?v=${v.youtube_id ?? ""}`}
              target="_blank"
              rel="noreferrer"
              data-gtm="youtube_click"
              data-yt-pos="bottom"
              data-video-id={v.id}
              data-pvf={pvf ?? ""}
              data-vmc={vmc ?? ""}
              data-tone={tone ?? ""}
            >
              YouTubeで元動画を確認する →
            </a>
          </div>
        ) : null}

        {/* 運営用 */}
        <details className="card cardStatic adminDetails">
          <summary className="adminSummary">運営用（IDなど）</summary>
          <div className="adminBody">
            <div className="adminGrid">
              <div className="adminItem">
                <div className="metaLabel">youtube_id</div>
                <div className="metaValue">{youtubeId || "—"}</div>
              </div>
              <div className="adminItem">
                <div className="metaLabel">video_id</div>
                <div className="metaValue">{videoId}</div>
              </div>
            </div>
          </div>
        </details>
      </div>

      <Script id="mvp-youtube-click" strategy="afterInteractive">
        {`
        (function () {
          window.dataLayer = window.dataLayer || [];
          document.addEventListener('click', function (e) {
            var el = e.target && e.target.closest && e.target.closest('a[data-gtm="youtube_click"]');
            if (!el) return;
            var d = el.dataset || {};
            window.dataLayer.push({
              event: 'youtube_click',
              video_id: d.videoId || '',
              pvf: d.pvf || '',
              vmc: d.vmc || '',
              tone: d.tone || '',
              youtube_position: d.ytPos || ''
            });
          }, true);
        })();
        `}
      </Script>
    </main>
  );
}