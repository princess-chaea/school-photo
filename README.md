# 사제동행 찰칵! 포토

학교 행사에서 QR로 참여하는 모바일 포토부스입니다. 공식 첫 화면은 운영자 Google 로그인입니다. 참가자는 행사 QR로 촬영 화면에 바로 접속하며, 참가자 화면에는 운영자 링크가 없습니다.

## 실행

Node.js 22.12 이상 또는 24 LTS를 사용하세요.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell에서는 `Copy-Item .env.example .env.local`을 사용합니다. `.env.local`에 Firebase 웹 앱 설정을 입력하면 Google 로그인과 내 계정 보관함이 활성화됩니다. 설정이 없을 때는 체험 모드이며 클라우드 저장·게시·QR 발급은 활성화되지 않습니다.

## 운영 흐름

1. 공식 주소(`/`)에서 Google 로그인합니다.
2. **내 학교**에서 학교명·로고를 미리 저장합니다. 새 행사에 기본 적용되며 기존 행사는 유지됩니다.
3. **디자인 보관함**에 로고·프레임·꾸미기 이미지를 누적합니다. PNG·JPG·WebP 원본(20MB 이하)을 받으며 브라우저에서 크기 조정 및 WebP 변환 후 업로드합니다. 투명도는 유지하고 EXIF 등 원본 메타데이터는 업로드하지 않습니다.
4. **내 행사·활동 → 새 행사**에서 행사명·일정·학교 정보, 사용할 프레임·스티커·계정별 이미지를 선택합니다. 행사 화면에서도 로고를 바로 업로드할 수 있습니다.
5. 참가자 미리보기로 확인하고 **저장하고 게시 → QR 저장**으로 안내합니다.
6. 참가자는 `/booth.html?event=행사ID`로 접속해 2·4·6·8컷 → 프레임 → 촬영 → 꾸미기 → 저장을 진행합니다.

게시된 행사 수정은 기존 QR에도 반영됩니다. 이전 버전을 보존하려면 **복제** 후 새로 게시하세요. 게시 중지·삭제하면 해당 QR로 새로 열 수 없습니다. 이미 열려 있거나 다운로드한 디자인/사진까지 회수하는 기능은 아닙니다.

## 참가자 기능

- HTTPS 카메라 권한 요청, 전·후면 전환, 0·3·5초 타이머, 단일·연속 촬영, 취소·재촬영
- 카메라 없이 내 사진 선택 또는 샘플 체험
- 사진별 확대·좌우·상하 구도 조정, 사진 드래그 및 두 손가락 확대
- 전체 필터, 기본 이미지 스티커 4종과 심볼, 교사가 선택한 이미지, 문구
- 스티커·문구를 터치로 이동, 모서리 또는 두 손가락으로 크기 조절, 삭제
- 사진을 누르면 확대 편집. 확대 편집에서는 **돌아가기**만 제공하며 전체 꾸미기 화면의 **완성하기**에서만 저장 단계로 진행
- 사진·프레임·학교 정보·스티커·문구를 합친 한 장의 PNG 다운로드 또는 파일 공유
- 모바일/태블릿 학생 화면은 100dvh를 기준으로 이전·다음 버튼을 화면 안에 고정. 작은 화면의 도구 영역만 내부 스크롤 가능

2·4컷은 세로 스트립, 6·8컷은 두 열 그리드입니다. 완성 파일 폭은 스트립 720px, 그리드 1200px이며 선택한 구성에 따라 높이가 달라집니다.

## Firebase 설정

현재 프로젝트 ID는 `teacher-student-photo`입니다. 웹 앱 설정은 Firebase Console → 프로젝트 설정 → 일반 → 내 앱에서 확인하고 `.env.local`에 넣습니다. Firebase 웹 설정은 공개 클라이언트 설정이며, 데이터 보호는 아래 보안 규칙이 담당합니다. 서비스 계정 키는 이 앱에 필요하지 않습니다.

1. **Authentication → 로그인 방법 → Google** 사용 설정. 로컬 검수에는 승인된 도메인 `localhost`, 운영에는 실제 Hosting/커스텀 도메인이 필요합니다.
2. **Cloud Firestore → Standard → 프로덕션 모드**로 생성하고 `firestore.rules`를 배포합니다. 이 프로젝트는 서울(`asia-northeast3`) 리전을 선택했습니다.
3. **Storage** 버킷을 생성하고 `storage.rules`를 배포합니다. Cloud Storage 사용에는 현재 Blaze 요금제 연결이 필요합니다. 요금제 연결은 계정 소유자가 직접 진행해야 합니다. 비용은 설정 이미지의 저장·조회 사용량 등에 따라 달라집니다.
4. `storage.cors.json`에 실제 웹앱 도메인을 넣고 CORS를 설정합니다. Canvas에서 학교 로고·스티커를 합성하려면 이미지의 CORS 허용이 필요합니다.

```sh
gcloud storage buckets update gs://teacher-student-photo.firebasestorage.app --cors-file=storage.cors.json
```

5. `.env.local`의 `VITE_PUBLIC_BASE_URL`을 실제 HTTPS 주소로 설정하고 빌드·배포합니다.

```sh
npm run build
npx firebase login
npx firebase use teacher-student-photo
npx firebase deploy --only hosting,firestore,storage
```

공식 주소: `https://teacher-student-photo.web.app/` (Hosting 배포 이후 사용 가능). QR은 `/booth.html?event=...`로 생성됩니다. 로컬 주소로 만든 QR은 휴대폰에서 사용할 운영 QR이 아닙니다.

## 저장되는 데이터와 저장되지 않는 데이터

| 위치 | 내용 | 접근 |
|---|---|---|
| Firestore `users/{uid}/profile/school` | 학교명·기본 로고 URL | 본인 계정만 |
| Firestore `users/{uid}/assets/{assetId}` | 디자인 이름·종류·최적화 정보·URL | 본인 계정만 |
| Storage `users/{uid}/assets/{assetId}` | 최적화된 WebP 디자인 | 본인 업로드·관리, 게시한 디자인의 다운로드 URL은 참가자에게 전달 |
| Firestore `events/{eventId}` | 행사 정보·선택된 디자인·게시 상태 | 본인 관리, 게시된 행사만 참가자 단건 읽기 |
| 참가자 브라우저 메모리 | 촬영/선택 사진·편집 위치·최종 PNG | 사용자 기기 안에서만 처리 |

**참가자 사진이나 완성 이미지를 업로드하는 코드·컬렉션·Storage 경로는 없습니다.** 참가자는 로그인할 필요가 없으며 익명 사용자의 모든 쓰기를 보안 규칙에서 차단합니다. Analytics·광고·외부 폰트/CDN은 사용하지 않습니다. 로그인한 운영자의 기본 Google 프로필은 Firebase Authentication에서 관리됩니다.

사진과 편집 내용은 새로고침/탭 종료 시 사라집니다. OS나 브라우저가 메모리·임시 파일을 관리하는 방식까지 통제하는 보안 삭제 기능은 아닙니다. 모바일 저장은 브라우저에 따라 다운로드 폴더 또는 공유 시트의 이미지 저장을 사용합니다.

## 디자인 업로드 최적화

로고는 긴 변 800px, 꾸미기 이미지는 640px, 프레임은 2400px 이내로 줄이고 WebP로 변환합니다. 기본 브라우저 인코더를 우선 사용하며 지원하지 않는 브라우저는 Web Worker의 libwebp WASM 인코더를 사용합니다. 원본 파일은 업로드하지 않습니다. 압축 결과가 4MB 이상이면 더 압축하거나 업로드를 거절합니다.

투명 프레임 이미지는 전체 결과물에 맞춰 늘어납니다. 여러 컷 수에 공통으로 사용할 프레임은 장식을 가장자리에 배치하거나, 구성별 디자인을 따로 만들어 행사에서 선택하세요. 투명도가 필요한 프레임은 PNG/WebP로 준비하세요. JPG는 불투명하므로 사진을 가릴 수 있습니다.

행사에서 사용 중인 디자인과 기본 학교 로고는 보관함에서 바로 삭제하지 못하도록 UI에서 확인합니다. 공개 행사에 포함된 디자인 URL은 공개 자료로 취급하세요. 보관함 목록과 다른 운영자의 편집 권한은 분리됩니다.

## 검증

```sh
npm test
npm run build
```

Firebase 규칙 통합 테스트는 Java 21 및 Firebase CLI가 필요합니다. 테스트는 실제 프로젝트를 사용하지 않습니다.

```sh
npx firebase emulators:exec --project demo-school-photo --only firestore,storage "node --test tests/security.rules.test.mjs"
```

기본 테스트는 2·4·6·8컷 배치/경계, 사진 크롭 경계, QR 참가자 경로, 외부 행사 URL 정제를 검사합니다. 규칙 테스트는 소유자 격리, 공개 행사 단건 읽기, 비공개 읽기 차단, 학교 설정 격리, 참가자 쓰기 차단, 디자인 업로드 형식·용량을 검사합니다.

UI 검수용 주소는 `/?demo=1`(실제 클라우드 저장 없는 운영자 체험), `/booth.html?demo=1`(일반 샘플 촬영)입니다. `/?demo=1&wasm=1`은 WebP 폴백 인코더 검수용입니다. 운영자 화면에는 이 검수 경로를 참가자에게 배포하는 버튼이 없습니다.

## 파일 구성

- `index.html`, `admin.js`, `admin.css`: 운영자 로그인·학교·행사·보관함·QR
- `booth.html`, `app.js`: 참가자 촬영·편집·합성·로컬 저장
- `core.js`: 프레임·스티커·배치·크롭·행사 설정 검증
- `cloud.js`: Google 로그인 및 운영자 Firebase 데이터 접근, 게시 행사 읽기
- `optimize.js`, `webp-worker.js`: 운영자 이미지 최적화
- `icons.js`: 로컬 SVG UI 아이콘
- `style.css`, `mobile.css`: 공통 스타일·폰트·모바일 고정 화면·확대 편집
- `public/`: WebP 로고·기본 스티커·케리스 배움체
- `firestore.rules`, `storage.rules`: 계정별 접근 제어

`.env.local`, `node_modules`, `dist`, Firebase 디버그 로그는 Git에 올리지 않습니다. GitHub에서 소스를 받으면 `npm ci`로 설치하세요.

## 출처

로고·기본 이미지 스티커는 이 프로젝트를 위해 생성했습니다. UI 아이콘은 프로젝트 내 SVG 경로입니다. 케리스 배움체는 사용자가 제공한 원본에서 웹용 WOFF2로 압축했으며 KERIS 학교 안심폰트/OFL 안내를 함께 제공합니다. 자세한 내용은 `THIRD_PARTY_NOTICES.md`와 `public/fonts/`를 확인하세요.

Firebase 공식 문서: [Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Storage 요금제 요건](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Canvas 이미지 CORS를 위한 Storage 설정](https://firebase.google.com/docs/storage/web/download-files#cors_configuration).
