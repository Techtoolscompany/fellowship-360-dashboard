export function HighlightPromoCard() {
  return (
    <div className="relative h-[334px] overflow-hidden rounded-card border border-border bg-lime-50 p-4">
      {/* Decorative Dots */}
      <div className="mb-3 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-black" />
        ))}
      </div>

      {/* Title */}
      <h2 className="max-w-[268px] text-[28px] font-semibold capitalize leading-9 text-dark">
        Unlock the power of your ministry with Fellowship 360!
      </h2>

      {/* Concentric Circles */}
      <div className="absolute -right-10 -bottom-15 h-[284px] w-[284px]">
        <div className="absolute h-[284px] w-[284px] rounded-full border-2 border-lime-400/50" />
        <div className="absolute left-[26px] top-[26px] h-[232px] w-[232px] rounded-full border-2 border-lime-400/70" />
        <div className="absolute left-[52px] top-[52px] h-[180px] w-[180px] rounded-full bg-lime-400" />
      </div>
    </div>
  );
}
