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
	"sync"
)

type ConvertRequest struct {
	Markdown     string `json:"markdown"`
	Format       string `json:"format"`
	UseCustomRef bool   `json:"useCustomRef"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// Default reference doc path
const defaultRefDocPath = "/app/reference/custom-reference.docx"

// Store for custom reference docs (session-based, in-memory)
var (
	customRefDocs = make(map[string][]byte)
	customRefMux  sync.RWMutex
)

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

	// Add reference-doc for docx format
	if req.Format == "docx" && req.UseCustomRef {
		// Check if default reference doc exists
		if _, err := os.Stat(defaultRefDocPath); err == nil {
			args = append(args, "--reference-doc="+defaultRefDocPath)
			log.Printf("Using default reference doc: %s", defaultRefDocPath)
		} else {
			log.Printf("Default reference doc not found at %s", defaultRefDocPath)
		}
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

// ConvertWithCustomRefHandler handles conversion with custom reference doc uploaded
func ConvertWithCustomRefHandler(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		sendError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}

	// Get markdown content
	markdown := r.FormValue("markdown")
	if strings.TrimSpace(markdown) == "" {
		sendError(w, http.StatusBadRequest, "Markdown content is required")
		return
	}

	// Get format
	format := r.FormValue("format")
	contentType, ok := validFormats[format]
	if !ok {
		sendError(w, http.StatusBadRequest, fmt.Sprintf("Unsupported format: %s", format))
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
	if err := os.WriteFile(inputPath, []byte(markdown), 0644); err != nil {
		log.Printf("Failed to write input file: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	// Determine output file extension
	ext := format
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

	// Handle reference doc for docx format
	if format == "docx" {
		// Check for uploaded custom reference doc
		file, _, err := r.FormFile("referenceDoc")
		if err == nil {
			defer file.Close()
			
			// Save uploaded reference doc to temp directory
			refDocPath := filepath.Join(tempDir, "custom-reference.docx")
			refDocFile, err := os.Create(refDocPath)
			if err != nil {
				log.Printf("Failed to create reference doc file: %v", err)
				sendError(w, http.StatusInternalServerError, "Internal server error")
				return
			}
			defer refDocFile.Close()
			
			if _, err := io.Copy(refDocFile, file); err != nil {
				log.Printf("Failed to save reference doc: %v", err)
				sendError(w, http.StatusInternalServerError, "Internal server error")
				return
			}
			
			args = append(args, "--reference-doc="+refDocPath)
			log.Printf("Using uploaded custom reference doc")
		} else {
			// Use default reference doc if useCustomRef is set
			useCustomRef := r.FormValue("useCustomRef")
			if useCustomRef == "true" {
				if _, err := os.Stat(defaultRefDocPath); err == nil {
					args = append(args, "--reference-doc="+defaultRefDocPath)
					log.Printf("Using default reference doc: %s", defaultRefDocPath)
				}
			}
		}
	}

	// Add PDF-specific options
	if format == "pdf" {
		args = append(args, "--pdf-engine=xelatex")
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
	outputFile, err := os.Open(outputPath)
	if err != nil {
		log.Printf("Failed to open output file: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer outputFile.Close()

	// Set response headers
	filename := fmt.Sprintf("document.%s", ext)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// Stream file to response
	if _, err := io.Copy(w, outputFile); err != nil {
		log.Printf("Failed to send file: %v", err)
	}

	log.Printf("Successfully converted to %s with custom reference", format)
}

// DownloadDefaultRefHandler allows downloading the default reference doc
func DownloadDefaultRefHandler(w http.ResponseWriter, r *http.Request) {
	if _, err := os.Stat(defaultRefDocPath); os.IsNotExist(err) {
		sendError(w, http.StatusNotFound, "Default reference document not found")
		return
	}

	file, err := os.Open(defaultRefDocPath)
	if err != nil {
		log.Printf("Failed to open default reference doc: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", `attachment; filename="custom-reference.docx"`)

	if _, err := io.Copy(w, file); err != nil {
		log.Printf("Failed to send reference doc: %v", err)
	}
}
