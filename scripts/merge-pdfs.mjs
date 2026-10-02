import { PDFDocument } from "pdf-lib";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = process.env.LEARN_BOOK_DIR ?? "C:\\Users\\justinmonzingo\\OneDrive - Rightpoint\\Documents\\AzureMasterBook";
const excluded = new Set(["AzureMasterBook-combined.pdf", "dev-center.pdf", "orbital.pdf", "space.pdf", "managed-services.pdf", "marketplace.pdf", "cdn.pdf", "quickstart-templates.pdf", "health-insights.pdf", "immersive-reader.pdf", "arc-postgresql.pdf", "acr-troubleshooting.pdf", "acr-tasks-run.pdf", "acr-tasks-authentication.pdf", "acr-tasks-kubernetes-auth.pdf", "acr-task-triggers.pdf", "acr-tasks-secrets.pdf", "confidential-ledger-quickstart-dotnet.pdf", "confidential-ledger-udf-overview.pdf", "document-intelligence-custom-model.pdf", "functions-hosting-options.pdf", "event-hubs-architecture.pdf", "service-bus-concepts.pdf", "logic-apps-standard-vs-consumption.pdf", "aks-cluster-architecture.pdf", "azure-sql-database-architecture.pdf"]);
const files = (await readdir(root)).filter(name => name.toLowerCase().endsWith(".pdf") && !excluded.has(name)).sort((a, b) => a.localeCompare(b));
const output = await PDFDocument.create();
const contents = [];
const seen = new Set();
for (const name of files) {
  const bytes = await readFile(join(root, name));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (seen.has(digest)) { contents.push({ name, duplicateOf: digest }); continue; }
  seen.add(digest);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = await output.copyPages(source, source.getPageIndices());
  pages.forEach(page => output.addPage(page));
  contents.push({ name, pages: source.getPageCount() });
}
const bytes = await output.save();
await writeFile(join(root, "AzureMasterBook-combined.pdf"), bytes);
await writeFile(join(root, "AzureMasterBook-manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), files: contents, totalPages: output.getPageCount(), output: "AzureMasterBook-combined.pdf" }, null, 2));
console.log(JSON.stringify({ output: join(root, "AzureMasterBook-combined.pdf"), files: contents.length, pages: output.getPageCount(), bytes: bytes.length }));
