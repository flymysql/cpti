#!/usr/bin/env node
/**
 * Convert generated-avatars/*.png → .webp (smaller cold-load).
 * - Full: square cover resize to AVATAR_FULL_MAX (default 1024), WebP quality AVATAR_WEBP_QUALITY_FULL (default 82).
 * - Thumbs: AVATAR_THUMB_SIZE (default 128), quality AVATAR_WEBP_QUALITY_THUMB (default 78).
 * Writes to a temp dir then replaces files; deletes each processed root PNG and matching thumbs/*.png.
 *
 * Run: npm install && npm run optimize:avatars
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'generated-avatars');
const THUMB_DIR = path.join(SRC_DIR, 'thumbs');
const TMP = path.join(SRC_DIR, '_opt_tmp');

const FULL_MAX = Number(process.env.AVATAR_FULL_MAX || 1024);
const THUMB_SIZE = Number(process.env.AVATAR_THUMB_SIZE || 128);
const Q_FULL = Number(process.env.AVATAR_WEBP_QUALITY_FULL || 82);
const Q_THUMB = Number(process.env.AVATAR_WEBP_QUALITY_THUMB || 78);

async function toWebpSquare(inPath, size, quality, outPath) {
  await sharp(inPath)
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .webp({ quality, effort: 6 })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Missing ${SRC_DIR}`);
    process.exit(1);
  }
  const pngs = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.png'));
  if (!pngs.length) {
    console.error('No root-level .png files in generated-avatars/ (already WebP?).');
    process.exit(0);
  }

  fs.mkdirSync(path.join(TMP, 'thumbs'), { recursive: true });
  fs.mkdirSync(THUMB_DIR, { recursive: true });

  for (const name of pngs) {
    const inPath = path.join(SRC_DIR, name);
    if (!fs.statSync(inPath).isFile()) continue;
    const base = name.replace(/\.png$/i, '');
    const fullOut = path.join(TMP, `${base}.webp`);
    const thumbOut = path.join(TMP, 'thumbs', `${base}.webp`);
    await toWebpSquare(inPath, FULL_MAX, Q_FULL, fullOut);
    await toWebpSquare(inPath, THUMB_SIZE, Q_THUMB, thumbOut);
    console.log(`${base}.webp + thumbs/${base}.webp`);
  }

  for (const name of pngs) {
    const base = name.replace(/\.png$/i, '');
    fs.renameSync(path.join(TMP, `${base}.webp`), path.join(SRC_DIR, `${base}.webp`));
    fs.renameSync(path.join(TMP, 'thumbs', `${base}.webp`), path.join(THUMB_DIR, `${base}.webp`));
    fs.unlinkSync(path.join(SRC_DIR, name));
    const oldThumbPng = path.join(THUMB_DIR, `${base}.png`);
    if (fs.existsSync(oldThumbPng)) fs.unlinkSync(oldThumbPng);
  }

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(
    `Done: ${pngs.length} avatar(s); full ≤${FULL_MAX}px WebP q${Q_FULL}; thumbs ${THUMB_SIZE}px WebP q${Q_THUMB}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
