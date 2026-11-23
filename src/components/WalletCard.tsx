import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wallet, Smartphone, Check, AlertCircle, ArrowUpRight, ShieldAlert, X } from 'lucide-react';
import { BKashIcon, NagadIcon } from './BrandIcons';

interface WalletCardProps {
  onClose?: () => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({ onClose }) => {
  const { wallet, updateWalletBinding } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [provider, setProvider] = useState<'bKash' | 'Nagad'>(wallet?.walletProvider || 'bKash');
  const [phone, setPhone] = useState(wallet?.walletNumber || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // BD Phone validation: 01[3-9]...
    const clean = phone.trim().replace(/[-\s]/g, '');
    const regex = /^(?:\+?88)?01[3-9]\d{8}$/;
    if (!regex.test(clean)) {
      setErrorMsg('সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01712345678)');
      return;
    }

    setIsSaving(true);
    const ok = await updateWalletBinding(provider, clean);
    setIsSaving(false);

    if (ok) {
      setSuccessMsg(`${provider} ওয়ালেট সফলভাবে সংযুক্ত হয়েছে!`);
      setIsEditing(false);
    } else {
      setErrorMsg('ওয়ালেট আপডেট করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-emerald-900 text-white rounded-2xl p-6 shadow-sm border border-emerald-700/50 relative overflow-hidden backdrop-blur-md">
      {/* Soft ambient emerald lighting */}
      <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-8 -top-8 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        
        {/* Header & MFS provider status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-emerald-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-900/70 backdrop-blur-md rounded-xl border border-emerald-700/50 text-emerald-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-emerald-300/80 font-semibold uppercase tracking-wider block">ক্রিয়েটর ওয়ালেট</span>
              <span className="text-sm font-bold text-white">টুলপত্র পে-আউট অ্যাকাউন্ট</span>
            </div>
          </div>

          {/* Bound provider status or Link button + optional Close button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {wallet?.walletNumber ? (
              <div className="flex items-center gap-2 bg-emerald-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-700/50">
                {wallet.walletProvider === 'bKash' ? (
                  <BKashIcon className="w-4 h-4 rounded shrink-0" />
                ) : (
                  <NagadIcon className="w-4 h-4 rounded shrink-0" />
                )}
                <span className="text-emerald-100">{wallet.walletProvider}</span>
                <span className="font-mono text-emerald-300/80">••••{wallet.walletNumber.slice(-4)}</span>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/50"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>বিকাশ / নগদ লিংক করুন</span>
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="ওয়ালেট বন্ধ করুন"
                className="p-2 rounded-lg text-emerald-300/80 hover:text-white hover:bg-emerald-800/60 border border-emerald-700/40 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Balance Grid (Translucent Glass Panels) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Available Withdrawable */}
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-700/40">
            <span className="text-xs text-emerald-200/80 font-medium block mb-1">উত্তোলনযোগ্য ব্যালেন্স</span>
            <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-baseline gap-1 tabular-nums">
              <span className="text-lg font-bold text-emerald-400">৳</span>
              <span>{wallet?.availableBalance.toLocaleString() || '0.00'}</span>
            </div>
            <span className="text-[11px] text-emerald-300/70 mt-1 block">এমএফএস বিতরণের জন্য প্রস্তুত</span>
          </div>

          {/* Pending / Held Balance */}
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-700/40">
            <span className="text-xs text-amber-200/90 font-medium block mb-1 flex items-center gap-1">
              হোল্ড / রিভিউ ব্যালেন্স
              {wallet && wallet.pendingBalance > 0 && (
                <ShieldAlert className="w-3 h-3 text-amber-300" />
              )}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-amber-300 tracking-tight flex items-baseline gap-1 tabular-nums">
              <span className="text-lg font-bold text-amber-400">৳</span>
              <span>{wallet?.pendingBalance.toLocaleString() || '0.00'}</span>
            </div>
            <span className="text-[11px] text-emerald-300/70 mt-1 block">&gt;২০k ভিউজ ও হাই-ভ্যালু রিভিউ</span>
          </div>

          {/* Lifetime Total Earned */}
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-xl p-4 border border-emerald-700/40">
            <span className="text-xs text-teal-200/80 font-medium block mb-1">সর্বমোট অর্জিত আয়</span>
            <div className="text-2xl sm:text-3xl font-bold text-teal-100 tracking-tight flex items-baseline gap-1 tabular-nums">
              <span className="text-lg font-bold text-teal-300">৳</span>
              <span>{wallet?.totalEarned.toLocaleString() || '0.00'}</span>
            </div>
            <span className="text-[11px] text-emerald-300/70 mt-1 block">ইউজিসি ক্যাম্পেইন থেকে সর্বমোট</span>
          </div>
        </div>

        {/* Wallet binding form toggle */}
        {isEditing ? (
          <form onSubmit={handleSave} className="bg-emerald-950/80 backdrop-blur-md p-4 rounded-xl border border-emerald-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-100">মোবাইল ফাইন্যান্সিয়াল সার্ভিস (MFS) লিংক করুন</span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-emerald-300/70 hover:text-white cursor-pointer"
              >
                বাতিল
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProvider('bKash')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  provider === 'bKash'
                    ? 'bg-pink-600/30 text-pink-200 border-pink-400'
                    : 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40 hover:bg-emerald-900/60'
                }`}
              >
                <BKashIcon className="w-4 h-4 rounded shrink-0" />
                <span>bKash (বিকাশ)</span>
              </button>
              <button
                type="button"
                onClick={() => setProvider('Nagad')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  provider === 'Nagad'
                    ? 'bg-amber-600/30 text-amber-200 border-amber-400'
                    : 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40 hover:bg-emerald-900/60'
                }`}
              >
                <NagadIcon className="w-4 h-4 rounded shrink-0" />
                <span>Nagad (নগদ)</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] text-emerald-200 block mb-1">
                ১১ ডিজিটের ওয়ালেট নম্বর:
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="017XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 bg-emerald-950 border border-emerald-700/60 rounded-lg px-3 py-2 text-sm text-white placeholder-emerald-400/40 focus:outline-hidden focus:ring-1 focus:ring-emerald-400 font-mono"
                  maxLength={11}
                  required
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errorMsg}
              </p>
            )}
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-200/80 pt-2 border-t border-emerald-800/60 gap-2">
            <span>
              {wallet?.walletNumber
                ? `আপনার রিওয়ার্ড স্বয়ংক্রিয়ভাবে ${wallet.walletProvider} অ্যাকাউন্ট (${wallet.walletNumber})-এ ক্রেডিট হবে।`
                : 'কোনো ওয়ালেট যুক্ত করা নেই। স্বয়ংক্রিয় পেমেন্ট পেতে বিকাশ বা নগদ লিংক করুন।'}
            </span>
            <button
              onClick={() => {
                setProvider(wallet?.walletProvider || 'bKash');
                setPhone(wallet?.walletNumber || '');
                setIsEditing(true);
              }}
              className="text-emerald-300 hover:text-white font-semibold flex items-center gap-0.5 cursor-pointer self-start sm:self-auto"
            >
              <span>{wallet?.walletNumber ? 'পরিবর্তন করুন' : 'লিংক করুন'}</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {successMsg && (
          <p className="text-xs text-emerald-300 font-medium mt-2 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            {successMsg}
          </p>
        )}

      </div>
    </div>
  );
};
