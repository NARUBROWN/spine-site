#!/usr/bin/env python3
"""Compile and test selected v0.7.1 Go excerpts with minimal supporting types.

These tests cover the marked excerpts only, not every snippet in the site.
"""
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs/ko"
GO_MOD = '''module example.com/spine-doc-snippet

go 1.25.5

require github.com/NARUBROWN/spine v0.7.1
'''


def block(path, text):
    source = (DOCS / path).read_text()
    found = [code for code in re.findall(r"^```go\n(.*?)^```", source, re.MULTILINE | re.DOTALL) if text in code]
    if len(found) != 1:
        raise AssertionError(f"expected one matching snippet in {path}, got {len(found)}")
    return found[0]


def verify(path, text, prefix, tests):
    with tempfile.TemporaryDirectory(prefix="spine-doc-snippet-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example.go").write_text(prefix + "\n" + block(path, text))
        (folder / "example_test.go").write_text(tests)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print(f"PASS {path}")


COMMON = '''package snippet
import (
    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)
type User struct { ID int64 }
type AuthUser struct{}
type Repository struct{}
func (*Repository) FindByID(id int64) (User, error) { return User{ID: id}, nil }
type UserController struct { repo *Repository }
'''
CONTEXT_TEST = '''package snippet
import (
    "errors"
    "testing"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/input"
)
type requestContext map[string]any
func (c requestContext) Get(key string) (any, bool) { value, ok := c[key]; return value, ok }
func TestContext(t *testing.T) {
    id := int64(42)
    c := &UserController{repo: &Repository{}}
    result, err := c.GetUser(requestContext{"auth.user": &AuthUser{}}, input.Path[int64](&id))
    if err != nil || result.Body.ID != 42 { t.Fatalf("got %#v, %v", result, err) }
    _, err = c.GetUser(requestContext{"auth.user": "wrong"}, input.Path[int64](&id))
    var httpErr *httperr.HTTPError
    if !errors.As(err, &httpErr) || httpErr.Status != 401 { t.Fatalf("got %v", err) }
}
'''
PIPELINE_PREFIX = '''package snippet
import (
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)
type User struct { ID int64 }
type Repository struct{}
func (*Repository) FindByID(id int64) (User, error) { return User{ID: id}, nil }
type UserController struct { repo *Repository }
'''
PIPELINE_TEST = '''package snippet
import (
    "errors"
    "testing"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/input"
)
func TestPipelineHandler(t *testing.T) {
    c := &UserController{repo: &Repository{}}
    id := int64(5)
    result, err := c.GetUser(input.Path[int64](&id))
    if err != nil || result.Body.ID != 5 { t.Fatalf("got %#v, %v", result, err) }
    id = 0
    _, err = c.GetUser(input.Path[int64](&id))
    var httpErr *httperr.HTTPError
    if !errors.As(err, &httpErr) || httpErr.Status != 400 { t.Fatalf("got %v", err) }
}
'''

ERROR_PREFIX = """package snippet
import (
    "errors"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
)
type User struct { ID int64 }
type Repository struct { failure bool; found bool }
func (r *Repository) FindByID(id int64) (User, error) { if r.failure { return User{}, errors.New("failure") }; return User{ID: id}, nil }
func (r *Repository) Exists(id int64) (bool, error) { if r.failure { return false, errors.New("failure") }; return r.found, nil }
func (r *Repository) Delete(id int64) error { if r.failure { return errors.New("failure") }; return nil }
type UserController struct { repo *Repository }
"""
ERROR_GET_TEST = """package snippet
import (
    "errors"
    "testing"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/input"
)
func TestGet(t *testing.T) {
    c := &UserController{repo: &Repository{}}
    id := int64(5)
    result, err := c.GetUser(input.Path[int64](&id))
    if err != nil || result.Body.ID != 5 { t.Fatalf("got %#v, %v", result, err) }
    id = 0
    _, err = c.GetUser(input.Path[int64](&id))
    var httpErr *httperr.HTTPError
    if !errors.As(err, &httpErr) || httpErr.Status != 400 { t.Fatalf("got %v", err) }
}
"""
ERROR_DELETE_TEST = """package snippet
import (
    "errors"
    "testing"
    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/input"
)
func TestDelete(t *testing.T) {
    id := int64(1)
    c := &UserController{repo: &Repository{found: true}}
    if err := c.DeleteUser(input.Path[int64](&id)); err != nil { t.Fatal(err) }
    c.repo.found = false
    var httpErr *httperr.HTTPError
    if err := c.DeleteUser(input.Path[int64](&id)); !errors.As(err, &httpErr) || httpErr.Status != 404 { t.Fatalf("got %v", err) }
    c.repo.failure = true
    if err := c.DeleteUser(input.Path[int64](&id)); err == nil || errors.As(err, &httpErr) { t.Fatalf("repository failure should pass through: %v", err) }
}
"""

def verify_app_contract():
    source = block("reference/api/spine-app.md", "type App interface {")
    source = source.replace("type App interface {", "type DocumentedApp interface {", 1)
    test = '''package snippet
import (
    "context"
    "reflect"
    "testing"
    spine "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/core"
    "github.com/NARUBROWN/spine/internal/event/consumer"
    "github.com/NARUBROWN/spine/internal/router"
    "github.com/NARUBROWN/spine/internal/ws"
    "github.com/NARUBROWN/spine/pkg/boot"
)
type PreparedApplication = spine.PreparedApplication
''' + source + '''
func TestAppContract(t *testing.T) {
    actual, documented := reflect.TypeOf((*spine.App)(nil)).Elem(), reflect.TypeOf((*DocumentedApp)(nil)).Elem()
    if actual.NumMethod() != documented.NumMethod() { t.Fatalf("actual %d methods, documented %d", actual.NumMethod(), documented.NumMethod()) }
    for i := 0; i < actual.NumMethod(); i++ { a, d := actual.Method(i), documented.Method(i); if a.Name != d.Name || a.Type != d.Type { t.Errorf("documented %s %s, actual %s %s", d.Name, d.Type, a.Name, a.Type) } }
}
'''
    with tempfile.TemporaryDirectory(prefix="spine-doc-app-contract-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD.replace("example.com/spine-doc-snippet", "github.com/NARUBROWN/spine/doc-check"))
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md App interface")

def verify_prepared_application():
    source = block("reference/api/spine-app.md", "type PreparedApplication interface {")
    match = re.search(r"type PreparedApplication interface\s*\{[^}]*\}", source, re.DOTALL)
    if not match:
        raise AssertionError("PreparedApplication definition not found")
    definition = match.group().replace("type PreparedApplication interface", "type DocumentedPreparedApplication interface", 1)
    test = '''package snippet
import (
    "context"; "io"; "net/http"; "net/http/httptest"; "reflect"; "testing"
    spine "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    httpcontract "github.com/NARUBROWN/spine/contract/http"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
)
''' + definition + '''
var _ func(spine.PreparedApplication) (http.Handler, error) = spine.NetHTTPHandler
type Controller struct{}
func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) { r.GET("/hello", func() httpx.Response[string] { return httpx.Response[string]{Body: "hello"} }) }
func TestPreparedApplication(t *testing.T) {
    actual, documented := reflect.TypeOf((*spine.PreparedApplication)(nil)).Elem(), reflect.TypeOf((*DocumentedPreparedApplication)(nil)).Elem()
    if actual.NumMethod() != documented.NumMethod() { t.Fatal("prepared interface method count differs") }
    for i := 0; i < actual.NumMethod(); i++ { a, d := actual.Method(i), documented.Method(i); if a.Name != d.Name || a.Type != d.Type { t.Fatalf("documented %s %s, actual %s %s", d.Name, d.Type, a.Name, a.Type) } }
    app := spine.New(echoplatform.Option()); app.Constructor(constructor.Controller(&Controller{}))
    prepared, err := app.Prepare(context.Background(), boot.Options{HTTP: &boot.HTTPOptions{}}); if err != nil { t.Fatal(err) }
    if prepared.HTTPAdapter() == nil { t.Fatal("expected HTTP adapter") }
    handler, err := spine.NetHTTPHandler(prepared); if err != nil { t.Fatal(err) }
    server := httptest.NewServer(handler)
    response, err := http.Get(server.URL + "/hello"); if err != nil { t.Fatal(err) }
    body, err := io.ReadAll(response.Body); response.Body.Close(); server.Close()
    if err != nil || response.StatusCode != 200 || string(body) != "hello" { t.Fatalf("status %d, body %q, err %v", response.StatusCode, body, err) }
    if err := prepared.Close(context.Background()); err != nil { t.Fatal(err) }
}
'''
    with tempfile.TemporaryDirectory(prefix="spine-doc-prepared-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md prepared HTTP application")

def verify_context_contracts():
    page = (DOCS / "reference/api/execution-context.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", page, re.MULTILINE | re.DOTALL)
    declarations = []
    for block_text in blocks:
        declarations.extend(re.findall(r"type (\w+) interface\s*\{[^}]*\}", block_text, re.DOTALL))
    if len(declarations) != len(set(declarations)) or not declarations:
        raise AssertionError("context interfaces must be present and unique")
    aliases = declarations + ["EventBus", "ResponseWriter", "HandlerMeta"]
    definitions = []
    for block_text in blocks:
        for match in re.finditer(r"type (\w+) interface\s*\{[^}]*\}", block_text, re.DOTALL):
            definitions.append(match.group().replace("type " + match.group(1) + " interface", "type Doc" + match.group(1) + " interface", 1))
    prefix = '''package snippet
import ("context"; "mime/multipart"; "reflect"; "testing"; "github.com/NARUBROWN/spine/core")
'''
    prefix += "\n".join("type " + name + " = core." + name for name in aliases) + "\n"
    prefix += "\n".join(definitions) + "\n"
    prefix += '''func TestContextContracts(t *testing.T) {
        compare := func(name string, documented, actual reflect.Type) {
            t.Helper(); if documented.NumMethod() != actual.NumMethod() { t.Errorf("%s: documented %d methods, actual %d", name, documented.NumMethod(), actual.NumMethod()); return }
            for i := 0; i < actual.NumMethod(); i++ { a, d := actual.Method(i), documented.Method(i); if a.Name != d.Name || a.Type != d.Type { t.Errorf("%s: documented %s %s, actual %s %s", name, d.Name, d.Type, a.Name, a.Type) } }
        }
'''
    for name in declarations:
        prefix += f'compare("{name}", reflect.TypeOf((*Doc{name})(nil)).Elem(), reflect.TypeOf((*core.{name})(nil)).Elem())\n'
    prefix += "}\n"
    with tempfile.TemporaryDirectory(prefix="spine-doc-contexts-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example_test.go").write_text(prefix)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print(f"PASS reference/api/execution-context.md {len(declarations)} interface definitions")

def verify_boot_options():
    source = block("reference/api/spine-app.md", "type HTTPOptions struct {")
    structures = re.findall(r"type (Options|HTTPOptions) struct \{(.*?)\}", source, re.DOTALL)
    if len(structures) != 2:
        raise AssertionError("expected both boot option structures")
    checks = []
    for name, body in structures:
        fields = [line.split()[0] for line in body.splitlines() if line.strip() and not line.lstrip().startswith("//")]
        checks.append(f'checkFields(t, reflect.TypeOf(boot.{name}{{}}), []string{{' + ", ".join('"' + field + '"' for field in fields) + '})')
    test = """package snippet
import ("reflect"; "testing"; "github.com/NARUBROWN/spine/pkg/boot")
func checkFields(t *testing.T, typ reflect.Type, names []string) {
  t.Helper(); if typ.NumField() != len(names) { t.Fatalf("%s has %d fields; document lists %d", typ.Name(), typ.NumField(), len(names)) }
  for i, name := range names { if typ.Field(i).Name != name { t.Fatalf("%s field %d: got %s, documented %s", typ.Name(), i, typ.Field(i).Name, name) } }
}
func TestBootFields(t *testing.T) {
""" + "\n".join(checks) + "\n}\n"
    with tempfile.TemporaryDirectory(prefix="spine-doc-options-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md boot option fields")

def verify_generated_app():
    source = block("reference/api/spine-app.md", "controller.HealthController{}")
    with tempfile.TemporaryDirectory(prefix="spine-doc-app-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text("module example.com/my-app\n\ngo 1.25.5\n\nrequire (\n github.com/NARUBROWN/spine v0.7.1\n github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n)\n")
        (folder / "application").mkdir()
        (folder / "application/application.go").write_text(source)
        controller = folder / "src/controller"
        controller.mkdir(parents=True)
        (controller / "health.go").write_text("""package controller
import ("github.com/NARUBROWN/spine/pkg/api"; "github.com/NARUBROWN/spine/pkg/httpx")
type HealthController struct{}
func (*HealthController) Constructor() *HealthController { return &HealthController{} }
func (*HealthController) RegisterRoutes(r *api.Registry) { r.GET("/health", func() httpx.Response[string] { return httpx.Response[string]{Body: "ok"} }) }
""")
        (folder / "application/application_test.go").write_text("""package application
import "testing"
func TestBuild(t *testing.T) { app, opts, err := BuildApplication(); if err != nil { t.Fatal(err) }; if err := app.Validate(opts); err != nil { t.Fatal(err) } }
""")
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md generated application")

def verify_custom_transport_example():
    source = block("reference/api/spine-app.md", "type GRPCTransport struct {")
    source = source.replace('app.RegisterTransport(&GRPCTransport{})', '').replace('net.Listen("tcp", ":9090")', 'net.Listen("tcp", "127.0.0.1:0")')
    test = """package snippet
import (
    "context"; "net"; "reflect"; "testing"; "time"
    spine "github.com/NARUBROWN/spine"; "github.com/NARUBROWN/spine/core"; "google.golang.org/grpc"
)
type MyService struct{}
func RegisterMyServiceServer(*grpc.Server, *MyService) {}
type testContainer struct{}
func (testContainer) Resolve(t reflect.Type) (any, error) { return &MyService{}, nil }
""" + source + """
var _ core.CustomTransport = (*GRPCTransport)(nil)
func TestTransportLifecycle(t *testing.T) {
    transport := &GRPCTransport{}
    app := spine.New(); app.RegisterTransport(transport)
    if err := transport.Init(testContainer{}); err != nil { t.Fatal(err) }
    started := make(chan error, 1); go func() { started <- transport.Start() }()
    ctx, cancel := context.WithTimeout(context.Background(), time.Second); defer cancel()
    if err := transport.Stop(ctx); err != nil { t.Fatal(err) }
    select { case err := <-started: if err != nil && err != grpc.ErrServerStopped { t.Fatal(err) }; case <-ctx.Done(): t.Fatal(ctx.Err()) }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-custom-transport-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire google.golang.org/grpc v1.80.0\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md custom transport lifecycle")


def verify_websocket_reference_example():
    source = block("reference/api/spine-app.md", "type ChatController struct {")
    source = source.replace('import "github.com/NARUBROWN/spine/pkg/ws"\n', "", 1)
    test = """package snippet
import (
    "context"; "encoding/json"; "errors"; "strings"; "sync"; "testing"; "time"
    "github.com/NARUBROWN/spine/pkg/ws"
)
""" + source + """
type mockSender struct { messages [][]byte; err error }
func (s *mockSender) Send(messageType int, data []byte) error { if messageType != ws.TextMessage { panic("unexpected frame") }; s.messages = append(s.messages, data); return s.err }
func TestBroadcastAndFailedSender(t *testing.T) {
    controller := NewChatController(); first, second := &mockSender{}, &mockSender{}
    ctx1 := context.WithValue(context.Background(), ws.SenderKey, first); ctx2 := context.WithValue(context.Background(), ws.SenderKey, second)
    if err := controller.OnMessage(ctx1, ws.ConnectionID{Value:"a"}, ChatMessage{Message:" first "}); err != nil { t.Fatal(err) }
    if err := controller.OnMessage(ctx2, ws.ConnectionID{Value:"b"}, ChatMessage{Message:"second"}); err != nil { t.Fatal(err) }
    if len(first.messages)!=2 || len(second.messages)!=1 { t.Fatalf("messages: %d, %d",len(first.messages),len(second.messages)) }
    var event ChatEvent; if err := json.Unmarshal(second.messages[0], &event); err != nil || event.From != "b" || event.Message != "second" { t.Fatalf("event: %+v %v",event,err) }
    first.err = errors.New("closed")
    if err := controller.OnMessage(ctx2, ws.ConnectionID{Value:"b"}, ChatMessage{Message:"third"}); !errors.Is(err, first.err) { t.Fatalf("expected send error, got %v",err) }
    if _, ok := controller.clients["a"]; ok { t.Fatal("failed sender not removed") }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-ws-reference-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/spine-app.md WebSocket broadcast snippet")


def verify_error_tutorial_app():
    page = "learn/tutorial/7-error-handling.md"
    repository = block(page, "var ErrUserNotFound = errors.New")
    service_method = block(page, "func (s *UserService) Find(id int64)")
    controller = block(page, "func toHTTPError(err error) error")
    creation = block(page, "func (r *CreateUserRequest) Validate() error")
    test = """package user
import (
    "bytes"; "context"; "io"; "net/http"; "net/http/httptest"; "strings"; "testing"
    spine "github.com/NARUBROWN/spine"; echoplatform "github.com/NARUBROWN/spine-echo-platform"; "github.com/NARUBROWN/spine/pkg/boot"
)
func TestErrorTutorial(t *testing.T) {
    app := spine.New(echoplatform.Option()); app.Constructor(NewUserRepository, NewUserService, NewUserController)
    app.Route("GET", "/user/:id", (*UserController).Get); app.Route("POST", "/user", (*UserController).Create)
    prepared, err := app.Prepare(context.Background(), boot.Options{HTTP: &boot.HTTPOptions{}}); if err != nil { t.Fatal(err) }; defer prepared.Close(context.Background())
    handler, err := spine.NetHTTPHandler(prepared); if err != nil { t.Fatal(err) }; server := httptest.NewServer(handler); defer server.Close()
    for _, tc := range []struct{path string; status int; body string}{{"/user/1",200,`"name":"Alice"`}, {"/user/0",400,"invalid user ID"}, {"/user/2",404,"user not found"}, {"/user/bad",400,""}} {
        response, err := http.Get(server.URL+tc.path); if err != nil { t.Fatal(err) }; result, err := io.ReadAll(response.Body); response.Body.Close()
        if err != nil || response.StatusCode != tc.status || !strings.Contains(string(result),tc.body) { t.Fatalf("%s: status %d body %q err %v", tc.path,response.StatusCode,result,err) }
    }
    for _, tc := range []struct{body string; status int}{{`{"name":"Alice","email":"a@example.test"}`,201}, {`{"name":"","email":"a@example.test"}`,400}, {`{"name":"Alice","email":""}`,400}, {`{"name":"`+strings.Repeat("가",101)+`","email":"a@example.test"}`,400}} {
        response, err := http.Post(server.URL+"/user", "application/json", bytes.NewBufferString(tc.body)); if err != nil { t.Fatal(err) }; response.Body.Close(); if response.StatusCode != tc.status { t.Fatalf("POST: got %d want %d", response.StatusCode,tc.status) }
    }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-error-tutorial-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n")
        (folder / "repository.go").write_text(repository)
        (folder / "service.go").write_text("package user\ntype UserService struct { repository *UserRepository }\nfunc NewUserService(repository *UserRepository) *UserService { return &UserService{repository:repository} }\n" + service_method)
        (folder / "controller.go").write_text(controller)
        (folder / "create.go").write_text(creation)
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS error tutorial GET and optional POST handlers")


def verify_error_handling_examples():
    path = "learn/core-concepts/httperr.md"
    payment = block(path, "func (c *PaymentController) Process(req *PaymentRequest)")
    helpers = block(path, "func Forbidden(msg string) error")
    with_cause = block(path, "func WithCause(status int, msg string, cause error)")
    with_cause = with_cause.split("// 사용", 1)[0]
    test = """package snippet
import (
    "errors"; "testing"; "github.com/NARUBROWN/spine/pkg/httperr"; "github.com/NARUBROWN/spine/pkg/httpx"
)
type PaymentRequest struct { UserID string; Amount int }
type Receipt struct { Amount int }
type Wallet struct { balance int; err error }
func (w *Wallet) GetBalance(string) (int, error) { return w.balance, w.err }
type PaymentController struct { wallet *Wallet; processErr error }
func (c *PaymentController) processPayment(req *PaymentRequest) (Receipt, error) { return Receipt{Amount:req.Amount}, c.processErr }
""" + payment + helpers + with_cause + """
func TestPayments(t *testing.T) {
    c := &PaymentController{wallet:&Wallet{balance:100}}
    for _, tc := range []struct{amount, status int}{{0,400}, {10000001,400}, {101,400}, {10,0}} {
        response, err := c.Process(&PaymentRequest{Amount:tc.amount})
        if tc.status == 0 { if err != nil || response.Body.Amount != tc.amount { t.Fatalf("success: %+v %v", response, err) }; continue }
        var httpErr *httperr.HTTPError; if !errors.As(err, &httpErr) || httpErr.Status != tc.status { t.Fatalf("amount %d: %v", tc.amount, err) }
    }
    c.wallet.err = errors.New("missing")
    _, err := c.Process(&PaymentRequest{Amount:1}); var httpErr *httperr.HTTPError
    if !errors.As(err, &httpErr) || httpErr.Status != 404 { t.Fatal(err) }
}
func TestHelpers(t *testing.T) {
    for _, tc := range []struct{err error; status int}{{Forbidden("x"),403}, {Conflict("x"),409}, {UnprocessableEntity("x"),422}, {TooManyRequests("x"),429}} {
        var actual *httperr.HTTPError; if !errors.As(tc.err, &actual) || actual.Status != tc.status { t.Fatal(tc.err) }
    }
    cause := errors.New("cause"); if err := WithCause(500, "safe", cause); !errors.Is(err,cause) { t.Fatal(err) }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-errors-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS httperr payment rules and custom error helpers")


def verify_controller_response_examples():
    text = (DOCS / "learn/tutorial/2-controller.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", text, re.MULTILINE | re.DOTALL)
    cases = [
        (4, "func (c *UserController) CreateUser", 'got := (&UserController{service: &UserService{}}).CreateUser(context.Background(), &CreateUserRequest{Name:"Alice"}); if got.Options.Status != 201 { t.Fatal(got) }', False),
        (8, "func (c *UserController) GetUser", 'id := int64(42); got := (&UserController{service: &UserService{}}).GetUser(context.Background(), input.Path[int64](&id)); if got.Body.ID != 42 { t.Fatal(got) }', False),
        (9, "func (c *UserController) Health", 'got := (&UserController{}).Health(); if got.Body != "OK" { t.Fatal(got) }', False),
        (10, "func (c *UserController) CreateUser", 'got := (&UserController{service: &UserService{}}).CreateUser(context.Background(), &CreateUserRequest{Name:"Alice"}); if got.Options.Status != 201 { t.Fatal(got) }', False),
        (11, "func (c *UserController) GetUser", 'id := int64(42); got := (&UserController{service: &UserService{}}).GetUser(context.Background(), input.Path[int64](&id)); if got.Options.Headers["Cache-Control"] != "max-age=3600" { t.Fatal(got) }', False),
        (12, "func (c *AuthController) Login", 'got := (&AuthController{service: &AuthService{}}).Login(context.Background(), &LoginRequest{}); if len(got.Options.Cookies) != 2 || !got.Body.Success { t.Fatal(got) }', True),
        (14, "func (c *AuthController) OAuthCallback", 'q := OAuthQuery{Code:"x"}; got := (&AuthController{service: &AuthService{}}).OAuthCallback(context.Background(), input.Query[OAuthQuery](&q)); if got.Location != "/dashboard" { t.Fatal(got) }', False),
        (15, "func (c *UserController) MovedPermanently", 'got := (&UserController{}).MovedPermanently(); if got.Options.Status != http.StatusMovedPermanently { t.Fatal(got) }', False),
        (16, "func (c *AuthController) Login", 'got := (&AuthController{service: &AuthService{}}).Login(context.Background(), &LoginRequest{}); if got.Location != "/dashboard" || len(got.Options.Cookies) != 1 { t.Fatal(got) }', False),
        (17, "func (c *AuthController) Logout", 'got := (&AuthController{}).Logout(); if got.Location != "/login" || len(got.Options.Cookies) != 2 { t.Fatal(got) }', False),
        (18, "func (c *UserController) GetUser", 'id := int64(0); err := (&UserController{service: &UserService{}}).GetUser(context.Background(), input.Path[int64](&id)); if err == nil { t.Fatal("expected not found") }', False),
        (19, "func (c *UserController) GetUser", 'id := int64(0); _, err := (&UserController{service: &UserService{}}).GetUser(context.Background(), input.Path[int64](&id)); if err == nil { t.Fatal("expected not found") }', False),
    ]
    base = """package snippet
import (
    "context"; "errors"; "net/http"; "testing"; "time"
    "github.com/NARUBROWN/spine/pkg/httperr"; "github.com/NARUBROWN/spine/pkg/httpx"; "github.com/NARUBROWN/spine/pkg/input"
)
var _ = httperr.NotFound
var _ httpx.Response[string]
var _ = http.StatusOK
var _ = time.Second
var _ input.Path[int64]
type UserResponse struct { ID int; Name string }
type CreateUserRequest struct { Name, Email string }
type LoginRequest struct { Email, Password string }
type LoginResponse struct { Success bool }
type UserService struct{}
func (*UserService) Get(ctx context.Context, id int) (UserResponse, error) { if id == 0 { return UserResponse{}, errors.New("missing") }; return UserResponse{ID:id}, nil }
func (*UserService) Create(ctx context.Context, name, email string) (UserResponse, error) { return UserResponse{Name:name}, nil }
type UserController struct { service *UserService }
type AuthService struct{}
func (*AuthService) ProcessOAuthCode(context.Context, string) {}
type AuthController struct { service *AuthService }
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-controller-responses-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        for number, (index, marker, assertion, triple) in enumerate(cases):
            snippet = blocks[index + 1 if index >= 4 else index]
            if marker not in snippet:
                raise AssertionError(f"controller example {index} changed")
            snippet = re.sub(r'^import "[^"\n]+"\n', '', snippet, flags=re.MULTILINE)
            login = 'func (*AuthService) Login(context.Context, string, string) (string, string, error) { return "a", "b", nil }\n' if triple else 'func (*AuthService) Login(context.Context, string, string) (string, error) { return "a", nil }\n'
            (folder / "example_test.go").write_text(base + login + snippet + f"\nfunc TestExample(t *testing.T) {{ {assertion} }}\n")
            if number == 0:
                subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
            subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True, stdout=subprocess.DEVNULL)
    print(f"PASS tutorial controller {len(cases)} response and error excerpts")


def verify_transport_factory_examples():
    kafka = block("reference/api/spine-app.md", "factory, err := kafkaplatform.NewFactory")
    rabbit = block("reference/api/spine-app.md", "factory, err := rabbitmqplatform.NewFactory")
    if kafka != block("reference/security-configuration.md", "factory, err := kafkaplatform.NewFactory") or rabbit != block("reference/security-configuration.md", "factory, err := rabbitmqplatform.NewFactory"):
        raise AssertionError("transport factory examples differ between reference pages")
    test = """package snippet
import (
    "testing"; "time"; spine "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    kafkaplatform "github.com/NARUBROWN/spine-kafka-platform"
    rabbitmqplatform "github.com/NARUBROWN/spine-rabbitmq-platform"
    "github.com/NARUBROWN/spine/pkg/boot"
)
func kafkaExample() (spine.App, boot.Options, error) {
""" + kafka + """
    return app, boot.Options{HTTP: &boot.HTTPOptions{}}, nil
}
func rabbitExample() (spine.App, boot.Options, error) {
""" + rabbit + """
    return app, boot.Options{HTTP: &boot.HTTPOptions{}}, nil
}
func TestFactoryExamples(t *testing.T) {
    for name, example := range map[string]func()(spine.App, boot.Options, error){"kafka": kafkaExample, "rabbitmq": rabbitExample} {
        app, opts, err := example(); if err != nil { t.Fatalf("%s: %v", name, err) }
        if err := app.Validate(opts); err != nil { t.Fatalf("%s: %v", name, err) }
    }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-broker-factory-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire (\n github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n github.com/NARUBROWN/spine-kafka-platform v0.2.0-rc.1\n github.com/NARUBROWN/spine-rabbitmq-platform v0.2.0-rc.1\n)\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS Kafka and RabbitMQ factory snippets on both reference pages")


def verify_controller_context_example():
    source = block("learn/tutorial/2-controller.md", "spineCtx spine.Ctx")
    source = source.replace('import "github.com/NARUBROWN/spine/pkg/spine"\n', "", 1)
    test = """package snippet
import (
    "context"; "testing"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"
    "github.com/NARUBROWN/spine/pkg/spine"
)
type UserResponse struct { ID int }
type UserService struct{}
func (*UserService) Get(ctx context.Context, id int) (UserResponse, error) { return UserResponse{ID: id}, nil }
type UserController struct { service *UserService }
type controllerContext map[string]any
func (c controllerContext) Get(key string) (any, bool) { value, ok := c[key]; return value, ok }
""" + source + """
func TestReadContext(t *testing.T) {
    id := int64(42); c := &UserController{service: &UserService{}}
    for _, value := range []any{"admin", 123, nil} {
        result := c.GetUser(context.Background(), input.Path[int64](&id), controllerContext{"userRole": value})
        if result.Body.ID != 42 { t.Fatalf("unexpected response: %+v", result) }
    }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-controller-context-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS tutorial controller context example")


def verify_query_values_examples():
    path = "reference/api/query-values.md"
    user = block(path, "func (c *UserController) Search(q query.Values)")
    product = block(path, "func (c *ProductController) Filter(q query.Values)")
    test = """package snippet
import (
    "context"; "encoding/json"; "net/http"; "net/http/httptest"; "testing"
    spine "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/boot"; "github.com/NARUBROWN/spine/pkg/httpx"; "github.com/NARUBROWN/spine/pkg/query"
)
type User struct { Status string `json:"status"`; Page int64 `json:"page"`; Size int64 `json:"size"`; Active bool `json:"active"` }
type Product struct { Category string `json:"category"`; MinPrice string `json:"min_price"` }
type UserService struct{}
func (*UserService) Search(status string, page, size int64, active bool) []User { return []User{{status, page, size, active}} }
type ProductService struct{}
func (*ProductService) FindByFilters(filters map[string]string) []Product { return []Product{{filters["category"], filters["min_price"]}} }
type UserController struct { service *UserService }
func NewUserController() *UserController { return &UserController{&UserService{}} }
type ProductController struct { service *ProductService }
func NewProductController() *ProductController { return &ProductController{&ProductService{}} }
""" + user + product + """
func TestQueryHelpers(t *testing.T) {
    values := map[string][]string{"name": {"john", "jane"}, "active": {"TRUE"}, "empty": {""}, "invalid": {"oops"}}
    q := query.NewValues(values)
    if q.Get("name") != "john" || q.String("missing") != "" || q.Int("invalid", 12) != 12 || !q.GetBoolByKey("active", false) || !q.Has("empty") || q.Has("missing") { t.Fatal("query helper behavior differs") }
    values["name"] = []string{"changed"}; if q.Get("name") != "changed" { t.Fatal("NewValues unexpectedly copied its map") }
    for _, truth := range []string{"true", "1", "yes", "y", "on"} { if !query.NewValues(map[string][]string{"v": {truth}}).GetBoolByKey("v", false) { t.Fatal(truth) } }
    for _, falsity := range []string{"false", "0", "no", "n", "off"} { if query.NewValues(map[string][]string{"v": {falsity}}).GetBoolByKey("v", true) { t.Fatal(falsity) } }
}
func TestLegacyQueryHandlers(t *testing.T) {
    app := spine.New(echoplatform.Option()); app.Constructor(NewUserController, NewProductController)
    app.Route("GET", "/users", (*UserController).Search); app.Route("GET", "/products", (*ProductController).Filter)
    prepared, err := app.Prepare(context.Background(), boot.Options{HTTP: &boot.HTTPOptions{}}); if err != nil { t.Fatal(err) }; defer prepared.Close(context.Background())
    handler, err := spine.NetHTTPHandler(prepared); if err != nil { t.Fatal(err) }; server := httptest.NewServer(handler); defer server.Close()
    response, err := http.Get(server.URL+"/users?status=active&page=3&active=false"); if err != nil { t.Fatal(err) }; defer response.Body.Close()
    var users []User; if err := json.NewDecoder(response.Body).Decode(&users); err != nil || len(users)!=1 || users[0] != (User{"active",3,20,false}) { t.Fatalf("users=%v, err=%v", users, err) }
    response2, err := http.Get(server.URL+"/products?category=books&min_price=10"); if err != nil { t.Fatal(err) }; defer response2.Body.Close()
    var products []Product; if err := json.NewDecoder(response2.Body).Decode(&products); err != nil || len(products)!=1 || products[0] != (Product{"books","10"}) { t.Fatalf("products=%v, err=%v", products, err) }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-query-values-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/query-values.md helpers and HTTP handlers")


def verify_multipart_examples():
    path = "learn/tutorial/2-controller.md"
    snippets = [block(path, marker) for marker in (
        "type CreatePostForm struct {", "func (c *PostController) Create(",
        "func (c *FileController) Upload(", "type PageQuery struct {",
    )]
    test = """package snippet
import (
    "bytes"; "context"; "fmt"; "io"; stdmultipart "mime/multipart"; "net/http"; "net/http/httptest"; "testing"
    spine "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"; "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"; "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/input"; "github.com/NARUBROWN/spine/pkg/multipart"
)
type PostController struct{}
func (*PostController) Constructor() *PostController { return &PostController{} }
func (c *PostController) RegisterRoutes(r *api.Registry) { r.POST("/posts", c.Create); r.POST("/combined", c.Upload) }
type FileController struct{}
func (*FileController) Constructor() *FileController { return &FileController{} }
func (c *FileController) RegisterRoutes(r *api.Registry) { r.POST("/upload", c.Upload) }
""" + "\n".join(snippets) + """
func TestMultipartExamples(t *testing.T) {
    app := spine.New(echoplatform.Option()); app.Constructor(constructor.Controller(&PostController{}), constructor.Controller(&FileController{}))
    prepared, err := app.Prepare(context.Background(), boot.Options{HTTP: &boot.HTTPOptions{}}); if err != nil { t.Fatal(err) }; defer prepared.Close(context.Background())
    handler, err := spine.NetHTTPHandler(prepared); if err != nil { t.Fatal(err) }; server := httptest.NewServer(handler); defer server.Close()
    for _, path := range []string{"/posts", "/upload", "/combined?page=2&size=3"} {
        var body bytes.Buffer; form := stdmultipart.NewWriter(&body)
        if err := form.WriteField("title", "hello"); err != nil { t.Fatal(err) }; if err := form.WriteField("content", "spine"); err != nil { t.Fatal(err) }
        file, err := form.CreateFormFile("file", "hello.txt"); if err != nil { t.Fatal(err) }; if _, err = io.WriteString(file, "hello"); err != nil { t.Fatal(err) }; if err = form.Close(); err != nil { t.Fatal(err) }
        response, err := http.Post(server.URL+path, form.FormDataContentType(), &body); if err != nil { t.Fatal(err) }; result, err := io.ReadAll(response.Body); response.Body.Close()
        if err != nil || response.StatusCode != 200 || string(result) != "OK" { t.Fatalf("%s: status=%d body=%q error=%v", path, response.StatusCode, result, err) }
    }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-multipart-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS tutorial controller form and multipart examples")


def verify_openapi_exports():
    legacy = block("reference/api/openapi.md", "func ExportOpenAPI(")
    prepared = block("reference/api/openapi.md", "func ExportPreparedOpenAPI(")
    test = """package snippet
import (
    "bytes"; "context"; "encoding/json"; "errors"; "io"; "testing"
    spine "github.com/NARUBROWN/spine"
    echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"
    "github.com/NARUBROWN/spine/pkg/boot"
    "github.com/NARUBROWN/spine/pkg/constructor"
    "github.com/NARUBROWN/spine/pkg/httpx"
    "github.com/NARUBROWN/spine/pkg/openapi"
)
""" + legacy + prepared + """
type Controller struct{}
func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) { r.GET("/hello", func() httpx.Response[string] { return httpx.Response[string]{Body: "hello"} }) }
func TestPreparedExport(t *testing.T) {
    app := spine.New(echoplatform.Option()); app.Constructor(constructor.Controller(&Controller{}))
    options := boot.Options{HTTP: &boot.HTTPOptions{}}
    var output bytes.Buffer
    if err := ExportOpenAPI(app, options, &output); !errors.Is(err, spine.ErrRoutesNotCollected) { t.Fatalf("expected uncollected routes, got %v", err) }
    prepared, err := app.Prepare(context.Background(), options); if err != nil { t.Fatal(err) }; defer prepared.Close(context.Background())
    if err := ExportPreparedOpenAPI(prepared, options.HTTP.OpenAPI, &output); err != nil { t.Fatal(err) }
    var document struct { Paths map[string]any `json:"paths"` }; if err := json.Unmarshal(output.Bytes(), &document); err != nil { t.Fatal(err) }
    if _, ok := document.Paths["/hello"]; !ok { t.Fatalf("missing route: %s", output.String()) }
}
"""
    with tempfile.TemporaryDirectory(prefix="spine-doc-export-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD + "\nrequire github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1\n")
        (folder / "example_test.go").write_text(test)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True)
    print("PASS reference/api/openapi.md static and prepared exports")


def verify_llms_example():
    guide = (ROOT / "docs/public/llms.txt").read_text()
    examples = re.findall(r"^```go\n(.*?)^```", guide, re.MULTILINE | re.DOTALL)
    introduction = (ROOT / "docs/en/learn/getting-started/intro.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", introduction, re.MULTILINE | re.DOTALL)
    if len(examples) != 1 or examples[0] not in blocks:
        raise AssertionError("llms.txt runnable example must match the tested introduction")
    print("PASS llms.txt example matches the tested introduction")


if __name__ == "__main__":
    verify_custom_transport_example()
    verify_websocket_reference_example()
    verify_error_tutorial_app()
    verify_error_handling_examples()
    verify_controller_response_examples()
    verify_transport_factory_examples()
    verify_controller_context_example()
    verify_query_values_examples()
    verify_multipart_examples()
    verify_openapi_exports()
    verify_llms_example()
    verify_app_contract()
    verify_prepared_application()
    verify_context_contracts()
    verify_boot_options()
    verify_generated_app()
    verify("reference/api/execution-context.md", "func (c *UserController) GetUser(ctx core.ControllerContext", COMMON, CONTEXT_TEST)
    verify("learn/core-concepts/httperr.md", "func (c *UserController) GetUser(userId input.Path", ERROR_PREFIX, ERROR_GET_TEST)
    verify("learn/core-concepts/httperr.md", "func (c *UserController) DeleteUser(userId input.Path", ERROR_PREFIX.replace('    "github.com/NARUBROWN/spine/pkg/httpx"\n', ""), ERROR_DELETE_TEST)
    verify("learn/core-concepts/pipeline.md", "func (c *UserController) GetUser(userId input.Path", PIPELINE_PREFIX, PIPELINE_TEST)
