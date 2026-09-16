"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import {
  closeTicketAction,
  getTicketMessagesAction,
  replyTicketAction,
} from "@/lib/support/actions";
import {
  TICKET_STATUS_LABEL,
  type AdminTicketRow,
  type TicketMessage,
} from "@/lib/support/labels";

function statusClass(status: string): string {
  if (status === "answered") {
    return "bg-status-success/15 text-status-success";
  }
  if (status === "closed") {
    return "bg-surface text-ink-muted";
  }
  return "bg-status-warning/15 text-status-warning";
}

export function AdminTicketList({ tickets }: { tickets: AdminTicketRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /*
    Konuşma talep açıldığında çekiliyor. Tüm kuyruğun mesajlarını birlikte
    getirmek, personelin çoğunu hiç açmayacağı yüzlerce mesajı taşımak
    demekti.
  */
  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      setMessages(await getTicketMessagesAction(id));
      setOpenId(id);
      setReply("");
    } finally {
      setPending(false);
    }
  }

  async function run(
    fn: () => Promise<{ error?: string; notice?: string }>,
  ): Promise<boolean> {
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

  if (tickets.length === 0) {
    return (
      <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
        Bu filtrede destek talebi yok.
      </p>
    );
  }

  return (
    <div>
      {message ? (
        <p
          role="status"
          className="mb-3 rounded-xl border border-edge bg-card px-3.5 py-2.5 text-sm text-ink-muted"
        >
          {message}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2.5">
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            className="overflow-hidden rounded-2xl border border-edge bg-card"
          >
            <button
              type="button"
              onClick={() => toggle(ticket.id)}
              aria-expanded={openId === ticket.id}
              className="press-soft flex w-full items-center gap-3 rounded-2xl p-3.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {ticket.subject}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(
                      ticket.status,
                    )}`}
                  >
                    {TICKET_STATUS_LABEL[ticket.status]}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    {ticket.username} · {ticket.message_count} mesaj ·{" "}
                    {new Date(ticket.updated_at).toLocaleDateString("tr-TR")}
                  </span>
                </span>
              </span>
            </button>

            {openId === ticket.id ? (
              <div className="border-t border-edge p-3.5">
                <ul className="flex flex-col gap-2">
                  {messages.map((item) => (
                    <li
                      key={item.id}
                      className={
                        item.is_staff
                          ? "ml-6 rounded-xl border border-primary/40 bg-primary/10 p-2.5"
                          : "mr-6 rounded-xl border border-edge bg-surface p-2.5"
                      }
                    >
                      <span className="block text-[11px] font-semibold text-ink-muted">
                        {item.is_staff ? "Destek ekibi" : ticket.username} ·{" "}
                        {new Date(item.created_at).toLocaleString("tr-TR")}
                      </span>
                      <span className="mt-1 block whitespace-pre-wrap text-sm text-ink">
                        {item.body}
                      </span>
                    </li>
                  ))}
                </ul>

                {ticket.status === "closed" ? (
                  <p className="mt-3 text-xs text-ink-muted">
                    Talep kapatıldı; yeni mesaj eklenemez.
                  </p>
                ) : (
                  <>
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={3}
                      placeholder="Yanıtını yaz"
                      className="mt-3 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button variant="primary" size="md" type="button" disabled={pending} onClick={async () => { const ok = await run(() => replyTicketAction(ticket.id, reply), ); if (ok) { setReply(""); setOpenId(null); router.refresh(); } }}>
                        Yanıtla
                      </Button>
                      <Button variant="secondary" size="md" type="button" disabled={pending} onClick={async () => { const ok = await run(() => closeTicketAction(ticket.id), ); if (ok) { setOpenId(null); router.refresh(); } }}>
                        Kapat
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
