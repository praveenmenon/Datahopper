package runner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/datahopper/backend/internal/registry"
)

// readTestProto reads a proto file from the repository's test_protos directory.
func readTestProto(t *testing.T, rel string) []byte {
	t.Helper()
	// Tests in this package run from backend/internal/runner, so go up 3 levels
	base := filepath.Join("..", "..", "..", "test_protos", "sample_proto_test_files")
	path := filepath.Join(base, rel)
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read test proto %s: %v", path, err)
	}
	return b
}

// setupRegistryForPaymentMethod registers the sample payment method protos into a registry service.
func setupRegistryForPaymentMethod(t *testing.T) *registry.Service {
	t.Helper()
	reg := registry.NewService()

	files := map[string][]byte{
		// Provide flat filenames; RegisterFromVirtualFS rewrites imports to these actual filenames
		"payment3_common.proto": readTestProto(t, "payment3_common.proto"),
		"common.proto":          readTestProto(t, "common.proto"),
		// The main file under test
		"payment3_paymentmethod.proto": readTestProto(t, "payment3_paymentmethod.proto"),
	}

	if err := reg.RegisterFromVirtualFS(files); err != nil {
		t.Fatalf("failed to register protos: %v", err)
	}
	return reg
}

func TestEncodeProtobufBody_TimestampMapConverted(t *testing.T) {
	reg := setupRegistryForPaymentMethod(t)
	svc := NewService(reg)

	// Construct a minimal but representative body with google.protobuf.Timestamp fields
	body := map[string]interface{}{
		"paymentMethod": map[string]interface{}{
			"paymentMethodID":  "pm_test",
			"includedInWallet": true,
			"brand":            "HSA",
			"details": map[string]interface{}{
				"type":   "PayPal",
				"paypal": map[string]interface{}{"email": "a@b.com"},
			},
			// DatabaseRecord has several timestamps; exercise at least one
			"db": map[string]interface{}{
				"createdAt": map[string]interface{}{"seconds": 6, "nanos": 7},
				"deletedAt": map[string]interface{}{"seconds": 0, "nanos": 0},
			},
			"processor": map[string]interface{}{
				"processor": "Braintree",
				"braintree": map[string]interface{}{"nonce": "n_123"},
			},
		},
	}

	// Encode; should succeed and not raise the previous protojson syntax error
	bytes, err := svc.encodeProtobufBody("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", body, nil)
	if err != nil {
		t.Fatalf("encodeProtobufBody failed: %v", err)
	}
	if len(bytes) == 0 {
		t.Fatalf("encodeProtobufBody returned empty payload")
	}

	// Decode back to JSON using the service helper and ensure Timestamp is RFC3339 string
	jsonStr, err := svc.decodeProtobufResponse("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", bytes)
	if err != nil {
		t.Fatalf("decodeProtobufResponse failed: %v", err)
	}

	// Expect RFC3339Nano representation for 6s + 7ns since epoch (spacing may vary)
	if !strings.Contains(jsonStr, "1970-01-01T00:00:06.000000007Z") {
		t.Fatalf("expected RFC3339 timestamp in JSON, got: %s", jsonStr)
	}
}

func TestEncodeProtobufBody_TimestampNestedStripeCauDate(t *testing.T) {
	reg := setupRegistryForPaymentMethod(t)
	svc := NewService(reg)

	body := map[string]interface{}{
		"paymentMethod": map[string]interface{}{
			"paymentMethodID":  "pm_test",
			"includedInWallet": true,
			"brand":            "HSA",
			"details": map[string]interface{}{
				"type":   "PayPal",
				"paypal": map[string]interface{}{"email": "a@b.com"},
			},
			"processor": map[string]interface{}{
				"processor": "Stripe",
				"stripe": map[string]interface{}{
					"cauDate": map[string]interface{}{"seconds": 6, "nanos": 7},
				},
			},
		},
	}

	bytes, err := svc.encodeProtobufBody("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", body, nil)
	if err != nil {
		t.Fatalf("encodeProtobufBody failed: %v", err)
	}
	if len(bytes) == 0 {
		t.Fatalf("encodeProtobufBody returned empty payload")
	}

	jsonStr, err := svc.decodeProtobufResponse("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", bytes)
	if err != nil {
		t.Fatalf("decodeProtobufResponse failed: %v", err)
	}

	if !strings.Contains(jsonStr, "1970-01-01T00:00:06.000000007Z") {
		t.Fatalf("expected RFC3339 cauDate in JSON, got: %s", jsonStr)
	}
}

func TestEncodeProtobufBody_StringCoercionForNumbers(t *testing.T) {
	reg := setupRegistryForPaymentMethod(t)
	svc := NewService(reg)

	// contractID is a string in proto. Provide it as a number and ensure it is coerced.
	body := map[string]interface{}{
		"paymentMethod": map[string]interface{}{
			"paymentMethodID": "pm_test",
			"brand":           "HSA",
			"details": map[string]interface{}{
				"type":   "PayPal",
				"paypal": map[string]interface{}{"email": "a@b.com"},
			},
			"owner": map[string]interface{}{
				"ownerIdentity": map[string]interface{}{
					"type": "ContractIdentityType",
					"contractIdentity": map[string]interface{}{
						"contractID": 123456788,
					},
				},
			},
		},
	}

	bytes, err := svc.encodeProtobufBody("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", body, nil)
	if err != nil {
		t.Fatalf("encodeProtobufBody failed: %v", err)
	}
	if len(bytes) == 0 {
		t.Fatalf("encodeProtobufBody returned empty payload")
	}

	jsonStr, err := svc.decodeProtobufResponse("payment3_paymentmethodpb.CreateUpdatePaymentMethodRequest", bytes)
	if err != nil {
		t.Fatalf("decodeProtobufResponse failed: %v", err)
	}

	// Be tolerant of pretty-print spacing
	if !(strings.Contains(jsonStr, "\"contractID\"") && strings.Contains(jsonStr, "\"123456788\"")) {
		t.Fatalf("expected numeric contractID to be coerced to string, got: %s", jsonStr)
	}
}
