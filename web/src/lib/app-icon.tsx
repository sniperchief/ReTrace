import { ImageResponse } from "next/og";

/**
 * The ReTrace mark as a PNG: an off-white "history" arrow on deep violet.
 * `maskable` adds the safe-zone padding Android needs for round/squircle icons.
 */
export function appIconResponse(size: number, { maskable = false } = {}) {
  const mark = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#151035" }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12a8 8 0 1 0 2.4-5.7" />
          <path d="M4 4v4h4" />
          <path d="M12 8v4l2.5 1.5" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
