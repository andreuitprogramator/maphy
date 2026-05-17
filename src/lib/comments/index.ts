const PROFANITY = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "motherfucker",
  "cunt",
  "retard",
];

export function normalizeCommentBody(input: string): string {
  return input.replace(/\r\n/g, "\n").trim();
}

export function containsProfanity(input: string): boolean {
  const text = input.toLowerCase();
  return PROFANITY.some((w) => text.includes(w));
}
