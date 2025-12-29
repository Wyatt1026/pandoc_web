package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type ConvertRequest struct {
	Markdown string `json:"markdown"`
	Format   string `json:"format"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

var validFormats = map[string]string{
	"pdf":   "application/pdf",
	"docx":  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"html":  "text/html",
	"epub":  "application/epub+zip",
	"latex": "application/x-latex",
	"rst":   "text/x-rst",
	"odt":   "application/vnd.oasis.opendocument.text",
}

func ConvertHandler(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req ConvertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate markdown content
	if strings.TrimSpace(req.Markdown) == "" {
		sendError(w, http.StatusBadRequest, "Markdown content is required")
		return
	}

	// Validate format
	contentType, ok := validFormats[req.Format]
	if !ok {
		sendError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported format: %s", req.Format))
		return
	}

	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "pandoc-convert-*")
	if err != nil {
		log.Printf("Failed to create temp dir: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer os.RemoveAll(tempDir)

	// Write markdown to temp file
	inputPath := filepath.Join(tempDir, "input.md")
	if err := os.WriteFile(inputPath, []byte(req.Markdown), 0644); err != nil {
		log.Printf("Failed to write input file: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	// Determine output file extension
	ext := req.Format
	if ext == "latex" {
		ext = "tex"
	}
	outputPath := filepath.Join(tempDir, fmt.Sprintf("output.%s", ext))

	// Build pandoc command
	args := []string{
		inputPath,
		"-o", outputPath,
		"--standalone",
	}

	// Add PDF-specific options
	if req.Format == "pdf" {
		args = append(args, "--pdf-engine=xelatex")
		// Add CJK support for Chinese/Japanese/Korean characters
		args = append(args, "-V", "CJKmainfont=Noto Sans CJK SC")
	}

	// Execute pandoc
	cmd := exec.Command("pandoc", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Pandoc conversion failed: %v\nOutput: %s", err, string(output))
		sendError(w, http.StatusInternalServerError, fmt.Sprintf("Conversion failed: %s", string(output)))
		return
	}

	// Read output file
	file, err := os.Open(outputPath)
	if err != nil {
		log.Printf("Failed to open output file: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer file.Close()

	// Set response headers
	filename := fmt.Sprintf("document.%s", ext)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// Stream file to response
	if _, err := io.Copy(w, file); err != nil {
		log.Printf("Failed to send file: %v", err)
	}

	log.Printf("Successfully converted to %s", req.Format)
}

func sendError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}
