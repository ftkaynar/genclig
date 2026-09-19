import Link from "next/link";

import { ChainCard } from "./chain-card";
import { HScroll } from "@/components/ui/h-scroll";
import { Icon } from "@/components/ui/icon";
import type { ChainRow } from "@/lib/chains/queries";

/*
  Zincirler bandı (D33 FAZ Z).

  /gorevler üstünde yatay şerit. Tek görev listesinin yanında "bunları
  birlikte yaparsan fazladan kazanırsın" diyen ikinci bir katman.

  Kart işaretlemesi chain-card.tsx'te (gerekçe orada): /zincirler index
  sayfası aynı kartı kullanıyor ve iki kopya tutmak istemedik.
*/
export function ChainStrip({ chains }: { chains: ChainRow[] }) {
  if (chains.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="list-checks" className="h-4 w-4 text-indigo" />
          Zincirler
        </h2>

        {/*
          "Tümü" bağlantısı (D36 FAZ ZR).

          Şerit yatay kaydırmalı ve üçten fazla zincirde sondakiler
          görünmüyordu; index sayfası olmadığı için de gidilecek bir yer
          yoktu. Şerit her zaman değil, DÖRTTEN itibaren bağlantı
          gösteriyor: üç kartın tamamı ekranda görünürken "tümünü gör"
          demek aynı üç kartı ikinci kez göstermek olurdu.
        */}
        {chains.length > 3 ? (
          <Link
            href="/zincirler"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-indigo hover:underline"
          >
            Tümü
            <Icon name="chevron-right" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <HScroll as="ul" ariaLabel="Görev zincirleri">
        {chains.map((chain) => (
          <li key={chain.chain_id} className="w-[210px] shrink-0 snap-start">
            <ChainCard chain={chain} />
          </li>
        ))}
      </HScroll>
    </section>
  );
}
