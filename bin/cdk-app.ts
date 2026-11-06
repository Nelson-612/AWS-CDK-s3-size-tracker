#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { StorageTrackingStack } from '../lib/storage-tracking-stack';
import { ApplicationStack } from '../lib/application-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Stack 1: DynamoDB
const databaseStack = new DatabaseStack(
  app,
  'HW3DatabaseStack',
  { env }
);

// Stack 2: S3 and tracking Lambda
const storageStack = new StorageTrackingStack(
  app,
  'HW3StorageTrackingStack',
  {
    env,
    table: databaseStack.table,
  }
);

// Stack 3: Plotting, driver, API Gateway
new ApplicationStack(
  app,
  'HW3ApplicationStack',
  {
    env,
    table: databaseStack.table,
    bucket: storageStack.bucket,
  }
);
