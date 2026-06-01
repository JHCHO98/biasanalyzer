# BiasAnalyzer: Deep Learning-Based Video Consumption & Confirmation Bias Diagnosis Tool 📊

> **제72회 경기도과학전람회 출품작 (산업 및 에너지 부문 / 출품번호: 산-29)**
> **딥러닝으로 분석하는 영상 시청 패턴과 확증편향: 콘텐츠 진단 모델 기반의 확증 편향 자각 도구 구현**

본 프로젝트는 사용자의 유튜브 시청 기록을 기반으로 미디어 소비 패턴의 관심사를 정밀 분류하고, 추천 알고리즘에 의해 심화되는 정치적 확증편향 및 '필터 버블(Filter Bubble)' 현상을 정량적으로 진단·시각화하여 사용자의 '편향 맹점(Bias Blind Spot)' 극복을 돕는 **2단계 딥러닝 분석 파이프라인 기반 웹 시스템**입니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 1차 진단: 사용자 시청 기록 기반 14개 주제 분류
* **KOELECTRA 기반 파인튜닝**: 기존 유튜브 API의 낮은 분류 정확도를 보완하여, 영상 제목과 댓글을 바탕으로 게임, 과학과 기술, 정치 등 **14개 핵심 카테고리**로 정밀 분류합니다.
* **소비 다양성 지수 산출**: 시청 패턴의 분포를 기반으로 **Shannon Entropy**를 정규화(0~1)하여 관심사의 편중도를 정량화합니다.

### 2. 2차 진단: 4단 병렬 어텐션 기반 정치적 편향성 예측
* **텍스트 정보 불균형 해소**: 짧고 압축적인 '영상 제목'과 파편화되고 긴 '댓글 텍스트'의 특성을 반영한 **4단 병렬 어텐션 구조(Self-Attention 2개 + Cross-Attention 2개)**를 제안하여 문맥과 여론 반응을 유기적으로 통합합니다.
* **정량적 필터 버블 지수(FBS) 도입**: 단순 비율 집계를 넘어 모델의 불확실성(Softmax Confidence)과 시청 최신성(지수 감쇠 시간 가중치)을 반영한 독자적 지표 $FBS$를 산출합니다.

### 3. 웹 기반 인터랙티브 분석 대시보드 (React)
* **Recharts 기반 시각화**: 관심사 도넛 차트 및 과거부터 현재까지의 편향 변화 추이를 추적하는 시계열 **Bias Drift Chart**를 제공합니다.
* **사용자 편의 기능**: Canvas API 활용 신경망 애니메이션 랜딩 페이지, 전역 테마 관리(Dark/Light Mode), 그리고 분석 결과를 즉시 문서화할 수 있는 **PDF 보고서 추출 기능**을 포함합니다.

---

## 🏗️ 시스템 아키텍처 (Model Architecture)

### 📊 2단계 정치 편향 진단 모델 (`BiasAnalyzer`)
```text
[Input] Video Title  &  Top Comments (max. 100)
         │                   │
         ▼                   ▼
   [KcELECTRA]          [KcELECTRA]
   (Title Vec 768d)   (Comment Vec 768d)
         │                   │
         └─────────┬─────────┘
                   ▼
┌──────────────────┴────────────────────────────────┐
│                   [Attention Fusion]              │
│  ├─ Self Attn (Comment)                           │
│  ├─ Cross Attn (Title -> Comment)                 │
│  ├─ Cross Attn (Comment -> Title)                 │
│  └─ Self Attn (Title)                             │
└──────────────────┬────────────────────────────────┘
                   ▼
       [Concatenation] (3072d Vector)
                   │
                   ▼
       [3-Layer FC Classifier] 
    (with ReLU, Dropout, Label Smoothing)
                   │
                   ▼
    [Output] Progressive / Neutral / Conservative
```

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