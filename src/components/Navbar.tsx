import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Wallet, LogIn, LogOut, Video, Activity } from 'lucide-react';

interface NavbarProps {
  currentTab: 'creator' | 'admin' | 'health';
  setCurrentTab: (tab: 'creator' | 'admin' | 'health') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, wallet, isAdmin, loginWithGoogle, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-emerald-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand Wordmark with Toolpotro Signature Emerald Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 via-teal-600 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-sm border border-emerald-500/30">
              ট
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-950 text-base sm:text-lg tracking-tight">Toolpotro</span>
                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-emerald-200">
                  Creators
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono hidden sm:block leading-none">
                creators.toolpotro.com
              </div>
            </div>
          </div>

          {/* Zone 2: Navigation Links — Creators only see ক্যাম্পেইন হাব; Admin sees Admin Panel & System Monitor */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setCurrentTab('creator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                currentTab === 'creator'
                  ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                  : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>ক্যাম্পেইন হাব</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setCurrentTab('admin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                    currentTab === 'admin'
                      ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                      : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>অ্যাডমিন প্যানেল</span>
                </button>

                <button
                  onClick={() => setCurrentTab('health')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer border ${
                    currentTab === 'health'
                      ? 'bg-emerald-500/15 text-emerald-950 border-emerald-500/40 shadow-xs backdrop-blur-xs font-bold'
                      : 'border-transparent text-slate-600 hover:text-emerald-900 hover:bg-emerald-500/10'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">সিস্টেম মনিটর</span>
                </button>
              </>
            )}
          </nav>

          {/* Zone 3: Account & Quick Balance */}
          <div className="flex items-center gap-3 shrink-0">
            {currentUser && wallet && (
              <div className="hidden lg:flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-semibold text-emerald-950">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="tabular-nums font-bold">৳{wallet.availableBalance.toLocaleString()}</span>
                {wallet.pendingBalance > 0 && (
                  <span className="text-amber-700 text-[10px] tabular-nums font-normal">
                    (+৳{wallet.pendingBalance.toLocaleString()} হোল্ড)
                  </span>
                )}
              </div>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-emerald-200 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google লগইন</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
