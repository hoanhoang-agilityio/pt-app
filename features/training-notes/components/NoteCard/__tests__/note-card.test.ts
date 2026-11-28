import { NextIntlClientProvider } from "next-intl";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NoteCard } from "@/features/training-notes/components/NoteCard";
import type { TrainingNote } from "@/features/training-notes/types/training-note";
import { viMessages } from "@/i18n/messages";

const set = (position: number, reps: number) => ({
  position,
  unit: "reps" as const,
  reps,
  durationSec: null,
  weightKg: 50,
  note: null,
});

const baseNote: TrainingNote = {
  id: 7,
  date: "2026-11-20",
  title: "Leg day",
  note: null,
  items: [],
};

// `children` is required by the provider's props type but is passed as the
// createElement argument (react/no-children-prop), hence the cast.
const providerProps = {
  locale: "vi",
  messages: viMessages,
} as ComponentProps<typeof NextIntlClientProvider>;

const render = (note: TrainingNote) =>
  renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      providerProps,
      createElement(NoteCard, { note, onEdit: () => {}, onDelete: () => {} }),
    ),
  );

describe("NoteCard initial state", () => {
  it("starts collapsed: toggle closed, body hidden, summary shown", () => {
    const html = render({
      ...baseNote,
      items: [
        {
          id: 1,
          position: 0,
          exerciseName: "Squat",
          exerciseRef: null,
          muscles: null,
          sets: [set(1, 8), set(2, 8)],
        },
        {
          id: 2,
          position: 1,
          exerciseName: "Lunge",
          exerciseRef: null,
          muscles: null,
          sets: [set(1, 10)],
        },
      ],
    });

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Mở rộng ghi chú: Leg day"');
    expect(html).not.toContain('aria-expanded="true"');
    expect(html).toMatch(/<div id="note-7-body" hidden="">/);
    expect(html).toContain("2 bài · 3 set");
  });

  it("renders no expand toggle for a card without a body", () => {
    const html = render(baseNote);

    expect(html).not.toContain('aria-controls="note-7-body"');
    expect(html).not.toContain("Mở rộng ghi chú");
    expect(html).not.toContain("Thu gọn ghi chú");
  });
});
