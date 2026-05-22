import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
        {/* Glow circle atras do F */}
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        {/* Letra F estilizada */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 320,
            height: 320,
            fontSize: 320,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: -20,
            lineHeight: 1,
            textShadow: "0 8px 24px rgba(0,0,0,0.25)",
            marginTop: -20,
          }}
        >
          F
        </div>
        {/* Cifrao subscrito */}
        <div
          style={{
            position: "absolute",
            right: 100,
            bottom: 100,
            width: 130,
            height: 130,
            borderRadius: "50%",
            background: "#10B981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 100,
            fontWeight: 900,
            color: "#fff",
            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            border: "6px solid rgba(255,255,255,0.95)",
          }}
        >
          $
        </div>
      </div>
    ),
    { ...size },
  );
}
