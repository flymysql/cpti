#!/usr/bin/env node
/**
 * Parse docs/avatar-prompts-pixel-full.md and call Volcengine Ark
 * POST {base}/images/generations (OpenAI-compatible) to generate images.
 *
 * Required: ARK_API_KEY
 * Optional: ARK_API_BASE, ARK_IMAGE_MODEL, ARK_IMAGE_SIZE, delay, limit, dry-run
 *
 * Usage:
 *   ARK_API_KEY=sk-... node scripts/generate-avatars-ark.mjs --dry-run
 *   ARK_API_KEY=sk-... node scripts/generate-avatars-ark.mjs --limit 2
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_MD = path.join(ROOT, 'docs', 'avatar-prompts-pixel-full.md');
const DEFAULT_OUT = path.join(ROOT, 'generated-avatars');

function parseArgs(argv) {
  const opts = {
    md: DEFAULT_MD,
    outDir: DEFAULT_OUT,
    dryRun: false,
    limit: 0,
    delayMs: 2500,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--limit') opts.limit = Number(argv[++i] || 0) || 0;
    else if (a === '--delay-ms') opts.delayMs = Number(argv[++i] || 0) || 2500;
    else if (a === '--out-dir') opts.outDir = path.resolve(argv[++i] || '');
    else if (a === '--md') opts.md = path.resolve(argv[++i] || '');
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/generate-avatars-ark.mjs [options]
  --md PATH       Markdown with fenced prompts (default: docs/avatar-prompts-pixel-full.md)
  --out-dir DIR   Output directory (default: generated-avatars)
  --dry-run       Parse only, no HTTP
  --limit N       Process at most N jobs
  --delay-ms MS   Pause between API calls (default: 2500)
Env:
  ARK_API_KEY       Required unless --dry-run
  ARK_API_BASE      Default https://ark.cn-beijing.volces.com/api/v3
  ARK_IMAGE_MODEL   Default doubao-seedream-5-0-260128
  ARK_IMAGE_SIZE    Default 1920x1920 (Seedream 5 requires ≥3,686,400 px; use 1024x1024 only if your model accepts it)`);
      process.exit(0);
    }
  }
  return opts;
}

/**
 * @returns {{ slug: string, variant: string, prompt: string }[]}
 */
export function parseAvatarMarkdown(md) {
  const jobs = [];
  // CRLF (\r\n) breaks split(/\n## /) and ```\n fences; normalize before parsing.
  const text = String(md || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const parts = text.split(/\n## /).slice(1);

  for (const part of parts) {
    const nl = part.indexOf('\n');
    if (nl === -1) continue;
    const headline = part.slice(0, nl).trim();
    const body = part.slice(nl + 1);

    const idMatch = headline.match(/^([a-z0-9]+)\s/i);
    if (!idMatch) continue;
    const slug = idMatch[1];

    const subBlocks = [
      ...body.matchAll(/\n###\s*(男性向|女性向)\s*\n+\s*```\s*\n([\s\S]*?)```/g),
    ];
    if (subBlocks.length) {
      for (const m of subBlocks) {
        const variant = m[1] === '男性向' ? 'male' : 'female';
        jobs.push({ slug, variant, prompt: m[2].trim() });
      }
      continue;
    }

    const one = body.match(/```\s*\n([\s\S]*?)```/);
    if (one) {
      jobs.push({ slug, variant: 'default', prompt: one[1].trim() });
    }
  }

  return jobs.filter((j) => j.prompt && j.slug !== '使用说明');
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function generateOne({
  apiKey,
  baseUrl,
  model,
  size,
  prompt,
}) {
  const url = `${baseUrl.replace(/\/$/, '')}/images/generations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      response_format: 'url',
      watermark: false,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || text.slice(0, 400);
    throw new Error(`API ${res.status}: ${msg}`);
  }
  const item = json?.data?.[0];
  const imageUrl = item?.url;
  if (!imageUrl) throw new Error(`No image URL in response: ${JSON.stringify(json).slice(0, 500)}`);
  return imageUrl;
}

function fileNameForJob(job) {
  if (job.variant === 'default') return `${job.slug}.png`;
  return `${job.slug}-${job.variant}.png`;
}

async function main() {
  const opts = parseArgs(process.argv);
  const apiKey = process.env.ARK_API_KEY || '';
  const baseUrl = process.env.ARK_API_BASE || 'https://ark.cn-beijing.volces.com/api/v3';
  const model = process.env.ARK_IMAGE_MODEL || 'doubao-seedream-5-0-260128';
  const size = process.env.ARK_IMAGE_SIZE || '1920x1920';

  if (!fs.existsSync(opts.md)) {
    console.error(`Markdown not found: ${opts.md}`);
    process.exit(1);
  }
  const md = fs.readFileSync(opts.md, 'utf8');
  let jobs = parseAvatarMarkdown(md);

  if (opts.limit > 0) jobs = jobs.slice(0, opts.limit);

  console.log(`Parsed ${jobs.length} generation job(s). Model=${model} size=${size}`);

  if (opts.dryRun) {
    jobs.forEach((j, i) => console.log(`${i + 1}. ${j.slug} / ${j.variant} (${j.prompt.length} chars)`));
    return;
  }

  if (!apiKey) {
    console.error('Missing ARK_API_KEY. Export it or use --dry-run.');
    process.exit(1);
  }

  fs.mkdirSync(opts.outDir, { recursive: true });

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i];
    const dest = path.join(opts.outDir, fileNameForJob(job));
    process.stdout.write(`[${i + 1}/${jobs.length}] ${job.slug} (${job.variant}) … `);
    try {
      const imageUrl = await generateOne({ apiKey, baseUrl, model, size, prompt: job.prompt });
      await downloadToFile(imageUrl, dest);
      console.log(`ok → ${path.relative(ROOT, dest)}`);
    } catch (e) {
      console.log(`fail: ${e.message || e}`);
    }
    if (i < jobs.length - 1 && opts.delayMs > 0) await sleep(opts.delayMs);
  }
}

const isCli =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
