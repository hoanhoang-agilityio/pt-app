// Strict decimal text: digits with one optional "." or "," ("1,5", ".5", "2."),
// never "1e2" or "0x14" that Number() would also take. Vietnamese keyboards
// type the comma.
const DECIMAL_PATTERN = /^(\d+[.,]?\d*|[.,]\d+)$/;

// NaN when the text is not a plain decimal.
export const parseDecimal = (value: string) => {
  const text = value.trim();

  return DECIMAL_PATTERN.test(text)
    ? Number(text.replace(",", "."))
    : Number.NaN;
};
