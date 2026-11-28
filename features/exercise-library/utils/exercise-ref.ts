// "b:<builtinId>" points at the static catalog, "c:<id>" at an
// exercise_library row of the admin. Anything else is no link.
export type ExerciseRef =
  { kind: "builtin"; id: string } | { kind: "custom"; id: number };

const BUILTIN_ID = /^[A-Za-z0-9_().,'-]{1,100}$/;
const CUSTOM_ID = /^[1-9]\d{0,9}$/;

export const formatExerciseRef = (
  kind: "builtin" | "custom",
  id: string | number,
) => `${kind === "builtin" ? "b" : "c"}:${id}`;

export const parseExerciseRef = (value: unknown): ExerciseRef | null => {
  if (typeof value !== "string") {
    return null;
  }
  const separator = value.indexOf(":");
  const prefix = value.slice(0, separator);
  const id = value.slice(separator + 1);

  if (separator === -1) {
    return null;
  }
  if (prefix === "b" && BUILTIN_ID.test(id)) {
    return { kind: "builtin", id };
  }
  if (prefix === "c" && CUSTOM_ID.test(id)) {
    return { kind: "custom", id: Number(id) };
  }
  return null;
};
