import fs from "fs";
import path from "path";
import zlib from "zlib";

const sourceDir = path.resolve(process.argv[2]);
const outputZip = path.resolve(process.argv[3]);
const packageRootName = process.argv[4] || path.basename(sourceDir);

if (!sourceDir || !outputZip) {
  throw new Error("Usage: node tools/create-mac-zip.mjs <sourceDir> <outputZip> [packageRootName]");
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function collectFiles(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = path.join(base, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full, rel));
    else if (entry.isFile()) files.push({ rel, full });
  }
  return files;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of collectFiles(sourceDir)) {
  const rel = `${packageRootName}/${file.rel.replaceAll(path.sep, "/")}`;
  const name = Buffer.from(rel, "utf8");
  const data = fs.readFileSync(file.full);
  const compressed = zlib.deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const { dosDate, dosTime } = dosDateTime(fs.statSync(file.full).mtime);
  const isCommand = rel.endsWith(".command");
  const unixMode = isCommand ? 0o100755 : 0o100644;
  const externalAttributes = (unixMode << 16) >>> 0;

  const localHeader = Buffer.concat([
    writeUInt32(0x04034b50),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(8),
    writeUInt16(dosTime),
    writeUInt16(dosDate),
    writeUInt32(crc),
    writeUInt32(compressed.length),
    writeUInt32(data.length),
    writeUInt16(name.length),
    writeUInt16(0),
    name,
  ]);

  localParts.push(localHeader, compressed);

  const centralHeader = Buffer.concat([
    writeUInt32(0x02014b50),
    writeUInt16(0x031e),
    writeUInt16(20),
    writeUInt16(0x0800),
    writeUInt16(8),
    writeUInt16(dosTime),
    writeUInt16(dosDate),
    writeUInt32(crc),
    writeUInt32(compressed.length),
    writeUInt32(data.length),
    writeUInt16(name.length),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt32(externalAttributes),
    writeUInt32(offset),
    name,
  ]);

  centralParts.push(centralHeader);
  offset += localHeader.length + compressed.length;
}

const centralDirectory = Buffer.concat(centralParts);
const endRecord = Buffer.concat([
  writeUInt32(0x06054b50),
  writeUInt16(0),
  writeUInt16(0),
  writeUInt16(centralParts.length),
  writeUInt16(centralParts.length),
  writeUInt32(centralDirectory.length),
  writeUInt32(offset),
  writeUInt16(0),
]);

fs.mkdirSync(path.dirname(outputZip), { recursive: true });
fs.writeFileSync(outputZip, Buffer.concat([...localParts, centralDirectory, endRecord]));
