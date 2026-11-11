#!/usr/bin/env python3
"""Check documented CLI recipes in temporary projects without DB/broker startup."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/"docs/ko"
FENCE=re.compile(r"^```go\n(.*?)^```[ \t]*$",re.M|re.S)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cli",type=Path,required=True,help="CLI binary to verify")
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    executable=str(args.cli.resolve())
    env=dict(os.environ,GOWORK="off",GOENV="off",GOTOOLCHAIN="local")
    checks=[]
    def run(cwd,command):
        completed=subprocess.run(command,cwd=cwd,env=env,text=True,capture_output=True,timeout=180)
        checks.append({"command":command,"exit_code":completed.returncode,"stdout":completed.stdout,"stderr":completed.stderr})
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps({"cli":executable,"checks":checks},ensure_ascii=False,indent=2)+"\n")
        if completed.returncode:raise RuntimeError(completed.stdout+completed.stderr)
        print("PASS "+" ".join(command),flush=True)
    with tempfile.TemporaryDirectory(prefix="spine-doc-cli-",dir="/var/tmp") as temporary:
        work=Path(temporary)
        # This is the onboarding command, with installation deferred to the explicit check below.
        run(work,[executable,"new","my-app","--module","example.com/my-app","--channel","main","--validator","playground","--no-interactive","--skip-install"])
        app=work/"my-app"
        run(app,["go","mod","tidy"])
        run(app,["go","mod","download","all"])
        run(app,[executable,"generate","resource","user","--dry-run"])
        run(app,[executable,"generate","resource","user"])
        run(app,[executable,"--help"])
        run(app,[executable,"contract","check"])
        run(app,["go","test","-count=1","./..."])
        deprecated=re.compile(r"\bapp\.Route\(|\broute\.WithInterceptors\(|github\.com/NARUBROWN/spine/(?:pkg/(?:path|query|header|multipart)|internal/)")
        for path in app.rglob("*.go"):
            if deprecated.search(path.read_text()):raise AssertionError(f"deprecated API generated: {path.relative_to(app)}")
        # MSA docs replace generated app and consumer files and retain platform config.
        for name,extra in [("order-app",[]),("stock-app",["--platform","none"])]:
            run(work,[executable,"new",name,"--module","example.com/"+name,*extra,"--event-platform","kafka","--channel","main","--no-interactive","--skip-install"])
        run(work,[executable,"generate","consumer","order","--root","stock-app","--topic","order.created","--field","event_id:string","--field","order_id:int64"])
        for source in FENCE.findall((DOCS/"reference/examples/msa.md").read_text()):
            match=re.match(r"// ((?:order-app|stock-app)/[^\n ]+\.go)\npackage ",source)
            if not match:continue
            path=work/match[1];path.parent.mkdir(parents=True,exist_ok=True);path.write_text(source)
        stock=work/"stock-app"
        run(stock,["go","mod","edit","-require=example.com/order-app@v0.0.0","-replace=example.com/order-app=../order-app"])
        for name in ["order-app","stock-app"]:
            folder=work/name
            run(folder,["go","mod","tidy"])
            run(folder,["go","mod","download","all"])
            run(folder,["go","test","-count=1","./..."])
            run(folder,[executable,"contract","check"])
            run(folder,[executable,"verify"])
        print("PASS onboarding generation and MSA compile/static checks; no broker connected",flush=True)

if __name__=="__main__":main()
