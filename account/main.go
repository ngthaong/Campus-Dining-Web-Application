package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"

	"github.com/aswearingen91/account-service/internal/config"
	"github.com/aswearingen91/account-service/internal/database"
	"github.com/aswearingen91/account-service/internal/handlers"
	"github.com/aswearingen91/account-service/internal/repositories"
	"github.com/aswearingen91/account-service/internal/router"
	"github.com/aswearingen91/account-service/internal/services"
)

// corsMiddleware wraps an http.Handler to add CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {

	//
	// ---- Parse CLI flags ----
	//
	flags := parse_flags()

	//
	// ---- Load config ----
	//
	cfg := load_config(flags)

	//
	// ---- Connect to database ----
	//
	db := database.Connect(cfg)
	log.Println("Connected to PostgreSQL.")

	//
	// ---- Initialize repositories ----
	//
	userRepo := repositories.NewUserRepository(db)

	//
	// ---- Initialize services ----
	//
	userService := services.NewUserService(userRepo)

	//
	// ---- Initialize handlers ----
	//
	userHandler := handlers.NewUserHandler(userService, cfg.JWTSecret)

	//
	// ---- Set up router ----
	//
	mux := router.NewRouter(userHandler)

	//
	// ---- Wrap with CORS middleware ----
	//
	handler := corsMiddleware(mux)

	//
	// ---- Start server ----
	//
	serverPort := cfg.Port
	if serverPort == "" {
		serverPort = "8080"
	}

	log.Printf("Server listening on :%s", serverPort)
	log.Fatal(http.ListenAndServe(":"+serverPort, handler))
}

func parse_flags() *CliFlags {
	flags := &CliFlags{}
	flag.StringVar(&flags.ConfigPath, "config", "./config.json", "Path to config file")
	flag.Parse()

	return flags
}

func load_config(flags *CliFlags) *config.Config {
	cfg := &config.Config{}
	fileProvided := flags.ConfigPath != "./config.json"

	if _, err := os.Stat(flags.ConfigPath); err != nil {
		if fileProvided {
			log.Fatalf("Failed to load config file at %s: %v", flags.ConfigPath, err)
		} else {
			log.Printf("No config.json found at default path (%s). Continuing with env vars only.", flags.ConfigPath)
		}
	} else {
		file, err := os.Open(flags.ConfigPath)
		if err != nil {
			log.Fatalf("Failed to open config file %s: %v", flags.ConfigPath, err)
		}
		defer file.Close()

		if err := json.NewDecoder(file).Decode(cfg); err != nil {
			log.Fatalf("Failed to parse config file %s: %v", flags.ConfigPath, err)
		}
	}

	return cfg
}

type CliFlags struct {
	ConfigPath string
}
