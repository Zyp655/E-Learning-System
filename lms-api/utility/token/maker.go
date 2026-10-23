package token

import "time"

type Maker interface {
	CreateToken(id int, role int, permissions string, sessionID string, duration time.Duration) (string, *Payload, error)
	VerifyToken(token string) (*Payload, error)
}
