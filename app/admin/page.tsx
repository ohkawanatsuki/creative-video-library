import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TAG_OPTIONS } from "@/lib/tagOptions";
import { TagPickerInput } from "@/components/admin/TagPickerInput";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

type RecentVideoRow = {
  id: string;
  youtube_id: string | null;
  title: string | null;
  channel_name: string | null;
  published_year: number | null;
  created_at: string | null;
};

type StructureCoreRow = {
  product_value_focus: string | null;
  visual_main_character: string | null;
  emotional_tone: string | null;
};

type StructureDetailRow = {
  appeal_method: string | null;
};

type AdminErrorMeta = Record<string, unknown>;

function getParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function extractYouTubeId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // ID直貼り（YouTube動画IDは通常11文字）
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // /shorts/<id>, /embed/<id>
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
    if (idx >= 0) {
      const id = parts[idx + 1];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

function logAdminError(label: string, error: unknown, meta?: AdminErrorMeta) {
  const e = (typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  console.error(`[admin_error] ${label}`, {
    message: typeof e.message === "string" ? e.message : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    meta,
  });
}

type UpsertResult = { ok: true } | { ok: false; error: PostgrestError };

async function upsertByVideoId(
  table:
    | "video_core_summary"
    | "video_structure_core"
    | "video_structure_detail"
    | "video_observation_notes",
  video_id: string,
  payload: Record<string, unknown>
): Promise<UpsertResult> {
  const { error } = await supabaseAdmin
    .from(table)
    .upsert({ video_id, ...payload }, { onConflict: "video_id" }); // DB側UNIQUE(video_id)前提
  if (error) return { ok: false, error };
  return { ok: true };
}

async function isAuthed(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // ✅ 本番公開前ガード：未設定なら「未認証」扱い（= admin を開けない）
  if (!adminPassword) return false;

  const store = await cookies();
  return store.get("admin_auth")?.value === "1";
}

async function fetchRecentVideos(): Promise<{ data: RecentVideoRow[]; error: PostgrestError | null }> {
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("id, youtube_id, title, channel_name, published_year, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return { data: (data ?? []) as RecentVideoRow[], error };
}

function uniqStrings(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((v) => (v ?? "").trim())
        .filter((v) => v.length > 0)
    )
  );
}

function mergeOptions(base: readonly string[], fromDb: string[]) {
  const baseSet = new Set(base);
  const extras = fromDb.filter((v) => !baseSet.has(v)).sort((a, b) => a.localeCompare(b, "ja"));
  return [...base, ...extras];
}

async function fetchAdminTagOptions(): Promise<{
  pvfDb: string[];
  vmcDb: string[];
  toneDb: string[];
  appealDb: string[];
}> {
  // MVPの動画本数なら2000で十分（必要なら増やす）
  const { data: coreRows, error: coreErr } = await supabaseAdmin
    .from("video_structure_core")
    .select("product_value_focus, visual_main_character, emotional_tone")
    .limit(2000);

  const { data: detailRows, error: detailErr } = await supabaseAdmin
    .from("video_structure_detail")
    .select("appeal_method")
    .limit(2000);

  if (coreErr) logAdminError("fetchAdminTagOptions:core", coreErr);
  if (detailErr) logAdminError("fetchAdminTagOptions:detail", detailErr);

  const core = (coreRows ?? []) as StructureCoreRow[];
  const detail = (detailRows ?? []) as StructureDetailRow[];

  const pvfDb = uniqStrings(core.map((r) => r.product_value_focus));
  const vmcDb = uniqStrings(core.map((r) => r.visual_main_character));
  const toneDb = uniqStrings(core.map((r) => r.emotional_tone));
  const appealDb = uniqStrings(detail.map((r) => r.appeal_method));

  return {
    pvfDb,
    vmcDb,
    toneDb,
    appealDb,
  };
}

/* ---------------------------
Server Actions
--------------------------- */

async function loginAction(formData: FormData) {
  "use server";
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) redirect("/admin");

  const password = String(formData.get("password") ?? "");
  if (password === adminPassword) {
    const store = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    store.set("admin_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd, // ✅ 本番のみ secure
      maxAge: 60 * 60 * 24 * 7, // ✅ 7日
    });
    redirect("/admin");
  } else {
    redirect("/admin?login=fail");
  }
}

async function logoutAction() {
  "use server";
  const isProd = process.env.NODE_ENV === "production";
  const store = await cookies();
  store.set("admin_auth", "", { path: "/", maxAge: 0, secure: isProd });
  redirect("/admin");
}

async function createVideoAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const youtube_id = String(formData.get("youtube_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const channel_name = String(formData.get("channel_name") ?? "").trim();
  const thumbnail_urlRaw = String(formData.get("thumbnail_url") ?? "").trim();
  const published_yearRaw = String(formData.get("published_year") ?? "").trim();

  const thumbnail_url = thumbnail_urlRaw.length ? thumbnail_urlRaw : null;
  const published_year = published_yearRaw.length ? Number(published_yearRaw) : null;

  const { data, error } = await supabaseAdmin
    .from("videos")
    .insert({
      youtube_id,
      title,
      channel_name,
      thumbnail_url,
      published_year,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    logAdminError("createVideoAction:insert_videos", error, { youtube_id, title });
    redirect(`/admin?err=${encodeURIComponent(error.message)}`);
  }

  const newId = (data as { id?: string } | null)?.id;
  if (!newId) {
    redirect(`/admin?err=${encodeURIComponent("INSERT succeeded but no id was returned.")}`);
  }

  redirect(`/admin?created_video_id=${encodeURIComponent(newId)}&ok=${encodeURIComponent("video_saved")}`);
}

async function createCoreSummaryAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const video_id = String(formData.get("video_id") ?? "").trim();
  const hitokoto_summary = String(formData.get("hitokoto_summary") ?? "").trim();

  const { error } = await supabaseAdmin.from("video_core_summary").insert({
    video_id,
    hitokoto_summary,
  });

  if (error) {
    logAdminError("createCoreSummaryAction:insert_video_core_summary", error, { video_id });
    redirect(`/admin?err=${encodeURIComponent(error.message)}`);
  }
  redirect(`/admin?ok=core_summary_saved&video_id=${encodeURIComponent(video_id)}`);
}

async function createStructureCoreAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const video_id = String(formData.get("video_id") ?? "").trim();
  const product_value_focus = String(formData.get("product_value_focus") ?? "").trim();
  const visual_main_character = String(formData.get("visual_main_character") ?? "").trim();
  const emotional_tone = String(formData.get("emotional_tone") ?? "").trim();

  const { error } = await supabaseAdmin.from("video_structure_core").insert({
    video_id,
    product_value_focus: product_value_focus.length ? product_value_focus : null,
    visual_main_character: visual_main_character.length ? visual_main_character : null,
    emotional_tone: emotional_tone.length ? emotional_tone : null,
  });

  if (error) {
    logAdminError("createStructureCoreAction:insert_video_structure_core", error, { video_id });
    redirect(`/admin?err=${encodeURIComponent(error.message)}`);
  }
  redirect(`/admin?ok=structure_core_saved&video_id=${encodeURIComponent(video_id)}`);
}

async function createStructureDetailAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const video_id = String(formData.get("video_id") ?? "").trim();

  const product_value_focus_detail = String(formData.get("product_value_focus_detail") ?? "").trim();
  const visual_main_character_detail = String(formData.get("visual_main_character_detail") ?? "").trim();
  const appeal_method = String(formData.get("appeal_method") ?? "").trim();
  const appeal_method_detail = String(formData.get("appeal_method_detail") ?? "").trim();
  const emotional_tone_detail = String(formData.get("emotional_tone_detail") ?? "").trim();

  const { error } = await supabaseAdmin.from("video_structure_detail").insert({
    video_id,
    product_value_focus_detail: product_value_focus_detail.length ? product_value_focus_detail : null,
    visual_main_character_detail: visual_main_character_detail.length ? visual_main_character_detail : null,
    appeal_method: appeal_method.length ? appeal_method : null,
    appeal_method_detail: appeal_method_detail.length ? appeal_method_detail : null,
    emotional_tone_detail: emotional_tone_detail.length ? emotional_tone_detail : null,
  });

  if (error) {
    logAdminError("createStructureDetailAction:insert_video_structure_detail", error, { video_id });
    redirect(`/admin?err=${encodeURIComponent(error.message)}`);
  }
  redirect(`/admin?ok=structure_detail_saved&video_id=${encodeURIComponent(video_id)}`);
}

async function createObservationNoteAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const video_id = String(formData.get("video_id") ?? "").trim();
  const observation_text = String(formData.get("observation_text") ?? "").trim();
  const pointsRaw = String(formData.get("observation_points") ?? "");

  const points = pointsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabaseAdmin.from("video_observation_notes").insert({
    video_id,
    observation_text: observation_text.length ? observation_text : null,
    observation_points: points.length ? points : null,
  });

  if (error) {
    logAdminError("createObservationNoteAction:insert_video_observation_notes", error, { video_id });
    redirect(`/admin?err=${encodeURIComponent(error.message)}`);
  }
  redirect(`/admin?ok=observation_saved&video_id=${encodeURIComponent(video_id)}`);
}

async function saveAllAction(formData: FormData) {
  "use server";
  if (!(await isAuthed())) redirect("/admin");

  const simulateFail = String(formData.get("simulate_fail") ?? "").trim();
  const isDev = process.env.NODE_ENV !== "production";

  const youtube_url = String(formData.get("youtube_url") ?? "");
  const youtube_id = extractYouTubeId(youtube_url);
  if (!youtube_id) redirect(`/admin?err=${encodeURIComponent("YouTube URL/ID から youtube_id を抽出できませんでした")}`);

  const title = String(formData.get("title") ?? "").trim();
  const channel_name = String(formData.get("channel_name") ?? "").trim();
  const thumbnail_urlRaw = String(formData.get("thumbnail_url") ?? "").trim();
  const published_yearRaw = String(formData.get("published_year") ?? "").trim();

  const hitokoto_summary = String(formData.get("hitokoto_summary") ?? "").trim();

  const product_value_focus = String(formData.get("product_value_focus") ?? "").trim();
  const visual_main_character = String(formData.get("visual_main_character") ?? "").trim();
  const emotional_tone = String(formData.get("emotional_tone") ?? "").trim();

  const product_value_focus_detail = String(formData.get("product_value_focus_detail") ?? "").trim();
  const visual_main_character_detail = String(formData.get("visual_main_character_detail") ?? "").trim();
  const appeal_method = String(formData.get("appeal_method") ?? "").trim();
  const appeal_method_detail = String(formData.get("appeal_method_detail") ?? "").trim();
  const emotional_tone_detail = String(formData.get("emotional_tone_detail") ?? "").trim();

  const observation_text = String(formData.get("observation_text") ?? "").trim();
  const pointsRaw = String(formData.get("observation_points") ?? "");
  const points = pointsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const thumbnail_url = thumbnail_urlRaw.length ? thumbnail_urlRaw : null;
  const published_year = published_yearRaw.length ? Number(published_yearRaw) : null;

  // 必須（DB NOT NULL）ガード：止まらない方針だが、最低限ここは弾く
  if (!title || !hitokoto_summary || !product_value_focus_detail || !observation_text) {
    redirect(`/admin?err=${encodeURIComponent("必須項目が未入力です（title / hitokoto_summary / product_value_focus_detail / observation_text）")}`);
  }

  const failures: string[] = [];

  // ① videos：youtube_id で upsert（UNIQUE制約あり）
  const { data: vrow, error: vErr } = await supabaseAdmin
    .from("videos")
    .upsert(
      {
        youtube_id,
        title,
        channel_name: channel_name.length ? channel_name : null,
        thumbnail_url,
        published_year,
      },
      { onConflict: "youtube_id" }
    )
    .select("id")
    .single();

  if (vErr || !vrow?.id) {
    logAdminError("saveAllAction:upsert_videos", vErr, { youtube_id });
    redirect(`/admin?err=${encodeURIComponent(vErr?.message ?? "videos の保存に失敗しました")}`);
  }

  const video_id = vrow.id as string;

  // ② core summary
  {
    const payload: Record<string, unknown> =
      isDev && simulateFail === "core_summary"
        ? { hitokoto_summary: null } // NOT NULL を踏ませる
        : { hitokoto_summary };

    const r = await upsertByVideoId("video_core_summary", video_id, payload);
    if (!r.ok) {
      failures.push("core_summary");
      logAdminError("saveAllAction:core_summary", r.error, { video_id });
    }
  }

  // ③ structure core
  {
    const payload: Record<string, unknown> =
      isDev && simulateFail === "structure_core"
        ? { product_value_focus: 1 } // 型不一致（環境差あり）
        : {
            product_value_focus: product_value_focus.length ? product_value_focus : null,
            visual_main_character: visual_main_character.length ? visual_main_character : null,
            emotional_tone: emotional_tone.length ? emotional_tone : null,
          };

    const r = await upsertByVideoId("video_structure_core", video_id, payload);
    if (!r.ok) {
      failures.push("structure_core");
      logAdminError("saveAllAction:structure_core", r.error, { video_id });
    }
  }

  // ④ structure detail
  {
    const payload: Record<string, unknown> =
      isDev && simulateFail === "structure_detail"
        ? { product_value_focus_detail: null } // NOT NULL を踏ませる
        : {
            product_value_focus_detail,
            visual_main_character_detail: visual_main_character_detail.length ? visual_main_character_detail : null,
            appeal_method: appeal_method.length ? appeal_method : null,
            appeal_method_detail: appeal_method_detail.length ? appeal_method_detail : null,
            emotional_tone_detail: emotional_tone_detail.length ? emotional_tone_detail : null,
          };

    const r = await upsertByVideoId("video_structure_detail", video_id, payload);
    if (!r.ok) {
      failures.push("structure_detail");
      logAdminError("saveAllAction:structure_detail", r.error, { video_id });
    }
  }

  // ⑤ observation notes
  {
    const payload: Record<string, unknown> =
      isDev && simulateFail === "observation_notes"
        ? { observation_text: null } // NOT NULL を踏ませる
        : {
            observation_text,
            observation_points: points.length ? points : null,
          };

    const r = await upsertByVideoId("video_observation_notes", video_id, payload);
    if (!r.ok) {
      failures.push("observation_notes");
      logAdminError("saveAllAction:observation_notes", r.error, { video_id });
    }
  }

  if (failures.length) {
    redirect(`/admin?ok=bulk_saved_partial&video_id=${encodeURIComponent(video_id)}&fail=${encodeURIComponent(failures.join(","))}`);
  }
  redirect(`/admin?ok=bulk_saved&video_id=${encodeURIComponent(video_id)}`);
}

/* ---------------------------
Page
--------------------------- */

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // ✅ 未設定ガード
  if (!adminPassword) {
    return (
      <main style={{ padding: 40, maxWidth: 900 }}>
        <h1>/admin（設定が必要）</h1>
        <p style={{ opacity: 0.85 }}>
          <code>ADMIN_PASSWORD</code> が未設定のため、管理画面は開けません。
        </p>
        <p style={{ opacity: 0.85 }}>
          ローカルは <code>.env.local</code>、本番は Vercel の Environment Variables に
          <code> ADMIN_PASSWORD</code> を設定してください。
        </p>
      </main>
    );
  }

  const authed = await isAuthed();
  const sp = await Promise.resolve(searchParams);

  const err = getParam(sp, "err");
  const ok = getParam(sp, "ok");
  const createdVideoId = getParam(sp, "created_video_id");
  const loginFail = getParam(sp, "login") === "fail";

  const savedVideoId = getParam(sp, "video_id");
  const fail = getParam(sp, "fail");
  const isBulk = ok === "bulk_saved" || ok === "bulk_saved_partial";
  const isPartial = ok === "bulk_saved_partial";

  // 未ログインの場合：ログインUIだけ表示
  if (adminPassword && !authed) {
    return (
      <main style={{ padding: 40, maxWidth: 900 }}>
        <h1>/admin（ログイン）</h1>
        <p style={{ opacity: 0.8 }}>
          ※ <code>ADMIN_PASSWORD</code> が設定されているため、ログインが必要です。
        </p>

        {loginFail && <div style={{ marginTop: 12, color: "red" }}>パスワードが違います。</div>}

        <form action={loginAction} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 360 }}>
          <input
            name="password"
            type="password"
            placeholder="ADMIN_PASSWORD"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <button style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>ログイン</button>
        </form>
      </main>
    );
  }

  const { data: recentVideos, error: recentErr } = await fetchRecentVideos();

  const { pvfDb, vmcDb, toneDb, appealDb } = await fetchAdminTagOptions();

  const pvfOptionsAdmin = mergeOptions(TAG_OPTIONS.product_value_focus, pvfDb);
  const vmcOptionsAdmin = mergeOptions(TAG_OPTIONS.visual_main_character, vmcDb);
  const toneOptionsAdmin = mergeOptions(TAG_OPTIONS.emotional_tone, toneDb);
  const appealOptionsAdmin = mergeOptions(TAG_OPTIONS.appeal_method, appealDb);

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>/admin（最小入力）</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            ← 一覧へ
          </Link>
          {adminPassword && (
            <form action={logoutAction}>
              <button style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>ログアウト</button>
            </form>
          )}
        </div>
      </div>

      {(err || ok || createdVideoId || savedVideoId) && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fafafa",
          }}
        >
          {err && (
            <div style={{ color: "red", whiteSpace: "pre-wrap" }}>
              <strong>Error:</strong> {err}
            </div>
          )}

          {ok && (
            <div style={{ color: isPartial ? "red" : "green" }}>
              <strong>OK:</strong> {ok}
              {isPartial && fail && (
                <div style={{ marginTop: 6 }}>
                  <strong>fail:</strong> <code>{fail}</code>
                </div>
              )}
            </div>
          )}

          {isBulk && savedVideoId && (
            <div style={{ marginTop: 6 }}>
              <strong>Saved video_id:</strong> <code>{savedVideoId}</code>
            </div>
          )}

          {createdVideoId && (
            <div style={{ marginTop: 6 }}>
              <strong>Created video_id:</strong> <code>{createdVideoId}</code>
            </div>
          )}
        </div>
      )}

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer" }}>直近の videos（video_id をコピペ用）</summary>
        <div style={{ marginTop: 10 }}>
          {recentErr ? (
            <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>{JSON.stringify(recentErr, null, 2)}</pre>
          ) : recentVideos.length === 0 ? (
            <div style={{ opacity: 0.8 }}>（まだ videos がありません）</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentVideos.map((v) => (
                <div key={v.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{v.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    <span>youtube_id: {v.youtube_id}</span> <span style={{ marginLeft: 10 }}>year: {v.published_year ?? "null"}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <strong>video_id:</strong> <code>{v.id}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <hr style={{ margin: "22px 0" }} />

      <section>
        <h2>0) 一括登録（Step C）</h2>

        <form action={saveAllAction} style={{ display: "grid", gap: 14, maxWidth: 860 }}>
          {/* YouTube */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>YouTube</div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                YouTube URL / 動画ID <span style={reqStyle}>（必須）</span>
              </div>
              <input
                name="youtube_url"
                placeholder={"youtube_url | 例：https://www.youtube.com/watch?v=xxxxxxxxxxx  /  youtu.be/xxxxxxxxxxx"}
                style={inputStyle}
                required
              />
              <div style={hintStyle}>URLでもID直貼りでもOK。自動で youtube_id を抽出します。</div>
            </div>
          </div>

          {/* 基本情報 */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>基本情報（動画の事実）</div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                タイトル <span style={reqStyle}>（必須）</span>
              </div>
              <input
                name="title"
                placeholder={"title | 例：『◯◯』商品プロモーション（世界観訴求）"}
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
              <div style={fieldStyle}>
                <div style={labelStyle}>チャンネル名（任意）</div>
                <input
                  name="channel_name"
                  placeholder={"channel_name | 例：NANATSU Official"}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <div style={labelStyle}>公開年（任意）</div>
                <input
                  name="published_year"
                  placeholder={"published_year | 例：2024"}
                  style={inputStyle}
                  inputMode="numeric"
                />
              </div>
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>サムネURL（任意）</div>
              <input
                name="thumbnail_url"
                placeholder={"thumbnail_url | 例：https://i.ytimg.com/vi/xxxxxxxxxxx/hqdefault.jpg"}
                style={inputStyle}
              />
              <div style={hintStyle}>未入力でもOK（Step Eで自動補完予定）。</div>
            </div>
          </div>

          {/* 一覧カードの核 */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>一覧カードの核（動画のポイント）</div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                ヒトコト要約（提案で使う1〜2行） <span style={reqStyle}>（必須）</span>
              </div>
              <textarea
                name="hitokoto_summary"
                placeholder={"hitokoto_summary | 例：機能ではなく『余白の時間』を価値として見せる、静かな世界観の訴求。"}
                style={{ ...inputStyle, minHeight: 96 }}
                required
              />
              <div style={hintStyle}>「なぜ良いか」をクライアントに説明できる言い回しを意識。</div>
            </div>
          </div>

          {/* コアタグ */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>コアタグ（カードの“価値/主役/トーン”）</div>

            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div style={fieldStyle}>
                <div style={labelStyle}>商品価値の捉え方（短）</div>
                <TagPickerInput
                  name="product_value_focus"
                  options={pvfOptionsAdmin}
                  placeholder={"product_value_focus | 例：体験・時間"}
                />
              </div>

              <div style={fieldStyle}>
                <div style={labelStyle}>映像の主役（短）</div>
                <TagPickerInput
                  name="visual_main_character"
                  options={vmcOptionsAdmin}
                  placeholder={"visual_main_character | 例：生活シーン"}
                />
              </div>

              <div style={fieldStyle}>
                <div style={labelStyle}>感情トーン（短）</div>
                <TagPickerInput
                  name="emotional_tone"
                  options={toneOptionsAdmin}
                  placeholder={"emotional_tone | 例：チル"}
                />
              </div>
            </div>
          </div>

          {/* 切り口の解説 */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>切り口の解説（詳細ページで使う説明）</div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                商品価値の捉え方（説明） <span style={reqStyle}>（必須）</span>
              </div>
              <textarea
                name="product_value_focus_detail"
                placeholder={"product_value_focus_detail | 例：機能ではなく『朝の余白』を価値として切り取り、生活の空気感で説得する。"}
                style={{ ...inputStyle, minHeight: 110 }}
                required
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>映像の主役（説明・任意）</div>
              <textarea
                name="visual_main_character_detail"
                placeholder={"visual_main_character_detail | 例：人の手元→生活シーン→商品は“結果”として登場させる構成。"}
                style={{ ...inputStyle, minHeight: 92 }}
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>主な訴求方法（任意）</div>
              <TagPickerInput
                name="appeal_method"
                options={appealOptionsAdmin}
                placeholder={"appeal_method | 例：映像（世界観）"}
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>主な訴求方法（補足・任意）</div>
              <textarea
                name="appeal_method_detail"
                placeholder={"appeal_method_detail | 例：テロップは最小。音と間、カットのリズムで情緒を作る。"}
                style={{ ...inputStyle, minHeight: 92 }}
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>感情トーン（補足・任意）</div>
              <textarea
                name="emotional_tone_detail"
                placeholder={"emotional_tone_detail | 例：静謐→終盤で少し高揚に転じ、余韻で締める。"}
                style={{ ...inputStyle, minHeight: 92 }}
              />
            </div>
          </div>

          {/* さらに詳しく */}
          <div style={groupStyle}>
            <div style={groupTitleStyle}>さらに詳しく（提案のヒント）</div>

            <div style={fieldStyle}>
              <div style={labelStyle}>
                演出メモ（本文） <span style={reqStyle}>（必須）</span>
              </div>
              <textarea
                name="observation_text"
                placeholder={"observation_text | 例：提案時は『余白の時間』を軸に、情緒→生活→結果の順で説明すると通りやすい。"}
                style={{ ...inputStyle, minHeight: 110 }}
                required
              />
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>箇条書きポイント（任意・1行=1ポイント）</div>
              <textarea
                name="observation_points"
                placeholder={
                  "observation_points | 例：\n導入：森へ向かう移動で“空気”を作る\n手元のクローズアップで生活感を補強\n商品は最後に“結果”として見せる"
                }
                style={{
                  ...inputStyle,
                  minHeight: 130,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              />
            </div>
          </div>

          {/* dev: simulate */}
          {process.env.NODE_ENV !== "production" && (
            <div style={groupStyle}>
              <div style={groupTitleStyle}>開発用（simulate_fail）</div>
              <div style={fieldStyle}>
                <div style={labelStyle}>一部失敗を擬似的に発生（devのみ）</div>
                <select name="simulate_fail" style={inputStyle} defaultValue="">
                  <option value="">simulate_fail（通常は空）</option>
                  <option value="core_summary">core_summary を失敗させる</option>
                  <option value="structure_detail">structure_detail を失敗させる</option>
                  <option value="observation_notes">observation_notes を失敗させる</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #eee" }}>
            <ConfirmSubmitButton label="5テーブル一括保存（更新も含む）" />
          </div>
        </form>
      </section>

      <hr style={{ margin: "22px 0" }} />

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          基本は「0) 一括登録」を使用。個別フォームはデバッグ/復旧用です。
        </div>

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>
          予備：個別登録フォーム（①〜⑤を手動で触りたい時だけ開く）
        </summary>

        <div style={{ marginTop: 14 }}>
          {/* ① videos */}
          <section>
            <h2>① videos（動画の事実）</h2>
            <form action={createVideoAction} style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              <input name="youtube_id" placeholder="youtube_id" style={inputStyle} required />
              <input name="title" placeholder="title" style={inputStyle} required />
              <input name="channel_name" placeholder="channel_name" style={inputStyle} />
              <input name="thumbnail_url" placeholder="thumbnail_url（任意）" style={inputStyle} />
              <input name="published_year" placeholder="published_year（任意）" style={inputStyle} />
              <button style={buttonStyle}>videos に追加</button>
            </form>
          </section>

          <hr style={{ margin: "22px 0" }} />

          {/* ② core summary */}
          <section>
            <h2>② video_core_summary（判断の核）</h2>
            <form action={createCoreSummaryAction} style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              <input name="video_id" placeholder="video_id（uuid）" style={inputStyle} required />
              <textarea
                name="hitokoto_summary"
                placeholder="hitokoto_summary（1〜2行推奨）"
                style={{ ...inputStyle, minHeight: 90 }}
                required
              />
              <button style={buttonStyle}>core_summary に追加</button>
            </form>
          </section>

          <hr style={{ margin: "22px 0" }} />

          {/* ③ structure core */}
          <section>
            <h2>③ video_structure_core（構造タグ：短縮）</h2>
            <form action={createStructureCoreAction} style={{ display: "grid", gap: 10, maxWidth: 800 }}>
              <input name="video_id" placeholder="video_id（uuid）" style={inputStyle} required />
              <input name="product_value_focus" placeholder="product_value_focus（例：体験・時間）" style={inputStyle} />
              <input name="visual_main_character" placeholder="visual_main_character（例：シーン・世界観）" style={inputStyle} />
              <input name="emotional_tone" placeholder="emotional_tone（例：チル）" style={inputStyle} />
              <button style={buttonStyle}>structure_core に追加</button>
            </form>
          </section>

          <hr style={{ margin: "22px 0" }} />

          {/* ④ structure detail */}
          <section>
            <h2>④ video_structure_detail（構造の補足）</h2>
            <form action={createStructureDetailAction} style={{ display: "grid", gap: 10, maxWidth: 900 }}>
              <input name="video_id" placeholder="video_id（uuid）" style={inputStyle} required />

              <textarea
                name="product_value_focus_detail"
                placeholder="product_value_focus_detail"
                style={{ ...inputStyle, minHeight: 90 }}
                required
              />
              <textarea
                name="visual_main_character_detail"
                placeholder="visual_main_character_detail"
                style={{ ...inputStyle, minHeight: 90 }}
              />

              <input name="appeal_method" placeholder="appeal_method（例：映像重視（世界観））" style={inputStyle} />
              <textarea
                name="appeal_method_detail"
                placeholder="appeal_method_detail"
                style={{ ...inputStyle, minHeight: 90 }}
              />
              <textarea
                name="emotional_tone_detail"
                placeholder="emotional_tone_detail"
                style={{ ...inputStyle, minHeight: 90 }}
              />

              <button style={buttonStyle}>structure_detail に追加</button>
            </form>
          </section>

          <hr style={{ margin: "22px 0" }} />

          {/* ⑤ observation notes */}
          <section>
            <h2>⑤ video_observation_notes（観察メモ）</h2>
            <form action={createObservationNoteAction} style={{ display: "grid", gap: 10, maxWidth: 900 }}>
              <input name="video_id" placeholder="video_id（uuid）" style={inputStyle} required />

              <textarea
                name="observation_text"
                placeholder="observation_text（本文）"
                style={{ ...inputStyle, minHeight: 90 }}
              />

              <textarea
                name="observation_points"
                placeholder={"observation_points（1行=1ポイント）\n例）\n森へ向かう導入で…\n手元のクローズアップで…"}
                style={{ ...inputStyle, minHeight: 120, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              />

              <button style={buttonStyle}>observation_notes に追加</button>
            </form>
          </section>
        </div>
      </details>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 12,              // 10 → 12
  border: "1px solid #ddd",
  borderRadius: 10,         // 8 → 10（少しだけ柔らかく）
};

const groupStyle: React.CSSProperties = {
  padding: 16,              // 12 → 16（ブロック内の余白）
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
  display: "grid",
  gap: 14,                  // ← 追加：ブロック内の要素間隔を統一
};

const groupTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 0,          // 10 → 0（groupStyleのgapに任せる）
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,                   // 6 → 8（ラベルと入力の距離）
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.4,          // ← 追加：詰まり感を軽減
};

const reqStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#b91c1c",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  lineHeight: 1.5,          // ← 追加：補足文が読みやすくなる
};

const buttonStyle: React.CSSProperties = {
  padding: 12,              // 10 → 12（押しやすさ）
  border: "1px solid #ddd",
  borderRadius: 10,
  cursor: "pointer",
};