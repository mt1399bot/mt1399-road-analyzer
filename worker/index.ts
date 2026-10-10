/** Cloudflare Worker entry point for MT1399 Analyze.
 *  Handles basePath /analyze/ by rewriting asset paths.
 */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const BASE_PATH = "/analyze";

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Open the standalone test site's main tool from its root URL.
    if (url.pathname === "/") {
      url.pathname = `${BASE_PATH}/`;
      return Response.redirect(url.toString(), 302);
    }

    if (url.pathname === BASE_PATH) {
      url.pathname = `${BASE_PATH}/`;
      return Response.redirect(url.toString(), 301);
    }

    // Rewrite /analyze/assets/* -> /assets/* for static files
    if (url.pathname.startsWith(`${BASE_PATH}/assets/`)) {
      const rewrittenPath = url.pathname.slice(BASE_PATH.length);
      const assetRequest = new Request(
        new URL(rewrittenPath, request.url),
        request
      );
      return env.ASSETS.fetch(assetRequest);
    }

    // Rewrite /analyze/_vinext/image -> /_vinext/image
    if (url.pathname === `${BASE_PATH}/_vinext/image`) {
      const rewrittenUrl = new URL(request.url);
      rewrittenUrl.pathname = "/_vinext/image";
      const imageRequest = new Request(rewrittenUrl, request);
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(imageRequest, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Handle image optimization at root path (fallback)
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
