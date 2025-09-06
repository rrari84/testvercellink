import { useState } from 'react';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, TrendingUp, TrendingDown } from 'lucide-react';

export function TradingPanel() {
  const {
    currentPair,
    isConnected,
    balance,
    orderType,
    orderSide,
    orderSize,
    orderPrice,
    orderLoading,
    setOrderType,
    setOrderSide,
    setOrderSize,
    setOrderPrice,
    placeOrder,
    positions,
    positionsLoading,
    closePosition
  } = useTradingStore();

  const [closingPosition, setClosingPosition] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (!isConnected) return;
    
    const result = await placeOrder();
    if (!result.success && result.error) {
      console.error('Order failed:', result.error);
      // You could show a toast notification here
    }
  };

  const handleClosePosition = async (positionId: string) => {
    setClosingPosition(positionId);
    try {
      const result = await closePosition(positionId);
      if (!result.success && result.error) {
        console.error('Position close failed:', result.error);
        // You could show a toast notification here
      }
    } finally {
      setClosingPosition(null);
    }
  };

  const calculateTotal = () => {
    const size = parseFloat(orderSize) || 0;
    const price = orderType === 'market' 
      ? currentPair.price 
      : parseFloat(orderPrice) || currentPair.price;
    return size * price;
  };

  const getMaxSize = () => {
    if (orderSide === 'buy') {
      const price = orderType === 'market' 
        ? currentPair.price 
        : parseFloat(orderPrice) || currentPair.price;
      return price > 0 ? balance / price : 0;
    }
    return 1000; // Mock value for sell
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Trading Form */}
      <div className="bg-card border border-border rounded">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Spot Trading</h3>
            <div className="text-xs text-muted-foreground">
              {formatPrice(currentPair.price)}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Buy/Sell Tabs */}
          <Tabs value={orderSide} onValueChange={(value) => setOrderSide(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger 
                value="buy" 
                className="text-xs data-[state=active]:bg-buy data-[state=active]:text-white"
              >
                Buy
              </TabsTrigger>
              <TabsTrigger 
                value="sell" 
                className="text-xs data-[state=active]:bg-sell data-[state=active]:text-white"
              >
                Sell
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="mt-4 space-y-4">
              <OrderForm 
                side="buy"
                orderType={orderType}
                orderSize={orderSize}
                orderPrice={orderPrice}
                currentPrice={currentPair.price}
                balance={balance}
                maxSize={getMaxSize()}
                onTypeChange={setOrderType}
                onSizeChange={setOrderSize}
                onPriceChange={setOrderPrice}
                onSubmit={handlePlaceOrder}
                loading={orderLoading}
                isConnected={isConnected}
                total={calculateTotal()}
              />
            </TabsContent>

            <TabsContent value="sell" className="mt-4 space-y-4">
              <OrderForm 
                side="sell"
                orderType={orderType}
                orderSize={orderSize}
                orderPrice={orderPrice}
                currentPrice={currentPair.price}
                balance={balance}
                maxSize={getMaxSize()}
                onTypeChange={setOrderType}
                onSizeChange={setOrderSize}
                onPriceChange={setOrderPrice}
                onSubmit={handlePlaceOrder}
                loading={orderLoading}
                isConnected={isConnected}
                total={calculateTotal()}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Positions */}
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Open Positions</h3>
            {positionsLoading && (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary" />
            )}
          </div>
        </div>
        <div className="p-4">
          {positions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">No open positions</p>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((position) => (
                <div key={position.id} className="bg-surface rounded p-3">
                  {/* Position Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-foreground">{position.symbol}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        position.side === 'long' ? 'bg-buy/10 text-buy' : 'bg-sell/10 text-sell'
                      }`}>
                        {position.side.toUpperCase()}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleClosePosition(position.id)}
                      disabled={closingPosition === position.id}
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 hover:bg-sell/10 hover:text-sell hover:border-sell/20"
                    >
                      {closingPosition === position.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {/* Position Details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Size:</span>
                      <div className="font-mono text-foreground">{position.size}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entry:</span>
                      <div className="font-mono text-foreground">${position.entryPrice.toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <div className="font-mono text-foreground">${currentPair.price.toFixed(4)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&L:</span>
                      <div className={`font-mono font-medium flex items-center space-x-1 ${
                        position.unrealizedPnl >= 0 ? 'text-positive' : 'text-sell'
                      }`}>
                        {position.unrealizedPnl >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>
                          {position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Position Progress Bar */}
                  <div className="mt-2">
                    <div className="w-full bg-surface rounded-full h-1">
                      <div 
                        className={`h-1 rounded-full transition-all duration-300 ${
                          position.unrealizedPnl >= 0 ? 'bg-positive' : 'bg-sell'
                        }`}
                        style={{ 
                          width: `${Math.min(Math.abs(position.unrealizedPnl / (position.size * position.entryPrice)) * 100, 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface OrderFormProps {
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  orderSize: string;
  orderPrice: string;
  currentPrice: number;
  balance: number;
  maxSize: number;
  onTypeChange: (type: 'market' | 'limit') => void;
  onSizeChange: (size: string) => void;
  onPriceChange: (price: string) => void;
  onSubmit: () => void;
  loading: boolean;
  isConnected: boolean;
  total: number;
}

function OrderForm({
  side,
  orderType,
  orderSize,
  orderPrice,
  currentPrice,
  balance,
  maxSize,
  onTypeChange,
  onSizeChange,
  onPriceChange,
  onSubmit,
  loading,
  isConnected,
  total
}: OrderFormProps) {
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
          <Label htmlFor="size" className="text-xs text-muted-foreground">Quantity</Label>
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
          Available: {maxSize.toFixed(4)} {side === 'buy' ? 'USD' : 'KALE'}
        </div>
      </div>

      {/* Order Summary */}
      <div className="bg-surface rounded p-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono text-foreground">${total.toFixed(4)}</span>
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
          side === 'buy' 
            ? 'bg-buy hover:bg-buy/90 text-white' 
            : 'bg-sell hover:bg-sell/90 text-white'
        }`}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
            Placing...
          </>
        ) : (
          `${side === 'buy' ? 'Buy' : 'Sell'} ${orderSize || '0'} KALE`
        )}
      </Button>
    </div>
  );
}