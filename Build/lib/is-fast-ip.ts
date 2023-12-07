/**
 * Check if a hostname is an IP. You should be aware that this only works
 * because `hostname` is already garanteed to be a valid hostname!
 */
export function isProbablyIpv4(hostname: string): boolean {
  // Cannot be shorted than 1.1.1.1
  if (hostname.length < 7) {
    return false;
  }

  // Cannot be longer than: 255.255.255.255
  if (hostname.length > 15) {
    return false;
  }

  let numberOfDots = 0;

  for (let i = 0; i < hostname.length; i += 1) {
    const code = hostname.charCodeAt(i);

    if (code === 46 /* '.' */) {
      numberOfDots += 1;
    } else if (code < 48 /* '0' */ || code > 57 /* '9' */) {
      return false;
    }
  }

  return (
    numberOfDots === 3
    && hostname.charCodeAt(0) !== 46
    && /* '.' */ hostname.charCodeAt(hostname.length - 1) !== 46 /* '.' */
  );
}
