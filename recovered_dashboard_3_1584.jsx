export default function Dashboard({ presentationMode, rawLabels, youtubeApiKey: propApiKey, onUpdateRawLabels, onResetAll }) {
  const [currentTab, setCurrentTab] = useState('bias');

  // Real-time Pipeline States
  const [analyzedVideos, setAnalyzedVideos] = useState([]);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [realDataProgress, setRealDataProgress] = useState(0);
  const [localApiKey, setLocalApiKey] = useState(() => localStorage.getItem("youtube_api_key") || propApiKey || "");
  const [analysisLimit, setAnalysisLimit] = useState(100);

  // Detailed Modal States
  const [selectedDetailVideo, setSelectedDetailVideo] = useState(null);
  const [showAllVideosModal, setShowAllVideosModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBias, setFilterBias] = useState('all');

  // Reset analysis when new rawLabels are received
  useEffect(() => {
    setAnalyzedVideos([]);
    setRealDataProgress(0);
  }, [rawLabels]);

  const handleManualPaste = () => {
    const dataStr = prompt("새로운 유튜브 시청 기록(비디오 ID 리스트)을 붙여넣어 주세요 (Ctrl + V):");
    if (dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        if (Array.isArray(parsed)) {
          if (onUpdateRawLabels) {
            onUpdateRawLabels(parsed);
          }
          alert(`새로운 비디오 ${parsed.length}개가 성공적으로 연동되었습니다! '실시간 분석 시작'을 눌러 분석을 진행하세요.`);
        } else {
          alert("올바른 데이터 형식이 아닙니다 (ID 배열이어야 합니다).");
        }
      } catch (e) {
        alert("데이터 파싱 실패: 복사된 JSON 형식의 데이터를 붙여넣어 주세요.");
      }
    }
  };