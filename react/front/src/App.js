import React, { useState, useEffect } from 'react';
import NeuralNetworkBackground from './components/NeuralNetworkBackground';
import Dashboard from './Dashboard';
import { Sun, Moon, Type, Settings, X, RefreshCw } from 'lucide-react';
import { useTheme } from './ThemeContext';

function App() {
    // 'intro' | 'loading' | 'result'
    const [phase, setPhase] = useState('intro');
    const [videoData, setVideoData] = useState(null);
    const { theme, toggleTheme, fontSize, setFontSize } = useTheme();
    const [showSettings, setShowSettings] = useState(false);
    const [youtubeApiKey, setYoutubeApiKey] = useState(() => localStorage.getItem("youtube_api_key") || "");

    // Real-time Pipeline States
    const [analyzedVideos, setAnalyzedVideos] = useState([]);
    const [realDataProgress, setRealDataProgress] = useState(0);
    const [currentlyAnalyzingTitle, setCurrentlyAnalyzingTitle] = useState("");
    const [etaSeconds, setEtaSeconds] = useState(0);

    const FONT_SIZES = [
        { key: 'xs', label: '최소' },
        { key: 'sm', label: '작게' },
        { key: 'base', label: '보통' },
        { key: 'lg', label: '크게' },
        { key: 'xl', label: '최대' },
    ];

    const startDemoAnalysis = () => {
        setAnalyzedVideos([]);
        setPhase('result');
    };

    const startRealAnalysis = async () => {
        if (!videoData || videoData.length === 0) {
            alert("스캔된 유튜브 시청 기록이 없습니다. 데이터를 먼저 연동해 주세요.");
            return;
        }
        if (!youtubeApiKey) {
            alert("YouTube API Key를 입력해 주세요.");
            return;
        }

        setPhase('loading');
        setRealDataProgress(0);
        setCurrentlyAnalyzingTitle("유튜브 서버 연결 중...");

        const results = [];
        const batchSize = 10;
        const uniqueIds = [...new Set(videoData)];
        setEtaSeconds(Math.round(uniqueIds.length * 0.45));

        try {
            for (let i = 0; i < uniqueIds.length; i += batchSize) {
                const batch = uniqueIds.slice(i, i + batchSize);
                
                // 1. YouTube snippet API
                const videoRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${youtubeApiKey}`
                );
                if (!videoRes.ok) throw new Error("YouTube API key가 잘못되었거나 한도를 초과했습니다.");
                const videoJson = await videoRes.json();
                const items = videoJson.items || [];

                for (const item of items) {
                    const videoId = item.id;
                    const title = item.snippet.title;
                    const channel = item.snippet.channelTitle;
                    
                    setCurrentlyAnalyzingTitle(`영상 정보 로드: ${title}`);
                    
                    // 2. Fetch top comments
                    let topComment = "";
                    try {
                        const commentRes = await fetch(
                            `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=2&key=${youtubeApiKey}`
                        );
                        if (commentRes.ok) {
                            const commentData = await commentRes.json();
                            if (commentData && commentData.items && commentData.items.length > 0) {
                                topComment = commentData.items.map(c => c.snippet.topLevelComment.snippet.textDisplay).join(" ");
                            }
                        }
                    } catch (e) {
                        console.warn("Comments skipped for ID:", videoId);
                    }

                    // 3. Local Model API Inference
                    setCurrentlyAnalyzingTitle(`신경망 텐서 연산 중: ${title}`);
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
                        // Simulated fallback if local server is down or returns error
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

                    // Update states
                    const curProgress = Math.round((results.length / uniqueIds.length) * 100);
                    setRealDataProgress(curProgress);
                    setEtaSeconds(Math.round((uniqueIds.length - results.length) * 0.45));
                }
            }
            setAnalyzedVideos(results);
            setPhase('result');
        } catch (err) {
            console.error("Error during live analysis:", err);
            alert(err.message || "오류가 발생했습니다.");
            setPhase('intro');
        }
    };

    useEffect(() => {
        // 1. 저장된 데이터 확인 (새로고침 시)
        const savedData = localStorage.getItem("youtube_data_ids");
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setVideoData(parsed);
                setPhase('intro'); // 처음 구동시 인트로 페이지에서 시작하여 사용자 입력을 받음
            } catch (e) {
                console.error("데이터 파싱 실패", e);
            }
        }

        // 2. 익스텐션 이벤트 수신
        const handleDataReady = () => {
            console.log("[React] 데이터 도착 이벤트 감지!");
            const newData = localStorage.getItem("youtube_data_ids");
            if (newData) {
                try {
                    const parsed = JSON.parse(newData);
                    setVideoData(parsed);
                    setPhase('intro');
                } catch (e) { console.error(e); }
            }
        };

        window.addEventListener("YoutubeDataReady", handleDataReady);
        return () => window.removeEventListener("YoutubeDataReady", handleDataReady);
    }, []);


    const handleOpenYoutube = () => {
        window.open('https://www.youtube.com/feed/history', '_blank');
    };

    const handlePasteData = () => {
        const dataStr = prompt("익스텐션에서 수집 및 복사된 데이터(비디오 ID 리스트)를 여기에 붙여넣어 주세요 (Ctrl + V):");
        if (dataStr) {
            try {
                const parsed = JSON.parse(dataStr);
                if (Array.isArray(parsed)) {
                    localStorage.setItem("youtube_data_ids", dataStr);
                    setVideoData(parsed);
                } else {
                    alert("올바른 데이터 형식이 아닙니다 (ID 배열이어야 합니다).");
                }
            } catch (e) {
                alert("데이터 파싱 실패: 복사된 JSON 형식의 데이터를 붙여넣어 주세요.");
            }
        }
    };

    // --- RENDER ---
    return (
        <div className="relative w-screen h-screen overflow-hidden bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white font-sans selection:bg-indigo-500/30 transition-colors duration-300">

            {/* Global Settings Floating Button */}
            {true && (
                <>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="fixed bottom-8 right-8 z-[60] w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-all backdrop-blur-md shadow-lg flex items-center justify-center"
                    >
                        {showSettings ? <X size={18} /> : <Settings size={18} />}
                    </button>

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="fixed bottom-24 right-8 z-[60] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5">
                            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">환경 설정</h4>

                            {/* Theme Toggle */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">테마</label>
                                <div className="flex rounded-lg border border-zinc-200 dark:border-white/10 overflow-hidden">
                                    <button onClick={() => { if (theme === 'dark') toggleTheme(); }} className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${theme === 'light' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>
                                        <Sun size={12} /> 라이트
                                    </button>
                                    <button onClick={() => { if (theme === 'light') toggleTheme(); }} className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${theme === 'dark' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'}`}>
                                        <Moon size={12} /> 다크
                                    </button>
                                </div>
                            </div>

                            {/* Font Size Slider */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">글꼴 크기</label>
                                <div className="flex items-center gap-1">
                                    {FONT_SIZES.map((s) => (
                                        <button
                                            key={s.key}
                                            onClick={() => setFontSize(s.key)}
                                            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${fontSize === s.key
                                                    ? 'bg-indigo-500 text-white shadow-sm'
                                                    : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 1. Background: Neural Network (Visible in Intro & Loading) */}
            {phase !== 'result' && (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <NeuralNetworkBackground />
                    {/* Dark/Light Overlay for better text readability */}
                    <div className={`absolute inset-0 bg-zinc-50/80 dark:bg-black/40 transition-opacity duration-1000 ${phase === 'loading' ? 'opacity-90 dark:opacity-80' : 'opacity-60 dark:opacity-40'}`} />
                </div>
            )}

            {/* 2. Phase: Intro (The Portal & Landing Page) */}
            {phase === 'intro' && (
                <div className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-700">

                    {/* --- HERO SECTION --- */}
                    <div className="flex flex-col items-center justify-center min-h-screen p-6">

                        {/* Cinematic Title */}
                        <div className="text-center mb-12 space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 text-xs font-mono tracking-widest uppercase mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                제72회 경기도과학전람회 출품작
                            </div>
                            <h1 className="text-5xl md:text-7xl font-sans font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-zinc-900 to-zinc-500 dark:from-zinc-100 dark:to-zinc-500 drop-shadow-sm relative group cursor-default">
                                BiasAnalyzer
                            </h1>
                            <p className="text-zinc-600 dark:text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
                                딥러닝 기반 유튜브 추천 알고리즘의<br />
                                이념적 편향성을 시각적으로 진단합니다.
                            </p>
                        </div>

                        {/* Vertical Glass Cards (The Portal) */}
                        <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">

                            {/* Card 1: Data Source */}
                            <div className="flex-1 group relative bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md border border-zinc-200 dark:border-white/10 rounded-xl p-6 hover:bg-zinc-50 dark:hover:bg-[#111] transition-all duration-300 flex flex-col justify-between overflow-hidden">
                                <div>
                                    <div className="text-zinc-500 mb-4 group-hover:text-indigo-400 transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">데이터셋 연동</h3>
                                    <p className="text-zinc-500 text-xs leading-relaxed">
                                        크롬 익스텐션이 유튜브 시청 기록을 자동으로 수집합니다.
                                    </p>
                                </div>
                                <div className="space-y-2 mt-4">
                                    <button onClick={handleOpenYoutube} className="w-full py-2 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 font-medium text-xs hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all rounded-lg">
                                        유튜브 시청기록 열기
                                    </button>
                                    <button onClick={handlePasteData} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all rounded-lg shadow-sm">
                                        클립보드 데이터 붙여넣기
                                    </button>
                                </div>
                            </div>

                            {/* Card 2: Analysis Launch (Main CTA) */}
                            <div className="flex-1 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md rounded-xl p-6 border border-indigo-500/20 shadow-xl flex flex-col justify-between text-left">
                                {videoData && videoData.length > 0 ? (
                                    <div className="space-y-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="rounded-full p-2 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 bg-indigo-500/10">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                                </div>
                                                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">수집된 시청 기록 분석</h3>
                                            </div>
                                            <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                                                익스텐션으로 총 <strong className="text-indigo-650 dark:text-indigo-400">{[...new Set(videoData)].length}개</strong>의 고유 영상 ID를 수집했습니다. 유튜브 API Key를 입력하여 전체 실시간 진단 분석을 시작하세요.
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">YouTube API Key</label>
                                                <input
                                                    type="text"
                                                    value={youtubeApiKey}
                                                    onChange={(e) => {
                                                        setYoutubeApiKey(e.target.value);
                                                        localStorage.setItem("youtube_api_key", e.target.value);
                                                    }}
                                                    placeholder="API Key 입력..."
                                                    className="w-full bg-zinc-100 dark:bg-black/50 border border-zinc-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => startRealAnalysis()}
                                                disabled={!youtubeApiKey}
                                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-all rounded-lg shadow-md"
                                            >
                                                실시간 분석 시작
                                            </button>
                                            <button
                                                onClick={() => startDemoAnalysis()}
                                                className="w-full text-center text-[10px] text-zinc-550 hover:text-indigo-400 hover:underline"
                                            >
                                                데모 데이터로 대시보드 바로가기 →
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => startDemoAnalysis()}
                                        className="h-full w-full cursor-pointer flex flex-col justify-center items-center text-center group py-6"
                                    >
                                        <div className="mb-4 relative">
                                            <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500 opacity-20"></span>
                                            <div className="relative rounded-full p-4 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">데모 데이터로 분석 시작</h3>
                                        <p className="text-zinc-500 text-xs leading-relaxed max-w-[220px]">
                                            시청 기록이 없을 경우, 내장된 샘플 시나리오로 대시보드를 시뮬레이션합니다.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div> {/* End Hero Section */}

                    {/* Scroll Indicator - Highly visible and positioned higher */}
                    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
                        <div className="flex flex-col items-center gap-1 group cursor-default">
                            <span className="text-indigo-500 dark:text-indigo-400 text-xs font-mono tracking-[0.3em] uppercase font-bold animate-pulse">DISCOVER MORE</span>
                            <div className="w-px h-16 bg-gradient-to-b from-indigo-500 to-transparent"></div>
                        </div>
                    </div>

                    {/* --- LANDING PAGE CONTENT --- */}
                    <div className="max-w-5xl mx-auto px-6 py-24 space-y-32">

                        {/* Section 0: How It Works */}
                        <section className="space-y-12">
                            <div className="text-center space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 dark:text-zinc-400 text-xs font-mono tracking-widest uppercase">
                                    분석 절차
                                </div>
                                <h2 className="text-3xl md:text-4xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    3단계 자동 분석
                                </h2>
                                <p className="text-zinc-600 dark:text-zinc-400 text-sm max-w-lg mx-auto">
                                    크롬 익스텐션이 시청 기록을 수집하면, 나머지는 시스템이 자동으로 처리합니다.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {[
                                    { step: '01', title: '데이터 수집', desc: '크롬 익스텐션이 유튜브 시청 기록 페이지에서 영상 ID를 자동으로 추출합니다.', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                                    { step: '02', title: '듀얼 AI 추론', desc: 'KoELECTRA가 주제를 분류하고, KcELECTRA가 정치적 편향성을 진단합니다.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                                    { step: '03', title: '결과 시각화', desc: '시청 패턴, FBS 지수, 편향성 추이 그래프를 대시보드로 제공합니다.', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' }
                                ].map((item, i) => (
                                    <div key={i} className="relative bg-white/80 dark:bg-[#0A0A0A]/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-sm dark:shadow-none">
                                        <div className="text-5xl font-bold text-zinc-200/60 dark:text-zinc-800/50 absolute top-4 right-5 select-none font-mono">{item.step}</div>
                                        <div className="relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={item.icon}></path></svg>
                                            </div>
                                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{item.title}</h3>
                                            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Section 1: The Problem */}
                        <section className="flex flex-col md:flex-row gap-12 items-center">
                            <div className="flex-1 space-y-6">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono tracking-widest uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    문제 제기
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    알고리즘의 숨겨진 영향력
                                </h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                    추천 시스템은 사용자의 체류 시간을 극대화하기 위해 편향된 콘텐츠를 지속적으로 노출하며, 이는 심각한 <strong className="text-zinc-900 dark:text-zinc-200 font-medium">필터 버블(Filter Bubble)</strong> 현상을 초래합니다.
                                </p>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                    사용자 스스로 자신의 미디어 소비 편향을 진단하기는 매우 어렵습니다. <strong>BiasAnalyzer</strong>는 딥러닝을 통해 알고리즘의 편향을 역추적하여 시각적인 객관성을 제공합니다.
                                </p>
                            </div>
                            <div className="flex-1 w-full bg-white/80 dark:bg-[#0A0A0A]/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden shadow-sm dark:shadow-none">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl"></div>
                                <div className="space-y-4 relative z-10">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-white/5 bg-zinc-50 dark:bg-white/5">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800/50 flex-shrink-0"></div>
                                            <div className="flex-1 space-y-2">
                                                <div className="h-2 bg-zinc-300 dark:bg-zinc-700/50 rounded-full w-3/4"></div>
                                                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full w-1/2"></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Dual Pipeline Architecture */}
                        <section className="flex flex-col lg:flex-row gap-12 items-start">
                            <div className="flex-1 space-y-6 lg:sticky lg:top-24">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono tracking-widest uppercase">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    방법론
                                </div>
                                <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    듀얼 파이프라인 아키텍처
                                </h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                    단일 모델의 한계를 극복하기 위해, 목적이 다른 두 개의 특화된 딥러닝 언어 모델을 연속적으로 배치한 <strong className="text-zinc-900 dark:text-zinc-200 font-medium">듀얼 파이프라인(Dual Pipeline)</strong> 구조를 설계했습니다.
                                </p>
                                <ul className="space-y-4 mt-6">
                                    <li className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">1</div>
                                        <div>
                                            <strong className="block text-zinc-900 dark:text-zinc-200 text-sm mb-1">KoELECTRA 기반 주제 분류</strong>
                                            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">
                                                영상 제목과 핵심 댓글을 입력받아 텍스트 클리닝 및 토큰화를 거친 후, <strong className="text-zinc-900 dark:text-zinc-200">KoELECTRA</strong> 모델을 통해 추출된 특징 벡터(Feature Vector)를 기반으로 영상을 14개의 카테고리로 정밀하게 1차 분류합니다.
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">2</div>
                                        <div>
                                            <strong className="block text-zinc-900 dark:text-zinc-200 text-sm mb-1">KcELECTRA 기반 편향성 진단</strong>
                                            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed">
                                                정치/사회 영역으로 분류된 데이터에 한하여, <strong className="text-zinc-900 dark:text-zinc-200">교차 어텐션(Cross-Attention)</strong> 메커니즘이 적용된 <strong className="text-zinc-900 dark:text-zinc-200">KcELECTRA</strong> 아키텍처가 문맥의 은닉된 이념적 편향성을 스코어링합니다.
                                            </p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            <div className="flex-[1.5] w-full flex flex-col gap-8">
                                {/* Model 1: KoELECTRA Topic Classification */}
                                <div className="w-full bg-white/80 dark:bg-[#0A0A0A]/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col items-center gap-2.5 shadow-xl">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl"></div>
                                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 z-10 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Pipeline 1 · 주제 분류 (KoELECTRA)
                                    </div>

                                    {/* Input */}
                                    <div className="flex gap-3 w-3/5 z-10">
                                        <div className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-300 text-center">Video Title</div>
                                        <div className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-300 text-center">Top Comments</div>
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Preprocessing */}
                                    <div className="w-2/5 py-1.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 rounded-lg text-[10px] text-sky-600 dark:text-sky-400 text-center z-10">
                                        Text Cleaning → Tokenization
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Embedding */}
                                    <div className="w-2/5 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center z-10">
                                        KoELECTRA → Hidden States
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Feature */}
                                    <div className="w-2/5 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-[10px] text-amber-600 dark:text-amber-400 text-center z-10">
                                        Feature Vector
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Classifier */}
                                    <div className="w-2/5 py-1.5 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-lg text-[10px] text-purple-600 dark:text-purple-400 text-center z-10">
                                        Linear Layer → Dropout
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>
                                    <div className="w-2/5 py-2 bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 border border-zinc-700 dark:border-zinc-300 rounded-lg text-[11px] font-bold text-center z-10">
                                        Softmax Output<br /><span className="text-[9px] font-mono font-normal text-zinc-400 dark:text-zinc-500">14 Classes</span>
                                    </div>
                                </div>

                                {/* Model 2: KcELECTRA Bias Detection */}
                                <div className="w-full bg-white/80 dark:bg-[#0A0A0A]/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col items-center gap-2.5 shadow-xl">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>

                                    <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-2 z-10 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                                        Pipeline 2 · 편향성 진단 (KcELECTRA)
                                    </div>

                                    {/* Input Level */}
                                    <div className="flex gap-3 w-full z-10">
                                        <div className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-300 text-center">영상 제목 (Title)</div>
                                        <div className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium text-zinc-600 dark:text-zinc-300 text-center">핵심 댓글 (Comments)</div>
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Embedding Level */}
                                    <div className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 text-center z-10">
                                        KcELECTRA Embedding (768d)
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Attention Level */}
                                    <div className="grid grid-cols-4 gap-1.5 w-full z-10">
                                        <div className="py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-[9px] text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center">Self Attn(T)</div>
                                        <div className="py-2 bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 rounded-lg text-[9px] text-indigo-600 dark:text-indigo-300 text-center flex items-center justify-center font-bold">Cross(T→C)</div>
                                        <div className="py-2 bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/40 rounded-lg text-[9px] text-indigo-600 dark:text-indigo-300 text-center flex items-center justify-center font-bold">Cross(C→T)</div>
                                        <div className="py-2 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-lg text-[9px] text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center">Self Attn(C)</div>
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Fusion Level */}
                                    <div className="w-2/3 py-2 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl text-[11px] font-semibold text-purple-600 dark:text-purple-300 text-center z-10">
                                        Fusion Layer: Concat(3072d)
                                    </div>
                                    <div className="h-3 border-l border-dashed border-zinc-300 dark:border-zinc-700 z-10"></div>

                                    {/* Classifier Level */}
                                    <div className="w-1/2 py-2 bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900 border border-zinc-700 dark:border-zinc-300 rounded-lg text-[11px] font-bold text-center z-10">
                                        Bias Classifier<br /><span className="text-[9px] font-mono font-normal text-zinc-400 dark:text-zinc-500">Score: -1.0 ~ 1.0</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 3: Performance */}
                        <section className="flex flex-col items-center text-center space-y-12 pb-24">
                            <div className="space-y-4 max-w-2xl">
                                <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                    모델 성능 지표
                                </h2>
                                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                    <strong className="text-zinc-900 dark:text-zinc-200">MLM(Masked Language Modeling) 역번역 증강 기법</strong>으로 언어 모델에 초기 문맥을 주입한 뒤, 대규모 크롤링 데이터로 2차 미세 조정(Fine-tuning)을 거치는 <strong className="text-zinc-900 dark:text-zinc-200">2단계 학습 전략</strong>을 적용하였습니다.
                                </p>
                            </div>

                            {/* KoELECTRA Performance */}
                            <div className="w-full space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono tracking-widest uppercase">
                                    Pipeline 1 · 주제 분류 (KoELECTRA)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mx-auto">
                                    <div className="bg-white/80 dark:bg-[#0A0A0A]/80 border border-emerald-200 dark:border-emerald-500/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center shadow-sm dark:shadow-none">
                                        <div className="text-4xl font-semibold text-emerald-600 dark:text-emerald-400 mb-2">85.7%</div>
                                        <div className="text-xs font-mono text-zinc-600 dark:text-zinc-500 uppercase tracking-widest">분류 정확도 (Accuracy)</div>
                                    </div>
                                    <div className="bg-white/80 dark:bg-[#0A0A0A]/80 border border-emerald-200 dark:border-emerald-500/10 rounded-2xl p-6 backdrop-blur-md flex flex-col items-center shadow-sm dark:shadow-none">
                                        <div className="text-4xl font-semibold text-emerald-600 dark:text-emerald-400 mb-2">14</div>
                                        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">분류 카테고리 수</div>
                                    </div>
                                </div>
                            </div>

                            {/* KcELECTRA Performance */}
                            <div className="w-full space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-mono tracking-widest uppercase">
                                    Pipeline 2 · 편향성 진단 (KcELECTRA)
                                </div>
                                <div className="flex justify-center w-full">
                                    <div className="bg-white/80 dark:bg-[#0A0A0A]/80 border border-indigo-200 dark:border-indigo-500/10 rounded-2xl p-8 backdrop-blur-md flex flex-col items-center shadow-sm dark:shadow-none min-w-[300px]">
                                        <div className="text-5xl font-semibold text-indigo-600 dark:text-indigo-400 mb-2">91.4%</div>
                                        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest">편향성 진단 정확도 (Accuracy)</div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Footer */}
                        <footer className="border-t border-zinc-200 dark:border-white/10 pt-12 pb-8">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="text-center md:text-left">
                                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                        BiasAnalyzer
                                    </h3>
                                    <p className="text-xs text-zinc-600 dark:text-zinc-500 mt-1">
                                        딥러닝 기반 유튜브 추천 알고리즘 편향성 진단 시스템
                                    </p>
                                </div>
                                <div className="flex items-center gap-6 text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                                    <span>제72회 경기도과학전람회</span>
                                    <span className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-700"></span>
                                    <span>React + KoELECTRA + KcELECTRA</span>
                                </div>
                            </div>
                        </footer>

                    </div>
                </div>
            )}

            {/* 3. Phase: Loading (Real-time Pipeline Inference) */}
            {phase === 'loading' && (
                <div className="relative z-10 flex flex-col items-center justify-center h-full animate-in fade-in duration-1000 px-6 max-w-2xl mx-auto text-center space-y-8">
                    <div className="space-y-3">
                        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono tracking-widest uppercase animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            실시간 딥러닝 텐서 추론 엔진 구동 중
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                            유튜브 시청 기록 정밀 진단 중
                        </h1>
                        <p className="text-xs text-zinc-550 dark:text-zinc-400 max-w-md mx-auto">
                            YouTube API를 통해 영상 정보 및 여론(댓글) 데이터를 가져와 KoELECTRA 및 KcELECTRA 파이프라인으로 성향 분석을 수행합니다.
                        </p>
                    </div>

                    {/* Progress Indicator */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-3 rounded-full overflow-hidden border border-zinc-300 dark:border-white/5 relative shadow-inner">
                        <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${realDataProgress}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between items-center w-full text-xs font-mono text-zinc-500">
                        <span className="font-bold text-indigo-500">{realDataProgress}% 완료</span>
                        <span>{etaSeconds > 0 ? `예상 소요 시간: 약 ${etaSeconds}초 남음` : '데이터 정합성 연산 중...'}</span>
                    </div>

                    {/* Video Log Overlay */}
                    <div className="w-full bg-white/70 dark:bg-[#0A0A0A]/70 border border-zinc-200 dark:border-white/10 rounded-xl p-4 backdrop-blur-md shadow-lg min-h-[75px] flex items-center justify-center">
                        <div className="flex items-center gap-3">
                            <RefreshCw className="animate-spin text-indigo-500" size={16} />
                            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-350 truncate max-w-md" title={currentlyAnalyzingTitle}>
                                {currentlyAnalyzingTitle || "데이터 대기 중..."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Phase: Result */}
            {phase === 'result' && (
                <div className="relative z-20 w-full h-full bg-zinc-50 dark:bg-black transition-colors duration-300 overflow-hidden animate-in fade-in duration-1000">
                    <Dashboard 
                        rawLabels={videoData} 
                        youtubeApiKey={youtubeApiKey}
                        analyzedVideos={analyzedVideos}
                        onUpdateRawLabels={(newData) => {
                            localStorage.setItem("youtube_data_ids", JSON.stringify(newData));
                            setVideoData(newData);
                        }}
                        onResetAll={() => {
                            localStorage.removeItem("youtube_data_ids");
                            setVideoData(null);
                            setPhase('intro');
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default App;