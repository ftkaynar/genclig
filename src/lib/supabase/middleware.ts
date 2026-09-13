import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv, hasSupabaseEnv } from "./env";

/** Oturum açmış kullanıcı gerektiren yollar. */
const PROTECTED_PATHS = ["/onboarding"];

/** Oturum açıkken anlamsız olan yollar; buradan ana sayfaya döndürülür. */
const GUEST_ONLY_PATHS = ["/giris", "/kayit"];

function matches(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Her istekte Supabase oturum çerezini tazeler ve yetki gerektiren yolları korur.
 *
 * Neden burada: access token kısa ömürlü. Yenileme yalnızca sayfa içinde
 * yapılsaydı, sunucu bileşenleri çerezi yazamadığı için (bkz. server.ts)
 * kullanıcı sessizce oturumdan düşerdi.
 *
 * getUser() bilerek kullanılıyor, getSession() değil: getSession çerezdeki
 * veriyi doğrulamadan döndürüyor, getUser token'ı Supabase'e doğrulatıyor.
 * Yetki kararı verilen yerde doğrulanmamış veriye güvenilmez.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Env yoksa uygulamayı komple kırmak yerine oturumsuz davran; /api/health
  // gibi Supabase'e ihtiyaç duymayan yollar çalışmaya devam etsin.
  if (!hasSupabaseEnv()) {
    return response;
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && matches(pathname, PROTECTED_PATHS)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/giris";
    // Giriş sonrası kullanıcıyı gelmek istediği yere döndürebilmek için.
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && matches(pathname, GUEST_ONLY_PATHS)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
