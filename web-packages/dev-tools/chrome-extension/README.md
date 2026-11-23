# Effects Chrome Extension

现有独立编辑器继续通过 `pnpm --filter dev-tools dev` 启动。Chrome 扩展用于连接业务页面里已经创建的 Player，界面仍使用同一套 Control、主题、停靠和属性控件。

扩展源码集中在 `../src/chrome-extension/`：`entry` 包含浏览器入口，`bridge` 管理页面通信，`panels` 包含运行时面板，`application.ts` 组装界面。面板独立维护运行时数据、选中状态和编辑命令，只复用现有的基础 Control、主题、停靠和通用属性控件；普通编辑器面板不接入远程模式。

本目录保存 manifest、HTML 入口和扩展文档；构建脚本为 `../scripts/build-extension.mjs`，复用 `../vite.config.js`，并在脚本中设置扩展的 HTML 入口和输出目录。

## 构建和加载扩展

```sh
pnpm --filter dev-tools build:extension
```

在 Chrome 的 `chrome://extensions` 打开开发者模式，点击“加载已解压的扩展程序”，选择 `web-packages/dev-tools/dist/chrome`。加载或更新扩展后刷新业务页面，打开其 DevTools，然后选择 **Effects** 标签页。

## 自动发现页面实例

UMD 或主动挂载全局命名空间的页面，会自动通过 `window.ge.getActivePlayers()` 发现已有实例，以及后续创建、销毁的变化。扩展只读取现有命名空间，不会创建或覆盖 `window.ge`，也不要求 SDK 安装调试钩子。

ES module、CommonJS 打包页面只需暴露同一个查询函数，不需要导入 dev-tools 包：

```js
import { getActivePlayers } from '@galacean/effects';

window.ge = { getActivePlayers };
```

`getActivePlayers` 必须来自创建 Player 所用的同一份 SDK。已有 `window.ge` 时，将查询函数添加到现有命名空间即可。扩展会列出它返回的实例，并持续发现创建、销毁后的变化，不创建或驱动 Player。

## 运行时调试

- 工具栏切换目标 Player，暂停、继续或跳转播放时间。
- Hierarchy 显示实际场景层级，支持搜索、展开、显隐切换和对象选择。
- Inspector 使用公用属性表编辑基础属性、Transform、组件属性、颜色和向量，支持按次编辑的撤销、重做。
- 选中 Scene 会显示合成信息、根元素的 Transform 和组件，包括根合成上的 Animator；组件编辑作用于原有运行时实例。
- Runtime Assets 显示目标引擎中已注册的运行时资源；选择资源可检查属性，图像、视频和 RGBA 字节源纹理可预览。
- 拾取按钮在业务画布上选择对象，高亮按钮显示选中对象的边界。普通高亮层允许鼠标穿透。
- 双击层级对象或资源可将实际对象输出到业务页面的 Console。

属性修改作用于运行中的对象。业务代码每帧重新写入的属性，仍然会被业务逻辑更新；可以暂停后检查修改。这里不把运行时修改保存成项目资产。

## 连接与渲染

扩展通过 `chrome.devtools.inspectedWindow.eval()` 调用页面侧代理。对象和 GPU 资源留在业务页面中，面板接收可序列化的快照并发送编辑命令；纹理预览通过图像传递。面板使用自己的 Canvas 和 WebGL context。

目标 Player 的画布、场景加载和渲染循环仍由业务代码管理。代理仅在显式编辑暂停的 Player 时请求一次零时间步渲染。面板隐藏时停止轮询并移除拾取、高亮层；关闭 DevTools 时通过浏览器 Port 的断开事件清理覆盖层。内容脚本仅接收该生命周期连接，不读取运行时数据。页面刷新会建立新的调试会话，旧会话命令不会应用到新实例。

当前仅连接被检查页面的主 frame。

压缩纹理和未保留像素源的 GPU 纹理目前仅显示属性，不提供图像预览。
