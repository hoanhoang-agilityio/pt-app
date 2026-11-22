import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, type LayoutChangeEvent, View } from "react-native";

import { AuthImage } from "@/components/AuthImage";
import { Txt } from "@/components/ui";
import { radius, useTheme } from "@/theme";

type Photo = { id: number; url: string; width: number; height: number };

// Aspect ratio of the photo area: the first photo's, kept between 4:5 and 3:2.
export const photoAspect = (photo: { width: number; height: number }) => {
  const ratio = photo.height > 0 ? photo.width / photo.height : 1;

  return Math.min(1.5, Math.max(0.8, ratio));
};

// One photo, or a swipeable strip with a counter for several.
export const PostPhotos = ({ photos }: { photos: Photo[] }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return null;
  }
  const height = width / photoAspect(photos[0]);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} style={{ borderRadius: radius.md, overflow: "hidden" }}>
      {width > 0 ? (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(photo) => String(photo.id)}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: position }) => (
            <AuthImage
              uri={item.url}
              accessibilityLabel={t("feed.photoAlt", { index: position + 1 })}
              style={{ width, height, backgroundColor: theme.line }}
              contentFit="cover"
            />
          )}
        />
      ) : null}
      {photos.length > 1 ? (
        <View
          style={{
            position: "absolute",
            right: 8,
            top: 8,
            backgroundColor: "rgba(0,0,0,0.55)",
            borderRadius: radius.pill,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Txt size={12} weight="600" style={{ color: "#fff" }}>
            {index + 1}/{photos.length}
          </Txt>
        </View>
      ) : null}
    </View>
  );
};
