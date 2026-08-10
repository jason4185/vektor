function errorText(error: unknown): string {
  const seen = new Set<unknown>();
  const parts: string[] = [];
  let current: unknown = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    if (typeof current !== "object") break;
    const value = current as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "details", "reason"]) {
      if (value[key]) parts.push(String(value[key]));
    }
    current = value["cause"];
  }
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (code !== undefined) parts.push(String(code));
  }
  return parts.join(" ").toLowerCase();
}

export function formatWalletError(error: unknown) {
  const text = errorText(error);
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  if (
    String(code) === "4001" ||
    /user rejected|user denied|rejected the request|request rejected|cancelled|canceled/.test(text)
  ) {
    return "Transaction cancelled. You cancelled the request in your wallet.";
  }
  if (
    /wrong network|chain mismatch|switch.*network|switch your wallet to genlayer|unsupported chain|bradbury/.test(
      text,
    )
  ) {
    return "Wrong network. Switch your wallet to GenLayer Bradbury Testnet.";
  }
  if (/insufficient funds|insufficient balance|not enough gen|underfunded/.test(text)) {
    return "Not enough GEN. Your wallet does not have enough GEN for this prediction.";
  }
  if (/minimum.*stake|amount.*too small|less than.*gen/.test(text))
    return "Minimum stake is 1 GEN.";
  if (/maximum.*stake|remaining.*capacity|exceed.*limit|stake.*limit/.test(text)) {
    return "You've reached your limit for this market.";
  }
  if (/opposite|other side|already.*side/.test(text))
    return "You already chose the other side for this market.";
  if (/betting.*closed|market.*closed|not.*open/.test(text))
    return "Predictions are closed for this market.";
  if (/not ready|too early|settlement.*eligible/.test(text))
    return "This market is not ready to settle yet.";
  if (/nothing.*claim|cannot claim|no position|not.*participant/.test(text))
    return "Nothing is available to claim yet.";
  return "This action could not be completed. Please try again.";
}

export function formatValidationReason(reason: string) {
  switch (reason) {
    case "NON_WEEKDAY_DATE":
      return "Choose a weekday. Vektor markets can be created from Monday through Friday.";
    case "INVALID_TARGET_DATE":
      return "Choose a valid target date.";
    case "TARGET_OUTSIDE_CREATION_WINDOW":
      return "Choose a future weekday within the allowed date range.";
    case "DUPLICATE_MARKET":
      return "This market already exists. Choose another instrument or date.";
    case "UNSUPPORTED_INSTRUMENT":
      return "Choose one of the supported Vektor markets.";
    default:
      return "Choose a valid target date to continue.";
  }
}
