export default function Dashboard({ presentationMode, rawLabels, youtubeApiKey: propApiKey, onUpdateRawLabels, onResetAll, analyzedVideos = [] }) {
  const [currentTab, setCurrentTab] = useState('bias');

  // Toggle mode state: 'demo' or 'real'
  const [dataSourceMode, setDataSourceMode] = useState(() => (analyzedVideos && analyzedVideos.length > 0) ? 'real' : 'demo');

  // Detailed Modal States
  const [selectedDetailVideo, setSelectedDetailVideo] = useState(null);
  const [showAllVideosModal, setShowAllVideosModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBias, setFilterBias] = useState('all');

  useEffect(() => {
    if (analyzedVideos && analyzedVideos.length > 0) {
      setDataSourceMode('real');
    } else {
      setDataSourceMode('demo');
    }
  }, [analyzedVideos]);