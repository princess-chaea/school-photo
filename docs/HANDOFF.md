# 다른 컴퓨터에서 이어 작업하기

GitHub: https://github.com/princess-chaea/school-photo
운영 주소: https://teacher-student-photo.web.app/
Firebase 프로젝트: `teacher-student-photo`

## 처음 한 번

Git과 Node.js 22.12 이상(또는 24 LTS)을 설치한 뒤 터미널에서 실행합니다. Windows PowerShell, macOS, Linux에서 같은 명령을 사용합니다.

```sh
git clone https://github.com/princess-chaea/school-photo.git
cd school-photo
npm ci
npm run setup
npm run dev
```

`npm run setup`은 운영 Hosting의 공개 Firebase 웹 설정을 읽어 Git에서 제외된 `.env.local`을 만듭니다. 기존 `.env.local`은 덮어쓰지 않습니다. 로그인 토큰이나 서비스 계정 키를 가져오는 명령이 아닙니다. 연결 실패 시 `.env.example`을 `.env.local`로 복사하고 Firebase Console → 프로젝트 설정 → 일반 → 내 앱의 웹 설정을 입력합니다.

터미널에 표시된 localhost 주소를 엽니다. 운영자 `/`, 학생 체험 `/booth.html?demo=1`, 운영자 체험 `/?demo=1`입니다. 실제 Google 로그인을 하면 기존 Firebase의 내 행사·디자인을 이어서 사용합니다. 새 Firebase 프로젝트나 데이터 이전은 필요 없습니다. 로컬에서 저장·게시한 행사는 실제 운영 데이터에 반영되므로 UI 개발에는 체험 모드를 사용하면 편리합니다.

## 수정 후 확인·저장

```sh
npm test
npm run build
git status
git add .
git commit -m "Describe the change"
git push origin main
```

`.env.local`, `node_modules`, `dist`, Firebase 인증 캐시·로그는 커밋하지 않습니다. 폰트·로고·스티커와 라이선스는 `public/`에 이미 들어 있습니다.

Firebase 권한 테스트는 Java 21 이상과 Firebase CLI를 사용할 수 있을 때 다음으로 실행합니다.

```sh
npx --yes --package firebase-tools firebase emulators:exec --project demo-school-photo --only firestore,storage "node --test tests/security.rules.test.mjs"
```

현재 기능 테스트 8개, Firebase 규칙 테스트 10개입니다. 기기 기본 카메라 호출, 실제 카메라 미리보기와 촬영 결과, 터치·두 손가락 조작, 사진첩 공유 및 실물 프린터 출력은 실기기 검수가 필요합니다.

## 운영에 배포하기

프로젝트 권한이 있는 Google 계정으로 CLI에 로그인합니다. 웹앱 Google 로그인과 CLI 로그인은 별개이며 새 컴퓨터에서는 CLI 로그인도 새로 합니다.

```sh
npx --yes --package firebase-tools firebase login
npm run build
npx --yes --package firebase-tools firebase deploy --project teacher-student-photo --only hosting,firestore,storage
```

GitHub에 push하는 것만으로는 Firebase에 자동 배포되지 않습니다. 이미 생성된 Firestore·Storage·Google 로그인 설정은 그대로 사용합니다. 새 도메인을 추가할 때만 Auth 승인 도메인과 Storage CORS를 검토합니다.

## 현재 설계와 파일 위치

- `booth.html`, `app.js`: 학생 단계별 UI, 기본 카메라/앱 안 촬영, 사진 편집·저장. 사진은 브라우저 메모리에서만 처리합니다.
- `core.js`: 컷 수·프레임·사용자 지정 `photoSlots` 정규화와 공통 좌표 계산.
- `frame-upload.js`: 프레임 이미지 배치, 사진 칸별 이동·모서리/두 손가락 크기 조절·좌표 입력.
- `editor-view.js`: 학생 꾸미기 화면 100~400% 보기 확대·화면 이동. 출력 크기와 독립적입니다.
- `export-formats.js`: 사각형 비율 선택 카드, 카톡·인스타·인화·A4·대표 비율과 여백 맞춤 저장.
- `admin.js`, `libraries.js`, `frame-editor.js`, `frame-preview.js`, `branding.js`: 교사 행사·보관함·학교 설정·로고/문구 위치 편집.
- `cloud.js`: 운영자 Firebase Auth/Firestore/Storage. `public-event.js`: 로그인 없는 학생의 게시 행사 단건 읽기.
- `optimize.js`, `webp-worker.js`: 교사 이미지 WebP 최적화. `print-png.js`: PNG 300dpi 메타데이터.
- `firestore.rules`, `storage.rules`: 계정별 자료 격리, 학생 쓰기 금지, 공용 자료 운영자 제한.
- `mobile.css`, `admin.css`, `style.css`: 반응형 화면. `public/`: 케리스 배움체·브랜드 이미지·PWA/OG 아이콘·라이선스.

## 반드시 유지할 조건

1. 학생 사진·완성 이미지는 Firebase나 다른 서버로 업로드하지 않습니다. 체험 사진도 동일합니다.
2. 공식 `/`는 운영자 페이지, 학생은 행사별 `/booth.html?event=...`로 들어옵니다. 학생 화면에는 운영자 이동 버튼을 넣지 않습니다.
3. 일반 교사의 탭은 내 행사·활동 / 프레임 보관함 / 디자인 보관함 / 내 학교. 인증된 `dltjdrms320@gmail.com`만 공용 자료 관리 탭에서 공용 이미지·프레임을 등록합니다. UI와 서버 규칙 모두 권한을 검사합니다.
4. 교사 업로드 디자인과 선택한 사진 칸 좌표는 계정별 또는 공용 자료로 저장합니다. 행사에는 선택한 디자인과 좌표가 복사됩니다.
5. 앱 안 촬영의 미리보기와 실제 캡처는 선택한 사진 칸의 비율 및 중앙 crop 기준을 공유합니다. 기본 카메라의 전·후면 선택 UI는 기기에 맡깁니다.
6. 사제동행 찰칵! 포토 명칭·기존 로고·케리스 배움체를 유지합니다.

새 컴퓨터의 코딩 도구에는 다음처럼 요청하면 됩니다.

> 이 저장소의 AGENTS.md, README.md, docs/HANDOFF.md를 먼저 읽고 기존 Firebase 프로젝트와 사진 브라우저 처리 원칙을 유지하며 작업을 이어가 주세요.
