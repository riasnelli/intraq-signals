// googleSheetsSync.ts
// Sync data to Google Sheets using Apps Script webhook

import { TSignal } from '../db';

// User will set this in Settings
const SHEETS_WEBHOOK_KEY = 'intraq_sheets_webhook_url';

// Get webhook URL from localStorage
export function getSheetsWebhookUrl(): string | null {
  return localStorage.getItem(SHEETS_WEBHOOK_KEY);
}

// Set webhook URL in localStorage
export function setSheetsWebhookUrl(url: string): void {
  localStorage.setItem(SHEETS_WEBHOOK_KEY, url);
}

// Clear webhook URL
export function clearSheetsWebhookUrl(): void {
  localStorage.removeItem(SHEETS_WEBHOOK_KEY);
}

// Test connection to Google Sheets
export async function testSheetsConnection(): Promise<boolean> {
  const webhookUrl = getSheetsWebhookUrl();
  if (!webhookUrl) {
    throw new Error('No webhook URL configured');
  }
  
  console.log('🔍 Testing Google Sheets connection...');
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Google Sheets connection successful:', result);
    return true;
  } catch (err) {
    console.error('❌ Google Sheets connection failed:', err);
    throw err;
  }
}

// Sync signals to Google Sheets
export async function syncSignalsToSheets(signals: TSignal[]): Promise<void> {
  const webhookUrl = getSheetsWebhookUrl();
  if (!webhookUrl) {
    console.warn('⚠️ No Google Sheets webhook configured, skipping sync');
    return;
  }
  
  console.log(`📤 Syncing ${signals.length} signals to Google Sheets...`);
  
  try {
    // Convert signals to flat format for sheets
    const flatSignals = signals.map(s => ({
      date: s.date,
      symbol: s.symbol,
      strategy: s.strategy,
      side: s.side,
      score: s.score,
      entry: s.entry,
      target: s.target,
      stopLoss: s.stopLoss,
      riskReward: s.riskReward,
      sector: s.sector,
      // AI Rankings
      chatGptRank: s.chatGptRank,
      perplexityRank: s.perplexityRank,
      deepSeekRank: s.deepSeekRank,
      finalRank: s.finalRank,
      // Technical Indicators
      gapPercent: s.gapPercent,
      preMarketVolumeSurge: s.preMarketVolumeSurge,
      atr14: s.atr14,
      volatilityRank: s.volatilityRank,
      trendStatus: s.trendStatus,
      relativeStrength20D: s.relativeStrength20D,
      vwapDistancePercent: s.vwapDistancePercent,
      liquidityRating: s.liquidityRating,
      // Backtest Results
      entryHit: s.backtest?.entryHit,
      entryHitTime: s.backtest?.entryHitTime,
      targetHit: s.backtest?.targetHit,
      targetHitTime: s.backtest?.targetHitTime,
      slHit: s.backtest?.slHit,
      slHitTime: s.backtest?.slHitTime,
      outcome: s.backtest?.outcome,
      timeToTarget: s.backtest?.timeToTarget,
      timeToSL: s.backtest?.timeToSL,
      dataSource: s.backtest?.dataSource,
    }));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sync_signals',
        timestamp: new Date().toISOString(),
        data: flatSignals,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Synced to Google Sheets:', result);
  } catch (err) {
    console.error('❌ Google Sheets sync failed:', err);
    // Don't throw - sync failure shouldn't break the app
  }
}

// Auto-sync wrapper with error handling
export async function autoSyncToSheets(signals: TSignal[]): Promise<void> {
  const webhookUrl = getSheetsWebhookUrl();
  if (!webhookUrl) return; // Silently skip if not configured
  
  try {
    await syncSignalsToSheets(signals);
  } catch (err) {
    // Silent fail for auto-sync
    console.warn('Auto-sync failed, but app continues normally');
  }
}

