# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o pandoc-web-server .

# Production stage
FROM alpine:3.19

# Install Pandoc with XeLaTeX and CJK fonts for PDF export
RUN apk add --no-cache \
    ca-certificates \
    fontconfig \
    font-noto-cjk \
    pandoc \
    texlive \
    texlive-xetex \
 && fc-cache -f

WORKDIR /app

COPY --from=builder /app/pandoc-web-server .

EXPOSE 8080

ENV PORT=8080

CMD ["./pandoc-web-server"]
