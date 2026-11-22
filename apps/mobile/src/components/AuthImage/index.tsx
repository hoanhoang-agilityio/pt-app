import { Image, type ImageProps } from "expo-image";
import { useMemo } from "react";

import { api, authHeaders, getSessionToken } from "@/lib/api";
import { API_URL } from "@/lib/config";

type Props = Omit<ImageProps, "source"> & {
  // An API path ("/v1/chat/photos/3") or an absolute URL.
  uri: string | null | undefined;
};

// Every image the API serves (avatars, chat and post photos, custom stickers)
// needs `Authorization: Bearer <token>`. This is the one place that adds it.
// Absolute URLs on other hosts (GIPHY) get no token.
export const AuthImage = ({ uri, ...rest }: Props) => {
  const token = getSessionToken();
  const source = useMemo(() => {
    if (!uri) {
      return null;
    }
    const url = api.url(uri);
    const isApi = uri.startsWith("/") || url.startsWith(API_URL);

    return {
      uri: url,
      headers: isApi ? authHeaders() : undefined,
      // The same photo id never changes: cache by URL (without the token).
      cacheKey: url,
    };
    // `token` makes the headers refresh after a rotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, token]);

  if (!source) {
    return null;
  }
  return <Image source={source} transition={120} {...rest} />;
};
