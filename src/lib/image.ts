/** Shrink a photo in the browser before upload (faster on mobile data), honouring EXIF rotation. */
export async function prepareImage(file: File): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error('Please choose a photo (JPEG, PNG or WebP).');
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); }
  catch { throw new Error('This image could not be opened. Try a JPEG or PNG photo.'); }
  const max = 1800;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  if (Math.min(w, h) < 200) throw new Error(`The photo is too small (${w}×${h}). Use a photo at least 200 px on each side.`);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the photo.'))), 'image/jpeg', 0.88));
  const small = document.createElement('canvas');
  const s = Math.min(1, 640 / Math.max(w, h)); small.width = Math.round(w * s); small.height = Math.round(h * s);
  small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height);
  return { blob, dataUrl: small.toDataURL('image/jpeg', 0.8), width: w, height: h };
}
