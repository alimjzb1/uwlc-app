#!/bin/bash
API_KEY="301527|lWQBwLsYA78ma9JKhD8z3VpRI8ZSJ9V77Yx5ocga34a366c3"
TRACK="862997542856556544"

echo "GET /v1/orders/tracking"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $API_KEY" "https://api.fleetrunnr.com/v1/orders/tracking/$TRACK"

echo "GET /v1/orders"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $API_KEY" "https://api.fleetrunnr.com/v1/orders/$TRACK"

echo "GET /orders"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $API_KEY" "https://api.fleetrunnr.com/orders/$TRACK"

echo "GET /v1/orders search"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $API_KEY" "https://api.fleetrunnr.com/v1/orders?tracking_number=$TRACK"

echo "GET /api/v1/orders mik-express"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $API_KEY" "https://mik-express.fleetrunnr.app/api/v1/orders/$TRACK"
