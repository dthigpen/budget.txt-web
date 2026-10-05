export const DEFAULT_BUDGET_CONTENT = `!options version=1.0
!options currency=USD

2026-09-01 envelope groceries budget=500
2026-09-01 envelope dining budget=250

2026-09-01 allocate 500 groceries
2026-09-03 spend 42.18 groceries account=mastercard merchant="Target"
2026-09-08 move 50 groceries dining
`;

export function tokenizeLine(line) {
  const tokens = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (/\s/.test(char) && !inQuotes) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseLine(rawLine) {
  const line = rawLine.trim();
  if (!line) return null;
  if (line.startsWith("!")) {
    return { type: "directive", raw: line, text: line };
  }

  const tokens = tokenizeLine(line);
  if (tokens.length < 2) {
    return { type: "unknown", raw: line, tokens };
  }

  const [date, verb, ...rest] = tokens;
  const args = [];
  const kwargs = {};

  for (const token of rest) {
    if (token.includes("=")) {
      const eqIndex = token.indexOf("=");
      const key = token.slice(0, eqIndex);
      const value = token.slice(eqIndex + 1).replace(/^"|"$/g, "");
      kwargs[key] = value;
      continue;
    }
    args.push(token);
  }

  return {
    type: "record",
    raw: line,
    date,
    verb,
    args,
    kwargs,
  };
}

export function parseBudgetDocument(content) {
  return content
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter(Boolean);
}

export function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function summarizeBudget(content) {
  const records = parseBudgetDocument(content);
  const envelopes = {};
  const transactions = [];

  for (const record of records) {
    if (!record || record.type !== "record") continue;

    transactions.push(record);
    const { verb, args, kwargs } = record;

    if (verb === "envelope") {
      const name = args[0];
      if (!name) continue;
      envelopes[name] = {
        name,
        budget: toNumber(kwargs.budget ?? kwargs.target ?? 0),
        available: toNumber(envelopes[name]?.available ?? 0),
      };
      continue;
    }

    if (verb === "allocate" || verb === "spend" || verb === "deallocate") {
      const amount = toNumber(args[0] ?? 0);
      const envelopeName = args[1];
      if (!envelopeName) continue;
      const envelope = envelopes[envelopeName] ?? { name: envelopeName, budget: 0, available: 0 };
      envelopes[envelopeName] = envelope;

      if (verb === "allocate") {
        envelope.available += amount;
      }
      if (verb === "spend") {
        envelope.available -= amount;
      }
      if (verb === "deallocate") {
        envelope.available -= amount;
      }
      continue;
    }

    if (verb === "move") {
      const amount = toNumber(args[0] ?? 0);
      const fromName = args[1];
      const toName = args[2];
      if (!fromName || !toName) continue;

      const fromEnvelope = envelopes[fromName] ?? { name: fromName, budget: 0, available: 0 };
      const toEnvelope = envelopes[toName] ?? { name: toName, budget: 0, available: 0 };
      envelopes[fromName] = fromEnvelope;
      envelopes[toName] = toEnvelope;

      fromEnvelope.available -= amount;
      toEnvelope.available += amount;
    }
  }

  return {
    records: transactions,
    envelopes: Object.values(envelopes).sort((a, b) => a.name.localeCompare(b.name)),
    totalBudget: Object.values(envelopes).reduce((sum, envelope) => sum + envelope.budget, 0),
    totalAvailable: Object.values(envelopes).reduce((sum, envelope) => sum + envelope.available, 0),
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
