package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/aswearingen91/account-service/internal/models"
	"github.com/aswearingen91/account-service/internal/services"
	"github.com/golang-jwt/jwt/v5"
)

// UserHandler handles HTTP endpoints for user-related actions.
type UserHandler struct {
	svc       services.UserService
	jwtSecret []byte
}

// NewUserHandler constructs a new UserHandler.
func NewUserHandler(svc services.UserService, jwtSecret string) *UserHandler {
	return &UserHandler{
		svc:       svc,
		jwtSecret: []byte(jwtSecret),
	}
}

// ------------------------------------------------------------
// CreateUser handles POST /user
// Expects JSON body: {"username":"...", "password":"..."}
// ------------------------------------------------------------
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	log.Println("CreateUser called")

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("CreateUser: invalid request body: %v\n", err)
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	user, err := h.svc.CreateUser(body.Username, body.Password)
	if err != nil {
		log.Printf("CreateUser: failed to create user %s: %v\n", body.Username, err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("CreateUser: user %s created successfully\n", body.Username)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(user)
}

// ------------------------------------------------------------
// GetUser handles GET /user?id=123
// ------------------------------------------------------------
func (h *UserHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	log.Println("GetUser called")

	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		log.Println("GetUser: missing id parameter")
		http.Error(w, "missing id parameter", http.StatusBadRequest)
		return
	}

	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		log.Printf("GetUser: invalid id parameter: %v\n", err)
		http.Error(w, "invalid id parameter", http.StatusBadRequest)
		return
	}

	id := uint(id64)
	user, err := h.svc.GetUser(id)
	if err != nil {
		log.Printf("GetUser: user with ID %d not found\n", id)
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	log.Printf("GetUser: returning user ID %d\n", id)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(user)
}

// ------------------------------------------------------------
// GetUserByUsername handles GET /user?username=alice
// ------------------------------------------------------------
func (h *UserHandler) GetUserByUsername(w http.ResponseWriter, r *http.Request) {
	log.Println("GetUserByUsername called")

	username := r.URL.Query().Get("username")
	if username == "" {
		log.Println("GetUserByUsername: missing username parameter")
		http.Error(w, "missing username parameter", http.StatusBadRequest)
		return
	}

	user, err := h.svc.GetUserByUsername(username)
	if err != nil || user == nil {
		log.Printf("GetUserByUsername: user %s not found\n", username)
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	log.Printf("GetUserByUsername: returning user %s\n", username)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(user)
}

// ------------------------------------------------------------
// Login handles POST /user/login
// Returns: { "token": "...", "message": "Logged in" }
// ------------------------------------------------------------
func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	log.Println("Login called")

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	w.Header().Set("Content-Type", "application/json")

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		log.Printf("Login: invalid request body: %v\n", err)
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid request body",
		})
		return
	}

	if err := h.svc.Login(body.Username, body.Password); err != nil {
		log.Printf("Login: failed login attempt for user %s\n", body.Username)
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Login failed. Check your credentials.",
		})
		return
	}
	user, err := h.svc.GetUserByUsername(body.Username)
	if err != nil {
		log.Printf("Login: user %s not found\n", body.Username)
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Could not user id to generate token",
		})
		return
	}
	tokenString, err := h.generateJWT(user)
	if err != nil {
		log.Printf("Login: could not generate token for user %s: %v\n", body.Username, err)
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "Could not generate token",
		})
		return
	}

	log.Printf("Login: user %s logged in successfully\n", body.Username)
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"token":   tokenString,
		"message": "Logged in successfully",
	})
}

// generateJWT creates a JWT token for a given username
func (h *UserHandler) generateJWT(user *models.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"username": user.Username,
		"user_id":  user.ID,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	return token.SignedString(h.jwtSecret)
}
