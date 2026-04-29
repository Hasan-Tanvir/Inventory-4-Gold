"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Dealer, Officer, Target, Order, Payment, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { showError, showSuccess } from '@/utils/toast';
import { Plus, Trash2, Edit, Phone, MapPin, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const Dealers = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [editingDealer, setEditingDealer] = useState<Partial<Dealer> | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'officer'>('name');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const loadData = async () => {
      const user = await api.getCurrentUser();
      setCurrentUser(user);
      setDealers(await api.getDealers());
      setOfficers(await api.getOfficers());
      setTargets(await api.getTargets());
      setOrders(await api.getOrders());
      setPayments(await api.getPayments());
    };
    loadData();
  }, []);

  const dealerTargetRows = (dealerId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const activeTargets = targets.filter(
      t =>
        t.status === 'active' &&
        (t.dealerId === 'all' || t.dealerId === dealerId) &&
        t.startDate <= today &&
        t.endDate >= today
    );

    return activeTargets.map((target, idx) => {
      const targetType = target.type || 'amount';
      const dealerOrders = orders.filter(o =>
        o.status === 'approved' &&
        !o.isQuote &&
        o.dealerId === dealerId &&
        o.date >= target.startDate &&
        o.date <= target.endDate
      );
      const relevantItems = dealerOrders.flatMap(o =>
        o.items.filter(i => target.productIds.length === 0 || target.productIds.includes(i.productId))
      );
      const current = targetType === 'amount'
        ? relevantItems.reduce((sum, i) => sum + i.total, 0)
        : relevantItems.reduce((sum, i) => sum + i.quantity, 0);
      const disbursedCycles = (target.rewardDisbursed || {})[dealerId] || 0;
      const achievedCycles = Math.floor(current / Math.max(1, target.targetValue));
      const eligibleCycles = Math.max(0, achievedCycles - disbursedCycles);

      return {
        id: target.id,
        label: target.name?.trim() || `Target-${idx + 1}`,
        current,
        target: target.targetValue,
        type: targetType,
        rewardGranted: disbursedCycles > 0,
        eligibleCycles
      };
    });
  };

  const handleDisburseReward = async (dealerId: string, targetId: string, officerId?: string, officerName?: string) => {
    const result = await api.disburseTargetReward(targetId, dealerId, officerId, officerName);
    if (!result.success) return showError(result.message || 'Reward not eligible');
    setTargets(await api.getTargets());
    setPayments(await api.getPayments());
    showSuccess('Reward disbursed');
  };

  const sortedDealers = useMemo(() => {
    const visibleDealers = currentUser?.role === 'member'
      ? dealers.filter(d => (d.officerId && d.officerId === currentUser.officerId) || d.officerName === currentUser.name)
      : dealers;
    const list = [...visibleDealers];
    if (sortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return list.sort((a, b) => (a.officerName || '').localeCompare(b.officerName || ''));
    }
  }, [dealers, sortBy, currentUser]);

  const dealerBalanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    dealers.forEach(d => {
      const billed = orders
        .filter(o => o.status === 'approved' && o.dealerId === d.id)
        .reduce((sum, o) => sum + o.netTotal, 0);
      const paid = payments
        .filter(p => p.dealerId === d.id)
        .reduce((sum, p) => sum + p.amount, 0);
      map[d.id] = paid - billed;
    });
    return map;
  }, [dealers, orders, payments]);

  const handleSave = async () => {
    if (editingDealer && editingDealer.name) {
      const officer = officers.find(o => o.id === editingDealer.officerId);
      const dealerToSave = {
        ...editingDealer,
        officerName: officer?.name || ''
      } as Dealer;

      if (editingDealer.id) {
        const updated = await api.updateDealer(editingDealer.id, dealerToSave);
        if (!updated) {
          showError("Failed to update dealer");
          return;
        }
      } else {
        const saved = await api.saveDealer(dealerToSave);
        if (!saved) {
          showError("Failed to save dealer");
          return;
        }
      }

      setDealers(await api.getDealers());
      setEditingDealer(null);
      showSuccess(editingDealer.id ? "Dealer updated" : "Dealer saved");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800">Dealer Management</h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'officer')}>
              <SelectTrigger className="w-full sm:w-48 h-10"><SelectValue placeholder="Sort By" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="officer">Sort by Officer</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={!!editingDealer} onOpenChange={(open) => !open && setEditingDealer(null)}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingDealer({ name: '', address: '', phone: '', officerId: '', balance: 0 })} className="bg-slate-900 w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Add Dealer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDealer?.id ? 'Edit Dealer' : 'Add New Dealer'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Dealer Name</Label>
                    <Input value={editingDealer?.name} onChange={e => setEditingDealer({...editingDealer, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={editingDealer?.address} onChange={e => setEditingDealer({...editingDealer, address: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input value={editingDealer?.phone} onChange={e => setEditingDealer({...editingDealer, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Officer</Label>
                    <Select 
                      value={editingDealer?.officerId} 
                      onValueChange={v => setEditingDealer({...editingDealer, officerId: v})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Officer" />
                      </SelectTrigger>
                      <SelectContent>
                        {officers.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-slate-900" onClick={handleSave}>Save Dealer</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            {isMobile ? (
              <div className="space-y-4 p-4">
                {sortedDealers.map((d) => {
                  const targetRows = dealerTargetRows(d.id);
                  const grantedCount = targetRows.filter(t => t.rewardGranted).length;
                  const currentBalance = dealerBalanceMap[d.id] || 0;
                  const balanceLabel = `${currentBalance >= 0 ? '+' : '-'}৳${Math.abs(currentBalance).toLocaleString()}`;
                  return (
                    <Card key={d.id} className="border border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-bold text-slate-900">{d.name}</h3>
                              <div className="text-xs text-slate-400 flex items-center mt-1">
                                <MapPin className="w-3 h-3 mr-1" /> {d.address}
                              </div>
                              <div className="text-xs text-slate-600 flex items-center mt-1">
                                <Phone className="w-3 h-3 mr-1" /> {d.phone}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                {(d.officerName || 'U').charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-slate-700">{d.officerName || 'Unassigned'}</span>
                            </div>
                          </div>
                          {targetRows.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-slate-500 uppercase">Active Targets</div>
                              {targetRows.map(row => (
                                <div key={row.id} className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                  <span>{row.label} {row.type === 'amount' ? `৳${row.current.toLocaleString()}` : row.current} / {row.type === 'amount' ? `৳${row.target.toLocaleString()}` : row.target}</span>
                                  {row.eligibleCycles > 0 && (
                                    <Button
                                      size="sm"
                                      className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                                      onClick={() => handleDisburseReward(d.id, row.id, d.officerId, d.officerName)}
                                    >
                                      Eligible x{row.eligibleCycles}
                                    </Button>
                                  )}
                                </div>
                              ))}
                              {grantedCount > 0 && (
                                <div className="text-xs font-black text-emerald-600 uppercase">
                                  Reward Granted x{grantedCount}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <div className={cn("font-black text-sm", currentBalance < 0 ? 'text-red-600' : 'text-green-600')}>
                              Balance: {balanceLabel}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingDealer(d)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteDealer(d.id); setDealers(await api.getDealers()); } }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/30">
                    <TableHead className="text-xs font-bold uppercase">Dealer Name</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Contact Info</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Assigned Officer</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Active Targets</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Current Balance</TableHead>
                    <TableHead className="text-right text-xs font-bold uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDealers.map((d) => (
                    (() => {
                      const targetRows = dealerTargetRows(d.id);
                      const grantedCount = targetRows.filter(t => t.rewardGranted).length;
                      const currentBalance = dealerBalanceMap[d.id] || 0;
                    const balanceLabel = `${currentBalance >= 0 ? '+' : '-'}৳${Math.abs(currentBalance).toLocaleString()}`;
                    return (
                      <TableRow key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell>
                        <div className="font-bold text-slate-900">{d.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center uppercase tracking-tighter"><MapPin className="w-3 h-3 mr-1" /> {d.address}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium flex items-center"><Phone className="w-3 h-3 mr-1 text-slate-400" /> {d.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {(d.officerName || 'U').charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-slate-700">{d.officerName || 'Unassigned'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {targetRows.length === 0 ? (
                          <span className="text-[10px] text-slate-400 font-bold uppercase">No active target</span>
                        ) : (
                          <div className="space-y-1">
                            {targetRows.map(row => (
                              <div key={row.id} className="text-[10px] font-bold text-slate-700 flex items-center justify-between gap-2">
                                <span>
                                  {row.label} {row.type === 'amount' ? `৳${row.current.toLocaleString()}` : row.current} / {row.type === 'amount' ? `৳${row.target.toLocaleString()}` : row.target}
                                </span>
                                {row.eligibleCycles > 0 ? (
                                  <Button
                                    size="sm"
                                    className="h-6 px-2 text-[9px] bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleDisburseReward(d.id, row.id, d.officerId, d.officerName)}
                                  >
                                    Target Eligible x{row.eligibleCycles}
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                            {grantedCount > 0 && (
                              <div className="text-[10px] font-black text-emerald-600 uppercase">
                                Reward Granted x{grantedCount}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={cn("font-black", currentBalance < 0 ? 'text-red-600' : 'text-green-600')}>
                        {balanceLabel}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingDealer(d)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={async () => { if(confirm('Delete?')) { await api.deleteDealer(d.id); setDealers(await api.getDealers()); } }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                      );
                    })()
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dealers;