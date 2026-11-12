import clsx from "clsx";

interface WaveDotsProps {
  className?: string;
  dotClassName?: string;
}

const DOT_DELAYS_MS = [0, 150, 300];

// Three dots that bounce in a staggered wave. Decorative: the caller supplies
// the accessible text. Under prefers-reduced-motion the dots stay still.
export const WaveDots = ({ className, dotClassName }: WaveDotsProps) => (
  <span
    aria-hidden
    className={clsx("inline-flex items-center gap-1", className)}
  >
    {DOT_DELAYS_MS.map((delay) => (
      <span
        key={delay}
        style={{ animationDelay: `${delay}ms` }}
        className={clsx(
          "size-1.5 animate-bounce rounded-full bg-muted motion-reduce:animate-none",
          dotClassName,
        )}
      />
    ))}
  </span>
);
