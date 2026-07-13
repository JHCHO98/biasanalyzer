import React, { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine, ComposedChart,
  Line
} from 'recharts';
import {
  PieChart as PieIcon, Activity, PlayCircle, Hash, FileText, Info, AlertCircle, CheckCircle2, Search, Network, Download, Sun, Moon, Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';

// --- MOCK DATA ---

const CATEGORY_COLORS = {
  "게임": "#ef4444", "과학과 기술": "#3b82f6", "노하우/스타일": "#8b5cf6", "정치": "#10b981",
  "비영리/사회운동": "#f59e0b", "스포츠": "#ec4899", "애완동물/동물": "#14b8a6", "예능": "#f43f5e",
  "여행/이벤트": "#06b6d4", "영화/애니메이션": "#8b5cf6", "음악": "#a855f7", "인물/블로그": "#f97316",
  "자동차/탈것": "#64748b", "코미디": "#eab308"
};

const MOCK_CATEGORIES = Object.keys(CATEGORY_COLORS).map(name => ({
  name,
  value: Math.floor(Math.random() * 50) + 10,
  color: CATEGORY_COLORS[name]
})).sort((a, b) => b.value - a.value);

const generateDriftData = () => {
  const data = [];
  let currentBias = 0;
  for (let i = 1; i <= 30; i++) {
    currentBias += (Math.random() * 0.4 - 0.2);
    if (currentBias > 1) currentBias = 1;
    if (currentBias < -1) currentBias = -1;
    data.push({ order: i, bias: currentBias });
  }
  return data;
};
const MOCK_DRIFT_DATA = generateDriftData();

const RECENT_VIDEOS = [
  { id: 1, title: "[단독] 충격적인 진실 공개", channel: "정치 인사이더", time: "2 min ago", bias: "Conservative" },
  { id: 2, title: "아이폰 16 프로 1달 리뷰", channel: "테크몽", time: "15 min ago", bias: "Neutral" },
  { id: 3, title: "침착맨의 롤 대결", channel: "침착맨", time: "1 hour ago", bias: "Neutral" },
  { id: 4, title: "검찰 개혁의 필요성", channel: "민주주의TV", time: "3 hours ago", bias: "Progressive" },
  { id: 5, title: "이번 선거 판세 분석", channel: "시사포커스", time: "5 hours ago", bias: "Progressive" },
  { id: 6, title: "강아지 브이로그", channel: "몽실언니", time: "1 day ago", bias: "Neutral" }
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

// --- COMPONENTS ---

const InfoTooltip = ({ content }) => (
  <div className="group relative inline-flex items-center ml-1.5 cursor-help">
    <Info size={12} className="text-zinc-500 hover:text-indigo-400 transition-colors" />
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 bg-zinc-800 dark:bg-zinc-900 border border-zinc-300 dark:border-white/10 rounded-lg text-xs text-zinc-200 dark:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-[100] whitespace-pre-wrap">
      {content}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-zinc-800 dark:border-b-zinc-900"></div>
    </div>
  </div>
);

const TopNav = ({ currentTab, setCurrentTab }) => (
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
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          LIVE INFERENCE ACTIVE
        </div>
      </div>
    </div>

    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-white/5 p-1.5 rounded-2xl border border-zinc-200 dark:border-white/5">
      {[
        { id: 'patterns', label: '시청 패턴', icon: PieIcon },
        { id: 'bias', label: '정치적 편향성', icon: Activity },
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
    whileHover={{ scale: 1.005 }}
    className={`bg-white dark:bg-[#0A0A0A] rounded-xl border border-zinc-200 dark:border-white/10 overflow-visible flex flex-col transition-all duration-300 shadow-sm dark:shadow-none ${className}`}
  >
    {(title || rightAction) && (
      <div className="px-8 py-6 border-b border-zinc-200 dark:border-white/5 flex justify-between items-end bg-zinc-50 dark:bg-[#0A0A0A]">
        <div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">{title}</h3>
          {subtitle && <p className="text-sm font-medium text-zinc-600 dark:text-zinc-500">{subtitle}</p>}
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

const PatternsView = ({ presentationMode }) => {
  const totalWatched = MOCK_CATEGORIES.reduce((acc, curr) => acc + curr.value, 0);
  const mostWatched = MOCK_CATEGORIES[0];

  const diversityIndex = useMemo(() => {
    let entropy = 0;
    MOCK_CATEGORIES.forEach(cat => {
      if (cat.value > 0) {
        const p = cat.value / totalWatched;
        entropy -= p * Math.log2(p);
      }
    });
    const maxEntropy = Math.log2(14);
    return (entropy / maxEntropy).toFixed(2);
  }, [totalWatched]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 pb-12"
    >
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '분석된 영상 수', value: totalWatched, unit: '개', icon: PlayCircle, color: 'text-indigo-500' },
          { label: '최다 시청 분야', value: mostWatched.name, unit: '', icon: Hash, color: 'text-emerald-500' },
          { label: '주제 다양성', value: diversityIndex, unit: '', icon: Activity, color: 'text-amber-500' },
          { label: '시스템 상태', value: '정상', unit: '', icon: CheckCircle2, color: 'text-sky-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-sm dark:shadow-none transition-all hover:border-indigo-500/30">
            <div className={`p-2 rounded-lg bg-zinc-100 dark:bg-white/5 ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {stat.value}<span className="text-xs font-normal text-zinc-500 ml-0.5">{stat.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        <Card title="카테고리 분포도" subtitle="최근 시청 기록의 14개 주요 카테고리 분포" className="flex-1 min-h-[400px]">
          <div className="w-full h-full flex gap-4">
            {/* 도넛 차트 */}
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MOCK_CATEGORIES}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent, cx, cy, midAngle, outerRadius, index }) => {
                      const RADIAN = Math.PI / 180;
                      // 지그재그 패턴 조정 (20 -> 30, 55 -> 70) 폰트가 커졌으므로 더 띄움
                      const radius = outerRadius + (index % 2 === 0 ? 30 : 70);
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);

                      // 너무 긴 이름 줄이기
                      const shortName = name
                        .replace('영화/애니메이션', '영화/애니')
                        .replace('과학과 기술', '과학/기술')
                        .replace('비영리/사회운동', '사회운동')
                        .replace('애완동물/동물', '동물')
                        .replace('여행/이벤트', '여행')
                        .replace('인물/블로그', '블로그')
                        .replace('자동차/탈것', '자동차');

                      return (
                        <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '0.8rem', fill: '#ccc', fontWeight: 800 }}>
                          {shortName} {(percent * 100).toFixed(0)}%
                        </text>
                      );
                    }}
                    labelLine={({ cx, cy, midAngle, outerRadius, index, ...props }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + (index % 2 === 0 ? 25 : 65);
                      return <path {...props} stroke="#999" strokeWidth={1} fill="none" />;
                    }}
                  >
                    {MOCK_CATEGORIES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
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
            {/* 카테고리 범례 (전체) */}
            <div className="w-44 shrink-0 flex flex-col justify-center space-y-1 overflow-y-auto custom-scrollbar pr-1">
              {MOCK_CATEGORIES.map((cat, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: cat.color }}></div>
                  <span className="text-zinc-600 dark:text-zinc-400 truncate flex-1">{cat.name}</span>
                  <span className="text-zinc-800 dark:text-zinc-200 font-mono font-medium tabular-nums">{((cat.value / totalWatched) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col h-full pb-6">
        <Card title="최근 시청 기록" subtitle="분석이 완료된 비디오 로그" className="h-full">
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1 custom-scrollbar">
            {RECENT_VIDEOS.map((vid) => (
              <div key={vid.id} className="p-3 hover:bg-zinc-100 dark:hover:bg-white/5 rounded-lg border border-transparent transition-colors group">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate" title={vid.title}>
                      {vid.title}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                      <span className="truncate">{vid.channel}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-700 shrink-0"></span>
                      <span className="shrink-0">{vid.time}</span>
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono tracking-wider shrink-0 border ${vid.bias === 'Conservative' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                      vid.bias === 'Progressive' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                        'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-white/10'
                    }`}>
                    {vid.bias.toUpperCase()}
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

const BiasView = ({ presentationMode }) => {
  // --- FBS (Filter Bubble Score) 산출 ---
  const N = MOCK_DRIFT_DATA.length; // 분석 대상 영상 수 (기본값 30)
  const LAMBDA = 0.05; // 시간 감쇠 계수
  const ALPHA = 0.3;   // 집중도 가중 계수

  // 1단계: 시간 가중 편향 누적값 (Drift Score) — 지수 감쇠 가중 평균
  const { weightedSum, weightTotal } = useMemo(() => {
    let wSum = 0, wTotal = 0;
    MOCK_DRIFT_DATA.forEach((d, idx) => {
      const i = idx + 1; // i=1(가장 오래된) ~ N(최신)
      const w = Math.exp(LAMBDA * (i - N));
      wSum += w * d.bias;
      wTotal += w;
    });
    return { weightedSum: wSum, weightTotal: wTotal };
  }, []);
  const driftScore = weightedSum / weightTotal;

  // 2단계: 단방향 집중도 비율 (R)
  const { nProg, nCons } = useMemo(() => {
    let prog = 0, cons = 0;
    MOCK_DRIFT_DATA.forEach(d => {
      if (d.bias < -0.05) prog++;
      else if (d.bias > 0.05) cons++;
    });
    return { nProg: prog, nCons: cons };
  }, []);
  const rProg = nProg / N;
  const rCons = nCons / N;
  const R = Math.max(rProg, rCons) - (1 / 3);

  // 3단계: 최종 FBS 산출
  const rawFbs = driftScore * (1 + ALPHA * Math.max(0, R));
  const fbs = Math.max(-1, Math.min(1, rawFbs)); // [-1, 1] 클리핑

  // 판정 등급
  let riskLevel = '균형';
  let riskColor = 'text-emerald-400';
  let riskBorder = 'border-emerald-500/20';
  let riskIcon = <CheckCircle2 className="text-emerald-400" size={18} />;

  if (Math.abs(fbs) >= 0.7) {
    riskLevel = '위험';
    riskColor = 'text-red-400';
    riskBorder = 'border-red-500/20';
    riskIcon = <AlertCircle className="text-red-400" size={18} />;
  } else if (Math.abs(fbs) >= 0.4) {
    riskLevel = '주의';
    riskColor = 'text-amber-400';
    riskBorder = 'border-amber-500/20';
    riskIcon = <AlertCircle className="text-amber-400" size={18} />;
  } else if (Math.abs(fbs) >= 0.15) {
    riskLevel = '경미';
    riskColor = 'text-yellow-400';
    riskBorder = 'border-yellow-500/20';
    riskIcon = <Info className="text-yellow-400" size={18} />;
  }

  const biasDirection = fbs >= 0 ? '보수 성향' : '진보 성향';

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-6 h-full pb-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* FBS 종합 패널 */}
        <Card className={`lg:col-span-1`}>
          <div className="h-full flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4">
              {riskIcon}
              <h2 className={`text-xs font-mono uppercase tracking-widest ${riskColor} flex items-center`}>
                필터 버블 지수 (FBS)
                <InfoTooltip content={`Filter Bubble Score (FBS):\n지수 감쇠 가중 Drift Score(λ=${LAMBDA})에\n단방향 집중도 비율 R을 반영(α=${ALPHA})하여 산출합니다.\n\n판정 기준:\n|FBS| < 0.15 → 균형\n0.15~0.4 → 경미\n0.4~0.7 → 주의\n0.7 이상 → 위험`} />
              </h2>
            </div>
            <div className="flex flex-col items-center justify-center py-6">
              <div className="flex items-baseline gap-3">
                <span className={`text-8xl font-black tracking-tighter ${riskColor} drop-shadow-[0_0_20px_rgba(var(--risk-rgb),0.3)]`}>
                  {fbs > 0 ? '+' : ''}{fbs.toFixed(3)}
                </span>
                <span className={`text-xl font-mono ${riskColor} opacity-50 font-black`}>FBS</span>
              </div>
              <p className={`text-xl font-bold ${riskColor} mt-4 tracking-tight`}>
                {riskLevel}: {biasDirection} 편향
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-white/5 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Drift</p>
                <p className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-200">{driftScore > 0 ? '+' : ''}{driftScore.toFixed(4)}</p>
              </div>
              <div className="text-center border-x border-white/5">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Intensity R</p>
                <p className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-200">{R.toFixed(4)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">λ / α / N</p>
                <p className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-200">{LAMBDA}/{ALPHA}/{N}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="추출된 이념 키워드" subtitle="KcELECTRA 교차 어텐션 기반 가중치 분석" className="lg:col-span-2">
          <div className="flex flex-wrap gap-4 mt-6">
            {EXTRACTED_KEYWORDS.map((kw, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-xl text-base font-bold border ${kw.type === 'Conservative'
                    ? 'bg-red-500/10 border-red-500/20 text-red-300'
                    : kw.type === 'Progressive'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                      : 'bg-zinc-800/50 border-white/10 text-zinc-300'
                  }`}
              >
                {kw.text}
                <span className="font-mono opacity-50 text-xs font-bold">
                  {kw.score > 0 ? '+' : ''}{kw.score}
                </span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card title="편향성 누적 추이 (Drift Flow)" subtitle="최근 시청한 30개 영상의 이념적 편향성 변동 궤적 분석" className="flex-1 min-h-[700px]" presentationMode={presentationMode}>
        <div className="h-full w-full pt-16 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={MOCK_DRIFT_DATA} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#f43f5e" stopOpacity={0} />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity={0} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.3} />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="6 6" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis 
                dataKey="order" 
                stroke="#a1a1aa" 
                tick={{fill: '#d4d4d8', fontSize: 18, fontWeight: 900, fontFamily: 'monospace'}} 
                tickMargin={25}
                axisLine={false}
              />
              <YAxis 
                domain={[-1, 1]} 
                ticks={[-1, -0.5, 0, 0.5, 1]}
                stroke="#a1a1aa" 
                tick={{fill: '#d4d4d8', fontSize: 18, fontWeight: 900, fontFamily: 'monospace'}}
                axisLine={false}
                tickFormatter={(val) => val.toFixed(1)}
              />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(30px)', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '32px', padding: '32px' }}
                itemStyle={{ fontSize: '24px', fontWeight: 900 }}
                formatter={(val) => [<span className={`font-black ${val > 0 ? 'text-rose-400' : 'text-indigo-400'}`}>{val.toFixed(3)}</span>, "편향도"]}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.4)" strokeDasharray="10 10" strokeWidth={3} />
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
                stroke="#fff" 
                strokeWidth={8} 
                dot={{ r: 6, fill: '#fff', strokeWidth: 0 }}
                activeDot={{ r: 10, fill: '#6366f1', stroke: '#fff', strokeWidth: 4 }}
                filter="url(#glow)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </motion.div>
  );
};

const DemoView = ({ presentationMode }) => {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const PRESETS = [
    {
      name: "정치 (진보)",
      title: "노무현 조롱이 그냥 웃긴 밈? 10대 극우화가 위험한 진짜 이유 | 정준희의 토요토론 | 문성호 청소년, 최은서 기자, 우석훈 경제학자",
      comment: `진짜 심각해요. 10대 애들 사이에 스며든 혐오와 조롱 문화가 극단으로 치닫고 있어요. ㅠㅠ
이명박정부부터 이런 혐오가 시작되었다.
벌써 20년이 넘도록 극우들이 키워온 혐오들이 아이들에게 퍼진것임.
초등 6학년 아이가 학교서 친구들이 노무현 대통령 얘기를 한다고 해서 너무 놀랐어요ㅜㅜ
이명박 저는 이 사람을 현재 우리나라 극우로 가는 발판을 깐 사람이라고 생각하게 됩니다. (그리스도인으로 이름로 하나님을 믿는다고 말하는 이명박 그렇기에 더더욱 슬프고 오만하고 어리석은 인간의 말로를 봅니다.) 청소년들을 선동해 혐오 조장하는 사람들은 언젠가 본인이나 본인이 사랑하는 누군가에게 부메랑이 되어 돌아오게 된다는 사실을 역사는 말합니다. 그 때에야 피눈물 흘리게 될 것입니다.`,
      url: "https://www.youtube.com/watch?v=IGuAELslFic",
      color: "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
    },
    {
      name: "정치 (보수)",
      title: " 홍준표의 좋은 세상 만들기 ep.7 정통보수주의 복원이 시급하다",
      comment: `홍카더운날씨에건강하세요❤❤❤❤❤❤❤
감사합니다~♡
의식수준이 높은 사람을 처음부터 선발해서 정치수업이 시작되어야 하는데 학벌위주랑 기회주의자를 선발한게 문제임니다ㆍ
응원 합니다 🎉❤
정통보수는 오직 온니홍❤
사랑합니다 무대홍❤`,
      url: "https://www.youtube.com/watch?v=Azs-zaTBXnQ",
      color: "border-red-500/30 text-red-400 hover:bg-red-500/10"
    },
    {
      name: "정치 (중립)",
      title: " [다시보기] 제21대 대통령선거 후보자 토론회 - 정치 분야 (2025.5.27) / JTBC News",
      comment: `JTBC는 대선 후보들의 토론 발언에 대한 '실시간 팩트체크'를 준비했습니다. 팩트체크 내용은 JTBC 뉴스 홈페이지( https://news.jtbc.co.kr/election/factcheck )과 유튜브 댓글, 포털 기사 등으로 확인하실 수 있습니다

그냥 한 달 동안 매일 6시간씩 토론회 했으면 좋겠음. 깊이 들어갈만하면 시간 부족하고 논쟁이 붙었다하면 시간없어서 툭툭 끊기고 이건 뭐 토론 하나마나한 수준임. 쓸데없이 돌아다니면서 유세할 시간에 그냥 한달 내내 매일 토론만 주구장창 끝장 볼때까지 하는 것이 유권자들한테 훨씬 이득임. 원래 파고들수록 밑천이 드러나기 마련이고 밑천이 드러날 정도로 파고 들어가면 그 후보의 역량과 한계가 명확히 보이게 되어있음. 그 지점이 대통령을 결정하는 판단 근거로서 유의미한 포인트가 되는 거임. 제발 토론회를 좀 많이 늘려줬으면 좋겠다.
아 보고있자니 너무 피로감느껴진다 이게 정녕 정치인들의 토론이 맞는가 ㅜ 진짜 해야할 이야기는 안하고 공격만 주고받네`,
      url: "https://www.youtube.com/watch?v=5sw-aVUYsCA",
      color: "border-zinc-500/30 text-zinc-400 hover:bg-zinc-500/10"
    },
    {
      name: "스포츠 (비정치)",
      title: "체코 압도한 한국, 공격의 시작에는 이강인 있었다｜지금 월드컵",
      comment: `패스정확도100%인거 보고 고트구나 이강인이 경기장을 지배함 부상 없이 월드컵 화이팅!!
진짜 이강인은 보물이다
이강인 진짜 잘한다
황인범도 너무 잘찼고, 이강인 어시스트는 예술이였다. 정말 잘 찼네`,
      url: "https://www.youtube.com/watch?v=Vd3NOTd9dIQ",
      color: "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
    },
    {
      name: "과학기술 (비정치)",
      title: "똑같은 내용을 책으로 읽은 아이와 영상으로 본 아이의 충격적인 격차 #과학 #EBS지식",
      comment: `내용 요약

1. 읽을 때 우리 뇌에서 일어나는 일
-문자 상자(VWFA): 좌반구 후두엽과 측두엽 경계에 위치한 영역으로, 문자를 볼 때 선택적으로 활성화되어 시각 정보와 의미 정보를 연결하는 관문 역할을 합니다. 문맹, 난독증 아동, 글을 배우기 전의 아이들의 뇌에서는 발견되지 않습니다.
-뇌의 기적적인 협업: 눈이 글자를 보는 순간 후두엽(시각 처리) -> 문자 상자 -> 측두엽 및 전두엽(발음 및 의미 처리)이 연속적·병행적으로 활성화됩니다. 읽기는 뇌의 거의 대부분 영역을 사용하는 고차원적이고 복잡한 실시간 처리 과정입니다.

2. 읽기의 원리와 '스카보로의 리딩 로프'
-읽기는 후천적 학습의 영역: 인간은 말하기(구어) 능력을 타고나지만, 읽기는 약 5,400년 전에 시작된 인위적인 활동으로 반드시 따로 배워야 합니다.
-리딩 로프(Reading Rope) 모델: 읽기 이해는 여러 요소가 촘촘히 꼬인 밧줄과 같습니다.
-단어 인식: 문자 인식, 해독(디코딩), 소리값(음운) 이해
-언어 이해: 어휘력, 배경 지식, 언어 구조, 문맥 및 추론 능력
-곱셈의 법칙: 읽기 능력은 각 요소들의 '곱'으로 이루어집니다. 즉, 다른 능력이 아무리 뛰어나도 단 하나의 요소라도 결핍(0)되면 전체 읽기 능력이 작동하지 않습니다(0).

3. 음운 처리와 난독증
-소리의 중요성: 읽기를 단순한 시각 처리로 생각하기 쉽지만, 시각 정보를 말소리(의문 정보)로 바꾸는 과정이 필수적입니다. 상측두회가 이 과정을 담당하며, 이 영역의 활성화 정도가 높은 아동일수록 글 읽기 학습이 잘 이루어집니다.
-난독증과 조기 치료: 난독증은 지능의 문제가 아니라 음운 지식과 해독 능력의 부족으로 발생합니다. 뇌의 가소성이 높은 어린 시절에 자음과 모음을 분리해 소리 내어 읽는 '음운 인식·소리 훈련'을 조기에 받으면 충분히 극복할 수 있습니다.

4. 독서의 핵심 변수: 배경 지식과 속도
-배경 지식의 힘 (빈익빈 부익부): 문해력이 높은 성인이라도 야구 지식이 전혀 없으면 야구 관련 글을 거의 이해하지 못하는 반면, 문해력이 낮아도 야구 지식이 풍부한 어린이는 글을 완벽히 이해하고 재연해 냅니다. 배경 지식이 많을수록 새로운 글을 더 쉽게 이해하고 기억하는 전략적 독서가 가능합니다.
-빠른 글 읽기의 함정: 디지털 화면을 통해 안구의 도약(움직임)을 줄여 빠르게 읽는 방식은 속도는 높여주지만, 깊이 있는 이해와 추론, 배경 지식 활용을 방해하여 정보가 쉽게 휘발되고 정답률(이해돈)을 떨어뜨립니다.

5. 영상(애니메이션) vs 독서
-동일한 이야기를 영상으로 본 집단과 책으로 읽은 집단을 비교했을 때 뇌의 정보 처리 방식에서 큰 차이가 나타났습니다.
-영상 시청: 시각 자극이 워낙 강력하여 뇌가 수동적으로 변합니다. 핵심 키워드(예: 보리수나무)나 제목을 잘 기억하지 못하며, 화면에 나온 이미지를 그대로 모방(복제)하는 경향을 보입니다.
-독서: 능동적으로 페이지를 넘기며 머릿속 스케치북에 정보를 스스로 구체화하는 '정교한 정신적 표상'을 구축합니다. 이 과정에서 상상력과 창의력이 발휘되어 훨씬 더 풍부하고 고유한 이해에 도달하게 됩니다.

요약하자면: 읽기는 타고난 뇌의 기능(시각, 기억, 언어 등)을 총동원하는 복잡한 과정입니다. 단순히 텍스트를 빠르게 훑거나 이미 만들어진 영상을 보는 것과 달리, 글자의 소리를 느끼고 배경 지식을 결합해 머릿속으로 상상하며 읽는 독서야말로 뇌를 가장 활성화하는 고차원적인 인지 활동입니다.
교보문고 알라딘 예스24가 이 영상을 좋아합니다
아주단순한 거임..책이 뇌를 더 활성화 시킨다는 거..책은 그냥 읽자.
미래에도 책이 사라지지 않는다는 증거네요`,
      url: "https://www.youtube.com/watch?v=GaFml8uvkYE",
      color: "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
    }
  ];

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
      
      // Calculate dummy/simulated keywords for visualization
      const isConservative = data.bias.score > 0;
      setResult({
        isLive: true,
        topic: data.topic.label,
        topicConf: (data.topic.confidence * 100).toFixed(1),
        topicProbs: data.topic.probabilities || [],
        score: data.bias.score.toFixed(2),
        label: data.bias.label,
        biasConf: (data.bias.confidence * 100).toFixed(1),
        biasProbs: data.bias.probabilities || [],
        keywords: [
          { text: title.split(' ')[0] || "유튜브", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) },
          { text: "실시간", score: (Math.random() * 0.5).toFixed(1) },
          { text: comment.split(' ')[0] || "댓글", score: (Math.random() * 0.8 + 0.2).toFixed(1) * (isConservative ? 1 : -1) }
        ]
      });
    } catch (err) {
      console.warn("API Server not available, falling back to local simulation.", err);
      // Fallback mode logic (Simulated Inference Delay)
      setTimeout(() => {
        setIsAnalyzing(false);
        setIsDemoMode(true);
        const isConservative = Math.random() > 0.5;
        const topicConfVal = Math.random() * 20 + 75; // e.g. 85.5%
        const mockTopicProbs = [
          { label: "정치", confidence: topicConfVal / 100 },
          { label: "예능", confidence: ((100 - topicConfVal) * 0.65) / 100 },
          { label: "인물/블로그", confidence: ((100 - topicConfVal) * 0.35) / 100 },
        ];
        
        const biasConfVal = Math.random() * 20 + 75; // e.g. 80%
        const remainingBias = 100 - biasConfVal;
        const primaryBias = isConservative ? '보수' : '진보';
        const secondaryBias = '중립';
        const tertiaryBias = isConservative ? '진보' : '보수';
        
        const mockBiasProbs = [
          { label: primaryBias, confidence: biasConfVal / 100 },
          { label: secondaryBias, confidence: (remainingBias * 0.7) / 100 },
          { label: tertiaryBias, confidence: (remainingBias * 0.3) / 100 }
        ];

        setResult({
          isLive: false,
          topic: "정치",
          topicConf: topicConfVal.toFixed(1),
          topicProbs: mockTopicProbs,
          score: (Math.random() * (isConservative ? 1 : -1)).toFixed(2),
          label: primaryBias,
          biasConf: biasConfVal.toFixed(1),
          biasProbs: mockBiasProbs,
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
      className="flex flex-col gap-6 h-full pb-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
        <Card title="모델 인터랙티브 테스트" subtitle="영상 제목과 댓글을 입력하여 모델의 편향성 및 카테고리 판별 과정을 직접 시연해 보세요." className="h-full">
          <form onSubmit={handleAnalyze} className="flex flex-col h-full mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">발표용 데모 프리셋 (클릭 시 자동 완성)</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTitle(preset.title);
                      setComment(preset.comment);
                      setUrl(preset.url || '');
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold bg-zinc-900/20 dark:bg-zinc-900/60 transition-colors ${preset.color}`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">유튜브 영상 링크 (선택사항)</label>
              <a
                href={url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-colors"
              >{url}</a>
            </div>

            <div className="space-y-2">
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
            <div className="space-y-2 flex flex-col">
              <label className="text-xs font-medium text-zinc-400">주요 댓글 (선택사항)</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="예: 이 영상 보고 구독 취소합니다..."
                className="w-full h-24 bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none custom-scrollbar"
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
              <div className="text-zinc-600 text-sm flex flex-col items-center gap-3 py-20">
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

            {result && !isAnalyzing && (() => {
              const isPoliticsRelated = result.topicProbs && result.topicProbs.slice(0, 3).some(item => item.label === "정치");
              return (
                <div className="w-full h-full flex flex-col space-y-4 mt-0 animate-in fade-in zoom-in-95 duration-500">
                  
                  {isDemoMode && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 text-xs text-amber-400">
                      <AlertCircle size={14} />
                      <span>로컬 API 서버 연결 실패 - 시뮬레이션 데모 모드로 동작 중</span>
                    </div>
                  )}

                  {result.url && (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 px-1 py-1 relative z-10">
                      <PlayCircle size={14} className="text-zinc-500 shrink-0" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">원본 링크:</span>
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(result.url, '_blank');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 hover:underline truncate flex-1 font-mono text-xs cursor-pointer relative z-20 pointer-events-auto"
                      >
                        {result.url}
                      </a>
                    </div>
                  )}

                  <div className={isPoliticsRelated ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                    {/* Topic Box */}
                    <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center space-y-1">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">예측 카테고리 (Topic)</span>
                      <span className="text-xl font-bold text-indigo-400">{result.topic}</span>
                      <span className="text-xs text-zinc-400">신뢰도: {result.topicConf}%</span>
                    </div>

                    {/* Bias Box */}
                    {isPoliticsRelated && (
                      <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3 flex flex-col items-center text-center space-y-1">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">정치 성향 (Bias)</span>
                        <span className={`text-xl font-bold ${result.label === '보수' ? 'text-red-400' : result.label === '진보' ? 'text-blue-400' : 'text-zinc-400'}`}>
                          {result.label}
                        </span>
                        <span className="text-xs text-zinc-400">신뢰도: {result.biasConf}%</span>
                      </div>
                    )}
                  </div>

                  {/* Softmax Probability Distributions */}
                  <div className={isPoliticsRelated ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                    {/* Topic Softmax */}
                    {result.topicProbs && result.topicProbs.length > 0 && (
                      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-zinc-400">카테고리 확률 (상위 3개)</div>
                        <div className="space-y-1.5">
                          {result.topicProbs.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-zinc-300 font-medium">{item.label}</span>
                                <span className="text-indigo-400 font-mono">{(item.confidence * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${item.confidence * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bias Softmax */}
                    {isPoliticsRelated && result.biasProbs && result.biasProbs.length > 0 && (
                      <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-zinc-400">정치 성향 확률 분포</div>
                        <div className="space-y-1.5">
                          {result.biasProbs.map((item, idx) => {
                            const isConservative = item.label.includes('보수') || item.label === '보수';
                            const isProgressive = item.label.includes('진보') || item.label === '진보';
                            const barColor = isConservative ? 'bg-red-500' : isProgressive ? 'bg-blue-500' : 'bg-zinc-500';
                            const textColor = isConservative ? 'text-red-400' : isProgressive ? 'text-blue-400' : 'text-zinc-400';
                            return (
                              <div key={idx} className="space-y-0.5">
                                <div className="flex justify-between text-xs">
                                  <span className="text-zinc-300 font-medium">{item.label}</span>
                                  <span className={`${textColor} font-mono`}>{(item.confidence * 100).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`${barColor} h-full rounded-full transition-all duration-500`} 
                                    style={{ width: `${item.confidence * 100}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {isPoliticsRelated && (
                    <div className="space-y-2">
                      <div className="text-[11px] font-medium text-zinc-500">어텐션 가중치 (추출된 핵심 키워드)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {result.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border bg-zinc-800/50 border-white/10 text-xs font-medium text-zinc-300"
                          >
                            {kw.text}
                            <span className="font-mono opacity-50 text-[10px] ml-1">
                              {kw.score > 0 ? '+' : ''}{kw.score}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </Card>
      </div>
    </motion.div>
  );
};

// --- MAIN DASHBOARD ---

export default function Dashboard({ presentationMode }) {
  const [currentTab, setCurrentTab] = useState('bias');

  return (
    <div className="flex flex-col h-screen bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 transition-colors duration-300 overflow-hidden">
      <TopNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-black transition-colors duration-300">
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar print:p-0 print:overflow-visible">
          <div className="max-w-[1600px] mx-auto h-full">
            <AnimatePresence mode="wait">
              {currentTab === 'patterns' && <PatternsView key="patterns" presentationMode={presentationMode} />}
              {currentTab === 'bias' && <BiasView key="bias" presentationMode={presentationMode} />}
              {currentTab === 'demo' && <DemoView key="demo" presentationMode={presentationMode} />}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}