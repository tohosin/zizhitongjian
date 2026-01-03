interface FilterControlsProps {
  juanRange: [number, number];
  onJuanRangeChange: (range: [number, number]) => void;
  maxJuan: number;
  timeRange: [number | null, number | null];
  onTimeRangeChange: (range: [number | null, number | null]) => void;
}

export function FilterControls({
  juanRange,
  onJuanRangeChange,
  maxJuan,
  timeRange,
  onTimeRangeChange,
}: FilterControlsProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-bold text-[#2c1810] mb-4">筛选控制</h3>

      {/* Juan Range */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-[#8b4513] mb-2">
          卷范围
        </label>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500">起始卷</label>
            <input
              type="number"
              min={1}
              max={maxJuan}
              value={juanRange[0]}
              onChange={(e) =>
                onJuanRangeChange([parseInt(e.target.value) || 1, juanRange[1]])
              }
              className="w-full mt-1 px-3 py-2 border border-[#d4c5b5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b4513]"
            />
          </div>
          <span className="text-gray-400 mt-6">—</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500">结束卷</label>
            <input
              type="number"
              min={1}
              max={maxJuan}
              value={juanRange[1]}
              onChange={(e) =>
                onJuanRangeChange([juanRange[0], parseInt(e.target.value) || maxJuan])
              }
              className="w-full mt-1 px-3 py-2 border border-[#d4c5b5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b4513]"
            />
          </div>
        </div>
        <input
          type="range"
          min={1}
          max={maxJuan}
          value={juanRange[1]}
          onChange={(e) =>
            onJuanRangeChange([juanRange[0], parseInt(e.target.value)])
          }
          className="w-full mt-2 accent-[#8b4513]"
        />
      </div>

      {/* Time Range */}
      <div>
        <label className="block text-sm font-semibold text-[#8b4513] mb-2">
          时间范围（公元前）
        </label>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500">起始年（如：453）</label>
            <input
              type="number"
              placeholder="不限"
              value={timeRange[0] !== null ? Math.abs(timeRange[0]) : ''}
              onChange={(e) => {
                const val = e.target.value ? -parseInt(e.target.value) : null;
                onTimeRangeChange([val, timeRange[1]]);
              }}
              className="w-full mt-1 px-3 py-2 border border-[#d4c5b5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b4513]"
            />
          </div>
          <span className="text-gray-400 mt-6">—</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500">结束年（如：200）</label>
            <input
              type="number"
              placeholder="不限"
              value={timeRange[1] !== null ? Math.abs(timeRange[1]) : ''}
              onChange={(e) => {
                const val = e.target.value ? -parseInt(e.target.value) : null;
                onTimeRangeChange([timeRange[0], val]);
              }}
              className="w-full mt-1 px-3 py-2 border border-[#d4c5b5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8b4513]"
            />
          </div>
        </div>
      </div>

      {/* Quick filters */}
      <div className="mt-4">
        <label className="block text-sm font-semibold text-[#8b4513] mb-2">
          快速筛选
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onJuanRangeChange([1, 1]);
              onTimeRangeChange([null, null]);
            }}
            className="px-3 py-1 text-sm border border-[#8b4513] text-[#8b4513] rounded-full hover:bg-[#8b4513] hover:text-white transition-colors"
          >
            第一卷
          </button>
          <button
            onClick={() => {
              onJuanRangeChange([1, maxJuan]);
              onTimeRangeChange([-500, -400]);
            }}
            className="px-3 py-1 text-sm border border-[#8b4513] text-[#8b4513] rounded-full hover:bg-[#8b4513] hover:text-white transition-colors"
          >
            战国初期
          </button>
          <button
            onClick={() => {
              onJuanRangeChange([1, maxJuan]);
              onTimeRangeChange([null, null]);
            }}
            className="px-3 py-1 text-sm border border-[#8b4513] text-[#8b4513] rounded-full hover:bg-[#8b4513] hover:text-white transition-colors"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
