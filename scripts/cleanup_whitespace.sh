#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directories to exclude
EXCLUDE_DIRS=(
    "venv"
    "node_modules"
    ".git"
    "__pycache__"
    "*.egg-info"
    "dist"
    "build"
    "static/img"
    "static/assets"
    "public/img"
    "public/assets"
)

# Asset file extensions to exclude
ASSET_EXTENSIONS=(
    "ico"
    "png"
    "jpg"
    "jpeg"
    "gif"
    "svg"
    "webp"
    "mp3"
    "mp4"
    "wav"
    "ogg"
    "ttf"
    "woff"
    "woff2"
    "eot"
)

# Function to safely print colored output
print_message() {
    local color=$1
    local message=$2
    printf "%b%s%b\n" "$color" "$message" "$NC"
}

# Function to check if file is an asset
is_asset() {
    local file="$1"
    for ext in "${ASSET_EXTENSIONS[@]}"; do
        if [[ "$file" =~ \.$ext$ ]]; then
            return 0
        fi
    done
    return 1
}

# Function to check if path should be excluded
should_exclude() {
    local path="$1"
    for exclude in "${EXCLUDE_DIRS[@]}"; do
        if [[ "$path" == *"/$exclude"* ]] || [[ "$path" == *"/$exclude/" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to clean whitespace in a file
clean_file() {
    local file="$1"
    local tmp_file

    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
        print_message "$RED" "Error: File $file does not exist"
        return 1
    fi

    # Skip if path should be excluded
    if should_exclude "$file"; then
        return 0
    fi

    # Skip asset files
    if is_asset "$file"; then
        return 0
    fi

    # Skip binary files
    if file "$file" | grep -q "binary file"; then
        return 0
    fi

    # Create temporary file
    tmp_file=$(mktemp)

    # Clean the file:
    # 1. Remove trailing whitespace
    # 2. Remove multiple empty lines
    # 3. Ensure exactly one newline at EOF
    cat "$file" | sed 's/[[:space:]]*$//' | sed -e :a -e '/^\n*$/{$d;N;ba' -e '}' > "$tmp_file"
    echo "" >> "$tmp_file"

    # Remove all trailing newlines and add exactly one
    sed -i -e :a -e '/^\n*$/{$d;N;ba' -e '}' "$tmp_file"
    echo "" >> "$tmp_file"

    # Check if file was modified
    if ! cmp -s "$file" "$tmp_file"; then
        cp "$tmp_file" "$file"
        print_message "$GREEN" " Cleaned whitespace in: $file"
        rm "$tmp_file"
        return 0
    else
        print_message "$BLUE" "No changes needed for: $file"
        rm "$tmp_file"
        return 0
    fi
}

# Print usage if no arguments provided
if [ $# -eq 0 ]; then
    print_message "$YELLOW" "Usage: $0 [-r] [file/directory...]"
    print_message "$YELLOW" "Options:"
    print_message "$YELLOW" "  -r    Recursively process directories"
    print_message "$YELLOW" "  -h    Show this help message"
    exit 1
fi

# Process command line arguments
recursive=false

while getopts "hr" opt; do
    case $opt in
        h)
            print_message "$YELLOW" "Usage: $0 [-r] [file/directory...]"
            print_message "$YELLOW" "Options:"
            print_message "$YELLOW" "  -r    Recursively process directories"
            print_message "$YELLOW" "  -h    Show this help message"
            exit 0
            ;;
        r)
            recursive=true
            ;;
        \?)
            print_message "$RED" "Invalid option: -$OPTARG"
            exit 1
            ;;
    esac
done

shift $((OPTIND-1))

# Process each argument
for arg in "$@"; do
    if [ -f "$arg" ]; then
        # Process single file
        clean_file "$arg"
    elif [ -d "$arg" ]; then
        if [ "$recursive" = true ]; then
            # Process directory recursively
            print_message "$YELLOW" "Processing directory: $arg"
            while IFS= read -r -d '' file; do
                clean_file "$file"
            done < <(find "$arg" -type f -print0)
        else
            # Process only files in the current directory
            print_message "$YELLOW" "Processing directory: $arg"
            for file in "$arg"/*; do
                if [ -f "$file" ]; then
                    clean_file "$file"
                fi
            done
        fi
    else
        print_message "$RED" "Error: $arg is not a file or directory"
    fi
done

