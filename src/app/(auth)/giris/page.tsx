import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell, FormAlert } from "@/components/ui/form";

export const metadata = {
  title: "Giriş yap — GençLİG",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; hata?: string }>;
}) {
  const { next, hata } = await searchParams;

  return (
    <AuthShell
      title="Giriş yap"
      description="Hesabınla devam et."
      footer={
        <>
          Hesabın yok mu?{" "}
          <Link href="/kayit" className="font-semibold text-primary-ink hover:underline">
            Hesap aç
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {hata === "dogrulama" ? (
          <FormAlert>
            Doğrulama bağlantısı geçersiz veya süresi dolmuş. Tekrar kayıt olup
            yeni bir bağlantı isteyebilirsin.
          </FormAlert>
        ) : null}

        <SignInForm next={next} />
      </div>
    </AuthShell>
  );
}
