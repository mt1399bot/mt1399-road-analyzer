#!/usr/bin/env node
/**
 * Generate test fixture images for road-reader recognition testing.
 *
 * Generates:
 * - Base sample copy
 * - Scale variants (50%, 200%)
 * - Black border variant
 * - Blurry variant (should fail)
 * - Cropped variant (should fail)
 * - Non-road image (should fail)
 * - Synthetic standard road (known outcomes)
 * - Synthetic MT-style road (red/blue with glow)
 * - Synthetic DG-style road (dark background)
 */

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");
const SAMPLE_PATH = join(__dirname, "..", "public", "sample-baccarat-road.png");

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

function createCircle(canvas: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, r: number, g: number, b: number) {
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px >= 0 && px < width && py >= 0 && py < height) {
          const idx = (py * width + px) * 4;
          canvas[idx] = r; canvas[idx + 1] = g; canvas[idx + 2] = b; canvas[idx + 3] = 255;
        }
      }
    }
  }
}

function fillRect(canvas: Uint8Array, width: number, x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
  for (let py = y; py < y + h && py < width; py++) {
    for (let px = x; px < x + w && px < width; px++) {
      const idx = (py * width + px) * 4;
      canvas[idx] = r; canvas[idx + 1] = g; canvas[idx + 2] = b; canvas[idx + 3] = 255;
    }
  }
}

async function generateScaledVariant(scale: number, suffix: string) {
  const { width, height } = await sharp(SAMPLE_PATH).metadata();
  if (!width || !height) throw new Error("Failed to read sample image metadata");
  const outputPath = join(FIXTURES_DIR, `sample-scaled-${suffix}.png`);
  await sharp(SAMPLE_PATH)
    .resize(Math.round(width * scale), Math.round(height * scale), { kernel: sharp.kernel.nearest })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

async function generateBlackBorderVariant(borderSize: number) {
  const { width, height } = await sharp(SAMPLE_PATH).metadata();
  if (!width || !height) throw new Error("Failed to read sample image metadata");
  const outputPath = join(FIXTURES_DIR, `sample-black-border-${borderSize}.png`);
  const newWidth = width + borderSize * 2;
  const newHeight = height + borderSize * 2;
  const blackBackground = await sharp({
    create: { width: newWidth, height: newHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();
  await sharp(blackBackground)
    .composite([{ input: SAMPLE_PATH, left: borderSize, top: borderSize }])
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

async function generateBlurryVariant() {
  const outputPath = join(FIXTURES_DIR, `sample-blurry.png`);
  await sharp(SAMPLE_PATH)
    .resize(200)
    .blur(8)
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

async function generateCroppedVariant() {
  const { width, height } = await sharp(SAMPLE_PATH).metadata();
  if (!width || !height) throw new Error("Failed to read sample image metadata");
  const outputPath = join(FIXTURES_DIR, `sample-cropped.png`);
  const cropW = Math.round(width * 0.15);
  const cropH = Math.round(height * 0.15);
  await sharp(SAMPLE_PATH)
    .extract({ left: width - cropW, top: height - cropH, width: cropW, height: cropH })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

async function generateNonRoadImage() {
  const outputPath = join(FIXTURES_DIR, `non-road.png`);
  await sharp({
    create: { width: 600, height: 400, channels: 4, background: { r: 240, g: 240, b: 240, alpha: 1 } },
  })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return outputPath;
}

async function generateSyntheticRoad() {
  const gridSize = 40;
  const rows = 8;
  const cols = 8;
  const padding = 20;
  const width = cols * gridSize + padding * 2;
  const height = rows * gridSize + padding * 2;

  const knownOutcomes: Array<"B" | "P"> = [
    "B","B","P","B","P","P","B","P",
    "B","P","B","B","P","B","P","P",
    "P","B","P","B","B","P","B","P",
    "B","B","P","P","B","P","B","B",
    "P","B","B","P","B","P","P","B",
    "B","P","P","B","B","P","B","P",
    "P","B","P","B","P","B","B","P",
    "B","P","B","P","P","B","P","B",
  ];

  const canvas = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 255; canvas[i * 4 + 1] = 255; canvas[i * 4 + 2] = 255; canvas[i * 4 + 3] = 255;
  }

  for (let r = 0; r <= rows; r++) {
    const y = padding + r * gridSize;
    for (let x = padding; x < width - padding; x++) {
      const idx = (y * width + x) * 4;
      canvas[idx] = 200; canvas[idx + 1] = 200; canvas[idx + 2] = 200; canvas[idx + 3] = 255;
    }
  }
  for (let c = 0; c <= cols; c++) {
    const x = padding + c * gridSize;
    for (let y = padding; y < height - padding; y++) {
      const idx = (y * width + x) * 4;
      canvas[idx] = 200; canvas[idx + 1] = 200; canvas[idx + 2] = 200; canvas[idx + 3] = 255;
    }
  }

  const radius = gridSize * 0.35;
  for (let idx = 0; idx < knownOutcomes.length; idx++) {
    const outcome = knownOutcomes[idx];
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const cx = padding + col * gridSize + gridSize / 2;
    const cy = padding + row * gridSize + gridSize / 2;
    if (outcome === "B") {
      createCircle(canvas, width, height, cx, cy, radius, 220, 50, 50);
    } else {
      createCircle(canvas, width, height, cx, cy, radius, 50, 100, 220);
    }
  }

  const outputPath = join(FIXTURES_DIR, `synthetic-road.png`);
  await sharp(Buffer.from(canvas), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return { path: outputPath, knownOutcomes };
}

async function generateSyntheticMTStyle() {
  // MT-style: white background, thick red/blue circles, slight glow
  const gridSize = 44;
  const rows = 6;
  const cols = 10;
  const padding = 24;
  const width = cols * gridSize + padding * 2;
  const height = rows * gridSize + padding * 2;

  const knownOutcomes: Array<"B" | "P"> = [
    "B","P","B","B","P","P","B","P","B","P",
    "P","B","P","B","P","B","B","P","P","B",
    "B","B","P","P","B","P","B","P","B","P",
    "P","B","B","P","B","B","P","B","P","P",
    "B","P","B","P","P","B","P","B","B","P",
    "P","B","P","B","B","P","B","P","P","B",
  ];

  const canvas = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 255; canvas[i * 4 + 1] = 255; canvas[i * 4 + 2] = 255; canvas[i * 4 + 3] = 255;
  }

  // Subtle grid
  for (let r = 0; r <= rows; r++) {
    const y = padding + r * gridSize;
    for (let x = padding; x < width - padding; x++) {
      const idx = (y * width + x) * 4;
      canvas[idx] = 230; canvas[idx + 1] = 230; canvas[idx + 2] = 230; canvas[idx + 3] = 255;
    }
  }
  for (let c = 0; c <= cols; c++) {
    const x = padding + c * gridSize;
    for (let y = padding; y < height - padding; y++) {
      const idx = (y * width + x) * 4;
      canvas[idx] = 230; canvas[idx + 1] = 230; canvas[idx + 2] = 230; canvas[idx + 3] = 255;
    }
  }

  const radius = gridSize * 0.38;
  for (let idx = 0; idx < knownOutcomes.length; idx++) {
    const outcome = knownOutcomes[idx];
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const cx = padding + col * gridSize + gridSize / 2;
    const cy = padding + row * gridSize + gridSize / 2;
    if (outcome === "B") {
      createCircle(canvas, width, height, cx, cy, radius, 210, 40, 40);
    } else {
      createCircle(canvas, width, height, cx, cy, radius, 40, 80, 200);
    }
  }

  const outputPath = join(FIXTURES_DIR, `synthetic-road-mt.png`);
  await sharp(Buffer.from(canvas), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return { path: outputPath, knownOutcomes };
}

async function generateSyntheticDGStyle() {
  // DG-style: dark background, bright red/blue circles
  const gridSize = 40;
  const rows = 8;
  const cols = 8;
  const padding = 20;
  const width = cols * gridSize + padding * 2;
  const height = rows * gridSize + padding * 2;

  const knownOutcomes: Array<"B" | "P"> = [
    "P","P","B","B","P","B","P","P",
    "B","B","P","B","P","P","B","B",
    "P","B","P","P","B","B","P","B",
    "B","P","B","P","P","B","P","P",
    "P","B","B","P","B","P","B","B",
    "B","P","P","B","B","P","P","B",
    "P","B","P","B","P","B","B","P",
    "B","B","P","P","B","P","B","P",
  ];

  const canvas = new Uint8Array(width * height * 4);
  // Dark background
  for (let i = 0; i < width * height; i++) {
    canvas[i * 4] = 30; canvas[i * 4 + 1] = 30; canvas[i * 4 + 2] = 35; canvas[i * 4 + 3] = 255;
  }

  const radius = gridSize * 0.35;
  for (let idx = 0; idx < knownOutcomes.length; idx++) {
    const outcome = knownOutcomes[idx];
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const cx = padding + col * gridSize + gridSize / 2;
    const cy = padding + row * gridSize + gridSize / 2;
    if (outcome === "B") {
      createCircle(canvas, width, height, cx, cy, radius, 230, 60, 60);
    } else {
      createCircle(canvas, width, height, cx, cy, radius, 60, 120, 240);
    }
  }

  const outputPath = join(FIXTURES_DIR, `synthetic-road-dg.png`);
  await sharp(Buffer.from(canvas), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
  console.log(`Generated: ${outputPath}`);
  return { path: outputPath, knownOutcomes };
}

async function main() {
  await ensureDir(FIXTURES_DIR);
  console.log("Generating test fixtures...\n");

  // Copy base sample
  const baseOutput = join(FIXTURES_DIR, "sample-base.png");
  await sharp(SAMPLE_PATH).png().toFile(baseOutput);
  console.log(`Generated: ${baseOutput}`);

  // Generate variants
  await generateScaledVariant(0.5, "50pct");
  await generateScaledVariant(2.0, "200pct");
  await generateBlackBorderVariant(30);
  await generateBlurryVariant();
  await generateCroppedVariant();
  await generateNonRoadImage();
  await generateSyntheticRoad();
  await generateSyntheticMTStyle();
  await generateSyntheticDGStyle();

  console.log("\nAll fixture images generated.");
  console.log("Next: run 'npx tsx tests/road-recognition.test.ts' to execute recognition tests.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
