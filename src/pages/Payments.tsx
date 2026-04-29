"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Payment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { numberToWords } from '@/lib/utils';
import { CreditCard, Plus, Trash2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

const Payments = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingPayment, setEditingPayment] = useState<Partial<Payment> | null>(null);
  
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [dealerSearch, setDealerSearch] = useState('');
  const [showDealerSuggestions, setShowDealerSuggestions] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<Payment['type']>('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const currentUser = api.getCurrentUser();

  useEffect(() => {
    const loadData = async () => {
      setDealers(await api.getDealers());
      setPayments(await api.getPayments());
      setReference(await api.getNextPaymentReference());
    };
    loadData();
  }, []);

  const formatIndianAmount = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    const [intPart, decPart] = sanitized.split('.');
    const formattedInt = Number(intPart || 0).toLocaleString('en-IN');
    return decPart !== undefined ? `${formattedInt}.${decPart.slice(0, 2)}` : formattedInt;
  };

  const cleanAmount = (value: string) => Number(value.replace(/,/g, ''));

  const handleSave = async () => {
    if (!selectedDealerId || !amount) return showError("Select dealer and enter amount");

    const dealer = dealers.find(d => d.id === selectedDealerId);
    if (!dealer) return;

    const payment: Payment = {
      id: editingPayment?.id || await api.getNextPaymentId(),
      dealerId: dealer.id,
      dealerName: dealer.name,
      date: paymentDate,
      type,
      amount: cleanAmount(amount),
      reference,
      notes
    };

    await api.savePayment(payment);
    setPayments(await api.getPayments());
    setDealers(await api.getDealers());

    // Reset form
    setSelectedDealerId('');
    setDealerSearch('');
    setAmount('');
    setReference(await api.getNextPaymentReference());
    setNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setEditingPayment(null);
    showSuccess("Payment recorded successfully");
  };

  const handleEdit = (p: Payment) => {
    setEditingPayment(p);
    setSelectedDealerId(p.dealerId);
    setDealerSearch(p.dealerName);
    setAmount(formatIndianAmount(String(p.amount)));
    setType(p.type);
    setReference(p.reference || '');
    setNotes(p.notes || '');
    setPaymentDate(p.date);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this payment record?")) {
      await api.deletePayment(id);
      setPayments(await api.getPayments());
      setDealers(await api.getDealers());
      showSuccess("Payment deleted");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <Card className="lg:col-span-1 border-none shadow-sm lg:sticky lg:top-6">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <Plus className="w-4 h-4 mr-2" /> {editingPayment ? 'Edit' : 'New'} Collection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Date</Label>
                <Input type="date" className="h-10" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Select Dealer</Label>
                <div className="relative">
                <Input
                  autoComplete="off"
                  className="h-10 border border-slate-200"
                  value={dealerSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDealerSearch(value);
                    const matchedDealer = dealers.find(d => d.name.toLowerCase() === value.toLowerCase().trim());
                    setSelectedDealerId(matchedDealer?.id || '');
                  }}
                  onFocus={() => setShowDealerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDealerSuggestions(false), 150)}
                  placeholder="Search dealer..."
                />
                {showDealerSuggestions && dealerSearch.trim().length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="max-h-72 overflow-y-auto">
                      {dealers.filter(d => d.name.toLowerCase().includes(dealerSearch.toLowerCase())).slice(0, 8).map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setDealerSearch(d.name);
                          setSelectedDealerId(d.id);
                          setShowDealerSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <div className="font-medium">{d.name}</div>
                        <div className="text-[11px] text-slate-500">{d.address}</div>
                      </button>
                      ))}
                    </div>
                    {dealers.filter(d => d.name.toLowerCase().includes(dealerSearch.toLowerCase())).length === 0 && (
                      <div className="px-4 py-2 text-sm text-slate-500">No dealers found.</div>
                    )}
                  </div>
                )}
              </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Amount (৳)</Label>
                <Input className="h-10" value={amount} onChange={e => setAmount(formatIndianAmount(e.target.value))} />
                {amount && cleanAmount(amount) > 0 && (
                  <p className="text-sm text-slate-600">In words: {numberToWords(Math.round(cleanAmount(amount)))} Taka Only</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Payment Method</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Purchase">Purchase</SelectItem>
                    <SelectItem value="Adjustment">Adjustment</SelectItem>
                    {currentUser?.role === 'admin' && <SelectItem value="Last balance Due">Last balance Due</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Reference Serial</Label>
                <Input className="h-10" value={reference} onChange={e => setReference(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-500">Notes</Label>
                <Input className="h-10" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <Button className="w-full bg-slate-900" onClick={handleSave}>
                {editingPayment ? 'Update' : 'Record'} Payment
              </Button>
              {editingPayment && (
                <Button variant="ghost" className="w-full" onClick={async () => {
                  setEditingPayment(null);
                  setSelectedDealerId('');
                  setDealerSearch('');
                  setAmount('');
                  setReference(await api.getNextPaymentReference());
                  setNotes('');
                  setPaymentDate(new Date().toISOString().split('T')[0]);
                }}>Cancel Edit</Button>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <CreditCard className="w-4 h-4 mr-2" /> Payment History
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Button variant="outline" className="w-full h-11" onClick={() => setHistoryOpen(true)}>
                View History
              </Button>
              <p className="text-[10px] text-slate-500 mt-3 uppercase font-bold">
                {payments.length} records available
              </p>
            </CardContent>
          </Card>
        </div>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Payment History
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-auto">
              <Table className="min-w-[860px]">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-slate-100/90 backdrop-blur">
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">ID</TableHead>
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Dealer</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Method</TableHead>
                    <TableHead className="text-xs font-bold uppercase whitespace-nowrap">Reference</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase">Amount</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-bold text-slate-900 py-2.5 whitespace-nowrap">{p.id}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{p.date}</TableCell>
                      <TableCell className="font-medium">{p.dealerName}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded font-bold uppercase",
                            p.type === 'Adjustment' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {p.type}
                          </span>
                          {(p.type === 'Bank Transfer' || p.type === 'Purchase') && p.notes && (
                            <p className="text-[10px] text-slate-500">
                              {p.type === 'Bank Transfer' ? 'Bank Payment' : 'Purchase'}: {p.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">{p.reference || '-'}</TableCell>
                      <TableCell className="text-right font-black text-green-600 whitespace-nowrap">৳{p.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Payments;