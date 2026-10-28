import encode, { init } from '@jsquash/webp/encode.js';
import normalURL from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import simdURL from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';
let ready;
self.onmessage = async ({ data }) => {
  try {
    ready ||= init(null, { locateFile: name => name.includes('simd') ? simdURL : normalURL });
    await ready;
    const result = await encode(data.image, { quality: data.quality, alpha_quality: 100, method: 4 });
    self.postMessage({ result }, [result]);
  } catch (error) { self.postMessage({ error: error.message || 'WebP 변환 실패' }); }
};
