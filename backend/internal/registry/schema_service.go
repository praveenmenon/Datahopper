package registry

import (
	"fmt"
	"crypto/sha256"
	"encoding/hex"

	"google.golang.org/protobuf/reflect/protoreflect"
)

// SchemaService provides comprehensive protobuf schema metadata
type SchemaService struct {
	registry *Service
}

// NewSchemaService creates a new schema service
func NewSchemaService(registry *Service) *SchemaService {
	return &SchemaService{
		registry: registry,
	}
}

// MessageSchema represents comprehensive schema metadata for a message
type MessageSchema struct {
	FQMN           string                 `json:"fqmn"`           // Fully qualified message name
	DescriptorHash string                 `json:"descriptorHash"` // Hash for cache invalidation
	Fields         []FieldSchema          `json:"fields"`         // Field metadata
	Oneofs         []OneofGroup           `json:"oneofs"`         // Oneof group definitions
	WKT            *WellKnownType        `json:"wkt,omitempty"`   // Well-known type info
	ReservedNumbers []int32               `json:"reservedNumbers,omitempty"`
	ReservedNames   []string              `json:"reservedNames,omitempty"`
}

// FieldSchema represents comprehensive field metadata
type FieldSchema struct {
	Name           string                 `json:"name"`           // Proto field name
	JSONName       string                 `json:"jsonName"`       // JSON field name
	Number         int32                  `json:"number"`         // Field number
	Kind           string                 `json:"kind"`           // Field kind (string, int32, message, etc.)
	Cardinality    string                 `json:"cardinality"`    // optional, repeated, map
	HasPresence    bool                   `json:"hasPresence"`    // Whether field supports presence
	DefaultValue   interface{}            `json:"defaultValue"`   // Computed default value
	OneofIndex     *int32                 `json:"oneofIndex"`     // Oneof group index (null if not in oneof)
	Deprecated     bool                   `json:"deprecated"`     // Whether field is deprecated
	MessageFQMN    *string                `json:"messageFqmn,omitempty"` // For message fields
	Enum           *EnumSchema            `json:"enum,omitempty"` // For enum fields
	Map            *MapSchema             `json:"map,omitempty"`  // For map fields
	WKT            *WellKnownType        `json:"wkt,omitempty"`   // Well-known type info
	Constraints    *ValidationConstraints `json:"constraints,omitempty"` // Validation hints
	BytesHint      *string                `json:"bytesHint,omitempty"`   // For bytes fields
}

// OneofGroup represents a oneof group definition
type OneofGroup struct {
	Index  int32    `json:"index"`  // Oneof group index
	Name   string   `json:"name"`   // Oneof group name
	Fields []string `json:"fields"` // Field names in this oneof
}

// EnumSchema represents enum metadata
type EnumSchema struct {
	Name   string       `json:"name"`   // Enum name
	Values []EnumValue  `json:"values"` // Enum values
}

// EnumValue represents an enum value
type EnumValue struct {
	Name       string `json:"name"`       // Enum value name
	Number     int32  `json:"number"`     // Enum value number
	Deprecated bool   `json:"deprecated"` // Whether value is deprecated
}

// MapSchema represents map field metadata
type MapSchema struct {
	KeyKind   string  `json:"keyKind"`   // Key type kind
	ValueKind string  `json:"valueKind"` // Value type kind
	ValueFQMN *string `json:"valueFqmn,omitempty"` // For message value types
}

// WellKnownType represents well-known type information
type WellKnownType struct {
	Type   string `json:"type"`   // WKT type (Timestamp, Duration, etc.)
	Format string `json:"format"` // Format hint (RFC3339, etc.)
}

// ValidationConstraints represents validation hints
type ValidationConstraints struct {
	MinLen   *int32    `json:"minLen,omitempty"`
	MaxLen   *int32    `json:"maxLen,omitempty"`
	Min      *float64  `json:"min,omitempty"`
	Max      *float64  `json:"max,omitempty"`
	Pattern  *string   `json:"pattern,omitempty"`
	Required *bool     `json:"required,omitempty"`
	In       []string  `json:"in,omitempty"`
	NotIn    []string  `json:"notIn,omitempty"`
}

// GetMessageSchema returns comprehensive schema metadata for a message
func (s *SchemaService) GetMessageSchema(fqmn string) (*MessageSchema, error) {
	// First try to find the message in our registry
	msgDesc, err := s.registry.GetMessageDescriptor(fqmn)
	if err != nil {
		return nil, fmt.Errorf("message not found: %s", fqmn)
	}

	schema := &MessageSchema{
		FQMN:           fqmn,
		DescriptorHash: s.computeDescriptorHash(msgDesc),
		Fields:         make([]FieldSchema, 0),
		Oneofs:         make([]OneofGroup, 0),
	}

	// Process fields
	fields := msgDesc.Fields()
	for i := 0; i < fields.Len(); i++ {
		field := fields.Get(i)
		fieldSchema := s.buildFieldSchema(field)
		schema.Fields = append(schema.Fields, fieldSchema)
	}

	// Process oneofs
	oneofs := msgDesc.Oneofs()
	for i := 0; i < oneofs.Len(); i++ {
		oneof := oneofs.Get(i)
		oneofGroup := s.buildOneofGroup(oneof, fields)
		schema.Oneofs = append(schema.Oneofs, oneofGroup)
	}

	// Check if this is a well-known type
	if wkt := s.detectWellKnownType(fqmn); wkt != nil {
		schema.WKT = wkt
	}

	// Add reserved information
	schema.ReservedNumbers = s.getReservedNumbers(msgDesc)
	schema.ReservedNames = s.getReservedNames(msgDesc)

	return schema, nil
}

// buildFieldSchema builds comprehensive field metadata
func (s *SchemaService) buildFieldSchema(field protoreflect.FieldDescriptor) FieldSchema {
	fieldSchema := FieldSchema{
		Name:        string(field.Name()),
		JSONName:    field.JSONName(),
		Number:      int32(field.Number()),
		Kind:        field.Kind().String(),
		Cardinality: s.getCardinality(field),
		HasPresence: field.HasPresence(),
		DefaultValue: s.getDefaultValue(field),
		Deprecated:  false, // TODO: Implement proper deprecation detection
	}

	// Handle oneof fields
	if oneof := field.ContainingOneof(); oneof != nil {
		index := int32(oneof.Index())
		fieldSchema.OneofIndex = &index
	}

	// Handle message fields
	if field.Message() != nil {
		fqmn := string(field.Message().FullName())
		fieldSchema.MessageFQMN = &fqmn
		
		// Check for well-known types
		if wkt := s.detectWellKnownType(fqmn); wkt != nil {
			fieldSchema.WKT = wkt
		}
	}

	// Handle enum fields
	if field.Enum() != nil {
		fieldSchema.Enum = s.buildEnumSchema(field.Enum())
	}

	// Handle map fields
	if field.IsMap() {
		fieldSchema.Map = s.buildMapSchema(field)
	}

	// Handle bytes fields
	if field.Kind() == protoreflect.BytesKind {
		hint := "base64"
		fieldSchema.BytesHint = &hint
	}

	return fieldSchema
}

// buildOneofGroup builds oneof group metadata
func (s *SchemaService) buildOneofGroup(oneof protoreflect.OneofDescriptor, fields protoreflect.FieldDescriptors) OneofGroup {
	group := OneofGroup{
		Index:  int32(oneof.Index()),
		Name:   string(oneof.Name()),
		Fields: make([]string, 0),
	}

	// Find all fields in this oneof
	for i := 0; i < fields.Len(); i++ {
		field := fields.Get(i)
		if field.ContainingOneof() == oneof {
			group.Fields = append(group.Fields, string(field.Name()))
		}
	}

	return group
}

// buildEnumSchema builds enum metadata
func (s *SchemaService) buildEnumSchema(enum protoreflect.EnumDescriptor) *EnumSchema {
	enumSchema := &EnumSchema{
		Name:   string(enum.Name()),
		Values: make([]EnumValue, 0),
	}

	values := enum.Values()
	for i := 0; i < values.Len(); i++ {
		value := values.Get(i)
		enumValue := EnumValue{
			Name:       string(value.Name()),
			Number:     int32(value.Number()),
			Deprecated: false, // TODO: Implement proper deprecation detection
		}
		enumSchema.Values = append(enumSchema.Values, enumValue)
	}

	return enumSchema
}

// buildMapSchema builds map field metadata
func (s *SchemaService) buildMapSchema(field protoreflect.FieldDescriptor) *MapSchema {
	mapSchema := &MapSchema{
		KeyKind:   field.MapKey().Kind().String(),
		ValueKind: field.MapValue().Kind().String(),
	}

	// Handle message value types
	if field.MapValue().Message() != nil {
		fqmn := string(field.MapValue().Message().FullName())
		mapSchema.ValueFQMN = &fqmn
	}

	return mapSchema
}

// getCardinality determines the cardinality of a field
func (s *SchemaService) getCardinality(field protoreflect.FieldDescriptor) string {
	if field.IsMap() {
		return "map"
	}
	if field.IsList() {
		return "repeated"
	}
	return "optional"
}

// getDefaultValue computes the default value for a field
func (s *SchemaService) getDefaultValue(field protoreflect.FieldDescriptor) interface{} {
	switch field.Kind() {
	case protoreflect.BoolKind:
		return false
	case protoreflect.Int32Kind, protoreflect.Int64Kind, protoreflect.Sint32Kind, protoreflect.Sint64Kind,
		 protoreflect.Uint32Kind, protoreflect.Uint64Kind, protoreflect.Fixed32Kind, protoreflect.Fixed64Kind,
		 protoreflect.Sfixed32Kind, protoreflect.Sfixed64Kind:
		return 0
	case protoreflect.FloatKind, protoreflect.DoubleKind:
		return 0.0
	case protoreflect.StringKind:
		return ""
	case protoreflect.BytesKind:
		return ""
	case protoreflect.EnumKind:
		// Return the first enum value
		if field.Enum() != nil && field.Enum().Values().Len() > 0 {
			return field.Enum().Values().Get(0).Name()
		}
		return ""
	case protoreflect.MessageKind:
		return nil
	default:
		return nil
	}
}

// detectWellKnownType detects if a type is a well-known type
func (s *SchemaService) detectWellKnownType(fqmn string) *WellKnownType {
	switch fqmn {
	case "google.protobuf.Timestamp":
		return &WellKnownType{Type: "Timestamp", Format: "RFC3339"}
	case "google.protobuf.Duration":
		return &WellKnownType{Type: "Duration", Format: "[-]Ns"}
	case "google.protobuf.Struct":
		return &WellKnownType{Type: "Struct", Format: "JSON"}
	case "google.protobuf.Value":
		return &WellKnownType{Type: "Value", Format: "JSON"}
	case "google.protobuf.Any":
		return &WellKnownType{Type: "Any", Format: "typeUrl + value"}
	case "google.protobuf.Int32Value", "google.protobuf.Int64Value",
		 "google.protobuf.UInt32Value", "google.protobuf.UInt64Value",
		 "google.protobuf.FloatValue", "google.protobuf.DoubleValue",
		 "google.protobuf.BoolValue", "google.protobuf.StringValue",
		 "google.protobuf.BytesValue":
		return &WellKnownType{Type: "Wrapper", Format: "scalar with presence"}
	}
	return nil
}

// computeDescriptorHash computes a hash for cache invalidation
func (s *SchemaService) computeDescriptorHash(msgDesc protoreflect.MessageDescriptor) string {
	// Stable hash from message fullname and field count
	h := sha256.New()
	_, _ = h.Write([]byte(string(msgDesc.FullName())))
	_, _ = h.Write([]byte(fmt.Sprintf("|%d", msgDesc.Fields().Len())))
	return hex.EncodeToString(h.Sum(nil))
}

// getReservedNumbers gets reserved field numbers
func (s *SchemaService) getReservedNumbers(msgDesc protoreflect.MessageDescriptor) []int32 {
	// This would need to be implemented based on the specific protobuf library
	// For now, return empty slice
	return []int32{}
}

// getReservedNames gets reserved field names
func (s *SchemaService) getReservedNames(msgDesc protoreflect.MessageDescriptor) []string {
	// This would need to be implemented based on the specific protobuf library
	// For now, return empty slice
	return []string{}
}
