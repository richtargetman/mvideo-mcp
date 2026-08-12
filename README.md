# M.Video MCP

Local MCP server for the M.Video / Eldorado OmniNet seller API.

Больше автоматизаций для селлеров найдешь в моем Telegram-канале: https://t.me/+yNLLxBt6vZ05MDUy

## Quick start

This is not a normal desktop app. It is a connector that lets your AI agent work
with the M.Video / Eldorado seller API: warehouses, product mappings, prices,
stocks, FBS orders, labels, and shipments.

What you need before installation:

- An M.Video / Eldorado seller API key.
- An AI agent or MCP client that supports local MCP servers.
- Node.js LTS installed on the computer where the agent runs.

The easiest way: open your AI agent and send it this message:

```text
Install this M.Video MCP for me: https://github.com/richtargetman/mvideo-mcp

Use Node.js, run npm install and npm run build, then connect dist/server.js as a local MCP server named "mvideo".
Ask me for my MVIDEO_API_KEY only when you are ready to put it into the local MCP environment.
Do not write the real API key into README, Git, screenshots, chat logs, or any public file.
After installation, run mvideo_health and tell me whether the connector is ready.
```

If you install it yourself, run:

```powershell
git clone https://github.com/richtargetman/mvideo-mcp.git
cd mvideo-mcp
npm install
npm run build
```

Then add the MCP client config from the section below and restart your agent.

How to check that everything works:

1. Ask the agent: `Check that M.Video MCP is connected.`
2. The agent should call `mvideo_health`.
3. If `apiKeyPresent` is `true`, the connector sees your API key.
4. Ask the agent: `Show my M.Video warehouses.`
5. If warehouses are returned, the connector is ready for real work.

## Auth

The server reads the seller API key from `MVIDEO_API_KEY` and sends it as the
`api-key` HTTP header. Do not store the real key in this repository.

Optional env:

- `MVIDEO_API_BASE`, default `https://omni-net.sellers.mvideo.ru`
- `MVIDEO_DEFAULT_LOCATION_ID`, default location for stock tools

## Tools

- `mvideo_health` - sanitized local configuration; does not call M.Video and never returns the API key.
- `mvideo_merchant_location_list` - list seller warehouses.
- `mvideo_product_mapping_list` - read `offer_id` to `product_id` mappings.
- `mvideo_price_info` - read prices by `product_id` and/or `offer_id`.
- `mvideo_price_update` - update RUB prices. Supports `dry_run`.
- `mvideo_stock_info` - read stock by `product_id`, `offer_id`, and/or `location_id`.
- `mvideo_stock_update` - update stock counts. Supports `dry_run`.
- `mvideo_order_fbs_list` - read FBS orders.
- `mvideo_order_fbs_status_list` - read FBS order status updates.
- `mvideo_order_fbs_labels_get` - get FBS order labels.
- `mvideo_order_fbs_exemplar_set` - set required FBS exemplar/marking data. Defaults to dry-run.
- `mvideo_shipment_create` - create an FBS shipment. Defaults to dry-run.

Write tools require an explicit confirmation string for live execution:

- `mvideo_price_update`: `confirm="APPLY_MVIDEO_PRICE_UPDATE"`
- `mvideo_stock_update`: `confirm="APPLY_MVIDEO_STOCK_UPDATE"`
- `mvideo_order_fbs_exemplar_set`: `confirm="APPLY_MVIDEO_FBS_EXEMPLAR_SET"`
- `mvideo_shipment_create`: `confirm="APPLY_MVIDEO_SHIPMENT_CREATE"`

Use `dry_run=true` first and only then repeat with `dry_run=false` and the matching `confirm`.

## How to ask your agent

After the MCP server is connected, you do not need to remember tool names. Write
to your agent like you would write to an employee: what to check, what to prepare,
and what to change.

Safe read-only examples:

- `Check if the M.Video connector works.`
- `Show my M.Video warehouses.`
- `Find product IDs in M.Video for these seller article numbers: SC_BLACK, SC_BLUE.`
- `Show current prices for these products.`
- `Show current stock balances for these products.`
- `Show new FBS orders from M.Video.`
- `Get labels for these FBS orders.`

Examples that change data:

- `Prepare a stock update, but do not send it yet: set SC_BLACK to 12 and SC_BLUE to 7.`
- `Prepare a price update, but do not send it yet: set SC_BLACK to 499 RUB.`
- `Create a shipment for these FBS orders, but first show me the dry-run.`

For any price, stock, exemplar, or shipment change, the agent must first show a
dry-run plan. If the plan is correct, tell the agent to apply it. The connector
will refuse dangerous write actions unless the agent sends the matching confirm
string.

Simple rule: checking data is safe; changing prices, stocks, marking data, or
shipments must always go through dry-run first.

## Agent reference

This section is for AI agents and technical users.

After the MCP server is connected, the agent should inspect available
`mvideo_*` tools, run read-only checks first, and use live write tools only after
showing a dry-run plan.

Example user requests:

- `Check that the M.Video MCP is connected and show the active base URL and default warehouse.`
- `Show my active M.Video warehouses.`
- `Find M.Video product mappings for offer IDs SC_BLACK and SC_BLUE.`
- `Show current M.Video prices for offer IDs SC_BLACK and SC_BLUE.`
- `Show stock balances for these offer IDs on warehouse 10008903.`
- `Prepare a dry-run stock update: set SC_BLACK to 12 and SC_BLUE to 7 on warehouse 10008903.`
- `Apply the stock update from the approved dry-run.`
- `Prepare a dry-run price update: set SC_BLACK to 499 RUB and old price to 699 RUB.`
- `Apply the approved price update.`
- `Show new FBS orders and their statuses.`
- `Create a shipment for these FBS orders using this idempotency key: <unique-key>. First show dry-run.`

Agent usage rules:

- For diagnostics, call `mvideo_health`.
- For warehouses, call `mvideo_merchant_location_list`.
- For `offer_id` to `product_id` conversion, call `mvideo_product_mapping_list`.
- For balances, call `mvideo_stock_info`.
- For prices, call `mvideo_price_info`.
- For FBS orders, statuses, labels, exemplar data, and shipments, use the matching `mvideo_order_fbs_*` or `mvideo_shipment_create` tools.
- Prices in `mvideo_price_info` and `mvideo_price_update` are in kopecks, so `499 RUB` must be sent as `49900`.
- Stock updates use `MVIDEO_DEFAULT_LOCATION_ID` when `location_id` is omitted.
- Any live write must be preceded by dry-run output and then repeated with `dry_run=false` plus the required `confirm` value.

## Run

```powershell
npm install
npm run build
$env:MVIDEO_API_KEY = "<set locally>"
npm start
```

## MCP client config example

Use your own absolute `dist/server.js` path after `npm run build`:

```json
{
  "mcpServers": {
    "mvideo": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "<absolute-path-to>\\mvideo-mcp\\dist\\server.js"
      ],
      "env": {
        "MVIDEO_API_KEY": "<set locally>",
        "MVIDEO_API_BASE": "https://omni-net.sellers.mvideo.ru",
        "MVIDEO_DEFAULT_LOCATION_ID": "10008903"
      }
    }
  }
}
```

Keep API keys in your local MCP client environment or shell only. Do not commit `.env` files or credentials.

OpenAPI source: `https://omni-net.sellers.mvideo.ru/api-docs`.
