import "server-only";

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_APP_URL must be configured with the deployed public origin.");
    }
    return new URL("http://localhost:3000");
  }

  const url = new URL(configured);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS outside local development.");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a public origin without credentials, path, query, or fragment.");
  }
  if (process.env.NODE_ENV === "production" && (url.hostname === "localhost" || url.hostname.endsWith(".localhost"))) {
    throw new Error("NEXT_PUBLIC_APP_URL must not use a local hostname in production.");
  }
  return url;
}
