import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeSharing,parsePadletDetails,validateSharing,collectionName,callCollectionRelay} from '../sharing.js';
import {normalizeEvent,DEFAULT_EVENT} from '../core.js';
import {localPoint,rotatedPoint,decorationHit,rotationDelta} from '../decoration-geometry.js';
test('공개 행사에는 API 키·로그인 토큰·폴더 자격증명을 포함하지 않는다',()=>{
 const event=normalizeEvent({...DEFAULT_EVENT,sharing:{mode:'padlet',boardId:'board123',relayUrl:'https://script.google.com/macros/s/relay/exec',submissionKey:'a'.repeat(24),apiKey:'must-stay-private',idToken:'private-token',folderId:'private-folder'}});
 assert.equal(event.sharing.mode,'padlet');assert(!JSON.stringify(event).includes('must-stay-private'));assert(!('apiKey' in event.sharing));assert(!('idToken' in event.sharing));assert(!('folderId' in event.sharing));
});
test('공유 주소는 HTTPS, 자동 수합은 Google Apps Script 배포만 허용한다',()=>{
 for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com/'])assert.equal(normalizeSharing({mode:'link',url}).url,'');
 assert.throws(()=>validateSharing({mode:'link',url:'javascript:alert(1)'}));assert.throws(()=>validateSharing({mode:'padlet',relayUrl:'https://example.com/exec'}));
 assert.equal(normalizeSharing({relayUrl:'https://script.google.com.evil.test/macros/s/x/exec'}).relayUrl,'');
 assert.equal(collectionName({mode:'link',url:'https://padlet.com/test/board'}),'Padlet');assert.equal(collectionName({mode:'link',url:'https://drive.google.com/drive/folders/123'}),'Google Drive');
});
test('개발자 메뉴 URL·cURL·JS에서 게시판 ID와 API 키를 추출한다',()=>{
 assert.deepEqual(parsePadletDetails('POST https://api.padlet.dev/v1/boards/s024xepj8lucpxnb4mc/posts'),{boardId:'s024xepj8lucpxnb4mc',apiKey:''});
 assert.deepEqual(parsePadletDetails(`curl https://api.padlet.dev/v1/boards/board123/posts -H 'X-API-KEY: private_key123'`),{boardId:'board123',apiKey:'private_key123'});
 assert.equal(parsePadletDetails(`headers: {"x-api-key": "example-secret"}`).apiKey,'example-secret');
});
test('선택한 사진 전달 시 쿠키·리퍼러를 보내지 않고 도우미 오류를 완료로 표시하지 않는다',async()=>{
 let sent;const fetcher=async(url,options)=>{sent=options;return {ok:true,json:async()=>({ok:true,url:'https://drive.google.com/file/d/123/view'})};};
 await callCollectionRelay('https://script.google.com/macros/s/relay/exec',{action:'submit',consent:true},{fetcher});
 assert.equal(sent.credentials,'omit');assert.equal(sent.referrerPolicy,'no-referrer');assert.equal(JSON.parse(sent.body).consent,true);
 await assert.rejects(callCollectionRelay('https://script.google.com/macros/s/relay/exec',{}, {fetcher:async()=>({ok:true,json:async()=>({ok:false,error:'실패'})})}),/실패/);
});
test('회전한 꾸미기 요소를 보이는 위치에서 선택하고 회전 경계를 자연스럽게 넘긴다',()=>{
 const b={x:200,y:300,w:160,h:40},p=rotatedPoint(70,0,b,90);assert(decorationHit(p,b,90));assert(!decorationHit(p,b,0));const local=localPoint(p,b,90);assert(Math.abs(local.x-70)<.00001);assert(Math.abs(local.y)<.00001);assert.equal(rotationDelta(179,-179),2);assert.equal(rotationDelta(-179,179),-2);
});
