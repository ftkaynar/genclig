import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /*
    Statik varlıklar ve görseller dışındaki her yolda koş.
    Neden dışlanıyorlar: her ikon isteğinde oturum doğrulaması yapmak
    Supabase'e gereksiz tur attırıyor ve ilk yüklemeyi yavaşlatıyordu.
  */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
