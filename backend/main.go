package main

import (
	"log"
	"net/http"
	"os"

	"pandoc-web-backend/handlers"

	"github.com/rs/cors"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Convert endpoint
	mux.HandleFunc("POST /api/convert", handlers.ConvertHandler)

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
	})

	handler := c.Handler(mux)

	log.Printf("🚀 Pandoc Web API Server starting on port %s", port)
	log.Printf("📄 POST /api/convert - Convert markdown to various formats")
	log.Printf("❤️  GET /api/health - Health check")

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
