import {
  User, Product, Order, Dealer, Target, Notification,
  Customization, Category, Officer, Payment, RetailTransaction,
  SendAmountEntry, CommissionClearance, ProductStockEntry, ProductStockTransfer, TargetReward
} from '../types';

// Force redeploy
import { supabase } from '@/lib/supabase';

const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    name: profile.name,
    role: profile.role,
    photo: profile.photo,
    notificationsEnabled: profile.notifications_enabled,
    allowedTabs: profile.allowed_tabs || [],
    mobileQuickTabs: profile.mobile_quick_tabs || [],
    officerId: profile.officer_id,
    displayNamePreference: profile.display_name_preference || 'officerId'
  };
};

const signIn = async (email: string, password: string): Promise<User | null> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error.message);
    return null;
  }

  return await getCurrentUser();
};

const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error.message);
  }
};

const signUp = async (email: string, password: string, name: string): Promise<User | null> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    console.error('Sign up error:', error.message);
    return null;
  }

  return await getCurrentUser();
};

const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return (data || []).map(profile => ({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    photo: profile.photo,
    notificationsEnabled: profile.notifications_enabled,
    allowedTabs: profile.allowed_tabs || [],
    mobileQuickTabs: profile.mobile_quick_tabs || [],
    officerId: profile.officer_id,
    displayNamePreference: profile.display_name_preference || 'officerId'
  }));
};

const saveUser = async (user: User & { password?: string }): Promise<User | null> => {
  if (user.password) {
    // Creation: sign up the user first
    const authUser = await signUp(user.id, user.password, user.name);
    if (!authUser) return null;
    // Now update the profile with additional fields
    const { data, error } = await supabase
      .from('profiles')
      .update({
        role: user.role,
        photo: user.photo,
        notifications_enabled: user.notificationsEnabled,
        allowed_tabs: user.allowedTabs,
        mobile_quick_tabs: user.mobileQuickTabs,
        officer_id: user.officerId,
        display_name_preference: user.displayNamePreference || 'officerId'
      })
      .eq('id', authUser.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating user profile:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      role: data.role,
      photo: data.photo,
      notificationsEnabled: data.notifications_enabled,
      allowedTabs: data.allowed_tabs || [],
      mobileQuickTabs: data.mobile_quick_tabs || [],
      officerId: data.officer_id,
      displayNamePreference: data.display_name_preference || 'officerId'
    };
  } else {
    // Update existing user
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: user.name,
        role: user.role,
        photo: user.photo,
        notifications_enabled: user.notificationsEnabled,
        allowed_tabs: user.allowedTabs,
        mobile_quick_tabs: user.mobileQuickTabs,
        officer_id: user.officerId,
        display_name_preference: user.displayNamePreference || 'officerId'
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating user:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      role: data.role,
      photo: data.photo,
      notificationsEnabled: data.notifications_enabled,
      allowedTabs: data.allowed_tabs || [],
      mobileQuickTabs: data.mobile_quick_tabs || [],
      officerId: data.officer_id,
      displayNamePreference: data.display_name_preference || 'officerId'
    };
  }
};

const deleteUser = async (id: string): Promise<boolean> => {
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    console.error('Error deleting user:', error);
    return false;
  }
  return true;
};

// Categories
const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data.map(cat => ({
    id: cat.id,
    name: cat.name,
  }));
};

const saveCategory = async (category: Omit<Category, 'id'> & { id?: string }): Promise<Category | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('categories')
    .upsert({
      ...category,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving category:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
  };
};

const updateCategory = async (id: string, category: Partial<Category>): Promise<boolean> => {
  const { error } = await supabase
    .from('categories')
    .update(category)
    .eq('id', id);

  if (error) {
    console.error('Error updating category:', error);
    return false;
  }

  return true;
};

const deleteCategory = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    return false;
  }

  return true;
};

// Products
const getProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }

  return data.map(prod => ({
    id: prod.id,
    name: prod.name,
    version: prod.version,
    categoryId: prod.category_id,
    retailPrice: prod.retail_price,
    commission: prod.commission,
    status: prod.status,
    dhaka: prod.dhaka,
    chittagong: prod.chittagong,
    slabs: prod.slabs,
  }));
};

const getProduct = async (id: string): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error) console.error('Error fetching product:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    version: data.version,
    categoryId: data.category_id,
    retailPrice: data.retail_price,
    commission: data.commission,
    status: data.status,
    dhaka: data.dhaka,
    chittagong: data.chittagong,
    slabs: data.slabs,
  };
};

const adjustProductStock = async (productId: string, location: 'dhaka' | 'chittagong', delta: number): Promise<boolean> => {
  const product = await getProduct(productId);
  if (!product) return false;

  const currentQty = product[location] || 0;
  const updatedQty = currentQty + delta;
  if (updatedQty < 0) {
    console.error('Insufficient stock for adjustment:', { productId, location, currentQty, delta });
    return false;
  }

  const { error } = await supabase
    .from('products')
    .update({ [location]: updatedQty })
    .eq('id', productId);

  if (error) {
    console.error('Error adjusting product stock:', error);
    return false;
  }

  return true;
};

const getOrderInventoryMap = (items: OrderItem[], inventorySource: 'dhaka' | 'chittagong' | 'mixed'): Map<string, number> => {
  const map = new Map<string, number>();
  const source = inventorySource || 'dhaka';

  items.forEach(item => {
    if (!item.productId) return;
    const location = source === 'mixed' ? item.location : source;
    const key = `${item.productId}:${location}`;
    map.set(key, (map.get(key) || 0) + (item.quantity || 0));
  });

  return map;
};

const applyOrderStockDelta = async (originalOrder: Order | null, updatedOrder: Order): Promise<boolean> => {
  const originalApproved = originalOrder?.status === 'approved';
  const updatedApproved = updatedOrder.status === 'approved';

  if (!originalApproved && !updatedApproved) {
    return true;
  }

  if (originalApproved && !updatedApproved) {
    const originalMap = getOrderInventoryMap(originalOrder!.items, originalOrder!.inventorySource);
    for (const [key, qty] of originalMap.entries()) {
      const [productId, location] = key.split(':') as [string, 'dhaka' | 'chittagong'];
      if (!(await adjustProductStock(productId, location, qty))) return false;
    }
    return true;
  }

  if (!originalApproved && updatedApproved) {
    const newMap = getOrderInventoryMap(updatedOrder.items, updatedOrder.inventorySource);
    for (const [key, qty] of newMap.entries()) {
      const [productId, location] = key.split(':') as [string, 'dhaka' | 'chittagong'];
      if (!(await adjustProductStock(productId, location, -qty))) return false;
    }
    return true;
  }

  const originalMap = getOrderInventoryMap(originalOrder!.items, originalOrder!.inventorySource);
  const newMap = getOrderInventoryMap(updatedOrder.items, updatedOrder.inventorySource);
  const allKeys = new Set<string>([...originalMap.keys(), ...newMap.keys()]);

  for (const key of allKeys) {
    const [productId, location] = key.split(':') as [string, 'dhaka' | 'chittagong'];
    const originalQty = originalMap.get(key) || 0;
    const newQty = newMap.get(key) || 0;
    const delta = newQty - originalQty;
    if (delta === 0) continue;
    if (!(await adjustProductStock(productId, location, -delta))) return false;
  }

  return true;
};

const createCommissionTokenForOrder = async (order: Order): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const existing = await supabase
    .from('commission_tokens')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();

  if (existing.error) {
    console.error('Error checking existing commission token:', existing.error);
    return false;
  }

  if (existing.data) {
    return true;
  }

  const amount = order.items.reduce((sum, item) => sum + Number(item.commission || 0), 0);
  if (amount <= 0) return true;

  const { error } = await supabase
    .from('commission_tokens')
    .insert({
      order_id: order.id,
      date: order.date,
      amount,
      status: 'pending',
      user_id: user.id,
    });

  if (error) {
    console.error('Error creating commission token:', error);
    return false;
  }

  return true;
};

const saveProduct = async (product: Omit<Product, 'id'>): Promise<Product | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // For new products with initial quantity, create stock entries instead of setting dhaka/chittagong directly
  const isNew = !product.id;
  const initialDhaka = isNew ? product.dhaka : 0;
  const initialChittagong = isNew ? product.chittagong : 0;

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      version: product.version,
      category_id: product.categoryId,
      retail_price: product.retailPrice,
      commission: product.commission,
      status: product.status,
      dhaka: 0, // Start at 0, add via stock entries
      chittagong: 0,
      slabs: product.slabs,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving product:', error);
    return null;
  }

  // Create initial stock entries
  const initialEntryId = (initialDhaka > 0 || initialChittagong > 0) ? await getNextStockEntryId() : undefined;
  if (initialDhaka > 0) {
    await saveProductStockEntry({
      entryId: initialEntryId,
      batchId: initialEntryId,
      productId: data.id,
      productName: data.name,
      date: new Date().toISOString().split('T')[0],
      location: 'dhaka',
      quantity: initialDhaka,
      note: 'Initial stock on product creation'
    });
  }
  if (initialChittagong > 0) {
    await saveProductStockEntry({
      entryId: initialEntryId,
      batchId: initialEntryId,
      productId: data.id,
      productName: data.name,
      date: new Date().toISOString().split('T')[0],
      location: 'chittagong',
      quantity: initialChittagong,
      note: 'Initial stock on product creation'
    });
  }

  // Re-fetch to get updated stock
  return await getProduct(data.id);
};

const updateProduct = async (id: string, product: Partial<Product>): Promise<boolean> => {
  const { error } = await supabase
    .from('products')
    .update({
      name: product.name,
      version: product.version,
      category_id: product.categoryId,
      retail_price: product.retailPrice,
      commission: product.commission,
      status: product.status,
      dhaka: product.dhaka,
      chittagong: product.chittagong,
      slabs: product.slabs,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating product:', error);
    return false;
  }

  return true;
};

const deleteProduct = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }

  return true;
};

const reorderProducts = async (ids: string[]): Promise<boolean> => {
  // Persisting product order is not supported in this schema yet.
  // This stub keeps page interactions from breaking while preserving the current client order.
  return true;
};

// Dealers
const getDealers = async (): Promise<Dealer[]> => {
  const { data, error } = await supabase
    .from('dealers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching dealers:', error);
    return [];
  }

  return data.map(dealer => ({
    id: dealer.id,
    name: dealer.name,
    address: dealer.address,
    phone: dealer.phone,
    officerName: dealer.officer_name,
    balance: dealer.balance,
    officerId: dealer.officer_id,
  }));
};

const getDealer = async (id: string): Promise<Dealer | null> => {
  const { data, error } = await supabase
    .from('dealers')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error) console.error('Error fetching dealer:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    address: data.address,
    phone: data.phone,
    officerName: data.officer_name,
    balance: data.balance,
    officerId: data.officer_id,
  };
};

const saveDealer = async (dealer: Omit<Dealer, 'id'>): Promise<Dealer | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('dealers')
    .insert({
      name: dealer.name,
      address: dealer.address,
      phone: dealer.phone,
      officer_name: dealer.officerName,
      balance: dealer.balance,
      officer_id: dealer.officerId,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving dealer:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    address: data.address,
    phone: data.phone,
    officerName: data.officer_name,
    balance: data.balance,
    officerId: data.officer_id,
  };
};

const updateDealer = async (id: string, dealer: Partial<Dealer>): Promise<boolean> => {
  const { error } = await supabase
    .from('dealers')
    .update({
      name: dealer.name,
      address: dealer.address,
      phone: dealer.phone,
      officer_name: dealer.officerName,
      balance: dealer.balance,
      officer_id: dealer.officerId,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating dealer:', error);
    return false;
  }

  return true;
};

const deleteDealer = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('dealers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting dealer:', error);
    return false;
  }

  return true;
};

// Officers
const getOfficers = async (): Promise<Officer[]> => {
  const { data, error } = await supabase
    .from('officers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching officers:', error);
    return [];
  }

  return data.map(officer => ({
    id: officer.id,
    name: officer.name,
    phone: officer.phone,
    designation: officer.designation,
    commissionBalance: officer.commission_balance,
    clearanceHistory: [], // Will fetch separately if needed
    commissionTokens: [], // Will fetch separately if needed
  }));
};

const saveOfficer = async (officer: Omit<Officer, 'id' | 'clearanceHistory' | 'commissionTokens'>): Promise<Officer | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('officers')
    .insert({
      name: officer.name,
      phone: officer.phone,
      designation: officer.designation,
      commission_balance: officer.commissionBalance,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving officer:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    phone: data.phone,
    designation: data.designation,
    commissionBalance: data.commission_balance,
    clearanceHistory: [],
    commissionTokens: [],
  };
};

const updateOfficer = async (id: string, officer: Partial<Officer>): Promise<boolean> => {
  const { error } = await supabase
    .from('officers')
    .update({
      name: officer.name,
      phone: officer.phone,
      designation: officer.designation,
      commission_balance: officer.commissionBalance,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating officer:', error);
    return false;
  }

  return true;
};

const deleteOfficer = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('officers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting officer:', error);
    return false;
  }

  return true;
};

// Orders
const getOrders = async (): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      dealers (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }

  const userIds = Array.from(new Set<any>(data.flatMap((order: any) => [order.created_by, order.approved_by].filter(Boolean))));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, officer_id, name, display_name_preference')
    .in('id', userIds);

  const userLabelMap = new Map<string, string>();
  (profiles || []).forEach((profile: any) => {
    if (profile.id) {
      const displayValue = profile.display_name_preference === 'name'
        ? profile.name || profile.officer_id || profile.id
        : profile.officer_id || profile.name || profile.id;
      userLabelMap.set(profile.id, displayValue);
    }
  });

  return data.map(order => ({
    id: order.id,
    date: order.date,
    type: order.type,
    status: order.status,
    customerName: order.customer_name,
    dealerId: order.dealer_id,
    customerPhone: order.customer_phone,
    customerAddress: order.customer_address,
    officer: order.officer,
    items: order.order_items.map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      version: item.version,
      quantity: item.quantity,
      basePrice: item.base_price,
      price: item.price,
      total: item.total,
      location: item.location,
      commission: item.commission,
      serialNumbers: item.serial_numbers,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    extra: order.extra,
    netTotal: order.net_total,
    notes: order.notes,
    createdBy: order.created_by,
    createdByLabel: userLabelMap.get(order.created_by) || order.created_by,
    approvedBy: order.approved_by,
    approvedByLabel: order.approved_by ? (userLabelMap.get(order.approved_by) || order.approved_by) : undefined,
    isQuote: order.is_quote,
    retailPaymentStatus: order.retail_payment_status,
    partialAmount: order.partial_amount,
    retailPaymentDate: order.retail_payment_date,
    paymentReference: order.payment_reference,
    includePriceIncreaseInCommission: order.include_price_increase_in_commission,
    inventorySource: order.inventory_source || 'dhaka',
    showSerialsOnInvoice: order.show_serials_on_invoice,
  }));
};

const saveOrder = async (order: Order): Promise<Order | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Insert order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      id: order.id,
      date: order.date,
      type: order.type,
      status: order.status,
      customer_name: order.customerName,
      dealer_id: order.dealerId,
      customer_phone: order.customerPhone,
      customer_address: order.customerAddress,
      officer: order.officer,
      subtotal: order.subtotal,
      discount: order.discount,
      extra: order.extra,
      net_total: order.netTotal,
      notes: order.notes,
      created_by: user.id,
      approved_by: order.approvedBy,
      is_quote: order.isQuote,
      retail_payment_status: order.retailPaymentStatus,
      partial_amount: order.partialAmount,
      retail_payment_date: order.retailPaymentDate,
      payment_reference: order.paymentReference,
      include_price_increase_in_commission: order.includePriceIncreaseInCommission,
      inventory_source: order.inventorySource,
      show_serials_on_invoice: order.showSerialsOnInvoice,
      user_id: user.id,
    })
    .select()
    .single();

  if (orderError) {
    console.error('Error saving order:', orderError);
    return null;
  }

  // Insert order items
  const itemsToInsert = order.items.map(item => ({
    order_id: orderData.id,
    product_id: item.productId,
    product_name: item.productName,
    version: item.version,
    quantity: item.quantity,
    base_price: item.basePrice,
    price: item.price,
    total: item.total,
    location: item.location,
    commission: item.commission,
    serial_numbers: item.serialNumbers,
    user_id: user.id,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('Error saving order items:', itemsError);
    await supabase.from('orders').delete().eq('id', orderData.id);
    return null;
  }

  return {
    ...order,
    id: orderData.id,
    createdBy: user.id,
  };
};

const updateOrder = async (id: string, order: Partial<Order>): Promise<boolean> => {
  const { error } = await supabase
    .from('orders')
    .update({
      date: order.date,
      type: order.type,
      status: order.status,
      customer_name: order.customerName,
      dealer_id: order.dealerId,
      customer_phone: order.customerPhone,
      customer_address: order.customerAddress,
      officer: order.officer,
      subtotal: order.subtotal,
      discount: order.discount,
      extra: order.extra,
      net_total: order.netTotal,
      notes: order.notes,
      approved_by: order.approvedBy,
      is_quote: order.isQuote,
      retail_payment_status: order.retailPaymentStatus,
      partial_amount: order.partialAmount,
      retail_payment_date: order.retailPaymentDate,
      payment_reference: order.paymentReference,
      include_price_increase_in_commission: order.includePriceIncreaseInCommission,
      inventory_source: order.inventorySource,
      show_serials_on_invoice: order.showSerialsOnInvoice,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating order:', error);
    return false;
  }

  return true;
};

const deleteOrder = async (id: string): Promise<boolean> => {
  const existingOrder = await getOrder(id);
  if (existingOrder?.status === 'approved') {
    const restored = await applyOrderStockDelta(existingOrder, { ...existingOrder, status: 'rejected' });
    if (!restored) {
      console.error('Error restoring stock for approved order before delete');
      return false;
    }
  }

  // Delete order items first
  await supabase
    .from('order_items')
    .delete()
    .eq('order_id', id);

  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting order:', error);
    return false;
  }

  return true;
};

const getOrder = async (id: string): Promise<Order | null> => {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      dealers (
        id,
        name
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching order:', error);
    return null;
  }

  const userIds = [data.created_by, data.approved_by].filter(Boolean);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, officer_id, name, display_name_preference')
    .in('id', userIds);

  const userLabelMap = new Map<string, string>();
  (profiles || []).forEach((profile: any) => {
    if (profile.id) {
      const displayValue = profile.display_name_preference === 'name'
        ? profile.name || profile.officer_id || profile.id
        : profile.officer_id || profile.name || profile.id;
      userLabelMap.set(profile.id, displayValue);
    }
  });

  return {
    id: data.id,
    date: data.date,
    type: data.type,
    status: data.status,
    customerName: data.customer_name,
    dealerId: data.dealer_id,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    officer: data.officer,
    items: data.order_items.map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      version: item.version,
      quantity: item.quantity,
      basePrice: item.base_price,
      price: item.price,
      total: item.total,
      location: item.location,
      commission: item.commission,
      serialNumbers: item.serial_numbers,
    })),
    subtotal: data.subtotal,
    discount: data.discount,
    extra: data.extra,
    netTotal: data.net_total,
    notes: data.notes,
    createdBy: data.created_by,
    createdByLabel: userLabelMap.get(data.created_by) || data.created_by,
    approvedBy: data.approved_by,
    approvedByLabel: data.approved_by ? (userLabelMap.get(data.approved_by) || data.approved_by) : undefined,
    isQuote: data.is_quote,
    retailPaymentStatus: data.retail_payment_status,
    partialAmount: data.partial_amount,
    retailPaymentDate: data.retail_payment_date,
    paymentReference: data.payment_reference,
    includePriceIncreaseInCommission: data.include_price_increase_in_commission,
    inventorySource: data.inventory_source || 'dhaka',
    showSerialsOnInvoice: data.show_serials_on_invoice,
  };
};

const getNextPaymentId = async (): Promise<string> => {
  return `PAY-${Date.now()}`;
};

const getNextPaymentReference = async (): Promise<string> => {
  const config = await getCustomization();
  if (!config?.paymentReferenceSeed) return `REF-${Date.now()}`;
  
  const seed = config.paymentReferenceSeed;
  const match = seed.match(/(\d+)$/);
  const numericPart = match ? parseInt(match[1], 10) : 1;
  const prefix = seed.substring(0, seed.length - match?.[1].length || 0);
  const padLength = match?.[1].length || 5;
  
  // Get existing payments
  const payments = await getPayments();
  let maxNum = numericPart - 1;
  payments.forEach(payment => {
    const payMatch = payment.reference?.match(/(\d+)$/);
    if (payMatch) {
      const num = parseInt(payMatch[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  
  const nextNum = maxNum + 1;
  const paddedNum = String(nextNum).padStart(padLength, '0');
  return `${prefix}${paddedNum}`;
};

const getNextSequentialId = async (table: string, column: string, prefix: string, padLength = 5): Promise<string> => {
  const { data, error } = await supabase
    .from(table)
    .select(column);

  if (error || !data) {
    console.error('Error fetching sequential ids:', error);
    return `${prefix}${String(1).padStart(padLength, '0')}`;
  }

  let maxNum = 0;
  data.forEach((row: any) => {
    const value = row[column];
    if (typeof value !== 'string') return;
    const match = value.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) {
      const num = parseInt(match[1], 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(padLength, '0')}`;
};

const getNextStockEntryId = async (): Promise<string> => {
  return await getNextSequentialId('product_stock_entries', 'entry_id', 'E', 5);
};

const getNextStockTransferId = async (): Promise<string> => {
  return await getNextSequentialId('product_stock_transfers', 'transfer_id', 'T', 5);
};

const getAllSerials = async (): Promise<string[]> => {
  const orders = await getOrders();
  return orders.flatMap(order => order.items.flatMap(item => item.serialNumbers || []));
};

const searchBySerial = async (serial: string): Promise<{ order: Order; item: any } | null> => {
  const normalized = serial.trim().toLowerCase();
  const orders = await getOrders();
  for (const order of orders) {
    for (const item of order.items) {
      if (item.serialNumbers.some(sn => sn.toLowerCase() === normalized)) {
        return { order, item };
      }
    }
  }
  return null;
};

const approveOrder = async (id: string, approvedBy: string): Promise<{ success: boolean; message?: string }> => {
  const existingOrder = await getOrder(id);
  if (!existingOrder) return { success: false, message: 'Order not found' };
  if (existingOrder.status === 'approved') return { success: true };

  const stockAdjusted = await applyOrderStockDelta(existingOrder, { ...existingOrder, status: 'approved' });
  if (!stockAdjusted) return { success: false, message: 'Insufficient stock to approve order' };

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'approved', approved_by: approvedBy })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('Error approving order:', error || 'No row returned from update');
    return { success: false, message: error?.message || 'Failed to update order status' };
  }

  if (existingOrder.type === 'retail') {
    await syncRetailSalesFromApprovedOrders();
  }

  await createCommissionTokenForOrder({ ...existingOrder, status: 'approved' });

  return { success: true };
};

const rejectOrder = async (id: string): Promise<boolean> => {
  const existingOrder = await getOrder(id);
  if (!existingOrder) return false;

  if (existingOrder.status === 'approved') {
    const stockRestored = await applyOrderStockDelta(existingOrder, { ...existingOrder, status: 'rejected' });
    if (!stockRestored) return false;
  }

  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'rejected', approved_by: null })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    console.error('Error rejecting order:', error || 'No row returned from update');
    return false;
  }

  return true;
};

const placeOrder = async (order: Order): Promise<{ success: boolean; order?: Order; message?: string }> => {
  const existingOrder = order.id ? await getOrder(order.id) : null;

  if (!order.id || !existingOrder) {
    const saved = await saveOrder(order);
    if (!saved) return { success: false, message: 'Failed to save order' };

    if (order.status === 'approved') {
      const stockAdjusted = await applyOrderStockDelta(null, order);
      if (!stockAdjusted) return { success: false, message: 'Failed to adjust stock for approved order' };
    }

    return { success: true, order: saved };
  }

  const updated = await updateOrder(order.id, order);
  if (!updated) return { success: false, message: 'Failed to update order' };

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', order.id);

  if (error) {
    console.error('Error clearing existing order items:', error);
    return { success: false, message: 'Failed to update order items' };
  }

  const itemsToInsert = order.items.map(item => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.productName,
    version: item.version,
    quantity: item.quantity,
    base_price: item.basePrice,
    price: item.price,
    total: item.total,
    location: item.location,
    commission: item.commission,
    serial_numbers: item.serialNumbers,
    user_id: order.createdBy,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsToInsert);

  if (itemsError) {
    console.error('Error updating order items:', itemsError);
    return { success: false, message: 'Failed to update order items' };
  }

  const stockAdjusted = await applyOrderStockDelta(existingOrder, order);
  if (!stockAdjusted) {
    return { success: false, message: 'Failed to adjust stock for order update' };
  }

  return { success: true, order };
};

const disburseTargetReward = async (
  targetId: string,
  dealerId: string,
  officerId?: string,
  officerName?: string
): Promise<{ success: boolean; message?: string }> => {
  const target = await getTarget(targetId);
  if (!target) return { success: false, message: 'Target not found' };
  if (target.status !== 'active') return { success: false, message: 'Target is not active' };

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, subtotal, net_total, status, is_quote, dealer_id, date')
    .eq('status', 'approved')
    .eq('dealer_id', dealerId);

  if (ordersError) {
    console.error('Error fetching orders for target reward:', ordersError);
    return { success: false, message: ordersError.message };
  }

  const orderIds = (orders || []).map((order: any) => order.id);
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, quantity, total, order_id')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (itemsError) {
    console.error('Error fetching order items for target reward:', itemsError);
    return { success: false, message: itemsError.message };
  }

  const relevantItems = (items || []).filter((item: any) =>
    !target.productIds.length || target.productIds.includes(item.product_id)
  );
  const current = target.type === 'quantity'
    ? relevantItems.reduce((sum, item: any) => sum + Number(item.quantity || 0), 0)
    : relevantItems.reduce((sum, item: any) => sum + Number(item.total || 0), 0);

  const disbursedCycles = (target.rewardDisbursed || {})[dealerId] || 0;
  const achievedCycles = Math.floor(current / Math.max(1, target.targetValue));
  const eligibleCycles = Math.max(0, achievedCycles - disbursedCycles);
  if (eligibleCycles <= 0) {
    return { success: false, message: 'No eligible reward cycle available' };
  }

  let amount = 0;
  if (target.rewardType === 'percentage') {
    amount = Math.round(current * (target.rewardValue / 100));
  } else {
    amount = Number(target.rewardValue || 0) * eligibleCycles;
  }

  const rewardRef = `TR-${Date.now()}`;
  const dealer = await getDealer(dealerId);
  const dealerName = dealer?.name || target.dealerName || 'Dealer';

  const { data: inserted, error: insertError } = await supabase
    .from('target_rewards')
    .insert({
      reward_ref: rewardRef,
      target_id: targetId,
      target_name: target.name,
      dealer_id: dealerId,
      dealer_name: dealerName,
      officer_id: officerId,
      officer_name: officerName || '',
      date: new Date().toISOString().split('T')[0],
      cycles: eligibleCycles,
      amount,
      payment_id: null,
      note: `Reward cycles: ${eligibleCycles}`,
      status: 'active',
      user_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error inserting target reward:', insertError);
    return { success: false, message: insertError.message };
  }

  const paymentRef = await getNextPaymentReference();
  const { data: paymentData, error: paymentError } = await supabase
    .from('payments')
    .insert({
      dealer_id: dealerId,
      dealer_name: dealerName,
      date: new Date().toISOString().split('T')[0],
      type: 'Adjustment',
      amount,
      reference: paymentRef,
      notes: `Target reward for ${target.name}`,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (paymentError || !paymentData) {
    console.error('Error inserting target reward payment:', paymentError);
    return { success: false, message: paymentError?.message || 'Failed to create reward payment' };
  }

  const { error: updateRewardError } = await supabase
    .from('target_rewards')
    .update({ payment_id: paymentData.id })
    .eq('id', inserted.id);

  if (updateRewardError) {
    console.error('Error updating target reward payment_id:', updateRewardError);
    return { success: false, message: updateRewardError.message };
  }

  const updatedRewardDisbursed = {
    ...(target.rewardDisbursed || {}),
    [dealerId]: disbursedCycles + eligibleCycles,
  };

  const { error: targetUpdateError } = await supabase
    .from('targets')
    .update({ reward_disbursed: updatedRewardDisbursed })
    .eq('id', targetId);

  if (targetUpdateError) {
    console.error('Error updating target reward disbursement:', targetUpdateError);
    return { success: false, message: targetUpdateError.message };
  }

  return { success: true };
};

const getTargetRewards = async (): Promise<TargetReward[]> => {
  const { data, error } = await supabase
    .from('target_rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching target rewards:', error);
    return [];
  }

  return data.map(reward => ({
    id: reward.id,
    rewardRef: reward.reward_ref,
    targetId: reward.target_id,
    targetName: reward.target_name,
    dealerId: reward.dealer_id,
    dealerName: reward.dealer_name,
    officerId: reward.officer_id,
    officerName: reward.officer_name,
    date: reward.date,
    cycles: reward.cycles,
    amount: Number(reward.amount),
    paymentId: reward.payment_id,
    note: reward.note,
    status: reward.status,
  }));
};

const updateTargetReward = async (id: string, updates: Partial<TargetReward>): Promise<{ success: boolean; message?: string }> => {
  const payload: any = {
    officer_id: updates.officerId,
    officer_name: updates.officerName,
    amount: updates.amount,
    date: updates.date,
    note: updates.note,
  };

  const { error } = await supabase
    .from('target_rewards')
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Error updating target reward:', error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

const undoTargetReward = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const { error } = await supabase
    .from('target_rewards')
    .update({ status: 'reversed' })
    .eq('id', id);

  if (error) {
    console.error('Error undoing target reward:', error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

const syncRetailSalesFromApprovedOrders = async (): Promise<{ success: boolean; message?: string }> => {
  const { data: approvedOrders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('type', 'retail')
    .eq('status', 'approved');

  if (ordersError) {
    console.error('Error fetching approved retail orders:', ordersError);
    return { success: false, message: ordersError.message };
  }

  const { data: existingTransactions, error: existingError } = await supabase
    .from('retail_transactions')
    .select('id, order_id');

  if (existingError) {
    console.error('Error fetching retail transactions:', existingError);
    return { success: false, message: existingError.message };
  }

  const transactionMap = new Map<string, string>();
  (existingTransactions || []).forEach((row: any) => {
    if (row.order_id) transactionMap.set(row.order_id, row.id);
  });

  for (const order of approvedOrders || []) {
    const transactionPayload = {
      order_id: order.id,
      date: order.date,
      detail: `Retail sale ${order.id}`,
      amount: order.net_total,
      payment_status: order.retail_payment_status,
      paid_amount: order.partial_amount,
      location: order.inventory_source === 'mixed' ? 'dhaka' : (order.inventory_source || 'dhaka'),
      type: 'sale',
      user_id: order.created_by,
    };

    if (transactionMap.has(order.id)) {
      const transactionId = transactionMap.get(order.id)!;
      const { error: updateError } = await supabase
        .from('retail_transactions')
        .update(transactionPayload)
        .eq('id', transactionId);

      if (updateError) {
        console.error('Error updating retail transaction:', updateError);
        return { success: false, message: updateError.message };
      }
    } else {
      const { error: insertError } = await supabase
        .from('retail_transactions')
        .insert(transactionPayload);

      if (insertError) {
        console.error('Error inserting retail transaction:', insertError);
        return { success: false, message: insertError.message };
      }
    }
  }

  return { success: true };
};

const setRetailOrderPaymentStatus = async (
  orderId: string,
  status: 'paid' | 'unpaid' | 'partial',
  paidAmount?: number
): Promise<{ success: boolean; message?: string }> => {
  const updates: any = {
    retail_payment_status: status,
  };

  if (status === 'unpaid') {
    updates.partial_amount = 0;
  } else if (typeof paidAmount === 'number') {
    updates.partial_amount = paidAmount;
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) {
    console.error('Error setting retail order payment status:', error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

const getSendAmounts = async (): Promise<SendAmountEntry[]> => {
  const { data, error } = await supabase
    .from('retail_transactions')
    .select('*')
    .eq('type', 'sent_to_main')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching send amounts:', error);
    return [];
  }

  return data.map(entry => ({
    id: entry.id,
    date: entry.date,
    location: entry.location,
    amount: entry.amount,
    note: entry.note,
  }));
};

const saveSendAmount = async (entry: Omit<SendAmountEntry, 'id'>): Promise<SendAmountEntry | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('retail_transactions')
    .insert({
      order_id: null,
      date: entry.date,
      detail: entry.note || 'Send to main',
      amount: entry.amount,
      payment_status: null,
      paid_amount: null,
      location: entry.location,
      type: 'sent_to_main',
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving send amount:', error);
    return null;
  }

  return {
    id: data.id,
    date: data.date,
    location: data.location,
    amount: data.amount,
    note: data.detail,
  };
};

const saveProductStockEntries = async (
  entries: Omit<ProductStockEntry, 'id'>[],
  options?: { applyToInventory?: boolean }
): Promise<ProductStockEntry[] | null> => {
  const applyToInventory = options?.applyToInventory ?? true;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const groupEntryId = entries[0]?.entryId || entries[0]?.batchId || await getNextStockEntryId();
  const payload = entries.map(entry => {
    const entryId = entry.entryId || entry.batchId || groupEntryId;
    const batchId = entry.batchId || entryId;
    return {
      entry_id: entryId,
      batch_id: batchId,
      product_id: entry.productId,
      product_name: entry.productName,
      date: entry.date,
      location: entry.location,
      quantity: entry.quantity,
      note: entry.note,
      user_id: user.id,
    };
  });

  const { data, error } = await supabase
    .from('product_stock_entries')
    .insert(payload)
    .select();

  if (error) {
    console.error('Error saving product stock entries:', error);
    return null;
  }

  if (applyToInventory) {
    const adjustmentMap = new Map<string, number>();
    payload.forEach(entry => {
      const key = `${entry.product_id}:${entry.location}`;
      adjustmentMap.set(key, (adjustmentMap.get(key) || 0) + entry.quantity);
    });

    for (const [key, qty] of adjustmentMap.entries()) {
      const [productId, location] = key.split(':') as [string, 'dhaka' | 'chittagong'];
      await adjustProductStock(productId, location, qty);
    }
  }

  return data.map(entry => ({
    id: entry.id,
    entryId: entry.entry_id,
    batchId: entry.batch_id,
    productId: entry.product_id,
    productName: entry.product_name,
    date: entry.date,
    location: entry.location,
    quantity: entry.quantity,
    note: entry.note,
  }));
};

const getCommissionTokens = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('commission_tokens')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching commission tokens:', error);
    return [];
  }

  return data.map(token => ({
    id: token.id,
    orderId: token.order_id,
    date: token.date,
    amount: Number(token.amount),
    status: token.status,
    disbursedDate: token.disbursed_date,
    officerId: token.officer_id,
    userId: token.user_id,
  }));
};

const disburseCommissionToken = async (tokenId: string): Promise<{ success: boolean; message?: string }> => {
  // Get the token to find the officer
  const { data: token, error: tokenError } = await supabase
    .from('commission_tokens')
    .select('amount, user_id')
    .eq('id', tokenId)
    .single();

  if (tokenError || !token) {
    return { success: false, message: 'Token not found' };
  }

  // Find the officer by user_id (assuming officer has user_id)
  const { data: officerData, error: officerError } = await supabase
    .from('officers')
    .select('id, commission_balance')
    .eq('user_id', token.user_id)
    .single();

  if (officerError || !officerData) {
    return { success: false, message: 'Officer not found' };
  }

  // Update token status
  const { error: updateError } = await supabase
    .from('commission_tokens')
    .update({ status: 'disbursed', disbursed_date: new Date().toISOString().split('T')[0] })
    .eq('id', tokenId);

  if (updateError) {
    console.error('Error disbursing commission token:', updateError);
    return { success: false, message: updateError.message };
  }

  // Add to officer's commission balance
  const newBalance = (officerData.commission_balance || 0) + token.amount;
  const { error: balanceError } = await supabase
    .from('officers')
    .update({ commission_balance: newBalance })
    .eq('id', officerData.id);

  if (balanceError) {
    console.error('Error updating officer balance:', balanceError);
    return { success: false, message: balanceError.message };
  }

  return { success: true };
};

const undoCommissionTokenDisbursement = async (tokenId: string): Promise<{ success: boolean; message?: string }> => {
  // Get the token to find the officer
  const { data: token, error: tokenError } = await supabase
    .from('commission_tokens')
    .select('amount, user_id')
    .eq('id', tokenId)
    .single();

  if (tokenError || !token) {
    return { success: false, message: 'Token not found' };
  }

  // Find the officer
  const { data: officerData, error: officerError } = await supabase
    .from('officers')
    .select('id, commission_balance')
    .eq('user_id', token.user_id)
    .single();

  if (officerError || !officerData) {
    return { success: false, message: 'Officer not found' };
  }

  // Update token status
  const { error: updateError } = await supabase
    .from('commission_tokens')
    .update({ status: 'pending', disbursed_date: null })
    .eq('id', tokenId);

  if (updateError) {
    console.error('Error undoing commission token disbursement:', updateError);
    return { success: false, message: updateError.message };
  }

  // Subtract from officer's commission balance
  const newBalance = Math.max(0, (officerData.commission_balance || 0) - token.amount);
  const { error: balanceError } = await supabase
    .from('officers')
    .update({ commission_balance: newBalance })
    .eq('id', officerData.id);

  if (balanceError) {
    console.error('Error updating officer balance:', balanceError);
    return { success: false, message: balanceError.message };
  }

  return { success: true };
};

const updateCommissionToken = async (tokenId: string, updates: { amount?: number; status?: string }): Promise<boolean> => {
  const payload: any = {};
  if (typeof updates.amount === 'number') payload.amount = updates.amount;
  if (updates.status) payload.status = updates.status;

  const { error } = await supabase
    .from('commission_tokens')
    .update(payload)
    .eq('id', tokenId);

  if (error) {
    console.error('Error updating commission token:', error);
    return false;
  }

  return true;
};

const deleteCommissionToken = async (tokenId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('commission_tokens')
    .delete()
    .eq('id', tokenId);

  if (error) {
    console.error('Error deleting commission token:', error);
    return false;
  }

  return true;
};

// Payments
const getPayments = async (): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      dealers (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    return [];
  }

  return data.map(payment => ({
    id: payment.id,
    dealerId: payment.dealer_id,
    dealerName: payment.dealer_name,
    date: payment.date,
    type: payment.type,
    amount: payment.amount,
    reference: payment.reference,
    notes: payment.notes,
  }));
};

const savePayment = async (payment: Omit<Payment, 'id'>): Promise<Payment | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      dealer_id: payment.dealerId,
      dealer_name: payment.dealerName,
      date: payment.date,
      type: payment.type,
      amount: payment.amount,
      reference: payment.reference,
      notes: payment.notes,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving payment:', error);
    return null;
  }

  return {
    id: data.id,
    dealerId: data.dealer_id,
    dealerName: data.dealer_name,
    date: data.date,
    type: data.type,
    amount: data.amount,
    reference: data.reference,
    notes: data.notes,
  };
};

const updatePayment = async (id: string, payment: Partial<Payment>): Promise<boolean> => {
  const { error } = await supabase
    .from('payments')
    .update({
      dealer_id: payment.dealerId,
      dealer_name: payment.dealerName,
      date: payment.date,
      type: payment.type,
      amount: payment.amount,
      reference: payment.reference,
      notes: payment.notes,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating payment:', error);
    return false;
  }

  return true;
};

const deletePayment = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting payment:', error);
    return false;
  }

  return true;
};

// Targets
const getTargets = async (): Promise<Target[]> => {
  const { data, error } = await supabase
    .from('targets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching targets:', error);
    return [];
  }

  return data.map(target => ({
    id: target.id,
    name: target.name,
    dealerId: target.dealer_id,
    dealerName: target.dealer_name,
    type: target.type,
    productIds: target.product_ids,
    targetValue: target.target_value,
    currentValue: target.current_value,
    startDate: target.start_date,
    endDate: target.end_date,
    rewardType: target.reward_type,
    rewardValue: target.reward_value,
    status: target.status,
    assignedOfficerId: target.assigned_officer_id,
    rewardedDealerIds: target.rewarded_dealer_ids,
    rewardDisbursed: target.reward_disbursed,
  }));
};

const getTarget = async (id: string): Promise<Target | null> => {
  const { data, error } = await supabase
    .from('targets')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error) console.error('Error fetching target:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    dealerId: data.dealer_id,
    dealerName: data.dealer_name,
    type: data.type,
    productIds: data.product_ids,
    targetValue: data.target_value,
    currentValue: data.current_value,
    startDate: data.start_date,
    endDate: data.end_date,
    rewardType: data.reward_type,
    rewardValue: data.reward_value,
    status: data.status,
    assignedOfficerId: data.assigned_officer_id,
    rewardedDealerIds: data.rewarded_dealer_ids,
    rewardDisbursed: data.reward_disbursed,
  };
};

const saveTarget = async (target: Omit<Target, 'id'>): Promise<Target | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('targets')
    .insert({
      name: target.name,
      dealer_id: target.dealerId,
      dealer_name: target.dealerName,
      type: target.type,
      product_ids: target.productIds,
      target_value: target.targetValue,
      current_value: target.currentValue,
      start_date: target.startDate,
      end_date: target.endDate,
      reward_type: target.rewardType,
      reward_value: target.rewardValue,
      status: target.status,
      assigned_officer_id: target.assignedOfficerId,
      rewarded_dealer_ids: target.rewardedDealerIds,
      reward_disbursed: target.rewardDisbursed,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving target:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    dealerId: data.dealer_id,
    dealerName: data.dealer_name,
    type: data.type,
    productIds: data.product_ids,
    targetValue: data.target_value,
    currentValue: data.current_value,
    startDate: data.start_date,
    endDate: data.end_date,
    rewardType: data.reward_type,
    rewardValue: data.reward_value,
    status: data.status,
    assignedOfficerId: data.assigned_officer_id,
    rewardedDealerIds: data.rewarded_dealer_ids,
    rewardDisbursed: data.reward_disbursed,
  };
};

const updateTarget = async (id: string, target: Partial<Target>): Promise<boolean> => {
  const { error } = await supabase
    .from('targets')
    .update({
      name: target.name,
      dealer_id: target.dealerId,
      dealer_name: target.dealerName,
      type: target.type,
      product_ids: target.productIds,
      target_value: target.targetValue,
      current_value: target.currentValue,
      start_date: target.startDate,
      end_date: target.endDate,
      reward_type: target.rewardType,
      reward_value: target.rewardValue,
      status: target.status,
      assigned_officer_id: target.assignedOfficerId,
      rewarded_dealer_ids: target.rewardedDealerIds,
      reward_disbursed: target.rewardDisbursed,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating target:', error);
    return false;
  }

  return true;
};

const deleteTarget = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('targets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting target:', error);
    return false;
  }

  return true;
};

// Notifications
const getNotifications = async (): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data.map(notification => ({
    id: notification.id,
    userId: notification.user_id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    read: notification.read,
    timestamp: notification.timestamp,
  }));
};

const saveNotification = async (notification: Omit<Notification, 'id'>): Promise<Notification | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: user.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      timestamp: notification.timestamp,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving notification:', error);
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type,
    read: data.read,
    timestamp: data.timestamp,
  };
};

const updateNotification = async (id: string, notification: Partial<Notification>): Promise<boolean> => {
  const { error } = await supabase
    .from('notifications')
    .update({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.read,
      timestamp: notification.timestamp,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating notification:', error);
    return false;
  }

  return true;
};

const deleteNotification = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting notification:', error);
    return false;
  }

  return true;
};

// Product Stock Entries
const getProductStockEntries = async (): Promise<ProductStockEntry[]> => {
  const { data, error } = await supabase
    .from('product_stock_entries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching product stock entries:', error);
    return [];
  }

  return data.map(entry => ({
    id: entry.id,
    entryId: entry.entry_id,
    batchId: entry.batch_id,
    productId: entry.product_id,
    productName: entry.product_name,
    date: entry.date,
    location: entry.location,
    quantity: entry.quantity,
    note: entry.note,
  }));
};

const saveProductStockEntry = async (entry: Omit<ProductStockEntry, 'id'>): Promise<ProductStockEntry | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const entryId = entry.entryId || await getNextStockEntryId();
  const batchId = entry.batchId || entryId;

  const { data, error } = await supabase
    .from('product_stock_entries')
    .insert({
      entry_id: entryId,
      batch_id: batchId,
      product_id: entry.productId,
      product_name: entry.productName,
      date: entry.date,
      location: entry.location,
      quantity: entry.quantity,
      note: entry.note,
      user_id: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('Error saving product stock entry:', error);
    return null;
  }

  const adjusted = await adjustProductStock(entry.productId, entry.location, entry.quantity);
  if (!adjusted) {
    await supabase.from('product_stock_entries').delete().eq('id', data.id);
    return null;
  }

  return {
    id: data.id,
    entryId: data.entry_id,
    batchId: data.batch_id,
    productId: data.product_id,
    productName: data.product_name,
    date: data.date,
    location: data.location,
    quantity: data.quantity,
    note: data.note,
  };
};

const updateProductStockEntry = async (id: string, entry: Partial<ProductStockEntry>): Promise<boolean> => {
  const { data: existing, error: existingError } = await supabase
    .from('product_stock_entries')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    console.error('Error fetching existing product stock entry:', existingError);
    return false;
  }

  const oldProductId = existing.product_id;
  const oldLocation = existing.location as 'dhaka' | 'chittagong';
  const oldQuantity = existing.quantity;

  const newProductId = entry.productId || oldProductId;
  const newLocation = entry.location || oldLocation;
  const newQuantity = typeof entry.quantity === 'number' ? entry.quantity : oldQuantity;

  if (oldProductId !== newProductId || oldLocation !== newLocation || oldQuantity !== newQuantity) {
    const restored = await adjustProductStock(oldProductId, oldLocation, oldQuantity);
    if (!restored) return false;

    const adjusted = await adjustProductStock(newProductId, newLocation, -newQuantity);
    if (!adjusted) {
      await adjustProductStock(oldProductId, oldLocation, -oldQuantity);
      return false;
    }
  }

  const { error } = await supabase
    .from('product_stock_entries')
    .update({
      entry_id: entry.entryId,
      batch_id: entry.batchId,
      product_id: entry.productId,
      product_name: entry.productName,
      date: entry.date,
      location: entry.location,
      quantity: entry.quantity,
      note: entry.note,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating product stock entry:', error);
    if (oldProductId !== newProductId || oldLocation !== newLocation || oldQuantity !== newQuantity) {
      await adjustProductStock(newProductId, newLocation, newQuantity);
      await adjustProductStock(oldProductId, oldLocation, -oldQuantity);
    }
    return false;
  }

  return true;
};

const deleteProductStockEntry = async (id: string): Promise<boolean> => {
  const { data: existing, error: existingError } = await supabase
    .from('product_stock_entries')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    console.error('Error fetching product stock entry to delete:', existingError);
    return false;
  }

  const adjusted = await adjustProductStock(existing.product_id, existing.location, -existing.quantity);
  if (!adjusted) {
    console.error('Error reversing product stock for deleted stock entry');
    return false;
  }

  const { error } = await supabase
    .from('product_stock_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product stock entry:', error);
    await adjustProductStock(existing.product_id, existing.location, existing.quantity);
    return false;
  }

  return true;
};

// Product Stock Transfers
const getProductStockTransfers = async (): Promise<ProductStockTransfer[]> => {
  const { data, error } = await supabase
    .from('product_stock_transfers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching product stock transfers:', error);
    return [];
  }

  return data.map(transfer => ({
    id: transfer.id,
    transferId: transfer.transfer_id,
    date: transfer.date,
    productId: transfer.product_id,
    productName: transfer.product_name,
    from: transfer.from_location,
    to: transfer.to_location,
    quantity: transfer.quantity,
    note: transfer.note,
  }));
};

const saveProductStockTransfer = async (transfer: Omit<ProductStockTransfer, 'id'>): Promise<{ success: boolean; transfer?: ProductStockTransfer; message?: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: 'No authenticated user' };

  if (transfer.from === transfer.to) {
    return { success: false, message: 'Source and destination must be different' };
  }

  const transferId = transfer.transferId || await getNextStockTransferId();
  const { data, error } = await supabase
    .from('product_stock_transfers')
    .insert({
      transfer_id: transferId,
      date: transfer.date,
      product_id: transfer.productId,
      product_name: transfer.productName,
      from_location: transfer.from,
      to_location: transfer.to,
      quantity: transfer.quantity,
      note: transfer.note,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving product stock transfer:', error);
    return { success: false, message: error.message };
  }

  const fromAdjusted = await adjustProductStock(transfer.productId, transfer.from, -transfer.quantity);
  const toAdjusted = await adjustProductStock(transfer.productId, transfer.to, transfer.quantity);

  if (!fromAdjusted || !toAdjusted) {
    if (fromAdjusted) {
      await adjustProductStock(transfer.productId, transfer.from, transfer.quantity);
    }
    if (toAdjusted) {
      await adjustProductStock(transfer.productId, transfer.to, -transfer.quantity);
    }
    return { success: false, message: 'Failed to adjust product stock after transfer' };
  }

  if (!data) {
    return { success: false, message: 'Stock transfer could not be created' };
  }

  return {
    success: true,
    transfer: {
      id: data.id,
      transferId: data.transfer_id,
      date: data.date,
      productId: data.product_id,
      productName: data.product_name,
      from: data.from_location,
      to: data.to_location,
      quantity: data.quantity,
      note: data.note,
    }
  };
};

const updateProductStockTransfer = async (id: string, transfer: Partial<ProductStockTransfer>): Promise<boolean> => {
  const { data: existing, error: existingError } = await supabase
    .from('product_stock_transfers')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    console.error('Error fetching existing product stock transfer:', existingError);
    return false;
  }

  const oldProductId = existing.product_id;
  const oldFrom = existing.from_location as 'dhaka' | 'chittagong';
  const oldTo = existing.to_location as 'dhaka' | 'chittagong';
  const oldQuantity = existing.quantity;

  const revertedFrom = await adjustProductStock(oldProductId, oldFrom, oldQuantity);
  const revertedTo = await adjustProductStock(oldProductId, oldTo, -oldQuantity);

  if (!revertedFrom || !revertedTo) {
    if (revertedFrom) await adjustProductStock(oldProductId, oldFrom, -oldQuantity);
    if (revertedTo) await adjustProductStock(oldProductId, oldTo, oldQuantity);
    return false;
  }

  const newProductId = transfer.productId || oldProductId;
  const newFrom = transfer.from || oldFrom;
  const newTo = transfer.to || oldTo;
  const newQuantity = typeof transfer.quantity === 'number' ? transfer.quantity : oldQuantity;

  const appliedFrom = await adjustProductStock(newProductId, newFrom, -newQuantity);
  const appliedTo = await adjustProductStock(newProductId, newTo, newQuantity);

  if (!appliedFrom || !appliedTo) {
    if (appliedFrom) await adjustProductStock(newProductId, newFrom, newQuantity);
    if (appliedTo) await adjustProductStock(newProductId, newTo, -newQuantity);
    await adjustProductStock(oldProductId, oldFrom, -oldQuantity);
    await adjustProductStock(oldProductId, oldTo, oldQuantity);
    return false;
  }

  const { error } = await supabase
    .from('product_stock_transfers')
    .update({
      transfer_id: transfer.transferId,
      date: transfer.date,
      product_id: transfer.productId,
      product_name: transfer.productName,
      from_location: transfer.from,
      to_location: transfer.to,
      quantity: transfer.quantity,
      note: transfer.note,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating product stock transfer:', error);
    return false;
  }

  return true;
};

const deleteProductStockTransfer = async (id: string): Promise<boolean> => {
  const { data: existing, error: existingError } = await supabase
    .from('product_stock_transfers')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    console.error('Error fetching product stock transfer to delete:', existingError);
    return false;
  }

  const productId = existing.product_id;
  const from = existing.from_location as 'dhaka' | 'chittagong';
  const to = existing.to_location as 'dhaka' | 'chittagong';
  const quantity = existing.quantity;

  const restoredFrom = await adjustProductStock(productId, from, quantity);
  const reversedTo = await adjustProductStock(productId, to, -quantity);

  if (!restoredFrom || !reversedTo) {
    if (restoredFrom) await adjustProductStock(productId, from, -quantity);
    if (reversedTo) await adjustProductStock(productId, to, quantity);
    return false;
  }

  const { error } = await supabase
    .from('product_stock_transfers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product stock transfer:', error);
    return false;
  }

  return true;
};

// Retail Transactions
const getRetailTransactions = async (): Promise<RetailTransaction[]> => {
  const { data, error } = await supabase
    .from('retail_transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching retail transactions:', error);
    return [];
  }

  return data.map(transaction => ({
    id: transaction.id,
    orderId: transaction.order_id,
    date: transaction.date,
    detail: transaction.detail,
    amount: transaction.amount,
    paymentStatus: transaction.payment_status,
    paidAmount: transaction.paid_amount,
    location: transaction.location,
    type: transaction.type,
  }));
};

const saveRetailTransaction = async (transaction: Omit<RetailTransaction, 'id'>): Promise<RetailTransaction | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('retail_transactions')
    .insert({
      order_id: transaction.orderId,
      date: transaction.date,
      detail: transaction.detail,
      amount: transaction.amount,
      payment_status: transaction.paymentStatus,
      paid_amount: transaction.paidAmount,
      location: transaction.location,
      type: transaction.type,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving retail transaction:', error);
    return null;
  }

  return {
    id: data.id,
    orderId: data.order_id,
    date: data.date,
    detail: data.detail,
    amount: data.amount,
    paymentStatus: data.payment_status,
    paidAmount: data.paid_amount,
    location: data.location,
    type: data.type,
  };
};

const updateRetailTransaction = async (id: string, transaction: Partial<RetailTransaction>): Promise<boolean> => {
  const { error } = await supabase
    .from('retail_transactions')
    .update({
      order_id: transaction.orderId,
      date: transaction.date,
      detail: transaction.detail,
      amount: transaction.amount,
      payment_status: transaction.paymentStatus,
      paid_amount: transaction.paidAmount,
      location: transaction.location,
      type: transaction.type,
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating retail transaction:', error);
    return false;
  }

  return true;
};

const deleteRetailTransaction = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('retail_transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting retail transaction:', error);
    return false;
  }

  return true;
};

// Customization
const getCustomization = async (): Promise<Customization | null> => {
  const { data, error } = await supabase
    .from('customization')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows
      return null;
    }
    console.error('Error fetching customization:', error);
    return null;
  }

  return {
    title: data.title,
    logo: data.logo,
    sidebarColor: data.sidebar_color,
    mainColor: data.main_color,
    initialRetailAmount: data.initial_retail_amount,
    initialRetailAmountDhaka: data.initial_retail_amount_dhaka,
    initialRetailAmountChittagong: data.initial_retail_amount_chittagong,
    regards: data.regards,
    execName: data.exec_name,
    execDetails: data.exec_details,
    customDetailText: data.custom_detail_text,
    customDetailHtml: data.custom_detail_html,
    customDetailBold: data.custom_detail_bold,
    customDetailItalic: data.custom_detail_italic,
    customDetailBoxed: data.custom_detail_boxed,
    orderSerialSeed: data.order_serial_seed,
    quoteSerialSeed: data.quote_serial_seed,
    paymentReferenceSeed: data.payment_reference_seed,
  };
};

const getConfig = getCustomization;

const getNextOrderId = async (isQuote = false): Promise<string> => {
  const config = await getCustomization();
  const defaultSeed = isQuote ? 'Q00001' : 'R00001';
  const seed = isQuote ? config?.quoteSerialSeed || defaultSeed : config?.orderSerialSeed || defaultSeed;
  const match = seed.match(/^([A-Za-z]+)(\d+)$/);
  const prefix = match?.[1] || (isQuote ? 'Q' : 'R');
  const padLength = match?.[2]?.length || 5;
  const startNum = match ? parseInt(match[2], 10) : 1;

  const orders = await getOrders();
  let maxNum = startNum - 1;

  orders.forEach(order => {
    const orderMatch = order.id?.match(new RegExp(`^${prefix}(\\d+)$`));
    if (orderMatch) {
      const num = parseInt(orderMatch[1], 10);
      if (!Number.isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  return `${prefix}${String(maxNum + 1).padStart(padLength, '0')}`;
};

const saveCustomization = async (customization: Customization): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('customization')
    .upsert({
      title: customization.title,
      logo: customization.logo,
      sidebar_color: customization.sidebarColor,
      main_color: customization.mainColor,
      initial_retail_amount: customization.initialRetailAmount,
      initial_retail_amount_dhaka: customization.initialRetailAmountDhaka,
      initial_retail_amount_chittagong: customization.initialRetailAmountChittagong,
      regards: customization.regards,
      exec_name: customization.execName,
      exec_details: customization.execDetails,
      custom_detail_text: customization.customDetailText,
      custom_detail_html: customization.customDetailHtml,
      custom_detail_bold: customization.customDetailBold,
      custom_detail_italic: customization.customDetailItalic,
      custom_detail_boxed: customization.customDetailBoxed,
      order_serial_seed: customization.orderSerialSeed,
      quote_serial_seed: customization.quoteSerialSeed,
      payment_reference_seed: customization.paymentReferenceSeed,
      user_id: user.id,
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving customization:', error);
    return false;
  }

  return true;
};

// Dashboard stats
const getDashboardStats = async () => {
  const orders = await getOrders();
  const officers = await getOfficers();
  const dealers = await getDealers();

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyOrders = orders.filter(order => {
    const orderDate = new Date(order.date);
    return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
  });

  const monthlySales = monthlyOrders.reduce((sum, order) => sum + order.netTotal, 0);
  const monthlyQuantity = monthlyOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  const pendingApprovals = orders.filter(order => order.status === 'pending').length;
  const totalQuotes = orders.filter(order => order.isQuote).length;

  const remainingDueBalance = dealers.reduce((sum, dealer) => sum + dealer.balance, 0);

  // Simple chart data
  const chartData = [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 5000 },
    { name: 'Thu', sales: 4500 },
    { name: 'Fri', sales: 6000 },
    { name: 'Sat', sales: 5500 },
    { name: 'Sun', sales: 7000 },
  ];

  return {
    monthlySales,
    monthlyQuantity,
    totalOfficers: officers.length,
    pendingApprovals,
    totalQuotes,
    remainingDueBalance,
    chartData,
  };
};

// Export all functions as an api object for backward compatibility
export const api = {
  getCurrentUser,
  signIn,
  signOut,
  signUp,
  getUsers,
  saveUser,
  deleteUser,
  getCategories,
  saveCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  saveProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
  getDealers,
  saveDealer,
  updateDealer,
  deleteDealer,
  getOfficers,
  saveOfficer,
  updateOfficer,
  deleteOfficer,
  getOrders,
  getOrder,
  getConfig,
  getNextOrderId,
  getNextPaymentId,
  getNextPaymentReference,
  getAllSerials,
  searchBySerial,
  approveOrder,
  rejectOrder,
  placeOrder,
  saveOrder,
  updateOrder,
  deleteOrder,
  getPayments,
  savePayment,
  updatePayment,
  deletePayment,
  getTargets,
  saveTarget,
  updateTarget,
  deleteTarget,
  getTargetRewards,
  updateTargetReward,
  undoTargetReward,
  getNotifications,
  saveNotification,
  updateNotification,
  deleteNotification,
  getProductStockEntries,
  saveProductStockEntry,
  saveProductStockEntries,
  updateProductStockEntry,
  deleteProductStockEntry,
  getProductStockTransfers,
  saveProductStockTransfer,
  updateProductStockTransfer,
  deleteProductStockTransfer,
  getCommissionTokens,
  disburseCommissionToken,
  undoCommissionTokenDisbursement,
  updateCommissionToken,
  deleteCommissionToken,
  getRetailTransactions,
  saveRetailTransaction,
  updateRetailTransaction,
  deleteRetailTransaction,
  syncRetailSalesFromApprovedOrders,
  setRetailOrderPaymentStatus,
  getSendAmounts,
  saveSendAmount,
  getCustomization,
  saveCustomization,
  getDashboardStats,
};

export default api;