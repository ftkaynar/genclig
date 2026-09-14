import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
    Statik varlıklar, ikonlar, manifest ve sağlık ucu dışındaki uygulama
    yollarında koş.

    Neden dışlanıyorlar: middleware her istekte Supabase'e oturum
    doğrulatıyor ve bu gerçek bir ağ turu. Bir ikon ya da manifest isteği
    için oturum doğrulamak saf gecikme ekliyordu. `/api/health` da dışarıda:
    sağlık ucunun Supabase ayakta olmasa bile yanıt vermesi gerekiyor.
  */
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|icons/|brand/|api/health|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js|map|txt|json)$).*)",
  ],
};
