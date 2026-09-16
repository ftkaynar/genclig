"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { EmptyState, XpPill } from "@/components/ui/pills";
import {
  createTeamAction,
  joinTeamAction,
  kickMemberAction,
  leaveTeamAction,
  transferCaptainAction,
} from "@/lib/teams/actions";
import type { MyTeam, TeamMemberRow } from "@/lib/teams/queries";

/*
  Takım ikonu seçenekleri: küratörlü ikon kümesinden takım kimliğine
  yakışan bir alt küme. Serbest metin bırakılmadı, çünkü tanınmayan ad
  varsayılan ikona düşüp kullanıcıyı şaşırtıyordu.
*/
const TEAM_ICONS = [
  "users",
  "shield",
  "flame",
  "waves",
  "target",
  "trophy",
  "star",
  "leaf",
  "zap",
  "flag",
];

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

export function TeamView({
  team,
  members,
}: {
  team: MyTeam | null;
  members: TeamMemberRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Takımsız görünüm
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("users");
  const [code, setCode] = useState("");

  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    setMessage(null);
    setPending(true);
    try {
      const result = await fn();
      setMessage(result.error ?? result.notice ?? null);
      if (!result.error) {
        setMode("none");
        setName("");
        setCode("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Pano izni yoksa kod zaten ekranda yazılı; sessizce geçiliyor.
      setMessage("Kodu kopyalayamadım, elle yazabilirsin.");
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

  // ---------------------------------------------------------------- takımsız
  if (!team) {
    return (
      <div>
        {mode === "none" ? (
          <EmptyState
            icon="users"
            title="Henüz bir takımda değilsin"
            description="Takım görevlerinde eşiği birlikte doldurun, bonus herkese yazılsın."
            action={
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="md" type="button" onClick={() => setMode("create")}>
                  Takım kur
                </Button>
                <Button variant="secondary" size="md" type="button" onClick={() => setMode("join")}>
                  Kodla katıl
                </Button>
              </div>
            }
          />
        ) : null}

        {mode === "create" ? (
          <section className="rounded-3xl border border-edge bg-card p-5">
            <h2 className="text-base font-bold text-ink">Takım kur</h2>
            <label className="mt-4 block">
              <span className="text-xs font-medium text-ink-muted">
                Takım adı
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="En az 3 karakter"
                maxLength={40}
                className="mt-1 w-full rounded-xl border border-edge bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary"
              />
            </label>

            <span className="mt-4 block text-xs font-medium text-ink-muted">
              Takım ikonu
            </span>
            <ul className="mt-2 flex flex-wrap gap-2">
              {TEAM_ICONS.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => setIcon(item)}
                    aria-pressed={icon === item}
                    aria-label={`İkon ${item}`}
                    className={
                      icon === item
                        ? "flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"
                        : "flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-surface text-ink-muted"
                    }
                  >
                    <Icon name={item} className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex gap-2">
              <Button variant="primary" size="md" type="button" disabled={pending} onClick={() => run(() => createTeamAction(name, icon))}>
                Kur
              </Button>
              <Button variant="secondary" size="md" type="button" onClick={() => setMode("none")}>
                Vazgeç
              </Button>
            </div>
          </section>
        ) : null}

        {mode === "join" ? (
          <section className="rounded-3xl border border-edge bg-card p-5">
            <h2 className="text-base font-bold text-ink">Kodla katıl</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Takım kaptanından aldığın 6 haneli kodu gir.
            </p>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              className="mt-4 w-full rounded-xl border border-edge bg-surface px-3.5 py-3 text-center text-xl font-bold tracking-[0.35em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink-muted focus:border-primary"
            />

            <div className="mt-5 flex gap-2">
              <Button variant="primary" size="md" type="button" disabled={pending} onClick={() => run(() => joinTeamAction(code))}>
                Katıl
              </Button>
              <Button variant="secondary" size="md" type="button" onClick={() => setMode("none")}>
                Vazgeç
              </Button>
            </div>
          </section>
        ) : null}

        {notice}
      </div>
    );
  }

  // ---------------------------------------------------------------- takım var
  const isCaptain = team.my_role === "captain";
  const teamXp = members.reduce((sum, member) => sum + member.weekly_xp, 0);

  return (
    <div>
      <section className="brand-gradient anim-pop rounded-3xl p-5 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <Icon name={team.icon} className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold">{team.name}</h2>
            <p className="text-xs text-white/80">
              {team.member_count}/{team.max_members} üye ·{" "}
              {isCaptain ? "Kaptansın" : "Üyesin"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/15 px-4 py-3">
          <span>
            <span className="block text-[11px] text-white/80">
              Bu hafta takım XP
            </span>
            <span className="block text-xl font-bold">{teamXp}</span>
          </span>
          <Icon name="trending-up" className="h-6 w-6 text-white/80" />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-edge bg-card p-4">
        <h3 className="text-sm font-semibold text-ink">Davet kodu</h3>
        <p className="mt-1 text-xs text-ink-muted">
          Arkadaşların bu kodla takıma katılabilir.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 rounded-xl bg-surface px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-ink">
            {team.invite_code}
          </span>
          <button
            type="button"
            onClick={() => copyCode(team.invite_code)}
            className="shrink-0 rounded-full border border-edge px-4 py-2.5 text-sm font-medium text-ink"
          >
            {copied ? "Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </section>

      {notice}

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-ink">Üyeler</h3>
        <ul className="mt-2 flex flex-col gap-2.5">
          {members.map((member) => (
            <li
              key={member.user_id}
              className="rounded-2xl border border-edge bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar url={member.avatar_url} name={member.username} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-ink">
                      {member.username}
                    </span>
                    {member.role === "captain" ? (
                      <Icon
                        name="shield"
                        className="h-3.5 w-3.5 shrink-0 text-primary"
                      />
                    ) : null}
                  </span>
                  <span className="block text-[11px] text-ink-muted">
                    Seviye {member.level}
                  </span>
                </span>
                <XpPill value={member.weekly_xp} className="shrink-0" />
              </div>

              {isCaptain && member.role !== "captain" ? (
                <div className="mt-2.5 flex gap-2">
                  <Button variant="secondary" size="sm" type="button" disabled={pending} onClick={() => run(() => transferCaptainAction(member.user_id)) }>
                    Kaptanlığı devret
                  </Button>
                  <Button variant="danger" size="sm" type="button" disabled={pending} onClick={() => run(() => kickMemberAction(member.user_id))}>
                    Çıkar
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Button variant="danger" size="md" block type="button" disabled={pending} onClick={() => run(() => leaveTeamAction())}>
        Takımdan ayrıl
      </Button>

      {isCaptain && team.member_count > 1 ? (
        <p className="mt-2 text-center text-[11px] text-ink-muted">
          Ayrılmadan önce kaptanlığı bir üyeye devretmelisin.
        </p>
      ) : null}
    </div>
  );
}
