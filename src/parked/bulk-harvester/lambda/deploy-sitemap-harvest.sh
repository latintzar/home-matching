#!/bin/bash
set -e

# Configuration
FUNCTION_NAME="leo-sitemap-harvest"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::000000000000:recipient-resource"
TIMEOUT=300  # 5 minutes
MEMORY=512

echo "🚀 Deploying Sitemap Harvest Lambda..."

# Check if role exists
if ! aws iam get-role --role-name leo-lambda-role 2>/dev/null; then
  echo "Creating Lambda execution role..."
  
  # Create trust policy
  cat > /tmp/trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  aws iam create-role \
    --role-name leo-lambda-role \
    --assume-role-policy-document file:///tmp/trust-policy.json
  
  # Attach policies
  aws iam attach-role-policy \
    --role-name leo-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  aws iam attach-role-policy \
    --role-name leo-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  
  aws iam attach-role-policy \
    --role-name leo-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess
  
  echo "Waiting for role to propagate..."
  sleep 10
fi

# Build the Lambda
echo "📦 Building Lambda package..."
cd "$(dirname "$0")/../.."

# Create temp directory for Lambda package
rm -rf /tmp/lambda-build
mkdir -p /tmp/lambda-build

# Bundle with esbuild
npx esbuild src/lambda/sitemap-harvest.ts \
  --bundle \
  --platform=node \
  --target=node18 \
  --outfile=/tmp/lambda-build/index.js \
  --external:@aws-sdk/client-dynamodb \
  --external:@aws-sdk/lib-dynamodb \
  --external:@aws-sdk/client-sns

# Create zip
cd /tmp/lambda-build
zip -r function.zip index.js

# Deploy or update Lambda
echo "☁️ Deploying to AWS Lambda..."
if aws lambda get-function --function-name $FUNCTION_NAME 2>/dev/null; then
  # Update existing function
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://function.zip \
    --region $REGION
else
  # Create new function
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --handler index.handler \
    --role $ROLE_ARN \
    --zip-file fileb://function.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION \
    --environment "Variables={URLS_TABLE=leo-urls,CRAWL_STATUS_TABLE=leo-crawl-status,SNS_TOPIC_ARN=arn:aws:sns:us-east-1:000000000000:recipient-resource"
fi

echo "✅ Lambda deployed: $FUNCTION_NAME"
echo ""
echo "To invoke manually:"
echo "  aws lambda invoke --function-name $FUNCTION_NAME --payload '{\"domains\":[{\"domain\":\"example.com\",\"sitemapUrl\":\"https://example.com/sitemap.xml\"}]}' /tmp/output.json"

