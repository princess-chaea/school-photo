/**
 * 교사 소유 Google Apps Script 수합 도우미.
 * 사진은 Google Drive에만 저장하며 앱의 Firebase에는 저장하지 않습니다.
 * 필수 Script Property: OWNER_UID (Firebase 관리 화면에서 복사한 본인 UID).
 * 배포: 실행 사용자=나, 액세스=모든 사용자. API 키는 Script Properties에만 보관합니다.
 */
var PROJECT_ID = 'teacher-student-photo';
var MAX_BYTES = 5 * 1024 * 1024;

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return jsonResponse({ok:true,message:'사제동행 찰칵! 포토 · 교사용 수합 도우미'}); }
function doPost(request) {
  try {
    var text = request && request.postData && request.postData.contents;
    if (!text || text.length > Math.ceil(MAX_BYTES * 4 / 3) + 20000) throw new Error('요청이 없거나 이미지가 너무 큽니다.');
    var data = JSON.parse(text);
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(data.eventId || '')) throw new Error('올바른 행사 ID가 아닙니다.');
    if (data.action === 'configure' || data.action === 'verify') return jsonResponse(configureCollection(data));
    if (data.action === 'submit') return jsonResponse(submitImage(data));
    throw new Error('지원하지 않는 요청입니다.');
  } catch (error) {
    // 요청 본문, 학생 이미지, API 키, Firebase 토큰을 로그에 남기지 않습니다.
    return jsonResponse({ok:false,error: safeError(error)});
  }
}
function safeError(error) {
  return error && error.publicMessage || (error && error.message && error.message.indexOf('Exception:') < 0 && error.message.length < 180 ? error.message : '수합 연결을 확인해 주세요. 기기에 저장한 사진은 유지됩니다.');
}
function reject(message) { var e = new Error(message); e.publicMessage=message; throw e; }
function firebaseConfig() {
  var cache=CacheService.getScriptCache(),existing=cache.get('firebase-web-config');
  if(existing)return JSON.parse(existing);
  var response=UrlFetchApp.fetch('https://'+PROJECT_ID+'.web.app/__/firebase/init.json',{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)reject('Firebase 공개 웹 설정을 확인하지 못했습니다.');
  var config=JSON.parse(response.getContentText());
  if(config.projectId!==PROJECT_ID||!config.apiKey)reject('Firebase 프로젝트 설정이 다릅니다.');
  cache.put('firebase-web-config',JSON.stringify({apiKey:config.apiKey}),3600);return config;
}
function publicEvent(eventId) {
  var url='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents/events/'+encodeURIComponent(eventId);
  var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)reject('게시되지 않았거나 삭제된 행사입니다.');
  return JSON.parse(response.getContentText()).fields;
}
function ownerEvent(data) {
  var owner=PropertiesService.getScriptProperties().getProperty('OWNER_UID');
  if(!owner)reject('도우미의 OWNER_UID를 먼저 설정해 주세요.');
  if(typeof data.idToken!=='string'||data.idToken.length>10000)reject('교사 로그인이 필요합니다.');
  var lookup=UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(firebaseConfig().apiKey),{method:'post',contentType:'application/json',payload:JSON.stringify({idToken:data.idToken}),muteHttpExceptions:true});
  if(lookup.getResponseCode()!==200)reject('교사 로그인이 만료됐어요. 다시 로그인해 주세요.');
  var account=JSON.parse(lookup.getContentText()).users;
  if(!account||account[0].localId!==owner)reject('이 수합 도우미를 설치한 교사만 설정할 수 있습니다.');
  var response=UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents/events/'+encodeURIComponent(data.eventId),{headers:{Authorization:'Bearer '+data.idToken},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)reject('행사를 먼저 임시 저장해 주세요.');
  var event=JSON.parse(response.getContentText()).fields;
  if(!event.ownerId||event.ownerId.stringValue!==owner)reject('본인 행사만 연결할 수 있습니다.');
  return event;
}
function sharingFields(event) {
  return event.sharing && event.sharing.mapValue && event.sharing.mapValue.fields || {};
}
function padletRequest(key,boardId,post) {
  var options={method:post?'post':'get',headers:{'X-API-KEY':key},muteHttpExceptions:true};
  if(post){options.contentType='application/json';options.payload=JSON.stringify(post);}
  var response=UrlFetchApp.fetch('https://api.padlet.dev/v1/boards/'+encodeURIComponent(boardId)+(post?'/posts':''),options);
  var code=response.getResponseCode();
  if(code<200||code>=300)reject('Padlet 연결 실패: 유료 계정 API 키·게시판 ID·관리자 권한을 확인해 주세요.');
  return JSON.parse(response.getContentText());
}
function configureCollection(data) {
  var event=ownerEvent(data),sharing=sharingFields(event),mode=sharing.mode && sharing.mode.stringValue;
  if(['drive','padlet'].indexOf(mode)<0)reject('행사에 자동 수합 방식을 먼저 저장해 주세요.');
  if(!sharing.relayUrl||sharing.relayUrl.stringValue!==ScriptApp.getService().getUrl())reject('행사의 수합 URL과 이 도우미의 배포 URL이 다릅니다.');
  var properties=PropertiesService.getScriptProperties(),name='collection_'+data.eventId,config=JSON.parse(properties.getProperty(name)||'{}');
  if(data.action==='verify') {
    if(!config.folderId||config.mode!==mode||(mode==='padlet'&&(!config.apiKey||config.boardId!==sharing.boardId.stringValue)))reject('설정의 저장하고 수합 연결 확인을 먼저 눌러 주세요.');
    return {ok:true,message:'수합 연결을 확인했어요.'};
  }
  var folderId=data.folderId||config.folderId;
  if(!/^[a-zA-Z0-9_-]{10,150}$/.test(folderId||''))reject('Google Drive 폴더 ID를 입력해 주세요.');
  var folder;
  try{folder=DriveApp.getFolderById(folderId);folder.getName();}catch(error){reject('도우미를 설치한 계정에서 사용할 수 있는 Drive 폴더인지 확인해 주세요.');}
  var next={folderId:folderId,mode:mode,ownerId:event.ownerId.stringValue};
  if(mode==='padlet') {
    if(data.publicAttachment!==true)reject('Padlet 첨부 이미지의 Drive 링크 공개에 동의해 주세요.');
    var key=data.apiKey||config.apiKey,board=sharing.boardId && sharing.boardId.stringValue;
    if(typeof key!=='string'||key.length<8||key.length>1000||!board)reject('Padlet 게시판 ID와 개발자 API 키를 입력해 주세요.');
    padletRequest(key,board);next.apiKey=key;next.boardId=board;next.publicAttachment=true;
  }
  properties.setProperty(name,JSON.stringify(next));
  return {ok:true,message:mode==='padlet'?'Drive 폴더와 Padlet 게시판 연결을 확인했어요.':'Google Drive 폴더 연결을 확인했어요.'};
}
function submitImage(data) {
  if(data.consent!==true)reject('학생이 제출을 선택한 이미지만 보낼 수 있습니다.');
  if(!/^[a-zA-Z0-9_-]{20,100}$/.test(data.submissionId||''))reject('제출 ID가 올바르지 않습니다.');
  var event=publicEvent(data.eventId),sharing=sharingFields(event),owner=PropertiesService.getScriptProperties().getProperty('OWNER_UID');
  if(!event.published||event.published.booleanValue!==true||!event.ownerId||event.ownerId.stringValue!==owner)reject('현재 제출을 받을 수 없는 행사입니다.');
  if(!sharing.relayUrl||sharing.relayUrl.stringValue!==ScriptApp.getService().getUrl()||!sharing.submissionKey||data.submissionKey!==sharing.submissionKey.stringValue)reject('행사의 수합 연결이 변경됐어요. QR을 다시 열어 주세요.');
  var mode=sharing.mode && sharing.mode.stringValue;
  var config=JSON.parse(PropertiesService.getScriptProperties().getProperty('collection_'+data.eventId)||'{}');
  if(['drive','padlet'].indexOf(mode)<0||config.mode!==mode||!config.folderId||(mode==='padlet'&&config.boardId!==sharing.boardId.stringValue))reject('선생님이 수합 연결을 먼저 확인해야 합니다.');
  if(typeof data.imageBase64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.imageBase64)||data.imageBase64.length>Math.ceil(MAX_BYTES*4/3))reject('5MB 이하 이미지만 제출할 수 있습니다.');
  var bytes=Utilities.base64Decode(data.imageBase64);
  if(bytes.length<4||bytes.length>MAX_BYTES||(bytes[0]&255)!==255||(bytes[1]&255)!==216||(bytes[2]&255)!==255)reject('올바른 JPEG 완성 이미지가 아닙니다.');
  // 사진은 Cache/Properties/Firestore에 저장하지 않습니다. 중복 방지 기록은 짧은 시간만 유지합니다.
  var cache=CacheService.getScriptCache(),receiptKey='receipt_'+data.eventId+'_'+data.submissionId;
  var lock=LockService.getScriptLock();if(!lock.tryLock(25000))reject('제출이 몰리고 있어요. 잠시 후 다시 눌러 주세요.');
  try {
    var existing=cache.get(receiptKey);if(existing){var receipt=JSON.parse(existing);if(receipt.pending)reject('이전 제출 결과를 확인 중입니다. 중복 제출을 막기 위해 선생님께 확인해 주세요.');return receipt;}
    var filename=(event.title && event.title.stringValue||'행사').replace(/[\\/:*?"<>|]/g,'-')+'-'+data.submissionId+'.jpg';
    var file=DriveApp.getFolderById(config.folderId).createFile(Utilities.newBlob(bytes,'image/jpeg',filename));
    var url=file.getUrl(),result={ok:true,url:url,message:'Google Drive에 제출했어요.'};
    if(mode==='padlet') {
      try {file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(error){file.setTrashed(true);reject('학교 계정에서 이미지 링크 공개가 제한됐어요. 선생님께 확인해 주세요.');}
      cache.put(receiptKey,JSON.stringify({pending:true}),21600);
      try {
        var post=padletRequest(config.apiKey,config.boardId,{data:{type:'post',attributes:{content:{subject:event.title.stringValue,body:'학생이 선택하여 제출한 행사 완성 이미지',attachment:{url:'https://drive.google.com/file/d/'+file.getId()+'/view',caption:filename}}}}});
        url=post.data && post.data.attributes && post.data.attributes.webUrl || (sharing.url && sharing.url.stringValue) || url;
        result={ok:true,url:url,message:'Drive 저장과 Padlet 게시 요청을 완료했어요. 게시판 승인 설정에 따라 표시가 늦어질 수 있어요.'};
      } catch(error) {
        // HTTP 응답이 끊긴 경우 재시도로 중복 게시하지 않습니다. Drive의 원본 제출은 유지합니다.
        result={ok:true,url:file.getUrl(),message:'Drive에는 저장했어요. Padlet 게시 여부는 선생님께 확인해 주세요. 중복 게시를 막기 위해 같은 사진은 다시 게시하지 않아요.'};
      }
    }
    cache.put(receiptKey,JSON.stringify(result),21600);return result;
  } finally { lock.releaseLock(); }
}
