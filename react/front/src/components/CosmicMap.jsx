import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';

/**
 * COSMIC MAP: VISUALIZING THE FILTER BUBBLE
 * - Red Cluster: Conservative / Right Bias
 * - Blue Cluster: Liberal / Left Bias
 * - Purple Line: User Trajectory
 */
const CosmicMap = ({ userCluster = 'Political Criticism' }) => {

    // 1. Generate Two Distinct Clusters (Stars)
    const stars = useMemo(() => {
        const arr = [];
        // Conservative Cluster (Right/Top) - Reddish
        for (let i = 0; i < 80; i++) {
            arr.push({
                x: Math.floor(Math.random() * 80) + 20, // 20 to 100
                y: Math.floor(Math.random() * 80) + 20, // 20 to 100
                z: Math.floor(Math.random() * 200) + 50,
                type: 'cons'
            });
        }
        // Liberal Cluster (Left/Bottom) - Blueish
        for (let i = 0; i < 80; i++) {
            arr.push({
                x: Math.floor(Math.random() * 80) - 100, // -100 to -20
                y: Math.floor(Math.random() * 80) - 100, // -100 to -20
                z: Math.floor(Math.random() * 200) + 50,
                type: 'lib'
            });
        }
        // Neutral/Noise (Center)
        for (let i = 0; i < 40; i++) {
            arr.push({
                x: Math.floor(Math.random() * 100) - 50,
                y: Math.floor(Math.random() * 100) - 50,
                z: Math.floor(Math.random() * 100),
                type: 'neutral'
            });
        }
        return arr;
    }, []);

    // 2. User Path: Starts Center, Moves Deep into Red Cluster
    const userPath = [
        { x: 0, y: 0, z: 200, label: 'Start (Neutral)' },
        { x: 20, y: 15, z: 200, label: 'Video A' },
        { x: 45, y: 40, z: 250, label: 'Video B' },
        { x: 60, y: 80, z: 300, label: 'Current Space' }, // Deep in Cons cluster
    ];

    const CustomStar = (props) => {
        const { cx, cy, payload } = props;
        let fill = "#555";
        let opacity = 0.3;

        if (payload.type === 'cons') {
            fill = "#ef4444"; // Red
            opacity = 0.5;
        } else if (payload.type === 'lib') {
            fill = "#3b82f6"; // Blue
            opacity = 0.5;
        }

        return <circle cx={cx} cy={cy} r={Math.random() * 2 + 1} fill={fill} opacity={opacity} />;
    };

    const CustomNode = (props) => {
        const { cx, cy, payload } = props;
        const isCurrent = payload.label === 'Current Space';

        return (
            <g>
                {isCurrent && (
                    <>
                        <circle cx={cx} cy={cy} r={20} fill="rgba(59, 130, 246, 0.1)" />
                        <circle cx={cx} cy={cy} r={40} fill="none" stroke="rgba(59, 130, 246, 0.2)" strokeDasharray="4 2" className="animate-spin-slow" />
                    </>
                )}
                {/* Core Node */}
                <circle cx={cx} cy={cy} r={isCurrent ? 8 : 4} fill={isCurrent ? "#3b82f6" : "#fff"} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />

                {/* Label */}
                <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    fill={isCurrent ? "#60a5fa" : "#94a3b8"}
                    fontSize={11}
                    fontFamily="sans-serif"
                    fontWeight="600"
                >
                    {payload.label}
                </text>
            </g>
        );
    };

    return (
        <div className="w-full h-full relative bg-slate-900 border border-slate-800 shadow-xl overflow-hidden rounded-xl group">
            {/* Background Grid */}
            <div className="absolute inset-0 z-0 opacity-10"
                style={{
                    backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }}>
            </div>

            {/* Legend / Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none bg-black/40 backdrop-blur-md p-3 rounded-lg border border-white/5">
                <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    ENTITY CLUSTERING TOPOLOGY
                </h3>
                <div className="space-y-1 text-[10px] font-medium text-slate-400">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500/50"></span> C-Cluster (Conservative)
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500/50"></span> L-Cluster (Liberal)
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700 text-slate-200 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> USER VECTOR
                    </div>
                </div>
            </div>

            {/* Visualization */}
            <div className="w-full h-full relative z-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <XAxis type="number" dataKey="x" hide domain={[-120, 120]} />
                        <YAxis type="number" dataKey="y" hide domain={[-120, 120]} />
                        <ZAxis type="number" dataKey="z" range={[0, 400]} />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3', stroke: '#333' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-black/90 border border-white/20 p-2 rounded text-xs text-white">
                                            {data.type ? (data.type === 'cons' ? 'Conservative Video' : 'Liberal Video') : data.label}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        {/* Background Stars (The Bubbles) */}
                        <Scatter
                            name="Universe"
                            data={stars}
                            shape={<CustomStar />}
                            isAnimationActive={false}
                        />
                        {/* User Path */}
                        <Scatter
                            name="Trajectory"
                            data={userPath}
                            line={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
                            shape={<CustomNode />}
                            isAnimationActive={true}
                        />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 font-mono">
                X: Political Bias | Y: Engagement Intensity
            </div>
        </div>
    );
};

export default CosmicMap;
