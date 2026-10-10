#!/usr/bin/env node
/**
 * Calibrate fixture baselines from actual recognition output.
 *
 * Usage: npx tsx tests/calibrate-fixtures.ts
 *
 * This script runs recognition on all fixture images and updates
 * expected-results.json with the actual engine output as baseline.
 * Use this after adding new real screenshots to capture their baseline.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRoadFromFile } from "./node-road-reader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

async function main() {
  console.log("Calibrating fixture baselines...\n");

  const expectedPath = join(FIXTURES_DIR, "expected-results.json");
  const data = JSON.parse(await readFile(expectedPath, "utf-8"));
  const fixtures = data.fixtures;
  let updated = 0;

  for (const fixture of fixtures) {
    const imagePath = join(FIXTURES_DIR, fixture.filename);

    try {
      const snapshot = await readRoadFromFile(imagePath);

      const newBaseline = {
        markerCount: snapshot.markerCount,
        mode: snapshot.mode,
        confidence: Math.round(snapshot.confidence * 1000) / 1000,
        outcomesFirst40: snapshot.outcomes.slice(0, 40).join(""),
        bigEyeRoad: snapshot.bigEyeRoad.length,
        smallRoad: snapshot.smallRoad.length,
        cockroachRoad: snapshot.cockroachRoad.length,
      };

      // Only update if baseline is null or different
      const oldBaseline = fixture.baseline;
      if (!oldBaseline || JSON.stringify(oldBaseline) !== JSON.stringify(newBaseline)) {
        fixture.baseline = newBaseline;
        updated++;
        console.log(`Updated: ${fixture.filename}`);
        console.log(`  markers=${newBaseline.markerCount}, confidence=${newBaseline.confidence}`);
      } else {
        console.log(`Unchanged: ${fixture.filename}`);
      }
    } catch (err) {
      console.log(`Failed: ${fixture.filename} - ${err instanceof Error ? err.message : String(err)}`);
      fixture.baseline = {
        markerCount: 0,
        mode: "error",
        confidence: 0,
        outcomesFirst40: "",
        bigEyeRoad: 0,
        smallRoad: 0,
        cockroachRoad: 0,
      };
      updated++;
    }
  }

  data.calibratedAt = new Date().toISOString();
  await writeFile(expectedPath, JSON.stringify(data, null, 2));

  console.log(`\n${updated} fixtures updated.`);
  console.log(`Saved to: ${expectedPath}`);
  console.log("\nNext: manually verify outcomesFirst40 against the actual image.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
