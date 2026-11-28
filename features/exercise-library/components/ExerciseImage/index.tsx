"use client";

import { Dumbbell } from "lucide-react";
import { useState } from "react";

import { cn } from "@/utils/cn";

interface ExerciseImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

// A plain lazy <img>: built-in photos are third-party files and custom ones
// come from our own route, neither needs the image optimizer. A broken or
// missing image falls back to an icon tile of the same size.
export const ExerciseImage = ({ src, alt, className }: ExerciseImageProps) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-line/50 text-muted",
          className,
        )}
      >
        <Dumbbell className="size-6" aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("rounded-xl bg-line/50 object-cover", className)}
    />
  );
};
