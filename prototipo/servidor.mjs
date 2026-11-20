// Servidor estático local que aplica os cabeçalhos de segurança de cabecalhos.json.
// Assim os testes rodam com a mesma Content-Security-Policy da produção.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const pasta = resolve(fileURLToPath(new URL(".", import.meta.url)));

const porta = Number(process.env.PORT ?? 4791);
const lista = JSON.parse(await readFile(join(pasta, "cabecalhos.json"), "utf8"));
const cabecalhos = Object.fromEntries(lista.map((h) => [h.key, h.value]));

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url ?? "/", "http://local").pathname);
  const relativo = normalize(caminho === "/" ? "index.html" : caminho.slice(1));
  const arquivo = resolve(pasta, relativo);
  // Bloqueia "../" para fora da pasta publicada.
  if (arquivo !== pasta && !arquivo.startsWith(pasta + sep)) {
    res.writeHead(403).end("Proibido");
    return;
  }
  try {
    const corpo = await readFile(arquivo);
    res.writeHead(200, { ...cabecalhos, "Content-Type": TIPOS[extname(arquivo)] ?? "application/octet-stream" });
    res.end(corpo);
  } catch {
    res.writeHead(404, cabecalhos).end("Não encontrado");
  }
}).listen(porta, () => console.log(`Juntos em http://localhost:${porta}`));
