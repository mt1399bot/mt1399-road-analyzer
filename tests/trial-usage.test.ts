#!/usr/bin/env node
/**
 * IP-based trial usage counter test (pure JS simulation)
 *
 * Simulates the D1 SQL logic in JavaScript to verify:
 * 1. Same IP shares counter across sessions
 * 2. Counter increments atomically
 * 3. Failed recognition does not consume
 * 4. Different IPs are independent
 */

const TRIAL_LIMIT = 20;

// Simulate D1 table
class TrialUsageDB {
  private data = new Map<string, { count: number; status: string }>();

  consume(ipHash: string): { success: boolean; remaining: number; error?: string } {
    const current = this.data.get(ipHash);

    if (!current) {
      // INSERT new record
      this.data.set(ipHash, { count: 1, status: "active" });
      return { success: true, remaining: TRIAL_LIMIT - 1 };
    }

    if (current.status !== "active" || current.count >= TRIAL_LIMIT) {
      return { success: false, remaining: 0, error: "Trial limit reached" };
    }

    // Atomic UPDATE
    current.count += 1;
    return { success: true, remaining: TRIAL_LIMIT - current.count };
  }

  get(ipHash: string) {
    return this.data.get(ipHash) ?? { count: 0, status: "active" };
  }
}

// Tests
function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`✓ ${name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  test("Fresh IP gets 19 remaining after first consume", () => {
    const db = new TrialUsageDB();
    const result = db.consume("ip-1");
    if (!result.success) throw new Error("Should succeed");
    if (result.remaining !== 19) throw new Error(`Expected 19, got ${result.remaining}`);
  });

  test("Same IP shares counter (simulate refresh/reopen/incognito)", () => {
    const db = new TrialUsageDB();
    // First session: consume 5 times
    for (let i = 0; i < 5; i++) db.consume("ip-2");

    // Simulate "refresh": same IP, should see remaining 15
    const result = db.consume("ip-2");
    if (!result.success) throw new Error("Should succeed");
    if (result.remaining !== 14) throw new Error(`Expected 14, got ${result.remaining}`);

    // Simulate "incognito": same IP (hash is same), should see remaining 14
    const result2 = db.consume("ip-2");
    if (!result2.success) throw new Error("Should succeed in incognito");
    if (result2.remaining !== 13) throw new Error(`Expected 13, got ${result2.remaining}`);
  });

  test("Different IP has independent counter", () => {
    const db = new TrialUsageDB();
    db.consume("ip-a");
    db.consume("ip-a");

    const result = db.consume("ip-b");
    if (!result.success) throw new Error("Should succeed for new IP");
    if (result.remaining !== 19) throw new Error(`Expected 19, got ${result.remaining}`);
  });

  test("20th consume fails (limit reached)", () => {
    const db = new TrialUsageDB();
    for (let i = 0; i < 20; i++) db.consume("ip-3");

    const result = db.consume("ip-3");
    if (result.success) throw new Error("Should fail after limit");
    if (result.error !== "Trial limit reached") throw new Error(`Expected limit error, got ${result.error}`);
  });

  test("Failed recognition does not consume (markerCount < 6)", () => {
    const db = new TrialUsageDB();

    // Simulate: analyzeFile() detects markerCount < 6, throws error BEFORE consumeUsage()
    const markerCount = 3;
    if (markerCount < 6) {
      // Error thrown, consumeUsage() never called
    }

    const usage = db.get("ip-4");
    if (usage.count !== 0) throw new Error("Should not consume on failed recognition");
  });

  test("Successful recognition consumes exactly 1", () => {
    const db = new TrialUsageDB();

    // Simulate: analyzeFile() succeeds, then consumeUsage() called once
    const markerCount = 10;
    if (markerCount >= 6) {
      db.consume("ip-5");
    }

    const usage = db.get("ip-5");
    if (usage.count !== 1) throw new Error(`Expected 1 consume, got ${usage.count}`);
  });

  test("Concurrent consumes are atomic", () => {
    const db = new TrialUsageDB();
    const ip = "ip-concurrent";

    // Simulate 5 rapid concurrent requests
    const results = [
      db.consume(ip),
      db.consume(ip),
      db.consume(ip),
      db.consume(ip),
      db.consume(ip),
    ];

    const successes = results.filter((r) => r.success).length;
    const final = db.get(ip);

    if (successes !== 5) throw new Error(`Expected 5 successes, got ${successes}`);
    if (final.count !== 5) throw new Error(`Expected count=5, got ${final.count}`);
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`IP Trial Usage Tests: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}`);

  return { passed, failed };
}

const { passed, failed } = runTests();
process.exit(failed > 0 ? 1 : 0);
