import os
import redis

def get_redis_connection():
    # 从环境变量中获取 Redis 连接信息
    redis_host = os.environ.get('REDIS_HOST', 'localhost')
    redis_port = int(os.environ.get('REDIS_PORT', 6379))
    redis_password = os.environ.get('REDIS_PASSWORD', None)

    # 创建 Redis 连接
    try:
        client = redis.StrictRedis(
            host=redis_host,
            port=redis_port,
            password=redis_password,
            decode_responses=True  # 自动解码为字符串
        )
        return client
    except redis.RedisError as e:
        print(f"Redis connection error: {e}")
        return None

def scan_redis_keys(client):
    cursor = 0
    keys = []

    try:
        # 使用 SCAN 命令遍历所有键
        while True:
            cursor, partial_keys = client.scan(cursor=cursor)
            keys.extend(partial_keys)
            if cursor == 0:  # 如果游标为 0，说明遍历完成
                break
    except redis.RedisError as e:
        print(f"Redis error: {e}")

    return keys

def delete_keys(client, keys_to_delete):
    for key in keys_to_delete:
        try:
            if client.exists(key):
                client.delete(key)
                print(f"Deleted key: {key}")
            else:
                print(f"Key does not exist: {key}")
        except redis.RedisError as e:
            print(f"Error deleting key {key}: {e}")

if __name__ == '__main__':
    redis_client = get_redis_connection()
    if redis_client:
        keys = scan_redis_keys(redis_client)
        print("Found keys:")
        for key in keys:
            print(key)  # 直接打印字符串

        # 要删除的键
        keys_to_delete = [
            'CACHE_KEY_LP_walletSecrets_9006',
            'CACHE_KEY_walletSecrets_501'
        ]
        
        # 删除指定键
        delete_keys(redis_client, keys_to_delete)