export const allowedSymbolRegex = /^[A-Z.-]{1,10}$/;

export const normalizeSymbol = (value: string | undefined | null) =>
  (value?.toUpperCase?.().trim() ?? '').slice(0, 10);

export const isValidSymbol = (value: string | undefined | null) => allowedSymbolRegex.test(normalizeSymbol(value));
