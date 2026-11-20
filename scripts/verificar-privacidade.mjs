// Barra a publicação se o repositório tiver algo que não pode ficar público:
// planilhas e exportações reais, arquivos .env, chaves e tokens, ou e-mails fora dos domínios de exemplo.
// Roda no CI, no build da Vercel e localmente com `npm run privacidade`.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const IGNORAR = new Set([
  ".git",
  "node_modules",
  "test-results",
  "playwright-report",
  ".vercel",
  ".next",
  ".turbo",
  ".data",
  "coverage",
  "dist",
]);
// Metadados de dependências trazem e-mails de autores de bibliotecas, que não são dados do projeto.
const ARQUIVOS_IGNORADOS = new Set(["package-lock.json"]);
const PROIBIDOS = new Set([".xlsx", ".xls", ".csv", ".env", ".pem", ".key", ".p12"]);
const BINARIOS = new Set([".webp", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2"]);

// Domínios reservados para exemplo (RFC 2606) e o endereço "noreply" do GitHub.
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const DOMINIOS_OK = /@(example\.(com|org|net)|users\.noreply\.github\.com)$/i;

const SEGREDOS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, "token do GitHub"],
  [/github_pat_[A-Za-z0-9_]{30,}/, "token do GitHub"],
  [/sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/, "chave de API"],
  [/AKIA[0-9A-Z]{16}/, "chave da AWS"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada"],
  [/postgres(ql)?:\/\/[^\s'"]+:[^\s'"]+@/, "URL de banco com senha"],
  [/AIza[0-9A-Za-z_-]{35}/, "chave do Google"],
  [/re_[A-Za-z0-9]{20,}/, "chave do Resend"],
];

// Pastas geradas (build, testes, cache) nunca são publicadas.
const ehGerada = (nome) => IGNORAR.has(nome) || nome.startsWith(".next");

async function* varrerPasta(pasta) {
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    if (ehGerada(item.name) || ARQUIVOS_IGNORADOS.has(item.name)) continue;
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) yield* varrerPasta(caminho);
    else yield caminho;
  }
}

// Com git, varre exatamente o que seria publicado: versionados e novos que não estão no .gitignore.
// Sem git (ex.: build na Vercel), varre a pasta pulando o que é gerado.
async function* arquivos(pasta) {
  let lista;
  try {
    lista = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: pasta,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    yield* varrerPasta(pasta);
    return;
  }
  for (const nome of lista) {
    if (ARQUIVOS_IGNORADOS.has(nome.split("/").pop())) continue;
    const caminho = join(pasta, nome);
    if (existsSync(caminho)) yield caminho;
  }
}

const problemas = [];
for await (const arquivo of arquivos(raiz)) {
  const nome = relative(raiz, arquivo).replaceAll("\\", "/");
  const ext = extname(arquivo).toLowerCase();
  if (PROIBIDOS.has(ext) || /(^|\/)\.env(\.|$)/.test(nome)) {
    if (!nome.endsWith(".env.example")) problemas.push(`${nome}: tipo de arquivo que não pode ser versionado`);
    continue;
  }
  if (BINARIOS.has(ext)) continue;
  const texto = await readFile(arquivo, "utf8");
  for (const [padrao, rotulo] of SEGREDOS) {
    if (padrao.test(texto)) problemas.push(`${nome}: parece conter ${rotulo}`);
  }
  for (const encontrado of texto.matchAll(EMAIL)) {
    // Ignora trechos de data URI (base64) que por acaso formam algo com "@".
    if (encontrado[0].length > 80) continue;
    if (!DOMINIOS_OK.test(encontrado[0]))
      problemas.push(`${nome}: e-mail fora dos domínios de exemplo (${encontrado[0]})`);
  }
}

if (problemas.length) {
  console.error("Verificação de privacidade falhou:\n" + problemas.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("Verificação de privacidade: nenhum dado pessoal, segredo ou planilha encontrado.");
