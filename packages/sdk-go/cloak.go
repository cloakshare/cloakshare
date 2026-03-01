// Package cloak provides the official Go SDK for Cloak — secure document sharing.
package cloak

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://api.cloakshare.dev"
	defaultTimeout = 30 * time.Second
	maxRetries     = 3
)

// Client is the Cloak API client.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new Cloak API client.
func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: defaultBaseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Option configures the client.
type Option func(*Client)

// WithBaseURL sets a custom base URL.
func WithBaseURL(url string) Option {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(url, "/")
	}
}

// WithTimeout sets the HTTP client timeout.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

// APIError represents an error from the Cloak API.
type APIError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
	RetryAfter int    `json:"retry_after,omitempty"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("cloak: %s (%s, HTTP %d)", e.Message, e.Code, e.StatusCode)
}

// apiResponse wraps all API responses.
type apiResponse struct {
	Data  json.RawMessage `json:"data"`
	Error *APIError       `json:"error"`
}

func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (json.RawMessage, error) {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			jitter := time.Duration(rand.Float64()*float64(delay) * 0.5)
			time.Sleep(delay + jitter)
		}

		var reqBody io.Reader
		if body != nil {
			b, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("cloak: marshal request: %w", err)
			}
			reqBody = bytes.NewReader(b)
		}

		req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
		if err != nil {
			return nil, fmt.Errorf("cloak: create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("cloak: request failed: %w", err)
			if attempt < maxRetries {
				continue
			}
			break
		}

		defer resp.Body.Close()
		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("cloak: read response: %w", err)
			if attempt < maxRetries {
				continue
			}
			break
		}

		if resp.StatusCode == 429 {
			retryAfter, _ := strconv.Atoi(resp.Header.Get("Retry-After"))
			if retryAfter == 0 {
				retryAfter = 60
			}
			if attempt < maxRetries {
				time.Sleep(time.Duration(retryAfter) * time.Second)
				continue
			}
			var apiResp apiResponse
			json.Unmarshal(respBody, &apiResp)
			apiErr := &APIError{Code: "RATE_LIMITED", Message: "Rate limited", StatusCode: 429, RetryAfter: retryAfter}
			if apiResp.Error != nil {
				apiErr = apiResp.Error
				apiErr.StatusCode = 429
				apiErr.RetryAfter = retryAfter
			}
			return nil, apiErr
		}

		if resp.StatusCode >= 500 && attempt < maxRetries {
			lastErr = &APIError{Code: "SERVER_ERROR", Message: fmt.Sprintf("Server error: %d", resp.StatusCode), StatusCode: resp.StatusCode}
			continue
		}

		var apiResp apiResponse
		if err := json.Unmarshal(respBody, &apiResp); err != nil {
			return nil, fmt.Errorf("cloak: parse response: %w", err)
		}

		if apiResp.Error != nil {
			apiResp.Error.StatusCode = resp.StatusCode
			return nil, apiResp.Error
		}

		return apiResp.Data, nil
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("cloak: request failed after %d retries", maxRetries)
}

// Link represents a Cloak secure link.
type Link struct {
	ID           string                 `json:"id"`
	SecureURL    string                 `json:"secure_url"`
	AnalyticsURL string                 `json:"analytics_url"`
	ProgressURL  string                 `json:"progress_url"`
	Name         *string                `json:"name"`
	FileType     string                 `json:"file_type"`
	Status       string                 `json:"status"`
	Rules        map[string]interface{} `json:"rules"`
	ViewCount    int                    `json:"view_count"`
	CreatedAt    string                 `json:"created_at"`
}

// CreateLinkParams are the parameters for creating a link.
type CreateLinkParams struct {
	UploadR2Key  string   `json:"upload_r2_key,omitempty"`
	Filename     string   `json:"filename,omitempty"`
	Name         string   `json:"name,omitempty"`
	ExpiresIn    string   `json:"expires_in,omitempty"`
	MaxViews     *int     `json:"max_views,omitempty"`
	RequireEmail *bool    `json:"require_email,omitempty"`
	Password     string   `json:"password,omitempty"`
	BlockDownload *bool   `json:"block_download,omitempty"`
}

// CreateLink creates a new secure link.
func (c *Client) CreateLink(ctx context.Context, params CreateLinkParams) (*Link, error) {
	data, err := c.doRequest(ctx, "POST", "/v1/links", params)
	if err != nil {
		return nil, err
	}
	var link Link
	if err := json.Unmarshal(data, &link); err != nil {
		return nil, fmt.Errorf("cloak: parse link: %w", err)
	}
	return &link, nil
}

// GetLink retrieves link details.
func (c *Client) GetLink(ctx context.Context, id string) (*Link, error) {
	data, err := c.doRequest(ctx, "GET", "/v1/links/"+id, nil)
	if err != nil {
		return nil, err
	}
	var link Link
	if err := json.Unmarshal(data, &link); err != nil {
		return nil, fmt.Errorf("cloak: parse link: %w", err)
	}
	return &link, nil
}

// RevokeLink revokes a secure link.
func (c *Client) RevokeLink(ctx context.Context, id string) error {
	_, err := c.doRequest(ctx, "DELETE", "/v1/links/"+id, nil)
	return err
}

// VerifyWebhook verifies a Cloak webhook signature.
func VerifyWebhook(payload, signature, secret string, toleranceSeconds int) bool {
	parts := make(map[string]string)
	for _, p := range strings.Split(signature, ",") {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) == 2 {
			parts[kv[0]] = kv[1]
		}
	}

	ts, ok := parts["t"]
	if !ok {
		return false
	}
	sig, ok := parts["v1"]
	if !ok {
		return false
	}

	timestamp, err := strconv.ParseInt(ts, 10, 64)
	if err != nil {
		return false
	}

	now := time.Now().Unix()
	if abs(now-timestamp) > int64(toleranceSeconds) {
		return false
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(fmt.Sprintf("%s.%s", ts, payload)))
	expected := hex.EncodeToString(mac.Sum(nil))

	sigBytes, err := hex.DecodeString(sig)
	if err != nil {
		return false
	}
	expectedBytes, err := hex.DecodeString(expected)
	if err != nil {
		return false
	}

	return hmac.Equal(sigBytes, expectedBytes)
}

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}
