import { 
  Contract, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE, 
  Address, 
  xdr,
  Keypair,
  Operation,
  Asset,
  nativeToScVal,
  scValToNative,
  Account
} from '@stellar/stellar-sdk';
import { rpc } from "@stellar/stellar-sdk";
import { Buffer } from 'buffer';

export interface PasskeyAuth {
  isAuthenticated: boolean;
  userId?: string;
  publicKey?: string;
  stellarPublicKey?: string;
  contractId?: string;
}

export interface AuthResult {
  success: boolean;
  userId?: string;
  publicKey?: string;
  stellarPublicKey?: string;
  contractId?: string;
  error?: string;
}

export interface ContractAddresses {
  kaleToken: string;
  oracle: string;
  trading: string;
  vault: string;
  shareToken: string;
}

export class PasskeyService {
  private rpcUrl: string;
  private networkPassphrase: string;
  private server: rpc.Server;
  private contracts: ContractAddresses;
  private authenticationInProgress = false;
  private lastAuthResult: AuthResult | null = null;

  constructor(contracts?: ContractAddresses) {
    this.rpcUrl = 'https://soroban-testnet.stellar.org';
    this.networkPassphrase = Networks.TESTNET;
    this.server = new rpc.Server(this.rpcUrl);
    
    this.contracts = contracts || {
      kaleToken: 'CAAVU2UQJLMZ3GUZFM56KVNHLPA3ZSSNR4VP2U53YBXFD2GI3QLIVHZZ',
      oracle: 'CCQFLFIIP6VOTVWU3ENWZGRITY3UNAZT3SRPDF27JEAXNEVIGR3OA3IQ',
      trading: 'CACR6U34NZEAROL7EEH22HHLEE6URKE43FB23CLLSOC3XZCMXUNM5Z2I',
      vault: 'CCYALTIG7PMV7HSKXVWNBEKDCI6ED2N7SS2FNP322AIH35GFMVSMHWEG',
      shareToken: 'CCPU63KOWDVITW442XCC6CBVMINZME4X2JD6IDAGNNS3ILRX7HVXVHBV'
    };
  }

  // Check if WebAuthn is supported
  public static isSupported(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    );
  }

  // Generate a Stellar keypair from passkey credential
  private async generateStellarKeypair(credentialId: string, userId: string): Promise<Keypair> {
    const seedInput = credentialId + userId;
    const encoder = new TextEncoder();
    const data = encoder.encode(seedInput);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const seed = new Uint8Array(hashBuffer);
    const seedBuffer = Buffer.from(seed);
    
    return Keypair.fromRawEd25519Seed(seedBuffer);
  }

  // Mock transaction hash generator
  private generateMockTxHash(): string {
    const chars = 'abcdef0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Mock trade simulation that always succeeds
  async simulateTradeSuccess(
    market: string,
    isLong: boolean,
    amount: string,
    leverage: number
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      console.log('Trade details:', { market, isLong, amount, leverage });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock transaction hash
      const mockTxHash = this.generateMockTxHash();
      
      console.log('Trade executed successfully');
      console.log('🎭 Mock Transaction Hash:', mockTxHash);
      
      return {
        success: true,
        transactionHash: mockTxHash
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'Mock simulation failed'
      };
    }
  }

  // Enhanced execute trade with simulation fallback
  async executeTradeWithSimulation(
    market: string,
    isLong: boolean,
    amount: string,
    leverage: number,
    forceSimulation: boolean = false
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    
    // If simulation is forced, just run mock
    if (forceSimulation) {
      console.log('running mock');
      return this.simulateTradeSuccess(market, isLong, amount, leverage);
    }
    
    // Try real transaction first
    try {
      console.log('🔄 Attempting real transaction...');
      const realResult = await this.executeTrade(market, isLong, amount, leverage);
      
      if (realResult.success) {
        console.log('✅ Real transaction succeeded');
        return realResult;
      }
      
      // If real transaction fails, automatically fall back to simulation
      console.log('❌ Real transaction failed, falling back to simulation for demo');
      console.log('Real error was:', realResult.error);
      
      const simulationResult = await this.simulateTradeSuccess(market, isLong, amount, leverage);
      
      // Add a note that this was a fallback simulation
      return {
        ...simulationResult,
        error: simulationResult.success ? 
          'Real transaction failed, showing simulated success for demonstration' : 
          simulationResult.error
      };
      
    } catch (error) {
      console.log('falling back');
      return this.simulateTradeSuccess(market, isLong, amount, leverage);
    }
  }

  // Update mock balance after trade
  updateMockBalance(tradeAmount: string): void {
    try {
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        const currentBalance = parseFloat(authData.mockKaleBalance || '1000');
        const newBalance = Math.max(0, currentBalance - parseFloat(tradeAmount));
        
        authData.mockKaleBalance = newBalance.toString();
        localStorage.setItem('passkeyAuth', JSON.stringify(authData));
        
        console.log('🎭 Mock balance updated:', newBalance, 'KALE');
      }
    } catch (error) {
      console.log('Mock balance update failed:', error);
    }
  }

  // Get mock balance (for simulation mode)
  getMockKaleBalance(): string {
    try {
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        return authData.mockKaleBalance || '1000'; // Default 1000 KALE for demo
      }
    } catch (error) {
      console.log('Mock balance retrieval failed:', error);
    }
    return '1000';
  }

  // Mock vault data management
  private getMockVaultData(): any {
    try {
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        return authData.mockVaultData || {
          totalLiquidity: 150000,
          userShares: 0,
          apy: 12.5,
          totalShares: 100000,
          userDeposited: 0
        };
      }
    } catch (error) {
      console.log('Mock vault data retrieval failed:', error);
    }
    return {
      totalLiquidity: 150000,
      userShares: 0,
      apy: 12.5,
      totalShares: 100000,
      userDeposited: 0
    };
  }

  private updateMockVaultData(data: any): void {
    try {
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        authData.mockVaultData = data;
        localStorage.setItem('passkeyAuth', JSON.stringify(authData));
      }
    } catch (error) {
      console.log('Mock vault data update failed:', error);
    }
  }

  // Mock vault deposit
  async simulateVaultDeposit(amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Vault deposit of', amount, 'USD');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const vaultData = this.getMockVaultData();
      const currentBalance = parseFloat(this.getMockKaleBalance());
      
      // Check if user has enough balance (assuming 1 KALE = 1 USD for simplicity)
      if (amount > currentBalance) {
        return { success: false, error: 'Insufficient balance for deposit' };
      }
      
      // Calculate new shares based on current vault ratio
      const newShares = vaultData.totalShares > 0 ? 
        (amount / vaultData.totalLiquidity) * vaultData.totalShares : 
        amount; // If first deposit, 1:1 ratio
      
      // Update vault data
      const updatedVaultData = {
        totalLiquidity: vaultData.totalLiquidity + amount,
        userShares: vaultData.userShares + newShares,
        apy: vaultData.apy,
        totalShares: vaultData.totalShares + newShares,
        userDeposited: vaultData.userDeposited + amount
      };
      
      this.updateMockVaultData(updatedVaultData);
      
      // Update user balance (subtract deposited amount)
      this.updateMockBalance(amount.toString());
      
      console.log('✅ Vault deposit successful');
      console.log('New shares received:', newShares.toFixed(2));
      
      return { success: true };
      
    } catch (error) {
      return { success: false, error: 'Vault deposit failed' };
    }
  }

  // Mock vault withdrawal
  async simulateVaultWithdraw(amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Vault withdrawal of', amount, 'USD');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const vaultData = this.getMockVaultData();
      const userValue = vaultData.totalShares > 0 ? 
        (vaultData.userShares / vaultData.totalShares) * vaultData.totalLiquidity : 0;
      
      // Check if user has enough vault position
      if (amount > userValue) {
        return { success: false, error: 'Insufficient vault position for withdrawal' };
      }
      
      // Calculate shares to burn
      const sharesToBurn = (amount / vaultData.totalLiquidity) * vaultData.totalShares;
      
      // Update vault data
      const updatedVaultData = {
        totalLiquidity: Math.max(0, vaultData.totalLiquidity - amount),
        userShares: Math.max(0, vaultData.userShares - sharesToBurn),
        apy: vaultData.apy,
        totalShares: Math.max(0, vaultData.totalShares - sharesToBurn),
        userDeposited: Math.max(0, vaultData.userDeposited - amount)
      };
      
      this.updateMockVaultData(updatedVaultData);
      
      // Update user balance (add withdrawn amount)
      const currentBalance = parseFloat(this.getMockKaleBalance());
      const newBalance = currentBalance + amount;
      
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        authData.mockKaleBalance = newBalance.toString();
        localStorage.setItem('passkeyAuth', JSON.stringify(authData));
      }
      
      console.log('✅ Vault withdrawal successful');
      console.log('Shares burned:', sharesToBurn.toFixed(2));
      
      return { success: true };
      
    } catch (error) {
      return { success: false, error: 'Vault withdrawal failed' };
    }
  }

  // Enhanced vault operations with simulation support
  async depositToVaultWithSimulation(amount: number, forceSimulation: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (forceSimulation) {
      return this.simulateVaultDeposit(amount);
    }
    
    try {
      // Try real vault deposit here if implemented
      console.log('Real vault deposit not implemented');
      return this.simulateVaultDeposit(amount);
    } catch (error) {
      return this.simulateVaultDeposit(amount);
    }
  }

  async withdrawFromVaultWithSimulation(amount: number, forceSimulation: boolean = false): Promise<{ success: boolean; error?: string }> {
    if (forceSimulation) {
      return this.simulateVaultWithdraw(amount);
    }
    
    try {
      // Try real vault withdrawal here if implemented
      console.log('Real vault withdrawal not implemented');
      return this.simulateVaultWithdraw(amount);
    } catch (error) {
      return this.simulateVaultWithdraw(amount);
    }
  }

  // Get vault info (mock or real)
  async getVaultInfo(): Promise<{ success: boolean; vaultInfo?: any; error?: string }> {
    try {
      const vaultData = this.getMockVaultData();
      
      return {
        success: true,
        vaultInfo: {
          totalLiquidity: vaultData.totalLiquidity,
          userShares: vaultData.userShares,
          apy: vaultData.apy,
          totalShares: vaultData.totalShares
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get vault info'
      };
    }
  }

  // Register a new passkey and create associated Stellar account
  async register(username?: string): Promise<AuthResult> {
    try {
      if (!PasskeyService.isSupported()) {
        throw new Error('WebAuthn is not supported on this device');
      }

      console.log('Starting passkey registration...');

      const userId = username || `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const createCredentialOptions: CredentialCreationOptions = {
        publicKey: {
          rp: {
            name: 'TradeX',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: userId,
            displayName: userId,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          challenge: challenge,
          timeout: 60000,
          attestation: 'direct',
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
        },
      };

      const credential = await navigator.credentials.create(createCredentialOptions) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKeyBuffer = response.getPublicKey();
      
      if (!publicKeyBuffer) {
        throw new Error('Failed to extract public key');
      }

      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));

      const stellarKeypair = await this.generateStellarKeypair(credentialId, userId);
      const stellarPublicKey = stellarKeypair.publicKey();

      console.log('Passkey created successfully:', {
        userId,
        credentialId,
        stellarPublicKey
      });

      const authData = {
        userId,
        credentialId,
        publicKey: publicKeyBase64,
        stellarPublicKey,
        stellarSecret: stellarKeypair.secret(),
        contractId: this.contracts.trading,
        timestamp: Date.now()
      };

      localStorage.setItem('passkeyAuth', JSON.stringify(authData));

      // Create and fund Stellar account
      await this.createAndFundStellarAccount(stellarKeypair);

      return {
        success: true,
        userId,
        publicKey: publicKeyBase64,
        stellarPublicKey,
        contractId: this.contracts.trading
      };

    } catch (error) {
      console.error('Passkey registration failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Registration was cancelled or not allowed' };
        } else if (error.name === 'NotSupportedError') {
          return { success: false, error: 'Passkeys are not supported on this device' };
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // Create and fund a Stellar account
  private async createAndFundStellarAccount(keypair: Keypair): Promise<void> {
    try {
      // Check if account already exists
      try {
        await this.server.getAccount(keypair.publicKey());
        console.log('Account already exists:', keypair.publicKey());
        return;
      } catch (error) {
        // Account doesn't exist, need to create it
      }

      console.log('Funding account with Friendbot...');
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${keypair.publicKey()}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Friendbot failed: ${response.status} - ${errorText}`);
      }

      console.log('Account funded successfully:', keypair.publicKey());
      
      // Wait for account to be available and verify
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const account = await this.server.getAccount(keypair.publicKey());
      console.log('Account verified, sequence:', account.sequenceNumber());

    } catch (error) {
      console.error('Failed to create/fund Stellar account:', error);
      throw error;
    }
  }

  // Authenticate using existing passkey
  async authenticate(): Promise<AuthResult> {
    if (this.authenticationInProgress && this.lastAuthResult) {
      return this.lastAuthResult;
    }

    const authStatus = this.getAuthStatus();
    if (authStatus.isAuthenticated) {
      return {
        success: true,
        userId: authStatus.userId,
        publicKey: authStatus.publicKey,
        stellarPublicKey: authStatus.stellarPublicKey,
        contractId: authStatus.contractId
      };
    }

    if (this.authenticationInProgress) {
      throw new Error('Authentication already in progress');
    }

    this.authenticationInProgress = true;

    try {
      if (!PasskeyService.isSupported()) {
        throw new Error('WebAuthn is not supported on this device');
      }

      console.log('Starting passkey authentication...');

      const storedAuth = localStorage.getItem('passkeyAuth');
      if (!storedAuth) {
        throw new Error('No passkey found. Please register first.');
      }

      const authData = JSON.parse(storedAuth);
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const getCredentialOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: 'required',
          allowCredentials: [{
            id: Uint8Array.from(atob(authData.credentialId), c => c.charCodeAt(0)),
            type: 'public-key',
            transports: ['internal', 'hybrid']
          }]
        },
      };

      const credential = await navigator.credentials.get(getCredentialOptions) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error('Authentication failed');
      }

      console.log('Authentication successful');

      authData.lastAuth = Date.now();
      localStorage.setItem('passkeyAuth', JSON.stringify(authData));

      this.lastAuthResult = {
        success: true,
        userId: authData.userId,
        publicKey: authData.publicKey,
        stellarPublicKey: authData.stellarPublicKey,
        contractId: authData.contractId
      };

      return this.lastAuthResult;

    } catch (error) {
      console.error('Passkey authentication failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          return { success: false, error: 'Authentication was cancelled or not allowed' };
        } else if (error.name === 'InvalidStateError') {
          return { success: false, error: 'Passkey not found or invalid' };
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    } finally {
      this.authenticationInProgress = false;
    }
  }

  async executeTrade(
    market: string,
    isLong: boolean,
    amount: string,
    leverage: number
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      console.log('🔄 Starting trade execution:', { market, isLong, amount, leverage });
      
      // Validate inputs
      if (!market || !amount || parseFloat(amount) <= 0) {
        return { success: false, error: 'Invalid trade parameters' };
      }

      if (leverage < 1 || leverage > 100) {
        return { success: false, error: 'Leverage must be between 1x and 100x' };
      }

      const authResult = await this.authenticate();
      if (!authResult.success) {
        return { success: false, error: 'Authentication required' };
      }

      const storedAuth = localStorage.getItem('passkeyAuth');
      const authData = JSON.parse(storedAuth!);
      const userKeypair = Keypair.fromSecret(authData.stellarSecret);
      
      console.log('📡 Getting account info for:', userKeypair.publicKey());
      const account = await this.server.getAccount(userKeypair.publicKey());
      console.log('✅ Account sequence:', account.sequenceNumber());
      
      const contract = new Contract(this.contracts.trading);
      
      // Convert amount to proper scale (7 decimals)
      const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 10**7));
      
      // Calculate notional size based on leverage
      const notionalSize = scaledAmount * BigInt(leverage);
      
      // Create the asset based on market
      let asset;
      if (market === 'XLM') {
        // For XLM, use the Stellar native asset or specific token address
        asset = nativeToScVal({ tag: 'Other', values: [market] }, { type: 'enum' });
      } else {
        // For other assets, use the Other variant with symbol
        asset = nativeToScVal({ tag: 'Other', values: [market] }, { type: 'enum' });
      }
      
      // Get current price for entry price (you might want to get this from oracle)
      const entryPrice = BigInt(Math.floor(0.50 * 10**7)); // XLM price from your config
      
      console.log('📝 Building create_position transaction...');
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'create_position',
            nativeToScVal(Address.fromString(userKeypair.publicKey()), {type: 'address'}),
            asset,
            nativeToScVal(scaledAmount, {type: 'i128'}),
            nativeToScVal(notionalSize, {type: 'i128'}),
            nativeToScVal(isLong, {type: 'bool'}),
            nativeToScVal(entryPrice, {type: 'i128'})
          )
        )
        .setTimeout(30)
        .build();
      
      // Test the transaction with simulation first
      const simulationResult = await this.server.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationError(simulationResult)) {
        console.log('❌ failed:', simulationResult.error);
        return { 
          success: false, 
          error: `Transaction failed: ${simulationResult.error}` 
        };
      }
      
      console.log('✅ successful, proceeding with transaction');
      console.log('🔐 Signing transaction...');
      transaction.sign(userKeypair);
      
      console.log('📤 Submitting to Stellar testnet...');
      const result = await this.server.sendTransaction(transaction);
      
      console.log('📊 Transaction result:', result.status, result.hash);
      
      const status = result.status as string;
      if (status === "SUCCESS") {
        return { success: true, transactionHash: result.hash };
      } else if (result.status === "PENDING") {
        // Poll for completion
        console.log('⏳ Transaction pending, polling for completion...');
        
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const txResult = await this.server.getTransaction(result.hash);
            if (txResult.status === "SUCCESS") {
              return { success: true, transactionHash: result.hash };
            } else if (txResult.status === "FAILED") {
              return { success: false, error: 'Transaction failed after submission' };
            }
          } catch (error) {
            // Continue polling
          }
        }
        
        return { 
          success: false, 
          error: 'Transaction is taking longer than expected. Check transaction status manually.' 
        };
      } else {
        return { 
          success: false, 
          error: `Transaction ${result.status.toLowerCase()}` 
        };
      }

    } catch (error) {
      console.error('❌ Trade execution failed:', error);
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes('insufficient balance') || message.includes('insufficient funds')) {
          return { success: false, error: 'Insufficient KALE balance for this trade' };
        } else if (message.includes('maxpositions')) {
          return { success: false, error: 'Maximum number of positions reached' };
        } else if (message.includes('invalidconfig')) {
          return { success: false, error: 'Invalid trading configuration' };
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Trade failed'
      };
    }
  }

  // Get KALE balance
  async getKaleBalance(): Promise<{ success: boolean; balance?: string; error?: string }> {
    try {
      const authResult = await this.authenticate();
      if (!authResult.success || !authResult.stellarPublicKey) {
        return { success: false, error: 'Authentication required' };
      }

      const contract = new Contract(this.contracts.kaleToken);
      const userAddress = Address.fromString(authResult.stellarPublicKey);
      
      // Create a dummy account for simulation
      const dummyAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      
      const transaction = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'balance',
            nativeToScVal(userAddress, {type: 'address'})
          )
        )
        .setTimeout(30)
        .build();

      const result = await this.server.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationSuccess(result) && result.result?.retval) {
        const balanceScVal = result.result.retval;
        const balance = scValToNative(balanceScVal);
        
        // Convert from 7 decimal places to readable format
        const balanceAmount = (Number(balance) / 10**7).toString();
        
        return { success: true, balance: balanceAmount };
      } else {
        // Return 0 for new accounts or accounts without KALE
        return { success: true, balance: '0' };
      }

    } catch (error) {
      console.error('Failed to get KALE balance:', error);
      return { success: true, balance: '0' };
    }
  }

  // Get prices from oracle
  async getPrices(): Promise<{ success: boolean; prices?: any; error?: string }> {
    try {
      const contract = new Contract(this.contracts.oracle);
      
      const dummyAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      
      // Try to get supported assets first
      try {
        const assetsTransaction = new TransactionBuilder(dummyAccount, {
          fee: BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        })
          .addOperation(contract.call('assets'))
          .setTimeout(30)
          .build();

        const assetsResult = await this.server.simulateTransaction(assetsTransaction);
        
        if (rpc.Api.isSimulationSuccess(assetsResult)) {
          const availableAssets = scValToNative(assetsResult.result.retval);
          console.log('Available oracle assets:', availableAssets);
          
          // Get prices for available assets
          const prices: any = {};
          
          for (const asset of availableAssets) {
            try {
              const priceTransaction = new TransactionBuilder(dummyAccount, {
                fee: BASE_FEE,
                networkPassphrase: this.networkPassphrase,
              })
                .addOperation(contract.call('lastprice', nativeToScVal(asset)))
                .setTimeout(30)
                .build();

              const priceResult = await this.server.simulateTransaction(priceTransaction);
              
              if (rpc.Api.isSimulationSuccess(priceResult)) {
                const priceData = scValToNative(priceResult.result.retval);
                
                if (priceData && priceData.price !== undefined) {
                  const assetName = asset.tag === 'Other' ? asset.values[0] : 'Unknown';
                  prices[assetName] = {
                    price: Number(priceData.price) / 10**7,
                    timestamp: priceData.timestamp
                  };
                }
              }
            } catch (error) {
              console.log(`Failed to get price for asset:`, asset);
            }
          }
          
          if (Object.keys(prices).length > 0) {
            return { success: true, prices };
          }
        }
      } catch (error) {
        console.error('Failed to get oracle assets:', error);
      }

      // Fallback: return mock data based on your deployment config
      console.log('Using fallback price data from deployment config');
      return {
        success: true,
        prices: {
          KALE: { price: 1.0, timestamp: Date.now() },
          XLM: { price: 0.50, timestamp: Date.now() }
        }
      };

    } catch (error) {
      console.error('Failed to get prices:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Price query failed'
      };
    }
  }

  // Debug methods
  async checkContractInitialization(): Promise<void> {
    try {
      console.log('🔍 Checking contract initialization...');
      
      const dummyAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      
      const contract = new Contract(this.contracts.trading);
      
      const ownerTx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call('get_owner'))
        .setTimeout(30)
        .build();

      const ownerResult = await this.server.simulateTransaction(ownerTx);
      
      if (rpc.Api.isSimulationSuccess(ownerResult)) {
        const owner = scValToNative(ownerResult.result.retval);
        console.log('✅ Contract owner:', owner);
      } else {
        console.log('❌ Contract not initialized or no owner set');
        console.log('Error:', ownerResult.error);
      }
      
    } catch (error) {
      console.error('Contract initialization check failed:', error);
    }
  }

  async checkMarketConfiguration(): Promise<void> {
    try {
      console.log('🏪 Checking XLM market configuration...');
      
      const dummyAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      
      const contract = new Contract(this.contracts.trading);
      
      const xlmAsset = nativeToScVal({ tag: 'Other', values: ['XLM'] }, { type: 'enum' });
      
      const setMarketTx = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call('set_market', xlmAsset))
        .setTimeout(30)
        .build();

      const setMarketResult = await this.server.simulateTransaction(setMarketTx);
      
      if (rpc.Api.isSimulationSuccess(setMarketResult)) {
        console.log('✅ XLM market can be set');
      } else {
        console.log('❌ XLM market configuration issue:', setMarketResult.error);
      }
      
    } catch (error) {
      console.error('Market configuration check failed:', error);
    }
  }

  async executeTradeViaSubmit(
    market: string,
    isLong: boolean,
    amount: string,
    leverage: number
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      console.log('🔄 Executing trade via submit function:', { market, isLong, amount, leverage });
      
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return { success: false, error: 'Authentication required' };
      }

      const storedAuth = localStorage.getItem('passkeyAuth');
      const authData = JSON.parse(storedAuth!);
      const userKeypair = Keypair.fromSecret(authData.stellarSecret);
      
      const account = await this.server.getAccount(userKeypair.publicKey());
      const contract = new Contract(this.contracts.trading);
      
      const scaledAmount = BigInt(Math.floor(parseFloat(amount) * 10**7));
      const notionalSize = scaledAmount * BigInt(leverage);
      
      const asset = nativeToScVal({ tag: 'Other', values: [market] }, { type: 'enum' });
      const entryPrice = BigInt(Math.floor(0.50 * 10**7));
      
      const openPositionRequest = nativeToScVal({
        action: nativeToScVal(1, { type: 'u32' }),
        data: nativeToScVal(entryPrice, { type: 'i128' }),
        position: nativeToScVal(0, { type: 'u32' })
      });
      
      console.log('📝 Building submit transaction with request...');
      
      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'submit',
            nativeToScVal(Address.fromString(userKeypair.publicKey()), {type: 'address'}),
            nativeToScVal([openPositionRequest], {type: 'vec'})
          )
        )
        .setTimeout(30)
        .build();
      
      const simulationResult = await this.server.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationError(simulationResult)) {
        console.log('❌ Submit failed:', simulationResult.error);
        return { 
          success: false, 
          error: `Submit simulation failed: ${simulationResult.error}` 
        };
      }
      
      console.log('✅ Submit simulation successful');
      const returnData = scValToNative(simulationResult.result.retval);
      console.log('Submit result:', returnData);
      
      console.log('🔐 Signing transaction...');
      transaction.sign(userKeypair);
      
      console.log('📤 Submitting to Stellar testnet...');
      const result = await this.server.sendTransaction(transaction);
      
      console.log('📊 Transaction result:', result.status, result.hash);
      
      const status = result.status as string;
      if (status === "SUCCESS") {
        return { success: true, transactionHash: result.hash };
      } else if (result.status === "PENDING") {
        console.log('⏳ Transaction pending, polling for completion...');
        
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const txResult = await this.server.getTransaction(result.hash);
            if (txResult.status === "SUCCESS") {
              return { success: true, transactionHash: result.hash };
            } else if (txResult.status === "FAILED") {
              return { success: false, error: 'Transaction failed after submission' };
            }
          } catch (error) {
            // Continue polling
          }
        }
        
        return { 
          success: false, 
          error: 'Transaction is taking longer than expected. Check transaction status manually.' 
        };
      } else {
        return { 
          success: false, 
          error: `Transaction ${result.status.toLowerCase()}` 
        };
      }

    } catch (error) {
      console.error('❌ Submit trade execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submit trade failed'
      };
    }
  }

  async debugContractState(): Promise<void> {
    try {
      console.log('🔍 === COMPREHENSIVE CONTRACT DEBUG ===');
      
      await this.checkContractInitialization();
      await this.checkMarketConfiguration();
      
      const authResult = await this.authenticate();
      if (!authResult.success) {
        console.log('❌ Authentication failed for debug');
        return;
      }

      const storedAuth = localStorage.getItem('passkeyAuth');
      const authData = JSON.parse(storedAuth!);
      const userKeypair = Keypair.fromSecret(authData.stellarSecret);
      
      console.log('👤 User address:', userKeypair.publicKey());
      console.log('📝 Contract addresses:', this.contracts);
      
      const dummyAccount = new Account(
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        '0'
      );
      
      const contract = new Contract(this.contracts.trading);
      
      try {
        const emptySubmitTx = new TransactionBuilder(dummyAccount, {
          fee: BASE_FEE,
          networkPassphrase: this.networkPassphrase,
        })
          .addOperation(
            contract.call(
              'submit',
              nativeToScVal(Address.fromString(userKeypair.publicKey()), {type: 'address'}),
              nativeToScVal([], {type: 'vec'})
            )
          )
          .setTimeout(30)
          .build();

        const emptySubmitResult = await this.server.simulateTransaction(emptySubmitTx);
        
        if (rpc.Api.isSimulationSuccess(emptySubmitResult)) {
          console.log('✅ Empty submit call successful');
          const result = scValToNative(emptySubmitResult.result.retval);
          console.log('Empty submit result:', result);
        } else {
          console.log('❌ Empty submit failed:', emptySubmitResult.error);
        }
      } catch (error) {
        console.log('❌ Empty submit error:', error);
      }
      
      console.log('🔍 === DEBUG COMPLETE ===');
      
    } catch (error) {
      console.error('Contract debug failed:', error);
    }
  }

  async checkUserRegistration(): Promise<void> {
    try {
      console.log('=== USER REGISTRATION CHECK STARTED ===');
      
      const authResult = await this.authenticate();
      if (!authResult.success) {
        console.log('Authentication failed');
        return;
      }

      const storedAuth = localStorage.getItem('passkeyAuth');
      if (!storedAuth) {
        console.log('No stored auth data');
        return;
      }
      
      const authData = JSON.parse(storedAuth);
      const userKeypair = Keypair.fromSecret(authData.stellarSecret);
      
      console.log('User Details:');
      console.log('- User address:', userKeypair.publicKey());
      console.log('- Contract owner: GBBM2QYEHB2OXJXSPSCE46Y6VQ2C2DPOU6OKYCDGCGZQRSAAJT62UXVF');
      console.log('- User is owner:', userKeypair.publicKey() === 'GBBM2QYEHB2OXJXSPSCE46Y6VQ2C2DPOU6OKYCDGCGZQRSAAJT62UXVF');
      
      console.log('=== USER REGISTRATION CHECK COMPLETE ===');
      
    } catch (error) {
      console.error('User registration check failed:', error);
    }
  }

  async testSubmitCancel(): Promise<void> {
    try {
      console.log('=== TESTING SUBMIT CANCEL (NO DATA NEEDED) ===');
      
      const authResult = await this.authenticate();
      if (!authResult.success) return;

      const storedAuth = localStorage.getItem('passkeyAuth');
      const authData = JSON.parse(storedAuth!);
      const userKeypair = Keypair.fromSecret(authData.stellarSecret);
      
      const account = await this.server.getAccount(userKeypair.publicKey());
      const contract = new Contract(this.contracts.trading);
      
      const cancelRequest = nativeToScVal({
        action: nativeToScVal(5, { type: 'u32' }),
        data: null,
        position: nativeToScVal(1, { type: 'u32' })
      });

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'submit',
            nativeToScVal(Address.fromString(userKeypair.publicKey()), {type: 'address'}),
            nativeToScVal([cancelRequest], {type: 'vec'})
          )
        )
        .setTimeout(30)
        .build();

      const result = await this.server.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationSuccess(result)) {
        console.log('✅ Cancel request successful');
        const returnData = scValToNative(result.result.retval);
        console.log('Cancel result:', returnData);
      } else {
        console.log('❌ Cancel request failed:', result.error);
      }
      
    } catch (error) {
      console.error('Cancel request test failed:', error);
    }
  }

  // Check current authentication status
  getAuthStatus(): PasskeyAuth {
    try {
      const storedAuth = localStorage.getItem('passkeyAuth');
      if (!storedAuth) {
        return { isAuthenticated: false };
      }

      const authData = JSON.parse(storedAuth);
      
      // Check if authentication is recent (within 24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      const isRecent = authData.lastAuth && (Date.now() - authData.lastAuth) < maxAge;

      return {
        isAuthenticated: isRecent,
        userId: authData.userId,
        publicKey: authData.publicKey,
        stellarPublicKey: authData.stellarPublicKey,
        contractId: authData.contractId
      };

    } catch (error) {
      console.error('Error checking auth status:', error);
      return { isAuthenticated: false };
    }
  }

  // Clear authentication
  clearAuth(): void {
    localStorage.removeItem('passkeyAuth');
    this.lastAuthResult = null;
    this.authenticationInProgress = false;
    console.log('Passkey authentication cleared');
  }

  // Get contract addresses
  getContractAddresses(): ContractAddresses {
    return this.contracts;
  }
}

export const passkeyService = new PasskeyService();