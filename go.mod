module github.com/usememos/memos

go 1.27.4

require (
	cel.dev/cel-go v0.33.4
	connectrpc.com/connect v1.21.1
	github.com/at-wat/ebml-go v0.19.4
	github.com/aws/aws-sdk-go-v2 v1.48.1
	github.com/aws/aws-sdk-go-v2/config v1.33.22
	github.com/aws/aws-sdk-go-v2/credentials v1.21.4
	github.com/aws/aws-sdk-go-v2/service/s3 v1.116.1
	github.com/aws/smithy-go v1.28.10
	github.com/disintegration/imaging v1.6.2
	github.com/go-sql-driver/mysql v1.10.2
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/google/jsonschema-go v0.4.3
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.34.0
	github.com/johannesboyne/gofakes3 v1.3.0
	github.com/joho/godotenv v1.5.1
	github.com/lib/pq v1.12.3
	github.com/lithammer/shortuuid/v4 v4.3.0
	github.com/moby/moby/api v1.57.0
	github.com/modelcontextprotocol/go-sdk v1.8.0
	github.com/openai/openai-go/v3 v3.108.0
	github.com/pion/opus v0.1.0
	github.com/pkg/errors v0.9.1
	github.com/spf13/cobra v1.10.2
	github.com/spf13/viper v1.21.0
	github.com/stretchr/testify v1.12.1
	github.com/testcontainers/testcontainers-go v0.45.0
	github.com/testcontainers/testcontainers-go/modules/mariadb v0.45.0
	github.com/testcontainers/testcontainers-go/modules/mysql v0.45.0
	github.com/testcontainers/testcontainers-go/modules/postgres v0.45.0
	github.com/yuin/goldmark v1.8.7
	golang.org/x/crypto v0.59.0
	golang.org/x/mod v0.43.0
	golang.org/x/net v0.63.0
	golang.org/x/oauth2 v0.38.0
	golang.org/x/sync v0.25.0
	golang.org/x/text v0.44.0
	google.golang.org/genai v1.79.1
	google.golang.org/genproto v0.0.0-20261123191846-1e707ab9fbc2
	google.golang.org/genproto/googleapis/api v0.0.0-20261123191846-1e707ab9fbc2
	google.golang.org/genproto/googleapis/rpc v0.0.0-20261123191846-1e707ab9fbc2
	google.golang.org/grpc v1.85.0
	google.golang.org/protobuf v1.36.12
	gopkg.in/yaml.v3 v3.0.1
	modernc.org/sqlite v1.63.0
)

require (
	cel.dev/expr v0.25.3 // indirect
	cloud.google.com/go v0.123.0 // indirect
	cloud.google.com/go/auth v0.23.1 // indirect
	cloud.google.com/go/compute/metadata v0.9.0 // indirect
	dario.cat/mergo v1.0.2 // indirect
	filippo.io/edwards25519 v1.2.0 // indirect
	github.com/Azure/go-ansiterm v0.0.0-20261006220739-8c912ac31dd4 // indirect
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.28 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.20.10 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.5.13 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.8.13 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.5.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.26 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.11.14 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.14.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.20.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.14.1 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.39.6 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.44.6 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.53.1 // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/coder/websocket v1.8.15 // indirect
	github.com/containerd/errdefs v1.0.0 // indirect
	github.com/containerd/errdefs/pkg v0.3.0 // indirect
	github.com/containerd/log v0.1.0 // indirect
	github.com/containerd/platforms v0.2.1 // indirect
	github.com/cpuguy83/dockercfg v0.3.2 // indirect
	github.com/distribution/reference v0.6.0 // indirect
	github.com/docker/go-connections v0.8.2 // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dustin/go-humanize v1.1.0 // indirect
	github.com/ebitengine/purego v0.10.2 // indirect
	github.com/felixge/httpsnoop v1.1.0 // indirect
	github.com/fsnotify/fsnotify v1.10.1 // indirect
	github.com/go-logr/logr v1.4.4 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-viper/mapstructure/v2 v2.5.0 // indirect
	github.com/google/go-cmp v0.7.0 // indirect
	github.com/google/s2a-go v0.1.9 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.21 // indirect
	github.com/googleapis/gax-go/v2 v2.23.0 // indirect
	github.com/gorilla/websocket v1.5.3 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/klauspost/compress v1.19.2 // indirect
	github.com/lufia/plan9stats v0.0.0-20260802145828-341c2f0c90b5 // indirect
	github.com/magiconair/properties v1.18.12 // indirect
	github.com/mattn/go-isatty v0.0.24 // indirect
	github.com/moby/docker-image-spec v1.3.1 // indirect
	github.com/moby/go-archive v0.3.3 // indirect
	github.com/moby/moby/client v0.6.2 // indirect
	github.com/moby/patternmatcher v0.6.1 // indirect
	github.com/moby/sys/sequential v0.7.0 // indirect
	github.com/moby/sys/user v0.4.1 // indirect
	github.com/moby/sys/userns v0.2.0 // indirect
	github.com/moby/term v0.5.2 // indirect
	github.com/ncruces/go-strftime v1.1.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.1 // indirect
	github.com/pelletier/go-toml/v2 v2.4.3 // indirect
	github.com/power-devops/perfstat v0.0.0-20260805114148-88456608a4f6 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/ryszard/goskiplist v0.0.0-20150312221310-2dfbae5fcf46 // indirect
	github.com/sagikazarmark/locafero v0.12.0 // indirect
	github.com/segmentio/asm v1.2.1 // indirect
	github.com/segmentio/encoding v0.5.4 // indirect
	github.com/shirou/gopsutil/v4 v4.26.7 // indirect
	github.com/sirupsen/logrus v1.10.0 // indirect
	github.com/spf13/afero v1.15.0 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/spf13/pflag v1.0.10 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	github.com/tidwall/gjson v1.20.1 // indirect
	github.com/tidwall/match v1.2.0 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/tidwall/sjson v1.2.5 // indirect
	github.com/tklauser/go-sysconf v0.4.0 // indirect
	github.com/tklauser/numcpus v0.12.0 // indirect
	github.com/yosida95/uritemplate/v3 v3.0.2 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.70.0 // indirect
	go.opentelemetry.io/otel v1.45.0 // indirect
	go.opentelemetry.io/otel/metric v1.45.0 // indirect
	go.opentelemetry.io/otel/trace v1.45.0 // indirect
	go.shabbyrobe.org/gocovmerge v0.0.0-20230507111327-fa4f82cfbf4d // indirect
	go.yaml.in/yaml/v3 v3.0.5 // indirect
	golang.org/x/exp v0.0.0-20261113113407-e3970619a1a4 // indirect
	golang.org/x/image v0.45.0 // indirect
	golang.org/x/sys v0.50.0 // indirect
	golang.org/x/time v0.15.0 // indirect
	golang.org/x/tools v0.52.1-0.20261106145633-d407941a339a // indirect
	google.golang.org/api v0.293.0 // indirect
	modernc.org/libc v1.80.1 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.12.1 // indirect
)
