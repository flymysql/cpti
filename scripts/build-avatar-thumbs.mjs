#!/usr/bin/env node
/**
 * Rebuild generated-avatars/thumbs/ from full-size rasters in generated-avatars/.
 * Source: *.webp (preferred) or *.png. Output: WebP thumbs (AVATAR_THUMB_SIZE, default 128).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'generated-avatars');
const OUT = path.join(ROOT, 'generated-avatars', 'thumbs');
const SIZE = Number(process.env.AVATAR_THUMB_SIZE || 128);
const Q = Number(process.env.AVATAR_WEBP_QUALITY_THUMB || 78);

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Missing ${SRC}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => {
    const l = f.toLowerCase();
    return (l.endsWith('.webp') || l.endsWith('.png')) && !fs.statSync(path.join(SRC, f)).isDirectory();
  });
  for (const name of files) {
    const inPath = path.join(SRC, name);
    const st = fs.statSync(inPath);
    if (!st.isFile()) continue;
    const base = name.replace(/\.(png|webp)$/i, '');
    const outPath = path.join(OUT, `${base}.webp`);
    await sharp(inPath)
      .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: Q, effort: 6 })
      .toFile(outPath);
    console.log(outPath.replace(ROOT + path.sep, ''));
  }
  console.log(`Done: ${files.length} thumb(s) @ ${SIZE}px WebP q${Q}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
