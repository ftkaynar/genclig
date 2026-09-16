import Link from "next/link";

import { Icon } from "@/components/ui/icon";

/*
  "Şehrin için bildir" çağrısı (D34 FAZ BD).

  Ana sayfada zaten vardı; artık /gorevler'de de filtrelerin hemen
  altında. Tek bileşen, çünkü iki ekranda iki kopya tutmak, birinin
  metni ya da ödülü değişince ötekinin geride kalması demekti — bu
  dilimdeki diğer üç fazın da ortak derdi.

  Neden /gorevler'de: "yapacak iş" arayan kullanıcı oraya gidiyor ama
  listede yalnız yayınlanmış görevler var. Bildirmek de bir katkı ve
  aynı ödül ekonomisine bağlı; görev listesinin dibinde ayrı bir
  ekranda saklı kalması, sivil amacın en görünür yerde olmaması
  demekti.

  Ödül metni burada SABİT (+25 XP • +10 Token): değerler
  problem_reports akışında koda gömülü, ayar tablosundan gelmiyor.
  Ayardan okumak için yeni bir sorgu açmak gerekiyordu ve bu dilim
  yalnız görsel. Değer değişirse TEK yer burası.
*/
export function ReportCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/bildir"
      className={`press-soft brand-gradient flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
        <Icon name="megaphone" className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">Şehrin için bildir</span>
        <span className="block text-[12px] text-white/85">
          Sorun, öneri ya da proje · +25 XP • +10 Token
        </span>
      </span>
      <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
    </Link>
  );
}
