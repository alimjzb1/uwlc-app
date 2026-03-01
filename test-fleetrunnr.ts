import { readFileSync } from 'fs';
import { resolve } from 'path';

const envContent = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
const keyMatch = envContent.match(/VITE_FLEETRUNNR_API_KEY=(.*)/);
const apiKey = keyMatch ? keyMatch[1].trim() : null;

const trackingNumber = '862997542856556544';

async function t(url: string) {
  try {
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` }});
    console.log(JSON.stringify({ url, status: res.status }));
  } catch (e:any) {
    console.log(JSON.stringify({ url, error: e.message }));
  }
}

async function run() {
  await t(`https://api.fleetrunnr.com/orders/${trackingNumber}`);
  await t(`https://api.fleetrunnr.com/v1/orders/${trackingNumber}`);
  await t(`https://api.fleetrunnr.com/v1/orders?tracking_number=${trackingNumber}`);
}

run();
