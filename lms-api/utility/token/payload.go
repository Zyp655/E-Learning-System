package token

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Payload struct {
	Id          int       `json:"id"`
	Role        int       `json:"role"`
	Permissions string    `json:"permissions"`
	SessionID   string    `json:"session_id,omitempty"`
	IssuedAt    time.Time `json:"issuedAt"`
	Expired     int64     `json:"exp"`
	jwt.RegisteredClaims
}

func NewPayload(id int, role int, permissions string, sessionID string, duration time.Duration) *Payload {
	issuedAt := time.Now()
	expired := issuedAt.Add(duration)
	return &Payload{
		Id:          id,
		Role:        role,
		Permissions: permissions,
		SessionID:   sessionID,
		IssuedAt:    issuedAt,
		Expired:     expired.Unix(),
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(issuedAt),
			ExpiresAt: jwt.NewNumericDate(expired),
		},
	}
}

func (payload *Payload) Valid() error {
	exp := time.Unix(payload.Expired, 0)
	if time.Now().After(exp) {
		return errExpired
	}
	return nil
}
