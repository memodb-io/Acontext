set -e
rm -rf ./db/dev_data
rm -rf ./db/dev_redis
rm -rf ./db/dev_rabbitmq
rm -rf ./db/dev_s3
DATABASE_LOCATION="./db/dev_data" \
REDIS_LOCATION="./db/dev_redis" \
RABBITMQ_LOCATION="./db/dev_rabbitmq" \
S3_LOCATION="./db/dev_s3" \
JAEGER_STORAGE_LOCATION="./db/dev_jaeger" \
docker compose up acontext-server-pg acontext-server-redis acontext-server-rabbitmq acontext-server-seaweedfs-setup acontext-server-seaweedfs acontext-server-jaeger
rm -rf ./db/dev_data
rm -rf ./db/dev_redis
rm -rf ./db/dev_rabbitmq
rm -rf ./db/dev_s3
rm -rf ./db/dev_jaeger