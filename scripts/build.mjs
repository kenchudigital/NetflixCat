import * as esbuild from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

async function safeCopy(sourceRelativePath, destinationRelativePath) {
  const source = path.join(root, sourceRelativePath);
  const destination = path.join(dist, destinationRelativePath);

  if (!existsSync(source)) {
    return;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

const shared = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  logLevel: "info"
};

await mkdir(dist, { recursive: true });

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ["src/background/service-worker.ts"],
    outfile: "dist/background/service-worker.js",
    format: "esm"
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content/index.js",
    format: "iife"
  }),
  esbuild.build({
    ...shared,
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup/popup.js",
    format: "iife"
  })
]);

await safeCopy("manifest.json", "manifest.json");
await safeCopy("src/popup/popup.html", "popup/popup.html");
await safeCopy("src/popup/popup.css", "popup/popup.css");
await safeCopy("src/content/styles.css", "content/styles.css");
await safeCopy("public/icons", "icons");

console.log("Build complete. Load the dist folder in chrome://extensions");
