#!/usr/bin/env python3
"""Compile current documentation in isolated modules and exercise public APIs.

No listeners are opened except an ephemeral httptest WebSocket server. External
DB and broker examples are compile-only. Local source replacements are optional;
omitting them verifies the published module cohort in the documentation.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs/ko"
SPEC = importlib.util.spec_from_file_location("tutorials", ROOT / "scripts/check-v075-tutorials.py")
TUTORIALS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TUTORIALS)
FENCE = re.compile(r"^```go\n(.*?)^```[ \t]*$", re.M | re.S)
MOD = TUTORIALS.MOD + """
require (
 github.com/NARUBROWN/spine-gorilla-platform v0.2.0
 github.com/gorilla/websocket v1.5.3
 github.com/golang-jwt/jwt/v5 v5.3.1
)
"""
SOURCE_MODULES = {
 "core": "github.com/NARUBROWN/spine",
 "http": "github.com/NARUBROWN/spine-echo-platform",
 "validator": "github.com/NARUBROWN/spine-validator-playground",
 "websocket": "github.com/NARUBROWN/spine-gorilla-platform",
}

def blocks(path):
    return FENCE.findall((DOCS / path).read_text())

def standalone(path):
    candidates = [b for b in blocks(path) if b.startswith("package main\n")]
    if len(candidates) != 1:
        raise AssertionError(f"{path}: expected one standalone main, found {len(candidates)}")
    return {"main.go": candidates[0]}

def files(path):
    result = {}
    for source in blocks(path):
        match = re.match(r"// ([^\n ]+\.go)\npackage ", source)
        if match:
            if match[1] in result:
                raise AssertionError(f"duplicate {match[1]} in {path}")
            result[match[1]] = source
    if not result:
        raise AssertionError(f"no files in {path}")
    return result

ENTRY = '''package main
import (
 "log"
 "MODULE/internal/application"
 "github.com/NARUBROWN/spine"
 "github.com/NARUBROWN/spine/pkg/boot"
)
func BuildApplication() (spine.App,boot.Options,error) { return application.BuildApplication() }
func main() { app,options,err:=BuildApplication();if err!=nil{log.Fatal(err)};if err:=app.Run(options);err!=nil{log.Fatal(err)} }
'''
QUERY = r'''func TestQueryInputs(t *testing.T){
 h:=handler(t)
 out:=object(t,call(t,h,"GET","/search?name=alice&page=2&tag=go&tag=web","",nil,200))
 if out["name"]!="alice"||out["page"]!=float64(2)||len(out["tags"].([]any))!=2{t.Fatal(out)}
 out=object(t,call(t,h,"GET","/search?tag=go,web","",nil,200))
 if out["page"]!=float64(1)||len(out["tags"].([]any))!=2{t.Fatal(out)}
 call(t,h,"GET","/search?page=invalid","",nil,400)
 call(t,h,"GET","/search?page=1&page=2","",nil,400)
}'''
OPENAPI = r'''func TestOpenAPIAndValidation(t *testing.T){
 h:=handler(t)
 for _,path:=range []string{"/docs","/redoc"}{call(t,h,"HEAD",path,"",nil,200)}
 invalid:=object(t,call(t,h,"POST","/users","{}",nil,400))
 if invalid["fields"]==nil{t.Fatal(invalid)}
 call(t,h,"POST","/users",`{"name":"Alice","email":"alice@example.com"}`,nil,201)
 doc:=object(t,call(t,h,"GET","/openapi.json","",nil,200))
 operation:=doc["paths"].(map[string]any)["/users"].(map[string]any)["post"].(map[string]any)
 schema:=operation["requestBody"].(map[string]any)["content"].(map[string]any)["application/json"].(map[string]any)["schema"].(map[string]any)
 ref:=strings.TrimPrefix(schema["$ref"].(string),"#/components/schemas/")
 model:=doc["components"].(map[string]any)["schemas"].(map[string]any)[ref].(map[string]any)
 required:=map[any]bool{};for _,key:=range model["required"].([]any){required[key]=true}
 if !required["name"]||!required["email"]{t.Fatal(model)}
}'''
CRUD = r'''func TestCRUD(t *testing.T){
 h:=handler(t)
 call(t,h,"POST","/users",`{"name":"","email":"bad"}`,nil,400)
 created:=object(t,call(t,h,"POST","/users",`{"name":"Alice","email":"alice@example.com"}`,nil,200))
 if created["id"]!=float64(1){t.Fatal(created)}
 list:=object(t,call(t,h,"GET","/users","",nil,200))
 if list["total"]!=float64(1){t.Fatal(list)}
 call(t,h,"GET","/users/1","",nil,200)
 call(t,h,"GET","/users/not-a-number","",nil,400)
 call(t,h,"POST","/users",`{"name":"Other","email":"alice@example.com"}`,nil,400)
 updated:=object(t,call(t,h,"PUT","/users/1",`{"name":"Bob","email":"bob@example.com"}`,nil,200))
 if updated["name"]!="Bob"{t.Fatal(updated)}
 call(t,h,"PUT","/users/1",`{"name":"","email":"bad"}`,nil,400)
 call(t,h,"DELETE","/users/1","",nil,200)
 call(t,h,"GET","/users/1","",nil,404)
}'''
LOGIN = r'''func TestLogin(t *testing.T){
 h:=handler(t)
 call(t,h,"POST","/signup","{}",nil,400)
 created:=object(t,call(t,h,"POST","/signup",`{"email":"alice@example.com","password":"1234","name":"Alice"}`,nil,200))
 if _,exists:=created["password"];exists{t.Fatal("password leaked")}
 call(t,h,"POST","/login",`{"email":"alice@example.com","password":"wrong"}`,nil,401)
 logged:=object(t,call(t,h,"POST","/login",`{"email":"alice@example.com","password":"1234"}`,nil,200))
 token,ok:=logged["token"].(string);if !ok||token==""{t.Fatal(logged)}
 call(t,h,"GET","/me","",nil,401)
 call(t,h,"GET","/me","",map[string]string{"Authorization":"Bearer invalid"},401)
 me:=object(t,call(t,h,"GET","/me","",map[string]string{"Authorization":"Bearer "+token},200))
 if me["email"]!="alice@example.com"{t.Fatal(me)}
}'''
WS = r'''package main
import (
 "context"
 "encoding/json"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
 "github.com/NARUBROWN/spine"
 "github.com/gorilla/websocket"
)
func TestWebSocketEcho(t *testing.T){
 app,options,err:=BuildApplication();if err!=nil{t.Fatal(err)}
 if err:=app.Validate(options);err!=nil{t.Fatal(err)}
 prepared,err:=app.Prepare(t.Context(),options);if err!=nil{t.Fatal(err)}
 t.Cleanup(func(){if err:=prepared.Close(context.Background());err!=nil{t.Error(err)}})
 h,err:=spine.NetHTTPHandler(prepared);if err!=nil{t.Fatal(err)}
 server:=httptest.NewServer(h);defer server.Close()
 response,err:=server.Client().Get(server.URL+"/health");if err!=nil{t.Fatal(err)}
 var health map[string]string
 if err:=json.NewDecoder(response.Body).Decode(&health);err!=nil{response.Body.Close();t.Fatal(err)}
 response.Body.Close()
 if response.StatusCode!=200||health["status"]!="ok"{t.Fatal(health)}
 conn,_,err:=websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL,"http")+"/ws/chat",nil);if err!=nil{t.Fatal(err)}
 defer conn.Close()
 if err:=conn.WriteJSON(map[string]string{"message":"hello"});err!=nil{t.Fatal(err)}
 conn.SetReadDeadline(time.Now().Add(5*time.Second))
 kind,payload,err:=conn.ReadMessage();if err!=nil{t.Fatal(err)}
 var out map[string]any;if err:=json.Unmarshal(payload,&out);err!=nil{t.Fatal(err)}
 if kind!=websocket.TextMessage||out["message"]!="hello"||out["type"]!="message"||out["from"]==""{t.Fatal(out)}
}'''
CONTRACT_PREFIX = '''package contracts
import (
 "context"
 "reflect"
 "testing"
 spine "github.com/NARUBROWN/spine"
 "github.com/NARUBROWN/spine/core"
 "github.com/NARUBROWN/spine/pkg/api"
 "github.com/NARUBROWN/spine/pkg/boot"
 httpcontract "github.com/NARUBROWN/spine/contract/http"
 spinectx "github.com/NARUBROWN/spine/pkg/spine"
)
type Registrar = spine.Registrar
type PreparedApplication = spine.PreparedApplication
type HTTPRequestView = spinectx.HTTPRequestView
type HTTPResponseView = spinectx.HTTPResponseView
type WebSocketView = spinectx.WebSocketView
'''
CONTRACT_TEST = '''
func same(t *testing.T,a,b reflect.Type) {
 t.Helper()
 if a.NumMethod()!=b.NumMethod(){t.Fatalf("%s has %d methods, documented %d",a,a.NumMethod(),b.NumMethod())}
 for i:=0;i<a.NumMethod();i++ {x,y:=a.Method(i),b.Method(i);if x.Name!=y.Name||x.Type!=y.Type{t.Fatalf("%s: %v != %v",x.Name,x.Type,y.Type)}}
}
func TestPublicContracts(t *testing.T){
 same(t,reflect.TypeOf((*spine.App)(nil)).Elem(),reflect.TypeOf((*DocumentedApp)(nil)).Elem())
 same(t,reflect.TypeOf((*spine.PreparedApplication)(nil)).Elem(),reflect.TypeOf((*DocumentedPreparedApplication)(nil)).Elem())
 same(t,reflect.TypeOf((*spinectx.Ctx)(nil)).Elem(),reflect.TypeOf((*DocumentedCtx)(nil)).Elem())
 same(t,reflect.TypeOf((*spinectx.ExecutionContextView)(nil)).Elem(),reflect.TypeOf((*ExecutionContextView)(nil)).Elem())
 same(t,reflect.TypeOf((*core.Interceptor)(nil)).Elem(),reflect.TypeOf((*Interceptor)(nil)).Elem())
 a,b:=reflect.TypeOf(core.HandlerMeta{}),reflect.TypeOf(HandlerMeta{})
 if a.NumField()!=b.NumField(){t.Fatal("HandlerMeta field count changed")}
 for i:=0;i<a.NumField();i++{x,y:=a.Field(i),b.Field(i);if x.Name!=y.Name||x.Type!=y.Type{t.Fatalf("HandlerMeta: %v != %v",x,y)}}
}
'''
def declaration(path, name, kind="interface"):
    text="\n".join(blocks(path))
    match=re.search(r"type "+re.escape(name)+r" "+kind+r"\s*\{[^}]*\}",text,re.S)
    if not match: raise AssertionError(f"missing {name} in {path}")
    return match[0]

def contract_project():
    app=declaration("reference/api/spine-app.md","App").replace("type App interface","type DocumentedApp interface")
    prepared=declaration("reference/api/spine-app.md","PreparedApplication").replace("type PreparedApplication interface","type DocumentedPreparedApplication interface")
    ctx=declaration("reference/api/execution-context.md","Ctx").replace("type Ctx interface","type DocumentedCtx interface")
    execution=declaration("reference/api/execution-context.md","ExecutionContextView")
    # A named local interface must alias the public view in the Ctx signature.
    ctx=ctx.replace("ExecutionContext() ExecutionContextView","ExecutionContext() spinectx.ExecutionContextView")
    interceptor=declaration("reference/api/interceptor.md","Interceptor")
    meta=declaration("learn/core-concepts/handler-meta.md","HandlerMeta","struct")
    return {"contracts_test.go":CONTRACT_PREFIX+"\n"+app+"\n"+prepared+"\n"+ctx+"\n"+execution+"\n"+interceptor+"\n"+meta+"\n"+CONTRACT_TEST}

def stages(mode):
    result=[]
    if mode in ("all","standalone"):
        for name,probe in TUTORIALS.CASES.items():
            result.append((name,"example.com/my-app",standalone(f"learn/tutorial/{name}.md"),TUTORIALS.PROBE+probe,"runtime-http"))
        for path,probe in [
          ("learn/getting-started/intro.md",TUTORIALS.CASES["3-dependency-injection"]),
          ("learn/core-concepts/query-values.md",QUERY),
          ("learn/tutorial/8-swagger.md",OPENAPI),
          ("reference/api/openapi.md",OPENAPI),
        ]:
            result.append((path,"example.com/my-app",standalone(path),TUTORIALS.PROBE+probe,"runtime-http"))
        result.append(("websocket","example.com/my-app",standalone("reference/examples/websocket.md"),WS,"runtime-websocket"))
        for name,probe in [("crud",CRUD),("login",LOGIN)]:
            source=files(f"reference/examples/{name}.md")
            module=f"example.com/{name}-example"
            source["main.go"]=ENTRY.replace("MODULE",module)
            result.append((name,module,source,TUTORIALS.PROBE+probe,"runtime-http"))
        onboarding=files("learn/tutorial/1-project-structure.md")
        result.append(("onboarding","example.com/my-app",onboarding,"","compile-only"))
        database=files("learn/tutorial/5-database.md")
        result.append(("database","example.com/my-app",database,"","compile-only-no-db"))
        result.append(("transactions","example.com/my-app",{**database,**files("learn/tutorial/6-transaction.md")},"","compile-only-no-db"))
    if mode in ("all","contracts"):
        result.append(("public-contracts","example.com/my-app",contract_project(),"","reflection-contracts"))
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode",choices=["all","standalone","contracts"],default="all")
    for name in SOURCE_MODULES:
        parser.add_argument("--"+name+"-source",type=Path)
    parser.add_argument("--output",type=Path)
    parser.add_argument("--only",action="append",help="Run only a named project; may be repeated")
    args=parser.parse_args()
    replacements={}
    for name,module in SOURCE_MODULES.items():
        source=getattr(args,name+"_source")
        if source:
            source=source.resolve()
            if not (source/"go.mod").is_file():parser.error(f"missing go.mod: {source}")
            replacements[module]=str(source)
    env=dict(os.environ,GOWORK="off",GOENV="off",GOTOOLCHAIN="local")
    checks=[]
    selected = [stage for stage in stages(args.mode) if not args.only or stage[0] in args.only]
    if args.only and set(args.only) - {stage[0] for stage in selected}:
        parser.error("unknown project selected")
    for name,module,source,probe,mode in selected:
        with tempfile.TemporaryDirectory(prefix="spine-doc-v075-",dir="/var/tmp") as temporary:
            project=Path(temporary)
            for path,code in source.items():
                target=project/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(code)
            if probe:(project/"doc_test.go").write_text(probe)
            mod=MOD.replace("module example.com/my-app","module "+module)
            mod+="\n"+"\n".join(f"replace {module} => {json.dumps(path)}" for module,path in replacements.items())+"\n"
            (project/"go.mod").write_text(mod)
            completed=subprocess.run(["go","test","-mod=mod","-count=1","-timeout=45s","./..."],cwd=project,env=env,text=True,capture_output=True,timeout=150)
            checks.append({"name":name,"mode":mode,"exit_code":completed.returncode,"stdout":completed.stdout,"stderr":completed.stderr})
            print(f"{name}: {mode} exit={completed.returncode}",flush=True)
            if args.output:
                args.output.parent.mkdir(parents=True,exist_ok=True)
                args.output.write_text(json.dumps({"dependencies":"local-source" if replacements else "published-modules","replacements":replacements,"checks":checks},ensure_ascii=False,indent=2)+"\n")
            if completed.returncode:raise RuntimeError(completed.stdout+completed.stderr)

if __name__=="__main__":main()
