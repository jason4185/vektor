export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof console !== "undefined") {
    console.error("Vektor frontend error", { error, ...context });
  }
}
