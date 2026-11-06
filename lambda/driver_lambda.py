
import boto3
import time
import os
import urllib.request
from boto3.dynamodb.conditions import Key

# AWS clients and resources
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# Get resource names from CDK environment variables
table = dynamodb.Table(os.environ["TABLE_NAME"])
bucket_name = os.environ["BUCKET_NAME"]
plotting_api_url = os.environ["PLOTTING_API_URL"]


def wait_for_size(expected_size, expected_count, since):
    # Allow up to 3 seconds for S3 event processing
    deadline = time.monotonic() + 6

    while time.monotonic() < deadline:

        # Query new measurements for this bucket
        response = table.query(
            KeyConditionExpression=(
                Key("bucket_name").eq(bucket_name) &
                Key("timestamp").gte(since)
            ),
            ConsistentRead=True
        )

        # Find the expected bucket state
        for item in response["Items"]:
            if (
                int(item["total_size"]) == expected_size
                and int(item["object_count"]) == expected_count
            ):
                print(f"Recorded: {expected_size} bytes")
                return int(item["timestamp"])

        time.sleep(0.25)

    raise RuntimeError(
        f"Size {expected_size} was not recorded in time"
    )


def lambda_handler(event, context):

    # Start with an empty S3 bucket
    response = s3.list_objects_v2(
        Bucket=bucket_name,
        MaxKeys=1
    )

    if response.get("Contents"):
        raise RuntimeError(
            "Empty the S3 bucket before testing"
        )

    start = int(time.time() * 1000)

    # 1. Create assignment1.txt
    s3.put_object(
        Bucket=bucket_name,
        Key="assignment1.txt",
        Body=b"Empty Assignment 1"
    )

    first = wait_for_size(18, 1, start)
    time.sleep(0.5)

    # 2. Update assignment1.txt
    marker = int(time.time() * 1000)

    s3.put_object(
        Bucket=bucket_name,
        Key="assignment1.txt",
        Body=b"Empty Assignment 2222222222"
    )

    wait_for_size(27, 1, marker)
    time.sleep(0.5)

    # 3. Delete assignment1.txt
    marker = int(time.time() * 1000)

    s3.delete_object(
        Bucket=bucket_name,
        Key="assignment1.txt"
    )

    wait_for_size(0, 0, marker)
    time.sleep(0.5)

    # 4. Create assignment2.txt
    marker = int(time.time() * 1000)

    s3.put_object(
        Bucket=bucket_name,
        Key="assignment2.txt",
        Body=b"33"
    )

    wait_for_size(2, 1, marker)

    # Make sure measurements fit in the plot window
    elapsed = int(time.time() * 1000) - first

    if elapsed >= 8500:
        raise RuntimeError(
            "Measurements took too long for the 10-second plot"
        )

    # 5. Call API Gateway to generate the plot
    with urllib.request.urlopen(
        plotting_api_url,
        timeout=15
    ) as response:
        body = response.read().decode()
        print("Plotting API response:", body)

    return {
        "statusCode": 200,
        "body": "Driver completed successfully"
    }
