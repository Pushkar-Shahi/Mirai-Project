import { DurableObject } from "cloudflare:workers";

interface Env {
  MIRAI_API: DurableObjectNamespace<MiraiApi>;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  CERT_SECRET?: string;
  CORS_ORIGINS?: string;
  CORS_ORIGIN_REGEX?: string;
  PUBLIC_BASE_URL?: string;
  APP_TIMEZONE: string;
  APP_NAME: string;
  APP_SHORT_NAME: string;
  INSTITUTION_NAME: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  SMTP_SECURITY?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_GRAPH_API_VERSION?: string;
  WHATSAPP_TEMPLATE_NAME?: string;
  WHATSAPP_TEMPLATE_LANGUAGE?: string;
}

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const READY_ATTEMPTS = 100;

function requiredSecret(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required Worker secret: ${name}. Run: npx wrangler secret put ${name}`);
  }
  return value;
}

/**
 * A single named Durable Object intentionally fronts the API.  The backend's
 * local worker mode elects one scheduler through PostgreSQL, and one object
 * also avoids multiplying its in-memory QR cache during a deployment.
 */
export class MiraiApi extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  async fetch(request: Request): Promise<Response> {
    this.starting ??= this.startAndWait().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const target = new URL(request.url);
    target.protocol = "http:";
    target.host = "container";
    const forwarded = new Request(target, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(8080).fetch(forwarded);
  }

  private async startAndWait(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      const databaseUrl = requiredSecret("DATABASE_URL", this.env.DATABASE_URL);
      const jwtSecret = requiredSecret("JWT_SECRET", this.env.JWT_SECRET);
      const corsOrigins = requiredSecret("CORS_ORIGINS", this.env.CORS_ORIGINS);
      const publicBaseUrl = requiredSecret("PUBLIC_BASE_URL", this.env.PUBLIC_BASE_URL);
      container.start({
        image: container.images.base,
        instance: "lite",
        // PostgreSQL, SMTP and the optional WhatsApp API are external services.
        enableInternet: true,
        env: {
          APP_MODE: "local",
          AUTO_MIGRATE: "1",
          UPLOAD_DIR: "/tmp/uploads",
          DATABASE_URL: databaseUrl,
          JWT_SECRET: jwtSecret,
          CERT_SECRET: this.env.CERT_SECRET ?? "",
          CORS_ORIGINS: corsOrigins,
          CORS_ORIGIN_REGEX: this.env.CORS_ORIGIN_REGEX ?? "",
          PUBLIC_BASE_URL: publicBaseUrl,
          APP_TIMEZONE: this.env.APP_TIMEZONE,
          APP_NAME: this.env.APP_NAME,
          APP_SHORT_NAME: this.env.APP_SHORT_NAME,
          INSTITUTION_NAME: this.env.INSTITUTION_NAME,
          SMTP_HOST: this.env.SMTP_HOST ?? "",
          SMTP_PORT: this.env.SMTP_PORT ?? "587",
          SMTP_USERNAME: this.env.SMTP_USERNAME ?? "",
          SMTP_PASSWORD: this.env.SMTP_PASSWORD ?? "",
          SMTP_FROM: this.env.SMTP_FROM ?? "",
          SMTP_SECURITY: this.env.SMTP_SECURITY ?? "starttls",
          WHATSAPP_ACCESS_TOKEN: this.env.WHATSAPP_ACCESS_TOKEN ?? "",
          WHATSAPP_PHONE_NUMBER_ID: this.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
          WHATSAPP_GRAPH_API_VERSION: this.env.WHATSAPP_GRAPH_API_VERSION ?? "",
          WHATSAPP_TEMPLATE_NAME: this.env.WHATSAPP_TEMPLATE_NAME ?? "",
          WHATSAPP_TEMPLATE_LANGUAGE: this.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en",
        },
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    const port = container.getTcpPort(8080);
    let lastError: unknown;
    for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
      try {
        const response = await port.fetch("http://container/health", {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error(`health check returned ${response.status}`);
        return;
      } catch (error) {
        lastError = error;
        await scheduler.wait(200);
      }
    }
    throw new Error("Mirai API container did not become ready on port 8080", {
      cause: lastError,
    });
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return env.MIRAI_API.getByName("primary").fetch(request);
  },
} satisfies ExportedHandler<Env>;
