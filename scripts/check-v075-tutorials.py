#!/usr/bin/env python3
"""Compile the six Korean 0.7.5 chapters and exercise the DB-free examples.

Source replacements explicitly identify a candidate checkout. Use
check-v075-examples.py without replacements to verify published modules.
Database examples are compiled, never connected to a DB.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "docs/ko/learn/tutorial"
FENCES = re.compile(r"^```go\n(.*?)^```", re.MULTILINE | re.DOTALL)
MOD = """module example.com/my-app

go 1.26.0

require (
 github.com/NARUBROWN/spine v0.7.5
 github.com/NARUBROWN/spine-echo-platform v0.2.1
 github.com/NARUBROWN/spine-validator-playground v0.2.0
 github.com/uptrace/bun v1.2.16
 github.com/uptrace/bun/dialect/mysqldialect v1.2.16
 github.com/go-sql-driver/mysql v1.9.3
)
"""

PROBE = r'''package main
import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "github.com/NARUBROWN/spine"
)
func handler(t *testing.T) http.Handler {
 t.Helper()
 app, options, err := BuildApplication()
 if err != nil { t.Fatal(err) }
 if err := app.Validate(options); err != nil { t.Fatal(err) }
 prepared, err := app.Prepare(t.Context(), options)
 if err != nil { t.Fatal(err) }
 t.Cleanup(func(){ if err:=prepared.Close(context.Background());err!=nil{t.Error(err)} })
 h, err := spine.NetHTTPHandler(prepared)
 if err != nil { t.Fatal(err) }
 return h
}
func call(t *testing.T,h http.Handler,method,path,body string,headers map[string]string,status int)*httptest.ResponseRecorder{
 t.Helper()
 req:=httptest.NewRequest(method,path,strings.NewReader(body))
 if body!=""{req.Header.Set("Content-Type","application/json")}
 for k,v:=range headers{req.Header.Set(k,v)}
 w:=httptest.NewRecorder();h.ServeHTTP(w,req)
 if w.Code!=status{t.Fatalf("%s %s: status=%d want=%d body=%s",method,path,w.Code,status,w.Body)}
 return w
}
func object(t *testing.T,w *httptest.ResponseRecorder)map[string]any{
 t.Helper();var out map[string]any
 if err:=json.Unmarshal(w.Body.Bytes(),&out);err!=nil{t.Fatal(err)}
 return out
}
'''

CASES = {
    "2-controller": r'''func TestDocumentedHTTPInputs(t *testing.T){
 h:=handler(t)
 out:=object(t,call(t,h,"GET","/users/search?name=alice","",map[string]string{"X-Request-ID":"r1"},200))
 if out["name"]!="alice"||out["request_id"]!="r1"{t.Fatal(out)}
 out=object(t,call(t,h,"GET","/users/id/12","",nil,200))
 if out["id"]!=float64(12){t.Fatal(out)}
 out=object(t,call(t,h,"POST","/users",`{"name":"bob"}`,nil,201))
 if out["name"]!="bob"{t.Fatal(out)}
 call(t,h,"GET","/users/id/not-a-number","",nil,400)
}''',
    "3-dependency-injection": r'''func TestDocumentedDependencyInjection(t *testing.T){
 h:=handler(t);w:=call(t,h,"GET","/greeting","",nil,200)
 if w.Body.String()!="hello"{t.Fatal(w.Body.String())}
}''',
    "4-interceptor": r'''func TestDocumentedInterceptorScopesAndBindingOrder(t *testing.T){
 h:=handler(t);auth:=map[string]string{"Authorization":"Bearer demo-token"}
 call(t,h,"GET","/users/1","",nil,401)
 call(t,h,"GET","/users/1","",auth,200)
 call(t,h,"GET","/profile","",nil,401)
 call(t,h,"GET","/profile","",auth,200)
 call(t,h,"GET","/users/not-a-number","",nil,401)
 call(t,h,"GET","/users/not-a-number","",auth,400)
 call(t,h,"POST","/users","{",nil,401)
 call(t,h,"POST","/users","{",auth,400)
 w:=call(t,h,"POST","/users",`{"name":"bob"}`,auth,200)
 if w.Body.String()!="bob"{t.Fatal(w.Body.String())}
}''',
    "7-error-handling": r'''func TestDocumentedAutomaticAndManualValidation(t *testing.T){
 h:=handler(t)
 call(t,h,"GET","/users/1","",nil,200)
 call(t,h,"GET","/users/0","",nil,400)
 call(t,h,"GET","/users/2","",nil,404)
 invalid:=object(t,call(t,h,"POST","/users",`{"name":"","email":"bad"}`,nil,400))
 if invalid["fields"]==nil{t.Fatal("tag validation did not produce field errors",invalid)}
 manual:=object(t,call(t,h,"POST","/users",`{"name":"admin","email":"a@example.com"}`,nil,400))
 if manual["message"]!="name is reserved"{t.Fatal(manual)}
 call(t,h,"POST","/users",`{"name":"Alice","email":"a@example.com"}`,nil,201)
 doc:=object(t,call(t,h,"GET","/openapi.json","",nil,200))
 operation:=doc["paths"].(map[string]any)["/users"].(map[string]any)["post"].(map[string]any)
 schema:=operation["requestBody"].(map[string]any)["content"].(map[string]any)["application/json"].(map[string]any)["schema"].(map[string]any)
 ref:=strings.TrimPrefix(schema["$ref"].(string),"#/components/schemas/")
 required:=doc["components"].(map[string]any)["schemas"].(map[string]any)[ref].(map[string]any)["required"].([]any)
 names:=map[any]bool{};for _,name:=range required{names[name]=true}
 if !names["name"]||!names["email"]{t.Fatal(required)}
 raw,_:=json.Marshal(doc);if strings.Contains(string(raw),"name is reserved"){t.Fatal("manual rule was inferred as a schema")}
}''',
}


def sources(name):
    text = (PAGES / f"{name}.md").read_text()
    return FENCES.findall(text)


def project_files(name):
    result = {}
    for code in sources(name):
        match = re.match(r"// ([^\n ]+\.go)\npackage ", code)
        if match:
            result[match[1]] = code
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--core-source", type=Path, required=True)
    parser.add_argument("--http-source", type=Path, required=True, help="Echo platform checkout")
    parser.add_argument("--validator-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    env = dict(os.environ, GOWORK="off", GOENV="off", GOTOOLCHAIN="local")
    results = []
    replacements = {
        "github.com/NARUBROWN/spine": args.core_source.resolve(),
        "github.com/NARUBROWN/spine-echo-platform": args.http_source.resolve(),
        "github.com/NARUBROWN/spine-validator-playground": args.validator_source.resolve(),
    }
    for path in replacements.values():
        if not (path / "go.mod").is_file():
            parser.error(f"missing go.mod in {path}")
    stages = {name: {"main.go": next(c for c in sources(name) if c.startswith("package main\n"))}
              for name in CASES}
    stages["5-database"] = project_files("5-database")
    stages["6-transaction"] = {**stages["5-database"], **project_files("6-transaction")}
    for name, files in stages.items():
        if not files:
            raise AssertionError(f"no project files extracted from {name}")
        with tempfile.TemporaryDirectory(prefix=f"spine-v075-{name}-", dir="/var/tmp") as temporary:
            project = Path(temporary)
            for path, code in files.items():
                target = project / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(code)
            if name in CASES:
                (project / "tutorial_test.go").write_text(PROBE + CASES[name])
            (project / "go.mod").write_text(MOD + "\n" + "\n".join(
                f"replace {module} => {json.dumps(str(path))}" for module, path in replacements.items()) + "\n")
            completed = subprocess.run(["go", "test", "-mod=mod", "-count=1", "-timeout=90s", "./..."],
                                       cwd=project, env=env, text=True, capture_output=True, timeout=150)
            result = {"page": name, "mode": "runtime-http" if name in CASES else "compile-only-no-db",
                      "file_count": len(files), "exit_code": completed.returncode,
                      "stdout": completed.stdout, "stderr": completed.stderr,
                      "page_sha256": hashlib.sha256((PAGES / f"{name}.md").read_bytes()).hexdigest()}
            results.append(result)
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps({"replacements": {k: str(v) for k, v in replacements.items()},
                                              "checks": results}, ensure_ascii=False, indent=2) + "\n")
            print(f"{name}: {result['mode']} exit={completed.returncode}", flush=True)
            if completed.returncode:
                raise RuntimeError(completed.stdout + completed.stderr)


if __name__ == "__main__":
    main()
