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
  return (
    <Link
      href={`/videos/${id}`}
      onClick={() => gtmEvent({ event: "open_detail", video_id: id })}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <article
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 12,
          cursor: "pointer",
        }}
      >
        <div style={{ fontWeight: 700 }}>
          {title ?? "（タイトル未入力）"}
        </div>

        <div style={{ marginTop: 6 }}>
          {hitokotoSummary ?? "（ヒトコト要約未入力）"}
        </div>

        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6 }}>
          <div>
            <strong>商品価値の捉え方：</strong>
            {productValueFocus ?? "（未入力）"}
          </div>
          <div>
            <strong>映像の主役：</strong>
            {visualMainCharacter ?? "（未入力）"}
          </div>
          <div>
            <strong>感情トーン：</strong>
            {emotionalTone ?? "（未入力）"}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
          id: {id}
        </div>
      </article>
    </Link>
  );
}