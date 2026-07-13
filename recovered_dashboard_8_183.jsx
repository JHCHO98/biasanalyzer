  useEffect(() => {
    if (analyzedVideos && analyzedVideos.length > 0) {
      setDataSourceMode('real');
    } else {
      setDataSourceMode('demo');
    }
  }, [analyzedVideos]);