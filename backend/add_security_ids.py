#!/usr/bin/env python3
"""
Interactive script to add Dhan Security IDs
Helps you find and add missing security IDs
"""

import sys
import json
import os

def main():
    print("═══════════════════════════════════════════")
    print("  Dhan Security ID Helper")
    print("═══════════════════════════════════════════")
    print()
    print("📚 How to find Security IDs:")
    print("   1. Go to: https://www.dhan.co/")
    print("   2. Search for the stock symbol")
    print("   3. Open the stock page")
    print("   4. Look in the URL: https://www.dhan.co/stocks/detail/<SECURITY_ID>")
    print("   OR")
    print("   5. Check browser DevTools Network tab when viewing stock")
    print()
    
    # Read missing symbols
    missing_file = "missing_symbols.txt"
    if not os.path.exists(missing_file):
        print(f"❌ {missing_file} not found!")
        print(f"📝 Creating {missing_file} with sample symbols...")
        with open(missing_file, 'w') as f:
            f.write("VLEGOV\nVIPULLTD\nVAKRANGEE\n")
        print(f"✅ Created {missing_file}")
    
    with open(missing_file, 'r') as f:
        symbols = [line.strip().upper() for line in f if line.strip()]
    
    print(f"📋 Found {len(symbols)} symbols to process:\n")
    
    results = {}
    
    for i, symbol in enumerate(symbols, 1):
        print(f"\n[{i}/{len(symbols)}] {symbol}")
        print("─" * 50)
        
        # Ask for security ID
        sec_id = input(f"Enter Security ID for {symbol} (or 'skip'/'s' to skip, 'quit'/'q' to finish): ").strip()
        
        if sec_id.lower() in ['quit', 'q']:
            print("\n⚠️ Stopping early...")
            break
        elif sec_id.lower() in ['skip', 's', '']:
            print(f"⏭️  Skipping {symbol}")
            results[symbol] = "0"
            continue
        elif sec_id.isdigit():
            results[symbol] = sec_id
            print(f"✅ Added: {symbol} = {sec_id}")
        else:
            print(f"⚠️ Invalid ID '{sec_id}', skipping {symbol}")
            results[symbol] = "0"
    
    # Output results
    print("\n" + "═"*60)
    print("  Results")
    print("═"*60)
    
    if results:
        print("\n📋 TypeScript format (add to src/utils/dhanSecurityIds.ts):\n")
        for symbol, sec_id in results.items():
            if sec_id != "0":
                print(f'  "{symbol}": "{sec_id}",')
        
        # Save to file
        output_ts = "new_security_ids.ts"
        with open(output_ts, 'w') as f:
            f.write("// New Security IDs - Add these to src/utils/dhanSecurityIds.ts\n\n")
            for symbol, sec_id in results.items():
                if sec_id != "0":
                    f.write(f'  "{symbol}": "{sec_id}",\n')
        
        found = sum(1 for v in results.values() if v != "0")
        print(f"\n📊 Summary:")
        print(f"  ✅ Added:   {found}")
        print(f"  ⏭️  Skipped: {len(results) - found}")
        print(f"\n💾 Saved to: {output_ts}")
        print(f"📝 Copy the content to: ../src/utils/dhanSecurityIds.ts")
    else:
        print("\n⚠️ No security IDs were added")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)

