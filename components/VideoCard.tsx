"use client";

import Link from "next/link";
import { gtmEvent } from "@/lib/gtm";

type Props = {
  id: string;
  title: string | null;
  hitokotoSummary: string | null;
  productValueFocus: string | null;
  visualMainCharacter: string | null;
  emotionalTone: string | null;
};

export function VideoCard({
  id,
  title,
  hitokotoSummary,
  productValueFocus,
  visualMainCharacter,
  emotionalTone,
}: Props) {
  const summary = hitokotoSummary ?? "（ヒトコト要約未入力）";

  return (
    <Link
      href={`/videos/${id}`}
      onClick={() => gtmEvent({ event: "open_detail", video_id: id })}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <article className="card">
        <div className="cardRow">
          <div className="thumb" aria-hidden="true" />

          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="kicker">動画のポイント（ヒトコト要約）</div>

            <div
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 800,
                lineHeight: 1.55,
                letterSpacing: 0.1,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </div>

            <div className="titleSmall">
              <span className="muted">動画タイトル：</span>
              {title ?? "（タイトル未入力）"}
            </div>

            <div className="tags">
              <span className="tag">
                <span className="tagValue">{productValueFocus ?? "未入力"}</span>
                <span className="tagKey">価値</span>
              </span>
              <span className="tag">
                <span className="tagValue">{visualMainCharacter ?? "未入力"}</span>
                <span className="tagKey">主役</span>
              </span>
              <span className="tag">
                <span className="tagValue">{emotionalTone ?? "未入力"}</span>
                <span className="tagKey">トーン</span>
              </span>
            </div>

            <div className="cardCta">
              詳細を見る <span className="cardCtaArrow">→</span>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}