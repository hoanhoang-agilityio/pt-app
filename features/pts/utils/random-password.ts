const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const RANDOM_PASSWORD_LENGTH = 12;

// A random password without look-alike characters (0/O, 1/l/I), drawn with
// rejection sampling so every character is equally likely.
export const generatePassword = (length = RANDOM_PASSWORD_LENGTH) => {
  const limit =
    Math.floor(256 / PASSWORD_ALPHABET.length) * PASSWORD_ALPHABET.length;
  let result = "";

  while (result.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length))) {
      if (byte < limit && result.length < length) {
        result += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      }
    }
  }
  return result;
};
