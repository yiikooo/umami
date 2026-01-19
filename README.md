# Umami (EdgeOne Pages 移植版)

> [!WARNING]
> **EdgeOne Pages 运行时兼容性严重警告**
>
> 经排查确认，EdgeOne Pages 平台在 **2025年12月21日** 左右更新了其 Node.js/Next.js 运行时适配器，引入了一个底层缺陷，导致在此日期之后部署的 Umami 实例无法正常工作（主要表现为 API 请求体丢失，导致登录失败等 400 错误）。
>
> **影响范围说明：**
> *   🔴 **受影响**：**2025年12月21日之后**新建，或在此日期之后执行过重新构建/部署的项目。
> *   🟢 **不受影响**：在此日期之前部署，且之后**未进行过任何更新**的旧存量项目（请务必避免触发重新构建，否则将受到影响）。
>
> **安全提示：**
> 为了协助官方定位修复该问题，当前代码库已临时植入了大量深度调试日志（Debug Logs）。这些日志可能会在构建日志或运行时输出中暴露敏感信息。**在官方修复此问题并移除本警告之前，建议普通用户暂停部署或更新。**

> [!NOTE]
> 我们已在 https://github.com/afoim/umami-edgeonepages/tree/main 短暂性修复该问题。由于EO吃POST请求，我们全部换成了GET请求 

### 漏洞详情与复现报告

# Bug Report: Next.js App Router Request Body Prematurely Consumed on EdgeOne Pages

## Summary
在 Tencent Cloud EdgeOne Pages (基于 SCF) 环境下部署 Next.js (App Router) 应用时，API Route 接收到的 `Request` 对象的 Body Stream 已经被提前消费 (Consumed/Drained)，导致应用层无法读取请求体。

即使 `content-length` 标头显示请求体存在且非零，应用层调用 `request.text()` 仍返回空字符串，调用 `request.json()` 则抛出 `Body is unusable: Body has already been read` 错误。这表明平台的 Next.js 适配器在将请求传递给应用逻辑之前，已经消耗了 Body 流且未正确重置。

## Environment
- **Platform**: Tencent Cloud EdgeOne Pages (Serverless Cloud Function / SCF)
- **Framework**: Next.js (App Router)
- **Deployment Type**: Serverless / Edge
- **Issue Scope**: All API Routes handling POST/PUT requests with body

## Reproduction Steps (POC)

### 1. POC Code
在 Next.js 项目中创建 `src/app/api/debug-poc/route.ts`：

```typescript
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  log(`[Start] Method: ${request.method}`);
  
  // 1. Check Headers
  const headers = Object.fromEntries(request.headers);
  const contentLength = headers['content-length'];
  log(`[Headers] content-length: ${contentLength}`);
  log(`[Headers] content-type: ${headers['content-type']}`);

  // 2. Check Body Status
  log(`[Status] request.bodyUsed before read: ${request.bodyUsed}`);

  // 3. Attempt Read
  try {
      const text = await request.text();
      log(`[Result] req.text() returned length: ${text.length}`);
      if (text.length === 0 && Number(contentLength) > 0) {
          log(`[FATAL] Content-Length is ${contentLength} but body text is empty!`);
      }
  } catch (e: any) {
      log(`[Error] req.text() failed: ${e.message}`);
  }

  // 4. Attempt JSON (to trigger specific stream error)
  try {
      // Re-reading specific error message
      await request.json();
  } catch (e: any) {
      log(`[Error] req.json() failed: ${e.message}`);
  }

  return NextResponse.json({
    platform: 'EdgeOne Pages',
    headers: { 'content-length': contentLength },
    logs
  });
}
```

### 2. Execution
发送一个带有 Body 的 POST 请求：
```bash
curl -X POST "https://your-site.edgeone.cool/api/debug-poc" \
     -H "Content-Type: application/json" \
     -d '{"test": "hello"}'
```

## Observed Logs
实际运行结果如下（基于真实环境调试）：

```json
{
    "headers": {
        "content-length": "46"
    },
    "logs": [
        "[Start] Method: POST",
        "[Headers] content-length: 46",
        "[Headers] content-type: application/json",
        "[Status] request.bodyUsed before read: false", 
        "[Result] req.text() returned length: 0",
        "[FATAL] Content-Length is 46 but body text is empty!",
        "[Error] req.json() failed: Body is unusable: Body has already been read"
    ]
}
```

## Technical Analysis
1.  **Stream Drained**: `req.json()` 抛出的错误 `Body has already been read` 是最直接的证据。这表明底层的 ReadableStream 已经被读取过。
2.  **Adapter Issue**: 在 Next.js App Router 中，`Request` 对象应由适配器根据入站事件（如 SCF Event）构建。如果适配器在构建 Request 对象时（例如为了处理 Base64 编码、日志记录或 WAF 检查）读取了流，但没有使用 `tee()` 分流或重置流，应用层拿到的就是枯竭的流。
3.  **Inconsistency**: `request.bodyUsed` 为 `false` 但流实际已空，这可能表明适配器创建了一个新的 Request 对象，但传入了一个已经空的 Stream，或者状态同步存在 Bug。

## Recommendation
建议 EdgeOne 团队检查 Next.js Runtime 适配器中关于 Request Body 的处理逻辑：
1.  确保在读取 Body（如用于 Base64 解码）后，创建一个新的 Buffer/Stream 传递给 Next.js。
2.  或者，确保使用 `stream.tee()` 来保留流的可读性。

### 立即可以进行的 POC 测试并获取详细调试信息（针对当前仓库最新提交）
```curl
curl -X POST "https://eo-umami.acofork.com/api/debug-poc" \
     -H "Content-Type: application/json" \
     -d '{"test": "hello edgeone", "timestamp": 123456}'
```
