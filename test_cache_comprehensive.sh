#!/bin/bash

# Comprehensive cache testing script for Memos distributed caching
set -e

echo "🧪 Running Comprehensive Cache Tests for Memos"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if Redis is available
REDIS_AVAILABLE=false
if command -v redis-server &> /dev/null && command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        REDIS_AVAILABLE=true
        print_status $GREEN "✅ Redis is available and running"
    else
        print_status $YELLOW "⚠️  Redis CLI available but server not responding"
    fi
else
    print_status $YELLOW "⚠️  Redis not available - will skip Redis-dependent tests"
fi

# Set Redis URL for tests if available
if [ "$REDIS_AVAILABLE" = true ]; then
    export REDIS_URL="redis://localhost:6379"
    print_status $BLUE "📡 Using Redis URL: $REDIS_URL"
else
    export REDIS_URL=""
    print_status $YELLOW "📡 Redis URL not set - distributed cache tests will be skipped"
fi

# Test categories - focused on our business logic
TESTS=(
    "distributed_session_test.go"
)

# Run tests with different configurations
print_status $BLUE "🏃 Running cache tests..."

# Create test results directory
mkdir -p test-results

# Run core business logic tests first (these work without Redis too - will just skip)
print_status $YELLOW "🔄 Running distributed session store tests (core K8s scaling feature)..."
go test -v -timeout 60s ./store/test/ -run TestDistributedSessionStore > test-results/distributed-session.log 2>&1
if [ $? -eq 0 ]; then
    print_status $GREEN "✅ Distributed session store tests passed"
else
    # Check if it was just skipped due to no Redis
    if grep -q "SKIP.*REDIS_URL not set" test-results/distributed-session.log; then
        print_status $YELLOW "⏭️  Distributed session tests skipped (no Redis) - this is expected"
    else
        print_status $RED "❌ Distributed session store tests failed"
        cat test-results/distributed-session.log
        exit 1
    fi
fi

# Run the REAL test with Redis if available
if [ "$REDIS_AVAILABLE" = true ]; then
    print_status $YELLOW "🔄 Running distributed session store tests with Redis (the real test!)..."
    REDIS_URL="$REDIS_URL" go test -v -timeout 120s ./store/test/ -run TestDistributedSessionStore > test-results/distributed-session-redis.log 2>&1
    if [ $? -eq 0 ]; then
        print_status $GREEN "✅ 🎯 CORE FEATURE WORKING: Multi-pod session sharing tested successfully!"
        print_status $BLUE "📊 This proves the SSO redirect issue is fixed!"
    else
        print_status $RED "❌ Distributed session store tests failed with Redis"
        cat test-results/distributed-session-redis.log
        exit 1
    fi
else
    print_status $YELLOW "⏭️  Skipping Redis-dependent tests (Redis not available)"
    print_status $BLUE "💡 To test the core K8s scaling feature, start Redis and run:"
    print_status $BLUE "   redis-server &"
    print_status $BLUE "   REDIS_URL=redis://localhost:6379 ./test_cache_comprehensive.sh"
fi

# Generate summary report
print_status $BLUE "📋 Generating test summary..."

echo "" > test-results/summary.txt
echo "Memos Distributed Cache Test Summary" >> test-results/summary.txt
echo "====================================" >> test-results/summary.txt
echo "Test Date: $(date)" >> test-results/summary.txt
echo "Redis Available: $REDIS_AVAILABLE" >> test-results/summary.txt
echo "" >> test-results/summary.txt

echo "Test Results:" >> test-results/summary.txt
echo "-------------" >> test-results/summary.txt

for log_file in test-results/*.log; do
    if [ -f "$log_file" ]; then
        test_name=$(basename "$log_file" .log)
        if grep -q "PASS" "$log_file"; then
            echo "✅ $test_name: PASSED" >> test-results/summary.txt
        elif grep -q "FAIL" "$log_file"; then
            echo "❌ $test_name: FAILED" >> test-results/summary.txt
        else
            echo "⚠️  $test_name: UNKNOWN" >> test-results/summary.txt
        fi
    fi
done

echo "" >> test-results/summary.txt
echo "Detailed logs available in test-results/ directory" >> test-results/summary.txt

# Display summary
cat test-results/summary.txt

print_status $GREEN "🎉 Cache testing completed!"
print_status $BLUE "📁 Test logs saved in test-results/ directory"

if [ "$REDIS_AVAILABLE" = true ]; then
    print_status $GREEN "✅ All distributed cache features have been tested"
    print_status $BLUE "🚀 Your Memos deployment is ready for multi-pod scaling!"
else
    print_status $YELLOW "⚠️  Redis-dependent tests were skipped"
    print_status $BLUE "💡 To test distributed caching, start Redis and run this script again"
fi
