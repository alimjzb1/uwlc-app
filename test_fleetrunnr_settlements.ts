import { config } from 'dotenv';
config();
const apiKey = process.env.VITE_FLEETRUNNR_API_KEY;

const testEndpoints = async () => {
  const endpoints = [
    'settlements',
    'accounting/settlements',
    'merchant-billing/settlements',
    'accounting/merchant-billing/settlements',
    'payouts',
    'accounting/payouts',
    'payments',
    'accounting/payments'
  ];

  let anyOk = false;
  for (const endpoint of endpoints) {
    try {
      const r = await fetch(`https://api.fleetrunnr.com/v1/${endpoint}?limit=5`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });
      if (r.ok) {
        console.log(`Endpoint SUCCESS: ${endpoint}`);
        console.log(await r.text());
        anyOk = true;
      }
    } catch (e) {
    }
  }
  if (!anyOk) console.log("NO ENDPOINTS WORKED");
};
testEndpoints();
