#!/usr/bin/env python3
import os
import json
import shutil
from pathlib import Path

def get_audio_files(directory):
    """Get all audio files from a directory"""
    audio_extensions = {'.wav', '.mp3', '.aiff', '.flac', '.ogg'}
    audio_files = []
    
    for file_path in Path(directory).rglob('*'):
        if file_path.suffix.lower() in audio_extensions:
            audio_files.append(file_path)
    
    return audio_files

def match_folder_to_category(folder_name, categories):
    """Try to match folder name to existing categories"""
    folder_upper = folder_name.upper()
    
    # Direct matches first (case insensitive)
    for category in categories:
        if folder_upper == category.upper():
            return category
    
    # Handle common variations - EXACT CATEGORY NAMES
    variations = {
        # KICKS variations
        'KICK': 'kicks',
        'KICKS': 'kicks',
        'BD': 'kicks',  # Bass drum
        'BASSDRUM': 'kicks',
        'BASS_DRUM': 'kicks',
        'BASS-DRUM': 'kicks',
        'BASSDRUM': 'kicks',
        'KICK_DRUM': 'kicks',
        'KICKDRUM': 'kicks',
        
        # SNARES variations
        'SNARE': 'snares',
        'SNARES': 'snares',
        'SN': 'snares',
        'SNARE_DRUM': 'snares',
        'SNAREDRUM': 'snares',
        
        # HIHATS variations
        'HIHAT': 'hihats',
        'HIHATS': 'hihats',
        'HH': 'hihats',
        'HAT': 'hihats',
        'HATS': 'hihats',
        'HI_HAT': 'hihats',
        'HI-HAT': 'hihats',
        'HIHAT_CLOSED': 'hihats',
        'CLOSED_HATS': 'hihats',
        'CLOSEDHATS': 'hihats',
        'CLOSED_HAT': 'hihats',
        'CLOSEDHAT': 'hihats',
        'CH': 'hihats',
        'CHH': 'hihats',
        
        # OPENHATS variations
        'OPENHAT': 'openhats',
        'OPENHATS': 'openhats',
        'OPEN_HAT': 'openhats',
        'OPEN_HATS': 'openhats',
        'OPENHI': 'openhats',
        'OPEN_HI': 'openhats',
        'OPEN_HIHAT': 'openhats',
        'OPEN_HI_HAT': 'openhats',
        'OH': 'openhats',
        'OHH': 'openhats',
        
        # CYMBALS variations
        'CYMBAL': 'cymbals',
        'CYMBALS': 'cymbals',
        'CRASH': 'cymbals',
        'CRASHES': 'cymbals',
        'RIDE': 'cymbals',
        'RIDES': 'cymbals',
        'SPLASH': 'cymbals',
        'CHINA': 'cymbals',
        'CRASHES_CYMBALS': 'cymbals',
        'CRASHES & CYMBALS': 'cymbals',
        'CRASHES&CYMBALS': 'cymbals',
        
        # CLAPS variations
        'CLAP': 'claps',
        'CLAPS': 'claps',
        'HANDCLAP': 'claps',
        'HAND_CLAP': 'claps',
        'HANDCLAPS': 'claps',
        'HAND_CLAPS': 'claps',
        
        # PERCS variations
        'PERC': 'percs',
        'PERCUSSION': 'percs',
        'PERCUSSIONS': 'percs',
        'PERCUSSIVE': 'percs',
        'TOMS': 'percs',
        'TOM': 'percs',
        'BONGO': 'percs',
        'BONGOS': 'percs',
        'CONGA': 'percs',
        'CONGAS': 'percs',
        'SHAKER': 'percs',
        'SHAKERS': 'percs',
        'TAMBOURINE': 'percs',
        'COWBELL': 'percs',
        'COWBELLS': 'percs',
        'TRIANGLE': 'percs',
        'MISC': 'percs',
        'MISCELLANEOUS': 'percs',
        'OTHERS': 'percs',
        'OTHER': 'other',  # Note: 'other' category for truly misc items
        
        # VOX variations
        'VOX': 'vox',
        'VOCAL': 'vox',
        'VOCALS': 'vox',
        'VOICE': 'vox',
        'VOICES': 'vox',
        'HUMAN': 'vox',
        'SPEECH': 'vox',
        'CHANT': 'vox',
        'CHANTS': 'vox',
        
        # 808S variations
        '808': '808s',
        '808S': '808s',
        'SUB': '808s',
        'BASS': '808s',  # Could be 808s or kicks - let user decide
        'SUBBASS': '808s',
        'SUB_BASS': '808s',
        'BASSLINE': '808s',
        'BASS_LINE': '808s',
        'LOWEND': '808s',
        'LOW_END': '808s',
    }
    
    return variations.get(folder_upper)

def get_user_category_choice(folder_name, categories):
    """Ask user to select category for unmatched folder"""
    print(f"\nFolder '{folder_name}' does not match any categories.")
    print("Please select a category:\n")
    
    print("Available categories:")
    for i, category in enumerate(categories, 1):
        print(f"{i:2d}. {category}")
    
    while True:
        choice = input(f"\nEnter number (1-{len(categories)}): ").strip()
        
        # Try to parse as number
        try:
            choice_num = int(choice)
            if 1 <= choice_num <= len(categories):
                return categories[choice_num - 1]
            else:
                print(f"Please enter a number between 1 and {len(categories)}")
                continue
        except ValueError:
            print(f"Please enter a valid number between 1 and {len(categories)}")
            continue

def remove_duplicate_entries(json_entries):
    """Remove duplicate entries based on file path"""
    seen_files = set()
    unique_entries = []
    duplicates_removed = 0
    
    for entry in json_entries:
        file_path = entry['file']
        if file_path not in seen_files:
            seen_files.add(file_path)
            unique_entries.append(entry)
        else:
            duplicates_removed += 1
            print(f"  ⚠️  Removed duplicate: {entry['name']} ({file_path})")
    
    if duplicates_removed > 0:
        print(f"\n✓ Removed {duplicates_removed} duplicate entries")
    
    return unique_entries

def main():
    input_dir = "input"
    output_dir = "output"
    
    if not os.path.exists(input_dir):
        print(f"Error: '{input_dir}' directory not found!")
        return
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # EXACT CATEGORY NAMES - DO NOT CHANGE THESE
    categories = ['808s', 'claps', 'cymbals', 'hihats', 'kicks', 'openhats', 'other', 'percs', 'snares', 'vox']
    
    # Get kit name from user
    kit_name = input("Enter the name for this drum kit: ").strip()
    if not kit_name:
        kit_name = "Unnamed Kit"
    
    json_entries = []
    processed_folders = set()
    
    print(f"\n{'='*60}")
    print(f"PROCESSING KIT: {kit_name}")
    print(f"{'='*60}")
    print("Valid categories:", ", ".join(categories))
    print("="*60)
    
    # Walk through all subdirectories in input
    for root, dirs, files in os.walk(input_dir):
        # Skip the root input directory itself
        if root == input_dir:
            continue
            
        # Get the immediate folder name (not full path)
        folder_name = os.path.basename(root)
        
        # Skip if we've already processed this folder name
        if folder_name in processed_folders:
            continue
            
        # Get audio files in this directory
        audio_files = get_audio_files(root)
        
        if not audio_files:
            continue
            
        processed_folders.add(folder_name)
        
        # Try to match folder to category
        matched_category = match_folder_to_category(folder_name, categories)
        
        if matched_category:
            category = matched_category
            print(f"✓ Auto-matched '{folder_name}' → '{category}'")
        else:
            # Ask user for category
            print(f"\n📁 Processing folder: '{folder_name}' ({len(audio_files)} files)")
            category = get_user_category_choice(folder_name, categories)
            print(f"✓ User selected '{folder_name}' → '{category}'")
        
        # Process all audio files in this folder
        for audio_file in audio_files:
            # Create category directory in output if it doesn't exist
            category_output_dir = os.path.join(output_dir, category)
            os.makedirs(category_output_dir, exist_ok=True)
            
            # Create destination path
            destination_file = os.path.join(category_output_dir, audio_file.name)
            
            # Handle duplicate filenames by adding a number
            counter = 1
            original_destination = destination_file
            while os.path.exists(destination_file):
                name_without_ext = audio_file.stem
                extension = audio_file.suffix
                destination_file = os.path.join(category_output_dir, f"{name_without_ext}_{counter}{extension}")
                counter += 1
            
            # Copy the file
            try:
                shutil.copy2(audio_file, destination_file)
                # Only print every 10th file to avoid spam
                if len(json_entries) % 10 == 0:
                    print(f"    → Copied '{audio_file.name}' to '{category}/'")
            except Exception as e:
                print(f"    ✗ Error copying '{audio_file.name}': {e}")
                continue
            
            # Create relative path for JSON (from output directory)
            relative_path = os.path.relpath(destination_file, output_dir)
            # Convert to forward slashes for consistency (important for web)
            relative_path = relative_path.replace('\\', '/')
            
            # Create name from filename (without extension)
            name = Path(destination_file).stem
            
            # Create JSON entry
            entry = {
                "name": name,
                "category": category,
                "file": relative_path,
                "kit": kit_name
            }
            
            json_entries.append(entry)
    
    # Remove duplicates
    if json_entries:
        json_entries = remove_duplicate_entries(json_entries)
    
    # Output results
    if json_entries:
        print(f"\n{'='*60}")
        print(f"PROCESSING COMPLETE")
        print(f"{'='*60}")
        print(f"Generated {len(json_entries)} unique entries")
        print("Files organized by category:")
        
        # Show breakdown by category
        category_counts = {}
        for entry in json_entries:
            cat = entry['category']
            category_counts[cat] = category_counts.get(cat, 0) + 1
        
        for category in categories:
            count = category_counts.get(category, 0)
            if count > 0:
                print(f"  {category:12s}: {count:3d} files")
        
        # Save to file
        output_filename = f"{kit_name.replace(' ', '_').lower()}_drum_entries.json"
        
        # Sort entries by category then by name for better organization
        json_entries.sort(key=lambda x: (x['category'], x['name']))
        
        with open(output_filename, "w") as f:
            json.dump(json_entries, f, indent=2)
        
        print(f"\n✓ Files organized in 'output/' directory")
        print(f"✓ JSON saved to '{output_filename}'")
        print("\n📋 COPY THIS JSON AND PASTE INTO YOUR DRUM-SOUNDS.JSON FILE:")
        print("="*60)
        
        # Pretty print a sample (first 3 entries) so user can see the format
        sample_entries = json_entries[:3]
        print(json.dumps(sample_entries, indent=2))
        if len(json_entries) > 3:
            print(f"... and {len(json_entries) - 3} more entries")
        
        print("="*60)
        print(f"Complete JSON is saved in: {output_filename}")
        
    else:
        print("No audio files found in the input directory.")

if __name__ == "__main__":
    main()