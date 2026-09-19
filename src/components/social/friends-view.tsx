"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  getProfileCardAction,
  removeFriendAction,
  respondFriendRequestAction,
  searchUsersAction,
  sendFriendRequestAction,
  type ProfileCard,
  type SearchResult,
} from "@/lib/social/actions";
import { IdentityCard } from "@/components/card/identity-card";
import { Icon } from "@/components/ui/icon";
import { EmptyState, XpPill } from "@/components/ui/pills";
import type { FriendRequestRow, FriendRow } from "@/lib/social/queries";

type Tab = "friends" | "requests" | "search";

/** Avatar ya da baş harf rozeti. */
function Avatar({
  url,
  name,
  size = 40,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className="brand-gradient flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function FriendsView({
  friends,
  requests,
}: {
  friends: FriendRow[];
  requests: FriendRequestRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("friends");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [card, setCard] = useState<ProfileCard | null>(null);

  const incoming = requests.filter((item) => item.direction === "incoming");
  const outgoing = requests.filter((item) => item.direction === "outgoing");

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setMessage(null);
    setPending(true);
    try {
      const result = await fn();
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function doSearch() {
    setMessage(null);
    if (query.trim().length < 3) {
      setMessage("En az 3 karakter yaz.");
      return;
    }
    setPending(true);
    try {
      setResults(await searchUsersAction(query));
    } finally {
      setPending(false);
    }
  }

  async function openCard(username: string) {
    setPending(true);
    try {
      setCard(await getProfileCardAction(username));
    } finally {
      setPending(false);
    }
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "friends", label: "Arkadaşlarım", count: friends.length },
    { key: "requests", label: "İstekler", count: incoming.length },
    { key: "search", label: "Ara" },
  ];

  return (
    <div>
      <nav aria-label="Arkadaş sekmeleri">
        <ul className="flex gap-2">
          {TABS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={tab === item.key ? "page" : undefined}
                className={
                  tab === item.key
                    ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-edge bg-card px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {item.label}
                {item.count ? ` (${item.count})` : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {message ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink-muted"
        >
          {message}
        </p>
      ) : null}

      {/* Profil kartı modalı */}
      {card ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand/80 px-6 backdrop-blur-sm"
        >
          <div className="anim-pop w-full max-w-sm rounded-3xl border border-edge bg-card p-6 text-center">
            {/*
              Arkadaşsa kimlik kartının mini sürümü; değilse yalnızca
              avatar ve seviye. İstatlar zaten sunucudan null geliyor.
            */}
            {card.is_friend && card.ovr !== null && card.tier ? (
              <span className="mx-auto block w-fit">
                <IdentityCard
                  size="mini"
                  identity={{
                    username: card.username,
                    avatarUrl: card.avatar_url,
                    level: card.level,
                    district: null,
                  }}
                  stats={{
                    user_id: card.user_id,
                    akt: card.akt ?? 0,
                    sos: card.sos ?? 0,
                    kat: card.kat ?? 0,
                    kes: card.kes ?? 0,
                    bil: card.bil ?? 0,
                    azm: card.azm ?? 0,
                    ovr: card.ovr,
                    tier: card.tier as "bronze" | "silver" | "gold" | "special",
                    computed_at: "",
                    // Arkadaş kartında soğuma rozeti gösterilmiyor:
                    // başkasının aktiflik geçmişi bize ait bir bilgi değil.
                    last_activity_at: null,
                  }}
                />
              </span>
            ) : (
              <Avatar url={card.avatar_url} name={card.username} size={72} />
            )}
            <p className="mt-3 text-lg font-bold text-ink">{card.username}</p>
            <p className="text-sm text-ink-muted">Seviye {card.level}</p>

            {card.is_friend ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <span className="rounded-xl bg-surface px-2 py-2.5">
                  <span className="block text-base font-bold text-xp">
                    {card.total_xp ?? 0}
                  </span>
                  <span className="block text-[11px] text-ink-muted">XP</span>
                </span>
                <span className="rounded-xl bg-surface px-2 py-2.5">
                  <span className="block text-base font-bold text-primary-ink">
                    {card.badge_count ?? 0}
                  </span>
                  <span className="block text-[11px] text-ink-muted">Rozet</span>
                </span>
                <span className="rounded-xl bg-surface px-2 py-2.5">
                  <span className="block text-base font-bold text-status-success">
                    {card.completed_tasks ?? 0}
                  </span>
                  <span className="block text-[11px] text-ink-muted">Görev</span>
                </span>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-surface px-3.5 py-3 text-xs text-ink-muted">
                Ayrıntılar yalnızca arkadaşlara görünür.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              {!card.is_friend && card.request_status === "none" ? (
                <Button variant="primary" size="md" type="button" disabled={pending} onClick={() => run(() => sendFriendRequestAction(card.username)).then(() => setCard(null), ) }>
                  Arkadaş ekle
                </Button>
              ) : null}

              {card.is_friend ? (
                <Button variant="danger" size="md" type="button" disabled={pending} onClick={() => run(() => removeFriendAction(card.user_id)).then(() => setCard(null), ) }>
                  Çıkar
                </Button>
              ) : null}

              <Button variant="secondary" size="md" type="button" onClick={() => setCard(null)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {tab === "friends" ? (
          friends.length === 0 ? (
            <EmptyState
              icon="users"
              title="Henüz arkadaşın yok"
              description="Kullanıcı adıyla arayıp istek gönderebilirsin."
              action={
                <Button variant="primary" size="md" type="button" onClick={() => setTab("search")}>
                  Arkadaş ara
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {friends.map((friend) => (
                <li key={friend.user_id}>
                  <Button variant="secondary" size="md" block type="button" onClick={() => openCard(friend.username)}>
                    <Avatar url={friend.avatar_url} name={friend.username} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {friend.username}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        Seviye {friend.level}
                      </span>
                    </span>
                    <XpPill value={friend.weekly_xp} className="shrink-0" />
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === "requests" ? (
          incoming.length === 0 && outgoing.length === 0 ? (
            <EmptyState
              icon="bell"
              title="Bekleyen istek yok"
              description="Sana gelen arkadaşlık istekleri burada görünür."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {incoming.length > 0 ? (
                <section>
                  <h2 className="text-sm font-semibold text-ink">
                    Gelen istekler
                  </h2>
                  <ul className="mt-2 flex flex-col gap-2.5">
                    {incoming.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3"
                      >
                        <Avatar url={item.avatar_url} name={item.username} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                          {item.username}
                        </span>
                        <Button variant="primary" size="sm" type="button" disabled={pending} onClick={() => run(() => respondFriendRequestAction(item.id, true)) }>
                          Kabul
                        </Button>
                        <Button variant="secondary" size="sm" type="button" disabled={pending} onClick={() => run(() => respondFriendRequestAction(item.id, false)) }>
                          Reddet
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {outgoing.length > 0 ? (
                <section>
                  <h2 className="text-sm font-semibold text-ink">
                    Gönderdiklerim
                  </h2>
                  <ul className="mt-2 flex flex-col gap-2.5">
                    {outgoing.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl border border-edge bg-card p-3"
                      >
                        <Avatar url={item.avatar_url} name={item.username} />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {item.username}
                        </span>
                        <span className="shrink-0 text-[11px] text-ink-muted">
                          Bekliyor
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )
        ) : null}

        {tab === "search" ? (
          <div>
            <div className="flex gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-edge bg-surface px-3 py-2">
                <Icon name="search" className="h-4 w-4 shrink-0 text-ink-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Kullanıcı adı (en az 3 karakter)"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </label>
              <Button variant="primary" size="md" type="button" onClick={doSearch} disabled={pending}>
                Ara
              </Button>
            </div>

            {results === null ? null : results.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-edge bg-card px-4 py-6 text-center text-sm text-ink-muted">
                Eşleşen kullanıcı bulunamadı.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {results.map((item) => (
                  <li key={item.user_id}>
                    <Button variant="secondary" size="md" block type="button" onClick={() => openCard(item.username)}>
                      <Avatar url={item.avatar_url} name={item.username} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {item.username}
                        </span>
                        <span className="block text-[11px] text-ink-muted">
                          Seviye {item.level}
                        </span>
                      </span>
                      <Icon
                        name="chevron-right"
                        className="h-4 w-4 shrink-0 text-ink-muted"
                      />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
