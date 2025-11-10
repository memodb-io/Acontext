package config

import (
	"bytes"
	"os"
	"regexp"
	"strings"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

type AppCfg struct {
	Name string
	Env  string
	Host string
	Port int
}

type RootCfg struct {
	ApiBearerToken           string
	ProjectBearerTokenPrefix string
	SecretPepper             string
}

type LogCfg struct {
	Level string
}

type DBCfg struct {
	DSN         string
	MaxOpen     int
	MaxIdle     int
	AutoMigrate bool
}

type RedisCfg struct {
	Addr     string
	Password string
	DB       int
	PoolSize int
}

type MQExchangeName struct {
	SessionMessage string
}

type MQRoutingKey struct {
	SessionMessageInsert string
}
type MQCfg struct {
	URL          string
	Queue        string
	Prefetch     int
	ExchangeName MQExchangeName
	RoutingKey   MQRoutingKey
}

type S3Cfg struct {
	Endpoint         string
	InternalEndpoint string
	Region           string
	AccessKey        string
	SecretKey        string
	Bucket           string
	UsePathStyle     bool
	PresignExpireSec int
	SSE              string
}

type Config struct {
	App      AppCfg
	Root     RootCfg
	Log      LogCfg
	Database DBCfg
	Redis    RedisCfg
	RabbitMQ MQCfg
	S3       S3Cfg
}

func setDefaults(v *viper.Viper) {
	v.SetDefault("app.port", 8029)
	v.SetDefault("root.apiBearerToken", "your-root-api-bearer-token")
	v.SetDefault("root.projectBearerTokenPrefix", "sk-ac-")
	v.SetDefault("database.dsn", "host=127.0.0.1 user=acontext password=helloworld dbname=acontext port=15432 sslmode=disable TimeZone=UTC")
	v.SetDefault("redis.addr", "127.0.0.1:16379")
	v.SetDefault("redis.password", "helloworld")
	v.SetDefault("s3.endpoint", "http://127.0.0.1:19000")
	v.SetDefault("s3.internalEndpoint", "http://127.0.0.1:19000")
	v.SetDefault("s3.region", "auto")
	v.SetDefault("s3.accessKey", "acontext")
	v.SetDefault("s3.secretKey", "helloworld")
	v.SetDefault("s3.bucket", "acontext-assets")
	v.SetDefault("rabbitmq.url", "amqp://acontext:helloworld@127.0.0.1:15672/%2F")
	v.SetDefault("rabbitmq.exchangeName.sessionMessage", "session.message")
	v.SetDefault("rabbitmq.routingKey.sessionMessageInsert", "session.message.insert")
}

func Load() (*Config, error) {
	base := viper.New()
	base.SetConfigName("config")
	base.SetConfigType("yaml")
	base.AddConfigPath("./configs")
	base.AddConfigPath(".")
	base.AutomaticEnv()
	base.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	base.SetEnvPrefix("APP") // e.g. APP_APP_PORT -> app.port

	// First assign a default value (effective regardless of whether there is a file or not)
	setDefaults(base)

	// Read the file (if any)
	if err := base.ReadInConfig(); err == nil {
		// After finding the file, manually perform one expansion of ${ENV}, and then parse it.
		path := base.ConfigFileUsed()
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		// Parse YAML to find and remove keys with undefined environment variables
		var yamlData interface{}
		if err := yaml.Unmarshal(raw, &yamlData); err == nil {
			keysToRemove := findKeysWithUndefinedEnvVars(yamlData, "")
			if len(keysToRemove) > 0 {
				removeKeys(yamlData, keysToRemove)
				// Re-marshal to YAML bytes
				if cleanedYaml, err := yaml.Marshal(yamlData); err == nil {
					raw = cleanedYaml
				}
			}
		}

		expanded := os.ExpandEnv(string(raw))

		// Load the expanded content with a new viper and copy the env settings.
		v := viper.New()
		v.SetConfigType("yaml")
		if err := v.ReadConfig(bytes.NewBufferString(expanded)); err != nil {
			return nil, err
		}
		v.AutomaticEnv()
		v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
		v.SetEnvPrefix("APP")
		setDefaults(v)

		cfg := new(Config)
		if err := v.Unmarshal(&cfg); err != nil {
			return nil, err
		}
		return cfg, nil
	}

	// No files are also allowed, using only env + default values
	cfg := new(Config)
	if err := base.Unmarshal(&cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

// removeKeys removes keys from the YAML data based on dot-separated paths
func removeKeys(data interface{}, keysToRemove []string) {
	for _, keyPath := range keysToRemove {
		parts := strings.Split(keyPath, ".")
		if len(parts) == 0 {
			continue
		}
		removeKeyRecursive(data, parts, 0)
	}
}

// removeKeyRecursive recursively removes a key from nested maps
func removeKeyRecursive(data interface{}, parts []string, index int) bool {
	if index >= len(parts) {
		return false
	}
	currentKey := parts[index]
	isLast := index == len(parts)-1

	switch m := data.(type) {
	case map[string]interface{}:
		if isLast {
			if _, ok := m[currentKey]; ok {
				delete(m, currentKey)
				return true
			}
			return false
		}
		if next, ok := m[currentKey]; ok {
			if removeKeyRecursive(next, parts, index+1) {
				// Remove parent key if nested map is now empty
				if isEmptyMap(next) {
					delete(m, currentKey)
				}
				return true
			}
		}
	case map[interface{}]interface{}:
		for k, v := range m {
			if strKey, ok := k.(string); ok && strKey == currentKey {
				if isLast {
					delete(m, k)
					return true
				}
				if removeKeyRecursive(v, parts, index+1) {
					if isEmptyMap(v) {
						delete(m, k)
					}
					return true
				}
				break
			}
		}
	}
	return false
}

// isEmptyMap checks if a value is an empty map
func isEmptyMap(v interface{}) bool {
	if m, ok := v.(map[string]interface{}); ok {
		return len(m) == 0
	}
	if m, ok := v.(map[interface{}]interface{}); ok {
		return len(m) == 0
	}
	return false
}

// findKeysWithUndefinedEnvVars recursively finds keys that contain undefined environment variables
func findKeysWithUndefinedEnvVars(data interface{}, prefix string) []string {
	var keysToRemove []string
	envVarPattern := regexp.MustCompile(`\$\{([^}]+)\}`)

	switch v := data.(type) {
	case map[string]interface{}:
		for key, value := range v {
			fullKey := key
			if prefix != "" {
				fullKey = prefix + "." + key
			}
			keysToRemove = append(keysToRemove, findKeysWithUndefinedEnvVars(value, fullKey)...)
		}
	case map[interface{}]interface{}:
		for key, value := range v {
			if keyStr, ok := key.(string); ok {
				fullKey := keyStr
				if prefix != "" {
					fullKey = prefix + "." + keyStr
				}
				keysToRemove = append(keysToRemove, findKeysWithUndefinedEnvVars(value, fullKey)...)
			}
		}
	case []interface{}:
		for i, item := range v {
			fullKey := prefix
			if prefix != "" {
				fullKey = prefix + "[" + string(rune(i+'0')) + "]"
			}
			keysToRemove = append(keysToRemove, findKeysWithUndefinedEnvVars(item, fullKey)...)
		}
	case string:
		matches := envVarPattern.FindAllStringSubmatch(v, -1)
		for _, match := range matches {
			if len(match) > 1 {
				if _, exists := os.LookupEnv(match[1]); !exists {
					if prefix != "" {
						keysToRemove = append(keysToRemove, prefix)
					}
					break
				}
			}
		}
	}

	return keysToRemove
}
