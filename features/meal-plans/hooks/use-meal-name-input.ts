"use client";

import { useState } from "react";

// The meal name is edited in place and saved when the field loses focus.
export const useMealNameInput = (
  savedName: string,
  save: (name: string) => void,
) => {
  const [name, setName] = useState(savedName);

  const handleBlur = () => {
    const trimmed = name.trim().replace(/\s+/g, " ");

    if (!trimmed) {
      setName(savedName);
      return;
    }
    setName(trimmed);
    if (trimmed !== savedName) {
      save(trimmed);
    }
  };

  return { name, setName, handleBlur };
};
