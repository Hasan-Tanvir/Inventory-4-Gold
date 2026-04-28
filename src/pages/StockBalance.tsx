"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Product, Order, SendAmountEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess } from '@/utils/toast';
import { Package, MapPin, TrendingUp, DollarSign, Send, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const StockBalance = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sendAmounts, setSendAmounts] = useState<SendAmountEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  
  const [sendAmount, setSendAmount] = useState<number | string>('');
  const [sendLocation, setSendLocation] = useState<'dhaka' | 'chittagong'>('chittagong');
  const [sendNote, setSendNote] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setProducts(await api.getProducts());
      setOrders(await api.getOrders());
      setSendAmounts(await api.getSendAmounts());
    };
    loadData();
  }, []);

  const balanceData = useMemo(() => {
    let dhakaValue = 0;
    let ctgValue = 0;
    let dhakaSold = 0;
    let ctgSold = 0;

    products.forEach(p => {
      const lowestPrice = p.slabs.length > 0 ? Math.min(...p.slabs.map(s => s.price)) : p.retailPrice;
      dhakaValue += (p.dhaka || 0) * lowestPrice;
      ctgValue += (p.chittagong || 0) * lowestPrice;
    });

    orders.filter(o => !o.isQuote).forEach(o => {
      o.items.forEach(item => {
        if (item.location === 'dhaka') dhakaSold += item.total;
        else ctgSold += item.total;
      });
    });

    const dhakaSent = sendAmounts.filter(s => s.location === 'dhaka').reduce((sum, s) => sum + s.amount, 0);
    const ctgSent = sendAmounts.filter(s => s.location === 'chittagong').reduce((sum, s) => sum + s.amount, 0);

    return {
      dhaka: { value: dhakaValue, sold: dhakaSold, sent: dhakaSent, due: dhakaSold - dhakaSent },
      ctg: { value: ctgValue, sold: ctgSold, sent: ctgSent, due: ctgSold - ctgSent }
    };
  }, [products, orders, sendAmounts]);

  const handleSendAmount = async () => {
    if (!sendAmount) return;
    await api.saveSendAmount({
      id: '',
      date: new Date().toISOString().split('T')[0],
      location: sendLocation,
      amount: Number(sendAmount),
      note: sendNote
    });
    setSendAmounts(await api.getSendAmounts());
    setSendAmount('');
    setSendNote('');
    showSuccess("Send amount recorded");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Warehouse Inventory & Accounts</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-slate-900"><Send className="w-4 h-4 mr-2" /> Record Send to Main</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Amount to Main Office</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Select value={sendLocation} onValueChange={(v: any) => setSendLocation(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dhaka">Dhaka Warehouse</SelectItem>
                      <SelectItem value="chittagong">Chittagong Warehouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (৳)</Label>
                  <Input type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Input value={sendNote} onChange={e => setSendNote(e.target.value)} placeholder="e.g. Bank deposit ref..." />
                </div>
                <Button className="w-full bg-slate-900" onClick={handleSendAmount}>Save Entry</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['dhaka', 'chittagong'].map((loc) => {
            const data = loc === 'dhaka' ? balanceData.dhaka : balanceData.ctg;
            return (
              <Card key={loc} className={cn("border-none shadow-sm", loc === 'dhaka' ? "bg-blue-50/50" : "bg-orange-50/50")}>
                <CardHeader className="pb-2">
                  <CardTitle className={cn("flex items-center text-sm font-bold uppercase tracking-wider", loc === 'dhaka' ? "text-blue-600" : "text-orange-600")}>
                    <MapPin className="w-4 h-4 mr-2" /> {loc} Warehouse
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Stock Value</p>
                    <p className="text-xl font-black text-slate-900">৳{data.value.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Sold Amount</p>
                    <p className="text-xl font-black text-green-600">৳{data.sold.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Sent to Main</p>
                    <p className="text-xl font-black text-blue-600">৳{data.sent.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Due Balance</p>
                    <p className="text-xl font-black text-red-600">৳{data.due.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Product Wise Inventory</CardTitle>
              <Button variant="outline" className="h-9" onClick={() => setInventoryOpen(true)}>View Inventory</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[56vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Dhaka</TableHead>
                    <TableHead className="text-xs font-bold uppercase">CTG</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Total</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const lowestPrice = p.slabs.length > 0 ? Math.min(...p.slabs.map(s => s.price)) : p.retailPrice;
                    const totalQty = (p.dhaka || 0) + (p.chittagong || 0);
                    return (
                      <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400">{p.version}</div>
                        </TableCell>
                        <TableCell className="text-blue-600 font-medium">{p.dhaka}</TableCell>
                        <TableCell className="text-orange-600 font-medium">{p.chittagong}</TableCell>
                        <TableCell className="font-black">{totalQty}</TableCell>
                        <TableCell className="text-right font-bold">৳{(totalQty * lowestPrice).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <History className="w-4 h-4 mr-2" /> Send History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Button variant="outline" className="w-full h-11" onClick={() => setHistoryOpen(true)}>
                View History
              </Button>
              <p className="text-[10px] text-slate-500 mt-3 uppercase font-bold">
                {sendAmounts.length} records available
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Product Wise Inventory
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Dhaka</TableHead>
                  <TableHead className="text-xs font-bold uppercase">CTG</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Total</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => {
                  const lowestPrice = p.slabs.length > 0 ? Math.min(...p.slabs.map(s => s.price)) : p.retailPrice;
                  const totalQty = (p.dhaka || 0) + (p.chittagong || 0);
                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.version}</div>
                      </TableCell>
                      <TableCell className="text-blue-600 font-medium">{p.dhaka}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{p.chittagong}</TableCell>
                      <TableCell className="font-black">{totalQty}</TableCell>
                      <TableCell className="text-right font-bold">৳{(totalQty * lowestPrice).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Send History
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30">
                  <TableHead className="text-xs font-bold uppercase">Date</TableHead>
                  <TableHead className="text-xs font-bold uppercase">Loc</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendAmounts.slice().reverse().slice(0, 25).map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-[10px] text-slate-500">{s.date}</TableCell>
                    <TableCell className="capitalize text-[10px] font-bold">{s.location.charAt(0)}</TableCell>
                    <TableCell className="text-right font-bold text-blue-600">৳{s.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default StockBalance;