"use client";

import { useActionState } from "react";

import { signUpAction, type ActionState } from "@/lib/auth/actions";
import { FormAlert, SubmitButton, TextField } from "@/components/ui/form";

const INITIAL: ActionState = {};

export function SignUpForm({
  inviteCode = "",
}: {
  /** /kayit?davet=KOD ile gelindiyse dolu; gizli alanla taşınıyor. */
  inviteCode?: string;
}) {
  const [state, formAction] = useActionState(signUpAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/*
        Gizli alan: kullanıcı kodu görmüyor ama kayıt eylemi çereze
        yazabilsin diye taşınıyor. Kod onboarding'de görünür bir
        alanda ayrıca düzenlenebiliyor.
      */}
      <input type="hidden" name="inviteCode" value={inviteCode} />
      {state.error ? <FormAlert>{state.error}</FormAlert> : null}

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
        autoComplete="new-password"
        hint="En az 8 karakter."
      />
      <TextField
        label="Şifre tekrar"
        name="passwordRepeat"
        type="password"
        autoComplete="new-password"
      />

      <SubmitButton pendingLabel="Hesap açılıyor...">Hesap aç</SubmitButton>
    </form>
  );
}
