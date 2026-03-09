import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const {data: i} = await supabase.from('orders').select('id, shopify_order_number').eq('shopify_order_number', 1693);
  const orderId = i[0].id;
  const {data: items} = await supabase.from('order_items').select('product_id, shopify_variant_id, sku, name').eq('order_id', orderId);
  console.log('Order Items:', items);
  
  const pIds = items.map(x => x.product_id).filter(Boolean);
  const vIds = items.map(x => x.shopify_variant_id).filter(Boolean);
  
  const {data: shopifyProds} = await supabase.from('products_shopify').select('id, shopify_id, sku, image_url');
  
  console.log('Sample shopify products:', shopifyProds.slice(0, 3));
  
  const foundByPid = shopifyProds.filter(p => pIds.includes(p.shopify_id) || pIds.includes(p.id));
  const foundByVid = shopifyProds.filter(p => vIds.includes(p.shopify_id) || vIds.includes(p.id));
  const foundBySku = shopifyProds.filter(p => items.map(i => i.sku).includes(p.sku));
  
  console.log('Found by product_id:', foundByPid.length > 0 ? foundByPid : 'None');
  console.log('Found by variant_id:', foundByVid.length > 0 ? foundByVid : 'None');
  console.log('Found by sku:', foundBySku.length > 0 ? foundBySku : 'None');
}
run();
