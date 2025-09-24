export const ALLOWED_DOMAIN = "umass.edu";
export function isAllowedEmail(email?: string | null) {
  return !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}
