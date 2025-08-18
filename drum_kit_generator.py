#!/usr/bin/env python3
import os
import json
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
    
    # Direct matches
    for category in categories:
        if folder_upper == category.upper():
            return category
    
    # Handle common variations
    variations = {
        'KICK': 'kicks',
        'KICKS': 'kicks',
        'BD': 'kicks',  # Bass drum
        'BASSDRUM': 'kicks',
        'SNARE': 'snares',
        'SNARES': 'snares',
        'SN': 'snares',
        'HIHAT': 'hihats',
        'HIHATS': 'hihats',
        'HH': 'hihats',
        'HAT': 'hihats',
        'HATS': 'hihats',
        'CYMBAL': 'cymbals',
        'CYMBALS': 'cymbals',
        'CRASH': 'cymbals',
        'RIDE': 'cymbals',
        'PERC': 'percs',
        'PERCUSSION': 'percs',
        'PERCUSSIONS': 'percs',
        'OTHER': 'percs',
        'MISC': 'percs',
        'CLAP': 'claps',
        'CLAPS': 'claps',
        'OPENHAT': 'openhats',
        'OPENHATS': 'openhats',
        'OPENHI': 'openhats',
        'OH': 'openhats',
        'VOX': 'vox',
        'VOCAL': 'vox',
        'VOCALS': 'vox',
        'VOICE': 'vox',
        '808': '808s',
        '808S': '808s',
        'SUB': '808s'
    }
    
    return variations.get(folder_upper)

def get_user_category_choice(folder_name, categories):
    """Ask user to select category for unmatched folder"""
    print(f"\nFolder '{folder_name}' does not match any categories.")
    print("Please select a category or press enter to create a new category:\n")
    
    print("Categories:")
    for i, category in enumerate(categories, 1):
        print(f"{i}. {category}")
    
    while True:
        choice = input("\nEnter number or new category name: ").strip()
        
        if not choice:  # Empty input - create new category
            new_category = input("Enter new category name: ").strip()
            if new_category:
                return new_category
            continue
        
        # Try to parse as number
        try:
            choice_num = int(choice)
            if 1 <= choice_num <= len(categories):
                return categories[choice_num - 1]
            else:
                print(f"Please enter a number between 1 and {len(categories)}")
                continue
        except ValueError:
            # Treat as new category name
            return choice

def main():
    input_dir = "input"
    
    if not os.path.exists(input_dir):
        print(f"Error: '{input_dir}' directory not found!")
        return
    
    # Initial categories
    categories = ['kicks', 'snares', 'hihats', 'cymbals', 'percs', '808s', 'claps', 'openhats', 'vox']
    
    # Get kit name from user
    kit_name = input("Enter the name for this drum kit: ").strip()
    if not kit_name:
        kit_name = "Unnamed Kit"
    
    json_entries = []
    processed_folders = set()
    
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
            print(f"✓ Matched '{folder_name}' → '{category}'")
        else:
            # Ask user for category
            category = get_user_category_choice(folder_name, categories)
            
            # Add to categories list if it's new
            if category not in categories:
                categories.append(category)
                print(f"✓ Added new category: '{category}'")
        
        # Process all audio files in this folder
        for audio_file in audio_files:
            # Create relative path from input directory
            relative_path = os.path.relpath(audio_file, input_dir)
            # Convert to forward slashes for consistency
            relative_path = relative_path.replace('\\', '/')
            
            # Create name from filename (without extension)
            name = audio_file.stem
            
            # Create JSON entry
            entry = {
                "name": name,
                "category": category,
                "file": relative_path,
                "kit": kit_name
            }
            
            json_entries.append(entry)
    
    # Output results
    if json_entries:
        print(f"\n{'='*50}")
        print(f"Generated {len(json_entries)} entries:")
        print("="*50)
        
        # Pretty print the JSON
        json_output = json.dumps(json_entries, indent=2)
        print(json_output)
        
        # Save to file
        output_filename = f"{kit_name.replace(' ', '_').lower()}_drum_entries.json"
        with open(output_filename, "w") as f:
            f.write(json_output)
        
        print(f"\n✓ Saved to '{output_filename}'")
        print("You can copy these entries and paste them into your main JSON file!")
        
    else:
        print("No audio files found in the input directory.")

if __name__ == "__main__":
    main()