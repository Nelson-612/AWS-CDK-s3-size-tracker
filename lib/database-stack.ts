import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, 
    id: string, 
    props?: cdk.StackProps
) {
    super(scope, id, props);

    //create DynamoDB table
    this.table = new dynamodb.Table(this, 'SizeHistoryTable', {
      partitionKey: { 
        name: 'bucket_name', 
        type: dynamodb.AttributeType.STRING 
    },

    sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
    },

    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

    //Allow table to be deleted during demo
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //Create an index for querying the historical maximum size
    this.table.addGlobalSecondaryIndex({
      indexName: 'GlobalSizeIndex',
      
      partitionKey: {
        name: 'global_key',
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: 'total_size',
        type: dynamodb.AttributeType.NUMBER,
      },

      projectionType:  dynamodb.ProjectionType.ALL,
    });
  }
}