import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const buildDir = path.resolve("build");
const html = await readFile(path.join(buildDir, "index.html"), "utf8");
const scriptTag = html.match(/<script[^>]+src="([^"]+)"/);

if (!scriptTag) {
  throw new Error("Unable to find the production entry script in build/index.html");
}

const entryPath = path.join(buildDir, scriptTag[1].replace(/^[/]/, ""));
const entryBytes = (await stat(entryPath)).size;
const entryBudgetBytes = 650 * 1024;

if (entryBytes > entryBudgetBytes) {
  throw new Error(
    "Initial JavaScript is " + (entryBytes / 1024).toFixed(1) + " KiB; budget is " + (entryBudgetBytes / 1024) + " KiB.",
  );
}

const assetNames = await readdir(path.join(buildDir, "assets"));
const workspaceChunks = assetNames.filter((name) =>
  /^(Model|VisualWritingInterface)-.*[.]js$/.test(name),
);

if (workspaceChunks.length === 0) {
  throw new Error("Campaign workspace is not emitted as a deferred production chunk.");
}

console.log(
  "Bundle budget passed: initial " + (entryBytes / 1024).toFixed(1) + " KiB, deferred workspace " + workspaceChunks.join(", ") + ".",
);
