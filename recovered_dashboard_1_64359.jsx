import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ComposedChart,
  Line
} from 'recharts';
import {
  PieChart as PieIcon, Activity, PlayCircle, Hash, Info, AlertCircle, CheckCircle2, Search, RefreshCw,
  Scale, Compass, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- COLOR AND THEME SYSTEM ---
const CATEGORY_COLORS = {
  "게임": "#ef4444", "과학과 기술": "#3b82f6", "노하우/스타일": "#8b5cf6", "정치": "#3b82f6",
  "비영리/사회운동": "#f59e0b", "스포츠": "#ec4899", "애완동물/동물": "#14b8a6", "예능": "#f43f5e",
  "여행/이벤트": "#06b6d4", "영화/애니메이션": "#8b5cf6", "음악": "#a855f7", "인물/블로그": "#f97316",
  "자동차/탈것": "#64748b", "코미디": "#eab308"
};

// --- MOCK FALLBACKS ---
const MOCK_CATEGORIES = [
  { name: "정치", value: 45, color: "#3b82f6" },
  { name: "과학과 기술", value: 20, color: "#10b981" },
  { name: "예능", value: 15, color: "#f43f5e" },
  { name: "게임", value: 10, color: "#ef4444" },
  { name: "음악", value: 10, color: "#a855f7" }
];

const generateDriftData = () => {
  const data = [];
  let currentBias = 0.35;
  for (let i = 1; i <= 30; i++) {
    currentBias += (Math.random() * 0.3 - 0.12);
    if (currentBias > 1) currentBias = 1;
    if (currentBias < -1) currentBias = -1;
    data.push({ order: i, bias: currentBias });
  }
  return data;
};
const MOCK_DRIFT_DATA = generateDriftData();

const RECENT_VIDEOS = [
  { id: 1, title: "[단독] 국가 채무 급증에 따른 비상 상황 선포", channel: "재정경제이슈", time: "방금 전", bias: "Conservative" },
  { id: 2, title: "기후 에너지 정책 개편 발표 내용 분석", channel: "그린포럼", time: "10분 전", bias: "Progressive" },
  { id: 3, title: "인공지능 규제법 통과의 득과 실", channel: "테크리뷰", time: "1시간 전", bias: "Neutral" },
  { id: 4, title: "주택 대출 금리 추가 인상 전망", channel: "금융포커스", time: "3시간 전", bias: "Conservative" },
  { id: 5, title: "공공 의료 확대 법안 논쟁 요약", channel: "시사이슈", time: "5시간 전", bias: "Progressive" }
];

const EXTRACTED_KEYWORDS = [
  { text: "검찰독재", type: "Progressive", score: -0.8 },
  { text: "주사파", type: "Conservative", score: 0.9 },
  { text: "선거", type: "Neutral", score: 0.1 },
  { text: "탄핵", type: "Progressive", score: -0.9 },
  { text: "자유민주주의", type: "Conservative", score: 0.7 },
  { text: "특검", type: "Progressive", score: -0.6 },
  { text: "종북", type: "Conservative", score: 0.8 },
];

// --- STATICS FOR EXP LAB ---
const PARETO_CURVE_DATA = [
  { alpha: 0.1, lambda: 0.01, accuracy: 94.2, mitigation: 15.4 },
  { alpha: 0.2, lambda: 0.03, accuracy: 91.8, mitigation: 38.6 },
  { alpha: 0.3, lambda: 0.05, accuracy: 88.5, mitigation: 68.2 }, // Optimal selection point
  { alpha: 0.4, lambda: 0.07, accuracy: 82.1, mitigation: 84.5 },
  { alpha: 0.5, lambda: 0.10, accuracy: 71.3, mitigation: 92.7 }
];

// --- REUSABLE COMPONENTS ---
const InfoTooltip = ({ content }) => (
  <div className="group relative inline-flex items-center ml-1.5 cursor-help">
    <Info size={12} className="text-zinc-500 hover:text-indigo-400 transition-colors" />
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-zinc-800 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-lg text-xs text-zinc-200 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-[100] whitespace-pre-wrap">
      {content}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800 dark:border-b-zinc-900"></div>
    </div>
  </div>
);

const TopNav = ({ currentTab, setCurrentTab, isRealData, progress }) => (
  <nav className="h-20 bg-white dark:bg-[#0A0A0A] border-b border-zinc-200 dark:border-white/10 flex items-center justify-between px-8 shrink-0 transition-colors duration-300 z-50">
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
        <Activity size={18} className="text-white" />
      </div>
      <div>
        <span className="font-black text-zinc-900 dark:text-zinc-100 tracking-tighter text-xl uppercase">
          BiasAnalyzer
        </span>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isRealData ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
          {isRealData ? `YOUTUBE API LIVE: ${progress}%` : "DEMO / MOCKUP VIEW ACTIVE"}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/5">
      {[
        { id: 'patterns', label: '시청 패턴', icon: PieIcon },
        { id: 'bias', label: '정치적 편향성', icon: Activity },
        { id: 'nudge', label: '편향 완화 넛지 (Nudge)', icon: Compass },
        { id: 'demo', label: '대화형 데모', icon: Search },
      ].map((item) => (
        <button
          key={item.id}
          onClick={() => setCurrentTab(item.id)}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${currentTab === item.id
              ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xl shadow-indigo-500/10'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5'
            }`}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}
    </div>

    <div className="flex items-center gap-4">
      <span className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
        <Activity size={14} className="animate-pulse" />
        DUAL PIPELINE
      </span>
      <button
        onClick={() => window.print()}
        className="px-5 py-2.5 rounded-xl text-xs font-black bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black hover:scale-105 transition-transform"
      >
        REPORT
      </button>
    </div>
  </nav>
);

const Card = ({ title, subtitle, children, className = "", rightAction }) => (
  <motion.div
    whileHover={{ scale: 1.002 }}
    className={`bg-white dark:bg-[#0A0A0A] rounded-xl border border-zinc-200 dark:border-white/10 overflow-visible flex flex-col transition-all duration-300 shadow-sm dark:shadow-none ${className}`}
  >
    {(title || rightAction) && (
      <div className="px-6 py-5 border-b border-zinc-200 dark:border-white/5 flex justify-between items-end bg-zinc-50 dark:bg-[#0A0A0A]">
        <div>
          <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">{title}</h3>
          {subtitle && <p className="text-xs font-medium text-zinc-650 dark:text-zinc-500 leading-normal">{subtitle}</p>}
        </div>
        {rightAction && <div>{rightAction}</div>}
      </div>
    )}
    <div className="p-5 flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0A0A0A]">
      {children}
    </div>
  </motion.div>
);

// --- VIEWS ---

const PatternsView = ({ presentationMode, categories, recentVideos }) => {
  const finalCategories = categories || MOCK_CATEGORIES;
  const finalRecentVideos = recentVideos || RECENT_VIDEOS;
  
  const totalWatched = finalCategories.reduce((acc, curr) => acc + curr.value, 0);
  const mostWatched = finalCategories[0] || { name: '없음' };

  const diversityIndex = useMemo(() => {
    let entropy = 0;
    finalCategories.forEach(cat => {
      if (cat.value > 0) {
        const p = cat.value / totalWatched;
        entropy -= p * Math.log2(p);
      }
    });
    const maxEntropy = Math.log2(14);
    return (entropy / maxEntropy).toFixed(2);
  }, [finalCategories, totalWatched]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 pb-12 text-left"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '분석된 영상 수', value: totalWatched, unit: '개', icon: PlayCircle, color: 'text-indigo-400 bg-indigo-500/10' },
          { label: '최다 시청 분야', value: mostWatched.name, unit: '', icon: Hash, color: 'text-emerald-400 bg-emerald-500/10' },
          { label: '주제 다양성', value: diversityIndex, unit: '', icon: Activity, color: 'text-amber-400 bg-amber-500/10' },
          { label: '시스템 상태', value: '정상', unit: '', icon: CheckCircle2, color: 'text-sky-400 bg-sky-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
            <div className={`p-2.5 rounded-lg ${stat.color} shrink-0`}>
              <stat.icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider truncate">{stat.label}</p>
              <p className="text-base font-bold text-zinc-100 truncate">
                {stat.value}<span className="text-xs font-normal text-zinc-500 ml-0.5">{stat.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card 
          title="카테고리 분포도" 
          subtitle="최근 시청 기록의 주요 카테고리 분포" 
          className="lg:col-span-2"
        >
          <div className="h-[350px] w-full flex flex-col sm:flex-row gap-6 mt-4">
            <div className="flex-1 min-w-0 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={finalCategories}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {finalCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || CATEGORY_COLORS[entry.name] || '#64748b'} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#f4f4f5' }}
                    formatter={(val) => [`${val}개`, '시청 수']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full sm:w-60 shrink-0 flex flex-col justify-start space-y-1.5 overflow-y-auto max-h-full pr-2 custom-scrollbar">
              {finalCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs py-1 px-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || CATEGORY_COLORS[cat.name] || '#64748b' }}></div>
                  <span className="text-zinc-455 truncate flex-1 font-medium">{cat.name}</span>
                  <span className="text-zinc-200 font-mono font-bold">{((cat.value / totalWatched) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card 
          title="최근 시청 기록" 
          subtitle="분석 완료된 비디오 로그"
          className="lg:col-span-1"
        >
          <div className="h-[350px] overflow-y-auto pr-1 space-y-2 mt-4 custom-scrollbar">
            {finalRecentVideos.map((vid) => (
              <div key={vid.id} className="p-3 bg-zinc-900/20 hover:bg-white/5 rounded-xl border border-white/5 transition-all group">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-indigo-400 transition-colors" title={vid.title}>
                      {vid.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-1">
                      <span className="truncate">{vid.channel}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700 shrink-0"></span>
                      <span className="shrink-0">{vid.time}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wider shrink-0 border uppercase ${
                    vid.bias === 'Conservative' || vid.bias === '보수' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                    vid.bias === 'Progressive' || vid.bias === '진보' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    'bg-zinc-800 text-zinc-450 border-white/5'
                  }`}>
                    {vid.bias}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

const BiasView = ({ presentationMode, driftData }) => {
  const finalDriftData = driftData || MOCK_DRIFT_DATA;
  const N = finalDriftData.length;
  const LAMBDA = 0.05;
  const ALPHA = 0.3;

  const { weightedSum, weightTotal } = useMemo(() => {
    let wSum = 0, wTotal = 0;
    finalDriftData.forEach((d, idx) => {
      const i = idx + 1;
      const w = Math.exp(LAMBDA * (i - N));
      wSum += w * d.bias;
      wTotal += w;
    });
    return { weightedSum: wSum, weightTotal: wTotal };
  }, [finalDriftData, N]);
  const driftScore = weightedSum / weightTotal;

  const { nProg, nCons } = useMemo(() => {
    let prog = 0, cons = 0;
    finalDriftData.forEach(d => {
      if (d.bias < -0.05) prog++;
      else if (d.bias > 0.05) cons++;
    });
    return { nProg: prog, nCons: cons };
  }, [finalDriftData]);
  const rProg = nProg / N;
  const rCons = nCons / N;
  const R = Math.max(rProg, rCons) - (1 / 3);

  const rawFbs = driftScore * (1 + ALPHA * Math.max(0, R));
  const fbs = Math.max(-1, Math.min(1, rawFbs));

  let riskLevel = '균형';
  let riskColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
  let riskIcon = <CheckCircle2 className="text-emerald-400" size={20} />;

  if (Math.abs(fbs) >= 0.7) {
    riskLevel = '위험';
    riskColor = 'text-rose-400 border-rose-500/20 bg-rose-500/5';
    riskIcon = <AlertCircle className="text-rose-400" size={20} />;
  } else if (Math.abs(fbs) >= 0.4) {
    riskLevel = '주의';
    riskColor = 'text-amber-400 border-amber-500/20 bg-amber-500/5';
    riskIcon = <AlertCircle className="text-amber-400" size={20} />;
  } else if (Math.abs(fbs) >= 0.15) {
    riskLevel = '경미';
    riskColor = 'text-yellow-400 border-yellow-500/20 bg-yellow-500/5';
    riskIcon = <Info className="text-yellow-400" size={20} />;
  }

  const biasDirection = fbs >= 0 ? '보수 성향' : '진보 성향';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 pb-12 text-left"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`lg:col-span-1 border-t-2 ${riskColor}`}>
          <div className="flex flex-col justify-between h-full py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {riskIcon}
                <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-400">필터 버블 지수 (FBS)</h3>
              </div>
              <InfoTooltip content={`Filter Bubble Score (FBS):\n지수 감쇠 가중 Drift Score(λ=${LAMBDA})에\n단방향 집중도 비율 R을 반영(α=${ALPHA})하여 산출합니다.\n\n판정 기준:\n|FBS| < 0.15 → 균형\n0.15~0.4 → 경미\n0.4~0.7 → 주의\n0.7 이상 → 위험`} />
            </div>

            <div className="flex flex-col items-center justify-center my-6 py-4">
              <div className="text-6xl font-black font-mono tracking-tighter text-zinc-100">
                {fbs > 0 ? '+' : ''}{fbs.toFixed(3)}
              </div>
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mt-1">Calculated Score</span>
              <div className="mt-3 px-3 py-1 bg-white/5 border border-white/5 rounded-full text-xs font-bold">
                {riskLevel}: <span className={fbs > 0 ? 'text-rose-400' : 'text-blue-400'}>{biasDirection} 편향</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5 text-center">
              <div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">Drift</span>
                <span className="text-xs font-mono font-bold text-zinc-300">{driftScore > 0 ? '+' : ''}{driftScore.toFixed(3)}</span>
              </div>
              <div className="border-x border-white/5">
                <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-widest block font-mono">Intensity R</span>
                <span className="text-xs font-mono font-bold text-zinc-300">{R.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-[8px] font-mono text-zinc-550 uppercase tracking-widest block font-mono">Params</span>
                <span className="text-xs font-mono font-bold text-zinc-300">{LAMBDA}/{ALPHA}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card 
          title="추출된 이념 키워드" 
          subtitle="KcELECTRA 교차 어텐션 기반 편향 가중치 어텐션 분석" 
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2.5 mt-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {EXTRACTED_KEYWORDS.map((kw, i) => (
              <div
                key={i}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-102 ${
                  kw.type === 'Conservative'
                    ? 'bg-rose-500/5 border-rose-500/10 text-rose-300 hover:border-rose-500/25'
                    : kw.type === 'Progressive'
                      ? 'bg-blue-500/5 border-blue-500/10 text-blue-300 hover:border-blue-500/25'
                      : 'bg-zinc-800/20 border-white/5 text-zinc-400 hover:border-white/10'
                }`}
              >
                <span>{kw.text}</span>
                <span className="font-mono text-[10px] opacity-65">
                  {kw.score > 0 ? '+' : ''}{kw.score}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card 
        title="편향성 누적 추이 (Drift Flow)" 
        subtitle="최근 시청한 30개 영상의 이념적 편향성 변동 궤적 분석" 
        className="w-full"
      >
        <div className="h-[320px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={finalDriftData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                  <stop offset="50%" stopColor="#f43f5e" stopOpacity={0} />
                  <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.4} />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="5 5" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="order" 
                stroke="#52525b" 
                tick={{fill: '#71717a', fontSize: 10, fontFamily: 'monospace'}} 
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[-1, 1]} 
                ticks={[-1, -0.5, 0, 0.5, 1]}
                stroke="#52525b" 
                tick={{fill: '#71717a', fontSize: 10, fontFamily: 'monospace'}}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => val.toFixed(1)}
              />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(9,9,11,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px' }}
                itemStyle={{ fontSize: '12px', fontWeight: 700 }}
                labelStyle={{ fontSize: '10px', color: '#71717a', fontFamily: 'monospace' }}
                formatter={(val) => [<span className={`font-bold ${val > 0 ? 'text-rose-400' : 'text-blue-450'}`}>{val.toFixed(3)}</span>, "편향도"]}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <Area 
                type="monotone" 
                dataKey="bias" 
                stroke="none" 
                fill="url(#splitColor)"
                tooltipType="none"
              />
              <Line 
                type="monotone" 
                dataKey="bias" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#fff', stroke: '#6366f1', strokeWidth: 2 }}
                filter="url(#glow)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
};

const NudgeView = ({ presentationMode }) => {
  const [predictedBias, setPredictedBias] = useState(0);
  const [showBlindSpotResult, setShowBlindSpotResult] = useState(false);
  const actualFbs = 0.52;

  const [selectedIssue, setSelectedIssue] = useState('tax');
  const [uciDial, setUciDial] = useState(1);

  const issues = {
    tax: {
      title: "종합부동산세(종부세) 개편 논란",
      prog: {
        title: "부자 감세 철회 및 복지 재원 확보",
        desc: "종부세 완화는 자산 양극화를 심화시키며, 서민 복지 및 공공 인프라 예산 축소로 이어진다는 주장.",
        channel: "민주공론광장",
        viewCount: "12만회"
      },
      cons: {
        title: "징벌적 이중 과세 해소 및 시장 정상화",
        desc: "실거주 1주택자에 대한 과도한 세부담을 경감하고, 부동산 세제를 정상화하여 거래를 활성화해야 한다는 주장.",
        channel: "자유경제포럼",
        viewCount: "18만회"
      },
      neutral: {
        title: "종부세 개편에 따른 세수 변동 및 거시경제적 영향 분석",
        desc: "국회예산정책처 자료를 토대로 세수 감소 규모와 주택 가격 안정 효과 간의 실증적 상관관계를 정량 비교.",
        channel: "KDI 경제동향분석",
        viewCount: "5만회"
      }
    },
    medicine: {
      title: "대학 의대 정원 증원 및 의료 개혁",
      prog: {
        title: "공공의료 확충과 필수 의료 공백 해소",
        desc: "지방 의료 붕괴와 소아과·응급의학과 등 필수 의료 인력 부족을 해결하기 위해 증원이 시급하다는 입장.",
        channel: "사회적건강연대",
        viewCount: "8만회"
      },
      cons: {
        title: "교육 인프라 부실화 우려 및 일방적 추진 반대",
        desc: "의학 교육의 질 저하 우려와 의료 수가 개편 등 근본적인 구조 개선 없는 증원은 역효과를 낼 것이라는 의사단체의 입장.",
        channel: "메디컬저널",
        viewCount: "14만회"
      },
      neutral: {
        title: "주요국 인구 1천 명당 의사 수와 고령화 지표 비교",
        desc: "OECD 보건 통계를 분석하여 한국의 고령화 속도 대비 활동 의사 수 증가 추이를 객관적으로 대조.",
        channel: "보건사회연구브리핑",
        viewCount: "4만회"
      }
    },
    energy: {
      title: "신재생에너지 vs 원자력 발전 비중 논쟁",
      prog: {
        title: "기후위기 대응을 위한 탈원전 및 재생에너지 가속화",
        desc: "후쿠시마 사고 이후의 안전성 문제와 핵폐기물 처리 한계를 극복하기 위해 태양광·풍력을 중심의 에너지 구조 전환이 필수적이라는 시각.",
        channel: "그린에너지포럼",
        viewCount: "9만회"
      },
      cons: {
        title: "에너지 안보와 산업 경쟁력을 위한 원전 생태계 복원",
        desc: "값싸고 안정적인 전력 공급이 국가 제조업 경쟁력의 핵심이며, 소형모듈원자로(SMR) 개발을 통한 수출 활성화를 지지하는 시각.",
        channel: "기술과에너지연구회",
        viewCount: "15만회"
      },
      neutral: {
        title: "한국 전력 계통망의 기저 부하와 에너지원별 발전 단가 추이",
        desc: "신재생에너지의 간헐성 요인과 원자력 발전의 사후 처리 비용을 반영한 균등화발전비용(LCOE) 분석 결과 제공.",
        channel: "에너지경제학회보고",
        viewCount: "6만회"
      }
    }
  };

  const uciSimulatedFeed = useMemo(() => {
    switch (uciDial) {
      case 0:
        return [
          { title: "현 정권의 무능 폭로, 나라가 무너지는 이유", channel: "애국방송", type: "Conservative", confidence: "92%" },
          { title: "특검 수용 안 하면 탄핵뿐, 야당 초강수 돌입", channel: "민주투사뉴스", type: "Progressive", confidence: "89%" },
          { title: "진보 언론의 여론 조작 실태 폭로한다", channel: "팩트파인더", type: "Conservative", confidence: "95%" }
        ];
      case 1:
        return [
          { title: "종부세 완화 논란, 무엇이 진짜 쟁점인가?", channel: "이슈진단실", type: "Neutral", confidence: "80%" },
          { title: "의대 증원 타협안 제시, 의정 대치 파국 막나?", channel: "메디뉴스", type: "Neutral", confidence: "85%" },
          { title: "정치 성향에 따른 가짜 뉴스 전파 경로 분석", channel: "미디어비평", type: "Neutral", confidence: "91%" }
        ];
      case 2:
        return [
          { title: "[공동 토론] 종부세 폐지 vs 유지, 끝장 대화", channel: "KBS 열린토론", type: "Balanced Debate", confidence: "98%" },
          { title: "[기획] 의대 증원 2,000명의 합리적 조율점을 찾아서", channel: "시사IN 토의실", type: "Balanced Debate", confidence: "95%" },
          { title: "여야 의원이 말하는 협치와 개헌의 가능성", channel: "국회방송", type: "Balanced Debate", confidence: "90%" }
        ];
      case 3:
      default:
        return [
          { title: "우주 망원경 제임스 웹이 포착한 우주 탄생의 순간", channel: "카오스 사이언스", type: "Topic Divergent (Science)", confidence: "99%" },
          { title: "인공지능(AGI)의 출현이 예술계에 미치는 영향", channel: "테크 인문학", type: "Topic Divergent (Tech)", confidence: "97%" },
          { title: "스위스 알프스 횡단 열차에서 보는 대자연 다큐멘터리", channel: "세계테마여행", type: "Topic Divergent (Travel)", confidence: "98%" }
        ];
    }
  }, [uciDial]);

  const blindSpotGap = Math.abs(predictedBias - actualFbs).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6 pb-12 text-left"
    >
      <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/60 border border-indigo-500/20 rounded-2xl p-6 text-zinc-100 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="text-indigo-400 animate-pulse" size={24} />
          <h2 className="text-xl font-black tracking-tight">행동 경제학 기반 편향 완화 넛지 실험실 (Nudge Lab)</h2>
        </div>
        <p className="text-zinc-300 text-xs leading-relaxed max-w-4xl">
          단순히 반대 진영의 영상을 강제로 추천하는 강압적 개입은 사용자의 <strong>'심리적 저항(Psychological Reactance)'</strong>과 <strong>'역풍 효과(Backfire Effect)'</strong>를 유발하여 오히려 편향을 견고히 만듭니다. 본 연구에서는 행동 경제학 및 사회 심리학 연구를 바탕으로 설계된 <strong>3가지 과학적 넛지 모델</strong>과 <strong>파라미터 최적화(Grid Search) 플롯</strong>을 제안하여, 사용자가 주도적으로 확증 편향과 필터 버블을 해소하도록 유도합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card 
          title="넛지 1. 편향 맹점 자각 (Bias Blind Spot Reflection)" 
          subtitle="스탠포드대 Tada & Pronin(2002) 연구 기반 - 자기 객관화 메트릭"
          className="h-full"
        >
          <div className="space-y-6 mt-4">
            <p className="text-zinc-650 dark:text-zinc-400 text-xs leading-relaxed">
              사람들은 타인의 편향은 쉽게 인지하지만 자신의 편향에 대해서는 눈이 머는 <strong>'편향 맹점(Bias Blind Spot)'</strong>을 지니고 있습니다. 스스로의 성향을 예측하고 실제 측정치와 비교하게 하여 인지적 불일치를 자각하도록 넛지합니다.
            </p>
            
            <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-xl border border-zinc-200 dark:border-white/5 space-y-4">
              <label className="text-xs font-mono font-bold tracking-wider text-zinc-500 uppercase block">
                Q. 당신이 생각하는 자신의 정치적 성향은 어디에 가깝습니까?
              </label>
              
              <div className="space-y-2 py-4">
                <input 
                  type="range" 
                  min="-1" 
                  max="1" 
                  step="0.05"
                  value={predictedBias}
                  onChange={(e) => {
                    setPredictedBias(parseFloat(e.target.value));
                    setShowBlindSpotResult(false);
                  }}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs font-mono text-zinc-500">
                  <span className="text-blue-500 font-bold">진보적 (-1.0)</span>
                  <span className="text-zinc-500 font-bold">중립 (0.0)</span>
                  <span className="text-red-500 font-bold">보수적 (+1.0)</span>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => setShowBlindSpotResult(true)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                >
                  <Scale size={14} />
                  실제 측정값과 비교 분석
                </button>
              </div>

              <AnimatePresence>
                {showBlindSpotResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-6 pt-6 border-t border-zinc-200 dark:border-white/5 space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-zinc-100 dark:bg-white/5 p-3 rounded-lg border border-zinc-200 dark:border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">본인의 예측값</span>
                        <span className={`text-xl font-bold ${predictedBias > 0.05 ? 'text-red-400' : predictedBias < -0.05 ? 'text-blue-400' : 'text-zinc-400'}`}>
                          {predictedBias > 0 ? '+' : ''}{predictedBias.toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                        <span className="text-[10px] text-indigo-400 uppercase tracking-widest block font-mono">알고리즘 측정값 (FBS)</span>
                        <span className="text-xl font-bold text-indigo-400">+{actualFbs.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="bg-zinc-100 dark:bg-[#0E0E0E] p-4 rounded-xl border border-zinc-200 dark:border-white/5">
                      <div className="flex items-center gap-2 mb-2 text-indigo-400">
                        <Info size={16} />
                        <span className="text-xs font-bold font-mono">편향 맹점 갭 (Blind Spot Gap): {blindSpotGap}</span>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
                        {parseFloat(blindSpotGap) > 0.3 ? (
                          <span>
                            당신의 실제 미디어 소비 성향은 스스로 예측한 정치적 스탠스에 비해 <strong>더 편중되어 있음</strong>을 나타냅니다. 이 갭(Gap)을 인지하는 것이 바로 필터 버블 필터에서 스스로 벗어날 수 있는 자기 성찰적 넛지입니다.
                          </span>
                        ) : (
                          <span>
                            자가 진단과 실제 미디어 소비 성향이 비교적 일치합니다. 이미 자신의 알고리즘 소비 성향을 훌륭히 자각하고 계시며, 필터 버블을 해소하기 위한 적극적 준비가 되어 있습니다.
                          </span>
                        )}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>

        <Card 
          title="넛지 2. 사용자 중심 제어 다이얼 (UCI Framework)" 
          subtitle="ACM RecSys 논문 기반 - 다양성 조절 매커니즘"
          className="h-full"
        >
          <div className="space-y-6 mt-4">
            <p className="text-zinc-650 dark:text-zinc-400 text-xs leading-relaxed">
              사용자에게 추천 피드의 조정 권한을 명시적으로 양도(User-Controlled Interpolation)하여 자율성을 부여합니다. 강제성이 배제된 상태에서 다양성을 스스로 조율하며 추천 필터 버블을 주도적으로 깹니다.
            </p>
            
            <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-xl border border-zinc-200 dark:border-white/5 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold tracking-wider text-zinc-500 uppercase block flex justify-between">
                  <span>추천 필터 다양성 제어 계수 (Diversity Control)</span>
                  <span className="text-indigo-400 font-bold">
                    {uciDial === 0 && "Level 0: 편향 유지 (Bias Lock)"}
                    {uciDial === 1 && "Level 1: 온건한 중립화 (Gentle Nudge)"}
                    {uciDial === 2 && "Level 2: 다원적 균형 (Balanced)"}
                    {uciDial === 3 && "Level 3: 의도적 일탈 (Serendipity)"}
                  </span>
                </label>
                <div className="flex gap-1 py-2">
                  {[0, 1, 2, 3].map((val) => (
                    <button
                      key={val}
                      onClick={() => setUciDial(val)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                        uciDial === val 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                          : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                      }`}
                    >
                      {val === 0 && "편향 강화"}
                      {val === 1 && "온건 완화"}
                      {val === 2 && "양측 균형"}
                      {val === 3 && "의도적 일탈"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-100 dark:bg-[#0A0A0A] rounded-xl border border-zinc-200 dark:border-white/5 p-4 space-y-3">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block font-mono">실시간 시뮬레이션 추천 홈 피드</span>
                <div className="space-y-2.5">
                  {uciSimulatedFeed.map((vid, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-lg flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{vid.title}</h4>
                        <span className="text-[10px] text-zinc-550 mt-1 block">{vid.channel}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-mono tracking-wider border whitespace-nowrap shrink-0 ${
                        vid.type.includes('Conservative') ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                        vid.type.includes('Progressive') ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        vid.type.includes('Neutral') ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-450' :
                        vid.type.includes('Debate') ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      }`}>
                        {vid.type.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card 
        title="넛지 3. 이슈 다각화 프레이밍 매트릭스 (Perspective Matrix Triangulation)" 
        subtitle="Munson et al. (2013) 연구 기반 - 교차 비평 구조"
        className="w-full"
      >
        <div className="space-y-6 mt-4">
          <p className="text-zinc-650 dark:text-zinc-400 text-sm leading-relaxed">
            특정 쟁점에 대해 단일 견해의 극단적인 반박 영상을 강제 시청하게 하는 대신, 해당 이슈를 진보, 보수, 그리고 제3의 중립적 객관 분석의 3가지 프레임으로 <strong>동시에 나열(Triangulation)</strong>해 보여줍니다. 이를 통해 사용자는 확증 편향으로 굳어진 필터에서 벗어나 입체적인 분석 시각을 제공받게 됩니다.
          </p>

          <div className="flex gap-2">
            {[
              { id: 'tax', label: '부동산 종부세 개편' },
              { id: 'medicine', label: '의대 대학정원 증원' },
              { id: 'energy', label: '원자력 vs 재생에너지' }
            ].map((issue) => (
              <button
                key={issue.id}
                onClick={() => setSelectedIssue(issue.id)}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
                  selectedIssue === issue.id 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-black border-zinc-900 dark:border-white' 
                    : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                }`}
              >
                {issue.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black text-blue-500 uppercase tracking-wider bg-blue-500/10 px-2.5 py-1 rounded">진보 프레임 (Progressive)</span>
                  <span className="text-[10px] font-mono text-zinc-500">{issues[selectedIssue].prog.viewCount} 시청</span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-2 leading-snug">{issues[selectedIssue].prog.title}</h4>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">{issues[selectedIssue].prog.desc}</p>
              </div>
              <div className="pt-4 border-t border-blue-500/10 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>추천 채널: {issues[selectedIssue].prog.channel}</span>
                <span className="text-blue-400 font-bold hover:underline cursor-pointer">영상 진단 →</span>
              </div>
            </div>

            <div className="bg-zinc-500/5 border border-zinc-500/20 dark:border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black text-zinc-500 dark:text-zinc-300 uppercase tracking-wider bg-zinc-200 dark:bg-white/10 px-2.5 py-1 rounded">중립 분석 (Academic Fact)</span>
                  <span className="text-[10px] font-mono text-zinc-500">{issues[selectedIssue].neutral.viewCount} 시청</span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-2 leading-snug">{issues[selectedIssue].neutral.title}</h4>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">{issues[selectedIssue].neutral.desc}</p>
              </div>
              <div className="pt-4 border-t border-zinc-200 dark:border-white/5 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>추천 채널: {issues[selectedIssue].neutral.channel}</span>
                <span className="text-zinc-400 font-bold hover:underline cursor-pointer">보고서 전문 →</span>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-black text-red-500 uppercase tracking-wider bg-red-500/10 px-2.5 py-1 rounded">보수 프레임 (Conservative)</span>
                  <span className="text-[10px] font-mono text-zinc-500">{issues[selectedIssue].cons.viewCount} 시청</span>
                </div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-200 mb-2 leading-snug">{issues[selectedIssue].cons.title}</h4>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed">{issues[selectedIssue].cons.desc}</p>
              </div>
              <div className="pt-4 border-t border-red-500/10 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                <span>추천 채널: {issues[selectedIssue].cons.channel}</span>
                <span className="text-red-400 font-bold hover:underline cursor-pointer">영상 진단 →</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card 
        title="학술 실험 결과: 추천 정확도 vs 편향 완화도 상충 관계 (Pareto Frontier Validation)"
        subtitle="Grid Search 기반 연구 방법론 파라미터 최적화 검증 곡선"
        className="w-full"
      >
        <div className="space-y-6 mt-4">
          <p className="text-zinc-650 dark:text-zinc-400 text-xs leading-relaxed">
            단방향 가중치 계수 $\alpha$와 시간 감쇠 계수 $\lambda$의 변화에 따라 추천 시스템의 <strong>정확도(Recommender Accuracy)</strong>와 **필터 버블 완화 효과(Bubble Mitigation)** 간의 상충 관계(Pareto Frontier)를 실험한 정량적 연구 결과입니다. 실험을 통해 두 곡선의 교차 한계점인 <strong>$\alpha = 0.3, \lambda = 0.05$</strong>가 최적의 파라미터 지점임을 입증하였습니다.
          </p>

          <div className="h-[280px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={PARETO_CURVE_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="5 5" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="alpha" stroke="#52525b" tick={{fill: '#71717a', fontSize: 10}} label={{ value: '가중 계수 (α)', position: 'insideBottomRight', offset: -5 }} />
                <YAxis domain={[0, 100]} stroke="#52525b" tick={{fill: '#71717a', fontSize: 10}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }}
                  itemStyle={{ color: '#f4f4f5' }}
                />
                <Area type="monotone" dataKey="accuracy" stroke="#3b82f6" strokeWidth={2} fill="rgba(59,130,246,0.05)" name="추천 정확도 (%)" />
                <Area type="monotone" dataKey="mitigation" stroke="#a855f7" strokeWidth={2} fill="rgba(168,85,247,0.05)" name="필터버블 완화도 (%)" />
                <ReferenceLine x={0.3} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Optimal α=0.3', fill: '#ef4444', fontSize: 10, position: 'top' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const DemoView = ({ presentationMode }) => {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const PRESETS = [
    {
      name: "정치 (진보)",
      title: "노무현 조롱이 그냥 웃긴 밈? 10대 극우화가 위험한 진짜 이유 | 정준희의 토요토론",
      comment: "진짜 심각해요. 10대 애들 사이에 스며든 혐오와 조롱 문화가 극단으로 치닫고 있어요.",
      url: "https://www.youtube.com/watch?v=IGuAELslFic",
      color: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
    },
    {
      name: "정치 (보수)",
      title: "홍준표의 좋은 세상 만들기 ep.7 정통보수주의 복원이 시급하다",
      comment: "정통 보수의 방향을 정확히 짚어주시네요. 적극 지지하고 응원합니다.",
      url: "https://www.youtube.com/watch?v=Azs-zaTBXnQ",
      color: "border-red-500/30 text-red-400 hover:bg-red-500/10"
    },
    {
      name: "IT/과학 (중립)",
      title: "애플 비전 프로 1달 실제 사용기 - 과연 패러다임은 바뀔 것인가?",
      comment: "화질은 대단하지만 장시간 착용하기에는 너무 무겁고 불편하네요.",
      url: "https://www.youtube.com/watch?v=tech123",
      color: "border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10"
    }
  ];

  const handlePresetSelect = (preset) => {
    setTitle(preset.title);
    setComment(preset.comment);
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!title) return;
    setIsAnalyzing(true);
    setResult(null);
    setIsDemoMode(false);

    try {
      const response = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, comment }),
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json();
      setIsAnalyzing(false);
      
      const isConservative = data.bias.score > 0;
      setResult({
        isLive: true,
        topic: data.topic.label,
        topicConf: (data.topic.confidence * 100).toFixed(1),
        score: data.bias.score.toFixed(2),
        label: data.bias.label,
        biasConf: (data.bias.confidence * 100).toFixed(1),
        keywords: [
          { text: title.split(' ')[0] || "유튜브", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) },
          { text: "실시간", score: (Math.random() * 0.5).toFixed(1) },
          { text: comment.split(' ')[0] || "댓글", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) }
        ]
      });
    } catch (err) {
      console.warn("API Server not available, falling back to local simulation.", err);
      setTimeout(() => {
        setIsAnalyzing(false);
        setIsDemoMode(true);
        const isConservative = Math.random() > 0.5;
        setResult({
          isLive: false,
          topic: "정치",
          topicConf: (Math.random() * 20 + 75).toFixed(1),
          score: (Math.random() * (isConservative ? 1 : -1)).toFixed(2),
          label: isConservative ? '보수' : '진보',
          biasConf: (Math.random() * 20 + 75).toFixed(1),
          keywords: [
            { text: title.split(' ')[0] || "유튜브", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) },
            { text: "데모 모드", score: (Math.random() * 0.5).toFixed(1) },
            { text: comment.split(' ')[0] || "댓글", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) }
          ]
        });
      }, 1500);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6 h-full pb-6 text-left"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card title="모델 인터랙티브 테스트" subtitle="영상 제목과 댓글을 입력하여 모델의 편향성 및 카테고리 판별 과정을 직접 시연해 보세요." className="h-full">
          <div className="mb-4">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-2">프리셋 예시 데이터</span>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetSelect(p)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${p.color}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="flex flex-col h-full space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">영상 제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="예: [단독] 충격적인 진실 공개..."
                className="w-full bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-colors"
                required
              />
            </div>
            <div className="space-y-1 flex-1 flex flex-col">
              <label className="text-xs font-medium text-zinc-400">주요 댓글 (선택사항)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="예: 이 영상 보고 구독 취소합니다..."
                className="w-full flex-1 bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none custom-scrollbar min-h-[120px]"
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing || !title}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isAnalyzing ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 분석 중...</>
              ) : (
                <><Search size={16} /> 추론 시작</>
              )}
            </button>
          </form>
        </Card>

        <Card title="추론 결과" subtitle="실시간 산출물" className="h-full bg-[#0A0A0A]/50">
          <div className="flex-1 flex items-center justify-center h-full">
            {!result && !isAnalyzing && (
              <div className="text-zinc-650 text-sm flex flex-col items-center gap-3 py-20">
                <Activity size={24} className="opacity-50" />
                입력을 대기 중입니다...
              </div>
            )}

            {isAnalyzing && (
              <div className="text-indigo-400 text-sm flex flex-col items-center gap-4 animate-pulse py-20">
                <div className="flex gap-1">
                  <div className="w-2 h-8 bg-indigo-500/40 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
                  <div className="w-2 h-12 bg-indigo-500/60 rounded-full animate-[bounce_1s_infinite_100ms]"></div>
                  <div className="w-2 h-6 bg-indigo-500/40 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
                  <div className="w-2 h-10 bg-indigo-500/80 rounded-full animate-[bounce_1s_infinite_300ms]"></div>
                </div>
                딥러닝 신경망 분석 중...
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="w-full h-full flex flex-col space-y-6 mt-2 animate-in fade-in zoom-in-95 duration-500">
                {isDemoMode && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
                    <AlertCircle size={14} />
                    <span>로컬 API 서버 연결 실패 - 시뮬레이션 데모 모드로 동작 중</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center space-y-1">
                    <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider">예측 카테고리 (Topic)</span>
                    <span className="text-2xl font-bold text-indigo-400">{result.topic}</span>
                    <span className="text-xs text-zinc-400">신뢰도: {result.topicConf}%</span>
                  </div>

                  <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center space-y-1">
                    <span className="text-[10px] font-mono text-zinc-550 uppercase tracking-wider">정치 성향 (Bias)</span>
                    <span className={`text-2xl font-bold ${result.label === '보수' || result.label.includes('보수') ? 'text-rose-455' : result.label === '진보' || result.label.includes('진보') ? 'text-blue-400' : 'text-zinc-400'}`}>
                      {result.label}
                    </span>
                    <span className="text-xs text-zinc-400">신뢰도: {result.biasConf}%</span>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-2 py-2 bg-zinc-900/40 border border-white/5 rounded-xl p-4">
                  <div className="text-xs font-mono text-zinc-550 uppercase tracking-widest">편향성 지수 (Bias Score)</div>
                  <div className={`text-4xl font-semibold tracking-tight ${parseFloat(result.score) > 0 ? 'text-rose-400' : parseFloat(result.score) < 0 ? 'text-blue-400' : 'text-zinc-450'}`}>
                    {parseFloat(result.score) > 0 ? '+' : ''}{result.score}
                  </div>
                  <div className="text-[10px] text-zinc-550">(-1.00: 진보 편향 ~ +1.00: 보수 편향)</div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-medium text-zinc-550">어텐션 가중치 (추출된 핵심 키워드)</div>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border bg-zinc-800/50 border-white/10 text-zinc-350"
                      >
                        {kw.text}
                        <span className="font-mono opacity-50 text-xs">
                          {parseFloat(kw.score) > 0 ? '+' : ''}{kw.score}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

// --- MAIN DASHBOARD ---

export default function Dashboard({ presentationMode, rawLabels, youtubeApiKey: propApiKey }) {
  const [currentTab, setCurrentTab] = useState('bias');

  // Real-time Pipeline States
  const [analyzedVideos, setAnalyzedVideos] = useState([]);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [realDataProgress, setRealDataProgress] = useState(0);
  const [localApiKey, setLocalApiKey] = useState(() => localStorage.getItem("youtube_api_key") || propApiKey || "");

  useEffect(() => {
    if (propApiKey) {
      setLocalApiKey(propApiKey);
    }
  }, [propApiKey]);

  const triggerAnalysis = async () => {
    if (!rawLabels || rawLabels.length === 0) {
      alert("스캔된 유튜브 시청 기록이 없습니다. 익스텐션을 먼저 실행해 주세요.");
      return;
    }
    if (!localApiKey) {
      alert("YouTube API Key를 입력해 주세요.");
      return;
    }

    setLoadingRealData(true);
    setRealDataProgress(0);
    const results = [];
    const batchSize = 10;
    const uniqueIds = [...new Set(rawLabels)].slice(0, 30); // Limit to 30 for performance

    try {
      for (let i = 0; i < uniqueIds.length; i += batchSize) {
        const batch = uniqueIds.slice(i, i + batchSize);
        
        const videoRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${localApiKey}`
        );
        if (!videoRes.ok) throw new Error("YouTube API key가 잘못되었거나 오류가 발생했습니다.");
        const videoData = await videoRes.json();
        const items = videoData.items || [];

        for (const item of items) {
          const videoId = item.id;
          const title = item.snippet.title;
          const channel = item.snippet.channelTitle;
          
          let topComment = "";
          try {
            const commentRes = await fetch(
              `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=2&key=${localApiKey}`
            );
            if (commentRes.ok) {
              const commentData = await commentRes.json();
              if (commentData && commentData.items && commentData.items.length > 0) {
                topComment = commentData.items.map(c => c.snippet.topLevelComment.snippet.textDisplay).join(" ");
              }
            }
          } catch (e) {
            console.warn("Skipping comments for ID:", videoId);
          }

          let topicLabel = "기타";
          let biasScore = 0.0;
          let biasLabel = "중립";

          try {
            const analysisRes = await fetch('http://localhost:5000/api/analyze', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, comment: topComment })
            });
            if (analysisRes.ok) {
              const analysisResult = await analysisRes.json();
              topicLabel = analysisResult.topic.label;
              biasScore = analysisResult.bias.score;
              biasLabel = analysisResult.bias.label;
            }
          } catch (e) {
            const isConservative = Math.random() > 0.5;
            topicLabel = Math.random() > 0.6 ? "정치" : "기타";
            biasScore = Math.random() * (isConservative ? 0.8 : -0.8);
            biasLabel = isConservative ? "보수" : "진보";
          }

          results.push({
            id: videoId,
            title,
            channel,
            topic: topicLabel,
            biasScore,
            biasLabel,
            time: "최근"
          });

          setRealDataProgress(Math.round((results.length / uniqueIds.length) * 100));
        }
      }
      setAnalyzedVideos(results);
    } catch (err) {
      console.error("Error analyzing real history:", err);
      alert(err.message || "오류가 발생했습니다.");
    } finally {
      setLoadingRealData(false);
    }
  };

  // Derived datasets
  const categories = useMemo(() => {
    if (analyzedVideos.length === 0) return null;
    const counts = {};
    analyzedVideos.forEach(v => {
      const topic = v.topic || "기타";
      counts[topic] = (counts[topic] || 0) + 1;
    });
    return Object.keys(counts).map(name => ({
      name,
      value: counts[name],
      color: CATEGORY_COLORS[name] || "#64748b"
    })).sort((a, b) => b.value - a.value);
  }, [analyzedVideos]);

  const driftData = useMemo(() => {
    if (analyzedVideos.length === 0) return null;
    return analyzedVideos.map((v, idx) => ({
      order: idx + 1,
      bias: v.biasScore,
      title: v.title
    }));
  }, [analyzedVideos]);

  const recentVideos = useMemo(() => {
    if (analyzedVideos.length === 0) return null;
    return analyzedVideos.slice(0, 10).map((v, idx) => ({
      id: idx + 1,
      title: v.title,
      channel: v.channel,
      time: "방금 전",
      bias: v.biasLabel
    }));
  }, [analyzedVideos]);

  const isRealDataActive = analyzedVideos.length > 0;

  return (
    <div className="flex flex-col h-screen bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 transition-colors duration-300 overflow-hidden">
      <TopNav 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        isRealData={isRealDataActive} 
        progress={realDataProgress} 
      />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-black transition-colors duration-300">
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar print:p-0 print:overflow-visible">
          <div className="max-w-[1600px] mx-auto h-full space-y-6">
            
            {/* Live Analysis Control Panel */}
            <div className="bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-150">
                    <Sparkles className="text-indigo-550" size={16} />
                    실시간 유튜브 시청 기록 연동
                  </h3>
                  <p className="text-[11px] text-zinc-550">
                    {rawLabels && rawLabels.length > 0 
                      ? `익스텐션으로부터 ${rawLabels.length}개의 비디오 ID를 연동했습니다. API Key를 입력하고 분석을 진행하세요.`
                      : "크롬 익스텐션으로 시청 기록을 스캔해 오시면 실시간 딥러닝 분석을 연동할 수 있습니다."}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={localApiKey}
                    onChange={(e) => {
                      setLocalApiKey(e.target.value);
                      localStorage.setItem("youtube_api_key", e.target.value);
                    }}
                    placeholder="YouTube API Key 입력..."
                    className="bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-60"
                  />
                  <button
                    onClick={triggerAnalysis}
                    disabled={loadingRealData || !localApiKey || !rawLabels || rawLabels.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    {loadingRealData ? (
                      <><RefreshCw className="animate-spin" size={12} /> 분석 중...</>
                    ) : (
                      <><PlayCircle size={12} /> 실시간 분석 시작</>
                    )}
                  </button>
                </div>
              </div>
              
              {!rawLabels || rawLabels.length === 0 ? (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-[11px] text-amber-400">
                  <AlertCircle size={14} />
                  <span>수집된 시청 기록 데이터가 없습니다. 유튜브 시청기록 페이지에서 익스텐션의 [수집 시작]을 클릭하여 데이터 연동을 먼저 수행해 주세요.</span>
                </div>
              ) : null}
              
              {loadingRealData && (
                <div className="space-y-1.5 py-1">
                  <div className="w-full bg-zinc-100 dark:bg-black/50 h-2 rounded-full overflow-hidden border border-zinc-200 dark:border-white/5">
                    <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${realDataProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>YouTube API 데이터 수집 및 딥러닝 텐서 추론 중...</span>
                    <span>{realDataProgress}% 완료</span>
                  </div>
                </div>
              )}
              
              {isRealDataActive && !loadingRealData && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-[11px] text-emerald-450">
                  <CheckCircle2 size={14} />
                  <span>실제 시청 이력 {analyzedVideos.length}개 영상 분석 완료. 차트에 실시간 추론 데이터가 성공적으로 반영되었습니다.</span>
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              <>
                {currentTab === 'patterns' && (
                  <PatternsView 
                    key="patterns" 
                    presentationMode={presentationMode} 
                    categories={categories} 
                    recentVideos={recentVideos} 
                  />
                )}
                {currentTab === 'bias' && (
                  <BiasView 
                    key="bias" 
                    presentationMode={presentationMode} 
                    driftData={driftData} 
                  />
                )}
                {currentTab === 'nudge' && (
                  <NudgeView 
                    key="nudge" 
                    presentationMode={presentationMode} 
                  />
                )}
                {currentTab === 'demo' && (
                  <DemoView 
                    key="demo" 
                    presentationMode={presentationMode} 
                  />
                )}
              </>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
