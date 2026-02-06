#!/bin/bash
# Upload BT4 (and other large files) to R2 using AWS CLI

BUCKET="play-lc0-models"
ENDPOINT="https://e279bdf8038be9bfccc6dda153c9ac71.r2.cloudflarestorage.com"
FILE="public/models/BT4-1024x15x32h-swa-6147500.onnx.bin"

echo "Uploading BT4 to R2 using AWS CLI..."
echo "File: $FILE (473 MB)"
echo ""

# Upload using AWS CLI with R2 endpoint
aws s3 cp "$FILE" \
  "s3://$BUCKET/BT4-1024x15x32h-swa-6147500.onnx.bin" \
  --endpoint-url "$ENDPOINT" \
  --profile r2

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ BT4 uploaded successfully!"
  echo "Available at: https://pub-0cf3a9ac59314aa1ac3e67a690fc3db5.r2.dev/BT4-1024x15x32h-swa-6147500.onnx.bin"
else
  echo ""
  echo "✗ Upload failed. Make sure you've configured AWS CLI:"
  echo "  aws configure --profile r2"
  echo ""
  echo "You'll need your R2 Access Key and Secret from:"
  echo "  https://dash.cloudflare.com/ → R2 → Manage R2 API Tokens"
fi
