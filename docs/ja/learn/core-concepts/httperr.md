# HTTP エラー

ハンドラーとインターセプターは公開 httperr 契約でステータスと公開メッセージを表します。内部詳細は通常のエラーで返します。

## 公開ヘルパー

```go
func BadRequest(msg string) error
func Unauthorized(msg string) error
func NotFound(msg string) error
func InternalServerError(msg string) error
```

順に 400、401、404、500 です。別の状態は &httperr.HTTPError{Status: 409, Message: "conflict"} などで表します。400〜599 のみ有効です。200 や 302 をエラーにすると詳細を隠した 500 です。成功状態は httpx.Response.Options、転送は httpx.Redirect を使います。

## 通常エラーとラップ

通常エラーは err.Error() を公開せず 500 です。HTTPError は errors.As で検出し、fmt.Errorf の %w でも包めます。明示したメッセージは公開されるため DB の生エラーを入れません。解析と登録検証器の失敗はハンドラー前に 400 です。

## インターセプターの優先順位

PreHandle はバインド前なので、不正本文でも認証失敗の 401 が先です。ハンドラー後の BeforeResponse がエラーを返すと応答で優先します。複数失敗なら最後を使い、以前のエラーも AfterCompletion に残します。完了は応答試行後で、状態変更やコミットの場所ではありません。

## 例

[Errors and validation](/ja/learn/tutorial/7-error-handling) / [インターセプター](/ja/learn/tutorial/4-interceptor) / [トランザクション](/ja/learn/tutorial/6-transaction)
