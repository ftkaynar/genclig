"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/pills";
import {
  closeTicketAction,
  createTicketAction,
  getTicketMessagesAction,
  replyTicketAction,
} from "@/lib/support/actions";
import {
  TICKET_STATUS_LABEL,
  type FaqItem,
  type TicketMessage,
  type TicketRow,
} from "@/lib/support/labels";

type Tab = "faq" | "tickets";

function statusClass(status: string): string {
  if (status === "answered") {
    return "bg-status-success/15 text-status-success";
  }
  if (status === "closed") {
    return "bg-surface text-ink-muted";
  }
  return "bg-status-warning/15 text-status-warning";
}

/** Tarih kısa ve yerel: uzun ISO metni mobil kartta satır kırıyordu. */
function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
  });
}

export function SupportView({
  faq,
  tickets,
}: {
  faq: FaqItem[];
  tickets: TicketRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("faq");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [thread, setThread] = useState<{
    ticket: TicketRow;
    messages: TicketMessage[];
  } | null>(null);
  const [reply, setReply] = useState("");

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setMessage(null);
    setPending(true);
    try {
      const result = await fn();
      setMessage(result.error ?? result.notice ?? null);
      return !result.error;
    } finally {
      setPending(false);
    }
  }

  /*
    Bildirimden gelen derin bağlantı: ?talep=<id> varsa o konuşma
    açılıyor. Effect bir kez koşuyor (ran bayrağı) ve setState'i
    doğrudan değil openThread üzerinden yapıyor; kullanıcı konuşmayı
    kapatırsa tekrar açılmamalı.
  */
  const params = useSearchParams();
  const deepLinked = useRef(false);

  useEffect(() => {
    if (deepLinked.current) return;
    const wanted = params.get("talep");
    if (!wanted) return;
    const found = tickets.find((t) => t.id === wanted);
    if (!found) return;
    deepLinked.current = true;
    void openThread(found);
  }, [params, tickets]);

  async function openThread(ticket: TicketRow) {
    setPending(true);
    try {
      setThread({
        ticket,
        messages: await getTicketMessagesAction(ticket.id),
      });
    } finally {
      setPending(false);
    }
  }

  const notice = message ? (
    <p
      role="status"
      className="mt-3 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink-muted"
    >
      {message}
    </p>
  ) : null;

  // ------------------------------------------------------------ tek konuşma
  if (thread) {
    const closed = thread.ticket.status === "closed";

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setThread(null);
            setReply("");
            setMessage(null);
          }}
          className="press-soft inline-flex min-h-[40px] items-center gap-1 rounded-[14px] px-3 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
          Taleplerime dön
        </button>

        <h2 className="mt-3 text-base font-bold text-ink">
          {thread.ticket.subject}
        </h2>
        <span
          className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(
            thread.ticket.status,
          )}`}
        >
          {TICKET_STATUS_LABEL[thread.ticket.status]}
        </span>

        <ul className="mt-4 flex flex-col gap-2.5">
          {thread.messages.map((item) => (
            <li
              key={item.id}
              className={
                item.is_staff
                  ? "mr-6 rounded-2xl rounded-tl-sm border border-primary/40 bg-primary/10 p-3"
                  : "ml-6 rounded-2xl rounded-tr-sm border border-edge bg-card p-3"
              }
            >
              <span className="block text-[11px] font-semibold text-ink-muted">
                {item.is_staff ? "Destek ekibi" : "Sen"} ·{" "}
                {shortDate(item.created_at)}
              </span>
              <span className="mt-1 block whitespace-pre-wrap text-sm text-ink">
                {item.body}
              </span>
            </li>
          ))}
        </ul>

        {notice}

        {closed ? (
          <p className="mt-4 rounded-xl bg-surface px-3.5 py-3 text-xs text-ink-muted">
            Bu talep kapatıldı. Yeni bir sorun için yeni talep açabilirsin.
          </p>
        ) : (
          <div className="mt-4">
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              rows={3}
              placeholder="Yanıtını yaz"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
            />
            <div className="mt-2 flex gap-2">
              <Button variant="primary" size="md" type="button" disabled={pending} onClick={async () => { const ok = await run(() => replyTicketAction(thread.ticket.id, reply), ); if (ok) { setReply(""); setThread(null); router.refresh(); } }}>
                Gönder
              </Button>
              <Button variant="secondary" size="md" type="button" disabled={pending} onClick={async () => { const ok = await run(() => closeTicketAction(thread.ticket.id), ); if (ok) { setThread(null); router.refresh(); } }}>
                Talebi kapat
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------- ana görünüm
  return (
    <div>
      <nav aria-label="Destek sekmeleri">
        <ul className="flex gap-2">
          {(
            [
              { key: "faq" as const, label: "Sık sorulanlar" },
              { key: "tickets" as const, label: "Taleplerim" },
            ]
          ).map((item) => (
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
                {item.key === "tickets" && tickets.length
                  ? ` (${tickets.length})`
                  : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {notice}

      {tab === "faq" ? (
        <ul className="mt-4 flex flex-col gap-2">
          {faq.map((item) => {
            const isOpen = openFaq === item.id;
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-2xl border border-edge bg-card"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 p-3.5 text-left"
                >
                  <span className="flex-1 text-sm font-semibold text-ink">
                    {item.question}
                  </span>
                  <Icon
                    name="chevron-right"
                    className={`h-4 w-4 shrink-0 text-ink-muted transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {isOpen ? (
                  <p className="border-t border-edge px-3.5 py-3 text-sm text-ink-muted">
                    {item.answer}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {tab === "tickets" ? (
        <div className="mt-4">
          {composing ? (
            <section className="rounded-3xl border border-edge bg-card p-5">
              <h2 className="text-base font-bold text-ink">Yeni talep</h2>
              <label className="mt-4 block">
                <span className="text-xs font-medium text-ink-muted">Konu</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={80}
                  placeholder="Kısaca konu"
                  className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-muted">
                  Mesajın
                </span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Sorunu olabildiğince ayrıntılı anlat (en az 10 karakter)"
                  className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
                />
              </label>
              <div className="mt-4 flex gap-2">
                <Button variant="primary" size="md" type="button" disabled={pending} onClick={async () => { const ok = await run(() => createTicketAction(subject, body), ); if (ok) { setSubject(""); setBody(""); setComposing(false); router.refresh(); } }}>
                  Gönder
                </Button>
                <Button variant="secondary" size="md" type="button" onClick={() => setComposing(false)}>
                  Vazgeç
                </Button>
              </div>
            </section>
          ) : (
            <Button variant="primary" size="md" block type="button" onClick={() => setComposing(true)}>
              Yeni talep aç
            </Button>
          )}

          {tickets.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon="megaphone"
                title="Henüz talebin yok"
                description="Bir sorun yaşarsan buradan destek ekibine yazabilirsin."
              />
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => openThread(ticket)}
                    /*
                      Yanıtlanmış talep vurgulu: kullanıcı listeye
                      baktığında hangisine bakması gerektiğini bilmeli.
                      Önceden tek ayrım küçük bir durum çipiydi ve
                      "Yanıtlandı" ile "Yanıt bekliyor" aynı ağırlıkta
                      duruyordu.
                    */
                    className={`press-soft flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-left ${
                      ticket.status === "answered"
                        ? "border-status-success/60"
                        : "border-edge hover:border-primary/60"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-semibold text-ink">
                          {ticket.subject}
                        </span>
                        {ticket.status === "answered" ? (
                          <span className="shrink-0 rounded-full bg-status-success px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Yeni yanıt
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                            ticket.status,
                          )}`}
                        >
                          {TICKET_STATUS_LABEL[ticket.status]}
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          {shortDate(ticket.updated_at)}
                        </span>
                      </span>
                    </span>
                    <Icon
                      name="chevron-right"
                      className="h-4 w-4 shrink-0 text-ink-muted"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
