import React, { useState, useEffect } from "react";
import { dhanApi } from "../services/dhanApi";
import { getSheetsWebhookUrl, setSheetsWebhookUrl, testSheetsConnection } from "../utils/googleSheetsSync";

interface DhanCredentials {
  clientId: string;
  accessToken: string;
  status?: 'active' | 'expired';
  lastSynced?: string;
}

// Utility function to check if JWT token is expired
function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    
    // Add padding if needed
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(atob(paddedPayload));
    
    if (!decoded.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const isExpired = now > decoded.exp;
    
    if (isExpired) {
      const expiryDate = new Date(decoded.exp * 1000);
      console.log(`🔴 Token expired at: ${expiryDate.toLocaleString()}`);
    } else {
      const expiryDate = new Date(decoded.exp * 1000);
      const hoursRemaining = Math.floor((decoded.exp - now) / 3600);
      console.log(`🟢 Token valid until: ${expiryDate.toLocaleString()} (${hoursRemaining}h remaining)`);
    }
    
    return isExpired;
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return true; // If we can't decode, assume expired
  }
}

export default function Settings({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [credentials, setCredentials] = useState<DhanCredentials>({
    clientId: '',
    accessToken: '',
    status: 'expired'
  });
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Google Sheets sync state
  const [sheetsWebhook, setSheetsWebhook] = useState('');
  const [sheetsTestSuccess, setSheetsTestSuccess] = useState(false);
  const [sheetsTestingConnection, setSheetsTestingConnection] = useState(false);

  // Load credentials and webhook from localStorage on mount
  useEffect(() => {
    const savedWebhook = getSheetsWebhookUrl();
    if (savedWebhook) {
      setSheetsWebhook(savedWebhook);
    }
  }, []);
  
  // Load Dhan credentials from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dhan_credentials');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Check if token is expired
        if (parsed.accessToken && isTokenExpired(parsed.accessToken)) {
          console.warn('⚠️ Stored token is expired, marking as expired');
          parsed.status = 'expired';
          // Update localStorage with expired status
          localStorage.setItem('dhan_credentials', JSON.stringify(parsed));
        }
        
        setCredentials(parsed);
      } catch (e) {
        console.error('Failed to load credentials', e);
      }
    }
  }, []);

  const saveCredentials = () => {
    // Don't automatically set to active - user needs to test first
    const updated = {
      ...credentials,
      lastSynced: new Date().toISOString(),
      status: credentials.status || 'expired' as const // Keep current status or set to expired
    };
    localStorage.setItem('dhan_credentials', JSON.stringify(updated));
    setCredentials(updated);
    alert('✅ Credentials saved!\n\nPlease click "Test" button to verify your credentials are working correctly.');
  };

  const testConnection = async () => {
    if (!credentials.clientId || !credentials.accessToken) {
      alert('❌ Please enter both Client ID and Access Token');
      return;
    }

    // Check if token is expired before testing
    if (isTokenExpired(credentials.accessToken)) {
      alert('❌ Access Token is EXPIRED!\n\nPlease generate a new Access Token from your Dhan account.\n\nDhan API tokens typically expire after 24 hours.');
      const expiredCreds = { ...credentials, status: 'expired' as const };
      setCredentials(expiredCreds);
      localStorage.setItem('dhan_credentials', JSON.stringify(expiredCreds));
      return;
    }

    setIsTesting(true);
    
    try {
      // Save credentials temporarily to test
      const testCreds = {
        ...credentials,
        status: 'active' as const
      };
      localStorage.setItem('dhan_credentials', JSON.stringify(testCreds));
      
      // Test the connection
      const isValid = await dhanApi.testConnection();
      
      if (isValid) {
        setCredentials(testCreds);
        alert('✅ Connection test successful!\n\nDhan API is properly configured and ready to use.');
      } else {
        // Revert status if test failed
        const failedCreds = { ...credentials, status: 'expired' as const };
        setCredentials(failedCreds);
        localStorage.setItem('dhan_credentials', JSON.stringify(failedCreds));
        alert('❌ Connection test failed!\n\nPlease check your Client ID and Access Token.\n\nMake sure they are valid and active in your Dhan account.');
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      const failedCreds = { ...credentials, status: 'expired' as const };
      setCredentials(failedCreds);
      localStorage.setItem('dhan_credentials', JSON.stringify(failedCreds));
      alert(`❌ Connection test failed!\n\nError: ${error.message || 'Unknown error'}\n\nPlease verify your credentials.`);
    } finally {
      setIsTesting(false);
    }
  };

  const syncNow = async () => {
    if (!credentials.clientId || !credentials.accessToken) {
      alert('❌ Please configure your API credentials first');
      return;
    }
    
    setIsSyncing(true);
    
    try {
      // Save credentials temporarily to test
      const testCreds = {
        ...credentials,
        status: 'active' as const
      };
      localStorage.setItem('dhan_credentials', JSON.stringify(testCreds));
      
      // Actually test the connection
      const isValid = await dhanApi.testConnection();
      
      if (isValid) {
        const updated = { 
          ...credentials, 
          lastSynced: new Date().toISOString(),
          status: 'active' as const
        };
        setCredentials(updated);
        localStorage.setItem('dhan_credentials', JSON.stringify(updated));
        alert('✅ Data synced successfully!\n\nDhan API connection verified and credentials are active.');
      } else {
        // Revert status if test failed
        const failedCreds = { ...credentials, status: 'expired' as const };
        setCredentials(failedCreds);
        localStorage.setItem('dhan_credentials', JSON.stringify(failedCreds));
        alert('❌ Sync failed!\n\nAPI connection test failed. Please check:\n\n1. Access Token is valid and not expired\n2. Client ID is correct\n3. API is enabled in your Dhan account\n\nCheck browser console (F12) for detailed error logs.');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      const failedCreds = { ...credentials, status: 'expired' as const };
      setCredentials(failedCreds);
      localStorage.setItem('dhan_credentials', JSON.stringify(failedCreds));
      alert(`❌ Sync failed!\n\nError: ${error.message || 'Unknown error'}\n\nCheck browser console (F12) for details.`);
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Google Sheets webhook test
  const testSheetsWebhook = async () => {
    if (!sheetsWebhook) {
      alert('❌ Please enter your Google Sheets webhook URL');
      return;
    }
    
    setSheetsTestingConnection(true);
    setSheetsTestSuccess(false);
    
    try {
      // Temporarily save to test
      setSheetsWebhookUrl(sheetsWebhook);
      
      const isValid = await testSheetsConnection();
      
      if (isValid) {
        setSheetsTestSuccess(true);
        alert('✅ Google Sheets connection successful!\n\nYour data will now auto-sync to Google Sheets.');
      }
    } catch (err) {
      alert(`❌ Connection failed!\n\n${err}\n\nPlease check:\n1. Webhook URL is correct\n2. Apps Script is deployed\n3. Access is set to "Anyone"`);
    } finally {
      setSheetsTestingConnection(false);
    }
  };
  
  const saveSheetsWebhook = () => {
    if (!sheetsTestSuccess) {
      alert('❌ Please test the connection first!');
      return;
    }
    
    setSheetsWebhookUrl(sheetsWebhook);
    alert('✅ Google Sheets sync is now active!\n\nAll changes will automatically sync to your Google Sheet.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-2xl font-semibold text-slate-100">Provider Credentials</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Dhan API Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-medium text-slate-100">Dhan API</h3>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  credentials.status === 'active' 
                    ? 'bg-emerald-900/50 text-emerald-400' 
                    : 'bg-red-900/50 text-red-400'
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {credentials.status === 'active' ? 'Active' : 'Expired'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={testConnection}
                  disabled={isTesting || !credentials.clientId || !credentials.accessToken}
                  className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-white px-4 py-2 rounded text-sm transition-colors"
                  title={!credentials.clientId || !credentials.accessToken ? 'Please enter credentials first' : 'Test API connection'}
                >
                  {isTesting ? '⏳ Testing...' : 'Test'}
                </button>
                <button
                  onClick={syncNow}
                  disabled={isSyncing || credentials.status !== 'active'}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                  title={credentials.status !== 'active' ? 'Please test connection first' : 'Sync data from Dhan API'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {credentials.lastSynced && (
                <div className="text-xs text-slate-400">
                  Last synced: {new Date(credentials.lastSynced).toLocaleString()}
                </div>
              )}
              
              {/* Token expiration warning */}
              {credentials.accessToken && isTokenExpired(credentials.accessToken) && (
                <div className="text-xs text-red-400 flex items-center gap-1 bg-red-900/20 px-3 py-2 rounded border border-red-800/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Token EXPIRED!</span> Please generate a new Access Token from your Dhan account.
                </div>
              )}
              
              {credentials.status !== 'active' && credentials.clientId && credentials.accessToken && !isTokenExpired(credentials.accessToken) && (
                <div className="text-xs text-yellow-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Click "Test" to verify credentials before syncing
                </div>
              )}
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Client ID
              </label>
              <input
                type="text"
                value={credentials.clientId}
                onChange={(e) => setCredentials({ ...credentials, clientId: e.target.value })}
                placeholder="Enter your Dhan Client ID"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>

            {/* Access Token */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Access Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={credentials.accessToken}
                  onChange={(e) => setCredentials({ ...credentials, accessToken: e.target.value })}
                  placeholder="Enter your Dhan Access Token"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 pr-12 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showToken ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm text-slate-400">
              <p className="font-medium text-slate-300 mb-2">ℹ️ How to configure Dhan API:</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>Log in to your Dhan account</li>
                <li>Navigate to Settings → API Management</li>
                <li>Generate or copy your Client ID and Access Token</li>
                <li>Paste them in the fields above</li>
                <li className="text-yellow-300 font-medium">Click "Test" button to verify (required)</li>
                <li>Once test passes, click "Sync Now" to activate</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500 italic">
                Note: Access tokens expire after 24 hours. You'll need to regenerate them daily.
              </p>
            </div>

            {/* Backend Requirement */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-300 mb-2">🔧 Backend Server Required:</p>
              <p className="text-blue-200/70 text-xs leading-relaxed mb-2">
                To use real Dhan API data, you need to run the Python backend server.
              </p>
              <div className="text-blue-200/70 text-xs leading-relaxed space-y-1">
                <p><strong className="text-blue-300">Quick Start:</strong></p>
                <ol className="list-decimal list-inside ml-2 space-y-0.5">
                  <li><code className="bg-blue-900/50 px-1 rounded">cd backend</code></li>
                  <li><code className="bg-blue-900/50 px-1 rounded">pip install -r requirements.txt</code></li>
                  <li><code className="bg-blue-900/50 px-1 rounded">python server.py</code></li>
                </ol>
                <p className="mt-2 text-xs italic">See <code>BACKEND_SETUP.md</code> for detailed instructions.</p>
              </div>
            </div>
          </div>
          
          {/* Google Sheets Sync Section */}
          <div className="border-t border-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Google Sheets Sync (Cloud Backup)
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Webhook URL
                </label>
                <input
                  type="text"
                  value={sheetsWebhook}
                  onChange={(e) => {
                    setSheetsWebhook(e.target.value);
                    setSheetsTestSuccess(false);
                  }}
                  placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={testSheetsWebhook}
                  disabled={sheetsTestingConnection}
                  className="bg-green-600/20 border border-green-600/50 text-green-400 hover:bg-green-600/30 px-4 py-2 rounded transition-colors disabled:opacity-50 text-sm"
                >
                  {sheetsTestingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                
                <button
                  onClick={saveSheetsWebhook}
                  disabled={!sheetsTestSuccess}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm"
                >
                  Enable Auto-Sync
                </button>
                
                {sheetsTestSuccess && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Connected!
                  </div>
                )}
              </div>
              
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-sm">
                <p className="font-medium text-green-300 mb-2">📚 Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-green-200/70 text-xs">
                  <li>Create a new Google Sheet</li>
                  <li>Go to Extensions → Apps Script</li>
                  <li>Copy the script from <code className="bg-green-900/50 px-1 rounded">GOOGLE_SHEETS_SYNC.md</code></li>
                  <li>Deploy as Web App (Anyone access)</li>
                  <li>Copy the webhook URL and paste above</li>
                  <li>Test connection, then enable auto-sync</li>
                </ol>
                <p className="mt-3 text-xs text-green-300 font-medium">
                  ✅ Once enabled, all your signals, AI rankings, and backtest results will auto-sync to Google Sheets!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              saveCredentials();
              onClose();
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2 rounded transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

