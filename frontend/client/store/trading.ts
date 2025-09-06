import { create } from 'zustand';
import { DualOracleService } from '@/servers/DualOracleService';

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
}

export interface PasskeyAuth {
  isAuthenticated: boolean;
  publicKey?: string;
  userId?: string;
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
  
  // Trading pair data
  currentPair: TradingPair;
  
  // User state
  isConnected: boolean;
  balance: number;
  positions: UserPosition[];
  
  // Passkey authentication
  passkeyAuth: PasskeyAuth;
  
  // Trading panel state
  orderType: 'market' | 'limit';
  orderSide: 'buy' | 'sell';
  orderSize: string;
  orderPrice: string;
  
  // Vault state
  vaultInfo: VaultInfo | null;
  vaultLoading: boolean;
  
  // Loading states
  positionsLoading: boolean;
  orderLoading: boolean;
  
  // Actions
  setPair: (pair: TradingPair) => void;
  setBalance: (balance: number) => void;
  setConnected: (connected: boolean) => void;
  setPositions: (positions: UserPosition[]) => void;
  setPasskeyAuth: (auth: PasskeyAuth) => void;
  setOrderType: (type: 'market' | 'limit') => void;
  setOrderSide: (side: 'buy' | 'sell') => void;
  setOrderSize: (size: string) => void;
  setOrderPrice: (price: string) => void;
  
  // Trading actions
  authenticateWithPasskey: () => Promise<void>;
  placeOrder: () => Promise<{ success: boolean; error?: string }>;
  closePosition: (positionId: string) => Promise<{ success: boolean; error?: string }>;
  refreshPositions: () => Promise<void>;
  cancelAllOrders: () => Promise<void>;
  
  // Vault actions
  loadVaultInfo: () => Promise<void>;
  depositToVault: (amount: number) => Promise<{ success: boolean; error?: string }>;
  withdrawFromVault: (amount: number) => Promise<{ success: boolean; error?: string }>;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  // Services
  oracleService: new DualOracleService(),
  
  // Initial state
  currentPair: {
    symbol: 'KALE-USD',
    baseAsset: 'KALE',
    quoteAsset: 'USD',
    price: 0.045,
    change24h: 2.34,
    volume24h: 1250000,
  },
  
  isConnected: false,
  balance: 0,
  positions: [],
  
  passkeyAuth: {
    isAuthenticated: false,
  },
  
  orderType: 'market',
  orderSide: 'buy',
  orderSize: '',
  orderPrice: '',
  
  vaultInfo: null,
  vaultLoading: false,
  positionsLoading: false,
  orderLoading: false,
  
  // Actions
  setPair: (pair) => set({ currentPair: pair }),
  setBalance: (balance) => set({ balance }),
  setConnected: (connected) => set({ isConnected: connected }),
  setPositions: (positions) => set({ positions }),
  setPasskeyAuth: (auth) => set({ passkeyAuth: auth }),
  setOrderType: (type) => set({ orderType: type }),
  setOrderSide: (side) => set({ orderSide: side }),
  setOrderSize: (size) => set({ orderSize: size }),
  setOrderPrice: (price) => set({ orderPrice: price }),
  
  // Trading actions
  authenticateWithPasskey: async () => {
    try {
      // Mock passkey authentication
      const mockAuth: PasskeyAuth = {
        isAuthenticated: true,
        publicKey: 'GBEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGH',
        userId: 'user-123',
      };
      
      set({ 
        passkeyAuth: mockAuth, 
        isConnected: true, 
        balance: 1000 
      });
      
      // Load user positions and vault info after connection
      const { refreshPositions, loadVaultInfo } = get();
      await Promise.all([
        refreshPositions(),
        loadVaultInfo()
      ]);
      
    } catch (error) {
      console.error('Passkey authentication failed:', error);
    }
  },
  
  placeOrder: async () => {
    const { 
      orderType, 
      orderSide, 
      orderSize, 
      orderPrice, 
      currentPair, 
      isConnected,
      passkeyAuth,
      oracleService
    } = get();
    
    if (!isConnected || !passkeyAuth.publicKey) {
      return { success: false, error: 'Please connect your wallet first' };
    }
    
    if (!orderSize || parseFloat(orderSize) <= 0) {
      return { success: false, error: 'Please enter a valid order size' };
    }
    
    if (orderType === 'limit' && (!orderPrice || parseFloat(orderPrice) <= 0)) {
      return { success: false, error: 'Please enter a valid price for limit order' };
    }
    
    set({ orderLoading: true });
    
    try {
      const amount = parseFloat(orderSize);
      const price = orderType === 'limit' ? parseFloat(orderPrice) : undefined;
      
      const result = await oracleService.executeTrade(
        orderSide,
        amount,
        passkeyAuth.publicKey,
        price
      );
      
      if (result.success) {
        console.log('Order placed successfully:', result.transactionId);
        
        // Reset form and refresh positions
        set({ orderSize: '', orderPrice: '' });
        await get().refreshPositions();
        
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Order failed' };
      }
      
    } catch (error) {
      console.error('Order placement failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      set({ orderLoading: false });
    }
  },
  
  closePosition: async (positionId: string) => {
    const { passkeyAuth, oracleService } = get();
    
    if (!passkeyAuth.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }
    
    try {
      const result = await oracleService.closePosition(
        positionId,
        passkeyAuth.publicKey
      );
      
      if (result.success) {
        console.log('Position closed successfully:', result.transactionId);
        await get().refreshPositions();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Position close failed' };
      }
      
    } catch (error) {
      console.error('Position close failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
  
  refreshPositions: async () => {
    const { passkeyAuth, oracleService } = get();
    
    if (!passkeyAuth.publicKey) return;
    
    set({ positionsLoading: true });
    
    try {
      const positions = await oracleService.getUserPositions(passkeyAuth.publicKey);
      set({ positions });
    } catch (error) {
      console.error('Failed to refresh positions:', error);
    } finally {
      set({ positionsLoading: false });
    }
  },
  
  cancelAllOrders: async () => {
    console.log('Cancelling all orders');
    // Implement cancel all orders logic
  },
  
  // Vault actions
  loadVaultInfo: async () => {
    const { oracleService } = get();
    
    set({ vaultLoading: true });
    
    try {
      const vaultInfo = await oracleService.getVaultInfo();
      set({ vaultInfo });
    } catch (error) {
      console.error('Failed to load vault info:', error);
    } finally {
      set({ vaultLoading: false });
    }
  },
  
  depositToVault: async (amount: number) => {
    const { passkeyAuth, oracleService } = get();
    
    if (!passkeyAuth.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }
    
    if (amount <= 0) {
      return { success: false, error: 'Invalid deposit amount' };
    }
    
    try {
      const result = await oracleService.depositToVault(
        amount,
        passkeyAuth.publicKey
      );
      
      if (result.success) {
        console.log('Vault deposit successful:', result.transactionId);
        await get().loadVaultInfo();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Deposit failed' };
      }
      
    } catch (error) {
      console.error('Vault deposit failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
  
  withdrawFromVault: async (amount: number) => {
    const { passkeyAuth, oracleService } = get();
    
    if (!passkeyAuth.publicKey) {
      return { success: false, error: 'Wallet not connected' };
    }
    
    if (amount <= 0) {
      return { success: false, error: 'Invalid withdrawal amount' };
    }
    
    try {
      const result = await oracleService.withdrawFromVault(
        amount,
        passkeyAuth.publicKey
      );
      
      if (result.success) {
        console.log('Vault withdrawal successful:', result.transactionId);
        await get().loadVaultInfo();
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Withdrawal failed' };
      }
      
    } catch (error) {
      console.error('Vault withdrawal failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
}));