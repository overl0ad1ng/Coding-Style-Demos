# Coding Style 扫描样例

本目录包含 14 个刻意保留问题的代码文件，用于评估 coding-style SKILL。根目录源码保留为反面案例，对应修复样本、行为测试与验证方法见 [fix/README.md](fix/README.md)。数据和依赖均为示例；文件不会在导入时发起请求或写入数据。

这些文件模拟同一个订单后台的不同模块。`11` 与 `12`、`13` 与 `14` 分别需要结合阅读，其他场景可以分别阅读。TypeScript 不需要第三方库，Python 只使用标准库。这里不提供逐项答案，方便进行首次扫描。

## 业务背景

- 金额统一使用整数分。购物车预览、提交订单和收据应遵守同一套配送费规则：普通配送 800 分，会员且商品原价合计达到 10000 分免配送费；加急费另加 1500 分。会员商品折扣为 10%。
- 付款接口不保证幂等。读取支付状态可以重试；扣款必须考虑请求已被服务端处理、客户端却未收到响应的情况。
- 对账任务只应导出已结算、未作废且属于当前租户的记录。
- 客户导出成功应表示所有客户都已经保存。后台取消操作应能让正在执行的导出停止。
- 账户模块正在统一使用 `customerId`、`emailAddress`、`suspended` 和 Promise 异步接口；旧名字没有兼容性要求。
- 发票通知需要可用的收件邮箱、已确认订单、已结算付款、未退订客户、启用的通知渠道和非空附件。
- 商家提现按调整后的总额收取 2% 手续费；每笔转账的租户、银行账户和金额应属于同一个商家，批量提现允许并发。
- 物流卡片和提示浮层只展示现有物流数据；库存预留属于确认发货操作，展示不会触发它。
- 退款只适用于已结算、尚未发货且付款后不超过 7 × 24 小时的订单，恰好位于截止时间也允许全额退款。按钮、接口、邮件和管理列表遵守同一政策。
- 日报只允许展示当前租户的数据，正式日报仅包含已结算记录；预览可以包含未结算记录。本功能没有插件、外部扩展点或运行时更换实现的需求。

## 文件

| 文件 | 场景 |
| --- | --- |
| `01-order-processing.ts` | 提交订单与处理配送 |
| `02-invoice-notifications.ts` | 发送发票通知 |
| `03-cart-pricing.ts` | 预览、提交和收据金额 |
| `04-payment-gateway.ts` | 查询支付状态与扣款 |
| `05-report-pipeline.ts` | 组装日报数据 |
| `06-customer-export.ts` | 启动、执行与取消客户导出 |
| `07-customer-accounts.ts` | 更新账户、停用账户及调用方 |
| `08-settlement-reconciliation.py` | 多租户结算对账 |
| `09-payout-session.ts` | 商家提现与批量转账 |
| `10-shipment-view.ts` | 物流卡片与提示浮层 |
| `11-refund-policy.ts` | 退款政策与订单信息 |
| `12-refund-actions.ts` | 退款按钮、接口、邮件和管理列表 |
| `13-report-runtime.ts` | 日报运行环境 |
| `14-report-screen.ts` | 日报安装、预览与展示 |

## 扫描命令

在 PowerShell 中执行，使用本机已经安装的技能：

```powershell
$demoPython = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
node "$env:USERPROFILE\.codex\skills\coding-style\scripts\cogstyle.mjs" scan "$env:USERPROFILE\Desktop\Coding-Style-Demos" --python "$demoPython" --format json
```

也可以使用相邻仓库中的技能版本：

```powershell
$demoPython = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
node "$env:USERPROFILE\Desktop\Coding-Style\coding-style\scripts\cogstyle.mjs" scan "$env:USERPROFILE\Desktop\Coding-Style-Demos" --python "$demoPython" --format json
```

首次扫描请使用完整扫描，不加 `--changed`。保留默认阈值，不配置忽略项或 baseline。根目录仍包含反面案例；验证修复样本时请将扫描目标设为 `fix/`，具体命令见其 README。

本机默认 `python` 指向 Windows 应用执行别名，因此上面显式指定了 Codex 附带的解释器。换机器时，将 `$demoPython` 改成当地可用的 Python 3.10+ 路径。

## 可直接交给 agent 的提示词

> 使用 coding-style SKILL 审查 Coding-Style-Demos，先阅读 README 中的业务背景，再扫描并阅读全部 14 个源码文件及其中的调用方和导入依赖。只报告问题，不修改文件。每项发现提供文件和行号、维护者需要额外推理的原因、具体影响与改进方向。区分脚本提供的结构性线索和人工结合上下文发现的问题，报告实际扫描覆盖范围；不要只复述指标或为降低指标而机械拆函数。没有结构告警的文件也必须审查；不要把合理的模块边界或正常的业务分支直接判为问题。扫描范围不要覆盖 /fix/、/scan/，并且不要阅读 /fix/、/scan/ 当中的任何文件。
