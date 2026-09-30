import { GizmoDemo } from './gizmo-2d/app';
import { element } from './gizmo-2d/dom';

try {
  new GizmoDemo().start();
} catch (error) {
  const status = element('status');

  status.textContent = `初始化失败：${String(error)}`;
  status.dataset.error = 'true';
  console.error(error);
}
