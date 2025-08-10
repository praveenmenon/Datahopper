# DataHopper Frontend

A modern React-based frontend for DataHopper, a protobuf-enabled HTTP API client.

## Features

- **Collections & Requests**: Organize your API requests into logical collections
- **Protobuf Support**: Send protobuf requests and decode protobuf responses
- **Variable Interpolation**: Use `{{variables}}` in URLs, headers, and body values
- **Environment Management**: Switch between different environments (local, staging, prod)
- **Dot-Path Body Editor**: Build nested protobuf messages using intuitive dot notation
- **Real-time Preview**: See how variables will be resolved before sending requests

## Tech Stack

- **React 18** with TypeScript
- **React Query** for server state management
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Lucide React** for icons

## Development

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Backend Integration

The frontend expects the DataHopper backend to be running on `http://localhost:8080`. The Vite dev server is configured to proxy `/api` requests to the backend.

## Project Structure

```
src/
├── components/          # React components
│   ├── App.tsx         # Main application component
│   ├── TopBar.tsx      # Top navigation bar
│   ├── Sidebar.tsx     # Collections sidebar
│   ├── RequestEditor.tsx # Main request editor
│   ├── HeadersEditor.tsx # HTTP headers editor
│   ├── BodyEditor.tsx  # Request body editor
│   ├── VariablesPreview.tsx # Variable interpolation preview
│   ├── ResponsePanel.tsx # Response display
│   └── modals/         # Modal components
├── lib/                # Utilities and API client
│   ├── api.ts          # API client functions
│   ├── types.ts        # TypeScript type definitions
│   └── useData.ts      # React Query hooks
├── main.tsx            # Application entry point
└── index.css           # Global styles and Tailwind imports
```

## Key Components

### RequestEditor
The main editor for configuring HTTP requests. Handles:
- HTTP method selection
- URL input with variable support
- Protobuf message type selection
- Headers and body configuration
- Request execution

### VariablesPreview
Shows how variables will be interpolated in:
- URL
- Headers
- Request body
- Displays variable precedence (environment > collection)

### ResponsePanel
Displays HTTP responses with:
- Status code and headers
- Decoded protobuf response (if applicable)
- Raw response data
- Copy-to-clipboard functionality

## Styling

The application uses Tailwind CSS with a custom primary color scheme. Custom CSS classes are defined in `index.css` for common UI patterns.

## API Integration

The frontend communicates with the backend through the API client in `lib/api.ts`. All API calls are wrapped in React Query hooks for caching, background updates, and optimistic UI updates.
