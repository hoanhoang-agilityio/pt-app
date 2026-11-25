"use client";

import { Eye, EyeOff, RefreshCw, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";

import { Input } from "@/components/common/Input";
import { SubmitButton } from "@/components/common/SubmitButton";
import { INITIAL_FORM_STATE } from "@/constants/form";
import { BUTTON_PRIMARY, FIELD_ERROR, LABEL } from "@/constants/styles";
import { createPtAction } from "@/features/pts/services/pt-actions";
import { generatePassword } from "@/features/pts/utils/random-password";
import { useFormFeedback } from "@/hooks/use-form-feedback";

interface CreatePtFormProps {
  // Called once the PT account was created (the sheet closes).
  onDone?: () => void;
}

export const CreatePtForm = ({ onDone }: CreatePtFormProps) => {
  const t = useTranslations("pts.createPt");
  const [state, formAction] = useActionState(
    createPtAction,
    INITIAL_FORM_STATE,
  );

  const passwordRef = useRef<HTMLInputElement>(null);
  const [isPasswordShown, setIsPasswordShown] = useState(false);

  // Closes the sheet once per successful submit.
  useFormFeedback(state, onDone);

  const fillRandomPassword = () => {
    if (passwordRef.current) {
      passwordRef.current.value = generatePassword();
      // Shown, so the admin can read it and pass it on.
      setIsPasswordShown(true);
    }
  };

  const usernameError = state.fieldErrors?.username;
  const passwordError = state.fieldErrors?.password;

  return (
    <form
      key={state.status === "success" ? state.submittedAt : "form"}
      action={formAction}
      className="space-y-4"
    >
      <div>
        <label htmlFor="pt-username" className={LABEL}>
          {t("usernameLabel")}
        </label>
        <Input
          clearable
          id="pt-username"
          name="username"
          defaultValue={state.status === "error" ? state.values?.username : ""}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          required
          aria-invalid={Boolean(usernameError)}
        />
        {usernameError && (
          <p role="alert" className={FIELD_ERROR}>
            {usernameError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="pt-password" className={LABEL}>
          {t("passwordLabel")}
        </label>
        <div className="relative">
          <Input
            ref={passwordRef}
            id="pt-password"
            name="password"
            type={isPasswordShown ? "text" : "password"}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            required
            aria-invalid={Boolean(passwordError)}
            className="pr-12"
          />
          <button
            type="button"
            aria-label={isPasswordShown ? t("hidePassword") : t("showPassword")}
            aria-pressed={isPasswordShown}
            onClick={() => setIsPasswordShown((shown) => !shown)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
          >
            {isPasswordShown ? (
              <EyeOff className="size-5" aria-hidden />
            ) : (
              <Eye className="size-5" aria-hidden />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={fillRandomPassword}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-accent"
        >
          <RefreshCw className="size-4" aria-hidden />
          {t("generate")}
        </button>
        {passwordError && (
          <p role="alert" className={FIELD_ERROR}>
            {passwordError}
          </p>
        )}
      </div>
      <SubmitButton className={`${BUTTON_PRIMARY} w-full`}>
        <UserPlus className="size-5" aria-hidden />
        {t("submit")}
      </SubmitButton>
    </form>
  );
};
