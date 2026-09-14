"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { setUserRoleAction } from "@/lib/panel/admin-actions";

const ROLES = [
  { value: "municipality_admin", label: "Belediye yöneticisi" },
  { value: "municipality_operator", label: "Belediye operatörü" },
  { value: "moderator", label: "Moderatör" },
  { value: "super_admin", label: "Süper admin" },
];

/** Kullanıcıya rol verir/alır. Belediye rollerinde belediye seçimi zorunlu. */
export function RoleManager({
  userId,
  municipalities,
}: {
  userId: string;
  municipalities: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(ROLES[0].value);
  const [municipalityId, setMunicipalityId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const needsMunicipality = role.startsWith("municipality_");

  async function run(grant: boolean) {
    setMessage(null);

    if (needsMunicipality && !municipalityId) {
      setMessage("Belediye seçmelisin.");
      return;
    }

    setPending(true);
    try {
      const result = await setUserRoleAction({
        userId,
        role,
        municipalityId: needsMunicipality ? municipalityId : null,
        grant,
      });
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 rounded-full border border-edge px-3 py-1 text-[11px] font-medium text-ink-muted hover:text-ink"
      >
        Rol yönet
      </button>
    );
  }

  return (
    <div className="mt-2.5 rounded-xl border border-edge bg-surface p-3">
      {message ? (
        <p className="mb-2 text-[11px] text-ink-muted">{message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink"
        >
          {ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        {needsMunicipality ? (
          <select
            value={municipalityId}
            onChange={(event) => setMunicipalityId(event.target.value)}
            className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink"
          >
            <option value="">Belediye seç</option>
            {municipalities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          onClick={() => run(true)}
          disabled={pending}
          className="rounded-full bg-cta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          Ver
        </button>
        <button
          type="button"
          onClick={() => run(false)}
          disabled={pending}
          className="rounded-full border border-status-danger/50 px-3 py-1.5 text-xs font-medium text-status-danger disabled:opacity-60"
        >
          Al
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-edge px-3 py-1.5 text-xs text-ink-muted"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
