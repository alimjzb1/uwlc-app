import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Assuming standard vite env vars
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20260303_order_details.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // we don't have a direct sql runner in supabase-js, so we'll just query 
    // to see if the columns exist or try to push it
    const { data: fetchTest, error: errTest } = await supabase.from('orders').select('delivery_price').limit(1);

    if (errTest) {
      console.log('Column does not exist, need to apply migration manually via SQL editor or CLI.');
      console.log('Error:', errTest.message);
    } else {
      console.log('Columns exist! Fetch test:', fetchTest);

      // Now fetch order 1678
      const { data } = await supabase.from('orders').select('shopify_order_number, delivery_price, delivery_method, payment_method').eq('shopify_order_number', '1678');
      console.log('Order 1678:', data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
