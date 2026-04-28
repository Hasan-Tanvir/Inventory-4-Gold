import {
  User, Product, Order, Dealer, Target, Notification,
  Customization, Category, Officer, Payment, RetailTransaction,
  SendAmountEntry, CommissionClearance, ProductStockEntry, ProductStockTransfer, TargetReward
} from '../types';
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
    officerId: profile.officer_id
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
    officerId: profile.officer_id
  }));
};

const saveUser = async (user: User & { password?: string }): Promise<User | null> => {
  if (user.password) {
    // Creation: sign up the user first
    const authUser = await signUp(user.id, user.password, user.name);
    if (!authUser) return null;
    // Now update the profile with additional fields
    const { error } = await supabase
      .from('profiles')
      .update({
        role: user.role,
        photo: user.photo,
        notifications_enabled: user.notificationsEnabled,
        allowed_tabs: user.allowedTabs,
        mobile_quick_tabs: user.mobileQuickTabs,
        officer_id: user.officerId
      })
      .eq('id', authUser.id);

    if (error) {
      console.error('Error updating profile after signup:', error);
      return null;
    }

    return {
      id: authUser.id,
      name: authUser.name,
      role: user.role,
      photo: user.photo,
      notificationsEnabled: user.notificationsEnabled,
      allowedTabs: user.allowedTabs || [],
      mobileQuickTabs: user.mobileQuickTabs || [],
      officerId: user.officerId
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
        officer_id: user.officerId
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
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
      officerId: data.officer_id
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

const saveProduct = async (product: Omit<Product, 'id'>): Promise<Product | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      version: product.version,
      category_id: product.categoryId,
      retail_price: product.retailPrice,
      commission: product.commission,
      status: product.status,
      dhaka: product.dhaka,
      chittagong: product.chittagong,
      slabs: product.slabs,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving product:', error);
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
    approvedBy: order.approved_by,
    isQuote: order.is_quote,
    retailPaymentStatus: order.retail_payment_status,
    partialAmount: order.partial_amount,
    retailPaymentDate: order.retail_payment_date,
    paymentReference: order.payment_reference,
    includePriceIncreaseInCommission: order.include_price_increase_in_commission,
    inventorySource: order.inventory_source,
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
    approvedBy: data.approved_by,
    isQuote: data.is_quote,
    retailPaymentStatus: data.retail_payment_status,
    partialAmount: data.partial_amount,
    retailPaymentDate: data.retail_payment_date,
    paymentReference: data.payment_reference,
    includePriceIncreaseInCommission: data.include_price_increase_in_commission,
    inventorySource: data.inventory_source,
    showSerialsOnInvoice: data.show_serials_on_invoice,
  };
};

const getConfig = async (): Promise<Customization | null> => {
  return getCustomization();
};

const getNextOrderId = async (isQuote = false): Promise<string> => {
  const config = await getCustomization();
  const seed = isQuote ? config?.quoteSerialSeed : config?.orderSerialSeed;
  const prefix = isQuote ? 'Q' : 'O';
  if (!seed) return `${prefix}-${Date.now()}`;
  return `${seed}-${Date.now()}`;
};

const getNextPaymentId = async (): Promise<string> => {
  return `PAY-${Date.now()}`;
};

const getNextPaymentReference = async (): Promise<string> => {
  const config = await getCustomization();
  if (!config?.paymentReferenceSeed) return `REF-${Date.now()}`;
  return `${config.paymentReferenceSeed}-${Date.now()}`;
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

const approveOrder = async (id: string, approvedBy: string): Promise<boolean> => {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'approved', approved_by: approvedBy })
    .eq('id', id);

  if (error) {
    console.error('Error approving order:', error);
    return false;
  }

  return true;
};

const rejectOrder = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'rejected' })
    .eq('id', id);

  if (error) {
    console.error('Error rejecting order:', error);
    return false;
  }

  return true;
};

const placeOrder = async (order: Order): Promise<{ success: boolean; order?: Order; message?: string }> => {
  if (!order.id) {
    const saved = await saveOrder(order);
    if (!saved) return { success: false, message: 'Failed to save order' };
    return { success: true, order: saved };
  }

  const existingOrder = await getOrder(order.id);
  if (!existingOrder) {
    const saved = await saveOrder(order);
    if (!saved) return { success: false, message: 'Failed to save order' };
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

  return { success: true, order };
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

  const { data: existingTransactions } = await supabase
    .from('retail_transactions')
    .select('order_id');

  const existingOrderIds = new Set(existingTransactions?.map((row: any) => row.order_id));

  const transactionsToInsert = approvedOrders
    .filter((order: any) => !existingOrderIds.has(order.id))
    .map((order: any) => ({
      order_id: order.id,
      date: order.date,
      detail: `Retail sale ${order.id}`,
      amount: order.net_total,
      payment_status: order.retail_payment_status,
      paid_amount: order.partial_amount,
      location: order.inventory_source,
      type: 'sale',
      user_id: order.created_by,
    }));

  if (transactionsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('retail_transactions')
      .insert(transactionsToInsert);

    if (insertError) {
      console.error('Error syncing retail sales:', insertError);
      return { success: false, message: insertError.message };
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

  if (typeof paidAmount === 'number') {
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

const saveProductStockEntries = async (entries: Omit<ProductStockEntry, 'id'>[]): Promise<ProductStockEntry[] | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const payload = entries.map(entry => ({
    entry_id: entry.entryId,
    batch_id: entry.batchId,
    product_id: entry.productId,
    product_name: entry.productName,
    date: entry.date,
    location: entry.location,
    quantity: entry.quantity,
    note: entry.note,
    user_id: user.id,
  }));

  const { data, error } = await supabase
    .from('product_stock_entries')
    .insert(payload)
    .select();

  if (error) {
    console.error('Error saving product stock entries:', error);
    return null;
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
    ...token,
    amount: Number(token.amount),
  }));
};

const disburseCommissionToken = async (officerId: string, tokenId: string): Promise<{ success: boolean; message?: string }> => {
  const { error } = await supabase
    .from('commission_tokens')
    .update({ status: 'disbursed', disbursed_date: new Date().toISOString().split('T')[0] })
    .eq('id', tokenId)
    .eq('officer_id', officerId);

  if (error) {
    console.error('Error disbursing commission token:', error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

const undoCommissionTokenDisbursement = async (officerId: string, tokenId: string): Promise<{ success: boolean; message?: string }> => {
  const { error } = await supabase
    .from('commission_tokens')
    .update({ status: 'pending', disbursed_date: null })
    .eq('id', tokenId)
    .eq('officer_id', officerId);

  if (error) {
    console.error('Error undoing commission token disbursement:', error);
    return { success: false, message: error.message };
  }

  return { success: true };
};

const updateCommissionToken = async (officerId: string, tokenId: string, updates: { amount?: number; status?: string }): Promise<boolean> => {
  const payload: any = {};
  if (typeof updates.amount === 'number') payload.amount = updates.amount;
  if (updates.status) payload.status = updates.status;

  const { error } = await supabase
    .from('commission_tokens')
    .update(payload)
    .eq('id', tokenId)
    .eq('officer_id', officerId);

  if (error) {
    console.error('Error updating commission token:', error);
    return false;
  }

  return true;
};

const deleteCommissionToken = async (officerId: string, tokenId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('commission_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('officer_id', officerId);

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

  const { data, error } = await supabase
    .from('product_stock_entries')
    .insert({
      entry_id: entry.entryId,
      batch_id: entry.batchId,
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

  if (error) {
    console.error('Error saving product stock entry:', error);
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
    return false;
  }

  return true;
};

const deleteProductStockEntry = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('product_stock_entries')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product stock entry:', error);
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

const saveProductStockTransfer = async (transfer: Omit<ProductStockTransfer, 'id'>): Promise<ProductStockTransfer | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('product_stock_transfers')
    .insert({
      transfer_id: transfer.transferId,
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
    return null;
  }

  return {
    id: data.id,
    transferId: data.transfer_id,
    date: data.date,
    productId: data.product_id,
    productName: data.product_name,
    from: data.from_location,
    to: data.to_location,
    quantity: data.quantity,
    note: data.note,
  };
};

const updateProductStockTransfer = async (id: string, transfer: Partial<ProductStockTransfer>): Promise<boolean> => {
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
    });

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