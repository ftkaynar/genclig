"use client";

import { InlineEditor } from "./inline-editor";
import {
  upsertBadgeAction,
  upsertProblemCategoryAction,
  upsertRewardAction,
  upsertTaskCategoryAction,
} from "@/lib/panel/admin-actions";

/*
  Yönetim ekranlarının ekleme formları.

  Her biri InlineEditor'ü alan tanımlarıyla besliyor. Sunucu eylemi buradan
  import ediliyor, sayfadan prop olarak geçirilmiyor: server component'ten
  client'a fonksiyon geçirmek yalnızca server action'lar için çalışıyor ve
  sarmalayan closure o ayrıcalığı kaybediyordu.
*/

export function BadgeCreator() {
  return (
    <InlineEditor
      title="Yeni rozet"
      fields={[
        { name: "slug", label: "Kısa ad", placeholder: "green-hero" },
        { name: "name", label: "Ad", placeholder: "Çevre Kahramanı" },
        { name: "description", label: "Açıklama", type: "textarea" },
        {
          name: "criteria",
          label: "Kriter (JSON)",
          type: "textarea",
          defaultValue: '{"type":"total_tasks","count":10}',
          hint: 'Desteklenen tipler: total_tasks, category_tasks, problem_reports, xp_total',
        },
        { name: "xpBonus", label: "XP bonusu", type: "number", defaultValue: "0" },
        { name: "coinBonus", label: "Token bonusu", type: "number", defaultValue: "0" },
      ]}
      onSubmit={(values) =>
        upsertBadgeAction({
          slug: values.slug ?? "",
          name: values.name ?? "",
          description: values.description ?? "",
          criteria: values.criteria ?? "{}",
          xpBonus: Number(values.xpBonus ?? 0),
          coinBonus: Number(values.coinBonus ?? 0),
          status: "active",
        })
      }
    />
  );
}

export function RewardCreator() {
  return (
    <InlineEditor
      title="Yeni global ödül"
      fields={[
        { name: "title", label: "Başlık" },
        { name: "description", label: "Açıklama", type: "textarea" },
        { name: "coinCost", label: "Token bedeli", type: "number", defaultValue: "100" },
        { name: "minLevel", label: "En az seviye", type: "number", defaultValue: "1" },
        {
          name: "stock",
          label: "Stok",
          type: "number",
          hint: "Boş bırakılırsa sınırsız.",
        },
      ]}
      onSubmit={(values) =>
        upsertRewardAction({
          title: values.title ?? "",
          description: values.description ?? "",
          coinCost: Number(values.coinCost ?? 0),
          minLevel: Number(values.minLevel ?? 1),
          stock: values.stock ? Number(values.stock) : null,
          status: "active",
        })
      }
    />
  );
}

export function TaskCategoryCreator() {
  return (
    <InlineEditor
      title="Yeni görev kategorisi"
      fields={[
        { name: "slug", label: "Kısa ad", placeholder: "environment" },
        { name: "name", label: "Ad", placeholder: "Çevre" },
        { name: "sort", label: "Sıra", type: "number", defaultValue: "100" },
      ]}
      onSubmit={(values) =>
        upsertTaskCategoryAction({
          slug: values.slug ?? "",
          name: values.name ?? "",
          sort: Number(values.sort ?? 0),
        })
      }
    />
  );
}

export function ProblemCategoryCreator() {
  return (
    <InlineEditor
      title="Yeni bildirim kategorisi"
      fields={[
        { name: "slug", label: "Kısa ad", placeholder: "waste" },
        { name: "name", label: "Ad", placeholder: "Çöp ve atık" },
        { name: "sort", label: "Sıra", type: "number", defaultValue: "100" },
      ]}
      onSubmit={(values) =>
        upsertProblemCategoryAction({
          slug: values.slug ?? "",
          name: values.name ?? "",
          sort: Number(values.sort ?? 0),
        })
      }
    />
  );
}
