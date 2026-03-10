#!/bin/bash
# =============================================================================
# NeuroReach AI — Setup Staging Frontend Infrastructure (one-time)
#
# This script creates the AWS resources needed for the staging frontend:
#   1. Register the ECS task definition
#   2. Create the ECS service
#
# Prerequisites:
#   - AWS CLI configured with valid credentials
#   - The neuroreach-ai/frontend ECR repo already exists (shared with production)
#   - The neuroreach-ai-cluster ECS cluster already exists
#
# Usage:
#   chmod +x infrastructure/setup-staging-frontend.sh
#   ./infrastructure/setup-staging-frontend.sh
# =============================================================================

set -euo pipefail

REGION="us-east-2"
CLUSTER="neuroreach-ai-cluster"
SERVICE_NAME="neuroreach-staging-frontend-service"
TASK_DEF_FILE="infrastructure/staging-frontend-taskdef.json"

echo "🚀 Setting up staging frontend infrastructure..."

# Step 1: Register the task definition
echo ""
echo "📋 Step 1: Registering task definition..."
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json file://${TASK_DEF_FILE} \
  --region ${REGION} \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)
echo "✅ Task definition registered: ${TASK_DEF_ARN}"

# Step 2: Get networking config from existing staging backend service
echo ""
echo "📋 Step 2: Getting networking config from existing staging backend service..."
NETWORK_CONFIG=$(aws ecs describe-services \
  --cluster ${CLUSTER} \
  --services neuroreach-staging-backend-service \
  --region ${REGION} \
  --query 'services[0].networkConfiguration' \
  --output json)

SUBNETS=$(echo ${NETWORK_CONFIG} | python3 -c "import sys,json; nc=json.load(sys.stdin); print(' '.join(['subnets='+s for s in nc['awsvpcConfiguration']['subnets']]))")
SECURITY_GROUPS=$(echo ${NETWORK_CONFIG} | python3 -c "import sys,json; nc=json.load(sys.stdin); print(','.join(nc['awsvpcConfiguration']['securityGroups']))")
SUBNET_LIST=$(echo ${NETWORK_CONFIG} | python3 -c "import sys,json; nc=json.load(sys.stdin); print(','.join(nc['awsvpcConfiguration']['subnets']))")

echo "  Subnets: ${SUBNET_LIST}"
echo "  Security Groups: ${SECURITY_GROUPS}"

# Step 3: Create the ECS service
echo ""
echo "📋 Step 3: Creating ECS service: ${SERVICE_NAME}..."
aws ecs create-service \
  --cluster ${CLUSTER} \
  --service-name ${SERVICE_NAME} \
  --task-definition ${TASK_DEF_ARN} \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${SECURITY_GROUPS}],assignPublicIp=ENABLED}" \
  --region ${REGION} \
  --query 'service.serviceArn' \
  --output text

echo ""
echo "✅ Staging frontend service created successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Configure ALB target group for the frontend service (port 80)"
echo "  2. Add ALB listener rule for staging frontend hostname"
echo "  3. Push code to dev branch to trigger the full CI/CD pipeline"
echo ""
echo "🎉 Done!"
