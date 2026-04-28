"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Target, Dealer, Product, Order } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target as TargetIcon, Plus, Trophy, Calendar, Edit, Trash2, RefreshCw, History, X } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { formatDisplayDate, getTodayISO } from '@/utils/date';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Targets = () => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [pendingProductId, setPendingProductId] = useState('');
  
  const getInitialTarget = (): Partial<Target> => ({
    name: '',
    dealerId: 'all',
    type: 'amount',
    productIds: [],
    targetValue: 0,
    currentValue: 0,
    startDate: getTodayISO(),
    endDate: getTodayISO(),
    rewardType: 'percentage',
    rewardValue: 0
  });
  const [editingTarget, setEditingTarget] = useState<Partial<Target> | null>(getInitialTarget());
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setTargets(await api.getTargets());
      setDealers(await api.getDealers());
      setProducts(await api.getProducts());
      setOrders(await api.getOrders());
    };
    loadData();
  }, []);

  const activeTargets = useMemo(() => targets.filter(t => t.status === 'active'), [targets]);
  const historicalTargets = useMemo(() => targets.filter(t => t.status !== 'active'), [targets]);

  const getTargetProductLabel = (target: Target) => {
    if (!target.productIds?.length) return 'All Products';
    const names = target.productIds
      .map(id => products.find(p => p.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  };

  const getTargetCurrentValue = (target: Target) => {
    const applicableDealerIds = target.dealerId === 'all'
      ? dealers.map(d => d.id)
      : [target.dealerId];

    const matchingOrders = orders.filter(o =>
      o.status === 'approved' &&
      !o.isQuote &&
      !!o.dealerId &&
      applicableDealerIds.includes(o.dealerId) &&
      o.date >= target.startDate &&
      o.date <= target.endDate
    );

    const relevantItems = matchingOrders.flatMap(o =>
      o.items.filter(i => target.productIds.length === 0 || target.productIds.includes(i.productId))
    );

    const targetType = target.type || 'amount';
    return targetType === 'amount'
      ? relevantItems.reduce((sum, i) => sum + i.total, 0)
      : relevantItems.reduce((sum, i) => sum + i.quantity, 0);
  };

  const handleSave = async () => {
    if (!editingTarget?.targetValue || !editingTarget?.endDate) return showError("Please set target value and end date");
    
    const target: Target = {
      id: editingTarget.id || Math.random().toString(36).substr(2, 9),
      name: (editingTarget.name || '').trim(),
      dealerId: editingTarget.dealerId || 'all',
      dealerName: editingTarget.dealerId === 'all' ? 'All Dealers' : dealers.find(d => d.id === editingTarget.dealerId)?.name || '',
      type: editingTarget.type as any,
      productIds: editingTarget.productIds || [],
      targetValue: Number(editingTarget.targetValue),
      currentValue: editingTarget.currentValue || 0,
      startDate: editingTarget.startDate || getTodayISO(),
      endDate: editingTarget.endDate!,
      rewardType: 'fixed',
      rewardValue: Number(editingTarget.rewardValue ?? 0),
      status: 'active'
    };
    
    await api.saveTarget(target);
    setTargets(await api.getTargets());
    setEditingTarget(getInitialTarget());
    showSuccess(editingTarget.id ? "Target updated" : "Target created");
  };

  const handleReapply = (t: Target) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setEditingTarget({
      ...t,
      id: undefined,
      currentValue: 0,
      startDate: getTodayISO(),
      endDate: nextMonth.toISOString().split('T')[0]
    });
  };

  const handleRenewBatch = async (t: Target) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const archived = { ...t, status: 'expired' as const };
    const renewed: Target = {
      ...t,
      id: `${t.id}-R-${Date.now()}`,
      currentValue: 0,
      status: 'active',
      startDate: getTodayISO(),
      endDate: nextMonth.toISOString().split('T')[0]
    };

    await api.saveTarget(archived);
    await api.saveTarget(renewed);
    setTargets(await api.getTargets());
    showSuccess('Target renewed for next batch');
  };

  const selectableProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );
  const addProductToTarget = () => {
    if (!pendingProductId) return;
    const ids = editingTarget?.productIds || [];
    if (ids.includes(pendingProductId)) return;
    setEditingTarget({ ...editingTarget, productIds: [...ids, pendingProductId] });
    setPendingProductId('');
    setProductSearch('');
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Plus className="w-4 h-4" /> {editingTarget?.id ? 'Edit' : 'New'} Target
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Target Name</Label>
                <Input
                  className="h-10 rounded-xl"
                  placeholder="Example: April Dealer Amount Target"
                  value={editingTarget?.name || ''}
                  onChange={e => setEditingTarget({ ...editingTarget, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Apply To</Label>
                <Select value={editingTarget?.dealerId || 'all'} onValueChange={v => setEditingTarget({...editingTarget, dealerId: v})}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dealers (Global)</SelectItem>
                    {dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Product Search</Label>
                <Input
                  className="h-9 rounded-xl"
                  placeholder="Search product..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  <Select value={pendingProductId} onValueChange={setPendingProductId}>
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="Select product to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectableProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" className="h-9" onClick={addProductToTarget}>Add</Button>
                </div>
                <div className="max-h-28 overflow-auto border rounded-xl p-2 space-y-1">
                  {(editingTarget?.productIds || []).map(pid => {
                    const product = products.find(p => p.id === pid);
                    return (
                      <div key={pid} className="text-xs flex items-center justify-between bg-slate-50 rounded px-2 py-1">
                        <span>{product?.name || pid}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingTarget({ ...editingTarget, productIds: (editingTarget?.productIds || []).filter(id => id !== pid) })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Type</Label>
                  <Select value={editingTarget?.type || 'amount'} onValueChange={v => setEditingTarget({...editingTarget, type: v as any})}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount (৳)</SelectItem>
                      <SelectItem value="quantity">Quantity (Pcs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Target Value</Label>
                  <Input type="number" className="h-10 rounded-xl" value={editingTarget?.targetValue || ''} onChange={e => setEditingTarget({...editingTarget, targetValue: Number(e.target.value)})} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Reward Commission (Fixed ৳)</Label>
                <Input
                  type="number"
                  className="h-10 rounded-xl"
                  value={editingTarget?.rewardValue || ''}
                  onChange={e => setEditingTarget({ ...editingTarget, rewardType: 'fixed', rewardValue: Number(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Start Date</Label>
                  <Input type="date" className="h-10 rounded-xl" value={editingTarget?.startDate || ''} onChange={e => setEditingTarget({...editingTarget, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">End Date</Label>
                  <Input type="date" className="h-10 rounded-xl" value={editingTarget?.endDate || ''} onChange={e => setEditingTarget({...editingTarget, endDate: e.target.value})} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1 h-11 bg-slate-900 rounded-xl font-black uppercase text-xs tracking-widest">
                  {editingTarget?.id ? 'Update' : 'Create'}
                </Button>
                {editingTarget && (
                  <Button variant="outline" onClick={() => setEditingTarget(getInitialTarget())} className="h-11 rounded-xl">Cancel</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" /> Active Targets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {activeTargets.map((t, targetIndex) => {
                const targetType = t.type || 'amount';
                const currentValue = getTargetCurrentValue(t);
                const progress = (currentValue / t.targetValue) * 100;
                const rewardType = t.rewardType || 'percentage';
                const rewardValue = Number(t.rewardValue ?? 0);
                return (
                  <Card key={t.id} className="border-none shadow-sm hover:shadow-md transition-all">
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-black text-slate-900">{t.name?.trim() || `Target-${targetIndex + 1}`}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">{t.dealerName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" /> {formatDisplayDate(t.startDate)} to {formatDisplayDate(t.endDate)}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                            Products: {t.productIds?.length || 0}
                          </p>
                          <p className="text-[10px] font-bold text-slate-500 mt-1">
                            Package: {getTargetProductLabel(t)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={cn("border-none text-[8px] font-black uppercase", t.dealerId === 'all' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600")}>
                            {t.dealerId === 'all' ? 'Global' : 'Dealer'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-[10px] font-bold text-slate-500">
                        Achieved: {targetType === 'amount' ? '৳' : ''}{currentValue.toLocaleString()} | Target: {targetType === 'amount' ? '৳' : ''}{t.targetValue.toLocaleString()} ({Math.round(progress)}%)
                      </div>

                      <div className="pt-4 border-t flex justify-between items-center">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTarget(t)}><Edit className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleReapply(t)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleRenewBatch(t)} title="Renew next batch"><TargetIcon className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteTarget(t.id); setTargets(await api.getTargets()); } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                        <div className="text-xs font-black text-emerald-600">
                          {rewardType === 'percentage' ? `${rewardValue}%` : `৳${rewardValue.toLocaleString()}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {targets.length === 0 && (
              <Card className="border-dashed border-2 bg-slate-50/60">
                <CardContent className="py-10 text-center text-xs font-bold uppercase text-slate-400">
                  No targets found yet.
                </CardContent>
              </Card>
            )}

            <div className="pt-2">
              <Button variant="outline" className="w-full bg-white" onClick={() => setHistoryOpen(true)}>
                <History className="w-4 h-4 mr-2 text-slate-500" />
                View Target History
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Target History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {historicalTargets.length === 0 ? (
              <p className="text-[10px] uppercase font-bold text-slate-400">No history yet.</p>
            ) : (
              historicalTargets.map(t => (
                <Card key={t.id} className="border-none shadow-sm bg-slate-50/60">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{t.name?.trim() || t.dealerName}</p>
                      <p className="text-[10px] text-slate-500">{t.dealerName}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatDisplayDate(t.startDate)} to {formatDisplayDate(t.endDate)} | {getTargetProductLabel(t)}
                      </p>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px]">{t.status}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Targets;