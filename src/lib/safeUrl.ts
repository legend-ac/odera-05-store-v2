export function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "link";
  }
}

