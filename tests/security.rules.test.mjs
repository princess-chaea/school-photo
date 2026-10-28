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
test('교사·공용 프레임의 사용자 지정 사진 칸 저장과 범위 검증', async () => {
  const a=env.authenticatedContext('teacher-a').firestore(),admin=env.authenticatedContext('admin',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();
  const photoSlots=[{x:.08,y:.12,w:.36,h:.3},{x:.5,y:.5,w:.42,h:.4}];
  const asset={name:'맞춤 2컷',kind:'frame',url:'https://example.com/frame.webp',path:'users/teacher-a/assets/custom',layoutCount:2,orientation:'portrait',photoSlots};
  await assertSucceeds(setDoc(doc(a,'users','teacher-a','assets','custom'),asset));
  assert.deepEqual((await getDoc(doc(a,'users','teacher-a','assets','custom'))).data().photoSlots,photoSlots);
  await assertSucceeds(setDoc(doc(admin,'sharedAssets','custom'),{...asset,path:'shared/assets/custom',active:true}));
  await assertFails(setDoc(doc(a,'users','teacher-a','assets','bad'),{...asset,path:'users/teacher-a/assets/bad',photoSlots:[{x:.8,y:0,w:.4,h:.3},photoSlots[1]]}));
});

test('행사 공유 설정은 저장하되 API 키·학생 사진·임의 수합 서버는 차단한다',async()=>{
 const a=env.authenticatedContext('teacher-a').firestore();
 const sharing={mode:'padlet',url:'https://padlet.com/example/board',relayUrl:'https://script.google.com/macros/s/relay/exec',boardId:'board123',submissionKey:'a'.repeat(24)};
 await assertSucceeds(setDoc(doc(a,'events','sharing'),{...config(),sharing}));
 await assertFails(setDoc(doc(a,'events','key'),{...config(),sharing:{...sharing,apiKey:'secret'}}));
 await assertFails(setDoc(doc(a,'events','relay'),{...config(),sharing:{...sharing,relayUrl:'https://evil.test/collect'}}));
 await assertFails(setDoc(doc(a,'events','data'),{...config(),sharing:{...sharing,photos:['private']}}));
});

test('운영자 현황 목록과 게시 중지는 지정 운영자만 허용한다',async()=>{
 const a=env.authenticatedContext('teacher-a',{email:'a@example.com'}).firestore(),b=env.authenticatedContext('teacher-b',{email:'b@example.com'}).firestore(),admin=env.authenticatedContext('admin',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();
 await assertSucceeds(setDoc(doc(a,'userDirectory','teacher-a'),{displayName:'교사',email:'a@example.com',lastSeen:serverTimestamp()}));
 await assertFails(getDocs(collection(b,'userDirectory')));await assertSucceeds(getDocs(collection(admin,'userDirectory')));
 await setDoc(doc(a,'events','ops'),config(true));await assertSucceeds(getDocs(collection(admin,'events')));await assertFails(getDocs(collection(b,'events')));
 const {updateDoc}=await import('firebase/firestore');await assertSucceeds(updateDoc(doc(admin,'events','ops'),{published:false,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(admin,'userDirectory','teacher-a'),{publishingBlocked:true}));
 await assertFails(updateDoc(doc(a,'userDirectory','teacher-a'),{publishingBlocked:false}));await assertFails(setDoc(doc(a,'events','blocked'),config(true)));await assertSucceeds(setDoc(doc(a,'events','draft'),config(false)));
});
test('정사각형 프레임 규격은 보관함에 보존하고 잘못된 규격은 차단한다',async()=>{
 const a=env.authenticatedContext('teacher-a').firestore();const asset={name:'정사각형',kind:'frame',url:'https://example.com/frame.webp',path:'users/teacher-a/assets/square',layoutCount:4,orientation:'portrait',frameFormat:'square'};
 await assertSucceeds(setDoc(doc(a,'users','teacher-a','assets','square'),asset));await assertFails(setDoc(doc(a,'users','teacher-a','assets','badformat'),{...asset,path:'users/teacher-a/assets/badformat',frameFormat:'unbounded'}));
});

test('공용 프레임에도 용도별 제작 규격을 저장한다',async()=>{
 const admin=env.authenticatedContext('admin',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();
 await assertSucceeds(setDoc(doc(admin,'sharedAssets','squareformat'),{name:'공용 정사각',kind:'frame',url:'https://example.com/frame.webp',path:'shared/assets/squareformat',active:true,layoutCount:4,orientation:'portrait',frameFormat:'square'}));
});

test('행사 텍스트의 학교안심폰트는 저장하고 임의 글꼴 값은 차단한다',async()=>{
 const a=env.authenticatedContext('teacher-a').firestore();const event=normalizeEvent({...DEFAULT_EVENT,title:'폰트 행사',branding:{title:{font:'poster'}}});await assertSucceeds(setDoc(doc(a,'events','font'),{...event,ownerId:'teacher-a',published:false,updatedAt:serverTimestamp()}));event.branding.title.font='untrusted';await assertFails(setDoc(doc(a,'events','bad-font'),{...event,ownerId:'teacher-a',published:false,updatedAt:serverTimestamp()}));
});

test('확장 글꼴·글자별 색상·자유 배치 저장은 허용하고 잘못된 스타일은 차단한다',async()=>{
 const {FONTS}=await import('../fonts.js');const a=env.authenticatedContext('teacher-a').firestore();
 const e=normalizeEvent({...DEFAULT_EVENT,title:'우정',branding:{title:{position:'free',anchor:'top',x:.03,y:.05,font:FONTS.at(-1).id,styledText:'우정',letterColors:['#ff0000','#0000ff']}}});
 const data={...e,ownerId:'teacher-a',published:true,updatedAt:serverTimestamp()};await assertSucceeds(setDoc(doc(a,'events','letters'),data));
 const loaded=(await getDoc(doc(a,'events','letters'))).data();assert.deepEqual(loaded.branding.title.letterColors,['#ff0000','#0000ff']);
 for(const part of [{font:'not-a-font'},{letterColors:['url(evil)']},{letterColors:[1]},{letterColors:Array(101).fill('#ff0000')},{anchor:'outside'},{x:'0.5'},{y:false},{size:'large'},{color:123}]){
  const bad={...data,branding:{...data.branding,title:{...data.branding.title,...part}}};await assertFails(setDoc(doc(a,'events','bad-style'),bad));
 }
});
test('추가 문구 8개와 글자별 크기 설정을 저장하고 상자 개수를 제한한다',async()=>{
 const a=env.authenticatedContext('teacher-a').firestore();const texts=Array.from({length:8},(_,i)=>({id:'extra-'+i,text:'추가 문구',letterSizes:[2,1,.5],letterColors:['#ff0000','','#0000ff']}));
 const e=normalizeEvent({...DEFAULT_EVENT,title:'행사',branding:{texts}}),data={...e,ownerId:'teacher-a',published:true,updatedAt:serverTimestamp()};
 await assertSucceeds(setDoc(doc(a,'events','extra-texts'),data));
 await assertFails(setDoc(doc(a,'events','too-many-texts'),{...data,branding:{...data.branding,texts:[...data.branding.texts,data.branding.texts[0]]}}));
});

test('익명 사용 집계는 게시 행사·한국 날짜·한 번의 원자 증가만 허용하고 사진·식별자와 조회는 차단한다',async()=>{
 const {Timestamp,increment}=await import('firebase/firestore'),{usageDay,emptyUsage}=await import('../usage-data.js');const teacher=env.authenticatedContext('teacher-a').firestore(),guest=env.unauthenticatedContext().firestore(),other=env.authenticatedContext('teacher-b').firestore(),admin=env.authenticatedContext('admin',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();
 await setDoc(doc(teacher,'events','live'),config(true));await setDoc(doc(teacher,'events','draft'),config(false));const day=usageDay(),data={eventId:'live',shard:0,day:Timestamp.fromMillis(day),...emptyUsage(),visits:1,updatedAt:serverTimestamp()},target=doc(guest,'usageDaily','live_'+day+'_0');
 await assertSucceeds(setDoc(target,data));await assertFails(getDoc(target));await assertFails(getDoc(doc(other,'usageDaily',target.id)));await assertSucceeds(getDoc(doc(admin,'usageDaily',target.id)));
 await assertSucceeds(setDoc(target,{cameraShots:increment(1),updatedAt:serverTimestamp()},{merge:true}));
 await assertFails(setDoc(target,{cameraShots:increment(20),updatedAt:serverTimestamp()},{merge:true}));await assertFails(setDoc(target,{visits:0,cameraShots:3,updatedAt:serverTimestamp()},{merge:true}));
 await assertFails(setDoc(doc(guest,'usageDaily','draft_'+day+'_0'),{...data,eventId:'draft'}));await assertFails(setDoc(doc(guest,'usageDaily','live_'+(day-86400000)+'_0'),{...data,day:Timestamp.fromMillis(day-86400000)}));
 for(const extra of [{imageBase64:'photo'},{studentId:'student'},{ip:'1.2.3.4'},{userAgent:'device'}])await assertFails(setDoc(doc(guest,'usageDaily','live_'+day+'_1'),{...data,shard:1,...extra}));
 await assertFails(deleteDoc(target));
});
test('교사 가입일은 한 번 기록하면 본인이 바꿀 수 없고 다른 교사 계정 조회도 차단한다',async()=>{
 const {Timestamp}=await import('firebase/firestore');const a=env.authenticatedContext('teacher-a',{email:'a@example.com'}).firestore(),b=env.authenticatedContext('teacher-b').firestore();const reference=doc(a,'userDirectory','teacher-a');
 const createdAt=Timestamp.fromMillis(Date.now()-86400000);await assertSucceeds(setDoc(reference,{displayName:'교사',email:'a@example.com',createdAt,firstSeen:serverTimestamp(),lastSeen:serverTimestamp()}));await assertSucceeds(getDoc(reference));await assertFails(getDoc(doc(b,'userDirectory','teacher-a')));await assertFails(setDoc(reference,{createdAt:Timestamp.fromMillis(Date.now()-1000),lastSeen:serverTimestamp()},{merge:true}));
});
test('운영자는 비공개 행사 내용을 검토하고 실제 게시 중지와 검토 기록을 함께 저장한다',async()=>{
 const {writeBatch}=await import('firebase/firestore');const a=env.authenticatedContext('teacher-a').firestore(),other=env.authenticatedContext('teacher-b').firestore(),admin=env.authenticatedContext('admin',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();await setDoc(doc(a,'events','review'),config(true));await setDoc(doc(a,'events','private-review'),config(false));await assertSucceeds(getDoc(doc(admin,'events','private-review')));await assertFails(getDoc(doc(other,'events','private-review')));
 const action={eventId:'review',eventTitle:'가을 축제',actorId:'admin',action:'unpublish',reason:'문구 검토',createdAt:serverTimestamp()};await assertFails(setDoc(doc(other,'moderationActions','bad'),action));await assertFails(setDoc(doc(admin,'moderationActions','without-stop'),action));
 const batch=writeBatch(admin);batch.update(doc(admin,'events','review'),{published:false,updatedAt:serverTimestamp()});batch.set(doc(admin,'moderationActions','approved'),action);await assertSucceeds(batch.commit());await assertSucceeds(getDoc(doc(admin,'moderationActions','approved')));await assertFails(getDoc(doc(other,'moderationActions','approved')));
});
test('운영자 본인 소유의 복합 문구 행사도 검토 후 게시 중지와 기록을 저장한다',async()=>{
 const {writeBatch}=await import('firebase/firestore');const admin=env.authenticatedContext('operator',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore(),event=normalizeEvent({...DEFAULT_EVENT,title:'운영자 행사',branding:{texts:Array.from({length:8},(_,i)=>({id:'extra-'+i,text:'추가 문구',letterColors:['#ff0000'],letterSizes:[2]}))}});
 await assertSucceeds(setDoc(doc(admin,'events','own-review'),{...event,ownerId:'operator',published:true,updatedAt:serverTimestamp()}));const batch=writeBatch(admin);batch.update(doc(admin,'events','own-review'),{published:false,updatedAt:serverTimestamp()});batch.set(doc(admin,'moderationActions','own-stop'),{eventId:'own-review',eventTitle:'운영자 행사',actorId:'operator',action:'unpublish',reason:'배치 검토',createdAt:serverTimestamp()});await assertSucceeds(batch.commit());
});
test('집계의 초기 원자 증가와 동시 증가가 수신한 횟수를 잃지 않고 합산된다',async()=>{
 const {Timestamp,increment}=await import('firebase/firestore'),{usageDay,USAGE_KEYS}=await import('../usage-data.js');const a=env.authenticatedContext('teacher-a').firestore(),guest=env.unauthenticatedContext().firestore(),admin=env.authenticatedContext('operator',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();await setDoc(doc(a,'events','parallel'),config(true));const day=usageDay(),reference=doc(guest,'usageDaily','parallel_'+day+'_2');
 const send=()=>setDoc(reference,{eventId:'parallel',shard:2,day:Timestamp.fromMillis(day),...Object.fromEntries(USAGE_KEYS.map(key=>[key,increment(key==='photoImports'?1:0)])),updatedAt:serverTimestamp()},{merge:true});await assertSucceeds(send());await assertSucceeds(Promise.all(Array.from({length:6},send)));assert.equal((await getDoc(doc(admin,'usageDaily',reference.id))).data().photoImports,7);
});

test('컷 제한 없는 프레임은 보존 모드만 허용하고 임의 모드와 스티커의 프레임 속성을 차단한다',async()=>{
 const a=env.authenticatedContext('teacher-a').firestore();
 const frame={name:'범용 프레임',kind:'frame',path:'users/teacher-a/assets/universal',url:'https://example.com/frame.webp',layoutCount:0,orientation:'portrait',frameFormat:'square',preserveAspect:true,clearPhotoSlots:true};
 await assertSucceeds(setDoc(doc(a,'users/teacher-a/assets/universal'),frame));
 for(const patch of [{preserveAspect:false},{clearPhotoSlots:'yes'},{kind:'sticker'}])await assertFails(setDoc(doc(a,'users/teacher-a/assets/universal'),{...frame,...patch}));
 const admin=env.authenticatedContext('operator',{email:'dltjdrms320@gmail.com',email_verified:true}).firestore();
 const shared={...frame,path:'shared/assets/universal',active:true};
 await assertSucceeds(setDoc(doc(admin,'sharedAssets/universal'),shared));
 await assertFails(setDoc(doc(a,'sharedAssets/universal'),shared));
});

test('100개 기본 스티커의 행사 저장·전체 해제와 256개 상한을 동일하게 적용한다',async()=>{
 const db=env.authenticatedContext('teacher-a').firestore(),event={...config(),stickers:normalizeEvent(DEFAULT_EVENT).stickers};
 assert.equal(event.stickers.length,100);
 await assertSucceeds(setDoc(doc(db,'events','stickers'),event));
 const sticker=event.stickers[0];await assertSucceeds(setDoc(doc(db,'events','stickers'),{...event,stickers:Array.from({length:256},()=>sticker)}));
 await assertFails(setDoc(doc(db,'events','stickers'),{...event,stickers:Array.from({length:257},()=>sticker)}));
 await assertSucceeds(setDoc(doc(db,'events','stickers'),{...event,stickers:[]}));
});
