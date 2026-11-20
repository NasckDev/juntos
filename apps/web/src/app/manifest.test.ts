import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../public");

describe("manifesto do app instalável", () => {
  it("abre em tela cheia no início, em português, com nome e cores do tema", () => {
    expect(manifest()).toMatchObject({
      name: "Juntos",
      short_name: "Juntos",
      display: "standalone",
      start_url: "/inicio",
      lang: "pt-BR",
      theme_color: "#5048e5",
    });
  });

  it("todos os ícones existem, com 192 e 512 px, e versões maskable", () => {
    const icons = manifest().icons ?? [];
    for (const icon of icons) expect(existsSync(path.join(PUBLIC_DIR, icon.src))).toBe(true);
    const sizes = (purpose: string) => icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes);
    expect(sizes("any")).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(sizes("maskable")).toEqual(["192x192", "512x512"]);
  });

  it("PNGs têm o tamanho declarado; há ícone para a Tela de Início do iPhone e para as notificações", () => {
    const pngSize = (file: string) => {
      const bytes = readFileSync(path.join(PUBLIC_DIR, file));
      return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    };
    expect(pngSize("icons/icon-192.png")).toEqual([192, 192]);
    expect(pngSize("icons/icon-512.png")).toEqual([512, 512]);
    expect(pngSize("icons/maskable-512.png")).toEqual([512, 512]);
    expect(pngSize("icons/apple-touch-icon.png")).toEqual([180, 180]);
    expect(pngSize("icons/badge-96.png")).toEqual([96, 96]);
  });
});
