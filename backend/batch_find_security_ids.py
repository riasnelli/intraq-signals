#!/usr/bin/env python3
"""
Batch find Dhan Security IDs from a list of symbols
Reads from symbols.txt or provided file
"""

import sys
import json
import os

# Add credentials
CLIENT_ID = os.environ.get('DHAN_CLIENT_ID', '')
ACCESS_TOKEN = os.environ.get('DHAN_ACCESS_TOKEN', '')

def search_via_backend(symbol):
    """
    Search using our backend proxy endpoint
    """
    import requests
    
    try:
        response = requests.post(
            'http://localhost:5001/api/search-symbol',
            json={'symbol': symbol},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.ok:
            data = response.json()
            if data.get('success') and data.get('results'):
                # Find NSE_EQ match
                for result in data['results']:
                    if result.get('SEM_EXM_EXCH_ID') == 'NSE' and result.get('SEM_INSTRUMENT_NAME') == 'EQUITY':
                        return result.get('SEM_SMST_SECURITY_ID', '0')
                # Return first result if no NSE_EQ match
                return data['results'][0].get('SEM_SMST_SECURITY_ID', '0')
        return None
    except Exception as e:
        print(f"  ❌ Error: {str(e)}", file=sys.stderr)
        return None


def web_scrape_security_id(symbol):
    """
    Fallback: Try to find security ID from public sources
    This is a placeholder - you'd need to implement actual scraping
    """
    # For now, return None
    # You could add logic to scrape from NSE/BSE websites
    return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 batch_find_security_ids.py <symbols_file>")
        print("Or:    python3 batch_find_security_ids.py SYMBOL1 SYMBOL2 SYMBOL3...")
        print("\nExample symbols_file format:")
        print("  VLEGOV")
        print("  VIPULLTD")
        print("  VAKRANGEE")
        sys.exit(1)
    
    # Read symbols
    symbols = []
    if os.path.isfile(sys.argv[1]):
        # Read from file
        print(f"📖 Reading symbols from {sys.argv[1]}...")
        with open(sys.argv[1], 'r') as f:
            symbols = [line.strip().upper() for line in f if line.strip()]
    else:
        # Use command line args as symbols
        symbols = [s.strip().upper() for s in sys.argv[1:]]
    
    if not symbols:
        print("❌ No symbols provided!")
        sys.exit(1)
    
    print(f"\n🔍 Searching for {len(symbols)} symbols...")
    print(f"⚠️  Make sure backend is running on http://localhost:5001\n")
    
    # Search for each symbol
    results = {}
    found_count = 0
    
    for i, symbol in enumerate(symbols, 1):
        print(f"[{i}/{len(symbols)}] {symbol:<15}", end=" ", flush=True)
        
        security_id = search_via_backend(symbol)
        
        if security_id and security_id != '0':
            print(f"✅ {security_id}")
            results[symbol] = security_id
            found_count += 1
        else:
            print(f"❌ Not found")
            results[symbol] = "0"
    
    # Output results
    print("\n" + "═"*60)
    print("  Results")
    print("═"*60)
    
    print("\n📋 TypeScript format (add to src/utils/dhanSecurityIds.ts):\n")
    for symbol, sec_id in results.items():
        comment = " // ⚠️ NOT FOUND" if sec_id == "0" else ""
        print(f'  "{symbol}": "{sec_id}",{comment}')
    
    print(f"\n📊 Summary:")
    print(f"  ✅ Found:   {found_count}/{len(symbols)}")
    print(f"  ❌ Missing: {len(symbols) - found_count}/{len(symbols)}")
    
    # Save to file
    output_file = "security_ids_batch.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\n💾 Saved to: {output_file}")
    
    # Also save only found ones as TypeScript
    ts_file = "security_ids_found.ts"
    with open(ts_file, 'w') as f:
        f.write("// Auto-generated Dhan Security IDs\n")
        f.write("// Add these to src/utils/dhanSecurityIds.ts\n\n")
        f.write("export const NEW_SECURITY_IDS: Record<string, string> = {\n")
        for symbol, sec_id in results.items():
            if sec_id != "0":
                f.write(f'  "{symbol}": "{sec_id}",\n')
        f.write("};\n")
    print(f"📝 TypeScript export saved to: {ts_file}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

