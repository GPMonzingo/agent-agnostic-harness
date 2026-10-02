import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.env.LEARN_BOOK_DIR ?? "C:\\Users\\justinmonzingo\\OneDrive - Rightpoint\\Documents\\AzureMasterBook";
const statePath = join(root, "crawl-manifest.json");
const pdfDir = join(root, "downloads");
const maxPages = Number(process.env.LEARN_MAX_PAGES ?? 500);
if (process.env.LEARN_INSECURE_TLS === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const seeds = [
  "https://learn.microsoft.com/en-us/docs/",
  "https://learn.microsoft.com/en-us/azure/",
  "https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-overview"
];

const canonical = (raw, base) => {
  try {
    const u = new URL(raw, base);
    if (!/^https?:$/.test(u.protocol) || u.hostname !== "learn.microsoft.com") return null;
    u.hash = "";
    ["view", "preserve-view", "tabs"].forEach(k => u.searchParams.delete(k));
    return u.toString().replace(/\/$/, "") + (new URL(u).pathname === "/en-us/docs" ? "/" : "");
  } catch { return null; }
};
const hash = data => createHash("sha256").update(data).digest("hex");
const safeName = (url, digest) => `${digest.slice(0, 16)}-${decodeURIComponent(new URL(url).pathname.split("/").pop() || "document").replace(/[^a-z0-9._-]/gi, "_")}.pdf`;
const save = async state => writeFile(statePath, JSON.stringify(state, null, 2));
const fetchPage = async url => {
  try { return await fetch(url, { headers: { "user-agent": "agent-agnostic-harness/0.1" } }); }
  catch {
    const raw = execFileSync("curl.exe", ["-k", "-L", "-sS", "-D", "-", url], { maxBuffer: 32 * 1024 * 1024 });
    const split = raw.indexOf(Buffer.from("\r\n\r\n")); const headers = raw.subarray(0, split).toString(); const body = raw.subarray(split + 4);
    const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? "";
    return { status: Number(headers.match(/HTTP\/[^ ]+\s+(\d+)/)?.[1] ?? 200), headers: { get: name => name.toLowerCase() === "content-type" ? type : null }, text: async () => body.toString("utf8"), arrayBuffer: async () => body };
  }
};

await mkdir(pdfDir, { recursive: true });
let state;
try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { state = { pages: {}, documents: {}, queue: [] }; }
for (const seed of seeds) { const url = canonical(seed); if (url && (!state.pages[url] || (process.env.LEARN_RETRY_ERRORS === "1" && state.pages[url].status === "error"))) state.queue.push(url); }
state.queue = [...new Set(state.queue)];
await save(state);

const emit = () => console.log(JSON.stringify({ type: "crawlProgress", active: true, pages: Object.keys(state.pages).length, sources: 1 + Object.keys(state.documents).length, merged: 0, queue: state.queue.length }));
while (state.queue.length && Object.keys(state.pages).length < maxPages) {
  const url = state.queue.shift();
  if (state.pages[url]) continue;
  let response;
  try { response = await fetchPage(url); }
  catch (error) { state.pages[url] = { status: "error", error: String(error), at: new Date().toISOString() }; await save(state); continue; }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    const bytes = Buffer.from(await response.arrayBuffer()); const digest = hash(bytes); const file = join(pdfDir, safeName(url, digest));
    if (!state.documents[digest]) { await writeFile(file, bytes); state.documents[digest] = { url, file, bytes: bytes.length, downloadedAt: new Date().toISOString() }; }
    state.pages[url] = { status: "pdf", hash: digest, at: new Date().toISOString() }; await save(state); emit(); continue;
  }
  const text = await response.text(); state.pages[url] = { status: response.status, contentType, at: new Date().toISOString() };
  const links = [...text.matchAll(/(?:href|data-bi-name)=["']([^"']+)["']/gi)].map(m => m[1]);
  for (const link of links) { const next = canonical(link, url); if (next && !state.pages[next] && !state.queue.includes(next)) state.queue.push(next); }
  for (const match of text.matchAll(/https?:[^"'<>\s]+?\.pdf(?:\?[^"'<>\s]*)?/gi)) { const pdf = canonical(match[0]); if (pdf && !state.pages[pdf] && !state.queue.includes(pdf)) state.queue.push(pdf); }
  await save(state); emit();
}
state.lastRun = new Date().toISOString(); state.active = false; await save(state);
console.log(JSON.stringify({ type: "crawlProgress", active: false, pages: Object.keys(state.pages).length, sources: 1 + Object.keys(state.documents).length, merged: 0, queue: state.queue.length }));
