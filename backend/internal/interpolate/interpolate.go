package interpolate

import (
	"regexp"
	"strings"
)

var varRegex = regexp.MustCompile(`\{\{([^}]+)\}\}`)

// String replaces {{var}} placeholders in a string with values from the variables map
func String(s string, vars map[string]string) string {
	return varRegex.ReplaceAllStringFunc(s, func(match string) string {
		// Extract variable name from {{var}}
		varName := strings.Trim(match, "{}")
		if value, exists := vars[varName]; exists {
			return value
		}
		// Return original if variable not found
		return match
	})
}

// Deep recursively interpolates strings in any data structure
func Deep(v interface{}, vars map[string]string) interface{} {
	switch val := v.(type) {
	case string:
		return String(val, vars)
	case []interface{}:
		result := make([]interface{}, len(val))
		for i, item := range val {
			result[i] = Deep(item, vars)
		}
		return result
	case map[string]interface{}:
		result := make(map[string]interface{})
		for k, v := range val {
			result[k] = Deep(v, vars)
		}
		return result
	case map[string]string:
		result := make(map[string]string)
		for k, v := range val {
			result[k] = String(v, vars)
		}
		return result
	default:
		return v
	}
}

// MergeVariables merges multiple variable maps with priority order
// Later maps override earlier ones
func MergeVariables(vars ...map[string]string) map[string]string {
	result := make(map[string]string)
	
	for _, varMap := range vars {
		for k, v := range varMap {
			result[k] = v
		}
	}
	
	return result
}

// ExtractVariables finds all {{var}} placeholders in a string
func ExtractVariables(s string) []string {
	matches := varRegex.FindAllStringSubmatch(s, -1)
	result := make([]string, 0, len(matches))
	
	for _, match := range matches {
		if len(match) > 1 {
			result = append(result, match[1])
		}
	}
	
	return result
}

// ValidateVariables checks if all required variables are provided
func ValidateVariables(s string, vars map[string]string) []string {
	required := ExtractVariables(s)
	missing := make([]string, 0)
	
	for _, varName := range required {
		if _, exists := vars[varName]; !exists {
			missing = append(missing, varName)
		}
	}
	
	return missing
}
