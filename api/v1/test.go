package v1

import "github.com/labstack/echo/v4"

func (*APIV1Service) registerTestRoutes(g *echo.Group) {
	g.GET("/test", func(c echo.Context) error {
		return c.String(200, "Hello World")
	})
}
