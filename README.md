# DataHopper 🚀

> **Hop between APIs with protobuf speed**

DataHopper is a modern, browser-based HTTP client specifically designed for working with Protocol Buffers. Think Postman, but optimized for protobuf workflows with a clean, developer-friendly interface.

## ✨ Features

- **🔧 Protobuf Registry**: Register `.proto` files and browse message types
- **📁 Collections & Requests**: Organize your API requests logically
- **🌍 Environment Management**: Switch between local, staging, and production
- **🔤 Variable Interpolation**: Use `{{variables}}` in URLs, headers, and body values
- **📝 Dot-Path Body Editor**: Build nested protobuf messages intuitively
- **📊 Smart Response Handling**: Automatic protobuf decoding with fallback to raw
- **⚡ Fast & Responsive**: Built with modern web technologies for optimal performance

## 🏗️ Architecture

DataHopper consists of two main components:

### Backend (Go)
- **Registry Service**: Manages protobuf file compilation and message type discovery
- **Workspace Service**: Handles collections, requests, and environment management
- **Runner Service**: Executes HTTP requests with protobuf encoding/decoding
- **HTTP API**: RESTful endpoints for all operations

### Frontend (React + TypeScript)
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Real-time Preview**: See variable interpolation and resolved values
- **Intuitive Editors**: Specialized components for headers, body, and variables
- **State Management**: React Query for efficient data fetching and caching

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd DataHopper
   ```

2. **Install Go dependencies:**
   ```bash
   go mod download
   ```

3. **Run the backend:**
   ```bash
   go run ./cmd/datahopper
   ```

   The backend will start on `http://localhost:8080`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser** to `http://localhost:3000`

## 📖 Usage Guide

### 1. Register Protobuf Files

Start by registering your `.proto` files:
- Click "Register .proto" in the top bar
- Enter the path to your `.proto` file or directory
- The app will compile and load all message types

### 2. Create Collections

Organize related requests into collections:
- Click the "+" button in the sidebar
- Give your collection a name and description
- Optionally add proto file paths and variables

### 3. Add Requests

Create requests within collections:
- Select a collection and click "Add Request"
- Configure HTTP method, URL, and protobuf message types
- Set up headers and body fields using dot notation

### 4. Use Variables

Leverage environment and collection variables:
- Define variables in collections or environments
- Reference them as `{{variable_name}}` in URLs, headers, and body
- Environment variables override collection variables

### 5. Send Requests

Execute your requests:
- Click "Send" to execute the request
- View the response in the bottom panel
- Protobuf responses are automatically decoded to JSON

## 🔧 Configuration

### Environment Variables

The backend supports these environment variables:
- `PORT`: Server port (default: 8080)
- `LOG_LEVEL`: Logging level (default: info)
- `PROTO_CACHE_DIR`: Protobuf cache directory

### Frontend Configuration

The frontend is configured via:
- `vite.config.ts`: Build and dev server settings
- `tailwind.config.js`: Styling and theme configuration
- `src/lib/api.ts`: API endpoint configuration

## 🧪 Testing

### Backend Tests
```bash
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
go build -o dist/datahopper ./cmd/datahopper
```

### Frontend Build
```bash
cd frontend
npm run build
```

### Docker Build
```bash
docker build -t datahopper .
```

## 🚀 Deployment

### Local Development
```bash
# Terminal 1: Backend
go run ./cmd/datahopper

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Production
```bash
# Build everything
make build

# Run the binary
./dist/datahopper
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

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/datahopper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/datahopper/discussions)
- **Documentation**: [Wiki](https://github.com/your-username/datahopper/wiki)

---

**DataHopper** - Making protobuf API development faster and more enjoyable! 🚀
