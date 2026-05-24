const SPECIAL: Record<string, string> = {
  rpip: "text-sky-500",
};

export function usernameColorClass(username: string): string {
  return SPECIAL[username] ?? "";
}
