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
          
          {/* Bottom Stats/Info Section */}
          <div className="h-[40%] bg-panel-bg rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Market Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">24h High</p>
                <p className="text-lg font-mono font-semibold text-foreground">$0.0465</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">24h Low</p>
                <p className="text-lg font-mono font-semibold text-foreground">$0.0441</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-lg font-mono font-semibold text-foreground">1.25M</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Market Cap</p>
                <p className="text-lg font-mono font-semibold text-foreground">$45.2M</p>
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