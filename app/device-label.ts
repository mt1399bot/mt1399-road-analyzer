export function deviceLabel(userAgent: string) {
  const kind = /iPad|Tablet/i.test(userAgent)
    ? "平板"
    : /Mobile|iPhone|Android/i.test(userAgent)
      ? "手機"
      : "電腦";
  const os = /iPhone|iPad/i.test(userAgent)
    ? "iOS"
    : /Android/i.test(userAgent)
      ? "Android"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "其他系統";
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /CriOS|Chrome\//i.test(userAgent)
      ? "Chrome"
      : /FxiOS|Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "其他瀏覽器";
  return `${kind}・${os}・${browser}`;
}
