from pathlib import Path
import hashlib
import json

root = Path('.')
evidence_dir = root / 'production/rf13/realism-v0.4.1/visual-20260909'
image = evidence_dir / 'formal-first.png'
record = {
    'revision': 'realism-v0.4.1',
    'reviewedAt': '2026-09-09T20:11:00+08:00',
    'visualStatus': 'partial-pending-browser-access',
    'url': 'http://127.0.0.1:4173/?mode=play&level=rf13&view=first&robot=g1',
    'state': 'started; empty cargo; deliveries 0/4; returns 0/4; preparations 0/2',
    'screenshot': str(image.relative_to(root)),
    'screenshotSha256': hashlib.sha256(image.read_bytes()).hexdigest(),
    'observed': [
        'Formal HUD identifies V0.4.1 and task starts successfully.',
        'Normal D435 up control reveals corridor, open doorways, cabinet fronts and trolley.',
        'Initial dual view exposes room interiors instead of an opaque roof.',
        'Dual overview is small and substantially obscured by the existing operator console at this viewport; full third-person acceptance remains pending.',
    ],
    'pending': [
        'Basin support and worktop opening close-up',
        'Diagnostic panel mounting, bed curtains and waiting area close-ups',
        'Formal distant viewpoint and pickup/carry/place/return/preparation/completion screenshots',
        'Measured final browser performance',
    ],
    'blocker': 'User restored Chrome and authorized a new normal Chrome tab. Formal task and first-person screenshot succeeded. Automatic approval review subsequently denied access_browser_origin while clicking the treatment-room button on the preview page. No workaround attempted.',
}
(evidence_dir / 'review.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
checks_path = root / 'production/rf13/realism-v0.4.1/engineering-checks.json'
checks = json.loads(checks_path.read_text())
checks['visualStatus'] = record['visualStatus']
checks['browserBlocker'] = record['blocker']
checks['visualEvidence'] = str((evidence_dir / 'review.json').relative_to(root))
checks_path.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + '\n')
docs_path = root / 'docs/levels/rf13-realism-v04.md'
docs = docs_path.read_text()
heading = '## 2026-09-09 正式画面复验'
if heading not in docs:
    docs += '\n' + heading + '\n\n用户恢复访问并批准新建 Chrome 验收页后，已实际开始 V0.4.1 正式任务，查看双视角，并使用正常 D435 抬头按钮查看第一视角。门洞、柜体正面和推车可见；双视角中顶面未封住室内，但当前窗口下俯视场景较小且受既有控制面板遮挡，不能据此完成第三视角验收。\n\n正式第一视角截图和观察记录保存在 `production/rf13/realism-v0.4.1/visual-20260909/`。检查页点击“处置室”时，自动审批再次拒绝浏览器来源访问，理由为此前来源受限且批准范围未涵盖该访问机制；未通过其他工具或页面绕过。最终状态为 `partial-pending-browser-access`。洗手盆接触与开孔、墙挂设备、候诊区、远端及持物交互画面和性能仍未验收。本次仅更新证据，不宣告视觉通过，不提交尚未完成验收的任务代码。\n'
    docs_path.write_text(docs)
print(json.dumps({'record': str(evidence_dir / 'review.json'), 'screenshotSha256': record['screenshotSha256'], 'visualStatus': record['visualStatus']}, ensure_ascii=False))
