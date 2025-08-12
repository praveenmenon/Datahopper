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
func SetByPath(root map[string]interface{}, path string, value interface{}) error {
	parts := strings.Split(path, ".")
	
	current := root
	for i, part := range parts {
		if i == len(parts)-1 {
			// Last part - set the value
			if isArrayAccess(part) {
				return setArrayValue(current, part, value)
			}
			current[part] = value
			return nil
		}
		
		// Navigate to next level
		if isArrayAccess(part) {
			next, err := getOrCreateArrayElement(current, part)
			if err != nil {
				return err
			}
			current = next
		} else {
			next, err := getOrCreateMap(current, part)
			if err != nil {
				return err
			}
			current = next
		}
	}
	
	return nil
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
	
	// Extend array if needed
	for len(arr) <= index {
		arr = append(arr, make(map[string]interface{}))
	}
	
	// Get element at index
	element := arr[index]
	if mapElement, ok := element.(map[string]interface{}); ok {
		return mapElement, nil
	}
	
	// Create new map if element is not a map
	newMap := make(map[string]interface{})
	arr[index] = newMap
	current[key] = arr
	return newMap, nil
}

// setArrayValue sets a value in an array
func setArrayValue(current map[string]interface{}, part string, value interface{}) error {
	key, index, err := parseArrayAccess(part)
	if err != nil {
		return err
	}
	
	// Get or create array
	var arr []interface{}
	if val, exists := current[key]; exists {
		if arrayVal, ok := val.([]interface{}); ok {
			arr = arrayVal
		} else {
			return fmt.Errorf("key %s is not an array", key)
		}
	} else {
		arr = make([]interface{}, 0)
	}
	
	// Extend array if needed
	for len(arr) <= index {
		arr = append(arr, nil)
	}
	
	// Set value at index
	arr[index] = value
	current[key] = arr
	return nil
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
					if err := SetByPath(result, path, value); err != nil {
						return nil, fmt.Errorf("failed to set %s: %w", path, err)
					}
					paths[path] = value
				} else {
					if err := SetByPath(result, path, value); err != nil {
						return nil, fmt.Errorf("failed to set %s: %w", path, err)
					}
					paths[path] = value
				}
			}
		}
	}
	
	return result, nil
}

// coerceValue attempts to convert string inputs into appropriate JSON-native types
// - "true"/"false" -> bool
// - numeric strings -> float64 (JSON number)
// - "null" -> nil
// - JSON objects/arrays -> map[string]interface{} / []interface{}
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

    // Try to parse as a JSON literal (bool/number/null or quoted string)
    var v interface{}
    if err := json.Unmarshal([]byte(str), &v); err == nil {
        return v
    }

    return s
}
