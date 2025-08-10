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
)

func main() {
	// Initialize logger
	logger := obs.NewLogger()
	logger.Info().Msg("Starting DataHopper backend...")

	// Initialize services
	store := store.NewInMemoryStore()
	registry := registry.NewService()
	workspace := workspace.NewService(store)
	runner := runner.NewService(registry)

	// Initialize HTTP API
	api := httpapi.NewAPI(registry, workspace, runner, logger)

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
