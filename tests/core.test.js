import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, crop, eventURL, normalizeEvent, DEFAULT_EVENT, brandingModel, BRAND_KEYS, templateGeometry, compatibleFrame } from '../core.js';
test('모든 컷 수에서 사진이 겹치거나 캔버스 밖으로 나가지 않는다', () => {
  for (const count of [2, 4, 6, 8]) for (const position of ['top', 'bottom']) {
    const g = layout(count, { ...DEFAULT_EVENT, school: '모먼트고등학교', logoPosition: position });
    assert.equal(g.slots.length, count);
    for (const s of g.slots) { assert(s.x >= 0 && s.y >= 0); assert(s.x + s.w <= g.width); assert(s.y + s.h < g.height); }
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) { const a = g.slots[i], b = g.slots[j]; assert(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y); }
    if (position === 'top') assert(g.slots[0].y >= g.brandY + g.brandH);
    else assert(g.brandY >= g.slots.at(-1).y + g.photoH);
    assert(g.footerY + g.footerH <= g.height);
  }
});
test('표시 설정을 모두 끄면 정보 영역을 비우고 상·하단 및 자유 배치를 따로 유지한다', () => {
  const event = { ...DEFAULT_EVENT, title: '축제', school: '학교', schedule: '오늘', logo: 'https://example.com/logo.png', branding: Object.fromEntries(BRAND_KEYS.map(key => [key, { visible: false }])) };
  const empty = layout(4, event); assert.equal(brandingModel(event).hasContent, false); assert.deepEqual(empty.slots, layout(4).slots);
  event.branding = { logo: { position: 'top' }, school: { position: 'bottom' }, title: { position: 'free' }, schedule: { visible: false } };
  const mixed = layout(8, event); assert(mixed.brandAreas.top.h > 0); assert(mixed.brandAreas.bottom.h > 0);
  assert.equal(brandingModel(event).title.position, 'free');
  const normalized = normalizeEvent({ ...event, branding: { school: { x: 999, y: -5, size: 2, color: 'bad' } } });
  assert.equal(normalized.branding.school.x, .95); assert.equal(normalized.branding.school.y, 0); assert.equal(normalized.branding.school.size, .10); assert.equal(normalized.branding.school.color, '');
});
test('세로·가로 사진의 확대 및 이동은 원본 경계를 넘지 않는다', () => {
  for (const [w, h] of [[3000, 1000], [1000, 3000], [1500, 1500]]) for (const z of [1, 1.5, 2.5]) for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) {
    const c = crop(w, h, 600, 450, z, x, y); assert(c.x >= 0 && c.y >= 0); assert(c.x + c.w <= w + .001); assert(c.y + c.h <= h + .001); assert(Math.abs(c.w / c.h - 600 / 450) < .00001);
  }
});
test('QR은 관리 화면이 아닌 행사 URL을 가리킨다', () => {
  assert.equal(eventURL('https://school.web.app/admin.html?old=1#top', 'spring-2026'), 'https://school.web.app/booth.html?event=spring-2026');
  assert.equal(eventURL('https://example.com/booth/index.html', 'abc'), 'https://example.com/booth/booth.html?event=abc');
  assert.throws(() => eventURL('javascript:alert(1)', 'x'));
});
test('외부 행사 데이터에서 실행 가능한 URL과 잘못된 색상을 제거한다', () => {
  const event = normalizeEvent({ title: '축제', logo: 'javascript:alert(1)', frames: [{ id: 'a', bg: 'red;display:none', ink: '#ffffff', overlay: 'http://bad.test/x' }], stickers: [{ text: '♡', url: 'javascript:x' }] });
  assert.equal(event.logo, ''); assert.equal(event.frames[0].bg, '#fffdf6'); assert.equal(event.frames[0].overlay, ''); assert.equal(event.stickers[0].url, '');
});
test('업로드 프레임의 제작 규격과 사진 칸은 정보 표시 설정이 바뀌어도 유지된다', () => {
  for (const n of [2,4,6,8]) {
    const original = templateGeometry(n);
    const changed = layout(n, { ...DEFAULT_EVENT, title: '가을축제', school: '우리학교', branding: { height: .6, school: { position: 'free', x: .2, y: .4 } } }, { frame: { layoutCount: n }, caption: true });
    assert.equal(changed.width, original.width); assert.equal(changed.height, original.height); assert.deepEqual(changed.slots, original.slots);
    assert.equal(compatibleFrame({ layoutCount: n }, n), true); assert.equal(compatibleFrame({ layoutCount: n }, n === 4 ? 2 : 4), false);
  }
  for (const count of [2,4,6,8]) for (const orientation of ['portrait','landscape']) { const g=templateGeometry(count,orientation); assert.equal(g.width,orientation==='portrait'?1200:1800); assert.equal(g.height,orientation==='portrait'?1800:1200); assert.equal(g.slots.length,count); assert(g.slots.every(s=>s.w>0&&s.h>0&&s.y+s.h<g.height)); }
});
