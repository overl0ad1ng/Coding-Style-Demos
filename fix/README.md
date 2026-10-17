# Coding Style 修复样本

这里对应根目录当前全部 14 个反面案例。原始源码保持不变。修复依据是 `coding-style/SKILL.md`、`references/reuse.md`、`references/language-notes.md`，业务行为以根目录 README 为准。

本目录保留原始文件名，便于逐文件比较；`pricing.ts` 是订单与购物车共用的金额规则。没有修改扫描阈值、禁用规则、添加忽略项或设置 baseline。扫描范围包括本目录的源代码和测试代码。

## 修复对应关系

| 样本 | 修复 | Coding Style 依据 |
| --- | --- | --- |
| 01 订单 | 前置失败提前返回；库存审计独立成明确阶段；复用金额规则；选项具名 | 主行为可见、相关状态邻近、共享规则有归属 |
| 02 发票 | 发送资格具名；发送选项具名；明确正文格式；保留发送完成后审计 | 领域名称、调用契约、异步顺序 |
| 03 金额 | 预览、提交、收据调用同一金额计算 | 共享领域规则有唯一维护位置 |
| 04 支付 | 仅查询自动重试；扣款只发送一次；保留结果未知状态 | 复用前比较副作用、幂等约束和错误语义 |
| 05 日报 | 直接表达租户、结算、作废筛选与汇总 | 抽象须有具体职责，避免无收益跳转 |
| 06 导出 | 等待实际保存；失败进入最终结果；每个会话拥有状态；取消传到存储层 | 异步顺序、错误契约、状态与约束邻近 |
| 07 账户 | 统一客户术语与 Promise；等待持久化；注释对应真实契约 | 明确迁移方向、契约文档、错误边界 |
| 08 对账 | 共同维护导出资格；展开校验；显式记录审计；保留严格模式差异 | 策略归属、主路径可见、副作用可见 |
| 09 提现 | 每次调用保留商家信息；先调整总额，再算手续费；保留批量并发 | 相关状态邻近、重要顺序明确 |
| 10 物流 | 展示仅读取已有数据；库存预留放在确认操作；排序不修改输入 | 副作用与责任明确、保留约定行为 |
| 11–12 退款 | 所有入口调用现有退款政策；统一含截止时刻的 7 天窗口 | 调查并复用现有规则，保留政策归属 |
| 13–14 日报 | 用显式数据选择替代可覆盖处理器；预览仍强制筛选租户 | 无扩展需求时减少概念与跳转；约束有明确归属 |

## 有意调整的接口

这是修复示例，未为旧接口增加兼容包装；目录内调用方已同步更新。

- `processOrder(order, options, audit)`：原来的处理参数改为具名选项；金额统一遵守 README 的配送规则，不再存在未约定的境外 2500 分分支。
- `sendInvoice(invoice, customer, sender, options, audit)`：展示和渠道配置具名，格式为 `text` 或 `html`；`sendPaidInvoice` 保留便捷入口。
- 支付捕获返回 `paid` 或 `unknown` 状态。样例只约定 200 表示成功，没有约定能证明未扣款的错误码，所以其他响应须查询确认；`payOrder` 返回 `complete` 或 `check-status`。
- `createExportSession()`：每个独立任务界面持有自己的会话，读取 `session.state`，使用 `session.runExport` 和 `session.cancelExport`。顶层 `runExport`、`cancelExport` 为同一个按钮会话服务。
- 导出存储接口为 `save(customer, signal)`。实现必须观察 `AbortSignal`，停止正在执行的 I/O 后才结束 Promise；已经完成的保存不会因取消而回滚。等待存储停止期间保持 `cancelling`，不会提前显示完成，也不允许同会话重入。
- 账户更新使用 `updateCustomerEmail`，停用使用 `suspendAccount`；不存在返回 `null`，存储失败保持 Promise 拒绝，由界面转换成消息。
- Python 对账使用 `reconcile(rows, tenant_id, options, audit, now)` 和 `ReconciliationOptions`；移除与业务约定冲突的 `include_pending`。预览只复用导出资格，保留原始字段；主导出额外负责币种、金额和客户校验。
- 提现移除共享全局选择状态；物流展示不再接收库存依赖，确认发货使用 `confirmShipment(shipment, inventory)`。
- `11-refund-policy.ts` 继续拥有退款规则；`13-report-runtime.ts` 保留领域数据选择边界，移除没有外部扩展需求的通用运行时。

## 验证

本次验证结果（2026-10-17）：

| 检查 | 结果 |
| --- | --- |
| Coding Style 完整扫描 | 分析 19 个源代码与测试文件；0 告警、0 错误、0 跳过、0 抑制 |
| TypeScript 严格类型检查 | 通过，退出码 0 |
| TypeScript 行为测试 | 25 / 25 通过 |
| Python 行为测试 | 4 / 4 通过 |

原始反面案例仍位于项目根目录，因此对整个项目根目录扫描仍会发现原始告警；上表是对整个 `fix/` 的检查结果。

在项目根目录执行以下 PowerShell 命令。Node.js 使用本机 `node`，TypeScript 使用已安装 Coding Style Skill 的依赖；Python 使用本机 Codex 附带解释器。其他机器可替换下面的路径，测试加载器也可通过 `COGSTYLE_DIRECTORY` 指定 Skill 安装位置。

```powershell
$skillDirectory = Join-Path $env:USERPROFILE '.codex\skills\coding-style'
$samplePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'

# 严格 TypeScript 检查，不生成构建文件。
node (Join-Path $skillDirectory 'node_modules\typescript\bin\tsc') -p .\fix\tsconfig.json

# TypeScript 业务回归与契约检查。
node --test .\fix\tests\regressions.test.cjs .\fix\tests\contracts.test.cjs

# Python 结算回归与严格/宽松模式检查。
& $samplePython -B -m unittest discover -s .\fix\tests -p 'test_*.py'

# 全量扫描修复目录；只要有警告或覆盖错误即非零退出。
node (Join-Path $skillDirectory 'scripts\cogstyle.mjs') scan .\fix --python $samplePython --format json --fail-on-findings
```

`tests/load-typescript.cjs` 只负责在内存中加载 TS 样本及相邻导入，不生成产物，不替代 `tsc` 类型检查。测试默认针对 `fix/`；设置 `SAMPLE_ROOT` 为项目根目录可复现原始版本的行为失败，新增接口的契约检查应针对修复版运行。

最初 10 项 TypeScript 回归检查和 1 项 Python 导出资格检查均先在原始样例上确认失败，再在修复版上确认通过。测试使用本地受控依赖，不发起真实扣款、银行转账或业务数据写入。扫描零警告只说明默认结构规则通过，业务结果另由测试验证。
