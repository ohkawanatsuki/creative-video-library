import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

function getParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function logAdminError(label: string, error: any, meta?: Record<string, any>) {
  console.error(`[admin_error] ${label}`, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
    meta,
  });
}

async function isAuthed(): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;

  // ✅ 本番公開前ガード：未設定なら「未認証」扱い（= admin を開けない）
  if (!adminPassword) return false;

  const store = await cookies();
  return store.get("admin_auth")?.value === "1";
}

async function fetchRecentVideos() {
  const { data, error } = await supabaseAdmin
    .from("videos")
    .select("id, youtube_id, title, channel_name, published_year, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return { data: data ?? [], error };
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
      secure: isProd,          // ✅ 本番のみ secure
      maxAge: 60 * 60 * 24 * 7 // ✅ 7日
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

  const newId = (data as any)?.id as string | undefined;
  if (!newId) {
    redirect(
      `/admin?err=${encodeURIComponent(
        "INSERT succeeded but no id was returned."
      )}`
    );
  }

  redirect(
    `/admin?created_video_id=${encodeURIComponent(newId)}&ok=${encodeURIComponent(
      "video_saved"
    )}`
  );
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

/* ---------------------------
Page
--------------------------- */

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  // ✅ これ自体は消してOK（今は実質不要）
  // await requireAuthOrShowLogin(searchParams);

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
  const sp = await Promise.resolve(searchParams as any);

  const err = getParam(sp, "err");
  const ok = getParam(sp, "ok");
  const createdVideoId = getParam(sp, "created_video_id");
  const loginFail = getParam(sp, "login") === "fail";

  // 未ログインの場合：ログインUIだけ表示
  if (adminPassword && !authed) {
    return (
      <main style={{ padding: 40, maxWidth: 900 }}>
        <h1>/admin（ログイン）</h1>
        <p style={{ opacity: 0.8 }}>
          ※ <code>ADMIN_PASSWORD</code> が設定されているため、ログインが必要です。
        </p>

        {loginFail && (
          <div style={{ marginTop: 12, color: "red" }}>パスワードが違います。</div>
        )}

        <form action={loginAction} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 360 }}>
          <input
            name="password"
            type="password"
            placeholder="ADMIN_PASSWORD"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          <button style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
            ログイン
          </button>
        </form>
      </main>
    );
  }

  const { data: recentVideos, error: recentErr } = await fetchRecentVideos();

  return (
    <main style={{ padding: 40, maxWidth: 1100 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>/admin（最小入力）</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/" style={{ textDecoration: "none" }}>
            ← 一覧へ
          </a>
          {adminPassword && (
            <form action={logoutAction}>
              <button style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px" }}>
                ログアウト
              </button>
            </form>
          )}
        </div>
      </div>

      {(err || ok || createdVideoId) && (
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
            <div style={{ color: "green" }}>
              <strong>OK:</strong> {ok}
            </div>
          )}
          {createdVideoId && (
            <div style={{ marginTop: 6 }}>
              <strong>Created video_id:</strong>{" "}
              <code>{createdVideoId}</code>
            </div>
          )}
        </div>
      )}

      <details style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer" }}>直近の videos（video_id をコピペ用）</summary>
        <div style={{ marginTop: 10 }}>
          {recentErr ? (
            <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(recentErr, null, 2)}
            </pre>
          ) : recentVideos.length === 0 ? (
            <div style={{ opacity: 0.8 }}>（まだ videos がありません）</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {recentVideos.map((v: any) => (
                <div key={v.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontWeight: 700 }}>{v.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    <span>youtube_id: {v.youtube_id}</span>{" "}
                    <span style={{ marginLeft: 10 }}>year: {v.published_year ?? "null"}</span>
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

      {/* ① videos */}
      <section>
        <h2>① videos（動画の事実）</h2>
        <form action={createVideoAction} style={{ display: "grid", gap: 10, maxWidth: 800 }}>
          <input name="youtube_id" placeholder="youtube_id" style={inputStyle} required />
          <input name="title" placeholder="title" style={inputStyle} required />
          <input name="channel_name" placeholder="channel_name" style={inputStyle} required />
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
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 8,
};

const buttonStyle: React.CSSProperties = {
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
};