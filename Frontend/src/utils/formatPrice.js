export function formatPrice(value, maximumFractionDigits = 2) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(numeric);
}
