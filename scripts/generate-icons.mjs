/**
 * Generates pixel-art PNG extension icons without any external dependencies.
 * Uses Node.js built-in `zlib` for PNG compression.
 */
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Minimal PNG encoder ─────────────────────────────────────────────────────

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function makePng(w, h, rgba) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      row[1 + x * 4] = rgba[i];
      row[1 + x * 4 + 1] = rgba[i + 1];
      row[1 + x * 4 + 2] = rgba[i + 2];
      row[1 + x * 4 + 3] = rgba[i + 3];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Pixel-art design (16×16 grid) ──────────────────────────────────────────
// Infinite Void — Domain brand icon, concentric circle eye
// 0 = BG (transparent)  1 = OUTER (electric cyan)  2 = IRIS (mid cyan)  3 = INNER (dark teal)
// 4 = VOID (pure black pupil)        5 = SHIMMER (lavender highlight)
const DESIGN = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // row  0 — bg
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // row  1 — outer ring top
  [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0], // row  2 — iris
  [0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0], // row  3 — iris
  [0, 0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 0, 0], // row  4 — inner dark
  [0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 0], // row  5 — inner dark
  [0, 1, 2, 2, 3, 3, 5, 4, 4, 4, 3, 3, 2, 2, 1, 0], // row  6 — void + shimmer
  [0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 2, 1, 0], // row  7 — void center
  [0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 2, 1, 0], // row  8 — void center
  [0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 3, 3, 2, 2, 1, 0], // row  9 — void
  [0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 1, 0], // row 10 — inner dark
  [0, 0, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 0, 0], // row 11 — inner dark
  [0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0], // row 12 — iris
  [0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 1, 0, 0, 0, 0], // row 13 — iris
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // row 14 — outer ring bottom
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // row 15 — bg
];

// Colours (RGBA) — electric cyan palette, transparent bg
const BG = [0, 0, 0, 0]; // transparent
const OUTER = [34, 211, 238, 255]; // electric cyan    #22d3ee
const IRIS = [8, 145, 178, 255]; // medium cyan      #0891b2
const INNER = [14, 32, 55, 255]; // dark teal        #0e2037
const VOID = [4, 8, 18, 255]; // near-black pupil
const SHIMMER = [207, 250, 254, 255]; // ice cyan reflect #cffafe

const PALETTE = [BG, OUTER, IRIS, INNER, VOID, SHIMMER];

function buildPixels(targetSize) {
  const base = DESIGN.length; // 16
  const pixels = new Uint8Array(targetSize * targetSize * 4);

  for (let py = 0; py < targetSize; py++) {
    for (let px = 0; px < targetSize; px++) {
      const dx = Math.floor((px / targetSize) * base);
      const dy = Math.floor((py / targetSize) * base);
      const val = DESIGN[dy]?.[dx] ?? 0;
      const [r, g, b, a] = PALETTE[val];
      const idx = (py * targetSize + px) * 4;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = a;
    }
  }
  return pixels;
}

// ── Generate icons ─────────────────────────────────────────────────────────

const sizes = [16, 32, 48, 96, 128];
const outDirs = [
  resolve(__dirname, "../public/icon"),
  resolve(__dirname, "../tab-limit-extension/icon"),
];

for (const dir of outDirs) {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  for (const size of sizes) {
    const pixels = buildPixels(size);
    const png = makePng(size, size, pixels);
    const outPath = resolve(dir, `${size}.png`);
    writeFileSync(outPath, png);
    console.log(`✓ ${size}px → ${outPath}`);
  }
}

console.log("\n🎨 Pixel-art icons generated!");
