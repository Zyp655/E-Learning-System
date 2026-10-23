const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i;

export function isMobileUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  if (/iPad/i.test(userAgent)) return false;
  return MOBILE_UA_REGEX.test(userAgent);
}
