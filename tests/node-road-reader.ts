// Node.js compatible wrapper for road-reader.ts
// Loads images via sharp, downscales large images to standard size,
// then calls the production engine (readRoadFromPixels) with step=1.
// Black border cropping and resolution checks are handled by the engine itself.

import sharp from "sharp";
import { readRoadFromPixels, cropBlackBorders } from "../app/road-reader";
import type { RoadSnapshot } from "../app/road-reader";

const STANDARD_SHORT_EDGE = 546;

async function loadAndNormalize(imagePath: string): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const { data, info } = await sharp(imagePath)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  let width = info.width;
  let height = info.height;
  let pixelData = new Uint8ClampedArray(data);

  // Step 1: Crop black borders (same as browser engine)
  const cropped = cropBlackBorders(pixelData, width, height);
  pixelData = cropped.data;
  width = cropped.width;
  height = cropped.height;

  // Step 2: Downscale large images to standard size (matches browser behavior)
  const currentShortEdge = Math.min(width, height);
  if (currentShortEdge > STANDARD_SHORT_EDGE) {
    const scale = STANDARD_SHORT_EDGE / currentShortEdge;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const resized = await sharp(pixelData, { raw: { width, height, channels: 4 } })
      .resize({ width: targetWidth, height: targetHeight, fit: "fill", kernel: sharp.kernel.nearest })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    pixelData = new Uint8ClampedArray(resized.data);
    width = resized.info.width;
    height = resized.info.height;
  }

  return { data: pixelData, width, height };
}

export async function readRoadFromFile(imagePath: string): Promise<RoadSnapshot> {
  const { data, width, height } = await loadAndNormalize(imagePath);
  // readRoadFromPixels handles black border cropping and resolution checks
  return readRoadFromPixels(data, width, height, { step: 1 });
}

export async function readRoadFromBuffer(buffer: Buffer): Promise<RoadSnapshot> {
  const { data, info } = await sharp(buffer)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  let width = info.width;
  let height = info.height;
  let pixelData = new Uint8ClampedArray(data);

  const currentShortEdge = Math.min(width, height);
  if (currentShortEdge > STANDARD_SHORT_EDGE) {
    const scale = STANDARD_SHORT_EDGE / currentShortEdge;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const resized = await sharp(pixelData, { raw: { width, height, channels: 4 } })
      .resize({ width: targetWidth, height: targetHeight, fit: "fill", kernel: sharp.kernel.nearest })
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    pixelData = new Uint8ClampedArray(resized.data);
    width = resized.info.width;
    height = resized.info.height;
  }

  return readRoadFromPixels(pixelData, width, height, { step: 1 });
}
