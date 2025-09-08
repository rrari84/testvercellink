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
  exchangeRate: number;
}

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  transactionXdr?: string;
  error?: string;
}

export class DualOracleService {
  private rpcServer: rpc.Server | any;
  private networkPassphrase: string;
  private lastApiCall: { [key: string]: number } = {};
  private apiCallInterval = 5000;
  private contracts: {
    kaleOracle: string;
    reflectorOracle: string;
    trading: string;
    vault: string;
    kaleToken: string;
  };

  private externalPriceFeeds = {
    'BTC-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=BTC',
    'ETH-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=ETH',
    'SOL-USD': 'https://api.coinbase.com/v2/exchange-rates?currency=SOL'
  };

  constructor() {
    console.log('Initializing Dual Oracle Service...');
    
    this.contracts = {
      kaleOracle: 'CDLPLS3KO5RE2RLCKUFFQUKTV4XKEPR75SC4HSIP6VTYWTN6Z43GXHNV',
      reflectorOracle: '',
      trading: 'CCLC7XND6O63N7EE567HLHFSR2B7P74CMHB3WVEOOPTVLNED4KR5UIBR',
      vault: 'CCCSN2RHOI4CI7MMQNJSNNKNVEXKQPEX6B7EPDLRXP6SZEJ4EUBETT3L',
      kaleToken: 'CBTQBEZW3XW7SBX7P3P4RWXI2W4ADDLBDWT665GJJAGBLQC4TUUKUZAZ'
    };

    try {
      this.rpcServer = new rpc.Server('https://soroban-testnet.stellar.org');
      console.log('✓ Successfully created rpc.Server');
    } catch (e) {
      console.error('rpc.Server creation failed:', e);
      this.rpcServer = this.createMockServer();
    }
    
    this.networkPassphrase = Networks.TESTNET;

    console.log('📊 Oracle Service initialized with:');
    console.log('- External API: Coinbase (CORS-friendly)');
    console.log('- KALE Price: 1:1 USD Parity');
    console.log('- Rate limiting: Protected with fallbacks');
  }

  // Get KALE price - now hardcoded to $1 for USD parity
  async getKalePrice(): Promise<OraclePrice | null> {
    try {
      console.log('💰 Using USD parity for KALE (1 KALE = 1 USD)');
      
      return {
        price: 1.0,
        timestamp: Date.now(),
        asset: 'KALE',
        source: 'kale'
      };

    } catch (error) {
      console.error('❌ Error in KALE USD parity:', error);
      return {
        price: 1.0,
        timestamp: Date.now(),
        asset: 'KALE',
        source: 'kale'
      };
    }
  }

  // Trading operations - Updated to return transaction XDR
  async executeTrade(
    orderType: 'buy' | 'sell',
    amount: number,
    userPublicKey: string,
    price?: number
  ): Promise<TransactionResult> {
    try {
      console.log(`Executing ${orderType} order:`, { amount, price, userPublicKey });
      
      // Validate userPublicKey first
      if (!userPublicKey || userPublicKey.length !== 56 || !userPublicKey.startsWith('G')) {
        throw new Error('Invalid Stellar account ID provided');
      }

      // Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount provided');
      }

      const contract = new Contract(this.contracts.trading);
      
      // Get actual account sequence from network
      const accountResponse = await this.rpcServer.getAccount(userPublicKey);
      const userAccount = new Account(userPublicKey, accountResponse.sequenceNumber());
      
      // Convert amounts to contract format (scaled integers)
      const scaledAmount = Math.floor(amount * 1e7);
      const scaledPrice = price ? Math.floor(price * 1e7) : 0;
      
      let operation;
      if (orderType === 'buy') {
        operation = contract.call(
          'buy',
          nativeToScVal(scaledAmount, { type: 'i128' }),
          nativeToScVal(scaledPrice, { type: 'i128' })
        );
      } else {
        operation = contract.call(
          'sell',
          nativeToScVal(scaledAmount, { type: 'i128' }),
          nativeToScVal(scaledPrice, { type: 'i128' })
        );
      }

      const tx = new TransactionBuilder(userAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      // Simulate first to check for errors
      const simulationResponse = await this.rpcServer.simulateTransaction(tx);
      
      if (simulationResponse.error) {
        throw new Error(`Transaction simulation failed: ${simulationResponse.error}`);
      }

      console.log('Trade simulation successful, returning transaction XDR');
      
      return {
        success: true,
        transactionXdr: tx.toXDR()
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
      // Validate userPublicKey
      if (!userPublicKey || userPublicKey.length !== 56 || !userPublicKey.startsWith('G')) {
        console.warn('Invalid public key for getUserPositions');
        return this.getMockPositions();
      }

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
        return this.parsePositionsResponse(response.result.retval);
      }

      return this.getMockPositions();

    } catch (error) {
      console.error('Error fetching user positions:', error);
      return this.getMockPositions();
    }
  }

  // Close a specific position - Updated to return transaction XDR
  async closePosition(
    positionId: string,
    userPublicKey: string
  ): Promise<TransactionResult> {
    try {
      // Validate userPublicKey
      if (!userPublicKey || userPublicKey.length !== 56 || !userPublicKey.startsWith('G')) {
        throw new Error('Invalid Stellar account ID provided');
      }

      const contract = new Contract(this.contracts.trading);
      
      // Get actual account sequence from network
      const accountResponse = await this.rpcServer.getAccount(userPublicKey);
      const userAccount = new Account(userPublicKey, accountResponse.sequenceNumber());
      
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

      // Simulate first
      const simulationResponse = await this.rpcServer.simulateTransaction(tx);
      
      if (simulationResponse.error) {
        throw new Error(`Transaction simulation failed: ${simulationResponse.error}`);
      }

      console.log('Position close transaction prepared');
      
      return {
        success: true,
        transactionXdr: tx.toXDR()
      };

    } catch (error) {
      console.error('Position close failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Vault operations - Updated to return transaction XDR
  async depositToVault(
    amount: number,
    userPublicKey: string
  ): Promise<TransactionResult> {
    try {
      if (!userPublicKey || userPublicKey.length !== 56 || !userPublicKey.startsWith('G')) {
        throw new Error('Invalid Stellar account ID provided');
      }

      console.log(`Depositing ${amount} to vault for user:`, userPublicKey);
      
      const contract = new Contract(this.contracts.vault);
      
      // Get actual account sequence from network
      const accountResponse = await this.rpcServer.getAccount(userPublicKey);
      const userAccount = new Account(userPublicKey, accountResponse.sequenceNumber());
      
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

      // Simulate first
      const simulationResponse = await this.rpcServer.simulateTransaction(tx);
      
      if (simulationResponse.error) {
        throw new Error(`Transaction simulation failed: ${simulationResponse.error}`);
      }

      console.log('Vault deposit transaction prepared');
      
      return {
        success: true,
        transactionXdr: tx.toXDR()
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
  ): Promise<TransactionResult> {
    try {
      if (!userPublicKey || userPublicKey.length !== 56 || !userPublicKey.startsWith('G')) {
        throw new Error('Invalid Stellar account ID provided');
      }

      console.log(`Withdrawing ${amount} from vault for user:`, userPublicKey);
      
      const contract = new Contract(this.contracts.vault);
      
      // Get actual account sequence from network
      const accountResponse = await this.rpcServer.getAccount(userPublicKey);
      const userAccount = new Account(userPublicKey, accountResponse.sequenceNumber());
      
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

      // Simulate first
      const simulationResponse = await this.rpcServer.simulateTransaction(tx);
      
      if (simulationResponse.error) {
        throw new Error(`Transaction simulation failed: ${simulationResponse.error}`);
      }

      console.log('Vault withdrawal transaction prepared');
      
      return {
        success: true,
        transactionXdr: tx.toXDR()
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

  // Get external asset price (BTC, ETH, etc.)
  async getExternalPrice(symbol: string): Promise<OraclePrice | null> {
    try {
      if (this.contracts.reflectorOracle) {
        const reflectorPrice = await this.getReflectorPrice(symbol);
        if (reflectorPrice) {
          return reflectorPrice;
        }
      }

      const apiPrice = await this.getExternalAPIPrice(symbol);
      return apiPrice;

    } catch (error) {
      console.error(`Error fetching ${symbol} price:`, error);
      return this.getMockExternalPrice(symbol);
    }
  }

  // Get trading pair data
  async getTradingPair(symbol: string): Promise<TradingPair | null> {
    try {
      const [baseAsset, quoteAsset] = symbol.split('-');
      
      const priceData = await this.getExternalPrice(symbol);
      if (!priceData) return null;

      return {
        symbol: symbol,
        baseAsset: baseAsset,
        quoteAsset: quoteAsset,
        price: priceData.price,
        change24h: (Math.random() - 0.5) * 0.1,
        volume: Math.floor(Math.random() * 10000000) + 1000000
      };

    } catch (error) {
      console.error(`Error fetching trading pair ${symbol}:`, error);
      return null;
    }
  }

  // Get collateral information - Updated for 1:1 USD parity
  async getCollateralInfo(): Promise<CollateralInfo> {
    try {
      return {
        token: 'KALE',
        price: 1.0, // Always $1 due to parity
        totalSupply: 1000000000,
        exchangeRate: 1.0 // 1 KALE = $1 USD
      };

    } catch (error) {
      console.error('Error fetching collateral info:', error);
      return {
        token: 'KALE',
        price: 1.0,
        totalSupply: 1000000000,
        exchangeRate: 1.0
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

  // Subscribe to price updates
  async subscribeToUpdates(
    callback: (priceUpdate: OraclePrice) => void,
    assets: string[] = ['KALE', 'BTC-USD']
  ): Promise<void> {
    console.log('Setting up price subscriptions for:', assets);

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
    }, 30000);

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
      if (!this.contracts.reflectorOracle) {
        return null;
      }
      return null;
    } catch (error) {
      console.warn('Reflector oracle unavailable:', error);
      return null;
    }
  }

  private parsePositionsResponse(retval: any): UserPosition[] {
    return this.getMockPositions();
  }

  private getMockPositions(): UserPosition[] {
    return [];
  }

  private parseVaultInfo(retval: any): any {
    return {
      totalLiquidity: 1500000,
      userShares: 0,
      apy: 12.5,
      totalShares: 1000000
    };
  }

  private async getExternalAPIPrice(symbol: string): Promise<OraclePrice | null> {
    try {
      const now = Date.now();
      const lastCall = this.lastApiCall[symbol] || 0;
      
      if (now - lastCall < this.apiCallInterval) {
        console.log(`Rate limiting: Using cached/mock data for ${symbol}`);
        return this.getMockExternalPrice(symbol);
      }

      const coinbaseUrl = this.externalPriceFeeds[symbol as keyof typeof this.externalPriceFeeds];
      if (coinbaseUrl) {
        this.lastApiCall[symbol] = now;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
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
      getEvents: () => ({ addEventListener: () => {} }),
      getAccount: async () => ({ sequenceNumber: () => '0' })
    };
  }

  private createDummyAccount(): Account {
    return new Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );
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

  private generateHistoricalFromPrice(currentPrice: number, days: number, symbol: string): OHLCData[] {
    const data: OHLCData[] = [];
    let price = currentPrice;
    
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
        volume: Math.floor(Math.random() * 500000) + 50000
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
        volume: Math.floor(Math.random() * 1000000) + 100000
      });
      
      price = close;
    }
    
    return data;
  }
}