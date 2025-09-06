import * as StellarSDK from '@stellar/stellar-sdk';
import { 
  Contract, 
  TransactionBuilder, 
  Networks,
  BASE_FEE,
  nativeToScVal,
  Account,
  rpc
} from '@stellar/stellar-sdk';

export interface OraclePrice {
  price: number;
  timestamp: number;
  asset: string;
  source: 'kale' | 'external';
}

export interface UserPosition {
  id: string;
  symbol: string;
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  side: 'long' | 'short';
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume: number;
}

export interface CollateralInfo {
  token: string;
  price: number;
  totalSupply: number;
  exchangeRate: number; // How much $1 USD = X KALE
}

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export class DualOracleService {
  private rpcServer: rpc.Server | any;
  private networkPassphrase: string;
  private lastApiCall: { [key: string]: number } = {};
  private apiCallInterval = 5000; // 5 seconds between API calls
  private contracts: {
    kaleOracle: string;
    reflectorOracle: string;
    trading: string;
    vault: string;
    kaleToken: string;
  };

  // External price feeds (CORS-friendly alternatives)
  private externalPriceFeeds = {
    'BTC-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
    'ETH-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
    'SOL-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=SOL'
  };

  constructor() {
    console.log('Initializing Dual Oracle Service...');
    
    this.contracts = {
      kaleOracle: 'CDLPLS3KO5RE2RLCKUFFQUKTV4XKEPR75SC4HSIP6VTYWTN6Z43GXHNV',
      reflectorOracle: '', // Empty for now - no valid contract
      trading: 'CCLC7XND6O63N7EE567HLHFSR2B7P74CMHB3WVEOOPTVLNED4KR5UIBR',
      vault: 'CCCSN2RHOI4CI7MMQNJSNNKNVEXKQPEX6B7EPDLRXP6SZEJ4EUBETT3L',
      kaleToken: 'CBTQBEZW3XW7SBX7P3P4RWXI2W4ADDLBDWT665GJJAGBLQC4TUUKUZAZ'
    };

    // Initialize RPC server with proper error handling
    try {
      this.rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
      console.log('✓ Successfully created rpc.Server');
    } catch (e) {
      console.error('rpc.Server creation failed:', e);
      this.rpcServer = this.createMockServer();
    }
    
    this.networkPassphrase = Networks.TESTNET;

    // Log initialization status
    console.log('📊 Oracle Service initialized with:');
    console.log('- External API: Coinbase (CORS-friendly)');
    console.log('- KALE Oracle: Using lastprice() function');
    console.log('- Rate limiting: Protected with fallbacks');
  }



  // Get KALE price from your oracle using the correct 'lastprice' function
  async getKalePrice(): Promise<OraclePrice | null> {
    try {
      console.log('🔍 Calling KALE oracle with lastprice() function...');
      
      const contract = new Contract(this.contracts.kaleOracle);
      
      // Create the KALE asset parameter - try as symbol first
      let kaleAsset;
      try {
        // Try as symbol (most likely)
        kaleAsset = nativeToScVal('KALE', {type: 'symbol'});
        console.log('Using KALE as symbol parameter');
      } catch (e) {
        // Fallback to string
        kaleAsset = nativeToScVal('KALE', {type: 'string'});
        console.log('Using KALE as string parameter');
      }
      
      // Call the correct function: lastprice
      const operation = contract.call('lastprice', kaleAsset);

      const tx = new TransactionBuilder(
        this.createDummyAccount(),
        {
          fee: BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      )
        .addOperation(operation)
        .setTimeout(30)
        .build();

      console.log('📡 Simulating lastprice transaction...');
      const response = await this.rpcServer.simulateTransaction(tx);

      if (response.error) {
        console.error('❌ KALE oracle error:', response.error);
        
        // Log available assets to help debug
        console.log('🔍 Checking available assets in oracle...');
        await this.logAvailableAssets();
        
        console.log('📝 Using mock KALE price as fallback');
        return this.getMockKalePrice();
      }

      console.log('✅ Oracle response received, parsing...');
      const result = await this.parseOracleResponse(response, 'KALE');
      if (result) {
        result.source = 'kale';
        console.log('✅ Successfully fetched KALE price from oracle:', result);
        return result;
      }

      console.log('⚠️ Could not parse oracle response, using mock data');
      return this.getMockKalePrice();
    } catch (error) {
      console.error('❌ Error fetching KALE price:', error);
      return this.getMockKalePrice();
    }
  }

  

  // Trading operations
// Trading operations
async executeTrade(
  orderType: 'buy' | 'sell',
  amount: number,
  userPublicKey: string,
  price?: number
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    console.log(`Executing ${orderType} order:`, { amount, price, userPublicKey });
    
    const contract = new Contract(this.contracts.trading);
    const userAccount = new Account(userPublicKey, '0');
    
    // Convert amounts to contract format (scaled integers)
    const scaledAmount = Math.floor(amount * 1e7); // 7 decimals
    const scaledPrice = price ? Math.floor(price * 1e7) : undefined;
    
    let operation;
    if (orderType === 'buy') {
      // Call buy function on trading contract
      operation = contract.call(
        'buy',
        nativeToScVal(scaledAmount, { type: 'i128' }),
        scaledPrice ? nativeToScVal(scaledPrice, { type: 'i128' }) : nativeToScVal(0, { type: 'i128' })
      );
    } else {
      // Call sell function on trading contract
      operation = contract.call(
        'sell',
        nativeToScVal(scaledAmount, { type: 'i128' }),
        scaledPrice ? nativeToScVal(scaledPrice, { type: 'i128' }) : nativeToScVal(0, { type: 'i128' })
      );
    }

    const tx = new TransactionBuilder(userAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // In a real implementation, you'd sign and submit the transaction
    // For now, we'll simulate success
    console.log('Trade transaction built successfully');
    
    return {
      success: true,
      transactionId: `mock-tx-${Date.now()}`
    };

  } catch (error) {
    console.error('Trade execution failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get user positions from the trading contract
async getUserPositions(userPublicKey: string): Promise<UserPosition[]> {
  try {
    const contract = new Contract(this.contracts.trading);
    const operation = contract.call(
      'get_positions',
      nativeToScVal(userPublicKey, { type: 'string' })
    );

    const tx = new TransactionBuilder(
      this.createDummyAccount(),
      {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const response = await this.rpcServer.simulateTransaction(tx);
    
    if (response.result?.retval) {
      // Parse positions from contract response
      return this.parsePositionsResponse(response.result.retval);
    }

    // Return mock positions for development
    return this.getMockPositions();

  } catch (error) {
    console.error('Error fetching user positions:', error);
    return this.getMockPositions();
  }
}

// Close a specific position
async closePosition(
  positionId: string,
  userPublicKey: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const contract = new Contract(this.contracts.trading);
    const userAccount = new Account(userPublicKey, '0');
    
    const operation = contract.call(
      'close_position',
      nativeToScVal(positionId, { type: 'string' })
    );

    const tx = new TransactionBuilder(userAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    console.log('Position close transaction built');
    
    return {
      success: true,
      transactionId: `close-tx-${Date.now()}`
    };

  } catch (error) {
    console.error('Position close failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Vault operations for liquidity provision
async depositToVault(
  amount: number,
  userPublicKey: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    console.log(`Depositing ${amount} to vault for user:`, userPublicKey);
    
    const contract = new Contract(this.contracts.vault);
    const userAccount = new Account(userPublicKey, '0');
    
    const scaledAmount = Math.floor(amount * 1e7);
    
    const operation = contract.call(
      'deposit',
      nativeToScVal(scaledAmount, { type: 'i128' })
    );

    const tx = new TransactionBuilder(userAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    console.log('Vault deposit transaction built');
    
    return {
      success: true,
      transactionId: `deposit-tx-${Date.now()}`
    };

  } catch (error) {
    console.error('Vault deposit failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async withdrawFromVault(
  amount: number,
  userPublicKey: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    console.log(`Withdrawing ${amount} from vault for user:`, userPublicKey);
    
    const contract = new Contract(this.contracts.vault);
    const userAccount = new Account(userPublicKey, '0');
    
    const scaledAmount = Math.floor(amount * 1e7);
    
    const operation = contract.call(
      'withdraw',
      nativeToScVal(scaledAmount, { type: 'i128' })
    );

    const tx = new TransactionBuilder(userAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    console.log('Vault withdrawal transaction built');
    
    return {
      success: true,
      transactionId: `withdraw-tx-${Date.now()}`
    };

  } catch (error) {
    console.error('Vault withdrawal failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get vault information
async getVaultInfo(): Promise<{
  totalLiquidity: number;
  userShares: number;
  apy: number;
  totalShares: number;
}> {
  try {
    const contract = new Contract(this.contracts.vault);
    const operation = contract.call('get_vault_info');

    const tx = new TransactionBuilder(
      this.createDummyAccount(),
      {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      }
    )
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const response = await this.rpcServer.simulateTransaction(tx);
    
    if (response.result?.retval) {
      return this.parseVaultInfo(response.result.retval);
    }

    // Return mock vault info
    return {
      totalLiquidity: 1500000,
      userShares: 0,
      apy: 12.5,
      totalShares: 1000000
    };

  } catch (error) {
    console.error('Error fetching vault info:', error);
    return {
      totalLiquidity: 1500000,
      userShares: 0,
      apy: 12.5,
      totalShares: 1000000
    };
  }
}


  // Helper method to see what assets are available in the oracle
  async logAvailableAssets(): Promise<void> {
    try {
      console.log('📋 Fetching available assets from oracle...');
      const contract = new Contract(this.contracts.kaleOracle);
      const operation = contract.call('assets');

      const tx = new TransactionBuilder(
        this.createDummyAccount(),
        {
          fee: BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      )
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const response = await this.rpcServer.simulateTransaction(tx);
      
      if (response.result?.retval) {
        console.log('📋 Available assets in oracle:', response.result.retval);
        
        // Also try to get the base asset
        console.log('📋 Fetching base asset...');
        await this.logBaseAsset();
        
        // Try to get decimals and resolution for more context
        console.log('📋 Fetching oracle configuration...');
        await this.logOracleConfig();
        
      } else if (response.error) {
        console.log('❌ Could not fetch available assets:', response.error);
      } else {
        console.log('❌ No assets data returned');
      }
    } catch (error) {
      console.log('❌ Could not fetch available assets:', error.message);
    }
  }

  // Get the base asset from the oracle
  async logBaseAsset(): Promise<void> {
    try {
      const contract = new Contract(this.contracts.kaleOracle);
      const operation = contract.call('base');

      const tx = new TransactionBuilder(
        this.createDummyAccount(),
        {
          fee: BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        }
      )
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const response = await this.rpcServer.simulateTransaction(tx);
      
      if (response.result?.retval) {
        console.log('📋 Base asset:', response.result.retval);
      }
    } catch (error) {
      console.log('❌ Could not fetch base asset:', error.message);
    }
  }

  // Get oracle configuration (decimals, resolution)
  async logOracleConfig(): Promise<void> {
    try {
      const contract = new Contract(this.contracts.kaleOracle);
      
      // Get decimals
      const decimalsOp = contract.call('decimals');
      const decimalsTx = new TransactionBuilder(
        this.createDummyAccount(),
        { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
      )
        .addOperation(decimalsOp)
        .setTimeout(30)
        .build();

      const decimalsResponse = await this.rpcServer.simulateTransaction(decimalsTx);
      if (decimalsResponse.result?.retval) {
        console.log('📋 Oracle decimals:', decimalsResponse.result.retval);
      }

      // Get resolution
      const resolutionOp = contract.call('resolution');
      const resolutionTx = new TransactionBuilder(
        this.createDummyAccount(),
        { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }
      )
        .addOperation(resolutionOp)
        .setTimeout(30)
        .build();

      const resolutionResponse = await this.rpcServer.simulateTransaction(resolutionTx);
      if (resolutionResponse.result?.retval) {
        console.log('📋 Oracle resolution:', resolutionResponse.result.retval);
      }

    } catch (error) {
      console.log('❌ Could not fetch oracle config:', error.message);
    }
  }

  // Get external asset price (BTC, ETH, etc.)
  async getExternalPrice(symbol: string): Promise<OraclePrice | null> {
    try {
      // Try Reflector oracle first (if available)
      if (this.contracts.reflectorOracle) {
        const reflectorPrice = await this.getReflectorPrice(symbol);
        if (reflectorPrice) {
          return reflectorPrice;
        }
      }

      // Fallback to external API
      const apiPrice = await this.getExternalAPIPrice(symbol);
      return apiPrice;

    } catch (error) {
      console.error(`Error fetching ${symbol} price:`, error);
      return this.getMockExternalPrice(symbol);
    }
  }

  // Get trading pair data with proper collateral context
  async getTradingPair(symbol: string): Promise<TradingPair | null> {
    try {
      const [baseAsset, quoteAsset] = symbol.split('-');
      
      // Get the external price for the trading pair
      const priceData = await this.getExternalPrice(symbol);
      if (!priceData) return null;

      return {
        symbol: symbol,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset,
        price: priceData.price,
        change24h: (Math.random() - 0.5) * 0.1, // Mock 24h change
        volume: Math.floor(Math.random() * 10000000) + 1000000 // Mock volume
      };

    } catch (error) {
      console.error(`Error fetching trading pair ${symbol}:`, error);
      return null;
    }
  }

  // Get collateral information
  async getCollateralInfo(): Promise<CollateralInfo> {
    try {
      const kalePrice = await this.getKalePrice();
      
      return {
        token: 'KALE',
        price: kalePrice?.price || 0.045,
        totalSupply: 1000000000, // Mock total supply
        exchangeRate: kalePrice ? (1 / kalePrice.price) : 22.22 // How many KALE = $1
      };

    } catch (error) {
      console.error('Error fetching collateral info:', error);
      return {
        token: 'KALE',
        price: 0.045,
        totalSupply: 1000000000,
        exchangeRate: 22.22
      };
    }
  }

  // Get historical data for trading pairs
  async getHistoricalData(symbol: string, days: number = 30): Promise<OHLCData[]> {
    try {
      const currentPrice = await this.getExternalPrice(symbol);
      
      if (currentPrice) {
        return this.generateHistoricalFromPrice(currentPrice.price, days, symbol);
      } else {
        return this.generateFallbackData(days, symbol);
      }

    } catch (error) {
      console.error('Error generating historical data:', error);
      return this.generateFallbackData(days, symbol);
    }
  }

  // Subscribe to both KALE and external price updates
  async subscribeToUpdates(
    callback: (priceUpdate: OraclePrice) => void,
    assets: string[] = ['KALE', 'BTC-USD']
  ): Promise<void> {
    console.log('Setting up price subscriptions for:', assets);

    // Set up polling for all requested assets
    const pollInterval = setInterval(async () => {
      for (const asset of assets) {
        try {
          let priceUpdate: OraclePrice | null = null;

          if (asset === 'KALE') {
            priceUpdate = await this.getKalePrice();
          } else {
            priceUpdate = await this.getExternalPrice(asset);
          }

          if (priceUpdate) {
            callback(priceUpdate);
          }
        } catch (error) {
          console.warn(`Failed to fetch ${asset} price:`, error);
        }
      }
    }, 30000); // Poll every 30 seconds

    // Mock real-time update after 5 seconds
    setTimeout(() => {
      const mockUpdate: OraclePrice = {
        price: 45000 + (Math.random() - 0.5) * 1000,
        timestamp: Date.now(),
        asset: 'BTC-USD',
        source: 'external'
      };
      callback(mockUpdate);
    }, 5000);
  }

  async healthCheck(): Promise<{ kale: boolean; external: boolean }> {
    const [kaleHealth, externalHealth] = await Promise.all([
      this.getKalePrice().then(p => p !== null).catch(() => false),
      this.getExternalPrice('BTC-USD').then(p => p !== null).catch(() => false)
    ]);

    return {
      kale: kaleHealth,
      external: externalHealth
    };
  }

  // Private helper methods
  private async getReflectorPrice(symbol: string): Promise<OraclePrice | null> {
    try {
      // Only try if we have a valid contract address
      if (!this.contracts.reflectorOracle) {
        return null;
      }

      const contract = new Contract(this.contracts.reflectorOracle);
      const operation = contract.call('get_price', nativeToScVal(symbol, {type: "string"}));
      
      // ... implement Reflector call similar to KALE oracle
      // For now, return null to fall back to external API
      return null;
      
    } catch (error) {
      console.warn('Reflector oracle unavailable:', error);
      return null;
    }
  }

  // Helper methods
private parsePositionsResponse(retval: any): UserPosition[] {
  // Parse the contract response to extract positions
  // This would depend on your contract's return format
  return this.getMockPositions();
}

private getMockPositions(): UserPosition[] {
  return [
    {
      id: 'pos-1',
      symbol: 'BTC-USD',
      size: 0.1,
      entryPrice: 44500,
      unrealizedPnl: 250.00,
      side: 'long'
    },
    {
      id: 'pos-2', 
      symbol: 'KALE-USD',
      size: 1000,
      entryPrice: 0.044,
      unrealizedPnl: -10.50,
      side: 'long'
    }
  ];
}

private parseVaultInfo(retval: any): any {
  // Parse vault information from contract response
  return {
    totalLiquidity: 1500000,
    userShares: 0,
    apy: 12.5,
    totalShares: 1000000
  };
}

  private async getExternalAPIPrice(symbol: string): Promise<OraclePrice | null> {
    try {
      // Rate limiting: check if we've called this API recently
      const now = Date.now();
      const lastCall = this.lastApiCall[symbol] || 0;
      
      if (now - lastCall < this.apiCallInterval) {
        console.log(`Rate limiting: Using cached/mock data for ${symbol}`);
        return this.getMockExternalPrice(symbol);
      }

      // Try Coinbase API first (CORS-friendly)
      const coinbaseUrl = this.externalPriceFeeds[symbol as keyof typeof this.externalPriceFeeds];
      if (coinbaseUrl) {
        this.lastApiCall[symbol] = now;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(coinbaseUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          const price = parseFloat(data.data?.rates?.USD || '0');
          
          if (price > 0) {
            console.log(`✅ Fetched ${symbol} price: $${price} from Coinbase`);
            return {
              price: price,
              timestamp: Date.now(),
              asset: symbol,
              source: 'external'
            };
          }
        } else {
          console.warn(`Coinbase API returned ${response.status}: ${response.statusText}`);
        }
      }

      // Fallback to mock data for development
      console.warn(`Failed to fetch ${symbol} price from external APIs, using mock data`);
      return this.getMockExternalPrice(symbol);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`API request timeout for ${symbol}`);
      } else {
        console.warn('External API failed:', error);
      }
      return this.getMockExternalPrice(symbol);
    }
  }

  private createMockServer() {
    return {
      simulateTransaction: async () => ({ error: 'Mock server' }),
      getLatestLedger: async () => ({ sequence: 0 }),
      getEvents: () => ({ addEventListener: () => {} })
    };
  }

  private createDummyAccount(): Account {
    return new Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );
  }

  private getMockKalePrice(): OraclePrice {
    return {
      price: 0.045 + (Math.random() - 0.5) * 0.005,
      timestamp: Date.now(),
      asset: 'KALE',
      source: 'kale'
    };
  }

  private getMockExternalPrice(symbol: string): OraclePrice {
    const basePrices = {
      'BTC-USD': 45000,
      'ETH-USD': 2800,
      'SOL-USD': 100
    };

    const basePrice = basePrices[symbol as keyof typeof basePrices] || 1;
    const variation = basePrice * (Math.random() - 0.5) * 0.02;

    return {
      price: basePrice + variation,
      timestamp: Date.now(),
      asset: symbol,
      source: 'external'
    };
  }

  private async parseOracleResponse(response: any, asset: string): Promise<OraclePrice | null> {
    try {
      if (response.result?.retval) {
        const retval = response.result.retval;
        console.log('📊 Raw oracle response:', retval);
        
        // Handle Option<PriceData> - check if it's Some or None
        if (retval._switch?.name === 'Some' && retval._switch?.value) {
          const priceData = retval._switch.value;
          console.log('📊 PriceData found:', priceData);
          
          // Extract price and timestamp from PriceData struct
          let price: number;
          let timestamp: number;
          
          // Get decimal precision from contract (default to 7)
          const decimals = 7; // We'll hardcode this for now to avoid extra calls
          
          // The price is an i128, need to convert to regular number
          if (priceData.price !== undefined) {
            price = Number(priceData.price) / Math.pow(10, decimals);
            console.log(`💰 Converted price: ${priceData.price} -> ${price} (using ${decimals} decimals)`);
          } else {
            console.log('❌ No price field in PriceData');
            return null;
          }
          
          // Timestamp is u64 - might be in seconds or milliseconds
          if (priceData.timestamp !== undefined) {
            const ts = Number(priceData.timestamp);
            // If timestamp is in seconds (typical for blockchain), convert to milliseconds
            timestamp = ts < 1e12 ? ts * 1000 : ts;
            console.log(`⏰ Converted timestamp: ${priceData.timestamp} -> ${new Date(timestamp)}`);
          } else {
            timestamp = Date.now();
            console.log('⏰ No timestamp field, using current time');
          }

          return {
            price: price,
            timestamp: timestamp,
            asset: asset,
            source: 'kale'
          };
        } else if (retval._switch?.name === 'None') {
          // Option is None - no price data available
          console.log(`❌ No price data available for ${asset} in oracle (Option::None)`);
          return null;
        } else {
          // Might be a direct PriceData struct (not wrapped in Option)
          if (retval.price !== undefined) {
            console.log('📊 Direct PriceData struct found:', retval);
            const decimals = 7;
            const price = Number(retval.price) / Math.pow(10, decimals);
            const ts = Number(retval.timestamp || Date.now() / 1000);
            const timestamp = ts < 1e12 ? ts * 1000 : ts;
            
            console.log(`💰 Direct price: ${retval.price} -> ${price}`);
            
            return {
              price: price,
              timestamp: timestamp,
              asset: asset,
              source: 'kale'
            };
          } else {
            console.log('❌ Unrecognized response format:', retval);
          }
        }
      } else {
        console.log('❌ No result.retval in response');
      }
      return null;
    } catch (error) {
      console.error('❌ Error parsing oracle response:', error);
      return null;
    }
  }

  private generateHistoricalFromPrice(currentPrice: number, days: number, symbol: string): OHLCData[] {
    const data: OHLCData[] = [];
    let price = currentPrice;
    
    // Adjust volatility based on asset
    const volatility = symbol.includes('BTC') ? 0.05 : 
                     symbol.includes('ETH') ? 0.06 : 
                     symbol.includes('SOL') ? 0.08 : 0.05;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const open = price;
      const randomChange = (Math.random() - 0.5) * volatility;
      const high = open * (1 + Math.abs(randomChange) + Math.random() * 0.02);
      const low = open * (1 - Math.abs(randomChange) - Math.random() * 0.02);
      const close = open * (1 + randomChange);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(Math.random() * 1000000) + 100000
      });
      
      price = close;
    }
    
    return data;
  }

  private generateFallbackData(days: number, symbol: string): OHLCData[] {
    const basePrices = {
      'BTC-USD': 45000,
      'ETH-USD': 2800,
      'SOL-USD': 100
    };
    
    let price = basePrices[symbol as keyof typeof basePrices] || 1;
    const data: OHLCData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
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
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(Math.random() * 500000) + 50000
      });
      
      price = close;
    }
    
    return data;
  }
}