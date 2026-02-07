#!/usr/bin/env node
import path from 'node:path';
import {
  applyThresholdChecks,
  collectMetrics,
  createResult,
  printResult,
} from './quality_baseline.lib.js';

const args = process.argv.slice(2);

const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  const value = args[index + 1];
  return value ?? fallback;
};

const hasFlag = (flag) => args.includes(flag);
const distDir = path.resolve(getArgValue('--dist', 'dist'));
const thresholds = {
  maxIndexMb: Number(getArgValue('--max-index-mb', '2')),
  maxTotalMb: Number(getArgValue('--max-total-mb', '120')),
  maxHomeKb: Number(getArgValue('--max-home-kb', '1024')),
  maxCoverKb: Number(getArgValue('--max-cover-kb', '1800')),
  maxHtmlMb: Number(getArgValue('--max-html-mb', '15')),
  maxPageKb: Number(getArgValue('--max-page-kb', '400')),
};
const warnOnly = hasFlag('--warn-only');
const jsonOutput = hasFlag('--json');

const run = async () => {
  const result = createResult({ distDir, thresholds });
  const metrics = await collectMetrics({ distDir, maxCoverKb: thresholds.maxCoverKb });

  applyThresholdChecks({ result, metrics, thresholds, distDir });
  result.stats = metrics.stats;
  printResult({ result, stats: result.stats, distDir, jsonOutput });

  if (!warnOnly && result.failures.length > 0) {
    process.exit(1);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
