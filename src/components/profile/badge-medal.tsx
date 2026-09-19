import { Icon } from "@/components/ui/icon";
import type { BadgeTone } from "@/lib/profile/badge-tones";

/*
  Rozet madalyası (D36 FAZ RZ).

  ÖNCEKİ DURUM: rozet, kenarı yuvarlatılmış bir kare kutuydu — rozetin
  kendi tonunda %20 opak bir dolgu, içinde aynı tonda ince çizgili bir
  lucide ikonu. Uygulamadaki her "renkli kutu içinde ikon" öğesiyle
  (kategori çipi, durum hapı, HUD rozeti) tıpatıp aynı reçeteydi. Yani
  oyunun en değerli öğesi, en sıradan öğesiyle aynı görünüyordu:
  kazanılmış bir rozete bakarken "bu bir ödül" hissi yoktu.

  Madalya BEŞ KATMAN. Her biri farklı bir iş yapıyor, hiçbiri süs değil:

    1. Dış metal halka  — kategori renginde eğik gradyan + bevel
                          gölgeleri. Hacmi bu veriyor: üstte açık,
                          altta koyu, yani ışık yukarıdan geliyor.
    2. İç kenar çizgisi — halka ile diski ayıran ince ışık hattı.
                          Olmadan iki katman tek parça gibi eriyordu.
    3. İç disk          — koyu, merkezden dışa doğru kararan. Madalyanın
                          "oyulmuş" yüzü; ikon bunun üstünde oturuyor.
    4. İkon             — rozetin kendi lucide ikonu, renkten beyaza
                          doğru açılmış tonda, altında gölge.
    5. Cam parlaması    — yalnız ÜST yarıda. Alt yarıya da koymak
                          denendi ve elendi: iki yönden gelen ışık
                          hacmi düzleştiriyor, madalya çıkartmaya
                          dönüyordu.

  Renk `--medal` değişkeninden geliyor ve türevleri `color-mix` ile
  burada hesaplanıyor. Sekiz ton için sekiz sınıf seti yazmak denendi ve
  elendi: Tailwind literal sınıf istiyor, yani 8 ton x 5 katman = 40
  sınıf elle yazılacaktı ve yeni bir ton eklemek 5 yeni sınıf demekti.

  KİLİTLİ rozet aynı madalya: doygunluğu kısılmış, soğuk bir örtü ve
  köşede kilit. D27'deki karar korunuyor — kilitli rozette de KENDİ
  ikonu duruyor, kullanıcı neyi kazanacağını görüyor.
*/

const SIZE = {
  /** Kart arka yüzü, HUD gibi dar yerler. */
  sm: 36,
  /** Profil rozet ızgarası. */
  md: 56,
  /** Detay modalı. */
  lg: 88,
} as const;

export function BadgeMedal({
  icon,
  tone,
  earned,
  size = "md",
}: {
  icon: string | null;
  tone: BadgeTone;
  earned: boolean;
  size?: keyof typeof SIZE;
}) {
  const px = SIZE[size];

  return (
    <span
      aria-hidden
      className={`badge-medal ${earned ? "badge-medal-earned" : "badge-medal-locked"}`}
      style={
        {
          "--medal": tone.hex,
          width: `${px}px`,
          height: `${px}px`,
        } as React.CSSProperties
      }
    >
      <span className="badge-medal-disc" />
      <span className="badge-medal-rim" />

      <Icon name={icon ?? "award"} className="badge-medal-icon" />

      <span className="badge-medal-glass" />

      {!earned ? (
        <span className="badge-medal-lock">
          <Icon name="lock" className="h-full w-full" />
        </span>
      ) : null}
    </span>
  );
}
