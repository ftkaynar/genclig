import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv, hasSupabaseEnv } from "./env";

/** Oturum açmış kullanıcı gerektiren yollar. */
const PROTECTED_PATHS = ["/onboarding"];

/** Oturum açıkken anlamsız olan yollar; buradan ana sayfaya döndürülür. */
const GUEST_ONLY_PATHS = ["/giris", "/kayit"];

/** Token bu süreden yakınsa yenilensin (saniye). */
const REFRESH_MARGIN_SECONDS = 120;

function matches(pathname: string, paths: string[]): boolean {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/*
  Çerezdeki oturumun bitiş zamanını ağa çıkmadan okur.

  @supabase/ssr oturumu "base64-<json>" olarak yazıyor ve 4KB'ı aşınca
  `.0`, `.1` gibi parçalara bölüyor; ikisi de burada birleştiriliyor.

  Dönen: `expiresAt` (unix saniye) veya çözülemediyse null.
*/
function readSessionExpiry(request: NextRequest): number | null {
  const parts = request.cookies
    .getAll()
    .filter(({ name }) => /^sb-.*-auth-token(\.\d+)?$/.test(name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (parts.length === 0) return null;

  const raw = parts.map(({ value }) => value).join("");
  if (!raw.startsWith("base64-")) return null;

  try {
    const json = Buffer.from(raw.slice("base64-".length), "base64").toString(
      "utf8",
    );
    const expiresAt = JSON.parse(json)?.expires_at;
    return typeof expiresAt === "number" ? expiresAt : null;
  } catch {
    // Bozuk ya da beklenmeyen biçimdeki çerez: karar veremiyoruz.
    return null;
  }
}

/**
 * Her istekte Supabase oturum çerezini gerektiğinde tazeler ve yetki
 * gerektiren yolları korur.
 *
 * Neden burada tazeleniyor: access token kısa ömürlü. Yenileme yalnızca
 * sayfa içinde yapılsaydı, sunucu bileşenleri çerezi yazamadığı için
 * (bkz. server.ts) kullanıcı sessizce oturumdan düşerdi.
 *
 * Ölçülen sorun: eski sürüm HER istekte `auth.getUser()` çağırıyordu, yani
 * her sayfa yüklemesine Supabase'e fazladan bir ağ turu ekliyordu. Oysa
 * token'ın bitiş zamanı çerezin içinde yazılı ve yerelde okunabiliyor;
 * ağa yalnızca gerçekten yenileme gerektiğinde çıkmak yetiyor.
 *
 * `getUser()` bilerek korunuyor, `getSession()` değil: getSession çerezdeki
 * veriyi doğrulamadan döndürüyor. Yenileme yaptığımız anda token'ı
 * Supabase'e doğrulatmış oluyoruz.
 *
 * Güvenlik sınırı: token hâlâ geçerliyken yapılan yönlendirmeler çerezin
 * varlığına bakıyor, imzasına değil. Bu bilinçli — buradaki iki yönlendirme
 * de (onboarding'e giriş zorunluluğu, girişteki kullanıcıyı ana sayfaya
 * atma) yalnızca gezinme kolaylığı. Asıl yetki kararını sayfaların ve
 * RPC'lerin kendisi veriyor: her sayfa `getViewerUser()` ile token'ı
 * doğrulatıyor ve veritabanı tarafında RLS var. Sahte bir çerez buradan
 * geçse bile hiçbir veriye erişemiyor.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Env yoksa uygulamayı komple kırmak yerine oturumsuz davran.
  if (!hasSupabaseEnv()) {
    return response;
  }

  const { pathname } = request.nextUrl;
  const expiresAt = readSessionExpiry(request);
  const now = Math.floor(Date.now() / 1000);

  // Çerez okunabildi ve token hâlâ rahatça geçerli: ağa hiç çıkma.
  const tokenFresh =
    expiresAt !== null && expiresAt - now > REFRESH_MARGIN_SECONDS;

  if (tokenFresh) {
    return redirectIfNeeded(request, response, pathname, true);
  }

  // Çerez hiç yok: oturumsuz kullanıcı, yenilenecek bir şey de yok.
  if (expiresAt === null && request.cookies.getAll().every(
    ({ name }) => !/^sb-.*-auth-token/.test(name),
  )) {
    return redirectIfNeeded(request, response, pathname, false);
  }

  // Buraya gelindiyse token süresi dolmuş ya da dolmak üzere: yenile.
  let refreshed = NextResponse.next({ request });

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
        refreshed = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          refreshed.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return redirectIfNeeded(request, refreshed, pathname, Boolean(user));
}

function redirectIfNeeded(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  signedIn: boolean,
): NextResponse {
  if (!signedIn && matches(pathname, PROTECTED_PATHS)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/giris";
    // Giriş sonrası kullanıcıyı gelmek istediği yere döndürebilmek için.
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (signedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
