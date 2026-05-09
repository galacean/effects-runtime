# Frame Diff 手工回归基线模板

> 用途：记录一次可复现的手工回归结果，作为后续重构对比基线。
> 说明：本项目 `pnpm test` 以页面人工观察为准，本模板用于标准化记录。

## 1. 执行信息

- 日期：
- 执行人：
- 分支：
- 关联提交（可选）：
- 浏览器/版本：
- 操作系统：
- 机器信息（可选）：

## 2. 环境参数

- 旧版 runtime 版本（URL `version` 参数）：
- 资源基地址（URL `assetBaseUrl` 参数，可选）：
- Viewer.js 版本（页面引入）：
- 是否开启本地代理/科学上网（影响资源加载）：

## 3. 入口与执行范围

按本次执行入口逐项记录（可复制多段）：

### 入口记录

- 页面：`2d.html` / `3d.html` / `spine.html`
- 查询参数：
- profile 过滤（`profiles`）：
- 目标 profile：
- 目标场景数：

## 4. 结果摘要

- 总体结论：通过 / 不通过
- 失败场景数量：
- 主要失败类型：
  - 资源加载失败
  - GPU 等级检查失败
  - 像素差异超阈值
  - 预览图渲染异常
  - 其他

## 5. 详细失败记录

失败项按以下格式追加：

### 失败项

- profile：
- scene id/name：
- 时间点（time）：
- 渲染后端：`webgl` / `webgl2`
- diff ratio：
- 阈值：
- 控制台关键日志：
- 截图文件名（old/new/diff）：
- 是否可稳定复现：是 / 否
- 备注：

## 6. 预览能力检查

- OLD/NEW/HEATMAP 三列展示正常：是 / 否
- heatmap 生成正常：是 / 否
- “全预览”链接可用：是 / 否
- 点击图片可打开 Viewer：是 / 否
- 缩放工具栏正常：是 / 否

## 7. 结论与后续动作

- 是否可作为新基线：是 / 否
- 若否，请给出阻塞项：
- 建议后续动作：
  - 修复后重跑
  - 缩小范围验证（指定 profile）
  - 回滚最近改动
  - 其他

## 8. 附：推荐执行 URL

- `2d.html?profiles=2d-interact`
- `2d.html?profiles=2d-dynamic`
- `2d.html?profiles=2d-inspire`
- `3d.html?profiles=3d-gltf`
- `3d.html?profiles=3d-case`
- `spine.html?profiles=spine`
