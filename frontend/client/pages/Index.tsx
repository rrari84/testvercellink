import { useState } from 'react';
import { Header } from '@/components/trading/Header';
import { TradingPanel } from '@/components/trading/TradingPanel';
import { PasskeyAuth } from '@/components/trading/PasskeyAuth';
import { VaultPanel } from '@/components/trading/VaultPanel'; // You'll need to create this
import { TradingChart } from '@/components/trading/TradingChart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Index() {
  const [activeTab, setActiveTab] = useState('trading');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex h-[calc(100vh-56px)]">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Chart Section */}
          <div className="flex-1 p-3">
            <div className="h-full bg-card border border-border rounded">
              {/* Chart Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center space-x-4">
                  <h3 className="font-medium text-foreground">BTC-USD Perpetual</h3>
                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <span>Collateral:</span>
                      <span className="text-purple-400 font-medium">KALE</span>
                    </div>
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <span>Oracle</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-xs">
                    <div className="w-2 h-2 bg-buy rounded-full animate-pulse"></div>
                    <span className="text-muted-foreground">Live</span>
                  </div>
                </div>
              </div>
              
              {/* Chart Container */}
              <div className="h-[calc(100%-73px)]">
                <TradingChart />
              </div>
            </div>
          </div>
          
          {/* Market Data Section */}
          <div className="h-48 p-3 pt-0">
            <div className="h-full bg-card border border-border rounded">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground">BTC-USD Market Data</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">24h High</div>
                    <div className="font-mono text-lg font-medium text-foreground">$46,250</div>
                    <div className="text-xs text-positive">+2.1%</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">24h Low</div>
                    <div className="font-mono text-lg font-medium text-foreground">$44,180</div>
                    <div className="text-xs text-sell">-1.8%</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">24h Volume</div>
                    <div className="font-mono text-lg font-medium text-foreground">$2.45B</div>
                    <div className="text-xs text-muted-foreground">+18.3%</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">Open Interest</div>
                    <div className="font-mono text-lg font-medium text-foreground">$125.8M</div>
                    <div className="text-xs text-muted-foreground">+5.2%</div>
                  </div>
                </div>
                
                {/* Collateral Info */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">KALE Price</div>
                      <div className="font-mono text-sm font-medium text-foreground">$0.0450</div>
                      <div className="text-xs text-positive">+1.2%</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Collateral Rate</div>
                      <div className="font-mono text-sm font-medium text-purple-400">22.22 KALE = $1</div>
                      <div className="text-xs text-muted-foreground">Updated 2s ago</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Total Value Locked</div>
                      <div className="font-mono text-sm font-medium text-foreground">$45.2M</div>
                      <div className="text-xs text-muted-foreground">1.003B KALE</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Sidebar with Tabs */}
        <div className="w-80 border-l border-border bg-background flex flex-col">
          <div className="flex-1 p-3 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
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

              <div className="h-[calc(100%-40px)]">
                <TabsContent value="trading" className="mt-0 space-y-3">
                  <TradingPanel />
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
    </div>
  );
}