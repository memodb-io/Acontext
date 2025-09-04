package config

import (
	"bytes"
	"os"
	"strings"

	"github.com/spf13/viper"
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

func setDefaults(v *viper.Viper) {
	v.SetDefault("app.host", "0.0.0.0")
	v.SetDefault("app.port", 8080)
	v.SetDefault("root.apiBearerToken", "acontext")
	v.SetDefault("root.projectBearerTokenPrefix", "sk-proj-")
	v.SetDefault("log.level", "info")
	v.SetDefault("redis.poolSize", 10)
	v.SetDefault("s3.region", "auto")
	v.SetDefault("s3.usePathStyle", true)
	v.SetDefault("s3.presignExpireSec", 900)
	v.SetDefault("rabbitmq.prefetch", 10)
	v.SetDefault("rabbitmq.exchangeName.sessionMessage", "session.message")
	v.SetDefault("rabbitmq.routingKey.sessionMessageInsert", "session.message.insert")
}
