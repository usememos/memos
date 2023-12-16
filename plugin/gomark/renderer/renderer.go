package renderer

import (
	htmlrenderer "github.com/usememos/memos/plugin/gomark/renderer/html"
	stringrenderer "github.com/usememos/memos/plugin/gomark/renderer/string"
)

func NewHTMLRenderer() *htmlrenderer.HTMLRenderer {
	return htmlrenderer.NewHTMLRenderer()
}

func NewStringRenderer() *stringrenderer.StringRenderer {
	return stringrenderer.NewStringRenderer()
}
