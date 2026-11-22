import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button, Txt } from "@/components/ui";
import { acceptTerms } from "@/features/feed/api";
import { qk } from "@/lib/query-keys";
import { useErrorText } from "@/lib/ui-helpers";
import { space } from "@/theme";

// Social terms: a trainee accepts them once before friends, feed, DMs and
// reports work (POST /v1/social/me/terms).
export const TermsGate = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const accept = useMutation({
    mutationFn: acceptTerms,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.socialMe }),
  });

  return (
    <View style={{ flex: 1, padding: space.xl, gap: space.lg, justifyContent: "center" }}>
      <Txt size={22} weight="700">
        {t("feed.termsTitle")}
      </Txt>
      <Txt tone="muted">{t("feed.termsBody")}</Txt>
      {accept.isError ? <Txt tone="danger">{errorText(accept.error)}</Txt> : null}
      <Button label={t("feed.termsAccept")} loading={accept.isPending} onPress={() => accept.mutate()} />
    </View>
  );
};

// Wraps a social screen: loads the terms state and shows the gate until
// accepted (admins never need them).
