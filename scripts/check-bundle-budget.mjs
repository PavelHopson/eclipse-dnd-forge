import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const buildDir = path.resolve("build");
const html = await readFile(path.join(buildDir, "index.html"), "utf8");
const initialAssetPaths = [
  ...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+[.]js)"/g),
].map((match) => match[1]);

if (initialAssetPaths.length === 0) {
  throw new Error("Unable to find the production JavaScript graph in build/index.html");
}

function resolveBuildAsset(assetPath) {
  const assetsIndex = assetPath.indexOf("/assets/");
  const localPath = assetsIndex >= 0
    ? assetPath.slice(assetsIndex + 1)
    : assetPath.replace(/^[/]/, "");
  return path.join(buildDir, localPath);
}

const initialAssets = [...new Set(initialAssetPaths)];
const initialBytes = (
  await Promise.all(initialAssets.map((assetPath) => stat(resolveBuildAsset(assetPath))))
).reduce((total, asset) => total + asset.size, 0);
const initialBudgetBytes = 650 * 1024;

if (initialBytes > initialBudgetBytes) {
  throw new Error(
    "Initial JavaScript graph is " + (initialBytes / 1024).toFixed(1) + " KiB; budget is " + (initialBudgetBytes / 1024) + " KiB.",
  );
}

const assetNames = await readdir(path.join(buildDir, "assets"));
const initialAssetNames = new Set(initialAssets.map((assetPath) => path.basename(assetPath)));
const deferredJavascriptAssets = assetNames.filter(
  (name) => name.endsWith(".js") && !initialAssetNames.has(name),
);
const sizedDeferredAssets = await Promise.all(
  deferredJavascriptAssets.map(async (name) => ({
    name,
    bytes: (await stat(path.join(buildDir, "assets", name))).size,
  })),
);
const largestDeferredChunk = sizedDeferredAssets.reduce((largest, asset) =>
  asset.bytes > largest.bytes ? asset : largest,
);
const deferredChunkBudgetBytes = 500 * 1024;

if (largestDeferredChunk.bytes > deferredChunkBudgetBytes) {
  throw new Error(
    "Largest deferred JavaScript chunk is " + largestDeferredChunk.name + " at " + (largestDeferredChunk.bytes / 1024).toFixed(1) + " KiB; budget is " + (deferredChunkBudgetBytes / 1024) + " KiB.",
  );
}

const workspaceChunks = assetNames.filter((name) =>
  /^(Model|VisualWritingInterface)-.*[.]js$/.test(name),
);

if (workspaceChunks.length === 0) {
  throw new Error("Campaign workspace is not emitted as a deferred production chunk.");
}

console.log(
  "Bundle budget passed: initial graph " + (initialBytes / 1024).toFixed(1) + " KiB, largest deferred chunk " + largestDeferredChunk.name + " " + (largestDeferredChunk.bytes / 1024).toFixed(1) + " KiB, deferred workspace " + workspaceChunks.join(", ") + ".",
);
