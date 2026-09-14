/**
 * Dairesel seviye halkası.
 *
 * SVG ile çiziliyor: ilerleme çemberin çevresi üzerinden stroke-dasharray ile
 * veriliyor, böylece ek bir kütüphane ya da animasyon motoru gerekmiyor ve
 * sunucuda render edilebiliyor.
 *
 * Halka, dolu kısmı `progress` (0-1) oranında gösteriyor; 0 olduğunda bile
 * arka çember çiziliyor ki gösterge boş görünmesin.
 */
export function LevelRing({
  level,
  progress,
  size = 84,
  strokeWidth = 7,
  tone = "light",
}: {
  level: number;
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** "light": koyu zemin üzerinde (hero kartı). "dark": açık kart üzerinde. */
  tone?: "light" | "dark";
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(Math.max(progress, 0), 1);
  const filled = circumference * clamped;

  const trackClass = tone === "light" ? "stroke-white/25" : "stroke-edge";
  const valueClass = tone === "light" ? "stroke-cta" : "stroke-primary";
  const labelClass = tone === "light" ? "fill-white" : "fill-ink";
  const captionClass = tone === "light" ? "fill-white/70" : "fill-ink-muted";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Seviye ${level}, ilerleme yüzde ${Math.round(clamped * 100)}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={trackClass}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        // Dolum saat 12'den başlasın diye çeyrek tur geri döndürülüyor.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={valueClass}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        className={`${labelClass} text-[18px] font-bold`}
      >
        {level}
      </text>
      <text
        x="50%"
        y="65%"
        textAnchor="middle"
        dominantBaseline="middle"
        className={`${captionClass} text-[9px] font-medium`}
      >
        SEVİYE
      </text>
    </svg>
  );
}
