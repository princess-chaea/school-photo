export const USAGE_KEYS=['visits','starts','cameraShots','photoImports','completions','downloads','shares','submissions'];
export const USAGE_LABELS={visits:'참여 페이지 열림',starts:'제작 시작',cameraShots:'웹 카메라 촬영',photoImports:'사진 등록',completions:'완성 단계 도달',downloads:'저장 요청',shares:'공유 실행',submissions:'제출 성공'};
export const emptyUsage=()=>Object.fromEntries(USAGE_KEYS.map(key=>[key,0]));
export const KST_OFFSET=9*60*60*1000;
export function usageDay(time=Date.now()){return Math.floor((Number(time)+KST_OFFSET)/86400000)*86400000-KST_OFFSET;}
export function dateLabel(time){return new Date(Number(time)+KST_OFFSET).toISOString().slice(0,10);}
export function timeMillis(value){return value?.toMillis?.()??(typeof value==='number'?value:0);}
export function summarizeUsage(rows,days=7,now=Date.now()){
 const first=usageDay(now)-(days-1)*86400000,last=usageDay(now),daily=Array.from({length:days},(_,i)=>({day:first+i*86400000,...emptyUsage()})),totals=emptyUsage(),events=new Map();
 for(const row of rows){const day=timeMillis(row.day);if(day<first||day>last||!row.eventId)continue;const index=Math.floor((day-first)/86400000);if(!events.has(row.eventId))events.set(row.eventId,emptyUsage());for(const key of USAGE_KEYS){const count=Number.isSafeInteger(row[key])&&row[key]>=0?row[key]:0;totals[key]+=count;daily[index][key]+=count;events.get(row.eventId)[key]+=count;}}
 return {totals,daily,events,activeEvents:events.size,first,last};
}
export function createUsageTracker(send){let started=false,completed=false,enabled=false;return {
 enable(){enabled=true;this.record('visits');},record(kind){if(enabled&&USAGE_KEYS.includes(kind))Promise.resolve().then(()=>send(kind)).catch(()=>{});},
 start(){if(!started){started=true;this.record('starts');}},complete(){if(!completed){completed=true;this.record('completions');}},restart(){started=false;completed=false;}
};}
