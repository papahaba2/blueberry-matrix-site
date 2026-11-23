/**
 * Algebra V4 tick math for human-facing prices.
 *
 * Price is expressed as token1 per token0, normalized to token decimals:
 *   humanPrice = 1.0001^tick * 10^(decimals0 - decimals1)
 *
 * The inverted exponent is intentional: token0 has decimals0 and token1 has
 * decimals1, so the human token1/token0 price needs 10^decimals0 / 10^decimals1.
 */

export const MIN_TICK = -887_272;
export const MAX_TICK = 887_272;
export const TICK_BASE = 1.0001;

export function clampTick(tick: number): number {
  if (!Number.isFinite(tick)) return 0;
  return Math.max(MIN_TICK, Math.min(MAX_TICK, Math.trunc(tick)));
}

export function priceFromTick(
  tick: number,
  decimals0: number,
  decimals1: number,
): number {
  if (!Number.isFinite(tick)) return 0;
  const raw = Math.pow(TICK_BASE, clampTick(tick));
  const human = raw * Math.pow(10, decimals0 - decimals1);
  return Number.isFinite(human) && human > 0 ? human : 0;
}

export function rawTickFromPrice(
  price: number,
  decimals0: number,
  decimals1: number,
): number {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Цена должна быть положительным числом.");
  }

  const raw = price / Math.pow(10, decimals0 - decimals1);
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error("Цена вне допустимого диапазона.");
  }

  return clampTick(Math.floor(Math.log(raw) / Math.log(TICK_BASE)));
}

export function roundToSpacing(tick: number, tickSpacing: number): number {
  if (!Number.isFinite(tick)) return 0;
  if (!Number.isFinite(tickSpacing) || tickSpacing <= 0) {
    return clampTick(tick);
  }
  return clampTick(Math.round(tick / tickSpacing) * tickSpacing);
}

export function tickFromPrice(
  price: number,
  decimals0: number,
  decimals1: number,
  tickSpacing: number,
): number {
  return roundToSpacing(
    rawTickFromPrice(price, decimals0, decimals1),
    tickSpacing,
  );
}

export function nearestSpacedTicks(
  price: number,
  decimals0: number,
  decimals1: number,
  tickSpacing: number,
): [number, number] {
  const raw = rawTickFromPrice(price, decimals0, decimals1);
  if (tickSpacing <= 0) return [raw, raw];
  return [
    clampTick(Math.floor(raw / tickSpacing) * tickSpacing),
    clampTick(Math.ceil(raw / tickSpacing) * tickSpacing),
  ];
}

export function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "—";
  if (price >= 1_000_000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1_000) return price.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (price >= 1) return price.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return price.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}

export function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}
