## 📈 연구 성과 및 정량 지표

* **주제 분류 모델**: 독립 테스트 데이터셋 기준 **92%**의 분류 정확도 달성
* **정치 편향 진단 모델 (`BiasAnalyzer`)**: 5,000개 미만의 소규모 데이터셋 환경에서 최적화 전략을 통해 **78% (최대 83% 앙상블)**의 분류 정확도를 확보하여, 대규모 데이터셋(1,150만 개)을 사용한 선행 연구(POLYTC, 정확도 75%) 대비 구조적 유효성 및 고효율 라벨링 프로세스의 우수성을 입증

---

## 🛠️ 기술 스택 (Tech Stack)

### Front-End
* Framework: **React (v18+)**
* Styling: **Tailwind CSS (v4)**, Framer Motion (애니메이션)
* Visualization: **Recharts**
* State & Context: React Context API, LocalStorage API

### Deep Learning & NLP (Core Line)
* Models: **KcELECTRA**, **KoELECTRA**, Claude 3.5 Sonnet (LLM Few-shot Annotation 데이터 구축용)
* Framework: PyTorch, Hugging Face Transformers
* Tokenizer: Bert WordPieceTokenizer

---

## 🚀 시작하기 (Getting Started)

### Prerequisites
일부 서드파티 라이브러리 간의 버전 의존성 충돌(`peerDependency`) 이슈가 존재하므로, 패키지 설치 시 반드시 패키지 빌드 충돌 방지 옵션을 사용하여 설치해야 정상 구동됩니다.

```bash
# 1. 저장소 복제 및 프론트엔드 디렉터리 이동
git clone [https://github.com/YOUR_GITHUB_USERNAME/biasanalyzer.git](https://github.com/YOUR_GITHUB_USERNAME/biasanalyzer.git)
cd biasanalyzer/react/front

# 2. 의존성 패키지 강제 설치 (legacy-peer-deps 필수)
npm install --legacy-peer-deps

# 3. 로컬 개발 서버 실행
npm start