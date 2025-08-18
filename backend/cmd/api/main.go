package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/datahopper/backend/internal/httpapi"
	"github.com/datahopper/backend/internal/obs"
	"github.com/datahopper/backend/internal/registry"
	"github.com/datahopper/backend/internal/runner"
	"github.com/datahopper/backend/internal/store"
	"github.com/datahopper/backend/internal/workspace"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	// Initialize logger
	logger := obs.NewLogger()
	logger.Info().Msg("Starting DataHopper backend...")

	// Initialize DB pool if DSN provided
	dsn := os.Getenv("DB_DSN")
	var pool *pgxpool.Pool
	if dsn != "" {
		ctx := context.Background()
		var err error
		pool, err = pgxpool.New(ctx, dsn)
		if err != nil {
			logger.Fatal().Err(err).Msg("failed to create pgx pool")
		}
		if err := pool.Ping(ctx); err != nil {
			logger.Fatal().Err(err).Msg("failed to ping database")
		}
		logger.Info().Msg("Connected to PostgreSQL")
	} else {
		logger.Warn().Msg("DB_DSN not set; running without PostgreSQL persistence")
	}

	// Initialize services
	store := store.NewInMemoryStore()
	regSvc := registry.NewService()
	if pool != nil {
		regSvc = regSvc.WithRepository(registry.NewRepository(pool))
		// Attempt to load latest registry on startup; ignore error if none
		_ = regSvc.LoadFromDatabase(context.Background(), "default")
	}
	workspace := workspace.NewService(store)
	runner := runner.NewService(regSvc)

	// Initialize HTTP API
	api := httpapi.NewAPI(regSvc, workspace, runner, logger)
	// Stash pool for save-request handler shim
	if pool != nil {
		httpapi.ApiRunnerPoolSet(pool)
	}

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Setup routes
	api.SetupRoutes(router)

	// Create HTTP server
	server := &http.Server{
		Addr:    ":8088",
		Handler: router,
	}

	// Start server in goroutine
	go func() {
		logger.Info().Str("port", "8088").Msg("Starting HTTP server...")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("Failed to start server")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("Shutting down server...")

	// Create context with timeout for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	logger.Info().Msg("Server exited gracefully")
}
