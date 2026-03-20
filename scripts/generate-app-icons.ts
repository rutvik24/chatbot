/**
 * Rasterizes SVG app icons for Expo (universal icon, Android adaptive, favicon, splash).
 * Run: bun run generate-icons
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsImages = path.join(root, "assets", "images");
const expoIconAssets = path.join(root, "assets", "expo.icon", "Assets");

async function renderPng(
  svgPath: string,
  outPath: string,
  size: number,
  background: string | undefined
) {
  const svg = await readFile(svgPath);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    ...(background !== undefined ? { background } : {}),
  });
  const data = resvg.render();
  await writeFile(outPath, data.asPng());
}

async function main() {
  await mkdir(assetsImages, { recursive: true });

  const iosLayer = path.join(expoIconAssets, "chat-app-icon-ios-layer.svg");
  const raster = path.join(expoIconAssets, "chat-app-icon.svg");
  const androidFg = path.join(expoIconAssets, "chat-app-icon-android-fg.svg");
  const splashSvg = path.join(expoIconAssets, "chat-app-icon-splash.svg");
  const bgSvg = path.join(expoIconAssets, "android-icon-background.svg");

  await renderPng(raster, path.join(assetsImages, "icon.png"), 1024, undefined);
  await renderPng(androidFg, path.join(assetsImages, "android-icon-foreground.png"), 1024, "transparent");
  await renderPng(iosLayer, path.join(assetsImages, "android-icon-monochrome.png"), 1024, "transparent");
  await renderPng(raster, path.join(assetsImages, "favicon.png"), 64, undefined);
  await renderPng(splashSvg, path.join(assetsImages, "splash-icon.png"), 400, "transparent");
  await renderPng(bgSvg, path.join(assetsImages, "android-icon-background.png"), 1024, undefined);

  console.log("Wrote PNGs under assets/images/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
