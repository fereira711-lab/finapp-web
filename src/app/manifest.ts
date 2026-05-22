import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FinApp - Controle Financeiro",
    short_name: "FinApp",
    description: "Controle financeiro pessoal: gastos, cartoes, metas e relatorios",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F172A",
    theme_color: "#6366F1",
    lang: "pt-BR",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
