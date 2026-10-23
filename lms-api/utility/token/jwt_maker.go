package token

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const minSecretKeySize = 16

var (
	errInvalid = fmt.Errorf("token is invalid")
	errExpired = fmt.Errorf("token is expired")
)

type JWTMaker struct {
	secretKey string
}

func NewJWTMaker(secretKey string) (Maker, error) {
	if len(secretKey) < minSecretKeySize {
		return nil, fmt.Errorf("invalid key size: must be at least %d characters", minSecretKeySize)
	}
	return &JWTMaker{secretKey: secretKey}, nil
}

func (maker *JWTMaker) CreateToken(id int, role int, permissions string, sessionID string, duration time.Duration) (string, *Payload, error) {
	payload := NewPayload(id, role, permissions, sessionID, duration)
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)
	tokenStr, err := jwtToken.SignedString([]byte(maker.secretKey))
	return tokenStr, payload, err
}

func (maker *JWTMaker) VerifyToken(tokenStr string) (*Payload, error) {
	keyFunc := func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errInvalid
		}
		return []byte(maker.secretKey), nil
	}

	jwtToken, err := jwt.ParseWithClaims(tokenStr, &Payload{}, keyFunc)
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, errExpired
		}
		return nil, errInvalid
	}

	payload, ok := jwtToken.Claims.(*Payload)
	if !ok {
		return nil, errInvalid
	}
	if err := payload.Valid(); err != nil {
		return nil, err
	}
	return payload, nil
}
