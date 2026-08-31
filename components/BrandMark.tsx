export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 min-w-0">
      <span
        className="relative grid place-items-center shrink-0 rounded-xl"
        style={{
          width: compact ? 32 : 40,
          height: compact ? 32 : 40,
          background:
            "linear-gradient(145deg, var(--cyan, #22d3ee) 0%, var(--turquoise, #14b8a6) 55%, #0e8f8a 100%)",
          boxShadow: "0 8px 20px -10px color-mix(in oklab, var(--turquoise, #14b8a6) 60%, transparent)",
        }}
        aria-hidden
      >
        <svg
          width={compact ? 18 : 22}
          height={compact ? 18 : 22}
          viewBox="0 0 24 24"
          fill="none"
        >
          {/* Pen body */}
          <path
            d="M14.5 3.5L20.5 9.5L11 19H5V13L14.5 3.5Z"
            fill="#041110"
            fillOpacity="0.9"
          />
          {/* Nib tip (pointing “down” into the note) */}
          <path d="M5 19L7.2 16.8L9.4 19H5Z" fill="#041110" />
          {/* Waveform ink trail */}
          <path
            d="M3 20.5C4.5 19.2 5.5 19.2 7 20.5C8.5 21.8 9.5 21.8 11 20.5"
            stroke="#041110"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Highlight edge on pen */}
          <path
            d="M15.2 4.8L19.2 8.8"
            stroke="white"
            strokeOpacity="0.35"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {!compact && (
        <span className="font-[family-name:var(--font-display)] font-semibold tracking-tight text-[var(--text)] text-lg truncate">
          Pen<span className="text-[var(--accent)]">Down</span>
        </span>
      )}
    </span>
  );
}