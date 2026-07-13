export default function Dashboard({ presentationMode, rawLabels, youtubeApiKey: propApiKey, onUpdateRawLabels, onResetAll, analyzedVideos = [] }) {
  const [currentTab, setCurrentTab] = useState('bias');

  // Toggle mode state: 'demo' or 'real'
  const [dataSourceMode, setDataSourceMode] = useState(() => (analyzedVideos && analyzedVideos.length > 0) ? 'real' : 'demo');