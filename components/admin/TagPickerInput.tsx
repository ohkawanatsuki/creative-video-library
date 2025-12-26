"use client";

import * as React from "react";

type Props = {
  name: string;
  placeholder?: string;
  options: readonly string[];
  defaultValue?: string;
  required?: boolean;
};

export function TagPickerInput({
  name,
  placeholder,
  options,
  defaultValue = "",
  required,
}: Props) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setValue(opt)}
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: active ? "#111827" : "#fff",
                color: active ? "#fff" : "#111827",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
              aria-pressed={active}
            >
              {opt}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setValue("")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px dashed #ddd",
            background: "#fff",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          クリア
        </button>
      </div>

      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          padding: 10,
          border: "1px solid #ddd",
          borderRadius: 8,
        }}
      />
    </div>
  );
}