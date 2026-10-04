export function readRoute(hash: string): string {
  try {
    return decodeURI(hash.replace(/^#\/?/, "")) || "home";
  } catch {
    return "invalid-route";
  }
}
