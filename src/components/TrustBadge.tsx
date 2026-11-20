export function TrustBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="C Breeze Notary and Signing — vetted notary network serving all 50 states"
    >
      <defs>
        <linearGradient id="tb-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="55%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <path id="tb-arc-top" d="M 14 100 A 86 86 0 0 1 186 100" fill="none" />
        <path id="tb-arc-bottom" d="M 14 100 A 86 86 0 0 0 186 100" fill="none" />
      </defs>

      {/* outer band */}
      <circle cx="100" cy="100" r="98" fill="url(#tb-ring)" />
      <circle cx="100" cy="100" r="72" fill="#ffffff" />
      <circle
        cx="100"
        cy="100"
        r="66"
        fill="none"
        stroke="#0d9488"
        strokeOpacity="0.35"
        strokeDasharray="3 5"
      />

      {/* arc text */}
      <text
        fill="#ffffff"
        fontSize="13"
        fontWeight="700"
        letterSpacing="2.5"
        fontFamily="Outfit, system-ui, sans-serif"
      >
        <textPath href="#tb-arc-top" startOffset="50%" textAnchor="middle">
          C BREEZE NOTARY &amp; SIGNING
        </textPath>
      </text>
      <text
        fill="#ffffff"
        fontSize="11"
        fontWeight="600"
        letterSpacing="3"
        fontFamily="Outfit, system-ui, sans-serif"
      >
        <textPath href="#tb-arc-bottom" startOffset="50%" textAnchor="middle">
          SERVING ALL 50 STATES
        </textPath>
      </text>

      {/* checkmark */}
      <path
        d="M 74 92 L 93 110 L 128 70"
        fill="none"
        stroke="#0d9488"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* center text */}
      <text
        x="100"
        y="134"
        textAnchor="middle"
        fill="#1e293b"
        fontSize="12"
        fontWeight="800"
        letterSpacing="3.5"
        fontFamily="Outfit, system-ui, sans-serif"
      >
        VETTED
      </text>
      <text
        x="100"
        y="150"
        textAnchor="middle"
        fill="#0f766e"
        fontSize="10"
        fontWeight="600"
        letterSpacing="2"
        fontFamily="Outfit, system-ui, sans-serif"
      >
        NOTARY NETWORK
      </text>

      {/* orange accent dots */}
      <circle cx="36" cy="100" r="3" fill="#f97316" />
      <circle cx="164" cy="100" r="3" fill="#f97316" />
    </svg>
  );
}
