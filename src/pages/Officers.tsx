"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Officer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';

const Officers = () => {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [tab, setTab] = useState<'officers' | 'tokens'>('officers');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>({ name: '', designation: '' });
  const [editToken, setEditToken] = useState<any | null>(null);
  const [filterOfficer, setFilterOfficer] = useState('all');

  const load = async () => {
    setOfficers(await api.getOfficers());
    setTokens(await api.getCommissionTokens().sort((a, b) => b.date.localeCompare(a.date)));
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ name: '', designation: '' });
    setModal(true);
  };

  const openEdit = (o: Officer) => {
    setForm({ ...o });
    setModal(true);
  };

  const save = async () => {
    if (!form.name?.trim()) return showError('Officer name is required');

    const officerId = form.id || `OFF-${Date.now()}`;
    const existing = officers.find(o => o.id === officerId);
    await api.saveOfficer({
      id: officerId,
      name: form.name.trim(),
      designation: form.designation || '',
      phone: existing?.phone || form.phone || '',
      commissionBalance: existing?.commissionBalance || form.commissionBalance || 0,
      clearanceHistory: existing?.clearanceHistory || form.clearanceHistory || [],
      commissionTokens: existing?.commissionTokens || form.commissionTokens || []
    });

    setModal(false);
    await load();
    showSuccess('Officer saved');
  };

  const del = async (id: string) => {
    if (!confirm('Delete officer?')) return;
    await api.deleteOfficer(id);
    await load();
  };

  const disburse = async (token: any) => {
    if (!confirm(`Mark ৳${token.amount.toLocaleString()} as disbursed to ${token.officerName}?`)) return;
    const result = await api.disburseCommissionToken(token.id);
    if (!result.success) return showError(result.message || 'Could not disburse token');
    await load();
  };

  const undoDisburse = async (token: any) => {
    if (!confirm('Undo disbursement?')) return;
    const result = await api.undoCommissionTokenDisbursement(token.id);
    if (!result.success) return showError(result.message || 'Could not undo disbursement');
    await load();
  };

  const saveEditToken = async () => {
    if (!editToken) return;
    const success = await api.updateCommissionToken(editToken.id, {
      amount: Number(editToken.amount) || 0,
      status: editToken.status
    });
    if (!success) return showError('Could not update token');
    setEditToken(null);
    await load();
  };

  const deleteToken = async (token: any) => {
    if (!confirm('Delete this token?')) return;
    const success = await api.deleteCommissionToken(token.id);
    if (!success) return showError('Could not delete token');
    await load();
  };

  const filtered = filterOfficer === 'all' ? tokens : tokens.filter(t => t.officerId === filterOfficer);
  const pendingTotal = filtered.filter(t => t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0);
  const disbursedTotal = filtered.filter(t => t.status === 'disbursed').reduce((s, t) => s + (t.amount || 0), 0);

  const officerSummary = useMemo(() => officers.map(o => {
    const oTokens = tokens.filter(t => t.officerId === o.id);
    const pending = oTokens.filter(t => t.status === 'pending').reduce((s, t) => s + (t.amount || 0), 0);
    const disbursed = oTokens.filter(t => t.status === 'disbursed').reduce((s, t) => s + (t.amount || 0), 0);
    return { ...o, pendingCommission: pending, disbursedCommission: disbursed, tokenCount: oTokens.length };
  }), [officers, tokens]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Officers</h1>
          {tab === 'officers' && <Button onClick={openAdd}>+ Add Officer</Button>}
        </div>

        <div className="flex gap-1 bg-white rounded-lg shadow-sm p-1 w-fit">
          <button onClick={() => setTab('officers')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'officers' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Officers</button>
          <button onClick={() => setTab('tokens')} className={`px-4 py-2 rounded text-sm font-medium ${tab === 'tokens' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Commission Tokens</button>
        </div>

        {tab === 'officers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {officerSummary.map(o => (
              <Card key={o.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{o.name}</CardTitle>
                  <p className="text-xs text-slate-500">{o.designation}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-50 p-2 rounded text-center text-xs">Pending: ৳{o.pendingCommission.toLocaleString()}</div>
                    <div className="bg-green-50 p-2 rounded text-center text-xs">Disbursed: ৳{o.disbursedCommission.toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => del(o.id)}>Del</Button>
                    {!!o.tokenCount && <Button size="sm" variant="ghost" onClick={() => { setFilterOfficer(o.id); setTab('tokens'); }}>Tokens</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === 'tokens' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <select value={filterOfficer} onChange={e => setFilterOfficer(e.target.value)} className="border rounded px-2 py-1">
                <option value="all">All Officers</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <div className="ml-auto text-sm">Pending: ৳{pendingTotal.toLocaleString()} | Disbursed: ৳{disbursedTotal.toLocaleString()}</div>
            </div>
            {filtered.map(token => (
              <div key={token.id} className={`bg-white rounded-xl border-l-4 p-4 ${token.status === 'disbursed' ? 'border-green-400' : 'border-amber-400'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{token.officerName} <span className="text-xs text-slate-500">#{token.orderId}</span></p>
                    <p className="text-xs text-slate-500">Token: {token.date}</p>
                    {token.status === 'disbursed' && token.disbursedDate && (
                      <p className="text-xs text-green-600 font-medium">Disbursed: {token.disbursedDate}</p>
                    )}
                  </div>
                  <p className="font-bold text-amber-700">৳{(token.amount || 0).toLocaleString()}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  {token.status === 'pending' ? (
                    <Button size="sm" onClick={() => disburse(token)}>Disburse</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => undoDisburse(token)}>Undo</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditToken(token)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteToken(token)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={modal} onOpenChange={setModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} Officer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Designation</Label><Input value={form.designation || ''} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} /></div>
              <Button onClick={save}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editToken} onOpenChange={(open) => !open && setEditToken(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Commission Token</DialogTitle></DialogHeader>
            {editToken && (
              <div className="space-y-3">
                <div><Label>Amount</Label><Input type="number" value={editToken.amount} onChange={e => setEditToken((t: any) => ({ ...t, amount: e.target.value }))} /></div>
                <Button onClick={saveEditToken}>Save</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Officers;
