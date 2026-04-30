"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Category, ProductStockEntry, ProductStockTransfer, Slab } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showError, showSuccess } from '@/utils/toast';
import { Plus, Trash2, Edit, Tags, Search, Warehouse, History, ArrowRightLeft, Eye, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { useIsMobile } from '@/hooks/use-mobile';

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockEntries, setStockEntries] = useState<ProductStockEntry[]>([]);
  const [stockTransfers, setStockTransfers] = useState<ProductStockTransfer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showStockEntryDialog, setShowStockEntryDialog] = useState(false);
  const [stockEntryDate, setStockEntryDate] = useState(getTodayISO());
  const [stockEntryLocation, setStockEntryLocation] = useState<'dhaka' | 'chittagong'>('chittagong');
  const [stockEntryItems, setStockEntryItems] = useState<Array<{
    productId: string;
    quantity: number | string;
  }>>([{ productId: '', quantity: '' }]);
  const [stockEntryNote, setStockEntryNote] = useState('');
  const [showStockTransferDialog, setShowStockTransferDialog] = useState(false);
  const [stockTransferForm, setStockTransferForm] = useState<{
    productId: string;
    from: 'dhaka' | 'chittagong';
    to: 'dhaka' | 'chittagong';
    quantity: number | string;
    date: string;
    note: string;
  }>({
    productId: '',
    from: 'chittagong',
    to: 'dhaka',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });
  const [activeView, setActiveView] = useState<'products' | 'history'>('products');
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [historyDetail, setHistoryDetail] = useState<{
    type: 'entry' | 'transfer';
    title: string;
    rows: Array<{ label: string; value: string }>;
  } | null>(null);
  const [editingStockEntryGroup, setEditingStockEntryGroup] = useState<ProductStockEntry[] | null>(null);
  const [editingStockTransfer, setEditingStockTransfer] = useState<ProductStockTransfer | null>(null);
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'tile' | 'list'>('tile');

  useEffect(() => {
    const loadData = async () => {
      setProducts(await api.getProducts());
      setCategories(await api.getCategories());
      setStockEntries(await api.getProductStockEntries());
      setStockTransfers(await api.getProductStockTransfers());
    };
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.version.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleSaveProduct = async () => {
    if (editingProduct && editingProduct.name) {
      const isNewProduct = !editingProduct.id;
      const initialDhaka = Number(editingProduct.dhaka || 0);
      const initialCtg = Number(editingProduct.chittagong || 0);
      let savedProduct: Product | null = null;

      if (isNewProduct) {
        savedProduct = await api.saveProduct(editingProduct as Product);
        if (!savedProduct) {
          showError("Failed to save product");
          return;
        }
      } else {
        const updated = await api.updateProduct(editingProduct.id, editingProduct as Product);
        if (!updated) {
          showError("Failed to update product");
          return;
        }
        savedProduct = editingProduct as Product;
      }

      setProducts(await api.getProducts());
      setStockEntries(await api.getProductStockEntries());
      setEditingProduct(null);
      showSuccess(isNewProduct ? "Product created" : "Product updated");
    }
  };

  const handleSaveCategory = async () => {
    if (!newCategoryName) return;
    const categoryToSave = editingCategory ? { id: editingCategory.id, name: newCategoryName } : { name: newCategoryName };
    const saved = await api.saveCategory(categoryToSave);
    if (!saved) {
      showError("Failed to save category");
      return;
    }
    setCategories(await api.getCategories());
    setNewCategoryName('');
    setEditingCategory(null);
    showSuccess("Category saved");
  };

  const addSlabRow = () => {
    if (!editingProduct) return;
    const slabs = editingProduct.slabs || [];
    setEditingProduct({
      ...editingProduct,
      slabs: [...slabs, { min: 1, max: 1, price: 0 }]
    });
  };

  const updateSlab = (index: number, field: keyof Slab, value: number) => {
    if (!editingProduct) return;
    const slabs = [...(editingProduct.slabs || [])];
    slabs[index] = { ...slabs[index], [field]: value };
    setEditingProduct({ ...editingProduct, slabs });
  };

  const removeSlab = (index: number) => {
    if (!editingProduct) return;
    const slabs = (editingProduct.slabs || []).filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, slabs });
  };

  const handleSaveStockEntry = async () => {
    const validItems = stockEntryItems.filter(i => i.productId && Number(i.quantity) > 0);
    if (validItems.length === 0) return;

    const payload: ProductStockEntry[] = validItems.map((item) => {
      const product = products.find(p => p.id === item.productId);
      return {
        id: '',
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        date: stockEntryDate,
        location: stockEntryLocation,
        quantity: Number(item.quantity),
        note: stockEntryNote
      };
    });

    await api.saveProductStockEntries(payload);
    setProducts(await api.getProducts());
    setStockEntries(await api.getProductStockEntries());
    setStockEntryItems([{ productId: '', quantity: '' }]);
    setStockEntryNote('');
    setStockEntryDate(getTodayISO());
    setStockEntryLocation('chittagong');
    setShowStockEntryDialog(false);
    showSuccess("Stock entry saved");
  };

  const addStockEntryRow = () => setStockEntryItems([
    ...stockEntryItems,
    { productId: '', quantity: '' }
  ]);

  const updateStockEntryRow = (index: number, field: 'productId' | 'quantity', value: string) => {
    const rows = [...stockEntryItems];
    rows[index] = { ...rows[index], [field]: field === 'quantity' ? value : value };
    setStockEntryItems(rows);
  };

  const removeStockEntryRow = (index: number) => {
    setStockEntryItems(stockEntryItems.filter((_, i) => i !== index));
  };

  const getProductSlabText = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || !product.slabs?.length) return 'No slabs';
    return product.slabs.map(s => `${s.min}-${s.max}: ৳${s.price}`).join(' | ');
  };

  const getAvailableQty = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    return stockEntryLocation === 'dhaka' ? product.dhaka : product.chittagong;
  };
  const getAvailableQtyByLocation = (productId: string, location: 'dhaka' | 'chittagong') => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;
    return location === 'dhaka' ? product.dhaka : product.chittagong;
  };

  const getSelectableProductsForRow = (rowIndex: number) => {
    const takenIds = new Set(
      stockEntryItems
        .filter((item, index) => index !== rowIndex)
        .map(item => item.productId)
        .filter(Boolean)
    );
    return products.filter(product => !takenIds.has(product.id));
  };

  const canDragProducts = selectedCategory === 'all' && searchTerm.trim() === '';
  const handleProductDrop = async (targetId: string) => {
    if (!draggedProductId || draggedProductId === targetId || !canDragProducts) return;
    const current = [...products];
    const from = current.findIndex(p => p.id === draggedProductId);
    const to = current.findIndex(p => p.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = current.splice(from, 1);
    current.splice(to, 0, moved);
    setProducts(current);
    await api.reorderProducts(current.map(p => p.id));
    setDraggedProductId(null);
  };

  const groupedEntryHistory = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      entryId: string;
      date: string;
      location: string;
      note: string;
      totalQty: number;
      itemCount: number;
      products: string[];
    }>();

    stockEntries.forEach((entry) => {
      const key = entry.entryId || entry.batchId || entry.id;
      const current = groups.get(key);
      const locationLabel = entry.location === 'dhaka' ? 'Dhaka' : 'CTG';
      if (!current) {
        groups.set(key, {
          id: key,
          entryId: entry.entryId || key,
          date: entry.date,
          location: locationLabel,
          note: entry.note || '-',
          totalQty: entry.quantity,
          itemCount: 1,
          products: [`${entry.productName} (${entry.quantity})`]
        });
        return;
      }
      current.totalQty += entry.quantity;
      current.itemCount += 1;
      current.products.push(`${entry.productName} (${entry.quantity})`);
      if (current.location !== locationLabel) current.location = 'Mixed';
    });

    return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [stockEntries]);

  const handleSaveStockTransfer = async () => {
    if (!stockTransferForm.productId || !stockTransferForm.quantity) return;
    if (stockTransferForm.from === stockTransferForm.to) {
      showError('Source and destination must be different');
      return;
    }
    const product = products.find(p => p.id === stockTransferForm.productId);
    if (!product) return;

    const result = await api.saveProductStockTransfer({
      id: '',
      date: stockTransferForm.date,
      productId: stockTransferForm.productId,
      productName: product.name,
      from: stockTransferForm.from,
      to: stockTransferForm.to,
      quantity: Number(stockTransferForm.quantity),
      note: stockTransferForm.note
    });

    if (!result || !result.success) {
      showError(result?.message || 'Could not transfer stock');
      return;
    }

    setProducts(await api.getProducts());
    setStockTransfers(await api.getProductStockTransfers());
    setShowStockTransferDialog(false);
    setStockTransferForm({
      productId: '',
      from: 'chittagong',
      to: 'dhaka',
      quantity: '',
      date: getTodayISO(),
      note: ''
    });
    showSuccess('Stock transferred');
  };

  const openEntryDetail = (entryGroupId: string) => {
    const details = stockEntries.filter(e => (e.batchId || e.id) === entryGroupId);
    if (!details.length) return;
    setHistoryDetail({
      type: 'entry',
      title: `Stock Entry ${details[0].entryId || details[0].batchId || details[0].id}`,
      rows: details.map((d, idx) => ({
        label: `${idx + 1}. ${d.productName}`,
        value: `${d.location.toUpperCase()} | Qty: ${d.quantity} | Date: ${formatDisplayDate(d.date)} | ${d.note || '-'}`
      }))
    });
    setHistoryDetailOpen(true);
  };

  const deleteEntryGroup = async (entryGroupId: string) => {
    if (!confirm('Delete this stock entry group?')) return;
    const entriesToDelete = stockEntries.filter(e => (e.entryId || e.batchId || e.id) === entryGroupId);
    for (const entry of entriesToDelete) {
      const success = await api.deleteProductStockEntry(entry.id);
      if (!success) {
        showError('Failed to delete stock entry');
        return;
      }
    }
    setProducts(await api.getProducts());
    setStockEntries(await api.getProductStockEntries());
    showSuccess('Stock entry deleted');
  };

  const openTransferDetail = (transfer: ProductStockTransfer) => {
    setHistoryDetail({
      type: 'transfer',
      title: `Transfer ${transfer.transferId || transfer.id}`,
      rows: [
        { label: 'Product', value: transfer.productName },
        { label: 'Date', value: formatDisplayDate(transfer.date) },
        { label: 'From -> To', value: `${transfer.from.toUpperCase()} -> ${transfer.to.toUpperCase()}` },
        { label: 'Quantity', value: String(transfer.quantity) },
        { label: 'Note', value: transfer.note || '-' }
      ]
    });
    setHistoryDetailOpen(true);
  };

  const deleteTransfer = async (transferId: string) => {
    if (!confirm('Delete this stock transfer?')) return;
    const success = await api.deleteProductStockTransfer(transferId);
    if (!success) {
      showError('Failed to delete stock transfer');
      return;
    }
    setProducts(await api.getProducts());
    setStockTransfers(await api.getProductStockTransfers());
    showSuccess('Stock transfer deleted');
  };

  const editEntryGroup = (entryGroupId: string) => {
    const groupEntries = stockEntries.filter(e => (e.batchId || e.id) === entryGroupId);
    if (!groupEntries.length) return;
    setEditingStockEntryGroup(groupEntries.map(entry => ({ ...entry })));
  };

  const updateEditingStockEntry = (index: number, field: keyof ProductStockEntry, value: string | number) => {
    if (!editingStockEntryGroup) return;
    const updated = [...editingStockEntryGroup];
    updated[index] = { ...updated[index], [field]: value } as ProductStockEntry;
    setEditingStockEntryGroup(updated);
  };

  const saveEditedStockEntryGroup = async () => {
    if (!editingStockEntryGroup) return;
    for (const entry of editingStockEntryGroup) {
      const success = await api.updateProductStockEntry(entry.id, entry);
      if (!success) {
        showError('Failed to update stock entry');
        return;
      }
    }
    setProducts(await api.getProducts());
    setStockEntries(await api.getProductStockEntries());
    setEditingStockEntryGroup(null);
    showSuccess('Stock entry updated');
  };

  const editTransfer = (transfer: ProductStockTransfer) => {
    setEditingStockTransfer({ ...transfer });
  };

  const updateEditingStockTransfer = (field: keyof ProductStockTransfer, value: string | number) => {
    if (!editingStockTransfer) return;
    setEditingStockTransfer({ ...editingStockTransfer, [field]: value } as ProductStockTransfer);
  };

  const saveEditedStockTransfer = async () => {
    if (!editingStockTransfer) return;
    const success = await api.updateProductStockTransfer(editingStockTransfer.id, editingStockTransfer);
    if (!success) {
      showError('Failed to update stock transfer');
      return;
    }
    setProducts(await api.getProducts());
    setStockTransfers(await api.getProductStockTransfers());
    setEditingStockTransfer(null);
    showSuccess('Stock transfer updated');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
            <h1 className="text-2xl font-bold text-slate-800">Product Inventory</h1>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search..." className="pl-10 h-11 w-full" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-40 h-11"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setShowCategoryManager(true)} className="h-11 w-full sm:w-auto"><Tags className="w-4 h-4 mr-2" /> Categories</Button>
              <Button variant="outline" onClick={() => setShowStockEntryDialog(true)} className="h-11 w-full sm:w-auto"><Warehouse className="w-4 h-4 mr-2" /> Stock Entry</Button>
              <Button variant="outline" onClick={() => setShowStockTransferDialog(true)} className="h-11 w-full sm:w-auto"><ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer</Button>
              <Button onClick={() => setEditingProduct({ name: '', version: '', categoryId: '', retailPrice: 0, commission: 0, status: 'active', dhaka: 0, chittagong: 0, slabs: [] })} className="h-11 w-full sm:w-auto bg-slate-900"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
            </div>
          </div>
          {isMobile && activeView === 'products' && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button type="button" variant={viewMode === 'tile' ? 'default' : 'outline'} className="min-w-[100px] h-10" onClick={() => setViewMode('tile')}>
                <LayoutGrid className="w-4 h-4 mr-2" /> Tile
              </Button>
              <Button type="button" variant={viewMode === 'list' ? 'default' : 'outline'} className="min-w-[100px] h-10" onClick={() => setViewMode('list')}>
                <List className="w-4 h-4 mr-2" /> List
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                {isMobile && viewMode === 'tile' ? (
                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-3">
                      {filteredProducts.map((p) => (
                        <Card key={p.id} className="border border-slate-200">
                          <CardContent className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-slate-900">{p.name}</div>
                                <div className="text-[11px] text-slate-500 uppercase">{p.version}</div>
                                <Badge variant="outline" className="mt-2 text-[10px] font-bold uppercase">
                                  {categories.find(c => c.id === p.categoryId)?.name || 'Uncategorized'}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold">৳{p.retailPrice}</div>
                                <div className="text-[12px] text-slate-500">Comm: ৳{p.commission || 0}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[13px]">
                              <div className="rounded-lg bg-slate-50 p-2">
                                <div className="text-[10px] uppercase text-slate-500">Dhaka</div>
                                <div className="font-semibold text-blue-600">{p.dhaka}</div>
                              </div>
                              <div className="rounded-lg bg-slate-50 p-2">
                                <div className="text-[10px] uppercase text-slate-500">CTG</div>
                                <div className="font-semibold text-orange-600">{p.chittagong}</div>
                              </div>
                            </div>
                            <div className="text-xs text-slate-500 truncate" title={getProductSlabText(p.id)}>
                              Slabs: {getProductSlabText(p.id)}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => setEditingProduct(p)}><Edit className="w-4 h-4 mr-1" />Edit</Button>
                              <Button variant="destructive" size="sm" className="flex-1 h-10" onClick={async () => { if (confirm('Delete?')) { const success = await api.deleteProduct(p.id); if (success) { setProducts(await api.getProducts()); showSuccess('Product deleted'); } else { showError('Failed to delete product'); } } }}>Delete</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[62vh] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/30">
                          <TableHead className="w-8 text-xs font-bold uppercase"></TableHead>
                          <TableHead className="text-xs font-bold uppercase">Product Details</TableHead>
                          <TableHead className="text-xs font-bold uppercase">Category</TableHead>
                          <TableHead className="text-xs font-bold uppercase">Retail / Dealer</TableHead>
                          <TableHead className="text-xs font-bold uppercase">Stock (D/C)</TableHead>
                          <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((p) => (
                          <TableRow
                            key={p.id}
                            className="hover:bg-slate-50/50 transition-colors"
                            draggable={canDragProducts}
                            onDragStart={() => setDraggedProductId(p.id)}
                            onDragOver={(e) => canDragProducts && e.preventDefault()}
                            onDrop={() => handleProductDrop(p.id)}
                          >
                            <TableCell className="text-slate-400">
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </TableCell>
                            <TableCell>
                              <div className="font-bold text-slate-900">{p.name}</div>
                              <div className="text-[10px] text-slate-400 uppercase">{p.version}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                {categories.find(c => c.id === p.categoryId)?.name || 'Uncategorized'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div>Retail: ৳{p.retailPrice}</div>
                              <div>Commission/Unit: ৳{p.commission || 0}</div>
                              <div className="text-slate-500 truncate max-w-[280px]" title={getProductSlabText(p.id)}>
                                Slabs: {getProductSlabText(p.id)}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <span className="text-blue-600">{p.dhaka}</span> / <span className="text-orange-600">{p.chittagong}</span>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProduct(p)}><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={async () => { if(confirm('Delete?')) { const success = await api.deleteProduct(p.id); if (success) { setProducts(await api.getProducts()); showSuccess('Product deleted'); } else { showError('Failed to delete product'); } } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Tabs defaultValue="entry" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="entry">Entry History</TabsTrigger>
                <TabsTrigger value="transfer">Transfer History</TabsTrigger>
              </TabsList>

              <TabsContent value="entry">
                <Card className="border-none shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                      <History className="w-4 h-4" /> Stock Entry History (Grouped)
                    </div>
                    <div className="max-h-[40vh] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/30">
                            <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Entry ID</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Location</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Products</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Items</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Total Qty</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Note</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">View</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Edit</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Delete</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupedEntryHistory.slice(0, 25).map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs text-slate-500">{formatDisplayDate(entry.date)}</TableCell>
                              <TableCell className="text-xs font-semibold">{entry.entryId}</TableCell>
                              <TableCell className="capitalize">{entry.location}</TableCell>
                              <TableCell className="text-xs max-w-[360px] truncate" title={entry.products.join(', ')}>
                                {entry.products.join(', ')}
                              </TableCell>
                              <TableCell className="text-right">{entry.itemCount}</TableCell>
                              <TableCell className="text-right font-semibold">{entry.totalQty}</TableCell>
                              <TableCell className="text-xs">{entry.note || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEntryDetail(entry.id)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editEntryGroup(entry.id)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => deleteEntryGroup(entry.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transfer">
                <Card className="border-none shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-slate-50/50 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                      <ArrowRightLeft className="w-4 h-4" /> Stock Transfer History
                    </div>
                    <div className="max-h-[40vh] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/30">
                            <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Transfer ID</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                            <TableHead className="text-xs font-bold uppercase">From</TableHead>
                            <TableHead className="text-xs font-bold uppercase">To</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Qty</TableHead>
                            <TableHead className="text-xs font-bold uppercase">Note</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">View</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Edit</TableHead>
                            <TableHead className="text-right text-xs font-bold uppercase">Delete</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stockTransfers.slice(0, 25).map((transfer) => (
                            <TableRow key={transfer.id}>
                              <TableCell className="text-xs text-slate-500">{formatDisplayDate(transfer.date)}</TableCell>
                              <TableCell className="text-xs font-semibold">{transfer.transferId || transfer.id}</TableCell>
                              <TableCell>{transfer.productName}</TableCell>
                              <TableCell className="capitalize">{transfer.from}</TableCell>
                              <TableCell className="capitalize">{transfer.to}</TableCell>
                              <TableCell className="text-right font-semibold">{transfer.quantity}</TableCell>
                              <TableCell className="text-xs">{transfer.note || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTransferDetail(transfer)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editTransfer(transfer)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => deleteTransfer(transfer.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Category Manager */}
        <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
          <DialogContent>
            <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input placeholder="Category name..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                <Button onClick={handleSaveCategory} className="bg-slate-900">{editingCategory ? 'Update' : 'Add'}</Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingCategory(cat); setNewCategoryName(cat.name); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={async () => { if(confirm('Delete?')) { const success = await api.deleteCategory(cat.id); if (success) { setCategories(await api.getCategories()); showSuccess("Category deleted"); } else { showError("Failed to delete category"); } } }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Edit Dialog */}
        <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editingProduct?.id ? 'Edit Product' : 'New Product'}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Product Name</Label><Input value={editingProduct?.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Version</Label><Input value={editingProduct?.version} onChange={e => setEditingProduct({...editingProduct, version: e.target.value})} /></div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editingProduct?.categoryId} onValueChange={v => setEditingProduct({...editingProduct, categoryId: v})}>
                    <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Retail Price</Label>
                  <Input type="number" value={editingProduct?.retailPrice || 0} onChange={e => setEditingProduct({...editingProduct, retailPrice: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Commission / Unit</Label>
                  <Input type="number" value={editingProduct?.commission || 0} onChange={e => setEditingProduct({...editingProduct, commission: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Dhaka Stock</Label>
                  <Input type="number" value={editingProduct?.dhaka || 0} onChange={e => setEditingProduct({...editingProduct, dhaka: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>CTG Stock</Label>
                  <Input type="number" value={editingProduct?.chittagong || 0} onChange={e => setEditingProduct({...editingProduct, chittagong: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex justify-between items-center">
                  <Label>Dealer Price Slabs</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addSlabRow}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Slab
                  </Button>
                </div>
                {(editingProduct?.slabs || []).length === 0 && (
                  <p className="text-xs text-slate-500">No slabs added. Dealer orders will use retail price.</p>
                )}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(editingProduct?.slabs || []).map((slab, index) => (
                    <div className="grid grid-cols-4 gap-2 items-center" key={index}>
                      <Input type="number" placeholder="Min Qty" value={slab.min} onChange={e => updateSlab(index, 'min', Number(e.target.value))} />
                      <Input type="number" placeholder="Max Qty" value={slab.max} onChange={e => updateSlab(index, 'max', Number(e.target.value))} />
                      <Input type="number" placeholder="Dealer Price" value={slab.price} onChange={e => updateSlab(index, 'price', Number(e.target.value))} />
                      <Button type="button" variant="ghost" size="icon" className="text-red-400" onClick={() => removeSlab(index)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-slate-900" onClick={handleSaveProduct}>Save Product</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Stock Entry Dialog */}
        <Dialog open={showStockEntryDialog} onOpenChange={setShowStockEntryDialog}>
          <DialogContent className="max-w-5xl">
            <DialogHeader><DialogTitle>Stock Entry (Single or Multiple Products)</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input type="date" value={stockEntryDate} onChange={e => setStockEntryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={stockEntryLocation} onValueChange={(v: 'dhaka' | 'chittagong') => setStockEntryLocation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Entry Note</Label>
                  <Input value={stockEntryNote} onChange={e => setStockEntryNote(e.target.value)} placeholder="Optional note for this stock entry" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Products</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addStockEntryRow}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Product Row
                  </Button>
                </div>
                <div className="rounded-lg border max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Available</TableHead>
                        <TableHead className="text-xs">Retail</TableHead>
                        <TableHead className="text-xs">Slabs</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockEntryItems.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="min-w-[220px]">
                            <Select value={row.productId} onValueChange={(v) => updateStockEntryRow(index, 'productId', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Select Product" /></SelectTrigger>
                              <SelectContent>
                                {getSelectableProductsForRow(index).map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-xs">{row.productId ? getAvailableQty(row.productId) : '-'}</TableCell>
                          <TableCell className="text-xs">৳{row.productId ? products.find(p => p.id === row.productId)?.retailPrice || 0 : 0}</TableCell>
                          <TableCell className="text-xs max-w-[280px] truncate" title={row.productId ? getProductSlabText(row.productId) : ''}>
                            {row.productId ? getProductSlabText(row.productId) : '-'}
                          </TableCell>
                          <TableCell className="min-w-[110px]">
                            <Input className="h-8" type="number" value={row.quantity} onChange={e => updateStockEntryRow(index, 'quantity', e.target.value)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeStockEntryRow(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <Button className="w-full bg-slate-900" onClick={handleSaveStockEntry}>Save Stock Entry</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showStockTransferDialog} onOpenChange={setShowStockTransferDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Stock Transfer</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={stockTransferForm.productId} onValueChange={(v) => setStockTransferForm({ ...stockTransferForm, productId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                  <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={stockTransferForm.from} onValueChange={(v: 'dhaka' | 'chittagong') => setStockTransferForm({ ...stockTransferForm, from: v, to: v === 'dhaka' ? 'chittagong' : 'dhaka' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Input value={stockTransferForm.from === 'dhaka' ? 'CTG' : 'Dhaka'} readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={stockTransferForm.date} onChange={(e) => setStockTransferForm({ ...stockTransferForm, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={stockTransferForm.quantity} onChange={(e) => setStockTransferForm({ ...stockTransferForm, quantity: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={stockTransferForm.note} onChange={(e) => setStockTransferForm({ ...stockTransferForm, note: e.target.value })} placeholder="Optional note" />
              </div>
              {stockTransferForm.productId && (
                <p className="text-xs text-slate-500">
                  Available in {stockTransferForm.from === 'dhaka' ? 'Dhaka' : 'CTG'}: {getAvailableQtyByLocation(stockTransferForm.productId, stockTransferForm.from)}
                </p>
              )}
              <Button className="w-full bg-slate-900" onClick={handleSaveStockTransfer}>Transfer Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingStockEntryGroup} onOpenChange={(open) => !open && setEditingStockEntryGroup(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Update Stock Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {editingStockEntryGroup?.map((entry, index) => (
                <div key={entry.id} className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label>Product</Label>
                    <Input value={entry.productName} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Select value={entry.location} onValueChange={(value) => updateEditingStockEntry(index, 'location', value as 'dhaka' | 'chittagong')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dhaka">Dhaka</SelectItem>
                        <SelectItem value="chittagong">CTG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" value={entry.quantity} onChange={(e) => updateEditingStockEntry(index, 'quantity', Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Note</Label>
                    <Input value={entry.note || ''} onChange={(e) => updateEditingStockEntry(index, 'note', e.target.value)} />
                  </div>
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingStockEntryGroup(null)}>Cancel</Button>
                <Button className="bg-slate-900" onClick={saveEditedStockEntryGroup}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingStockTransfer} onOpenChange={(open) => !open && setEditingStockTransfer(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit Stock Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Input value={editingStockTransfer?.productName || ''} readOnly />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={editingStockTransfer?.from} onValueChange={(value) => updateEditingStockTransfer('from', value as 'dhaka' | 'chittagong')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <Select value={editingStockTransfer?.to} onValueChange={(value) => updateEditingStockTransfer('to', value as 'dhaka' | 'chittagong')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka</SelectItem>
                      <SelectItem value="chittagong">CTG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={editingStockTransfer?.date || ''} onChange={(e) => updateEditingStockTransfer('date', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={editingStockTransfer?.quantity || 0} onChange={(e) => updateEditingStockTransfer('quantity', Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Input value={editingStockTransfer?.note || ''} onChange={(e) => updateEditingStockTransfer('note', e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingStockTransfer(null)}>Cancel</Button>
                <Button className="bg-slate-900" onClick={saveEditedStockTransfer}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyDetailOpen} onOpenChange={setHistoryDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{historyDetail?.title || 'History Detail'}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {historyDetail?.rows.map((row, idx) => (
                <div key={idx} className="rounded-md border p-2">
                  <div className="text-xs font-semibold text-slate-700">{row.label}</div>
                  <div className="text-xs text-slate-500">{row.value}</div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Products;