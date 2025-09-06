import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { ChevronDown, Wifi, WifiOff } from 'lucide-react';

export function Header() {
  const { 
    currentPair, 
    isConnected, 
    balance, 
    passkeyAuth,
    authenticateWithPasskey 
  } = useTradingStore();

  const formatPrice = (price: number) => {
    return price.toFixed(4);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toFixed(0);
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center">
      <div className="flex-1 flex items-center">
        {/* Logo */}
        <div className="flex items-center px-6 border-r border-border h-full">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <div className="w-3 h-3 bg-primary-foreground rounded-sm"></div>
            </div>
            <span className="font-semibold text-foreground">TradeX</span>
          </div>
        </div>

        {/* Trading Pair */}
        <div className="flex items-center px-6 border-r border-border h-full">
          <div className="flex items-center space-x-1">
            <span className="font-semibold text-foreground text-sm">
              {currentPair.symbol}
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        {/* Price Info */}
        <div className="flex items-center space-x-8 px-6">
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Price</div>
            <div className="font-mono text-lg font-medium text-foreground">
              ${formatPrice(currentPair.price)}
            </div>
          </div>
          
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">24h Change</div>
            <div className={`font-mono text-sm font-medium ${
              currentPair.change24h >= 0 ? 'text-positive' : 'text-sell'
            }`}>
              {formatPercent(currentPair.change24h)}
            </div>
          </div>
          
          <div className="space-y-0.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">24h Volume</div>
            <div className="font-mono text-sm font-medium text-foreground">
              ${formatVolume(currentPair.volume24h)}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center space-x-4 px-6">
        {/* Connection Status */}
        <div className="flex items-center space-x-2 text-xs">
          {isConnected ? (
            <Wifi className="h-3 w-3 text-buy" />
          ) : (
            <WifiOff className="h-3 w-3 text-muted-foreground" />
          )}
          <span className={`${
            isConnected ? 'text-buy' : 'text-muted-foreground'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Balance (when connected) */}
        {isConnected && (
          <div className="text-xs text-muted-foreground">
            Balance: <span className="font-mono text-foreground">${balance.toFixed(2)}</span>
          </div>
        )}

        {/* Connect Button */}
        <Button
          onClick={authenticateWithPasskey}
          disabled={isConnected}
          size="sm"
          className={`text-xs h-8 px-3 ${
            isConnected
              ? 'bg-buy/10 text-buy border border-buy/20 hover:bg-buy/20'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
        >
          {isConnected ? 'Connected' : 'Connect'}
        </Button>
      </div>
    </header>
  );
}
