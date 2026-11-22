import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { Sheet } from "@/components/Sheet";
import { ErrorState, Spinner, Txt } from "@/components/ui";

import { useReactors } from "../hooks";

export const ReactorsSheet = ({
  postId,
  visible,
  onClose,
}: {
  postId: number;
  visible: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const query = useReactors(postId, visible);

  return (
    <Sheet visible={visible} onClose={onClose} title={t("feed.reactors")}>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <Txt tone="muted">{t("feed.reactorsEmpty")}</Txt>
      ) : (
        <ScrollView style={{ maxHeight: 360 }}>
          {query.data.items.map((item, index) => (
            <View
              key={`${item.name}-${index}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
            >
              <Txt size={22}>{item.emoji}</Txt>
              <Txt weight={item.isMe ? "700" : "400"}>
                {item.isMe ? t("common.you") : item.name}
              </Txt>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
};
