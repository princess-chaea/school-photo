// 운영자 전용 모듈입니다. 참가자는 public-event.js의 읽기 기능만 사용합니다.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, connectStorageEmulator } from 'firebase/storage';
import { normalizeEvent } from './core.js';

const env = import.meta.env;
export const ADMIN_EMAIL = 'dltjdrms320@gmail.com';
export function isSiteAdmin(user) { return Boolean(user?.emailVerified && user.email === ADMIN_EMAIL); }
export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
let services;
function firebase() {
  if (!configured) throw new Error('Firebase 연결 전입니다. .env 설정 후 다시 빌드해 주세요.');
  if (services) return services;
  const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID });
  const auth = getAuth(app), db = getFirestore(app), storage = getStorage(app);
  if (env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099'); connectFirestoreEmulator(db, '127.0.0.1', 8080); connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  services = { auth, db, storage }; return services;
}
export async function login(redirect = false) {
  const { auth } = firebase(), provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
  return redirect ? signInWithRedirect(auth, provider) : signInWithPopup(auth, provider);
}
export async function redirectResult() { return configured ? getRedirectResult(firebase().auth) : null; }
export function watchUser(fn) { return configured ? onAuthStateChanged(firebase().auth, fn) : (fn(null), () => {}); }
export async function logout() { await signOut(firebase().auth); }
export async function loadSchool(uid) { const snap = await getDoc(doc(firebase().db, 'users', uid, 'profile', 'school')); return snap.exists() ? { school: snap.data().school, logo: snap.data().logo } : { school: '', logo: '' }; }
export async function saveSchool(uid, data) { await setDoc(doc(firebase().db, 'users', uid, 'profile', 'school'), { school: data.school.slice(0, 60), logo: data.logo, updatedAt: serverTimestamp() }); }
export async function listEvents(uid) {
  const snap = await getDocs(query(collection(firebase().db, 'events'), where('ownerId', '==', uid)));
  return snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
}
export async function saveEvent(uid, id, event, published) {
  const { db, auth } = firebase(); if (auth.currentUser?.uid !== uid) throw new Error('다시 로그인해 주세요.');
  const data = normalizeEvent(event);
  await setDoc(doc(db, 'events', id), { ...data, ownerId: uid, published: Boolean(published), updatedAt: serverTimestamp() });
  return data;
}
export async function removeEvent(id) { await deleteDoc(doc(firebase().db, 'events', id)); }
export async function listAssets(uid) {
  const snap = await getDocs(collection(firebase().db, 'users', uid, 'assets'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}
export async function savePalette(uid, palette) {
  const id = crypto.randomUUID();
  const asset = { name: palette.name.slice(0, 30), kind: 'palette', bg: palette.bg, ink: palette.ink };
  await setDoc(doc(firebase().db, 'users', uid, 'assets', id), asset); return { ...asset, id };
}
export async function uploadAsset(uid, file, kind, name, metadata = {}) {
  if (!['logo', 'frame', 'sticker'].includes(kind)) throw new Error('지원하지 않는 디자인 종류');
  if (file.type !== 'image/webp' || file.size >= 4 * 1024 * 1024) throw new Error('WebP로 최적화한 디자인만 업로드할 수 있어요 (4MB 미만).');
  const id = crypto.randomUUID(), path = `users/${uid}/assets/${id}`;
  const object = ref(firebase().storage, path);
  await uploadBytes(object, file, { contentType: file.type });
  try {
    const url = await getDownloadURL(object);
    const asset = { name: (name || file.name).slice(0, 60), kind, url, path, ...metadata };
    await setDoc(doc(firebase().db, 'users', uid, 'assets', id), asset);
    return { ...asset, id };
  } catch (error) { await deleteObject(object).catch(() => {}); throw error; }
}
export async function removeAsset(uid, asset) {
  // 게시 행사에서 사용 중인 에셋 삭제는 운영자 UI에서도 제한합니다.
  if (asset.path) await deleteObject(ref(firebase().storage, asset.path));
  await deleteDoc(doc(firebase().db, 'users', uid, 'assets', asset.id));
}
export async function listSharedAssets(all = false) {
  const source = collection(firebase().db, 'sharedAssets');
  const snap = await getDocs(all ? source : query(source, where('active', '==', true)));
  return snap.docs.map(d => ({ ...d.data(), id: d.id, shared: true }));
}
export async function uploadSharedAsset(file, kind, name, metadata) {
  if (!isSiteAdmin(firebase().auth.currentUser)) throw new Error('공용 자료 관리는 운영자 전용입니다.');
  if (!['frame','sticker'].includes(kind) || file.type !== 'image/webp' || file.size >= 4 * 1024 * 1024) throw new Error('최적화한 프레임 또는 스티커만 올릴 수 있어요.');
  const id = crypto.randomUUID(), path = `shared/assets/${id}`, object = ref(firebase().storage, path);
  await uploadBytes(object, file, { contentType: 'image/webp' });
  try { const url = await getDownloadURL(object), asset = { name: name.slice(0,60), kind, path, url, active: true, ...metadata }; await setDoc(doc(firebase().db, 'sharedAssets', id), asset); return { ...asset, id, shared: true }; }
  catch (error) { await deleteObject(object).catch(() => {}); throw error; }
}
export async function setSharedActive(id, active) { if (!isSiteAdmin(firebase().auth.currentUser)) throw new Error('운영자 전용입니다.'); await updateDoc(doc(firebase().db, 'sharedAssets', id), { active: Boolean(active) }); }
