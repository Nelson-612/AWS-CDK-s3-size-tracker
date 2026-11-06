
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';

// Custom props to receive the DynamoDB table from DatabaseStack
interface StorageTrackingStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
}

export class StorageTrackingStack extends cdk.Stack {
  public readonly bucket: s3.Bucket;

  constructor(
    scope: Construct,
    id: string,
    props: StorageTrackingStackProps
  ) {
    super(scope, id, props);

    // Create an S3 bucket for assignment files and plots
    this.bucket = new s3.Bucket(this, 'TestBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Create the size-tracking Lambda
    const trackingLambda = new lambda.Function(
      this,
      'SizeTrackingLambda',
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'size_tracking_lambda.lambda_handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda')
        ),
        timeout: cdk.Duration.seconds(30),

        // Pass the generated DynamoDB table name to Lambda
        environment: {
          TABLE_NAME: props.table.tableName,
        },
      }
    );

    // Allow Lambda to read the S3 bucket
    this.bucket.grantRead(trackingLambda);

    // Allow Lambda to write measurements to DynamoDB
    props.table.grantWriteData(trackingLambda);

    // Trigger Lambda on S3 object creation or overwrite
    this.bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(trackingLambda)
    );

    // Trigger Lambda on S3 object deletion
    this.bucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED,
      new s3n.LambdaDestination(trackingLambda)
    );
  }
}
