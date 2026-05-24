const SPECIAL: Record<string, string> = {
  trif: "text-violet-500",
  pip: "text-sky-500",
};

export function usernameColorClass(username: string): string {
  return SPECIAL[username] ?? "";
}
