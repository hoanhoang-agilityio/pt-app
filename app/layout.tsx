import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Bricolage_Grotesque } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { AppToaster } from "@/components/common/AppToaster";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EMBED_MARKER_SCRIPT } from "@/features/chat-bubbles/constants/embed-script";
import { ServiceWorkerRegister } from "@/features/pwa/components/ServiceWorkerRegister";
import { INSTALL_CAPTURE_SCRIPT } from "@/features/pwa/constants/capture-script";
import { getViewerAccent } from "@/features/theme/services/theme-queries";
import { buildThemeCss } from "@/features/theme/utils/theme-css";
import { pickClientMessages } from "@/i18n/client-namespaces";
import { parseTheme, THEME_COOKIE } from "@/utils/theme";

// Both fonts ship the vietnamese subset (diacritics). Exposed as CSS variables
// that app/globals.css maps to --font-sans and --font-display.
const bodyFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body-loaded",
});

const displayFont = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-display-loaded",
});

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("layout.meta");

  return {
    title: { default: "PT App", template: "%s · PT App" },
    description: t("description"),
    icons: { apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: "PT App", statusBarStyle: "default" },
  };
};

const THEME_COLORS = { light: "#f4f4f5", dark: "#0c0c0e" };

// A forced theme sets one browser chrome color; "Hệ thống" follows the OS.
export const generateViewport = async (): Promise<Viewport> => {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return {
    width: "device-width",
    initialScale: 1,
    // Lets the page draw under the notch / Dynamic Island; headers pad with
    // env(safe-area-inset-*).
    viewportFit: "cover",
    themeColor:
      theme === "system"
        ? [
            {
              media: "(prefers-color-scheme: light)",
              color: THEME_COLORS.light,
            },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
          ]
        : THEME_COLORS[theme],
  };
};

// Reads the theme cookie on the server so the first paint already has the right
// colors (no flash). This makes every route dynamic.
const RootLayout = async ({ children }: LayoutProps<"/">) => {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const locale = await getLocale();
  // Only the namespaces browser code reads; the rest stays on the server.
  const messages = await getMessages();
  // The super admin's primary color for this viewer; null = default orange.
  const themeCss = buildThemeCss(await getViewerAccent());

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${bodyFont.variable} ${displayFont.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INSTALL_CAPTURE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: EMBED_MARKER_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* After globals.css in document order, so the same selectors win; the
            CSS is built only from a normalized #rrggbb, never raw input. */}
        {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
        <NextIntlClientProvider
          locale={locale}
          messages={pickClientMessages(messages)}
        >
          {children}
          <AppToaster />
          <ConfirmDialog />
          <ServiceWorkerRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
