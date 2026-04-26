import { 
  User, Product, Order, Dealer, Target, Notification, 
  Customization, Category, Officer, Payment, RetailTransaction,
  SendAmountEntry, CommissionClearance, ProductStockEntry, ProductStockTransfer, TargetReward
} from '../types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const KEYS = {
  USERS: 'erp_users',
  PRODUCTS: 'erp_products',
  ORDERS: 'erp_orders',
  DEALERS: 'erp_dealers',
  TARGETS: 'erp_targets',
  NOTIFICATIONS: 'erp_notifications',
  RETAIL: 'erp_retail',
  CONFIG: 'erp_config',
  SESSION: 'erp_session',
  CATEGORIES: 'erp_categories',
  OFFICERS: 'erp_officers',
  PAYMENTS: 'erp_payments',
  PRODUCT_STOCK_ENTRIES: 'erp_product_stock_entries',
  PRODUCT_STOCK_TRANSFERS: 'erp_product_stock_transfers',
  PRODUCT_STOCK_ENTRY_COUNTER: 'erp_product_stock_entry_counter',
  PRODUCT_STOCK_TRANSFER_COUNTER: 'erp_product_stock_transfer_counter',
  TARGET_REWARDS: 'erp_target_rewards',
  TARGET_REWARD_COUNTER: 'erp_target_reward_counter',
  ORDER_INVOICE_COUNTER: 'erp_order_invoice_counter',
  ORDER_QUOTE_COUNTER: 'erp_order_quote_counter',
  PAYMENT_REFERENCE_COUNTER: 'erp_payment_reference_counter'
};

const SUPABASE_TABLE = 'app_kv';
const SYNCED_KEYS = Object.values(KEYS);
let isHydratedFromRemote = false;

const getCurrentSessionUser = () => get<User | null>(KEYS.SESSION, null);

const getStorageKey = (key: string) => {
  if (key === KEYS.SESSION) return key;
  const user = getCurrentSessionUser();
  return isSupabaseConfigured && user?.id ? `${user.id}:${key}` : key;
};

const getSupabaseSession = async () => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Supabase auth session check failed', error.message);
    return null;
  }
  return data.session;
};

const getSupabaseOwnerId = async () => {
  const session = await getSupabaseSession();
  return session?.user?.id ?? null;
};

const getSupabaseUserData = async (): Promise<User | null> => {
  const session = await getSupabaseSession();
  if (!session?.user) return null;
  const metadata = (session.user.user_metadata || {}) as Record<string, any>;
  return {
    id: session.user.id,
    name: String(metadata.name || session.user.email || 'User'),
    role: metadata.role === 'admin' ? 'admin' : 'member',
    password: '',
    notificationsEnabled: metadata.notificationsEnabled !== false,
    allowedTabs: Array.isArray(metadata.allowedTabs) ? metadata.allowedTabs : [],
    mobileQuickTabs: Array.isArray(metadata.mobileQuickTabs) ? metadata.mobileQuickTabs : [],
    officerId: metadata.officerId || ''
  };
};

const hydrateSupabaseSession = async () => {
  if (!isSupabaseConfigured || !supabase) return null;
  const existing = getCurrentSessionUser();
  if (existing) return existing;
  const user = await getSupabaseUserData();
  if (user) set(KEYS.SESSION, user);
  return user;
};

const pushToRemote = async (key: string, value: unknown) => {
  if (!isSupabaseConfigured || !supabase) return;
  const ownerId = await getSupabaseOwnerId();
  if (!ownerId) return;
  const { error } = await supabase.from(SUPABASE_TABLE).upsert(
    { owner_id: ownerId, key, value, updated_at: new Date().toISOString() },
    { onConflict: ['owner_id', 'key'] }
  );
  if (error) {
    console.error(`Supabase upsert failed for ${key}`, error.message);
  }
};

const removeFromRemote = async (key: string) => {
  if (!isSupabaseConfigured || !supabase) return;
  const ownerId = await getSupabaseOwnerId();
  if (!ownerId) return;
  const { error } = await supabase.from(SUPABASE_TABLE).delete().eq('owner_id', ownerId).eq('key', key);
  if (error) {
    console.error(`Supabase delete failed for ${key}`, error.message);
  }
};

export const initializeApiStorage = async () => {
  if (!isSupabaseConfigured || !supabase || isHydratedFromRemote) return;
  const user = await hydrateSupabaseSession();
  if (!user) return;
  const { data, error } = await supabase.from(SUPABASE_TABLE).select('key, value').eq('owner_id', user.id);
  if (error) {
    console.error('Supabase initial sync failed', error.message);
    return;
  }
  (data || []).forEach((row) => {
    if (typeof row.key === 'string') {
      localStorage.setItem(getStorageKey(row.key), JSON.stringify(row.value));
    }
  });
  isHydratedFromRemote = true;
};

const get = <T>(key: string, def: T): T => {
  const val = localStorage.getItem(getStorageKey(key));
  return val ? JSON.parse(val) : def;
};
const set = (key: string, val: any) => {
  localStorage.setItem(getStorageKey(key), JSON.stringify(val));
  void pushToRemote(key, val);
};
const remove = (key: string) => {
  localStorage.removeItem(getStorageKey(key));
  void removeFromRemote(key);
};
const DEFAULT_ADMIN: User = {
  id: 'admin',
  name: 'Administrator',
  role: 'admin',
  password: 'whotheadmin',
  notificationsEnabled: true,
  allowedTabs: [],
  mobileQuickTabs: ['/', '/new-order', '/orders', '/invoices', '/balance']
};
const DEFAULT_MEMBER_TABS = ['/', '/new-order', '/orders', '/invoices', '/balance', '/serial-search', '/dealers'];
const normalizeUserId = (id: string) => (id || '').trim().toLowerCase();
const ensureUsers = () => {
  const users = get<User[]>(KEYS.USERS, []);
  if (users.length === 0) {
    set(KEYS.USERS, [DEFAULT_ADMIN]);
    return [DEFAULT_ADMIN];
  }

  const hasAdmin = users.some(u => normalizeUserId(u.id) === 'admin');
  if (!hasAdmin) {
    const merged = [...users, DEFAULT_ADMIN];
    set(KEYS.USERS, merged);
    return merged;
  }
  return users;
};
const nextSerial = (key: string, prefix: string) => {
  const current = get<number>(key, 0) + 1;
  set(key, current);
  return `${prefix}-${String(current).padStart(4, '0')}`;
};
const nextTargetRewardRef = () => {
  const current = get<number>(KEYS.TARGET_REWARD_COUNTER, 0) + 1;
  set(KEYS.TARGET_REWARD_COUNTER, current);
  return `TR-${String(current).padStart(5, '0')}`;
};
const getTodayISO = () => new Date().toISOString().split('T')[0];
const parseSeedSerial = (seed: string, fallbackPrefix: string) => {
  const cleaned = (seed || '').trim();
  const match = cleaned.match(/^(.*?)(\d+)$/);
  if (!match) return { prefix: fallbackPrefix, start: 1, width: 5 };
  return { prefix: match[1], start: Number(match[2]) || 1, width: match[2].length };
};
const getConfigSnapshot = () => get<Customization>(KEYS.CONFIG, {
  title: 'Smart ERP System',
  logo: '',
  sidebarColor: '#4169E1',
  mainColor: '#3b82f6',
  initialRetailAmount: 5000,
  initialRetailAmountDhaka: 5000,
  initialRetailAmountChittagong: 5000,
  regards: 'Best Regards,',
  execName: '',
  execDetails: '',
  customDetailText: '',
  customDetailHtml: '',
  customDetailBold: false,
  customDetailItalic: false,
  customDetailBoxed: true,
  orderSerialSeed: 'R00001',
  quoteSerialSeed: 'Q00001',
  paymentReferenceSeed: 'P00001'
});
const nextSeedSerial = (counterKey: string, seed: string, fallbackPrefix: string) => {
  const parsed = parseSeedSerial(seed, fallbackPrefix);
  const storedCounter = get<number | null>(counterKey, null);
  const nextValue = storedCounter === null ? parsed.start : storedCounter + 1;
  set(counterKey, nextValue);
  return `${parsed.prefix}${String(nextValue).padStart(parsed.width, '0')}`;
};

export const api = {
  // Auth & Users
  login: async (id: string, pass: string) => {
    const password = (pass || '').trim();
    if (isSupabaseConfigured && supabase) {
      const email = (id || '').trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        console.error('Supabase login failed', error?.message);
        return null;
      }
      const user = await getSupabaseUserData();
      if (user) set(KEYS.SESSION, user);
      return user;
    }

    const users = ensureUsers();
    const normalizedId = normalizeUserId(id);
    const user = users.find(
      u => normalizeUserId(u.id) === normalizedId && String(u.password || '').trim() === password
    );
    if (user) set(KEYS.SESSION, user);
    return user;
  },
  getCurrentUser: () => getCurrentSessionUser(),
  getUsers: () => {
    const users = get<User[]>(KEYS.USERS, []);
    if (users.length) return users;
    const current = getCurrentSessionUser();
    return current ? [current] : [];
  },
  saveUser: (u: User) => {
    const users = ensureUsers();
    const existing = users.find(x => normalizeUserId(x.id) === normalizeUserId(u.id));
    const allowedTabs = u.role === 'admin' ? [] : (u.allowedTabs?.length ? u.allowedTabs : DEFAULT_MEMBER_TABS);
    const mobileQuickTabs =
      u.mobileQuickTabs?.length
        ? u.mobileQuickTabs
        : (existing?.mobileQuickTabs?.length ? existing.mobileQuickTabs : allowedTabs.slice(0, 5));
    const cleanUser = {
      ...u,
      id: (u.id || '').trim(),
      password: u.password && String(u.password).trim().length > 0 ? String(u.password).trim() : existing?.password || '',
      allowedTabs,
      mobileQuickTabs
    };
    const idx = users.findIndex(x => normalizeUserId(x.id) === normalizeUserId(cleanUser.id));
    if (idx > -1) users[idx] = cleanUser; else users.push(cleanUser);
    set(KEYS.USERS, users);
  },
  deleteUser: (id: string) => {
    const normalizedId = normalizeUserId(id);
    const users = ensureUsers().filter(u => normalizeUserId(u.id) !== normalizedId);
    const hasAdmin = users.some(u => normalizeUserId(u.id) === 'admin');
    set(KEYS.USERS, hasAdmin ? users : [...users, DEFAULT_ADMIN]);
  },
  logout: () => {
    if (isSupabaseConfigured && supabase) {
      void supabase.auth.signOut();
    }
    remove(KEYS.SESSION);
  },
  
  // Dashboard
  getDashboardStats: () => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const dealers = get<Dealer[]>(KEYS.DEALERS, []);
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const isSameDay = (a: Date, b: Date) => 
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const monthlyOrders = orders.filter(o => {
      const d = new Date(o.date);
      return o.status === 'approved' && d.getFullYear() === year && d.getMonth() === month;
    });

    const monthlyQuantity = monthlyOrders.reduce(
      (sum, order) => sum + (order.items?.reduce((qty, item) => qty + Number(item.quantity || 0), 0) || 0),
      0
    );

    const chartData = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date(now);
      day.setDate(now.getDate() - (6 - idx));
      const sales = orders
        .filter(o => {
          const d = new Date(o.date);
          return o.status === 'approved' && isSameDay(d, day);
        })
        .reduce((sum, order) => sum + order.netTotal, 0);
      return {
        name: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales
      };
    });

    return {
      monthlySales: monthlyOrders.reduce((s, o) => s + o.netTotal, 0),
      monthlyQuantity,
      totalOfficers: officers.length,
      pendingApprovals: orders.filter(o => o.status === 'pending').length,
      totalQuotes: orders.filter(o => o.isQuote).length,
      remainingDueBalance: dealers.reduce((s, d) => s + (d.balance || 0), 0),
      chartData
    };
  },

  // Orders
  getOrders: () => get<Order[]>(KEYS.ORDERS, []),
  getOrder: (id: string) => get<Order[]>(KEYS.ORDERS, []).find(o => o.id === id),
  getNextOrderId: (isQuote: boolean) => {
    const config = getConfigSnapshot();
    return isQuote
      ? nextSeedSerial(KEYS.ORDER_QUOTE_COUNTER, config.quoteSerialSeed || 'Q00001', 'Q')
      : nextSeedSerial(KEYS.ORDER_INVOICE_COUNTER, config.orderSerialSeed || 'R00001', 'R');
  },
  adjustApprovedOrderStockAndBalance: (updatedOrder: Order, previousOrder: Order) => {
    const products = get<Product[]>(KEYS.PRODUCTS, []);
    const adjustMap = new Map<string, { oldQty: number; newQty: number; location: 'dhaka' | 'chittagong'; productId: string }>();

    const normalizeLocation = (item: OrderItem, inventorySource: Order['inventorySource']) => {
      return item.location || inventorySource || 'dhaka';
    };

    previousOrder.items.forEach(item => {
      const location = normalizeLocation(item, previousOrder.inventorySource);
      const key = `${item.productId}::${location}`;
      adjustMap.set(key, { oldQty: item.quantity, newQty: 0, location, productId: item.productId });
    });

    updatedOrder.items.forEach(item => {
      const location = normalizeLocation(item, updatedOrder.inventorySource);
      const key = `${item.productId}::${location}`;
      const existing = adjustMap.get(key);
      if (existing) {
        existing.newQty = item.quantity;
      } else {
        adjustMap.set(key, { oldQty: 0, newQty: item.quantity, location, productId: item.productId });
      }
    });

    adjustMap.forEach(({ oldQty, newQty, location, productId }) => {
      const product = products.find(x => x.id === productId);
      if (!product) return;
      const delta = newQty - oldQty;
      if (location === 'dhaka') product.dhaka -= delta;
      else product.chittagong -= delta;
    });

    set(KEYS.PRODUCTS, products);

    if (previousOrder.type === 'dealer' || updatedOrder.type === 'dealer') {
      const dealers = get<Dealer[]>(KEYS.DEALERS, []);
      const oldDealerId = previousOrder.dealerId;
      const newDealerId = updatedOrder.dealerId;
      if (oldDealerId) {
        const oldDealerIdx = dealers.findIndex(d => d.id === oldDealerId);
        if (oldDealerIdx > -1) {
          dealers[oldDealerIdx].balance -= previousOrder.netTotal;
        }
      }
      if (newDealerId) {
        const newDealerIdx = dealers.findIndex(d => d.id === newDealerId);
        if (newDealerIdx > -1) {
          dealers[newDealerIdx].balance += updatedOrder.netTotal;
        }
      }
      set(KEYS.DEALERS, dealers);
    }
  },
  placeOrder: async (o: Order) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const idx = orders.findIndex(x => x.id === o.id);
    const isNewOrder = idx === -1;
    const previousOrder = idx > -1 ? orders[idx] : null;
    const isQuoteConversion = previousOrder && previousOrder.isQuote && !o.isQuote;
    
    // Handle stock deduction and balance adjustment for ORDERS ONLY (not quotes)
    if (!o.isQuote) {
      if ((isNewOrder || isQuoteConversion) && o.status === 'approved') {
        // New order or converting quote to order: deduct stock if approved
        const products = get<Product[]>(KEYS.PRODUCTS, []);
        o.items.forEach(item => {
          const location = item.location || o.inventorySource || 'dhaka';
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (location === 'dhaka') product.dhaka = Math.max(0, (product.dhaka || 0) - item.quantity);
            else if (location === 'chittagong') product.chittagong = Math.max(0, (product.chittagong || 0) - item.quantity);
          }
        });
        await set(KEYS.PRODUCTS, products);
        
        // Update dealer balance for dealer orders
        if (o.type === 'dealer' && o.dealerId) {
          const dealers = get<Dealer[]>(KEYS.DEALERS, []);
          const dealerIdx = dealers.findIndex(d => d.id === o.dealerId);
          if (dealerIdx > -1) {
            dealers[dealerIdx].balance = (dealers[dealerIdx].balance || 0) + o.netTotal;
          }
          await set(KEYS.DEALERS, dealers);
        }
      } else if (!isNewOrder && previousOrder && previousOrder.status === 'approved' && !o.isQuote) {
        // Editing an approved order: adjust stock for changes
        const products = get<Product[]>(KEYS.PRODUCTS, []);
        
        // Restore old stock
        previousOrder.items.forEach(item => {
          const location = item.location || previousOrder.inventorySource || 'dhaka';
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (location === 'dhaka') product.dhaka = (product.dhaka || 0) + item.quantity;
            else if (location === 'chittagong') product.chittagong = (product.chittagong || 0) + item.quantity;
          }
        });
        
        // Deduct new stock
        o.items.forEach(item => {
          const location = item.location || o.inventorySource || 'dhaka';
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (location === 'dhaka') product.dhaka = Math.max(0, (product.dhaka || 0) - item.quantity);
            else if (location === 'chittagong') product.chittagong = Math.max(0, (product.chittagong || 0) - item.quantity);
          }
        });
        
        await set(KEYS.PRODUCTS, products);
        
        // Adjust dealer balance if changed
        if (previousOrder.type === 'dealer' || o.type === 'dealer') {
          const dealers = get<Dealer[]>(KEYS.DEALERS, []);
          if (previousOrder.dealerId) {
            const oldDealerIdx = dealers.findIndex(d => d.id === previousOrder.dealerId);
            if (oldDealerIdx > -1) {
              dealers[oldDealerIdx].balance -= previousOrder.netTotal;
            }
          }
          if (o.dealerId) {
            const newDealerIdx = dealers.findIndex(d => d.id === o.dealerId);
            if (newDealerIdx > -1) {
              dealers[newDealerIdx].balance += o.netTotal;
            }
          }
          await set(KEYS.DEALERS, dealers);
        }
      }
    }
    
    if (idx > -1) {
      orders[idx] = o;
    } else {
      orders.push(o);
    }
    
    // Generate payment reference for unpaid retail orders
    if (o.type === 'retail' && o.retailPaymentStatus === 'unpaid' && !o.paymentReference) {
      o.paymentReference = api.getNextPaymentReference();
      if (idx > -1) {
        orders[idx] = o;
      }
    }
    
    await set(KEYS.ORDERS, orders);
    const creator = getCurrentSessionUser();
    if (o.status === 'pending' && creator?.role === 'member') {
      const admins = ensureUsers().filter(u => u.role === 'admin' && u.notificationsEnabled);
      admins.forEach(admin => {
        api.addNotification({
          id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: admin.id,
          title: 'Order Pending Approval',
          message: `${o.id} placed by ${creator.name || creator.id} requires approval.`,
          type: 'approval',
          read: false,
          timestamp: new Date().toISOString()
        });
      });
    }

    // Update commission token if editing an approved dealer order
    if (!isNewOrder && o.status === 'approved' && o.type === 'dealer' && o.officer) {
      const officers = get<Officer[]>(KEYS.OFFICERS, []);
      const officerIdx = officers.findIndex(off => off.id === o.officer || off.name === o.officer);
      if (officerIdx > -1) {
        const commissionAmount = o.items.reduce((sum, item) => sum + (item.commission || 0), 0);
        const tokenIdx = officers[officerIdx].commissionTokens?.findIndex(t => t.orderId === o.id);
        if (tokenIdx !== undefined && tokenIdx > -1) {
          officers[officerIdx].commissionTokens![tokenIdx].amount = commissionAmount;
          await set(KEYS.OFFICERS, officers);
        }
      }
    }

    api.syncRetailSalesFromApprovedOrders();
  },
  deleteOrder: async (id: string) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const orderIdx = orders.findIndex(o => o.id === id);
    if (orderIdx > -1) {
      const order = orders[orderIdx];
      // Restore stock if it's an order (not a quote)
      if (!order.isQuote) {
        const products = get<Product[]>(KEYS.PRODUCTS, []);
        order.items.forEach(item => {
          const location = item.location || order.inventorySource || 'dhaka';
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (location === 'dhaka') product.dhaka = (product.dhaka || 0) + item.quantity;
            else if (location === 'chittagong') product.chittagong = (product.chittagong || 0) + item.quantity;
          }
        });
        await set(KEYS.PRODUCTS, products);
        // Restore dealer balance for dealer orders
        if (order.type === 'dealer' && order.dealerId) {
          const dealers = get<Dealer[]>(KEYS.DEALERS, []);
          const dealerIdx = dealers.findIndex(d => d.id === order.dealerId);
          if (dealerIdx > -1) {
            dealers[dealerIdx].balance = (dealers[dealerIdx].balance || 0) - order.netTotal;
          }
          await set(KEYS.DEALERS, dealers);
        }
      }
    }
    await set(KEYS.ORDERS, get<Order[]>(KEYS.ORDERS, []).filter(o => o.id !== id));
  },
  approveOrder: async (id: string, adminId: string) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === id);
    if (idx > -1) {
      if (orders[idx].status === 'approved') return;
      const wasPending = orders[idx].status === 'pending';
      orders[idx].status = 'approved';
      orders[idx].approvedBy = adminId;
      await set(KEYS.ORDERS, orders);
      const creator = ensureUsers().find(u => u.id === orders[idx].createdBy);
      if (creator && creator.role === 'member') {
        api.addNotification({
          id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: creator.id,
          title: 'Order Approved',
          message: `${orders[idx].id} has been approved by ${adminId}.`,
          type: 'approval',
          read: false,
          timestamp: new Date().toISOString()
        });
      }
      // Deduct stock for orders (not quotes) that were pending
      if (!orders[idx].isQuote && wasPending) {
        const products = get<Product[]>(KEYS.PRODUCTS, []);
        orders[idx].items.forEach(item => {
          const location = item.location || orders[idx].inventorySource || 'dhaka';
          const product = products.find(p => p.id === item.productId);
          if (product) {
            if (location === 'dhaka') product.dhaka = Math.max(0, (product.dhaka || 0) - item.quantity);
            else if (location === 'chittagong') product.chittagong = Math.max(0, (product.chittagong || 0) - item.quantity);
          }
        });
        await set(KEYS.PRODUCTS, products);
      }
      
      api.syncRetailSalesFromApprovedOrders();

      // Generate officer commission token only for approved dealer orders.
      if (orders[idx].officer && orders[idx].type === 'dealer') {
        const officers = get<Officer[]>(KEYS.OFFICERS, []);
        const officerIdx = officers.findIndex(
          o => o.id === orders[idx].officer || o.name === orders[idx].officer
        );
        if (officerIdx > -1) {
          // Use the commission values from the order items (which may have been edited by admin)
          const totalCommission = orders[idx].items.reduce((sum, item) => sum + (item.commission || 0), 0);
          officers[officerIdx].commissionBalance += totalCommission;
          const tokens = officers[officerIdx].commissionTokens || [];
          const tokenId = `CMT-${orders[idx].id}`;
          if (!tokens.some(t => t.id === tokenId)) {
            tokens.push({
              id: tokenId,
              orderId: orders[idx].id,
              date: orders[idx].date,
              amount: totalCommission,
              status: 'pending'
            });
          }
          officers[officerIdx].commissionTokens = tokens;
          set(KEYS.OFFICERS, officers);
        }
      }
    }
  },
  rejectOrder: (id: string) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === id);
    if (idx > -1) {
      orders[idx].status = 'rejected';
      set(KEYS.ORDERS, orders);
    }
  },

  // Targets
  getTargets: () => get<Target[]>(KEYS.TARGETS, []),
  saveTarget: (t: Target) => {
    const targets = get<Target[]>(KEYS.TARGETS, []);
    const idx = targets.findIndex(x => x.id === t.id);
    if (idx > -1) targets[idx] = { ...targets[idx], ...t };
    else targets.push({ ...t, rewardedDealerIds: t.rewardedDealerIds || [], rewardDisbursed: t.rewardDisbursed || {} });
    set(KEYS.TARGETS, targets);
  },
  deleteTarget: (id: string) => set(KEYS.TARGETS, get<Target[]>(KEYS.TARGETS, []).filter(t => t.id !== id)),
  syncTargetStatuses: () => {
    const today = getTodayISO();
    const targets = get<Target[]>(KEYS.TARGETS, []);
    let changed = false;
    const nextTargets = targets.map(t => {
      if (t.status === 'active' && t.endDate < today) {
        changed = true;
        return { ...t, status: 'expired' as const };
      }
      return t;
    });
    if (changed) set(KEYS.TARGETS, nextTargets);
    return nextTargets;
  },
  processTargetRewardsForDealer: (dealerId: string) => {
    // Kept for compatibility; rewards are disbursed manually from Targets UI.
    api.syncTargetStatuses();
  },
  getTargetRewards: () => get<TargetReward[]>(KEYS.TARGET_REWARDS, []),
  disburseTargetReward: (targetId: string, dealerId: string, targetNumber?: number, officerId?: string) => {
    const today = getTodayISO();
    const targets = api.syncTargetStatuses();
    const targetIdx = targets.findIndex(t => t.id === targetId);
    if (targetIdx === -1) return { success: false, message: 'Target not found' };
    const target = targets[targetIdx];

    const dealer = get<Dealer[]>(KEYS.DEALERS, []).find(d => d.id === dealerId);
    if (!dealer) return { success: false, message: 'Dealer not found' };
    if (target.status !== 'active') return { success: false, message: 'Target is not active' };

    const orders = get<Order[]>(KEYS.ORDERS, []);
    const matchingOrders = orders.filter(o =>
      o.status === 'approved' &&
      !o.isQuote &&
      o.dealerId === dealerId &&
      o.date >= target.startDate &&
      o.date <= target.endDate
    );
    const relevantItems = matchingOrders.flatMap(o =>
      o.items.filter(i => target.productIds.length === 0 || target.productIds.includes(i.productId))
    );
    const targetType = target.type || 'amount';
    const currentValue = targetType === 'amount'
      ? relevantItems.reduce((sum, i) => sum + i.total, 0)
      : relevantItems.reduce((sum, i) => sum + i.quantity, 0);

    const achievedCycles = Math.floor(currentValue / Math.max(1, target.targetValue));
    const alreadyDisbursed = (target.rewardDisbursed || {})[dealerId] || 0;
    const pendingCycles = achievedCycles - alreadyDisbursed;
    if (pendingCycles <= 0) return { success: false, message: 'No reward eligible yet' };

    const rewardPerCycle = Number(target.rewardValue || 0);
    const totalReward = rewardPerCycle * pendingCycles;
    if (totalReward <= 0) return { success: false, message: 'Reward amount is zero' };
    const rewardRef = nextTargetRewardRef();
    const paymentId = api.getNextPaymentId();
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const dealerOfficer = get<Dealer[]>(KEYS.DEALERS, []).find(d => d.id === dealerId)?.officerId;
    const selectedOfficerId = officerId || dealerOfficer;
    const selectedOfficer = selectedOfficerId ? officers.find(o => o.id === selectedOfficerId) : undefined;

    api.savePayment({
      id: paymentId,
      dealerId: dealer.id,
      dealerName: dealer.name,
      date: today,
      type: 'Adjustment',
      amount: totalReward,
      reference: rewardRef,
      notes: `Commission adjustment for target ${targetNumber || 1}`
    });

    const rewards = get<TargetReward[]>(KEYS.TARGET_REWARDS, []);
    rewards.push({
      id: `TGR-${Date.now()}`,
      rewardRef,
      targetId: target.id,
      targetName: target.name?.trim() || `Target-${targetNumber || 1}`,
      dealerId: dealer.id,
      dealerName: dealer.name,
      officerId: selectedOfficer?.id,
      officerName: selectedOfficer?.name,
      date: today,
      cycles: pendingCycles,
      amount: totalReward,
      paymentId,
      status: 'active'
    });
    set(KEYS.TARGET_REWARDS, rewards);

    targets[targetIdx] = {
      ...target,
      rewardDisbursed: {
        ...(target.rewardDisbursed || {}),
        [dealerId]: alreadyDisbursed + pendingCycles
      }
    };
    set(KEYS.TARGETS, targets);
    return { success: true, pendingCycles, rewardRef };
  },
  updateTargetReward: (rewardId: string, updates: Partial<Pick<TargetReward, 'officerId' | 'date' | 'amount' | 'note'>>) => {
    const rewards = get<TargetReward[]>(KEYS.TARGET_REWARDS, []);
    const idx = rewards.findIndex(r => r.id === rewardId);
    if (idx === -1) return { success: false, message: 'Reward not found' };
    const reward = rewards[idx];
    if (reward.status !== 'active') return { success: false, message: 'Reversed reward cannot be edited' };

    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const officer = updates.officerId ? officers.find(o => o.id === updates.officerId) : undefined;
    const nextReward: TargetReward = {
      ...reward,
      officerId: updates.officerId ?? reward.officerId,
      officerName: updates.officerId ? officer?.name : reward.officerName,
      date: updates.date || reward.date,
      amount: Number(updates.amount ?? reward.amount),
      note: updates.note ?? reward.note
    };
    rewards[idx] = nextReward;
    set(KEYS.TARGET_REWARDS, rewards);

    const payment = get<Payment[]>(KEYS.PAYMENTS, []).find(p => p.id === reward.paymentId);
    if (payment) {
      api.savePayment({
        ...payment,
        date: nextReward.date,
        amount: nextReward.amount,
        notes: nextReward.note || payment.notes,
        reference: reward.rewardRef
      });
    }
    return { success: true };
  },
  undoTargetReward: (rewardId: string) => {
    const rewards = get<TargetReward[]>(KEYS.TARGET_REWARDS, []);
    const idx = rewards.findIndex(r => r.id === rewardId);
    if (idx === -1) return { success: false, message: 'Reward not found' };
    const reward = rewards[idx];
    if (reward.status === 'reversed') return { success: false, message: 'Reward already reversed' };

    api.deletePayment(reward.paymentId);
    const targets = get<Target[]>(KEYS.TARGETS, []);
    const targetIdx = targets.findIndex(t => t.id === reward.targetId);
    if (targetIdx > -1) {
      const target = targets[targetIdx];
      const currentCycles = (target.rewardDisbursed || {})[reward.dealerId] || 0;
      targets[targetIdx] = {
        ...target,
        rewardDisbursed: {
          ...(target.rewardDisbursed || {}),
          [reward.dealerId]: Math.max(0, currentCycles - reward.cycles)
        }
      };
      set(KEYS.TARGETS, targets);
    }
    rewards[idx] = { ...reward, status: 'reversed' };
    set(KEYS.TARGET_REWARDS, rewards);
    return { success: true };
  },

  // Products & Categories
  getProducts: () => get<Product[]>(KEYS.PRODUCTS, []),
  saveProduct: (p: Product) => {
    const products = get<Product[]>(KEYS.PRODUCTS, []);
    const idx = products.findIndex(x => x.id === p.id);
    let savedProduct = p;
    if (idx > -1) {
      products[idx] = p;
    } else {
      savedProduct = { ...p, id: `PRD-${Date.now()}` };
      products.push(savedProduct);
    }
    set(KEYS.PRODUCTS, products);
    return savedProduct;
  },
  deleteProduct: (id: string) => set(KEYS.PRODUCTS, get<Product[]>(KEYS.PRODUCTS, []).filter(p => p.id !== id)),
  getProductStockEntries: () => get<ProductStockEntry[]>(KEYS.PRODUCT_STOCK_ENTRIES, []),
  saveProductStockEntry: (entry: ProductStockEntry, options?: { applyToInventory?: boolean }) => {
    const entries = get<ProductStockEntry[]>(KEYS.PRODUCT_STOCK_ENTRIES, []);
    entries.push({ ...entry, id: entry.id || `PSE-${Date.now()}` });
    set(KEYS.PRODUCT_STOCK_ENTRIES, entries);

    const shouldApplyToInventory = options?.applyToInventory ?? true;
    if (shouldApplyToInventory) {
      const products = get<Product[]>(KEYS.PRODUCTS, []);
      const idx = products.findIndex(p => p.id === entry.productId);
      if (idx > -1) {
        if (entry.location === 'dhaka') products[idx].dhaka += entry.quantity;
        else products[idx].chittagong += entry.quantity;
        set(KEYS.PRODUCTS, products);
      }
    }
  },
  saveProductStockEntries: (entries: ProductStockEntry[], options?: { applyToInventory?: boolean }) => {
    const generatedEntryId = entries[0]?.entryId || nextSerial(KEYS.PRODUCT_STOCK_ENTRY_COUNTER, 'EN');
    entries.forEach(entry => api.saveProductStockEntry({ ...entry, entryId: generatedEntryId }, options));
    return generatedEntryId;
  },
  getProductStockTransfers: () => get<ProductStockTransfer[]>(KEYS.PRODUCT_STOCK_TRANSFERS, []),
  saveProductStockTransfer: (transfer: ProductStockTransfer) => {
    const products = get<Product[]>(KEYS.PRODUCTS, []);
    const productIdx = products.findIndex(p => p.id === transfer.productId);
    if (productIdx === -1) return { success: false, message: 'Product not found' };
    if (transfer.from === transfer.to) return { success: false, message: 'From and To locations cannot be same' };

    const product = products[productIdx];
    const fromQty = transfer.from === 'dhaka' ? product.dhaka : product.chittagong;
    if (transfer.quantity <= 0) return { success: false, message: 'Transfer quantity must be greater than zero' };
    if (fromQty < transfer.quantity) return { success: false, message: 'Not enough stock to transfer' };

    if (transfer.from === 'dhaka') {
      product.dhaka -= transfer.quantity;
      product.chittagong += transfer.quantity;
    } else {
      product.chittagong -= transfer.quantity;
      product.dhaka += transfer.quantity;
    }
    set(KEYS.PRODUCTS, products);

    const transfers = get<ProductStockTransfer[]>(KEYS.PRODUCT_STOCK_TRANSFERS, []);
    transfers.push({
      ...transfer,
      id: transfer.id || `PST-${Date.now()}`,
      transferId: transfer.transferId || nextSerial(KEYS.PRODUCT_STOCK_TRANSFER_COUNTER, 'TR')
    });
    set(KEYS.PRODUCT_STOCK_TRANSFERS, transfers);
    return { success: true };
  },
  
  getCategories: () => get<Category[]>(KEYS.CATEGORIES, []),
  saveCategory: (c: Category) => {
    const cats = get<Category[]>(KEYS.CATEGORIES, []);
    const idx = cats.findIndex(x => x.id === c.id);
    if (idx > -1) cats[idx] = c; else cats.push(c);
    set(KEYS.CATEGORIES, cats);
  },
  deleteCategory: (id: string) => set(KEYS.CATEGORIES, get<Category[]>(KEYS.CATEGORIES, []).filter(c => c.id !== id)),

  // Dealers & Officers
  getDealers: () => {
    const dealers = get<Dealer[]>(KEYS.DEALERS, []);
    const currentUser = getCurrentSessionUser();
    if (!currentUser || currentUser.role === 'admin') return dealers;
    return dealers.filter(d =>
      (currentUser.officerId && d.officerId === currentUser.officerId) ||
      d.officerName === currentUser.name
    );
  },
  saveDealer: (d: Dealer) => {
    const dealers = get<Dealer[]>(KEYS.DEALERS, []);
    const idx = dealers.findIndex(x => x.id === d.id);
    if (idx > -1) dealers[idx] = d; else dealers.push({ ...d, id: `DLR-${Date.now()}` });
    set(KEYS.DEALERS, dealers);
  },
  deleteDealer: (id: string) => set(KEYS.DEALERS, get<Dealer[]>(KEYS.DEALERS, []).filter(d => d.id !== id)),
  
  getOfficers: () => get<Officer[]>(KEYS.OFFICERS, []),
  saveOfficer: (o: Officer) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const idx = officers.findIndex(x => x.id === o.id);
    if (idx > -1) officers[idx] = o; else officers.push(o);
    set(KEYS.OFFICERS, officers);
  },
  deleteOfficer: (id: string) => set(KEYS.OFFICERS, get<Officer[]>(KEYS.OFFICERS, []).filter(o => o.id !== id)),
  updateClearance: (officerId: string, clearance: CommissionClearance) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const idx = officers.findIndex(o => o.id === officerId);
    if (idx > -1) {
      const cIdx = officers[idx].clearanceHistory.findIndex(c => c.id === clearance.id);
      if (cIdx > -1) {
        const oldAmount = officers[idx].clearanceHistory[cIdx].amount;
        officers[idx].clearanceHistory[cIdx] = clearance;
        officers[idx].commissionBalance += (oldAmount - clearance.amount);
        set(KEYS.OFFICERS, officers);
      }
    }
  },
  deleteClearance: (officerId: string, clearanceId: string) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const idx = officers.findIndex(o => o.id === officerId);
    if (idx > -1) {
      const clearance = officers[idx].clearanceHistory.find(c => c.id === clearanceId);
      if (clearance) {
        officers[idx].commissionBalance += clearance.amount;
        officers[idx].clearanceHistory = officers[idx].clearanceHistory.filter(c => c.id !== clearanceId);
        set(KEYS.OFFICERS, officers);
      }
    }
  },
  disburseCommissionToken: (officerId: string, tokenId: string, note?: string) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const idx = officers.findIndex(o => o.id === officerId);
    if (idx === -1) return { success: false, message: 'Officer not found' };
    const tokens = officers[idx].commissionTokens || [];
    const tokenIdx = tokens.findIndex(t => t.id === tokenId);
    if (tokenIdx === -1) return { success: false, message: 'Token not found' };
    if (tokens[tokenIdx].status === 'disbursed') return { success: false, message: 'Token already disbursed' };

    tokens[tokenIdx] = { ...tokens[tokenIdx], status: 'disbursed', disbursedDate: getTodayISO() };
    officers[idx].commissionTokens = tokens;
    officers[idx].commissionBalance = Math.max(0, (officers[idx].commissionBalance || 0) - tokens[tokenIdx].amount);
    officers[idx].clearanceHistory = [
      ...(officers[idx].clearanceHistory || []),
      {
        id: `CLR-TOKEN-${Date.now()}`,
        date: getTodayISO(),
        amount: tokens[tokenIdx].amount,
        note: note || `Token disbursed: ${tokenId}`
      }
    ];
    set(KEYS.OFFICERS, officers);
    return { success: true };
  },
  undoCommissionTokenDisbursement: (officerId: string, tokenId: string) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const idx = officers.findIndex(o => o.id === officerId);
    if (idx === -1) return { success: false, message: 'Officer not found' };
    const tokens = officers[idx].commissionTokens || [];
    const tokenIdx = tokens.findIndex(t => t.id === tokenId);
    if (tokenIdx === -1) return { success: false, message: 'Token not found' };
    const token = tokens[tokenIdx];
    if (token.status !== 'disbursed') return { success: false, message: 'Token is not disbursed yet' };

    tokens[tokenIdx] = { ...token, status: 'pending' };
    officers[idx].commissionTokens = tokens;
    officers[idx].commissionBalance = (officers[idx].commissionBalance || 0) + token.amount;
    officers[idx].clearanceHistory = (officers[idx].clearanceHistory || []).filter(
      c => !(c.note || '').includes(tokenId)
    );
    set(KEYS.OFFICERS, officers);
    return { success: true };
  },
  getCommissionTokens: () => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    return officers.flatMap(officer =>
      (officer.commissionTokens || []).map(token => ({
        ...token,
        officerId: officer.id,
        officerName: officer.name
      }))
    );
  },
  updateCommissionToken: (officerId: string, tokenId: string, updates: Partial<{ amount: number; status: 'pending' | 'disbursed'; note: string }>) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const oIdx = officers.findIndex(o => o.id === officerId);
    if (oIdx === -1) return { success: false, message: 'Officer not found' };
    const tokens = officers[oIdx].commissionTokens || [];
    const tIdx = tokens.findIndex(t => t.id === tokenId);
    if (tIdx === -1) return { success: false, message: 'Token not found' };
    const oldToken = tokens[tIdx];
    const nextAmount = updates.amount ?? oldToken.amount;
    tokens[tIdx] = { ...oldToken, amount: nextAmount, status: updates.status ?? oldToken.status };
    if (oldToken.status === 'pending' && tokens[tIdx].status === 'pending') {
      officers[oIdx].commissionBalance += (nextAmount - oldToken.amount);
    }
    officers[oIdx].commissionTokens = tokens;
    set(KEYS.OFFICERS, officers);
    return { success: true };
  },
  deleteCommissionToken: (officerId: string, tokenId: string) => {
    const officers = get<Officer[]>(KEYS.OFFICERS, []);
    const oIdx = officers.findIndex(o => o.id === officerId);
    if (oIdx === -1) return { success: false, message: 'Officer not found' };
    const tokens = officers[oIdx].commissionTokens || [];
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return { success: false, message: 'Token not found' };
    officers[oIdx].commissionTokens = tokens.filter(t => t.id !== tokenId);
    if (token.status === 'pending') {
      officers[oIdx].commissionBalance = Math.max(0, officers[oIdx].commissionBalance - token.amount);
    }
    set(KEYS.OFFICERS, officers);
    return { success: true };
  },

  // Payments
  getPayments: () => get<Payment[]>(KEYS.PAYMENTS, []),
  getNextPaymentId: () => `PAY-${Date.now()}`,
  getNextPaymentReference: () => {
    const config = getConfigSnapshot();
    return nextSeedSerial(
      KEYS.PAYMENT_REFERENCE_COUNTER,
      config.paymentReferenceSeed || 'P00001',
      'P'
    );
  },
  savePayment: (p: Payment) => {
    const getBalanceDelta = (payment: Payment) => payment.type === 'Last balance Due' ? payment.amount : -payment.amount;
    
    const payments = get<Payment[]>(KEYS.PAYMENTS, []);
    const idx = payments.findIndex(x => x.id === p.id);
    if (idx > -1) {
      const old = payments[idx];
      const dealers = get<Dealer[]>(KEYS.DEALERS, []);
      const oldDIdx = dealers.findIndex(d => d.id === old.dealerId);
      if (oldDIdx > -1) dealers[oldDIdx].balance -= getBalanceDelta(old);
      payments[idx] = p;
      const newDIdx = dealers.findIndex(d => d.id === p.dealerId);
      if (newDIdx > -1) dealers[newDIdx].balance += getBalanceDelta(p);
      set(KEYS.DEALERS, dealers);
    } else {
      payments.push(p);
      const dealers = get<Dealer[]>(KEYS.DEALERS, []);
      const dIdx = dealers.findIndex(d => d.id === p.dealerId);
      if (dIdx > -1) dealers[dIdx].balance += getBalanceDelta(p);
      set(KEYS.DEALERS, dealers);
    }
    set(KEYS.PAYMENTS, payments);
  },
  deletePayment: (id: string) => {
    const payments = get<Payment[]>(KEYS.PAYMENTS, []);
    const p = payments.find(x => x.id === id);
    if (p) {
      const getBalanceDelta = (payment: Payment) => payment.type === 'Last balance Due' ? payment.amount : -payment.amount;
      const dealers = get<Dealer[]>(KEYS.DEALERS, []);
      const dIdx = dealers.findIndex(d => d.id === p.dealerId);
      if (dIdx > -1) dealers[dIdx].balance -= getBalanceDelta(p);
      set(KEYS.DEALERS, dealers);
      set(KEYS.PAYMENTS, payments.filter(x => x.id !== id));
    }
  },

  // Retail
  getRetailTransactions: () => get<RetailTransaction[]>(KEYS.RETAIL, []),
  syncRetailSalesFromApprovedOrders: () => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const txs = get<RetailTransaction[]>(KEYS.RETAIL, []);
    const manualTxs = txs.filter(t => !t.id.startsWith('RTX-ORD-'));
    const generated: RetailTransaction[] = [];
    let changed = false;
    orders
      .filter(o => o.status === 'approved' && !o.isQuote && o.type === 'retail')
      .forEach(order => {
          const orderPaymentStatus = order.retailPaymentStatus || 'paid';
        const amount = orderPaymentStatus === 'unpaid'
          ? order.netTotal
          : orderPaymentStatus === 'partial'
            ? (order.partialAmount || 0)
            : order.netTotal;
        const txId = `RTX-ORD-${order.id}`;
        const noteText = order.notes ? ` | Note: ${order.notes}` : '';
        generated.push({
          id: txId,
          orderId: order.id,
          date: order.retailPaymentDate || order.date,
          detail: `Retail Sale ${order.id}: ${order.customerName}${noteText}`,
          amount: amount,
          paymentStatus: orderPaymentStatus,
          paidAmount: orderPaymentStatus === 'partial' ? (order.partialAmount || 0) : orderPaymentStatus === 'paid' ? order.netTotal : 0,
          location: order.inventorySource === 'mixed' ? 'dhaka' : order.inventorySource, // assuming mixed defaults to dhaka
          type: 'sale'
        });
      });
    const nextTxs = [...manualTxs, ...generated];
    if (JSON.stringify(nextTxs) !== JSON.stringify(txs)) {
      set(KEYS.RETAIL, nextTxs);
      changed = true;
    }
    return changed ? nextTxs : txs;
  },
  saveRetailTransaction: (t: RetailTransaction) => {
    const txs = get<RetailTransaction[]>(KEYS.RETAIL, []);
    txs.push(t);
    set(KEYS.RETAIL, txs);
  },
  setRetailOrderPaymentStatus: (orderId: string, paymentStatus: 'paid' | 'unpaid' | 'partial', partialAmount?: number) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, message: 'Order not found' };
    const order = orders[idx];
    const today = new Date().toISOString().split('T')[0];
    const updatedPartialAmount = paymentStatus === 'partial'
      ? partialAmount
      : paymentStatus === 'paid'
        ? order.netTotal
        : undefined;
    orders[idx] = {
      ...order,
      retailPaymentStatus: paymentStatus,
      partialAmount: updatedPartialAmount,
      retailPaymentDate: paymentStatus === 'unpaid' ? order.retailPaymentDate : today
    };
    set(KEYS.ORDERS, orders);
    api.syncRetailSalesFromApprovedOrders();
    return { success: true };
  },
  reorderProducts: (orderedIds: string[]) => {
    const current = get<Product[]>(KEYS.PRODUCTS, []);
    const byId = new Map(current.map(p => [p.id, p]));
    const reordered: Product[] = [];
    orderedIds.forEach(id => {
      const p = byId.get(id);
      if (p) reordered.push(p);
    });
    current.forEach(p => {
      if (!orderedIds.includes(p.id)) reordered.push(p);
    });
    set(KEYS.PRODUCTS, reordered);
  },
  deleteRetailTransaction: (id: string) => set(KEYS.RETAIL, get<RetailTransaction[]>(KEYS.RETAIL, []).filter(t => t.id !== id)),

  // Send Amounts (Stock Balance)
  getSendAmounts: () => get<RetailTransaction[]>(KEYS.RETAIL, []).filter(t => t.type === 'sent_to_main').map(t => ({
    id: t.id,
    date: t.date,
    location: t.location,
    amount: Math.abs(t.amount),
    note: t.detail.replace('Sent to Main: ', '')
  })),
  saveSendAmount: (entry: SendAmountEntry) => {
    const txs = get<RetailTransaction[]>(KEYS.RETAIL, []);
    txs.push({
      id: entry.id || `TX-${Date.now()}`,
      date: entry.date,
      location: entry.location,
      amount: entry.amount,
      type: 'sent_to_main',
      detail: `Sent to Main: ${entry.note}`
    });
    set(KEYS.RETAIL, txs);
  },

  // Serials
  getAllSerials: () => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    const serials = new Set<string>();
    orders.forEach(o => o.items.forEach(i => i.serialNumbers?.forEach(s => serials.add(s))));
    return Array.from(serials);
  },
  searchBySerial: (serial: string) => {
    const orders = get<Order[]>(KEYS.ORDERS, []);
    for (const order of orders) {
      for (const item of order.items) {
        if (item.serialNumbers?.some(s => s.toLowerCase() === serial.toLowerCase())) {
          return { order, item };
        }
      }
    }
    return null;
  },

  // Notifications
  getNotifications: (userId: string) => get<Notification[]>(KEYS.NOTIFICATIONS, []).filter(n => n.userId === userId),
  markNotificationsRead: (userId: string) => {
    const ns = get<Notification[]>(KEYS.NOTIFICATIONS, []);
    const updated = ns.map(n => n.userId === userId ? { ...n, read: true } : n);
    set(KEYS.NOTIFICATIONS, updated);
  },
  addNotification: (n: Notification) => {
    const ns = get<Notification[]>(KEYS.NOTIFICATIONS, []);
    ns.push(n);
    set(KEYS.NOTIFICATIONS, ns);
  },

  // Config
  getConfig: () => get<Customization>(KEYS.CONFIG, {
    title: 'Smart ERP System',
    logo: '',
    sidebarColor: '#0f172a',
    mainColor: '#3b82f6',
    initialRetailAmount: 5000,
    initialRetailAmountDhaka: 5000,
    initialRetailAmountChittagong: 5000,
    regards: 'Best Regards,',
    execName: '',
    execDetails: '',
    customDetailText: '',
    customDetailHtml: '',
    customDetailBold: false,
    customDetailItalic: false,
    customDetailBoxed: true,
    orderSerialSeed: 'R00001',
    quoteSerialSeed: 'Q00001',
    paymentReferenceSeed: 'P00001'
  }),
  saveConfig: (c: Customization) => set(KEYS.CONFIG, c),
  getCustomization: () => api.getConfig(),
  saveCustomization: (c: Customization) => api.saveConfig(c),
  exportAllData: () => {
    const payload: Record<string, unknown> = {};
    SYNCED_KEYS.forEach((key) => {
      payload[key] = get<unknown>(key, null);
    });
    return {
      exportedAt: new Date().toISOString(),
      app: 'bicycle-inventory',
      data: payload
    };
  },
  importAllData: (payload: any) => {
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
      return { success: false, message: 'Invalid backup file format' };
    }
    SYNCED_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(payload.data, key)) {
        set(key, (payload.data as Record<string, unknown>)[key]);
      }
    });
    return { success: true };
  },
  
  // System
  clearAllData: () => {
    SYNCED_KEYS.forEach((k) => remove(k));
    window.location.reload();
  }
};