package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"sync"
)

type ConvertRequest struct {
	Markdown     string `json:"markdown"`
	Format       string `json:"format"`
	UseCustomRef bool   `json:"useCustomRef"`
	SourceName   string `json:"sourceName"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// Default reference doc path
const defaultRefDocPath = "/app/reference/custom-reference.docx"
const maxMultipartMemory = 64 << 20

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

const pdfInlineCodeLineBreakFilter = `local latex_escapes = {
	["\\"] = "\\textbackslash{}",
	["{"] = "\\{",
	["}"] = "\\}",
	["#"] = "\\#",
	["$"] = "\\$",
	["%"] = "\\%",
	["&"] = "\\&",
	["_"] = "\\_",
	["~"] = "\\textasciitilde{}",
	["^"] = "\\textasciicircum{}"
}

local break_after = {
	["."] = true,
	["/"] = true,
	["_"] = true,
	["-"] = true,
	["("] = true,
	[")"] = true,
	[","] = true,
	[":"] = true
}

local function escape_breakable_code(text)
	local parts = {}

	for char in text:gmatch(utf8.charpattern) do
		table.insert(parts, latex_escapes[char] or char)

		if break_after[char] then
			table.insert(parts, "\\allowbreak{}")
		end
	end

	return table.concat(parts)
end

function Code(el)
	return pandoc.RawInline("latex", "\\texttt{" .. escape_breakable_code(el.text) .. "}")
end

function Table(tbl)
	return pandoc.walk_block(tbl, { Code = Code })
end
`

func appendPDFOptions(args []string, tempDir string) ([]string, error) {
	args = append(args, "--pdf-engine=xelatex")
	args = append(args, "-V", "CJKmainfont=Noto Sans CJK SC")

	filterPath := filepath.Join(tempDir, "pdf-inline-code-breaks.lua")
	if err := os.WriteFile(filterPath, []byte(pdfInlineCodeLineBreakFilter), 0644); err != nil {
		return nil, err
	}

	args = append(args, "--lua-filter="+filterPath)
	return args, nil
}

func outputExtension(format string) string {
	if format == "latex" {
		return "tex"
	}

	return format
}

func sanitizeDownloadBaseName(sourceName string) string {
	cleanName := strings.ReplaceAll(filepath.ToSlash(sourceName), `\`, "/")
	cleanName = path.Base(cleanName)
	cleanName = strings.TrimSpace(cleanName)
	if cleanName == "." || cleanName == "/" {
		return ""
	}

	cleanName = strings.Map(func(r rune) rune {
		switch r {
		case 0, '/', '\\', ':', '*', '?', '"', '<', '>', '|', '\r', '\n', '\t':
			return '-'
		default:
			if r < 32 {
				return '-'
			}
			return r
		}
	}, cleanName)
	cleanName = strings.Trim(cleanName, " .")
	if cleanName == "" {
		return ""
	}

	ext := strings.ToLower(path.Ext(cleanName))
	if ext == ".md" || ext == ".markdown" {
		cleanName = strings.TrimSuffix(cleanName, path.Ext(cleanName))
	}

	return strings.Trim(cleanName, " .")
}

func outputFilename(sourceName string, ext string) string {
	baseName := sanitizeDownloadBaseName(sourceName)
	if baseName == "" {
		baseName = "document"
	}

	return fmt.Sprintf("%s.%s", baseName, ext)
}

func asciiFilenameFallback(filename string) string {
	var builder strings.Builder
	for _, r := range filename {
		if r >= 32 && r <= 126 {
			switch r {
			case '"', '\\', '/', ':', '*', '?', '<', '>', '|':
				builder.WriteRune('-')
			default:
				builder.WriteRune(r)
			}
			continue
		}

		builder.WriteRune('-')
	}

	fallback := strings.Trim(builder.String(), " .")
	if fallback == "" {
		return "document"
	}

	return fallback
}

func setDownloadHeaders(w http.ResponseWriter, contentType string, filename string) {
	w.Header().Set("Content-Type", contentType)
	w.Header().Set(
		"Content-Disposition",
		fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, asciiFilenameFallback(filename), url.PathEscape(filename)),
	)
}

func sanitizeRelativePath(rawPath string) (string, error) {
	cleanInput := strings.ReplaceAll(filepath.ToSlash(rawPath), `\`, "/")
	if cleanInput == "" {
		return "", fmt.Errorf("empty path")
	}
	if strings.Contains(cleanInput, "\x00") {
		return "", fmt.Errorf("invalid path")
	}
	if strings.HasPrefix(cleanInput, "/") || strings.HasPrefix(cleanInput, `\`) {
		return "", fmt.Errorf("absolute paths are not allowed")
	}

	parts := strings.Split(cleanInput, "/")
	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", fmt.Errorf("path traversal is not allowed")
		}
	}

	cleanPath := path.Clean(cleanInput)
	if cleanPath == "." || cleanPath == ".." || strings.HasPrefix(cleanPath, "../") {
		return "", fmt.Errorf("path traversal is not allowed")
	}

	return cleanPath, nil
}

func safeJoin(baseDir string, relativePath string) (string, error) {
	cleanPath, err := sanitizeRelativePath(relativePath)
	if err != nil {
		return "", err
	}

	targetPath := filepath.Join(baseDir, filepath.FromSlash(cleanPath))
	rel, err := filepath.Rel(baseDir, targetPath)
	if err != nil {
		return "", err
	}
	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", fmt.Errorf("path escapes workspace")
	}

	return targetPath, nil
}

func writeMarkdownToWorkspace(tempDir string, markdown string, sourcePath string) (string, string, error) {
	relativePath := "input.md"
	if sourcePath != "" {
		cleanPath, err := sanitizeRelativePath(sourcePath)
		if err != nil {
			return "", "", fmt.Errorf("invalid markdown path: %w", err)
		}
		relativePath = cleanPath
	}

	inputPath, err := safeJoin(tempDir, relativePath)
	if err != nil {
		return "", "", err
	}

	if err := os.MkdirAll(filepath.Dir(inputPath), 0755); err != nil {
		return "", "", err
	}

	if err := os.WriteFile(inputPath, []byte(markdown), 0644); err != nil {
		return "", "", err
	}

	return inputPath, filepath.Dir(inputPath), nil
}

func appendResourcePath(args []string, resourceRoot string, tempDir string) []string {
	resourcePaths := []string{resourceRoot}
	if resourceRoot != tempDir {
		resourcePaths = append(resourcePaths, tempDir)
	}

	return append(args, "--resource-path="+strings.Join(resourcePaths, string(os.PathListSeparator)))
}

func saveUploadedAsset(tempDir string, fieldName string, header *multipart.FileHeader) error {
	const assetPrefix = "asset:"
	if !strings.HasPrefix(fieldName, assetPrefix) {
		return nil
	}

	assetPath := strings.TrimPrefix(fieldName, assetPrefix)
	targetPath, err := safeJoin(tempDir, assetPath)
	if err != nil {
		return fmt.Errorf("invalid asset path %q: %w", assetPath, err)
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
		return err
	}

	sourceFile, err := header.Open()
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	targetFile, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer targetFile.Close()

	if _, err := io.Copy(targetFile, sourceFile); err != nil {
		return err
	}

	return nil
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
	inputPath, resourceRoot, err := writeMarkdownToWorkspace(tempDir, req.Markdown, "")
	if err != nil {
		log.Printf("Failed to write input file: %v", err)
		sendError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	// Determine output file extension
	ext := outputExtension(req.Format)
	outputPath := filepath.Join(tempDir, fmt.Sprintf("output.%s", ext))

	// Build pandoc command
	args := []string{
		inputPath,
		"-o", outputPath,
		"--standalone",
	}
	args = appendResourcePath(args, resourceRoot, tempDir)

	// Add PDF-specific options
	if req.Format == "pdf" {
		args, err = appendPDFOptions(args, tempDir)
		if err != nil {
			log.Printf("Failed to prepare PDF conversion options: %v", err)
			sendError(w, http.StatusInternalServerError, "Internal server error")
			return
		}
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
	cmd.Dir = resourceRoot
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
	setDownloadHeaders(w, contentType, outputFilename(req.SourceName, ext))

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
	// Parse multipart form. Larger embedded resources spill to temporary files.
	if err := r.ParseMultipartForm(maxMultipartMemory); err != nil {
		sendError(w, http.StatusBadRequest, "Failed to parse form data")
		return
	}
	defer r.MultipartForm.RemoveAll()

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

	for fieldName, fileHeaders := range r.MultipartForm.File {
		if !strings.HasPrefix(fieldName, "asset:") {
			continue
		}

		for _, fileHeader := range fileHeaders {
			if err := saveUploadedAsset(tempDir, fieldName, fileHeader); err != nil {
				log.Printf("Failed to save uploaded asset: %v", err)
				sendError(w, http.StatusBadRequest, "Invalid asset upload")
				return
			}
		}
	}

	// Write markdown to temp file after assets so edited text wins if paths overlap.
	inputPath, resourceRoot, err := writeMarkdownToWorkspace(tempDir, markdown, r.FormValue("markdownPath"))
	if err != nil {
		log.Printf("Failed to write input file: %v", err)
		sendError(w, http.StatusBadRequest, "Invalid markdown path")
		return
	}

	// Determine output file extension
	ext := outputExtension(format)
	outputPath := filepath.Join(tempDir, fmt.Sprintf("output.%s", ext))

	// Build pandoc command
	args := []string{
		inputPath,
		"-o", outputPath,
		"--standalone",
	}
	args = appendResourcePath(args, resourceRoot, tempDir)

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
		args, err = appendPDFOptions(args, tempDir)
		if err != nil {
			log.Printf("Failed to prepare PDF conversion options: %v", err)
			sendError(w, http.StatusInternalServerError, "Internal server error")
			return
		}
	}

	// Execute pandoc
	cmd := exec.Command("pandoc", args...)
	cmd.Dir = resourceRoot
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
	sourceName := r.FormValue("sourceName")
	if sourceName == "" {
		sourceName = r.FormValue("markdownPath")
	}
	setDownloadHeaders(w, contentType, outputFilename(sourceName, ext))

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
