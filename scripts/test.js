#!/usr/bin/env node
/**
 * AlphaMind Lite - Test Suite
 * Lightweight test runner (zero dependencies)
 */

const assert = require('assert');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];

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

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, error: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

// ==========================================
console.log('\n🧪 AlphaMind Lite Test Suite\n');

// ---- Config Tests ----
console.log('📋 Config');
test('config loads without error', () => {
  const config = require('../config/config');
  assert.ok(config);
  assert.ok(config.server);
  assert.ok(config.apis);
});

test('config has required fields', () => {
  const config = require('../config/config');
  assert.strictEqual(typeof config.server.port, 'number');
  assert.ok(config.server.port > 0);
  assert.ok(config.apis.binance.rest);
  assert.ok(config.apis.fearGreed.url);
});

test('config validate returns array', () => {
  const config = require('../config/config');
  const warnings = config.validate();
  assert.ok(Array.isArray(warnings));
});

// ---- Logger Tests ----
console.log('\n📋 Logger');
test('logger creates without error', () => {
  const { Logger } = require('./logger');
  const logger = new Logger({ level: 'debug', format: 'json' });
  assert.ok(logger);
  logger.close();
});

test('logger child creates context', () => {
  const { Logger } = require('./logger');
  const logger = new Logger({ level: 'info', context: 'test' });
  const child = logger.child('sub');
  assert.ok(child);
  assert.strictEqual(child.context, 'test:sub');
  logger.close();
  child.close();
});

// ---- API Client Tests ----
console.log('\n📋 API Client');
test('api-client module loads', () => {
  const api = require('./api-client');
  assert.ok(api.fetchMarketData);
  assert.ok(api.fetchPrice);
  assert.ok(api.fetchFearGreedIndex);
  assert.ok(api.fetchMultiplePrices);
});

test('api-client has all expected exports', () => {
  const api = require('./api-client');
  const expected = ['httpGet', 'fetchMarketData', 'fetchPrice', 'fetchMultiplePrices', 'fetchFearGreedIndex', 'fetchFundingRates', 'fetchKlines'];
  expected.forEach(fn => {
    assert.strictEqual(typeof api[fn], 'function', `Missing export: ${fn}`);
  });
});

// ---- Script Syntax Tests ----
console.log('\n📋 Script Syntax');
const fs = require('fs');

const scriptDir = path.join(__dirname);
const scripts = fs.readdirSync(scriptDir).filter(f => f.endsWith('.js') && f !== 'test.js');

scripts.forEach(script => {
  test(`${script} has valid syntax`, () => {
    const { execSync } = require('child_process');
    execSync(`node -c "${path.join(scriptDir, script)}"`, { encoding: 'utf8' });
  });
});

// ---- Config File Syntax ----
const configDir = path.join(__dirname, '..', 'config');
if (fs.existsSync(configDir)) {
  const configFiles = fs.readdirSync(configDir).filter(f => f.endsWith('.js'));
  configFiles.forEach(file => {
    test(`config/${file} has valid syntax`, () => {
      const { execSync } = require('child_process');
      execSync(`node -c "${path.join(configDir, file)}"`, { encoding: 'utf8' });
    });
  });
}

// ---- Results ----
console.log(`\n${'═'.repeat(40)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(40)}\n`);

if (failed > 0) {
  console.log('Failed tests:');
  errors.forEach(({ name, error }) => console.log(`  ✗ ${name}: ${error}`));
  process.exit(1);
}

process.exit(0);
