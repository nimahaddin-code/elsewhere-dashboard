type VercelRequest = { method?: string; query?: Record<string, string | string[] | undefined> };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer | string) => void;
  end: () => void;
};

const blockedHosts = /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?$)/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const raw = Array.isArray(req.query?.url) ? req.query?.url[0] : req.query?.url;
  if (!raw) {
    res.status(400).send("Missing image URL");
    return;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || blockedHosts.test(url.hostname)) throw new Error("Unsupported URL");
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 Elsewhere-Catalogue/1.0", Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    const contentType = response.headers.get("content-type") || "";
    const size = Number(response.headers.get("content-length") || 0);
    if (!response.ok || !contentType.startsWith("image/") || size > 15_000_000) throw new Error("Invalid image response");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 15_000_000) throw new Error("Image too large");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(bytes);
  } catch {
    res.status(422).send("Image could not be loaded");
  }
}
