import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = join(root, "public", "monsters");
const outputDir = join(sourceDir, "transparent");
const manifestFile = join(outputDir, "manifest.json");
const assetPattern = /^([0-9A-Z]+)[\s_-]+(.+)\.png$/u;

const backgroundThreshold = 238;
const neutralTolerance = 30;
const maxOutputSize = 768;
const generatorVersion = 2;

mkdirSync(outputDir, { recursive: true });

const files = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name.normalize("NFC"))
  .filter((file) => assetPattern.test(file))
  .sort((a, b) => a.localeCompare(b, "ja"));

function readManifest() {
  if (!existsSync(manifestFile)) return {};
  try {
    return JSON.parse(readFileSync(manifestFile, "utf8"));
  } catch {
    return {};
  }
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

const manifest = readManifest();

function isBackgroundPixel(data, index) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const alpha = data[index + 3];

  if (alpha === 0) return true;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return red >= backgroundThreshold
    && green >= backgroundThreshold
    && blue >= backgroundThreshold
    && max - min <= neutralTolerance;
}

function removeEdgeConnectedBackground(data, width, height) {
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = [];

  function enqueue(pixelIndex) {
    if (visited[pixelIndex]) return;
    const byteIndex = pixelIndex * 4;
    if (!isBackgroundPixel(data, byteIndex)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const x = current % width;
    const y = Math.floor(current / width);

    if (x > 0) enqueue(current - 1);
    if (x < width - 1) enqueue(current + 1);
    if (y > 0) enqueue(current - width);
    if (y < height - 1) enqueue(current + width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (visited[pixelIndex]) {
      data[pixelIndex * 4 + 3] = 0;
    }
  }

  return visited.reduce((sum, value) => sum + value, 0);
}

let totalRemoved = 0;
let generatedCount = 0;
let skippedCount = 0;

async function isOutputFresh(file, sourceFile, outputFile, sourceHash) {
  if (!existsSync(outputFile)) return false;
  const entry = manifest[file];
  if (!entry) return false;
  if (entry.sourceHash !== sourceHash) return false;
  if (entry.generatorVersion !== generatorVersion) return false;
  if (entry.backgroundThreshold !== backgroundThreshold) return false;
  if (entry.neutralTolerance !== neutralTolerance) return false;
  if (entry.maxOutputSize !== maxOutputSize) return false;

  const metadata = await sharp(outputFile).metadata();
  return Math.max(metadata.width ?? 0, metadata.height ?? 0) <= maxOutputSize;
}

for (const file of files) {
  const sourceFile = join(sourceDir, file);
  const outputFile = join(outputDir, file);
  const sourceHash = hashFile(sourceFile);

  if (await isOutputFresh(file, sourceFile, outputFile, sourceHash)) {
    skippedCount += 1;
    continue;
  }

  const { data, info } = await sharp(sourceFile)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const removed = removeEdgeConnectedBackground(data, info.width, info.height);
  totalRemoved += removed;

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .resize({
      width: maxOutputSize,
      height: maxOutputSize,
      fit: "inside",
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toFile(outputFile);

  const outputMetadata = await sharp(outputFile).metadata();
  manifest[file] = {
    sourceHash,
    generatorVersion,
    backgroundThreshold,
    neutralTolerance,
    maxOutputSize,
    width: outputMetadata.width,
    height: outputMetadata.height
  };

  generatedCount += 1;
}

for (const key of Object.keys(manifest)) {
  if (!files.includes(key)) {
    delete manifest[key];
  }
}

writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Prepared ${files.length} transparent monster assets in ${outputDir}.`);
console.log(`Generated ${generatedCount}, skipped ${skippedCount}.`);
if (generatedCount > 0) {
  console.log(`Removed ${totalRemoved.toLocaleString("ja-JP")} edge-connected background pixels.`);
}
