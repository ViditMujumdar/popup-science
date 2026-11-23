/**
 * Validate image bytes by content (magic numbers + header parsing), never by file name.
 * Supports JPEG, PNG and WebP, and reports pixel dimensions.
 */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ImageInfo { mime: ImageMime; width: number; height: number }

export function sniffImage(buf: Uint8Array): ImageInfo | null {
  if (buf.length < 32) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR width/height (big-endian)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (String.fromCharCode(...buf.subarray(12, 16)) !== 'IHDR') return null;
    return { mime: 'image/png', width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // JPEG: FF D8 FF, then walk segments to a SOFn marker
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = (buf[i + 2]! << 8) | buf[i + 3]!;
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const height = (buf[i + 5]! << 8) | buf[i + 6]!;
        const width = (buf[i + 7]! << 8) | buf[i + 8]!;
        return { mime: 'image/jpeg', width, height };
      }
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  // WebP: "RIFF" .... "WEBP" + VP8 / VP8L / VP8X chunk
  if (String.fromCharCode(...buf.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...buf.subarray(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...buf.subarray(12, 16));
    if (chunk === 'VP8X') {
      const w = 1 + (buf[24]! | (buf[25]! << 8) | (buf[26]! << 16));
      const h = 1 + (buf[27]! | (buf[28]! << 8) | (buf[29]! << 16));
      return { mime: 'image/webp', width: w, height: h };
    }
    if (chunk === 'VP8L') {
      if (buf[20] !== 0x2f) return null;
      const b = buf.subarray(21, 25);
      const w = 1 + (b[0]! | ((b[1]! & 0x3f) << 8));
      const h = 1 + ((b[1]! >> 6) | (b[2]! << 2) | ((b[3]! & 0x0f) << 10));
      return { mime: 'image/webp', width: w, height: h };
    }
    if (chunk === 'VP8 ') {
      // keyframe start code 9D 01 2A at offset 23
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
      const w = (buf[26]! | (buf[27]! << 8)) & 0x3fff;
      const h = (buf[28]! | (buf[29]! << 8)) & 0x3fff;
      return { mime: 'image/webp', width: w, height: h };
    }
    return null;
  }
  return null;
}

export function validateImage(buf: Uint8Array, limits: { uploadBytes: number; minDim: number; maxDim: number }):
  { ok: true; info: ImageInfo } | { ok: false; code: string; message: string } {
  if (buf.length === 0) return { ok: false, code: 'empty', message: 'The file is empty.' };
  if (buf.length > limits.uploadBytes) return { ok: false, code: 'too_large', message: `Images must be ${Math.round(limits.uploadBytes / 1048576)} MB or smaller.` };
  const info = sniffImage(buf);
  if (!info) return { ok: false, code: 'bad_type', message: 'Only JPEG, PNG and WebP images are supported. This file does not look like one of those.' };
  if (!info.width || !info.height) return { ok: false, code: 'bad_image', message: 'The image header could not be read.' };
  if (Math.min(info.width, info.height) < limits.minDim) return { ok: false, code: 'too_small', message: `The image is too small (${info.width}×${info.height}). Use a photo at least ${limits.minDim} px on each side so labels are readable.` };
  if (Math.max(info.width, info.height) > limits.maxDim) return { ok: false, code: 'too_big_dims', message: `The image is too large (${info.width}×${info.height}). The maximum is ${limits.maxDim} px per side.` };
  return { ok: true, info };
}

/** Build a data URL only after validating; used for opt-in share images. */
export function parseDataUrlImage(dataUrl: string, maxBytes: number): { ok: true; mime: ImageMime; bytes: Uint8Array } | { ok: false; message: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return { ok: false, message: 'Image must be a base64 JPEG, PNG or WebP data URL.' };
  const bytes = Uint8Array.from(Buffer.from(m[2]!, 'base64'));
  if (bytes.length > maxBytes) return { ok: false, message: 'Shared image is too large.' };
  const info = sniffImage(bytes);
  if (!info || info.mime !== m[1]) return { ok: false, message: 'Shared image content does not match its type.' };
  return { ok: true, mime: info.mime, bytes };
}
