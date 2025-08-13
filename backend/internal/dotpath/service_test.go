package dotpath

import (
	"reflect"
	"testing"
)

// mapsEqual compares two maps by content, ignoring field order
func mapsEqual(a, b map[string]interface{}) bool {
	if len(a) != len(b) {
		return false
	}

	for key, valA := range a {
		valB, exists := b[key]
		if !exists {
			return false
		}

		// Use a simpler comparison that checks actual values
		if !valuesEqual(valA, valB) {
			return false
		}
	}

	return true
}

// valuesEqual compares two values for equality
func valuesEqual(a, b interface{}) bool {
	// Handle nil cases
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// Handle basic types
	switch va := a.(type) {
	case string:
		if vb, ok := b.(string); ok {
			return va == vb
		}
	case int:
		if vb, ok := b.(int); ok {
			return va == vb
		}
	case float64:
		if vb, ok := b.(float64); ok {
			return va == vb
		}
	case bool:
		if vb, ok := b.(bool); ok {
			return va == vb
		}
	case []interface{}:
		if vb, ok := b.([]interface{}); ok {
			if len(va) != len(vb) {
				return false
			}
			for i, v := range va {
				if !valuesEqual(v, vb[i]) {
					return false
				}
			}
			return true
		}
	case map[string]interface{}:
		if vb, ok := b.(map[string]interface{}); ok {
			return mapsEqual(va, vb)
		}
	}

	// Fallback to reflect.DeepEqual for other types
	return reflect.DeepEqual(a, b)
}

func TestSetByPath(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]interface{}
		path     string
		value    interface{}
		expected map[string]interface{}
	}{
		{
			name:  "simple field",
			data:  map[string]interface{}{},
			path:  "name",
			value: "John",
			expected: map[string]interface{}{
				"name": "John",
			},
		},
		{
			name:  "nested field",
			data:  map[string]interface{}{},
			path:  "user.name",
			value: "John",
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
				},
			},
		},
		{
			name:  "array index",
			data:  map[string]interface{}{},
			path:  "tags[0]",
			value: "tag1",
			expected: map[string]interface{}{
				"tags": []interface{}{"tag1"},
			},
		},
		{
			name:  "nested array",
			data:  map[string]interface{}{},
			path:  "user.tags[0]",
			value: "tag1",
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"tags": []interface{}{"tag1"},
				},
			},
		},
		{
			name:  "complex nested path",
			data:  map[string]interface{}{},
			path:  "user.emails[1].address",
			value: "work@example.com",
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"emails": []interface{}{
						nil,
						map[string]interface{}{
							"address": "work@example.com",
						},
					},
				},
			},
		},
		{
			name: "existing data preservation",
			data: map[string]interface{}{
				"existing": "value",
				"user": map[string]interface{}{
					"name": "John",
				},
			},
			path:  "user.age",
			value: 30,
			expected: map[string]interface{}{
				"existing": "value",
				"user": map[string]interface{}{
					"name": "John",
					"age":  30,
				},
			},
		},
		{
			name:  "array expansion",
			data:  map[string]interface{}{},
			path:  "items[5]",
			value: "item5",
			expected: map[string]interface{}{
				"items": []interface{}{nil, nil, nil, nil, nil, "item5"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SetByPath(tt.data, tt.path, tt.value)

			if !mapsEqual(result, tt.expected) {
				t.Errorf("SetByPath() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestBuildFromFields(t *testing.T) {
	tests := []struct {
		name   string
		fields []interface{}
		want   map[string]interface{}
	}{
		{
			name: "simple fields",
			fields: []interface{}{
				map[string]interface{}{"path": "name", "value": "John"},
				map[string]interface{}{"path": "age", "value": "30"},
			},
			want: map[string]interface{}{
				"name": "John",
				"age":  float64(30), // JSON unmarshal returns float64 for numbers
			},
		},
		{
			name: "nested fields",
			fields: []interface{}{
				map[string]interface{}{"path": "user.name", "value": "John"},
				map[string]interface{}{"path": "user.age", "value": "30"},
			},
			want: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
					"age":  float64(30), // JSON unmarshal returns float64 for numbers
				},
			},
		},
		{
			name: "array fields",
			fields: []interface{}{
				map[string]interface{}{"path": "tags[0]", "value": "tag1"},
				map[string]interface{}{"path": "tags[1]", "value": "tag2"},
			},
			want: map[string]interface{}{
				"tags": []interface{}{"tag1", "tag2"},
			},
		},
		{
			name: "complex nested with arrays",
			fields: []interface{}{
				map[string]interface{}{"path": "user.name", "value": "John"},
				map[string]interface{}{"path": "user.emails[0].address", "value": "home@example.com"},
				map[string]interface{}{"path": "user.emails[1].address", "value": "work@example.com"},
				map[string]interface{}{"path": "user.emails[1].type", "value": "work"},
			},
			want: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
					"emails": []interface{}{
						map[string]interface{}{
							"address": "home@example.com",
						},
						map[string]interface{}{
							"address": "work@example.com",
							"type":    "work",
						},
					},
				},
			},
		},
		{
			name:   "empty fields",
			fields: []interface{}{},
			want:   map[string]interface{}{},
		},
		{
			name:   "nil fields",
			fields: nil,
			want:   map[string]interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BuildFromFields(tt.fields)
			if err != nil {
				t.Errorf("BuildFromFields() error = %v", err)
				return
			}

			if !mapsEqual(got, tt.want) {
				t.Errorf("BuildFromFields() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSetByPathEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]interface{}
		path     string
		value    interface{}
		expected map[string]interface{}
	}{
		{
			name:     "empty path",
			data:     map[string]interface{}{},
			path:     "",
			value:    "value",
			expected: map[string]interface{}{},
		},
		{
			name:     "invalid array index",
			data:     map[string]interface{}{},
			path:     "items[abc]",
			value:    "value",
			expected: map[string]interface{}{},
		},
		{
			name:     "negative array index",
			data:     map[string]interface{}{},
			path:     "items[-1]",
			value:    "value",
			expected: map[string]interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SetByPath(tt.data, tt.path, tt.value)

			if !mapsEqual(result, tt.expected) {
				t.Errorf("SetByPath() = %v, want %v", result, tt.expected)
			}
		})
	}
}
