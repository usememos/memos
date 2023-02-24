package server

import (
	"context"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

type jwtCustomClaims struct {
	UserID    int    `json:"userId"`
	SessionID string `json:"sessionId"`
	jwt.RegisteredClaims
}

func (s *Server) issueJWT(ctx context.Context, claims *jwtCustomClaims) (string, error) {
	claims = &jwtCustomClaims{
		UserID:    claims.UserID,
		SessionID: claims.SessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "memos",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	secret, err := s.getSystemSecretSessionName(ctx)
	if err != nil {
		return "", err
	}

	t, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return t, nil
}

func (s *Server) verifyJWT(ctx context.Context, token string) (*jwtCustomClaims, error) {
	secret, err := s.getSystemSecretSessionName(ctx)
	if err != nil {
		return nil, err
	}

	claims := &jwtCustomClaims{}
	t, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if !t.Valid {
		return nil, jwt.ErrInvalidKey
	}

	return claims, nil
}
