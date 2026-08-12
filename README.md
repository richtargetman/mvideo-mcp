# M.Video MCP

Local MCP server for the M.Video / Eldorado OmniNet seller API.

Больше автоматизаций для селлеров найдешь в моем Telegram-канале: https://t.me/+yNLLxBt6vZ05MDUy

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
