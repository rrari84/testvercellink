import { useState, useEffect } from 'react';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Droplets, Coins, DollarSign } from 'lucide-react';

export function VaultPanel() {
  const {
    vaultInfo,
    vaultLoading,
    isConnected,
    balance,
    loadVaultInfo,
    depositToVault,
    withdrawFromVault
  } = useTradingStore();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  // Load vault info on component mount
  useEffect(() => {
    if (isConnected) {
      loadVaultInfo();
    }
  }, [isConnected, loadVaultInfo]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    
    setLoading(true);
    try {
      const result = await depositToVault(parseFloat(depositAmount));
      if (result.success) {
        setDepositAmount('');
        console.log('Deposit successful');
      } else {
        console.error('Deposit failed:', result.error);
      }
    } catch (error) {
      console.error('Deposit error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    
    setLoading(true);
    try {
      const result = await withdrawFromVault(parseFloat(withdrawAmount));
      if (result.success) {
        setWithdrawAmount('');
        console.log('Withdrawal successful');
      } else {
        console.error('Withdrawal failed:', result.error);
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUserValue = () => {
    if (!vaultInfo || vaultInfo.totalShares === 0) return 0;
    return (vaultInfo.userShares / vaultInfo.totalShares) * vaultInfo.totalLiquidity;
  };

  const getMaxWithdraw = () => {
    return calculateUserValue();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Vault Overview */}
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Droplets className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">Liquidity Vault</h3>
            {vaultLoading && (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Vault Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface rounded p-3">
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Liquidity</span>
              </div>
              <div className="font-mono text-sm font-medium text-foreground">
                {vaultInfo ? formatCurrency(vaultInfo.totalLiquidity) : '--'}
              </div>
            </div>

            <div className="bg-surface rounded p-3">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp className="h-3 w-3 text-positive" />
                <span className="text-xs text-muted-foreground">APY</span>
              </div>
              <div className="font-mono text-sm font-medium text-positive">
                {vaultInfo ? `${vaultInfo.apy.toFixed(1)}%` : '--'}
              </div>
            </div>

            <div className="bg-surface rounded p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Coins className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Your Position</span>
              </div>
              <div className="font-mono text-sm font-medium text-foreground">
                {vaultInfo ? formatCurrency(calculateUserValue()) : '--'}
              </div>
            </div>

            <div className="bg-surface rounded p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Droplets className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Your Shares</span>
              </div>
              <div className="font-mono text-sm font-medium text-foreground">
                {vaultInfo ? formatNumber(vaultInfo.userShares) : '--'}
              </div>
            </div>
          </div>

          {/* User Position Summary */}
          {vaultInfo && vaultInfo.userShares > 0 && (
            <div className="bg-positive/5 border border-positive/10 rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Active Position</div>
                  <div className="text-xs text-muted-foreground">
                    {((vaultInfo.userShares / vaultInfo.totalShares) * 100).toFixed(2)}% of total vault
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-foreground">
                    {formatCurrency(calculateUserValue())}
                  </div>
                  <div className="text-xs text-positive">
                    ~{formatCurrency(calculateUserValue() * (vaultInfo.apy / 100))} yearly
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deposit/Withdraw Form */}
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Manage Liquidity</h3>
        </div>

        <div className="p-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'deposit' | 'withdraw')}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger 
                value="deposit" 
                className="text-xs data-[state=active]:bg-buy data-[state=active]:text-white"
              >
                Deposit
              </TabsTrigger>
              <TabsTrigger 
                value="withdraw" 
                className="text-xs data-[state=active]:bg-sell data-[state=active]:text-white"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="deposit-amount" className="text-xs text-muted-foreground">
                      Deposit Amount (USD)
                    </Label>
                    <button
                      onClick={() => setDepositAmount(balance.toString())}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Max
                    </button>
                  </div>
                  <Input
                    id="deposit-amount"
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-8 text-xs font-mono"
                    step="0.01"
                  />
                  <div className="text-xs text-muted-foreground">
                    Available: {formatCurrency(balance)}
                  </div>
                </div>

                {/* Deposit Preview */}
                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <div className="bg-surface rounded p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Deposit Amount</span>
                      <span className="font-mono text-foreground">{formatCurrency(parseFloat(depositAmount))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Est. Shares Received</span>
                      <span className="font-mono text-foreground">
                        {vaultInfo ? formatNumber((parseFloat(depositAmount) / vaultInfo.totalLiquidity) * vaultInfo.totalShares) : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Est. Annual Earnings</span>
                      <span className="font-mono text-positive">
                        {vaultInfo ? formatCurrency(parseFloat(depositAmount) * (vaultInfo.apy / 100)) : '--'}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleDeposit}
                  disabled={!isConnected || loading || !depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > balance}
                  className="w-full h-9 text-xs font-medium bg-buy hover:bg-buy/90 text-white"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                      Depositing...
                    </>
                  ) : (
                    `Deposit ${depositAmount || '0'} USD`
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="withdraw" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="withdraw-amount" className="text-xs text-muted-foreground">
                      Withdraw Amount (USD)
                    </Label>
                    <button
                      onClick={() => setWithdrawAmount(getMaxWithdraw().toString())}
                      className="text-xs text-primary hover:text-primary/80"
                    >
                      Max
                    </button>
                  </div>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="h-8 text-xs font-mono"
                    step="0.01"
                  />
                  <div className="text-xs text-muted-foreground">
                    Available: {formatCurrency(getMaxWithdraw())}
                  </div>
                </div>

                {/* Withdraw Preview */}
                {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                  <div className="bg-surface rounded p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Withdraw Amount</span>
                      <span className="font-mono text-foreground">{formatCurrency(parseFloat(withdrawAmount))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Shares to Burn</span>
                      <span className="font-mono text-foreground">
                        {vaultInfo ? formatNumber((parseFloat(withdrawAmount) / vaultInfo.totalLiquidity) * vaultInfo.totalShares) : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Remaining Position</span>
                      <span className="font-mono text-foreground">
                        {formatCurrency(getMaxWithdraw() - parseFloat(withdrawAmount))}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleWithdraw}
                  disabled={!isConnected || loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > getMaxWithdraw()}
                  className="w-full h-9 text-xs font-medium bg-sell hover:bg-sell/90 text-white"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                      Withdrawing...
                    </>
                  ) : (
                    `Withdraw ${withdrawAmount || '0'} USD`
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Vault Information */}
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">How It Works</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">1</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Provide Liquidity</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deposit USD to provide liquidity for KALE trading. Your funds help maintain price stability.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">2</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Earn Rewards</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Receive vault shares that earn trading fees and oracle rewards automatically.
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-medium text-primary">3</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">Withdraw Anytime</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your shares can be redeemed for USD plus earned rewards at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}