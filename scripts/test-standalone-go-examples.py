#!/usr/bin/env python3
"""Compile and exercise the standalone v0.7.1 HTTP examples in the Korean docs.

The translation checker verifies the executable blocks match across locales.
These tests do not cover partial snippets or external databases and brokers.
"""

import json
import re
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs/ko"
GO_MOD = '''module example.com/spine-doc-example

go 1.25.5

require (
    github.com/NARUBROWN/spine v0.7.1
    github.com/NARUBROWN/spine-echo-platform v0.2.0-rc.1
)
'''


def standalone(path, required, wrap=False):
    content = (DOCS / path).read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", content, re.MULTILINE | re.DOTALL)
    matches = [block for block in blocks if (wrap or block.startswith("package main\n")) and required in block]
    if len(matches) != 1:
        raise AssertionError(f"expected one standalone example in {path}, got {len(matches)}")
    if wrap:
        return '''package main
import ("log"; "github.com/NARUBROWN/spine"; echoplatform "github.com/NARUBROWN/spine-echo-platform"; "github.com/NARUBROWN/spine/pkg/boot")
''' + matches[0] + '''
func main() { app := spine.New(echoplatform.Option()); register(app); if err := app.Run(boot.Options{Address: ":8080", HTTP: &boot.HTTPOptions{}}); err != nil { log.Fatal(err) } }
'''
    return matches[0]


def get_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def request(port, path, *, data=None, headers=None, method=None):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=2) as response:
            return response.status, response.headers.get_content_type(), response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get_content_type(), error.read()


def exercise(path, required, verify, extra_mod="", wrap=False):
    source = standalone(path, required, wrap)
    port = get_port()
    source = source.replace('Address: ":8080"', f'Address: ":{port}"')
    source = source.replace('Address: ":8080",', f'Address: ":{port}",')
    with tempfile.TemporaryDirectory(prefix="spine-doc-example-") as directory:
        folder = Path(directory)
        (folder / "go.mod").write_text(GO_MOD + extra_mod)
        (folder / "main.go").write_text(source)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "build", "-buildvcs=false", "-o", "example", "."], cwd=folder, check=True, capture_output=True, text=True)
        with (folder / "server.log").open("w+") as log:
            process = subprocess.Popen([str(folder / "example")], cwd=folder, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        log.flush()
                        raise AssertionError(f"server exited: {(folder / 'server.log').read_text()}")
                    try:
                        request(port, "/")
                        break
                    except (OSError, urllib.error.URLError):
                        if time.monotonic() >= deadline:
                            raise AssertionError("server did not start")
                        time.sleep(0.1)
                verify(port)
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    print(f"PASS {path}")


def verify_crud_example():
    page = (DOCS / "reference/examples/crud.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", page, re.MULTILINE | re.DOTALL)
    paths = ("src/model/user.go", "src/repository/user_repository.go", "src/dto/user_dto.go", "src/service/user_service.go", "src/controller/user_controller.go", "internal/application/application.go")
    with tempfile.TemporaryDirectory(prefix="spine-doc-crud-") as temp:
        folder = Path(temp)
        (folder / "go.mod").write_text(GO_MOD.replace("example.com/spine-doc-example", "example.com/crud-example"))
        port = get_port()
        for path in paths:
            matches = [b for b in blocks if b.startswith(f"// {path}\npackage ")]
            if len(matches) != 1:
                raise AssertionError(f"expected one code block for {path}, got {len(matches)}")
            target = folder / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(re.sub(r'Address:\s*":8080"', f'Address: ":{port}"', matches[0]))
        (folder / "main.go").write_text("""package main
import ("log"; "example.com/crud-example/internal/application")
func main() { app, opts, err := application.BuildApplication(); if err != nil { log.Fatal(err) }; if err := app.Run(opts); err != nil { log.Fatal(err) } }
""")
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "build", "-buildvcs=false", "-o", "example", "."], cwd=folder, check=True, capture_output=True, text=True)
        with (folder / "server.log").open("w+") as log:
            process = subprocess.Popen([str(folder / "example")], cwd=folder, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        log.flush()
                        raise AssertionError(f"CRUD server exited: {(folder / 'server.log').read_text()}")
                    try:
                        request(port, "/users")
                        break
                    except (OSError, urllib.error.URLError):
                        if time.monotonic() >= deadline:
                            raise AssertionError("CRUD server did not start")
                        time.sleep(0.1)
                headers = {"Content-Type": "application/json"}
                status, _, body = request(port, "/users", data=b'{"name":"Alice","email":"alice@example.com"}', headers=headers)
                assert status == 200 and json.loads(body)["id"] == 1
                status, _, body = request(port, "/users")
                assert status == 200 and json.loads(body)["total"] == 1
                status, _, body = request(port, "/users/1")
                assert status == 200 and json.loads(body)["name"] == "Alice"
                assert request(port, "/users", data=b'{"name":"Other","email":"alice@example.com"}', headers=headers)[0] == 400
                status, _, body = request(port, "/users/1", method="PUT", data=b'{"name":"Bob","email":"bob@example.com"}', headers=headers)
                assert status == 200 and json.loads(body)["name"] == "Bob"
                assert request(port, "/users/1", method="DELETE")[0] == 200
                assert request(port, "/users/1")[0] == 404
                assert request(port, "/users/not-a-number")[0] == 400
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    print("PASS reference/examples/crud.md")


def verify_login_example():
    page = (DOCS / "reference/examples/login.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", page, re.MULTILINE | re.DOTALL)
    paths = ("src/model/user.go", "src/store/user_store.go", "src/interceptor/auth_interceptor.go", "src/controller/auth_controller.go", "internal/application/application.go")
    with tempfile.TemporaryDirectory(prefix="spine-doc-login-") as temp:
        folder = Path(temp)
        mod = GO_MOD.replace("example.com/spine-doc-example", "example.com/login-example")
        (folder / "go.mod").write_text(mod + "\nrequire github.com/golang-jwt/jwt/v5 v5.3.1\n")
        port = get_port()
        for path in paths:
            matches = [b for b in blocks if b.startswith(f"// {path}\npackage ")]
            if len(matches) != 1:
                raise AssertionError(f"expected one code block for {path}, got {len(matches)}")
            target = folder / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(re.sub(r'Address:\s*":8080"', f'Address: ":{port}"', matches[0]))
        (folder / "main.go").write_text("""package main
import ("log"; "example.com/login-example/internal/application")
func main() { app, opts, err := application.BuildApplication(); if err != nil { log.Fatal(err) }; if err := app.Run(opts); err != nil { log.Fatal(err) } }
""")
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "test", "-buildvcs=false", "./..."], cwd=folder, check=True, capture_output=True, text=True)
        subprocess.run(["go", "build", "-buildvcs=false", "-o", "example", "."], cwd=folder, check=True, capture_output=True, text=True)
        with (folder / "server.log").open("w+") as log:
            process = subprocess.Popen([str(folder / "example")], cwd=folder, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        log.flush()
                        raise AssertionError(f"login server exited: {(folder / 'server.log').read_text()}")
                    try:
                        request(port, "/me")
                        break
                    except (OSError, urllib.error.URLError):
                        if time.monotonic() >= deadline:
                            raise AssertionError("login server did not start")
                        time.sleep(0.1)
                headers = {"Content-Type": "application/json"}
                status, _, body = request(port, "/signup", data=b'{"name":"Alice","email":"alice@example.com","password":"1234"}', headers=headers)
                user = json.loads(body)
                assert status == 200 and user["id"] == 1 and "password" not in user
                status, _, body = request(port, "/login", data=b'{"email":"alice@example.com","password":"1234"}', headers=headers)
                token = json.loads(body)["token"]
                assert status == 200 and token
                assert request(port, "/me")[0] == 401
                assert request(port, "/me", headers={"Authorization": "Bearer invalid"})[0] == 401
                status, _, body = request(port, "/me", headers={"Authorization": "Bearer " + token})
                assert status == 200 and json.loads(body)["email"] == "alice@example.com"
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
    print("PASS reference/examples/login.md")


def verify_tls_example():
    import ssl
    content = (DOCS / "learn/migration/preview-features.md").read_text()
    blocks = re.findall(r"^```go\n(.*?)^```", content, re.MULTILINE | re.DOTALL)
    snippets = [block for block in blocks if "func runTLS(app spine.App) error" in block]
    if len(snippets) != 1:
        raise AssertionError("expected one TLS function")
    port = get_port()
    source = """package main
import (
    "crypto/tls"; "log"; spine "github.com/NARUBROWN/spine"; echoplatform "github.com/NARUBROWN/spine-echo-platform"
    "github.com/NARUBROWN/spine/pkg/api"; "github.com/NARUBROWN/spine/pkg/boot"; "github.com/NARUBROWN/spine/pkg/constructor"; "github.com/NARUBROWN/spine/pkg/httpx"
)
type Controller struct{}
func (*Controller) Constructor() *Controller { return &Controller{} }
func (*Controller) RegisterRoutes(r *api.Registry) { r.GET("/hello", func() httpx.Response[string] { return httpx.Response[string]{Body:"hello"} }) }
func main() { app := spine.New(echoplatform.Option()); app.Constructor(constructor.Controller(&Controller{})); if err := runTLS(app); err != nil { log.Fatal(err) } }
""" + snippets[0].replace('Address: ":8443"', f'Address: ":{port}"')
    with tempfile.TemporaryDirectory(prefix="spine-doc-tls-") as directory:
        folder = Path(directory)
        (folder / "go.mod").write_text(GO_MOD)
        (folder / "main.go").write_text(source)
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-keyout", "server.key", "-out", "server.crt", "-days", "1", "-nodes", "-subj", "/CN=localhost"], cwd=folder, check=True, capture_output=True)
        subprocess.run(["go", "mod", "tidy"], cwd=folder, check=True, capture_output=True)
        subprocess.run(["go", "build", "-buildvcs=false", "-o", "example", "."], cwd=folder, check=True, capture_output=True)
        with (folder / "server.log").open("w+") as log:
            process = subprocess.Popen([str(folder / "example")], cwd=folder, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 20
                while True:
                    if process.poll() is not None:
                        log.flush(); raise AssertionError(f"TLS server exited: {(folder / 'server.log').read_text()}")
                    try:
                        context = ssl._create_unverified_context()
                        with urllib.request.urlopen(f"https://127.0.0.1:{port}/hello", context=context, timeout=1) as response:
                            assert response.status == 200 and response.read() == b"hello"
                        break
                    except (urllib.error.URLError, TimeoutError):
                        if time.monotonic() >= deadline: raise
                        time.sleep(0.1)
            finally:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill(); process.wait()
    print("PASS learn/migration/preview-features.md TLS listener")


def verify_inputs(port):
    status, _, body = request(port, "/users/search?name=alice", headers={"X-Request-ID": "r1"})
    assert status == 200 and json.loads(body) == {"name": "alice", "request_id": "r1"}
    status, _, body = request(port, "/users/id/12")
    assert status == 200 and json.loads(body)["id"] == 12
    status, _, body = request(port, "/users/create", data=b'{"name":"bob"}', headers={"Content-Type": "application/json"})
    assert status == 201 and json.loads(body)["name"] == "bob"
    assert request(port, "/users/id/not-a-number")[0] == 400


def verify_query(port):
    status, _, body = request(port, "/search?name=alice&page=2&tag=go&tag=web")
    assert status == 200 and json.loads(body) == {"name": "alice", "page": 2, "tags": ["go", "web"]}
    status, _, body = request(port, "/search?tag=go,web")
    assert status == 200 and json.loads(body)["page"] == 1 and json.loads(body)["tags"] == ["go", "web"]
    assert request(port, "/search?page=invalid")[0] == 400
    assert request(port, "/search?page=1&page=2")[0] == 400


def verify_di(port):
    status, _, body = request(port, "/greeting")
    assert status == 200 and body == b"hello"


def verify_interceptor(port):
    assert request(port, "/users/1")[0] == 401
    status, _, body = request(port, "/users/1", headers={"Authorization": "Bearer demo-token"})
    assert status == 200 and json.loads(body) == {"id": 1}


def verify_meta(port):
    status, _, body = request(port, "/meta")
    assert status == 200 and json.loads(body) == {"argument_offset": 0, "handler": "*main.Controller.RegisterRoutes"}


def verify_cors(port):
    headers = {"Origin": "https://app.example.com", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"}
    req = urllib.request.Request(f"http://127.0.0.1:{port}/resource", headers=headers, method="OPTIONS")
    with urllib.request.urlopen(req, timeout=2) as response:
        assert response.status == 204 and response.headers.get("Access-Control-Max-Age") == "60"
        assert response.headers.get("Access-Control-Allow-Origin") == "https://app.example.com"
    headers["Access-Control-Request-Method"] = "DELETE"
    req = urllib.request.Request(f"http://127.0.0.1:{port}/resource", headers=headers, method="OPTIONS")
    try:
        urllib.request.urlopen(req, timeout=2)
        raise AssertionError("disallowed CORS method was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 403


def verify_input_migration(port):
    headers = {"Content-Type": "application/json", "X-Request-ID": "test"}
    body = b'{"name":"Ada","count":0}'
    status, _, result = request(port, "/users/42?tags=a,b&tags=c", data=body, headers=headers)
    payload = json.loads(result)
    assert status == 200 and payload["id"] == 42 and payload["page"] == 1 and payload["size"] == 20 and payload["tags"] == ["a", "b", "c"]
    assert request(port, "/users/42?page=bad", data=body, headers=headers)[0] == 400
    assert request(port, "/users/42", data=b'{"name":"Ada","count":null}', headers=headers)[0] == 400
    assert request(port, "/users/42", data=body, headers={"Content-Type": "application/json"})[0] == 400
    assert request(port, "/openapi.json")[0] == 200


def verify_controller_migration(port):
    status, _, body = request(port, "/users/42")
    assert status == 200 and json.loads(body) == {"id": 42}
    assert request(port, "/users/invalid")[0] == 400


def verify_openapi(port):
    assert request(port, "/hello")[0] == 200
    status, content_type, body = request(port, "/openapi.json")
    assert status == 200 and content_type == "application/json" and json.loads(body)["openapi"].startswith("3.")
    for path in ("/docs", "/redoc"):
        status, content_type, _ = request(port, path)
        assert status == 200 and content_type == "text/html"


if __name__ == "__main__":
    verify_tls_example()
    verify_crud_example()
    verify_login_example()
    exercise("learn/core-concepts/query-values.md", "type SearchQuery struct", verify_query)
    exercise("learn/tutorial/2-controller.md", 'users.GET("/search"', verify_inputs)
    exercise("learn/getting-started/intro.md", "type Repository struct", verify_di)
    exercise("learn/tutorial/3-dependency-injection.md", "type Repository struct", verify_di)
    exercise("learn/tutorial/4-interceptor.md", "type Auth struct", verify_interceptor)
    exercise("learn/core-concepts/handler-meta.md", "type Inspector struct", verify_meta)
    exercise("reference/api/interceptor.md", "constructor.Interceptor(&Auth{})", verify_interceptor)
    exercise("reference/security-configuration.md", "maxAge := 60", verify_cors)
    exercise("learn/migration/preview-controller-routes.md", 'users.GET("/:id"', verify_controller_migration, wrap=True)
    exercise("learn/migration/v0.7.1-preview.md", "type UpdateBody struct", verify_input_migration, "\nrequire github.com/NARUBROWN/spine-validator-playground v0.2.0-rc.1\n")
    exercise("learn/migration/preview-features.md", "swaggerui.New", verify_openapi)
    exercise("reference/api/openapi.md", "swaggerui.New", verify_openapi)
    exercise("learn/tutorial/8-swagger.md", "swaggerui.New", verify_openapi)
