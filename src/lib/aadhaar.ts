/**
 * Mask an Aadhaar number to show only the last 4 digits.
 * "123456789012" -> "XXXX-XXXX-9012"
 */
export function maskAadhaar(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "XXXX-XXXX-XXXX";
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export function maskMobile(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "XXXXXX";
  return `XXXXXX${digits.slice(-4)}`;
}