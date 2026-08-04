export type ProcessedImage = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  blurScore: number | null;
  brightnessScore: number | null;
  exifLat: number | null;
  exifLng: number | null;
  exifCapturedAt: string | null;
  qualityReasons: string[];
  sha256: string;
};

const MAX_EDGE = 1600;
const MIN_EDGE = 640;
const CEILING = 1_048_576;
const BLUR_THRESHOLD = 100;

/* ---------------- EXIF (JPEG APP1) ---------------- */

type Exif = { lat: number | null; lng: number | null; capturedAt: string | null };

function readExif(buffer: ArrayBuffer): Exif {
  const empty: Exif = { lat: null, lng: null, capturedAt: null };
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return empty;

  let offset = 2;
  let tiffStart = -1;
  while (offset + 4 < view.byteLength) {
    if (view.getUint16(offset) !== 0xffe1) {
      const size = view.getUint16(offset + 2);
      offset += 2 + size;
      continue;
    }
    tiffStart = offset + 10;
    break;
  }
  if (tiffStart < 0 || tiffStart + 8 > view.byteLength) return empty;

  const little = view.getUint16(tiffStart) === 0x4949;
  const u16 = (p: number) => view.getUint16(p, little);
  const u32 = (p: number) => view.getUint32(p, little);

  const readIfd = (start: number): Map<number, { type: number; count: number; valueOffset: number }> => {
    const entries = new Map<number, { type: number; count: number; valueOffset: number }>();
    if (start + 2 > view.byteLength) return entries;
    const count = u16(start);
    for (let i = 0; i < count; i += 1) {
      const entry = start + 2 + i * 12;
      if (entry + 12 > view.byteLength) break;
      entries.set(u16(entry), { type: u16(entry + 2), count: u32(entry + 4), valueOffset: entry + 8 });
    }
    return entries;
  };

  const rational = (pointer: number) => {
    const numerator = u32(pointer);
    const denominator = u32(pointer + 4);
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const dms = (pointer: number) =>
    rational(pointer) + rational(pointer + 8) / 60 + rational(pointer + 16) / 3600;

  try {
    const ifd0 = readIfd(tiffStart + u32(tiffStart + 4));
    let capturedAt: string | null = null;

    const exifPointer = ifd0.get(0x8769);
    if (exifPointer) {
      const exifIfd = readIfd(tiffStart + u32(exifPointer.valueOffset));
      const dateTag = exifIfd.get(0x9003) ?? exifIfd.get(0x9004);
      if (dateTag) {
        const start = tiffStart + u32(dateTag.valueOffset);
        let text = "";
        for (let i = 0; i < 19 && start + i < view.byteLength; i += 1) {
          text += String.fromCharCode(view.getUint8(start + i));
        }
        const match = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
        if (match) capturedAt = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
      }
    }

    const gpsPointer = ifd0.get(0x8825);
    if (!gpsPointer) return { lat: null, lng: null, capturedAt };

    const gps = readIfd(tiffStart + u32(gpsPointer.valueOffset));
    const latTag = gps.get(0x0002);
    const lngTag = gps.get(0x0004);
    if (!latTag || !lngTag) return { lat: null, lng: null, capturedAt };

    let lat = dms(tiffStart + u32(latTag.valueOffset));
    let lng = dms(tiffStart + u32(lngTag.valueOffset));
    const latRef = gps.get(0x0001);
    const lngRef = gps.get(0x0003);
    if (latRef && String.fromCharCode(view.getUint8(latRef.valueOffset)) === "S") lat = -lat;
    if (lngRef && String.fromCharCode(view.getUint8(lngRef.valueOffset)) === "W") lng = -lng;

    return { lat, lng, capturedAt };
  } catch {
    return empty;
  }
}

/* ---------------- quality scores ---------------- */

function scores(canvas: HTMLCanvasElement): { blur: number; brightness: number } {
  const size = 240;
  const small = document.createElement("canvas");
  small.width = size;
  small.height = Math.max(1, Math.round((canvas.height / canvas.width) * size));
  const ctx = small.getContext("2d");
  if (!ctx) return { blur: 0, brightness: 0.5 };
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const { data } = ctx.getImageData(0, 0, small.width, small.height);

  const gray = new Float32Array(small.width * small.height);
  let sum = 0;
  for (let i = 0; i < gray.length; i += 1) {
    const value =
      0.299 * (data[i * 4] ?? 0) + 0.587 * (data[i * 4 + 1] ?? 0) + 0.114 * (data[i * 4 + 2] ?? 0);
    gray[i] = value;
    sum += value;
  }
  const brightness = sum / gray.length / 255;

  // Laplacian variance
  const laplacian: number[] = [];
  for (let y = 1; y < small.height - 1; y += 1) {
    for (let x = 1; x < small.width - 1; x += 1) {
      const idx = y * small.width + x;
      const value =
        4 * (gray[idx] ?? 0) -
        (gray[idx - 1] ?? 0) -
        (gray[idx + 1] ?? 0) -
        (gray[idx - small.width] ?? 0) -
        (gray[idx + small.width] ?? 0);
      laplacian.push(value);
    }
  }
  const mean = laplacian.reduce((a, b) => a + b, 0) / (laplacian.length || 1);
  const variance = laplacian.reduce((a, b) => a + (b - mean) ** 2, 0) / (laplacian.length || 1);

  return { blur: variance, brightness };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function processImage(file: File): Promise<ProcessedImage | { error: string }> {
  if (file.size > 12 * 1024 * 1024) return { error: "warn.small" };

  const buffer = await file.arrayBuffer();
  const exif = readExif(buffer);

  const bitmap = await createImageBitmap(new Blob([buffer])).catch(() => null);
  if (!bitmap) return { error: "error.generic" };

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return { error: "error.generic" };
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  if (Math.max(canvas.width, canvas.height) < MIN_EDGE) return { error: "warn.small" };

  let quality = 0.8;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length * 0.75 > CEILING && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length * 0.75 > CEILING) return { error: "error.generic" };

  const { blur, brightness } = scores(canvas);
  const reasons: string[] = [];
  if (blur < BLUR_THRESHOLD) reasons.push("too_blurry");
  if (brightness < 0.12 || brightness > 0.92) reasons.push("bad_exposure");
  if (exif.capturedAt && Date.now() - new Date(exif.capturedAt).getTime() > 48 * 3_600_000)
    reasons.push("stale_capture_time");
  const ratio = canvas.width / canvas.height;
  if (ratio > 0.44 && ratio < 0.52) reasons.push("possible_screenshot");

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    bytes: Math.round(dataUrl.length * 0.75),
    blurScore: Math.round(blur * 100) / 100,
    brightnessScore: Math.round(brightness * 1000) / 1000,
    exifLat: exif.lat,
    exifLng: exif.lng,
    exifCapturedAt: exif.capturedAt,
    qualityReasons: reasons,
    sha256: await sha256Hex(dataUrl),
  };
}

export function warningKeyFor(reasons: string[]): string | null {
  if (reasons.includes("too_blurry")) return "warn.blurry";
  if (reasons.includes("bad_exposure")) return "warn.dark";
  return null;
}
