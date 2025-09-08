import { useState, useEffect } from 'react';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Key, CheckCircle, Fingerprint, AlertCircle, User, Lock } from 'lucide-react';
import { PasskeyService } from '@/servers/PasskeyService';

export function PasskeyAuth() {
  const { 
    passkeyAuth, 
    isConnected, 
    authenticateWithPasskey, 
    registerPasskey, 
    signOutPasskey,
    checkPasskeyStatus 
  } = useTradingStore();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  // Check passkey support and current status on mount
  useEffect(() => {
    const checkSupport = async () => {
      const supported = PasskeyService.isSupported();
      setIsSupported(supported);
      
      if (supported) {
        checkPasskeyStatus();
      }
    };
    
    checkSupport();
  }, [checkPasskeyStatus]);

  

  const handleRegisterPasskey = async () => {
    setIsRegistering(true);
    setError(null);
    
    try {
      const result = await registerPasskey(username || undefined);
      
      if (result.success) {
        setShowUsernameInput(false);
        setUsername('');
        console.log('Passkey registered successfully');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Passkey registration failed:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    setError(null);
    
    try {
      const result = await authenticateWithPasskey();
      
      if (!result.success) {
        setError(result.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Passkey authentication failed:', error);
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = () => {
    signOutPasskey();
    setError(null);
    setUsername('');
    setShowUsernameInput(false);
  };

  const startRegistration = () => {
    setShowUsernameInput(true);
    setError(null);
  };

  const cancelRegistration = () => {
    setShowUsernameInput(false);
    setUsername('');
    setError(null);
  };

  // Show loading while checking support
  if (isSupported === null) {
    return (
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">Security</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Checking passkey support...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show unsupported message
  if (!isSupported) {
    return (
      <div className="bg-card border border-border rounded">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-foreground">Security</h3>
          </div>
        </div>
        <div className="p-4">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500" />
            <div>
              <h4 className="font-medium text-foreground mb-2">Passkeys Not Supported</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Your device or browser doesn't support passkey authentication. 
                Please use a modern browser with WebAuthn support.
              </p>
            </div>
            <div className="bg-surface rounded p-3">
              <h5 className="text-xs font-medium text-foreground mb-2">Supported browsers:</h5>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Chrome 67+ / Edge 18+</li>
                <li>• Firefox 60+ / Safari 14+</li>
                <li>• Mobile browsers (iOS 14+, Android 7+)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <Shield className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Passkey Security</h3>
        </div>
      </div>

      <div className="p-4">
        {/* Error Display */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          </div>
        )}

        {!passkeyAuth.isAuthenticated ? (
          <div className="space-y-4">
            {/* Info Card */}
            <div className="bg-surface rounded p-3">
              <div className="flex items-start space-x-3">
                <Key className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-foreground">Secure Authentication</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Use your device's biometric authentication (fingerprint, face recognition, or security key) 
                    for secure, passwordless access to your trading account.
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
              <div className="flex items-center space-x-2 text-xs">
                <CheckCircle className="h-3 w-3 text-positive flex-shrink-0" />
                <span className="text-muted-foreground">Works across all your devices</span>
              </div>
            </div>

            {/* Registration Form */}
            {showUsernameInput ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs text-muted-foreground">
                    Username (optional)
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter a username or leave blank"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-8 text-xs"
                    disabled={isRegistering}
                  />
                  <p className="text-xs text-muted-foreground">
                    If left blank, a unique username will be generated for you.
                  </p>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={handleRegisterPasskey}
                    disabled={isRegistering}
                    className="flex-1 h-8 text-xs"
                    size="sm"
                  >
                    {isRegistering ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="h-3 w-3 mr-2" />
                        Create Passkey
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={cancelRegistration}
                    disabled={isRegistering}
                    variant="outline"
                    className="h-8 text-xs"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Check if user has existing passkey */}
                {passkeyAuth.userId ? (
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
                        Sign In with Passkey
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={startRegistration}
                    disabled={isRegistering}
                    className="w-full h-8 text-xs"
                    size="sm"
                  >
                    <Key className="h-3 w-3 mr-2" />
                    Setup Passkey
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Status */}
            <div className="bg-positive/5 border border-positive/10 rounded p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-positive flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">Passkey Active</h4>
                  <p className="text-xs text-muted-foreground">Your account is secured with passkey authentication</p>
                </div>
              </div>
            </div>

            {/* Status Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="text-xs font-medium text-positive">Authenticated</span>
              </div>
              
              {passkeyAuth.userId && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">User ID</span>
                  <span className="text-xs font-mono text-foreground">
                    {passkeyAuth.userId.length > 12 
                      ? `${passkeyAuth.userId.substring(0, 8)}...${passkeyAuth.userId.substring(passkeyAuth.userId.length - 4)}`
                      : passkeyAuth.userId
                    }
                  </span>
                </div>
              )}
              
              {passkeyAuth.contractId && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">Contract</span>
                  <span className="text-xs font-mono text-foreground">
                    {passkeyAuth.contractId.substring(0, 8)}...{passkeyAuth.contractId.substring(passkeyAuth.contractId.length - 4)}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">Connection</span>
                <span className="text-xs font-medium text-positive">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
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
                      Re-authenticate
                    </>
                  )}
                </Button>
              )}
              
              {/* Sign Out */}
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full h-8 text-xs"
                size="sm"
              >
                <Lock className="h-3 w-3 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        )}

        {/* Technical Info */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Protocol:</span>
              <span className="text-blue-400">WebAuthn</span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="text-purple-400">Stellar Testnet</span>
            </div>
            <div className="flex justify-between">
              <span>Authentication:</span>
              <span className="text-green-400">Platform Authenticator</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}