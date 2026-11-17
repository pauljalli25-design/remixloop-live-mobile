import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

function createPNG(width, height, drawFn) {
  // RGBA buffer: 4 bytes per pixel + 1 filter byte (0) per scanline
  const rowLength = width * 4;
  const rawData = Buffer.alloc((rowLength + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowLength + 1);
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function drawRemixIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background dark cyber gradient
  let r = Math.floor(11 + 10 * (1 - ny));
  let g = Math.floor(15 + 15 * (1 - ny));
  let b = Math.floor(25 + 20 * (1 - ny));
  let a = 255;

  // Center pad coordinates
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.hypot(nx - cx, ny - cy);

  // Outer glowing ring
  if (dist > 0.44 && dist < 0.47) {
    return [0, 242, 254, 255]; // Cyan neon glow ring
  }

  // 4 Pads
  const inPad1 = nx > 0.18 && nx < 0.46 && ny > 0.18 && ny < 0.46; // Cyan Loop
  const inPad2 = nx > 0.54 && nx < 0.82 && ny > 0.18 && ny < 0.46; // Pink Synth
  const inPad3 = nx > 0.18 && nx < 0.46 && ny > 0.54 && ny < 0.82; // Amber Bit Music
  const inPad4 = nx > 0.54 && nx < 0.82 && ny > 0.54 && ny < 0.82; // Green Bass

  if (inPad1) {
    return [0, 242, 254, 255]; // Cyan
  }
  if (inPad2) {
    return [255, 0, 127, 255]; // Pink / Magenta
  }
  if (inPad3) {
    return [245, 158, 11, 255]; // Amber / Bit Music Fill
  }
  if (inPad4) {
    return [16, 185, 129, 255]; // Emerald Green
  }

  // Waveform bars in center
  if (Math.abs(ny - 0.5) < 0.05 && Math.abs(nx - 0.5) < 0.15) {
    return [255, 255, 255, 255];
  }

  return [r, g, b, a];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, drawRemixIcon));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, drawRemixIcon));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, drawRemixIcon));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, drawRemixIcon));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, drawRemixIcon));

console.log('Successfully generated all PWA icons!');
