import {USAGE_KEYS,usageDay} from './usage-data.js';
// 참가자 모듈: 행사 읽기와 익명 일일 횟수 집계만 처리합니다. 사진·Auth·Storage 업로드는 없습니다.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, connectFirestoreEmulator, setDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore/lite';
import { normalizeEvent } from './core.js';
let usageDb;
export async function loadPublicEvent(id) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('올바르지 않은 행사 주소입니다.');
  const e = import.meta.env;
  if (!e.VITE_FIREBASE_API_KEY || !e.VITE_FIREBASE_PROJECT_ID || !e.VITE_FIREBASE_APP_ID) throw new Error('행사 서버 연결 전입니다. 운영자에게 문의해 주세요.');
  const app = initializeApp({ apiKey: e.VITE_FIREBASE_API_KEY, authDomain: e.VITE_FIREBASE_AUTH_DOMAIN, projectId: e.VITE_FIREBASE_PROJECT_ID, storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: e.VITE_FIREBASE_APP_ID });
  const db = getFirestore(app);
  if (e.VITE_USE_EMULATORS === 'true') connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const snap = await getDoc(doc(db, 'events', id));
  if (!snap.exists() || !snap.data().published) throw new Error('게시되지 않았거나 삭제된 행사입니다. 운영자에게 QR을 확인해 주세요.');
  usageDb=db;return normalizeEvent(snap.data());
}

export async function recordPublicUsage(eventId,kind){
 if(!usageDb||!USAGE_KEYS.includes(kind)||!/^[a-zA-Z0-9_-]{1,100}$/.test(eventId))return;
 const day=usageDay(),shard=Math.floor(Math.random()*8),values=Object.fromEntries(USAGE_KEYS.map(key=>[key,increment(key===kind?1:0)]));
 await setDoc(doc(usageDb,'usageDaily',eventId+'_'+day+'_'+shard),{eventId,shard,day:Timestamp.fromMillis(day),...values,updatedAt:serverTimestamp()},{merge:true});
}
