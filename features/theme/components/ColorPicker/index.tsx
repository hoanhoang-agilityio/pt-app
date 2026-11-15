"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { INPUT, LABEL } from "@/constants/styles";
import { PRESET_COLORS } from "@/features/theme/constants/theme";
import { type Hsl, normalizeHex, type Rgb } from "@/features/theme/utils/color";

interface ColorPickerProps {
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  disabled?: boolean;
  onHex: (hex: string) => void;
  onRgb: (rgb: Rgb) => void;
  onHsl: (hsl: Hsl) => void;
}

interface SliderProps {
  label: string;
  value: number;
  max: number;
  // CSS gradient of the track, so the slider shows what it will do.
  track: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const Slider = ({
  label,
  value,
  max,
  track,
  disabled = false,
  onChange,
}: SliderProps) => {
  const id = useId();

  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="w-24 shrink-0 text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.round(value)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ background: track }}
        className="h-3 min-h-11 flex-1 cursor-pointer appearance-none rounded-full bg-clip-content py-4 accent-accent"
      />
      <output
        htmlFor={id}
        className="w-9 shrink-0 text-right text-sm text-fg tabular-nums"
      >
        {Math.round(value)}
      </output>
    </div>
  );
};

// Native color input, HEX field, RGB and HSL sliders and preset swatches, all
// editing the same color.
export const ColorPicker = ({
  hex,
  rgb,
  hsl,
  disabled = false,
  onHex,
  onRgb,
  onHsl,
}: ColorPickerProps) => {
  const t = useTranslations("theme.picker");
  const hexId = useId();
  const [text, setText] = useState(hex);
  const [lastHex, setLastHex] = useState(hex);

  // A change from anywhere else (slider, swatch, scope switch) rewrites the field.
  if (hex !== lastHex) {
    setLastHex(hex);
    setText(hex);
  }
  const isTextInvalid = normalizeHex(text) === null;
  const hueTrack =
    "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)";

  return (
    <div className="space-y-5">
      <div>
        <p className={LABEL}>{t("presets")}</p>
        <div
          role="group"
          aria-label={t("presets")}
          className="flex flex-wrap gap-2"
        >
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onHex(preset)}
              aria-label={t("pickPreset", { color: preset })}
              aria-pressed={hex === preset}
              style={{ backgroundColor: preset }}
              className="size-11 rounded-full border border-line ring-offset-2 ring-offset-surface transition aria-pressed:ring-2 aria-pressed:ring-fg"
            />
          ))}
        </div>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label htmlFor={`${hexId}-native`} className={LABEL}>
            {t("native")}
          </label>
          <input
            id={`${hexId}-native`}
            type="color"
            value={hex}
            disabled={disabled}
            onChange={(event) => onHex(event.target.value)}
            className="block h-12 w-16 cursor-pointer rounded-xl border border-line bg-surface p-1"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={hexId} className={LABEL}>
            {t("hex")}
          </label>
          <input
            id={hexId}
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            value={text}
            disabled={disabled}
            aria-invalid={isTextInvalid}
            onChange={(event) => {
              setText(event.target.value);
              onHex(event.target.value);
            }}
            className={`${INPUT} font-mono uppercase`}
          />
        </div>
      </div>
      {isTextInvalid && (
        <p role="alert" className="-mt-3 text-sm text-danger">
          {t("hexInvalid")}
        </p>
      )}

      <fieldset className="space-y-1">
        <legend className={LABEL}>{t("rgb")}</legend>
        <Slider
          label={t("red")}
          value={rgb.r}
          max={255}
          disabled={disabled}
          track={`linear-gradient(to right,rgb(0 ${rgb.g} ${rgb.b}),rgb(255 ${rgb.g} ${rgb.b}))`}
          onChange={(r) => onRgb({ ...rgb, r })}
        />
        <Slider
          label={t("green")}
          value={rgb.g}
          max={255}
          disabled={disabled}
          track={`linear-gradient(to right,rgb(${rgb.r} 0 ${rgb.b}),rgb(${rgb.r} 255 ${rgb.b}))`}
          onChange={(g) => onRgb({ ...rgb, g })}
        />
        <Slider
          label={t("blue")}
          value={rgb.b}
          max={255}
          disabled={disabled}
          track={`linear-gradient(to right,rgb(${rgb.r} ${rgb.g} 0),rgb(${rgb.r} ${rgb.g} 255))`}
          onChange={(b) => onRgb({ ...rgb, b })}
        />
      </fieldset>

      <fieldset className="space-y-1">
        <legend className={LABEL}>{t("hsl")}</legend>
        <Slider
          label={t("hue")}
          value={hsl.h}
          max={359}
          disabled={disabled}
          track={hueTrack}
          onChange={(h) => onHsl({ ...hsl, h })}
        />
        <Slider
          label={t("saturation")}
          value={hsl.s}
          max={100}
          disabled={disabled}
          track={`linear-gradient(to right,hsl(${hsl.h} 0% ${hsl.l}%),hsl(${hsl.h} 100% ${hsl.l}%))`}
          onChange={(s) => onHsl({ ...hsl, s })}
        />
        <Slider
          label={t("lightness")}
          value={hsl.l}
          max={100}
          disabled={disabled}
          track={`linear-gradient(to right,#000,hsl(${hsl.h} ${hsl.s}% 50%),#fff)`}
          onChange={(l) => onHsl({ ...hsl, l })}
        />
      </fieldset>
    </div>
  );
};
