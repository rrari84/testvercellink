import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { useTradingStore } from '@/store/trading';
import { DualOracleService, OraclePrice, OHLCData, CollateralInfo, TradingPair } from '@/servers/DualOracleService';

export function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<any>(null);
  const oracleService = useRef(new DualOracleService());
  
  const { currentPair } = useTradingStore();
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    kale: 'connecting' | 'connected' | 'disconnected';
    btc: 'connecting' | 'connected' | 'disconnected';
  }>({ kale: 'connecting', btc: 'connecting' });
  
  const [currentOHLC, setCurrentOHLC] = useState({
    open: 0,
    high: 0,
    low: 0,
    close: 0
  });
  
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [collateralInfo, setCollateralInfo] = useState<CollateralInfo | null>(null);
  const [tradingPairData, setTradingPairData] = useState<TradingPair | null>(null);

  // Initialize chart with dual oracle data
  useEffect(() => {
    const initializeWithDualOracle = async () => {
      setIsLoading(true);
      setChartError(null);
      setConnectionStatus({ kale: 'connecting', btc: 'connecting' });

      try {
        console.log('Connecting to dual oracle system...');
        console.log('Trading pair: BTC-USD');
        console.log('Collateral: KALE');

        // Health check both oracles
        const healthStatus = await oracleService.current.healthCheck();
        console.log('Oracle health:', healthStatus);

        // Get collateral info (KALE)
        const collateral = await oracleService.current.getCollateralInfo();
        setCollateralInfo(collateral);
        console.log('KALE collateral info:', collateral);

        // Get trading pair data (BTC-USD)
        const pairData = await oracleService.current.getTradingPair('BTC-USD');
        setTradingPairData(pairData);
        console.log('BTC-USD trading pair data:', pairData);

        // Get historical data for BTC-USD
        const historicalData = await oracleService.current.getHistoricalData('BTC-USD', 30);
        console.log(`Generated ${historicalData.length} historical candles for BTC-USD`);

        if (historicalData.length === 0) {
          throw new Error('No price data available');
        }

        // Initialize chart
        initChart(historicalData);

        // Update OHLC display
        const latest = historicalData[historicalData.length - 1];
        setCurrentOHLC({
          open: latest.open,
          high: latest.high,
          low: latest.low,
          close: latest.close
        });

        // Set up real-time updates for both KALE and BTC-USD
        setupDualSubscription();
        
        setConnectionStatus({
          kale: healthStatus.kale ? 'connected' : 'disconnected',
          btc: healthStatus.external ? 'connected' : 'disconnected'
        });
        setLastUpdate(new Date());

      } catch (error) {
        console.error('Dual oracle initialization failed:', error);
        setChartError(`Oracle connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setConnectionStatus({ kale: 'disconnected', btc: 'disconnected' });
        
        // Try fallback data
        const fallbackData = generateFallbackData();
        if (fallbackData.length > 0) {
          initChart(fallbackData);
          const latest = fallbackData[fallbackData.length - 1];
          setCurrentOHLC({
            open: latest.open,
            high: latest.high,
            low: latest.low,
            close: latest.close
          });
        }
        
      } finally {
        setIsLoading(false);
      }
    };

    initializeWithDualOracle();
  }, []); // No dependency since we only have BTC-USD

  // Set up dual oracle subscriptions
  const setupDualSubscription = () => {
    console.log('Setting up KALE and BTC-USD subscriptions...');
    
    oracleService.current.subscribeToUpdates(
      (priceUpdate: OraclePrice) => {
        console.log('Price update received:', priceUpdate);
        
        if (priceUpdate.asset === 'KALE') {
          // Update collateral info
          setCollateralInfo(prev => prev ? {
            ...prev,
            price: priceUpdate.price,
            exchangeRate: 1 / priceUpdate.price
          } : null);
          setConnectionStatus(prev => ({ ...prev, kale: 'connected' }));
        } else if (priceUpdate.asset === 'BTC-USD') {
          // Update trading chart
          updateChartWithPrice(priceUpdate);
          setTradingPairData(prev => prev ? {
            ...prev,
            price: priceUpdate.price
          } : null);
          setConnectionStatus(prev => ({ ...prev, btc: 'connected' }));
        }
        
        setLastUpdate(new Date());
      }
    );

    // Cleanup function
    return () => {
      console.log('Cleaning up oracle subscriptions');
    };
  };

  // Initialize chart with data
  const initChart = (data: OHLCData[]) => {
    if (!chartRef.current) return;

    try {
      // Remove existing chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
      }

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight,
        layout: {
          background: { color: 'transparent' },
          textColor: '#d1d5db',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        rightPriceScale: {
          borderColor: '#485563',
          scaleMargins: { top: 0.1, bottom: 0.1 },
          autoScale: true,
        },
        timeScale: {
          borderColor: '#485563',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
        },
        watermark: {
          visible: true,
          fontSize: 14,
          horzAlign: 'left',
          vertAlign: 'bottom',
          color: 'rgba(171, 71, 188, 0.3)',
          text: 'BTC-USD • Collateral: KALE',
        },
        crosshair: {
          mode: 1,
        },
      } as any);

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
        priceFormat: {
          type: 'price',
          precision: 0, // No decimals for BTC
          minMove: 1,
        },
      });

      // Set data
      candlestickSeries.setData(data);

      // Store references
      chartInstanceRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;

      // Fit content and scroll to end
      chart.timeScale().fitContent();
      chart.timeScale().scrollToRealTime();

    } catch (error) {
      console.error('Chart initialization failed:', error);
      setChartError('Chart rendering failed');
    }
  };

  // Update chart with new price
  const updateChartWithPrice = (priceUpdate: OraclePrice) => {
    if (!candlestickSeriesRef.current) return;

    const now = new Date(priceUpdate.timestamp);
    const timeKey = now.toISOString().split('T')[0];
    
    const updatedCandle: OHLCData = {
      time: timeKey,
      open: currentOHLC.open || priceUpdate.price,
      high: Math.max(currentOHLC.high || priceUpdate.price, priceUpdate.price),
      low: Math.min(currentOHLC.low || priceUpdate.price, priceUpdate.price),
      close: priceUpdate.price,
      volume: Math.floor(Math.random() * 100000) + 50000
    };

    candlestickSeriesRef.current.update(updatedCandle);
    
    setCurrentOHLC({
      open: updatedCandle.open,
      high: updatedCandle.high,
      low: updatedCandle.low,
      close: updatedCandle.close
    });
  };

  // Generate fallback data for BTC-USD
  const generateFallbackData = (): OHLCData[] => {
    const data: OHLCData[] = [];
    let price = 45000; // Default BTC price
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const volatility = 0.05;
      const open = price;
      const change = (Math.random() - 0.5) * volatility;
      const high = open * (1 + Math.abs(change) + Math.random() * 0.02);
      const low = open * (1 - Math.abs(change) - Math.random() * 0.02);
      const close = open * (1 + change);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Number(open.toFixed(0)),
        high: Number(high.toFixed(0)),
        low: Number(low.toFixed(0)),
        close: Number(close.toFixed(0))
      });
      
      price = close;
    }
    
    return data;
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartRef.current.clientWidth,
          height: chartRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const retryConnection = async () => {
    setChartError(null);
    setConnectionStatus({ kale: 'connecting', btc: 'connecting' });
    window.location.reload();
  };

  return (
    <div className="h-full bg-gray-900 rounded-lg border border-gray-700 relative">
      {/* Header with Collateral Info */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-white">
            BTC-USD Chart
          </h3>
          
          {/* Collateral Badge */}
          {collateralInfo && (
            <div className="flex items-center space-x-2 bg-purple-900/50 px-3 py-1 rounded-lg">
              <div className="text-xs text-purple-300">
                Collateral: {collateralInfo.exchangeRate.toFixed(2)} KALE = $1.00
              </div>
              <div className="text-xs text-gray-400">
                (${collateralInfo.price.toFixed(4)}/KALE)
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Time interval buttons */}
          <div className="flex items-center space-x-1">
            {['1m', '5m', '1h', '4h', '1d'].map((interval) => (
              <button
                key={interval}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  interval === '1d' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
                }`}
              >
                {interval}
              </button>
            ))}
          </div>
          
          {/* Oracle connection status */}
          <div className="flex items-center space-x-3 text-sm">
            {/* KALE Oracle Status */}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus.kale === 'connected' ? 'bg-green-500 animate-pulse' :
                connectionStatus.kale === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`}></div>
              <span className="text-gray-400 text-xs">KALE</span>
            </div>
            
            {/* BTC Oracle Status */}
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus.btc === 'connected' ? 'bg-green-500 animate-pulse' :
                connectionStatus.btc === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`}></div>
              <span className="text-gray-400 text-xs">BTC</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chart Container */}
      <div className="h-[calc(100%-64px)] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Connecting to dual oracle system...</p>
              <p className="text-xs text-gray-500 mt-2">KALE collateral + BTC-USD pricing</p>
            </div>
          </div>
        )}
        
        {chartError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
            <div className="text-center max-w-md">
              <div className="text-red-400 mb-3 font-medium">{chartError}</div>
              <div className="text-xs text-gray-500 mb-4 space-y-1">
                <div>Trading: BTC-USD</div>
                <div>Collateral: KALE</div>
              </div>
              <button 
                onClick={retryConnection}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm transition-colors"
              >
                Retry Oracle Connection
              </button>
            </div>
          </div>
        )}
        
        <div 
          ref={chartRef}
          className="w-full h-full"
          style={{ minHeight: '300px' }}
        />
      </div>
      
      {/* Combined Trading Info Panel */}
      <div className="absolute top-20 left-4 bg-gray-800/90 backdrop-blur-sm border border-gray-700 rounded p-3 min-w-[280px]">
        {/* Trading Pair Header */}
        {tradingPairData && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-600">
            <div className="text-sm font-medium text-white">{tradingPairData.symbol}</div>
            <div className="text-lg font-mono text-white">
              ${tradingPairData.price.toFixed(0)}
            </div>
          </div>
        )}
        
        {/* OHLC Data */}
        <div className="grid grid-cols-4 gap-3 text-xs mb-3">
          <div>
            <span className="text-gray-400">O:</span>
            <div className="text-white font-mono">${currentOHLC.open.toFixed(0)}</div>
          </div>
          <div>
            <span className="text-gray-400">H:</span>
            <div className="text-green-500 font-mono">${currentOHLC.high.toFixed(0)}</div>
          </div>
          <div>
            <span className="text-gray-400">L:</span>
            <div className="text-red-500 font-mono">${currentOHLC.low.toFixed(0)}</div>
          </div>
          <div>
            <span className="text-gray-400">C:</span>
            <div className="text-white font-mono">${currentOHLC.close.toFixed(0)}</div>
          </div>
        </div>

        {/* Trading Metrics */}
        {tradingPairData && (
          <div className="grid grid-cols-2 gap-3 text-xs mb-3 pb-2 border-b border-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-400">24h Change:</span>
              <span className={`font-mono ${
                tradingPairData.change24h >= 0 ? 'text-green-500' : 'text-red-500'
              }`}>
                {tradingPairData.change24h >= 0 ? '+' : ''}
                {(tradingPairData.change24h * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Volume:</span>
              <span className="text-white font-mono">
                ${(tradingPairData.volume / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        )}
        
        {/* System Info */}
        <div className="space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Pair:</span>
            <span className="text-blue-400">BTC-USD</span>
          </div>
          <div className="flex justify-between">
            <span>Collateral:</span>
            <span className="text-purple-400">KALE</span>
          </div>
          {collateralInfo && (
            <div className="flex justify-between">
              <span>Rate:</span>
              <span className="text-yellow-400">
                {collateralInfo.exchangeRate.toFixed(2)} KALE/$1
              </span>
            </div>
          )}
          {lastUpdate && (
            <div className="flex justify-between">
              <span>Updated:</span>
              <span>{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Network:</span>
            <span className="text-blue-400">Stellar Testnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}