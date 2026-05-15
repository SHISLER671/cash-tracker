/**
 * Manual Sync Service
 * 
 * ADHD-friendly sync architecture:
 * - No auto-sync (avoids confusion and data conflicts)
 * - User explicitly pushes when they want to share
 * - Partner explicitly pulls when they want updates
 * 
 * Her phone: "SHARE WITH PARTNER" button
 * Partner phone: "CHECK FOR UPDATES" button
 */

import { db, type Transaction } from '@/lib/db';
// import { supabase, isSupabaseConfigured } from './client';

export interface SyncStatus {
  lastPushed: Date | null;
  lastPulled: Date | null;
  pendingCount: number;
}

// Get local sync status from localStorage
export function getSyncStatus(): SyncStatus {
  if (typeof window === 'undefined') {
    return { lastPushed: null, lastPulled: null, pendingCount: 0 };
  }
  
  const stored = localStorage.getItem('cashtracker_sync_status');
  if (!stored) {
    return { lastPushed: null, lastPulled: null, pendingCount: 0 };
  }
  
  const parsed = JSON.parse(stored);
  return {
    lastPushed: parsed.lastPushed ? new Date(parsed.lastPushed) : null,
    lastPulled: parsed.lastPulled ? new Date(parsed.lastPulled) : null,
    pendingCount: parsed.pendingCount ?? 0,
  };
}

// Save sync status to localStorage
function saveSyncStatus(status: Partial<SyncStatus>) {
  if (typeof window === 'undefined') return;
  
  const current = getSyncStatus();
  const updated = { ...current, ...status };
  localStorage.setItem('cashtracker_sync_status', JSON.stringify(updated));
}

/**
 * Push local transactions to Supabase
 * Called when user taps "SHARE WITH PARTNER"
 */
export async function pushToPartner(): Promise<{ success: boolean; count: number; error?: string }> {
  // Placeholder - Supabase not configured yet
  // When activated, this will:
  // 1. Get all local transactions since last push
  // 2. Upload them to Supabase shared_transactions table
  // 3. Update lastPushed timestamp
  
  try {
    const transactions = await db.transactions.toArray();
    const lastPushed = getSyncStatus().lastPushed;
    
    // Filter transactions since last push
    const newTransactions = lastPushed 
      ? transactions.filter(t => t.date > lastPushed)
      : transactions;
    
    // Simulate push (placeholder)
    console.log('[v0] Would push', newTransactions.length, 'transactions to Supabase');
    
    // Update sync status
    saveSyncStatus({ 
      lastPushed: new Date(),
      pendingCount: 0 
    });
    
    return { 
      success: true, 
      count: newTransactions.length,
      error: 'Supabase not configured yet - this is a placeholder'
    };
  } catch (error) {
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Push failed' 
    };
  }
}

/**
 * Pull transactions from partner via Supabase
 * Called when partner taps "CHECK FOR UPDATES"
 */
export async function pullFromPartner(): Promise<{ success: boolean; count: number; error?: string }> {
  // Placeholder - Supabase not configured yet
  // When activated, this will:
  // 1. Fetch shared_transactions from Supabase since last pull
  // 2. Merge with local data (avoiding duplicates)
  // 3. Update lastPulled timestamp
  
  try {
    const lastPulled = getSyncStatus().lastPulled;
    
    // Simulate pull (placeholder)
    console.log('[v0] Would pull transactions from Supabase since', lastPulled);
    
    // Update sync status
    saveSyncStatus({ lastPulled: new Date() });
    
    return { 
      success: true, 
      count: 0,
      error: 'Supabase not configured yet - this is a placeholder'
    };
  } catch (error) {
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Pull failed' 
    };
  }
}

/**
 * Get count of transactions not yet pushed
 */
export async function getPendingPushCount(): Promise<number> {
  const transactions = await db.transactions.toArray();
  const lastPushed = getSyncStatus().lastPushed;
  
  if (!lastPushed) return transactions.length;
  
  return transactions.filter(t => t.date > lastPushed).length;
}
