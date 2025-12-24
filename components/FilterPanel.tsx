"use client";

import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gtmEvent } from "@/lib/gtm";

const NULL_SENTINEL = "__NULL__";

type Props = {
  pvf?: string;
  vmc?: string;
  tone?: string;

  pvfOptions: string[];
  vmcOptions: string[];
  toneOptions: string[];

  pvfHasNull: boolean;
  vmcHasNull: boolean;
  toneHasNull: boolean;

  rowsCount: number;
};

function valueLabel(v?: string) {
  if (!v) return "";
  if (v === NULL_SENTINEL) return "（未入力）";
  return v;
}

function buildHref(base: URLSearchParams, removeKey?: string) {
  const p = new URLSearchParams(base);
  if (removeKey) p.delete(removeKey);
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

export function FilterPanel({
  pvf,
  vmc,
  tone,
  pvfOptions,
  vmcOptions,
  toneOptions,
  pvfHasNull,
  vmcHasNull,
  toneHasNull,
  rowsCount,
}: Props) {
  const router = useRouter();

  // サーバーから来た値を初期値にして、クライアント側で保持
  let pvfState = pvf ?? "";
  let vmcState = vmc ?? "";
  let toneState = tone ?? "";

  const hasFilter = !!(pvfState || vmcState || toneState);

  const currentQuery = new URLSearchParams();
  if (pvfState) currentQuery.set("pvf", pvfState);
  if (vmcState) currentQuery.set("vmc", vmcState);
  if (toneState) currentQuery.set("tone", toneState);

  function pushFilterUrl(next: { pvf?: string; vmc?: string; tone?: string }) {
    const params = new URLSearchParams();
    if (next.pvf) params.set("pvf", next.pvf);
    if (next.vmc) params.set("vmc", next.vmc);
    if (next.tone) params.set("tone", next.tone);

    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // フィルタ適用（URL更新）
    pushFilterUrl({
      pvf: pvfState || undefined,
      vmc: vmcState || undefined,
      tone: toneState || undefined,
    });

    // ✅ GA4 用の最小イベント
    gtmEvent({
      event: "filter_used",
      pvf: pvfState || null,
      vmc: vmcState || null,
      tone: toneState || null,
    });
  }

  function onReset() {
    router.push("/");
    gtmEvent({ event: "filter_used", action: "reset" });
  }

  return (
    <section
      style={{
        marginTop: 16,
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 700 }}>フィルタ（最小）</div>

      {/* 適用中チップ（外す操作も filter_used にする） */}
      {hasFilter && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.85 }}>適用中：</div>

          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {pvfState && (
              <a
                href={buildHref(currentQuery, "pvf")}
                style={chipStyle}
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "pvf", value: pvfState });
                  pushFilterUrl({ pvf: "", vmc: vmcState || undefined, tone: toneState || undefined });
                }}
              >
                商品価値の捉え方：{valueLabel(pvfState)} <span style={{ opacity: 0.7 }}>×</span>
              </a>
            )}
            {vmcState && (
              <a
                href={buildHref(currentQuery, "vmc")}
                style={chipStyle}
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "vmc", value: vmcState });
                  pushFilterUrl({ pvf: pvfState || undefined, vmc: "", tone: toneState || undefined });
                }}
              >
                映像の主役：{valueLabel(vmcState)} <span style={{ opacity: 0.7 }}>×</span>
              </a>
            )}
            {toneState && (
              <a
                href={buildHref(currentQuery, "tone")}
                style={chipStyle}
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "tone", value: toneState });
                  pushFilterUrl({ pvf: pvfState || undefined, vmc: vmcState || undefined, tone: "" });
                }}
              >
                感情トーン：{valueLabel(toneState)} <span style={{ opacity: 0.7 }}>×</span>
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 700 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14 }}>
            <strong>商品価値の捉え方</strong>
          </span>
          <select
            name="pvf"
            defaultValue={pvfState}
            style={selectStyle}
            onChange={(e) => (pvfState = e.target.value)}
          >
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
          <select
            name="vmc"
            defaultValue={vmcState}
            style={selectStyle}
            onChange={(e) => (vmcState = e.target.value)}
          >
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
          <select
            name="tone"
            defaultValue={toneState}
            style={selectStyle}
            onChange={(e) => (toneState = e.target.value)}
          >
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

          <button type="button" onClick={onReset} style={{ ...buttonStyle, background: "transparent" }}>
            リセット
          </button>

          <span style={{ fontSize: 12, opacity: 0.8 }}>件数：{rowsCount}</span>
        </div>
      </form>
    </section>
  );
}

const selectStyle: CSSProperties = {
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 8,
};

const buttonStyle: CSSProperties = {
  padding: "10px 14px",
  border: "1px solid #ddd",
  borderRadius: 8,
  cursor: "pointer",
};

const chipStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  border: "1px solid #ddd",
  borderRadius: 999,
  padding: "6px 10px",
  textDecoration: "none",
  fontSize: 13,
  color: "inherit",
};