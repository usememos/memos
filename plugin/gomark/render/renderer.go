package render

import (
	htmlrender "github.com/usememos/memos/plugin/gomark/render/html"
	stringrender "github.com/usememos/memos/plugin/gomark/render/string"
)

func NewHTMLRender() *htmlrender.HTMLRender {
	return htmlrender.NewHTMLRender()
}

func NewStringRender() *stringrender.StringRender {
	return stringrender.NewStringRender()
}
