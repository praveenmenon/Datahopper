package interpolate

import (
	"reflect"
	"testing"
)

func TestString(t *testing.T) {
	tests := []struct {
		name      string
		template  string
		variables map[string]string
		expected  string
	}{
		{
			name:      "simple variable",
			template:  "Hello {{name}}!",
			variables: map[string]string{"name": "World"},
			expected:  "Hello World!",
		},
		{
			name:      "multiple variables",
			template:  "{{greeting}} {{name}}, welcome to {{place}}!",
			variables: map[string]string{
				"greeting": "Hello",
				"name":     "Alice",
				"place":    "DataHopper",
			},
			expected: "Hello Alice, welcome to DataHopper!",
		},
		{
			name:      "no variables",
			template:  "Hello World!",
			variables: map[string]string{},
			expected:  "Hello World!",
		},
		{
			name:      "unresolved variable",
			template:  "Hello {{name}}!",
			variables: map[string]string{},
			expected:  "Hello {{name}}!",
		},
		{
			name:      "empty template",
			template:  "",
			variables: map[string]string{"name": "World"},
			expected:  "",
		},
		{
			name:      "variable with special characters",
			template:  "URL: {{base_url}}/api/v1",
			variables: map[string]string{"base_url": "https://api.example.com"},
			expected:  "URL: https://api.example.com/api/v1",
		},
		{
			name:      "nested braces in text",
			template:  "Function: f(x) = {{formula}}",
			variables: map[string]string{"formula": "x^2 + 2x + 1"},
			expected:  "Function: f(x) = x^2 + 2x + 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := String(tt.template, tt.variables)
			if result != tt.expected {
				t.Errorf("String() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestDeep(t *testing.T) {
	tests := []struct {
		name      string
		data      interface{}
		variables map[string]string
		expected  interface{}
	}{
		{
			name: "simple string",
			data: "Hello {{name}}!",
			variables: map[string]string{"name": "World"},
			expected: "Hello World!",
		},
		{
			name: "map with strings",
			data: map[string]interface{}{
				"greeting": "{{greeting}} {{name}}",
				"count":    42,
			},
			variables: map[string]string{
				"greeting": "Hello",
				"name":     "Alice",
			},
			expected: map[string]interface{}{
				"greeting": "Hello Alice",
				"count":    42,
			},
		},
		{
			name: "slice with strings",
			data: []interface{}{
				"{{first}}",
				"{{second}}",
				"static",
			},
			variables: map[string]string{
				"first":  "Hello",
				"second": "World",
			},
			expected: []interface{}{
				"Hello",
				"World",
				"static",
			},
		},
		{
			name: "nested structure",
			data: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "{{user_name}}",
					"email": "{{user_email}}",
				},
				"settings": []interface{}{
					map[string]interface{}{
						"key":   "theme",
						"value": "{{theme}}",
					},
				},
			},
			variables: map[string]string{
				"user_name":  "Alice",
				"user_email": "alice@example.com",
				"theme":      "dark",
			},
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"name":  "Alice",
					"email": "alice@example.com",
				},
				"settings": []interface{}{
					map[string]interface{}{
						"key":   "theme",
						"value": "dark",
					},
				},
			},
		},
		{
			name: "non-string types unchanged",
			data: map[string]interface{}{
				"number": 42,
				"bool":   true,
				"nil":    nil,
			},
			variables: map[string]string{"name": "World"},
			expected: map[string]interface{}{
				"number": 42,
				"bool":   true,
				"nil":    nil,
			},
		},
		{
			name:      "nil data",
			data:      nil,
			variables: map[string]string{"name": "World"},
			expected:  nil,
		},
		{
			name:      "empty variables",
			data:      "Hello {{name}}!",
			variables: map[string]string{},
			expected:  "Hello {{name}}!",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Deep(tt.data, tt.variables)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("Deep() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestMergeVariables(t *testing.T) {
	tests := []struct {
		name      string
		base      map[string]string
		override  map[string]string
		expected  map[string]string
	}{
		{
			name: "simple merge",
			base: map[string]string{
				"base_url": "https://api.example.com",
				"timeout":  "30",
			},
			override: map[string]string{
				"timeout": "60",
				"debug":   "true",
			},
			expected: map[string]string{
				"base_url": "https://api.example.com",
				"timeout":  "60",
				"debug":    "true",
			},
		},
		{
			name: "override overrides base",
			base: map[string]string{
				"env": "staging",
			},
			override: map[string]string{
				"env": "production",
			},
			expected: map[string]string{
				"env": "production",
			},
		},
		{
			name:     "empty base",
			base:     map[string]string{},
			override: map[string]string{"key": "value"},
			expected: map[string]string{"key": "value"},
		},
		{
			name:     "empty override",
			base:     map[string]string{"key": "value"},
			override: map[string]string{},
			expected: map[string]string{"key": "value"},
		},
		{
			name:     "both empty",
			base:     map[string]string{},
			override: map[string]string{},
			expected: map[string]string{},
		},
		{
			name:     "nil base",
			base:     nil,
			override: map[string]string{"key": "value"},
			expected: map[string]string{"key": "value"},
		},
		{
			name:     "nil override",
			base:     map[string]string{"key": "value"},
			override: nil,
			expected: map[string]string{"key": "value"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MergeVariables(tt.base, tt.override)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("MergeVariables() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestExtractVariables(t *testing.T) {
	tests := []struct {
		name     string
		template string
		expected []string
	}{
		{
			name:     "single variable",
			template: "Hello {{name}}!",
			expected: []string{"name"},
		},
		{
			name:     "multiple variables",
			template: "{{greeting}} {{name}}, welcome to {{place}}!",
			expected: []string{"greeting", "name", "place"},
		},
		{
			name:     "duplicate variables",
			template: "{{name}} says hello to {{name}}",
			expected: []string{"name", "name"},
		},
		{
			name:     "no variables",
			template: "Hello World!",
			expected: []string{},
		},
		{
			name:     "empty template",
			template: "",
			expected: []string{},
		},
		{
			name:     "malformed variables",
			template: "Hello {{name} and {{name}} and {{",
			expected: []string{"name", "name"},
		},
		{
			name:     "variables with underscores",
			template: "{{base_url}}/{{api_version}}",
			expected: []string{"base_url", "api_version"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractVariables(tt.template)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ExtractVariables() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestValidateVariables(t *testing.T) {
	tests := []struct {
		name      string
		template  string
		variables map[string]string
		expected  []string
	}{
		{
			name:      "all variables resolved",
			template:  "Hello {{name}}!",
			variables: map[string]string{"name": "World"},
			expected:  []string{},
		},
		{
			name:      "missing variables",
			template:  "{{greeting}} {{name}}!",
			variables: map[string]string{"greeting": "Hello"},
			expected:  []string{"name"},
		},
		{
			name:      "no variables in template",
			template:  "Hello World!",
			variables: map[string]string{},
			expected:  []string{},
		},
		{
			name:      "empty template",
			template:  "",
			variables: map[string]string{"name": "World"},
			expected:  []string{},
		},
		{
			name:      "extra variables provided",
			template:  "Hello {{name}}!",
			variables: map[string]string{"name": "World", "extra": "value"},
			expected:  []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateVariables(tt.template, tt.variables)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ValidateVariables() = %v, want %v", result, tt.expected)
			}
		})
	}
}
