import { access, writeFile } from 'node:fs/promises';
import * as tls from 'node:tls';
// 최신 Node에서는 OS의 신뢰된 인증서도 사용합니다. TLS 검증은 유지합니다.
if (typeof tls.getCACertificates==='function' && typeof tls.setDefaultCACertificates==='function') {
  tls.setDefaultCACertificates([...tls.getCACertificates('default'), ...tls.getCACertificates('system')]);
}
const destination=new URL('../.env.local',import.meta.url);
try { await access(destination); console.log('.env.local이 이미 있어 유지합니다. npm run dev로 실행하세요.'); process.exit(0); } catch(error) { if(error.code!=='ENOENT')throw error; }
const response=await fetch('https://teacher-student-photo.web.app/__/firebase/init.json',{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error('공개 Firebase 웹 설정을 받지 못했습니다. .env.example을 .env.local로 복사해 Console 설정을 입력하세요.');
const config=await response.json();
if(config.projectId!=='teacher-student-photo')throw new Error('예상한 Firebase 프로젝트가 아닙니다.');
const fields={VITE_FIREBASE_API_KEY:'apiKey',VITE_FIREBASE_AUTH_DOMAIN:'authDomain',VITE_FIREBASE_PROJECT_ID:'projectId',VITE_FIREBASE_STORAGE_BUCKET:'storageBucket',VITE_FIREBASE_MESSAGING_SENDER_ID:'messagingSenderId',VITE_FIREBASE_APP_ID:'appId'};
const lines=['# 공개 Firebase 클라이언트 설정입니다. 인증 토큰·서비스 계정 키가 아닙니다.'];
for(const [env,key] of Object.entries(fields)){if(typeof config[key]!=='string'||!config[key]||/[\r\n]/.test(config[key]))throw new Error('Firebase 설정 필드가 올바르지 않습니다: '+key);lines.push(env+'='+JSON.stringify(config[key]));}
lines.push('VITE_STUDENT_BASE_URL=https://teacher-student-photo-students.web.app/','');
await writeFile(destination,lines.join('\n'),{flag:'wx'});
console.log('.env.local을 공개 웹 설정으로 만들었습니다. npm run dev로 실행하세요.');
