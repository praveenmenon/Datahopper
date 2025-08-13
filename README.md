# DataHopper 🚀

> **Hop between APIs with protobuf speed**

DataHopper is a modern, browser-based HTTP client specifically designed for working with Protocol Buffers. Think Postman, but optimized for protobuf workflows with a clean, developer-friendly interface.

## ✨ Features

- **🔧 Protobuf Registry**: Register `.proto` files and browse message types with automatic compilation
- **📁 Collections & Requests**: Organize your API requests logically with inline actions
- **🌍 Environment Management**: Create, edit, and switch between environments with variable management
- **🔤 Variable Interpolation**: Use `{{variables}}` in URLs, headers, and body values with visual feedback
- **📝 Dot-Path Body Editor**: Build nested protobuf messages using intuitive dot notation
- **📊 Smart Response Handling**: Automatic protobuf decoding with error handling and raw response fallback
- **🎯 Header Suggestions**: Intelligent autocomplete for common HTTP headers
- **⚡ Fast & Responsive**: Built with modern web technologies for optimal performance
- **🔄 Real-time Variable Resolution**: See resolved values with color-coded status indicators

## 🏗️ Architecture

DataHopper consists of two main components:

### Backend (Go)
- **Registry Service**: Manages protobuf file compilation and message type discovery
- **Workspace Service**: Handles collections, requests, and environment management
- **Runner Service**: Executes HTTP requests with protobuf encoding/decoding and oneof field handling
- **HTTP API**: RESTful endpoints for all operations with multipart file upload support
- **Variable Interpolation**: Deep traversal and dot-path expansion for complex data structures

### Frontend (React + TypeScript)
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Real-time Preview**: See variable interpolation and resolved values with status indicators
- **Intuitive Editors**: Specialized components for headers, body, and variables
- **State Management**: React Query for efficient data fetching and caching
- **Environment Selector**: Easy switching between environments with persistent state

## 🚀 Quick Start

### Prerequisites
- Go 1.22+
- Node.js 18+
- npm or yarn
- `protoc` compiler (for .proto file processing)

### Development Setup

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd DataHopper
   ```

2. **Install dependencies:**
   ```bash
   make install-deps
   ```

3. **Start both backend and frontend concurrently:**
   ```bash
   make dev
   ```

   This will start:
   - Backend on `http://localhost:8088`
   - Frontend on `http://localhost:3000`

### Alternative: Run Services Separately

```bash
# Terminal 1: Backend only
make backend

# Terminal 2: Frontend only
make frontend
```

## 📖 Usage Guide

### 1. Register Protobuf Files

Start by registering your `.proto` files:
- Click "Register .proto" in the top bar
- Choose between file path or directory upload
- The app will compile and load all message types automatically

### 2. Manage Environments

Create and manage environment-specific variables:
- Use the environment selector in the top-right corner
- Click the "+" button to create new environments
- Add variables like `base_url`, `api_key`, `auth_token`
- Switch between environments to change variable values

### 3. Create Collections

Organize related requests into collections:
- Click the "+" button in the Collections sidebar section
- Give your collection a name and description
- Optionally add proto file paths and collection-scoped variables

### 4. Add Requests

Create requests within collections:
- Select a collection and click "Add Request" (hover to see inline actions)
- Configure HTTP method, URL, and protobuf message types
- Set up headers with intelligent suggestions and variable support
- Configure separate response types for success and error scenarios

### 5. Use Variables

Leverage environment and collection variables:
- Define variables in collections or environments
- Reference them as `{{variable_name}}` in URLs, headers, and body
- See real-time resolution with green (resolved) or yellow (unresolved) indicators
- Environment variables override collection variables

### 6. Send Requests

Execute your requests:
- Click "Send" to execute the request
- View the response in the bottom panel
- Protobuf responses are automatically decoded to JSON
- See decode errors as warnings while still viewing raw responses

## 🔧 Configuration

### Environment Variables

The backend supports these environment variables:
- `PORT`: Server port (default: 8088)
- `LOG_LEVEL`: Logging level (default: info)
- `PROTO_CACHE_DIR`: Protobuf cache directory

### Frontend Configuration

The frontend is configured via:
- `vite.config.ts`: Build and dev server settings (port 3000)
- `tailwind.config.ts`: Styling and theme configuration
- `src/lib/api.ts`: API endpoint configuration

## 🧪 Testing

### Backend Tests
```bash
make test
# or
go test -v ./...
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
# Run the full test suite
make test
```

## 📦 Building

### Backend Binary
```bash
make build
# or
go build -o dist/datahopper ./cmd/api
```

### Frontend Build
```bash
cd frontend
npm run build
```

### Docker Build
```bash
make docker-build
# or
docker-compose build
```

## 🚀 Deployment

### Local Development
```bash
# Start both services concurrently
make dev

# Or run separately
make backend    # Backend on :8088
make frontend   # Frontend on :3000
```

### Production
```bash
# Build everything
make build

# Run with Docker
make docker-run
```

## 🛠️ Development Commands

```bash
make dev          # Start both backend and frontend
make backend      # Start backend only
make frontend     # Start frontend only
make test         # Run all tests
make build        # Build both backend and frontend
make clean        # Clean build artifacts
make fmt          # Format Go code
make lint         # Lint Go code
make install-deps # Install all dependencies
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow Go and TypeScript best practices
- Write tests for new functionality
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Go](https://golang.org/) and [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- State management with [React Query](https://react-query.tanstack.com/)
- Protobuf handling with [google.golang.org/protobuf](https://pkg.go.dev/google.golang.org/protobuf)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/datahopper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/datahopper/discussions)
- **Documentation**: [Wiki](https://github.com/your-username/datahopper/wiki)

---

**DataHopper** - Making protobuf API development faster and more enjoyable! 🚀
