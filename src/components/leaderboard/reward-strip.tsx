import { Icon } from "@/components/ui/icon";
import type { RewardSetting } from "@/lib/leaderboard/rewards";

/*
  Dönem ödülü şeridi.

  Sıralamanın bir SONU olduğunu söylüyor: bitmeyen bir liste, başa
  oynamayan kullanıcı için anlamsız. "İlk 3'e ne var" görünür olmazsa
  ödülün teşvik değeri de yok.

  Yalnızca Türkiye ve Takım kapsamlarında gösteriliyor; il/ilçe/mahalle
  sıralamalarında ödül YOK (küçük ilçede üç kişilik listenin birincisine
  her hafta ödül vermek ödülü değersizleştirirdi — bkz. M29b).
*/
/*
  Dönem etiketleri.

  Kayıtsız bir dönem gelirse şerit hiç çizilmiyor (aşağıda), bu yüzden
  burada varsayılan bir metne düşmek gerekmiyor — "Bu hafta"ya düşmek,
  yanlış dönemin ödülünü doğru dönem gibi göstermek olurdu.
*/
const PERIOD_LABEL: Record<string, string> = {
  week: "Bu hafta",
  month: "Bu ay",
  season: "Bu sezon",
};

export function RewardStrip({
  settings,
  period,
  isTeams = false,
}: {
  settings: RewardSetting[];
  period: string;
  /** Takım modunda metin "takımının ilk 3'e girmesi" anlamına geliyor. */
  isTeams?: boolean;
}) {
  const label = PERIOD_LABEL[period];

  /*
    Şerit yalnızca SEÇİLİ kombinasyonun kaydı varsa görünüyor.

    Kayıt yokken (yönetici sezon satırlarını kapattı, ya da şema geride
    kaldı) şeridi çizmek "ödül var" demek olurdu; dağıtım yapılmayacağı
    için bu boş bir vaat.
  */
  if (settings.length === 0 || !label) {
    return null;
  }

  const top = settings.find((s) => s.rank === 1);
  if (!top) return null;

  return (
    <div className="anim-stagger mb-3 flex items-center gap-2.5 rounded-2xl border border-coin/40 bg-coin/10 px-3.5 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coin/25 text-coin">
        <Icon name="trophy" className="h-4.5 w-4.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink">
          {label} ilk 3&apos;e {isTeams ? "takım ödülü" : "ödül"} var
        </span>
        <span className="block truncate text-[11px] text-ink-muted">
          {settings
            .map((s) => `${s.rank}. +${s.xp} XP +${s.token} Token`)
            .join(" · ")}
        </span>
      </span>
    </div>
  );
}
