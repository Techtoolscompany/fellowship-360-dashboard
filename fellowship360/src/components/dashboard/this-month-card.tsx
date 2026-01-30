export function ThisMonthCard() {
  return (
    <div className="relative h-[182px] overflow-hidden rounded-card border border-border bg-card p-4">
      {/* Title */}
      <p className="text-xl font-semibold capitalize text-dark">This Week</p>

      {/* Stats with Bars */}
      <div className="relative mt-5 flex items-end justify-between">
        {/* Attendance Bar */}
        <div className="flex flex-col gap-2">
          <div className="h-20 w-[59px] rounded-lg bg-lime-200" />
          {/* Label */}
          <div className="absolute -top-[50px] left-2.5 z-10 rounded-xl bg-white p-2">
            <span className="block text-[10px] text-dark/40">attendance</span>
            <span className="text-[13px] font-semibold text-dark">1,247</span>
          </div>
        </div>

        {/* Online Bar */}
        <div className="flex flex-col gap-2">
          <div className="h-[60px] w-[59px] rounded-lg bg-neutral-300" />
          {/* Label */}
          <div className="absolute -top-[30px] right-2.5 z-10 rounded-xl bg-white p-2">
            <span className="block text-[10px] text-dark/40">online</span>
            <span className="text-[13px] font-semibold text-dark">856</span>
          </div>
        </div>
      </div>

      {/* Mini Bar Chart */}
      <div className="absolute -right-px -bottom-1 h-11 w-[81px] overflow-hidden rounded bg-neutral-400 p-1">
        <div className="flex h-full items-end gap-1 p-0.5">
          {[19, 16, 21, 18, 19].map((h, i) => (
            <div key={i} className="flex gap-1">
              <div
                className="w-1.5 rounded-sm bg-lime-200"
                style={{ height: `${h}px` }}
              />
              <div
                className="w-1.5 rounded-sm bg-neutral-300"
                style={{ height: `${h - 5}px` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
