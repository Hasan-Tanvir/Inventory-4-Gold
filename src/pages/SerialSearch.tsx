"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, OrderItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, User, Calendar, MapPin, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const SerialSearch = () => {
  const [serial, setSerial] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [searched, setSearched] = useState(false);
  const [allSerials, setAllSerials] = useState<string[]>([]);

  useEffect(() => {
    setAllSerials(api.getAllSerials());
  }, []);

  const handleInputChange = (val: string) => {
    setSerial(val);
    if (val.length > 1) {
      const filtered = allSerials.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = (searchVal?: string) => {
    const finalVal = searchVal || serial;
    if (!finalVal) return;
    setResult(api.searchBySerial(finalVal));
    setSearched(true);
    setSuggestions([]);
    setSerial(finalVal);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Search Product by Serial Number</CardTitle></CardHeader>
          <CardContent className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input 
                  placeholder="Enter Serial Number..." 
                  value={serial} 
                  onChange={e => handleInputChange(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                  className="h-11"
                />
                {suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
                    {suggestions.map(s => (
                      <button 
                        key={s} 
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                        onClick={() => handleSearch(s)}
                      >
                        <History className="w-3 h-3 text-slate-400" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => handleSearch()} className="h-11 px-6 bg-slate-900"><Search className="w-4 h-4 mr-2" /> Search</Button>
            </div>
          </CardContent>
        </Card>

        {searched && result ? (
          <Card className="border-none shadow-sm bg-green-50/50">
            <CardHeader><CardTitle className="text-green-800 flex items-center text-sm font-bold uppercase tracking-wider"><Package className="w-5 h-5 mr-2" /> Product Found</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Product</p>
                  <p className="font-black text-lg text-slate-900">{result.item.productName}</p>
                  <p className="text-xs text-slate-500">{result.item.version}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Order ID</p>
                  <p className="font-black text-lg text-slate-900">{result.order.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center"><User className="w-3 h-3 mr-1" /> Customer</p>
                  <p className="font-bold text-slate-800">{result.order.customerName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center"><Calendar className="w-3 h-3 mr-1" /> Date</p>
                  <p className="font-bold text-slate-800">{result.order.date}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center"><MapPin className="w-3 h-3 mr-1" /> Location</p>
                  <p className="font-bold text-slate-800 capitalize">{result.item.location}</p>
                </div>
              </div>
              <div className="pt-6 border-t border-green-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-3">Batch Serials</p>
                <div className="flex flex-wrap gap-2">
                  {result.item.serialNumbers?.map(s => (
                    <span key={s} className={cn("px-2 py-1 rounded text-[10px] font-bold", s.toLowerCase() === serial.toLowerCase() ? "bg-green-600 text-white" : "bg-white border border-green-200 text-green-700")}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : searched && (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No product found with serial number: <span className="font-bold text-slate-800">{serial}</span></p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SerialSearch;