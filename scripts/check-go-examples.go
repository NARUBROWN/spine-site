// Check syntax of Korean Go examples, including documented partial excerpts.
// This is a syntax check; executable examples require separate runtime tests.
package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var fences = regexp.MustCompile("(?ms)^```go\\n(.*?)^```[ \\t]*$")
var pseudocode = regexp.MustCompile(`\{\s*\.\.\.\s*\}`)

func valid(source string) bool {
	_, err := parser.ParseFile(token.NewFileSet(), "example.go", source, parser.AllErrors)
	return err == nil
}

func splitStatements(source, marker string) string {
	pos := strings.Index(source, marker)
	if pos < 0 {
		return ""
	}
	return "package example\n" + source[:pos] + "\nfunc example() {\n" + source[pos:] + "\n}\n"
}

// Some documentation blocks combine declarations and excerpts used inside a
// function, or show fields within an enclosing boot.Options literal.
func contextual(path, source string) string {
	switch {
	case strings.HasSuffix(path, "learn/core-concepts/httperr.md") && strings.Contains(source, "func WithCause("):
		return splitStatements(source, "user, err :=")
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "func NewOrderConsumer()") && strings.Contains(source, "app.Constructor("):
		return splitStatements(source, "app.Constructor(")
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "route.WithInterceptors(&LoggingInterceptor{})"):
		return splitStatements(source, "app.Route(")
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "echoplatform.WithEcho(fn func(*echo.Echo))"):
		return "package example\nfunc " + strings.Replace(source, "echoplatform.WithEcho", "WithEcho", 1)
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "e.Use(middleware.RequestID())"):
		return splitStatements(source, "app := spine.New(")
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "type GRPCTransport struct"):
		return splitStatements(source, "app.RegisterTransport(")
	case strings.HasSuffix(path, "reference/api/spine-app.md") && strings.Contains(source, "type PreparedApplication interface"):
		pos := strings.Index(source, "\ntype PreparedApplication")
		if pos < 0 {
			return ""
		}
		return "package example\ntype Example interface {\n" + source[:pos] + "\n}\n" + source[pos:]
	case strings.HasSuffix(path, "reference/examples/crud.md") && strings.Contains(source, "func (c *UserController) GetByID(") && strings.Contains(source, "return httpx.Response"):
		return splitStatements(source, "return httpx.Response")
	case strings.HasSuffix(path, "reference/security-configuration.md") && strings.Contains(source, "MaxConnections: 4096"):
		return "package example\nvar _ = boot.Options{\n" + source + "\n}\n"
	}
	return ""
}

func main() {
	root := "docs/ko"
	if len(os.Args) > 1 {
		root = os.Args[1]
	}
	count, partial, pseudo, failures := 0, 0, 0, 0
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".md") {
			return nil
		}
		contents, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, indexes := range fences.FindAllSubmatchIndex(contents, -1) {
			count++
			source := string(contents[indexes[2]:indexes[3]])
			if pseudocode.MatchString(source) && strings.HasSuffix(path, "learn/tutorial/3-dependency-injection.md") {
				pseudo++
				continue
			}
			forms := []string{source, "package example\n" + source, "package example\nfunc example() {\n" + source + "\n}", "package example\ntype Example interface {\n" + source + "\n}"}
			passed := false
			for _, form := range forms {
				if valid(form) {
					passed = true
					break
				}
			}
			if !passed {
				if form := contextual(filepath.ToSlash(path), source); form != "" && valid(form) {
					passed = true
					partial++
				}
			}
			if !passed {
				failures++
				line := 1 + strings.Count(string(contents[:indexes[0]]), "\n")
				fmt.Fprintf(os.Stderr, "%s:%d: Go example did not parse\n", path, line)
			}
		}
		return nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("Go examples: %d checked, %d contextual, %d pseudocode, %d failures\n", count, partial, pseudo, failures)
	if failures != 0 {
		os.Exit(1)
	}
}
