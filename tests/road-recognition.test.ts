#!/usr/bin/env node
/**
 * Road recognition test suite v1.12.6
 *
 * Reads tests/fixtures/expected-results.json and executes actual recognition
 * against every fixture image using the production engine (road-reader.ts).
 *
 * Comparison rules:
 * - If expected.knownOutcomes exists: exact match against outcomes array
 * - If expected.shouldFail: markerCount must be < 6
 * - For edge tests with canonical: outcomes must match the canonical image exactly
 * - Otherwise: markerCount >= expected.markerCountMin, confidence >= expected.confidenceMin
 *
 * Reports: pass/fail per image, total counts, and detailed diffs.
 */

import { readFile, access, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRoadFromFile } from "./node-road-reader";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

interface ExpectedFixture {
  filename: string;
  description: string;
  type: "positive" | "negative" | "edge";
  source?: string;
  platform?: string;
  device?: string;
  device?: string;
  expected: {
    markerCountMin?: number;
    markerCountMax?: number;
    mode?: string;
    confidenceMin?: number;
    shouldFail?: boolean;
    knownOutcomes?: string[];
  };
  baseline?: {
    markerCount: number;
    mode: string;
    confidence: number;
    outcomesFirst40: string;
    bigEyeRoad: number;
    smallRoad: number;
    cockroachRoad: number;
  } | null;
  note?: string;
  // For edge tests: name of the canonical/original image to compare against
  canonical?: string;
}

interface TestReport {
  filename: string;
  description: string;
  type: string;
  source?: string;
  platform?: string;
  passed: boolean;
  actual: {
    markerCount: number;
    mode: string;
    confidence: number;
    outcomes: string;
    outcomesLength: number;
    bigEyeRoad: number;
    smallRoad: number;
    cockroachRoad: number;
  };
  expected: ExpectedFixture["expected"];
  baseline?: ExpectedFixture["baseline"];
  errors: string[];
  warnings: string[];
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function formatOutcomes(outcomes: string[]): string {
  if (outcomes.length <= 40) return outcomes.join("");
  return outcomes.slice(0, 40).join("") + `... (${outcomes.length} total)`;
}

async function runTests(): Promise<TestReport[]> {
  const expectedData = JSON.parse(await readFile(join(FIXTURES_DIR, "expected-results.json"), "utf-8"));
  const fixtures: ExpectedFixture[] = expectedData.fixtures;
  const reports: TestReport[] = [];

  // Pre-read canonical outcomes for edge tests
  const canonicalOutcomes: Map<string, string> = new Map();
  for (const fixture of fixtures) {
    if (fixture.type === "edge" && fixture.canonical) {
      const canonicalPath = join(FIXTURES_DIR, fixture.canonical);
      if (await fileExists(canonicalPath) && !canonicalOutcomes.has(fixture.canonical)) {
        try {
          const snapshot = await readRoadFromFile(canonicalPath);
          canonicalOutcomes.set(fixture.canonical, snapshot.outcomes.join(""));
        } catch {
          // ignore
        }
      }
    }
  }

  for (const fixture of fixtures) {
    const imagePath = join(FIXTURES_DIR, fixture.filename);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if file exists
    if (!(await fileExists(imagePath))) {
      errors.push(`Fixture image not found: ${imagePath}`);
      reports.push({
        filename: fixture.filename,
        description: fixture.description,
        type: fixture.type,
        source: fixture.source,
        platform: fixture.platform,
        device: fixture.device,
        passed: false,
        actual: { markerCount: 0, mode: "missing", confidence: 0, outcomes: "", outcomesLength: 0, bigEyeRoad: 0, smallRoad: 0, cockroachRoad: 0 },
        expected: fixture.expected,
        baseline: fixture.baseline,
        errors,
        warnings: fixture.source === "real-screenshot" ? ["Real screenshot required but not provided"] : [],
      });
      continue;
    }

    // Run recognition
    let snapshot;
    try {
      snapshot = await readRoadFromFile(imagePath);
    } catch (err) {
      if (fixture.expected.shouldFail) {
        reports.push({
          filename: fixture.filename,
          description: fixture.description,
          type: fixture.type,
          source: fixture.source,
          platform: fixture.platform,
          device: fixture.device,
          passed: true,
          actual: { markerCount: 0, mode: "error", confidence: 0, outcomes: "", outcomesLength: 0, bigEyeRoad: 0, smallRoad: 0, cockroachRoad: 0 },
          expected: fixture.expected,
          baseline: fixture.baseline,
          errors: [],
          warnings: [`Recognition failed as expected: ${err instanceof Error ? err.message : String(err)}`],
        });
      } else {
        errors.push(`Recognition error: ${err instanceof Error ? err.message : String(err)}`);
        reports.push({
          filename: fixture.filename,
          description: fixture.description,
          type: fixture.type,
          source: fixture.source,
          platform: fixture.platform,
          device: fixture.device,
          passed: false,
          actual: { markerCount: 0, mode: "error", confidence: 0, outcomes: "", outcomesLength: 0, bigEyeRoad: 0, smallRoad: 0, cockroachRoad: 0 },
          expected: fixture.expected,
          baseline: fixture.baseline,
          errors,
          warnings,
        });
      }
      continue;
    }

    const actualOutcomesStr = snapshot.outcomes.join("");

    // Validate against expectations
    if (fixture.expected.shouldFail) {
      if (snapshot.markerCount >= 6) {
        errors.push(`Expected failure but got ${snapshot.markerCount} markers (mode=${snapshot.mode}, confidence=${snapshot.confidence.toFixed(3)})`);
      }
    } else {
      if (fixture.expected.markerCountMin !== undefined && snapshot.markerCount < fixture.expected.markerCountMin) {
        errors.push(`markerCount ${snapshot.markerCount} < expected min ${fixture.expected.markerCountMin}`);
      }
      if (fixture.expected.confidenceMin !== undefined && snapshot.confidence < fixture.expected.confidenceMin) {
        errors.push(`confidence ${snapshot.confidence.toFixed(3)} < expected min ${fixture.expected.confidenceMin}`);
      }
      if (fixture.expected.mode && snapshot.mode !== fixture.expected.mode) {
        errors.push(`mode ${snapshot.mode} !== expected ${fixture.expected.mode}`);
      }
    }

    // Check known outcomes (exact match for synthetic images)
    if (fixture.expected.knownOutcomes) {
      const expectedStr = fixture.expected.knownOutcomes.join("");
      if (actualOutcomesStr !== expectedStr) {
        errors.push(`Outcomes mismatch`);
        errors.push(`  Expected (${fixture.expected.knownOutcomes.length}): ${expectedStr.slice(0, 60)}${expectedStr.length > 60 ? "..." : ""}`);
        errors.push(`  Actual   (${snapshot.outcomes.length}): ${actualOutcomesStr.slice(0, 60)}${actualOutcomesStr.length > 60 ? "..." : ""}`);
      }
    }

    // For edge tests: compare against canonical (original) image outcomes
    if (fixture.type === "edge" && fixture.canonical) {
      const canonical = canonicalOutcomes.get(fixture.canonical);
      if (canonical !== undefined) {
        if (actualOutcomesStr !== canonical) {
          errors.push(`Outcomes mismatch against canonical (${fixture.canonical})`);
          errors.push(`  Canonical: ${canonical.slice(0, 60)}${canonical.length > 60 ? "..." : ""}`);
          errors.push(`  Actual:    ${actualOutcomesStr.slice(0, 60)}${actualOutcomesStr.length > 60 ? "..." : ""}`);
          // Show diff position
          let diffPos = 0;
          while (diffPos < Math.min(canonical.length, actualOutcomesStr.length) && canonical[diffPos] === actualOutcomesStr[diffPos]) {
            diffPos++;
          }
          errors.push(`  First diff at position ${diffPos}: expected '${canonical[diffPos] || "EOF"}', got '${actualOutcomesStr[diffPos] || "EOF"}'`);
        }
      }
    }

    reports.push({
      filename: fixture.filename,
      description: fixture.description,
      type: fixture.type,
      source: fixture.source,
      platform: fixture.platform,
      device: fixture.device,
      passed: errors.length === 0,
      actual: {
        markerCount: snapshot.markerCount,
        mode: snapshot.mode,
        confidence: snapshot.confidence,
        outcomes: formatOutcomes(snapshot.outcomes),
        outcomesLength: snapshot.outcomes.length,
        bigEyeRoad: snapshot.bigEyeRoad.length,
        smallRoad: snapshot.smallRoad.length,
        cockroachRoad: snapshot.cockroachRoad.length,
      },
      expected: fixture.expected,
      baseline: fixture.baseline,
      errors,
      warnings,
    });
  }

  return reports;
}

async function main() {
  console.log("=".repeat(70));
  console.log("MT1399 Road Recognition Test Suite v1.12.6");
  console.log("=".repeat(70));
  console.log("Engine: readRoadFromPixels (production code path)");
  console.log("Images: tests/fixtures/");
  console.log("");

  const reports = await runTests();

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const report of reports) {
    const hasWarnings = report.warnings.length > 0;
    const isMissingRealFixture = report.source === "real-screenshot" && report.actual.mode === "missing";

    const status = isMissingRealFixture ? "SKIP" : report.passed ? "PASS" : "FAIL";
    const icon = isMissingRealFixture ? "○" : report.passed ? "✓" : "✗";
    console.log(`\n${icon} [${status}] ${report.filename}`);
    console.log(`   Description: ${report.description}`);
    if (report.platform) console.log(`   Platform: ${report.platform} (${report.device || "unknown"})`);
    console.log(`   Type: ${report.type} | Source: ${report.source || "unknown"}`);
    console.log(`   Actual:   markerCount=${report.actual.markerCount}, mode=${report.actual.mode}, confidence=${report.actual.confidence.toFixed(3)}`);
    console.log(`   Outcomes: ${report.actual.outcomes}`);
    console.log(`   Derived:  BigEye=${report.actual.bigEyeRoad}, Small=${report.actual.smallRoad}, Cockroach=${report.actual.cockroachRoad}`);

    if (report.expected.knownOutcomes) {
      console.log(`   Known:    ${report.expected.knownOutcomes.length} outcomes defined for exact match`);
    }

    if (isMissingRealFixture) {
      skipped++;
    } else if (report.errors.length > 0) {
      for (const error of report.errors) {
        console.log(`   ERROR: ${error}`);
      }
      failed++;
    } else {
      passed++;
    }

    if (hasWarnings) {
      for (const warning of report.warnings) {
        console.log(`   WARN:  ${warning}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped (total ${reports.length})`);
  console.log("=".repeat(70));

  // Write JSON report
  const reportPath = join(FIXTURES_DIR, "test-report.json");
  await writeFile(
    reportPath,
    JSON.stringify({
      version: "1.11.0",
      timestamp: new Date().toISOString(),
      passed,
      failed,
      skipped,
      total: reports.length,
      reports: reports.map(r => ({
        filename: r.filename,
        passed: r.passed,
        errors: r.errors,
        warnings: r.warnings,
        actual: r.actual,
      })),
    }, null, 2)
  );
  console.log(`\nDetailed report: ${reportPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
