import {normalizeFrameDraft} from './frame-draft.js';
import {storeFrameMetadata,readFrameAsset} from './frame-metadata.js';
import {usageDay} from './usage-data.js';
// 운영자 전용 모듈입니다. 참가자는 public-event.js의 읽기 기능만 사용합니다.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, connectFirestoreEmulator, limit,orderBy,documentId,startAfter,getCountFromServer,Timestamp,runTransaction } from 'firebase/firestore';
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
  return snap.docs.map(d => ({ ...readFrameAsset(d.data()), id: d.id }));
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
    const asset = { name: (name || file.name).slice(0, 60), kind, url, path, ...storeFrameMetadata(metadata) };
    await setDoc(doc(firebase().db, 'users', uid, 'assets', id), asset);
    return { ...readFrameAsset(asset), id };
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
  return snap.docs.map(d => ({ ...readFrameAsset(d.data()), id: d.id, shared: true }));
}
export async function saveSharedPalette(palette){
 if(!isSiteAdmin(firebase().auth.currentUser))throw new Error('운영자 전용입니다.');
 const id=crypto.randomUUID(),asset={name:palette.name.slice(0,30),kind:'palette',bg:palette.bg,ink:palette.ink,active:true};
 await setDoc(doc(firebase().db,'sharedAssets',id),asset);return{...asset,id,shared:true};
}
export async function uploadSharedAsset(file, kind, name, metadata) {
  if (!isSiteAdmin(firebase().auth.currentUser)) throw new Error('공용 자료 관리는 운영자 전용입니다.');
  if (!['frame','sticker'].includes(kind) || file.type !== 'image/webp' || file.size >= 4 * 1024 * 1024) throw new Error('최적화한 프레임 또는 스티커만 올릴 수 있어요.');
  const id = crypto.randomUUID(), path = `shared/assets/${id}`, object = ref(firebase().storage, path);
  await uploadBytes(object, file, { contentType: 'image/webp' });
  try { const url = await getDownloadURL(object), asset = { name: name.slice(0,60), kind, path, url, active: true, ...storeFrameMetadata(metadata) }; await setDoc(doc(firebase().db, 'sharedAssets', id), asset); return { ...readFrameAsset(asset), id, shared: true }; }
  catch (error) { await deleteObject(object).catch(() => {}); throw error; }
}
export async function setSharedActive(id, active) { if (!isSiteAdmin(firebase().auth.currentUser)) throw new Error('운영자 전용입니다.'); await updateDoc(doc(firebase().db, 'sharedAssets', id), { active: Boolean(active) }); }

export async function recordOperatorUser(user) {
  const reference=doc(firebase().db,'userDirectory',user.uid),previous=await getDoc(reference),data={displayName:(user.displayName||'').slice(0,80),email:user.email||'',lastSeen:serverTimestamp()};
  if(!previous.data()?.firstSeen)data.firstSeen=serverTimestamp();
  const created=Date.parse(user.metadata?.creationTime||'');if(!previous.data()?.createdAt&&Number.isFinite(created))data.createdAt=Timestamp.fromMillis(created);
  await setDoc(reference,data,{merge:true});
}
export async function listOperationsPage(kind,after=null){
  if(!isSiteAdmin(firebase().auth.currentUser))throw new Error('운영자 전용입니다.');
  const constraints=[orderBy(documentId()),...(after?[startAfter(after)]:[]),limit(100)];
  const snap=await getDocs(query(collection(firebase().db,kind==='users'?'userDirectory':'events'),...constraints));
  return {items:snap.docs.map(d=>({...d.data(),id:d.id})),cursor:snap.docs.at(-1)?.id||null,more:snap.size===100};
}
export async function moderateEvent(id,expectedUpdatedAt,reason=''){
  const {auth,db}=firebase();if(!isSiteAdmin(auth.currentUser))throw new Error('운영자 전용입니다.');
  await runTransaction(db,async transaction=>{
    const reference=doc(db,'events',id),snapshot=await transaction.get(reference);if(!snapshot.exists())throw new Error('삭제된 행사입니다.');
    const current=snapshot.data();if(expectedUpdatedAt&&!current.updatedAt?.isEqual?.(expectedUpdatedAt))throw new Error('검토 중 행사 내용이 변경됐어요. 미리보기를 다시 열어 확인해 주세요.');
    if(!current.published)return;
    transaction.update(reference,{published:false,updatedAt:serverTimestamp()});
    transaction.set(doc(collection(db,'moderationActions')),{eventId:id,eventTitle:String(current.title||'').slice(0,80),actorId:auth.currentUser.uid,action:'unpublish',reason:reason.slice(0,300),createdAt:serverTimestamp()});
  });
}
export async function setPublishingBlocked(uid,blocked){
  if(!isSiteAdmin(firebase().auth.currentUser))throw new Error('운영자 전용입니다.');
  if(uid===firebase().auth.currentUser.uid)throw new Error('본인의 운영 권한은 변경할 수 없습니다.');
  await updateDoc(doc(firebase().db,'userDirectory',uid),{publishingBlocked:Boolean(blocked)});
}

export async function getOperationsOverview(days=7){
 const {auth,db}=firebase();if(!isSiteAdmin(auth.currentUser))throw new Error('운영자 전용입니다.');
 const first=usageDay()-(days-1)*86400000,count=async source=>(await getCountFromServer(source)).data().count;
 const [users,totalEvents,published,blocked,knownDates,usage,signup,recent]=await Promise.all([
  count(collection(db,'userDirectory')),count(collection(db,'events')),count(query(collection(db,'events'),where('published','==',true))),count(query(collection(db,'userDirectory'),where('publishingBlocked','==',true))),count(query(collection(db,'userDirectory'),where('createdAt','>=',Timestamp.fromMillis(0)))),
  getDocs(query(collection(db,'usageDaily'),where('day','>=',Timestamp.fromMillis(first)))),
  Promise.all(Array.from({length:days},async(_,index)=>{const day=first+index*86400000;return{day,count:await count(query(collection(db,'userDirectory'),where('createdAt','>=',Timestamp.fromMillis(day)),where('createdAt','<',Timestamp.fromMillis(day+86400000))))};})),getDocs(query(collection(db,'events'),orderBy('updatedAt','desc'),limit(5)))
 ]);
 return {users,totalEvents,published,blocked,knownDates,signup,recent:recent.docs.map(d=>({...d.data(),id:d.id})),usage:usage.docs.map(d=>({...d.data(),id:d.id}))};
}
export async function getOperationsEvent(id){
 if(!isSiteAdmin(firebase().auth.currentUser))throw new Error('운영자 전용입니다.');const snap=await getDoc(doc(firebase().db,'events',id));if(!snap.exists())throw new Error('삭제된 행사입니다.');return {...normalizeEvent(snap.data()),id:snap.id,ownerId:snap.data().ownerId,published:snap.data().published,updatedAt:snap.data().updatedAt};
}
export async function listModerationActions(){if(!isSiteAdmin(firebase().auth.currentUser))throw new Error('운영자 전용입니다.');const snap=await getDocs(query(collection(firebase().db,'moderationActions'),orderBy('createdAt','desc'),limit(50)));return snap.docs.map(d=>({...d.data(),id:d.id}));}

export async function listFrameDrafts(uid){
 const snapshot=await getDocs(collection(firebase().db,'users',uid,'frameDrafts'));return snapshot.docs.map(d=>({...d.data(),id:d.id}));
}
export async function saveFrameDraft(uid,{id,name,scope='private',config}){
 const clean=normalizeFrameDraft(config);if(!clean)throw new Error('배치를 확인해 주세요.');
 if(scope==='shared'&&!isSiteAdmin(firebase().auth.currentUser))throw new Error('공용 프레임 배치는 운영자만 저장할 수 있어요.');
 const draftId=id||crypto.randomUUID(),record={name:name.slice(0,60),scope,config:JSON.stringify(clean),updatedAt:serverTimestamp()};
 await setDoc(doc(firebase().db,'users',uid,'frameDrafts',draftId),record);return{...record,config:clean,id:draftId,updatedAt:new Date().toISOString()};
}
export async function deleteFrameDraft(uid,id){await deleteDoc(doc(firebase().db,'users',uid,'frameDrafts',id));}
