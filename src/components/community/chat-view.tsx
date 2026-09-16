"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import {
  deleteOwnMessageAction,
  postMessageAction,
  refreshMessagesAction,
  reportMessageAction,
} from "@/lib/community/actions";
import {
  MESSAGE_MAX,
  type ChannelMessage,
  type MyChannel,
} from "@/lib/community/labels";
import { getProfileCardAction, sendFriendRequestAction, type ProfileCard } from "@/lib/social/actions";

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <span
      aria-hidden
      className="brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function clock(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatView({
  channel,
  initialMessages,
  isMinor,
  isMuted,
}: {
  channel: MyChannel;
  initialMessages: ChannelMessage[];
  /** 18 yaş altı: kalıcı güvenlik şeridi gösteriliyor. */
  isMinor: boolean;
  /**
   * Susturma kararı sunucuda veriliyor.
   *
   * Neden burada hesaplanmıyor: `Date.now()` render içinde çağrılınca
   * bileşen saf olmaktan çıkıyor ve lint bunu hata sayıyor (aynı kurala
   * D07'de geri sayımda takılmıştık). Asıl kontrol zaten sunucuda:
   * post_message susturulmuş kullanıcıyı reddediyor, buradaki kilit
   * yalnızca kullanıcıya durumu göstermek için.
   */
  isMuted: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [card, setCard] = useState<ProfileCard | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const mutedUntil = channel.muted_until
    ? new Date(channel.muted_until)
    : null;

  /*
    Yeni mesaj yoklaması: 30 saniyede bir.

    Gerçek zamanlı kanal bu dilimin DOKUNMA listesinde. Yoklama aralığı
    30 sn: daha sık olması sohbetin hacmine göre gereksiz istek, daha
    seyreği "konuşma" hissini bozuyordu.
  */
  useEffect(() => {
    const timer = setInterval(async () => {
      const fresh = await refreshMessagesAction();
      setMessages(fresh);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Yeni mesaj gelince en alta kaydır — sohbet düzeninde en yeni altta.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (body.length === 0) return;

    setNotice(null);
    setPending(true);
    try {
      const result = await postMessageAction(body);
      if (result.error) {
        setNotice(result.error);
        return;
      }
      setDraft("");
      setMessages(await refreshMessagesAction());
    } finally {
      setPending(false);
    }
  }

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setPending(true);
    try {
      const result = await fn();
      setNotice(result.error ?? result.notice ?? null);
      if (!result.error) setMessages(await refreshMessagesAction());
    } finally {
      setPending(false);
      setMenuFor(null);
    }
  }

  const remaining = MESSAGE_MAX - draft.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/*
        Kanalın kapsamı açıkça yazılı. D29'da topluluk ilçeden İL'e
        geçti; kullanıcının "bu sohbeti kim görüyor" sorusunu
        tahmin etmesi gerekmemeli — çocuk güvenliğinde kapsamın
        belirsiz olması başlı başına bir risk.
      */}
      <p className="mx-4 mt-3 flex items-center gap-1.5 rounded-xl border border-edge bg-card px-3.5 py-2 text-[11px] text-ink-muted">
        <Icon name="globe" className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Bu sohbet <strong className="text-ink">{channel.district_name}</strong>
          &apos;deki tüm GençLİG kullanıcılarına açık.
        </span>
      </p>

      {/*
        18 yaş altı güvenlik şeridi. Kapatılamıyor: kapatılabilir bir
        uyarı ilk gün kapatılır ve bir daha görünmez.
      */}
      {isMinor ? (
        <div className="mx-4 mt-3 rounded-xl border border-status-warning/50 bg-status-warning/10 px-3.5 py-2.5">
          <p className="flex items-start gap-2 text-[11px] font-medium text-status-warning">
            <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Kişisel bilgilerini (adres, telefon, okul adı) paylaşma.
              Tanımadığın biri seninle buluşmak isterse yazma, mesajı
              <strong> rapor et</strong>.
            </span>
          </p>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="mx-4 mt-3 rounded-xl border border-edge bg-card px-3.5 py-2 text-xs text-ink-muted"
        >
          {notice}
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
            <span className="mx-auto block w-fit">
              <Avatar url={card.avatar_url} name={card.username} />
            </span>
            <p className="mt-3 text-lg font-bold text-ink">{card.username}</p>
            <p className="text-sm text-ink-muted">Seviye {card.level}</p>

            {!card.is_friend ? (
              <p className="mt-3 rounded-xl bg-surface px-3.5 py-2.5 text-[11px] text-ink-muted">
                Ayrıntılar yalnızca arkadaşlara görünür.
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              {!card.is_friend && card.request_status === "none" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => sendFriendRequestAction(card.username)).then(() =>
                      setCard(null),
                    )
                  }
                  className="btn-chunky bg-cta flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Arkadaş ekle
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCard(null)}
                className="flex-1 rounded-full border border-edge px-4 py-2.5 text-sm font-medium text-ink-muted"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mesaj akışı */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
            Henüz mesaj yok. İlk yazan sen ol.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.is_mine ? "flex justify-end" : "flex"}
              >
                <div
                  className={`max-w-[80%] ${message.is_mine ? "items-end" : ""}`}
                >
                  {!message.is_mine ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setPending(true);
                        try {
                          setCard(await getProfileCardAction(message.username));
                        } finally {
                          setPending(false);
                        }
                      }}
                      className="mb-1 flex items-center gap-1.5"
                    >
                      <Avatar
                        url={message.avatar_url}
                        name={message.username}
                      />
                      <span className="text-[11px] font-semibold text-ink">
                        {message.username}
                      </span>
                      <span className="rounded-full bg-primary/15 px-1.5 text-[9px] font-bold text-primary">
                        {message.level}
                      </span>
                    </button>
                  ) : null}

                  <div
                    className={
                      message.is_mine
                        ? "brand-gradient rounded-2xl rounded-br-sm px-3.5 py-2 text-white"
                        : "rounded-2xl rounded-tl-sm border border-edge bg-card px-3.5 py-2"
                    }
                  >
                    <p
                      className={`whitespace-pre-wrap break-words text-sm ${
                        message.is_mine ? "text-white" : "text-ink"
                      }`}
                    >
                      {message.body}
                    </p>
                    <p
                      className={`mt-0.5 text-right text-[10px] ${
                        message.is_mine ? "text-white/70" : "text-ink-muted"
                      }`}
                    >
                      {clock(message.created_at)}
                    </p>
                  </div>

                  {/* Mesaj menüsü */}
                  <div
                    className={`mt-0.5 flex ${message.is_mine ? "justify-end" : ""}`}
                  >
                    {menuFor === message.id ? (
                      <span className="flex gap-2">
                        {message.is_mine ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() => deleteOwnMessageAction(message.id))
                            }
                            className="text-[10px] font-semibold text-status-danger"
                          >
                            Sil
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(() =>
                                reportMessageAction(
                                  message.id,
                                  "Uygunsuz içerik",
                                ),
                              )
                            }
                            className="text-[10px] font-semibold text-status-danger"
                          >
                            Rapor et
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMenuFor(null)}
                          className="text-[10px] font-medium text-ink-muted"
                        >
                          Vazgeç
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMenuFor(message.id)}
                        aria-label="Mesaj menüsü"
                        className="text-[10px] font-medium text-ink-muted hover:text-ink"
                      >
                        ⋯
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Giriş kutusu */}
      <div className="sticky bottom-0 border-t border-edge bg-card px-4 py-2.5">
        {isMuted ? (
          <p className="rounded-xl bg-status-danger/10 px-3.5 py-2.5 text-center text-xs font-medium text-status-danger">
            Bu kanalda geçici olarak yazamıyorsun
            {mutedUntil
              ? ` · ${mutedUntil.toLocaleString("tr-TR")} sonrasında açılacak`
              : ""}
            .
          </p>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value.slice(0, MESSAGE_MAX))
                }
                rows={1}
                placeholder="Mesajını yaz"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
              />
              <button
                type="button"
                disabled={pending || draft.trim().length === 0}
                onClick={send}
                aria-label="Gönder"
                className="btn-chunky bg-cta flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-white disabled:opacity-50"
              >
                <Icon name="chevron-right" className="h-5 w-5" />
              </button>
            </div>
            <p
              className={`mt-1 text-right text-[10px] ${
                remaining < 50 ? "text-status-warning" : "text-ink-muted"
              }`}
            >
              {remaining} karakter kaldı
            </p>
          </>
        )}
      </div>
    </div>
  );
}
