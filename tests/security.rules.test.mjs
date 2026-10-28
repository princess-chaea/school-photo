import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { normalizeEvent, DEFAULT_EVENT } from '../core.js';
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-school-photo', firestore: { rules: await readFile('firestore.rules', 'utf8') }, storage: { rules: await readFile('storage.rules', 'utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.clearStorage(); });
const config = (published = false) => ({ ownerId: 'teacher-a', published, title: '가을 축제', school: '우리학교', schedule: '2026. 10. 30', logo: '', logoPosition: 'top', frames: [{ id: 'cream', name: '크림', bg: '#fffdf6', ink: '#34372f' }], stickers: [], updatedAt: serverTimestamp() });
test('소유자만 행사 생성·수정·삭제, 소유권 탈취 차단', async () => {
  const a = env.authenticatedContext('teacher-a').firestore(), b = env.authenticatedContext('teacher-b').firestore();
  await assertSucceeds(setDoc(doc(a, 'events', 'test'), config()));
  await assertFails(setDoc(doc(b, 'events', 'test'), { ...config(), ownerId: 'teacher-b' }));
  await assertFails(setDoc(doc(a, 'events', 'test'), { ...config(), ownerId: 'teacher-b' }));
  await assertFails(deleteDoc(doc(b, 'events', 'test'))); await assertSucceeds(deleteDoc(doc(a, 'events', 'test')));
});
test('익명 참가자는 게시 행사만 단건 읽기, 목록·초안·쓰기는 차단', async () => {
  const a = env.authenticatedContext('teacher-a').firestore(), guest = env.unauthenticatedContext().firestore();
  await setDoc(doc(a, 'events', 'live'), config(true)); await setDoc(doc(a, 'events', 'draft'), config(false));
  await assertSucceeds(getDoc(doc(guest, 'events', 'live'))); await assertFails(getDoc(doc(guest, 'events', 'draft')));
  await assertFails(getDocs(collection(guest, 'events'))); await assertFails(setDoc(doc(guest, 'events', 'new'), config(true)));
  await setDoc(doc(a, 'events', 'live'), config(false)); await assertFails(getDoc(doc(guest, 'events', 'live')));
});
test('운영자의 내 행사 쿼리와 보관함 격리', async () => {
  const a = env.authenticatedContext('teacher-a').firestore(), b = env.authenticatedContext('teacher-b').firestore();
  await setDoc(doc(a, 'events', 'test'), config());
  const own = await assertSucceeds(getDocs(query(collection(a, 'events'), where('ownerId', '==', 'teacher-a')))); assert.equal(own.size, 1);
  await assertFails(getDoc(doc(b, 'events', 'test')));
  await assertSucceeds(setDoc(doc(a, 'users', 'teacher-a', 'assets', 'palette'), { name: '라일락', kind: 'palette', bg: '#e4d6ec', ink: '#51415d' }));
  await assertFails(getDocs(collection(b, 'users', 'teacher-a', 'assets')));
});
test('행사 임의 필드와 사진 전용 컬렉션 저장 차단', async () => {
  const a = env.authenticatedContext('teacher-a').firestore();
  await assertFails(setDoc(doc(a, 'events', 'bad'), { ...config(), photos: ['image'] }));
  await assertFails(setDoc(doc(a, 'photos', 'photo'), { ownerId: 'teacher-a', data: 'photo' }));
  await assertFails(setDoc(doc(a, 'events', 'empty'), { ...config(), frames: [] }));
});
test('학교 기본 설정도 계정별로 분리된다', async () => {
  const a = env.authenticatedContext('teacher-a').firestore(), b = env.authenticatedContext('teacher-b').firestore(), guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(setDoc(doc(a, 'users', 'teacher-a', 'profile', 'school'), { school: '우리학교', logo: '', updatedAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(a, 'users', 'teacher-a', 'profile', 'school')));
  await assertFails(getDoc(doc(b, 'users', 'teacher-a', 'profile', 'school'))); await assertFails(getDoc(doc(guest, 'users', 'teacher-a', 'profile', 'school')));
});
test('행사별 정보 표시·위치·크기 설정은 저장하고 비정상 설정은 차단한다', async () => {
  const a = env.authenticatedContext('teacher-a').firestore();
  const normalized = normalizeEvent({ ...DEFAULT_EVENT, title: '축제', school: '학교', branding: { school: { position: 'free', x: .3, y: .4, size: .045 }, schedule: { visible: false } } });
  await assertSucceeds(setDoc(doc(a, 'events', 'layout'), { ...normalized, ownerId: 'teacher-a', published: true, updatedAt: serverTimestamp() }));
  const bad = structuredClone(normalized); bad.branding.school.x = 100;
  await assertFails(setDoc(doc(a, 'events', 'invalid'), { ...bad, ownerId: 'teacher-a', published: false, updatedAt: serverTimestamp() }));
});
test('디자인 이미지 업로드는 본인 경로와 허용 형식·용량만, 익명 업로드 차단', async () => {
  const a = env.authenticatedContext('teacher-a').storage(), b = env.authenticatedContext('teacher-b').storage(), guest = env.unauthenticatedContext().storage();
  await assertSucceeds(uploadBytes(ref(a, 'users/teacher-a/assets/logo'), new Uint8Array([1, 2, 3]), { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(b, 'users/teacher-a/assets/other'), new Uint8Array([1]), { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(guest, 'users/teacher-a/assets/photo'), new Uint8Array([1]), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(a, 'users/teacher-a/assets/html'), new Uint8Array([1]), { contentType: 'text/html' }));
  await assertFails(uploadBytes(ref(a, 'users/teacher-a/assets/large'), new Uint8Array(4 * 1024 * 1024 + 1), { contentType: 'image/webp' }));
  await assertFails(uploadBytes(ref(a, 'photos/test'), new Uint8Array([1]), { contentType: 'image/webp' }));
  await assertFails(getBytes(ref(b, 'users/teacher-a/assets/logo'))); await assertSucceeds(deleteObject(ref(a, 'users/teacher-a/assets/logo')));
});
test('공용 자료는 모두 읽고, 이메일 인증된 지정 운영자만 등록·노출 변경한다', async () => {
  const claims = { email: 'dltjdrms320@gmail.com', email_verified: true };
  const admin = env.authenticatedContext('site-admin', claims).firestore();
  const teacher = env.authenticatedContext('teacher-a', { email: 'teacher@example.com', email_verified: true }).firestore();
  const unverified = env.authenticatedContext('unverified', { email: claims.email, email_verified: false }).firestore();
  const guest = env.unauthenticatedContext().firestore();
  const asset = { name: '공용 스티커', kind: 'sticker', path: 'shared/assets/sticker', url: 'https://example.com/sticker.webp', active: true };
  await assertFails(setDoc(doc(teacher,'sharedAssets','sticker'),asset)); await assertFails(setDoc(doc(unverified,'sharedAssets','sticker'),asset));
  await assertSucceeds(setDoc(doc(admin,'sharedAssets','sticker'),asset)); await assertSucceeds(getDoc(doc(guest,'sharedAssets','sticker')));
  await assertSucceeds(setDoc(doc(admin,'sharedAssets','sticker'),{...asset,active:false}));
  await assertFails(setDoc(doc(teacher,'sharedAssets','sticker'),{...asset,active:true}));
  await assertFails(setDoc(doc(admin,'sharedAssets','sticker'),{...asset,name:'덮어쓰기'}));
});
test('공용 Storage 업로드도 일반 교사와 미인증 운영자를 차단한다', async () => {
  const admin = env.authenticatedContext('site-admin',{ email: 'dltjdrms320@gmail.com', email_verified: true }).storage();
  const teacher = env.authenticatedContext('teacher-a').storage(); const guest = env.unauthenticatedContext().storage();
  await assertSucceeds(uploadBytes(ref(admin,'shared/assets/public'),new Uint8Array([1,2,3]),{contentType:'image/webp'}));
  await assertSucceeds(getBytes(ref(guest,'shared/assets/public')));
  await assertFails(uploadBytes(ref(teacher,'shared/assets/blocked'),new Uint8Array([1]),{contentType:'image/webp'}));
  const unverified = env.authenticatedContext('unverified',{email:'dltjdrms320@gmail.com',email_verified:false}).storage();
  await assertFails(uploadBytes(ref(unverified,'shared/assets/blocked'),new Uint8Array([1]),{contentType:'image/webp'}));
});
