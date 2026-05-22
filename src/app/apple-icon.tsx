import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #818CF8 0%, #6366F1 50%, #4F46E5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        {/* F */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            fontSize: 120,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -8,
            lineHeight: 1,
            textShadow: "0 3px 10px rgba(0,0,0,0.25)",
            marginTop: -8,
          }}
        >
          F
        </div>
        {/* $ verde */}
        <div
          style={{
            position: "absolute",
            right: 30,
            bottom: 30,
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: "#10B981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 900,
            color: "#fff",
            boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
            border: "3px solid rgba(255,255,255,0.95)",
          }}
        >
          $
        </div>
      </div>
    ),
    { ...size },
  );
}
