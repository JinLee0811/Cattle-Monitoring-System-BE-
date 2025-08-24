# 🐄 Cattle Monitoring System Backend

소 모니터링 프로토타입 시스템의 백엔드 API 서버입니다.

## 🛠 기술 스택

- **Node.js** + **Express.js** - 서버 프레임워크
- **MongoDB** + **Mongoose** - 데이터베이스
- **Multer** - 파일 업로드 처리
- **Axios** - 외부 API 통신
- **JWT** - 인증 토큰
- **OpenWeatherMap API** - 날씨 정보
- **Roboflow API** - AI 비디오 분석 (모킹)

## 📁 프로젝트 구조

```
Backend/
├── controllers/          # 비즈니스 로직
│   ├── uploadController.js
│   └── analysisController.js
├── middleware/           # 미들웨어
│   ├── auth.js
│   └── errorHandler.js
├── models/              # MongoDB 스키마
│   ├── Video.js
│   └── Alert.js
├── routes/              # API 라우터
│   ├── auth.js
│   ├── upload.js
│   ├── weather.js
│   ├── analysis.js
│   └── soundCheck.js
├── services/            # 외부 서비스 통합
│   ├── roboflowService.js
│   └── weatherService.js
├── utils/               # 유틸리티
│   └── logger.js
├── uploads/             # 업로드된 파일 저장소
├── logs/                # 로그 파일
├── server.js            # 메인 서버 파일
├── package.json
└── README.md
```

## 🚀 설치 및 실행

### 1. 의존성 설치

```bash
cd Backend
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/cattle-monitoring

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Admin Password (for simple auth)
ADMIN_PASSWORD=admin123

# External APIs
ROBOFLOW_API_KEY=your-roboflow-api-key
ROBOFLOW_API_URL=https://api.roboflow.com/detect
OPENWEATHER_API_KEY=your-openweather-api-key
OPENWEATHER_API_URL=https://api.openweathermap.org/data/2.5

# File Upload Configuration
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads
```

### 3. MongoDB 실행

MongoDB가 로컬에서 실행 중인지 확인하세요:

```bash
# MongoDB 시작 (macOS)
brew services start mongodb-community

# 또는 Docker 사용
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

서버가 `http://localhost:5000`에서 실행됩니다.

## 📡 API 엔드포인트

### 🔐 인증

- `POST /api/auth` - 패스워드 인증

### 📹 비디오 업로드

- `POST /api/upload` - 비디오 업로드 및 분석
- `GET /api/upload` - 업로드된 비디오 목록
- `DELETE /api/upload/:videoId` - 비디오 삭제

### 🌤️ 날씨 정보

- `GET /api/weather?lat=xx&lon=yy` - 현재 날씨 정보
- `GET /api/weather/forecast?lat=xx&lon=yy` - 날씨 예보
- `GET /api/weather/alerts?lat=xx&lon=yy` - 날씨 경고

### 📊 분석 결과

- `GET /api/analysis/:videoId` - 특정 비디오 분석 결과
- `GET /api/analysis/summary` - 분석 결과 요약
- `GET /api/analysis/patterns` - 이상 행동 패턴
- `GET /api/analysis/tracking` - 소 개체 수 추적

### 🔊 사운드 체크 (미래 기능)

- `POST /api/sound-check` - 오디오 분석
- `GET /api/sound-check/status` - 기능 상태 확인

### 🏥 헬스 체크

- `GET /api/health` - 서버 상태 확인

## 🔧 주요 기능

### 1. 비디오 업로드 및 AI 분석

- 다양한 비디오 형식 지원 (MP4, AVI, MOV, WMV, FLV, WebM, MKV)
- 파일 크기 제한 (기본 100MB)
- Roboflow AI 모델을 통한 소 감지 및 이상 행동 분석
- 비동기 처리로 빠른 응답

### 2. 날씨 통합

- OpenWeatherMap API 연동
- 실시간 날씨 정보 및 경고
- 소 사육에 영향을 주는 날씨 조건 분석
- 위치 기반 날씨 데이터

### 3. 알림 시스템

- 이상 행동 감지 시 자동 알림
- 날씨 경고 알림
- 소 미감지 알림
- 실시간 알림 생성

### 4. 데이터 분석

- 소 개체 수 추적
- 이상 행동 패턴 분석
- 날씨별 분석 결과 통계
- 시간대별 패턴 분석

### 5. 보안

- 간단한 패스워드 기반 인증
- JWT 토큰 관리
- 파일 업로드 보안
- Rate limiting

## 🧪 개발 모드

개발 모드에서는 다음 기능들이 활성화됩니다:

- **모킹 데이터**: API 키가 없어도 모킹 데이터로 테스트 가능
- **상세 로깅**: 모든 요청과 응답이 로그 파일에 기록
- **에러 스택 트레이스**: 개발 환경에서 상세한 에러 정보 제공
- **Hot Reload**: nodemon을 통한 자동 서버 재시작

## 📝 로그 시스템

모든 API 요청과 시스템 이벤트가 `logs/` 디렉토리에 일별로 기록됩니다:

- `YYYY-MM-DD.log` - 일별 로그 파일
- 로그 레벨: INFO, WARN, ERROR, DEBUG
- 구조화된 로그 형식

## 🔮 향후 계획

### Phase 2 (Q2 2024)

- [ ] 사운드 분석 기능 구현
- [ ] 실시간 스트리밍 지원
- [ ] 모바일 앱 API
- [ ] 고급 알림 시스템

### Phase 3 (Q3 2024)

- [ ] 머신러닝 모델 개선
- [ ] 예측 분석 기능
- [ ] 대시보드 API
- [ ] 사용자 관리 시스템

## 🐛 문제 해결

### MongoDB 연결 실패

```bash
# MongoDB 상태 확인
brew services list | grep mongodb

# MongoDB 재시작
brew services restart mongodb-community
```

### 포트 충돌

```bash
# 포트 사용 확인
lsof -i :5000

# 다른 포트 사용
PORT=5001 npm run dev
```

### 파일 업로드 실패

- 파일 크기 제한 확인
- 지원되는 파일 형식 확인
- 업로드 디렉토리 권한 확인

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. 로그 파일 확인 (`logs/` 디렉토리)
2. 환경 변수 설정 확인
3. MongoDB 연결 상태 확인
4. API 키 유효성 확인

## �� 라이선스

MIT License
