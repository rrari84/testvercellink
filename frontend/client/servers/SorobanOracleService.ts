import * as StellarSDK from '@stellar/stellar-sdk';
import { 
  Contract, 
  TransactionBuilder, 
  Networks,
  BASE_FEE,
  nativeToScVal,
  Account
} from '@stellar/stellar-sdk';

export interface OraclePrice {
  price: number;
  timestamp: number;
  asset: string;
}

export interface TradingData {
  symbol: string;
  price: number;
  volume: number;
  change24h: number;
}

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export class SorobanOracleService {
  private rpcServer: any; // Use any type temporarily
  private networkPassphrase: string;
  private contracts: {
    oracle: string;
    trading: string;
    vault: string;
    oUsdToken: string;
    shareToken: string;
  };

  constructor() {
    // Debug: log what's available
    console.log('Available in StellarSDK:', Object.keys(StellarSDK));
    
    this.contracts = {
      oracle: 'CDLPLS3KO5RE2RLCKUFFQUKTV4XKEPR75SC4HSIP6VTYWTN6Z43GXHNV',
      trading: 'CCLC7XND6O63N7EE567HLHFSR2B7P74CMHB3WVEOOPTVLNED4KR5UIBR',
      vault: 'CCCSN2RHOI4CI7MMQNJSNNKNVEXKQPEX6B7EPDLRXP6SZEJ4EUBETT3L',
      oUsdToken: 'CBTQBEZW3XW7SBX7P3P4RWXI2W4ADDLBDWT665GJJAGBLQC4TUUKUZAZ',
      shareToken: 'CCXDWGGF6MYE6ZG7G5DZ3USUJRDKNPTM4EM2DWASLFZLKFLXB3DS2K4D'
    };

    // Try different server instantiation patterns
    try {
      // Pattern 1: SorobanRpc.Server
      if ((StellarSDK as any).SorobanRpc?.Server) {
        this.rpcServer = new (StellarSDK as any).SorobanRpc.Server('https://soroban-testnet.stellar.org');
        console.log('✓ Using SorobanRpc.Server pattern');
      }
      // Pattern 2: Soroban.Rpc.Server  
      else if ((StellarSDK as any).Soroban?.Rpc?.Server) {
        this.rpcServer = new (StellarSDK as any).Soroban.Rpc.Server('https://soroban-testnet.stellar.org');
        console.log('✓ Using Soroban.Rpc.Server pattern');
      }
      // Pattern 3: Direct Server
      else if ((StellarSDK as any).Server) {
        this.rpcServer = new (StellarSDK as any).Server('https://soroban-testnet.stellar.org');
        console.log('✓ Using direct Server pattern');
      }
      // Pattern 4: Soroban.Server
      else if ((StellarSDK as any).Soroban?.Server) {
        this.rpcServer = new (StellarSDK as any).Soroban.Server('https://soroban-testnet.stellar.org');
        console.log('✓ Using Soroban.Server pattern');
      }
      else {
        console.error('❌ No compatible server found in SDK');
        console.log('Available SorobanRpc:', (StellarSDK as any).SorobanRpc);
        console.log('Available Soroban:', (StellarSDK as any).Soroban);
        console.log('Available Server:', (StellarSDK as any).Server);
        
        // Fallback: create a mock server for development
        this.rpcServer = {
          simulateTransaction: async () => ({ error: 'Server not found' }),
          getLatestLedger: async () => ({ sequence: 0 }),
          getEvents: () => ({ addEventListener: () => {} })
        };
      }
    } catch (error) {
      console.error('Server instantiation failed:', error);
      // Fallback mock server
      this.rpcServer = {
        simulateTransaction: async () => ({ error: 'Server instantiation failed' }),
        getLatestLedger: async () => ({ sequence: 0 }),
        getEvents: () => ({ addEventListener: () => {} })
      };
    }

    this.networkPassphrase = Networks.TESTNET;
  }

  async getCurrentPrice(asset: string = 'KALE'): Promise<OraclePrice | null> {
    try {
      if (!this.rpcServer.simulateTransaction) {
        console.warn('RPC server not properly initialized');
        return this.getMockPrice(asset);
      }

      const contract = new Contract(this.contracts.oracle);
      const operation = contract.call('get_price', nativeToScVal(asset, {type: "string"}));

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

      if (response.error) {
        console.error('Oracle simulation error:', response.error);
        return this.getMockPrice(asset);
      }

      const result = this.parseOracleResponse(response, asset);
      return result || this.getMockPrice(asset);

    } catch (error) {
      console.error('Error fetching price from oracle:', error);
      return this.getMockPrice(asset);
    }
  }

  async getTradingData(symbol: string = 'KALE-USD'): Promise<TradingData | null> {
    try {
      // Return mock data for now
      return {
        symbol: symbol,
        price: 0.045,
        volume: 125000,
        change24h: -0.002
      };
    } catch (error) {
      console.error('Error fetching trading data:', error);
      return null;
    }
  }

  async getHistoricalData(asset: string = 'KALE', days: number = 30): Promise<OHLCData[]> {
    try {
      const currentPrice = await this.getCurrentPrice(asset);
      
      if (currentPrice) {
        return this.generateHistoricalFromPrice(currentPrice.price, days);
      } else {
        return this.generateFallbackData(days);
      }

    } catch (error) {
      console.error('Error generating historical data:', error);
      return this.generateFallbackData(days);
    }
  }

  async getVaultInfo(): Promise<any> {
    return { totalValue: 1000000, users: 150 };
  }

  async subscribeToEvents(callback: (event: any) => void, contractAddress?: string): Promise<void> {
    console.log('Event subscription setup (mock implementation)');
    // Mock event subscription - send a test event after 5 seconds
    setTimeout(() => {
      callback({
        price: 0.045 + (Math.random() - 0.5) * 0.01,
        timestamp: Date.now(),
        asset: 'KALE'
      });
    }, 5000);
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.rpcServer.simulateTransaction) {
        return false;
      }
      const price = await this.getCurrentPrice();
      return price !== null;
    } catch {
      return false;
    }
  }

  private createDummyAccount(): Account {
    return new Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );
  }

  private getMockPrice(asset: string): OraclePrice {
    const basePrice = asset === 'KALE' ? 0.045 : 1.0;
    const randomVariation = (Math.random() - 0.5) * 0.01;
    
    return {
      price: basePrice + randomVariation,
      timestamp: Date.now(),
      asset: asset
    };
  }

  private parseOracleResponse(response: any, asset: string): OraclePrice | null {
    try {
      if (response.result?.retval) {
        const retval = response.result.retval;
        let price: number;
        
        if (retval._switch?.value !== undefined) {
          price = Number(retval._switch.value) / 1e7;
        } else if (typeof retval === 'string') {
          price = Number(retval) / 1e7;
        } else {
          price = Number(retval.price || retval.value) / 1e7;
        }

        return {
          price: price,
          timestamp: Date.now(),
          asset: asset
        };
      }
      return null;
    } catch (error) {
      console.error('Error parsing oracle response:', error);
      return null;
    }
  }

  private parseTradingResponse(response: any, symbol: string): TradingData | null {
    try {
      if (response.result?.retval) {
        const data = response.result.retval;
        
        return {
          symbol: symbol,
          price: Number(data.price) / 1e7,
          volume: Number(data.volume) / 1e7,
          change24h: Number(data.change24h) / 1e7
        };
      }
      return null;
    } catch (error) {
      console.error('Error parsing trading response:', error);
      return null;
    }
  }

  private parseVaultResponse(response: any): any {
    try {
      return response.result?.retval || null;
    } catch (error) {
      console.error('Error parsing vault response:', error);
      return null;
    }
  }

  private isPriceUpdateEvent(eventData: any): boolean {
    return eventData.type === 'contract' &&
           eventData.body?.topics?.some((topic: any) => 
             topic.includes('price_update') || topic.includes('PriceUpdated')
           );
  }

  private parsePriceUpdateEvent(eventData: any): OraclePrice | null {
    try {
      const data = eventData.body?.value;
      if (data) {
        return {
          price: Number(data.price) / 1e7,
          timestamp: eventData.ledgerClosedAt,
          asset: data.asset || 'KALE'
        };
      }
      return null;
    } catch (error) {
      console.error('Error parsing price update event:', error);
      return null;
    }
  }

  private generateHistoricalFromPrice(currentPrice: number, days: number): OHLCData[] {
    const data: OHLCData[] = [];
    let price = currentPrice;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const volatility = 0.15;
      const trend = -0.001;
      
      const open = price;
      const randomChange = (Math.random() - 0.5) * volatility;
      const high = open * (1 + Math.abs(randomChange) + Math.random() * 0.03);
      const low = open * (1 - Math.abs(randomChange) - Math.random() * 0.03);
      const close = open * (1 + randomChange + trend);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Number(open.toFixed(6)),
        high: Number(high.toFixed(6)),
        low: Number(low.toFixed(6)),
        close: Number(close.toFixed(6)),
        volume: Math.floor(Math.random() * 500000) + 100000
      });
      
      price = close;
    }
    
    if (data.length > 0) {
      const lastCandle = data[data.length - 1];
      lastCandle.close = currentPrice;
      lastCandle.high = Math.max(lastCandle.high, currentPrice);
      lastCandle.low = Math.min(lastCandle.low, currentPrice);
    }
    
    return data;
  }

  private generateFallbackData(days: number): OHLCData[] {
    const data: OHLCData[] = [];
    let price = 0.045;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const volatility = 0.12;
      const open = price;
      const change = (Math.random() - 0.5) * volatility;
      const high = open * (1 + Math.abs(change) + Math.random() * 0.02);
      const low = open * (1 - Math.abs(change) - Math.random() * 0.02);
      const close = open * (1 + change);
      
      data.push({
        time: date.toISOString().split('T')[0],
        open: Number(open.toFixed(6)),
        high: Number(high.toFixed(6)),
        low: Number(low.toFixed(6)),
        close: Number(close.toFixed(6)),
        volume: Math.floor(Math.random() * 300000) + 50000
      });
      
      price = close;
    }
    
    return data;
  }
}