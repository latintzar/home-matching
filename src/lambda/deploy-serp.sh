#!/bin/bash
# Deploy SERP Lambda Functions for Neighborhood Analysis
# 
# These run independently - no schedule, triggered by orchestrator.
#
# Usage: bash src/lambda/deploy-serp.sh

set -e

REGION="${AWS_REGION:-us-east-1}"
LAMBDA_ROLE="arn:aws:iam::000000000000:recipient-resource"
S3_BUCKET="puedo-casa-html-archive"
GEMINI_API_KEY="${GEMINI_API_KEY}"

echo "🚀 Deploying SERP Lambda Functions"
echo "=============================="
echo "Region: $REGION"
echo ""

# Check Gemini API key
if [ -z "$GEMINI_API_KEY" ]; then
  echo "⚠️  Warning: GEMINI_API_KEY not set. serp-analyze-single will fail without it."
fi

# Check if Lambda role exists
if ! aws iam get-role --role-name lambda-execution-role &>/dev/null; then
  echo "❌ Lambda execution role not found. Run deploy-lambdas.sh first."
  exit 1
fi

echo "✅ Lambda role exists"

# Ensure Lambda can invoke other Lambdas
echo "Adding Lambda invoke permissions..."
aws iam attach-role-policy \
  --role-name lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/AWSLambdaRole \
  2>/dev/null || true

# Build and deploy each Lambda
deploy_lambda() {
  local NAME=$1
  local HANDLER=$2
  local TIMEOUT=$3
  local MEMORY=$4
  local RESERVED_CONCURRENT=$5
  
  echo ""
  echo "📦 Deploying $NAME..."
  
  # Create deployment package
  mkdir -p dist
  
  # Build with esbuild
  npx esbuild src/lambda/$NAME.ts \
    --bundle \
    --platform=node \
    --target=node18 \
    --outfile=dist/$NAME.js \
    --external:@aws-sdk/* \
    --minify
  
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
      --no-cli-pager > /dev/null
  else
    echo "  Creating new function..."
    aws lambda create-function \
      --function-name $NAME \
      --runtime nodejs18.x \
      --role $LAMBDA_ROLE \
      --handler $NAME.handler \
      --zip-file fileb://dist/$NAME.zip \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --environment "Variables={S3_BUCKET=$S3_BUCKET,AWS_REGION=$REGION,GEMINI_API_KEY=$GEMINI_API_KEY}" \
      --region $REGION \
      --no-cli-pager > /dev/null
  fi
  
  # Update configuration
  echo "  Updating configuration..."
  sleep 2  # Wait for code update to propagate
  
  aws lambda update-function-configuration \
    --function-name $NAME \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment "Variables={S3_BUCKET=$S3_BUCKET,AWS_REGION=$REGION,GEMINI_API_KEY=$GEMINI_API_KEY}" \
    --region $REGION \
    --no-cli-pager > /dev/null || true
  
  # Set reserved concurrency (limit parallel executions)
  if [ -n "$RESERVED_CONCURRENT" ] && [ "$RESERVED_CONCURRENT" != "0" ]; then
    echo "  Setting reserved concurrency: $RESERVED_CONCURRENT"
    aws lambda put-function-concurrency \
      --function-name $NAME \
      --reserved-concurrent-executions $RESERVED_CONCURRENT \
      --region $REGION \
      --no-cli-pager > /dev/null || true
  fi
  
  echo "  ✅ $NAME deployed"
}

# Deploy functions
# NAME                    HANDLER                        TIMEOUT  MEMORY  CONCURRENT
deploy_lambda "serp-download-single"  "serp-download-single.handler"  30       256     400
deploy_lambda "serp-analyze-single"   "serp-analyze-single.handler"   120      1024    100
deploy_lambda "serp-orchestrator"     "serp-orchestrator.handler"     900      512     1

# Cleanup
rm -rf dist

echo ""
echo "=============================="
echo "✅ SERP Lambda functions deployed!"
echo ""
echo "Functions:"
echo "  - serp-download-single: Downloads 1 URL to S3 (400 concurrent)"
echo "  - serp-analyze-single:  Analyzes 1 neighborhood with Gemini (100 concurrent)"
echo "  - serp-orchestrator:    Fires download + analyze Lambdas"
echo ""
echo "Run orchestrator:"
echo "  aws lambda invoke --function-name serp-orchestrator --payload '{}' /dev/stdout"
echo ""
echo "Or with city filter:"
echo "  aws lambda invoke --function-name serp-orchestrator --payload '{\"city\":\"barcelona\"}' /dev/stdout"
echo ""
echo "Monitor with:"
echo "  aws logs tail /aws/lambda/serp-download-single --follow"
echo "  aws logs tail /aws/lambda/serp-analyze-single --follow"
echo "  aws logs tail /aws/lambda/serp-orchestrator --follow"

