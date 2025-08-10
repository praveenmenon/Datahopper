package dotpath

import (
	"reflect"
	"testing"
)

func TestSetByPath(t *testing.T) {
	tests := []struct {
		name     string
		data     map[string]interface{}
		path     string
		value    interface{}
		expected map[string]interface{}
	}{
		{
			name: "simple field",
			data: map[string]interface{}{},
			path:  "name",
			value: "John",
			expected: map[string]interface{}{
				"name": "John",
			},
		},
		{
			name: "nested field",
			data: map[string]interface{}{},
			path:  "user.name",
			value: "John",
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
				},
			},
		},
		{
			name: "array index",
			data: map[string]interface{}{},
			path:  "tags[0]",
			value: "tag1",
			expected: map[string]interface{}{
				"tags": []interface{}{"tag1"},
			},
		},
		{
			name: "nested array",
			data: map[string]interface{}{},
			path:  "user.tags[0]",
			value: "tag1",
			expected: map[string]interface{}{
				"user": map[string]interface{}{
					"tags": []interface{}{"tag1"},
				},
			},
		},
		{
			name: "complex nested path",
			data: map[string]interface{}{},
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
			name: "array expansion",
			data: map[string]interface{}{},
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
			
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("SetByPath() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestBuildFromFields(t *testing.T) {
	tests := []struct {
		name   string
		fields []BodyField
		want   map[string]interface{}
	}{
		{
			name: "simple fields",
			fields: []BodyField{
				{Path: "name", Value: "John"},
				{Path: "age", Value: "30"},
			},
			want: map[string]interface{}{
				"name": "John",
				"age":  "30",
			},
		},
		{
			name: "nested fields",
			fields: []BodyField{
				{Path: "user.name", Value: "John"},
				{Path: "user.age", Value: "30"},
			},
			want: map[string]interface{}{
				"user": map[string]interface{}{
					"name": "John",
					"age":  "30",
				},
			},
		},
		{
			name: "array fields",
			fields: []BodyField{
				{Path: "tags[0]", Value: "tag1"},
				{Path: "tags[1]", Value: "tag2"},
			},
			want: map[string]interface{}{
				"tags": []interface{}{"tag1", "tag2"},
			},
		},
		{
			name: "complex nested with arrays",
			fields: []BodyField{
				{Path: "user.name", Value: "John"},
				{Path: "user.emails[0].address", Value: "home@example.com"},
				{Path: "user.emails[1].address", Value: "work@example.com"},
				{Path: "user.emails[1].type", Value: "work"},
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
			name: "empty fields",
			fields: []BodyField{},
			want:   map[string]interface{}{},
		},
		{
			name: "nil fields",
			fields: nil,
			want:   map[string]interface{}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildFromFields(tt.fields)
			if !reflect.DeepEqual(got, tt.want) {
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
			name: "empty path",
			data: map[string]interface{}{},
			path:  "",
			value: "value",
			expected: map[string]interface{}{},
		},
		{
			name: "invalid array index",
			data: map[string]interface{}{},
			path:  "items[abc]",
			value: "value",
			expected: map[string]interface{}{},
		},
		{
			name: "negative array index",
			data: map[string]interface{}{},
			path:  "items[-1]",
			value: "value",
			expected: map[string]interface{}{},
		},
		{
			name: "very large array index",
			data: map[string]interface{}{},
			path:  "items[999999]",
			value: "value",
			expected: map[string]interface{}{
				"items": make([]interface{}, 1000000),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SetByPath(tt.data, tt.path, tt.value)
			
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("SetByPath() = %v, want %v", result, tt.expected)
			}
		})
	}
}
