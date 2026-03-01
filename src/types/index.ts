export type UserRole = 'admin' | 'employee' | 'viewer' | 'user';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  permissions?: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 
  | 'new' 
  | 'packaging' 
  | 'needs_approval' 
  | 'ready_to_ship' 
  | 'shipped' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled'
  | 'blocked';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: UserRole;
  profile?: Profile;
}

export interface Customer {
  id: string;
  shopify_customer_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  shopify_line_item_id?: string;
  shopify_variant_id?: string;
  product_id?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  customer_id: string; // references customers.id
  customer?: Customer;
  delivery_company_id?: string;
  email: string;
  currency: string;
  total_price: number;
  subtotal_price: number;
  total_tax: number;
  delivery_method?: string;
  delivery_price?: number;
  payment_method?: string;
  fulfillment_status: string | null; // 'fulfilled', 'partial', etc.
  financial_status: string; // 'paid', 'pending', etc.
  internal_status: OrderStatus;
  created_at: string;
  updated_at: string;
  note: string | null;
  shipping_address: any; // JSONB
  billing_address: any; // JSONB
  items?: OrderItem[];
  audit_history?: AuditLog[]; 
  tags?: string[];
  tracking_number?: string;
  tracking_url?: string;
}


export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  image_url?: string;
  category?: string;
  tags?: string[];
  quantity_on_hand: number;
  low_stock_threshold: number;
  bin_location: string | null;
  cost: number;
  selling_price: number;
  parent_id?: string | null;
  parent?: { name: string };
  shopify_variant_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProduct {
  id: string;
  shopify_product_id: string;
  shopify_variant_id: string;
  title: string;
  sku: string;
  price: number;
  images: string[];
  inventory_policy: 'deny' | 'continue';
  created_at: string;
  updated_at: string;
  local_inventory_enabled?: boolean;
  local_quantity?: number;
  cost?: number;
  selling_price?: number;
}

export interface ProductLink {
  id: string;
  shopify_product_id: string; 
  shopify_variant_id: string;
  inventory_product_id: string;
  inventory_product?: Product;
  priority: number;
  quantity_per_unit: number; // For bundles/sets
}

export interface OrderVerification {
  id: string;
  order_id: string;
  variant_id: string | null; // null represents "whole order" verification
  media_url: string;
  media_type: 'image' | 'video';
  uploaded_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string; 
  old_data: any;
  new_data: any;
  metadata?: any;
  reason?: string;
  user_id: string;
  created_at: string;
  profiles?: {
      full_name: string;
      role: UserRole;
  };
}

export interface DeliveryCompany {
  id: string;
  name: string;
  api_key?: string;
  base_url?: string;
  rates?: any; // JSONB for rate configuration
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryTagMapping {
  id: string;
  tag: string;
  delivery_company_id: string;
  priority: number;
  created_at: string;
}

export interface InventoryLocation {
  id: string;
  name: string;
  type: 'warehouse' | 'truck' | 'store' | 'other';
  details?: string;
  precise_location_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface InventoryLevel {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  updated_at: string;
  location?: InventoryLocation;
}

