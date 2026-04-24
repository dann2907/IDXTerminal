export function ensureFonts() {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
  if (!document.head.querySelector(`link[href="${fontLink.href}"]`)) {
    document.head.appendChild(fontLink);
  }
}