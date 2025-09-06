# Kubernetes High Availability and Scaling Guide

This guide explains how to deploy Memos in a Kubernetes environment with proper session management for horizontal scaling and high availability.

## Description

Till v0.25.0, Memos had limitations when deployed as multiple pods in Kubernetes:

1. **Session Isolation**: Each pod maintained its own in-memory session cache, causing authentication inconsistencies when load balancers directed users to different pods.

2. **SSO Redirect Issues**: OAuth2 authentication flows would fail when:
   - User initiated login on Pod A
   - OAuth provider redirected back to Pod B
   - Pod B couldn't validate the session created by Pod A

3. **Cache Inconsistency**: Session updates on one pod weren't reflected on other pods until cache expiry (10+ minutes).

## Solution Overview

The solution implements a **distributed cache system** with the following features:

- **Redis-backed shared cache** for session synchronization across pods
- **Hybrid cache strategy** with local cache fallback for resilience
- **Event-driven cache invalidation** for real-time consistency
- **Backward compatibility** - works without Redis for single-pod deployments

## Architecture

### Production Architecture with External Services

```
┌─────────────────────────────────────────────────────────────┐
│                Load Balancer (Ingress)                     │
└─────────────┬─────────────┬─────────────┬─────────────────┘
              │             │             │
         ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
         │  Pod A  │   │  Pod B  │   │  Pod C  │
         │         │   │         │   │         │
         └────┬────┘   └────┬────┘   └────┬────┘
              │             │             │
              └─────────────┼─────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
    ┌─────────▼─────────┐   │   ┌─────────▼─────────┐
    │  Redis Cache      │   │   │  ReadWriteMany    │
    │  (ElastiCache)    │   │   │  Storage (EFS)    │
    │  Distributed      │   │   │  Shared Files     │
    │  Sessions         │   │   │  & Attachments    │
    └───────────────────┘   │   └───────────────────┘
                            │
                   ┌────────▼────────┐
                   │  External DB    │
                   │  (RDS/Cloud SQL)│
                   │  Multi-AZ HA    │
                   └─────────────────┘
```

## Configuration

### Environment Variables

Set these environment variables for Redis integration:

```bash
# Required: Redis connection URL
MEMOS_REDIS_URL=redis://redis-service:6379

# Optional: Redis configuration
MEMOS_REDIS_POOL_SIZE=20                    # Connection pool size
MEMOS_REDIS_DIAL_TIMEOUT=5s                 # Connection timeout
MEMOS_REDIS_READ_TIMEOUT=3s                 # Read timeout  
MEMOS_REDIS_WRITE_TIMEOUT=3s                # Write timeout
MEMOS_REDIS_KEY_PREFIX=memos                # Key prefix for isolation
```

### Fallback Behavior

- **Redis Available**: Uses hybrid cache (Redis + local fallback)
- **Redis Unavailable**: Falls back to local-only cache (single pod)
- **Redis Failure**: Gracefully degrades to local cache until Redis recovers

## Deployment Options

### 1. Development/Testing Deployment

For testing with self-hosted database:

```bash
kubectl apply -f kubernetes-example.yaml
```

This creates:
- Self-hosted PostgreSQL with persistent storage
- Redis deployment with persistence  
- Memos deployment with 3 replicas
- ReadWriteMany shared storage
- Load balancer service and ingress
- HorizontalPodAutoscaler

### 2. Production Deployment (Recommended)

For production with managed services:

```bash
# First, set up your managed database and Redis
# Then apply the production configuration:
kubectl apply -f kubernetes-production.yaml
```

This provides:
- **External managed database** (AWS RDS, Google Cloud SQL, Azure Database)
- **External managed Redis** (ElastiCache, Google Memorystore, Azure Cache)
- **ReadWriteMany storage** for shared file access
- **Pod Disruption Budget** for high availability
- **Network policies** for security
- **Advanced health checks** and graceful shutdown
- **Horizontal Pod Autoscaler** with intelligent scaling

### 3. Cloud Provider Specific Examples

#### AWS Deployment with RDS and ElastiCache

```bash
# 1. Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier memos-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username memos \
  --master-user-password YourSecurePassword \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name memos-subnet-group \
  --multi-az \
  --backup-retention-period 7

# 2. Create ElastiCache Redis cluster
aws elasticache create-replication-group \
  --replication-group-id memos-redis \
  --description "Memos Redis cluster" \
  --node-type cache.t3.medium \
  --num-cache-clusters 2 \
  --port 6379

# 3. Update secrets with actual endpoints
kubectl create secret generic memos-secrets \
  --from-literal=database-dsn="postgres://memos:password@memos-db.xxxxxx.region.rds.amazonaws.com:5432/memos?sslmode=require"

# 4. Update ConfigMap with ElastiCache endpoint
kubectl create configmap memos-config \
  --from-literal=MEMOS_REDIS_URL="redis://memos-redis.xxxxxx.cache.amazonaws.com:6379"

# 5. Deploy Memos
kubectl apply -f kubernetes-production.yaml
```

#### Google Cloud Deployment

```bash
# 1. Create Cloud SQL instance
gcloud sql instances create memos-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --backup \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=06

# 2. Create Memorystore Redis instance  
gcloud redis instances create memos-redis \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_7_0

# 3. Deploy with Cloud SQL Proxy (secure connection)
kubectl apply -f kubernetes-production.yaml
```

#### Azure Deployment

```bash
# 1. Create Azure Database for PostgreSQL
az postgres server create \
  --resource-group memos-rg \
  --name memos-db \
  --location eastus \
  --admin-user memos \
  --admin-password YourSecurePassword \
  --sku-name GP_Gen5_2 \
  --version 15

# 2. Create Azure Cache for Redis
az redis create \
  --resource-group memos-rg \
  --name memos-redis \
  --location eastus \
  --sku Standard \
  --vm-size C2

# 3. Deploy Memos
kubectl apply -f kubernetes-production.yaml
```

## Monitoring and Troubleshooting

### Cache Status Endpoint

Monitor cache health via the admin API:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  https://your-memos-instance.com/api/v1/cache/status
```

Response includes:
```json
{
  "user_cache": {
    "type": "hybrid",
    "size": 150,
    "local_size": 45,
    "redis_size": 150,
    "redis_available": true,
    "pod_id": "abc12345",
    "event_queue_size": 0
  },
  "user_setting_cache": {
    "type": "hybrid",
    "size": 89,
    "redis_available": true,
    "pod_id": "abc12345"
  }
}
```

### Health Checks

Monitor these indicators:

1. **Redis Connectivity**: Check `redis_available` in cache status
2. **Event Queue**: Monitor `event_queue_size` for backlog
3. **Cache Hit Rates**: Compare `local_size` vs `redis_size`
4. **Pod Distribution**: Verify requests distributed across pods

### Common Issues

#### Problem: Authentication fails after login
**Symptoms**: Users can log in but subsequent requests fail
**Cause**: Session created on one pod, request handled by another
**Solution**: Verify Redis configuration and connectivity

#### Problem: High cache misses
**Symptoms**: Poor performance, frequent database queries  
**Cause**: Redis unavailable or misconfigured
**Solution**: Check Redis logs and connection settings

#### Problem: Session persistence issues
**Symptoms**: Users logged out unexpectedly
**Cause**: Redis data loss or TTL issues
**Solution**: Enable Redis persistence and verify TTL settings

## Performance Considerations

### External Database Requirements

**PostgreSQL Sizing**:
- **Small (< 100 users)**: 2 CPU, 4GB RAM, 100GB storage
- **Medium (100-1000 users)**: 4 CPU, 8GB RAM, 500GB storage  
- **Large (1000+ users)**: 8+ CPU, 16GB+ RAM, 1TB+ storage

**Redis Sizing**:
- **Memory**: Base 50MB + (2KB × active sessions) + (1KB × cached settings)
- **Small**: 1GB (handles ~500K sessions)
- **Medium**: 2-4GB (handles 1-2M sessions)
- **Large**: 8GB+ (handles 4M+ sessions)

**Connection Pool Sizing**:
- Database: Start with `max_connections = 20 × number_of_pods`
- Redis: Start with `pool_size = 10 × number_of_pods`

### Scaling Guidelines

**Horizontal Pod Autoscaler**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: memos-hpa
spec:
  scaleTargetRef:
    kind: Deployment
    name: memos
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

**Recommended Scaling**:
- **Small (< 100 users)**: 2-3 pods, managed Redis, managed DB
- **Medium (100-1000 users)**: 3-8 pods, Redis cluster, Multi-AZ DB
- **Large (1000+ users)**: 8-20 pods, Redis cluster, read replicas
- **Enterprise**: 20+ pods, Redis cluster, DB sharding

## Security Considerations

### Redis Security

1. **Network Isolation**: Deploy Redis in private network
2. **Authentication**: Use Redis AUTH if exposed
3. **Encryption**: Enable TLS for Redis connections
4. **Access Control**: Restrict Redis access to Memos pods only

Example with Redis AUTH:
```bash
MEMOS_REDIS_URL=redis://:password@redis-service:6379
```

### Session Security

- Sessions remain encrypted in transit
- Redis stores serialized session data
- Session TTL honored across all pods
- Admin-only access to cache status endpoint

## Migration Guide

### From Single Pod to Multi-Pod

#### Option 1: Gradual Migration (Recommended)
1. **Setup External Services**: Deploy managed database and Redis
2. **Migrate Data**: Export/import existing database to managed service
3. **Update Configuration**: Add Redis and external DB environment variables
4. **Rolling Update**: Update Memos deployment with new config
5. **Scale Up**: Increase replica count gradually
6. **Verify**: Check cache status and session persistence

#### Option 2: Blue-Green Deployment
1. **Setup New Environment**: Complete production setup in parallel
2. **Data Migration**: Sync data to new environment
3. **DNS Cutover**: Switch traffic to new environment
4. **Cleanup**: Remove old environment after verification

### Rollback Strategy

If issues occur:
1. **Scale Down**: Reduce to single pod
2. **Remove Redis Config**: Environment variables
3. **Restart**: Pods will use local cache only

## Best Practices

1. **Resource Limits**: Set appropriate CPU/memory limits
2. **Health Checks**: Implement readiness/liveness probes  
3. **Monitoring**: Track cache metrics and Redis health
4. **Backup**: Regular Redis data backups
5. **Testing**: Verify session persistence across pod restarts
6. **Gradual Scaling**: Increase replicas incrementally

## Additional Resources

- [Redis Kubernetes Operator](https://github.com/spotahome/redis-operator)
- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Session Affinity vs Distributed Sessions](https://kubernetes.io/docs/concepts/services-networking/service/#session-stickiness)

## Support

For issues or questions:
1. Check cache status endpoint first
2. Review Redis and pod logs
3. Verify environment variable configuration
4. Test with single pod to isolate issues

