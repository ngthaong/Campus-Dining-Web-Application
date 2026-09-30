package router

import (
	"net/http"

	"github.com/aswearingen91/account-service/internal/handlers"
)

func NewRouter(userHandler *handlers.UserHandler) *http.ServeMux {
	mux := http.NewServeMux()

	// ------------------------
	// User routes
	// ------------------------

	// /user - create (POST) or get (GET)
	mux.Handle("/user", cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			// Create user
			userHandler.CreateUser(w, r)
		case http.MethodGet:
			// Get user by id or username
			if r.URL.Query().Has("id") {
				userHandler.GetUser(w, r)
				return
			}
			if r.URL.Query().Has("username") {
				userHandler.GetUserByUsername(w, r)
				return
			}
			http.Error(w, "missing id or username parameter", http.StatusBadRequest)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	// /user/login - login (POST)
	mux.Handle("/user/login", cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		userHandler.Login(w, r)
	})))

	return mux
}

// CORS middleware
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
