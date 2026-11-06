
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { Construct } from 'constructs';

interface ApplicationStackProps extends cdk.StackProps {
  table: dynamodb.ITable;
  bucket: s3.IBucket;
}

export class ApplicationStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: ApplicationStackProps
  ) {
    super(scope, id, props);

    // Matplotlib layer for the plotting Lambda
    const matplotlibLayer = new lambda.LayerVersion(
      this,
      'MatplotlibLayer',
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../layer/matplotlib')
        ),
        compatibleRuntimes: [
          lambda.Runtime.PYTHON_3_12,
        ],
        compatibleArchitectures: [
          lambda.Architecture.X86_64,
        ],
      }
    );

    // Plotting Lambda
    const plottingLambda = new lambda.Function(
      this,
      'PlottingLambda',
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
        handler: 'plotting_lambda.lambda_handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda')
        ),
        layers: [matplotlibLayer],
        memorySize: 512,
        timeout: cdk.Duration.seconds(30),
        environment: {
          TABLE_NAME: props.table.tableName,
          BUCKET_NAME: props.bucket.bucketName,
        },
      }
    );

    // Plotting Lambda reads DynamoDB
    props.table.grantReadData(plottingLambda);

    // Plotting Lambda uploads the graph to S3
    props.bucket.grantPut(plottingLambda);

    // Create REST API Gateway
    const api = new apigateway.RestApi(
      this,
      'PlottingAPI',
      {
        deployOptions: {
          stageName: 'prod',
        },
      }
    );

    // Create GET /plot endpoint
    const plotResource = api.root.addResource('plot');

    plotResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(plottingLambda)
    );

    // Driver Lambda
    const driverLambda = new lambda.Function(
      this,
      'DriverLambda',
      {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'driver_lambda.lambda_handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda')
        ),
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
        environment: {
          TABLE_NAME: props.table.tableName,
          BUCKET_NAME: props.bucket.bucketName,
          PLOTTING_API_URL: api.urlForPath('/plot'),
        },
      }
    );

    // Driver creates, updates, deletes, and lists S3 objects
    props.bucket.grantReadWrite(driverLambda);

    // Driver queries DynamoDB to confirm measurements
    props.table.grantReadData(driverLambda);

    // Display important information after deployment
    new cdk.CfnOutput(this, 'PlottingApiUrl', {
      value: api.urlForPath('/plot'),
    });

    new cdk.CfnOutput(this, 'DriverLambdaName', {
      value: driverLambda.functionName,
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: props.bucket.bucketName,
    });
  }
}
