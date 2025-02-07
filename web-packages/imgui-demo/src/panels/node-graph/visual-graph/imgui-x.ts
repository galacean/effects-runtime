import { generateGUID } from '@galacean/effects';
import { ImGui } from '../../../imgui/index';
import { subtract, add, multiplyScalar, lengthSqr, normalize } from '../bezier-math';
import { ImRect } from './im-rect';
import type { UUID } from './state-machine-graph';

export type ImVec2 = ImGui.ImVec2;
export const ImVec2 = ImGui.ImVec2;

type Color = ImGui.Color;
const Color = ImGui.Color;

// General helpers
export function ClampToRect (rect: ImRect, inPoint: ImGui.ImVec2): ImGui.ImVec2 {
  return new ImGui.ImVec2(
    Math.max(rect.Min.x, Math.min(inPoint.x, rect.Max.x)),
    Math.max(rect.Min.y, Math.min(inPoint.y, rect.Max.y))
  );
}

export function ImLineClosestPoint (a: ImVec2, b: ImVec2, p: ImVec2): ImVec2 {
  const ap = subtract(p, a);
  const ab_dir = subtract(b, a);
  const dot = ap.x * ab_dir.x + ap.y * ab_dir.y;

  if (dot < 0.0) {
    return new ImVec2(a.x, a.y);
  }
  const ab_len_sqr = ab_dir.x * ab_dir.x + ab_dir.y * ab_dir.y;

  if (dot > ab_len_sqr) {
    return new ImVec2(b.x, b.y);
  }

  return add(a, multiplyScalar(ab_dir, dot / ab_len_sqr));
}

// Closely mimics PathBezierToCasteljau() in imgui_draw.cpp
export function ImBezierCubicClosestPointCasteljauStep (
  p: ImVec2,
  p_closest: { value: ImVec2 },
  p_last: { value: ImVec2 },
  p_closest_dist2: { value: number },
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number,
  tess_tol: number,
  level: number
): void {
  const dx = x4 - x1;
  const dy = y4 - y1;
  let d2 = ((x2 - x4) * dy - (y2 - y4) * dx);
  let d3 = ((x3 - x4) * dy - (y3 - y4) * dx);

  d2 = (d2 >= 0) ? d2 : -d2;
  d3 = (d3 >= 0) ? d3 : -d3;
  if ((d2 + d3) * (d2 + d3) < tess_tol * (dx * dx + dy * dy)) {
    const p_current = new ImVec2(x4, y4);
    const p_line = ImLineClosestPoint(p_last.value, p_current, p);
    const dist2 = lengthSqr(subtract(p, p_line));

    if (dist2 < p_closest_dist2.value) {
      p_closest.value = p_line;
      p_closest_dist2.value = dist2;
    }
    p_last.value = p_current;
  } else if (level < 10) {
    const x12 = (x1 + x2) * 0.5, y12 = (y1 + y2) * 0.5;
    const x23 = (x2 + x3) * 0.5, y23 = (y2 + y3) * 0.5;
    const x34 = (x3 + x4) * 0.5, y34 = (y3 + y4) * 0.5;
    const x123 = (x12 + x23) * 0.5, y123 = (y12 + y23) * 0.5;
    const x234 = (x23 + x34) * 0.5, y234 = (y23 + y34) * 0.5;
    const x1234 = (x123 + x234) * 0.5, y1234 = (y123 + y234) * 0.5;

    ImBezierCubicClosestPointCasteljauStep(p, p_closest, p_last, p_closest_dist2, x1, y1, x12, y12, x123, y123, x1234, y1234, tess_tol, level + 1);
    ImBezierCubicClosestPointCasteljauStep(p, p_closest, p_last, p_closest_dist2, x1234, y1234, x234, y234, x34, y34, x4, y4, tess_tol, level + 1);
  }
}

// tess_tol is generally the same value you would find in ImGui::GetStyle().CurveTessellationTol
// Because those ImXXX functions are lower-level than ImGui:: we cannot access this value automatically.
export function ImBezierCubicClosestPointCasteljau (p1: ImVec2, p2: ImVec2, p3: ImVec2, p4: ImVec2, p: ImVec2, tess_tol: number): ImVec2 {
  const p_last = { value: new ImVec2().Copy(p1) };
  const p_closest = { value: new ImVec2() };
  const p_closest_dist2 = { value: Number.MAX_VALUE };

  ImBezierCubicClosestPointCasteljauStep(p, p_closest, p_last, p_closest_dist2, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y, tess_tol, 0);

  return p_closest.value;
}

export function GetClosestPointOnRectBorder (rect: ImRect, inPoint: ImGui.ImVec2): ImGui.ImVec2 {
  const points: ImGui.ImVec2[] = [
    ImLineClosestPoint(rect.GetTL(), rect.GetTR(), inPoint),
    ImLineClosestPoint(rect.GetBL(), rect.GetBR(), inPoint),
    ImLineClosestPoint(rect.GetTL(), rect.GetBL(), inPoint),
    ImLineClosestPoint(rect.GetTR(), rect.GetBR(), inPoint),
  ];

  const distancesSq: number[] = points.map(p => lengthSqr(subtract(p, inPoint)));

  let lowestDistance = Number.MAX_VALUE;
  let closestPointIdx = -1;

  for (let i = 0; i < 4; i++) {
    if (distancesSq[i] < lowestDistance) {
      closestPointIdx = i;
      lowestDistance = distancesSq[i];
    }
  }

  return points[closestPointIdx];
}

export function IsValidNameIDChar (c: string): boolean {
  return /[a-zA-Z0-9_]/.test(c);
}

export function FilterNameIDChars (data: ImGui.ImGuiInputTextCallbackData<any>): number {
  return IsValidNameIDChar(String.fromCharCode(data.EventChar)) ? 0 : 1;
}

// export function BeginViewportPopupModal (popupName: string, isPopupOpen: { value: boolean }, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), windowSizeCond: ImGui.ImGuiCond = ImGui.ImGuiCond.Always, windowFlags: ImGui.ImGuiWindowFlags = ImGui.ImGuiWindowFlags.NoSavedSettings | ImGui.ImGuiWindowFlags.AlwaysAutoResize): boolean {
//   ImGui.OpenPopup(popupName);
//   if (size.x !== 0 || size.y !== 0) {
//     ImGui.SetNextWindowSize(size, windowSizeCond);
//   }
//   ImGui.SetNextWindowViewport(ImGui.GetMainViewport()!.ID);

//   return ImGui.BeginPopupModal(popupName, isPopupOpen, windowFlags);
// }

export function CancelDialogViaEsc (isDialogOpen: boolean): boolean {
  if (ImGui.IsKeyPressed(ImGui.ImGuiKey.Escape)) {
    ImGui.CloseCurrentPopup();

    return false;
  }

  return isDialogOpen;
}

// Layout and Separators
export function SameLineSeparator (width: number = 0, color?: Color): void {
  const separatorColor = color ? color : new Color(ImGui.GetStyleColorVec4(ImGui.ImGuiCol.Separator));
  const separatorSize = new ImGui.ImVec2(width <= 0 ? (ImGui.GetStyle().ItemSpacing.x * 2) + 1 : width, ImGui.GetFrameHeight());

  ImGui.SameLine(0, 0);

  const canvasPos = ImGui.GetCursorScreenPos();
  const startPosX = canvasPos.x + Math.floor(separatorSize.x / 2);
  const startPosY = canvasPos.y + 1;
  const endPosY = startPosY + separatorSize.y - 2;

  const drawList = ImGui.GetWindowDrawList();

  drawList.AddLine(new ImGui.ImVec2(startPosX, startPosY), new ImGui.ImVec2(startPosX, endPosY), separatorColor.toImU32(), 1);

  ImGui.Dummy(separatorSize);
  ImGui.SameLine(0, 0);
}

export function BeginCollapsibleChildWindow (labelAndID: string, initiallyOpen: boolean = true, backgroundColor: Color = new Color(28 / 255, 28 / 255, 28 / 255, 1)): boolean {
  ImGui.PushStyleColor(ImGui.ImGuiCol.ChildBg, backgroundColor.toImVec4());
  ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ChildRounding, 8);
  //   const drawChildWindow = ImGui.BeginChild(labelAndID, new ImGui.ImVec2(0, 0), ImGui.ImGuiChildFlags.AutoResizeY | ImGui.ImGuiChildFlags.AlwaysAutoResize | ImGui.ImGuiChildFlags.AlwaysUseWindowPadding, 0);
  const drawChildWindow = ImGui.BeginChild(labelAndID, new ImGui.ImVec2(0, 0), true, ImGui.ImGuiWindowFlags.AlwaysAutoResize | ImGui.ImGuiWindowFlags.AlwaysUseWindowPadding);

  ImGui.PopStyleVar();
  ImGui.PopStyleColor();

  if (drawChildWindow) {
    ImGui.PushStyleColor(ImGui.ImGuiCol.Header, backgroundColor.toImVec4());
    ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderActive, backgroundColor.toImVec4());
    ImGui.PushStyleColor(ImGui.ImGuiCol.HeaderHovered, backgroundColor.toImVec4());
    ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, new ImGui.ImVec2(2, 4));
    ImGui.SetNextItemOpen(initiallyOpen, ImGui.ImGuiCond.FirstUseEver);
    // ImGuiX.PushFont(Font.MediumBold);
    const drawContents = ImGui.CollapsingHeader(labelAndID);

    // ImGuiX.PopFont();
    ImGui.PopStyleVar();
    ImGui.PopStyleColor(3);

    return drawContents;
  }

  return false;
}

export function EndCollapsibleChildWindow (): void {
  ImGui.EndChild();
}

// export function ItemTooltip (fmt: string, ...args: any[]): void {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.WindowPadding, new ImGui.ImVec2(4, 4));
//   if (ImGui.IsItemHovered() && ImGui.GetHoveredIdTimer() > Style.s_toolTipDelay) {
//     ImGui.SetTooltip(fmt, ...args);
//   }
//   ImGui.PopStyleVar();
// }

// export function TextTooltip (fmt: string, ...args: any[]): void {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.WindowPadding, new ImGui.ImVec2(4, 4));
//   if (ImGui.IsItemHovered()) {
//     ImGui.SetTooltip(fmt, ...args);
//   }
//   ImGui.PopStyleVar();
// }

// export function Checkbox (label: string, value: { value: boolean }): boolean {
//   const newFramePadding = new ImGui.ImVec2(2, 2);

//   const originalCursorPosY = ImGui.GetCursorPosY();
//   const offsetY = ImGui.GetStyle().FramePadding.y - newFramePadding.y;

//   ImGui.SetCursorPosY(originalCursorPosY + offsetY);

//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, newFramePadding);
//   const result = ImGui.Checkbox(label, value);

//   ImGui.PopStyleVar();

//   ImGui.SameLine();
//   ImGui.SetCursorPosY(originalCursorPosY);
//   ImGui.NewLine();

//   return result;
// }

// export function ButtonEx (icon: string | null, label: string, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), backgroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), shouldCenterContents: boolean = false): boolean {
//   let wasPressed = false;

//   const hoveredColor = backgroundColor.getScaledColor(1.15);
//   const activeColor = backgroundColor.getScaledColor(1.25);

//   if (!icon || icon.length === 0) {
//     ImGui.PushStyleColor(ImGui.ImGuiCol.Button, backgroundColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, hoveredColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, activeColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.Text, foregroundColor.toImVec4());
//     ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ButtonTextAlign, shouldCenterContents ? new ImGui.ImVec2(0.5, 0.5) : new ImGui.ImVec2(0.0, 0.5));
//     wasPressed = ImGui.Button(label, size);
//     ImGui.PopStyleColor(4);
//     ImGui.PopStyleVar();
//   } else {
//     // Icon button implementation
//     const window = ImGui.GetCurrentWindow();

//     if (window.SkipItems) {
//       return false;
//     }

//     const id = label.length === 0 ? icon : label;
//     const ID = window.GetID(id);

//     const style = ImGui.GetStyle();
//     const iconSize = ImGui.CalcTextSize(icon);
//     const labelSize = ImGui.CalcTextSize(label);
//     const spacing = (iconSize.x > 0 && labelSize.x > 0) ? style.ItemSpacing.x : 0.0;
//     const buttonWidth = labelSize.x + iconSize.x + spacing;
//     const buttonWidthWithFramePadding = buttonWidth + (style.FramePadding.x * 2.0);
//     const textHeightMax = Math.max(iconSize.y, labelSize.y);
//     const buttonHeight = Math.max(ImGui.GetFrameHeight(), textHeightMax);

//     const pos = window.DC.CursorPos;
//     const finalButtonSize = ImGui.CalcItemSize(size, buttonWidthWithFramePadding, buttonHeight);

//     const bb = new ImGui.ImRect(pos, ImGui.ImVec2.Add(pos, finalButtonSize));

//     ImGui.ItemSize(finalButtonSize, 0);
//     if (!ImGui.ItemAdd(bb, ID)) {
//       return false;
//     }

//     let hovered: boolean, held: boolean;

//     wasPressed = ImGui.ButtonBehavior(bb, ID, hovered, held, 0);

//     ImGui.PushStyleColor(ImGui.ImGuiCol.Button, backgroundColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, hoveredColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, activeColor.toImVec4());
//     ImGui.PushStyleColor(ImGui.ImGuiCol.Text, foregroundColor.toImVec4());

//     const color = ImGui.GetColorU32((held && hovered) ? ImGui.ImGuiCol.ButtonActive : hovered ? ImGui.ImGuiCol.ButtonHovered : ImGui.ImGuiCol.Button);

//     ImGui.RenderNavCursor(bb, ID);
//     ImGui.RenderFrame(bb.Min, bb.Max, color, true, style.FrameRounding);

//     const isDisabled = ImGui.GetCurrentContext().CurrentItemFlags & ImGui.ImGuiItemFlags.Disabled;
//     const finalIconColor = isDisabled ? Style.s_colorTextDisabled : iconColor;

//     if (shouldCenterContents) {
//       if (labelSize.x > 0) {
//         const textOffset = new ImGui.ImVec2((bb.GetWidth() / 2) - (buttonWidthWithFramePadding / 2) + iconSize.x + spacing + style.FramePadding.x, 0);

//         ImGui.RenderTextClipped(ImGui.ImVec2.Add(bb.Min, textOffset), bb.Max, label, null, labelSize, new ImGui.ImVec2(0, 0.5), bb);

//         const offsetX = textOffset.x - iconSize.x - spacing;
//         const offsetY = ((bb.GetHeight() - textHeightMax) / 2.0);
//         const iconOffset = new ImGui.ImVec2(offsetX, offsetY);

//         window.DrawList.AddText(ImGui.ImVec2.Add(pos, iconOffset), finalIconColor.toImU32(), icon);
//       } else {
//         const offsetX = (bb.GetWidth() - iconSize.x) / 2.0;
//         const offsetY = ((bb.GetHeight() - iconSize.y) / 2.0);
//         const iconOffset = new ImGui.ImVec2(offsetX, offsetY);

//         window.DrawList.AddText(ImGui.ImVec2.Add(pos, iconOffset), finalIconColor.toImU32(), icon);
//       }
//     } else {
//       const textOffset = new ImGui.ImVec2(iconSize.x + spacing + style.FramePadding.x, 0);

//       ImGui.RenderTextClipped(ImGui.ImVec2.Add(bb.Min, textOffset), bb.Max, label, null, labelSize, new ImGui.ImVec2(0, 0.5), bb);

//       const iconHeightOffset = ((bb.GetHeight() - iconSize.y) / 2.0);

//       window.DrawList.AddText(ImGui.ImVec2.Add(pos, new ImGui.ImVec2(style.FramePadding.x, iconHeightOffset)), finalIconColor.toImU32(), icon);
//     }

//     ImGui.PopStyleColor(4);
//   }

//   return wasPressed;
// }

// export function ButtonColored (label: string, backgroundColor: Color, foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0)): boolean {
//   return ButtonEx(null, label, size, backgroundColor, Color.Transparent, foregroundColor);
// }

// export function IconButton (icon: string, label: string, iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), shouldCenterContents: boolean = false): boolean {
//   return ButtonEx(icon, label, size, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), shouldCenterContents);
// }

// export function IconButtonColored (icon: string, label: string, backgroundColor: Color, iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), shouldCenterContents: boolean = false): boolean {
//   return ButtonEx(icon, label, size, backgroundColor, iconColor, foregroundColor, shouldCenterContents);
// }

// export function FlatButton (label: string, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text])): boolean {
//   return ButtonEx(null, label, size, Color.Transparent, Color.Transparent, foregroundColor);
// }

// export function FlatIconButton (icon: string, label: string, iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), shouldCenterContents: boolean = false): boolean {
//   return ButtonEx(icon, label, size, Color.Transparent, iconColor, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), shouldCenterContents);
// }

// Drop Down Button
// export function DropDownButtonEx (icon: string | null, label: string, contextMenuCallback: () => void, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), backgroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), shouldCenterContents: boolean = false): void {
//   const isPressed = ButtonEx(icon, label, size, backgroundColor, iconColor, foregroundColor, shouldCenterContents);
//   const buttonRect = new ImGui.ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());
//   const windowStartPos = ImGui.ImVec2.Subtract(buttonRect.GetBL(), new ImGui.ImVec2(0, ImGui.GetStyle().FrameRounding));

//   const dropDownMenuID = `${label}##dropdownMenu`;
//   const isDropDownOpen = ImGui.IsPopupOpen(dropDownMenuID, ImGui.ImGuiPopupFlags.None);

//   if (isPressed && !isDropDownOpen) {
//     ImGui.OpenPopup(dropDownMenuID);
//   }

//   ImGui.SetNextWindowPos(windowStartPos);
//   ImGui.SetNextWindowSizeConstraints(new ImGui.ImVec2(buttonRect.GetWidth(), 0), new ImGui.ImVec2(Number.MAX_VALUE, Number.MAX_VALUE));

//   if (ImGui.BeginPopup(dropDownMenuID, ImGui.ImGuiPopupFlags.MouseButtonLeft)) {
//     contextMenuCallback();
//     ImGui.EndPopup();
//   }
// }

// export function DropDownButton (label: string, contextMenuCallback: () => void, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0)): void {
//   return DropDownButtonEx(null, label, contextMenuCallback, size);
// }

// export function DropDownIconButton (icon: string, label: string, contextMenuCallback: () => void, iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0)): void {
//   return DropDownButtonEx(icon, label, contextMenuCallback, size, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]));
// }

// export function DropDownIconButtonColored (icon: string, label: string, contextMenuCallback: () => void, backgroundColor: Color, iconColor: Color, foregroundColor: Color, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), shouldCenterContents: boolean = false): void {
//   return DropDownButtonEx(icon, label, contextMenuCallback, size, backgroundColor, iconColor, foregroundColor, shouldCenterContents);
// }

// // Combo Button
// export function ComboButtonEx (icon: string | null, label: string, comboCallback: () => void, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), backgroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), foregroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), shouldCenterContents: boolean = false): boolean {
//   const style = ImGui.GetStyle();

//   const dropDownMenuID = `${label}##DropdownMenu`;

//   // Calculate button size
//   const dropDownButtonWidth = ImGui.GetFrameHeight() + style.ItemSpacing.x;
//   let buttonWidth = size.x;

//   if (buttonWidth > 0) {
//     if (buttonWidth > dropDownButtonWidth) {
//       buttonWidth -= dropDownButtonWidth;
//     } else {
//       buttonWidth = 1;
//     }
//   } else if (buttonWidth === 0) {
//     const iconSize = ImGui.CalcTextSize(icon || '');
//     const labelSize = ImGui.CalcTextSize(label);
//     const spacing = (iconSize.x > 0 && labelSize.x > 0) ? style.ItemSpacing.x : 0;

//     buttonWidth = iconSize.x + labelSize.x + spacing + (style.FramePadding.x * 2);
//   } else if (buttonWidth < 0) {
//     buttonWidth = ImGui.GetContentRegionAvail().x - dropDownButtonWidth;
//   }

//   // Button
//   const actualMainButtonSize = new ImGui.ImVec2(buttonWidth, size.y);
//   const buttonResult = ButtonEx(icon, label, actualMainButtonSize, backgroundColor, iconColor, foregroundColor, shouldCenterContents);
//   const mainButtonRect = new ImGui.ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());
//   const windowStartPos = ImGui.ImVec2.Subtract(mainButtonRect.GetBL(), new ImGui.ImVec2(0, style.FrameRounding));

//   const hoveredColor = backgroundColor.getScaledColor(1.15);
//   const activeColor = backgroundColor.getScaledColor(1.25);

//   let buttonColor = backgroundColor;

//   if (ImGui.IsItemHovered()) {
//     buttonColor = ImGui.IsItemActive() ? activeColor : hoveredColor;
//   }

//   // Gap
//   ImGui.SameLine(0, 0);

//   // Combo
//   ImGui.PushID(dropDownMenuID);

//   ImGui.PushStyleColor(ImGui.ImGuiCol.Button, backgroundColor.toImVec4());
//   ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonHovered, hoveredColor.toImVec4());
//   ImGui.PushStyleColor(ImGui.ImGuiCol.ButtonActive, activeColor.toImVec4());
//   ImGui.PushStyleColor(ImGui.ImGuiCol.Text, foregroundColor.toImVec4());
//   const isPressed = ImGui.Button('##dropdownButton', new ImGui.ImVec2(dropDownButtonWidth, mainButtonRect.GetHeight()));
//   const dropDownButtonRect = new ImGui.ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());

//   ImGui.PopStyleColor(4);

//   const dropdownID = '##dropdownMenu';
//   const isDropDownOpen = ImGui.IsPopupOpen(dropdownID, ImGui.ImGuiPopupFlags.None);

//   if (isPressed && !isDropDownOpen) {
//     ImGui.OpenPopup(dropdownID);
//   }

//   ImGui.SetNextWindowPos(windowStartPos);
//   ImGui.SetNextWindowSizeConstraints(new ImGui.ImVec2(buttonWidth + dropDownButtonWidth, 0), new ImGui.ImVec2(Number.MAX_VALUE, Number.MAX_VALUE));
//   if (ImGui.BeginPopup(dropdownID)) {
//     comboCallback();
//     ImGui.EndPopup();
//   }
//   ImGui.PopID();

//   // Fill gap between button and drop down button
//   const drawList = ImGui.GetWindowDrawList();
//   const fillerMin = ImGui.ImVec2.Add(mainButtonRect.GetTR(), new ImGui.ImVec2(-style.FrameRounding, 0));
//   const fillerMax = ImGui.ImVec2.Add(dropDownButtonRect.GetBL(), new ImGui.ImVec2(style.FrameRounding, 0));

//   drawList.AddRectFilled(fillerMin, fillerMax, buttonColor.toImU32());

//   // Draw arrow
//   const arrowHeight = drawList._Data.FontSize;
//   const arrowVerticalPos = dropDownButtonRect.GetCenter().y - (arrowHeight / 2);

//   drawList.PushClipRect(dropDownButtonRect.Min, dropDownButtonRect.Max);
//   ImGui.RenderArrow(drawList, new ImGui.ImVec2(dropDownButtonRect.Min.x + style.FramePadding.x + style.ItemSpacing.x, arrowVerticalPos), foregroundColor.toImU32(), ImGui.ImGuiDir.Down, 1.0);
//   drawList.PopClipRect();

//   return buttonResult;
// }

// export function ComboButton (label: string, comboCallback: () => void, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0)): boolean {
//   return ComboButtonEx(null, label, comboCallback, size);
// }

// export function ComboIconButton (icon: string, label: string, comboCallback: () => void, iconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0)): boolean {
//   return ComboButtonEx(icon, label, comboCallback, size, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), iconColor);
// }

// export function ComboIconButtonColored (icon: string, label: string, comboCallback: () => void, backgroundColor: Color, iconColor: Color, foregroundColor: Color, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), shouldCenterContents: boolean = false): boolean {
//   return ComboButtonEx(icon, label, comboCallback, size, backgroundColor, iconColor, foregroundColor, shouldCenterContents);
// }

// Custom InputText
export function InputTextEx (inputTextID: string, buf: ImGui.ImStringBuffer | ImGui.Bind.ImAccess<string> | ImGui.Bind.ImScalar<string>, bufferSize: number, hasClearButton: boolean, helpText: string | null, comboCallback: (() => void) | null, flags: ImGui.ImGuiInputTextFlags = 0, callback: ((data: ImGui.ImGuiInputTextCallbackData<any>) => number) | null = null, userData: any = null): boolean {
  ImGui.PushID(inputTextID);

  const style = ImGui.GetStyle();
  const drawList = ImGui.GetWindowDrawList();

  // Calculate size
  const hasCombo = comboCallback !== null;
  const clearButtonWidth = 20;
  const comboButtonWidth = ImGui.GetFrameHeight() + style.ItemSpacing.x;

  let requiredExtraWidth = 0;

  if (hasClearButton) {requiredExtraWidth += clearButtonWidth;}
  if (hasCombo) {requiredExtraWidth += comboButtonWidth;}

  //   const totalWidgetWidth = ImGui.GetNextItemWidth();
  const totalWidgetWidth = 0;

  let inputWidth = 0;

  if (totalWidgetWidth > 0) {
    inputWidth = Math.max(totalWidgetWidth - requiredExtraWidth, 1);
  } else if (totalWidgetWidth === 0) {
    inputWidth = Math.max(ImGui.GetContentRegionAvail().x - requiredExtraWidth, 1);
    inputWidth = Math.min(inputWidth, 100); // arbitrary choice
  } else if (totalWidgetWidth < 0) {
    inputWidth = Math.max(ImGui.GetContentRegionAvail().x - requiredExtraWidth, 1);
  }

  // Draw Background
  if (hasClearButton) {
    drawList.AddRectFilled(
      ImGui.GetCursorScreenPos(),
      add(ImGui.GetCursorScreenPos(), new ImGui.ImVec2(inputWidth + clearButtonWidth, ImGui.GetFrameHeight())),
      ImGui.GetColorU32(ImGui.ImGuiCol.FrameBg),
      style.FrameRounding
    );
  }

  // Draw Input
  const inputFinalID = `##${inputTextID}`;

  ImGui.SetNextItemWidth(inputWidth);
  let inputResult = ImGui.InputText(inputFinalID, buf, bufferSize, flags, callback, userData);

  inputResult = inputResult || ImGui.IsItemDeactivatedAfterEdit();
  const inputRect = new ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());
  const windowStartPos = subtract(inputRect.GetBL(), new ImGui.ImVec2(0, style.FrameRounding));
  const fillerRectMin = inputRect.GetTR();

  // Clear Button
  //   if (hasClearButton) {
  //     ImGui.SameLine(0, 0);

  //     const isInputFocused = ImGui.IsItemFocused() && ImGui.IsItemActive();
  //     const isBufferEmpty = buffer.length === 0;

  //     if (!isBufferEmpty) {
  //       ImGui.PushStyleVar(ImGui.ImGuiStyleVar.FramePadding, new ImGui.ImVec2(0, style.FramePadding.y));
  //       if (FlatButton(`${ImGui.ImGuiX.Icons.Close}##Clear`, new ImGui.ImVec2(clearButtonWidth, ImGui.GetFrameHeight()), ImGuiX.Style.s_colorText)) {
  //         buffer = '';
  //         inputResult = true;
  //       }
  //       fillerRectMin.x += ImGui.GetItemRectSize().x;
  //       ImGui.PopStyleVar();
  //     } else {
  //       ImGui.Dummy(new ImGui.ImVec2(clearButtonWidth, 0));
  //     }

  //     // Draw filter text
  //     if (helpText && isBufferEmpty && !isInputFocused) {
  //       const textPos = add(inputRect.GetTL(), new ImGui.ImVec2(style.ItemSpacing.x, style.FramePadding.y));

  //       drawList.AddText(textPos, ImGui.GetColorU32(ImGui.ImGuiCol.TextDisabled), helpText);
  //     }
  //   }

  // Combo
  //   if (hasCombo) {
  //     // Gap
  //     ImGui.SameLine(0, 0);

  //     // Combo Button
  //     const comboMenuID = `${inputTextID}##ComboMenu`;

  //     ImGui.PushID(comboMenuID);

  //     const isPressed = ImGui.Button('##comboButton', new ImGui.ImVec2(comboButtonWidth, 0));
  //     const comboButtonRect = new ImGui.ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());

  //     const comboID = '##comboMenu';
  //     const isComboOpen = ImGui.IsPopupOpen(comboID, ImGui.ImGuiPopupFlags.None);

  //     if (isPressed && !isComboOpen) {
  //       ImGui.OpenPopup(comboID);
  //     }

  //     ImGui.SetNextWindowPos(windowStartPos);
  //     ImGui.SetNextWindowSizeConstraints(new ImGui.ImVec2(inputWidth + requiredExtraWidth, 0), new ImGui.ImVec2(Number.MAX_VALUE, Number.MAX_VALUE));
  //     if (ImGui.BeginPopup(comboID)) {
  //       comboCallback();
  //       ImGui.EndPopup();
  //     }
  //     ImGui.PopID();

  //     // Fill gap between button and drop down button
  //     const fillerMin = ImGui.ImVec2.Add(fillerRectMin, new ImGui.ImVec2(-style.FrameRounding, 0));
  //     const fillerMax = ImGui.ImVec2.Add(comboButtonRect.GetBL(), new ImGui.ImVec2(style.FrameRounding, 0));

  //     drawList.AddRectFilled(fillerMin, fillerMax, ImGui.GetColorU32(ImGui.ImGuiCol.FrameBg));

  //     // Draw arrow
  //     ImGui.RenderArrow(drawList, new ImGui.ImVec2(comboButtonRect.Min.x + style.FramePadding.x + style.ItemSpacing.x, comboButtonRect.Min.y + style.FramePadding.y), ImGui.GetColorU32(ImGui.ImGuiCol.Text), ImGui.ImGuiDir.Down, 1.0);
  //   }

  ImGui.PopID();

  return inputResult;
}

// export function InputTextCombo (inputTextID: string, buffer: string, bufferSize: number, comboCallback: () => void, flags: ImGui.ImGuiInputTextFlags = 0, callback: ((data: ImGui.ImGuiInputTextCallbackData) => number) | null = null, userData: any = null): boolean {
//   return InputTextEx(inputTextID, buffer, bufferSize, false, null, comboCallback, flags, callback, userData);
// }

export function InputTextWithClearButton (inputTextID: string, helpText: string, buf: ImGui.ImStringBuffer | ImGui.Bind.ImAccess<string> | ImGui.Bind.ImScalar<string>, bufferSize: number, flags: ImGui.ImGuiInputTextFlags = 0, callback: ((data: ImGui.ImGuiInputTextCallbackData<any>) => number) | null = null, userData: any = null): boolean {
  return InputTextEx(inputTextID, buf, bufferSize, true, helpText, null, flags, callback, userData);
}

// export function InputTextComboWithClearButton (inputTextID: string, helpText: string, buffer: string, bufferSize: number, comboCallback: () => void, flags: ImGui.ImGuiInputTextFlags = 0, callback: ((data: ImGui.ImGuiInputTextCallbackData) => number) | null = null, userData: any = null): boolean {
//   return InputTextEx(inputTextID, buffer, bufferSize, true, helpText, comboCallback, flags, callback, userData);
// }

// // Toggle Buttons
// export function ToggleButtonEx (onIcon: string | null, onLabel: string, offIcon: string | null, offLabel: string, value: { value: boolean }, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), onForegroundColor: Color = Style.s_colorAccent0, onIconColor: Color = Style.s_colorAccent0, offForegroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), offIconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text])): boolean {
//   let valueUpdated = false;

//   if (value.value) {
//     valueUpdated = ButtonEx(onIcon, onLabel, size, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), onIconColor, onForegroundColor);
//   } else {
//     valueUpdated = ButtonEx(offIcon, offLabel, size, new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Button]), offIconColor, offForegroundColor);
//   }

//   if (valueUpdated) {
//     value.value = !value.value;
//   }

//   return valueUpdated;
// }

// export function ToggleButton (onLabel: string, offLabel: string, value: { value: boolean }, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), onColor: Color = Style.s_colorAccent0, offColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text])): boolean {
//   return ToggleButtonEx(null, onLabel, null, offLabel, value, size, onColor, Color.Transparent, offColor);
// }

// export function FlatToggleButton (onIcon: string, onLabel: string, offIcon: string, offLabel: string, value: { value: boolean }, size: ImGui.ImVec2 = new ImGui.ImVec2(0, 0), onForegroundColor: Color = Style.s_colorAccent0, onIconColor: Color = Style.s_colorAccent0, offForegroundColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), offIconColor: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text])): boolean {
//   ImGui.PushStyleColor(ImGui.ImGuiCol.Button, new ImGui.ImVec4(0, 0, 0, 0));
//   const result = ToggleButtonEx(onIcon, onLabel, offIcon, offLabel, value, size, onForegroundColor, onIconColor, offForegroundColor, offIconColor);

//   ImGui.PopStyleColor(1);

//   return result;
// }

// Drawing functions
export function DrawArrow (drawList: ImGui.ImDrawList, arrowStart: ImGui.ImVec2, arrowEnd: ImGui.ImVec2, color: Color, arrowWidth: number, arrowHeadWidth: number = 5.0): void {
  const direction = normalize(subtract(arrowEnd, arrowStart));
  const orthogonalDirection = new ImGui.ImVec2(-direction.y, direction.x);

  const triangleSideOffset = multiplyScalar(orthogonalDirection, arrowHeadWidth);
  const triBase = subtract(arrowEnd, multiplyScalar(direction, arrowHeadWidth));
  const tri1 = subtract(triBase, triangleSideOffset);
  const tri2 = add(triBase, triangleSideOffset);

  drawList.AddLine(arrowStart, triBase, color.toImU32(), arrowWidth);
  drawList.AddTriangleFilled(arrowEnd, tri1, tri2, color.toImU32());
}

// export function DrawSpinner (buttonLabel: string, color: Color = new Color(ImGui.GetStyle().Colors[ImGui.ImGuiCol.Text]), size: number = 0, thickness: number = 3.0, padding: number = ImGui.GetStyle().FramePadding.y): boolean {
//   const numSegments = 30.0;

//   const window = ImGui.GetCurrentWindow();

//   if (window.SkipItems) {
//     return false;
//   }

//   const style = ImGui.GetStyle();

//   // Calculate final size
//   let finalSize = size;

//   // Try to fill the remaining space if possible
//   if (finalSize < 0) {
//     finalSize = Math.min(ImGui.GetContentRegionAvail().x, ImGui.GetContentRegionAvail().y);
//   }

//   // Ensure that the minimum size is always the frame height
//   if (finalSize <= 0) {
//     finalSize = ImGui.GetFrameHeight();
//   }

//   // Calculate pos, radius and bounding box
//   const startPos = ImGui.GetCursorScreenPos();
//   const radius = ((finalSize - thickness) / 2) - padding;

//   const buttonResult = ImGui.InvisibleButton(buttonLabel, new ImGui.ImVec2(finalSize, finalSize));
//   const spinnerRect = new ImGui.ImRect(ImGui.GetItemRectMin(), ImGui.GetItemRectMax());

//   const time = ImGui.GetTime();
//   const start = Math.abs(Math.sin(time * 1.8) * (numSegments - 5));
//   const min = Math.PI * 2.0 * (start) / numSegments;
//   const max = Math.PI * 2.0 * (numSegments - 3) / numSegments;

//   const center = spinnerRect.GetCenter();

//   for (let i = 0; i < numSegments; i++) {
//     const a = min + (i / numSegments) * (max - min);
//     const b = a + (time * 8);

//     window.DrawList.PathLineTo(new ImGui.ImVec2(center.x + Math.cos(b) * radius, center.y + Math.sin(b) * radius));
//   }

//   window.DrawList.PathStroke(color.toImU32(), false, thickness);

//   return buttonResult;
// }

// // Math Widgets
// const g_labelWidth = 24.0;
// const g_transformLabelColWidth = 24;

// function DrawFloatEditorWithLabel (id: string, label: string, width: number, color: Color, value: { value: number }, isReadOnly: boolean = false): boolean {
//   let result = false;

//   // Label
//   const cursorPosBefore = ImGui.GetCursorScreenPos();

//   ImGui.Dummy(new ImGui.ImVec2(g_labelWidth, 0));
//   ImGui.SameLine();
//   const cursorPosAfter = ImGui.GetCursorScreenPos();

//   if (label[0] !== '#') {
//     ImGuiX.ScopedFont(Font.MediumBold, color);
//     ImGui.AlignTextToFramePadding();
//     const offset = new ImGui.ImVec2(Math.floor((g_labelWidth - ImGui.CalcTextSize(label).x) / 2), 0.0);

//     ImGui.SetCursorScreenPos(ImGui.ImVec2.Add(cursorPosBefore, offset));
//     ImGui.Text(label);
//     ImGui.SetCursorScreenPos(cursorPosAfter);
//   }

//   // Editor
//   {
//     ImGuiX.ScopedFont(Font.Small);
//     ImGui.SetNextItemWidth(width - g_labelWidth);
//     ImGui.InputFloat(id, value, 0, 0, '%.3f', isReadOnly ? ImGui.ImGuiInputTextFlags.ReadOnly : 0);
//     result = ImGui.IsItemDeactivatedAfterEdit();
//   }

//   return result;
// }

// function DrawFloatElementReadOnly (label: string, width: number, color: Color, value: number): void {
//   const id = `##${label}`;

//   DrawFloatEditorWithLabel(id, label, width, color, { value }, true);
// }

// function InputFloat2Impl (value: Float2, width: number): boolean {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const inputWidth = Math.round(contentWidth / 2);

//   let valueUpdated = false;

//   if (DrawFloatEditorWithLabel('##x', 'X', inputWidth, Colors.MediumRed, { value: value.x })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();

//   if (DrawFloatEditorWithLabel('##y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y })) {
//     valueUpdated = true;
//   }

//   ImGui.PopStyleVar();

//   return valueUpdated;
// }

// function InputFloat3Impl (value: Float3, width: number): boolean {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const inputWidth = Math.round(contentWidth / 3);

//   let valueUpdated = false;

//   if (DrawFloatEditorWithLabel('##x', 'X', inputWidth, Colors.MediumRed, { value: value.x })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();
//   if (DrawFloatEditorWithLabel('##y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();
//   if (DrawFloatEditorWithLabel('##z', 'Z', inputWidth, Colors.RoyalBlue, { value: value.z })) {
//     valueUpdated = true;
//   }

//   ImGui.PopStyleVar();

//   return valueUpdated;
// }

// function InputFloat4Impl (value: Float4, width: number): boolean {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const inputWidth = Math.round(contentWidth / 4);

//   let valueUpdated = false;

//   if (DrawFloatEditorWithLabel('##x', 'X', inputWidth, Colors.MediumRed, { value: value.x })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();
//   if (DrawFloatEditorWithLabel('##y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();
//   if (DrawFloatEditorWithLabel('##z', 'Z', inputWidth, Colors.RoyalBlue, { value: value.z })) {
//     valueUpdated = true;
//   }

//   ImGui.SameLine();
//   if (DrawFloatEditorWithLabel('##w', 'W', inputWidth, Colors.DarkOrange, { value: value.w })) {
//     valueUpdated = true;
//   }

//   ImGui.PopStyleVar();

//   return valueUpdated;
// }

// export function InputFloat2 (id: string | object, value: Float2, width: number = -1): boolean {
//   ImGui.PushID(id);
//   const valueUpdated = InputFloat2Impl(value, width);

//   ImGui.PopID();

//   return valueUpdated;
// }

// export function InputFloat3 (id: string | object, value: Float3, width: number = -1): boolean {
//   ImGui.PushID(id);
//   const valueUpdated = InputFloat3Impl(value, width);

//   ImGui.PopID();

//   return valueUpdated;
// }

// export function InputFloat4 (id: string | object, value: Float4, width: number = -1): boolean {
//   ImGui.PushID(id);
//   const valueUpdated = InputFloat4Impl(value, width);

//   ImGui.PopID();

//   return valueUpdated;
// }

// function InputTransformImpl (value: Transform, width: number, allowScaleEditing: boolean): boolean {
//   let valueUpdated = false;

//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.CellPadding, new ImGui.ImVec2(0, 2));
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));

//   if (ImGui.BeginTable('Transform', 2, ImGui.ImGuiTableFlags.None, new ImGui.ImVec2(width, 0))) {
//     ImGui.TableSetupColumn('Header', ImGui.ImGuiTableColumnFlags.WidthFixed | ImGui.ImGuiTableColumnFlags.NoResize, g_transformLabelColWidth);
//     ImGui.TableSetupColumn('Values', ImGui.ImGuiTableColumnFlags.NoHide | ImGui.ImGuiTableColumnFlags.WidthStretch);

//     ImGui.TableNextRow();
//     {
//       ImGui.TableNextColumn();
//       ImGui.AlignTextToFramePadding();
//       ImGui.Text(ImGuiX.Icons.Rotate360);
//       ImGuiX.TextTooltip('Rotation');

//       ImGui.TableNextColumn();
//       const rotation = value.getRotation().toEulerAngles().toDegrees();

//       if (ImGuiX.InputFloat3('R', rotation)) {
//         value.setRotation(Quaternion.fromEulerAngles(EulerAngles.fromDegrees(rotation)));
//         valueUpdated = true;
//       }
//     }

//     ImGui.TableNextRow();
//     {
//       ImGui.TableNextColumn();
//       ImGui.AlignTextToFramePadding();
//       ImGui.Text(ImGuiX.Icons.AxisArrow);
//       ImGuiX.TextTooltip('Translation');

//       ImGui.TableNextColumn();
//       const translation = value.getTranslation();

//       if (ImGuiX.InputFloat3('T', translation)) {
//         value.setTranslation(translation);
//         valueUpdated = true;
//       }
//     }

//     if (allowScaleEditing) {
//       ImGui.TableNextRow();
//       {
//         ImGui.TableNextColumn();
//         ImGui.AlignTextToFramePadding();
//         ImGui.Text(ImGuiX.Icons.ArrowTopRightBottomLeft);
//         ImGuiX.TextTooltip('Scale');

//         ImGui.TableNextColumn();
//         const scale = { value: value.getScale() };

//         if (DrawFloatEditorWithLabel('##S', '##S', ImGui.GetContentRegionAvail().x, Colors.HotPink, scale)) {
//           value.setScale(scale.value);
//           valueUpdated = true;
//         }
//       }
//     }

//     ImGui.EndTable();
//   }
//   ImGui.PopStyleVar(2);

//   return valueUpdated;
// }

// export function InputTransform (id: string | object, value: Transform, width: number = -1, allowScaleEditing: boolean = true): boolean {
//   ImGui.PushID(id);
//   const valueUpdated = InputTransformImpl(value, width, allowScaleEditing);

//   ImGui.PopID();

//   return valueUpdated;
// }

// export function DrawFloat2 (value: Float2, width: number = -1): void {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const itemSpacing = ImGui.GetStyle().ItemSpacing.x;
//   const inputWidth = Math.floor((contentWidth - itemSpacing) / 2);

//   ImGui.PushID(value);
//   DrawFloatEditorWithLabel('##X', 'X', inputWidth, Colors.MediumRed, { value: value.x }, true);
//   ImGui.SameLine();
//   DrawFloatEditorWithLabel('##Y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y }, true);
//   ImGui.PopID();

//   ImGui.PopStyleVar();
// }

// export function DrawFloat3 (value: Float3, width: number = -1): void {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const itemSpacing = ImGui.GetStyle().ItemSpacing.x;
//   const inputWidth = Math.floor((contentWidth - (itemSpacing * 2)) / 3);

//   ImGui.PushID(value);
//   DrawFloatEditorWithLabel('##X', 'X', inputWidth, Colors.MediumRed, { value: value.x }, true);
//   ImGui.SameLine(0, itemSpacing);
//   DrawFloatEditorWithLabel('##Y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y }, true);
//   ImGui.SameLine(0, itemSpacing);
//   DrawFloatEditorWithLabel('##Z', 'Z', inputWidth, Colors.RoyalBlue, { value: value.z }, true);
//   ImGui.PopID();

//   ImGui.PopStyleVar();
// }

// export function DrawFloat4 (value: Float4, width: number = -1): void {
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   const contentWidth = (width > 0) ? width : ImGui.GetContentRegionAvail().x;
//   const itemSpacing = ImGui.GetStyle().ItemSpacing.x;
//   const inputWidth = Math.floor((contentWidth - (itemSpacing * 3)) / 4);

//   ImGui.PushID(value);
//   DrawFloatEditorWithLabel('##X', 'X', inputWidth, Colors.MediumRed, { value: value.x }, true);
//   ImGui.SameLine(0, itemSpacing);
//   DrawFloatEditorWithLabel('##Y', 'Y', inputWidth, Colors.LimeGreen, { value: value.y }, true);
//   ImGui.SameLine(0, itemSpacing);
//   DrawFloatEditorWithLabel('##Z', 'Z', inputWidth, Colors.RoyalBlue, { value: value.z }, true);
//   ImGui.SameLine(0, itemSpacing);
//   DrawFloatEditorWithLabel('##W', 'W', inputWidth, Colors.DarkOrange, { value: value.w }, true);
//   ImGui.PopID();

//   ImGui.PopStyleVar();
// }

// export function DrawTransform (value: Transform, width: number = -1, showScale: boolean = true): void {
//   ImGui.PushID(value);
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.ItemSpacing, new ImGui.ImVec2(0, ImGui.GetStyle().ItemSpacing.y));
//   ImGui.PushStyleVar(ImGui.ImGuiStyleVar.CellPadding, new ImGui.ImVec2(0, 2));
//   if (ImGui.BeginTable('Transform', 2, ImGui.ImGuiTableFlags.None, new ImGui.ImVec2(width, 0))) {
//     ImGui.TableSetupColumn('Header', ImGui.ImGuiTableColumnFlags.WidthFixed | ImGui.ImGuiTableColumnFlags.NoResize, g_transformLabelColWidth);
//     ImGui.TableSetupColumn('Values', ImGui.ImGuiTableColumnFlags.NoHide | ImGui.ImGuiTableColumnFlags.WidthStretch);

//     ImGui.TableNextRow();
//     {
//       ImGui.TableNextColumn();
//       ImGui.AlignTextToFramePadding();
//       ImGui.Text(ImGuiX.Icons.Rotate360);
//       ImGuiX.TextTooltip('Rotation');

//       ImGui.TableNextColumn();
//       const rotation = value.getRotation().toEulerAngles().toDegrees();

//       ImGuiX.DrawFloat3(rotation);
//     }

//     ImGui.TableNextRow();
//     {
//       ImGui.TableNextColumn();
//       ImGui.AlignTextToFramePadding();
//       ImGui.Text(ImGuiX.Icons.AxisArrow);
//       ImGuiX.TextTooltip('Translation');

//       ImGui.TableNextColumn();
//       const translation = value.getTranslation();

//       ImGuiX.DrawFloat3(translation);
//     }

//     if (showScale) {
//       ImGui.TableNextRow();
//       {
//         ImGui.TableNextColumn();
//         ImGui.AlignTextToFramePadding();
//         ImGui.Text(ImGuiX.Icons.ArrowTopRightBottomLeft);
//         ImGuiX.TextTooltip('Scale');

//         ImGui.TableNextColumn();
//         const scale = value.getScale();

//         DrawFloatEditorWithLabel('##S', '', ImGui.GetContentRegionAvail().x, Colors.HotPink, { value: scale }, true);
//       }
//     }

//     ImGui.EndTable();
//   }
//   ImGui.PopStyleVar(2);
//   ImGui.PopID();
// }

export class FilterData {
  static readonly s_bufferSize: number = 255;

  public m_buffer: string = '';
  private m_tokens: string[] = [];
  private m_filterHelpText: string = 'Filter...';

  public setFilter (filterText: string): void {
    this.m_buffer = filterText.slice(0, FilterData.s_bufferSize);
    this.update();
  }

  public setFilterHelpText (helpText: string): void {
    this.m_filterHelpText = helpText;
  }

  public getFilterHelpText (): string {
    return this.m_filterHelpText;
  }

  public update (): void {
    this.m_tokens = this.m_buffer.toLowerCase().split(/\s+/).filter(token => token.length > 0);
  }

  public clear (): void {
    this.m_buffer = '';
    this.m_tokens = [];
  }

  public hasFilterSet (): boolean {
    return this.m_tokens.length > 0;
  }

  public getFilterTokens (): string[] {
    return this.m_tokens;
  }

  public matchesFilter (str: string): boolean {
    if (str.length === 0) {
      return false;
    }

    if (this.m_tokens.length === 0) {
      return true;
    }

    str = str.toLowerCase();

    return this.m_tokens.every(token => str.includes(token));
  }
}

export class FilterWidget {
  m_ID: UUID = generateGUID();
  private m_data: FilterData = new FilterData();

  public updateAndDraw (width: number = -1, flags: number = 0): boolean {
    let filterUpdated = false;

    ImGui.PushID(this.m_ID);

    if ((flags & FilterWidget.Flags.TakeInitialFocus) !== 0) {
      if (ImGui.IsWindowAppearing()) {
        ImGui.SetKeyboardFocusHere();
      }
    }

    ImGui.SetNextItemWidth(width);
    filterUpdated = InputTextWithClearButton('Input', this.m_data.getFilterHelpText(), (_ = this.m_data.m_buffer)=>this.m_data.m_buffer = _, FilterData.s_bufferSize);

    if (filterUpdated) {
      this.m_data.update();
    }

    ImGui.PopID();

    return filterUpdated;
  }

  public setFilter (filterText: string): void {
    this.m_data.setFilter(filterText);
  }

  public setFilterHelpText (helpText: string): void {
    this.m_data.setFilterHelpText(helpText);
  }

  public clear (): void {
    this.m_data.clear();
  }

  public hasFilterSet (): boolean {
    return this.m_data.hasFilterSet();
  }

  public getFilterTokens (): string[] {
    return this.m_data.getFilterTokens();
  }

  public matchesFilter (str: string): boolean {
    return this.m_data.matchesFilter(str);
  }

  static Flags = {
    TakeInitialFocus: 1 << 0,
  };
}

// export class OrientationGuide {
//   static readonly g_windowPadding: number = 4.0;
//   static readonly g_windowRounding: number = 2.0;
//   static readonly g_guideDimension: number = 55.0;
//   static readonly g_axisHeadRadius: number = 3.0;
//   static readonly g_axisHalfLength: number = (OrientationGuide.g_guideDimension / 2) - OrientationGuide.g_axisHeadRadius - 4.0;
//   static readonly g_worldRenderDistanceZ: number = 5.0;
//   static readonly g_axisThickness: number = 2.0;

//   static getSize (): Float2 {
//     return new Float2(OrientationGuide.g_guideDimension, OrientationGuide.g_guideDimension);
//   }

//   static getWidth (): number {
//     return OrientationGuide.g_guideDimension / 2;
//   }

//   static draw (guideOrigin: Float2, viewport: Viewport): void {
//     // Implementation of draw method...
//     // This would require a more complex translation of the 3D to 2D projection logic
//   }
// }

// export class ApplicationTitleBar {
//   static readonly s_windowControlButtonWidth: number = 45;
//   static readonly s_minimumDraggableGap: number = 24;
//   static readonly s_sectionPadding: number = 8;

//   private m_rect: Math.ScreenSpaceRectangle = new Math.ScreenSpaceRectangle();

//   static getWindowsControlsWidth (): number {
//     return ApplicationTitleBar.s_windowControlButtonWidth * 3;
//   }

//   static drawWindowControls (): void {
//     // Implementation of drawWindowControls method...
//   }

//   draw (menuSectionDrawFunction: (() => void) | null = null, menuSectionWidth: number = 0, controlsSectionDrawFunction: (() => void) | null = null, controlsSectionWidth: number = 0): void {
//     // Implementation of draw method...
//   }

//   getScreenRectangle (): Math.ScreenSpaceRectangle {
//     return this.m_rect;
//   }
// }
