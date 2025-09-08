export interface WalletConnection {
  publicKey: string;
  isConnected: boolean;
  walletType: string;
}

export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export class SimpleAlbedoService {
  private connection: WalletConnection = {
    publicKey: '',
    isConnected: false,
    walletType: ''
  };

  // Connect using Albedo direct URL
  async connectWallet(): Promise<WalletConnection> {
    try {
      console.log('Connecting to Albedo via URL...');
      
      const baseUrl = 'https://albedo.link/intent';
      const params = new URLSearchParams({
        intent: 'public_key',
        callback: 'postMessage',
      });

      const url = `${baseUrl}?${params}`;
      
      // Open Albedo in a popup
      const popup = window.open(url, 'albedo', 'width=500,height=600,scrollbars=yes,resizable=yes');
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Wait for response
      const result = await this.waitForPopupResponse(popup);
      
      if (!result.pubkey) {
        throw new Error('No public key received from Albedo');
      }

      this.connection = {
        publicKey: result.pubkey,
        isConnected: true,
        walletType: 'albedo'
      };

      console.log('Connected to Albedo:', result.pubkey);
      return this.connection;

    } catch (error) {
      console.error('Albedo connection failed:', error);
      throw new Error(`Albedo connection failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Sign and submit transaction using Albedo URL
  async signAndSubmitTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<TransactionResult> {
    try {
      if (!this.connection.isConnected) {
        throw new Error('Wallet not connected');
      }

      console.log('Signing transaction with Albedo...');

      const baseUrl = 'https://albedo.link/intent';
      const network = networkPassphrase === 'Test SDF Network ; September 2015' ? 'testnet' : 'public';
      
      const params = new URLSearchParams({
        intent: 'tx',
        xdr: transactionXdr,
        network: network,
        submit: 'true',
        callback: 'postMessage',
        description: 'Trading transaction'
      });

      const url = `${baseUrl}?${params}`;
      
      // Open Albedo in a popup
      const popup = window.open(url, 'albedo', 'width=500,height=600,scrollbars=yes,resizable=yes');
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Wait for response
      const result = await this.waitForPopupResponse(popup);

      if (result.tx_hash) {
        console.log('Transaction submitted successfully:', result.tx_hash);
        return {
          success: true,
          transactionId: result.tx_hash
        };
      } else {
        throw new Error('Transaction signing/submission failed');
      }

    } catch (error) {
      console.error('Albedo transaction failed:', error);
      
      if (error.message?.includes('User declined')) {
        return {
          success: false,
          error: 'Transaction cancelled by user'
        };
      } else {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  }

  // Helper method to wait for popup response
  private waitForPopupResponse(popup: Window): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('Timeout waiting for Albedo response');
        popup.close();
        reject(new Error('Timeout waiting for Albedo response. Please try again.'));
      }, 120000); // 2 minute timeout

      const handleMessage = (event: MessageEvent) => {
        console.log('Received message:', event);
        console.log('Message origin:', event.origin);
        console.log('Message data:', event.data);

        // Accept messages from Albedo
        if (event.origin !== 'https://albedo.link') {
          console.log('Ignoring message from', event.origin);
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener('message', handleMessage);
        popup.close();

        if (event.data && event.data.error) {
          console.error('Albedo error:', event.data.error);
          reject(new Error(event.data.error));
        } else if (event.data) {
          console.log('Albedo success:', event.data);
          resolve(event.data);
        } else {
          console.error('No data in message');
          reject(new Error('No data received from Albedo'));
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed by user
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          console.log('Popup was closed by user');
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          reject(new Error('Connection cancelled - popup was closed'));
        }
      }, 1000);

      // Focus the popup
      popup.focus();
    });
  }

  // Get current connection status
  getConnection(): WalletConnection {
    return this.connection;
  }

  // Disconnect wallet
  disconnect(): void {
    this.connection = {
      publicKey: '',
      isConnected: false,
      walletType: ''
    };
    console.log('Albedo disconnected');
  }

  // Check if wallet is connected
  isConnected(): boolean {
    return this.connection.isConnected && !!this.connection.publicKey;
  }

  // Get connected public key
  getPublicKey(): string | null {
    return this.connection.isConnected ? this.connection.publicKey : null;
  }

  // Static method to check if Albedo is available (always true since it's web-based)
  static async isAlbedoAvailable(): Promise<boolean> {
    // Albedo is always available since it's web-based
    return true;
  }
}

export const simpleAlbedoService = new SimpleAlbedoService();