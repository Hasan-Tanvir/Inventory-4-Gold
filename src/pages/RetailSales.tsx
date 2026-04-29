"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, RetailTransaction, RetailTransactionType, Customization } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showSuccess } from '@/utils/toast';
import { Plus, BadgePercent, Trash2, History, Landmark, Undo2, List, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDisplayDate, getTodayISO } from '@/utils/date';

const RetailSales = () => {
  const [transactions, setTransactions] = useState<RetailTransaction[]>([]);
  const [location, setLocation] = useState<'dhaka' | 'chittagong'>('dhaka');
  const [config, setConfig] = useState<Customization | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const [txDetail, setTxDetail] = useState('');
  const [txAmount, setTxAmount] = useState<number | string>('');
  const [txType, setTxType] = useState<RetailTransactionType>('other');
  const [txDate, setTxDate] = useState(getTodayISO());
  const [historyView, setHistoryView] = useState<'table' | 'cards'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [payAmountOrderId, setPayAmountOrderId] = useState<string | null>(null);
  const [payAmountValue, setPayAmountValue] = useState<number>(0);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDialogOrder, setPayDialogOrder] = useState<Order | null>(null);

  useEffect(() => {
    const loadData = async () => {
      await api.syncRetailSalesFromApprovedOrders();
      setTransactions(await api.getRetailTransactions());
      setConfig(await api.getCustomization());
    };
    loadData();
  }, []);

  const refreshRetailData = async () => {
    await api.syncRetailSalesFromApprovedOrders();
    setTransactions(await api.getRetailTransactions());
  };

  const filteredTransactions = useMemo(() => 
    transactions.filter(t => t.location === location), 
  [transactions, location]);

  const initialByLocation = useMemo(() => {
    if (!config) return 0;
    if (location === 'dhaka') return config.initialRetailAmountDhaka ?? config.initialRetailAmount ?? 0;
    return config.initialRetailAmountChittagong ?? config.initialRetailAmount ?? 0;
  }, [config, location]);

  const netBalance = useMemo(() => {
    const initial = initialByLocation;
    // Retail sale orders with paymentStatus === 'unpaid' should not affect balance.
    // For partial, use paidAmount.
    return initial + filteredTransactions.reduce((sum, t) => {
      if (t.type === 'sale') {
        if ((t.paymentStatus || 'paid') === 'unpaid') return sum;
        if (t.paymentStatus === 'partial') return sum + (t.paidAmount || 0);
        return sum + t.amount;
      }
      return sum + t.amount;
    }, 0);
  }, [filteredTransactions, initialByLocation]);

  const handleAddTransaction = async () => {
    if (!txDetail || !txAmount) return;
    const rawAmount = Number(txAmount);
    const normalizedAmount = txType === 'sent_to_main'
      ? -Math.abs(rawAmount)
      : rawAmount;
    const newTx: RetailTransaction = { 
      id: `RTX-${Date.now()}`, 
      date: txDate, 
      detail: txDetail, 
      amount: normalizedAmount, 
      location,
      type: txType
    };
    await api.saveRetailTransaction(newTx);
    await refreshRetailData();
    setTxDetail('');
    setTxAmount('');
    showSuccess("Transaction recorded");
  };

  const setRetailPaymentStatus = async (orderId: string, status: 'paid' | 'unpaid' | 'partial') => {
    const result = await api.setRetailOrderPaymentStatus(orderId, status);
    if (!result.success) return;
    await refreshRetailData();
    showSuccess(`Retail order marked as ${status}.`);
  };

  const payAmount = async (orderId: string, amount: number) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const currentPaid = order.partialAmount || 0;
    const newPaid = currentPaid + amount;
    const total = order.netTotal;
    let newStatus: 'paid' | 'unpaid' | 'partial' = 'partial';
    if (newPaid >= total) {
      newStatus = 'paid';
    }
    const result = await api.setRetailOrderPaymentStatus(orderId, newStatus, newPaid);
    if (!result.success) return;
    await refreshRetailData();
    showSuccess(`Payment of ৳${amount} added.`);
  };

  const openPayDialog = async (orderId: string) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === orderId) || null;
    const dueAmount = order ? Math.max(order.netTotal - (order.partialAmount || 0), 0) : 0;
    setPayAmountOrderId(orderId);
    setPayDialogOrder(order);
    setPayAmountValue(dueAmount);
    setPayDialogOpen(true);
  };

  const submitPayAmount = async () => {
    if (!payAmountOrderId || payAmountValue <= 0) return;
    await payAmount(payAmountOrderId, payAmountValue);
    setPayDialogOpen(false);
    setPayDialogOrder(null);
    setPayAmountOrderId(null);
    setPayAmountValue(0);
  };

  const handleUpdateInitial = async (val: number) => {
    if (config) {
      const newConfig = location === 'dhaka'
        ? { ...config, initialRetailAmountDhaka: val }
        : { ...config, initialRetailAmountChittagong: val };
      await api.saveCustomization(newConfig);
      setConfig(newConfig);
      showSuccess("Initial balance updated");
    }
  };

  const deleteTransaction = async (id: string) => {
    if (confirm('Delete?')) {
      await api.deleteRetailTransaction(id);
      setTransactions(await api.getRetailTransactions());
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center sticky top-0 z-20 bg-slate-50/95 backdrop-blur py-2">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BadgePercent className="w-6 h-6 text-blue-600" />
            Retail Transactions
          </h1>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border shadow-sm">
              <Landmark className="w-4 h-4 text-slate-400" />
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-slate-400">Initial Balance</span>
                <input 
                  type="number" 
                  className="w-20 text-xs font-bold bg-transparent border-none p-0 focus:ring-0" 
                  value={initialByLocation}
                  onChange={(e) => handleUpdateInitial(Number(e.target.value))}
                />
              </div>
            </div>
            <Select value={location} onValueChange={(v: any) => setLocation(v)}>
              <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dhaka">Dhaka Branch</SelectItem>
                <SelectItem value="chittagong">Chittagong Branch</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-10 px-3 hidden sm:flex items-center gap-2"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="w-4 h-4" />
              History
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-3 border-none shadow-sm bg-white">
            <CardHeader className="border-b bg-slate-50/50"><CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Adjustment / Entry</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Date</Label>
                <Input type="date" className="h-9" value={txDate} onChange={e => setTxDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Entry Type</Label>
                <Select value={txType} onValueChange={(v: any) => setTxType(v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">Other Sale / Income</SelectItem>
                    <SelectItem value="sent_to_main">Amount Sent to Main</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Detail</Label>
                <Input className="h-9" value={txDetail} onChange={e => setTxDetail(e.target.value)} placeholder="Description..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Amount (৳)</Label>
                <Input type="number" className="h-9" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
              </div>
              <Button className="w-full bg-slate-900" onClick={handleAddTransaction}><Plus className="w-4 h-4 mr-2" /> Record Entry</Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Net Balance</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-black text-slate-900">৳{netBalance.toLocaleString()}</div>
              <p className="text-[10px] text-slate-500 mt-1">{location === 'dhaka' ? 'Dhaka' : 'Chittagong'} Branch</p>
            </CardContent>
          </Card>
        </div>

        <div className="sm:hidden">
          <Button className="w-full bg-slate-900" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4 mr-2" /> View History
          </Button>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Retail History ({location === 'dhaka' ? 'Dhaka' : 'Chittagong'})
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-1">
              <Button variant={historyView === 'table' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setHistoryView('table')}>
                <List className="w-4 h-4" />
              </Button>
              <Button variant={historyView === 'cards' ? 'default' : 'outline'} size="icon" className="h-9 w-9" onClick={() => setHistoryView('cards')}>
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">
              Showing {filteredTransactions.length} entries
            </p>
          </div>

          <div className="pt-4">
            <div className={cn("max-h-[60vh] overflow-auto", historyView === 'cards' ? "hidden sm:block" : "block")}>
              <Table className="min-w-[980px]">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-slate-100/90 backdrop-blur">
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Order ID</TableHead>
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Type</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Description</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Note</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase whitespace-nowrap">Amount</TableHead>
                    <TableHead className="w-44"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => {
                    const isGenerated = t.id.startsWith('RTX-ORD-');
                    const paymentStatus = t.paymentStatus || 'paid';
                    const canPayToggle = isGenerated && t.type === 'sale' && t.orderId;
                    const canDelete = !isGenerated;
                    return (
                      <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                        <TableCell className="text-[10px] text-slate-500 py-2.5 whitespace-nowrap">{formatDisplayDate(t.date)}</TableCell>
                        <TableCell className="text-[10px] font-semibold whitespace-nowrap">{t.orderId || '-'}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                            t.type === 'sent_to_main' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700",
                            t.type === 'sale' && paymentStatus === 'unpaid' ? "bg-orange-100 text-orange-700" : "",
                            t.type === 'sale' && paymentStatus === 'partial' ? "bg-yellow-100 text-yellow-700" : ""
                          )}>
                            {t.type === 'sale'
                              ? `Sale (${paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Unpaid'})`
                              : t.type.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-900">
                          {t.detail.split(' | Note:')[0]}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {t.detail.includes(' | Note:') ? t.detail.split(' | Note:')[1] : '-'}
                        </TableCell>
                        <TableCell className={cn("text-right font-bold whitespace-nowrap", t.amount >= 0 ? "text-green-600" : "text-red-600")}>
                          {t.amount >= 0 ? '+' : ''}৳{t.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            {canPayToggle && paymentStatus !== 'paid' && (
                              <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => openPayDialog(t.orderId!)}>
                                Pay Amount
                              </Button>
                            )}
                            {canPayToggle && paymentStatus === 'paid' && (
                              <Button variant="outline" size="sm" className="h-8" onClick={() => setRetailPaymentStatus(t.orderId!, 'unpaid')}>
                                <Undo2 className="w-4 h-4 mr-1" /> Undo
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-70 hover:opacity-100"
                                onClick={() => deleteTransaction(t.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className={cn("p-3 space-y-2 sm:hidden", historyView === 'cards' ? "block" : "hidden")}>
              {filteredTransactions.map((t) => {
                const isGenerated = t.id.startsWith('RTX-ORD-');
                const paymentStatus = t.paymentStatus || 'paid';
                const canPayToggle = isGenerated && t.type === 'sale' && t.orderId;
                const canDelete = !isGenerated;
                return (
                  <div key={t.id} className="rounded-xl border bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black">{t.orderId || t.id}</p>
                      <p className="text-[10px] text-slate-500">{formatDisplayDate(t.date)}</p>
                    </div>
                    <p className="text-xs text-slate-700">{t.detail.split(' | Note:')[0]}</p>
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                        t.type === 'sent_to_main' ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-700",
                        t.type === 'sale' && paymentStatus === 'unpaid' ? "bg-orange-100 text-orange-700" : "",
                        t.type === 'sale' && paymentStatus === 'partial' ? "bg-yellow-100 text-yellow-700" : ""
                      )}>
                        {t.type === 'sale'
                          ? `Sale (${paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Partial' : 'Unpaid'})`
                          : t.type.replace('_', ' ')}
                      </span>
                      <span className={cn("text-sm font-black", t.amount >= 0 ? "text-green-600" : "text-red-600")}>
                        {t.amount >= 0 ? '+' : ''}৳{t.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {canPayToggle && paymentStatus !== 'paid' && (
                        <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => openPayDialog(t.orderId!)}>
                          Pay Amount
                        </Button>
                      )}
                      {canPayToggle && paymentStatus === 'paid' && (
                        <Button variant="outline" size="sm" className="h-8" onClick={() => setRetailPaymentStatus(t.orderId!, 'unpaid')}>
                          <Undo2 className="w-4 h-4 mr-1" /> Undo
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-70 hover:opacity-100"
                          onClick={() => deleteTransaction(t.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pay Amount</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-700">
              <p><strong>Order:</strong> {payDialogOrder?.id || payAmountOrderId}</p>
              <p><strong>Due Amount:</strong> ৳{payDialogOrder ? Math.max(payDialogOrder.netTotal - (payDialogOrder.partialAmount || 0), 0).toLocaleString() : payAmountValue.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Payment amount</Label>
              <Input type="number" className="h-10" value={payAmountValue} onChange={e => setPayAmountValue(Number(e.target.value))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button className="bg-blue-600" onClick={submitPayAmount}>Submit Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default RetailSales;