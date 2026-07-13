                  <button
                    onClick={triggerAnalysis}
                    disabled={loadingRealData || !localApiKey || !rawLabels || rawLabels.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {loadingRealData ? (
                      <><RefreshCw className="animate-spin" size={12} /> 분석 중...</>
                    ) : (
                      <><PlayCircle size={12} /> 실시간 분석 시작</>
                    )}
                  </button>
                  <button
                    onClick={handleManualPaste}
                    disabled={loadingRealData}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all border border-white/10 shrink-0"
                  >
                    새 데이터 붙여넣기
                  </button>
                  <button
                    onClick={onResetAll}
                    disabled={loadingRealData}
                    className="px-4 py-2 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 rounded-xl text-xs font-bold transition-all border border-rose-500/20 shrink-0"
                  >
                    초기화
                  </button>