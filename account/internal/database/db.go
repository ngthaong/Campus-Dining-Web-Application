package database

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/aswearingen91/account-service/internal/config"
	"github.com/aswearingen91/account-service/internal/models"
)

func Connect(cfg *config.Config) *gorm.DB {

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.PostgresHost,
		cfg.PostgresPort,
		cfg.PostgresUser,
		cfg.PostgresPassword,
		cfg.PostgresDB,
		cfg.PostgresSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect to database:", err)
	}
	// Automatically create tables if they do not exist
	err = db.AutoMigrate(&models.User{})
	if err != nil {
		panic(err)
	}

	return db
}
