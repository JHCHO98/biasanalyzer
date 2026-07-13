                        onClick={() => setDataSourceMode('demo')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${dataSourceMode === 'demo' ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                      >
                        데모 모드
                      </button>
                      <button
                        onClick={() => {
                          if (analyzedVideos.length === 0) {
                            alert("수집된 시청 데이터 분석이 완료되지 않았습니다. 메인 페이지에서 실시간 분석을 먼저 수행해 주세요.");
                            return;
                          }
                          setDataSourceMode('real');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${dataSourceMode === 'real' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-550 hover:text-zinc-700'} ${analyzedVideos.length === 0 ? 'opacity-50' : ''}`}
                      >
                        실시간 분석 뷰 {analyzedVideos.length > 0 ? `(${analyzedVideos.length}개)` : ''}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    {analyzedVideos.length > 0
                      ? `실제 시청 이력 ${analyzedVideos.length}개 영상을 분석한 결과 데이터가 차트에 정상 반영되어 있습니다.`
                      : "현재 데모 데이터 뷰가 활성화되어 있습니다. 본인 유튜브 시청 이력을 분석하려면 메인 화면에서 시작해 주세요."}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onResetAll}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-all border border-white/10 shrink-0"
                  >
                    새 데이터 연동 (메인 이동)
                  </button>
                  <button
                    onClick={onResetAll}
                    className="px-4 py-2 bg-rose-950/30 hover:bg-rose-950/50 text-rose-350 rounded-xl text-xs font-bold transition-all border border-rose-500/20 shrink-0"
                  >
                    초기화
                  </button>
                </div>
              </div>
              
              {analyzedVideos.length > 0 && (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-[11px] text-emerald-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>실제 시청 이력 {analyzedVideos.length}개 영상 분석 완료.</span>
                  </div>
                  {dataSourceMode === 'demo' ? (
                    <button 
                      onClick={() => setDataSourceMode('real')}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all"
                    >
                      실시간 분석 결과 뷰 활성화하기
                    </button>
                  ) : (
                    <span className="font-bold">분석 결과가 반영된 실시간 뷰가 구동 중입니다.</span>
                  )}
                </div>
              )}
            </div>