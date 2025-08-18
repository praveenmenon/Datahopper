package dotpath

import (
    "encoding/json"
    "fmt"
    "regexp"
    "strconv"
    "strings"
)

var arrayIndexRegex = regexp.MustCompile(`^(\w+)\[(\d+)\]$`)

// SetByPath sets a value in a nested structure using dot notation
// Supports: user.id, items[0].name, user.profile.address.city
func SetByPath(root map[string]interface{}, path string, value interface{}) map[string]interface{} {
	if path == "" {
		return root
	}
	
	parts := strings.Split(path, ".")
	
	current := root
	for i, part := range parts {
		if i == len(parts)-1 {
			// Last part - set the value
			if isArrayAccess(part) {
				setArrayValue(current, part, value)
			} else if isInvalidArrayAccess(part) {
				// Invalid array access pattern, just return without doing anything
				return root
			} else {
				current[part] = value
			}
			return root
		}
		
		// Navigate to next level
		if isArrayAccess(part) {
			next, err := getOrCreateArrayElement(current, part)
			if err != nil {
				// If we can't parse the array access, just return without doing anything
				return root
			}
			current = next
		} else if isInvalidArrayAccess(part) {
			// Invalid array access pattern, just return without doing anything
			return root
		} else {
			// Create nested map if it doesn't exist
			if _, exists := current[part]; !exists {
				current[part] = make(map[string]interface{})
			}
			if next, ok := current[part].(map[string]interface{}); ok {
				current = next
			} else {
				// If the key exists but is not a map, just return without doing anything
				return root
			}
		}
	}
	
	return root
}

// GetByPath retrieves a value from a nested structure using dot notation
func GetByPath(root map[string]interface{}, path string) (interface{}, error) {
	parts := strings.Split(path, ".")
	
	current := root
	for _, part := range parts {
		if isArrayAccess(part) {
			val, err := getArrayValue(current, part)
			if err != nil {
				return nil, err
			}
			current = val.(map[string]interface{})
		} else {
			val, exists := current[part]
			if !exists {
				return nil, fmt.Errorf("path not found: %s", path)
			}
			current = val.(map[string]interface{})
		}
	}
	
	return current, nil
}

// isArrayAccess checks if a path part is an array access (e.g., items[0])
func isArrayAccess(part string) bool {
	return arrayIndexRegex.MatchString(part)
}

// isInvalidArrayAccess checks if a path part looks like an array access but is invalid
// This catches patterns like items[abc], items[-1], items[1.5], etc.
func isInvalidArrayAccess(part string) bool {
	// Check if it looks like array access but doesn't match the valid pattern
	if strings.Contains(part, "[") && strings.Contains(part, "]") {
		return !arrayIndexRegex.MatchString(part)
	}
	return false
}

// parseArrayAccess extracts the key and index from array access notation
func parseArrayAccess(part string) (string, int, error) {
	matches := arrayIndexRegex.FindStringSubmatch(part)
	if len(matches) != 3 {
		return "", 0, fmt.Errorf("invalid array access format: %s", part)
	}
	
	key := matches[1]
	index, err := strconv.Atoi(matches[2])
	if err != nil {
		return "", 0, fmt.Errorf("invalid array index: %s", matches[2])
	}
	
	return key, index, nil
}

// getOrCreateMap gets or creates a map at the specified key
func getOrCreateMap(current map[string]interface{}, key string) (map[string]interface{}, error) {
	if val, exists := current[key]; exists {
		if mapVal, ok := val.(map[string]interface{}); ok {
			return mapVal, nil
		}
		return nil, fmt.Errorf("key %s is not a map", key)
	}
	
	// Create new map
	newMap := make(map[string]interface{})
	current[key] = newMap
	return newMap, nil
}

// getOrCreateArrayElement gets or creates an array element
func getOrCreateArrayElement(current map[string]interface{}, part string) (map[string]interface{}, error) {
	key, index, err := parseArrayAccess(part)
	if err != nil {
		return nil, err
	}
	
	// Handle negative indices
	if index < 0 {
		return nil, fmt.Errorf("negative array index: %d", index)
	}
	
	// Get or create array
	var arr []interface{}
	if val, exists := current[key]; exists {
		if arrayVal, ok := val.([]interface{}); ok {
			arr = arrayVal
		} else {
			return nil, fmt.Errorf("key %s is not an array", key)
		}
	} else {
		arr = make([]interface{}, 0)
		current[key] = arr
	}
	
	// Extend array if needed - create array with exact size needed
	if index >= len(arr) {
		newArr := make([]interface{}, index+1)
		copy(newArr, arr)
		arr = newArr
		current[key] = arr
	}
	
	// Get or create element at index
	var element map[string]interface{}
	if arr[index] == nil {
		element = make(map[string]interface{})
		arr[index] = element
	} else if mapVal, ok := arr[index].(map[string]interface{}); ok {
		element = mapVal
	} else {
		return nil, fmt.Errorf("element at index %d is not a map", index)
	}
	
	return element, nil
}

// setArrayValue sets a value in an array
func setArrayValue(current map[string]interface{}, part string, value interface{}) {
	key, index, err := parseArrayAccess(part)
	if err != nil {
		// If we can't parse the array access, just return without doing anything
		return
	}
	
	// Handle negative indices
	if index < 0 {
		return
	}
	
	// Get or create array
	var arr []interface{}
	if val, exists := current[key]; exists {
		if arrayVal, ok := val.([]interface{}); ok {
			arr = arrayVal
		} else {
			// If the key exists but is not an array, just return without doing anything
			return
		}
	} else {
		arr = make([]interface{}, 0)
	}
	
	// Extend array if needed - create array with exact size needed
	if index >= len(arr) {
		newArr := make([]interface{}, index+1)
		copy(newArr, arr)
		arr = newArr
		current[key] = arr
	}
	
	// Set value at index
	arr[index] = value
}

// getArrayValue gets a value from an array
func getArrayValue(current map[string]interface{}, part string) (interface{}, error) {
	key, index, err := parseArrayAccess(part)
	if err != nil {
		return nil, err
	}
	
	val, exists := current[key]
	if !exists {
		return nil, fmt.Errorf("array key %s not found", key)
	}
	
	arr, ok := val.([]interface{})
	if !ok {
		return nil, fmt.Errorf("key %s is not an array", key)
	}
	
	if index >= len(arr) {
		return nil, fmt.Errorf("array index %d out of bounds", index)
	}
	
	return arr[index], nil
}

// BuildFromFields builds a nested structure from a list of body fields
func BuildFromFields(fields []interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{})
	
	// Track all paths to detect potential conflicts
	paths := make(map[string]interface{})
	
	for _, field := range fields {
		if bodyField, ok := field.(map[string]interface{}); ok {
			path, pathOk := bodyField["path"].(string)
			value, valueOk := bodyField["value"]
			
			if pathOk && valueOk {
                // Coerce common literal types from strings (bool, number, null, JSON objects/arrays)
                value = coerceValue(value)
				// Check for potential conflicts with existing paths
				if _, exists := paths[path]; exists {
					// If the same path is set multiple times, use the last value
					// This helps with oneof field conflicts
					SetByPath(result, path, value)
					paths[path] = value
				} else {
					SetByPath(result, path, value)
					paths[path] = value
				}
			}
		}
	}
	
	return result, nil
}

// coerceValue attempts to convert string inputs into appropriate JSON-native types
// - "true"/"false" -> bool
// - "null" -> nil
// - JSON objects/arrays -> map[string]interface{} / []interface{}
// - Simple strings (like "4444") remain as strings and are NOT converted to numbers
// Otherwise returns the original value
func coerceValue(val interface{}) interface{} {
    s, ok := val.(string)
    if !ok {
        return val
    }
    str := strings.TrimSpace(s)
    if str == "" {
        return s
    }

    // Fast path for objects/arrays
    if strings.HasPrefix(str, "{") || strings.HasPrefix(str, "[") {
        var v interface{}
        if err := json.Unmarshal([]byte(str), &v); err == nil {
            return v
        }
        return s
    }

    // Only coerce JSON literals (bool/null/number)
    if str == "true" {
        return true
    }
    if str == "false" {
        return false
    }
    if str == "null" {
        return nil
    }

    // Attempt to parse as a JSON number (e.g., 30, 1.25, 1e3)
    // json.Unmarshal will convert JSON numbers to float64
    var num interface{}
    if err := json.Unmarshal([]byte(str), &num); err == nil {
        switch num.(type) {
        case float64:
            return num
        }
    }

    // Return the original string for everything else
    return s
}

