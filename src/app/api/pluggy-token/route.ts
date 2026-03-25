import { NextResponse } from "next/server";

export async function POST() {
  const authRes = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });

  if (!authRes.ok) {
    return NextResponse.json({ error: "Falha na autenticação Pluggy" }, { status: 500 });
  }

  const { apiKey } = await authRes.json();

  const tokenRes = await fetch("https://api.pluggy.ai/connect_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
  });

  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Falha ao gerar connect token" }, { status: 500 });
  }

  const { accessToken } = await tokenRes.json();
  return NextResponse.json({ connectToken: accessToken });
}
