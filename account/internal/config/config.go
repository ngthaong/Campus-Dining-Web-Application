package config

import (
	"encoding/json"
	"log"
	"os"
)

type Config struct {
	PostgresHost     string `json:"postgres_host"`
	PostgresPort     string `json:"postgres_port"`
	PostgresUser     string `json:"postgres_user"`
	PostgresPassword string `json:"postgres_password"`
	PostgresDB       string `json:"postgres_db"`
	PostgresSSLMode  string `json:"postgres_sslmode"`
	JWTSecret        string `json:"jwt_secret"`

	Port string `json:"port"` // NEW — HTTP server port
}

// LoadConfig loads configuration from (in order):
// 1. Defaults
// 2. JSON file (optional)
// 3. Environment variables (override)
func LoadConfig(jsonPath string) *Config {
	cfg := &Config{
		PostgresHost:     "localhost",
		PostgresPort:     "5432",
		PostgresUser:     "postgres",
		PostgresPassword: "postgres",
		PostgresDB:       "account",
		PostgresSSLMode:  "disable",

		Port: "8080", // default server port
	}

	// 1. Load JSON if provided
	if jsonPath != "" {
		data, err := os.ReadFile(jsonPath)
		if err != nil {
			log.Printf("Warning: could not read config file %s: %v", jsonPath, err)
		} else {
			if err := json.Unmarshal(data, cfg); err != nil {
				log.Fatalf("Invalid JSON config file: %v", err)
			}
		}
	}

	// 2. Override with environment variables (if set)
	overrideEnv(&cfg.PostgresHost, "POSTGRES_HOST")
	overrideEnv(&cfg.PostgresPort, "POSTGRES_PORT")
	overrideEnv(&cfg.PostgresUser, "POSTGRES_USER")
	overrideEnv(&cfg.PostgresPassword, "POSTGRES_PASSWORD")
	overrideEnv(&cfg.PostgresDB, "POSTGRES_DB")
	overrideEnv(&cfg.PostgresSSLMode, "POSTGRES_SSLMODE")

	overrideEnv(&cfg.Port, "PORT") // NEW — override HTTP port
	overrideEnv(&cfg.JWTSecret, "JWT_SECRET")

	return cfg
}

func overrideEnv(target *string, envName string) {
	if val := os.Getenv(envName); val != "" {
		*target = val
	}
}
