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
          background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 280,
          fontWeight: 900,
          letterSpacing: -10,
        }}
      >
        F$
      </div>
    ),
    { ...size },
  );
}
