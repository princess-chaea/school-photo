const MODES = ['none', 'link', 'drive', 'padlet'];
export function httpsURL(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''; } catch { return ''; }
}
export function relayURL(value) {
  const url=httpsURL(value);
  return /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)?url:'';
}
export function normalizeSharing(raw = {}) {
  const mode=MODES.includes(raw?.mode)?raw.mode:'none';
  return {mode,url:httpsURL(raw?.url),relayUrl:relayURL(raw?.relayUrl),boardId:/^[a-zA-Z0-9_-]{1,100}$/.test(raw?.boardId||'')?raw.boardId:'',submissionKey:/^[a-zA-Z0-9_-]{20,100}$/.test(raw?.submissionKey||'')?raw.submissionKey:''};
}
export function validateSharing(value) {
  const s=normalizeSharing(value);
  if(s.mode==='link'&&!s.url)throw new Error('공유할 HTTPS 링크를 입력해 주세요.');
  if(['drive','padlet'].includes(s.mode)&&(!s.relayUrl||!s.submissionKey))throw new Error('Google 수합 도우미의 배포 URL을 연결해 주세요.');
  if(s.mode==='padlet'&&!s.boardId)throw new Error('Padlet 게시판 ID를 입력해 주세요.');
  return s;
}
export async function callCollectionRelay(url, payload, {fetcher=fetch, timeout=60000}={}) {
  if(!relayURL(url))throw new Error('올바른 Google 수합 도우미 주소가 아니에요.');
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),redirect:'follow',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(timeout)});
  if(!response.ok)throw new Error('수합 도우미에 연결하지 못했어요. 사진은 기기에 저장할 수 있어요.');
  const result=await response.json();
  if(!result.ok)throw new Error(typeof result.error==='string'?result.error:'제출하지 못했어요. 선생님께 확인해 주세요.');
  return result;
}
export function parsePadletDetails(text='') {
  const board=text.match(/\/boards\/([a-zA-Z0-9_-]{1,100})/)?.[1]||(/^[a-zA-Z0-9_-]{16,100}$/.test(text.trim())?text.trim():'');
  const apiKey=text.match(/x-api-key["'\s]*[:=]["'\s]*([a-zA-Z0-9._-]+)/i)?.[1]||'';
  return {boardId:board,apiKey};
}
export function collectionName(sharing) {
  const s=normalizeSharing(sharing);
  if(s.mode==='padlet'||/^https:\/\/(?:[a-z0-9-]+\.)?padlet\.(?:com|org)\//.test(s.url))return 'Padlet';
  if(s.mode==='drive'||/^https:\/\/drive\.google\.com\//.test(s.url))return 'Google Drive';
  return '행사 게시판';
}
