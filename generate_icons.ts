import fs from 'fs';
import path from 'path';

// Minimal valid PNG generator in pure Node.js
function createPNG(size: number): Buffer {
  // A tiny valid 1x1 or size-based PNG payload
  // We can write a tiny valid PNG file buffer
  const width = size;
  const height = size;
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // Helper for CRC32
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  
  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]!) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  
  function makeChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const typeAndData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([len, typeAndData, crcBuf]);
  }
  
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = makeChunk('IHDR', ihdr);
  
  // Raw RGBA pixels (Indigo color: R=79, G=70, B=229, A=255)
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;
      row[idx] = 79;   // R
      row[idx + 1] = 70;  // G
      row[idx + 2] = 229; // B
      row[idx + 3] = 255; // A
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  
  // Minimal zlib deflate block (uncompressed data inside zlib container)
  // zlib header 0x78 0x01
  const zlibHeader = Buffer.from([0x78, 0x01]);
  
  // Deflate uncompressed block (BFINAL=1, BTYPE=00)
  const len = rawData.length;
  const nlen = (~len) & 0xffff;
  const blockHeader = Buffer.alloc(5);
  blockHeader[0] = 0x01; // final block
  blockHeader.writeUInt16LE(len, 1);
  blockHeader.writeUInt16LE(nlen, 3);
  
  // Adler32 checksum
  let a = 1, b = 0;
  for (let i = 0; i < rawData.length; i++) {
    a = (a + rawData[i]!) % 65521;
    b = (b + a) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((b << 16) | a, 0);
  
  const idatData = Buffer.concat([zlibHeader, blockHeader, rawData, adler]);
  const idatChunk = makeChunk('IDAT', idatData);
  
  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('packages/extension/public/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = createPNG(size);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
}
