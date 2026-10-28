import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('../integrations/google-collection/Code.gs',import.meta.url),'utf8');
function harness({published=true,mode='padlet',padletFailure=false,owner='teacher'}={}){
 const url='https://script.google.com/macros/s/relay/exec',properties=new Map([['OWNER_UID','teacher'],['collection_event',JSON.stringify({folderId:'folder123456789',mode,ownerId:'teacher',apiKey:'private-example-key',boardId:'board123'})]]),cache=new Map(),files=[],requests=[];
 const event={ownerId:{stringValue:owner},published:{booleanValue:published},title:{stringValue:'행사'},sharing:{mapValue:{fields:{mode:{stringValue:mode},url:{stringValue:'https://padlet.com/example/board'},relayUrl:{stringValue:url},submissionKey:{stringValue:'a'.repeat(24)},boardId:{stringValue:'board123'}}}}};
 const response=(value,status=200)=>({getResponseCode:()=>status,getContentText:()=>JSON.stringify(value)});
 const c={JSON,Math,Error,ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({body,setMimeType(){return this;}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},ScriptApp:{getService:()=>({getUrl:()=>url})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},Utilities:{base64Decode:s=>[...Buffer.from(s,'base64')],newBlob:(bytes,type,name)=>({bytes,type,name})},DriveApp:{Access:{ANYONE_WITH_LINK:'public'},Permission:{VIEW:'read'},getFolderById:()=>({getName:()=>'사진 수합',createFile:blob=>{const file={blob,shared:false,trashed:false,setSharing(){file.shared=true;},setTrashed(v){file.trashed=v;},getId:()=> 'image123',getUrl:()=> 'https://drive.google.com/file/d/image123/view'};files.push(file);return file;}})},UrlFetchApp:{fetch:(url,options={})=>{requests.push({url,options});if(url.includes('/__/firebase/init.json'))return response({projectId:'teacher-student-photo',apiKey:'public-web-api-key'});if(url.includes('accounts:lookup'))return response({users:[{localId:'teacher'}]});if(url.includes('firestore.googleapis.com'))return response({fields:event});if(url.startsWith('https://api.padlet.dev/')){if(padletFailure&&options.method==='post')return response({},403);return response({data:{attributes:{webUrl:'https://padlet.com/example/board/wish/post123'}}});}throw new Error('Unexpected URL');}}};vm.createContext(c);vm.runInContext(source,c);
 const call=data=>JSON.parse(c.doPost({postData:{contents:JSON.stringify(data)}}).body);
 return {call,properties,cache,files,requests};
}
const submission={action:'submit',eventId:'event',submissionId:'b'.repeat(24),submissionKey:'a'.repeat(24),consent:true,imageBase64:Buffer.from([255,216,255,217]).toString('base64')};
test('선택한 완성 이미지 하나를 Drive와 Padlet에 보내고 중복 요청을 다시 게시하지 않는다',()=>{
 const h=harness(),result=h.call(submission);assert.equal(result.ok,true);assert.equal(h.files.length,1);assert.equal(h.files[0].shared,true);assert.equal(h.requests.filter(r=>r.url.includes('api.padlet.dev')&&r.options.method==='post').length,1);h.call(submission);assert.equal(h.files.length,1);
 for(const [key,value]of h.cache){assert(!value.includes(submission.imageBase64));assert(!value.includes('private-example-key'));}
 assert(!JSON.stringify(result).includes('private-example-key'));
});
test('제출 미동의·비공개 행사·다른 교사·잘못된 제출키는 이미지 생성 전에 차단한다',()=>{
 for(const [options,data]of [[{}, {...submission,consent:false}],[{published:false},submission],[{owner:'other'},submission],[{}, {...submission,submissionKey:'wrong'}]]){const h=harness(options),result=h.call(data);assert.equal(result.ok,false);assert.equal(h.files.length,0);}
});
test('Drive 전용 수합은 이미지를 공개하지 않고 Padlet 요청도 하지 않는다',()=>{
 const h=harness({mode:'drive'}),result=h.call(submission);assert.equal(result.ok,true);assert.equal(h.files[0].shared,false);assert(!h.requests.some(r=>r.url.includes('api.padlet.dev')));
});
test('Padlet 실패 시 Drive 수합본을 유지하고 부분 완료를 정확히 알린다',()=>{
 const h=harness({padletFailure:true}),result=h.call(submission);assert.equal(result.ok,true);assert.match(result.message,/Drive에는 저장/);assert.match(result.message,/Padlet 게시 여부/);h.call(submission);assert.equal(h.files.length,1);assert.equal(h.requests.filter(r=>r.options.method==='post'&&r.url.includes('api.padlet.dev')).length,1);
});
test('자동 수합 연결은 로그인한 행사 소유자만 API 키를 갱신한다',()=>{
 const h=harness(),result=h.call({action:'configure',eventId:'event',idToken:'test-id-token',apiKey:'new-private-example-key',folderId:'folder123456789',publicAttachment:true});assert.equal(result.ok,true);assert.equal(JSON.parse(h.properties.get('collection_event')).apiKey,'new-private-example-key');assert(!JSON.stringify(result).includes('new-private-example-key'));
 const other=harness({owner:'other'});assert.equal(other.call({action:'configure',eventId:'event',idToken:'test-id-token',apiKey:'bad-key'}).ok,false);
});
