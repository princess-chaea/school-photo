import { imageFromURL, templateGeometry } from './core.js';
const MAX_DIMENSION = { logo: 800, sticker: 640, frame: 2400 };
async function encodeFallback(image, quality) {
  const worker = new Worker(new URL('./webp-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('이미지 변환에 시간이 오래 걸려요. 더 작은 파일로 다시 시도해 주세요.')); }, 45000);
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    worker.onmessage = ({ data }) => { finish(); if (data.error) reject(new Error(data.error)); else resolve(new Blob([data.result], { type: 'image/webp' })); };
    worker.onerror = () => { finish(); reject(new Error('WebP 변환을 실행하지 못했어요. 브라우저를 업데이트해 주세요.')); };
    worker.postMessage({ image, quality }, [image.data.buffer]);
  });
}
export async function optimizeDesign(file, kind, { forceWasm = false, layoutCount = 0, orientation = 'portrait', frameFormat='print-4x6', photoSlots, preserveAspect=false, clearPhotoSlots=false } = {}) {
  if (!MAX_DIMENSION[kind]) throw new Error('올바른 디자인 종류를 선택해 주세요.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('20MB 이하 PNG·JPG·WebP 파일을 선택해 주세요.');
  const sourceURL = URL.createObjectURL(file);
  let image;
  try { image = await imageFromURL(sourceURL); } finally { URL.revokeObjectURL(sourceURL); }
  if (!image.width || !image.height || image.width * image.height > 50_000_000) throw new Error('이미지가 너무 커요. 5천만 화소 이하로 줄여 주세요.');
  const template = kind === 'frame' && layoutCount ? templateGeometry(layoutCount, orientation,frameFormat) : null;
  if (template && Math.abs(image.width / image.height / (template.width / template.height) - 1) > .015) throw new Error(`${layoutCount}컷 프레임은 ${template.width} × ${template.height}px 비율로 제작해 주세요. 같은 비율의 고해상도 파일도 사용할 수 있어요.`);
  const scale = Math.min(1, MAX_DIMENSION[kind] / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  if (template && file.type === 'image/jpeg') for (const slot of template.slots) ctx.clearRect(slot.x / template.width * canvas.width, slot.y / template.height * canvas.height, slot.w / template.width * canvas.width, slot.h / template.height * canvas.height);
  let blob = forceWasm ? null : await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
  if (!blob || blob.type !== 'image/webp') blob = await encodeFallback(ctx.getImageData(0, 0, canvas.width, canvas.height), 86);
  // 투명도는 유지하고 사진 EXIF/GPS 등 원본 메타데이터는 전달하지 않습니다.
  if (blob.size >= 4 * 1024 * 1024) blob = await encodeFallback(ctx.getImageData(0, 0, canvas.width, canvas.height), 70);
  if (blob.size >= 4 * 1024 * 1024) throw new Error('변환 후에도 4MB를 넘어요. 이미지 크기를 더 줄여 주세요.');
  return { file: new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' }), metadata: { originalBytes: file.size, optimizedBytes: blob.size, width: canvas.width, height: canvas.height, format: 'webp', ...(kind === 'frame' ? { layoutCount, orientation, frameFormat, ...(preserveAspect ? {preserveAspect,clearPhotoSlots} : {}), ...(photoSlots ? {photoSlots} : {}) } : {}) } };
}
export function formatBytes(n) { return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)}KB` : `${(n / 1024 / 1024).toFixed(2)}MB`; }
