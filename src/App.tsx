import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { CreatorDashboard } from './pages/CreatorDashboard';
import { AdminPanel } from './pages/AdminPanel';
import { LiveHealthMonitor } from './components/LiveHealthMonitor';
import { Campaign } from './types';
import { syncAllCampaignsToFirestore } from './services/firestoreSync';
import { authFetch } from './utils/authFetch';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<'creator' | 'admin' | 'health'>('creator');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const { isAdmin, currentUser, hydrationVersion, authError } = useAuth();

  useEffect(() => {
    if (!isAdmin && currentTab !== 'creator') {
      setCurrentTab('creator');
    }
  }, [isAdmin, currentTab]);

  const fetchCampaigns = async () => {
    try {
      const res = await authFetch('/api/campaigns');
      if (res.ok) {
        const data: Campaign[] = await res.json();
        setCampaigns(data);
        if (currentUser && isAdmin) {
          void syncAllCampaignsToFirestore(data);
        }
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [hydrationVersion, currentUser?.uid, isAdmin]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans selection:bg-emerald-700 selection:text-white">
      
      {/* Top Sticky Navigation */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {authError && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold px-4 py-2.5 rounded-xl">
            {authError}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'creator' && (
          <CreatorDashboard campaigns={campaigns} />
        )}

        {isAdmin && currentTab === 'admin' && (
          <AdminPanel
            campaigns={campaigns}
            onRefreshCampaigns={fetchCampaigns}
          />
        )}

        {isAdmin && currentTab === 'health' && (
          <div className="space-y-6">
            <LiveHealthMonitor />
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-950 text-base">আর্কিটেকচার ও নির্ভরযোগ্যতা নীতিমালা</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-950 block text-sm">Anti-Fraud & Penalty Engine</span>
                  <p className="leading-relaxed">
                    লাইক-টু-ভিউ ও কমেন্ট-টু-ভিউ রেশিও স্বয়ংক্রিয়ভাবে যাচাই করা হয়। টাইম-অ্যানোমালি বট ও ক্লিক-ফার্মিং ডিটেকশন স্প্যাম ভিউজ প্রতিরোধ করে।
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-950 block text-sm">Gemini AI Transcription (Temp = 0)</span>
                  <p className="leading-relaxed">
                    বাংলা ও ইংরেজি উভয় ভাষায় ব্র্যান্ড কিওয়ার্ড (যেমন: <em>টুলপত্র, Toolpotro</em>) এবং নির্ধারিত ডায়লগ নিশ্চিত করে। নয়েজি অডিওর ক্ষেত্রে সরাসরি ম্যানুয়াল রিভিউ কিউতে পাঠায়।
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-950 block text-sm">Sequential Task Queue</span>
                  <p className="leading-relaxed">
                    ইন-মেমোরি টাস্ক কিউ প্রতিটি সাবমিশন এক এক করে প্রসেস করে, যা কোনো সার্ভার মেমরি ওভারলোড বা সিপিইউ স্পাইক হতে দেয় না।
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="font-bold text-slate-950 block text-sm">1-Click Manual Payout Credit</span>
                  <p className="leading-relaxed">
                    রিভিউতে থাকা ভিডিওগুলো অ্যাডমিন ১-ক্লিকে "Approve (ওকে)" করলে তাৎক্ষণিকভাবে ক্রিয়েটরের বিকাশ/নগদ ওয়ালেটে ব্যালেন্স জমা হয়।
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-950">Toolpotro Creators Network</span>
            <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              creators.toolpotro.com
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            টুলপত্র ই-কমার্স ক্রিয়েটর নেটওয়ার্ক • সর্বস্বত্ব সংরক্ষিত
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
