import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Imaginea care apare când cineva distribuie site-ul (Facebook, WhatsApp, LinkedIn, X).
// Generată o dată la build. Textul e fără diacritice, fiindcă fontul implicit nu le are pe toate.
export const alt = "Sejur Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "linear-gradient(180deg, #cfe6f5 0%, #eaf3f7 45%, #f6efe2 70%, #e9dcc3 100%)",
          color: "#1f3d63",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={168} height={168} style={{ borderRadius: 999 }} alt="" />
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>Sejur Studio</div>
        <div style={{ fontSize: 38, color: "#3b4f6b" }}>Mamaia · Neptun · Saturn · Mangalia · 2 Mai · Bran</div>
      </div>
    ),
    size,
  );
}
