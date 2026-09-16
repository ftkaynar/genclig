/*
  Bildirim tiplerinin kullanıcıya görünen karşılıkları ve gidecekleri yer.

  ÖLÇÜLEN SORUN (D30 FAZ N): NOTIFICATION_LABEL haritası eksikti ve
  bulunamayan tipte `?? item.type` ile HAM TİP ekrana basılıyordu —
  kullanıcı bildirim listesinde "support_reply", "friend_request",
  "stat_decay" gibi teknik dizgiler görüyordu.

  Artık harita DB'deki notifications_type_check listesinin tamamını
  kapsıyor. Yeni bir tip eklendiğinde buraya da eklenmesi gerekiyor;
  eksik kalırsa ham tip yerine nötr bir "Bildirim" etiketi görünüyor,
  teknik dizgi asla görünmüyor.

  Saf veri ayrı dosyada: client bileşenleri import ediyor ve queries.ts
  içinde dururken next/headers tarayıcı paketine sızıyordu (D21-D23'te
  ölçülmüştü).
*/

export type NotificationMeta = {
  label: string;
  icon: string;
  /** Rozet tonu — liste satırında tipin rengi. */
  tone: string;
};

export const NOTIFICATION_META: Record<string, NotificationMeta> = {
  submission_approved: {
    label: "Görev onaylandı",
    icon: "check",
    tone: "bg-status-success/15 text-status-success",
  },
  submission_rejected: {
    label: "Görev reddedildi",
    icon: "x",
    tone: "bg-status-danger/15 text-status-danger",
  },
  badge_earned: {
    label: "Yeni rozet",
    icon: "award",
    tone: "bg-coin/15 text-coin",
  },
  problem_status: {
    label: "Bildirimin güncellendi",
    icon: "megaphone",
    tone: "bg-amber/15 text-amber",
  },
  reward_redeemed: {
    label: "Ödül alındı",
    icon: "gift",
    tone: "bg-coin/15 text-coin",
  },
  system: {
    label: "Sistem",
    icon: "bell",
    tone: "bg-surface text-ink-muted",
  },
  friend_request: {
    label: "Arkadaşlık isteği",
    icon: "users",
    tone: "bg-primary/15 text-primary",
  },
  friend_accepted: {
    label: "Arkadaşlık kabul edildi",
    icon: "hand-heart",
    tone: "bg-primary/15 text-primary",
  },
  team_invite: {
    label: "Takım daveti",
    icon: "shield",
    tone: "bg-magenta/15 text-magenta",
  },
  support_reply: {
    label: "Destek yanıtı",
    icon: "hand-heart",
    tone: "bg-cyan/15 text-cyan",
  },
  announcement: {
    label: "Duyuru",
    icon: "megaphone",
    tone: "bg-indigo/15 text-indigo",
  },
  community: {
    label: "Topluluk",
    icon: "globe",
    tone: "bg-primary/15 text-primary",
  },
  stat_decay: {
    label: "Kartın soğuyor",
    icon: "activity",
    tone: "bg-cyan/15 text-cyan",
  },
  leaderboard_reward: {
    label: "Sıralama ödülü",
    icon: "trophy",
    tone: "bg-coin/15 text-coin",
  },
};

/** Tanınmayan tipte bile HAM TİP gösterilmiyor. */
export const NOTIFICATION_FALLBACK: NotificationMeta = {
  label: "Bildirim",
  icon: "bell",
  tone: "bg-surface text-ink-muted",
};

export function notificationMeta(type: string): NotificationMeta {
  return NOTIFICATION_META[type] ?? NOTIFICATION_FALLBACK;
}

/*
  Bildirimin gideceği yer.

  ref_id her tipte farklı bir şeyi işaret ediyor (teslim, rozet, talep...)
  ve bazılarında hiç yok. Hedef sayfa tipten türüyor; ref_id yalnızca
  gerçekten tekil bir sayfası olan tiplerde (destek talebi) kullanılıyor.

  Hedefi olmayan tip yok: her bildirim bir yere götürüyor. Tıklanıp
  hiçbir şey olmayan bildirim, kullanıcıya "bu bildirim bozuk" dedirtiyor.
*/
export function notificationHref(type: string, refId: string | null): string {
  switch (type) {
    case "submission_approved":
    case "submission_rejected":
      return "/gorevlerim";
    case "badge_earned":
      return "/profil";
    case "problem_status":
      return "/bildir/gecmis";
    case "reward_redeemed":
      return "/oduller/kuponlarim";
    case "friend_request":
    case "friend_accepted":
      return "/arkadaslar";
    case "team_invite":
      return "/takim";
    case "support_reply":
      // Rota değil sorgu parametresi: destek tek sayfa, konuşma
      // istemcide açılıyor (bkz. support-view.tsx).
      return refId ? `/destek?talep=${refId}` : "/destek";
    case "community":
      return "/topluluk";
    case "stat_decay":
      return "/gorevler";
    case "leaderboard_reward":
      return "/siralama";
    case "announcement":
    case "system":
    default:
      return "/bildirimler";
  }
}
