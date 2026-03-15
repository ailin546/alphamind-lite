#!/usr/bin/env node
/**
 * AlphaMind Lite - Test Runner
 * Lightweight test harness (zero dependencies)
 */

const assert = require('assert');

let passed = 0;
let failed = 0;
const errors = [];
const asyncTests = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function testAsync(name, fn) {
  asyncTests.push(async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (err) {
      failed++;
      errors.push({ name, error: err.message });
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  });
}

async function runAll() {
  for (const runTest of asyncTests) {
    await runTest();
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    errors.forEach(({ name, error }) => console.log(`  ✗ ${name}: ${error}`));
    process.exit(1);
  }

  process.exit(0);
}

module.exports = { assert, test, testAsync, runAll };
