import { useState } from 'react';
import { Header } from './Header';
import { TradingChart } from './TradingChart';
import { PasskeyTradingPanel } from './PasskeyTradingPanel';
import { PasskeyAuth } from './PasskeyAuth';
import { VaultPanel } from './VaultPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TradingLayout() {
  const [activeTab, setActiveTab] = useState('trading');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex h-[calc(100vh-64px)]">
        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6">
          {/* Chart Section */}
          <div className="h-[60%]">
            <TradingChart />
          </div>
          
          {/* Bottom Market Data Section */}
          <div className="h-[40%] bg-panel-bg rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-6">BTC-USD Market Data</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">24H HIGH</p>
                <p className="text-2xl font-mono font-bold text-green-500">$46,250</p>
                <p className="text-sm text-green-500">+2.1%</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">24H LOW</p>
                <p className="text-2xl font-mono font-bold text-red-500">$44,180</p>
                <p className="text-sm text-red-500">-1.8%</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">24H VOLUME</p>
                <p className="text-2xl font-mono font-bold text-foreground">$2.45B</p>
                <p className="text-sm text-green-500">+18.3%</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">OPEN INTEREST</p>
                <p className="text-2xl font-mono font-bold text-foreground">$125.8M</p>
                <p className="text-sm text-green-500">+5.2%</p>
              </div>
            </div>

            {/* Additional Market Info */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">KALE PRICE</p>
                <p className="text-lg font-mono font-semibold text-foreground">$0.0450</p>
                <p className="text-sm text-green-500">+1.2%</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">COLLATERAL RATE</p>
                <p className="text-lg font-mono font-semibold text-foreground">22.22 KALE = $1</p>
                <p className="text-xs text-muted-foreground">Updated 2s ago</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">TOTAL VALUE LOCKED</p>
                <p className="text-lg font-mono font-semibold text-foreground">$45.2M</p>
                <p className="text-xs text-muted-foreground">1.003B KALE</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar */}
        <div className="w-96 p-6 border-l border-border bg-background">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="trading" className="text-xs">
                Trading
              </TabsTrigger>
              <TabsTrigger value="vault" className="text-xs">
                Vault
              </TabsTrigger>
              <TabsTrigger value="auth" className="text-xs">
                Security
              </TabsTrigger>
            </TabsList>

            <div className="h-[calc(100%-40px)] overflow-y-auto">
              <TabsContent value="trading" className="mt-0 space-y-6">
                <PasskeyTradingPanel />
              </TabsContent>

              <TabsContent value="vault" className="mt-0">
                <VaultPanel />
              </TabsContent>

              <TabsContent value="auth" className="mt-0">
                <PasskeyAuth />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}