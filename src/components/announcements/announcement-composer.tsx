"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import { sendAnnouncementAction } from "@/lib/announcements/actions";
import {
  AUDIENCE_LABEL,
  type AnnouncementRow,
} from "@/lib/announcements/labels";

type Municipality = { id: string; name: string };

/*
  Duyuru oluşturma ve geçmiş listesi.

  Hedef seçenekleri role göre daralıyor: personel yalnızca kendi
  belediyesine gönderebiliyor, dolayısıyla ona "Tüm kullanıcılar" ve
  "Tek kullanıcı" seçenekleri hiç gösterilmiyor. Bu bir güvenlik önlemi
  değil, kullanıcıyı reddedilecek bir seçime sürüklememek için — asıl
  kural `send_announcement` içinde ve orada ölçüldü.
*/
export function AnnouncementComposer({
  announcements,
  municipalities,
  isSuper,
  fixedMunicipalityId,
}: {
  announcements: AnnouncementRow[];
  municipalities: Municipality[];
  isSuper: boolean;
  /** Personel görünümünde hedef belediye sabit. */
  fixedMunicipalityId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState(isSuper ? "all" : "municipality");
  const [municipalityId, setMunicipalityId] = useState(
    fixedMunicipalityId ?? municipalities[0]?.id ?? "",
  );
  const [username, setUsername] = useState("");

  const audiences = isSuper
    ? (["all", "municipality", "user"] as const)
    : (["municipality"] as const);

  async function send() {
    setMessage(null);
    setPending(true);
    try {
      const result = await sendAnnouncementAction({
        title,
        body,
        audience,
        municipalityId:
          audience === "municipality"
            ? (fixedMunicipalityId ?? municipalityId)
            : null,
        username: audience === "user" ? username : null,
      });
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) {
        setTitle("");
        setBody("");
        setUsername("");
        setOpen(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
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

      {open ? (
        <section className="mb-4 rounded-2xl border border-edge bg-card p-4">
          <h2 className="text-base font-bold text-ink">Yeni duyuru</h2>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-muted">Başlık</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="Kısa ve net bir başlık"
              className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-muted">Metin</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Duyuru metni (en az 10 karakter)"
              className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
            />
          </label>

          <span className="mt-3 block text-xs font-medium text-ink-muted">
            Hedef
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {audiences.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAudience(key)}
                aria-pressed={audience === key}
                className={
                  audience === key
                    ? "rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-edge px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:text-ink"
                }
              >
                {AUDIENCE_LABEL[key]}
              </button>
            ))}
          </div>

          {audience === "municipality" && !fixedMunicipalityId ? (
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-muted">
                Belediye
              </span>
              <select
                value={municipalityId}
                onChange={(event) => setMunicipalityId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary"
              >
                {municipalities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {audience === "user" ? (
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-muted">
                Kullanıcı adı
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="kullanici_adi"
                className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
              />
            </label>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={send}
              className="btn-chunky bg-cta rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Gönderiliyor..." : "Gönder"}
            </button>
            <Button variant="secondary" size="md" type="button" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </section>
      ) : (
        <Button variant="primary" size="md" type="button" onClick={() => setOpen(true)}>
          Yeni duyuru
        </Button>
      )}

      {announcements.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-card px-4 py-8 text-center text-sm text-ink-muted">
          Henüz duyuru gönderilmedi.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {announcements.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-edge bg-card p-3.5"
            >
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-ink-muted">
                {item.body}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                  {AUDIENCE_LABEL[item.audience] ?? item.audience}
                  {item.municipality_name ? ` · ${item.municipality_name}` : ""}
                </span>
                <span>{item.sent_count} kişiye gönderildi</span>
                {item.created_by_username ? (
                  <span>· {item.created_by_username}</span>
                ) : null}
                <span>
                  · {new Date(item.created_at).toLocaleDateString("tr-TR")}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
