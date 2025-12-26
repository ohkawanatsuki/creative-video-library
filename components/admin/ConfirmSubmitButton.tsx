"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

type Props = {
  label: string;
};

function SubmitArea({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();

  return (
    <>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        この内容で保存します。よければもう一度押してください。
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          padding: 14,
          border: "1px solid #111827",
          borderRadius: 10,
          cursor: pending ? "not-allowed" : "pointer",
          width: "100%",
          fontWeight: 900,
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? "送信中…" : "保存する（確定）"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        style={{
          padding: 10,
          border: "1px solid #ddd",
          borderRadius: 10,
          cursor: pending ? "not-allowed" : "pointer",
          width: "100%",
          opacity: pending ? 0.6 : 1,
        }}
      >
        戻る
      </button>
    </>
  );
}

export function ConfirmSubmitButton({ label }: Props) {
  const [armed, setArmed] = React.useState(false);

  // Enter誤送信の抑止：armed時のみ（フォーム内に閉じる）
  const onKeyDownCapture = (e: React.KeyboardEvent) => {
    if (!armed) return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }} onKeyDownCapture={onKeyDownCapture}>
      {!armed ? (
        <button
          type="button"
          onClick={() => setArmed(true)}
          style={{
            padding: 14,
            border: "1px solid #ddd",
            borderRadius: 10,
            cursor: "pointer",
            width: "100%",
            fontWeight: 800,
          }}
        >
          {label}
        </button>
      ) : (
        <SubmitArea onCancel={() => setArmed(false)} />
      )}
    </div>
  );
}