import { create } from 'zustand';
import { DualOracleService } from '@/servers/DualOracleService';
import { PasskeyService, PasskeyAuth, AuthResult, ContractAddresses } from '@/servers/PasskeyService';

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface UserPosition {
  id: string;
  symbol: string;
  size: number;
  entryPrice: number;
  unrealizedPnl: number;
  side: 'long' | 'short';
  leverage: number; // Added leverage to position
}

export interface VaultInfo {
  totalLiquidity: number;
  userShares: number;
  apy: number;
  totalShares: number;
}

export interface TradingState {
  // Services
  oracleService: DualOracleService;
  passkeyService: PasskeyService;

  // Trading pair data
  currentPair: TradingPair;
  
  // Passkey authentication state
  passkeyAuth: PasskeyAuth;
  
  // User state
  isConnected: boolean;
  balance: number;
  kaleBalance: string;
  stellarBalance: string;
  positions: UserPosition[];
  
  // Trading panel state
  orderType: 'market' | 'limit';
  orderSide: 'long' | 'short';
  orderSize: string;
  orderPrice: string;
  leverage: number; // Added leverage state
  
  // Vault state
  vaultInfo: VaultInfo | null;
  vaultLoading: boolean;
  
  // Loading states
  positionsLoading: boolean;
  orderLoading: boolean;
  balanceLoading: boolean;
  
  // Contract addresses and prices
  contractAddresses: ContractAddresses;
  currentPrices: any;
  
  // Add operation lock to prevent concurrent calls
  operationInProgress: boolean;
  
  // Actions
  setPair: (pair: TradingPair) => void;
  setBalance: (balance: number) => void;
  setConnected: (connected: boolean) => void;
  setPositions: (positions: UserPosition[]) => void;
  setOrderType: (type: 'market' | 'limit') => void;
  setOrderSide: (side: 'long' | 'short') => void;  setOrderSize: (size: string) => void;
  setOrderPrice: (price: string) => void;
  setLeverage: (leverage: number) => void; // Added leverage setter

  debugContractState: () => Promise<void>;
  checkContractStatus: () => Promise<void>;
  executeTradeWithDebug: (market: string, isLong: boolean, amount: string, leverage: number) => Promise<{ success: boolean; error?: string; transactionHash?: string }>;
  
  // Passkey authentication actions
  authenticateWithPasskey: () => Promise<AuthResult>;
  registerPasskey: (username?: string) => Promise<AuthResult>;
  signOutPasskey: () => void;
  checkPasskeyStatus: () => void;
  
  // Smart contract integration actions
  refreshBalances: () => Promise<void>;
  getCurrentPrices: () => Promise<void>;
  executeSmartContractTrade: (market: string, isLong: boolean, amount: string, leverage: number) => Promise<{ success: boolean; error?: string; transactionHash?: string }>;
  
  // Trading actions
  placeOrder: () => Promise<{ success: boolean; error?: string; transactionHash?: string }>;
  closePosition: (positionId: string) => Promise<{ success: boolean; error?: string }>;
  refreshPositions: () => Promise<void>;
  cancelAllOrders: () => Promise<void>;
  
  // Vault actions
  loadVaultInfo: () => Promise<void>;
  depositToVault: (amount: number) => Promise<{ success: boolean; error?: string }>;
  withdrawFromVault: (amount: number) => Promise<{ success: boolean; error?: string }>;

  
}

// Contract addresses from your deployment
const CONTRACT_ADDRESSES: ContractAddresses = {
  kaleToken: 'CAAVU2UQJLMZ3GUZFM56KVNHLPA3ZSSNR4VP2U53YBXFD2GI3QLIVHZZ',
  oracle: 'CCQFLFIIP6VOTVWU3ENWZGRITY3UNAZT3SRPDF27JEAXNEVIGR3OA3IQ',
  trading: 'CACR6U34NZEAROL7EEH22HHLEE6URKE43FB23CLLSOC3XZCMXUNM5Z2I',
  vault: 'CCYALTIG7PMV7HSKXVWNBEKDCI6ED2N7SS2FNP322AIH35GFMVSMHWEG',
  shareToken: 'CCPU63KOWDVITW442XCC6CBVMINZME4X2JD6IDAGNNS3ILRX7HVXVHBV'
};

export const useTradingStore = create<TradingState>((set, get) => ({
  // Services - Initialize with contract addresses
  oracleService: new DualOracleService(),
  passkeyService: new PasskeyService(CONTRACT_ADDRESSES),
  
  // Initial state
  currentPair: {
    symbol: 'XLM-USD',
    baseAsset: 'XLM',
    quoteAsset: 'USD',
    price: 0.50,
    change24h: 2.34,
    volume24h: 1250000,
  },
  
  // Passkey authentication state
  passkeyAuth: {
    isAuthenticated: false,
    userId: undefined,
    publicKey: undefined,
    stellarPublicKey: undefined,
    contractId: undefined
  },
  
  isConnected: false,
  balance: 0,
  kaleBalance: '0',
  stellarBalance: '0',
  positions: [],
  
  orderType: 'market',
  orderSide: 'long',
  orderSize: '',
  orderPrice: '',
  leverage: 1, // Default leverage
  
  vaultInfo: null,
  vaultLoading: false,
  positionsLoading: false,
  orderLoading: false,
  balanceLoading: false,
  operationInProgress: false,
  
  contractAddresses: CONTRACT_ADDRESSES,
  currentPrices: null,
  
  // Basic actions
  setPair: (pair) => set({ currentPair: pair }),
  setBalance: (balance) => set({ balance }),
  setConnected: (connected) => set({ isConnected: connected }),
  setPositions: (positions) => set({ positions }),
  setOrderType: (type) => set({ orderType: type }),
  setOrderSide: (side) => set({ orderSide: side }),
  setOrderSize: (size) => set({ orderSize: size }),
  setOrderPrice: (price) => set({ orderPrice: price }),
  setLeverage: (leverage) => set({ leverage }),
  
  // Passkey authentication actions with concurrency control
  checkPasskeyStatus: async () => {
    const { passkeyService, operationInProgress } = get();
    
    if (operationInProgress) {
      console.log('Operation already in progress, skipping status check');
      return;
    }
    
    const authStatus = passkeyService.getAuthStatus();
    const isConnected = authStatus.isAuthenticated;
    
    set({ 
      passkeyAuth: authStatus,
      isConnected
    });
    
    // Load user data if authenticated
    if (isConnected && !operationInProgress) {
      set({ operationInProgress: true });
      
      try {
        const { refreshBalances, getCurrentPrices } = get();
        
        await refreshBalances().catch(console.error);
        await getCurrentPrices().catch(console.error);
      } finally {
        set({ operationInProgress: false });
      }
    }
  },

  debugContractState: async () => {
    const { passkeyService, passkeyAuth } = get();
    
    if (!passkeyAuth.isAuthenticated) {
      console.log('Not authenticated for debugging');
      return;
    }
    
    try {
      console.log('Starting comprehensive contract debug...');
      await passkeyService.debugContractState();
    } catch (error) {
      console.error('Debug failed:', error);
    }
  },

  // Check contract initialization and market status
  checkContractStatus: async () => {
    const { passkeyService } = get();
    
    try {
      console.log('Checking contract status...');
      await passkeyService.checkContractInitialization();
      await passkeyService.checkMarketConfiguration();
    } catch (error) {
      console.error('Contract status check failed:', error);
    }
  },

    // Enhanced trade execution with better error handling
  executeTradeWithDebug: async (market: string, isLong: boolean, amount: string, leverage: number) => {
    const { passkeyService, passkeyAuth } = get();
    
    if (!passkeyAuth.isAuthenticated) {
      return { success: false, error: 'Please authenticate with your passkey first' };
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Please enter a valid trade amount' };
    }
    
    if (leverage < 1 || leverage > 100) {
      return { success: false, error: 'Leverage must be between 1x and 100x' };
    }
    
    set({ orderLoading: true });
    
    try {
      console.log('Executing trade with debug info:', { market, isLong, amount, leverage });
      
      // First try the submit-based approach
      console.log('Trying submit-based trade execution...');
      const submitResult = await passkeyService.executeTradeViaSubmit(market, isLong, amount, leverage);
      
      if (submitResult.success) {
        console.log('Submit-based trade successful:', submitResult.transactionHash);
        
        // Refresh balances after successful trade
        await get().refreshBalances().catch(console.error);
        
        return { 
          success: true, 
          transactionHash: submitResult.transactionHash 
        };
      } else {
        console.log('Submit-based trade failed, trying original create_position...');
        
        // Fallback to original method with additional debugging
        const originalResult = await passkeyService.executeTrade(market, isLong, amount, leverage);
        
        if (originalResult.success) {
          await get().refreshBalances().catch(console.error);
          return { 
            success: true, 
            transactionHash: originalResult.transactionHash 
          };
        } else {
          // If both methods fail, run debug
          console.log('Both trade methods failed, running debug...');
          await passkeyService.debugContractState();
          
          return { 
            success: false, 
            error: `Both trade methods failed. Submit error: ${submitResult.error}. Create position error: ${originalResult.error}` 
          };
        }
      }
      
    } catch (error) {
      console.error('Enhanced trade execution failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      set({ orderLoading: false });
    }
  },

  
  registerPasskey: async (username?: string) => {
    const { passkeyService, operationInProgress } = get();
    
    if (operationInProgress) {
      return {
        success: false,
        error: 'Another operation is in progress'
      };
    }
    
    set({ operationInProgress: true });
    
    try {
      console.log('Registering new passkey...');
      
      const result = await passkeyService.register(username);
      
      if (result.success) {
        const authStatus = passkeyService.getAuthStatus();
        set({ 
          passkeyAuth: authStatus,
          isConnected: true
        });
        
        // Load user data after successful registration
        const { refreshBalances, getCurrentPrices } = get();
        await refreshBalances().catch(console.error);
        await getCurrentPrices().catch(console.error);
        
        console.log('Passkey registered and user authenticated');
      }
      
      return result;
      
    } catch (error) {
      console.error('Passkey registration failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    } finally {
      set({ operationInProgress: false });
    }
  },
  
  authenticateWithPasskey: async () => {
    const { passkeyService, operationInProgress } = get();
    
    if (operationInProgress) {
      return {
        success: false,
        error: 'Another operation is in progress'
      };
    }
    
    set({ operationInProgress: true });
    
    try {
      console.log('Authenticating with passkey...');
      
      // Check if user has existing passkey
      const currentAuth = passkeyService.getAuthStatus();
      
      if (!currentAuth.userId) {
        // No existing passkey, need to register first
        console.log('No existing passkey found, starting registration...');
        const result = await get().registerPasskey();
        return result;
      }
      
      // Authenticate with existing passkey
      const result = await passkeyService.authenticate();
      
      if (result.success) {
        const authStatus = passkeyService.getAuthStatus();
        set({ 
          passkeyAuth: authStatus,
          isConnected: true
        });
        
        // Load user data after successful authentication
        const { refreshBalances, getCurrentPrices } = get();
        await refreshBalances().catch(console.error);
        await getCurrentPrices().catch(console.error);
        
        console.log('Passkey authentication successful');
      }
      
      return result;
      
    } catch (error) {
      console.error('Passkey authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    } finally {
      set({ operationInProgress: false });
    }
  },
  
  signOutPasskey: () => {
    const { passkeyService } = get();
    passkeyService.clearAuth();
    
    set({
      passkeyAuth: {
        isAuthenticated: false,
        userId: undefined,
        publicKey: undefined,
        stellarPublicKey: undefined,
        contractId: undefined
      },
      isConnected: false,
      balance: 0,
      kaleBalance: '0',
      stellarBalance: '0',
      positions: [],
      vaultInfo: null,
      currentPrices: null,
      operationInProgress: false,
      orderSize: '',
      orderPrice: '',
      leverage: 1
    });
    console.log('Signed out from passkey authentication');
  },
  
  // Smart contract integration actions
  refreshBalances: async () => {
    const { passkeyService, passkeyAuth } = get();
    
    if (!passkeyAuth.isAuthenticated) {
      console.log('Not authenticated, skipping balance refresh');
      return;
    }
    
    set({ balanceLoading: true });
    
    try {
      const kaleResult = await passkeyService.getKaleBalance();
      if (kaleResult.success && kaleResult.balance) {
        set({ 
          kaleBalance: kaleResult.balance,
          balance: parseFloat(kaleResult.balance)
        });
        console.log('KALE balance refreshed:', kaleResult.balance);
      } else {
        console.error('Failed to get KALE balance:', kaleResult.error);
        set({ 
          kaleBalance: '0',
          balance: 0
        });
      }
      
    } catch (error) {
      console.error('Failed to refresh balances:', error);
      set({ 
        kaleBalance: '0',
        balance: 0
      });
    } finally {
      set({ balanceLoading: false });
    }
  },
  
  getCurrentPrices: async () => {
    const { passkeyService } = get();
    
    try {
      const pricesResult = await passkeyService.getPrices();
      if (pricesResult.success && pricesResult.prices) {
        set({ currentPrices: pricesResult.prices });
        console.log('Current prices updated:', pricesResult.prices);
      } else {
        console.error('Failed to get prices:', pricesResult.error);
        set({ 
          currentPrices: {
            KALE: 1.0,
            XLM: 0.5,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Failed to get current prices:', error);
      set({ 
        currentPrices: {
          KALE: 1.0,
          XLM: 0.5,
          timestamp: Date.now()
        }
      });
    }
  },
  
  executeSmartContractTrade: async (market: string, isLong: boolean, amount: string, leverage: number) => {
    const { passkeyService, passkeyAuth } = get();
    
    if (!passkeyAuth.isAuthenticated) {
      return { success: false, error: 'Please authenticate with your passkey first' };
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Please enter a valid trade amount' };
    }
    
    if (leverage < 1 || leverage > 100) {
      return { success: false, error: 'Leverage must be between 1x and 100x' };
    }
    
    set({ orderLoading: true });
    
    try {
      console.log('Executing smart contract trade:', { market, isLong, amount, leverage });
      
      const result = await passkeyService.executeTrade(market, isLong, amount, leverage);
      
      if (result.success) {
        console.log('Smart contract trade executed:', result.transactionHash);
        
        // Refresh balances after successful trade
        await get().refreshBalances().catch(console.error);
        
        return { 
          success: true, 
          transactionHash: result.transactionHash 
        };
      } else {
        return { 
          success: false, 
          error: result.error || 'Smart contract trade failed' 
        };
      }
      
    } catch (error) {
      console.error('Smart contract trade failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      set({ orderLoading: false });
    }
  },
  
  // Trading actions
  placeOrder: async () => {
    const { 
      orderSide, 
      orderSize, 
      leverage,
      currentPair,
      executeSmartContractTrade
    } = get();
    
    if (!orderSize || parseFloat(orderSize) <= 0) {
      return { success: false, error: 'Please enter a valid order size' };
    }
    
    if (leverage < 1 || leverage > 100) {
      return { success: false, error: 'Leverage must be between 1x and 100x' };
    }
    
    // Try smart contract trade for supported markets
    const supportedMarkets = ['XLM', 'BTC', 'ETH'];
    const market = currentPair.baseAsset;
    
    if (supportedMarkets.includes(market)) {
      console.log('Using smart contract trade for supported market:', market);
      
      const isLong = orderSide === 'long';
      
      const smartContractResult = await executeSmartContractTrade(
        market, 
        isLong, 
        orderSize, 
        leverage
      );
      
      if (smartContractResult.success) {
        set({ orderSize: '', orderPrice: '' });
        return smartContractResult;
      }
      
      return smartContractResult;
    }
    
    return { success: false, error: 'Market not supported for smart contract trading' };
  },
  
  // Simplified placeholder methods for other actions
  closePosition: async (positionId: string) => {
    console.log('Closing position:', positionId);
    return { success: false, error: 'Position closing not implemented yet' };
  },
  
  refreshPositions: async () => {
    console.log('Refreshing positions - placeholder');
  },
  
  cancelAllOrders: async () => {
    console.log('Cancelling all orders - placeholder');
  },
  
  loadVaultInfo: async () => {
    console.log('Loading vault info - placeholder');
  },
  
  depositToVault: async (amount: number) => {
    console.log('Depositing to vault:', amount);
    return { success: false, error: 'Vault deposit not implemented yet' };
  },
  
  withdrawFromVault: async (amount: number) => {
    console.log('Withdrawing from vault:', amount);
    return { success: false, error: 'Vault withdrawal not implemented yet' };
  },
}));

// Initialize passkey status on store creation
setTimeout(() => {
  const store = useTradingStore.getState();
  if (!store.operationInProgress) {
    store.checkPasskeyStatus();
  }
}, 500);