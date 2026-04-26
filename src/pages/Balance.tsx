"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Order, Payment, Customization } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowUpRight, ArrowDownLeft, Printer, Calendar, RotateCcw } from 'lucide-react';
import { printDoc } from '@/utils/invoice-generator';
import { formatDisplayDate, getTodayISO } from '@/utils/date';

const Balance = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState('');
  const [fromDate, setFromDate] = useState(getTodayISO());
  const [toDate, setToDate] = useState(getTodayISO());
  const [config, setConfig] = useState<Customization | null>(null);
  const BALANCE_DRAFT_KEY = 'inventory4-dealer-balance-state';

  useEffect(() => {
    setDealers(api.getDealers());
    setOrders(api.getOrders());
    setPayments(api.getPayments());
    setConfig(api.getCustomization());

    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(BALANCE_DRAFT_KEY);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.selectedDealerId) setSelectedDealerId(data.selectedDealerId);
          if (data.fromDate) setFromDate(data.fromDate);
          if (data.toDate) setToDate(data.toDate);
        } catch {
          window.localStorage.removeItem(BALANCE_DRAFT_KEY);
        }
      }
    }
  }, []);

  const ledger = useMemo(() => {
    if (!selectedDealerId) return [];
    
    const dealerOrders = orders.filter(o => o.dealerId === selectedDealerId && o.status === 'approved').map(o => ({
      date: o.date,
      ref: o.id,
      type: 'Order',
      debit: o.netTotal,
      credit: 0,
      notes: o.notes || 'Sales Order'
    }));

    const dealerPayments = payments.filter(p => p.dealerId === selectedDealerId).map(p => ({
      date: p.date,
      ref: p.reference || 'PAY',
      type: 'Payment',
      debit: p.type === 'Last balance Due' ? p.amount : 0,
      credit: p.type === 'Last balance Due' ? 0 : p.amount,
      notes: 
        p.type === 'Bank Transfer' 
          ? (p.notes ? `Bank Payment: ${p.notes}` : 'Bank Payment')
          : p.type === 'Purchase'
          ? (p.notes ? `Purchase: ${p.notes}` : 'Purchase')
          : p.notes || `Payment via ${p.type}`
    }));

    let combined = [...dealerOrders, ...dealerPayments].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      return (isNaN(aTime) ? 0 : aTime) - (isNaN(bTime) ? 0 : bTime);
    });

    if (fromDate) combined = combined.filter(x => x.date >= fromDate);
    if (toDate) combined = combined.filter(x => x.date <= toDate);

    return combined;
  }, [selectedDealerId, orders, payments, fromDate, toDate]);

  const totals = useMemo(() => {
    const debit = ledger.reduce((sum, item) => sum + item.debit, 0);
    const credit = ledger.reduce((sum, item) => sum + item.credit, 0);
    return { debit, credit, balance: credit - debit };
  }, [ledger]);

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(BALANCE_DRAFT_KEY);
    }
    setSelectedDealerId('');
    setFromDate(getTodayISO());
    setToDate(getTodayISO());
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(BALANCE_DRAFT_KEY, JSON.stringify({ selectedDealerId, fromDate, toDate }));
    }
  }, [selectedDealerId, fromDate, toDate]);

  const handlePrint = () => {
    if (!selectedDealerId || !config) return;
    const dealer = dealers.find(d => d.id === selectedDealerId);
    
    const html = `
      <html>
        <head>
          <style>
            * { box-sizing:border-box; }
            body { font-family: 'Times New Roman', Times, serif; padding: 24px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px; }
            .company { font-size: 22px; font-weight: bold; text-transform: uppercase; }
            .title { font-size: 16px; margin-top: 4px; font-weight: bold; }
            .info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 8px; font-size: 12px; }
            th { text-align: left; font-weight: bold; text-transform: uppercase; }
            .text-right { text-align: right; }
            .summary { margin-top: 16px; border:1px solid #000; padding: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">${config.title}</div>
            <div class="title">Dealer Statement of Account</div>
          </div>
          <div class="info">
            <div>
              <strong>Dealer:</strong> ${dealer?.name}<br>
              <strong>Address:</strong> ${dealer?.address}<br>
              <strong>Phone:</strong> ${dealer?.phone}
            </div>
            <div class="text-right">
              <strong>Period:</strong> ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}<br>
              <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description / Note</th>
                <th class="text-right">Credit (+)</th>
                <th class="text-right">Debit (-)</th>
                <th class="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${ledger.map((item, i) => {
                const running = ledger.slice(0, i + 1).reduce((s, c) => s + c.credit - c.debit, 0);
                return `
                  <tr>
                    <td>${formatDisplayDate(item.date)}</td>
                    <td>${item.ref}</td>
                    <td>${item.notes}</td>
                    <td class="text-right">${item.credit > 0 ? '৳' + item.credit.toLocaleString() : '-'}</td>
                    <td class="text-right">${item.debit > 0 ? '৳' + item.debit.toLocaleString() : '-'}</td>
                    <td class="text-right"><strong>৳${running.toLocaleString()}</strong></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div class="summary">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total Billed: ৳${totals.debit.toLocaleString()}</span>
              <span>Total Paid: ৳${totals.credit.toLocaleString()}</span>
              <span>Net Balance: ৳${totals.balance.toLocaleString()}</span>
            </div>
          </div>
        </body>
      </html>
    `;
    printDoc(html);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Reset
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={!selectedDealerId} className="gap-2">
                <Printer className="w-4 h-4" /> Print Statement
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Select Dealer</Label>
                <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
                  <SelectTrigger><SelectValue placeholder="Choose Dealer" /></SelectTrigger>
                  <SelectContent>
                    {dealers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedDealerId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-red-50 border-red-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600 flex items-center"><ArrowUpRight className="w-4 h-4 mr-2" /> Total Billed</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-900">৳{totals.debit.toLocaleString()}</div></CardContent>
              </Card>
              <Card className="bg-green-50 border-green-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600 flex items-center"><ArrowDownLeft className="w-4 h-4 mr-2" /> Total Paid</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-900">৳{totals.credit.toLocaleString()}</div></CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600 flex items-center"><Wallet className="w-4 h-4 mr-2" /> Current Balance</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-blue-900">৳{totals.balance.toLocaleString()}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="text-right">Credit (+)</TableHead>
                      <TableHead className="text-right">Debit (-)</TableHead>
                      <TableHead className="text-right">Running Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((item, i) => {
                      const runningBalance = ledger.slice(0, i + 1).reduce((sum, curr) => sum + curr.credit - curr.debit, 0);
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{formatDisplayDate(item.date)}</TableCell>
                          <TableCell className="font-medium">{item.ref}</TableCell>
                          <TableCell className="text-xs text-slate-500 italic">{item.notes}</TableCell>
                          <TableCell className="text-right text-green-600">{item.credit > 0 ? `৳${item.credit.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right text-red-600">{item.debit > 0 ? `৳${item.debit.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-bold">৳{runningBalance.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Balance;