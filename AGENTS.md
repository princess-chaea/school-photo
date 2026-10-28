# 프로젝트 작업 안내

먼저 README.md와 docs/HANDOFF.md를 읽으세요.

- 앱은 Vite + JavaScript + Firebase입니다. 새 스택이나 Firebase 프로젝트로 교체하지 않습니다.
- 학생 사진과 완성 이미지는 브라우저에서만 처리하며 서버 업로드·분석 수집을 추가하지 않습니다.
- 학생 UI는 모바일/태블릿 기준으로 검수합니다. 학생 화면에 운영자 링크를 추가하지 않습니다.
- 프레임 사진 칸 좌표는 core.js의 공통 layout/normalizeSlots를 사용해 운영자 미리보기·학생 촬영·꾸미기·출력에 동일하게 적용합니다.
- 꾸미기의 보기 확대는 이미지/스티커 출력 크기와 구분합니다. 비율 프리셋은 전체 프레임을 여백 맞춤으로 보존합니다.
- 계정별 자산과 공용 자산의 권한을 구분하고 Firebase 규칙을 함께 유지합니다.
- 기본 카메라 호출은 OS가 제어합니다. 웹 카메라 미리보기와 캡처의 crop/좌우 반전은 일치시킵니다.
- 실행: npm ci, npm run setup, npm run dev. 검증: npm test, npm run build. 규칙 변경 시 docs/HANDOFF.md의 에뮬레이터 테스트를 실행합니다.
- .env.local·인증 토큰·서비스 계정 파일·node_modules·dist는 Git에 넣지 않습니다. 배포는 Firebase이며 Git push만으로 자동 배포되지 않습니다.
- 실기기에서 확인하지 않은 카메라·터치·공유·인쇄 동작을 검증 완료라고 보고하지 않습니다.
