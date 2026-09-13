import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/ui/form";

export const metadata = {
  title: "Hesap aç — GençLİG",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Hesap aç"
      description="E-posta adresinle kaydol, şehrindeki görevlere başla."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link href="/giris" className="font-semibold text-primary hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
