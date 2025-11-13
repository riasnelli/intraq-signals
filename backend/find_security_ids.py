#!/usr/bin/env python3
"""
Script to find Dhan Security IDs for stock symbols
Uses Dhan API to search for security IDs
"""

import sys
import json
from dhanhq import dhanhq

def find_security_id(dhan, symbol):
    """
    Search for a security ID using Dhan API
    """
    try:
        # Use the security ID search endpoint
        # Note: This might return multiple results, we take the first NSE_EQ match
        result = dhan.get_security_id(symbol)
        
        if result and isinstance(result, dict):
            # Try to find NSE_EQ segment
            if 'NSE_EQ' in result:
                return result['NSE_EQ']
            # Otherwise return first available
            for key, value in result.items():
                if value:
                    return value
        
        return None
    except Exception as e:
        print(f"  ❌ Error searching {symbol}: {str(e)}", file=sys.stderr)
        return None


def main():
    print("═══════════════════════════════════════════")
    print("  Dhan Security ID Finder")
    print("═══════════════════════════════════════════")
    print()
    
    # Get credentials
    client_id = input("Enter Dhan Client ID: ").strip()
    access_token = input("Enter Dhan Access Token: ").strip()
    
    if not client_id or not access_token:
        print("❌ Client ID and Access Token are required!")
        sys.exit(1)
    
    # Initialize Dhan client
    print("\n🔗 Connecting to Dhan API...")
    dhan = dhanhq(client_id, access_token)
    
    # Get symbols to search
    print("\n📝 Enter stock symbols (one per line, empty line to finish):")
    symbols = []
    while True:
        symbol = input("Symbol: ").strip().upper()
        if not symbol:
            break
        symbols.append(symbol)
    
    if not symbols:
        print("❌ No symbols provided!")
        sys.exit(1)
    
    print(f"\n🔍 Searching for {len(symbols)} symbols...\n")
    
    # Search for each symbol
    results = {}
    for symbol in symbols:
        print(f"  Searching {symbol}...", end=" ", flush=True)
        security_id = find_security_id(dhan, symbol)
        
        if security_id:
            print(f"✅ Found: {security_id}")
            results[symbol] = str(security_id)
        else:
            print(f"❌ Not found")
            results[symbol] = "0"
    
    # Output results
    print("\n" + "═"*50)
    print("  Results")
    print("═"*50)
    print("\n📋 TypeScript format (copy to dhanSecurityIds.ts):\n")
    
    for symbol, sec_id in results.items():
        print(f'  "{symbol}": "{sec_id}",')
    
    print("\n📊 Summary:")
    found = sum(1 for v in results.values() if v != "0")
    print(f"  Found: {found}/{len(symbols)}")
    print(f"  Missing: {len(symbols) - found}/{len(symbols)}")
    
    # Save to file
    output_file = "security_ids_found.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n💾 Saved to: {output_file}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

