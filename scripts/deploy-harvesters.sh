#!/bin/bash
# Deploy Harvester Lambda Functions with EventBridge Schedules
# 
# Usage: ./scripts/deploy-harvesters.sh [--invoke] [--export-only]
#   --invoke       Run each Lambda immediately after deploying
#   --export-only  Only deploy the catalogue-export Lambda
#
# Prerequisites:
# - AWS CLI configured (source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION)
# - Node.js installed
#
# ═══════════════════════════════════════════════════════════════════════════════
# SCHEDULE OVERVIEW (3x Daily)
# ═══════════════════════════════════════════════════════════════════════════════
#
# CYCLE 1 - Early Morning (Spain: 4-8 AM)
#   3:00 AM UTC - Harvesters start (staggered)
#   7:00 AM UTC - Export to S3
#
# CYCLE 2 - Midday (Spain: 12-3 PM)  
#   11:00 AM UTC - Harvesters start (staggered)
#   2:00 PM UTC - Export to S3
#
# CYCLE 3 - Evening (Spain: 6-9 PM)
#   5:00 PM UTC - Harvesters start (staggered)
#   8:00 PM UTC - Export to S3
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

REGION="${AWS_REGION:-us-east-1}"
LAMBDA_ROLE="arn:aws:iam::000000000000:recipient-resource"
INVOKE_AFTER_DEPLOY=false
EXPORT_ONLY=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --invoke)
      INVOKE_AFTER_DEPLOY=true
      ;;
    --export-only)
      EXPORT_ONLY=true
      ;;
  esac
done

echo "🚀 Deploying Harvester Lambda Functions (3x Daily Schedule)"
echo "============================================================"
echo "Region: $REGION"
echo "Invoke after deploy: $INVOKE_AFTER_DEPLOY"
echo "Export only: $EXPORT_ONLY"
echo ""

# Check if Lambda role exists, create if not
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
  
  echo "Waiting for role to propagate..."
  sleep 10
fi

# Create dist directory
mkdir -p dist

# Deploy a single Lambda with multiple schedules
# Args: NAME TIMEOUT MEMORY SCHEDULE1 SCHEDULE2 SCHEDULE3 [ENV_VARS]
deploy_harvester() {
  local NAME=$1
  local TIMEOUT=$2
  local MEMORY=$3
  local SCHEDULE1=$4  # Cycle 1 (early morning)
  local SCHEDULE2=$5  # Cycle 2 (midday)
  local SCHEDULE3=$6  # Cycle 3 (evening)
  local ENV_VARS=$7
  
  echo ""
  echo "📦 Deploying $NAME..."
  
  # Build with esbuild
  npx esbuild src/lambda/$NAME.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/$NAME.js \
    --external:@aws-sdk/*
  
  # Create zip
  cd dist
  zip -q $NAME.zip $NAME.js
  cd ..
  
  # Default environment variables
  local DEFAULT_ENV="AWS_REGION=$REGION,S3_BUCKET=puedo-casa-html-archive,NOMINATIM_URL=http://3.230.148.50:8080"
  
  # Merge additional env vars if provided
  if [ -n "$ENV_VARS" ]; then
    DEFAULT_ENV="${DEFAULT_ENV},${ENV_VARS}"
  fi
  
  # Create or update Lambda
  if aws lambda get-function --function-name $NAME --region $REGION &>/dev/null; then
    echo "  Updating existing function..."
    aws lambda update-function-code \
      --function-name $NAME \
      --zip-file fileb://dist/$NAME.zip \
      --region $REGION \
      --no-cli-pager > /dev/null
    
    aws lambda wait function-updated --function-name $NAME --region $REGION 2>/dev/null || sleep 3
    
    aws lambda update-function-configuration \
      --function-name $NAME \
      --runtime nodejs20.x \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --environment "Variables={$DEFAULT_ENV}" \
      --region $REGION \
      --no-cli-pager > /dev/null 2>&1 || true
      
    aws lambda wait function-updated --function-name $NAME --region $REGION 2>/dev/null || sleep 2
  else
    echo "  Creating new function..."
    aws lambda create-function \
      --function-name $NAME \
      --runtime nodejs20.x \
      --role $LAMBDA_ROLE \
      --handler $NAME.handler \
      --zip-file fileb://dist/$NAME.zip \
      --timeout $TIMEOUT \
      --memory-size $MEMORY \
      --environment "Variables={$DEFAULT_ENV}" \
      --region $REGION \
      --no-cli-pager > /dev/null
    
    sleep 5
  fi
  
  # Keep recursive invocation protection ENABLED for safety
  # Harvesters use state persistence + scheduled runs instead of self-invocation
  aws lambda put-function-recursion-config \
    --function-name $NAME \
    --recursive-loop "Terminate" \
    --region $REGION \
    --no-cli-pager 2>/dev/null || true
  
  # Set up 3 EventBridge schedules
  for i in 1 2 3; do
    local SCHEDULE_VAR="SCHEDULE$i"
    local SCHEDULE="${!SCHEDULE_VAR}"
    
    if [ -n "$SCHEDULE" ]; then
      local RULE_NAME="${NAME}-cycle${i}"
      
      # Create rule
      aws events put-rule \
        --name "$RULE_NAME" \
        --schedule-expression "$SCHEDULE" \
        --state ENABLED \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
      
      # Add Lambda permission
      aws lambda add-permission \
        --function-name $NAME \
        --statement-id "${RULE_NAME}-permission" \
        --action lambda:InvokeFunction \
        --principal events.amazonaws.com \
        --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
      
      # Add target
      aws events put-targets \
        --rule "$RULE_NAME" \
        --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
        --region $REGION \
        --no-cli-pager 2>/dev/null || true
    fi
  done
  
  echo "  ✅ $NAME deployed with 3 daily schedules"
  
  # Invoke immediately if requested
  if [ "$INVOKE_AFTER_DEPLOY" = true ]; then
    echo "  🔄 Invoking $NAME..."
    aws lambda invoke \
      --function-name $NAME \
      --invocation-type Event \
      --region $REGION \
      --no-cli-pager \
      /dev/null 2>/dev/null || echo "  ⚠️  Invoke queued (async)"
  fi
}

# Deploy export Lambda (simpler - just needs schedules)
deploy_export() {
  local NAME="catalogue-export"
  
  echo ""
  echo "📦 Deploying $NAME..."
  
  npx esbuild src/lambda/$NAME.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --outfile=dist/$NAME.js \
    --external:@aws-sdk/*
  
  cd dist
  zip -q $NAME.zip $NAME.js
  cd ..
  
  local DEFAULT_ENV="AWS_REGION=$REGION"
  
  if aws lambda get-function --function-name $NAME --region $REGION &>/dev/null; then
    aws lambda update-function-code \
      --function-name $NAME \
      --zip-file fileb://dist/$NAME.zip \
      --region $REGION \
      --no-cli-pager > /dev/null
    
    aws lambda wait function-updated --function-name $NAME --region $REGION 2>/dev/null || sleep 3
  else
    aws lambda create-function \
      --function-name $NAME \
      --runtime nodejs20.x \
      --role $LAMBDA_ROLE \
      --handler $NAME.handler \
      --zip-file fileb://dist/$NAME.zip \
      --timeout 120 \
      --memory-size 256 \
      --environment "Variables={$DEFAULT_ENV}" \
      --region $REGION \
      --no-cli-pager > /dev/null
    
    sleep 5
  fi
  
  # 3 export schedules (after each harvest cycle)
  local SCHEDULES=("cron(0 7 * * ? *)" "cron(0 14 * * ? *)" "cron(0 20 * * ? *)")
  local NAMES=("morning" "midday" "evening")
  
  for i in 0 1 2; do
    local RULE_NAME="${NAME}-${NAMES[$i]}"
    local SCHEDULE="${SCHEDULES[$i]}"
    
    aws events put-rule \
      --name "$RULE_NAME" \
      --schedule-expression "$SCHEDULE" \
      --state ENABLED \
      --region $REGION \
      --no-cli-pager 2>/dev/null || true
    
    aws lambda add-permission \
      --function-name $NAME \
      --statement-id "${RULE_NAME}-permission" \
      --action lambda:InvokeFunction \
      --principal events.amazonaws.com \
      --source-arn "arn:aws:events:$REGION:000000000000:recipient-resource" \
      --region $REGION \
      --no-cli-pager 2>/dev/null || true
    
    aws events put-targets \
      --rule "$RULE_NAME" \
      --targets "Id=1,Arn=arn:aws:lambda:$REGION:000000000000:recipient-resource" \
      --region $REGION \
      --no-cli-pager 2>/dev/null || true
  done
  
  echo "  ✅ $NAME deployed with 3 daily schedules"
}

# Get ScrapFly key for aProperties
SCRAPFLY_KEY="${SCRAPFLY_KEY:-}"

if [ "$EXPORT_ONLY" = false ]; then
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  DEPLOYING HARVESTERS (3x Daily)"
  echo "═══════════════════════════════════════════════════════════════"
  
  # Deploy all 7 harvesters with 3x daily schedules
  # Staggered by 15 minutes within each cycle
  #
  # NAME                    TIMEOUT MEM   CYCLE1(3AM)      CYCLE2(11AM)      CYCLE3(5PM)       ENV
  deploy_harvester "tc-harvest-delta"          900 512  "cron(0 3 * * ? *)"  "cron(0 11 * * ? *)"  "cron(0 17 * * ? *)"  ""
  deploy_harvester "ev-harvest-delta"          900 512  "cron(15 3 * * ? *)" "cron(15 11 * * ? *)" "cron(15 17 * * ? *)" ""
  deploy_harvester "c21-harvest-delta"         900 512  "cron(30 3 * * ? *)" "cron(30 11 * * ? *)" "cron(30 17 * * ? *)" ""
  deploy_harvester "lf-harvest-delta"          900 512  "cron(45 3 * * ? *)" "cron(45 11 * * ? *)" "cron(45 17 * * ? *)" ""
  deploy_harvester "remax-harvest-delta"       900 2048 "cron(0 4 * * ? *)"  "cron(0 12 * * ? *)"  "cron(0 18 * * ? *)"  ""
  deploy_harvester "dp-harvest-delta"          900 512  "cron(15 4 * * ? *)" "cron(15 12 * * ? *)" "cron(15 18 * * ? *)" ""
  
  # aProperties needs ScrapFly
  if [ -n "$SCRAPFLY_KEY" ]; then
    deploy_harvester "aproperties-harvest-delta" 900 512  "cron(30 4 * * ? *)" "cron(30 12 * * ? *)" "cron(30 18 * * ? *)" "SCRAPFLY_KEY=$SCRAPFLY_KEY"
  else
    echo ""
    echo "⚠️  SCRAPFLY_KEY not set - skipping aProperties harvester"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  DEPLOYING EXPORT (3x Daily, after each harvest cycle)"
echo "═══════════════════════════════════════════════════════════════"

deploy_export

# Cleanup
rm -rf dist

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT COMPLETE - 3x Daily Schedule"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "┌─────────────────────────────────────────────────────────────────────────────┐"
echo "│  CYCLE 1 - EARLY MORNING                                                    │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│  3:00 AM UTC  tc-harvest-delta       (Tecnocasa)        → 4:00 AM Spain    │"
echo "│  3:15 AM      ev-harvest-delta       (Engel & Völkers)  → 4:15 AM Spain    │"
echo "│  3:30 AM      c21-harvest-delta      (Century 21)       → 4:30 AM Spain    │"
echo "│  3:45 AM      lf-harvest-delta       (Lucas Fox)        → 4:45 AM Spain    │"
echo "│  4:00 AM      remax-harvest-delta    (RE/MAX)           → 5:00 AM Spain    │"
echo "│  4:15 AM      dp-harvest-delta       (donpiso)          → 5:15 AM Spain    │"
echo "│  4:30 AM      aproperties-delta      (aProperties)      → 5:30 AM Spain    │"
echo "│  7:00 AM      catalogue-export       (→ S3)             → 8:00 AM Spain    │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│  CYCLE 2 - MIDDAY                                                           │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│  11:00 AM     Harvesters start...                       → 12:00 PM Spain   │"
echo "│  2:00 PM      catalogue-export       (→ S3)             → 3:00 PM Spain    │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│  CYCLE 3 - EVENING                                                          │"
echo "├─────────────────────────────────────────────────────────────────────────────┤"
echo "│  5:00 PM      Harvesters start...                       → 6:00 PM Spain    │"
echo "│  8:00 PM      catalogue-export       (→ S3)             → 9:00 PM Spain    │"
echo "└─────────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "Commands:"
echo "  Monitor:      aws logs tail /aws/lambda/remax-harvest-delta --follow"
echo "  Manual run:   aws lambda invoke --function-name tc-harvest-delta /dev/null"
echo "  Manual export: aws lambda invoke --function-name catalogue-export /dev/null"
echo "  DB count:     aws dynamodb scan --table-name leo-listings --select COUNT"
echo ""
