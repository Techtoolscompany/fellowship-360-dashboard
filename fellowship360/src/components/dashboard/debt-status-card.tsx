export function DebtStatusCard() {
  return (
    <div className="flex h-[277px] flex-col justify-between overflow-hidden rounded-card border border-neutral-400 bg-dark p-4">
      {/* Header */}
      <div>
        <p className="mb-1 text-xl font-bold capitalize text-white">
          Goal Progress
        </p>
        <p className="text-base text-white">Annual Giving Goal</p>
      </div>

      {/* Progress Section */}
      <div className="flex flex-col gap-3">
        {/* Progress Bar */}
        <div className="flex items-baseline pr-5">
          <div className="relative z-[2] -mr-5 h-[19px] w-[157px] rounded-pill bg-lime-400" />
          <div className="z-[1] h-[19px] flex-1 rounded-pill bg-neutral-300" />
        </div>

        {/* Info */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-base font-medium text-white">
            $156,000 of $250,000
          </span>
          <span className="text-base text-white">62% Complete</span>
        </div>

        {/* Button */}
        <button className="w-full rounded-pill border-none bg-white px-4 py-3 text-base font-semibold text-dark transition-colors hover:bg-neutral-100">
          View Details
        </button>
      </div>
    </div>
  );
}
