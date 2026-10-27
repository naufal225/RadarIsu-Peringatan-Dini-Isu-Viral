/** Tanda RadarIsu: busur konsentris dan satu titik. Warna mengikuti teks (currentColor); bukan lambang resmi mana pun. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M4 22a12 12 0 0 1 12-12" />
      <path d="M9 22a7 7 0 0 1 7-7" />
      <circle cx="21.5" cy="22" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
