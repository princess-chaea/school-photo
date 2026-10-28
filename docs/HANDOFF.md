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

현재 기능 테스트 37개, Firebase 규칙 테스트 22개입니다. 기기 기본 카메라 호출, 실제 카메라 미리보기와 촬영 결과, 터치·두 손가락 조작, 사진첩 공유 및 실물 프린터 출력은 실기기 검수가 필요합니다.

## 운영에 배포하기

프로젝트 권한이 있는 Google 계정으로 CLI에 로그인합니다. 웹앱 Google 로그인과 CLI 로그인은 별개이며 새 컴퓨터에서는 CLI 로그인도 새로 합니다.

```sh
npx --yes --package firebase-tools firebase login
npm run build
# 최초 한 번: 학생 전용 Hosting 사이트 생성
npx --yes --package firebase-tools firebase hosting:sites:create teacher-student-photo-students --project teacher-student-photo
npm run check:hosting
npx --yes --package firebase-tools firebase deploy --project teacher-student-photo --only hosting,firestore,storage
```

관리자 Hosting은 `teacher-student-photo`, 학생 Hosting은 `teacher-student-photo-students`입니다. `npm run build`는 각각 `dist/admin`, `dist/student`를 생성합니다. 학생 사이트의 루트에는 QR 안내만 있고, `/e/행사ID`는 촬영 화면으로 연결됩니다. QR 생성은 `VITE_STUDENT_BASE_URL`을 사용하며 기본값은 `https://teacher-student-photo-students.web.app/`입니다. 사이트 ID를 변경하면 `.firebaserc` student 대상과 환경변수를 함께 바꾸세요. 학생용 사이트를 생성·배포하기 전 새 QR을 배포하지 마세요. 기존 `/booth.html?event=...`는 유지합니다.

GitHub에 push하는 것만으로는 Firebase에 자동 배포되지 않습니다. 이미 생성된 Firestore·Storage·Google 로그인 설정은 그대로 사용합니다. 새 도메인을 추가할 때만 Auth 승인 도메인과 Storage CORS를 검토합니다.

## 현재 설계와 파일 위치

- `booth.html`, `app.js`: 학생 3단계 UI(용도·프레임 → 촬영 → 꾸미기·저장), 연속 촬영 완료 후 자동 이동, 회전 손잡이·두 손가락 크기·회전, 선택형 제출과 기존 저장·공유.
- `decoration-geometry.js`: 회전 좌표·선택 판정·각도 변화.
- `sharing.js`: 공유 설정 정규화, 공개 필드 제한, 개발자 정보 붙여넣기 추출, 선택형 수합 요청.
- `collection-setup.html`, `integrations/google-collection/`: 교사 소유 Google Apps Script 수합 도우미와 설치 안내. API 키는 Script Properties, 학생 이미지는 교사의 Drive에만 저장합니다.
- `core.js`: 컷 수·프레임·사용자 지정 `photoSlots` 정규화와 공통 좌표 계산.
- `frame-upload.js`: 프레임 이미지 배치, 사진 칸별 이동·모서리/두 손가락 크기 조절·좌표 입력.
- `editor-view.js`: 학생 꾸미기 화면 100~400% 보기 확대·화면 이동. 출력 크기와 독립적입니다.
- `layout-guide.js`: 공통 layout 좌표로 용도·컷 수·프레임 카드와 사진 공간 안내를 렌더링합니다.
- `scripts/check-hosting.mjs`: 두 Hosting 대상과 학생 빌드의 관리자 모듈 분리를 검사합니다.
- `export-formats.js`: 사각형 비율 선택 카드, 카톡·인스타·인화·A4·대표 비율과 여백 맞춤 저장.
- `admin.js`, `libraries.js`, `frame-editor.js`, `frame-preview.js`, `branding.js`: 교사 행사·보관함·학교 설정·로고/문구 위치 편집.
- `cloud.js`: 운영자 Firebase Auth/Firestore/Storage. `public-event.js`: 로그인 없는 학생의 게시 행사 단건 읽기.
- `optimize.js`, `webp-worker.js`: 교사 이미지 WebP 최적화. `print-png.js`: PNG 300dpi 메타데이터.
- `firestore.rules`, `storage.rules`: 계정별 자료 격리, 학생 쓰기 금지, 공용 자료 운영자 제한.
- `mobile.css`, `admin.css`, `style.css`: 반응형 화면. `public/`: 케리스 배움체·브랜드 이미지·PWA/OG 아이콘·라이선스.

## 반드시 유지할 조건

1. 학생 사진·완성 이미지는 Firebase/앱 서버에 저장하지 않습니다. 기본 촬영·꾸미기는 기기에서 처리하고, 학생이 명시적으로 제출한 완성 이미지 한 장만 교사 소유 수합 도우미를 거쳐 교사의 Drive·선택한 Padlet에 전송할 수 있습니다. 자동 수합은 교사 Apps Script 설치와 키 연결 후 사용합니다. API 키는 공개 행사·학생 코드에 포함하지 않습니다.
2. 공식 `/`는 운영자 페이지, 학생은 행사별 `/booth.html?event=...`로 들어옵니다. 학생 화면에는 운영자 이동 버튼을 넣지 않습니다.
3. 일반 교사의 탭은 내 행사·활동 / 프레임 보관함 / 디자인 보관함 / 내 학교. 인증된 `dltjdrms320@gmail.com`만 공용 자료 관리 탭에서 공용 이미지·프레임을 등록합니다. UI와 서버 규칙 모두 권한을 검사합니다.
4. 교사 업로드 디자인과 선택한 사진 칸 좌표는 계정별 또는 공용 자료로 저장합니다. 행사에는 선택한 디자인과 좌표가 복사됩니다.
5. 앱 안 촬영의 미리보기와 실제 캡처는 선택한 사진 칸의 비율 및 중앙 crop 기준을 공유합니다. 기본 카메라의 전·후면 선택 UI는 기기에 맡깁니다.
6. 사제동행 찰칵! 포토 명칭·기존 로고·케리스 배움체를 유지합니다.

새 컴퓨터의 코딩 도구에는 다음처럼 요청하면 됩니다.

> 이 저장소의 AGENTS.md, README.md, docs/HANDOFF.md를 먼저 읽고 기존 Firebase 프로젝트와 사진 브라우저 처리 원칙을 유지하며 작업을 이어가 주세요.

수합·공유 검증: `npm test`에는 수합 도우미 모의 서비스 검증(소유권, 제출 동의, 중복, 비공개 Drive, Padlet 부분 실패)도 포함됩니다. 실제 Padlet 게시와 Drive 권한·Apps Script CORS는 해당 교사 계정의 배포 URL·게시판 연결 후 실서비스 검수가 필요합니다.

### 문구 상자와 확인창
교사 행사 설정은 행사명·학교명·일정 외에 추가 문구 상자를 최대 8개 저장합니다. 글꼴·상자 크기·전체 색상과 글자별 크기(50~300%)·색상을 지정할 수 있습니다. 글자 선택은 이모지 등의 결합 문자 단위이며 문구 수정 시 유지된 앞뒤 글자의 스타일을 보존합니다. 학생 꾸미기의 추가 문구에도 같은 조절기를 사용합니다. `text-colors.js`의 공통 측정·그리기를 교사 미리보기, 학생 화면과 PNG 출력에 사용합니다.
프레임 편집의 배치 범위 선택은 제거했습니다. 이동한 요소는 전체 프레임 좌표로 저장하고, 상단·하단에 놓인 요소는 용도 변경 시 함께 변환합니다. 앱의 확인창은 `app-dialog.js`를 사용하며 확인은 왼쪽, 취소는 오른쪽입니다. 브라우저 종료·새로고침 시 저장하지 않은 작업에 대한 경고는 브라우저의 beforeunload 동작을 유지합니다.

프레임 확대 편집 상단의 **가로·세로 비교**에서 프레임·컷 수·출력 용도를 바꾸며 읽기 전용으로 두 배치를 비교할 수 있습니다. 기본 규격은 방향별 세로·가로 크기를 사용하고, 특정 출력 용도를 고르면 학생 화면과 같은 크기·여백으로 표시합니다. 제작 방향이 고정된 이미지 프레임은 지원하는 방향만 표시하며, 비교창의 선택은 행사 설정이나 편집 중인 배치를 변경하지 않습니다.

### 운영 대시보드와 익명 이용 집계
운영 현황은 요약·사용 분석·행사 검토·사용자 관리 탭으로 구분합니다. KPI는 Firestore 전체 집계 쿼리로 구하고 목록은 100건씩 읽어 10건 단위로 표시합니다. 요약은 기간별 추이·게시/가입 차트·최근 행사 3건을 표시합니다. 사용자 수는 `userDirectory`에 로그인으로 등록된 교사 계정 기준이며 기존 미등록 계정은 다음 로그인 때 나타납니다. `createdAt`은 Firebase Auth의 계정 생성 시각에서 한 번 기록하고, 확인하지 못한 가입일은 별도로 표시합니다.
학생 페이지는 실제 게시 행사에서 받은 페이지 열림·제작 시작·웹 촬영·사진 등록·완성 단계·저장 요청·공유 실행·제출 성공 횟수를 `usageDaily`에 원자 증가로 합산합니다. 사진·파일명·IP·학생 계정/기기 식별자를 보내지 않습니다. 한국 자정 기준 날짜와 행사 ID, 8개 집계 조각만 사용합니다. 읽기는 지정 운영자에게만 허용하며 공개 행사/현재 날짜/한 번에 +1인 쓰기만 허용합니다. 미리보기·demo 경로는 집계하지 않습니다. 파일 선택과 기본 카메라는 사진 등록, 게시판 열기는 공유 실행에 포함됩니다. 고유 방문자 수나 갤러리 저장 확인 수치가 아니며 반복·누락이 있을 수 있습니다. 과거의 미기록 사용량을 추정하지 않습니다.
행사 검토창은 최신 이벤트를 읽어 프레임·문구·스티커를 보여 줍니다. 게시 중지는 검토한 `updatedAt`과 최신값이 같은지 트랜잭션에서 확인하고 `moderationActions` 기록을 함께 저장합니다. 촬영한 학생 사진은 검토하거나 수합하지 않습니다. 운영자에게는 비공개 행사 단건 조회를 허용합니다.

### 이미지 프레임 등록과 배치 미리보기
내 프레임·공용 프레임 등록은 규격 선택 → 파일 선택 시 배치 미리보기 → 이미지 이동·확대 → 배치 적용 → 이름 확인 및 등록 순서입니다. 최종 등록 전에는 파일을 전송하지 않습니다. 방향과 컷 수는 미리보기 전용이며 이미지를 다시 자르거나 등록 제한으로 저장하지 않습니다. 새 프레임은 `layoutCount:0`, `preserveAspect:true`로 원본 규격을 보존하고 모든 컷·배치에 사용할 수 있습니다. 사진 칸 자동 비우기를 선택하면 원본은 보존하고 `frame-overlay.js`가 실제 공통 layout의 사진 칸만 렌더링 시 비웁니다. 행사·정보 설정에 따라 사진 칸 위치는 달라질 수 있습니다. 투명 PNG 장식을 사진 위에 겹치려면 자동 비우기를 해제합니다. 기존 `layoutCount`가 지정된 프레임·사용자 사진 칸은 종전 동작을 유지합니다.

### 기본 스티커 100종과 행사별 선택
기본 스티커는 기존 마스코트 WebP 4종 + 프로젝트 원본 SVG 일러스트 96종으로 총 100종입니다. 이전 30개 preset ID와 경로는 유지하되 디자인을 개선했습니다. `scripts/generate-stickers.mjs`로 96종과 `sticker-presets.js`를 재생성합니다. 기존 행사의 선택 목록을 자동으로 늘리지 않습니다. 행사 설정에서 전체 선택 후 저장하면 100종을 사용할 수 있습니다.
`sticker-selector.js`는 전체 선택·해제, 테마·이름 검색, 선택 개수, 스크롤 가능한 목록, 드래그 범위 선택·해제를 제공합니다. 전체 선택·해제는 검색 결과뿐 아니라 모든 자료에 적용됩니다. 마우스는 누른 채 이동, 터치는 ‘드래그 선택’ 모드를 먼저 켠 후 이동하며 가장자리에서 자동 스크롤합니다. 모드를 끄면 일반 터치 스크롤이 가능합니다. 키보드는 Tab·Space/Enter를 사용합니다. 교사 보관함과 학생 도구에도 테마 필터가 있습니다.
행사별 스티커 상한은 정규화·편집기·Firestore 규칙 모두 256개입니다. 학생은 행사에 저장된 스티커만 표시·로드하며 전체 해제 상태도 그대로 유지합니다. 기본 프리셋을 임의로 다시 합치지 않습니다.
