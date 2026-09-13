"use client";

import { useActionState } from "react";

import { signInAction, type ActionState } from "@/lib/auth/actions";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";

const INITIAL: ActionState = {};

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signInAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}

      {/* Giriş sonrası kullanıcıyı gelmek istediği sayfaya döndürmek için. */}
      <input type="hidden" name="next" value={next ?? ""} />

      <TextField
        label="E-posta"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="ornek@eposta.com"
      />
      <TextField
        label="Şifre"
        name="password"
        type="password"
        autoComplete="current-password"
      />

      <SubmitButton pendingLabel="Giriş yapılıyor...">Giriş yap</SubmitButton>
    </form>
  );
}
