import { useState } from 'react';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Shield, Key, CheckCircle, Fingerprint } from 'lucide-react';

export function PasskeyAuth() {
  const { passkeyAuth, isConnected, authenticateWithPasskey } = useTradingStore();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await authenticateWithPasskey();
    } catch (error) {
      console.error('Passkey registration failed:', error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      await authenticateWithPasskey();
    } catch (error) {
      console.error('Passkey authentication failed:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Security</h3>
        </div>
      </div>

      <div className="p-4">
        {!passkeyAuth.isAuthenticated ? (
          <div className="space-y-4">
            {/* Info Card */}
            <div className="bg-surface rounded p-3">
              <div className="flex items-start space-x-3">
                <Key className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Passkey Authentication</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Secure your account with biometric authentication or security key for enhanced protection.
                  </p>
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-xs">
                <CheckCircle className="h-3 w-3 text-positive flex-shrink-0" />
                <span className="text-muted-foreground">Phishing-resistant security</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <CheckCircle className="h-3 w-3 text-positive flex-shrink-0" />
                <span className="text-muted-foreground">No passwords to remember</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <CheckCircle className="h-3 w-3 text-positive flex-shrink-0" />
                <span className="text-muted-foreground">Hardware-backed authentication</span>
              </div>
            </div>

            {/* Setup Button */}
            <Button
              onClick={handleRegisterPasskey}
              disabled={isRegistering}
              className="w-full h-8 text-xs"
              size="sm"
            >
              {isRegistering ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <Key className="h-3 w-3 mr-2" />
                  Setup Passkey
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Status */}
            <div className="bg-positive/5 border border-positive/10 rounded p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-positive flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">Passkey Active</h4>
                  <p className="text-xs text-muted-foreground">Your account is secured</p>
                </div>
              </div>
            </div>

            {/* Status Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="text-xs font-medium text-positive">Connected</span>
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">User ID</span>
                <span className="text-xs font-mono text-foreground">
                  {passkeyAuth.userId?.substring(0, 8)}...
                </span>
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Key</span>
                <span className="text-xs font-mono text-foreground">
                  {passkeyAuth.publicKey?.substring(0, 12)}...
                </span>
              </div>
            </div>

            {/* Re-authenticate if not connected */}
            {!isConnected && (
              <Button
                onClick={handleAuthenticate}
                disabled={isAuthenticating}
                className="w-full h-8 text-xs bg-buy hover:bg-buy/90 text-white"
                size="sm"
              >
                {isAuthenticating ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-3 w-3 mr-2" />
                    Authenticate
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}