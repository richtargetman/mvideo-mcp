#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_BASE_URL = "https://omni-net.sellers.mvideo.ru";
const DEFAULT_LOCATION_ID = "10008903";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type StockUpdateItem = {
  product_id: string;
  location_id: string;
  count: number;
  offer_id?: string;
};

type PriceUpdateItem = {
  product_id: string;
  price: number;
  offer_id?: string;
  old_price?: number;
  vat?: string;
  min_price?: number;
};

type ProductMappingFilter = {
  product_id?: string[];
  offer_id?: string[];
  is_archived?: boolean;
};

type StockInfoFilter = ProductMappingFilter & {
  location_id?: string[];
};

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema)
  ])
);

const jsonObjectSchema = z.record(jsonValueSchema);

const server = new McpServer({
  name: "mvideo-mcp",
  version: "0.2.0"
});

function getApiConfig() {
  const apiKey = process.env.MVIDEO_API_KEY;
  if (!apiKey) {
    throw new Error("MVIDEO_API_KEY is not set");
  }

  return {
    apiKey,
    baseUrl: (process.env.MVIDEO_API_BASE ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    defaultLocationId: process.env.MVIDEO_DEFAULT_LOCATION_ID ?? DEFAULT_LOCATION_ID
  };
}

async function postMvideo(path: string, body: JsonValue): Promise<JsonValue> {
  const { apiKey, baseUrl } = getApiConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let parsed: JsonValue = text;
  if (text) {
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch {
      parsed = text;
    }
  } else {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(
      `M.Video API ${path} failed with HTTP ${response.status}: ${JSON.stringify(parsed)}`
    );
  }

  return parsed;
}

function jsonContent(value: JsonValue) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

function safeConfigContent() {
  return jsonContent({
    baseUrl: (process.env.MVIDEO_API_BASE ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    defaultLocationId: process.env.MVIDEO_DEFAULT_LOCATION_ID ?? DEFAULT_LOCATION_ID,
    apiKeyPresent: Boolean(process.env.MVIDEO_API_KEY),
    apiKeyLength: process.env.MVIDEO_API_KEY?.length ?? 0
  });
}

function cleanArray(value: string[] | undefined) {
  return value && value.length > 0 ? value : undefined;
}

function cleanProductMappingFilter(input: ProductMappingFilter): ProductMappingFilter {
  return {
    product_id: cleanArray(input.product_id),
    offer_id: cleanArray(input.offer_id),
    is_archived: input.is_archived
  };
}

function cleanStockInfoFilter(input: StockInfoFilter): StockInfoFilter {
  return {
    ...cleanProductMappingFilter(input),
    location_id: cleanArray(input.location_id)
  };
}

const paginationSchema = {
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(1000).optional()
};

function paginatedBody(filter: JsonObject | undefined, cursor?: string, limit?: number): JsonObject {
  return {
    filter: filter ?? {},
    cursor: cursor ?? "",
    limit: limit ?? 1000
  };
}

function requireConfirm(actual: string | undefined, expected: string) {
  if (actual !== expected) {
    throw new Error(`Live write refused. Pass confirm="${expected}" after dry_run review.`);
  }
}

server.registerTool(
  "mvideo_health",
  {
    title: "M.Video MCP health",
    description: "Return sanitized MCP/API configuration. Does not call M.Video and never returns the API key.",
    inputSchema: {}
  },
  async () => safeConfigContent()
);

server.registerTool(
  "mvideo_merchant_location_list",
  {
    title: "M.Video merchant location list",
    description: "List seller warehouses and their marketplace connections.",
    inputSchema: {
      status: z.array(z.enum(["DRAFT", "PENDING", "ACTIVE", "QUARANTINE", "FAILED", "ARCHIVED"])).optional(),
      location_id: z.array(z.string()).optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ status, location_id, cursor, limit }) => {
    const filter: JsonValue = {};
    if (status?.length) filter.status = status;
    if (location_id?.length) filter.location_id = location_id;
    filter.location_types = ["WAREHOUSE"];

    return jsonContent(
      await postMvideo("/v1/merchant/location/list", {
        filter,
        cursor,
        limit
      } as JsonValue)
    );
  }
);

server.registerTool(
  "mvideo_product_mapping_list",
  {
    title: "M.Video product mappings",
    description: "Read offer_id to product_id mappings.",
    inputSchema: {
      product_id: z.array(z.string()).optional(),
      offer_id: z.array(z.string()).optional(),
      is_archived: z.boolean().optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ product_id, offer_id, is_archived, cursor, limit }) => {
    const filter = cleanProductMappingFilter({ product_id, offer_id, is_archived });
    return jsonContent(
      await postMvideo("/v1/product/mapping/list", {
        filter,
        cursor,
        limit
      } as JsonValue)
    );
  }
);

server.registerTool(
  "mvideo_stock_info",
  {
    title: "M.Video stock info",
    description: "Read stock counts by product_id, offer_id, and/or location_id.",
    inputSchema: {
      product_id: z.array(z.string()).optional(),
      offer_id: z.array(z.string()).optional(),
      location_id: z.array(z.string()).optional(),
      is_archived: z.boolean().optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ product_id, offer_id, location_id, is_archived, cursor, limit }) => {
    const filter = cleanStockInfoFilter({ product_id, offer_id, location_id, is_archived });
    return jsonContent(
      await postMvideo("/v1/product/stock/info", {
        filter,
        cursor,
        limit
      } as JsonValue)
    );
  }
);

server.registerTool(
  "mvideo_price_info",
  {
    title: "M.Video price info",
    description: "Read prices by product_id and/or offer_id. Monetary values are returned in kopecks.",
    inputSchema: {
      product_id: z.array(z.string()).optional(),
      offer_id: z.array(z.string()).optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ product_id, offer_id, cursor, limit }) => {
    const filter = cleanProductMappingFilter({ product_id, offer_id });
    return jsonContent(
      await postMvideo("/v1/product/price/info", {
        filter,
        cursor: cursor ?? "",
        limit: limit ?? 1000
      } as JsonValue)
    );
  }
);

server.registerTool(
  "mvideo_price_update",
  {
    title: "M.Video price update",
    description: "Update RUB prices. Pass price/old_price/min_price in kopecks. Use dry_run=true to inspect the request before sending.",
    inputSchema: {
      items: z.array(
        z.object({
          product_id: z.string(),
          price: z.number().int().min(0),
          offer_id: z.string().optional(),
          old_price: z.number().int().min(0).optional(),
          vat: z.string().optional(),
          min_price: z.number().int().min(0).optional()
        })
      ).min(1).max(1000),
      dry_run: z.boolean().optional(),
      confirm: z.string().optional()
    }
  },
  async ({ items, dry_run, confirm }) => {
    const requestItems: PriceUpdateItem[] = items.map((item) => ({
      product_id: item.product_id,
      price: item.price,
      ...(item.offer_id ? { offer_id: item.offer_id } : {}),
      ...(item.old_price !== undefined ? { old_price: item.old_price } : {}),
      ...(item.vat !== undefined ? { vat: item.vat } : {}),
      ...(item.min_price !== undefined ? { min_price: item.min_price } : {})
    }));

    const request = { currency: "RUB", items: requestItems };
    if (dry_run) {
      return jsonContent({
        dry_run: true,
        request
      });
    }

    requireConfirm(confirm, "APPLY_MVIDEO_PRICE_UPDATE");
    return jsonContent(await postMvideo("/v1/product/price/update", request as JsonValue));
  }
);

server.registerTool(
  "mvideo_stock_update",
  {
    title: "M.Video stock update",
    description: "Update product stock counts. Use dry_run=true to inspect the request before sending.",
    inputSchema: {
      items: z.array(
        z.object({
          product_id: z.string(),
          location_id: z.string().optional(),
          count: z.number().int().min(0),
          offer_id: z.string().optional()
        })
      ).min(1).max(1000),
      dry_run: z.boolean().optional(),
      confirm: z.string().optional()
    }
  },
  async ({ items, dry_run, confirm }) => {
    const { defaultLocationId } = getApiConfig();
    const requestItems: StockUpdateItem[] = items.map((item) => ({
      product_id: item.product_id,
      location_id: item.location_id ?? defaultLocationId,
      count: item.count,
      ...(item.offer_id ? { offer_id: item.offer_id } : {})
    }));

    const request = { items: requestItems };
    if (dry_run) {
      return jsonContent({
        dry_run: true,
        request
      });
    }

    requireConfirm(confirm, "APPLY_MVIDEO_STOCK_UPDATE");
    return jsonContent(await postMvideo("/v1/product/stock/update", request as JsonValue));
  }
);

server.registerTool(
  "mvideo_order_fbs_list",
  {
    title: "M.Video FBS order list",
    description: "Read FBS orders. Pass OmniNet filter fields as a raw JSON object when needed.",
    inputSchema: {
      filter: jsonObjectSchema.optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ filter, cursor, limit }) =>
    jsonContent(await postMvideo("/v1/order/fbs/list", paginatedBody(filter, cursor, limit)))
);

server.registerTool(
  "mvideo_order_fbs_status_list",
  {
    title: "M.Video FBS order status list",
    description: "Read FBS order status updates. Pass OmniNet filter fields as a raw JSON object when needed.",
    inputSchema: {
      filter: jsonObjectSchema.optional(),
      cursor: paginationSchema.cursor,
      limit: paginationSchema.limit
    }
  },
  async ({ filter, cursor, limit }) =>
    jsonContent(await postMvideo("/v1/order/fbs/status/list", paginatedBody(filter, cursor, limit)))
);

server.registerTool(
  "mvideo_order_fbs_labels_get",
  {
    title: "M.Video FBS labels get",
    description: "Get FBS order labels. Pass the exact OmniNet request object from the order workflow.",
    inputSchema: {
      request: jsonObjectSchema
    }
  },
  async ({ request }) => jsonContent(await postMvideo("/v1/order/fbs/labels/get", request))
);

server.registerTool(
  "mvideo_order_fbs_exemplar_set",
  {
    title: "M.Video FBS exemplar set",
    description: "Set required FBS exemplar/marking data. Defaults to dry-run; live write requires confirm.",
    inputSchema: {
      request: jsonObjectSchema,
      dry_run: z.boolean().optional(),
      confirm: z.string().optional()
    }
  },
  async ({ request, dry_run, confirm }) => {
    if (dry_run !== false) {
      return jsonContent({ dry_run: true, request });
    }
    requireConfirm(confirm, "APPLY_MVIDEO_FBS_EXEMPLAR_SET");
    return jsonContent(await postMvideo("/v1/order/fbs/exemplar/set", request));
  }
);

server.registerTool(
  "mvideo_shipment_create",
  {
    title: "M.Video shipment create",
    description: "Create a shipment for FBS orders. Defaults to dry-run; live write requires idempotency_key and confirm.",
    inputSchema: {
      request: jsonObjectSchema,
      dry_run: z.boolean().optional(),
      confirm: z.string().optional()
    }
  },
  async ({ request, dry_run, confirm }) => {
    if (!request.idempotency_key || typeof request.idempotency_key !== "string") {
      throw new Error("shipment/create requires request.idempotency_key");
    }
    if (dry_run !== false) {
      return jsonContent({ dry_run: true, request });
    }
    requireConfirm(confirm, "APPLY_MVIDEO_SHIPMENT_CREATE");
    return jsonContent(await postMvideo("/v1/shipment/create", request));
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
