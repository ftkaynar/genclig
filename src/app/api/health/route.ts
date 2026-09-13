import { NextResponse } from "next/server";

// Sağlık kontrolü: sadece env var'ların varlığına bakar, DB'ye gitmez.
// Neden DB'ye gitmiyor: health endpoint'i Vercel cold start'ta ve uptime
// kontrolünde sık çağrılır; DB bağımlılığı gereksiz gecikme ve maliyet yaratır.
// Denenen ve elenen alternatif: Supabase'e basit bir select atmak — env eksikken
// çökmesi ve rate limit riski nedeniyle elendi.
export const dynamic = "force-dynamic";

export function GET() {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return NextResponse.json({
    ok: true,
    supabase: hasUrl && hasAnonKey ? "configured" : "missing",
  });
}
