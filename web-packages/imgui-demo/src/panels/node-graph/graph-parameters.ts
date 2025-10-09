import { ImGui } from '../../imgui';
import type { GraphInstance } from '@galacean/effects';

interface ParameterControl {
  id: string,
  name: string,
  type: 'bool' | 'float' | 'int' | 'trigger',
  nodeInstance?: any,
  currentValue?: any,
  // 用于浮点参数的范围设置
  minValue?: number,
  maxValue?: number,
}

export class AnimationParametersPanel {
  private parameters: ParameterControl[] = [];
  private graphInstance: GraphInstance | null = null;

  constructor () {}

  setGraphInstance (graphInstance: GraphInstance | null) {
    this.graphInstance = graphInstance;
    this.refreshParameters();
  }

  private refreshParameters () {
    this.parameters = [];

    if (!this.graphInstance) {
      return;
    }

    const numParams = this.graphInstance.getNumControlParameters();

    for (let i = 0; i < numParams; i++) {
      const parameterID = this.graphInstance.getControlParameterID(i);
      const nodeInstance = this.graphInstance.getNodeDebugInstance(i);

      let paramType: 'bool' | 'float' | 'int' | 'trigger' = 'bool';
      let currentValue: any = false;
      let minValue: number = 0;
      let maxValue: number = 1;

      // 根据节点构造函数名称或类型判断参数类型
      const nodeTypeName = nodeInstance.constructor.name;

      if (nodeTypeName.includes('Bool')) {
        paramType = 'bool';
        currentValue = false;
      } else if (nodeTypeName.includes('Float')) {
        paramType = 'float';
        currentValue = 0;
        minValue = -10;
        maxValue = 10;
      } else if (nodeTypeName.includes('Int')) {
        paramType = 'int';
        currentValue = 0;
        minValue = -100;
        maxValue = 100;
      } else if (nodeTypeName.includes('Trigger')) {
        paramType = 'trigger';
        currentValue = false;
      }

      this.parameters.push({
        id: parameterID,
        name: parameterID,
        type: paramType,
        nodeInstance: nodeInstance,
        currentValue,
        minValue,
        maxValue,
      });
    }
  }

  // 绘制参数面板，作为子面板嵌入到主窗口中
  drawPanel (availableWidth: number, availableHeight: number) {
    if (!this.graphInstance) {
      return;
    }

    // 使用 BeginChild 创建一个子面板区域
    const childFlags = ImGui.WindowFlags.None;

    if (ImGui.BeginChild('Parameters', new ImGui.ImVec2(availableWidth, availableHeight), true, childFlags)) {
      this.drawTabHeader();

      ImGui.Separator();

      // 绘制参数列表
      if (this.parameters.length === 0) {
        // 居中显示提示文本
        const windowWidth = ImGui.GetWindowWidth();
        const textWidth = ImGui.CalcTextSize('No parameters found').x;

        ImGui.SetCursorPosX((windowWidth - textWidth) * 0.5);
        ImGui.TextDisabled('No parameters found');
      } else {
        this.drawParametersList();
      }
    }
    ImGui.EndChild();
  }

  private drawTabHeader () {
    const tabFlags = ImGui.TabBarFlags.None;

    if (ImGui.BeginTabBar('ParameterTabs', tabFlags)) {
      if (ImGui.BeginTabItem('Parameters')) {
        ImGui.EndTabItem();
      }

      // 可以添加更多标签页，比如Layers

      ImGui.EndTabBar();
    }
  }

  private drawParametersList () {
    const tableFlags = ImGui.TableFlags.BordersInnerV |
                      ImGui.TableFlags.SizingFixedFit |
                      ImGui.TableFlags.PadOuterX |
                      ImGui.TableFlags.Borders;

    if (ImGui.BeginTable('ParametersTable', 2, tableFlags)) {
      // 设置列宽：名称列自动拉伸，控件列固定宽度
      ImGui.TableSetupColumn('Name', ImGui.TableColumnFlags.WidthStretch);
      ImGui.TableSetupColumn('Value', ImGui.TableColumnFlags.WidthFixed, 85.0);

      for (const param of this.parameters) {
        ImGui.TableNextRow();
        ImGui.PushID(param.id);

        // 第一列：参数名称和类型图标
        ImGui.TableSetColumnIndex(0);
        ImGui.AlignTextToFramePadding();
        this.drawParameterName(param);

        // 第二列：参数控件
        ImGui.TableSetColumnIndex(1);
        this.drawParameterControl(param);

        ImGui.PopID();
      }

      ImGui.EndTable();
    }
  }

  private drawParameterIcon (param: ParameterControl, pos: ImGui.ImVec2, size: number) {
    const drawList = ImGui.GetWindowDrawList();
    const color = this.getParameterTypeColor(param.type);
    const colorU32 = ImGui.GetColorU32(color);

    const center = new ImGui.ImVec2(pos.x + size * 0.5, pos.y + size * 0.5);
    const radius = size * 0.4;

    switch (param.type) {
      case 'bool': {
        // 绘制方形（复选框）
        const halfSize = radius * 0.7;

        drawList.AddRectFilled(
          new ImGui.ImVec2(center.x - halfSize, center.y - halfSize),
          new ImGui.ImVec2(center.x + halfSize, center.y + halfSize),
          colorU32,
          2.0
        );

        break;
      }
      case 'float':
        // 绘制圆形
        drawList.AddCircleFilled(center, radius, colorU32, 12);

        break;
      case 'int': {
        // 绘制六边形
        const points: ImGui.ImVec2[] = [];

        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;

          points.push(new ImGui.ImVec2(
            center.x + Math.cos(angle) * radius,
            center.y + Math.sin(angle) * radius
          ));
        }
        drawList.AddConvexPolyFilled(points, points.length, colorU32);

        break;
      }
      case 'trigger': {
        // 绘制三角形
        const trianglePoints = [
          new ImGui.ImVec2(center.x, center.y - radius),
          new ImGui.ImVec2(center.x - radius * 0.866, center.y + radius * 0.5),
          new ImGui.ImVec2(center.x + radius * 0.866, center.y + radius * 0.5),
        ];

        drawList.AddConvexPolyFilled(trianglePoints, trianglePoints.length, colorU32);

        break;
      }
    }
  }

  private drawParameterName (param: ParameterControl) {
    // 绘制参数图标
    const iconSize = 12;
    const cursor = ImGui.GetCursorScreenPos();

    this.drawParameterIcon(param, cursor, iconSize);

    // 调整文本位置，在图标后面
    ImGui.SetCursorPosX(ImGui.GetCursorPosX() + iconSize + 6);

    ImGui.Text(param.name);
  }

  private drawParameterControl (param: ParameterControl) {
    switch (param.type) {
      case 'bool':
        this.drawBoolParameter(param);

        break;
      case 'float':
        this.drawFloatParameter(param);

        break;
      case 'int':
        this.drawIntParameter(param);

        break;
      case 'trigger':
        this.drawTriggerParameter(param);

        break;
    }
  }

  private drawBoolParameter (param: ParameterControl) {
    let currentValue = param.currentValue as boolean;

    // 复选框左对齐，保持和其他控件一致
    if (ImGui.Checkbox('##bool', (value = currentValue) => currentValue = value)) {
      param.currentValue = currentValue;
      this.graphInstance?.setBool(param.name, currentValue);
    }
  }

  private drawFloatParameter (param: ParameterControl) {
    let currentValue = param.currentValue as number;
    const minVal = param.minValue || 0;
    const maxVal = param.maxValue || 1;

    // 统一控件宽度，稍微减小以适应更紧凑的布局
    ImGui.PushItemWidth(70);
    if (ImGui.DragFloat('##float', (value = currentValue) => currentValue = value, 0.01, minVal, maxVal, '%.2f')) {
      param.currentValue = currentValue;
      this.graphInstance?.setFloat(param.name, currentValue);
    }
    ImGui.PopItemWidth();
  }

  private drawIntParameter (param: ParameterControl) {
    let currentValue = param.currentValue as number;
    const minVal = param.minValue || 0;
    const maxVal = param.maxValue || 100;

    // 统一控件宽度
    ImGui.PushItemWidth(70);
    if (ImGui.DragInt('##int', (value = currentValue) => currentValue = value, 1, minVal, maxVal)) {
      param.currentValue = currentValue;
      this.graphInstance?.setFloat(param.name, currentValue);
    }
    ImGui.PopItemWidth();
  }

  private drawTriggerParameter (param: ParameterControl) {
    // 触发器按钮，统一尺寸
    const buttonSize = new ImGui.ImVec2(70, 20);

    if (ImGui.Button('Fire##trigger', buttonSize)) {
      this.graphInstance?.setTrigger(param.name);

      // 视觉反馈
      setTimeout(() => {
        // 触发后重置
      }, 100);
    }

    if (ImGui.IsItemHovered()) {
      ImGui.SetTooltip('Click to trigger');
    }
  }

  private getParameterTypeColor (type: string): ImGui.ImVec4 {
    // 保留图标的类型颜色区分
    switch (type) {
      case 'bool':
        return new ImGui.ImVec4(0.4, 0.8, 0.4, 1.0); // 绿色
      case 'float':
        return new ImGui.ImVec4(0.4, 0.6, 1.0, 1.0); // 蓝色
      case 'int':
        return new ImGui.ImVec4(1.0, 0.6, 0.4, 1.0); // 橙色
      case 'trigger':
        return new ImGui.ImVec4(1.0, 0.8, 0.4, 1.0); // 黄色
      default:
        return new ImGui.ImVec4(0.8, 0.8, 0.8, 1.0); // 默认灰色
    }
  }
}