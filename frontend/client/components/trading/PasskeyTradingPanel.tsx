import { useState, useEffect } from 'react';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, TrendingUp, TrendingDown, Shield, AlertCircle, AlertTriangle, ExternalLink } from 'lucide-react';

export function PasskeyTradingPanel() {
  const {
    currentPair,
    passkeyAuth,
    isConnected,
    balance,
    kaleBalance,
    orderType,
    orderSide,
    orderSize,
    orderPrice,
    leverage,
    orderLoading,
    simulationMode,
    setOrderType,
    setOrderSide,
    setOrderSize,
    setOrderPrice,
    setLeverage,
    executeSmartContractTrade,
    positions,
    positionsLoading,
    closePosition,
    authenticateWithPasskey,
    registerPasskey,
    signOutPasskey,
    setSimulationMode,
    refreshBalances,
    // Add these if they exist in your store
    debugContractState,
    checkContractStatus
  } = useTradingStore();

  const [closingPosition, setClosingPosition] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Clear auth error when authentication status changes
  useEffect(() => {
    if (isConnected) {
      setAuthError(null);
    }
  }, [isConnected]);

  const handleAuthenticate = async () => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const result = await authenticateWithPasskey();
      if (!result.success) {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDebugContract = async () => {
    console.log('Starting contract debug...');
    try {
      if (debugContractState) {
        await debugContractState();
      } else {
        console.log('debugContractState not available in store');
      }
    } catch (error) {
      console.error('Debug failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Debug failed');
    }
  };

  const handleCheckContractStatus = async () => {
    console.log('Checking contract status...');
    try {
      if (checkContractStatus) {
        await checkContractStatus();
      } else {
        console.log('checkContractStatus not available in store');
      }
    } catch (error) {
      console.error('Status check failed:', error);
      setAuthError(error instanceof Error ? error.message : 'Status check failed');
    }
  };

  const handleRegister = async () => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const result = await registerPasskey();
      if (!result.success) {
        setAuthError(result.error || 'Registration failed');
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!isConnected) {
      setAuthError('Please authenticate with your passkey first');
      return;
    }
    
    if (!orderSize || parseFloat(orderSize) <= 0) {
      setAuthError('Please enter a valid order size');
      return;
    }

    if (leverage < 1 || leverage > 100) {
      setAuthError('Leverage must be between 1x and 100x');
      return;
    }
    
    setAuthError(null);
    setLastTxHash(null);
    
    try {
      const market = currentPair.baseAsset;
      const isLong = orderSide === 'long';
      
      console.log('Placing order:', { market, isLong, orderSize, leverage });
      
      const result = await executeSmartContractTrade(market, isLong, orderSize, leverage);
      
      if (result.success) {
        setLastTxHash(result.transactionHash || null);
        setOrderSize('');
        setOrderPrice('');
        
        // Refresh balances after successful trade
        setTimeout(() => {
          refreshBalances();
        }, 2000);
      } else {
        setAuthError(result.error || 'Trade failed');
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleClosePosition = async (positionId: string) => {
    setClosingPosition(positionId);
    try {
      const result = await closePosition(positionId);
      if (!result.success && result.error) {
        setAuthError(result.error);
      }
    } finally {
      setClosingPosition(null);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPrice = (price: number) => {
    if (isNaN(price)) return '--';
    return `$${price.toFixed(4)}`;
  };

  const calculateTotal = () => {
    const size = parseFloat(orderSize) || 0;
    const price = orderType === 'market' 
      ? currentPair.price 
      : parseFloat(orderPrice) || currentPair.price;
    return size * price;
  };

  const calculateMarginRequired = () => {
    const total = calculateTotal();
    return total / leverage;
  };

  const calculateLiquidationPrice = (entryPrice: number, leverageValue: number, side: 'long' | 'short') => {
    const liquidationDistance = entryPrice / leverageValue;
    return side === 'long' 
      ? entryPrice - liquidationDistance
      : entryPrice + liquidationDistance;
  };

  const getMaxSize = () => {
    if (orderSide === 'long') {
      const price = orderType === 'market' 
        ? currentPair.price 
        : parseFloat(orderPrice) || currentPair.price;
      const availableBalance = parseFloat(kaleBalance) || 0;
      return price > 0 ? (availableBalance * leverage) / price : 0;
    }
    return 1000; // Mock value for sell
  };

  const leverageOptions = [1, 2, 3, 5, 10, 20, 50];

  return (
    <div className="space-y-6">
      {/* Authentication Status */}
      {!isConnected ? (
        <div className="bg-card border border-border rounded p-4">
          <div className="text-center space-y-4">
            <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-medium text-foreground">Secure Passkey Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Use your device's biometric authentication to trade securely on Stellar testnet
              </p>
            </div>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{authError}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {passkeyAuth.userId ? (
                <Button
                  onClick={handleAuthenticate}
                  disabled={authLoading}
                  className="w-full"
                >
                  {authLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Sign In with Passkey
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleRegister}
                  disabled={authLoading}
                  className="w-full"
                >
                  {authLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Setup Passkey Authentication
                    </>
                  )}
                </Button>
              )}

              <div className="text-xs text-muted-foreground">
                <p>Passkey authentication provides:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Hardware-backed security</li>
                  <li>No passwords to remember</li>
                  <li>Direct Stellar testnet integration</li>
                  <li>Real transaction submission</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
                <span className="text-sm font-medium">Passkey Authenticated</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatAddress(passkeyAuth.stellarPublicKey!)} • Stellar Testnet
              </p>
              <p className="text-xs text-muted-foreground">
                Balance: {kaleBalance} KALE
              </p>
            </div>
            <Button
              onClick={signOutPasskey}
              variant="outline"
              size="sm"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Simulation Mode Toggle */}
{isConnected && (
  <div className="bg-card border border-border rounded p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${simulationMode ? 'bg-orange-500' : 'bg-blue-500'}`} />
          <span className="text-sm font-medium">
            {simulationMode ? 'Demo Mode' : 'Live Trading'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {simulationMode 
            ? 'Simulated transactions for demonstration' 
            : 'Real transactions on Stellar testnet'
          }
        </p>
      </div>
      <Button
        onClick={() => setSimulationMode(!simulationMode)}
        variant={simulationMode ? "default" : "outline"}
        size="sm"
      >
        {simulationMode ? 'Exit Demo' : 'Demo Mode'}
      </Button>
    </div>
    
    {simulationMode && (
      <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-xs">
        <div className="flex items-center space-x-1 text-orange-600 font-medium mb-1">
          <AlertTriangle className="h-3 w-3" />
          <span>Demo Mode Active</span>
        </div>
        <div className="text-orange-700">
          <div>• All transactions are simulated</div>
          <div>• No real blockchain interaction</div>
          <div>• Perfect for testing and demonstrations</div>
        </div>
      </div>
    )}
  </div>
)}



      {/* Last Transaction - Updated */}
{lastTxHash && (
  <div className={`border rounded p-3 ${
    simulationMode ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
  }`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className={`h-2 w-2 rounded-full ${
          simulationMode ? 'bg-orange-500' : 'bg-green-500'
        }`} />
        <span className={`text-sm font-medium ${
          simulationMode ? 'text-orange-700' : 'text-green-700'
        }`}>
          {simulationMode ? 'Demo Transaction' : 'Transaction Successful'}
        </span>
      </div>
      {!simulationMode && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-green-600 hover:text-green-800 flex items-center space-x-1"
        >
          <span>View on Explorer</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
    <p className={`text-xs font-mono mt-1 ${
      simulationMode ? 'text-orange-600' : 'text-green-600'
    }`}>
      {simulationMode && '🎭 '}{formatAddress(lastTxHash)}
    </p>
    {simulationMode && (
      <p className="text-xs text-orange-600 mt-1">
        This is a transaction for demonstration purposes
      </p>
    )}
  </div>
)}

      {/* Trading Form */}
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Leveraged Trading</h3>
            <div className="text-xs text-muted-foreground">
              {formatPrice(currentPair.price)}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Error Display */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>{authError}</span>
              </div>
            </div>
          )}

          {/* Buy/Sell Tabs */}
          <Tabs value={orderSide} onValueChange={(value) => setOrderSide(value as 'long' | 'short')}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger 
                value="long" 
                className="text-xs data-[state=active]:bg-buy data-[state=active]:text-white"
              >
                Long
              </TabsTrigger>
              <TabsTrigger 
                value="short" 
                className="text-xs data-[state=active]:bg-sell data-[state=active]:text-white"
              >
                Short
              </TabsTrigger>
            </TabsList>

            <TabsContent value="long" className="mt-4 space-y-4">
              <OrderForm 
                side="long"
                orderType={orderType}
                orderSize={orderSize}
                orderPrice={orderPrice}
                leverage={leverage}
                currentPrice={currentPair.price}
                balance={parseFloat(kaleBalance)}
                maxSize={getMaxSize()}
                onTypeChange={setOrderType}
                onSizeChange={setOrderSize}
                onPriceChange={setOrderPrice}
                onLeverageChange={setLeverage}
                onSubmit={handlePlaceOrder}
                loading={orderLoading}
                isConnected={isConnected}
                total={calculateTotal()}
                marginRequired={calculateMarginRequired()}
                leverageOptions={leverageOptions}
                onDebugContract={handleDebugContract}
                onCheckContractStatus={handleCheckContractStatus}
              />
            </TabsContent>

            <TabsContent value="short" className="mt-4 space-y-4">
              <OrderForm 
                side="short"
                orderType={orderType}
                orderSize={orderSize}
                orderPrice={orderPrice}
                leverage={leverage}
                currentPrice={currentPair.price}
                balance={parseFloat(kaleBalance)}
                maxSize={getMaxSize()}
                onTypeChange={setOrderType}
                onSizeChange={setOrderSize}
                onPriceChange={setOrderPrice}
                onLeverageChange={setLeverage}
                onSubmit={handlePlaceOrder}
                loading={orderLoading}
                isConnected={isConnected}
                total={calculateTotal()}
                marginRequired={calculateMarginRequired()}
                leverageOptions={leverageOptions}
                onDebugContract={handleDebugContract}
                onCheckContractStatus={handleCheckContractStatus}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      
      
    </div>
  );
}

interface OrderFormProps {
  side: 'long' | 'short';
  orderType: 'market' | 'limit';
  orderSize: string;
  orderPrice: string;
  leverage: number;
  currentPrice: number;
  balance: number;
  maxSize: number;
  leverageOptions: number[];
  onTypeChange: (type: 'market' | 'limit') => void;
  onSizeChange: (size: string) => void;
  onPriceChange: (price: string) => void;
  onLeverageChange: (leverage: number) => void;
  onSubmit: () => void;
  loading: boolean;
  isConnected: boolean;
  total: number;
  marginRequired: number;
  onDebugContract: () => void;
  onCheckContractStatus: () => void;
}


function OrderForm({
  side,
  orderType,
  orderSize,
  orderPrice,
  leverage,
  currentPrice,
  balance,
  maxSize,
  leverageOptions,
  onTypeChange,
  onSizeChange,
  onPriceChange,
  onLeverageChange,
  onSubmit,
  loading,
  isConnected,
  total,
  marginRequired,
  onDebugContract,
  onCheckContractStatus
}: OrderFormProps) {
  const { simulationMode } = useTradingStore(); // Add this to access simulation mode
  
  const liquidationPrice = orderSize ? 
    (side === 'long' ? currentPrice - (currentPrice / leverage) : currentPrice + (currentPrice / leverage)) : 0;

  return (
    <div className="space-y-4">
      {/* Order Type Selector */}
      <div className="flex space-x-1 bg-surface rounded p-1">
        <button
          onClick={() => onTypeChange('market')}
          className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
            orderType === 'market' 
              ? 'bg-background text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Market
        </button>
        <button
          onClick={() => onTypeChange('limit')}
          className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
            orderType === 'limit' 
              ? 'bg-background text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Limit
        </button>
      </div>

      {/* Leverage Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Leverage</Label>
        <div className="grid grid-cols-4 gap-1">
          {leverageOptions.map((lev) => (
            <button
              key={lev}
              onClick={() => onLeverageChange(lev)}
              className={`py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                leverage === lev 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-surface hover:bg-surface/80 text-muted-foreground hover:text-foreground'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
        
        <div className="flex items-center space-x-2">
          <Input
            type="number"
            min="1"
            max="100"
            value={leverage}
            onChange={(e) => onLeverageChange(Number(e.target.value))}
            className="h-6 text-xs flex-1"
            placeholder="Custom"
          />
          <span className="text-xs text-muted-foreground">x</span>
        </div>
      </div>

      {/* High Leverage Warning */}
      {leverage > 10 && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
          <div className="flex items-center space-x-1 text-red-600 font-medium mb-1">
            <AlertTriangle className="h-3 w-3" />
            <span>High Leverage Warning</span>
          </div>
          <div className="space-y-1 text-red-700">
            <div>• Position liquidated if price moves {(100/leverage).toFixed(1)}% against you</div>
            <div>• Consider using lower leverage for safer trading</div>
          </div>
        </div>
      )}

      {/* Price Input (for limit orders) */}
      {orderType === 'limit' && (
        <div className="space-y-1">
          <Label htmlFor="price" className="text-xs text-muted-foreground">Price</Label>
          <Input
            id="price"
            type="number"
            placeholder={currentPrice.toFixed(4)}
            value={orderPrice}
            onChange={(e) => onPriceChange(e.target.value)}
            className="h-8 text-xs font-mono"
            step="0.0001"
          />
        </div>
      )}

      {/* Size Input */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="size" className="text-xs text-muted-foreground">Position Size</Label>
          <button
            onClick={() => onSizeChange(maxSize.toFixed(4))}
            className="text-xs text-primary hover:text-primary/80"
          >
            Max
          </button>
        </div>
        <Input
          id="size"
          type="number"
          placeholder="0.0000"
          value={orderSize}
          onChange={(e) => onSizeChange(e.target.value)}
          className="h-8 text-xs font-mono"
          step="0.01"
        />
        <div className="text-xs text-muted-foreground">
          Available: {balance.toFixed(4)} KALE
        </div>
      </div>

      {/* Position Summary */}
      <div className="bg-surface rounded p-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Position Value</span>
          <span className="font-mono text-foreground">${total.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Margin Required</span>
          <span className="font-mono text-foreground">${marginRequired.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Liquidation Price</span>
          <span className="font-mono text-red-400">${liquidationPrice.toFixed(4)}</span>
        </div>
        {orderType === 'market' && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Est. Price</span>
            <span className="font-mono text-foreground">${currentPrice.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        onClick={onSubmit}
        disabled={!isConnected || loading || !orderSize || parseFloat(orderSize) <= 0}
        className={`w-full h-9 text-xs font-medium ${
          side === 'long' 
            ? 'bg-buy hover:bg-buy/90 text-white' 
            : 'bg-sell hover:bg-sell/90 text-white'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
            {simulationMode ? 'Submitting...' : 'Submitting to Testnet...'}
          </>
        ) : (
          <>
            {simulationMode && '🎭 '}
            {side === 'long' ? 'Open Long' : 'Open Short'} {orderSize || '0'} {leverage}x
            {simulationMode && ' (Demo)'}
          </>
        )}
      </Button>
    </div>
  );
}