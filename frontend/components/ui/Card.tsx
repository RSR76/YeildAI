export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[linear-gradient(160deg,rgba(255,255,255,0.82),rgba(255,255,255,0.55))] border border-[rgba(255,255,255,0.7)] rounded-[18px] shadow-[0_1px_2px_rgba(20,49,42,0.04),0_16px_40px_-20px_rgba(20,49,42,0.22)] backdrop-blur-[14px] p-[22px]">
      <h3 className="font-[var(--font-display)] text-[19px] font-medium text-[var(--forest-900)] mb-4">{title}</h3>
      {children}
    </div>
  );
}
