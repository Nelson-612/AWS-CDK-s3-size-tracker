import boto3
import time
import os

#S3 resource
s3 = boto3.resource("s3")

#DynamoDB resource
dynamodb = boto3.resource("dynamodb")

#History table
table = dynamodb.Table(os.environ["TABLE_NAME"])

def lambda_handler(event, context):
    #Get bucket name
    bucket_name = event["Records"][0]["s3"]["bucket"]["name"]

    #Get bucket
    bucket = s3.Bucket(bucket_name)

    #Initial value
    total_size = 0
    object_count = 0

    #List objects
    for obj in bucket.objects.all():
        total_size += obj.size
        object_count += 1

    #Get timestamp
    timestamp = int(time.time() * 1000)

    #Save history
    table.put_item(
        Item={
            "bucket_name": bucket_name,
            "timestamp": timestamp,
            "total_size": total_size,
            "object_count": object_count,
            "global_key": "ALL_BUCKETS"
        }
    )

    #Print result
    print(f"Bucket: {bucket_name}, Total Size: {total_size} bytes, Object Count: {object_count}")

    return {
        "statusCode": 200,
        "body": "Size history saved successfully"
    }