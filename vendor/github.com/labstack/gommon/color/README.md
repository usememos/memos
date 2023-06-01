# Color

Style terminal text.

## Installation

```sh
go get github.com/labstack/gommon/color
```

## Windows?

Try [cmder](http://bliker.github.io/cmder) or https://github.com/mattn/go-colorable

## [Usage](https://github.com/labstack/gommon/blob/master/color/color_test.go)

```sh
import github.com/labstack/gommon/color
```

### Colored text

```go
color.Println(color.Black("black"))
color.Println(color.Red("red"))
color.Println(color.Green("green"))
color.Println(color.Yellow("yellow"))
color.Println(color.Blue("blue"))
color.Println(color.Magenta("magenta"))
color.Println(color.Cyan("cyan"))
color.Println(color.White("white"))
color.Println(color.Grey("grey"))
```
![Colored Text](http://i.imgur.com/8RtY1QR.png)

### Colored background

```go
color.Println(color.BlackBg("black background", color.Wht))
color.Println(color.RedBg("red background"))
color.Println(color.GreenBg("green background"))
color.Println(color.YellowBg("yellow background"))
color.Println(color.BlueBg("blue background"))
color.Println(color.MagentaBg("magenta background"))
color.Println(color.CyanBg("cyan background"))
color.Println(color.WhiteBg("white background"))
```
![Colored Background](http://i.imgur.com/SrrS6lw.png)

### Emphasis

```go
color.Println(color.Bold("bold"))
color.Println(color.Dim("dim"))
color.Println(color.Italic("italic"))
color.Println(color.Underline("underline"))
color.Println(color.Inverse("inverse"))
color.Println(color.Hidden("hidden"))
color.Println(color.Strikeout("strikeout"))
```
![Emphasis](http://i.imgur.com/3RSJBbc.png)

### Mix and match

```go
color.Println(color.Green("bold green with white background", color.B, color.WhtBg))
color.Println(color.Red("underline red", color.U))
color.Println(color.Yellow("dim yellow", color.D))
color.Println(color.Cyan("inverse cyan", color.In))
color.Println(color.Blue("bold underline dim blue", color.B, color.U, color.D))
```
![Mix and match](http://i.imgur.com/jWGq9Ca.png)

### Enable/Disable the package

```go
color.Disable()
color.Enable()
```

### New instance

```go
c := New()
c.Green("green")
```
