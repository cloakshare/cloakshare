#!/usr/bin/env npx tsx
/**
 * Load test script for CloakShare API.
 *
 * Usage:
 *   npx tsx scripts/load-test.ts [options]
 *
 * Options:
 *   --url        API base URL (default: http://localhost:3000)
 *   --key        API key for authenticated endpoints
 *   --concurrency Number of concurrent requests (default: 10)
 *   --duration   Test duration in seconds (default: 30)
 *   --endpoint   Endpoint to test: health | links | upload | viewer (default: health)
 */

const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const BASE_URL = getArg('url', 'http://localhost:3000');
const API_KEY = getArg('key', '');
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const DURATION_SEC = parseInt(getArg('duration', '30'), 10);
const ENDPOINT = getArg('endpoint', 'health');

interface Stats {
  total: number;
  success: number;
  errors: number;
  latencies: number[];
}

const stats: Stats = { total: 0, success: 0, errors: 0, latencies: [] };

function authHeaders(): Record<string, string> {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

async function makeRequest(): Promise<void> {
  const start = performance.now();
  try {
    let res: Response;

    switch (ENDPOINT) {
      case 'health':
        res = await fetch(`${BASE_URL}/health`);
        break;

      case 'links':
        res = await fetch(`${BASE_URL}/v1/links?limit=5`, {
          headers: authHeaders(),
        });
        break;

      case 'upload': {
        // Minimal PNG: 1x1 pixel
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        );
        const formData = new FormData();
        formData.append('file', new Blob([png], { type: 'image/png' }), 'load-test.png');
        res = await fetch(`${BASE_URL}/v1/links`, {
          method: 'POST',
          headers: authHeaders(),
          body: formData,
        });
        break;
      }

      case 'viewer':
        // Hit a non-existent link — tests 404 path performance
        res = await fetch(`${BASE_URL}/v1/viewer/lnk_nonexistent`);
        break;

      default:
        throw new Error(`Unknown endpoint: ${ENDPOINT}`);
    }

    const latency = performance.now() - start;
    stats.total++;
    stats.latencies.push(latency);

    if (res.ok || res.status === 202 || res.status === 404) {
      stats.success++;
    } else {
      stats.errors++;
    }
  } catch {
    stats.total++;
    stats.errors++;
    stats.latencies.push(performance.now() - start);
  }
}

async function worker(endTime: number): Promise<void> {
  while (Date.now() < endTime) {
    await makeRequest();
  }
}

function printResults() {
  const sorted = stats.latencies.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const rps = stats.total / DURATION_SEC;

  console.log('\n--- Load Test Results ---');
  console.log(`Endpoint:    ${ENDPOINT} (${BASE_URL})`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Duration:    ${DURATION_SEC}s`);
  console.log(`Total:       ${stats.total} requests`);
  console.log(`Success:     ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Errors:      ${stats.errors}`);
  console.log(`RPS:         ${rps.toFixed(1)} req/s`);
  console.log(`Latency avg: ${avg.toFixed(1)}ms`);
  console.log(`Latency p50: ${p50.toFixed(1)}ms`);
  console.log(`Latency p95: ${p95.toFixed(1)}ms`);
  console.log(`Latency p99: ${p99.toFixed(1)}ms`);
}

async function main() {
  if ((ENDPOINT === 'links' || ENDPOINT === 'upload') && !API_KEY) {
    console.error('Error: --key is required for the links and upload endpoints');
    process.exit(1);
  }

  console.log(`Starting load test: ${ENDPOINT} @ ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}, Duration: ${DURATION_SEC}s\n`);

  const endTime = Date.now() + DURATION_SEC * 1000;
  const workers = Array.from({ length: CONCURRENCY }, () => worker(endTime));
  await Promise.all(workers);

  printResults();
}

main().catch(console.error);
