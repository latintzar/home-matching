#!/bin/bash
# Deploy Lambda Functions with EventBridge Cron Schedules
# 
# Prerequisites:
# - AWS CLI configured
# - Node.js installed
# - Lambda execution role exists
#
# Usage: ./deploy-lambdas.sh

set -e

REGION="${AWS_REGION:-us-east-1}"
LAMBDA_ROLE="arn:aws:iam::000000000000:recipient-resource"
S3_BUCKET="puedo-casa-html-archive"

echo "🚀 Deploying Lambda Functions"
echo "=============================="
echo "Region: $REGION"
echo ""

# Check if Lambda role exists
if ! aws iam get-role --role-name lambda-execution-role &>/dev/null; then
  echo "Creating Lambda execution role..."
  aws iam create-role \
    --role-name lambda-execution-role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'
  
  # Attach policies
  aws iam attach-role-policy \
    --role-name lambda-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  aws iam attach-role-policy \
    --role-name lambda-execution-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
  
  aws iam attach-role-policy \
    --role-name lambda-execution-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  
  aws iam attach-role-policy \
    --role-name lambda-execution-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
  
  echo "Waiting for role to propagate..."
  sleep 10
fi

# Build and deploy each Lambda
deploy_lambda() {
  local NAME=$1
  local HANDLER=$2
  local TIMEOUT=$3
  local MEMORY=$4
  local SCHEDULE=$5
  
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
      --environment "Variables={S3_BUCKET=$S3_BUCKET,AWS_REGION=$REGION}" \
      --region $REGION \
      --no-cli-pager
  fi
  
  # Update configuration (including runtime upgrade to Node 20)
  aws lambda update-function-configuration \
    --function-name $NAME \
    --runtime nodejs20.x \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --region $REGION \
    --no-cli-pager || true
  
  # Create or update EventBridge schedule
  if [ -n "$SCHEDULE" ]; then
    echo "  Setting up schedule: $SCHEDULE"
    
    # Create rule
    aws events put-rule \
      --name "${NAME}-schedule" \
      --schedule-expression "$SCHEDULE" \
      --state ENABLED \
      --region $REGION \
      --no-cli-pager || true
    
    # Add Lambda permission
    aws lambda add-permission \
      --function-name $NAME \
      --statement-id "${NAME}-schedule-permission" \
      --action lambda:InvokeFunction \
      --principal events.amazonaws.com \
      --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
      --region $REGION \
      --no-cli-pager 2>/dev/null || true
    
    # Add target
    aws events put-targets \
      --rule "${NAME}-schedule" \
      --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
      --region $REGION \
      --no-cli-pager || true
  fi
  
  echo "  ✅ $NAME deployed"
}

# Deploy functions
# NAME                    HANDLER                           TIMEOUT  MEMORY  SCHEDULE
deploy_lambda "daily-harvest-delta"   "daily-harvest-delta.handler"   900      512     "cron(0 3 * * ? *)"
deploy_lambda "daily-parse"           "daily-parse.handler"           900      1024    "cron(0 4 * * ? *)"
deploy_lambda "detect-listing-status" "detect-listing-status.handler" 900      512     "cron(0 5 * * ? *)"
deploy_lambda "daily-recommend-users" "daily-recommend-users.handler" 1800     1024    "cron(0 6 * * ? *)"

# E&V Harvest - runs 3x daily (7 AM, 12 PM, 6 PM Spain = 6 AM, 11 AM, 5 PM UTC)
deploy_lambda "ev-harvest-delta"      "ev-harvest-delta.handler"      900      2048    "cron(0 6 * * ? *)"

# Additional E&V schedules (11:00 and 17:00 UTC = 12 PM and 6 PM Spain)
echo ""
echo "📅 Setting up additional E&V schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "ev-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name ev-harvest-delta \
  --statement-id "ev-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "ev-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "ev-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name ev-harvest-delta \
  --statement-id "ev-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "ev-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ E&V schedules configured (7 AM, 12 PM, 6 PM Spain)"

# Lucas Fox Harvest - runs 3x daily (same schedule as E&V)
deploy_lambda "lf-harvest-delta"      "lf-harvest-delta.handler"      900      2048    "cron(0 6 * * ? *)"

# Additional Lucas Fox schedules
echo ""
echo "📅 Setting up Lucas Fox schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "lf-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name lf-harvest-delta \
  --statement-id "lf-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "lf-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "lf-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name lf-harvest-delta \
  --statement-id "lf-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "lf-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ Lucas Fox schedules configured (7 AM, 12 PM, 6 PM Spain)"

# donpiso Harvest - runs 3x daily (same schedule as E&V)
deploy_lambda "dp-harvest-delta"       "dp-harvest-delta.handler"       900      2048    "cron(0 6 * * ? *)"

# Additional donpiso schedules
echo ""
echo "📅 Setting up donpiso schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "dp-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name dp-harvest-delta \
  --statement-id "dp-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "dp-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "dp-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name dp-harvest-delta \
  --statement-id "dp-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "dp-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ donpiso schedules configured (7 AM, 12 PM, 6 PM Spain)"

# Tecnocasa Harvest - runs 3x daily (same schedule)
deploy_lambda "tc-harvest-delta"       "tc-harvest-delta.handler"       900      2048    "cron(0 6 * * ? *)"

# Additional Tecnocasa schedules
echo ""
echo "📅 Setting up Tecnocasa schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "tc-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name tc-harvest-delta \
  --statement-id "tc-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "tc-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "tc-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name tc-harvest-delta \
  --statement-id "tc-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "tc-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ Tecnocasa schedules configured (7 AM, 12 PM, 6 PM Spain)"

# Century21 Harvest - runs 3x daily (same schedule)
deploy_lambda "c21-harvest-delta"       "c21-harvest-delta.handler"       900      2048    "cron(0 6 * * ? *)"

# Additional Century21 schedules
echo ""
echo "📅 Setting up Century21 schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "c21-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name c21-harvest-delta \
  --statement-id "c21-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "c21-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "c21-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name c21-harvest-delta \
  --statement-id "c21-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "c21-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ Century21 schedules configured (7 AM, 12 PM, 6 PM Spain)"

# RE/MAX Harvest - runs 3x daily (same schedule)
deploy_lambda "remax-harvest-delta"       "remax-harvest-delta.handler"       900      4096    "cron(0 6 * * ? *)"

# Additional RE/MAX schedules
echo ""
echo "📅 Setting up RE/MAX schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "remax-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name remax-harvest-delta \
  --statement-id "remax-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "remax-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "remax-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name remax-harvest-delta \
  --statement-id "remax-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "remax-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ RE/MAX schedules configured (7 AM, 12 PM, 6 PM Spain)"

# aProperties Harvest - runs 3x daily (same schedule)
deploy_lambda "aproperties-harvest-delta"       "aproperties-harvest-delta.handler"       900      2048    "cron(0 6 * * ? *)"

# Additional aProperties schedules
echo ""
echo "📅 Setting up aProperties schedules..."

# 11 AM UTC = 12 PM Spain
aws events put-rule \
  --name "aproperties-harvest-delta-noon" \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name aproperties-harvest-delta \
  --statement-id "aproperties-harvest-noon-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "aproperties-harvest-delta-noon" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

# 5 PM UTC = 6 PM Spain
aws events put-rule \
  --name "aproperties-harvest-delta-evening" \
  --schedule-expression "cron(0 17 * * ? *)" \
  --state ENABLED \
  --region $REGION \
  --no-cli-pager || true

aws lambda add-permission \
  --function-name aproperties-harvest-delta \
  --statement-id "aproperties-harvest-evening-permission" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager 2>/dev/null || true

aws events put-targets \
  --rule "aproperties-harvest-delta-evening" \
  --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
  --region $REGION \
  --no-cli-pager || true

echo "  ✅ aProperties schedules configured (7 AM, 12 PM, 6 PM Spain)"

# Cleanup
rm -rf dist

echo ""
echo "=============================="
echo "✅ All Lambda functions deployed!"
echo ""
echo "Schedules (UTC):"
echo "  - daily-harvest-delta:   3:00 AM - Check sitemaps for new URLs"
echo "  - daily-parse:           4:00 AM - Parse new HTMLs"
echo "  - detect-listing-status: 5:00 AM - Detect sold/rented"
echo "  - daily-recommend-users: 6:00 AM - Run recommender for all users"
echo ""
echo "Premium Domain Lambdas (7 AM, 12 PM, 6 PM Spain):"
echo "  - ev-harvest-delta:         E&V (~6k listings, SSR)"
echo "  - lf-harvest-delta:         Lucas Fox (~2k listings, JSON-LD + Nominatim)"
echo "  - dp-harvest-delta:         donpiso (~2.8k listings, JSON-LD)"
echo "  - tc-harvest-delta:         Tecnocasa (~7.3k listings, embedded JSON) ★ BEST DATA"
echo "  - c21-harvest-delta:        Century21 (~23k listings, HTML parsing + Nominatim)"
echo "  - remax-harvest-delta:      RE/MAX (~TBD listings, HTML parsing + Nominatim)"
echo "  - aproperties-harvest-delta: aProperties (~7.3k listings, HTML parsing + Nominatim)"
echo ""
echo "Monitor with:"
echo "  aws logs tail /aws/lambda/daily-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/daily-parse --follow"
echo "  aws logs tail /aws/lambda/detect-listing-status --follow"
echo "  aws logs tail /aws/lambda/daily-recommend-users --follow"
echo "  aws logs tail /aws/lambda/ev-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/lf-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/dp-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/tc-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/c21-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/remax-harvest-delta --follow"
echo "  aws logs tail /aws/lambda/aproperties-harvest-delta --follow"

