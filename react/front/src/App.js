import React, { useState, useEffect } from 'react';
import LandingExperience from './components/LandingExperience';
import AnalysisProgress from './components/AnalysisProgress';
import AppearanceSettings from './components/AppearanceSettings';
import Dashboard from './Dashboard';

function App() {
    // 'intro' | 'loading' | 'result'
    const [phase, setPhase] = useState('intro');
    const [videoData, setVideoData] = useState(null);
    const [youtubeApiKey, setYoutubeApiKey] = useState(() => localStorage.getItem("youtube_api_key") || "");

    // Real-time Pipeline States
    const [analyzedVideos, setAnalyzedVideos] = useState([]);
    const [realDataProgress, setRealDataProgress] = useState(0);
    const [currentlyAnalyzingTitle, setCurrentlyAnalyzingTitle] = useState("");
    const [etaSeconds, setEtaSeconds] = useState(0);

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
                            `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=50&key=${youtubeApiKey}`
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
                        } else {
                            throw new Error('모델 분석 요청에 실패했습니다. 분석 서버 상태를 확인해 주세요.');
                        }
                    } catch (e) {
                        throw new Error('실제 영상 분석을 완료하지 못했습니다. 로컬 분석 서버를 확인하고 다시 시도해 주세요.');
                    }

                    results.push({
                        id: videoId,
                        title,
                        description: item.snippet.description || '',
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

    const handlePasteData = (dataStr) => {
        try {
            const parsed = JSON.parse(dataStr);
            if (!Array.isArray(parsed) || !parsed.length || parsed.length > 500 ||
                !parsed.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id))) {
                return '11자리 영상 ID로 구성된 JSON 배열을 입력해 주세요. 최대 500개까지 연결할 수 있습니다.';
            }
            const unique = [...new Set(parsed)];
            localStorage.setItem('youtube_data_ids', JSON.stringify(unique));
            setVideoData(unique);
            return '';
        } catch (e) {
            return 'JSON 형식을 확인해 주세요. 확장 프로그램에서 복사한 목록을 그대로 붙여넣으면 됩니다.';
        }
    };

    return (
        <div className="site-root">
            <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
            <div id="main-content" tabIndex={-1}>
                {phase === 'intro' && <LandingExperience
                    videoData={videoData}
                    youtubeApiKey={youtubeApiKey}
                    onApiKeyChange={value => {
                        setYoutubeApiKey(value);
                        localStorage.setItem('youtube_api_key', value);
                    }}
                    onImport={handlePasteData}
                    onOpenYoutube={handleOpenYoutube}
                    onAnalyze={startRealAnalysis}
                    onDemo={startDemoAnalysis}
                />}
                {phase === 'loading' && <AnalysisProgress
                    progress={realDataProgress} title={currentlyAnalyzingTitle} eta={etaSeconds}
                />}
                {phase === 'result' && <Dashboard
                    rawLabels={videoData}
                    youtubeApiKey={youtubeApiKey}
                    analyzedVideos={analyzedVideos}
                    onUpdateRawLabels={newData => {
                        localStorage.setItem('youtube_data_ids', JSON.stringify(newData));
                        setVideoData(newData);
                    }}
                    onResetAll={() => setPhase('intro')}
                />}
            </div>
            <AppearanceSettings />
        </div>
    );
}

export default App;
