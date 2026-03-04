#!/usr/bin/env bash
# ═══════════════════════════════════════════
# MAJU AI Video Launchpad — AWS App Runner Deploy
# ═══════════════════════════════════════════
#
# Prerequisites:
#   1. AWS CLI installed and configured (aws configure)
#   2. Docker installed and running
#
# Usage:
#   chmod +x deploy-aws.sh
#   ./deploy-aws.sh
#
# This script:
#   - Creates an ECR repository (if needed)
#   - Builds and pushes the Docker image
#   - Creates/updates an App Runner service
#
# After first deploy, copy the service URL and paste it
# into your MAJU dashboard Settings → Backend URL
# ═══════════════════════════════════════════

set -euo pipefail

# ─── Config ───
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="maju-backend"
APP_RUNNER_SERVICE_NAME="maju-backend"
PORT=3001

echo "╔═══════════════════════════════════════╗"
echo "║  MAJU Backend → AWS App Runner Deploy ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ─── Step 1: Get AWS Account ID ───
echo "→ Getting AWS account info..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_URI="${ECR_URI}/${ECR_REPO_NAME}:latest"
echo "  Account: ${ACCOUNT_ID}"
echo "  Region:  ${AWS_REGION}"

# ─── Step 2: Create ECR Repository ───
echo ""
echo "→ Creating ECR repository (if needed)..."
aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${AWS_REGION}" 2>/dev/null || \
  aws ecr create-repository --repository-name "${ECR_REPO_NAME}" --region "${AWS_REGION}" --image-scanning-configuration scanOnPush=true

# ─── Step 3: Docker Login to ECR ───
echo ""
echo "→ Logging into ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_URI}"

# ─── Step 4: Build & Push Docker Image ───
echo ""
echo "→ Building Docker image..."
docker build -t "${ECR_REPO_NAME}" -f server/Dockerfile server/

echo ""
echo "→ Tagging and pushing to ECR..."
docker tag "${ECR_REPO_NAME}:latest" "${IMAGE_URI}"
docker push "${IMAGE_URI}"

# ─── Step 5: Create App Runner IAM Role (if needed) ───
echo ""
echo "→ Setting up IAM role for App Runner ECR access..."
ROLE_NAME="AppRunnerECRAccessRole"

# Create the role if it doesn't exist
if ! aws iam get-role --role-name "${ROLE_NAME}" 2>/dev/null; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "build.apprunner.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'
  aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
  echo "  Waiting for role to propagate..."
  sleep 10
fi
ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)

# ─── Step 6: Create or Update App Runner Service ───
echo ""
echo "→ Deploying App Runner service..."

EXISTING_SERVICE=$(aws apprunner list-services --region "${AWS_REGION}" \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE_NAME}'].ServiceArn" --output text 2>/dev/null || echo "")

if [ -n "${EXISTING_SERVICE}" ] && [ "${EXISTING_SERVICE}" != "None" ]; then
  echo "  Updating existing service..."
  aws apprunner update-service \
    --service-arn "${EXISTING_SERVICE}" \
    --source-configuration "{
      \"AuthenticationConfiguration\": {\"AccessRoleArn\": \"${ROLE_ARN}\"},
      \"ImageRepository\": {
        \"ImageIdentifier\": \"${IMAGE_URI}\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {\"Port\": \"${PORT}\"}
      }
    }" \
    --region "${AWS_REGION}"
  SERVICE_URL=$(aws apprunner describe-service --service-arn "${EXISTING_SERVICE}" --region "${AWS_REGION}" \
    --query 'Service.ServiceUrl' --output text)
else
  echo "  Creating new service..."
  CREATE_OUTPUT=$(aws apprunner create-service \
    --service-name "${APP_RUNNER_SERVICE_NAME}" \
    --source-configuration "{
      \"AuthenticationConfiguration\": {\"AccessRoleArn\": \"${ROLE_ARN}\"},
      \"ImageRepository\": {
        \"ImageIdentifier\": \"${IMAGE_URI}\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {\"Port\": \"${PORT}\"}
      }
    }" \
    --instance-configuration '{"Cpu": "1024", "Memory": "2048"}' \
    --health-check-configuration '{"Protocol": "HTTP", "Path": "/api/health", "Interval": 20, "Timeout": 5, "HealthyThreshold": 1, "UnhealthyThreshold": 5}' \
    --region "${AWS_REGION}")
  SERVICE_URL=$(echo "${CREATE_OUTPUT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['Service']['ServiceUrl'])")
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  ✓ Deploy complete!                                  ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "  Backend URL: https://${SERVICE_URL}"
echo "║                                                       ║"
echo "║  Next steps:                                          ║"
echo "║  1. Wait ~2-3 min for service to become active        ║"
echo "║  2. Open your MAJU dashboard                         ║"
echo "║  3. Go to Settings → Backend URL                     ║"
echo "║  4. Paste the URL above and click Save                ║"
echo "║                                                       ║"
echo "║  To redeploy after code changes:                      ║"
echo "║    ./deploy-aws.sh                                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
