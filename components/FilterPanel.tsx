"use client";

import type { FormEvent } from "react";
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

    pushFilterUrl({
      pvf: pvfState || undefined,
      vmc: vmcState || undefined,
      tone: toneState || undefined,
    });

    gtmEvent({
      event: "filter_used",
      pvf: pvfState || null,
      vmc: vmcState || null,
      tone: toneState || null,
    });
  }

  function onReset() {
    router.push("/");
    gtmEvent({ event: "filter_used", action: "reset", pvf: null, vmc: null, tone: null });
  }

  return (
    <section className="card filterBox">
      <div className="filterPanelTitle">条件で探す</div>
      <div className="filterHelp">まずはどれか1つ選んで「絞り込む」を押してみてください。</div>

      {hasFilter && (
        <div className="chipsWrap">
          <div className="chipsLabel">適用中：</div>

          <div className="chipsRow">
            {pvfState && (
              <a
                href={buildHref(currentQuery, "pvf")}
                className="chip"
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "pvf", value: pvfState });
                  pushFilterUrl({
                    pvf: "",
                    vmc: vmcState || undefined,
                    tone: toneState || undefined,
                  });
                }}
              >
                商品価値の捉え方：{valueLabel(pvfState)} <span className="chipX">×</span>
              </a>
            )}

            {vmcState && (
              <a
                href={buildHref(currentQuery, "vmc")}
                className="chip"
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "vmc", value: vmcState });
                  pushFilterUrl({
                    pvf: pvfState || undefined,
                    vmc: "",
                    tone: toneState || undefined,
                  });
                }}
              >
                映像の主役：{valueLabel(vmcState)} <span className="chipX">×</span>
              </a>
            )}

            {toneState && (
              <a
                href={buildHref(currentQuery, "tone")}
                className="chip"
                onClick={(e) => {
                  e.preventDefault();
                  gtmEvent({ event: "filter_used", action: "remove", key: "tone", value: toneState });
                  pushFilterUrl({
                    pvf: pvfState || undefined,
                    vmc: vmcState || undefined,
                    tone: "",
                  });
                }}
              >
                感情トーン：{valueLabel(toneState)} <span className="chipX">×</span>
              </a>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 12, display: "grid", gap: 12, maxWidth: 700 }}>
        <label className="fieldLabel">
          <strong>商品価値の捉え方</strong>
          <div className="fieldHelp">例：体験・時間 / 機能・性能 / 価格 など</div>
          <select
            name="pvf"
            defaultValue={pvfState}
            className="select"
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

        <label className="fieldLabel">
          <strong>映像の主役</strong>
          <div className="fieldHelp">例：人 / シーン・世界観 / 商品そのもの など</div>
          <select
            name="vmc"
            defaultValue={vmcState}
            className="select"
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

        <label className="fieldLabel">
          <strong>感情トーン</strong>
          <div className="fieldHelp">例：チル / 高揚 / 温かい など</div>
          <select
            name="tone"
            defaultValue={toneState}
            className="select"
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

        <div className="actionsRow">
          <button type="submit" className="btn btnPrimary">
            絞り込む
          </button>

          <button type="button" onClick={onReset} className="btn btnSecondary">
            リセット
          </button>

          <span className="muted" style={{ fontSize: 12 }}>
            件数：{rowsCount}
          </span>
        </div>
      </form>
    </section>
  );
}