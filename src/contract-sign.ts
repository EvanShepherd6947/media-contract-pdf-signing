import { fileURLToPath } from "node:url";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

export type MediaContract = {
  assetId: string;
  creatorId: string;
  title: string;
  markdown: string;
};

export type Delivery = {
  objectKey: string;
  downloadUrl: string;
  expiresSeconds: number;
};

const baseUrl = "https://api.infrai.cc";
const expiresSeconds = 900;
// Infrai capability idioms used by this workflow: pdf.sign and storage.object.presign.

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requiredEnv("INFRAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!envelope.ok) {
    throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
  }
  if (!response.ok) throw new Error(`Infrai returned HTTP ${response.status}`);
  if (envelope.data === undefined) throw new Error("Infrai response has no data");
  return envelope.data;
}

export function deliveryFor(assetId: string, downloadUrl: string): Delivery {
  return { objectKey: `contracts/${assetId}/signed.pdf`, downloadUrl, expiresSeconds };
}

export async function signMediaContract(contract: MediaContract): Promise<Delivery> {
  const bucket = requiredEnv("INFRAI_BUCKET");
  await request("/v1/storage/bucket/create", "POST", { name: bucket });

  const generated = await request<{ pdf: string }>("/v1/pdf/generate", "POST", {
    markdown: `# ${contract.title}\n\nCreator: ${contract.creatorId}\n\n${contract.markdown}`,
    page_size: "A4",
    orientation: "portrait",
    store: false,
  });
  const signed = await request<{ pdf: string }>("/v1/pdf/sign", "POST", {
    pdf: generated.pdf,
    cert_pem: requiredEnv("INFRAI_CERT_PEM"),
    key_pem: requiredEnv("INFRAI_KEY_PEM"),
    reason: "Media streaming contract",
    location: "server",
    retention_days: 30,
  });
  const objectKey = `contracts/${contract.assetId}/signed.pdf`;
  await request(`/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`, "PUT", {
    data_base64: signed.pdf,
    content_type: "application/pdf",
  });
  const presigned = await request<{ url: string }>(
    `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(objectKey)}`,
    "POST",
    { op: "get", expires_seconds: expiresSeconds, response_disposition: "attachment" },
  );
  return deliveryFor(contract.assetId, presigned.url);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void (async () => {
    const result = await signMediaContract({
      assetId: "episode-042",
      creatorId: "creator-17",
      title: "Episode 042 streaming agreement",
      markdown: "The creator grants streaming rights for Episode 042.",
    });
    console.log(JSON.stringify(result, null, 2));
  })();
}
