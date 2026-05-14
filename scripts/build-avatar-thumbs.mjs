#!/usr/bin/env node
/**
 * Resize generated-avatars/*.png into generated-avatars/thumbs/ (square WebP + PNG fallback).
 * Default: 160px JPEG-quality WebP not used — output PNG @ 160 for broad browser support.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'generated-avatars');
const OUT = path.join(ROOT, 'generated-avatars', 'thumbs');
const SIZE = Number(process.env.AVATAR_THUMB_SIZE || 160);

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.png'));
  for (const name of files) {
    const inPath = path.join(SRC, name);
    const st = fs.statSync(inPath);
    if (!st.isFile()) continue;
    const outPath = path.join(OUT, name);
    await sharp(inPath)
      .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(outPath.replace(ROOT + path.sep, ''));
  }
  console.log(`Done: ${files.length} thumb(s) @ ${SIZE}px`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
