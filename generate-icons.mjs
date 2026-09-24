import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal pure-Node PNG generator using zlib
function createPng(width, height, drawFn) {
  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowBytes = width * 4;
  const rawData = Buffer.alloc(height * (rowBytes + 1));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowBytes + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(12 + length);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = calculateCrc32(buffer.subarray(4, 8 + length));
  buffer.writeInt32BE(crc, 8 + length);
  return buffer;
}

function calculateCrc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (crc ^ (byte >> j)) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
    }
  }
  return crc ^ 0xffffffff;
}

// Draw Dots Logo (Rounded white background with 4 colorful dots like original icon)
function drawDotsIcon(x, y, w, h) {
  // Background: Soft cream #F8F9FA
  let r = 248, g = 249, b = 250, a = 255;

  const hexToRgb = (hex) => {
    const num = parseInt(hex.replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const dots = [
    { cx: w * 0.35, cy: h * 0.35, color: hexToRgb('#EA4335') }, // Red
    { cx: w * 0.65, cy: h * 0.35, color: hexToRgb('#0091EA') }, // Sky Blue
    { cx: w * 0.35, cy: h * 0.65, color: hexToRgb('#FBBC05') }, // Yellow
    { cx: w * 0.65, cy: h * 0.65, color: hexToRgb('#2E7D32') }  // Forest Green
  ];

  const dotRadius = w * 0.12;

  for (const dot of dots) {
    const dist = Math.hypot(x - dot.cx, y - dot.cy);
    if (dist <= dotRadius) {
      // Smooth edge antialiasing
      const edge = dotRadius - dist;
      if (edge < 1) {
        const factor = Math.max(0, edge);
        return [
          Math.round(dot.color[0] * factor + r * (1 - factor)),
          Math.round(dot.color[1] * factor + g * (1 - factor)),
          Math.round(dot.color[2] * factor + b * (1 - factor)),
          255
        ];
      }
      return [...dot.color, 255];
    }
  }

  return [r, g, b, a];
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), createPng(192, 192, drawDotsIcon));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), createPng(512, 512, drawDotsIcon));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPng(180, 180, drawDotsIcon));

console.log('Icons generated successfully!');
