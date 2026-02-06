#!/bin/bash
# Upload all ONNX models to Cloudflare R2

BUCKET="play-lc0-models"
MODEL_DIR="public/models"
FORCE_UPLOAD=false

# Parse command line arguments
if [ "$1" = "--force" ] || [ "$1" = "-f" ]; then
    FORCE_UPLOAD=true
    echo "Force upload mode enabled - will overwrite existing files"
    echo
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler is not installed"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

echo "Uploading models to R2 bucket: $BUCKET (remote)"
echo "This may take a while for large models..."
echo

# Upload all .onnx.bin files (to root of bucket, not /models subdirectory)
for file in "$MODEL_DIR"/*.onnx.bin; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")

        # Check if file already exists in R2 (unless force mode)
        if [ "$FORCE_UPLOAD" = false ] && wrangler r2 object get "$BUCKET/$filename" --file=/dev/null --remote 2>/dev/null; then
            echo "⊘ $filename already exists, skipping..."
        else
            echo "↑ Uploading $filename..."
            wrangler r2 object put "$BUCKET/$filename" --file="$file" --remote
            if [ $? -eq 0 ]; then
                echo "✓ $filename uploaded successfully"
            else
                echo "✗ Failed to upload $filename"
            fi
        fi
        echo
    fi
done

echo "Upload complete!"
echo "Models are now available at: https://pub-0cf3a9ac59314aa1ac3e67a690fc3db5.r2.dev/"
