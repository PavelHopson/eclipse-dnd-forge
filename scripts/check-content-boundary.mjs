import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const roots = ["src", "public", "build", "README.md", "index.html"];
const extensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".tsx", ".txt"]);
const protectedNames = [
    "Phandalin", "Barovia", "Strahd", "Moradin", "Neverwinter", "Cragmaw", "Ravenloft",
    "Zhentarim", "Pelor", "Stonehill", "Triboar", "Sildar", "Redbrand", "Dungeons & Dragons",
];

async function filesUnder(path) {
    const entries = await readdir(path, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const child = join(path, entry.name);
        if (entry.isDirectory()) files.push(...await filesUnder(child));
        else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) files.push(child);
    }
    return files;
}

const files = [];
for (const entry of roots) {
    const path = join(root, entry);
    try {
        const info = await stat(path);
        if (info.isDirectory()) files.push(...await filesUnder(path));
        else files.push(path);
    } catch {
        // Missing optional roots are not a finding.
    }
}

const findings = [];
for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const name of protectedNames) {
        const matcher = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
        if (matcher.test(text)) findings.push(`${relative(root, file)}: ${name}`);
    }
}

if (findings.length > 0) {
    console.error(`Content boundary blocked: ${findings.length} protected-name finding(s).`);
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
} else {
    console.log("Content boundary passed: no protected setting/story names in shipping paths.");
}
