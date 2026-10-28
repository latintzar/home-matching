#!/bin/bash
# Deploy only the harvester Lambda functions with updated analytics
# 
# Usage: ./deploy-harvesters-only.sh

set -e

REGION="${AWS_REGION:-us-east-1}"
LAMBDA_ROLE="arn:aws:iam::000000000000:recipient-resource"
S3_BUCKET="puedo-casa-html-archive"
SCRAPFLY_KEY="${SCRAPFLY_KEY:-}"
NOMINATIM_URL="${NOMINATIM_URL:-http://3.230.148.50:8080}"

echo "🚀 Deploying Harvester Lambda Functions"
echo "======================================="
echo "Region: $REGION"
echo ""

# Build and deploy each Lambda
deploy_harvester() {
  local NAME=$1
  local HANDLER=$2
  local TIMEOUT=$3
  local MEMORY=$4
  
  echo ""
  echo "📦 Deploying $NAME..."
  
  # Create deployment package
  mkdir -p dist
  npx esbuild src/lambda/$NAME.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/$NAME.js \
    --external:@aws-sdk/*
  
  cd dist
  zip -q $NAME.zip $NAME.js
  cd ..
  
  # Create or update Lambda
  if aws lambda get-function --function-name $NAME --region $REGION &>/dev/null; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --function-name $NAME \
      --zip-file fileb://dist/$NAME.zip \
      --region $REGION \
      --no-cli-pager
    
    # Wait for update to complete
    sleep 3
    
    # Update configuration
    aws lambda update-function-configuration \
      --function-name $NAME \
      --runtime nodejs20.x \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --environment "Variables={S3_BUCKET=$S3_BUCKET,SCRAPFLY_KEY=$SCRAPFLY_KEY,NOMINATIM_URL=$NOMINATIM_URL}" \
      --region $REGION \
      --no-cli-pager || true
  else
    echo "  Creating new function..."
    aws lambda create-function \
      --function-name $NAME \
      --runtime nodejs20.x \
      --role $LAMBDA_ROLE \
      --handler $HANDLER \
      --zip-file fileb://dist/$NAME.zip \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --environment "Variables={S3_BUCKET=$S3_BUCKET,SCRAPFLY_KEY=$SCRAPFLY_KEY,NOMINATIM_URL=$NOMINATIM_URL}" \
      --region $REGION \
      --no-cli-pager
  fi
  
  echo "  ✅ $NAME deployed (${MEMORY}MB memory)"
}

# Deploy harvesters with updated memory settings
# NAME                         HANDLER                                TIMEOUT  MEMORY
deploy_harvester "tc-harvest-delta"          "tc-harvest-delta.handler"         900      2048
deploy_harvester "c21-harvest-delta"         "c21-harvest-delta.handler"        900      2048
deploy_harvester "lf-harvest-delta"          "lf-harvest-delta.handler"         900      2048
deploy_harvester "dp-harvest-delta"          "dp-harvest-delta.handler"         900      2048
deploy_harvester "remax-harvest-delta"       "remax-harvest-delta.handler"      900      4096
deploy_harvester "aproperties-harvest-delta" "aproperties-harvest-delta.handler" 900     2048

echo ""
echo "✅ All harvesters deployed!"
echo ""
echo "📊 Memory Configuration:"
echo "  - tc-harvest-delta:          2048 MB"
echo "  - c21-harvest-delta:         2048 MB"
echo "  - lf-harvest-delta:          2048 MB"
echo "  - dp-harvest-delta:          2048 MB"
echo "  - remax-harvest-delta:       4096 MB"
echo "  - aproperties-harvest-delta: 2048 MB"
echo ""
echo "📈 Run analytics will be written to 'leo-harvest-stats' DynamoDB table."
echo ""
