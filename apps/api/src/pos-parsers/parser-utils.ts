export function readMoney(text: string, labels: string[]): number {
  for (const label of labels) {
    const expression = new RegExp(`${label}\\s*[:\\-]?\\s*\\$?([\\d,]+(?:\\.\\d{2})?)`, "i");
    const match = text.match(expression);
    if (match?.[1]) return Number(match[1].replace(/,/g, ""));
  }

  return 0;
}

export function confidenceFrom(values: number[]): number {
  const found = values.filter((value) => value > 0).length;
  return Number((found / values.length).toFixed(2));
}
