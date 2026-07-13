            {/* Live Analysis Control Panel */}
            <div className="bg-white dark:bg-[#0A0A0A] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm space-y-4 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-800 dark:text-zinc-150">
                    <Sparkles className="text-indigo-550" size={16} />
                    실시간 유튜브 시청 기록 연동
                  </h3>
                  <p className="text-[11px] text-zinc-500">
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