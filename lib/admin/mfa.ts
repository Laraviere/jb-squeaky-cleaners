// Supabase Auth can return an unescaped SVG data URL, including whitespace.
// Encode the payload without changing the QR artwork or authenticator secret.
export function mfaQrImageSource(qr: string) {
  if (/^data:image\/svg\+xml[^,]*;base64,/i.test(qr)) return qr;
  let svg = qr;
  if (/^data:image\/svg\+xml[^,]*,/i.test(qr)) {
    svg = qr.slice(qr.indexOf(",") + 1);
    if (!svg.trimStart().startsWith("<")) svg = decodeURIComponent(svg);
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
